import type { Entity } from '../sim/types';

export type EntityType = Entity['type'];

export const TYPE_NAME: Record<EntityType, string> = {
  star: 'Звезда', planet: 'Планета', station: 'Станция', belt: 'Пояс астероидов', signal: 'Сигнал',
  asteroid: 'Астероид', wreck: 'Обломки', ship: 'Корабль',
};

const c = 'currentColor';
const BODY: Record<EntityType, string> = {
  star: `<circle cx="7" cy="7" r="4.5" fill="#f3c46e"/>`,
  planet: `<circle cx="7" cy="7" r="5" fill="none" stroke="${c}" stroke-width="1.5"/>`,
  station: `<rect x="2.5" y="2.5" width="9" height="9" fill="none" stroke="${c}" stroke-width="1.5"/>`,
  belt: `<path d="M7 1.5 12.5 7 7 12.5 1.5 7Z" fill="none" stroke="${c}" stroke-width="1.5"/>`,
  signal: `<path d="M7 2 12.5 12H1.5Z" fill="none" stroke="#e7b25e" stroke-width="1.5"/>`,
  asteroid: `<path d="M7 3.5 10.5 7 7 10.5 3.5 7Z" fill="${c}" opacity=".75"/>`,
  wreck: `<path d="M3.5 3.5 10.5 10.5M10.5 3.5 3.5 10.5" stroke="#d98a52" stroke-width="1.6"/>`,
  ship: `<path d="M7 2 12 11.5H2Z" fill="none" stroke="#e3a87a" stroke-width="1.5"/>`,
};

/** Значок типа объекта для обзора и меток. */
export function glyph(type: EntityType, size = 14): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 14 14" aria-hidden="true">${BODY[type]}</svg>`;
}
