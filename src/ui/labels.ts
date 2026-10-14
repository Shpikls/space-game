import { GRID_RANGE } from '../sim/constants';
import type { Entity, PlayerWorld } from '../sim/types';
import { surfaceDistance } from '../sim/world';
import { $, fmtDist } from './format';
import { glyph, isHostile } from './glyphs';
import { applyThreat, threatOf } from './threat';

type Project = (rx: number, rz: number) => { x: number; y: number } | null;
type ScreenDir = (rx: number, rz: number) => { x: number; y: number };

// Стрелка к врагу за краем экрана стоит на столько пикселей внутри края
const EDGE_INSET = 22;
const ARROW = `<svg width="16" height="16" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2.5 12.5 7 2 11.5 4.5 7Z" fill="currentColor"/></svg>`;

/**
 * Метки объектов поверх сцены: значок, у крупных — имя, у выбранного — расстояние. Тап по метке выбирает объект.
 * Враг рядом, но за краем экрана — стрелка у края в его сторону (тоже выбирает по тапу).
 */
export function createLabels(world: PlayerWorld, project: Project, screenDir: ScreenDir, selected: () => string | null, select: (id: string) => void) {
  const player = world.player;
  const labelsEl = $('labels'), labels = new Map<string, HTMLElement>(), arrows = new Map<string, HTMLElement>();
  labelsEl.addEventListener('click', (e) => {
    const l = (e.target as HTMLElement).closest<HTMLElement>('.lbl,.edge'); if (l) select(l.dataset.id!);
  });
  const entities = (): Entity[] => [...world.objects, ...world.ships.filter((s) => s !== player)];

  /** Ставит стрелку к врагу e у края экрана; dx, dy — направление от центра экрана. */
  function placeArrow(e: Entity, dx: number, dy: number, w: number, h: number) {
    let a = arrows.get(e.id);
    if (!a) {
      a = document.createElement('div'); a.className = 'edge'; a.dataset.id = e.id; a.innerHTML = ARROW;
      a.setAttribute('aria-label', e.name);
      labelsEl.appendChild(a); arrows.set(e.id, a);
    }
    const cx = w / 2, cy = h / 2;
    // луч из центра до прямоугольника, отступающего от краёв на EDGE_INSET
    const tx = dx > 0 ? (w - EDGE_INSET - cx) / dx : dx < 0 ? (EDGE_INSET - cx) / dx : Infinity;
    const ty = dy > 0 ? (h - EDGE_INSET - cy) / dy : dy < 0 ? (EDGE_INSET - cy) / dy : Infinity;
    const t = Math.min(tx, ty);
    a.style.display = '';
    a.style.transform = `translate(${(cx + dx * t).toFixed(1)}px,${(cy + dy * t).toFixed(1)}px)`;
    (a.firstElementChild as HTMLElement).style.transform = `rotate(${Math.atan2(dy, dx).toFixed(3)}rad)`;
    applyThreat(a, e.type === 'ship' ? threatOf(player, e) : null);
    a.classList.toggle('sel', e.id === selected());
  }

  return function updateLabels() {
    const w = window.innerWidth, h = window.innerHeight, seen = new Set<string>(), pointed = new Set<string>();
    const sel = selected();
    for (const e of entities()) {
      const d = surfaceDistance(player, e);
      const celestial = e.type !== 'ship' && !!e.celestial;
      const show = celestial || d <= GRID_RANGE;
      if (!show) continue;
      const rx = e.pos.x - player.pos.x, rz = e.pos.z - player.pos.z;
      const pt = project(rx, rz);
      const onScreen = !!pt && pt.x >= -40 && pt.x <= w + 40 && pt.y >= -40 && pt.y <= h + 40;
      if (!onScreen) {
        if (isHostile(e) && !player.dead) {
          // перед камерой — по точке на экране, за спиной — по направлению в системе камеры
          const dir = pt ? { x: pt.x - w / 2, y: pt.y - h / 2 } : screenDir(rx, rz);
          if (dir.x || dir.y) { placeArrow(e, dir.x, dir.y, w, h); pointed.add(e.id); }
        }
        continue;
      }
      const { x, y } = pt!;
      seen.add(e.id);
      let l = labels.get(e.id);
      if (!l) {
        l = document.createElement('div'); l.className = 'lbl'; l.dataset.id = e.id;
        l.innerHTML = glyph(e, 16) + `<span class="t">${e.name}<span class="d"></span></span>`;
        labelsEl.appendChild(l); labels.set(e.id, l);
      }
      l.style.display = '';
      l.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
      // имена врагов — в полоске врагов; в космосе подписан только тот, кто захватывает тебя (жёлтым), и выбранный
      const threat = e.type === 'ship' ? threatOf(player, e) : null;
      l.classList.toggle('named', (celestial && e.type !== 'station') || (e.type === 'station' && d > GRID_RANGE) || !!threat?.lockingMe);
      l.classList.toggle('sel', e.id === sel);
      if (e.id === sel) l.querySelector('.d')!.textContent = fmtDist(d);
      applyThreat(l, threat);
    }
    for (const [id, l] of labels) if (!seen.has(id)) l.style.display = 'none';
    for (const [id, a] of arrows) {
      if (pointed.has(id)) continue;
      if (world.byId[id]) a.style.display = 'none';
      else { a.remove(); arrows.delete(id); }
    }
  };
}
