export default class ExitCommand {
    execute(term, params, directory, setDirectory) {
        term.writeln('');
        term.writeln('The NE-DOS session will be terminated in 5 seconds. Bye-Bye!');
  
      setTimeout(() => {
        window.close();
      }, 5000);
    }
  }  