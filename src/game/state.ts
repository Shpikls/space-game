import type { EnemyId, ModuleId, OreId, ShipId, SlotKind, SystemId } from '../data/types';

export type Fit = Record<SlotKind, ModuleId[]>;

export interface Mission {
  id: number;
  level: 1 | 2 | 3;
  sys: SystemId;
  comp: Record<EnemyId, number>;
  reward: number;
  title: string;
}

export interface GameState {
  v: 1;
  credits: number;
  sys: SystemId;
  lastStation: SystemId;
  docked: boolean;
  ships: Record<ShipId, boolean>;
  active: ShipId;
  fits: Record<ShipId, Fit>;
  owned: Partial<Record<ModuleId, boolean>>;
  cargo: Record<OreId, number>;
  boards: Partial<Record<SystemId, Mission[]>>;
  mission: Mission | null;
  mid: number;
}

export function newGame(): GameState {
  return {
    v: 1, credits: 1500, sys: 'alpha', lastStation: 'alpha', docked: true,
    ships: { frigate: true, cruiser: false }, active: 'frigate',
    fits: {
      frigate: { weapon: ['kinetic', 'energy'], def: ['plate'], util: ['none'] },
      cruiser: { weapon: ['kinetic', 'kinetic', 'energy'], def: ['plate', 'plate'], util: ['none'] },
    },
    owned: { kinetic: true, energy: true, plate: true, none: true },
    cargo: { ferite: 0, indarite: 0 }, boards: {}, mission: null, mid: 0,
  };
}
