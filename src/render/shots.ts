import * as THREE from 'three';
import type { Vec2 } from '../sim/types';
import { glowTexture } from './textures';

/** Точка в мире, м: x, z — плоскость полёта, y — высота. */
export interface P3 {
  x: number;
  y: number;
  z: number;
}

const boltTex = glowTexture('rgba(255,252,235,1)', 'rgba(255,196,96,.7)');
const flashTex = glowTexture('rgba(255,250,230,1)', 'rgba(255,170,80,.5)');

// Снаряды и вспышки рисуются одного размера на экране, на любой дистанции (sizeAttenuation: false),
// иначе выстрел на 15 км был бы невидимой точкой
const BOLT_SIZE = 0.035, MUZZLE_SIZE = 0.07, IMPACT_SIZE = 0.13;

interface Bolt { from: P3; to: P3; t: number; life: number; head: THREE.Sprite; trail: THREE.Line }
interface Flash { at: P3; t: number; life: number; size: number; grow: boolean; sprite: THREE.Sprite }

/** Выстрелы как картинка: вспышка у ствола, снаряд со следом летит к цели, вспышка попадания. Урон считает симуляция. */
export function createShotFx(scene: THREE.Scene) {
  const bolts: Bolt[] = [], flashes: Flash[] = [];
  const headMat = new THREE.SpriteMaterial({ map: boltTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, sizeAttenuation: false });
  const trailMat = new THREE.LineBasicMaterial({ color: 0xffd38a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });

  function flash(at: P3, size: number, life: number, grow: boolean) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, sizeAttenuation: false }));
    scene.add(sprite);
    flashes.push({ at, t: 0, life, size, grow, sprite });
  }

  function spawn(from: P3, to: P3) {
    const d = Math.hypot(to.x - from.x, to.z - from.z);
    const head = new THREE.Sprite(headMat);
    head.scale.setScalar(BOLT_SIZE);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const trail = new THREE.Line(geo, trailMat);
    trail.frustumCulled = false;
    scene.add(head, trail);
    // полёт занимает доли секунды: на 10 км — полсекунды
    bolts.push({ from, to, t: 0, life: Math.min(0.7, Math.max(0.2, d / 20000)), head, trail });
    flash(from, MUZZLE_SIZE, 0.15, false);
  }

  /** Кадр: всё переводится в координаты относительно корабля игрока (origin). */
  function update(dt: number, origin: Vec2) {
    const rel = (a: P3, b: P3, u: number): [number, number, number] =>
      [a.x + (b.x - a.x) * u - origin.x, a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u - origin.z];
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i]!;
      b.t += dt;
      const k = Math.min(1, b.t / b.life);
      const head = rel(b.from, b.to, k), tail = rel(b.from, b.to, Math.max(0, k - 0.35));
      b.head.position.set(...head);
      const pos = b.trail.geometry.attributes.position as THREE.BufferAttribute;
      pos.set([...tail, ...head]); pos.needsUpdate = true;
      if (k >= 1) {
        scene.remove(b.head, b.trail); b.trail.geometry.dispose(); bolts.splice(i, 1);
        flash(b.to, IMPACT_SIZE, 0.35, true);
      }
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i]!;
      f.t += dt;
      const k = f.t / f.life;
      if (k >= 1) { scene.remove(f.sprite); f.sprite.material.dispose(); flashes.splice(i, 1); continue; }
      f.sprite.position.set(f.at.x - origin.x, f.at.y, f.at.z - origin.z);
      f.sprite.scale.setScalar(f.size * (f.grow ? 0.5 + k : 1 - 0.6 * k));
      f.sprite.material.opacity = 1 - k;
    }
  }

  return { spawn, update };
}
