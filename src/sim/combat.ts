import { clamp, wrap, yawTo } from './math';
import { AIM_TOLERANCE, slewRate } from './turrets';
import type { Ship, SpaceObject, Turret, World } from './types';
import { surfaceDistance } from './world';

/** Дальность самой дальнобойной турели корабля (0 — турелей нет). */
export const weaponRange = (s: Ship) => Math.max(0, ...s.turrets.map((t) => t.def.range));

/**
 * Назначает цель атаки (null — прекратить огонь). Атака не трогает приказ движения:
 * куда лететь и кого бить — два независимых решения.
 */
export function setAttack(world: World, s: Ship, targetId: string | null): boolean {
  if (s.warp) return false;
  if (targetId === null) { s.attack = null; return true; }
  const t = world.byId[targetId];
  if (!t || t.type !== 'ship' || t === s || t.dead) return false;
  s.attack = targetId;
  return true;
}

/** Цель атаки, если она ещё существует. */
function attackTarget(world: World, s: Ship): Ship | null {
  const t = s.attack ? world.byId[s.attack] : undefined;
  return t && t.type === 'ship' && !t.dead ? t : null;
}

/** Куда должен смотреть ствол (относительно носа), чтобы попасть в цель. */
const aimTo = (s: Ship, t: Ship) => wrap(yawTo(t.pos.x - s.pos.x, t.pos.z - s.pos.z) - s.yaw);

/** Поворачивает башню к нужному углу не быстрее её скорости поворота. */
function rotateTurret(tr: Turret, want: number, dt: number) {
  const mx = slewRate(tr.def) * dt;
  tr.aim = wrap(tr.aim + clamp(wrap(want - tr.aim), -mx, mx));
}

/** Скорость корабля вектором: летит носом вперёд, в варпе — по направлению варпа. */
function velocity(s: Ship): { x: number; z: number } {
  if (s.warp) return { x: s.warp.dx * s.warp.v, z: s.warp.dz * s.warp.v };
  return { x: Math.sin(s.yaw) * s.speed, z: Math.cos(s.yaw) * s.speed };
}

/** Угловая скорость цели, как её видит стрелок: поперечная скорость / расстояние, рад/с. */
export function angularVelocity(s: Ship, t: Ship): number {
  const rx = t.pos.x - s.pos.x, rz = t.pos.z - s.pos.z, d = Math.hypot(rx, rz) || 1;
  const vs = velocity(s), vt = velocity(t);
  const transversal = Math.abs(rx * (vt.z - vs.z) - rz * (vt.x - vs.x)) / d;
  return transversal / d;
}

/**
 * Шанс попадания, как в EVE: 0,5 в степени ((угловая скорость / скорость наведения) × (калибр / сигнатура цели))².
 * Неподвижная цель — 100%. Быстро смещающаяся мелкая цель для крупного медленного калибра — почти 0%.
 */
export function hitChance(s: Ship, tr: Turret, t: Ship): number {
  const term = (angularVelocity(s, t) / tr.def.tracking) * (tr.def.signatureResolution / t.hull.signature);
  return Math.pow(0.5, term * term);
}

export type AttackStatus = 'none' | 'far' | 'aiming' | 'firing';

/** Что сейчас с атакой: нет цели, цель дальше дальности, башня наводится, ведётся огонь. */
export function attackStatus(world: World, s: Ship): AttackStatus {
  const t = attackTarget(world, s);
  if (!t || s.turrets.length === 0) return 'none';
  const d = surfaceDistance(s, t);
  const ready = s.turrets.filter((tr) => d <= tr.def.range);
  if (ready.length === 0) return 'far';
  const want = aimTo(s, t);
  return ready.some((tr) => Math.abs(wrap(want - tr.aim)) <= AIM_TOLERANCE) ? 'firing' : 'aiming';
}

/** Шанс попадания сейчас: лучший среди турелей, которые достают до цели (null — некого или нечем). */
export function currentHitChance(world: World, s: Ship): number | null {
  const t = attackTarget(world, s);
  if (!t) return null;
  const d = surfaceDistance(s, t);
  const ready = s.turrets.filter((tr) => d <= tr.def.range);
  return ready.length ? Math.max(...ready.map((tr) => hitChance(s, tr, t))) : null;
}

/**
 * Турели перезаряжаются всегда. Башня поворачивается к цели (без цели — обратно вперёд)
 * и стреляет, когда навелась, перезарядилась и цель в пределах дальности.
 */
export function stepWeapons(world: World, s: Ship, dt: number): void {
  for (const tr of s.turrets) tr.cooldown = Math.max(0, tr.cooldown - dt);
  const t = s.warp ? null : attackTarget(world, s);
  if (s.attack && !t && !s.warp) s.attack = null;
  if (!t) { for (const tr of s.turrets) rotateTurret(tr, 0, dt); return; }
  const want = aimTo(s, t), d = surfaceDistance(s, t);
  for (let i = 0; i < s.turrets.length; i++) {
    const tr = s.turrets[i]!;
    rotateTurret(tr, want, dt);
    if (tr.cooldown > 0 || d > tr.def.range || Math.abs(wrap(want - tr.aim)) > AIM_TOLERANCE) continue;
    tr.cooldown = tr.def.cycle;
    const chance = hitChance(s, tr, t), hit = world.rng() < chance;
    if (hit) t.structure = Math.max(0, t.structure - tr.def.damage);
    world.events.push({ type: 'shot', ship: s.id, target: t.id, turret: i, hit, chance, damage: hit ? tr.def.damage : 0, from: { ...s.pos }, to: { ...t.pos } });
    if (t.structure <= 0) {
      t.dead = true;
      world.events.push({ type: 'destroyed', ship: t.id, name: t.name, by: s.id, pos: { ...t.pos }, size: t.hull.size });
      break;
    }
  }
}

/** Убирает уничтоженные корабли; на их месте остаются обломки. */
export function removeDead(world: World): void {
  if (!world.ships.some((s) => s.dead)) return;
  for (const d of world.ships) {
    if (!d.dead) continue;
    delete world.byId[d.id];
    const wreck: SpaceObject = {
      id: `wreck-${d.id}-${Math.round(world.time * 1000)}`, name: 'Обломки: ' + d.name, type: 'wreck', local: true,
      pos: { ...d.pos }, radius: d.hull.size * 0.6, seed: 77,
    };
    world.objects.push(wreck); world.byId[wreck.id] = wreck;
  }
  world.ships = world.ships.filter((s) => !s.dead);
  for (const s of world.ships) if (s.attack && !world.byId[s.attack]) s.attack = null;
}
