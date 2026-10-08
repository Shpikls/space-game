import { useState } from 'react';
import { winRate, type MissionSim } from '../game/simulate';

const CASES: { label: string; cfg: MissionSim }[] = [
  { label: 'Фрегат, 2 рельсы — 2 тяжёлых', cfg: { ship: 'frigate', fit: { weapon: ['kinetic', 'kinetic'], def: ['plate'], util: ['none'] }, comp: { heavy: 2 }, order: { type: 'keep', dist: 700 } } },
  { label: 'Фрегат, 2 лазера — 3 перехватчика', cfg: { ship: 'frigate', fit: { weapon: ['energy', 'energy'], def: ['plate'], util: ['none'] }, comp: { light: 3 }, order: { type: 'keep', dist: 450 } } },
  { label: 'Фрегат, 2 лазера — 3 тяжёлых', cfg: { ship: 'frigate', fit: { weapon: ['energy', 'energy'], def: ['plate'], util: ['none'] }, comp: { heavy: 3 }, order: { type: 'keep', dist: 450 } } },
  { label: 'Крейсер, рельса + 2 лазера — 3 тяжёлых и 4 перехватчика', cfg: { ship: 'cruiser', fit: { weapon: ['kinetic', 'energy', 'energy'], def: ['plate', 'plate'], util: ['repair'] }, comp: { heavy: 3, light: 4 }, order: { type: 'keep', dist: 450 } } },
];

/** Лаборатория баланса: прогоняет бои без вмешательства игрока прямо в браузере. */
export function BalanceLab() {
  const [rates, setRates] = useState<number[] | null>(null);
  return (
    <section>
      <h2>Лаборатория баланса</h2>
      <p className="muted">40 боёв на каждый случай, корабль воюет сам по стартовому плану.</p>
      <button type="button" onClick={() => setRates(CASES.map((c) => winRate(c.cfg)))}>Прогнать бои</button>
      {rates && (
        <table>
          <tbody>
            {CASES.map((c, i) => (
              <tr key={c.label}>
                <td>{c.label}</td>
                <td>{Math.round((rates[i] ?? 0) * 100)}% побед</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
