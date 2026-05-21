export default class SetCommand {
  description() { return "Set, list, or remove environment variables"; }

  help(term) {
    term.writeln('Usage: set [NAME=VALUE]');
    term.writeln('       set NAME');
  }

  execute(term, params) {
    if (!window.__nedosEnv) window.__nedosEnv = {};
    const arg = params.slice(1).join(' ');

    if (!arg) {
      Object.keys(window.__nedosEnv).sort().forEach((k) => term.writeln(`${k}=${window.__nedosEnv[k]}`));
      return;
    }

    if (arg.includes('=')) {
      const idx = arg.indexOf('=');
      const key = arg.slice(0, idx).trim();
      const value = arg.slice(idx + 1);
      if (!key) {
        term.writeln('Invalid variable name');
        return;
      }
      if (value === '') delete window.__nedosEnv[key];
      else window.__nedosEnv[key] = value;
      return;
    }

    const key = arg.trim();
    if (Object.prototype.hasOwnProperty.call(window.__nedosEnv, key)) term.writeln(`${key}=${window.__nedosEnv[key]}`);
  }
}
