import { DAMAGE_MULT, SIG_BASE } from '../data/weapons';
import type { DamageType, Weapon } from '../data/types';
import type { Body, Ship } from './types';

export interface HitInfo {
  chance: number;
  inRange: boolean;
  reason: 'вне досягаемости' | 'хорошие условия' | 'цель быстро смещается' | 'цель далеко';
}

/** Шанс попадания: множитель по слежению (угловая скорость и сигнатура) × множитель по дальности. */
export function hitInfo(s: Body, t: Body & { sig: number }, w: Weapon): HitInfo {
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const d = Math.hypot(dx, dy) || 1;
  const rx = dx / d;
  const ry = dy / d;
  const transversal = Math.abs(rx * (t.vy - s.vy) - ry * (t.vx - s.vx));
  const angular = transversal / d;
  const trackTerm = (angular / w.tracking) * (SIG_BASE / t.sig);
  const rangeTerm = Math.max(0, d - w.optimal) / w.falloff;
  const tf = Math.pow(0.5, trackTerm * trackTerm);
  const rf = Math.pow(0.5, rangeTerm * rangeTerm);
  const chance = tf * rf;
  const inRange = d <= maxRange(w);
  let reason: HitInfo['reason'];
  if (!inRange) reason = 'вне досягаемости';
  else if (chance > 0.75) reason = 'хорошие условия';
  else if (tf < rf) reason = 'цель быстро смещается';
  else reason = 'цель далеко';
  return { chance, inRange, reason };
}

export const maxRange = (w: Weapon) => w.optimal + 2.5 * w.falloff;

/** Урон сначала по броне (со своим множителем), остаток переходит в корпус. */
export function applyDamage(t: Ship, raw: number, type: DamageType): { armor: number; hull: number } {
  const m = DAMAGE_MULT[type];
  let armor = 0;
  let hull = 0;
  if (t.armor > 0) {
    const ad = raw * m.armor;
    if (ad <= t.armor) {
      t.armor -= ad;
      armor = ad;
    } else {
      armor = t.armor;
      t.armor = 0;
      hull = ((ad - armor) / m.armor) * m.hull;
      t.hull -= hull;
    }
  } else {
    hull = raw * m.hull;
    t.hull -= hull;
  }
  if (t.hull <= 0) {
    t.hull = 0;
    t.dead = true;
  }
  return { armor, hull };
}
