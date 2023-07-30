export default class AboutmeCommand {
    execute(term, params, directory, setDirectory) {
      let userAgent = navigator.userAgent;
      let browserMatch = userAgent.match(/(Firefox|Edg|Edge|Chrome|Safari|Opera|MSIE|Trident)\/?\s*(\d+)/i);
      let browserName = browserMatch[1];
      let browserVersion = browserMatch[2];
      let osMatch = userAgent.match(/(iOS|iPhone OS|Android|Symbian|Windows|Mac OS X|Linux)/i);
      let osName = osMatch[1];
      let hostname = window.location.hostname;
      term.writeln("User agent: " + userAgent);
      term.writeln("Browser name: " + browserName);
      term.writeln("Browser version: " + browserVersion);
      term.writeln("Operating system: " + osName);
      term.writeln("Hostname: " + hostname);
    }
    
    description() {
      return "Prints information about the user's browser and device";
    }
    
    help(term) {
      term.writeln("Usage: aboutme");
      term.writeln("Prints information about the user's browser and device, such as user agent, browser name and version, operating system, and hostname.");
    }
  }
  