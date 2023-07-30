export default class WwwCommand {
    execute(term, params, directory, setDirectory) {
        if (!params[1]) {
            term.writeln('usage: www [url]');
            return;
        }
        params = params.slice(1);
        const url = params.join(" ");
        try {
            new URL(url);
            window.open(url, '_blank');
        } catch (_) {
            term.writeln("Incorrect URL");
        }
    }

    description() {
        return "Open new tab with given URL";
    }
}