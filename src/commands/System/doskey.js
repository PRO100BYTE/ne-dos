export default class DosKeyCommand {
  description() { return "Manage command aliases and history"; }

  help(term) {
    term.writeln('Usage: doskey [alias=value] [/macros] [/history]');
  }

  execute(term, params) {
    if (!window.__nedosAliases) window.__nedosAliases = {};
    if (!window.__nedosHistory) window.__nedosHistory = [];

    const arg = params.slice(1).join(' ');
    const flags = params.slice(1).filter(p => p.startsWith('/')).map(p => p.toLowerCase());

    if (!arg || flags.includes('/macros')) {
      Object.keys(window.__nedosAliases).sort().forEach((k) => term.writeln(`${k}=${window.__nedosAliases[k]}`));
      return;
    }

    if (flags.includes('/history')) {
      window.__nedosHistory.forEach((h) => term.writeln(h));
      return;
    }

    const idx = arg.indexOf('=');
    if (idx === -1) {
      term.writeln('Invalid syntax. Use alias=value');
      return;
    }

    const key = arg.slice(0, idx).trim().toLowerCase();
    const value = arg.slice(idx + 1).trim();
    if (!key) {
      term.writeln('Invalid alias');
      return;
    }
    window.__nedosAliases[key] = value;
    term.writeln(`${key}=${value}`);
  }
}
