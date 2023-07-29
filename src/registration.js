import VersionCommand from "./commands/ver";
import DirectoryCommand from "./commands/dir";
import ChangeDirectoryCommand from "./commands/cd";
import ClearCommand from "./commands/cls";

export const registerAllCommands = () => {
  let registeredCommands = {};

  // Register commands here
  registeredCommands['ver'] = new VersionCommand();
  registeredCommands['dir'] = new DirectoryCommand();
  registeredCommands['cd'] = new ChangeDirectoryCommand();
  registeredCommands['cls'] = new ClearCommand();

  return registeredCommands;
};