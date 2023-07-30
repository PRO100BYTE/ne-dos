export default class CalcCommand {
    execute(term, params, directory, setDirectory) {
        function calc(args) {
            if (args.length === 0) {
              // Выводим справку об использовании, если нет аргументов
              term.writeln("Usage: calc <expression>");
              term.writeln("Example: calc 2 + 3 * 5");
              term.writeln("Supported operations: +, -, *, /");
              term.writeln("Note: Make sure to put spaces between each operand and operator.");
            } 
            else {
              try {
                // Приводим аргументы к строке и выполняем вычисление с помощью eval
                const result = eval(args.join(' '));
                // Выводим результат
                term.writeln(result);
              } catch (error) {
                // Если возникла ошибка при вычислении, выводим сообщение об ошибке
                term.writeln('Error: Invalid expression. Please provide a valid mathematical expression.');
              }
            }
          }
          
          // Получаем аргументы командной строки, исключая путь к файлу и название программы
          const args = process.argv.slice(2);
          
          // Вызываем калькулятор с переданными аргументами
          calc(args);
          
    }
    
    description() {
      // Краткое описание команды для команды help
      return "Calculates mathematical expressions.";
    }
    
    help(term) {
      // Выводим справку об использовании команды calc
      term.writeln("Usage: calc <expression>");
      term.writeln("Example: calc 2 + 3 * 5");
      term.writeln("Supported operations: +, -, *, /");
      term.writeln("Note: Make sure to put spaces between each operand and operator.");
    }
  }
  
  