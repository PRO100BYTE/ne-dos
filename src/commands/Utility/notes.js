import path from "path-browserify";
import { GetDriveRoot } from "../Filesystem/StorageManager";

export default class NotesCommand {
  description() { return "Quick notes utility"; }

  help(term) {
    term.writeln('Usage: notes');
    term.writeln('       notes add <text>');
    term.writeln('       notes clear');
  }

  execute(term, params, currentDirectory) {
    const root = GetDriveRoot(currentDirectory);
    const dir = root === '/' ? '/notes' : `${root}/notes`;
    const file = path.join(dir, 'notes.txt');

    try {
      if (!window.fs.existsSync(dir)) window.fs.mkdirSync(dir, { recursive: true });
    } catch {}

    const cmd = (params[1] || '').toLowerCase();
    if (cmd === 'clear') {
      window.fs.writeFileSync(file, '');
      term.writeln('Notes cleared.');
      return;
    }

    if (cmd === 'add') {
      const text = params.slice(2).join(' ').trim();
      if (!text) {
        term.writeln('Usage: notes add <text>');
        return;
      }
      const prev = window.fs.existsSync(file) ? window.fs.readFileSync(file, 'utf8') : '';
      window.fs.writeFileSync(file, prev + (prev ? '\n' : '') + '- ' + text);
      term.writeln('Note added.');
      return;
    }

    if (!window.fs.existsSync(file)) {
      term.writeln('No notes yet. Use: notes add <text>');
      return;
    }
    term.writeln(window.fs.readFileSync(file, 'utf8').replaceAll('\n', '\r\n'));
  }
}
