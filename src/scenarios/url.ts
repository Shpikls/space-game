/**
 * Сценарий из адресной строки: ?ship=frigate|cruiser|battleship, ?gun=light|heavy, ?at=station|belt|signal|p3|pirate1, ?speed=4, ?debug=1,
 * ?scenario=duel|brawler|sniper|swarm — бой: без ship и gun открывается подготовка, с ними — сразу вылет.
 * Без параметров — стартовый экран.
 */
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
  /** бой из ?scenario= (неизвестный — стартовый экран решает сам) */
  fight: string | null;
  /** корпус или турель заданы явно — для боя это значит «сразу вылет» */
  fit: boolean;
  /** в адресе есть хоть один параметр — стартовый экран не показываем */
  explicit: boolean;
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
    fight: params.get('scenario'),
    fit: params.has('ship') || params.has('gun'),
    explicit: [...params.keys()].length > 0,
  };
}
