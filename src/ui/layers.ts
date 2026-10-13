import type { Ship } from '../sim/types';

const LAYERS = [['shield', 'Щит'], ['armor', 'Броня'], ['structure', 'Корпус']] as const;

/** Три полоски прочности — щит, броня, корпус. Разметка создаётся один раз, дальше только обновляется. */
export function updateLayers(el: HTMLElement, s: Ship): void {
  if (!el.firstChild) {
    el.innerHTML = LAYERS.map(([k, name]) =>
      `<div class="lay ${k}"><div class="row"><span>${name}</span><b></b></div><div class="meter"><i></i></div></div>`).join('');
  }
  LAYERS.forEach(([k], i) => {
    const lay = el.children[i] as HTMLElement, v = s[k], max = s.hull[k];
    lay.querySelector('b')!.textContent = String(Math.ceil(v));
    (lay.querySelector('i') as HTMLElement).style.width = ((100 * v) / max).toFixed(1) + '%';
  });
}
