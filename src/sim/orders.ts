import type { Order, Ship, World } from './types';
import { canWarpTo } from './world';

/** Отдаёт приказ кораблю. false — приказ недоступен (в варпе или до цели варпа слишком близко). */
export function issueOrder(world: World, s: Ship, order: Order): boolean {
  if (s.warp || s.dead) return false; // варп нельзя прервать
  if (order.type === 'warp' && !canWarpTo(world, s, world.byId[order.target])) return false;
  s.order = order; s.align = null;
  return true;
}
