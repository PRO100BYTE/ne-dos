import dateFormat from "dateformat";
const date = new Date();
const t = dateFormat(date, "h:MM:ss.L");

export default class TimeCommand {
    execute(term, params, directory, setDirectory) {
    term.writeln('');
    term.writeln(`Current time is ${t}`);
    term.writeln('');
    }
  }