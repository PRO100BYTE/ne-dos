export default class CalcCommand {
  description() { return "Simple calculator"; }

  help(term) {
    term.writeln('Usage: calc <expression>');
    term.writeln('Example: calc (2+3)*4');
  }

  execute(term, params) {
    const expr = params.slice(1).join(' ').trim();
    if (!expr) {
      term.writeln('Usage: calc <expression>');
      return;
    }
    if (!/^[0-9+\-*/().%\s]+$/.test(expr)) {
      term.writeln('Unsupported characters in expression.');
      return;
    }
    try {
      const result = Function(`"use strict"; return (${expr});`)();
      term.writeln(String(result));
    } catch (e) {
      term.writeln(`Calc error: ${e.message}`);
    }
  }
}
