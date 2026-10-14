import { describe, expect, it } from 'vitest';
import { FIGHTS } from '../src/scenarios/fights';
import {
  ENEMIES, HULLS, TURRETS, createWorld, damageShip, endFight, fightPoint, issueOrder, maxHp, setAttack, startFight, step, surfaceDistance, totalHp, updateFight, weaponRange,
  type Fight, type FightResult, type PlayerWorld, type Ship,
} from '../src/sim';

const enemies = (w: PlayerWorld, f: Fight) => f.enemyIds.map((id) => w.byId[id] as Ship | undefined);

/** Простая тактика: если цели нет — атаковать ближайшего живого врага (не ушедшего в варп). */
function brawl(w: PlayerWorld, f: Fight) {
  if (w.player.attack) return;
  const alive = enemies(w, f).filter((s): s is Ship => !!s && !s.dead && !s.warp);
  alive.sort((a, b) => surfaceDistance(w.player, a) - surfaceDistance(w.player, b));
  if (alive[0]) setAttack(w, w.player, alive[0].id);
}

/** Играет бой шагами по 0,1 с до итога (null — не закончился за maxSec). */
function play(w: PlayerWorld, f: Fight, maxSec = 600): FightResult | null {
  for (let t = 0; t < maxSec; t += 0.1) {
    brawl(w, f);
    step(w, 0.1);
    const r = updateFight(w, f, w.events.splice(0));
    if (r) return r;
  }
  return null;
}

describe('бой как задача', () => {
  it('вылет: враги боя на местах, пираты свободного полёта убраны, игрок целый с выбранным фитом', () => {
    const w = createWorld();
    damageShip(w, w.player, 900, 'debug');
    const f = startFight(w, FIGHTS.brawler, 'frigate', 'heavy');
    expect(['pirate1', 'pirate2', 'pirate3'].some((id) => w.byId[id])).toBe(false);
    expect(w.ships.filter((s) => s.faction === 'pirate').map((s) => s.id)).toEqual(['brawler-1']);
    expect(w.player.hull).toBe(HULLS.frigate);
    expect(w.player.turrets.map((t) => t.def)).toEqual([TURRETS.heavy]);
    expect(totalHp(w.player)).toBe(maxHp(w.player));
    expect(f.enemyIds).toEqual(['brawler-1']);
  });

  it('дуэль и снайпер: враги не замечают игрока на старте — как подлетать, решает игрок', () => {
    for (const def of [FIGHTS.duel, FIGHTS.sniper]) {
      const w = createWorld();
      const f = startFight(w, def, 'cruiser', 'light');
      for (const s of enemies(w, f)) expect(surfaceDistance(w.player, s!)).toBeGreaterThan(s!.ai!.def.aggro);
      step(w, 10);
      for (const s of enemies(w, f)) expect(s!.ai!.state).toBe('idle');
      expect(updateFight(w, f, w.events.splice(0))).toBeNull();
    }
  });

  it('брулеры — засада: выходишь из варпа рядом, и они сразу нападают', () => {
    for (const def of [FIGHTS.brawler, FIGHTS.swarm]) {
      const w = createWorld();
      const f = startFight(w, def, 'cruiser', 'light');
      for (const s of enemies(w, f)) expect(surfaceDistance(w.player, s!)).toBeLessThan(15e3);
      step(w, 5);
      for (const s of enemies(w, f)) expect(s!.attack).toBe('player');
    }
  });

  it('дуэль: тяжёлая турель с 35 км — победа без единого попадания, итог считает выстрелы и урон', () => {
    const w = createWorld();
    const f = startFight(w, FIGHTS.duel, 'frigate', 'heavy');
    issueOrder(w, w.player, { type: 'keep', target: 'duel-1', range: 35e3 });
    const r = play(w, f)!;
    expect(r).toMatchObject({ win: true, taken: 0, hpLeft: 1, killed: 1, fled: 0, total: 1 });
    expect(r.hits).toBeGreaterThan(0);
    expect(r.hits).toBeLessThanOrEqual(r.shots);
    expect(r.dealt).toBe(r.hits * TURRETS.heavy.damage);
    expect(r.time).toBeGreaterThan(0);
  });

  it('брулер: крейсер с лёгкой турелью побеждает, тяжёлая по нему почти не попадает', () => {
    const light = createWorld(), fl = startFight(light, FIGHTS.brawler, 'cruiser', 'light');
    issueOrder(light, light.player, { type: 'approach', target: 'brawler-1' });
    const rl = play(light, fl)!;
    expect(rl.win).toBe(true);
    const heavy = createWorld(), fh = startFight(heavy, FIGHTS.brawler, 'cruiser', 'heavy');
    issueOrder(heavy, heavy.player, { type: 'approach', target: 'brawler-1' });
    // брулер на орбите вплотную смещается слишком быстро для тяжёлой турели
    expect(play(heavy, fh)?.win).toBe(false);
    expect(fh.stats.hits / fh.stats.shots).toBeLessThan(0.2);
  });

  it('снайпер: крейсер с тяжёлой турелью побеждает — подбитый снайпер уходит в варп', () => {
    const w = createWorld();
    const f = startFight(w, FIGHTS.sniper, 'cruiser', 'heavy');
    issueOrder(w, w.player, { type: 'approach', target: 'sniper-1' });
    const r = play(w, f)!;
    expect(r).toMatchObject({ win: true, killed: 0, fled: 1 });
    expect(r.hits).toBeGreaterThan(0);
  });

  it('звено: фрегат погибает, линкор с лёгкой турелью побеждает', () => {
    const fw = createWorld(), ff = startFight(fw, FIGHTS.swarm, 'frigate', 'light');
    issueOrder(fw, fw.player, { type: 'approach', target: 'swarm-1' });
    expect(play(fw, ff)).toMatchObject({ win: false, hpLeft: 0 });
    const bw = createWorld(), bf = startFight(bw, FIGHTS.swarm, 'battleship', 'light');
    issueOrder(bw, bw.player, { type: 'approach', target: 'swarm-1' });
    expect(play(bw, bf)).toMatchObject({ win: true, killed: 3, total: 3 });
  });

  it('«Ещё раз»: бой с нуля — враги целы и на местах, обломков нет, игрок починен', () => {
    const w = createWorld();
    const f1 = startFight(w, FIGHTS.swarm, 'frigate', 'light');
    issueOrder(w, w.player, { type: 'approach', target: 'swarm-1' });
    play(w, f1);
    expect(w.player.dead).toBe(true);
    expect(w.objects.some((o) => o.id.startsWith('wreck-'))).toBe(true);
    const f2 = startFight(w, FIGHTS.swarm, 'frigate', 'light');
    expect(w.player.dead).toBe(false);
    expect(totalHp(w.player)).toBe(maxHp(w.player));
    expect(w.objects.some((o) => o.id.startsWith('wreck-'))).toBe(false);
    for (const s of enemies(w, f2)) {
      expect(totalHp(s!)).toBe(maxHp(s!));
      expect(s!.ai!.state).toBe('idle');
    }
    expect(f2.result).toBeNull();
    expect(updateFight(w, f2, [])).toBeNull();
  });

  it('из боя — в свободный полёт: пираты на своих местах, враги боя убраны, игрок у станции', () => {
    const w = createWorld();
    startFight(w, FIGHTS.swarm, 'battleship', 'light');
    endFight(w);
    expect(w.ships.filter((s) => s.faction === 'pirate').map((s) => s.id).sort()).toEqual(['pirate1', 'pirate2', 'pirate3']);
    expect(surfaceDistance(w.player, w.byId.station!)).toBeLessThan(10e3);
    expect(w.player.hull).toBe(HULLS.battleship);
    expect(ENEMIES.jackal.aggro).toBeLessThan(surfaceDistance(w.player, w.byId.pirate1!));
  });

  it('три группы: влетишь в середину — нападают все и линкор погибает; вытягиваешь по одной — побеждает', () => {
    /** Вытягивание: подлететь к ближайшей паре на дальность турели, выстрелить и ждать, пока она прилетит. */
    function pull(w: PlayerWorld, f: Fight) {
      if (w.player.attack) return;
      const alive = enemies(w, f).filter((s): s is Ship => !!s && !s.dead && !s.warp)
        .sort((a, b) => surfaceDistance(w.player, a) - surfaceDistance(w.player, b));
      const t = alive.find((s) => s.ai!.state !== 'idle') ?? alive[0];
      if (!t) return;
      if (t.ai!.state !== 'idle' || surfaceDistance(w.player, t) < weaponRange(w.player) - 2e3) {
        issueOrder(w, w.player, { type: 'stop' }); setAttack(w, w.player, t.id);
      } else if (w.player.order.type !== 'approach') issueOrder(w, w.player, { type: 'approach', target: t.id });
    }
    const run = (dive: boolean) => {
      const w = createWorld(), f = startFight(w, FIGHTS.groups, 'battleship', 'light');
      if (dive) w.player.pos = fightPoint(w, FIGHTS.groups);
      let most = 0;
      for (let t = 0; t < 900; t += 0.1) {
        pull(w, f);
        step(w, 0.1);
        most = Math.max(most, enemies(w, f).filter((s) => s && !s.dead && s.ai!.state !== 'idle').length);
        const r = updateFight(w, f, w.events.splice(0));
        if (r) return { r, most };
      }
      return { r: null, most };
    };
    const dive = run(true), careful = run(false);
    expect(dive.most).toBe(6);
    expect(dive.r?.win).toBe(false);
    expect(careful.most).toBe(2);
    expect(careful.r?.win).toBe(true);
  });
});
