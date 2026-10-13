import { DEG } from './constants';
import type { Turret, TurretDef } from './types';

export const TURRETS = {
  // быстро наводится и попадает по мелким юрким целям, но бьёт слабо и недалеко
  light: { key: 'light', name: 'Лёгкая турель', damage: 100, cycle: 2, range: 20e3, tracking: 30 * DEG, signatureResolution: 40 },
  // вдвое больше урона в секунду и вдвое дальше, но медленно наводится и мажет по мелким и быстрым целям
  heavy: { key: 'heavy', name: 'Тяжёлая турель', damage: 450, cycle: 5, range: 40e3, tracking: 6 * DEG, signatureResolution: 300 },
} satisfies Record<string, TurretDef>;

export type TurretKey = keyof typeof TURRETS;
export const isTurretKey = (k: string | null | undefined): k is TurretKey => !!k && Object.hasOwn(TURRETS, k);

// Скорость наведения — точность сопровождения цели (входит в шанс попадания). Развернуть башню можно быстрее:
// иначе тяжёлая турель (6°/с) разворачивалась бы к цели сбоку по 10 секунд
export const SLEW_FACTOR = 3;
/** Как быстро башня поворачивается, рад/с. */
export const slewRate = (def: TurretDef) => def.tracking * SLEW_FACTOR;

/** Стреляет, только когда ствол смотрит на цель с этой точностью. */
export const AIM_TOLERANCE = 2 * DEG;

export const mountTurret = (def: TurretDef): Turret => ({ def, cooldown: 0, aim: 0 });
