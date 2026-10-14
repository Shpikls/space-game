import type { FightDef } from '../sim/fight';

/**
 * Бои как задачи. Цель всегда — уничтожить всех (сбежавший в варп тоже считается). У каждого боя свой «правильный» фит.
 * Дуэль и снайпер начинаются дальше, чем враги замечают, — как подлетать, решает игрок. Брулеры — засада:
 * выходишь из варпа, а они рядом. Издалека тяжёлая турель убила бы брулера, пока он летит по прямой (угловая скорость ноль).
 * Засады из двух типов врагов здесь нет: брулеру нужна лёгкая турель, снайперу — тяжёлая, а ствол пока один.
 */
export const FIGHTS = {
  duel: {
    key: 'duel', name: 'Дуэль',
    brief: 'Пират «Шакал» висит у пояса астероидов и стреляет во всё, что ближе 20 км.',
    at: 'belt', d: 0, deg: 0,
    enemies: [{ key: 'jackal', d: 0, deg: 0 }],
    start: { d: 45e3, deg: 200 },
  },
  brawler: {
    key: 'brawler', name: 'Брулер',
    brief: 'Выходишь из варпа у обломков конвоя, а брулер «Оса» уже в 8 км: бросится в бой и закружит вплотную.',
    at: 'signal', d: 0, deg: 0,
    enemies: [{ key: 'wasp', d: 0, deg: 0 }],
    start: { d: 8e3, deg: 40 },
  },
  sniper: {
    key: 'sniper', name: 'Снайпер',
    brief: 'Снайпер «Гюрза» у Ксанты II держит 30 км и бьёт тяжёлой турелью. Подбит — уходит в варп.',
    at: 'p2', d: 2e7, deg: 0,
    enemies: [{ key: 'viper', d: 0, deg: 0 }],
    start: { d: 60e3, deg: 300 },
  },
  swarm: {
    key: 'swarm', name: 'Звено',
    brief: 'Выходишь из варпа у Ксанты III, а в 10 км звено из трёх брулеров. Нападают вместе.',
    at: 'p3', d: 1.5e8, deg: 300,
    enemies: [
      { key: 'wasp', name: 'Брулер «Оса-1»', d: 3e3, deg: 0 },
      { key: 'wasp', name: 'Брулер «Оса-2»', d: 3e3, deg: 120 },
      { key: 'wasp', name: 'Брулер «Оса-3»', d: 3e3, deg: 240 },
    ],
    start: { d: 10e3, deg: 300 },
  },
} satisfies Record<string, FightDef>;

export type FightKey = keyof typeof FIGHTS;
export const isFightKey = (k: string | null | undefined): k is FightKey => !!k && Object.hasOwn(FIGHTS, k);
