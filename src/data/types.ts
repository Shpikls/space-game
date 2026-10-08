export type DamageType = 'kinetic' | 'energy';
export type Layer = 'armor' | 'hull';
export type OreId = 'ferite' | 'indarite';
export type EnemyId = 'heavy' | 'light';
export type ShipId = 'frigate' | 'cruiser';
export type SystemId = 'alpha' | 'beta' | 'gamma' | 'delta';
export type Security = 'high' | 'mid' | 'low';
export type SlotKind = 'weapon' | 'def' | 'util';
export type ModuleId = 'kinetic' | 'energy' | 'miner' | 'plate' | 'repair' | 'boost' | 'cargoext' | 'none';

export interface Weapon {
  id: DamageType;
  name: string;
  /** урон за выстрел до множителей слоя */
  dmg: number;
  /** секунд между выстрелами */
  cycle: number;
  /** до этой дальности точность не падает, м */
  optimal: number;
  /** на сколько метров за optimal точность падает вдвое */
  falloff: number;
  /** угловая скорость цели (рад/с), при которой шанс падает вдвое (при сигнатуре SIG_BASE) */
  tracking: number;
  color: string;
}

export interface EnemyDef {
  name: string;
  maxSpeed: number;
  accel: number;
  sig: number;
  armor: number;
  hull: number;
  ai: 'keep' | 'orbit';
  range: number;
  size: number;
  color: string;
  weapon: Weapon;
}

export interface ShipDef {
  name: string;
  hull: number;
  speed: number;
  accel: number;
  sig: number;
  slots: Record<SlotKind, number>;
  cargo: number;
  price: number;
  /** сколько брони даёт одна броневая плита на этом корпусе */
  plate: number;
  size: number;
  desc: string;
}

export interface ModuleDef {
  kind: SlotKind | 'any';
  name: string;
  price: number;
  desc: string;
}

export interface SystemDef {
  name: string;
  sec: Security;
  station: string | null;
  /** доли руд в поясе */
  belt: Partial<Record<OreId, number>>;
  /** множитель запасов руды */
  rich: number;
  /** шанс появления пиратов при каждой проверке */
  pirate: number;
  links: SystemId[];
  /** позиция на карте, 0..100 × 0..72 */
  pos: [number, number];
}
