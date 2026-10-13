import { describe, expect, it } from 'vitest';
import { HULLS, createWorld, issueOrder, measureWarp, objectById, step, type HullKey, type Ship, type SpaceObject } from '../src/sim';

const HULL_KEYS = Object.keys(HULLS) as HullKey[];
const dist = (a: Ship, b: SpaceObject) => Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);

describe('выравнивание и варп по корпусам', () => {
  // ориентиры из прототипа: чем тяжелее корпус, тем дольше выравнивание и сам варп
  const expected: Record<HullKey, { align90: number; warp10: number }> = {
    frigate: { align90: 3.8, warp10: 17 },
    cruiser: { align90: 7, warp10: 25 },
    battleship: { align90: 11, warp10: 37 },
  };
  for (const h of HULL_KEYS) {
    it(`${HULLS[h].name}: выравнивание с поворотом на 90° ≈ ${expected[h].align90} с, варп на 10 а. е. ≈ ${expected[h].warp10} с`, () => {
      const m = measureWarp(h, 10, 90);
      expect(m.align).toBeCloseTo(expected[h].align90, 0);
      expect(Math.abs(m.warp - expected[h].warp10)).toBeLessThan(1);
    });
  }
});

describe('орбита', () => {
  for (const h of HULL_KEYS) {
    it(`${HULLS[h].name} держит орбиту 5 км вокруг станции с точностью ±50 м`, () => {
      const w = createWorld({ hull: h, at: 'station' });
      const station = objectById(w, 'station')!;
      expect(issueOrder(w, w.player, { type: 'orbit', target: 'station', range: 5e3 })).toBe(true);
      step(w, 300); // выход на орбиту
      const R = 5e3 + station.radius;
      for (let i = 0; i < 100; i++) {
        step(w, 1);
        expect(Math.abs(dist(w.player, station) - R)).toBeLessThan(50);
      }
    });
  }
});

describe('выход из варпа', () => {
  for (const h of HULL_KEYS) {
    it(`${HULLS[h].name}: варп на 10 км от пояса — выход в 12,5 км от его центра`, () => {
      const w = createWorld({ hull: h, at: 'station' });
      const belt = objectById(w, 'belt')!;
      expect(belt.warpIn).toBe(2500);
      expect(issueOrder(w, w.player, { type: 'warp', target: 'belt', dist: 10e3 })).toBe(true);
      let exit: number | null = null;
      for (let t = 0; t < 120 && exit === null; t += 0.1) {
        step(w, 0.1);
        if (w.events.some((e) => e.type === 'warpEnd')) exit = dist(w.player, belt);
        w.events.length = 0;
      }
      expect(exit).not.toBeNull();
      expect(Math.abs(exit! - 12.5e3)).toBeLessThan(300);
      step(w, 60); // после выхода корабль тормозит по приказу «стоп»
      expect(w.player.speed).toBe(0);
      expect(Math.abs(dist(w.player, belt) - 12.5e3)).toBeLessThan(300);
    });
  }
});

describe('приказы', () => {
  it('варп нельзя прервать', () => {
    const w = createWorld({ hull: 'frigate', at: 'station' });
    issueOrder(w, w.player, { type: 'warp', target: 'p3', dist: 0 });
    for (let i = 0; i < 200 && !w.player.warp; i++) step(w, 0.1);
    expect(w.player.warp).not.toBeNull();
    expect(issueOrder(w, w.player, { type: 'stop' })).toBe(false);
  });
  it('ближе 150 км варп недоступен', () => {
    const w = createWorld({ hull: 'frigate', at: 'belt' });
    expect(issueOrder(w, w.player, { type: 'warp', target: 'belt', dist: 0 })).toBe(false);
    expect(issueOrder(w, w.player, { type: 'warp', target: 'station', dist: 0 })).toBe(true);
  });
  it('отрицательный шаг времени ничего не меняет', () => {
    const w = createWorld({ hull: 'frigate', at: 'belt' });
    const pos = { ...w.player.pos };
    step(w, -0.3);
    expect(w.player.speed).toBe(0);
    expect(w.player.pos).toEqual(pos);
    expect(w.time).toBe(0);
  });
  it('мир детерминирован: одинаковый сид — одинаковые астероиды', () => {
    const a = createWorld({ seed: 7 }), b = createWorld({ seed: 7 });
    expect(a.objects.map((o) => o.pos)).toEqual(b.objects.map((o) => o.pos));
  });
});
