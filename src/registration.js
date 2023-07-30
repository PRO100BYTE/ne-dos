import VersionCommand from "./commands/ver";
import DirectoryCommand from "./commands/dir";
import ChangeDirectoryCommand from "./commands/cd";
import ClearCommand from "./commands/cls";
import CreditsCommand from "./commands/credits";
import GithubCommand from "./commands/github";
import DateCommand from "./commands/date";
import TimeCommand from "./commands/time";

export const registerAllCommands = () => {
  let registeredCommands = {};

  // Register commands here
  registeredCommands['ver'] = new VersionCommand();
  registeredCommands['dir'] = new DirectoryCommand();
  registeredCommands['cd'] = new ChangeDirectoryCommand();
  registeredCommands['cls'] = new ClearCommand();
  registeredCommands['credits'] = new CreditsCommand();
  registeredCommands['github'] = new GithubCommand();
  registeredCommands['date'] = new DateCommand();
  registeredCommands['time'] = new TimeCommand();

  return registeredCommands;
};