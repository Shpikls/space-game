import { ORE_PRICES } from '../data/world';
import type { OreId } from '../data/types';
import type { GameState } from './state';

/** Продаёт всю руду данного типа на текущей станции. Возвращает выручку. */
export function sellOre(game: GameState, ore: OreId): number {
  const prices = ORE_PRICES[game.sys];
  if (!prices || !game.docked) return 0;
  const sum = game.cargo[ore] * prices[ore];
  game.credits += sum;
  game.cargo[ore] = 0;
  return sum;
}
