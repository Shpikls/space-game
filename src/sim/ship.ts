import { ALIGN_ANGLE, ALIGN_FRACTION } from './constants';
import { angAccel, linAccel } from './hulls';
import { clamp, wrap, yawTo } from './math';
import type { Hull, Ship, World } from './types';
import { startWarp, stepWarp } from './warp';
import { landingPoint, objectById } from './world';

/** Поворот маневровыми: разгоняем вращение так, чтобы успеть затормозить его точно на нужном курсе. */
export function steer(s: Ship, desiredYaw: number | null, dt: number): void {
  const h = s.hull, a = angAccel(h);
  let targetW = 0;
  if (desiredYaw !== null) {
    const err = wrap(desiredYaw - s.yaw);
    if (Math.abs(err) < 1e-4 && Math.abs(s.angVel) < a * dt) { s.yaw = wrap(desiredYaw); s.angVel = 0; return; }
    targetW = Math.sign(err) * Math.min(h.maxTurn, Math.sqrt(2 * a * Math.abs(err) * 0.9));
  }
  const dw = clamp(targetW - s.angVel, -a * dt, a * dt);
  s.angVel += dw;
  s.yaw = wrap(s.yaw + s.angVel * dt);
}

/** Скорость, с которой ещё успеваем остановиться через d метров. */
export function arriveSpeed(h: Hull, d: number): number {
  return d <= 0 ? 0 : Math.min(h.maxSpeed, Math.sqrt(2 * linAccel(h) * d) * 0.85);
}

/** Один шаг корабля по его приказу. Скорость всегда направлена по носу. */
export function stepShip(world: World, s: Ship, dt: number): void {
  if (s.warp) { stepWarp(world, s, dt); return; }
  const h = s.hull, o = s.order;
  let desiredYaw: number | null = null, desiredSpeed = 0;
  const tObj = 'target' in o ? world.byId[o.target] : undefined;
  // цель исчезла — приказ снимается
  if ('target' in o && !tObj) s.order = { type: 'stop' };
  switch (o.type) {
    case 'dir':
      desiredYaw = o.yaw; desiredSpeed = h.maxSpeed; break;
    case 'approach': {
      if (!tObj) break;
      const dx = tObj.pos.x - s.pos.x, dz = tObj.pos.z - s.pos.z;
      const stopAt = (tObj.radius || 0) + Math.max(300, h.size * 3);
      desiredYaw = yawTo(dx, dz); desiredSpeed = arriveSpeed(h, Math.hypot(dx, dz) - stopAt);
      break;
    }
    case 'orbit': {
      if (!tObj) break;
      let rx = s.pos.x - tObj.pos.x, rz = s.pos.z - tObj.pos.z;
      const d = Math.hypot(rx, rz) || 1; rx /= d; rz /= d;
      if (o.sign === undefined) {
        // направление обхода — то, куда корабль уже смотрит
        const hx = Math.sin(s.yaw), hz = Math.cos(s.yaw);
        o.sign = hx * -rz + hz * rx >= 0 ? 1 : -1;
      }
      const tx = -rz * o.sign, tz = rx * o.sign;
      const R = o.range + (tObj.radius || 0);
      const c = clamp((R - d) / Math.max(R * 0.35, 1000), -2, 2);
      desiredYaw = yawTo(tx + rx * c, tz + rz * c); desiredSpeed = h.maxSpeed;
      break;
    }
    case 'keep': {
      if (!tObj) break;
      const dx = tObj.pos.x - s.pos.x, dz = tObj.pos.z - s.pos.z;
      const d = Math.hypot(dx, dz), R = o.range + (tObj.radius || 0), e = d - R;
      const tol = Math.max(200, R * 0.04);
      if (e > tol) { desiredYaw = yawTo(dx, dz); desiredSpeed = arriveSpeed(h, e); }
      else if (e < -tol) { desiredYaw = yawTo(-dx, -dz); desiredSpeed = arriveSpeed(h, -e); }
      break;
    }
    case 'warp': {
      const tgt = objectById(world, o.target);
      if (!tgt) break;
      const land = landingPoint(tgt, s.pos, o.dist);
      desiredYaw = yawTo(land.x - s.pos.x, land.z - s.pos.z); desiredSpeed = h.maxSpeed;
      const err = Math.abs(wrap(desiredYaw - s.yaw));
      s.align = { angle: err, speedFrac: s.speed / (h.maxSpeed * ALIGN_FRACTION) };
      if (err < ALIGN_ANGLE && s.speed >= ALIGN_FRACTION * h.maxSpeed - 1e-6) { startWarp(world, s, land, tgt, o.dist); return; }
      break;
    }
  }
  steer(s, desiredYaw, dt);
  const a = linAccel(h);
  s.speed += clamp(desiredSpeed - s.speed, -a * dt, a * dt);
  s.pos.x += Math.sin(s.yaw) * s.speed * dt;
  s.pos.z += Math.cos(s.yaw) * s.speed * dt;
}
