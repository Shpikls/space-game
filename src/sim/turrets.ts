import type { TurretDef } from './types';

export const TURRETS = {
  light: { key: 'light', name: 'Лёгкая турель', damage: 100, cycle: 2, range: 20e3 },
} satisfies Record<string, TurretDef>;
