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

/** Где сейчас концы стволов и корабли (null — уже нет). Эффекты едут вместе с ними. */
export interface Locate {
  muzzle(ship: string, turret: number): P3 | null;
  ship(id: string): P3 | null;
}

export interface ShotFx {
  shooter: string;
  turret: number;
  target: string;
  /** точки в момент выстрела — если стрелок или цель исчезнут */
  from: P3;
  to: P3;
  /** куда в корпус цели попал снаряд, относительно её центра */
  hit: P3;
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

interface Tracer { shot: ShotFx; t: number; life: number; line: Line2 }
/** Вспышка привязана к стволу (turret), к кораблю со смещением (offset) или к точке (at). */
interface Flash { ship?: string; turret?: number; offset?: P3; at: P3; t: number; life: number; size: number; grow: boolean; sprite: THREE.Sprite }

const add = (a: P3, b: P3): P3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

/**
 * Выстрелы как картинка: вспышка у ствола, трассер летит к цели, вспышка попадания. Урон считает симуляция.
 * Всё привязано к участникам: стрелок летит дальше, и трассер с вспышкой летят вместе с его стволом.
 * Иначе за полсекунды полёта корабль уходит вперёд на сотню метров, а след выстрела остаётся сзади.
 */
export function createShotFx(scene: THREE.Scene) {
  const tracers: Tracer[] = [], flashes: Flash[] = [];
  const tracerMat = new LineMaterial({ linewidth: TRACER_WIDTH, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });

  function flash(f: Omit<Flash, 't' | 'sprite'>) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, sizeAttenuation: false }));
    scene.add(sprite);
    flashes.push({ ...f, t: 0, sprite });
  }

  function spawn(shot: ShotFx) {
    const d = Math.hypot(shot.to.x - shot.from.x, shot.to.z - shot.from.z);
    const geo = new LineGeometry();
    geo.setPositions([0, 0, 0, 0, 0, 0]);
    geo.setColors([...TAIL_COLOR, ...HEAD_COLOR]);
    const line = new Line2(geo, tracerMat);
    line.frustumCulled = false;
    scene.add(line);
    // полёт занимает доли секунды: на 10 км — полсекунды
    tracers.push({ shot, t: 0, life: Math.min(0.7, Math.max(0.2, d / 20000)), line });
    flash({ ship: shot.shooter, turret: shot.turret, at: shot.from, life: 0.15, size: MUZZLE_SIZE, grow: false });
  }

  /** Кадр: концы берутся там, где сейчас стволы и цели, и переводятся в координаты относительно игрока (origin). */
  function update(dt: number, origin: Vec2, locate: Locate) {
    tracerMat.resolution.set(window.innerWidth, window.innerHeight);
    for (let i = tracers.length - 1; i >= 0; i--) {
      const b = tracers[i]!, s = b.shot;
      b.t += dt;
      const k = Math.min(1, b.t / b.life);
      // запоминаем последние известные точки: стрелок или цель могут исчезнуть посреди полёта
      s.from = locate.muzzle(s.shooter, s.turret) ?? s.from;
      const target = locate.ship(s.target);
      if (target) s.to = add(target, s.hit);
      const at = (u: number) => [s.from.x + (s.to.x - s.from.x) * u - origin.x, s.from.y + (s.to.y - s.from.y) * u, s.from.z + (s.to.z - s.from.z) * u - origin.z];
      (b.line.geometry as LineGeometry).setPositions([...at(Math.max(0, k - TRACER_LENGTH)), ...at(k)]);
      if (k >= 1) {
        scene.remove(b.line); b.line.geometry.dispose(); tracers.splice(i, 1);
        flash({ ship: s.target, offset: s.hit, at: s.to, life: 0.35, size: IMPACT_SIZE, grow: true });
      }
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i]!;
      f.t += dt;
      const k = f.t / f.life;
      if (k >= 1) { scene.remove(f.sprite); f.sprite.material.dispose(); flashes.splice(i, 1); continue; }
      if (f.ship !== undefined) {
        const p = f.turret !== undefined ? locate.muzzle(f.ship, f.turret) : locate.ship(f.ship);
        if (p) f.at = f.offset ? add(p, f.offset) : p;
      }
      f.sprite.position.set(f.at.x - origin.x, f.at.y, f.at.z - origin.z);
      f.sprite.scale.setScalar(f.size * (f.grow ? 0.5 + k : 1 - 0.6 * k));
      f.sprite.material.opacity = 1 - k;
    }
  }

  return { spawn, update };
}
