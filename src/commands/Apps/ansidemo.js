const CSI = '\x1b[';
const RESET = CSI + '0m';

export default class AnsiDemoCommand {
  description() { return "ANSI demo pack"; }

  help(term) {
    term.writeln('Usage: ansidemo');
  }

  execute(term) {
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
    term.writeln('Blink test: ' + CSI + '5mBLINK?' + RESET + ' (depends on terminal support)');
  }
}
