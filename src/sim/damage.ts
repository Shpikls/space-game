import type { Ship, SpaceObject, World } from './types';

/** Урон снимает сначала щит, потом броню, потом корпус. */
export function applyDamage(t: Ship, dmg: number): void {
  let left = dmg;
  const take = (v: number) => { const d = Math.min(v, left); left -= d; return v - d; };
  t.shield = take(t.shield);
  t.armor = take(t.armor);
  t.structure = take(t.structure);
}

export const totalHp = (s: Ship) => s.shield + s.armor + s.structure;
export const maxHp = (s: Ship) => s.hull.shield + s.hull.armor + s.hull.structure;

/** Полностью чинит корабль: щит, броня и корпус. */
export function repairShip(s: Ship): void {
  s.shield = s.hull.shield;
  s.armor = s.hull.armor;
  s.structure = s.hull.structure;
}

/** Щит восстанавливается сам, равномерно: от нуля до полного за hull.shieldRecharge секунд. */
export function regenShield(s: Ship, dt: number): void {
  if (s.dead) return;
  s.shield = Math.min(s.hull.shield, s.shield + (s.hull.shield / s.hull.shieldRecharge) * dt);
}

/**
 * Наносит урон; если корпус кончился — корабль уничтожен: событие и обломки на его месте.
 * Чужие корабли убираются из мира в конце шага, корабль игрока остаётся (ждёт нового вылета).
 */
export function damageShip(world: World, t: Ship, dmg: number, by: string): void {
  if (t.dead) return;
  applyDamage(t, dmg);
  if (t.structure > 0) return;
  t.dead = true;
  t.speed = 0;
  t.attack = null;
  world.events.push({ type: 'destroyed', ship: t.id, name: t.name, by, pos: { ...t.pos }, size: t.hull.size });
  const wreck: SpaceObject = {
    id: `wreck-${t.id}-${Math.round(world.time * 1000)}`, name: 'Обломки: ' + t.name, type: 'wreck', local: true,
    pos: { ...t.pos }, radius: t.hull.size * 0.6, seed: 77,
  };
  world.objects.push(wreck); world.byId[wreck.id] = wreck;
}
