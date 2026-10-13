import type { HullKey } from './types';
import type { TurretKey } from './turrets';

/**
 * Типы врагов — данными. ИИ отдаёт те же приказы, что и игрок; тип задаёт, какие:
 * hold — стоять на месте, keep — держать дистанцию, orbit — кружить вокруг цели.
 */
export interface EnemyDef {
  key: string;
  name: string;
  /** кто это для игрока — показывается в карточке цели */
  role: string;
  hull: HullKey;
  gun: TurretKey;
  behavior: 'hold' | 'keep' | 'orbit';
  /** дистанция для keep и orbit, м */
  range: number;
  /** с какого расстояния замечает игрока, м */
  aggro: number;
  /** через сколько секунд после того, как заметил, начинает бой */
  reaction: number;
  /** уходит в варп, когда прочности остаётся меньше этой доли (null — бьётся до конца) */
  fleeBelow: number | null;
}

export const ENEMIES = {
  jackal: { key: 'jackal', name: 'Пират «Шакал»', role: 'стоит на месте', hull: 'frigate', gun: 'light', behavior: 'hold', range: 0, aggro: 20e3, reaction: 0, fleeBelow: null },
  wasp: { key: 'wasp', name: 'Брулер «Оса»', role: 'брулер — вьётся вплотную', hull: 'frigate', gun: 'light', behavior: 'orbit', range: 2e3, aggro: 40e3, reaction: 1.5, fleeBelow: null },
  viper: { key: 'viper', name: 'Снайпер «Гюрза»', role: 'снайпер — держит дистанцию', hull: 'frigate', gun: 'heavy', behavior: 'keep', range: 30e3, aggro: 45e3, reaction: 2.5, fleeBelow: 0.4 },
} satisfies Record<string, EnemyDef>;

export type EnemyKey = keyof typeof ENEMIES;
