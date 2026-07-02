import { ResolveInCurrentDrive } from "./StorageManager";

export default class FCCommand {
  description() { return "Compare two files"; }

  help(term) {
    term.writeln('Usage: fc <file1> <file2>');
  }

  execute(term, params, currentDirectory) {
    const aArg = params[1];
    const bArg = params[2];
    if (!aArg || !bArg) {
      term.writeln('Usage: fc <file1> <file2>');
      return;
    }

    const a = ResolveInCurrentDrive(currentDirectory, aArg);
    const b = ResolveInCurrentDrive(currentDirectory, bArg);
    if (!window.fs.existsSync(a) || !window.fs.existsSync(b)) {
      term.writeln('File not found');
      return;
    }

    const al = window.fs.readFileSync(a, 'utf8').replaceAll('\r\n', '\n').split('\n');
    const bl = window.fs.readFileSync(b, 'utf8').replaceAll('\r\n', '\n').split('\n');
    const max = Math.max(al.length, bl.length);
    let diff = 0;

    for (let i = 0; i < max; i++) {
      const left = al[i] ?? '';
      const right = bl[i] ?? '';
      if (left !== right) {
        diff++;
        term.writeln(`***** Line ${i + 1}`);
        term.writeln(`< ${left}`);
        term.writeln(`> ${right}`);
      }
    }

    if (!diff) term.writeln('FC: no differences encountered');
    else term.writeln(`FC: ${diff} difference(s) found`);
  }
}
