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

    // ── BIOS boot sequence ────────────────────────────────────────────────────
    const CSI = '\x1b[';
    const RESET   = CSI + '0m';
    const BOLD    = CSI + '1m';
    const DIM     = CSI + '2m';
    const FG_WHITE  = CSI + '37m';
    const FG_CYAN   = CSI + '36m';
    const FG_YELLOW = CSI + '33m';
    const FG_GREEN  = CSI + '32m';
    const FG_RED    = CSI + '31m';
    const BG_BLACK  = CSI + '40m';
    const BG_BLUE   = CSI + '44m';
    const goto = (r, c) => `${CSI}${r};${c}H`;
    const clearScreen = () => `${CSI}2J${CSI}H`;
    const hideCursor  = () => `${CSI}?25l`;
    const showCursor  = () => `${CSI}?25h`;

    const LOGO = [
      '  ██████╗ ██████╗  ██████╗  ██╗ ██████╗  ██████╗ ██████╗ ██╗   ██╗████████╗███████╗',
      '  ██╔══██╗██╔══██╗██╔═══██╗███║██╔═████╗██╔═████╗██╔══██╗╚██╗ ██╔╝╚══██╔══╝██╔════╝',
      '  ██████╔╝██████╔╝██║   ██║╚██║██║██╔██║██║██╔██║██████╔╝ ╚████╔╝    ██║   █████╗  ',
      '  ██╔═══╝ ██╔══██╗██║   ██║ ██║████╔╝██║████╔╝██║██╔══██╗  ╚██╔╝     ██║   ██╔══╝  ',
      '  ██║     ██║  ██║╚██████╔╝ ██║╚██████╔╝╚██████╔╝██████╔╝   ██║      ██║   ███████╗',
      '  ╚═╝     ╚═╝  ╚═╝ ╚═════╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═════╝   ╚═╝      ╚═╝   ╚══════╝',
      '                                    T E A M',
    ];

    const BIOS_CHECKS = [
      { label: 'CPU Type',        value: 'NE-CPU 8086 @ 666 MHz',             ok: true  },
      { label: 'Math Coprocessor',value: 'Detected',                          ok: true  },
      { label: 'Memory Test',     value: '640 KB OK',                         ok: true  },
      { label: 'Extended Memory', value: '1048576 KB OK',                     ok: true  },
      { label: 'Bus Type',        value: 'ISA/PCI',                           ok: true  },
      { label: 'Display Type',    value: 'xterm-256color CGA/VGA Compatible', ok: true  },
      { label: 'Primary HDD',     value: 'BrowserFS IndexedDB Virtual Drive', ok: true  },
      { label: 'Secondary HDD',   value: 'Not detected',                      ok: false },
      { label: 'BrowserFS',       value: 'Mounted at /',                      ok: true  },
      { label: 'Serial Port',     value: 'COM1 – Not available',              ok: false },
      { label: 'BIOS Version',    value: `PRO100BYTE BIOS v${window['VERSION'] || '1.3.0'} / ${window['BUILD_DATE'] || 'N/A'}`, ok: true },
    ];

    let biosAborted = false;

    const runBios = () => new Promise((resolveBios) => {
      term.write(hideCursor() + clearScreen());

      // Draw logo (centered, cyan)
      const COLS = term.cols;
      const logoStart = Math.max(1, Math.floor((COLS - 84) / 2));
      let out = '';
      LOGO.forEach((line, i) => {
        out += goto(2 + i, 1) + BOLD + FG_CYAN + line.padEnd(COLS, ' ') + RESET;
      });
      out += goto(9, 1) + DIM + FG_WHITE + '─'.repeat(COLS) + RESET;
      out += goto(10, 2) + BOLD + FG_WHITE + 'NE-BIOS Version 1.0  Copyright (C) PRO100BYTE Team' + RESET;
      out += goto(11, 2) + DIM + FG_WHITE + 'All Rights Reserved.' + RESET;
      out += goto(12, 1) + DIM + FG_WHITE + '─'.repeat(COLS) + RESET;
      term.write(out);

      // Draw checks one by one with delay
      let row = 14;
      let idx = 0;

      // Keypress handler — any key skips BIOS
      const skipDisposable = term.onData(() => {
        biosAborted = true;
        skipDisposable.dispose();
        resolveBios();
      });

      const drawNext = () => {
        if (biosAborted) return;
        if (idx >= BIOS_CHECKS.length) {
          // All checks done — draw bottom bar and wait 1.5s
          term.write(
            goto(row + 1, 1) + DIM + FG_WHITE + '─'.repeat(COLS) + RESET +
            goto(row + 2, 2) + BG_BLUE + FG_WHITE + BOLD +
            ' Press any key to continue, or wait...'.padEnd(COLS - 2, ' ') + RESET
          );
          setTimeout(() => {
            if (!biosAborted) { skipDisposable.dispose(); resolveBios(); }
          }, 1500);
          return;
        }

        const chk = BIOS_CHECKS[idx++];
        const label  = chk.label.padEnd(22, '.');
        const status = chk.ok ? (BOLD + FG_GREEN + '[ OK ]' + RESET) : (DIM + FG_RED + '[SKIP]' + RESET);
        term.write(goto(row++, 2) + FG_WHITE + label + ' ' + status + ' ' + DIM + FG_WHITE + chk.value + RESET);
        setTimeout(drawNext, 60);
      };

      setTimeout(drawNext, 200);
    });

    const date = new Date();
    const d = dateFormat(date, "ddd m-dd-yyyy");
    const t = dateFormat(date, "HH:MM:ss.L");

    const startShell = () => {
      term.write(showCursor() + clearScreen());
      term.writeln(`Current date is ${d}`);
      term.writeln(`Current time is ${t}`);
      term.writeln('');
      term.writeln('');
      term.writeln('The NE-DOS Personal Computer DOS');
      term.writeln(`Version ${window['VERSION']} (C) Copyright PRO100BYTE Team`);
      term.writeln(`Built: ${window['BUILD_DATE']}`);
      term.writeln('');

      prompt(term);
    };

    runBios().then(startShell);

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
          default: {
            if (!parts[0]) break; // empty command — do nothing
            let app = window.registeredCommands[parts[0].toLowerCase()];

            if (app) {
              await app.execute(term, parts, currentDirectory, (e) => currentDirectory = e);
            } else {
              term.writeln(`Bad command`);
            }
            break;
          }
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
