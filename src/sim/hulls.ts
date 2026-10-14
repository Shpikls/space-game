import { DEG } from './constants';
import type { Hull, HullKey } from './types';

// Масса, размер и маневровые двигатели задают поворот: углов. ускорение = момент / инерция
export const HULLS: Record<HullKey, Hull> = {
  frigate: { key: 'frigate', name: 'Фрегат', mass: 1.4e6, size: 45, thrust: 9.8e7, torque: 2.9e8, maxTurn: 80 * DEG, maxSpeed: 380, warpSpeed: 5, warpAccel: 5, warpDecel: 2, shield: 400, shieldRecharge: 40, armor: 300, structure: 300, signature: 40, lockTime: 1.2, lockRange: 50e3 },
  cruiser: { key: 'cruiser', name: 'Крейсер', mass: 1.2e7, size: 140, thrust: 2.64e8, torque: 6.2e9, maxTurn: 30 * DEG, maxSpeed: 220, warpSpeed: 3, warpAccel: 3, warpDecel: 1.4, shield: 1400, shieldRecharge: 80, armor: 1200, structure: 900, signature: 120, lockTime: 3, lockRange: 70e3 },
  battleship: { key: 'battleship', name: 'Линкор', mass: 9e7, size: 420, thrust: 6.3e8, torque: 1.15e11, maxTurn: 14 * DEG, maxSpeed: 110, warpSpeed: 2, warpAccel: 2, warpDecel: 1, shield: 5000, shieldRecharge: 150, armor: 4000, structure: 3000, signature: 360, lockTime: 5, lockRange: 90e3 },
};

export const isHullKey = (k: string | null | undefined): k is HullKey => !!k && Object.hasOwn(HULLS, k);

/** Момент инерции стержня: масса × длина² / 12. */
export const inertia = (h: Hull) => (h.mass * h.size * h.size) / 12;
export const angAccel = (h: Hull) => h.torque / inertia(h);
export const linAccel = (h: Hull) => h.thrust / h.mass;
