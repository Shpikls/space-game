import type { Ship } from '../sim/types';

const LAYERS = ['shield', 'armor', 'structure'] as const;

/**
 * Прочность — три тонкие полоски без подписей: щит (синяя), броня (оранжевая), корпус (красная).
 * Числа — во всплывающей подсказке и в отладке. Разметка создаётся один раз, дальше только обновляется.
 */
export function updateHp(el: HTMLElement, s: Ship): void {
  if (!el.firstChild) el.innerHTML = LAYERS.map((k) => `<i class="${k}"><b></b></i>`).join('');
  LAYERS.forEach((k, i) => {
    (el.children[i]!.firstElementChild as HTMLElement).style.width = ((100 * Math.max(0, s[k])) / s.hull[k]).toFixed(1) + '%';
  });
  const title = `Щит ${Math.ceil(s.shield)}, броня ${Math.ceil(s.armor)}, корпус ${Math.ceil(s.structure)}`;
  if (el.title !== title) el.title = title;
}
