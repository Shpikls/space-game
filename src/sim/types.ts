/** Позиция в плоскости XZ, метры. */
export interface Vec2 {
  x: number;
  z: number;
}

export type HullKey = 'frigate' | 'cruiser' | 'battleship';

export interface Hull {
  key: HullKey;
  name: string;
  /** кг */
  mass: number;
  /** длина корпуса, м */
  size: number;
  /** тяга маршевых двигателей, Н */
  thrust: number;
  /** момент маневровых двигателей, Н·м */
  torque: number;
  /** предел скорости вращения, рад/с */
  maxTurn: number;
  /** м/с */
  maxSpeed: number;
  /** а. е./с */
  warpSpeed: number;
  /** темп экспоненциального разгона в варпе, 1/с */
  warpAccel: number;
  /** темп экспоненциального торможения в варпе, 1/с */
  warpDecel: number;
  /** прочность корпуса: сколько урона выдерживает */
  structure: number;
}

export interface TurretDef {
  key: string;
  name: string;
  /** урон за выстрел */
  damage: number;
  /** секунд между выстрелами */
  cycle: number;
  /** дальность стрельбы, м */
  range: number;
  /** скорость наведения: как быстро башня поворачивается к цели, рад/с */
  tracking: number;
}

export interface Turret {
  def: TurretDef;
  /** сколько секунд до готовности к выстрелу */
  cooldown: number;
  /** куда смотрит ствол относительно носа корабля, рад (0 — вперёд) */
  aim: number;
}

export type ObjectType = 'star' | 'planet' | 'station' | 'belt' | 'signal' | 'asteroid' | 'wreck';
export type PlanetLook = 'rock' | 'terran' | 'gas' | 'ice' | 'red';

export interface SpaceObject {
  id: string;
  name: string;
  type: ObjectType;
  pos: Vec2;
  /** м; у поясов и сигналов 0 */
  radius: number;
  /** виден в обзоре «Система», к нему можно варпнуть */
  celestial?: boolean;
  /** мелкий объект, виден только вблизи */
  local?: boolean;
  /** на каком расстоянии от центра выходят из варпа при «варп на 0 км» */
  warpIn?: number;
  look?: PlanetLook;
  seed?: number;
}

export type Order =
  | { type: 'stop' }
  | { type: 'dir'; yaw: number }
  | { type: 'approach'; target: string }
  | { type: 'orbit'; target: string; range: number; sign?: 1 | -1 }
  | { type: 'keep'; target: string; range: number }
  | { type: 'warp'; target: string; dist: number };

export interface Warp {
  from: Vec2;
  /** единичный вектор направления */
  dx: number;
  dz: number;
  total: number;
  traveled: number;
  /** текущая скорость, м/с */
  v: number;
  phase: 'accel' | 'cruise' | 'decel';
  target: string;
  dist: number;
  startTime: number;
}

/** Ход выравнивания перед варпом: насколько курс далёк от цели и сколько набрано скорости. */
export interface Align {
  angle: number;
  /** 1 = набрано 70% макс. скорости */
  speedFrac: number;
}

export type Faction = 'player' | 'npc' | 'pirate' | 'test';

export interface Ship {
  id: string;
  name: string;
  type: 'ship';
  faction: Faction;
  hull: Hull;
  pos: Vec2;
  /** курс: нос смотрит в (sin yaw, cos yaw) */
  yaw: number;
  angVel: number;
  speed: number;
  order: Order;
  warp: Warp | null;
  align: Align | null;
  radius: number;
  /** оставшаяся прочность корпуса */
  structure: number;
  turrets: Turret[];
  /** id корабля, по которому стреляют турели; не зависит от приказа движения */
  attack: string | null;
  /** уничтожен; в конце шага убирается из мира */
  dead: boolean;
}

export type Entity = SpaceObject | Ship;

export type SimEvent =
  | { type: 'warpStart'; ship: string; target: string }
  | { type: 'warpEnd'; ship: string; target: string; duration: number }
  | { type: 'shot'; ship: string; target: string; turret: number; damage: number; from: Vec2; to: Vec2 }
  | { type: 'destroyed'; ship: string; name: string; by: string; pos: Vec2; size: number };

export interface World {
  time: number;
  timeScale: number;
  objects: SpaceObject[];
  ships: Ship[];
  byId: Record<string, Entity | undefined>;
  /** события накапливаются, пока их не заберёт интерфейс */
  events: SimEvent[];
  debug: { instantWarp: boolean };
  player: Ship | null;
}

export type PlayerWorld = World & { player: Ship };
