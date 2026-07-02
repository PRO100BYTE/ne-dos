export default class ModeCommand {
  description() { return "Display or set terminal mode"; }

  help(term) {
    term.writeln('Usage: mode');
    term.writeln('       mode con cols=<n> lines=<n>');
  }

  execute(term, params) {
    if (!params[1]) {
      term.writeln(`CON: cols=${term.cols} lines=${term.rows}`);
      return;
    }

    const args = params.slice(1).join(' ').toLowerCase();
    if (!args.startsWith('con')) {
      term.writeln('Only CON mode is supported.');
      return;
    }

    const colsMatch = args.match(/cols\s*=\s*(\d+)/i);
    const linesMatch = args.match(/lines\s*=\s*(\d+)/i);
    const cols = colsMatch ? Math.max(40, Math.min(300, parseInt(colsMatch[1], 10))) : term.cols;
    const lines = linesMatch ? Math.max(15, Math.min(120, parseInt(linesMatch[1], 10))) : term.rows;
    try {
      term.resize(cols, lines);
      term.writeln(`Mode updated: cols=${cols} lines=${lines}`);
    } catch (e) {
      term.writeln(`Mode error: ${e.message}`);
    }
  }
}
