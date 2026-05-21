export default class PingCommand {
  description() { return "Ping a host (simulated)"; }

  help(term) {
    term.writeln('Usage: ping <host>');
  }

  async execute(term, params) {
    const host = params[1];
    if (!host) {
      term.writeln('Usage: ping <host>');
      return;
    }

    term.writeln(`Pinging ${host} with 32 bytes of data:`);
    for (let i = 0; i < 4; i++) {
      const ms = 12 + Math.floor(Math.random() * 25);
      await new Promise((r) => setTimeout(r, 220));
      term.writeln(`Reply from ${host}: bytes=32 time=${ms}ms TTL=64`);
    }
    term.writeln('');
    term.writeln('Ping statistics: Sent = 4, Received = 4, Lost = 0 (0% loss)');
  }
}
