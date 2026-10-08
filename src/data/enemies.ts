import type { EnemyDef, EnemyId } from './types';

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  heavy: {
    name: 'Тяжёлый', maxSpeed: 85, accel: 35, sig: 120, armor: 250, hull: 150, ai: 'keep', range: 550, size: 13, color: '#f0a640',
    weapon: { id: 'kinetic', name: 'Рельса', dmg: 18, cycle: 2.2, optimal: 650, falloff: 200, tracking: 0.3, color: '#ffe08a' },
  },
  light: {
    name: 'Перехватчик', maxSpeed: 200, accel: 260, sig: 40, armor: 0, hull: 140, ai: 'orbit', range: 270, size: 7, color: '#ff6f91',
    weapon: { id: 'energy', name: 'Лазер', dmg: 10, cycle: 1.2, optimal: 280, falloff: 80, tracking: 1.2, color: '#ff9db4' },
  },
};
