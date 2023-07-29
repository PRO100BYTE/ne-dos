export default class VersionCommand {
  execute(term, params, directory, setDirectory) {
    if (params[1] === ".alex") {
      window.open(`https://promudoblyadskayapizdoproyobina.site/`, '_blank');
      return;
    }
    term.writeln('');
    term.writeln(`NOT-DOS ${window['VERSION']}`);
    term.writeln('');
  }
}