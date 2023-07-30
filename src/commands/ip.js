export default class IpCommand {
    async execute(term, params, directory, setDirectory) {
        try {
            const ip = await fetch(`https://ens4.ru/`)
              .then(d => d.text());
            term.writeln(ip.replaceAll("\n", "\r\n"));
        } catch (_) {
            term.writeln("Failed to fetch your IP address");
        }
    }
}