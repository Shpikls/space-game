import type { EnemyId, ShipId, SystemId } from '../data/types';
import { createScene, spawnEnemy, stepScene } from '../sim/scene';
import { seededRng } from '../sim/rng';
import type { Order } from '../sim/types';
import { buildPlayer } from './fit';
import type { Fit } from './state';

export interface MissionSim {
  ship: ShipId;
  fit: Fit;
  comp: Partial<Record<EnemyId, number>>;
  order: Order;
  sys?: SystemId;
  maxTime?: number;
}

/** Прогоняет бой задания без вмешательства игрока: проверка «правильная подготовка решает». */
export function simulateMission(cfg: MissionSim, seed: number): { won: boolean; time: number; hullLeft: number } {
  const rng = seededRng(seed);
  const player = buildPlayer(cfg.ship, cfg.fit);
  const scene = createScene('mission', cfg.sys ?? 'alpha', player, { ferite: 0, indarite: 0 }, rng);
  for (let i = 0; i < (cfg.comp.heavy ?? 0); i++) spawnEnemy(scene, 'heavy', 1600, 1900, rng);
  for (let i = 0; i < (cfg.comp.light ?? 0); i++) spawnEnemy(scene, 'light', 1450, 1700, rng);
  const dt = 1 / 60;
  const maxTime = cfg.maxTime ?? 300;
  while (scene.time < maxTime) {
    const ev = stepScene(scene, cfg.order, dt, rng);
    if (ev.some((e) => e.type === 'playerLost')) return { won: false, time: scene.time, hullLeft: 0 };
    if (scene.enemies.length === 0) return { won: true, time: scene.time, hullLeft: player.hull };
  }
  return { won: false, time: maxTime, hullLeft: player.hull };
}

export function winRate(cfg: MissionSim, runs = 40): number {
  let wins = 0;
  for (let i = 0; i < runs; i++) if (simulateMission(cfg, 1000 + i).won) wins++;
  return wins / runs;
}
