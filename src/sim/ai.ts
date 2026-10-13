import { setAttack, weaponRange } from './combat';
import type { Ship, World } from './types';
import { surfaceDistance } from './world';

/**
 * Простейший ИИ пирата: стоит на месте и открывает огонь по игроку, как только тот подлетел на дальность его турелей.
 * Двигаться и выбирать дистанцию враги начнут позже (веха 1, пункт 5).
 */
export function stepAI(world: World, s: Ship): void {
  if (s.faction !== 'pirate' || s.dead || s.attack) return;
  const p = world.player;
  if (!p || p.dead || p.warp) return;
  if (surfaceDistance(s, p) <= weaponRange(s)) setAttack(world, s, p.id);
}
