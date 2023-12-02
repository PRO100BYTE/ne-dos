import dateFormat from "dateformat";

export default class DateCommand {
    execute(term, params, directory, setDirectory) {
        const date = new Date();
        const d = dateFormat(date, "ddd m-dd-yyyy");
        term.writeln('');
        term.writeln(`Current date is ${d}`);
        term.writeln('');
    }

    description() {
        return "Print current date";
    }

    help(term) {
        term.writeln("Usage: date")
        term.writeln("This command prints the current date in the format ddd m-dd-yyyy")
        term.writeln("Sample output: Thu 01-01-1970") // Current date is Thu 01-01-1970
    }
}