import type { ModuleDef, ModuleId, ShipDef, ShipId, SlotKind } from './types';

export const SHIPS: Record<ShipId, ShipDef> = {
  frigate: {
    name: 'Фрегат «Стриж»', hull: 250, speed: 230, accel: 170, sig: 45, slots: { weapon: 2, def: 1, util: 1 },
    cargo: 50, price: 0, plate: 150, size: 9,
    desc: 'Лёгкий и быстрый. Перехватчикам трудно по нему попасть, но тяжёлый бой ему не по силам. Бесплатный: после потери выдаётся снова.',
  },
  cruiser: {
    name: 'Крейсер «Кондор»', hull: 650, speed: 150, accel: 85, sig: 110, slots: { weapon: 3, def: 2, util: 1 },
    cargo: 120, price: 12000, plate: 350, size: 14,
    desc: 'Тяжёлый и медленный. Три оружия, две плиты, большой трюм. Крупная мишень для тяжёлых пушек. Потерял — покупай заново.',
  },
};

export const MODULES: Record<ModuleId, ModuleDef> = {
  kinetic: { kind: 'weapon', name: 'Рельса', price: 0, desc: 'Кинетика, 700 м, сильна по броне' },
  energy: { kind: 'weapon', name: 'Лазер', price: 0, desc: 'Энергетика, 420 м, силён по корпусу' },
  miner: { kind: 'weapon', name: 'Буровой лазер', price: 800, desc: 'Добыча руды на 250 м' },
  plate: { kind: 'def', name: 'Броневая плита', price: 0, desc: 'Броня: +150 фрегату, +350 крейсеру; −15% скорости' },
  repair: { kind: 'util', name: 'Ремонт брони', price: 1500, desc: '+30 брони каждые 4 с' },
  boost: { kind: 'util', name: 'Форсаж', price: 1200, desc: '+30% скорости' },
  cargoext: { kind: 'util', name: 'Расширитель трюма', price: 1000, desc: '+60% трюма' },
  none: { kind: 'any', name: 'Пусто', price: 0, desc: '' },
};

export const SLOT_OPTIONS: Record<SlotKind, ModuleId[]> = {
  weapon: ['kinetic', 'energy', 'miner'],
  def: ['plate', 'none'],
  util: ['none', 'repair', 'boost', 'cargoext'],
};
