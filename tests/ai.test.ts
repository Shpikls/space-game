import { describe, expect, it } from 'vitest';
import {
  ENEMIES, createWorld, damageShip, issueOrder, maxHp, spawnSignalPirates, step, surfaceDistance, teleport, totalHp,
  type PlayerWorld, type Ship,
} from '../src/sim';

const wasp = (w: PlayerWorld) => w.byId.pirate2 as Ship;
const viper = (w: PlayerWorld) => w.byId.pirate3 as Ship;
const dist = (a: Ship, b: Ship) => surfaceDistance(a, b);

describe('ИИ врагов у сигнала', () => {
  it('враги замечают игрока и вступают в бой только через время реакции', () => {
    const w = createWorld({ hull: 'battleship', at: 'signal' });
    expect(dist(w.player, wasp(w))).toBeLessThan(ENEMIES.wasp.aggro);
    expect(dist(w.player, viper(w))).toBeLessThan(ENEMIES.viper.aggro);
    step(w, 1);
    expect(wasp(w).ai!.state).toBe('alert');
    expect(wasp(w).attack).toBeNull();
    step(w, 0.6); // реакция брулера — 1,5 с
    expect(wasp(w).ai!.state).toBe('engage');
    expect(wasp(w).attack).toBe('player');
    expect(wasp(w).order).toMatchObject({ type: 'orbit', target: 'player', range: ENEMIES.wasp.range });
    expect(viper(w).ai!.state).toBe('alert');
    step(w, 1); // реакция снайпера — 2,5 с
    expect(viper(w).ai!.state).toBe('engage');
    expect(viper(w).order).toMatchObject({ type: 'keep', target: 'player', range: ENEMIES.viper.range });
  });

  it('брулер выходит на орбиту 2 км вокруг игрока', () => {
    const w = createWorld({ hull: 'battleship', at: 'signal' });
    step(w, 60);
    for (let i = 0; i < 10; i++) {
      step(w, 1);
      expect(Math.abs(dist(w.player, wasp(w)) - ENEMIES.wasp.range)).toBeLessThan(400);
    }
    expect(wasp(w).speed).toBeGreaterThan(300);
  });

  it('снайпер держит 30 км, даже когда к нему подлетают', () => {
    const w = createWorld({ hull: 'battleship', at: 'signal' });
    step(w, 60);
    expect(Math.abs(dist(w.player, viper(w)) - ENEMIES.viper.range)).toBeLessThan(2e3);
    issueOrder(w, w.player, { type: 'approach', target: 'pirate3' });
    for (let i = 0; i < 30; i++) {
      step(w, 1);
      expect(dist(w.player, viper(w))).toBeGreaterThan(ENEMIES.viper.range - 2e3);
    }
  });

  it('снайпер уходит в варп, когда прочности меньше 40%', () => {
    const w = createWorld({ hull: 'battleship', at: 'signal' });
    step(w, 5);
    expect(viper(w).ai!.state).toBe('engage');
    damageShip(w, viper(w), maxHp(viper(w)) * 0.65, 'player');
    step(w, 0.1);
    expect(viper(w).ai!.state).toBe('flee');
    expect(viper(w).attack).toBeNull();
    expect(viper(w).order.type).toBe('warp');
    step(w, 120);
    expect(viper(w).ai!.state).toBe('gone');
    expect(dist(w.player, viper(w))).toBeGreaterThan(1e9);
  });

  it('«Вернуть пиратов» возвращает сбежавшего снайпера на место, целым и в покое', () => {
    const w = createWorld({ hull: 'battleship', at: 'signal' });
    step(w, 5);
    damageShip(w, viper(w), maxHp(viper(w)) * 0.65, 'player');
    step(w, 120);
    expect(viper(w).ai!.state).toBe('gone');
    spawnSignalPirates(w);
    expect(viper(w).ai!.state).toBe('idle');
    expect(totalHp(viper(w))).toBe(maxHp(viper(w)));
    expect(surfaceDistance(viper(w), w.byId.signal!)).toBeCloseTo(26e3, -2);
  });

  it('брулер бьётся до конца и не убегает', () => {
    const w = createWorld({ hull: 'battleship', at: 'signal' });
    step(w, 5);
    damageShip(w, wasp(w), maxHp(wasp(w)) * 0.9, 'player');
    step(w, 5);
    expect(wasp(w).ai!.state).toBe('engage');
    expect(wasp(w).attack).toBe('player');
  });

  it('игрок далеко — враги у сигнала в покое', () => {
    const w = createWorld({ at: 'station' });
    step(w, 30);
    for (const s of [wasp(w), viper(w)]) {
      expect(s.ai!.state).toBe('idle');
      expect(s.attack).toBeNull();
      expect(s.speed).toBe(0);
    }
  });

  it('игрок улетел далеко — враги прекращают бой', () => {
    const w = createWorld({ hull: 'battleship', at: 'signal' });
    step(w, 5);
    expect(wasp(w).ai!.state).toBe('engage');
    teleport(w, w.player, 'station');
    step(w, 0.1);
    expect(wasp(w).ai!.state).toBe('idle');
    expect(wasp(w).attack).toBeNull();
    expect(wasp(w).order.type).toBe('stop');
  });

  it('игрок погиб — враги прекращают бой и возвращаются в покой', () => {
    const w = createWorld({ hull: 'frigate', at: 'signal' });
    for (let t = 0; t < 300 && !w.player.dead; t += 0.1) step(w, 0.1);
    expect(w.player.dead).toBe(true);
    step(w, 0.1);
    for (const s of [wasp(w), viper(w)]) {
      expect(s.ai!.state).toBe('idle');
      expect(s.attack).toBeNull();
    }
  });
});
