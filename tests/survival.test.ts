import { describe, expect, it } from 'vitest';
import {
  HULLS, TURRETS, applyDamage, createWorld, damageShip, issueOrder, maxHp, respawnPlayer, setAttack, step, surfaceDistance, totalHp,
  type PlayerWorld, type Ship, type SimEvent,
} from '../src/sim';

const pirate = (w: PlayerWorld) => w.byId.pirate1 as Ship | undefined;

/** Крутит мир шагами по 0,1 с, пока не выполнится условие; возвращает события. */
function runUntil(w: PlayerWorld, done: () => boolean, maxSec = 120): SimEvent[] {
  const all: SimEvent[] = [];
  for (let t = 0; t < maxSec && !done(); t += 0.1) { step(w, 0.1); all.push(...w.events.splice(0)); }
  return all;
}

describe('щит, броня, корпус', () => {
  it('урон снимает сначала щит, потом броню, потом корпус', () => {
    const w = createWorld({ hull: 'frigate' }), s = w.player, f = HULLS.frigate;
    applyDamage(s, 350);
    expect([s.shield, s.armor, s.structure]).toEqual([f.shield - 350, f.armor, f.structure]);
    applyDamage(s, 200); // 50 щита и 150 брони
    expect([s.shield, s.armor, s.structure]).toEqual([0, f.armor - 150, f.structure]);
    applyDamage(s, 400); // 150 брони и 250 корпуса
    expect([s.shield, s.armor, s.structure]).toEqual([0, 0, f.structure - 250]);
  });

  it('щит восстанавливается сам, броня и корпус — нет', () => {
    const w = createWorld({ hull: 'frigate', at: 'station' }), s = w.player, f = HULLS.frigate;
    applyDamage(s, f.shield + 100 + 50 + f.armor - 100); // щит в ноль, броня в ноль, 50 корпуса
    expect([s.shield, s.armor, s.structure]).toEqual([0, 0, f.structure - 50]);
    step(w, f.shieldRecharge / 2);
    expect(s.shield).toBeCloseTo(f.shield / 2, 3);
    step(w, f.shieldRecharge);
    expect([s.shield, s.armor, s.structure]).toEqual([f.shield, 0, f.structure - 50]);
  });
});

describe('ответный огонь пирата', () => {
  it('пират молчит, пока ты дальше его дальности', () => {
    const w = createWorld({ at: 'station' });
    expect(surfaceDistance(w.player, pirate(w)!)).toBeGreaterThan(TURRETS.light.range);
    const events = runUntil(w, () => false, 30);
    expect(events.some((e) => e.type === 'shot')).toBe(false);
    expect(pirate(w)!.attack).toBeNull();
  });

  it('пират открывает огонь, когда ты подлетел ближе 20 км', () => {
    const w = createWorld({ at: 'pirate1' });
    const events = runUntil(w, () => false, 10);
    expect(pirate(w)!.attack).toBe('player');
    expect(events.some((e) => e.type === 'shot' && e.ship === 'pirate1' && e.target === 'player')).toBe(true);
    expect(totalHp(w.player)).toBeLessThan(maxHp(w.player));
  });

  it('крейсер с лёгкой турелью побеждает пирата и выживает', () => {
    const w = createWorld({ hull: 'cruiser', at: 'pirate1' });
    setAttack(w, w.player, 'pirate1');
    runUntil(w, () => !pirate(w));
    expect(pirate(w)).toBeUndefined();
    expect(w.player.dead).toBe(false);
    expect(totalHp(w.player)).toBeLessThan(maxHp(w.player));
  });

  it('подготовка: тяжёлая турель бьёт с 40 км, пират с 20 км не достаёт — победа без единого попадания', () => {
    const w = createWorld({ hull: 'frigate', gun: 'heavy', at: 'station' });
    const d = surfaceDistance(w.player, pirate(w)!);
    expect(d).toBeGreaterThan(TURRETS.light.range);
    expect(d).toBeLessThan(TURRETS.heavy.range);
    setAttack(w, w.player, 'pirate1');
    const events = runUntil(w, () => !pirate(w));
    expect(pirate(w)).toBeUndefined();
    expect(events.some((e) => e.type === 'shot' && e.ship === 'pirate1')).toBe(false);
    expect(totalHp(w.player)).toBe(maxHp(w.player));
  });
});

describe('гибель своего корабля', () => {
  it('корабль игрока уничтожен: событие, обломки, приказы недоступны, пират прекращает огонь', () => {
    const w = createWorld({ hull: 'frigate', at: 'pirate1' });
    const events = runUntil(w, () => w.player.dead, 300);
    expect(w.player.dead).toBe(true);
    expect(events.find((e) => e.type === 'destroyed')).toMatchObject({ ship: 'player', by: 'pirate1' });
    // корабль игрока остаётся в мире — ждёт нового вылета
    expect(w.byId.player).toBe(w.player);
    expect(w.objects.some((o) => o.type === 'wreck' && o.name === 'Обломки: Ваш корабль')).toBe(true);
    expect(issueOrder(w, w.player, { type: 'stop' })).toBe(false);
    expect(setAttack(w, w.player, 'pirate1')).toBe(false);
    const pos = { ...w.player.pos };
    const after = runUntil(w, () => false, 10);
    expect(after.some((e) => e.type === 'shot')).toBe(false);
    expect(pirate(w)!.attack).toBeNull();
    expect(w.player.pos).toEqual(pos);
  });

  it('новый вылет: корабль целиком починен и стоит у станции, вне дальности пирата', () => {
    const w = createWorld({ hull: 'frigate', at: 'pirate1' });
    runUntil(w, () => w.player.dead, 300);
    respawnPlayer(w);
    expect(w.player.dead).toBe(false);
    expect(totalHp(w.player)).toBe(maxHp(w.player));
    expect(surfaceDistance(w.player, w.byId.station!)).toBeLessThan(10e3);
    expect(surfaceDistance(w.player, pirate(w)!)).toBeGreaterThan(TURRETS.light.range);
    expect(issueOrder(w, w.player, { type: 'stop' })).toBe(true);
  });

  it('урон напрямую (кнопка в отладке) тоже может уничтожить корабль', () => {
    const w = createWorld({ hull: 'frigate', at: 'station' });
    damageShip(w, w.player, maxHp(w.player), 'debug');
    expect(w.player.dead).toBe(true);
    expect(w.events.find((e) => e.type === 'destroyed')).toMatchObject({ ship: 'player', by: 'debug' });
  });
});
