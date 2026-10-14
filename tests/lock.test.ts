import { describe, expect, it } from 'vitest';
import {
  addShip, attackStatus, createWorld, isLocked, issueOrder, lockProgress, lockTime, offset, setAttack, step,
  type PlayerWorld, type Ship, type SimEvent,
} from '../src/sim';

const pirate = (w: PlayerWorld) => w.byId.pirate1 as Ship;
/** Пират без оружия — чтобы ответный огонь не мешал. */
const calm = (w: PlayerWorld) => { pirate(w).turrets = []; return w; };
/** Ставит игрока на расстоянии d от пирата (без учёта радиуса — у кораблей он 0). */
const placeAt = (w: PlayerWorld, d: number) => { w.player.pos = offset(pirate(w).pos, d, 0); };

/** Время первого выстрела корабля shooter, шагами по 0,02 с. */
function firstShotOf(w: PlayerWorld, shooter: string, maxSec = 30): number {
  const start = w.time;
  for (let t = 0; t < maxSec; t += 0.02) {
    step(w, 0.02);
    if (w.events.splice(0).some((e: SimEvent) => e.type === 'shot' && e.ship === shooter)) return w.time - start;
  }
  return Infinity;
}

describe('захват цели', () => {
  it('время захвата: мелкий корабль захватывает быстро, мелкую цель — долго', () => {
    const w = createWorld();
    const ship = (hull: 'frigate' | 'cruiser' | 'battleship') => addShip(w, 'test-' + hull, hull, hull, { x: 0, z: 0 }, 0, 'test');
    const f = ship('frigate'), c = ship('cruiser'), b = ship('battleship');
    // цель размером с крейсер — ровно время корпуса
    expect(lockTime(f, c)).toBe(f.hull.lockTime);
    expect(lockTime(b, c)).toBe(b.hull.lockTime);
    // фрегат захватывает кого угодно за 1–2 с, линкору на фрегат нужно почти 8 с
    expect(lockTime(f, f)).toBeCloseTo(1.9, 1);
    expect(lockTime(f, b)).toBeCloseTo(0.83, 2);
    expect(lockTime(c, f)).toBeCloseTo(4.7, 1);
    expect(lockTime(b, f)).toBeCloseTo(7.8, 1);
    expect(lockTime(b, b)).toBeLessThan(lockTime(b, c));
  });

  it('без захвата турели молчат: первый выстрел — когда захват завершён', () => {
    const w = calm(createWorld({ at: 'pirate1' }));
    setAttack(w, w.player, 'pirate1');
    expect(attackStatus(w, w.player)).toBe('locking');
    step(w, 1);
    expect(lockProgress(w.player)).toBeCloseTo(1 / lockTime(w.player, pirate(w)), 2);
    expect(isLocked(w.player)).toBe(false);
    const need = lockTime(w.player, pirate(w));
    // башня успевает навестись за время захвата — стреляет ровно по его завершении
    expect(1 + firstShotOf(w, 'player')).toBeCloseTo(need, 1);
    expect(isLocked(w.player)).toBe(true);
    expect(attackStatus(w, w.player)).toBe('firing');
  });

  it('цель видит, что её захватывают: пират сначала захватывает, потом стреляет', () => {
    const w = createWorld({ at: 'pirate1' });
    step(w, 0.1);
    expect(pirate(w).attack).toBe('player');
    expect(lockProgress(pirate(w))).toBeGreaterThan(0);
    expect(isLocked(pirate(w))).toBe(false);
    const need = lockTime(pirate(w), w.player);
    expect(0.1 + firstShotOf(w, 'pirate1')).toBeGreaterThanOrEqual(need);
    expect(isLocked(pirate(w))).toBe(true);
  });

  it('фрегат захватывает линкор быстрее, чем линкор фрегат, — и стреляет первым', () => {
    const w = createWorld({ hull: 'battleship', at: 'pirate1' });
    setAttack(w, w.player, 'pirate1');
    let mine = Infinity, theirs = Infinity;
    for (let t = 0; t < 20 && mine === Infinity; t += 0.02) {
      step(w, 0.02);
      for (const e of w.events.splice(0)) if (e.type === 'shot') {
        if (e.ship === 'player') mine = Math.min(mine, w.time);
        else theirs = Math.min(theirs, w.time);
      }
    }
    expect(theirs).toBeLessThan(2);
    expect(mine).toBeGreaterThanOrEqual(lockTime(w.player, pirate(w)));
  });

  it('дальше дальности захвата захват не идёт, ближе — идёт', () => {
    const w = calm(createWorld({ at: 'pirate1' }));
    placeAt(w, w.player.hull.lockRange + 10e3);
    setAttack(w, w.player, 'pirate1');
    step(w, 10);
    expect(lockProgress(w.player)).toBe(0);
    expect(attackStatus(w, w.player)).toBe('far');
    placeAt(w, w.player.hull.lockRange - 10e3);
    step(w, 1);
    expect(lockProgress(w.player)).toBeGreaterThan(0);
    expect(attackStatus(w, w.player)).toBe('locking');
  });

  it('цель ушла за дальность захвата — захват сорван и начинается заново', () => {
    const w = calm(createWorld({ at: 'pirate1' }));
    setAttack(w, w.player, 'pirate1');
    step(w, lockTime(w.player, pirate(w)) + 0.1);
    expect(isLocked(w.player)).toBe(true);
    placeAt(w, w.player.hull.lockRange + 10e3);
    step(w, 0.1);
    expect(lockProgress(w.player)).toBe(0);
    placeAt(w, 10e3);
    step(w, 1);
    expect(isLocked(w.player)).toBe(false);
  });

  it('цель ушла в варп — захват сорван', () => {
    const w = calm(createWorld({ hull: 'frigate', at: 'pirate1' }));
    setAttack(w, w.player, 'pirate1');
    step(w, lockTime(w.player, pirate(w)) + 0.1);
    expect(isLocked(w.player)).toBe(true);
    expect(issueOrder(w, pirate(w), { type: 'warp', target: 'p3', dist: 0 })).toBe(true);
    for (let t = 0; t < 60 && !pirate(w).warp; t += 0.1) step(w, 0.1);
    expect(pirate(w).warp).not.toBeNull();
    expect(lockProgress(w.player)).toBe(0);
  });

  it('повторное «Атаковать» по той же цели захват не сбрасывает; «Прекратить огонь» — снимает', () => {
    const w = calm(createWorld({ at: 'pirate1' }));
    setAttack(w, w.player, 'pirate1');
    step(w, 1);
    const p = lockProgress(w.player);
    setAttack(w, w.player, 'pirate1');
    expect(lockProgress(w.player)).toBe(p);
    setAttack(w, w.player, null);
    expect(w.player.lock).toBeNull();
    setAttack(w, w.player, 'pirate1');
    expect(lockProgress(w.player)).toBe(0);
  });

  it('новая цель захватывается с нуля', () => {
    const w = calm(createWorld({ at: 'pirate1' }));
    const other = addShip(w, 'other', 'Мишень', 'frigate', offset(w.player.pos, 5e3, 90), 0, 'pirate');
    setAttack(w, w.player, 'pirate1');
    step(w, lockTime(w.player, pirate(w)) + 0.1);
    expect(isLocked(w.player)).toBe(true);
    setAttack(w, w.player, other.id);
    expect(lockProgress(w.player)).toBe(0);
    expect(w.player.lock?.target).toBe(other.id);
  });

  it('варп и гибель снимают захват', () => {
    const w = createWorld({ hull: 'frigate', at: 'pirate1' });
    setAttack(w, w.player, 'pirate1');
    issueOrder(w, w.player, { type: 'warp', target: 'p3', dist: 0 });
    for (let t = 0; t < 30 && !w.player.warp; t += 0.1) step(w, 0.1);
    expect(w.player.lock).toBeNull();
    const w2 = createWorld({ hull: 'frigate', at: 'pirate1' });
    for (let t = 0; t < 300 && !w2.player.dead; t += 0.1) step(w2, 0.1);
    expect(w2.player.dead).toBe(true);
    step(w2, 0.1);
    expect(pirate(w2).lock).toBeNull();
  });
});
