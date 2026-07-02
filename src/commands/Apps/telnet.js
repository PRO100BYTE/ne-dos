export default class TelnetCommand {
  description() { return "Telnet to internal TUI services"; }

  help(term) {
    term.writeln('Usage: telnet <service>');
    term.writeln('Services: echo, time, bbs');
  }

  execute(term, params) {
    return new Promise((resolve) => {
      const service = (params[1] || 'echo').toLowerCase();
      if (term._setAppMode) term._setAppMode(true);
      term.writeln(`Connected to ${service}. Press Esc to disconnect.`);

      const nowLine = () => new Date().toLocaleString();
      const disp = term.onData((k) => {
        if (k === '\x1b') {
          disp.dispose();
          if (term._setAppMode) term._setAppMode(false);
          term.writeln('Disconnected.');
          resolve();
          return;
        }
        if (k === '\r') {
          term.writeln('');
          return;
        }
        if (service === 'echo') {
          term.write(k);
        } else if (service === 'time') {
          term.writeln(nowLine());
        } else if (service === 'bbs') {
          term.writeln(`BBS> ${k}`);
        }
      });
    });
  }
}
