import { setAttack } from '../sim/combat';
import { GRID_RANGE } from '../sim/constants';
import { issueOrder } from '../sim/step';
import type { Entity, Order, PlayerWorld } from '../sim/types';
import { canWarpTo, surfaceDistance } from '../sim/world';
import { $, fmtDist } from './format';
import { TYPE_NAME, glyph, isHostile } from './glyphs';
import { updateLayers } from './layers';

export interface Overview {
  selected(): string | null;
  select(id: string): void;
  /** перерисовать список и действия, даже если ничего не поменялось (после телепорта) */
  invalidate(): void;
  /** обновить список и действия; вызывается 4 раза в секунду */
  refresh(): void;
}

/** Обзор внизу: вкладки «Система» и «Рядом», выбранный объект и приказы для него. */
export function createOverview(world: PlayerWorld, toast: (msg: string) => void): Overview {
  const player = world.player;
  let selected: string | null = null, tab = 'system';
  let listKey = '', actionsKey = '';

  const entities = (): Entity[] => [...world.objects, ...world.ships.filter((s) => s !== player)];
  const dist = (e: Entity) => surfaceDistance(player, e);
  function listFor(t: string) {
    const all = entities().map((e) => ({ e, d: dist(e) }));
    const out = t === 'system' ? all.filter((x) => x.e.type !== 'ship' && x.e.celestial) : all.filter((x) => x.d <= GRID_RANGE);
    return out.sort((a, b) => a.d - b.d);
  }

  const listEl = $('list');
  function renderList() {
    const items = listFor(tab);
    const key = tab + '|' + items.map((x) => x.e.id).join(',') + '|' + (selected || '');
    if (key !== listKey) {
      listKey = key;
      listEl.innerHTML = items.length
        ? items.map((x) =>
          `<button class="row-item${x.e.id === selected ? ' sel' : ''}" data-id="${x.e.id}">${glyph(x.e)}<span class="n">${x.e.name}</span><span class="dist"></span></button>`,
        ).join('')
        : `<div class="empty">Рядом ничего нет. Откройте «Система» и выберите, куда варпнуть.</div>`;
    }
    listEl.querySelectorAll('.row-item').forEach((row, i) => { row.lastChild!.textContent = fmtDist(items[i]!.d); });
  }

  function renderActions() {
    const e = selected ? world.byId[selected] : undefined;
    $('sheet').classList.toggle('has-sel', !!e);
    if (!e) {
      $('selName').innerHTML = 'Ничего не выбрано'; $('selHint').textContent = 'Выберите объект в обзоре или на экране.';
      $('chips').innerHTML = ''; $('selHp').hidden = true; actionsKey = ''; return;
    }
    const d = dist(e);
    const warpable = canWarpTo(world, player, e);
    const near = d <= GRID_RANGE;
    $('selName').innerHTML = `<span>${e.name}</span><small>${fmtDist(d)}</small>`;
    const hp = $('selHp');
    hp.hidden = e.type !== 'ship';
    if (e.type === 'ship') updateLayers(hp, e);
    const hostile = isHostile(e), attacking = player.attack === e.id;
    const key = e.id + '|' + warpable + '|' + near + '|' + !!player.warp + '|' + attacking;
    if (key === actionsKey) return;
    actionsKey = key;
    // [приказ, значение, подпись, класс кнопки]
    const chips: [Order['type'] | 'attack' | 'ceasefire', number, string, string?][] = [];
    if (player.warp) {
      $('selHint').textContent = TYPE_NAME[e.type] + '. В варпе приказы недоступны.';
    } else {
      $('selHint').textContent = (hostile ? 'Враг' : TYPE_NAME[e.type]) + (warpable ? '. Можно варпнуть.' : near ? '. В пределах манёвра.' : '. Слишком далеко для манёвра.');
      if (hostile) chips.push(attacking ? ['ceasefire', 0, 'Прекратить огонь', 'attack'] : ['attack', 0, 'Атаковать', 'attack']);
      if (warpable) chips.push(['warp', 0, 'Варп на 0 км', 'primary'], ['warp', 10e3, 'на 10 км', 'primary'], ['warp', 50e3, 'на 50 км', 'primary']);
      if (near) {
        chips.push(['approach', 0, 'Сблизиться'], ['orbit', 5e3, 'Орбита 5 км'], ['orbit', 15e3, 'Орбита 15 км'],
          ['keep', 10e3, 'Держать 10 км'], ['keep', 30e3, 'Держать 30 км']);
      }
    }
    $('chips').innerHTML = chips.map((c) => `<button class="btn${c[3] ? ' ' + c[3] : ''}" data-o="${c[0]}" data-v="${c[1]}">${c[2]}</button>`).join('');
  }

  function select(id: string) {
    selected = id; actionsKey = ''; listKey = '';
    setListOpen(false); // на телефоне список закрывается сам — остаётся компактная карточка
    renderActions(); renderList();
  }

  /** Список объектов на телефоне открывается кнопкой «Обзор» (на широком экране он виден всегда). */
  function setListOpen(open: boolean) {
    $('sheet').classList.toggle('list-open', open);
    const b = $('overviewBtn');
    b.classList.toggle('on', open);
    b.setAttribute('aria-expanded', String(open));
    if (open) { listKey = ''; renderList(); }
  }
  $('overviewBtn').addEventListener('click', () => setListOpen(!$('sheet').classList.contains('list-open')));

  listEl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.row-item'); if (b) select(b.dataset.id!);
  });
  document.querySelectorAll<HTMLElement>('.tab').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab!; document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === b)); listKey = ''; renderList();
  }));
  $('handle').addEventListener('click', () => $('sheet').classList.toggle('collapsed'));

  $('chips').addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('button'); if (!b || !selected) return;
    if (b.dataset.o === 'attack' || b.dataset.o === 'ceasefire') {
      if (!setAttack(world, player, b.dataset.o === 'attack' ? selected : null)) toast(player.warp ? 'В варпе турели не стреляют' : 'Цель недоступна');
      renderActions();
      return;
    }
    const type = b.dataset.o as Order['type'], v = Number(b.dataset.v);
    const order: Order = type === 'warp' ? { type, target: selected, dist: v }
      : type === 'approach' ? { type, target: selected }
      : type === 'orbit' || type === 'keep' ? { type, target: selected, range: v } : { type: 'stop' };
    if (!issueOrder(world, player, order)) toast(player.warp ? 'Варп нельзя прервать' : 'Приказ недоступен');
  });
  document.querySelectorAll('[data-stop]').forEach((b) => b.addEventListener('click', () => {
    if (!issueOrder(world, player, { type: 'stop' })) toast('Варп нельзя прервать');
  }));

  return {
    selected: () => selected,
    select,
    invalidate() { actionsKey = ''; listKey = ''; },
    refresh() { renderList(); renderActions(); },
  };
}
