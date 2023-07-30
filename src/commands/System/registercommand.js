export default class RegisterCmdCommand {
  async execute(term, params, directory, setDirectory) {
    if (!params[1] || params[1] === "") {
      this.help(term);
      return;
    }

    term.writeln("");
    term.writeln("    \x1b[31m                     IMPORTANT!");
    term.writeln("    \x1b[31mWe cannot check all scripts you download from the Internet.");
    term.writeln("    \x1b[31mThis means that the use of third-party scripts may transfer");
    term.writeln("    \x1b[31mto the developer the data stored in the NeDOS repository and");
    term.writeln("    \x1b[31mthe tokens you used to log into accounts on the system.");
    term.writeln("    \x1b[31mIt also means that the author of the script can access your");
    term.writeln("    \x1b[31mbrowser (e.g. camera) if you give permission.");
    term.writeln("    \x1b[31mImport scripts only from sources you trust.\x1b[0m");
    term.writeln("");

    try {
      new URL(params[1]);
    } catch (e) {
      term.writeln("Please use valid URL");
      return;
    }

    let response;
    try {
      response = await fetch(params[1]);
    } catch (e) {
      term.writeln("Failed to fetch script");
      term.writeln(e.message);
      return;
    }
    if (!response.ok) {
      term.writeln("Response not 2xx");
      return;
    }

    const textRaw = await response.text();
    // eslint-disable-next-line no-eval
    const j = eval(textRaw);

    if (!(typeof j === 'object')) {
      term.writeln(`Result of script execution must be object, ${typeof j} given.`);
      return;
    }

    if (!j.cmd || j.cmd === "" || j.cmd.includes(" ")) {
      term.writeln("Incorrect command found in script");
      return;
    }
    if (window.registeredCommands[j.cmd] != null) {
      term.writeln(`Another command ${j.cmd} already registered`);
      return;
    }

    if (!(typeof j.func === 'function')) {
      term.writeln("Command object not a function");
      return;
    }

    const cl = new j.func();

    if (!cl) {
      term.writeln("No execute() function found in command object");
      return;
    }

    window.registeredCommands[j.cmd] = cl;
    term.writeln(`\x1b[32mSuccessfully registered command ${j.cmd}\x1b[0m`);
  }

  description() {
    return "Load and register command from URL";
  }

  help(term) {
    term.writeln("");
    term.writeln("    \x1b[31m                     IMPORTANT!");
    term.writeln("    \x1b[31mWe cannot check all scripts you download from the Internet.");
    term.writeln("    \x1b[31mThis means that the use of third-party scripts may transfer");
    term.writeln("    \x1b[31mto the developer the data stored in the NeDOS repository and");
    term.writeln("    \x1b[31mthe tokens you used to log into accounts on the system.");
    term.writeln("    \x1b[31mIt also means that the author of the script can access your");
    term.writeln("    \x1b[31mbrowser (e.g. camera) if you give permission.");
    term.writeln("    \x1b[31mImport scripts only from sources you trust.\x1b[0m");
    term.writeln("");
    term.writeln("    Usage:");
    term.writeln("        registercommand [url]          register new command from URL given");
  }
}