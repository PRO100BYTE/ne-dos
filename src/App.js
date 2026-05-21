import React, {useEffect} from "react";
import styled, {createGlobalStyle} from "styled-components";
import { Terminal as Term } from "xterm";
import "xterm/css/xterm.css"

import {FitAddon} from "xterm-addon-fit";
import dateFormat from "dateformat";
import {registerAllCommands} from "./registration";
import {FormatDirectory, GetDriveRoot} from "./commands/Filesystem/StorageManager";
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
    const setCurrentDirectory = (dir) => {
      currentDirectory = dir;
      window.__nedosCurrentDriveRoot = GetDriveRoot(currentDirectory);
    };
    window.__nedosCurrentDriveRoot = GetDriveRoot(currentDirectory);

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
    const REVERSE = CSI + '7m';
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
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const LOGO = [
      '  ██████╗ ██████╗  ██████╗  ██╗ ██████╗  ██████╗ ██████╗ ██╗   ██╗████████╗███████╗',
      '  ██╔══██╗██╔══██╗██╔═══██╗███║██╔═████╗██╔═████╗██╔══██╗╚██╗ ██╔╝╚══██╔══╝██╔════╝',
      '  ██████╔╝██████╔╝██║   ██║╚██║██║██╔██║██║██╔██║██████╔╝ ╚████╔╝    ██║   █████╗  ',
      '  ██╔═══╝ ██╔══██╗██║   ██║ ██║████╔╝██║████╔╝██║██╔══██╗  ╚██╔╝     ██║   ██╔══╝  ',
      '  ██║     ██║  ██║╚██████╔╝ ██║╚██████╔╝╚██████╔╝██████╔╝   ██║      ██║   ███████╗',
      '  ╚═╝     ╚═╝  ╚═╝ ╚═════╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═════╝   ╚═╝      ╚═╝   ╚══════╝',
      '                                    T E A M',
    ];

    const getBiosSetting = (id, defaultIdx = 0) => {
      const raw = localStorage.getItem('nedos_bios_' + id);
      const parsed = raw !== null ? parseInt(raw, 10) : defaultIdx;
      return Number.isFinite(parsed) ? parsed : defaultIdx;
    };

    const getCpuLabel = () => {
      const idx = getBiosSetting('cpu_speed', 0);
      if (idx === 1) return 'NE-CPU 8086 @ 1337 MHz (Turbo)';
      if (idx === 2) return 'NE-CPU 8086 @ 133 MHz (Safe)';
      return 'NE-CPU 8086 @ 666 MHz';
    };

    const getBootDeviceLabel = () => {
      const idx = getBiosSetting('boot_device', 0);
      if (idx === 1) return 'RAM Disk (/tempfs)';
      if (idx === 2) return 'Network Boot (/netboot)';
      return 'BrowserFS IndexedDB Virtual Drive';
    };

    const getPostDelay = () => {
      const idx = getBiosSetting('bios_delay', 0);
      if (idx === 1) return Math.floor(Math.random() * 80) + 40;      // fast
      if (idx === 2) return Math.floor(Math.random() * 2500) + 1500;   // slow
      return Math.floor(Math.random() * 2900) + 100;                    // random/authentic
    };

    const runMemoryProbe = () => {
      try {
        const mem = new Uint8Array(2 * 1024 * 1024);
        mem[0] = 0xAA;
        mem[mem.length - 1] = 0x55;
        const ok = mem[0] === 0xAA && mem[mem.length - 1] === 0x55;
        return ok;
      } catch {
        return false;
      }
    };

    const buildBiosChecks = () => {
      const memoryTestEnabled = getBiosSetting('memory_test', 0) === 0;
      const memoryOk = memoryTestEnabled ? runMemoryProbe() : false;
      return [
        { label: 'CPU Type',        value: getCpuLabel(),                          ok: true  },
        { label: 'Math Coprocessor',value: 'Detected',                             ok: true  },
        { label: 'Memory Test',     value: memoryTestEnabled ? (memoryOk ? '640 KB OK' : 'FAILED') : 'Skipped by BIOS Setup', ok: memoryTestEnabled ? memoryOk : false },
        { label: 'Extended Memory', value: memoryTestEnabled ? (memoryOk ? '1048576 KB OK' : 'Unavailable') : 'Skipped by BIOS Setup', ok: memoryTestEnabled ? memoryOk : false },
        { label: 'Bus Type',        value: 'ISA/PCI',                              ok: true  },
        { label: 'Display Type',    value: 'xterm-256color CGA/VGA Compatible',    ok: true  },
        { label: 'Primary HDD',     value: getBootDeviceLabel(),                   ok: true  },
        { label: 'Secondary HDD',   value: 'Not detected',                         ok: false },
        { label: 'BrowserFS',       value: 'Mounted at /',                         ok: true  },
        { label: 'Serial Port',     value: 'COM1 - Not available',                 ok: false },
        { label: 'BIOS Version',    value: `PRO100BYTE BIOS v${window['VERSION'] || '1.3.0'} / ${window['BUILD_DATE'] || 'N/A'}`, ok: true },
      ];
    };

    const applyColorScheme = () => {
      const idx = getBiosSetting('color_scheme', 0);
      if (idx === 1) {
        term.options.theme = { background: '#1b1200', foreground: '#ffb347', cursor: '#ffb347' };
      } else if (idx === 2) {
        term.options.theme = { background: '#0a0a0a', foreground: '#e6f1ff', cursor: '#e6f1ff' };
      } else if (idx === 3) {
        term.options.theme = { background: '#002b36', foreground: '#93a1a1', cursor: '#b58900' };
      } else {
        term.options.theme = { background: '#000000', foreground: '#00ff66', cursor: '#00ff66' };
      }
    };

    const clearDirRecursive = (p) => {
      if (!window.fs.existsSync(p)) return;
      window.fs.readdirSync(p).forEach((name) => {
        const child = `${p}/${name}`.replace(/\/+/g, '/');
        const st = window.fs.statSync(child);
        if (st.isDirectory()) {
          clearDirRecursive(child);
          window.fs.rmdirSync(child);
        } else {
          window.fs.unlinkSync(child);
        }
      });
    };

    const randomIp = () => `192.168.1.${Math.floor(Math.random() * 190) + 20}`;
    const randomMac = () => {
      const b = [];
      for (let i = 0; i < 6; i++) b.push(Math.floor(Math.random() * 256).toString(16).padStart(2, '0'));
      return b.join(':');
    };

    const buildNetbootFile = ({ ip, gateway, tftp, mac }) => {
      const serial = Math.floor(Math.random() * 900000 + 100000);
      return [
        '# PXE BOOT LOADER CONFIGURATION',
        '# Generated by NE-BIOS Network Boot',
        `CLIENT_MAC=${mac}`,
        `CLIENT_IP=${ip}`,
        `GATEWAY=${gateway}`,
        `TFTP_SERVER=${tftp}`,
        'BOOT_FILE=pxelinux.0',
        '',
        'DEFAULT ne-dos',
        'PROMPT 0',
        'TIMEOUT 30',
        '',
        'LABEL ne-dos',
        '  KERNEL /boot/vmlinuz-ne',
        '  INITRD /boot/initrd-ne.img',
        `  APPEND root=/dev/nfs nfsroot=${tftp}:/srv/ne-dos rw ip=${ip}::${gateway}:255.255.255.0:ne-dos-${serial}:eth0:dhcp console=tty0 quiet splash`,
        '',
        '# End of file',
      ].join('\n');
    };

    const playPostBeep = () => {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 880;
        gain.gain.value = 0.04;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const now = ctx.currentTime;
        osc.start(now);
        osc.stop(now + 0.09);
        osc.onended = () => {
          try { ctx.close(); } catch {}
        };
      } catch {}
    };

    const applyBootDevice = async (netProfile = null) => {
      const idx = getBiosSetting('boot_device', 0);
      if (idx === 1) {
        // RAM Disk mode: isolated in-memory tempfs, wiped each boot
        if (!window.fs.existsSync('/tempfs')) window.fs.mkdirSync('/tempfs');
        clearDirRecursive('/tempfs');
        setCurrentDirectory('/tempfs');
        return 'RAM Disk ready at /tempfs';
      }
      if (idx === 2) {
        // Network Boot mode: isolated /netboot volume
        if (!window.fs.existsSync('/netboot')) window.fs.mkdirSync('/netboot');
        clearDirRecursive('/netboot');
        const ip = netProfile && netProfile.ip ? netProfile.ip : randomIp();
        const gateway = netProfile && netProfile.gateway ? netProfile.gateway : '192.168.1.1';
        const tftp = netProfile && netProfile.tftp ? netProfile.tftp : '192.168.1.10';
        const mac = netProfile && netProfile.mac ? netProfile.mac : randomMac();
        const bootFile = buildNetbootFile({ ip, gateway, tftp, mac });
        window.fs.writeFileSync('/netboot/remote_boot.txt', bootFile);
        window.fs.writeFileSync('/netboot/dhcp_lease.json', JSON.stringify({ ip, gateway, dns: ['1.1.1.1', '8.8.8.8'], leaseSeconds: 3600, mac }, null, 2));
        window.fs.writeFileSync('/netboot/pxe_args.txt', `BOOTIF=${mac}\nIP=${ip}\nNEXT_SERVER=${tftp}\nBOOTFILE=pxelinux.0\n`);
        setCurrentDirectory('/netboot');
        return 'Network boot image prepared in /netboot';
      }
      setCurrentDirectory('/');
      return 'Booted from BrowserFS /';
    };

    let biosAborted = false;

    // ── BIOS Setup TUI ────────────────────────────────────────────────────────
    const runBiosSetup = (term) => {
      const COLS = term.cols;
      const ROWS = term.rows;
      const SETUP_VERSION = 'PRO100BYTE BIOS SETUP UTILITY v1.0';

      // Settings definitions — each has an id, label, options array, default
      const SETUP_SETTINGS = [
        {
          id: 'boot_device',
          label: 'Boot Device',
          options: ['BrowserFS VDrive', 'RAM Disk', 'Network Boot'],
          defaultIdx: 0,
        },
        {
          id: 'memory_test',
          label: 'Memory Test on Boot',
          options: ['Enabled', 'Disabled'],
          defaultIdx: 0,
        },
        {
          id: 'color_scheme',
          label: 'Terminal Color Scheme',
          options: ['Classic Green', 'Amber', 'Cool White', 'Solarized'],
          defaultIdx: 0,
        },
        {
          id: 'cpu_speed',
          label: 'CPU Speed',
          options: ['Normal (666 MHz)', 'Turbo (1337 MHz)', 'Safe (133 MHz)'],
          defaultIdx: 0,
        },
        {
          id: 'bios_delay',
          label: 'POST Delay Mode',
          options: ['Random  (Authentic)', 'Fast (Skip delays)', 'Slow  (Dramatic)'],
          defaultIdx: 0,
        },
        {
          id: 'boot_sound',
          label: 'Boot Beep',
          options: ['Enabled', 'Disabled'],
          defaultIdx: 1,
        },
      ];

      // Load current values from localStorage
      const values = {};
      SETUP_SETTINGS.forEach(s => {
        const stored = localStorage.getItem('nedos_bios_' + s.id);
        const idx = stored !== null ? parseInt(stored, 10) : s.defaultIdx;
        values[s.id] = Math.max(0, Math.min(s.options.length - 1, idx));
      });

      let cursor = 0;
      let dirty = false;

      const gc = (r, c) => `${CSI}${r};${c}H`;
      const W = Math.min(COLS - 4, 78);
      const leftCol = Math.max(1, Math.floor((COLS - W) / 2));
      const topRow = 2;

      const renderSetup = () => {
        let out = hideCursor() + clearScreen();

        // Header
        out += gc(topRow, leftCol) + BG_BLUE + FG_WHITE + BOLD;
        out += ('  ' + SETUP_VERSION).padEnd(W, ' ') + RESET;
        out += gc(topRow + 1, leftCol) + BG_BLUE + FG_WHITE + '─'.repeat(W) + RESET;

        // Settings rows
        SETUP_SETTINGS.forEach((s, i) => {
          const row = topRow + 2 + i;
          const val = s.options[values[s.id]];
          const label = s.label.padEnd(30, '.');
          const valStr = `[ ${val} ]`;
          const line = `  ${label}  ${valStr}`;
          if (i === cursor) {
            out += gc(row, leftCol) + REVERSE + FG_WHITE + BOLD + line.padEnd(W, ' ') + RESET;
          } else {
            out += gc(row, leftCol) + FG_WHITE + line + RESET;
          }
        });

        // Divider
        const divRow = topRow + 2 + SETUP_SETTINGS.length;
        out += gc(divRow, leftCol) + DIM + FG_WHITE + '─'.repeat(W) + RESET;

        // Help row
        out += gc(divRow + 1, leftCol) + DIM + FG_WHITE;
        out += '  ↑↓:Select   ←→/Enter:Change   F10:Save&Exit   Esc:Discard';
        out = out.padEnd(out.length, ' ');
        out += RESET;

        // Status (if dirty)
        if (dirty) {
          out += gc(divRow + 2, leftCol) + FG_YELLOW + BOLD + '  * Modified — press F10 to save' + RESET;
        }

        term.write(out);
      };

      renderSetup();

      const rebootFromSetup = () => {
        term.write(clearScreen() + hideCursor());
        term.write(goto(Math.max(2, Math.floor(ROWS / 2)), 2) + BOLD + FG_YELLOW + 'Rebooting system...' + RESET);
        setTimeout(() => {
          window.location.reload();
        }, 500);
      };

      const setupDisposable = term.onData((key) => {
        switch (key) {
          // Navigation
          case '\x1b[A': // Up
            cursor = (cursor - 1 + SETUP_SETTINGS.length) % SETUP_SETTINGS.length;
            renderSetup();
            return;
          case '\x1b[B': // Down
            cursor = (cursor + 1) % SETUP_SETTINGS.length;
            renderSetup();
            return;
          case '\x1b[D': // Left — prev option
          case '\x1b[Z': { // Shift+Tab
            const s = SETUP_SETTINGS[cursor];
            values[s.id] = (values[s.id] - 1 + s.options.length) % s.options.length;
            dirty = true;
            renderSetup();
            return;
          }
          case '\x1b[C': // Right — next option
          case '\r': {   // Enter — toggle/next
            const s = SETUP_SETTINGS[cursor];
            values[s.id] = (values[s.id] + 1) % s.options.length;
            dirty = true;
            renderSetup();
            return;
          }
          case '\x1b[21~': // F10 — Save & Exit
          case '\x1b[20~': {
            // Save all settings to localStorage
            SETUP_SETTINGS.forEach(s => {
              localStorage.setItem('nedos_bios_' + s.id, String(values[s.id]));
            });
            setupDisposable.dispose();
            rebootFromSetup();
            return;
          }
          case '\x1b': // Esc — discard & exit
            setupDisposable.dispose();
            rebootFromSetup();
            return;
          default:
            break;
        }
      });
    };

    const runBios = () => new Promise((resolveBios) => {
      term.write(hideCursor() + clearScreen());
      const BIOS_CHECKS = buildBiosChecks();

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

      // Keypress handler — Del or F2 opens Setup, any other key skips BIOS
      const skipDisposable = term.onData((key) => {
        // Del = \x1b[3~ or \x7f, F2 = \x1bOS, \x1b[12~, \x1bOQ, or \x1b[[B
        if (key === '\x1b[3~' || key === '\x7f' || key === '\x1bOS' || key === '\x1b[12~' || key === '\x1bOQ' || key === '\x1b[[B') {
          // Enter BIOS Setup
          biosAborted = true;
          skipDisposable.dispose();
          runBiosSetup(term);
          return;
        }
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
            ' Press any key to continue, or wait...  │  Del / F2 = BIOS Setup'.padEnd(COLS - 2, ' ') + RESET
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
        setTimeout(drawNext, getPostDelay());
      };

      setTimeout(drawNext, 200);
    });

    const startShell = () => {
      applyColorScheme();
      const now = new Date();
      const d = dateFormat(now, 'ddd m-dd-yyyy');
      const t = dateFormat(now, 'HH:MM:ss.L');
      term.write(showCursor() + clearScreen());
      term.writeln(`Current date is ${d}`);
      term.writeln(`Current time is ${t}`);
      term.writeln('');
      term.writeln('');
      term.writeln('The NE-DOS Personal Computer DOS');
      term.writeln(`Version ${window['VERSION']} (C) Copyright PRO100BYTE Team`);
      term.writeln(`Built: ${window['BUILD_DATE']}`);
      term.writeln('');

      if (getBiosSetting('boot_sound', 1) === 0) {
        playPostBeep();
        term.write('\x07');
      }

      prompt(term);
    };

    const runLoading = async () => {
      term.write(hideCursor() + clearScreen());

      const COLS = term.cols;
      const bootIdx = getBiosSetting('boot_device', 0);
      const bootMode = getBootDeviceLabel();
      // ASCII logo (same as BIOS)
      let out = '';
      LOGO.forEach((line, i) => {
        out += goto(3 + i, 1) + BOLD + FG_CYAN + line + RESET + '\r\n';
      });
      out += '\r\n' + goto(11, 1) + BOLD + FG_YELLOW + 'Loading NE-DOS...'.padStart(Math.floor(COLS / 2) + 9, ' ') + RESET + '\r\n';
      out += goto(13, 2) + DIM + FG_WHITE + `Boot device: ${bootMode}` + RESET;
      term.write(out);

      // Random delay 3-5 seconds
      const delay = Math.random() * 2000 + 3000;
      const started = Date.now();

      if (bootIdx === 2) {
        const log = async (row, txt) => {
          term.write(goto(row, 2) + FG_WHITE + txt.padEnd(Math.max(0, COLS - 3), ' ') + RESET);
        };
        const netProfile = {
          ip: randomIp(),
          gateway: '192.168.1.1',
          tftp: '192.168.1.10',
          mac: randomMac(),
        };
        await log(15, 'NETBOOT: Initializing PXE stack...');
        await sleep(350);
        await log(16, 'NETBOOT: Link up on NE-ETH0 [1000Mbps Full Duplex]');
        await sleep(450);
        await log(17, 'DHCP: Discover broadcast 255.255.255.255:67');
        await sleep(500);
        await log(18, `DHCP: Offer received -> IP ${netProfile.ip}, GW ${netProfile.gateway}, DNS 1.1.1.1`);
        await sleep(450);
        await log(19, `DHCP: Lease ACK 3600s, boot-server ${netProfile.tftp}`);
        await sleep(350);
        await log(20, 'PXE: Requesting boot arguments...');
        await sleep(450);
        await log(21, 'PXE: Args received [BOOTIF, NEXT_SERVER, BOOTFILE]');
        await sleep(350);
        await log(22, 'TFTP: Downloading pxelinux.0 and remote_boot.txt ... OK');
        await sleep(350);
        await applyBootDevice(netProfile);
        await log(23, 'NETBOOT: Hand-off to NE-DOS loader complete');
      } else {
        await applyBootDevice();
      }

      const elapsed = Date.now() - started;
      if (elapsed < delay) {
        await sleep(delay - elapsed);
      }
    };

    runBios().then(runLoading).then(startShell);

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

        const cpuMode = getBiosSetting('cpu_speed', 0);
        const commandLatency = cpuMode === 1 ? 0 : (cpuMode === 2 ? 140 : 40);
        if (commandLatency > 0) {
          await new Promise((resolve) => setTimeout(resolve, commandLatency));
        }

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
              await app.execute(term, parts, currentDirectory, setCurrentDirectory);
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
