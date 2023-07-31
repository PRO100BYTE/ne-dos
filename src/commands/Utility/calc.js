const basicMath = require('advanced-calculator');

export default class CalcCommand {
  execute(term, params, directory, setDirectory) {
    if (params.length > 0) {
      try {
        const expression = params[1].replace(/calc|\s/g, '');
        const result = basicMath.evaluate(expression);
        term.writeln(result);
      } catch (error) {
        term.writeln("Invalid expression: " + error.message);
      }
    } else {
      term.writeln("Usage: calc <expression>");
      term.writeln("Example: calc 2+2*2");
    }
  }
  
  description() {
    return "A calculator command that evaluates arithmetic expressions";
  }
  
  help(term) {
    term.writeln("The calc command evaluates arithmetic expressions using the advanced-calculator library.");
    term.writeln("You can use parentheses, operators (+, -, *, /, %, ^), constants (e, pi), and functions (sin, cos, tan, ln, log, sqrt) in your expressions.");
    term.writeln("Usage: calc <expression>");
    term.writeln("Example: calc (2+2)*2^2");
  }
}
