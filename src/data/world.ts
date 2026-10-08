import type { OreId, Security, SystemDef, SystemId } from './types';

export const SECURITY: Record<Security, { label: string; color: string }> = {
  high: { label: 'Безопасно', color: '#5fd39a' },
  mid: { label: 'Умеренно', color: '#f2c14e' },
  low: { label: 'Опасно', color: '#ff6f7d' },
};

export const SYSTEMS: Record<SystemId, SystemDef> = {
  alpha: { name: 'Альфа', sec: 'high', station: 'Альфа-Порт', belt: { ferite: 1 }, rich: 0.8, pirate: 0, links: ['beta', 'gamma'], pos: [16, 50] },
  beta: { name: 'Бета', sec: 'high', station: null, belt: { ferite: 1 }, rich: 1.2, pirate: 0.08, links: ['alpha', 'gamma'], pos: [40, 16] },
  gamma: { name: 'Гамма', sec: 'mid', station: 'Гамма-Кузня', belt: { ferite: 0.7, indarite: 0.3 }, rich: 1.0, pirate: 0.3, links: ['alpha', 'beta', 'delta'], pos: [60, 56] },
  delta: { name: 'Дельта', sec: 'low', station: null, belt: { ferite: 0.3, indarite: 0.7 }, rich: 1.3, pirate: 0.55, links: ['gamma'], pos: [86, 26] },
};

export const ORES: Record<OreId, { name: string; color: string }> = {
  ferite: { name: 'Ферит', color: '#b8c2d6' },
  indarite: { name: 'Индарит', color: '#b48cff' },
};

/** цены скупки руды по станциям (ключ — система станции) */
export const ORE_PRICES: Partial<Record<SystemId, Record<OreId, number>>> = {
  alpha: { ferite: 10, indarite: 38 },
  gamma: { ferite: 8, indarite: 52 },
};
