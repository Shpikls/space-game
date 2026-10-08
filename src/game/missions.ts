import type { EnemyId, SystemId } from '../data/types';
import { range, type Rng } from '../sim/rng';
import type { GameState, Mission } from './state';

const TITLES = ['Пиратская засада', 'Зачистка маршрута', 'Логово налётчиков', 'Перехват контрабандистов', 'Сигнал бедствия', 'Охота за наградой'];
const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)] as T;

type Comp = Partial<Record<EnemyId, number>>;

export function generateMission(id: number, rng: Rng): Mission {
  const r = rng();
  let level: Mission['level'];
  let sys: SystemId;
  let comp: Comp;
  let reward: number;
  if (r < 0.5) {
    level = 1; sys = pick(rng, ['alpha', 'beta'] as const);
    comp = pick<Comp>(rng, [{ light: 3 }, { heavy: 2 }]); reward = range(rng, 1200, 1700);
  } else if (r < 0.85) {
    level = 2; sys = 'gamma';
    comp = pick<Comp>(rng, [{ light: 5 }, { heavy: 3 }, { heavy: 2, light: 2 }]); reward = range(rng, 3000, 4200);
  } else {
    level = 3; sys = 'delta';
    comp = pick<Comp>(rng, [{ heavy: 3, light: 4 }, { heavy: 4, light: 2 }]); reward = range(rng, 7000, 9500);
  }
  return {
    id, level, sys, comp: { heavy: comp.heavy ?? 0, light: comp.light ?? 0 },
    reward: Math.round(reward / 50) * 50, title: pick(rng, TITLES),
  };
}

/** Дополняет доску заданий станции до трёх. */
export function ensureBoard(game: GameState, station: SystemId, rng: Rng): Mission[] {
  const board = game.boards[station] ?? (game.boards[station] = []);
  while (board.length < 3) board.push(generateMission(++game.mid, rng));
  return board;
}
