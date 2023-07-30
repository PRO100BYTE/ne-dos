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
import HttpcatCommand from "./commands/cat";

export const registerAllCommands = () => {
  let registeredCommands = {};

    // System commands
    registeredCommands['ver'] = new VersionCommand();
    registeredCommands['cls'] = new ClearCommand();
    registeredCommands['wait'] = new WaitCommand();
  
    // File system commands
    registeredCommands['dir'] = new DirectoryCommand();
    registeredCommands['cd'] = new ChangeDirectoryCommand();

    // General commands
    registeredCommands['credits'] = new CreditsCommand();
    registeredCommands['github'] = new GithubCommand();
    registeredCommands['date'] = new DateCommand();
    registeredCommands['time'] = new TimeCommand();
    registeredCommands['www'] = new WwwCommand();
    registeredCommands['confetti'] = new ConfettiCommand();
    registeredCommands['httpcat'] = new HttpcatCommand();
  
    // Utility commands
    registeredCommands['echo'] = new EchoCommand();
    registeredCommands['ip'] = new IpCommand();
    registeredCommands['geoip'] = new GeoIpCommand();

  return registeredCommands;
};