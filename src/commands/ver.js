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
    if (params[1] === ".team") {
      term.writeln('');
      term.writeln(`NE-DOS ${window['VERSION']}`);
      term.writeln('');
      term.writeln('Developed by PRO100BYTE Team:');
      term.writeln('Eduard Ilin (edwardcode)');
      term.writeln('Evgeniy Struchkov (thedayg0ne)');
      term.writeln('');
      term.writeln('You can find more information in the GitHub repository:');
      term.writeln('https://github.com/PRO100BYTE/ne-dos or print "ver .github"')
      return;
    }
    if (params[1] === ".github") {
      term.writeln('')
      term.writeln('Opening GitHub Repository...')
      window.open(`https://github.com/PRO100BYTE/ne-dos`, '_blank');
      
      return;
    }
    term.writeln('');
    term.writeln(`NE-DOS ${window['VERSION']}`);
    term.writeln('');
  }
}