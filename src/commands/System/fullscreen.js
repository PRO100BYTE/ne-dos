export default class FullscreenCommand {
  description() {
    return 'Toggle fullscreen mode (F11)';
  }

  help(term) {
    term.writeln('FULLSCREEN\r');
    term.writeln('  Toggles fullscreen mode for the terminal.\r');
    term.writeln('  Use Shift+F11 as a system hotkey for other applications.\r');
  }

  execute(term, params) {
    try {
      if (typeof window.__nedosToggleFullscreen === 'function') {
        window.__nedosToggleFullscreen();
      } else {
        term.writeln('Fullscreen API not available\r');
      }
    } catch (err) {
      term.writeln(`Fullscreen error: ${err.message}\r`);
    }
  }
}
