<h1 align="left">
  <br>
  <a href="https://ne-dos.ru/"><img src="https://raw.githubusercontent.com/PRO100BYTE/ne-dos/master/.github/images/nedos-title.png" alt="NE-DOS" width="500"></a>
</h1>

### С чего начать?
1. Выполните клонирование репозитория: \
   `git clone https://github.com/PRO100BYTE/ne-dos`
2. Установите зависимости: \
   `npm install`
3. Запустите сервер разработки: \
   `npm start`


### Как создать и добавить команду?
Для начала, создайте файл команды в `src/commands`. Это должен быть JavaScript файл. Например: `my-command.js`

Создайте логику своей команды:
```javascript
export default class MyCommand {
  execute(term, params, directory, setDirectory) {
    // здесь создайте логику команды
  }
  
  description() {
    // Краткое описание Вашей команды (для команды help)
    return "";
  }
  
  help(term) {
    // Действия программы при получении помощи
    // Выполняется при 'help your_command'
  }
}
```

И наконец, зарегистрируйте свою команду в файле `src/registration.js`:
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
