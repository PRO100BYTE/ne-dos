export default class WaitCommand {
  async execute(term, params, directory, setDirectory) {
    if (!params[1]) {
      term.writeln("Please specify number of milliseconds to wait");
      return;
    }
    let ms = parseInt(params[1]);
    await new Promise((a) => setTimeout(a, ms));
  }

  description() {
    return "Wait N milliseconds";
  }
}