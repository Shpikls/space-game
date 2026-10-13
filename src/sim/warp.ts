import { AU } from './constants';
import { yawTo } from './math';
import type { Ship, SpaceObject, Vec2, World } from './types';

export function startWarp(world: World, s: Ship, land: Vec2, tgt: SpaceObject, dist: number): void {
  const dx = land.x - s.pos.x, dz = land.z - s.pos.z, total = Math.hypot(dx, dz);
  s.align = null;
  s.attack = null; // в варпе турели не стреляют, цель сбрасывается
  world.events.push({ type: 'warpStart', ship: s.id, target: tgt.id });
  if (world.debug.instantWarp) {
    s.pos = { x: land.x, z: land.z }; s.speed = 0; s.order = { type: 'stop' };
    world.events.push({ type: 'warpEnd', ship: s.id, target: tgt.id, duration: 0 });
    return;
  }
  s.yaw = yawTo(dx, dz); s.angVel = 0;
  s.warp = { from: { x: s.pos.x, z: s.pos.z }, dx: dx / total, dz: dz / total, total, traveled: 0, v: s.speed,
    phase: 'accel', target: tgt.id, dist, startTime: world.time };
}

/** Варп: экспоненциальный разгон → крейсерский участок → экспоненциальное торможение. */
export function stepWarp(world: World, s: Ship, dt: number): void {
  const w = s.warp!, h = s.hull;
  const vmax = h.warpSpeed * AU, kA = h.warpAccel, kD = h.warpDecel;
  const remain = w.total - w.traveled;
  if (w.phase !== 'decel' && remain <= w.v / kD) w.phase = 'decel';
  if (w.phase === 'decel') {
    const nr = remain * Math.exp(-kD * dt);
    w.traveled = w.total - nr; w.v = kD * nr;
    if (w.v < h.maxSpeed * 0.5) {
      s.pos = { x: w.from.x + w.dx * w.traveled, z: w.from.z + w.dz * w.traveled };
      s.speed = w.v; s.warp = null; s.order = { type: 'stop' };
      world.events.push({ type: 'warpEnd', ship: s.id, target: w.target, duration: world.time - w.startTime });
      return;
    }
  } else {
    let v1 = w.v * Math.exp(kA * dt);
    if (v1 >= vmax) { v1 = vmax; w.phase = 'cruise'; }
    w.traveled = Math.min(w.total, w.traveled + ((w.v + v1) / 2) * dt);
    w.v = v1;
  }
  s.speed = w.v;
  s.pos = { x: w.from.x + w.dx * w.traveled, z: w.from.z + w.dz * w.traveled };
}
