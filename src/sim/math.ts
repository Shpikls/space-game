export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Угол в диапазон [−π, π). */
export function wrap(a: number): number {
  a = (a + Math.PI) % (2 * Math.PI);
  if (a < 0) a += 2 * Math.PI;
  return a - Math.PI;
}

/** Курс на вектор (dx, dz): нос смотрит в (sin yaw, cos yaw). */
export const yawTo = (dx: number, dz: number) => Math.atan2(dx, dz);
