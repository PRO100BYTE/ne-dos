import { ResolveInCurrentDrive, FormatDirectory } from "./StorageManager";

const getStore = () => {
  if (!window.__nedosAttribStore) window.__nedosAttribStore = {};
  return window.__nedosAttribStore;
};

export default class AttribCommand {
  description() { return "View or change file attributes"; }

  help(term) {
    term.writeln("Usage: attrib [+r|-r] [+h|-h] [+s|-s] [+a|-a] <path>");
    term.writeln("If no flags are provided, shows current attributes.");
  }

  execute(term, params, currentDirectory) {
    const flags = params.slice(1).filter(p => /^[+-][rhsa]$/i.test(p));
    const targetArg = params.slice(1).find(p => !p.startsWith('+') && !p.startsWith('-'));
    if (!targetArg) {
      term.writeln("Usage: attrib [+r|-r] [+h|-h] [+s|-s] [+a|-a] <path>");
      return;
    }

    const target = ResolveInCurrentDrive(currentDirectory, targetArg);
    if (!window.fs.existsSync(target)) {
      term.writeln("File not found");
      return;
    }

    const store = getStore();
    if (!store[target]) store[target] = { r: false, h: false, s: false, a: true };

    for (const f of flags) {
      const op = f[0];
      const key = f[1].toLowerCase();
      store[target][key] = op === '+';
    }

    const a = store[target];
    const fmt = `${a.r ? 'R' : '-'}${a.h ? 'H' : '-'}${a.s ? 'S' : '-'}${a.a ? 'A' : '-'}`;
    term.writeln(`${fmt}  ${FormatDirectory(target)}`);
  }
}
