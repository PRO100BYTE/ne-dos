export default class ClearCommand {
  execute(term, params, directory, setDirectory) {
    term.clear();
  }

  description() {
    return "Clear terminal";
  }
}