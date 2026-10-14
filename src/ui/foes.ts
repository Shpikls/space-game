import { GRID_RANGE } from '../sim/constants';
import { lockProgress } from '../sim/lock';
import type { PlayerWorld, Ship } from '../sim/types';
import { surfaceDistance } from '../sim/world';
import { $, fmtDist } from './format';
import { glyph, isHostile, shortName } from './glyphs';
import { applyThreat, threatOf } from './threat';

const LAYERS = ['shield', 'armor', 'structure'] as const;

const setText = (el: Element, s: string) => { if (el.textContent !== s) el.textContent = s; };
const setWidth = (el: HTMLElement, frac: number) => { el.style.width = (100 * Math.max(0, Math.min(1, frac))).toFixed(1) + '%'; };

/**
 * Полоска врагов под карточкой состояния: все враги рядом всегда на виду — что делают (⚠ захватывает тебя,
 * ✖ атакует, рамка — твоя цель), сколько до них и сколько у них прочности. Тап — выбрать врага.
 * Порядок не прыгает: новые встают в конец, чтобы под пальцем не оказался другой враг.
 */
export function createFoes(world: PlayerWorld, selected: () => string | null, select: (id: string) => void) {
  const player = world.player;
  const el = $('foes'), chips = new Map<string, HTMLElement>();
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.foe'); if (b) select(b.dataset.id!);
  });

  return function updateFoes() {
    const foes = player.dead ? [] : world.ships.filter((s): s is Ship => isHostile(s) && !s.dead && surfaceDistance(player, s) <= GRID_RANGE);
    const ids = new Set(foes.map((f) => f.id));
    for (const [id, c] of chips) if (!ids.has(id)) { c.remove(); chips.delete(id); }
    el.hidden = foes.length === 0;
    const sel = selected();
    for (const f of foes) {
      let c = chips.get(f.id);
      if (!c) {
        c = document.createElement('button');
        c.className = 'foe'; c.dataset.id = f.id; c.setAttribute('aria-label', f.name);
        c.innerHTML = `<span class="top"><span class="mark"></span>${glyph(f, 12)}<span class="n">${shortName(f.name)}</span><span class="d"></span></span>` +
          `<span class="hp">${LAYERS.map((k) => `<i class="${k}"><b></b></i>`).join('')}</span>` +
          `<span class="lk mine"><b></b></span><span class="lk theirs"><b></b></span>`;
        el.appendChild(c); chips.set(f.id, c);
      }
      const t = threatOf(player, f);
      applyThreat(c, t);
      c.classList.toggle('sel', f.id === sel);
      setText(c.querySelector('.mark')!, t.lockedMe ? '✖' : t.lockingMe ? '⚠' : '');
      setText(c.querySelector('.d')!, fmtDist(surfaceDistance(player, f)));
      LAYERS.forEach((k) => setWidth(c.querySelector<HTMLElement>(`.${k} b`)!, f[k] / f.hull[k]));
      if (t.lockingMe) setWidth(c.querySelector<HTMLElement>('.theirs b')!, lockProgress(f));
      if (t.myLocking) setWidth(c.querySelector<HTMLElement>('.mine b')!, lockProgress(player));
    }
  };
}
