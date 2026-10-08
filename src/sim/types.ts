import type { EnemyId, OreId, ShipId, SystemId, Weapon } from '../data/types';

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Ship extends Body {
  angle: number;
  maxSpeed: number;
  accel: number;
  sig: number;
  size: number;
  hull: number;
  hullMax: number;
  armor: number;
  armorMax: number;
  dead: boolean;
}

export interface Turret {
  w: Weapon;
  cd: number;
}

export interface Player extends Ship {
  side: 'player';
  ship: ShipId;
  turrets: Turret[];
  miners: { cd: number }[];
  repair: boolean;
  repairT: number;
  cargoMax: number;
  target: Enemy | null;
  mineTarget: Asteroid | null;
  armorBroken: boolean;
}

export interface Enemy extends Ship {
  side: 'enemy';
  type: EnemyId;
  label: string;
  w: Weapon;
  cd: number;
  ai: 'keep' | 'orbit';
  range: number;
  dir: 1 | -1;
}

export interface Asteroid extends Body {
  type: OreId;
  ore: number;
  oreMax: number;
  verts: number[];
  rot: number;
}

export type OrderType = 'orbit' | 'keep' | 'approach' | 'away' | 'stop' | 'mine';
export interface Order {
  type: OrderType;
  dist: number;
}

export type SceneKind = 'space' | 'station' | 'belt' | 'mission';

export interface Scene {
  kind: SceneKind;
  sys: SystemId;
  time: number;
  player: Player;
  enemies: Enemy[];
  asteroids: Asteroid[];
  cargo: Record<OreId, number>;
  pirateT: number;
  count: Partial<Record<EnemyId, number>>;
  cargoFullReported: boolean;
}

/** События шага симуляции: их читают UI, журнал и отрисовка эффектов. */
export type SimEvent =
  | { type: 'shot'; x1: number; y1: number; x2: number; y2: number; color: string; kind: 'kinetic' | 'energy' | 'mine' }
  | { type: 'hit'; target: Ship; amount: number; toPlayer: boolean; layer: 'armor' | 'hull' }
  | { type: 'miss'; target: Ship }
  | { type: 'kill'; enemy: Enemy }
  | { type: 'armorBroken' }
  | { type: 'repaired'; amount: number }
  | { type: 'mined'; asteroid: Asteroid; amount: number }
  | { type: 'asteroidDepleted' }
  | { type: 'cargoFull' }
  | { type: 'pirates'; count: number }
  | { type: 'playerLost' };
