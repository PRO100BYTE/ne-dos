const CSI = '\x1b[';
const RESET = CSI + '0m';
const goto = (r, c) => `${CSI}${r};${c}H`;

export default class AnsiDemoCommand {
  description() { return "ANSI demo pack"; }

  help(term) {
    term.writeln('Usage: ansidemo');
  }

  execute(term) {
    return new Promise((resolve) => {
      if (term._setAppMode) term._setAppMode(true);

      const blinkRow = 11;
      let visible = true;
      let ticks = 0;

      term.write(`${CSI}2J${CSI}H`);
      term.writeln('ANSI color demo:');
      for (let c = 30; c <= 37; c++) term.write(`${CSI}${c}m FG${c} ${RESET}`);
      term.writeln('');
      for (let c = 40; c <= 47; c++) term.write(`${CSI}${c}m BG${c} ${RESET}`);
      term.writeln('');
      term.writeln('Pseudo-graphics test:');
      term.writeln('┌─────────────────────────────┐');
      term.writeln('│  NE-DOS Retro Benchmark     │');
      term.writeln('│  [##########] 100%          │');
      term.writeln('└─────────────────────────────┘');
      term.writeln('Blink test (hardware): ' + CSI + '5mBLINK?' + RESET + '  [may be unsupported]');
      term.writeln('Blink test (software):');
      term.writeln('Press Esc to close demo.');

      const drawSoftBlink = () => {
        const text = visible ? (CSI + '1;33mBLINK ACTIVE' + RESET) : '            ';
        term.write(goto(blinkRow + 1, 24) + text);
      };

      const finish = () => {
        clearInterval(timer);
        if (disp) disp.dispose();
        term.write(goto(blinkRow + 3, 1) + RESET);
        if (term._setAppMode) term._setAppMode(false);
        resolve();
      };

      drawSoftBlink();
      const timer = setInterval(() => {
        visible = !visible;
        ticks++;
        drawSoftBlink();
        if (ticks >= 24) {
          term.write(goto(blinkRow + 2, 1) + 'Software blink demo complete. Press Esc or any key to exit.');
        }
      }, 180);

      const disp = term.onData((k) => {
        if (k === '\x1b' || ticks >= 24) {
          finish();
        }
      });
    });
  }
}
