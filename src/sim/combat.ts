import type { Ship, SpaceObject, World } from './types';
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

/** Турели перезаряжаются всегда, а стреляют, когда цель жива и в пределах дальности. */
export function stepWeapons(world: World, s: Ship, dt: number): void {
  for (const tr of s.turrets) tr.cooldown = Math.max(0, tr.cooldown - dt);
  if (s.warp || !s.attack) return;
  const t = world.byId[s.attack];
  if (!t || t.type !== 'ship' || t.dead) { s.attack = null; return; }
  const d = surfaceDistance(s, t);
  for (const tr of s.turrets) {
    if (tr.cooldown > 0 || d > tr.def.range) continue;
    tr.cooldown = tr.def.cycle;
    t.structure = Math.max(0, t.structure - tr.def.damage);
    world.events.push({ type: 'shot', ship: s.id, target: t.id, damage: tr.def.damage });
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
