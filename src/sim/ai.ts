import { setAttack } from './combat';
import { maxHp, totalHp } from './damage';
import { issueOrder } from './orders';
import type { Order, Ship, World } from './types';
import { surfaceDistance } from './world';

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
 * Игрок погиб, ушёл в варп или улетел далеко — враг возвращается в покой.
 */
export function stepAI(world: World, s: Ship, dt: number): void {
  const ai = s.ai;
  if (!ai || s.dead) return;
  const p = world.player;
  const visible = !!p && !p.dead && !p.warp;
  const d = visible ? surfaceDistance(s, p) : Infinity;
  switch (ai.state) {
    case 'idle':
      if (d <= ai.def.aggro) { ai.state = 'alert'; ai.timer = ai.def.reaction; }
      break;
    case 'alert':
      if (d > ai.def.aggro) { ai.state = 'idle'; break; }
      ai.timer -= dt;
      if (ai.timer > 0) break;
      ai.state = 'engage';
      issueOrder(world, s, engageOrder(s, p!.id));
      setAttack(world, s, p!.id);
      break;
    case 'engage': {
      // улетел далеко, погиб или ушёл в варп — бой окончен
      if (d > ai.def.aggro * 1.5) { disengage(world, s); break; }
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
