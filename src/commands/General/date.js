import dateFormat from "dateformat";
const date = new Date();
const d = dateFormat(date, "ddd m-dd-yyyy");

export default class DateCommand {
    execute(term, params, directory, setDirectory) {
        term.writeln('');
        term.writeln(`Current date is ${d}`);
        term.writeln('');
    }

    description() {
        return "Return current date";
    }
}