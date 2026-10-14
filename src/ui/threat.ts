import { isLocked, lockProgress } from '../sim/lock';
import type { Ship } from '../sim/types';

/** Что враг делает с нами и мы с ним — для карточки, меток, полоски врагов и стрелок к врагам. */
export interface Threat {
  /** захватывает тебя */
  lockingMe: boolean;
  /** захватил тебя — атакует */
  lockedMe: boolean;
  /** ты его захватываешь */
  myLocking: boolean;
  /** ты его захватил */
  myLocked: boolean;
}

export function threatOf(player: Ship, e: Ship): Threat {
  const aims = e.attack === player.id && !e.dead, mine = player.attack === e.id;
  return {
    lockingMe: aims && !isLocked(e) && lockProgress(e) > 0,
    lockedMe: aims && isLocked(e),
    myLocking: mine && !isLocked(player),
    myLocked: mine && isLocked(player),
  };
}

/** Классы locking-me, locked-me, my-locking, my-locked — по ним стили рисуют захват. */
export function applyThreat(el: HTMLElement, t: Threat | null): void {
  el.classList.toggle('locking-me', !!t?.lockingMe);
  el.classList.toggle('locked-me', !!t?.lockedMe);
  el.classList.toggle('my-locking', !!t?.myLocking);
  el.classList.toggle('my-locked', !!t?.myLocked);
}
