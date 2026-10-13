import { stepAI } from './ai';
import { removeDead, stepWeapons } from './combat';
import { regenShield } from './damage';
import { stepShip } from './ship';
import type { World } from './types';

/** Продвигает мир на dt секунд мелкими шагами не длиннее 0,02 с. */
export function step(world: World, dt: number): void {
  // Первый кадр браузера бывает с отметкой времени раньше запуска скрипта. Назад время не идёт:
  // иначе «тормозящий» корабль разгоняется (в прототипе это давало стоящему фрегату 20 м/с)
  if (!(dt > 0)) return;
  const n = Math.max(1, Math.ceil(dt / 0.02)), h = dt / n;
  for (let i = 0; i < n; i++) {
    for (const s of world.ships) stepAI(world, s, h);
    for (const s of world.ships) if (!s.dead) stepShip(world, s, h);
    for (const s of world.ships) regenShield(s, h);
    for (const s of world.ships) stepWeapons(world, s, h);
    removeDead(world);
    world.time += h;
  }
}
