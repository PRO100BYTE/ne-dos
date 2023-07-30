export default class VersionCommand {
  execute(term, params, directory, setDirectory) {
    if (params[1] === ".alex") {
      window.open(`https://promudoblyadskayapizdoproyobina.site/`, '_blank');

      return;
    }
    if (params[1] === ".lexa") {
      term.writeln('');
      term.writeln('Open the Lexa blackhole...');
      setTimeout(() => {
        window.open(`https://promudoblyadskayapizdoproyobina.site/`, '_blank');
      }, 2000);

      return;
    }
    term.writeln('');
    term.writeln(`NE-DOS ${window['VERSION']}`);
    term.writeln(`Built: ${window['BUILD_DATE']}`);
    term.writeln('');
  }

  description() {
    return "Print current version";
  }
}