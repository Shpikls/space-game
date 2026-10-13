import { attackStatus, weaponRange } from '../sim/combat';
import { DEG } from '../sim/constants';
import type { PlayerWorld, SimEvent } from '../sim/types';
import { $, fmtDist, fmtSec, fmtSpeed } from './format';

export interface Hud {
  /** карточка состояния вверху: корпус, скорость, приказ, выравнивание, варп */
  update(): void;
  toast(msg: string): void;
  /** убрать подсказку для новичка (после первого действия или через 9 с) */
  hideHint(): void;
  /** показать всплывающие сообщения о событиях симуляции */
  handleEvents(events: SimEvent[]): void;
}

export function createHud(world: PlayerWorld): Hud {
  const player = world.player;
  const statusEl = $('status');

  function stateText(): string {
    const s = player, o = s.order;
    const t = 'target' in o ? world.byId[o.target] : undefined;
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
    const target = s.attack ? world.byId[s.attack] : undefined;
    statusEl.classList.toggle('attacking', !!target);
    if (target) {
      const st = attackStatus(world, s);
      $('attackLine').textContent = 'Атака: ' + target.name +
        (st === 'firing' ? ' — огонь' : st === 'aiming' ? ' — наводится' : ' — далеко, нужно ближе ' + fmtDist(weaponRange(s)));
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
    const stopBtn = $<HTMLButtonElement>('stopBtn');
    stopBtn.disabled = !!s.warp;
    stopBtn.style.opacity = s.warp ? '0.4' : '1';
  }

  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  function toast(msg: string) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  let hintHidden = false;
  function hideHint() {
    if (hintHidden) return;
    hintHidden = true; $('hint').style.opacity = '0'; setTimeout(() => $('hint').remove(), 700);
  }
  setTimeout(hideHint, 9000);

  function handleEvents(events: SimEvent[]) {
    for (const e of events) {
      if (e.type === 'destroyed' && e.by === 'player') toast(e.name + ' уничтожен');
      if (e.ship !== 'player') continue;
      if (e.type === 'warpStart') toast('Варп к «' + world.byId[e.target]!.name + '»');
      if (e.type === 'warpEnd') toast('Прибыли к «' + world.byId[e.target]!.name + '»' + (e.duration ? ' за ' + fmtSec(e.duration) : ''));
    }
  }

  return { update, toast, hideHint, handleEvents };
}
