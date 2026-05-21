/**
 * js - JavaScript interpreter / REPL
 *
 * Analogous to a .bat / .exe runner but for JS scripts stored in BrowserFS.
 *
 * Usage:
 *   js                      - interactive REPL
 *   js script.js            - run a script file
 *   js -e "code"            - evaluate inline code snippet
 *
 * Sandbox API available to scripts:
 *   print(...)              - write line to terminal
 *   write(str)              - write without newline
 *   input(prompt)           - async readline (returns Promise<string>)
 *   fs                      - window.fs (BrowserFS)
 *   path                    - window.path (path-browserify)
 *   env                     - window.__nedosEnv
 *   args                    - array of extra CLI tokens
 *   exit(code)              - stop execution
 *   sleep(ms)               - async delay
 *   readFile(p)             - utf8 read helper
 *   writeFile(p, data)      - utf8 write helper
 *   listDir(p)              - returns array of entry names
 */

import { PrepareInternal } from '../Filesystem/StorageManager';

const CSI = '\x1b[';
const R = `${CSI}0m`;
const Bold = `${CSI}1m`;
const FgCyan = `${CSI}36m`;
const FgYellow = `${CSI}33m`;
const FgRed = `${CSI}31m`;
const FgGreen = `${CSI}32m`;
const FgGrey = `${CSI}90m`;

const PROMPT_REPL = `${FgGreen}js>${R} `;

export default class JsCommand {
  description() { return 'JavaScript interpreter / REPL'; }

  help(term) {
    term.writeln('Usage:');
    term.writeln('  js                  Interactive REPL');
    term.writeln('  js script.js [args] Run a script file');
    term.writeln('  js -e "code"        Evaluate inline code');
    term.writeln('Script API: print(), write(), input(), fs, path, env, args, exit(), sleep(), readFile(), writeFile(), listDir()');
  }

  execute(term, params, currentDirectory) {
    return new Promise((resolve) => {
      const parts = (params || '').trim().split(/\s+/).filter(Boolean);

      const makeCtx = (overrideExit) => {
        let exitTriggered = false;
        const exitFn = (code) => {
          exitTriggered = true;
          if (overrideExit) overrideExit(code);
        };

        const ctx = {
          print: (...args) => term.write(args.map(a => String(a)).join(' ') + '\r\n'),
          write: (...args) => term.write(args.map(a => String(a)).join('')),
          input: (prompt = '') => {
            term.write(prompt);
            return new Promise(res => {
              let buf = '';
              const d = term.onData(data => {
                if (data === '\r' || data === '\n') {
                  d.dispose();
                  term.write('\r\n');
                  res(buf);
                } else if (data === '\x7f' || data === '\b') {
                  if (buf.length > 0) { buf = buf.slice(0, -1); term.write('\b \b'); }
                } else if (data.charCodeAt(0) >= 32) {
                  buf += data;
                  term.write(data);
                }
              });
            });
          },
          sleep: (ms) => new Promise(r => setTimeout(r, ms)),
          exit: exitFn,
          fs: window.fs,
          path: window.path,
          env: window.__nedosEnv || {},
          args: [],
          readFile: (p) => {
            const abs = PrepareInternal(p, currentDirectory);
            return window.fs.readFileSync(abs, 'utf8');
          },
          writeFile: (p, data) => {
            const abs = PrepareInternal(p, currentDirectory);
            window.fs.writeFileSync(abs, data);
          },
          listDir: (p) => {
            const abs = PrepareInternal(p || '.', currentDirectory);
            return window.fs.readdirSync(abs);
          },
          console: {
            log: (...args) => term.write(args.map(a => {
              try { return JSON.stringify(a); } catch { return String(a); }
            }).join(' ') + '\r\n'),
            error: (...args) => term.write(`${FgRed}` + args.map(a => String(a)).join(' ') + `${R}\r\n`),
            warn: (...args) => term.write(`${FgYellow}` + args.map(a => String(a)).join(' ') + `${R}\r\n`),
          },
        };
        return { ctx, isExited: () => exitTriggered };
      };

      // Build an async function body from user code using the context vars
      const execCode = async (code, ctx) => {
        const ctxKeys = Object.keys(ctx);
        const ctxVals = ctxKeys.map(k => ctx[k]);
        try {
          // Wrap code in async IIFE accessible to context
          const fn = new Function(...ctxKeys, `"use strict"; return (async () => { ${code} })()`);
          await fn(...ctxVals);
        } catch (e) {
          if (e.message === '_nedos_exit_') return;
          term.write(`${FgRed}${e.constructor.name}: ${e.message}${R}\r\n`);
        }
      };

      // ── Mode: -e "inline code" ─────────────────────────────────────────────
      if (parts[0] === '-e') {
        const code = parts.slice(1).join(' ');
        const { ctx } = makeCtx(null);
        execCode(code, ctx).then(resolve);
        return;
      }

      // ── Mode: run script file ──────────────────────────────────────────────
      if (parts.length > 0 && !parts[0].startsWith('-')) {
        const filePath = PrepareInternal(parts[0], currentDirectory);
        const scriptArgs = parts.slice(1);
        let code;
        try {
          if (!window.fs.existsSync(filePath)) {
            term.write(`${FgRed}File not found: ${parts[0]}${R}\r\n`);
            resolve(); return;
          }
          code = window.fs.readFileSync(filePath, 'utf8');
        } catch (e) {
          term.write(`${FgRed}${e.message}${R}\r\n`);
          resolve(); return;
        }
        let exitResolve = null;
        const { ctx } = makeCtx((code) => { if (exitResolve) exitResolve(code); });
        ctx.args = scriptArgs;
        const p = new Promise(r => { exitResolve = r; });
        term.write(`${FgGrey}Running: ${parts[0]}${R}\r\n`);
        execCode(code, ctx).then(() => resolve()).catch(() => resolve());
        p.then(() => resolve());
        return;
      }

      // ── Mode: interactive REPL ─────────────────────────────────────────────
      term.write(`${Bold}${FgCyan}NE-DOS JS REPL${R}  Type ${FgYellow}.help${R} or ${FgYellow}.exit${R}\r\n`);
      term.write(PROMPT_REPL);

      let line = '';
      let cursorPos = 0;
      const history = [];
      let histIdx = -1;
      let multiLine = '';
      let inMulti = false;

      // Persistent context across REPL evaluations
      const { ctx } = makeCtx(() => {
        dispose.dispose();
        term.write('\r\n');
        resolve();
      });

      const evalAndPrint = async (code) => {
        const fullCode = multiLine + code;
        multiLine = '';
        inMulti = false;
        const ctxKeys = Object.keys(ctx);
        const ctxVals = ctxKeys.map(k => ctx[k]);
        try {
          const fn = new Function(...ctxKeys, `"use strict"; return (async () => { try { return (${fullCode}); } catch(_e1) { ${fullCode} } })()`);
          const result = await fn(...ctxVals);
          if (result !== undefined) {
            let out;
            try { out = JSON.stringify(result, null, 2); } catch { out = String(result); }
            term.write(`${FgGrey}<< ${FgGreen}${out}${R}\r\n`);
          }
        } catch (e) {
          // Check if it's incomplete (multi-line)
          if (e instanceof SyntaxError && /(unexpected end|unexpected token)/i.test(e.message)) {
            multiLine = fullCode + '\n';
            inMulti = true;
          } else {
            term.write(`${FgRed}${e.constructor.name}: ${e.message}${R}\r\n`);
          }
        }
      };

      const dispose = term.onData(async (data) => {
        if (data === '\r' || data === '\n') {
          term.write('\r\n');
          const cmd = line;
          history.unshift(cmd);
          histIdx = -1;
          line = ''; cursorPos = 0;

          if (cmd.trim() === '.exit' || cmd.trim() === '.quit') {
            dispose.dispose();
            resolve(); return;
          }
          if (cmd.trim() === '.help') {
            term.write([
              `${Bold}${FgCyan}JS REPL Commands:${R}`,
              `  ${FgYellow}.exit${R}          Exit REPL`,
              `  ${FgYellow}.clear${R}         Clear screen`,
              `  ${FgYellow}.vars${R}          List user variables`,
              `  ${FgYellow}.load <file>${R}   Load and run a script`,
              `  Multi-line: lines ending with \\ continue to next`,
              '',
            ].join('\r\n'));
            term.write(PROMPT_REPL); return;
          }
          if (cmd.trim() === '.clear') { term.write(`${CSI}2J${CSI}H`); term.write(PROMPT_REPL); return; }
          if (cmd.startsWith('.load ')) {
            const fp = PrepareInternal(cmd.slice(6).trim(), currentDirectory);
            try {
              const src = window.fs.readFileSync(fp, 'utf8');
              await evalAndPrint(src);
            } catch (e) {
              term.write(`${FgRed}${e.message}${R}\r\n`);
            }
            term.write(inMulti ? `${FgGrey}...${R} ` : PROMPT_REPL); return;
          }

          if (cmd.endsWith('\\')) {
            multiLine += cmd.slice(0, -1) + '\n';
            inMulti = true;
            term.write(`${FgGrey}...${R} `); return;
          }

          if (cmd.trim()) await evalAndPrint(cmd);
          term.write(inMulti ? `${FgGrey}...${R} ` : PROMPT_REPL);
          return;
        }

        if (data === '\x1b[A') { // Up
          if (histIdx < history.length - 1) {
            histIdx++;
            line = history[histIdx]; cursorPos = line.length;
            term.write('\r' + CSI + 'K' + PROMPT_REPL + line);
          }
          return;
        }
        if (data === '\x1b[B') { // Down
          if (histIdx > 0) { histIdx--; line = history[histIdx]; }
          else { histIdx = -1; line = ''; }
          cursorPos = line.length;
          term.write('\r' + CSI + 'K' + PROMPT_REPL + line);
          return;
        }
        if (data === '\x7f' || data === '\b') {
          if (cursorPos > 0) {
            line = line.slice(0, cursorPos - 1) + line.slice(cursorPos);
            cursorPos--;
            term.write('\b' + line.slice(cursorPos) + ' ' + CSI + `${line.slice(cursorPos).length + 1}D`);
          }
          return;
        }
        if (data === '\x1b[D') { if (cursorPos > 0) { cursorPos--; term.write(data); } return; }
        if (data === '\x1b[C') { if (cursorPos < line.length) { cursorPos++; term.write(data); } return; }

        const code = data.charCodeAt(0);
        if (data === '\x03') { // Ctrl+C
          term.write('^C\r\n' + PROMPT_REPL);
          line = ''; cursorPos = 0; histIdx = -1; multiLine = ''; inMulti = false;
          return;
        }
        if (code >= 32) {
          line = line.slice(0, cursorPos) + data + line.slice(cursorPos);
          cursorPos++;
          const tail = line.slice(cursorPos);
          term.write(data + tail + (tail ? CSI + `${tail.length}D` : ''));
        }
      });
    });
  }
}
