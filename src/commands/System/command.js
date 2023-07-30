import dateFormat from "dateformat";

export default class CommandCOMCommand {
    execute(term, params, directory, setDirectory) {
        term.clear();
        const date = new Date();
        const d = dateFormat(date, "ddd m-dd-yyyy");
        const t = dateFormat(date, "HH:MM:ss.L");

        term.writeln(`Current date is ${d}`);
        term.writeln(`Current time is ${t}`);
        term.writeln('');
        term.writeln('');
        term.writeln('The NE-DOS Personal Computer DOS');
        term.writeln(`Version ${window['VERSION']} (C) Copyright PRO100BYTE Team`);
        term.writeln(`Built: ${window['BUILD_DATE']}`);
        term.writeln('');
    }
  
    description() {
      return "Start a new instance of the NE-DOS";
    }
  }