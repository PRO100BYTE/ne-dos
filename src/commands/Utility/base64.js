export default class Base64Command {
    execute(term, params, directory, setDirectory) {
      if (params.length === 1) {
        this.help(term);
      } else {
        let fullText = params.join(" ");
        let text = fullText.replace("base64 ", "");
        let encoded = btoa(text);
        term.writeln(`${encoded}`);
      }
    }
    
    description() {
      return "Encodes the text using base64 and outputs the result to the terminal";
    }
    
    help(term) {
        term.writeln("Usage: base64 <text>");
        term.writeln("Encodes text using base64 and outputs the result to the terminal");
        term.writeln("Text may contain spaces or commas");
    }
  }
  