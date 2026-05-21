export default class IpConfigCommand {
  description() { return "Display simulated TCP/IP configuration"; }

  help(term) {
    term.writeln('Usage: ipconfig');
  }

  execute(term) {
    const profile = window.__nedosNetProfile || {
      hostname: 'NE-DOS',
      ip: '192.168.1.77',
      mask: '255.255.255.0',
      gateway: '192.168.1.1',
      dns: ['1.1.1.1', '8.8.8.8']
    };

    term.writeln('Windows IP Configuration (simulated)');
    term.writeln('');
    term.writeln(`Host Name . . . . . . . . . . . . : ${profile.hostname}`);
    term.writeln(`IPv4 Address. . . . . . . . . . . : ${profile.ip}`);
    term.writeln(`Subnet Mask . . . . . . . . . . . : ${profile.mask}`);
    term.writeln(`Default Gateway . . . . . . . . . : ${profile.gateway}`);
    term.writeln(`DNS Servers . . . . . . . . . . . : ${profile.dns.join(', ')}`);
  }
}
