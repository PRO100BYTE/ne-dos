export default class RebootCommand {
    async execute(term, params, directory, setDirectory) {
      term.writeln("NE-DOS will be rebooted in 3 seconds...");
      await new Promise((a) => setTimeout(a, 3000));
      window.location.reload();
    }
    
    description() {
      return "Reboots NE-DOS and reloads the browser tab";
    }
    
    help(term) {
      term.writeln("Usage: reboot");
      term.writeln("Reboots NE-DOS and reloads the browser tab after a countdown of 3 seconds.");
    }
  }
  