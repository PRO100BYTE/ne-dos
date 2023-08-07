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

### Кастомные внешние команды
С использованием `registercommand [URL]` можно временно регистрировать команды,
исполняемые файлы которых расположены на другом сервере.

Сам файл должен быть анонимной функцией, возвращающей объект с параметрами `cmd` и `func`

Например:
```javascript
(() => {
  return {
    cmd: "test",
    func: class TestCommand {
      execute(term, args, dir, setDir) {
        term.writeln("Command test registered! It works!")
      }
      description() {
        return "Example third-party command";
      }
      help(term) {
        term.writeln("help() of custom command!")
      }
    }
  }
})();
```

**ВАЖНО!** Сервер с JS-файлом должен отдавать заголовок `Access-Control-Allow-Origin` равный `https://ne-dos.ru` или `*`

___Приветствуется___ помощь в создании маркетплейса таких кастомных команд. Маркетплейс должен быть доступен на GitHub (быть опенсурсом) и работать на основе XorekID в качестве системы аккаунтов. 

Для получения более подробной информации вы можете связаться с разработчиками в Telegram: [@dpudnet](https://t.me/dpudnet) и [@thedayg0ne](https://t.me/thedayg0ne)
