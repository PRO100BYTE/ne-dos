export default class PasswordCommand {
    execute(term, params, directory, setDirectory) {
      let length = 8;
      if (params[1] && Number.isInteger(+params[1])) {
        length = +params[1];
      }
      let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@()+-=;:,.?";
      let password = "";
      for (let i = 0; i < length; i++) {
        password += chars[Math.floor(Math.random() * chars.length)];
      }
      term.writeln("Your password is: " + password);
    }
    
    description() {
      return "Generate a random password of a given length";
    }
    
    help(term) {
      term.writeln("Usage: password [length]");
      term.writeln("Generate a random password of a given length (default is 8)");
      term.writeln("Example: password 12");
    }
  }
  