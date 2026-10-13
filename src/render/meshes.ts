import * as THREE from 'three';
import { rng } from '../sim/rng';
import type { Hull, SpaceObject } from '../sim/types';
import { glowTexture, planetTexture, ringTexture } from './textures';

const engineTex = glowTexture('rgba(220,235,255,1)', 'rgba(110,160,255,.45)');

export function rockGeometry(seed: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 2), r = rng(seed), p = geo.attributes.position!;
  const bumps: [number, number, number, number][] = [];
  for (let i = 0; i < 6; i++) bumps.push([r() * 2 - 1, r() * 2 - 1, r() * 2 - 1, 0.15 + r() * 0.3]);
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i).normalize();
    let k = 0.85 + r() * 0.12;
    for (const b of bumps) k += b[3] * Math.max(0, v.x * b[0] + v.y * b[1] + v.z * b[2]) * 0.35;
    v.multiplyScalar(k); v.y *= 0.75; p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildStation(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8b97a6, metalness: 0.6, roughness: 0.45 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3c4552, metalness: 0.5, roughness: 0.6 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1300, 110, 12, 72), mat); ring.rotation.x = Math.PI / 2; g.add(ring);
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(240, 320, 2000, 24), dark));
  const top = new THREE.Mesh(new THREE.CylinderGeometry(420, 240, 260, 24), mat); top.position.y = 1100; g.add(top);
  for (let i = 0; i < 4; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(2600, 70, 90), dark); sp.rotation.y = (i * Math.PI) / 4; g.add(sp);
  }
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffc27a });
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const l = new THREE.Mesh(new THREE.SphereGeometry(28, 8, 6), lampMat);
    l.position.set(Math.cos(a) * 1300, 120, Math.sin(a) * 1300); g.add(l);
  }
  return g;
}

export function buildWreck(seed: number): THREE.Group {
  const g = new THREE.Group(), r = rng(seed);
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a4f57, metalness: 0.4, roughness: 0.75 });
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.3 + r() * 0.9, 0.15 + r() * 0.35, 0.2 + r() * 0.6), mat);
    m.position.set(r() - 0.5, (r() - 0.5) * 0.4, r() - 0.5); m.rotation.set(r() * 3, r() * 3, r() * 3); g.add(m);
  }
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff8a3c }));
  ember.position.set(0.1, 0.1, 0); g.add(ember);
  return g;
}

export interface ShipMeshData {
  glow: THREE.Sprite;
  L: number;
  /** башни турелей: поворачиваются вокруг вертикали */
  turrets: THREE.Object3D[];
  /** точки на концах стволов — откуда вылетает снаряд */
  muzzles: THREE.Object3D[];
}

/** Башня турели: основание и ствол вдоль +Z. */
function buildTurret(L: number, mat: THREE.Material): { turret: THREE.Group; muzzle: THREE.Object3D } {
  const turret = new THREE.Group();
  turret.add(new THREE.Mesh(new THREE.CylinderGeometry(L * 0.045, L * 0.05, L * 0.03, 12), mat));
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(L * 0.016, L * 0.016, L * 0.15), mat);
  barrel.position.set(0, L * 0.012, L * 0.075); turret.add(barrel);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, L * 0.012, L * 0.15); turret.add(muzzle);
  return { turret, muzzle };
}

// Корпус металлический: металл почти не рассеивает свет, а отражает окружение. В пустом космосе отражать нечего,
// и сторона без солнца выходила чёрной. Мягкое отражение «студии» (envMap) делает её читаемой
const SHIP_ENV_INTENSITY = 0.4;

/** Корабль длиной L = h.size вдоль оси Z, с факелом двигателя и башнями турелей сверху. */
export function buildShip(h: Hull, tint: number, turretCount = 0, env: THREE.Texture | null = null): THREE.Group {
  const g = new THREE.Group(), L = h.size;
  const lit = { envMap: env, envMapIntensity: SHIP_ENV_INTENSITY };
  const mat = new THREE.MeshStandardMaterial({ color: tint, metalness: 0.55, roughness: 0.38, ...lit });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b323c, metalness: 0.5, roughness: 0.6, ...lit });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(L * 0.07, L * 0.13, L * 0.72, 10), mat);
  body.rotation.x = Math.PI / 2; g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(L * 0.07, L * 0.26, 10), mat);
  nose.rotation.x = Math.PI / 2; nose.position.z = L * 0.49; g.add(nose);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(L * 0.64, L * 0.025, L * 0.22), dark);
  wing.position.z = -L * 0.16; g.add(wing);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(L * 0.02, L * 0.17, L * 0.22), dark);
  fin.position.set(0, L * 0.09, -L * 0.24); g.add(fin);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: engineTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.position.z = -L * 0.4; glow.scale.setScalar(L * 0.45); g.add(glow);
  const turrets: THREE.Object3D[] = [], muzzles: THREE.Object3D[] = [];
  const turretMat = new THREE.MeshStandardMaterial({ color: 0x5b6573, metalness: 0.6, roughness: 0.4, ...lit });
  for (let i = 0; i < turretCount; i++) {
    const { turret, muzzle } = buildTurret(L, turretMat);
    turret.position.set(0, L * 0.095, L * 0.1 - i * L * 0.16);
    g.add(turret); turrets.push(turret); muzzles.push(muzzle);
  }
  const data: ShipMeshData = { glow, L, turrets, muzzles };
  g.userData = data;
  return g;
}

/** Меш объекта мира; у поясов и сигналов своего меша нет. */
export function buildObjectMesh(o: SpaceObject): THREE.Object3D | null {
  if (o.type === 'star') {
    const m = new THREE.Group();
    m.add(new THREE.Mesh(new THREE.SphereGeometry(o.radius, 48, 24), new THREE.MeshBasicMaterial({ color: 0xffe6bd })));
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,236,200,1)', 'rgba(255,180,90,.35)'),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    gl.scale.setScalar(o.radius * 16); m.add(gl);
    return m;
  }
  if (o.type === 'planet') {
    const m = new THREE.Group();
    const sph = new THREE.Mesh(new THREE.SphereGeometry(o.radius, 64, 32),
      new THREE.MeshStandardMaterial({ map: planetTexture(o.look!, o.id.charCodeAt(1)), roughness: 1, metalness: 0 }));
    sph.rotation.z = 0.25; m.add(sph); m.userData.spin = sph;
    if (o.look === 'gas') {
      const ring = new THREE.Mesh(new THREE.RingGeometry(o.radius * 1.35, o.radius * 2.2, 160),
        new THREE.MeshStandardMaterial({ map: ringTexture(), transparent: true, side: THREE.DoubleSide, roughness: 1, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2 + 0.38; m.add(ring);
    }
    return m;
  }
  if (o.type === 'station') return buildStation();
  if (o.type === 'asteroid') {
    const seed = o.seed!;
    const m = new THREE.Mesh(rockGeometry(seed), new THREE.MeshStandardMaterial({ color: 0x7d7468, roughness: 0.95, flatShading: true }));
    m.scale.setScalar(o.radius); m.rotation.set(seed, seed * 2, 0);
    return m;
  }
  if (o.type === 'wreck') {
    const m = buildWreck(o.seed!); m.scale.setScalar(o.radius * 2);
    return m;
  }
  return null;
}
