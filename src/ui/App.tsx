import { BalanceLab } from './BalanceLab';

/**
 * Временная стартовая страница. Игра пока живёт в прототипах (public/prototype),
 * её интерфейс переносится сюда по шагам из docs/roadmap.md.
 */
export function App() {
  return (
    <main className="page">
      <h1>Космическая игра</h1>
      <p className="muted">Проект в переносе из прототипов. Ядро симуляции уже здесь: src/sim.</p>
      <h2>Прототипы</h2>
      <ul className="links">
        <li><a href="/prototype/flight.html">Прототип полёта</a>: управление как в EVE: тап задаёт курс, у маяков — подлёт и орбита.</li>
        <li><a href="/prototype/world.html">Прототип мира</a>: системы, станции, задания, добыча, рынок.</li>
        <li><a href="/prototype/combat.html">Прототип боя</a>: цепочка точек и решение «дальше или домой».</li>
      </ul>
      <BalanceLab />
    </main>
  );
}
