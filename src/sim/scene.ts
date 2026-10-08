import { ENEMIES } from '../data/enemies';
import { MINER, REPAIR } from '../data/weapons';
import { SYSTEMS } from '../data/world';
import type { EnemyId, OreId, SystemId, Weapon } from '../data/types';
import { applyDamage, hitInfo, maxRange } from './combat';
import { dist, enemyDesired, playerDesired, steer } from './movement';
import { range, type Rng } from './rng';
import type { Asteroid, Enemy, Order, Player, Scene, SceneKind, Ship, SimEvent } from './types';

export function createScene(kind: SceneKind, sys: SystemId, player: Player, cargo: Record<OreId, number>, rng: Rng): Scene {
  player.x = 0;
  player.y = 0;
  player.vx = 0;
  player.vy = 0;
  player.target = null;
  player.mineTarget = null;
  const scene: Scene = { kind, sys, time: 0, player, enemies: [], asteroids: [], cargo, pirateT: 15, count: {}, cargoFullReported: false };
  if (kind === 'belt') generateBelt(scene, rng);
  return scene;
}

export function generateBelt(scene: Scene, rng: Rng): void {
  const sys = SYSTEMS[scene.sys];
  for (let i = 0; i < 11; i++) {
    const a = rng() * Math.PI * 2;
    const d = range(rng, 450, 1500);
    const type: OreId = rng() < (sys.belt.indarite ?? 0) ? 'indarite' : 'ferite';
    const ore = Math.round((type === 'ferite' ? range(rng, 40, 80) : range(rng, 15, 35)) * sys.rich);
    scene.asteroids.push({
      x: Math.cos(a) * d, y: Math.sin(a) * d, vx: 0, vy: 0, type, ore, oreMax: ore,
      verts: Array.from({ length: 9 }, () => range(rng, 0.72, 1.15)), rot: rng() * 6,
    });
  }
}

export function spawnEnemy(scene: Scene, type: EnemyId, dmin: number, dmax: number, rng: Rng): Enemy {
  const T = ENEMIES[type];
  const p = scene.player;
  const a = rng() * Math.PI * 2;
  const d = range(rng, dmin, dmax);
  const n = (scene.count[type] ?? 0) + 1;
  scene.count[type] = n;
  const e: Enemy = {
    side: 'enemy', type, label: `${T.name} ${n}`,
    x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, vx: 0, vy: 0, angle: a + Math.PI,
    maxSpeed: T.maxSpeed * range(rng, 0.9, 1.1), accel: T.accel, sig: T.sig, size: T.size,
    armorMax: T.armor, armor: T.armor, hullMax: T.hull, hull: T.hull, dead: false,
    w: T.weapon, cd: range(rng, 1, 2.5), ai: T.ai, range: T.range + range(rng, -30, 30), dir: rng() < 0.5 ? 1 : -1,
  };
  scene.enemies.push(e);
  return e;
}

export function spawnPirates(scene: Scene, rng: Rng): number {
  const sec = SYSTEMS[scene.sys].sec;
  const before = scene.enemies.length;
  if (sec === 'high') spawnEnemy(scene, 'light', 1100, 1300, rng);
  else if (sec === 'mid') {
    if (rng() < 0.5) {
      spawnEnemy(scene, 'light', 1100, 1300, rng);
      spawnEnemy(scene, 'light', 1100, 1300, rng);
    } else spawnEnemy(scene, 'heavy', 1200, 1400, rng);
  } else {
    spawnEnemy(scene, 'heavy', 1200, 1400, rng);
    spawnEnemy(scene, 'heavy', 1200, 1400, rng);
    spawnEnemy(scene, 'light', 1100, 1300, rng);
    spawnEnemy(scene, 'light', 1100, 1300, rng);
  }
  return scene.enemies.length - before;
}

export const cargoUsed = (cargo: Record<OreId, number>) => cargo.ferite + cargo.indarite;

function nearestEnemy(scene: Scene): Enemy | null {
  let best: Enemy | null = null;
  let bd = Infinity;
  for (const e of scene.enemies) {
    if (e.dead) continue;
    const d = dist(scene.player, e);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

export function nearestAsteroid(scene: Scene, maxD = Infinity): Asteroid | null {
  let best: Asteroid | null = null;
  let bd = maxD;
  for (const a of scene.asteroids) {
    if (a.ore <= 0) continue;
    const d = dist(scene.player, a);
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}

function fire(s: Ship, t: Ship, w: Weapon, rng: Rng, ev: SimEvent[]): void {
  const h = hitInfo(s, t, w);
  const hit = rng() < h.chance;
  let ex = t.x;
  let ey = t.y;
  if (!hit) {
    const a = rng() * Math.PI * 2;
    const off = range(rng, 45, 95);
    ex += Math.cos(a) * off;
    ey += Math.sin(a) * off;
  }
  ev.push({ type: 'shot', x1: s.x, y1: s.y, x2: ex, y2: ey, color: w.color, kind: w.id });
  if (!hit) { ev.push({ type: 'miss', target: t }); return; }
  const res = applyDamage(t, w.dmg * range(rng, 0.85, 1.15), w.id);
  ev.push({ type: 'hit', target: t, amount: res.armor + res.hull, toPlayer: (t as { side?: string }).side === 'player', layer: res.hull > 0 ? 'hull' : 'armor' });
}

/**
 * Один шаг симуляции сцены. Ничего не знает про DOM и отрисовку.
 * Возвращает события шага; при гибели игрока последним идёт playerLost.
 */
export function stepScene(scene: Scene, order: Order, dt: number, rng: Rng): SimEvent[] {
  const ev: SimEvent[] = [];
  const p = scene.player;
  scene.time += dt;

  if (!p.target || p.target.dead) p.target = nearestEnemy(scene);
  if (!p.mineTarget || p.mineTarget.ore <= 0) p.mineTarget = order.type === 'mine' ? nearestAsteroid(scene) : null;

  steer(p, playerDesired(p, order), dt);
  for (const e of scene.enemies) if (!e.dead) steer(e, enemyDesired(e, p), dt);

  // оружие игрока
  for (const tr of p.turrets) {
    tr.cd -= dt;
    if (tr.cd > 0) continue;
    const t = p.target;
    if (t && !t.dead && dist(p, t) <= maxRange(tr.w)) {
      fire(p, t, tr.w, rng, ev);
      tr.cd = tr.w.cycle;
      if (t.dead) ev.push({ type: 'kill', enemy: t });
    } else tr.cd = 0;
  }

  // добыча
  for (const m of p.miners) {
    m.cd -= dt;
    if (m.cd > 0) continue;
    const a = p.mineTarget && p.mineTarget.ore > 0 && dist(p, p.mineTarget) <= MINER.range ? p.mineTarget : nearestAsteroid(scene, MINER.range);
    if (!a) { m.cd = 0.5; continue; }
    m.cd = MINER.cycle;
    const free = p.cargoMax - cargoUsed(scene.cargo);
    if (free <= 0) {
      if (!scene.cargoFullReported) { ev.push({ type: 'cargoFull' }); scene.cargoFullReported = true; }
      continue;
    }
    const q = Math.min(MINER.yield, a.ore, free);
    a.ore -= q;
    scene.cargo[a.type] += q;
    ev.push({ type: 'shot', x1: p.x, y1: p.y, x2: a.x, y2: a.y, color: MINER.color, kind: 'mine' });
    ev.push({ type: 'mined', asteroid: a, amount: q });
    if (a.ore <= 0) ev.push({ type: 'asteroidDepleted' });
  }

  // оружие врагов
  for (const e of scene.enemies) {
    if (e.dead) continue;
    e.cd -= dt;
    if (e.cd > 0) continue;
    if (dist(e, p) <= maxRange(e.w)) {
      const armorBefore = p.armor;
      fire(e, p, e.w, rng, ev);
      e.cd = e.w.cycle * range(rng, 0.9, 1.1);
      if (p.armorMax > 0 && armorBefore > 0 && p.armor <= 0 && !p.armorBroken) { p.armorBroken = true; ev.push({ type: 'armorBroken' }); }
      if (p.dead) { ev.push({ type: 'playerLost' }); return ev; }
    } else e.cd = 0.3;
  }

  // ремонт брони
  if (p.repair) {
    p.repairT -= dt;
    if (p.repairT <= 0) {
      p.repairT = REPAIR.cycle;
      if (p.armor < p.armorMax) {
        const before = p.armor;
        p.armor = Math.min(p.armorMax, p.armor + REPAIR.amount);
        if (p.armor > 0) p.armorBroken = false;
        ev.push({ type: 'repaired', amount: p.armor - before });
      }
    }
  }

  scene.enemies = scene.enemies.filter((e) => !e.dead);
  scene.asteroids = scene.asteroids.filter((a) => a.ore > 0);

  // пираты в поясе
  if (scene.kind === 'belt') {
    scene.pirateT -= dt;
    if (scene.pirateT <= 0) {
      scene.pirateT = 25;
      if (scene.enemies.length === 0 && rng() < SYSTEMS[scene.sys].pirate) ev.push({ type: 'pirates', count: spawnPirates(scene, rng) });
    }
  }
  return ev;
}
