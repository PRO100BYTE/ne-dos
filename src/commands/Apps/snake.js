const CSI = '\x1b[';
const clear = () => `${CSI}2J${CSI}H`;
const goto = (r, c) => `${CSI}${r};${c}H`;
const hide = () => `${CSI}?25l`;
const show = () => `${CSI}?25h`;

export default class SnakeCommand {
  description() { return "Classic snake game"; }

  help(term) { term.writeln('Usage: snake'); }

  execute(term) {
    return new Promise((resolve) => {
      const w = Math.max(28, Math.min(term.cols - 2, 96));
      const h = Math.max(14, Math.min(term.rows - 4, 36));
      let dir = { x: 1, y: 0 };
      const cx = Math.floor(w / 2);
      const cy = Math.floor(h / 2);
      // Start with a 4-segment snake for better gameplay pacing.
      let snake = [
        { x: cx, y: cy },
        { x: cx - 1, y: cy },
        { x: cx - 2, y: cy },
        { x: cx - 3, y: cy },
      ];
      let food = { x: 5, y: 5 };
      let score = 0;
      let timer = null;
      let over = false;

      if (term._setAppMode) term._setAppMode(true);

      const placeFood = () => {
        while (true) {
          const x = 1 + Math.floor(Math.random() * (w - 2));
          const y = 1 + Math.floor(Math.random() * (h - 2));
          if (!snake.some(s => s.x === x && s.y === y)) { food = { x, y }; return; }
        }
      };

      const render = () => {
        let out = hide() + clear();
        out += goto(1, 1) + `SNAKE  Score:${score}  Esc:Quit`;
        for (let y = 0; y < h; y++) {
          out += goto(y + 2, 1);
          for (let x = 0; x < w; x++) {
            const border = x === 0 || y === 0 || x === w - 1 || y === h - 1;
            if (border) out += '#';
            else if (food.x === x && food.y === y) out += '*';
            else {
              const idx = snake.findIndex(s => s.x === x && s.y === y);
              out += idx === 0 ? '@' : (idx > 0 ? 'o' : ' ');
            }
          }
        }
        if (over) out += goto(h + 3, 1) + 'Game Over. Press Esc.';
        term.write(out);
      };

      const tick = () => {
        if (over) return;
        const head = snake[0];
        const next = { x: head.x + dir.x, y: head.y + dir.y };
        if (next.x <= 0 || next.y <= 0 || next.x >= w - 1 || next.y >= h - 1 || snake.some(s => s.x === next.x && s.y === next.y)) {
          over = true;
          render();
          return;
        }
        snake.unshift(next);
        if (next.x === food.x && next.y === food.y) {
          score += 10;
          placeFood();
        } else snake.pop();
        render();
      };

      const exit = () => {
        if (timer) clearInterval(timer);
        if (disp) disp.dispose();
        if (term._setAppMode) term._setAppMode(false);
        term.write(show() + clear());
        resolve();
      };

      placeFood();
      render();
      timer = setInterval(tick, 120);

      const disp = term.onData((k) => {
        if (k === '\x1b') { exit(); return; }
        if (k === '\x1b[A' && dir.y !== 1) dir = { x: 0, y: -1 };
        else if (k === '\x1b[B' && dir.y !== -1) dir = { x: 0, y: 1 };
        else if (k === '\x1b[D' && dir.x !== 1) dir = { x: -1, y: 0 };
        else if (k === '\x1b[C' && dir.x !== -1) dir = { x: 1, y: 0 };
      });
    });
  }
}
