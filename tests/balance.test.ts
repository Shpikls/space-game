import { describe, expect, it } from 'vitest';
import { winRate, type MissionSim } from '../src/game/simulate';

// Столп: подготовка даёт ~95% успеха. Эти тесты фиксируют баланс:
// правильный фит без вмешательства игрока побеждает, неправильный — проигрывает.
const frigate = (w1: 'kinetic' | 'energy', w2: 'kinetic' | 'energy'): MissionSim['fit'] => ({ weapon: [w1, w2], def: ['plate'], util: ['none'] });
const cruiser = (w: ('kinetic' | 'energy')[]): MissionSim['fit'] => ({ weapon: w, def: ['plate', 'plate'], util: ['repair'] });

describe('баланс заданий (бой без вмешательства)', () => {
  it('уровень 1: фрегат с рельсами против 2 тяжёлых', () => {
    expect(winRate({ ship: 'frigate', fit: frigate('kinetic', 'kinetic'), comp: { heavy: 2 }, order: { type: 'keep', dist: 700 } })).toBeGreaterThanOrEqual(0.9);
  });
  it('уровень 1: фрегат с лазерами против 3 перехватчиков', () => {
    expect(winRate({ ship: 'frigate', fit: frigate('energy', 'energy'), comp: { light: 3 }, order: { type: 'keep', dist: 450 } })).toBeGreaterThanOrEqual(0.9);
  });
  it('уровень 2: неправильный фит (лазеры против 3 тяжёлых) проигрывает', () => {
    expect(winRate({ ship: 'frigate', fit: frigate('energy', 'energy'), comp: { heavy: 3 }, order: { type: 'keep', dist: 450 } })).toBeLessThanOrEqual(0.2);
  });
  it('уровень 3: фрегату не по силам', () => {
    expect(winRate({ ship: 'frigate', fit: frigate('kinetic', 'energy'), comp: { heavy: 3, light: 4 }, order: { type: 'keep', dist: 450 } })).toBeLessThanOrEqual(0.3);
  });
  it('уровень 3: крейсер с правильным сочетанием оружия проходит', () => {
    expect(winRate({ ship: 'cruiser', fit: cruiser(['kinetic', 'energy', 'energy']), comp: { heavy: 3, light: 4 }, order: { type: 'keep', dist: 450 } })).toBeGreaterThanOrEqual(0.8);
  });
  it('уровень 3: крейсер с одними рельсами против смешанной группы проигрывает', () => {
    expect(winRate({ ship: 'cruiser', fit: cruiser(['kinetic', 'kinetic', 'kinetic']), comp: { heavy: 4, light: 2 }, order: { type: 'keep', dist: 700 } })).toBeLessThanOrEqual(0.3);
  });
});
