import type { SpaceView } from '../render/scene';
import { issueOrder } from '../sim/step';
import type { PlayerWorld } from '../sim/types';

/**
 * Управление пальцем и мышью: тянуть — вращать камеру, щипок или колесо — масштаб,
 * двойной тап по пространству — лететь в ту сторону.
 */
export function attachInput(canvas: HTMLCanvasElement, world: PlayerWorld, view: SpaceView, toast: (msg: string) => void, hideHint: () => void) {
  const player = world.player, cam = view.cam;
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch: number | null = null;
  let tapStart: { x: number; y: number; t: number; moved: number } | null = null;
  let lastTap: { x: number; y: number; t: number } | null = null;

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) tapStart = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
    else { tapStart = null; const [a, b] = [...pointers.values()]; pinch = Math.hypot(a!.x - b!.x, a!.y - b!.y); }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 1) {
      cam.yaw -= dx * 0.006; cam.pitch = Math.max(-1.45, Math.min(1.45, cam.pitch + dy * 0.006));
      if (tapStart) tapStart.moved += Math.abs(dx) + Math.abs(dy);
    } else if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()], d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const [lo, hi] = view.camLimits(); cam.dist = Math.max(lo, Math.min(hi, (cam.dist * pinch) / d)); pinch = d;
    }
  });
  function endPointer(e: PointerEvent) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (tapStart && pointers.size === 0 && tapStart.moved < 10 && performance.now() - tapStart.t < 350) {
      const now = performance.now();
      if (lastTap && now - lastTap.t < 380 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40) {
        flyToward(e.clientX, e.clientY); lastTap = null;
      } else lastTap = { x: e.clientX, y: e.clientY, t: now };
    }
    tapStart = null;
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const [lo, hi] = view.camLimits(); cam.dist = Math.max(lo, Math.min(hi, cam.dist * Math.exp(e.deltaY * 0.0012)));
  }, { passive: false });
  canvas.addEventListener('dblclick', (e) => e.preventDefault());

  function flyToward(x: number, y: number) {
    const yaw = view.yawAt(x, y);
    if (yaw === null) return;
    if (!issueOrder(world, player, { type: 'dir', yaw })) { toast('Варп нельзя прервать'); return; }
    const rp = document.createElement('div'); rp.className = 'ripple'; rp.style.left = x + 'px'; rp.style.top = y + 'px';
    document.body.appendChild(rp); setTimeout(() => rp.remove(), 700);
    hideHint();
  }
}
