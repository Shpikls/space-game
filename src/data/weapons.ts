import type { DamageType, Layer, Weapon } from './types';

/** сигнатура, при которой tracking оружия применяется «как есть» */
export const SIG_BASE = 60;

export const WEAPONS: Record<DamageType, Weapon> = {
  kinetic: { id: 'kinetic', name: 'Рельса', dmg: 26, cycle: 2.0, optimal: 700, falloff: 250, tracking: 0.18, color: '#ffe08a' },
  energy: { id: 'energy', name: 'Лазер', dmg: 18, cycle: 1.4, optimal: 420, falloff: 120, tracking: 0.9, color: '#c4a0ff' },
};

/** множитель урона по слою защиты */
export const DAMAGE_MULT: Record<DamageType, Record<Layer, number>> = {
  kinetic: { armor: 1.5, hull: 0.8 },
  energy: { armor: 0.6, hull: 1.5 },
};

export const MINER = { cycle: 5, yield: 3, range: 250, color: '#7ee0a1' } as const;

/** ремонт брони: сколько и как часто */
export const REPAIR = { amount: 30, cycle: 4 } as const;
