export default class WwwCommand {
    execute(term, params, directory, setDirectory) {
        if (!params[1]) {
            term.writeln('usage: www [url]');
            return;
        }
        params = params.slice(1);
        const url = params.join(" ");
        window.open(url, '_blank');
    }
  }