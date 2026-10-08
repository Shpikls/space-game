import type { Body, Enemy, Order, Player, Ship } from './types';

export type Vec2 = [number, number];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const dist = (a: Body, b: Body) => Math.hypot(a.x - b.x, a.y - b.y);

/** Плавно разгоняет корабль к желаемой скорости с ограничением ускорения. */
export function steer(s: Ship, desired: Vec2, dt: number): void {
  let [dx, dy] = desired;
  const m = Math.hypot(dx, dy);
  if (m > s.maxSpeed) {
    dx = (dx / m) * s.maxSpeed;
    dy = (dy / m) * s.maxSpeed;
  }
  let ax = dx - s.vx;
  let ay = dy - s.vy;
  const am = Math.hypot(ax, ay);
  const lim = s.accel * dt;
  if (am > lim) {
    ax = (ax / am) * lim;
    ay = (ay / am) * lim;
  }
  s.vx += ax;
  s.vy += ay;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  if (Math.hypot(s.vx, s.vy) > 4) s.angle = Math.atan2(s.vy, s.vx);
}

export function orbitDesired(s: Ship, t: Body, radius: number, dir: 1 | -1): Vec2 {
  const d = dist(s, t) || 1;
  const rx = (s.x - t.x) / d;
  const ry = (s.y - t.y) / d;
  const corr = clamp((d - radius) / (radius * 0.5), -1, 1);
  const vx = -ry * dir - rx * corr * 1.5;
  const vy = rx * dir - ry * corr * 1.5;
  const m = Math.hypot(vx, vy) || 1;
  return [(vx / m) * s.maxSpeed, (vy / m) * s.maxSpeed];
}

export function keepDesired(s: Ship, t: Body, range: number): Vec2 {
  const d = dist(s, t) || 1;
  const rx = (s.x - t.x) / d;
  const ry = (s.y - t.y) / d;
  const k = clamp((d - range) / 120, -1, 1);
  return [t.vx - rx * k * s.maxSpeed, t.vy - ry * k * s.maxSpeed];
}

export function playerDesired(p: Player, order: Order): Vec2 {
  if (order.type === 'mine') {
    const a = p.mineTarget;
    if (!a) return [0, 0];
    const d = dist(p, a) || 1;
    return d > 150 ? [((a.x - p.x) / d) * p.maxSpeed, ((a.y - p.y) / d) * p.maxSpeed] : [0, 0];
  }
  const t = p.target;
  if (!t) return order.type === 'away' ? [p.vx, p.vy] : [0, 0];
  const d = dist(p, t) || 1;
  switch (order.type) {
    case 'orbit':
      return orbitDesired(p, t, order.dist, 1);
    case 'keep':
      return keepDesired(p, t, order.dist);
    case 'approach':
      return d > 130 ? [((t.x - p.x) / d) * p.maxSpeed, ((t.y - p.y) / d) * p.maxSpeed] : [t.vx, t.vy];
    case 'away':
      return [((p.x - t.x) / d) * p.maxSpeed, ((p.y - t.y) / d) * p.maxSpeed];
    default:
      return [0, 0];
  }
}

export const enemyDesired = (e: Enemy, p: Player): Vec2 =>
  e.ai === 'keep' ? keepDesired(e, p, e.range) : orbitDesired(e, p, e.range, e.dir);
