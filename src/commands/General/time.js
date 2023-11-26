import dateFormat from "dateformat";

export default class TimeCommand {
    execute(term, params, directory, setDirectory) {
        const date = new Date();
        const t = dateFormat(date, "HH:MM:ss.L");
        term.writeln('');
        term.writeln(`Current time is ${t}`);
        term.writeln('');
    }

    description() {
        return "Print current time";
    }

    help(term) {
        term.writeln("Usage: time");
        term.writeln("This command prints the current time in the format HH:mm:ss.SSS");
    }
}
