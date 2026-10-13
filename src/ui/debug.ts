import type { SpaceView } from '../render/scene';
import { TIME_SCALES } from '../scenarios/url';
import { DEG } from '../sim/constants';
import { HULLS, angAccel, isHullKey, linAccel } from '../sim/hulls';
import { measureWarp, type WarpMeasure } from '../sim/measure';
import type { HullKey, PlayerWorld } from '../sim/types';
import { teleport } from '../sim/world';
import { $, fmtSec, nf } from './format';

const TELEPORTS: [string, string][] = [['station', 'Станция'], ['belt', 'Пояс III-1'], ['signal', 'Обломки'], ['p3', 'Ксанта III'], ['star', 'Звезда']];

/** Панель отладки: корпус, скорость времени, мгновенный варп, переброска, характеристики корпуса. */
export function createDebug(world: PlayerWorld, view: SpaceView, onTeleport: () => void) {
  const player = world.player;
  const dbg = $('debug');
  const open = (v: boolean) => { dbg.classList.toggle('open', v); if (v) render(); };
  $('gear').addEventListener('click', () => open(!dbg.classList.contains('open')));
  $('debugClose').addEventListener('click', () => open(false));

  const measured: Partial<Record<HullKey, { a90: WarpMeasure; a180: WarpMeasure; w30: WarpMeasure }>> = {};
  function render() {
    $('hullSeg').innerHTML = Object.values(HULLS).map((h) => `<button class="btn${player.hull === h ? ' on' : ''}" data-h="${h.key}">${h.name}</button>`).join('');
    $('timeSeg').innerHTML = TIME_SCALES.map((k) => `<button class="btn${world.timeScale === k ? ' on' : ''}" data-k="${k}">×${k}</button>`).join('');
    $('instantBtn').classList.toggle('on', world.debug.instantWarp);
    $('tpSeg').innerHTML = TELEPORTS.map(([id, n]) => `<button class="btn" data-tp="${id}">${n}</button>`).join('');
    const h = player.hull;
    const m = measured[h.key] ?? (measured[h.key] = { a90: measureWarp(h.key, 10, 90), a180: measureWarp(h.key, 10, 180), w30: measureWarp(h.key, 30, 0) });
    const rows = [
      ['Масса', nf.format(h.mass / 1000) + ' т'],
      ['Длина корпуса', h.size + ' м'],
      ['Момент маневровых', (h.torque / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' МН·м'],
      ['Угловое ускорение', (angAccel(h) / DEG).toFixed(1).replace('.', ',') + ' °/с²'],
      ['Предел поворота', Math.round(h.maxTurn / DEG) + ' °/с'],
      ['Разгон', Math.round(linAccel(h)) + ' м/с²'],
      ['Макс. скорость', h.maxSpeed + ' м/с'],
      ['Скорость варпа', h.warpSpeed + ' а. е./с'],
      ['Выравнивание, поворот 90°', m.a90.align.toFixed(1).replace('.', ',') + ' с'],
      ['Выравнивание, поворот 180°', m.a180.align.toFixed(1).replace('.', ',') + ' с'],
      ['Варп на 10 а. е.', fmtSec(m.a90.warp)],
      ['Варп на 30 а. е.', fmtSec(m.w30.warp)],
    ];
    $('stats').innerHTML = rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
  }

  dbg.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button'); if (!b) return;
    if (isHullKey(b.dataset.h)) {
      player.hull = HULLS[b.dataset.h]; player.speed = Math.min(player.speed, player.hull.maxSpeed);
      view.rebuildShipMesh(player); view.cam.dist = player.hull.size * 7;
    } else if (b.dataset.k) world.timeScale = Number(b.dataset.k);
    else if (b.id === 'instantBtn') world.debug.instantWarp = !world.debug.instantWarp;
    else if (b.dataset.tp) { teleport(world, player, b.dataset.tp); onTeleport(); }
    else return;
    render();
  });

  return { open };
}
