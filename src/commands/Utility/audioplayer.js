// #TheDayG0ne: Если бы это говно еще работало...
import { Howl, Howler } from 'howler';

export default class AudioplayerCommand {
  constructor() {
    this.playlist = [];
    this.index = 0;
    this.sound = null;
    this.repeat = false;
  }

  // Метод для выполнения команды
  execute(term, params, directory, setDirectory) {
    
    if (params.length === 0) {
      this.help(term);
    } else {
      if (params[1].endsWith('.mp3') || params[1].endsWith('.ogg') || params[1].endsWith('.wav')) {
        this.playlist.push(params[1]);
        term.writeln(`Added ${params[1]} file to playlist`);
        if (this.playlist.length === 1) {
          this.play(term);
        }
      } else {
        switch (params[1]) {
          case 'play':
            this.play(term);
            break;
          case 'pause':
            this.pause(term);
            break;
          case 'stop':
            this.stop(term);
            break;
          case 'prev':
            this.prev(term);
            break;
          case 'next':
            this.next(term);
            break;
          case 'exit':
            this.exit(term);
            break;
          case 'repeat':
            this.repeat = !this.repeat;
            term.writeln(`Repeat mode: ${this.repeat ? 'enabled' : 'disabled'}`);
            break;
          case 'help':
            this.help(term);
            break;
          default:
            term.writeln(`Invalid command: ${params[0]}`);
        }
      }
    }
  }

  // Метод для получения краткого описания команды (для команды help)
  description() {
    return "Program for playing audio files";
  }

  // Метод для вывода справки по программе
  help(term) {
    term.writeln("Usage: audioplayer [file | command]");
    term.writeln("File - audio file in mp3, ogg or wav format");
    term.writeln("The command is one of the following:");
    term.writeln(" play - start playing the current file");
    term.writeln(" pause - pause the playback of the current file");
    term.writeln(" stop - stop playing the current file");
    term.writeln(" prev - go to the previous file in the playlist");
    term.writeln(" next - go to the next file in the playlist");
    term.writeln(" exit - exit the program and clear the playlist");
    term.writeln(" repeat - toggle repeat mode");
    term.writeln(" help - print this help");
  }

  // Метод для запуска проигрывания текущего файла
  play(term) {
    if (this.playlist.length > 0) {
      if (this.sound) {
        this.sound.play();
      } else {
        this.sound = new Howl({
          src: [this.playlist[this.index]],
          onend: () => {
            if (this.repeat) {
              this.play(term);
            } else {
              this.next(term);
            }
          }
        });
        this.sound.play();
      }
      term.writeln(`Playing file ${this.playlist[this.index]}`);
      term.writeln(this.interface());
    } else {
      term.writeln("The playlist is empty");
    }
  }

  // Метод для приостановки проигрывания текущего файла
  pause(term) {
    if (this.sound) {
      this.sound.pause();
      term.writeln(`Paused file ${this.playlist[this.index]}`);
      term.writeln(this.interface());
    } else {
      term.writeln("There is no current file");
    }
  }

  // Метод для остановки проигрывания текущего файла и сброса индекса плейлиста
  stop(term) {
    if (this.sound) {
      this.sound.stop();
      this.sound.unload();
      this.sound = null;
      this.index = 0;
      term.writeln(`Stopped file ${this.playlist[this.index]}`);
      term.writeln(this.interface());
    } else {
      term.writeln("There is no current file");
    }
  }

  // Метод для перехода к предыдущему файлу в плейлисте и его проигрывания
  prev(term) {
    if (this.playlist.length > 0) {
      this.index = (this.index - 1 + this.playlist.length) % this
      .playlist.length;
      if (this.sound) {
        this.sound.stop();
        this.sound.unload();
        this.sound = null;
      }
      this.play(term);
    } else {
      term.writeln("The playlist is empty");
    }
  }

  // Метод для перехода к следующему файлу в плейлисте и его проигрывания
  next(term) {
    if (this.playlist.length > 0) {
      this.index = (this.index + 1) % this.playlist.length;
      if (this.sound) {
        this.sound.stop();
        this.sound.unload();
        this.sound = null;
      }
      this.play(term);
    } else {
      term.writeln("The playlist is empty");
    }
  }

  // Метод для выхода из программы и очистки плейлиста
  exit(term) {
    if (this.sound) {
      this.sound.stop();
      this.sound.unload();
      this.sound = null;
    }
    this.playlist = [];
    term.writeln("Shutting down the AudioPlayer...");
  }

  // Метод для создания интерфейса программы в виде псевдографики
interface() {
    let interfaceString = "";
    interfaceString += "+-----------------+\n";
    interfaceString += `| AudioPlayer     |\n`;
    interfaceString += `| ${this.playlist[this.index]} |\n`;
    interfaceString += "+-----------------+\n";
    interfaceString += "| play | pause | stop |\n";
    interfaceString += "| prev | next  | exit |\n";
    interfaceString += "| repeat | help |\n";
    return interfaceString;
  }
  
}
