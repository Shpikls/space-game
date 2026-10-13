import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { weaponRange } from '../sim/combat';
import { rng } from '../sim/rng';
import type { Ship, SimEvent, Vec2, World } from '../sim/types';
import { buildObjectMesh, buildShip, type ShipMeshData } from './meshes';
import { createShotFx, type Locate, type P3 } from './shots';
import { glowTexture } from './textures';

// Прототип рисовался на three.js r128. Чтобы картинка не поменялась, возвращаем его правила:
// цвета без перевода из sRGB в линейное пространство и без такого же перевода на выходе.
THREE.ColorManagement.enabled = false;

/** Камера летает вокруг корабля игрока: поворот, наклон, расстояние. */
export interface OrbitCam {
  yaw: number;
  pitch: number;
  dist: number;
}

export interface SpaceView {
  cam: OrbitCam;
  /** допустимое расстояние камеры до корабля, м */
  camLimits(): [number, number];
  /** перестроить меш корабля (после смены корпуса) */
  rebuildShipMesh(s: Ship): void;
  /** точка на экране → курс в плоскости полёта (null — направление не определено) */
  yawAt(clientX: number, clientY: number): number | null;
  /** позиция относительно игрока → точка на экране (null — за камерой) */
  project(rx: number, rz: number): { x: number; y: number } | null;
  /** события симуляции, которые видно в сцене: выстрелы и взрывы */
  handleEvents(events: SimEvent[]): void;
  /** кадр: расставить меши относительно игрока и нарисовать. Возвращает силу эффекта варпа 0…1. */
  render(dt: number): number;
}

export function createSpaceView(canvas: HTMLCanvasElement, world: World, player: Ship): SpaceView {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02040a);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 2e14);
  // В r128 яркость источников умножалась на π внутри шейдера, а свет звезды не ослабевал с расстоянием
  scene.add(new THREE.AmbientLight(0x6b7f99, 0.2 * Math.PI));
  const sunLight = new THREE.PointLight(0xfff0dc, 1.65 * Math.PI, 0, 0);
  scene.add(sunLight);

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize();

  scene.add(buildStars());

  // Меши объектов и кораблей. Мир меняется по ходу игры (корабль уничтожен, появились обломки),
  // поэтому каждый кадр сверяемся с ним: новым — меш, исчезнувшим — убрать
  const meshes = new Map<string, THREE.Object3D | null>();
  const shipMeshes = new Map<string, THREE.Group>();
  const TINT = { player: 0xa9b8c8, pirate: 0xb0584e } as Record<string, number>;
  // как выглядят турели: размер башни, толщина трассера (px), вспышка у ствола
  const TURRET_LOOK: Record<string, { size: number; width: number; muzzle: number }> = {
    light: { size: 1, width: 3, muzzle: 0.07 },
    heavy: { size: 1.7, width: 6, muzzle: 0.12 },
  };
  const lookOf = (key: string | undefined) => TURRET_LOOK[key ?? 'light'] ?? TURRET_LOOK.light!;
  // окружение, которое отражают корпуса кораблей (только они — планеты и станция светятся как раньше)
  const shipEnv = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  function rebuildShipMesh(s: Ship) {
    const old = shipMeshes.get(s.id); if (old) scene.remove(old);
    const m = buildShip(s.hull, TINT[s.faction] ?? 0xc4a27e, s.turrets.map((t) => lookOf(t.def.key).size), shipEnv);
    scene.add(m); shipMeshes.set(s.id, m);
  }
  function syncMeshes() {
    for (const o of world.objects) {
      if (meshes.has(o.id)) continue;
      const m = buildObjectMesh(o); // у поясов и сигналов меша нет — запоминаем null
      if (m) scene.add(m);
      meshes.set(o.id, m);
    }
    for (const [id, m] of meshes) if (!world.byId[id]) { if (m) scene.remove(m); meshes.delete(id); }
    for (const s of world.ships) if (!shipMeshes.has(s.id)) rebuildShipMesh(s);
    for (const [id, m] of shipMeshes) if (world.byId[id]?.type !== 'ship') { scene.remove(m); shipMeshes.delete(id); }
  }
  syncMeshes();

  // Взрывы: вспышка растёт и гаснет на месте уничтоженного корабля
  const boomTex = glowTexture('rgba(255,244,220,1)', 'rgba(255,140,60,.55)');
  const booms: { sprite: THREE.Sprite; pos: Vec2; size: number; t: number }[] = [];
  const BOOM_LIFE = 1.6;
  const shots = createShotFx(scene);
  const tmpMuzzle = new THREE.Vector3();
  // Где сейчас концы стволов и корабли, в мировых метрах. Сцена хранит меши относительно игрока — прибавляем его позицию
  const locate: Locate = {
    muzzle(shipId, turret) {
      const s = world.byId[shipId], m = shipMeshes.get(shipId);
      if (!s || s.type !== 'ship' || !m) return null;
      const muzzle = (m.userData as ShipMeshData).muzzles[turret];
      if (!muzzle) return { x: s.pos.x, y: 0, z: s.pos.z };
      muzzle.getWorldPosition(tmpMuzzle);
      return { x: tmpMuzzle.x + player.pos.x, y: tmpMuzzle.y, z: tmpMuzzle.z + player.pos.z };
    },
    ship(id) {
      const s = world.byId[id];
      return s && s.type === 'ship' ? { x: s.pos.x, y: 0, z: s.pos.z } : null;
    },
  };
  function handleEvents(events: SimEvent[]) {
    for (const e of events) {
      if (e.type === 'shot') {
        // попадание — куда-то в корпус цели, промах — мимо, на 2,5–4 её размера в сторону
        const t = world.byId[e.target], size = t?.type === 'ship' ? t.hull.size : 40;
        const j = () => (Math.random() - 0.5) * size * 0.5;
        const a = Math.random() * Math.PI * 2, miss = size * (2.5 + Math.random() * 1.5);
        const hit: P3 = e.hit ? { x: j(), y: j() * 0.3, z: j() } : { x: Math.cos(a) * miss, y: (Math.random() - 0.5) * size, z: Math.sin(a) * miss };
        const shooter = world.byId[e.ship], look = lookOf(shooter?.type === 'ship' ? shooter.turrets[e.turret]?.def.key : undefined);
        const from: P3 = locate.muzzle(e.ship, e.turret) ?? { x: e.from.x, y: 0, z: e.from.z };
        shots.spawn({ shooter: e.ship, turret: e.turret, target: e.target, from, to: { x: e.to.x, y: 0, z: e.to.z }, hit, miss: !e.hit, width: look.width, muzzle: look.muzzle });
        continue;
      }
      if (e.type !== 'destroyed') continue;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: boomTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      scene.add(sprite);
      booms.push({ sprite, pos: e.pos, size: e.size, t: 0 });
    }
  }

  const tunnel = createTunnel();
  scene.add(tunnel.lines);

  // Кольцо дальности турелей вокруг игрока, пока идёт атака
  const rangeRing = new THREE.LineLoop(circleGeometry(128),
    new THREE.LineBasicMaterial({ color: 0xff7a6b, transparent: true, opacity: 0.35, depthWrite: false }));
  rangeRing.frustumCulled = false;
  scene.add(rangeRing);

  const cam: OrbitCam = { yaw: -2.5, pitch: 0.3, dist: player.hull.size * 7 };
  function placeCamera() {
    const cp = Math.cos(cam.pitch);
    camera.position.set(Math.sin(cam.yaw) * cp * cam.dist, Math.sin(cam.pitch) * cam.dist, Math.cos(cam.yaw) * cp * cam.dist);
    camera.lookAt(0, 0, 0);
  }

  const raycaster = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function yawAt(x: number, y: number): number | null {
    const ndc = new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    let dx: number, dz: number;
    if (raycaster.ray.intersectPlane(plane, hit)) { dx = hit.x; dz = hit.z; }
    else { dx = raycaster.ray.direction.x; dz = raycaster.ray.direction.z; }
    if (Math.hypot(dx, dz) < 1e-6) return null;
    return Math.atan2(dx, dz);
  }

  const tmpV = new THREE.Vector3();
  function project(rx: number, rz: number) {
    tmpV.set(rx, 0, rz).project(camera);
    if (tmpV.z > 1 || tmpV.z < -1) return null;
    return { x: ((tmpV.x + 1) / 2) * window.innerWidth, y: ((1 - tmpV.y) / 2) * window.innerHeight };
  }

  function render(dt: number): number {
    // Всё рисуется относительно корабля игрока (floating origin): так не теряется точность на расстояниях в а. е.
    syncMeshes();
    const p = player.pos;
    for (const o of world.objects) {
      const m = meshes.get(o.id); if (!m) continue;
      const rx = o.pos.x - p.x, rz = o.pos.z - p.z;
      if (o.local && !o.celestial) { m.visible = Math.hypot(rx, rz) < 3e6; if (!m.visible) continue; }
      m.position.set(rx, 0, rz);
      if (m.userData.spin) (m.userData.spin as THREE.Object3D).rotation.y += dt * 0.004;
    }
    const star = world.byId.star!;
    sunLight.position.set(star.pos.x - p.x, 0, star.pos.z - p.z);
    for (let i = booms.length - 1; i >= 0; i--) {
      const b = booms[i]!;
      b.t += dt;
      const k = b.t / BOOM_LIFE;
      if (k >= 1) { scene.remove(b.sprite); b.sprite.material.dispose(); booms.splice(i, 1); continue; }
      b.sprite.position.set(b.pos.x - p.x, 0, b.pos.z - p.z);
      b.sprite.scale.setScalar(b.size * (4 + 20 * k));
      b.sprite.material.opacity = 1 - k;
    }
    for (const s of world.ships) {
      const m = shipMeshes.get(s.id)!;
      const rx = s.pos.x - p.x, rz = s.pos.z - p.z;
      m.visible = Math.hypot(rx, rz) < 3e6; if (!m.visible) continue;
      m.position.set(rx, 0, rz); m.rotation.y = s.yaw;
      const f = s.warp ? 1 : Math.min(1, s.speed / s.hull.maxSpeed);
      const { glow, L, turrets } = m.userData as ShipMeshData;
      glow.scale.setScalar(L * (0.2 + 0.55 * f));
      glow.material.opacity = 0.35 + 0.65 * f;
      turrets.forEach((t, i) => { t.rotation.y = s.turrets[i]?.aim ?? 0; });
      m.updateMatrixWorld(true); // стволы — уже в позиции этого кадра, эффекты выстрелов берут их отсюда
    }
    shots.update(dt, p, locate);
    const range = weaponRange(player);
    rangeRing.visible = !!player.attack && range > 0 && !player.warp;
    rangeRing.scale.setScalar(range);

    // Интенсивность варпа: логарифм отношения скорости к обычной
    let wi = 0;
    if (player.warp) wi = Math.max(0, Math.min(1, Math.log10(Math.max(1, player.warp.v / player.hull.maxSpeed)) / 7));
    tunnel.update(dt, wi, cam.dist, player.yaw);
    const fov = 60 + wi * 14;
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }

    placeCamera();
    renderer.render(scene, camera);
    return wi;
  }

  return {
    cam,
    camLimits: () => [player.hull.size * 1.6, 4e6],
    rebuildShipMesh,
    handleEvents,
    yawAt,
    project,
    render,
  };
}

/** Окружность радиуса 1 в плоскости полёта. */
function circleGeometry(segments: number): THREE.BufferGeometry {
  const pts = new Float32Array(segments * 3);
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.set([Math.sin(a), 0, Math.cos(a)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  return g;
}

/** Звёзды с полосой Млечного пути. */
function buildStars(): THREE.Points {
  const r = rng(99), n = 4200, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), R = 8e13;
  const tilt = 0.5;
  for (let i = 0; i < n; i++) {
    let x: number, y: number, z: number;
    if (i < n * 0.45) {
      const lon = r() * Math.PI * 2, lat = (r() + r() + r() - 1.5) * 0.18;
      x = Math.cos(lat) * Math.cos(lon); y = Math.sin(lat); z = Math.cos(lat) * Math.sin(lon);
      const y2 = y * Math.cos(tilt) - z * Math.sin(tilt), z2 = y * Math.sin(tilt) + z * Math.cos(tilt); y = y2; z = z2;
    } else {
      const u = r() * 2 - 1, t = r() * Math.PI * 2, q = Math.sqrt(1 - u * u);
      x = q * Math.cos(t); y = u; z = q * Math.sin(t);
    }
    pos.set([x * R, y * R, z * R], i * 3);
    const b = 0.45 + r() * 0.55, warm = r();
    col.set([b * (warm > 0.8 ? 1 : 0.85), b * 0.9, b * (warm < 0.3 ? 1 : 0.86)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 1.7, sizeAttenuation: false, vertexColors: true, depthWrite: false }));
}

/** Тоннель варпа: штрихи, летящие навстречу вокруг корабля. */
function createTunnel() {
  const TUN = 520;
  const tunPos = new Float32Array(TUN * 6), tunSeed: [number, number, number, number][] = [];
  const r = rng(3);
  for (let i = 0; i < TUN; i++) {
    const a = r() * Math.PI * 2, rad = 0.5 + r() * 2.4;
    tunSeed.push([Math.cos(a) * rad, Math.sin(a) * rad, r() * 8 - 4, 0.6 + r() * 0.8]);
  }
  const tunGeo = new THREE.BufferGeometry(); tunGeo.setAttribute('position', new THREE.BufferAttribute(tunPos, 3));
  const tunMat = new THREE.LineBasicMaterial({ color: 0xb8c8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const lines = new THREE.LineSegments(tunGeo, tunMat); lines.frustumCulled = false;

  function update(dt: number, wi: number, scale: number, yaw: number) {
    tunMat.opacity = wi * 0.85;
    if (wi <= 0) { lines.visible = false; return; }
    const len = 0.04 + wi * 1.1, adv = dt * (1 + wi * 14);
    for (let i = 0; i < TUN; i++) {
      const t = tunSeed[i]!; t[2] -= adv * t[3]; if (t[2] < -4) t[2] += 8;
      tunPos.set([t[0], t[1], t[2], t[0], t[1], t[2] + len * t[3]], i * 6);
    }
    tunGeo.attributes.position!.needsUpdate = true;
    lines.scale.setScalar(scale); lines.rotation.y = yaw; lines.visible = true;
  }
  return { lines, update };
}
