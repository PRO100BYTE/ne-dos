// Import the Howler.js library for working with audio
import Howl from 'howler';

// Import the StorageManager for formatting and preparing directories
import { FormatDirectory, PrepareInternal } from '../Filesystem/StorageManager';
import path from 'path-browserify'

// Create the AudioplayerCommand class
export default class AudioplayerCommand {
  // Constructor of the class
  constructor() {
    // Create an array to store the playlist
    this.playlist = [];
    // Create a variable to store the current index of the playlist
    this.index = 0;
    // Create a variable to store the current audio
    this.sound = null;
    // Create a variable to store the repeat mode
    this.repeat = false;
  }

  // Method to execute the command
execute(term, params, directory, setDirectory) {
    // Check if there are parameters
    if (params.length === 0) {
      // If not, display the help message for using the program
      this.help(term);
    } else {
      // If yes, check if the second parameter is an audio file
      if (params[1].endsWith('.mp3') || params[1].endsWith('.ogg') || params[1].endsWith('.wav')) {
        // If yes, check if the file exists in the current directory
        // Import the path module to resolve the file path
        const path = require('path');
        const filename = path.resolve(directory, params[1]);
        const fileExists = window.fs.existsSync(filename);
        if (fileExists) {
          // If yes, add it to the playlist
          this.playlist.push(params[1]);
          // Display a message about adding the file to the playlist
          term.writeln(`Added ${params[1]} file to playlist`);
          // If the playlist contains only one file, start playing it
          if (this.playlist.length === 1) {
            this.play(term);
          }
        } else {
          // If not, display an error message
          term.writeln(`File ${params[1]} not found`);
        }
      } else {
        // If not, check if the second parameter is a control command
        switch (params[1]) {
          case 'play':
            // If the command is play, start playing the current file
            this.play(term);
            break;
          case 'pause':
            // If the command is pause, pause playing the current file
            this.pause(term);
            break;
          case 'stop':
            // If the command is stop, stop playing the current file and reset the playlist index
            this.stop(term);
            break;
          case 'prev':
            // If the command is prev, go to the previous file in the playlist and start playing it
            this.prev(term);
            break;
          case 'next':
            // If the command is next, go to the next file in the playlist and start playing it
            this.next(term);
            break;
          case 'exit':
            // If the command is exit, exit from the program and clear the playlist
            this.exit(term);
            break;
          case 'repeat':
            // If the command is repeat, toggle the repeat mode and display its state
            this.repeat = !this.repeat;
            term.writeln(`Repeat mode: ${this.repeat ? 'on' : 'off'}`);
            break;
          case 'help':
            // If the command is help, display the help message for using the program
            this.help(term);
            break;
          default:
            // If an unknown command, display an error message
            term.writeln(`Invalid command: ${params[1]}`);
        }
      }
    }
  }
  

  // Method to get a brief description of the command (for the help command)
  description() {
    return "A program for playing audio files";
  }

  // Method to display the help message for using the program
  help(term) {
    term.writeln("Usage: audioplayer [file | command]");
    term.writeln("File - an audio file in mp3, ogg or wav format");
    term.writeln("Command - one of the following:");
    term.writeln("  play - start playing the current file");
    term.writeln("  pause - pause playing the current file");
    term.writeln("  stop - stop playing the current file");
    term.writeln("  prev - go to the previous file in the playlist");
    term.writeln("  next - go to the next file in the playlist");
    term.writeln("  exit - exit from the program and clear the playlist");
    term.writeln("  repeat - toggle repeat mode");
    term.writeln("  help - display this help message");
  }

  // Method to start playing the current file
  play(term) {
    // Check if there are files in the playlist
    if (this.playlist.length > 0) {
      // If yes, check if there is a current audio
      if (this.sound) {
        // If yes, resume playing it
        this.sound.play();
      } else {
        // If not, create a new audio from the file by the current index of the playlist
        this.sound = new Howl({
          src: [this.playlist[this.index]],
          // Set the handler for the end of playback event
          onend: () => {
            // Check if the repeat mode is on
            if (this.repeat) {
              // If yes, start playing again
              this.play(term);
            } else {
              // If not, go to the next file in the playlist
              this.next(term);
            }
          }
        });
        // Start playing the audio
        this.sound.play();
      }
      // Display a message about playing the file and the interface of the program
      term.writeln(`Playing file ${this.playlist[this.index]}`);
      term.writeln(this.interface());
      // Replace the prompt with a string for entering commands for the player
      term.set_prompt("audioplayer> ");
    } else {
      // If not, display an error message
      term.writeln("Playlist is empty");
    }
  }

  // Method to pause playing the current file
  pause(term) {
    // Check if there is a current audio
    if (this.sound) {
      // If yes, pause playing it
      this.sound.pause();
      // Display a message about pausing the file and the interface of the program
      term.writeln(`Paused file ${this.playlist[this.index]}`);
      term.writeln(this.interface());
    } else {
      // If not, display an error message
      term.writeln("No current file");
    }
  }

  // Method to stop playing the current file and reset the playlist index
  stop(term) {
    // Check if there is a current audio
    if (this.sound) {
      // If yes, stop playing it and destroy it
      this.sound.stop();
      this.sound.unload();
      this.sound = null;
      // Reset the playlist index to zero
      this.index = 0;
      // Display a message about stopping the file and the interface of the program
      term.writeln(`Stopped file ${this.playlist[this.index]}`);
      term.writeln(this.interface());
    } else {
      // If not, display an error message
      term.writeln("No current file");
    }
  }

  // Method to go to the previous file in the playlist and play it
  prev(term) {
    // Check if there are files in the playlist
    if (this.playlist.length > 0) {
      // If yes, decrease the playlist index by one with cyclicality
      this.index = (this.index - 1 + this.playlist.length) % this.playlist.length;
      // Check if there is a current audio
      if (this.sound) {
        // If yes, stop playing it and destroy it
        this.sound.stop();
        this.sound.unload();
        this.sound = null;
      }
      // Start playing the file by the new index of the playlist
      this.play(term);
    } else {
      // If not, display an error message
      term.writeln("Playlist is empty");
    }
  }

  // Method to go to the next file in the playlist and play it
  next(term) {
    // Check if there are files in the playlist
    if (this.playlist.length > 0) {
      // If yes, increase the playlist index by one with cyclicality
      this.index = (this.index + 1) % this.playlist.length;
      // Check if there is a current audio
      if (this.sound) {
        // If yes, stop playing it and destroy it
        this.sound.stop();
        this.sound.unload();
        this.sound = null;
      }
      // Start playing the file by the new index of the playlist
      this.play(term);
    } else {
      // If not, display an error message
      term.writeln("Playlist is empty");
    }
  }

  // Method to exit from the program and clear the playlist
  exit(term) {
    // Check if there is a current audio
    if (this.sound) {
      // If yes, stop playing it and destroy it
      this.sound.stop();
      this.sound.unload();
      this.sound = null;
    }
    // Clear the playlist
    this.playlist = [];
    // Display a message about exiting from the program
    term.writeln("You exited from the audioplayer program");
    // Restore the original prompt
    term.set_prompt("C:\\>");
  }

  // Method to create the interface of the program in pseudographics
  interface() {
    // Create a variable to store the interface as a string
    // Rename the variable from interface to interfaceString to avoid conflict with the TypeScript keyword
    let interfaceString = "";
    // Add a blank line
    interfaceString += "\r\n";
    // Add the top border of the interface
    interfaceString += "+=============================================+\r\n";
    // Add the name of the program and the current file in the playlist
    interfaceString += `|                 AudioPlayer                 |\r\n`;
    interfaceString += "+=============================================+\r\n";
    interfaceString +=  `    Now playing: ${this.playlist[this.index]}\r\n`;
    // Add the bottom border of the interface
    interfaceString += "+=============================================+\r\n";
    // Add the control commands for the player
    interfaceString += "|    play    |     pause     |      stop      |\r\n";
    interfaceString += "+---------------------------------------------+\r\n";
    interfaceString += "|    prev    |      next     |      exit      |\r\n";
    interfaceString += "+---------------------------------------------+\r\n";
    interfaceString += "|        repeat        |         help         |\r\n";
    interfaceString += "+=============================================+\r\n";
    // Add a blank line
    interfaceString += "\r\n";
    // Add a message about how to enter commands for the player
    interfaceString += "Player control: audioplayer <command>\r\n";
    // Return the interface as a string
    return interfaceString;
  }
}

