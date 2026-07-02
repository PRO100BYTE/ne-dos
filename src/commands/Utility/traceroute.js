export default class TraceRouteCommand {
  description() { return "Trace route to host (simulated)"; }

  help(term) {
    term.writeln('Usage: traceroute <host>');
  }

  async execute(term, params) {
    const host = params[1];
    if (!host) {
      term.writeln('Usage: traceroute <host>');
      return;
    }

    term.writeln(`Tracing route to ${host} over a maximum of 30 hops`);
    const hops = [
      '192.168.1.1',
      '10.10.0.1',
      '172.16.4.2',
      '93.184.216.34'
    ];

    for (let i = 0; i < hops.length; i++) {
      const t1 = 8 + Math.floor(Math.random() * 15);
      const t2 = 8 + Math.floor(Math.random() * 15);
      const t3 = 8 + Math.floor(Math.random() * 15);
      await new Promise((r) => setTimeout(r, 180));
      term.writeln(`${String(i + 1).padStart(2, ' ')}   ${String(t1).padStart(2, ' ')} ms  ${String(t2).padStart(2, ' ')} ms  ${String(t3).padStart(2, ' ')} ms  ${hops[i]}`);
    }
    term.writeln('Trace complete.');
  }
}
