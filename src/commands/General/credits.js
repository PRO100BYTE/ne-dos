export default class CreditsCommand {
    execute(term, params, directory, setDirectory) {
        term.writeln('');
        term.writeln('##    ## ########         ########   #######   ######  ');
        term.writeln('###   ## ##               ##     ## ##     ## ##    ## ');
        term.writeln('####  ## ##               ##     ## ##     ## ##       ');
        term.writeln('## ## ## ######   ####### ##     ## ##     ##  ######  ');
        term.writeln('##  #### ##               ##     ## ##     ##       ## ');
        term.writeln('##   ### ##               ##     ## ##     ## ##    ## ');
        term.writeln('##    ## ########         ########   #######   ######  ');                                   
        term.writeln('');
        term.writeln('');
        term.writeln(`NE-DOS ${window['VERSION']}`);
        term.writeln(`Built: ${window['BUILD_DATE']}`);
        term.writeln('');
        term.writeln('Developed by PRO100BYTE Team:');
        term.writeln('- Eduard Ilin (mraliscoder)');
        term.writeln('- Evgeniy Struchkov (thedayg0ne)');
        term.writeln('');
        term.writeln('You can find more information in the GitHub repository:');
        term.writeln('https://github.com/PRO100BYTE/ne-dos or print "github"')
    }

    description() {
        return "Show this project authors";
    }
}