import VersionCommand from "./commands/System/ver";
import DirectoryCommand from "./commands/Filesystem/dir";
import ChangeDirectoryCommand from "./commands/Filesystem/cd";
import ClearCommand from "./commands/System/cls";
import CreditsCommand from "./commands/General/credits";
import GithubCommand from "./commands/General/github";
import DateCommand from "./commands/General/date";
import TimeCommand from "./commands/General/time";
import WwwCommand from "./commands/General/www";
import ConfettiCommand from "./commands/General/confetti";
import EchoCommand from "./commands/Utility/echo";
import IpCommand from "./commands/Utility/ip";
import GeoIpCommand from "./commands/Utility/geoip";
import WaitCommand from "./commands/System/wait";
import HttpcatCommand from "./commands/General/httpcat";
import HttpdogCommand from "./commands/General/httpdog";
import MakeDirectoryCommand from "./commands/Filesystem/mkdir";
import CatCommand from "./commands/Filesystem/cat";
import ECodeAPICommand from "./commands/ECodeAPI/ecode";
import GeoCommand from "./commands/Utility/geo";
import RegisterCmdCommand from "./commands/System/registercommand";
import CommandCOMCommand from "./commands/System/command";
import DeleteCommand from "./commands/Filesystem/rm";
import DeleteDirectoryCommand from "./commands/Filesystem/rmdir";
import WeatherCommand from "./commands/Utility/weather";
import StatusCommand from "./commands/System/status";
import AboutmeCommand from "./commands/Utility/aboutme";
import DownloadCommand from "./commands/Filesystem/download";
import UploadCommand from "./commands/Filesystem/upload";
import MatrixCommand from "./commands/General/matrix";
import RebootCommand from "./commands/System/reboot";
import Base64Command from "./commands/Utility/base64";

export const registerAllCommands = () => {
  let registeredCommands = {};

  // System commands
  registeredCommands['ver'] = new VersionCommand();
  registeredCommands['cls'] = new ClearCommand();
  registeredCommands['wait'] = new WaitCommand();
  registeredCommands['registercommand'] = new RegisterCmdCommand();
  registeredCommands['command'] = new CommandCOMCommand();
  registeredCommands['status'] = new StatusCommand();
  registeredCommands['reboot'] = new RebootCommand();

  // Filesystem commands
  registeredCommands['dir'] = new DirectoryCommand();
  registeredCommands['cd'] = new ChangeDirectoryCommand();
  registeredCommands['mkdir'] = new MakeDirectoryCommand();
  registeredCommands['type'] = new CatCommand();
  registeredCommands['del'] = new DeleteCommand();
  registeredCommands['rmdir'] = new DeleteDirectoryCommand();
  registeredCommands['download'] = new DownloadCommand();
  registeredCommands['upload'] = new UploadCommand();

  // General commands
  registeredCommands['credits'] = new CreditsCommand();
  registeredCommands['github'] = new GithubCommand();
  registeredCommands['date'] = new DateCommand();
  registeredCommands['time'] = new TimeCommand();
  registeredCommands['www'] = new WwwCommand();
  registeredCommands['confetti'] = new ConfettiCommand();
  registeredCommands['httpcat'] = new HttpcatCommand();
  registeredCommands['httpdog'] = new HttpdogCommand();
  registeredCommands['matrix'] = new MatrixCommand();

  // Utility commands
  registeredCommands['echo'] = new EchoCommand();
  registeredCommands['ip'] = new IpCommand();
  registeredCommands['geoip'] = new GeoIpCommand();
  registeredCommands['geo'] = new GeoCommand();
  registeredCommands['aboutme'] = new AboutmeCommand();
  registeredCommands['weather'] = new WeatherCommand();
  registeredCommands['base64'] = new Base64Command();

  // ECodeAPI
  registeredCommands['ecode'] = new ECodeAPICommand();

  return registeredCommands;
};