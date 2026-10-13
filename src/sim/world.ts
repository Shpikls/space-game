import { AU, DEG, MIN_WARP } from './constants';
import { HULLS, isHullKey } from './hulls';
import { yawTo } from './math';
import { rng } from './rng';
import type { Entity, Faction, HullKey, PlanetLook, PlayerWorld, Ship, SpaceObject, Vec2, World } from './types';

export interface WorldOptions {
  seed?: number;
  hull?: string;
  /** id объекта, у которого появляется игрок */
  at?: string;
}

export const emptyWorld = (): World => ({
  time: 0, timeScale: 1, objects: [], ships: [], byId: {}, events: [], debug: { instantWarp: false }, player: null,
});

/** Система «Ксанта»: звезда, пять планет, станция, пояс, сигнал с обломками и два NPC. */
export function createWorld(opts: WorldOptions = {}): PlayerWorld {
  const world = emptyWorld();
  const r = rng(opts.seed || 7);
  const add = (o: SpaceObject) => { world.objects.push(o); world.byId[o.id] = o; return o; };
  const polar = (au: number, deg: number): Vec2 => ({ x: Math.sin(deg * DEG) * au * AU, z: Math.cos(deg * DEG) * au * AU });
  const off = (p: Vec2, d: number, deg: number): Vec2 => ({ x: p.x + Math.sin(deg * DEG) * d, z: p.z + Math.cos(deg * DEG) * d });

  add({ id: 'star', name: 'Ксанта', type: 'star', celestial: true, pos: { x: 0, z: 0 }, radius: 6.5e8, warpIn: 6.5e8 * 5 });
  const planets: [string, string, PlanetLook, number, number, number][] = [
    ['p1', 'Ксанта I', 'rock', 2.6, 40, 2.4e6],
    ['p2', 'Ксанта II', 'terran', 6.8, 155, 6.4e6],
    ['p3', 'Ксанта III', 'gas', 13.5, 262, 5.8e7],
    ['p4', 'Ксанта IV', 'ice', 24, 330, 2.4e7],
    ['p5', 'Ксанта V', 'red', 37, 95, 3.1e6],
  ];
  for (const [id, name, look, au, deg, rad] of planets) {
    add({ id, name, type: 'planet', look, celestial: true, pos: polar(au, deg), radius: rad, warpIn: rad * 2.3 });
  }
  const p2 = objectById(world, 'p2')!, p3 = objectById(world, 'p3')!;
  const station = add({ id: 'station', name: 'Станция «Причал Ксанты»', type: 'station', celestial: true, local: true,
    pos: off(p2.pos, 2.6e7, 220), radius: 1600, warpIn: 2600 });
  const belt = add({ id: 'belt', name: 'Пояс астероидов III-1', type: 'belt', celestial: true, pos: off(p3.pos, 1.7e8, 30), radius: 0, warpIn: 2500 });
  const kinds = ['Железистый', 'Кремниевый', 'Ледяной', 'Углистый'];
  for (let i = 0; i < 14; i++) {
    add({ id: 'ast' + i, name: kinds[i % 4] + ' астероид ' + (i + 1), type: 'asteroid', local: true,
      pos: off(belt.pos, 5e3 + r() * 24e3, r() * 360), radius: 250 + r() * 1100, seed: i + 11 });
  }
  const signal = add({ id: 'signal', name: 'Сигнал: обломки конвоя', type: 'signal', celestial: true, pos: polar(18.5, 205), radius: 0, warpIn: 3000 });
  for (let i = 0; i < 6; i++) {
    add({ id: 'wreck' + i, name: 'Обломки транспорта ' + (i + 1), type: 'wreck', local: true,
      pos: off(signal.pos, 1.5e3 + r() * 7e3, r() * 360), radius: 90 + r() * 120, seed: i + 40 });
  }

  // Корабли NPC используют те же приказы, что и игрок
  const npc1 = addShip(world, 'npc1', 'Патруль «Скат»', 'frigate', off(station.pos, 6.6e3, 90), 0, 'npc');
  npc1.order = { type: 'orbit', target: 'station', range: 5e3 };
  const npc2 = addShip(world, 'npc2', 'Грузовик «Ирбис»', 'cruiser', off(station.pos, 12.6e3, 250), 0, 'npc');
  npc2.order = { type: 'orbit', target: 'station', range: 11e3 };

  const player = addShip(world, 'player', 'Ваш корабль', isHullKey(opts.hull) ? opts.hull : 'cruiser', { x: 0, z: 0 }, 0, 'player');
  world.player = player;
  teleport(world, player, opts.at || 'station');
  return world as PlayerWorld;
}

export function addShip(world: World, id: string, name: string, hullKey: HullKey, pos: Vec2, yaw: number, faction: Faction): Ship {
  const s: Ship = { id, name, type: 'ship', faction, hull: HULLS[hullKey], pos: { x: pos.x, z: pos.z }, yaw, angVel: 0, speed: 0,
    order: { type: 'stop' }, warp: null, align: null, radius: 0 };
  world.ships.push(s); world.byId[id] = s; return s;
}

/** Объект мира (не корабль) по id. */
export function objectById(world: World, id: string): SpaceObject | undefined {
  const e = world.byId[id];
  return e && e.type !== 'ship' ? e : undefined;
}

/** Точка выхода из варпа: на прямой от цели к кораблю, в warpIn + dist от центра цели. */
export function landingPoint(tgt: SpaceObject, from: Vec2, dist: number): Vec2 {
  let dx = from.x - tgt.pos.x, dz = from.z - tgt.pos.z;
  let d = Math.hypot(dx, dz);
  if (d < 1) { dx = 0; dz = 1; d = 1; }
  const k = ((tgt.warpIn ?? 0) + dist) / d;
  return { x: tgt.pos.x + dx * k, z: tgt.pos.z + dz * k };
}

/** Мгновенно ставит корабль у объекта (неизвестный id — у станции). */
export function teleport(world: World, s: Ship, id: string): void {
  const tgt = objectById(world, id) ?? objectById(world, 'station')!;
  const extra = tgt.type === 'station' ? 5e3 : 0;
  const p = landingPoint(tgt, { x: tgt.pos.x + 1e9, z: tgt.pos.z - 3e9 }, extra);
  s.pos = p; s.warp = null; s.speed = 0; s.angVel = 0; s.order = { type: 'stop' }; s.align = null;
  s.yaw = yawTo(tgt.pos.x - p.x, tgt.pos.z - p.z) + 1.1;
}

/** Расстояние до поверхности цели (до центра минус радиус). */
export function surfaceDistance(a: Entity, b: Entity): number {
  const d = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
  return Math.max(0, d - (b.radius || 0));
}

export function canWarpTo(_world: World, s: Ship, tgt: Entity | undefined): tgt is SpaceObject {
  return !!tgt && tgt.type !== 'ship' && !!tgt.celestial && surfaceDistance(s, tgt) > MIN_WARP;
}
