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

const HOSTILE_SHIP = `<path d="M7 2 12 11.5H2Z" fill="#ff7a6b" fill-opacity=".35" stroke="#ff7a6b" stroke-width="1.5"/>`;

/** Враг — корабль пиратов. */
export const isHostile = (e: Entity) => e.type === 'ship' && e.faction === 'pirate';

/** Короткое имя для тесных мест: у «Брулер «Оса»» — «Оса». */
export const shortName = (name: string) => /«(.+?)»/.exec(name)?.[1] ?? name;

/** Значок объекта для обзора и меток; враги — красные. */
export function glyph(e: Entity, size = 14): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 14 14" aria-hidden="true">${isHostile(e) ? HOSTILE_SHIP : BODY[e.type]}</svg>`;
}
