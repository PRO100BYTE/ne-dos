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

    // TUI apps call term._setAppMode(true) to suppress the shell input handler
    let appMode = false;
    term._setAppMode = (val) => { appMode = val; };

    let currentDirectory = '/';
    let command = '';
    const setCommand = v => command = v;

    // Command history
    const history = [];
    let historyIndex = -1;
    let savedInput = '';

    const prompt = (term) => {
      setCommand("");
      historyIndex = -1;
      savedInput = '';
      term.write(`\r\n${FormatDirectory(currentDirectory)}>`);
    }

    // TUI apps call term.prompt() to restore the shell prompt after exiting
    term.prompt = () => prompt(term);

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

    // Helper: replace current command line on terminal
    const replaceCurrentInput = (newValue) => {
      // Erase current input: move cursor back and clear to end of line
      term.write('\r\x1b[K');
      term.write(`${FormatDirectory(currentDirectory)}>${newValue}`);
      setCommand(newValue);
    };

    term.onData(e => {
      if (appMode) return; // TUI application is handling input
      switch (e) {
        case '\u0003': // Ctrl+C
          term.write('^C');
          prompt(term);
          break;
        case '\r': // Enter
          runCommand();
          break;
        case '\u007F': // Backspace
          if (command.length > 0) {
            term.write('\b \b');
            setCommand(command.substring(0, command.length - 1));
          }
          break;
        case '\x1b[A': // Arrow Up — history backward
          if (history.length === 0) break;
          if (historyIndex === -1) {
            savedInput = command;
            historyIndex = history.length - 1;
          } else if (historyIndex > 0) {
            historyIndex--;
          }
          replaceCurrentInput(history[historyIndex]);
          break;
        case '\x1b[B': // Arrow Down — history forward
          if (historyIndex === -1) break;
          if (historyIndex < history.length - 1) {
            historyIndex++;
            replaceCurrentInput(history[historyIndex]);
          } else {
            historyIndex = -1;
            replaceCurrentInput(savedInput);
          }
          break;
        case '\x1b[C': // Arrow Right — ignore
        case '\x1b[D': // Arrow Left — ignore
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

        // Save non-empty commands to history (skip duplicate of last entry)
        const trimmed = command.trim();
        if (trimmed && (history.length === 0 || history[history.length - 1] !== trimmed)) {
          history.push(trimmed);
        }

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
