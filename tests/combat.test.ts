import { describe, expect, it } from 'vitest';
import {
  AIM_TOLERANCE, DEG, HULLS, TURRETS, attackStatus, createWorld, issueOrder, setAttack, spawnPirate, step, surfaceDistance,
  teleport, wrap, yawTo, type PlayerWorld, type Ship, type SimEvent,
} from '../src/sim';

const pirate = (w: PlayerWorld) => w.byId.pirate1 as Ship | undefined;

/** На какой угол башне игрока надо повернуться к пирату (корабль стоит, нос не двигается). */
const aimNeeded = (w: PlayerWorld) => {
  const p = pirate(w)!, s = w.player;
  return Math.abs(wrap(yawTo(p.pos.x - s.pos.x, p.pos.z - s.pos.z) - s.yaw));
};

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
    const start = w.time, aimTime = (aimNeeded(w) - AIM_TOLERANCE) / TURRETS.light.tracking;
    const events = runUntil(w, () => !pirate(w));
    // башня наводится, затем 10 выстрелов по 100 раз в 2 с = 1000 прочности
    const shots = Math.ceil(HULLS.frigate.structure / TURRETS.light.damage);
    expect(events.filter((e) => e.type === 'shot')).toHaveLength(shots);
    expect(Math.abs(w.time - start - (aimTime + (shots - 1) * TURRETS.light.cycle))).toBeLessThan(0.15);
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

describe('турели', () => {
  /** Время первого выстрела после приказа атаковать. */
  function firstShot(w: PlayerWorld): number {
    const start = w.time;
    for (let t = 0; t < 60; t += 0.02) {
      step(w, 0.02);
      if (w.events.splice(0).some((e) => e.type === 'shot')) return w.time - start;
    }
    return Infinity;
  }

  it('башня сначала наводится, потом стреляет', () => {
    const w = createWorld({ at: 'pirate1' });
    expect(aimNeeded(w)).toBeGreaterThan(30 * DEG); // после переброски пират сбоку
    setAttack(w, w.player, 'pirate1');
    expect(attackStatus(w, w.player)).toBe('aiming');
    const expected = (aimNeeded(w) - AIM_TOLERANCE) / TURRETS.light.tracking;
    expect(Math.abs(firstShot(w) - expected)).toBeLessThan(0.05);
    expect(attackStatus(w, w.player)).toBe('firing');
  });

  it('чем медленнее наведение, тем позже первый выстрел', () => {
    const fast = createWorld({ at: 'pirate1' }), slow = createWorld({ at: 'pirate1' });
    slow.player.turrets[0]!.def = { ...TURRETS.light, tracking: 10 * DEG };
    setAttack(fast, fast.player, 'pirate1'); setAttack(slow, slow.player, 'pirate1');
    const tf = firstShot(fast), ts = firstShot(slow);
    expect(ts / tf).toBeCloseTo(3, 0);
  });

  it('корпус не обязан смотреть на цель: на орбите вокруг врага огонь не прерывается', () => {
    const w = createWorld({ hull: 'frigate', at: 'pirate1' });
    issueOrder(w, w.player, { type: 'orbit', target: 'pirate1', range: 5e3 });
    setAttack(w, w.player, 'pirate1');
    const shots: number[] = [];
    for (let t = 0; t < 20 && pirate(w); t += 0.02) {
      step(w, 0.02);
      for (const e of w.events.splice(0)) if (e.type === 'shot') shots.push(w.time);
    }
    expect(shots.length).toBeGreaterThanOrEqual(8);
    // после первого выстрела — строго раз в перезарядку, хотя корабль всё время поворачивает
    for (let i = 1; i < shots.length; i++) expect(shots[i]! - shots[i - 1]!).toBeCloseTo(TURRETS.light.cycle, 1);
  });

  it('выстрел несёт точки «откуда» и «куда» для картинки', () => {
    const w = createWorld({ at: 'pirate1' });
    setAttack(w, w.player, 'pirate1');
    let shot: SimEvent | undefined;
    for (let t = 0; t < 30 && !shot; t += 0.02) { step(w, 0.02); shot = w.events.splice(0).find((e) => e.type === 'shot'); }
    expect(shot).toMatchObject({ ship: 'player', target: 'pirate1', turret: 0, from: w.player.pos, to: pirate(w)!.pos });
  });

  it('без цели башня возвращается вперёд', () => {
    const w = createWorld({ at: 'pirate1' });
    setAttack(w, w.player, 'pirate1');
    step(w, 10);
    expect(Math.abs(w.player.turrets[0]!.aim)).toBeGreaterThan(30 * DEG);
    setAttack(w, w.player, null);
    expect(attackStatus(w, w.player)).toBe('none');
    step(w, 10);
    expect(w.player.turrets[0]!.aim).toBeCloseTo(0, 5);
  });

  it('дальше дальности — статус «далеко»', () => {
    const w = createWorld({ at: 'station' });
    setAttack(w, w.player, 'pirate1');
    expect(attackStatus(w, w.player)).toBe('far');
  });
});
