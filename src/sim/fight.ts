import { maxHp, repairShip, totalHp } from './damage';
import type { EnemyKey } from './enemies';
import { HULLS } from './hulls';
import { yawTo } from './math';
import { TURRETS, mountTurret, type TurretKey } from './turrets';
import type { HullKey, PlayerWorld, Ship, SimEvent, Vec2, World } from './types';
import { objectById, offset, respawnPlayer, spawnEnemy, spawnPirate, spawnSignalPirates } from './world';

/** Враг в бою: тип, имя (если врагов одного типа несколько), группа и место относительно точки боя. */
export interface FightEnemy {
  key: EnemyKey;
  name?: string;
  /** группа: заметил один — нападают все */
  group?: string;
  /** своя дальность обнаружения, м (по умолчанию — из типа врага) */
  aggro?: number;
  /** расстояние от точки боя, м, и направление, градусы */
  d: number;
  deg: number;
}

/** Бой как задача — данными: где идёт, кто ждёт, откуда начинает игрок. Цель — уничтожить всех. */
export interface FightDef {
  key: string;
  name: string;
  /** коротко, о чём бой — в списке боёв и на подготовке */
  brief: string;
  /** точка боя: у объекта at, на расстоянии d по направлению deg (градусы) */
  at: string;
  d: number;
  deg: number;
  enemies: FightEnemy[];
  /** откуда начинает игрок — от точки боя; дальше, чем враги замечают, чтобы подлёт был решением */
  start: { d: number; deg: number };
}

export interface FightStats {
  /** выстрелов игрока и попаданий */
  shots: number;
  hits: number;
  /** урон, нанесённый игроком и полученный им */
  dealt: number;
  taken: number;
  /** уничтожено врагов */
  killed: number;
}

export interface FightResult extends FightStats {
  win: boolean;
  /** секунд от вылета */
  time: number;
  /** доля прочности, оставшаяся у игрока */
  hpLeft: number;
  /** сколько врагов сбежало в варп */
  fled: number;
  total: number;
}

export interface Fight {
  def: FightDef;
  hull: HullKey;
  gun: TurretKey;
  startTime: number;
  enemyIds: string[];
  stats: FightStats;
  result: FightResult | null;
}

/** Точка боя в мире. */
export function fightPoint(world: World, def: FightDef): Vec2 {
  return offset(objectById(world, def.at)!.pos, def.d, def.deg);
}

/** Убирает всех врагов и обломки уничтоженных кораблей (неподвижные обломки сигнала остаются). */
function clearCombat(world: World): void {
  const gone = world.ships.filter((s) => s.faction === 'pirate');
  for (const s of gone) delete world.byId[s.id];
  world.ships = world.ships.filter((s) => s.faction !== 'pirate');
  for (const o of world.objects) if (o.id.startsWith('wreck-')) delete world.byId[o.id];
  world.objects = world.objects.filter((o) => !o.id.startsWith('wreck-'));
  world.events.length = 0;
}

/** Ставит корабль игрока целым, с выбранным корпусом и турелью, неподвижным. */
function refit(s: Ship, hull: HullKey, gun: TurretKey): void {
  Object.assign(s, { hull: HULLS[hull], dead: false, speed: 0, angVel: 0, order: { type: 'stop' }, warp: null, align: null, attack: null, lock: null });
  s.turrets = [mountTurret(TURRETS[gun])];
  repairShip(s);
}

/**
 * Вылет на бой: врагов прежнего боя и свободного полёта убирает, ставит врагов этого боя,
 * игрока — с выбранным фитом, целым, в точке старта носом к врагам. «Ещё раз» — тот же вызов.
 */
export function startFight(world: PlayerWorld, def: FightDef, hull: HullKey, gun: TurretKey): Fight {
  clearCombat(world);
  const at = fightPoint(world, def);
  const enemyIds = def.enemies.map((e, i) => {
    const s = spawnEnemy(world, e.key, `${def.key}-${i + 1}`, offset(at, e.d, e.deg), (e.deg + 180) * (Math.PI / 180));
    if (e.name) s.name = e.name;
    if (e.group) s.ai!.group = e.group;
    if (e.aggro) s.ai!.def = { ...s.ai!.def, aggro: e.aggro };
    return s.id;
  });
  const p = world.player;
  refit(p, hull, gun);
  p.pos = offset(at, def.start.d, def.start.deg);
  p.yaw = yawTo(at.x - p.pos.x, at.z - p.pos.z);
  return { def, hull, gun, startTime: world.time, enemyIds, stats: { shots: 0, hits: 0, dealt: 0, taken: 0, killed: 0 }, result: null };
}

/** Враг вышел из боя: уничтожен, ушёл в варп или уже ушёл. */
function enemyOut(world: World, id: string): boolean {
  const s = world.byId[id];
  if (!s || s.type !== 'ship' || s.dead) return true;
  return s.ai?.state === 'gone' || (s.ai?.state === 'flee' && !!s.warp);
}

/**
 * Учитывает события шага (выстрелы, уничтожения) и проверяет конец боя:
 * игрок уничтожен — поражение, все враги уничтожены или сбежали — победа. Возвращает итог, когда бой окончен.
 */
export function updateFight(world: PlayerWorld, f: Fight, events: SimEvent[]): FightResult | null {
  if (f.result) return f.result;
  const st = f.stats;
  for (const e of events) {
    if (e.type === 'shot' && e.ship === 'player') { st.shots++; if (e.hit) { st.hits++; st.dealt += e.damage; } }
    if (e.type === 'shot' && e.target === 'player' && e.hit) st.taken += e.damage;
    if (e.type === 'destroyed' && f.enemyIds.includes(e.ship)) st.killed++;
  }
  const p = world.player, lost = p.dead, won = !lost && f.enemyIds.every((id) => enemyOut(world, id));
  if (!lost && !won) return null;
  f.result = {
    ...st, win: won, time: world.time - f.startTime, hpLeft: lost ? 0 : totalHp(p) / maxHp(p),
    fled: won ? f.enemyIds.length - st.killed : 0, total: f.enemyIds.length,
  };
  return f.result;
}

/** Из боя — в свободный полёт: враги боя убраны, пираты на своих местах, игрок у станции, целый, с тем же фитом. */
export function endFight(world: PlayerWorld): void {
  clearCombat(world);
  spawnPirate(world);
  spawnSignalPirates(world);
  respawnPlayer(world);
}
