export default class CalendarCommand {
  description() { return "Show monthly calendar"; }

  help(term) {
    term.writeln('Usage: calendar [month] [year]');
  }

  execute(term, params) {
    const now = new Date();
    const month = Math.max(1, Math.min(12, parseInt(params[1] || String(now.getMonth() + 1), 10))) - 1;
    const year = parseInt(params[2] || String(now.getFullYear()), 10);

    const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const first = new Date(year, month, 1);
    const days = new Date(year, month + 1, 0).getDate();
    let out = `${names[month]} ${year}`;
    term.writeln(out);
    term.writeln('Su Mo Tu We Th Fr Sa');

    let line = '   '.repeat(first.getDay());
    for (let d = 1; d <= days; d++) {
      line += String(d).padStart(2, ' ') + ' ';
      if ((first.getDay() + d) % 7 === 0 || d === days) {
        term.writeln(line.trimEnd());
        line = '';
      }
    }
  }
}
