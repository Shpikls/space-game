import { describe, expect, it } from 'vitest';
import { applyDamage, hitInfo } from '../src/sim/combat';
import { WEAPONS } from '../src/data/weapons';

const body = (x: number, y: number, vx = 0, vy = 0, sig = 60) => ({ x, y, vx, vy, sig });

describe('hitInfo', () => {
  it('неподвижная цель в оптимальной дальности — почти гарантированное попадание', () => {
    expect(hitInfo(body(0, 0), body(500, 0), WEAPONS.kinetic).chance).toBeCloseTo(1, 5);
  });
  it('быстрая цель вблизи — рельса мажет, лазер попадает', () => {
    const target = body(250, 0, 0, 200, 40);
    expect(hitInfo(body(0, 0), target, WEAPONS.kinetic).chance).toBeLessThan(0.05);
    expect(hitInfo(body(0, 0), target, WEAPONS.energy).chance).toBeGreaterThan(0.2);
  });
  it('за пределами досягаемости стрелять нельзя', () => {
    const h = hitInfo(body(0, 0), body(2000, 0), WEAPONS.energy);
    expect(h.inRange).toBe(false);
    expect(h.reason).toBe('вне досягаемости');
  });
});

describe('applyDamage', () => {
  const ship = () => ({ x: 0, y: 0, vx: 0, vy: 0, angle: 0, maxSpeed: 0, accel: 0, sig: 60, size: 1, hull: 100, hullMax: 100, armor: 30, armorMax: 30, dead: false });
  it('кинетика сильнее по броне, остаток переходит в корпус с множителем корпуса', () => {
    const s = ship();
    const r = applyDamage(s, 40, 'kinetic'); // 60 по броне: 30 съела броня, 30/1.5*0.8 = 16 в корпус
    expect(r.armor).toBe(30);
    expect(r.hull).toBeCloseTo(16);
    expect(s.hull).toBeCloseTo(84);
  });
  it('корабль гибнет, когда корпус кончился', () => {
    const s = ship();
    s.armor = 0;
    applyDamage(s, 1000, 'energy');
    expect(s.dead).toBe(true);
    expect(s.hull).toBe(0);
  });
});
