export default class NetStatCommand {
  description() { return "Display simulated network connections"; }

  help(term) {
    term.writeln('Usage: netstat');
  }

  execute(term) {
    term.writeln('Active Connections (simulated)');
    term.writeln('');
    term.writeln('Proto  Local Address          Foreign Address        State');
    term.writeln('TCP    0.0.0.0:80             0.0.0.0:0              LISTENING');
    term.writeln('TCP    127.0.0.1:3000         127.0.0.1:54120        ESTABLISHED');
    term.writeln('UDP    0.0.0.0:68             *:*                    OPEN');
  }
}
