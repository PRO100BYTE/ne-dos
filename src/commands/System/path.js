export default class PathCommand {
  description() { return "Display or set command search path"; }

  help(term) {
    term.writeln('Usage: path [value]');
  }

  execute(term, params) {
    if (!window.__nedosEnv) window.__nedosEnv = {};
    const value = params.slice(1).join(' ').trim();
    if (!value) {
      term.writeln(`PATH=${window.__nedosEnv.PATH || ''}`);
      return;
    }
    window.__nedosEnv.PATH = value;
    term.writeln(`PATH=${window.__nedosEnv.PATH}`);
  }
}
