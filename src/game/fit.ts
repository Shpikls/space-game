import { SHIPS } from '../data/ships';
import { WEAPONS, REPAIR } from '../data/weapons';
import type { DamageType, ShipId } from '../data/types';
import type { Player } from '../sim/types';
import type { Fit } from './state';

export interface ShipStats {
  speed: number;
  accel: number;
  armor: number;
  hull: number;
  cargo: number;
  sig: number;
  size: number;
  repair: boolean;
  weapons: DamageType[];
  miners: number;
}

export function shipStats(ship: ShipId, fit: Fit): ShipStats {
  const S = SHIPS[ship];
  let speed = S.speed;
  let accel = S.accel;
  let armor = 0;
  let cargo = S.cargo;
  let repair = false;
  for (const d of fit.def) {
    if (d === 'plate') { armor += S.plate; speed *= 0.85; accel *= 0.85; }
  }
  for (const u of fit.util) {
    if (u === 'boost') { speed *= 1.3; accel *= 1.2; }
    if (u === 'cargoext') cargo = Math.round(cargo * 1.6);
    if (u === 'repair') repair = true;
  }
  const weapons = fit.weapon.filter((w): w is DamageType => w === 'kinetic' || w === 'energy');
  return {
    speed, accel, armor, hull: S.hull, cargo, sig: S.sig, size: S.size, repair: repair && armor > 0,
    weapons, miners: fit.weapon.filter((w) => w === 'miner').length,
  };
}

export function buildPlayer(ship: ShipId, fit: Fit): Player {
  const st = shipStats(ship, fit);
  return {
    side: 'player', ship, x: 0, y: 0, vx: 0, vy: 0, angle: -Math.PI / 2,
    maxSpeed: st.speed, accel: st.accel, sig: st.sig, size: st.size,
    hullMax: st.hull, hull: st.hull, armorMax: st.armor, armor: st.armor, dead: false,
    turrets: st.weapons.map((w, i) => ({ w: WEAPONS[w], cd: 0.3 + i * 0.5 })),
    miners: Array.from({ length: st.miners }, (_, i) => ({ cd: 5 * (0.4 + i * 0.2) })),
    repair: st.repair, repairT: REPAIR.cycle, cargoMax: st.cargo,
    target: null, mineTarget: null, armorBroken: false,
  };
}
