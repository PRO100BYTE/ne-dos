import { Buffer } from 'buffer';

export default class Base64Command {
  execute(term, params, directory, setDirectory) {
    if (params.length === 1) {
      this.help(term);
      return;
    }
    
    const action = params[1];
    const text = params.slice(2).join(' ');
    
    if (action !== 'encode' && action !== 'decode') {
      term.writeln('Invalid action: ' + action);
      term.writeln('Usage: base64 encode <text> or base64 decode <base64 text>');
      return;
    }
    
    if (!text || typeof text !== 'string') {
      term.writeln('Invalid text: ' + text);
      term.writeln('Usage: base64 encode <text> or base64 decode <base64 text>');
      return;
    }
    
    let result;
    if (action === 'encode') {
      result = Buffer.from(text, 'utf-8').toString('base64');
    } else {
      result = Buffer.from(text, 'base64').toString('utf-8');
    }
    
    term.writeln(result);
  }
  
  description() {
    return "Encode or decode text in base64 format";
  }
  
  help(term) {
    term.writeln('Usage: base64 encode <text> or base64 decode <base64 text>');
    term.writeln('Example: base64 encode NE-DOS');
    term.writeln('Result: TkUtRE9T');
  }
  
}