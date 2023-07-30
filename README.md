# NE-DOS


### How to start?
1. Clone this repository: \
   `git clone https://github.com/PRO100BYTE/ne-dos`
2. Install dependencies: \
   `npm install`
3. Run development server: \
   `npm start`


### How to create command?
At first, create command file in `src/commands`. It has to be JavaScript file. For example, `my-command.js` \
Create your command logic:
```javascript
export default class MyCommand {
  execute(term, params, directory, setDirectory) {
    // create your logic here
  }
}
```

Finally, register command in `src/registration.js`:
```javascript
// ...
registeredCommands['mycmd'] = new MyCommand();
// ...
```

#### ECode APIs
Если необходимо реализовать работу с использованием ecode apis (lk.edwardcode.ru)

Токен можно найти в `/.config/ecode.token` (`C:\.config\ecode.token`)
```javascript
if (!window.fs.existsSync("/.config/ecode.token")) {
  term.writeln("  \x1b[33;1mNo API key found\x1b[0m");
  term.writeln("  Please sign in first: ecode auth [token]");
  return;
}

const token = window.fs.readFileSync("/.config/ecode.token", "utf8");
```

Также всю работу с токенами/сохраняемыми объектами лучше делать в папке `/.config`

### Файловая система
Реализована с помощью BrowserFS с использованием localstorage в качестве хранилища

`window.fs` - пакет для работы с файловой системой, аналог обычному fs