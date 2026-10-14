import { setAttack } from './combat';
import { maxHp, totalHp } from './damage';
import { issueOrder } from './orders';
import type { Order, Ship, World } from './types';
import { surfaceDistance } from './world';

/** Ближе этого заметивший враг не отпускает игрока (или полторы дальности обнаружения, если она больше), м. */
export const LEASH = 60e3;
const leash = (s: Ship) => Math.max(s.ai!.def.aggro * 1.5, LEASH);

/** Группа поднимается целиком: один заметил игрока — остальные из его группы тоже, каждый со своим временем реакции. */
function alertGroup(world: World, s: Ship) {
  const g = s.ai!.group;
  if (!g) return;
  for (const o of world.ships) {
    if (o === s || o.dead || o.ai?.group !== g || o.ai.state !== 'idle') continue;
    o.ai.state = 'alert'; o.ai.timer = o.ai.def.reaction;
  }
}

/** Приказ движения по типу врага: стоять, держать дистанцию или кружить вокруг цели. */
function engageOrder(s: Ship, targetId: string): Order {
  const d = s.ai!.def;
  if (d.behavior === 'keep') return { type: 'keep', target: targetId, range: d.range };
  if (d.behavior === 'orbit') return { type: 'orbit', target: targetId, range: d.range };
  return { type: 'stop' };
}

/** Куда уйти в варп: случайное небесное тело (через RNG мира — прогоны повторяются). */
function fleeOrder(world: World, s: Ship): Order | null {
  const options = world.objects.filter((o) => o.celestial && surfaceDistance(s, o) > 1e9);
  if (options.length === 0) return null;
  const o = options[Math.floor(world.rng() * options.length)]!;
  return { type: 'warp', target: o.id, dist: 0 };
}

function disengage(world: World, s: Ship) {
  setAttack(world, s, null);
  issueOrder(world, s, { type: 'stop' });
  s.ai!.state = 'idle';
}

/**
 * ИИ врага — конечный автомат, который отдаёт те же приказы, что и игрок:
 * покой → заметил (ждёт время реакции) → бой (приказ движения по типу + атака) → бегство в варп.
 * Замечает игрока ближе дальности обнаружения или когда в него выстрелили; заметил — поднимается вся его группа.
 * Игрок погиб, ушёл в варп или улетел дальше поводка — враг возвращается в покой.
 */
export function stepAI(world: World, s: Ship, dt: number): void {
  const ai = s.ai;
  if (!ai || s.dead) return;
  const p = world.player;
  const visible = !!p && !p.dead && !p.warp;
  const d = visible ? surfaceDistance(s, p) : Infinity;
  switch (ai.state) {
    case 'idle':
      if (visible && (d <= ai.def.aggro || ai.provoked)) { ai.state = 'alert'; ai.timer = ai.def.reaction; alertGroup(world, s); }
      ai.provoked = false;
      break;
    case 'alert':
      // заметившего не по дальности (выстрел, тревога группы) держит поводок, а не дальность обнаружения
      if (d > leash(s)) { ai.state = 'idle'; break; }
      ai.timer -= dt;
      if (ai.timer > 0) break;
      ai.state = 'engage';
      issueOrder(world, s, engageOrder(s, p!.id));
      setAttack(world, s, p!.id);
      break;
    case 'engage': {
      // улетел далеко, погиб или ушёл в варп — бой окончен
      if (d > leash(s)) { disengage(world, s); break; }
      if (ai.def.fleeBelow !== null && totalHp(s) < maxHp(s) * ai.def.fleeBelow) {
        const order = fleeOrder(world, s);
        if (order && issueOrder(world, s, order)) { setAttack(world, s, null); ai.state = 'flee'; break; }
      }
      // приказ мог смениться (цель исчезла и т. п.) — восстанавливаем
      if (!s.attack) setAttack(world, s, p!.id);
      if (s.order.type === 'stop' && ai.def.behavior !== 'hold') issueOrder(world, s, engageOrder(s, p!.id));
      break;
    }
    case 'flee':
      // вышел из варпа где-то далеко — больше не вмешивается
      if (!s.warp && s.order.type !== 'warp') ai.state = 'gone';
      break;
    case 'gone':
      break;
  }
}
