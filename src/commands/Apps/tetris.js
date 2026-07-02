const CSI = '\x1b[';
const clear = () => `${CSI}2J${CSI}H`;
const goto = (r, c) => `${CSI}${r};${c}H`;
const hide = () => `${CSI}?25l`;
const show = () => `${CSI}?25h`;

export default class TetrisCommand {
  description() { return "Mini tetris game"; }

  help(term) { term.writeln('Usage: tetris'); }

  execute(term) {
    return new Promise((resolve) => {
      const W = Math.max(12, Math.min(18, Math.floor((term.cols - 4) / 2)));
      const H = Math.max(20, Math.min(30, term.rows - 5));
      const board = Array.from({ length: H }, () => Array(W).fill(0));
      const pieces = [
        [[1,1,1,1]],
        [[1,1],[1,1]],
        [[0,1,0],[1,1,1]],
        [[1,1,0],[0,1,1]],
        [[0,1,1],[1,1,0]],
      ];

      let piece = null;
      let x = 3;
      let y = 0;
      let score = 0;
      let over = false;
      let timer = null;

      if (term._setAppMode) term._setAppMode(true);

      const rotate = (m) => m[0].map((_, i) => m.map(r => r[i]).reverse());
      const collide = (px, py, pm) => {
        for (let r = 0; r < pm.length; r++) {
          for (let c = 0; c < pm[r].length; c++) {
            if (!pm[r][c]) continue;
            const bx = px + c;
            const by = py + r;
            if (bx < 0 || bx >= W || by >= H) return true;
            if (by >= 0 && board[by][bx]) return true;
          }
        }
        return false;
      };

      const merge = () => {
        for (let r = 0; r < piece.length; r++) for (let c = 0; c < piece[r].length; c++) if (piece[r][c]) {
          const by = y + r;
          const bx = x + c;
          if (by >= 0) board[by][bx] = 1;
        }
      };

      const clearLines = () => {
        for (let r = H - 1; r >= 0; r--) {
          if (board[r].every(Boolean)) {
            board.splice(r, 1);
            board.unshift(Array(W).fill(0));
            score += 100;
            r++;
          }
        }
      };

      const spawn = () => {
        piece = JSON.parse(JSON.stringify(pieces[Math.floor(Math.random() * pieces.length)]));
        x = Math.floor((W - piece[0].length) / 2);
        y = -1;
        if (collide(x, y + 1, piece)) over = true;
      };

      const render = () => {
        let out = hide() + clear();
        out += goto(1, 1) + `TETRIS  Score:${score}  Esc:Quit`;
        for (let r = 0; r < H; r++) {
          out += goto(2 + r, 1) + '|';
          for (let c = 0; c < W; c++) {
            let filled = board[r][c];
            for (let pr = 0; piece && pr < piece.length; pr++) for (let pc = 0; piece && pc < piece[pr].length; pc++) {
              if (piece[pr][pc] && y + pr === r && x + pc === c) filled = 1;
            }
            out += filled ? '[]' : '  ';
          }
          out += '|';
        }
        out += goto(H + 2, 1) + '+' + '-'.repeat(W * 2) + '+';
        if (over) out += goto(H + 4, 1) + 'Game Over. Press Esc.';
        term.write(out);
      };

      const step = () => {
        if (over) return render();
        if (!piece) spawn();
        if (!collide(x, y + 1, piece)) y++;
        else {
          merge();
          clearLines();
          spawn();
        }
        render();
      };

      const exit = () => {
        if (timer) clearInterval(timer);
        if (disp) disp.dispose();
        if (term._setAppMode) term._setAppMode(false);
        term.write(show() + clear());
        resolve();
      };

      spawn();
      render();
      timer = setInterval(step, 300);

      const disp = term.onData((k) => {
        if (k === '\x1b') { exit(); return; }
        if (over) return;
        if (k === '\x1b[D' && !collide(x - 1, y, piece)) x--;
        else if (k === '\x1b[C' && !collide(x + 1, y, piece)) x++;
        else if (k === '\x1b[B' && !collide(x, y + 1, piece)) y++;
        else if (k === ' ' || k === '\x1b[A') {
          const rp = rotate(piece);
          if (!collide(x, y, rp)) piece = rp;
        }
        render();
      });
    });
  }
}
