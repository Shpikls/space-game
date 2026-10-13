/** Сценарий из адресной строки: ?ship=frigate|cruiser|battleship, ?at=station|belt|signal|p3, ?speed=4, ?debug=1 */
export interface Scenario {
  /** корпус игрока; неизвестный — крейсер (решает createWorld) */
  hull: string;
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
    at: params.get('at') || 'station',
    timeScale: TIME_SCALES.includes(speed) ? speed : 1,
    debug: params.get('debug') === '1',
  };
}
