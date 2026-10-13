import { stepShip } from './ship';
import type { Order, Ship, World } from './types';
import { canWarpTo } from './world';

/** Отдаёт приказ кораблю. false — приказ недоступен (в варпе или до цели варпа слишком близко). */
export function issueOrder(world: World, s: Ship, order: Order): boolean {
  if (s.warp) return false; // варп нельзя прервать
  if (order.type === 'warp' && !canWarpTo(world, s, world.byId[order.target])) return false;
  s.order = order; s.align = null;
  return true;
}

/** Продвигает мир на dt секунд мелкими шагами не длиннее 0,02 с. */
export function step(world: World, dt: number): void {
  // Первый кадр браузера бывает с отметкой времени раньше запуска скрипта. Назад время не идёт:
  // иначе «тормозящий» корабль разгоняется (в прототипе это давало стоящему фрегату 20 м/с)
  if (!(dt > 0)) return;
  const n = Math.max(1, Math.ceil(dt / 0.02)), h = dt / n;
  for (let i = 0; i < n; i++) {
    for (const s of world.ships) stepShip(world, s, h);
    world.time += h;
  }
}
