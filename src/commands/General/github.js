export default class GithubCommand {
    execute(term, params, directory, setDirectory) {
        term.writeln('')
        term.writeln('Opening GitHub Repository...')
        window.open(`https://github.com/PRO100BYTE/ne-dos`, '_blank');
    }

    description() {
        return "Open project's github repository";
    }
}