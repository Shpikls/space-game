import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { Vec2 } from '../sim/types';
import { glowTexture } from './textures';

/** Точка в мире, м: x, z — плоскость полёта, y — высота. */
export interface P3 {
  x: number;
  y: number;
  z: number;
}

const flashTex = glowTexture('rgba(255,250,230,1)', 'rgba(255,170,80,.5)');

// Вспышки одного размера на экране на любой дистанции (sizeAttenuation: false),
// иначе выстрел на 15 км был бы невидимой точкой
const MUZZLE_SIZE = 0.07, IMPACT_SIZE = 0.13;

// Снаряд — сплошной трассер, а не яркая точка: за кадр он пролетает десятки пикселей,
// и точка на соседних кадрах виделась бы цепочкой, как очередь из пулемёта.
// Трассер длиннее шага за кадр, поэтому глаз видит один летящий росчерк
const TRACER_WIDTH = 3; // пикселей
const TRACER_LENGTH = 0.35; // доля пути до цели
// Хвост тёмный — при сложении цветов почти невидим, голова яркая
const TAIL_COLOR = [0.1, 0.06, 0.02], HEAD_COLOR = [1, 0.9, 0.62];

interface Tracer { from: P3; to: P3; t: number; life: number; line: Line2 }
interface Flash { at: P3; t: number; life: number; size: number; grow: boolean; sprite: THREE.Sprite }

/** Выстрелы как картинка: вспышка у ствола, трассер летит к цели, вспышка попадания. Урон считает симуляция. */
export function createShotFx(scene: THREE.Scene) {
  const tracers: Tracer[] = [], flashes: Flash[] = [];
  const tracerMat = new LineMaterial({ linewidth: TRACER_WIDTH, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });

  function flash(at: P3, size: number, life: number, grow: boolean) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, sizeAttenuation: false }));
    scene.add(sprite);
    flashes.push({ at, t: 0, life, size, grow, sprite });
  }

  function spawn(from: P3, to: P3) {
    const d = Math.hypot(to.x - from.x, to.z - from.z);
    const geo = new LineGeometry();
    geo.setPositions([0, 0, 0, 0, 0, 0]);
    geo.setColors([...TAIL_COLOR, ...HEAD_COLOR]);
    const line = new Line2(geo, tracerMat);
    line.frustumCulled = false;
    scene.add(line);
    // полёт занимает доли секунды: на 10 км — полсекунды
    tracers.push({ from, to, t: 0, life: Math.min(0.7, Math.max(0.2, d / 20000)), line });
    flash(from, MUZZLE_SIZE, 0.15, false);
  }

  /** Кадр: всё переводится в координаты относительно корабля игрока (origin). */
  function update(dt: number, origin: Vec2) {
    tracerMat.resolution.set(window.innerWidth, window.innerHeight);
    const rel = (a: P3, b: P3, u: number): [number, number, number] =>
      [a.x + (b.x - a.x) * u - origin.x, a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u - origin.z];
    for (let i = tracers.length - 1; i >= 0; i--) {
      const b = tracers[i]!;
      b.t += dt;
      const k = Math.min(1, b.t / b.life);
      (b.line.geometry as LineGeometry).setPositions([...rel(b.from, b.to, Math.max(0, k - TRACER_LENGTH)), ...rel(b.from, b.to, k)]);
      if (k >= 1) {
        scene.remove(b.line); b.line.geometry.dispose(); tracers.splice(i, 1);
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
