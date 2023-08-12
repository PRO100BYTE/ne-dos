var CryptoJS = require("crypto-js");

export default class PasswordCommand {
  execute(term, params, directory, setDirectory) {
    let length = 12;
    if (params[1] && Number.isInteger(+params[1])) {
      length = +params[1];
    }
    if (length < 12) {
      term.writeln("Invalid password length. It should be at least 12.");
      return;
    }
    let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,./<>?";
    let password = "";
    for (let i = 0; i < length; i++) {
      let byte = CryptoJS.lib.WordArray.random(1).toString().charCodeAt(0);
      password += chars[byte % chars.length];
    }
    term.writeln("Your password is: " + password);
  }
  
  description() {
    return "Generate a random password of a given length of at least 12";
  }
  
  help(term) {
    term.writeln("Usage: password [length]");
    term.writeln("Generate a random password of a given length of at least 12");
    term.writeln("Example: password 16");
  }
}
