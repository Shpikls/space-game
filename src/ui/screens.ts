import type { SpaceView } from '../render/scene';
import { FIGHTS, isFightKey, type FightKey } from '../scenarios/fights';
import { DEG } from '../sim/constants';
import { ENEMIES, type EnemyKey } from '../sim/enemies';
import { endFight, startFight, updateFight, type Fight, type FightResult } from '../sim/fight';
import { HULLS, isHullKey } from '../sim/hulls';
import { TURRETS, isTurretKey, type TurretKey } from '../sim/turrets';
import type { HullKey, PlayerWorld, SimEvent } from '../sim/types';
import { $, fmtClock, nf } from './format';

export interface Screens {
  /** стартовый экран; бой, если идёт, заканчивается — снова свободный полёт */
  menu(): void;
  /** подготовка к бою: корпус, турель, кто ждёт */
  prep(key: FightKey): void;
  /** вылет на бой с выбранным фитом */
  launch(key: FightKey, hull: HullKey, gun: TurretKey): void;
  /** идёт бой-задача (экран гибели свободного полёта не нужен — будет итог) */
  fightActive(): boolean;
  /** события шага: считает итог боя и показывает его, когда бой окончен */
  handleEvents(events: SimEvent[]): void;
}

// Пауза перед итогом: успеть увидеть взрыв
const RESULT_DELAY = 1800;

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * Экраны поверх игры: стартовый, список боёв, подготовка, итог. Пока экран открыт, мир живёт за ним —
 * свободный полёт у станции или только что закончившийся бой.
 */
export function createScreens(world: PlayerWorld, view: SpaceView, onReset: () => void): Screens {
  const player = world.player;
  const el = $('screen');
  let fight: Fight | null = null, prepKey: FightKey = 'duel';
  const fit = { hull: player.hull.key, gun: (isTurretKey(player.turrets[0]?.def.key) ? player.turrets[0]!.def.key : 'light') as TurretKey };

  function show(html: string) {
    el.innerHTML = `<div class="card">${html}</div>`;
    el.hidden = false;
    $('debug').classList.remove('open');
    el.querySelector<HTMLElement>('.primary')?.focus();
  }
  const hide = () => { el.hidden = true; };

  /** Корабль игрока сменился (корпус, турель, место) — перестроить меш, камеру и панели. */
  function refresh() {
    view.rebuildShipMesh(player);
    view.cam.dist = player.hull.size * 7;
    onReset();
  }

  function menu() {
    if (fight) { fight = null; endFight(world); refresh(); }
    show(`<h2>Ксанта</h2>
      <p class="sub">Полёт по приказам, варп и бой турелями — как в EVE.</p>
      <div class="stack">
        <button class="btn primary big" data-act="fights">Бои</button>
        <button class="btn big" data-act="fly">Свободный полёт</button>
      </div>`);
  }

  function fightsList() {
    show(`<h2>Бои</h2>
      <p class="sub">Цель — уничтожить всех. Подбери корабль и турель под врага.</p>
      <div class="stack">${Object.values(FIGHTS).map((f) =>
        `<button class="pick" data-act="prep" data-fight="${f.key}"><b>${f.name}</b><span>${f.brief}</span></button>`).join('')}</div>
      <div class="stack"><button class="btn" data-act="menu">Назад</button></div>`);
  }

  function prep(key: FightKey) {
    prepKey = key;
    const def = FIGHTS[key];
    // враги одного типа — одной строкой: «3 × Брулер «Оса»»
    const counts = new Map<EnemyKey, number>();
    for (const e of def.enemies) counts.set(e.key, (counts.get(e.key) ?? 0) + 1);
    const who = [...counts].map(([k, n]) => {
      const e = ENEMIES[k];
      return `<li>${n > 1 ? n + ' × ' : ''}<b>${e.name}</b> — ${lower(HULLS[e.hull].name)}, ${lower(TURRETS[e.gun].name)}. ${e.role.charAt(0).toUpperCase() + e.role.slice(1)}.</li>`;
    }).join('');
    const h = HULLS[fit.hull], g = TURRETS[fit.gun];
    show(`<h2>${def.name}</h2>
      <p class="sub">${def.brief}</p>
      <h3>Кто ждёт</h3>
      <ul class="who">${who}</ul>
      <h3>Корабль</h3>
      <div class="seg">${Object.values(HULLS).map((x) => `<button class="btn${x.key === fit.hull ? ' on' : ''}" data-act="hull" data-v="${x.key}">${x.name}</button>`).join('')}</div>
      <p class="note">прочность ${nf.format(h.shield + h.armor + h.structure)} · скорость ${h.maxSpeed} м/с · сигнатура ${h.signature} м</p>
      <h3>Турель</h3>
      <div class="seg">${Object.values(TURRETS).map((x) => `<button class="btn${x.key === fit.gun ? ' on' : ''}" data-act="gun" data-v="${x.key}">${x.name}</button>`).join('')}</div>
      <p class="note">${g.damage} урона раз в ${g.cycle} с · дальность ${g.range / 1000} км · наведение ${Math.round(g.tracking / DEG)}°/с</p>
      <div class="stack">
        <button class="btn primary big" data-act="go">Вылет</button>
        <button class="btn" data-act="fights">Назад</button>
      </div>`);
  }

  function launch(key: FightKey, hull: HullKey, gun: TurretKey) {
    fit.hull = hull; fit.gun = gun;
    fight = startFight(world, FIGHTS[key], hull, gun);
    refresh();
    hide();
  }

  function result(f: Fight, r: FightResult) {
    const pct = r.shots ? ` (${Math.round((100 * r.hits) / r.shots)}%)` : '';
    show(`<h2 class="${r.win ? 'win' : 'loss'}">${r.win ? 'Победа' : 'Корабль уничтожен'}</h2>
      <p class="sub">${f.def.name} · ${lower(HULLS[f.hull].name)}, ${lower(TURRETS[f.gun].name)}</p>
      <table class="res">
        <tr><td>Время боя</td><td>${fmtClock(r.time)}</td></tr>
        <tr><td>Уничтожено</td><td>${r.killed} из ${r.total}${r.fled ? `, ушли в варп: ${r.fled}` : ''}</td></tr>
        <tr><td>Попадания</td><td>${r.hits} из ${r.shots}${pct}</td></tr>
        <tr><td>Нанесено урона</td><td>${nf.format(r.dealt)}</td></tr>
        <tr><td>Получено урона</td><td>${nf.format(r.taken)}</td></tr>
        <tr><td>Осталось прочности</td><td>${Math.round(r.hpLeft * 100)}%</td></tr>
      </table>
      <div class="stack">
        <button class="btn primary big" data-act="again">Ещё раз</button>
        <button class="btn" data-act="refit">Другой фит</button>
        <button class="btn" data-act="menu">В меню</button>
      </div>`);
  }

  el.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]'); if (!b) return;
    const v = b.dataset.v;
    switch (b.dataset.act) {
      case 'menu': menu(); break;
      case 'fights': fightsList(); break;
      case 'fly': hide(); break;
      case 'prep': if (isFightKey(b.dataset.fight)) prep(b.dataset.fight); break;
      case 'hull': if (isHullKey(v)) { fit.hull = v; prep(prepKey); } break;
      case 'gun': if (isTurretKey(v)) { fit.gun = v; prep(prepKey); } break;
      case 'go': launch(prepKey, fit.hull, fit.gun); break;
      case 'again': if (fight) launch(fight.def.key as FightKey, fight.hull, fight.gun); break;
      case 'refit': prep((fight?.def.key ?? prepKey) as FightKey); break;
    }
  });
  // из отладки: начать бой заново или выйти в меню
  $('fightAgainBtn').addEventListener('click', () => { if (fight) launch(fight.def.key as FightKey, fight.hull, fight.gun); });
  $('menuBtn').addEventListener('click', menu);

  return {
    menu, prep, launch,
    fightActive: () => !!fight,
    handleEvents(events) {
      const f = fight;
      if (!f || f.result) return;
      const r = updateFight(world, f, events);
      // бой могли начать заново, пока шла пауза, — тогда этот итог уже не нужен
      if (r) setTimeout(() => { if (fight === f) result(f, r); }, RESULT_DELAY);
    },
  };
}
