export default class ClearCommand {
  execute(term, params, directory, setDirectory) {
    const flags = params.slice(1).map(p => p.toLowerCase());
    const CSI = '\x1b[';
    const full = flags.includes('/full');
    const home = flags.includes('/home') || full;
    const reset = flags.includes('/reset') || full;

    term.clear();
    if (reset) term.write(CSI + '0m');
    if (home) term.write(CSI + '2J' + CSI + 'H');
  }

  description() {
    return "Clear terminal (/full, /home, /reset)";
  }

  help(term) {
    term.writeln('Usage: cls [/full] [/home] [/reset]');
    term.writeln('  /full  clear + home + reset attributes');
    term.writeln('  /home  move cursor to top-left');
    term.writeln('  /reset reset ANSI attributes');
  }
}