import { AU, DEG } from './constants';
import { step } from './step';
import type { HullKey } from './types';
import { addShip, emptyWorld } from './world';

export interface WarpMeasure {
  /** время выравнивания до входа в варп, с */
  align: number;
  /** время самого варпа, с */
  warp: number;
  total: number;
}

/** Замер для отладки и тестов: выравнивание с разворотом на turnDeg и варп на distAU. */
export function measureWarp(hullKey: HullKey, distAU: number, turnDeg: number): WarpMeasure {
  const w = emptyWorld();
  const tgt = { id: 't', name: 't', type: 'signal' as const, celestial: true,
    pos: { x: Math.sin(turnDeg * DEG) * distAU * AU, z: Math.cos(turnDeg * DEG) * distAU * AU }, radius: 0, warpIn: 0 };
  w.objects.push(tgt); w.byId.t = tgt;
  const s = addShip(w, 's', 's', hullKey, { x: 0, z: 0 }, 0, 'test');
  s.order = { type: 'warp', target: 't', dist: 0 };
  let align: number | null = null, total: number | null = null;
  for (let i = 0; i < 20000 && total === null; i++) {
    step(w, 0.02);
    for (const e of w.events) {
      if (e.type === 'warpStart' && align === null) align = w.time;
      if (e.type === 'warpEnd') total = w.time;
    }
    w.events.length = 0;
  }
  if (align === null || total === null) throw new Error('варп не завершился за 400 с');
  return { align, warp: total - align, total };
}
