# Космическая игра

Одиночная космическая песочница в браузере: полёт по приказам, варп по звёздной системе «Ксанта». TypeScript, three.js, Vite.

Играть: https://shpikls.github.io/space-game/ (отладка — https://shpikls.github.io/space-game/?debug=1)

```bash
npm install
npm run dev     # http://localhost:5173
npm test
```

Сценарии в адресе: `?ship=frigate|cruiser|battleship`, `?gun=light|heavy`, `?at=station|belt|signal|p3|pirate1` (у `signal` — засада: брулер и снайпер), `?speed=4`, `?debug=1`.

Видение — `docs/VISION.md`, решения — `docs/DESIGN.md`, план — `ROADMAP.md`, правила для Claude Code — `CLAUDE.md`.
