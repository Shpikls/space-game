import './styles.css';
import { createSpaceView } from './render/scene';
import { scenarioFromUrl } from './scenarios/url';
import { createWorld } from './sim/world';
import { step } from './sim/step';
import { createDebug } from './ui/debug';
import { $ } from './ui/format';
import { createHud } from './ui/hud';
import { attachInput } from './ui/input';
import { createLabels } from './ui/labels';
import { createOverview } from './ui/overview';

const scenario = scenarioFromUrl(location.search);
const world = createWorld({ hull: scenario.hull, gun: scenario.gun, at: scenario.at });
world.timeScale = scenario.timeScale;

const canvas = $<HTMLCanvasElement>('scene');
const view = createSpaceView(canvas, world, world.player);
const hud = createHud(world);
const overview = createOverview(world, hud.toast);
const updateLabels = createLabels(world, view.project, overview.selected, overview.select);
const debug = createDebug(world, view, overview.invalidate);
attachInput(canvas, world, view, hud.toast);
if (scenario.debug) debug.open(true);

let last = performance.now(), slow = 0;
function frame(now: number) {
  // Отметка первого кадра бывает на секунды раньше запуска скрипта (долгая загрузка) — назад время не идёт,
  // иначе панели не обновляются, пока счётчик не «отработает» минус
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now;
  step(world, dt * world.timeScale);
  const events = world.events.splice(0);
  hud.handleEvents(events);
  view.handleEvents(events);
  const wi = view.render(dt);
  $('veil').style.opacity = (wi * 0.9).toFixed(3);
  updateLabels();
  hud.update();
  slow += dt;
  if (slow > 0.25) { slow = 0; overview.refresh(); }
  requestAnimationFrame(frame);
}
overview.refresh();
requestAnimationFrame(frame);
