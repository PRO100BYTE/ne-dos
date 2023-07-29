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