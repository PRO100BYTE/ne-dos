import React, {useEffect} from "react";
import styled, {createGlobalStyle} from "styled-components";
import { Terminal as Term } from "xterm";
import "xterm/css/xterm.css"

import {FitAddon} from "xterm-addon-fit";
import dateFormat from "dateformat";
import {registerAllCommands} from "./registration";
import {FormatDirectory} from "./commands/Filesystem/StorageManager";
import HelpCommand from "./commands/System/help";

const GlobalStyles = createGlobalStyle`
  html, body {
    margin: 0;
    padding: 0;
    background-color: #000;
  }
  
  * {
    box-sizing: border-box;
  }
  
  .xterm-viewport {
    overflow-y: hidden !important;
  }
`;

const Terminal = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  bottom: 0;
`;

function App() {
  // const [ currentDirectory, setCurrentDirectory ] = useState('\\');
  // const [ command, setCommand ] = useState("");

  const terminalRef = React.useRef(null);

  useEffect(() => {
    const term = new Term({ scrollback: 1000 });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();
    // window.onresize = () => fitAddon.fit();

    let currentDirectory = '/';
    let command = '';
    const setCommand = v => command = v;

    const prompt = (term) => {
      setCommand("");
      term.write(`\r\n${FormatDirectory(currentDirectory)}>`);
    }

    term.prompt = () => {
      term.write(`\r\n${FormatDirectory(currentDirectory)}>`);
    };

    const date = new Date();
    const d = dateFormat(date, "ddd m-dd-yyyy");
    const t = dateFormat(date, "HH:MM:ss.L");

    term.writeln(`Current date is ${d}`);
    term.writeln(`Current time is ${t}`);
    term.writeln('');
    term.writeln('');
    term.writeln('The NE-DOS Personal Computer DOS');
    term.writeln(`Version ${window['VERSION']} (C) Copyright PRO100BYTE Team`);
    term.writeln(`Built: ${window['BUILD_DATE']}`);
    term.writeln('');

    prompt(term);

    term.onData(e => {
      switch (e) {
        case '\u0003':
          term.write('^C');
          prompt(term);
          break;
        case '\r':
          // run command
          runCommand();
          break;
        case '\u007F':
          if (command.length > 0) {
            term.write('\b \b');
            setCommand(command.substring(0, command.length - 1));
          }
          break;
        default:
          if ((e >= String.fromCharCode(0x20) && e <= String.fromCharCode(0x7E)) || e >= '\u00a0') {
            let cmd = command;
            cmd += e;
            setCommand(cmd);
            term.write(e);
          }
      }
    });

    window.registeredCommands = registerAllCommands();

    const runCommand = async () => {
      try {
        let parts = command.split(" ");
        term.write('\r\n');

        switch (parts[0]) {
          default:
            let app = window.registeredCommands[parts[0].toLowerCase()];

            if (app) {
              await app.execute(term, parts, currentDirectory, (e) => currentDirectory = e);
            } else {
              term.writeln(`Bad command`);
            }
            break
          case 'help':
          case '?':
            if (parts.length < 2) {
              new HelpCommand().execute(term, window.registeredCommands)
            } else {
              new HelpCommand().fetchHelp(term, window.registeredCommands, parts[1]);
            }
            break
        }
      } catch (e) {
        console.error(e);
        term.writeln(`Command execution finished with exit code 1`);
        term.writeln(e.message);
      }
      prompt(term);
    };
  }, []);

  return (
    <>
      <GlobalStyles />
      <Terminal ref={terminalRef} />
    </>
  );
}

export default App;
