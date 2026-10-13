/** Сценарий из адресной строки: ?ship=frigate|cruiser|battleship, ?gun=light|heavy, ?at=station|belt|signal|p3|pirate1, ?speed=4, ?debug=1 */
export interface Scenario {
  /** корпус игрока; неизвестный — крейсер (решает createWorld) */
  hull: string;
  /** турель игрока; неизвестная — лёгкая (решает createWorld) */
  gun: string;
  /** id объекта, у которого появляется игрок; неизвестный — станция */
  at: string;
  /** ускорение времени: 1, 4 или 10 */
  timeScale: number;
  /** открыть панель отладки сразу */
  debug: boolean;
}

export const TIME_SCALES = [1, 4, 10];

export function scenarioFromUrl(search: string): Scenario {
  const params = new URLSearchParams(search);
  const speed = Number(params.get('speed'));
  return {
    hull: params.get('ship') || 'cruiser',
    gun: params.get('gun') || 'light',
    at: params.get('at') || 'station',
    timeScale: TIME_SCALES.includes(speed) ? speed : 1,
    debug: params.get('debug') === '1',
  };
}
