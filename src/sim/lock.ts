import type { Hull, Ship } from './types';
import { surfaceDistance } from './world';

/** Время захвата корпуса (hull.lockTime) задано для цели с такой сигнатурой — размером с крейсер. */
export const LOCK_REF_SIGNATURE = 120;

/**
 * Сколько секунд корпус h захватывает цель с такой сигнатурой. Как в EVE: чем мельче цель, тем дольше —
 * пропорционально 1 / asinh(сигнатура)². Поэтому фрегат захватывается примерно вдвое дольше линкора,
 * а не в девять раз, как было бы по сигнатуре напрямую.
 */
export function lockTimeVs(h: Hull, signature: number): number {
  const k = Math.asinh(LOCK_REF_SIGNATURE) / Math.asinh(signature);
  return h.lockTime * k * k;
}

/** Сколько секунд s захватывает t. */
export const lockTime = (s: Ship, t: Ship): number => lockTimeVs(s.hull, t.hull.signature);

/** Ход захвата цели атаки от 0 до 1 (0 — нет цели или захват не идёт). */
export const lockProgress = (s: Ship): number => (s.attack && s.lock?.target === s.attack ? s.lock.progress : 0);

/** Цель атаки захвачена — турели могут стрелять. */
export const isLocked = (s: Ship): boolean => lockProgress(s) >= 1;

/** Сколько секунд осталось до захвата цели t. */
export const lockLeft = (s: Ship, t: Ship): number => (1 - lockProgress(s)) * lockTime(s, t);

/**
 * Захват идёт, пока цель в пределах дальности захвата и не в варпе. Цель ушла дальше или в варп —
 * захват сорван и начнётся заново. Новая цель — захват с нуля.
 */
export function stepLock(s: Ship, t: Ship | null, dt: number): void {
  if (!t) { s.lock = null; return; }
  if (s.lock?.target !== t.id) s.lock = { target: t.id, progress: 0 };
  if (t.warp || surfaceDistance(s, t) > s.hull.lockRange) { s.lock.progress = 0; return; }
  const need = lockTime(s, t);
  s.lock.progress = need > 0 ? Math.min(1, s.lock.progress + dt / need) : 1;
}
