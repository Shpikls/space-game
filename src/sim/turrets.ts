import { DEG } from './constants';
import type { Turret, TurretDef } from './types';

export const TURRETS = {
  light: { key: 'light', name: 'Лёгкая турель', damage: 100, cycle: 2, range: 20e3, tracking: 30 * DEG },
} satisfies Record<string, TurretDef>;

/** Стреляет, только когда ствол смотрит на цель с этой точностью. */
export const AIM_TOLERANCE = 2 * DEG;

export const mountTurret = (def: TurretDef): Turret => ({ def, cooldown: 0, aim: 0 });
