import { attackStatus, currentHitChance, weaponRange } from '../sim/combat';
import { DEG } from '../sim/constants';
import { isLocked, lockLeft, lockProgress } from '../sim/lock';
import type { PlayerWorld, SimEvent } from '../sim/types';
import { $, fmtDist, fmtSec, fmtSpeed } from './format';
import { updateLayers } from './layers';

export interface Hud {
  /** карточка состояния вверху: корпус, скорость, приказ, выравнивание, варп */
  update(): void;
  toast(msg: string): void;
  /** показать всплывающие сообщения о событиях симуляции */
  handleEvents(events: SimEvent[]): void;
}

export function createHud(world: PlayerWorld, onRespawn: () => void): Hud {
  const player = world.player;
  const statusEl = $('status');

  function stateText(): string {
    const s = player, o = s.order;
    const t = 'target' in o ? world.byId[o.target] : undefined;
    if (s.dead) return 'Корабль уничтожен';
    if (s.warp) {
      const ph = s.warp.phase;
      return ph === 'accel' ? 'Варп: разгон' : ph === 'cruise' ? 'Варп' : 'Варп: торможение';
    }
    switch (o.type) {
      case 'dir': return 'Полёт по курсу';
      case 'approach': return 'Сближение: ' + t?.name;
      case 'orbit': return 'Орбита ' + o.range / 1000 + ' км: ' + t?.name;
      case 'keep': return 'Держу ' + o.range / 1000 + ' км: ' + t?.name;
      case 'warp': return 'Выравнивание на ' + t?.name;
      default: return s.speed > 1 ? 'Торможение' : 'Стоп';
    }
  }

  function update() {
    const s = player;
    $('hullName').textContent = s.hull.name + (world.timeScale !== 1 ? ', время ×' + world.timeScale : '');
    $('speed').textContent = s.warp ? '' : fmtSpeed(s.speed);
    $('state').textContent = stateText();
    statusEl.classList.toggle('aligning', !!s.align && s.order.type === 'warp' && !s.warp);
    statusEl.classList.toggle('warping', !!s.warp);
    updateLayers($('myLayers'), s);
    // кто целится в нас: захват идёт — жёлтое предупреждение с полоской, захватил — «Вас атакует»
    const aimers = world.ships.filter((e) => e.attack === s.id && !e.dead);
    const locking = aimers.filter((e) => !isLocked(e) && lockProgress(e) > 0), locked = aimers.filter(isLocked);
    statusEl.classList.toggle('warned', locking.length > 0);
    if (locking.length) {
      $('warnLine').textContent = '⚠ Вас захватывает: ' + locking.map((e) => e.name).join(', ');
      $('theirLockBar').style.width = (100 * Math.max(...locking.map(lockProgress))).toFixed(1) + '%';
    }
    statusEl.classList.toggle('threatened', locked.length > 0);
    if (locked.length) $('threatLine').textContent = 'Вас атакует: ' + locked.map((e) => e.name).join(', ');
    const target = s.attack ? world.byId[s.attack] : undefined;
    const st = target ? attackStatus(world, s) : 'none';
    statusEl.classList.toggle('attacking', !!target);
    statusEl.classList.toggle('locking', st === 'locking');
    if (target?.type === 'ship') {
      const chance = currentHitChance(world, s);
      // шанс показываем всегда, когда достаём: по нему видно, что мешает попадать
      const odds = chance === null ? '' : ', попадание ' + Math.round(chance * 100) + '%' + (chance < 0.5 ? ' — цель быстро смещается' : '');
      if (st === 'locking') {
        $('attackLine').textContent = 'Захват: ' + target.name + ' — ' + lockLeft(s, target).toFixed(1).replace('.', ',') + ' с';
        $('myLockBar').style.width = (100 * lockProgress(s)).toFixed(1) + '%';
      } else {
        // чтобы стрелять, нужно быть ближе и дальности турели, и дальности захвата
        const need = Math.min(weaponRange(s), s.hull.lockRange);
        $('attackLine').textContent = 'Атака: ' + target.name +
          (st === 'firing' ? ' — огонь' + odds : st === 'aiming' ? ' — наводится' + odds : ' — далеко, нужно ближе ' + fmtDist(need));
      }
    }
    if (s.align && !s.warp) {
      const deg = s.align.angle / DEG;
      $('alignAngle').textContent = deg < 2 ? 'на цели' : Math.round(deg) + '°';
      $('alignAngleBar').style.width = (100 * Math.max(0, 1 - deg / 180)).toFixed(1) + '%';
      const f = Math.min(1, s.align.speedFrac);
      $('alignSpeed').textContent = Math.round(f * 100) + '%';
      $('alignSpeedBar').style.width = (f * 100).toFixed(1) + '%';
    }
    if (s.warp) {
      $('bigSpeed').textContent = fmtSpeed(s.warp.v);
      $('warpTarget').textContent = world.byId[s.warp.target]!.name;
      $('warpLeft').textContent = fmtDist(s.warp.total - s.warp.traveled);
      $('warpBar').style.width = ((100 * s.warp.traveled) / s.warp.total).toFixed(2) + '%';
    }
    document.querySelectorAll<HTMLButtonElement>('[data-stop]').forEach((b) => {
      b.disabled = !!s.warp;
      b.style.opacity = s.warp ? '0.4' : '1';
    });
  }

  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  function toast(msg: string) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }


  const lost = $('lost');
  $('respawnBtn').addEventListener('click', () => { lost.hidden = true; onRespawn(); });

  function handleEvents(events: SimEvent[]) {
    for (const e of events) {
      if (e.type === 'destroyed' && e.by === 'player') toast(e.name + ' уничтожен');
      if (e.type === 'destroyed' && e.ship === 'player') {
        const killer = world.byId[e.by];
        $('lostText').textContent = (killer ? killer.name + ' уничтожил ваш ' : 'Ваш ') + player.hull.name.toLowerCase() + '. Новый корабль ждёт на станции.';
        lost.hidden = false;
        $<HTMLButtonElement>('respawnBtn').focus();
      }
      if (e.ship !== 'player') continue;
      if (e.type === 'warpStart') toast('Варп к «' + world.byId[e.target]!.name + '»');
      if (e.type === 'warpEnd') toast('Прибыли к «' + world.byId[e.target]!.name + '»' + (e.duration ? ' за ' + fmtSec(e.duration) : ''));
    }
  }

  return { update, toast, handleEvents };
}
