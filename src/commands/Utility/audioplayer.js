import { Howl } from "howler";

export default class AudioplayerCommand {
  execute(term, params, directory, setDirectory) {
    if (params.length === 1) {
      this.help(term);
    } else {
      const audioFile = params[1];
      const audioExt = audioFile.split(".").pop();
      if (audioExt === "mp3" || audioExt === "ogg" || audioExt === "wav") {
        const filePath = "/" + directory + "/" + audioFile;
        if (window.fs.existsSync(filePath)) {
          const fileData = window.fs.readFileSync(filePath);
          window.player = new Howl({
            src: [fileData],
            format: [audioExt],
            html5: true
          });
          window.player.play();
          term.writeln("Playing file " + audioFile);
        } else {
          term.writeln("File " + audioFile + " not found");
        }
      } else {
        term.writeln("Invalid file format. Only .mp3, .ogg and .wav are supported");
      }
    }
  }

  description() {
    return "Playing audio files";
  }

  help(term) {
    term.writeln("The audioplayer command allows you to play audio files");
    term.writeln("Syntax: audioplayer <file>");
    term.writeln("Where <file> is the name of an audio file with the extension mp3, ogg or wav");
    term.writeln("Example: audioplayer song.mp3");
  }
}

function handlePlayerCommand(term, command) {
  if (window.player) {
    switch (command) {
      case "pause":
        window.player.pause();
        term.writeln("Playback paused");
        break;
      case "play":
        window.player.play();
        term.writeln("Playback resumed");
        break;
      case "stop":
        window.player.stop();
        term.writeln("Playback stopped");
        break;
      default:
        term.writeln("Invalid command for the player. Available commands: pause, play, stop");
    }
  } else {
    term.writeln("The player is not running. To start the player, use the audioplayer <file> command");
  }
}

export { handlePlayerCommand };

