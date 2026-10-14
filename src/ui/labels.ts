import { GRID_RANGE } from '../sim/constants';
import type { Entity, PlayerWorld } from '../sim/types';
import { isLocked, lockProgress } from '../sim/lock';
import { surfaceDistance } from '../sim/world';
import { $, fmtDist } from './format';
import { glyph, isHostile } from './glyphs';

type Project = (rx: number, rz: number) => { x: number; y: number } | null;

/** Метки объектов поверх сцены: значок, у крупных — имя, у выбранного — расстояние. Тап по метке выбирает объект. */
export function createLabels(world: PlayerWorld, project: Project, selected: () => string | null, select: (id: string) => void) {
  const player = world.player;
  const labelsEl = $('labels'), labels = new Map<string, HTMLElement>();
  labelsEl.addEventListener('click', (e) => {
    const l = (e.target as HTMLElement).closest<HTMLElement>('.lbl'); if (l) select(l.dataset.id!);
  });
  const entities = (): Entity[] => [...world.objects, ...world.ships.filter((s) => s !== player)];

  return function updateLabels() {
    const w = window.innerWidth, h = window.innerHeight, seen = new Set<string>();
    const sel = selected();
    for (const e of entities()) {
      const d = surfaceDistance(player, e);
      const celestial = e.type !== 'ship' && !!e.celestial;
      const show = celestial || d <= GRID_RANGE;
      if (!show) continue;
      const pt = project(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
      if (!pt) continue;
      const { x, y } = pt;
      if (x < -40 || x > w + 40 || y < -40 || y > h + 40) continue;
      seen.add(e.id);
      let l = labels.get(e.id);
      if (!l) {
        l = document.createElement('div'); l.className = 'lbl'; l.dataset.id = e.id;
        l.innerHTML = glyph(e, 16) + `<span class="t">${e.name}<span class="d"></span></span>`;
        labelsEl.appendChild(l); labels.set(e.id, l);
      }
      l.style.display = '';
      l.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
      l.classList.toggle('named', (celestial && e.type !== 'station') || (e.type === 'station' && d > GRID_RANGE) || isHostile(e));
      l.classList.toggle('sel', e.id === sel);
      if (e.id === sel) l.querySelector('.d')!.textContent = fmtDist(d);
      // захват: враг захватывает тебя (круг), ты захватываешь его (квадрат)
      const aimsAtMe = e.type === 'ship' && e.attack === player.id && !e.dead;
      l.classList.toggle('locking-me', aimsAtMe && !isLocked(e) && lockProgress(e) > 0);
      l.classList.toggle('locked-me', aimsAtMe && isLocked(e));
      const mine = player.attack === e.id;
      l.classList.toggle('my-locking', mine && !isLocked(player));
      l.classList.toggle('my-locked', mine && isLocked(player));
    }
    for (const [id, l] of labels) if (!seen.has(id)) l.style.display = 'none';
  };
}
