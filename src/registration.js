import VersionCommand from "./commands/ver";
import DirectoryCommand from "./commands/dir";
import ChangeDirectoryCommand from "./commands/cd";
import ClearCommand from "./commands/cls";
import CreditsCommand from "./commands/credits";
import GithubCommand from "./commands/github";
import DateCommand from "./commands/date";
import TimeCommand from "./commands/time";
import WwwCommand from "./commands/www";
import ConfettiCommand from "./commands/confetti";
import EchoCommand from "./commands/echo";
import IpCommand from "./commands/ip";
import GeoIpCommand from "./commands/geoip";
import WaitCommand from "./commands/wait";
import HttpcatCommand from "./commands/httpcat";
import HttpdogCommand from "./commands/httpdog";
import MakeDirectoryCommand from "./commands/mkdir";
import CatCommand from "./commands/cat";
import ECodeAPICommand from "./commands/ecode";

export const registerAllCommands = () => {
  let registeredCommands = {};

  // System commands
  registeredCommands['ver'] = new VersionCommand();
  registeredCommands['cls'] = new ClearCommand();
  registeredCommands['wait'] = new WaitCommand();

  // File system commands
  registeredCommands['dir'] = new DirectoryCommand();
  registeredCommands['cd'] = new ChangeDirectoryCommand();
  registeredCommands['mkdir'] = new MakeDirectoryCommand();
  registeredCommands['type'] = new CatCommand();

  // General commands
  registeredCommands['credits'] = new CreditsCommand();
  registeredCommands['github'] = new GithubCommand();
  registeredCommands['date'] = new DateCommand();
  registeredCommands['time'] = new TimeCommand();
  registeredCommands['www'] = new WwwCommand();
  registeredCommands['confetti'] = new ConfettiCommand();
  registeredCommands['httpcat'] = new HttpcatCommand();
  registeredCommands['httpdog'] = new HttpdogCommand();

  // Utility commands
  registeredCommands['echo'] = new EchoCommand();
  registeredCommands['ip'] = new IpCommand();
  registeredCommands['geoip'] = new GeoIpCommand();

  // ECodeAPI
  registeredCommands['ecode'] = new ECodeAPICommand();

  return registeredCommands;
};