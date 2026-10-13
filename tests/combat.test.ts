import { describe, expect, it } from 'vitest';
import {
  HULLS, TURRETS, createWorld, issueOrder, setAttack, spawnPirate, step, surfaceDistance, teleport,
  type PlayerWorld, type Ship, type SimEvent,
} from '../src/sim';

const pirate = (w: PlayerWorld) => w.byId.pirate1 as Ship | undefined;

/** Крутит мир шагами по 0,1 с, пока не выполнится условие; возвращает собранные события. */
function runUntil(w: PlayerWorld, done: () => boolean, maxSec = 120): SimEvent[] {
  const all: SimEvent[] = [];
  for (let t = 0; t < maxSec && !done(); t += 0.1) { step(w, 0.1); all.push(...w.events.splice(0)); }
  return all;
}

describe('первая цель', () => {
  it('пират стоит в 30 км от станции и не двигается', () => {
    const w = createWorld();
    const p = pirate(w)!;
    expect(p.faction).toBe('pirate');
    expect(surfaceDistance(p, w.byId.station!)).toBeCloseTo(30e3 - 1600, -1);
    const pos = { ...p.pos };
    step(w, 30);
    expect(p.pos).toEqual(pos);
  });

  it('атаковать можно только другой корабль', () => {
    const w = createWorld();
    expect(setAttack(w, w.player, 'station')).toBe(false);
    expect(setAttack(w, w.player, 'player')).toBe(false);
    expect(setAttack(w, w.player, 'нет такого')).toBe(false);
    expect(setAttack(w, w.player, 'pirate1')).toBe(true);
    expect(w.player.attack).toBe('pirate1');
    expect(setAttack(w, w.player, null)).toBe(true);
    expect(w.player.attack).toBeNull();
  });

  it('вне дальности турель молчит', () => {
    const w = createWorld({ at: 'station' });
    expect(surfaceDistance(w.player, pirate(w)!)).toBeGreaterThan(TURRETS.light.range);
    setAttack(w, w.player, 'pirate1');
    const events = runUntil(w, () => false, 30);
    expect(events.filter((e) => e.type === 'shot')).toHaveLength(0);
    expect(pirate(w)!.structure).toBe(HULLS.frigate.structure);
  });

  it('в пределах дальности уничтожает пирата за расчётное время', () => {
    const w = createWorld({ at: 'pirate1' });
    expect(surfaceDistance(w.player, pirate(w)!)).toBeCloseTo(10e3, -1);
    setAttack(w, w.player, 'pirate1');
    const start = w.time;
    const events = runUntil(w, () => !pirate(w));
    // первый выстрел сразу, дальше раз в 2 с: 10 выстрелов по 100 = 1000 прочности за 18 с
    const shots = Math.ceil(HULLS.frigate.structure / TURRETS.light.damage);
    expect(events.filter((e) => e.type === 'shot')).toHaveLength(shots);
    expect(w.time - start).toBeCloseTo((shots - 1) * TURRETS.light.cycle, 0);
    const boom = events.find((e) => e.type === 'destroyed');
    expect(boom).toMatchObject({ ship: 'pirate1', by: 'player', name: 'Пират «Шакал»' });
    // корабля больше нет, на его месте обломки, турель свободна
    expect(w.ships.some((s) => s.id === 'pirate1')).toBe(false);
    const wreck = w.objects.find((o) => o.type === 'wreck' && o.name === 'Обломки: Пират «Шакал»');
    expect(wreck?.pos).toEqual(boom?.type === 'destroyed' ? boom.pos : null);
    expect(w.player.attack).toBeNull();
  });

  it('приказ движения по уничтоженной цели снимается', () => {
    const w = createWorld({ at: 'pirate1' });
    issueOrder(w, w.player, { type: 'orbit', target: 'pirate1', range: 5e3 });
    setAttack(w, w.player, 'pirate1');
    runUntil(w, () => !pirate(w));
    step(w, 0.1);
    expect(w.player.order.type).toBe('stop');
  });

  it('варп сбрасывает цель, в варпе атаковать нельзя', () => {
    const w = createWorld({ hull: 'frigate', at: 'pirate1' });
    setAttack(w, w.player, 'pirate1');
    issueOrder(w, w.player, { type: 'warp', target: 'p3', dist: 0 });
    runUntil(w, () => !!w.player.warp, 30);
    expect(w.player.warp).not.toBeNull();
    expect(w.player.attack).toBeNull();
    expect(setAttack(w, w.player, 'pirate1')).toBe(false);
  });

  it('пирата можно вернуть после уничтожения, чтобы переиграть бой', () => {
    const w = createWorld({ at: 'pirate1' });
    setAttack(w, w.player, 'pirate1');
    runUntil(w, () => !pirate(w));
    const again = spawnPirate(w);
    expect(again.structure).toBe(HULLS.frigate.structure);
    teleport(w, w.player, 'pirate1');
    expect(surfaceDistance(w.player, again)).toBeCloseTo(10e3, -1);
  });
});
