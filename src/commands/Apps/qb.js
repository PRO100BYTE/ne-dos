/**
 * QB - QuickBASIC-like mini BASIC interpreter TUI
 *
 * Supported statements:
 *   REM / '           comments
 *   PRINT expr[,expr...]  (semicolon = no newline)
 *   INPUT [prompt;] var
 *   LET var = expr  (LET optional)
 *   IF expr THEN stmt [ELSE stmt]
 *   GOTO n
 *   GOSUB n / RETURN
 *   FOR var = start TO end [STEP s] / NEXT [var]
 *   DIM var(size) – 1-based numeric array
 *   END  /  STOP
 *   CLS
 *   LOAD "file" / SAVE "file"
 *   LIST / NEW / RUN
 *
 * Built-in functions:
 *   ABS, INT, SQR, RND, SGN
 *   LEN, LEFT$, RIGHT$, MID$, STR$, VAL, CHR$, ASC, UCASE$, LCASE$, TRIM$
 *   STRING$, SPACE$, INSTR
 */

import { PrepareInternal, FormatDirectory } from '../Filesystem/StorageManager';

const CSI = '\x1b[';
const ESC = '\x1b';
const clr = `${CSI}2J${CSI}H`;
const bold = `${CSI}1m`;
const cyan = `${CSI}36m`;
const yellow = `${CSI}33m`;
const red = `${CSI}31m`;
const green = `${CSI}32m`;
const reset = `${CSI}0m`;

const BANNER = `${bold}${cyan}NE-DOS QB  v1.0${reset}  Mini BASIC Interpreter
Type ${yellow}HELP${reset} for commands. ${yellow}NEW${reset} to clear. ${yellow}RUN${reset} to execute.
`;

// ─── Tokeniser ────────────────────────────────────────────────────────────────

function tokenise(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    if (/\s/.test(src[i])) { i++; continue; }
    // string literal
    if (src[i] === '"') {
      let s = '';
      i++;
      while (i < src.length && src[i] !== '"') s += src[i++];
      i++; // closing "
      tokens.push({ type: 'STRING', value: s });
      continue;
    }
    // number
    if (/[\d.]/.test(src[i])) {
      let n = '';
      while (i < src.length && /[\d.eE+\-]/.test(src[i])) {
        if ((src[i] === '+' || src[i] === '-') && !/[eE]/.test(n.slice(-1))) break;
        n += src[i++];
      }
      tokens.push({ type: 'NUM', value: parseFloat(n) });
      continue;
    }
    // word / keyword
    if (/[A-Za-z_]/.test(src[i])) {
      let w = '';
      while (i < src.length && /[A-Za-z0-9_$]/.test(src[i])) w += src[i++];
      tokens.push({ type: 'WORD', value: w.toUpperCase() });
      continue;
    }
    // two-char ops
    if (i + 1 < src.length) {
      const two = src.slice(i, i + 2);
      if (['<>', '<=', '>='].includes(two)) { tokens.push({ type: 'OP', value: two }); i += 2; continue; }
    }
    // single-char
    tokens.push({ type: 'OP', value: src[i] });
    i++;
  }
  return tokens;
}

// ─── Parser / Evaluator ───────────────────────────────────────────────────────

class BasicInterpreter {
  constructor(outputCb, inputCb) {
    this.output = outputCb;   // (str) -> void, NO auto newline
    this.inputCb = inputCb;   // () -> Promise<string>
    this.reset();
  }

  reset() {
    this.lines = {};      // { lineNo: sourceText }
    this.vars = {};       // name -> value
    this.arrays = {};     // name -> Float64Array or Array
    this.stack = [];      // GOSUB return stack [{lineNo, stmtIdx}]
    this.forStack = [];   // FOR loop frames
    this.running = false;
    this.stopped = false;
  }

  load(src) {
    this.lines = {};
    for (const raw of src.split('\n')) {
      const m = raw.match(/^(\d+)\s*(.*)/);
      if (m) this.lines[parseInt(m[1])] = m[2].trimEnd();
    }
  }

  listText() {
    const nums = Object.keys(this.lines).map(Number).sort((a, b) => a - b);
    return nums.map(n => `${n.toString().padStart(5)} ${this.lines[n]}`).join('\r\n');
  }

  // Returns sorted array of { no, src }
  _program() {
    return Object.keys(this.lines)
      .map(Number)
      .sort((a, b) => a - b)
      .map(no => ({ no, src: this.lines[no] }));
  }

  async run() {
    this.running = true;
    this.stopped = false;
    this.vars = {};
    this.arrays = {};
    this.stack = [];
    this.forStack = [];
    const prog = this._program();
    if (prog.length === 0) { this.output('No program loaded.\r\n'); this.running = false; return; }
    let ip = 0; // index into prog
    let iterGuard = 0;
    while (ip < prog.length && !this.stopped) {
      if (++iterGuard > 2_000_000) { this.output(`${red}Infinite loop detected.${reset}\r\n`); break; }
      const { no, src } = prog[ip];
      let jump = null;
      try {
        jump = await this._execLine(src, no);
      } catch (e) {
        this.output(`${red}Error in line ${no}: ${e.message}${reset}\r\n`);
        break;
      }
      if (typeof jump === 'number') {
        const idx = prog.findIndex(p => p.no === jump);
        if (idx === -1) { this.output(`${red}Undefined line ${jump}${reset}\r\n`); break; }
        ip = idx;
      } else {
        ip++;
      }
    }
    this.running = false;
  }

  // Execute a single source line; returns target line number or null
  async _execLine(src, lineNo) {
    if (!src || src.trim() === '') return null;
    // REM / comment
    if (/^(?:REM\b|')/.test(src.trim())) return null;

    const tokens = tokenise(src);
    if (tokens.length === 0) return null;
    return await this._execTokens(tokens, lineNo);
  }

  async _execTokens(tokens, lineNo) {
    const first = tokens[0];
    const keyword = first.type === 'WORD' ? first.value : null;

    // ── PRINT ──────────────────────────────────────────────────────────────────
    if (keyword === 'PRINT') {
      let i = 1;
      let noNewline = false;
      while (i < tokens.length) {
        if (tokens[i].type === 'OP' && tokens[i].value === ';') { noNewline = true; i++; continue; }
        if (tokens[i].type === 'OP' && tokens[i].value === ',') {
          this.output('\t'); noNewline = false; i++; continue;
        }
        noNewline = false;
        const [val, ni] = this._expr(tokens, i);
        this.output(typeof val === 'number' ? this._numStr(val) : String(val));
        i = ni;
      }
      if (!noNewline) this.output('\r\n');
      return null;
    }

    // ── INPUT ──────────────────────────────────────────────────────────────────
    if (keyword === 'INPUT') {
      let i = 1;
      let prompt = '? ';
      if (tokens[i] && tokens[i].type === 'STRING') {
        prompt = tokens[i].value;
        i++;
        if (tokens[i] && tokens[i].type === 'OP' && tokens[i].value === ';') i++;
      }
      this.output(prompt);
      const val = await this.inputCb();
      const varName = tokens[i] ? tokens[i].value.toUpperCase() : '_';
      this.vars[varName] = isNaN(Number(val)) ? val : Number(val);
      return null;
    }

    // ── CLS ────────────────────────────────────────────────────────────────────
    if (keyword === 'CLS') { this.output(clr); return null; }

    // ── END / STOP ─────────────────────────────────────────────────────────────
    if (keyword === 'END' || keyword === 'STOP') { this.stopped = true; return null; }

    // ── GOTO ───────────────────────────────────────────────────────────────────
    if (keyword === 'GOTO') {
      const target = parseInt(tokens[1].value, 10);
      return target;
    }

    // ── GOSUB ──────────────────────────────────────────────────────────────────
    if (keyword === 'GOSUB') {
      const target = parseInt(tokens[1].value, 10);
      this.stack.push({ returnAfter: lineNo });
      return target;
    }

    // ── RETURN ─────────────────────────────────────────────────────────────────
    if (keyword === 'RETURN') {
      if (this.stack.length === 0) throw new Error('RETURN without GOSUB');
      const { returnAfter } = this.stack.pop();
      const prog = this._program();
      const idx = prog.findIndex(p => p.no === returnAfter);
      return prog[idx + 1] ? prog[idx + 1].no : null;
    }

    // ── FOR ────────────────────────────────────────────────────────────────────
    if (keyword === 'FOR') {
      // FOR var = start TO end [STEP s]
      const varName = tokens[1].value.toUpperCase();
      // tokens[2] should be '='
      const [start, i2] = this._expr(tokens, 3);
      // tokens[i2] should be 'TO'
      const [end, i3] = this._expr(tokens, i2 + 1);
      let step = 1;
      if (tokens[i3] && tokens[i3].value === 'STEP') {
        const [sv] = this._expr(tokens, i3 + 1);
        step = sv;
      }
      this.vars[varName] = start;
      this.forStack.push({ varName, end, step, lineNo });
      return null;
    }

    // ── NEXT ───────────────────────────────────────────────────────────────────
    if (keyword === 'NEXT') {
      if (this.forStack.length === 0) throw new Error('NEXT without FOR');
      const frame = this.forStack[this.forStack.length - 1];
      this.vars[frame.varName] = (this.vars[frame.varName] || 0) + frame.step;
      const done = frame.step > 0
        ? this.vars[frame.varName] > frame.end
        : this.vars[frame.varName] < frame.end;
      if (done) { this.forStack.pop(); return null; }
      return frame.lineNo + 1; // jump back to line after FOR
    }

    // ── IF ─────────────────────────────────────────────────────────────────────
    if (keyword === 'IF') {
      // IF expr THEN stmt [ELSE stmt]
      const [cond, ithen] = this._expr(tokens, 1);
      // tokens[ithen] should be THEN
      let thenStart = ithen + 1;
      // find ELSE if any
      let elseStart = -1;
      for (let k = thenStart; k < tokens.length; k++) {
        if (tokens[k].type === 'WORD' && tokens[k].value === 'ELSE') { elseStart = k + 1; break; }
      }
      const thenTokens = elseStart >= 0 ? tokens.slice(thenStart, elseStart - 1) : tokens.slice(thenStart);
      const elseTokens = elseStart >= 0 ? tokens.slice(elseStart) : [];
      if (this._truthy(cond)) {
        if (thenTokens.length === 1 && thenTokens[0].type === 'NUM') return thenTokens[0].value;
        return await this._execTokens(thenTokens, lineNo);
      } else if (elseTokens.length > 0) {
        if (elseTokens.length === 1 && elseTokens[0].type === 'NUM') return elseTokens[0].value;
        return await this._execTokens(elseTokens, lineNo);
      }
      return null;
    }

    // ── DIM ────────────────────────────────────────────────────────────────────
    if (keyword === 'DIM') {
      // DIM name(size)
      const name = tokens[1].value.toUpperCase();
      const [size] = this._expr(tokens, 3); // tokens[2]='('
      this.arrays[name] = new Array(Math.ceil(size) + 1).fill(0);
      return null;
    }

    // ── LET (explicit or implicit assignment) ──────────────────────────────────
    if (keyword === 'LET' || (first.type === 'WORD' && tokens[1] && tokens[1].value === '=')) {
      const offset = keyword === 'LET' ? 1 : 0;
      const name = tokens[offset].value.toUpperCase();
      // array assignment: name(idx) = expr
      if (tokens[offset + 1] && tokens[offset + 1].value === '(') {
        const [idx, ie] = this._expr(tokens, offset + 2);
        const [val] = this._expr(tokens, ie + 1); // skip ')'
        if (!this.arrays[name]) this.arrays[name] = [];
        this.arrays[name][Math.round(idx)] = val;
      } else {
        const [val] = this._expr(tokens, offset + 2); // skip '='
        this.vars[name] = val;
      }
      return null;
    }

    throw new Error(`Unknown statement: ${tokens.map(t => t.value).join(' ')}`);
  }

  // ── Expression parser ─────────────────────────────────────────────────────
  // Returns [value, nextIndex]

  _expr(tokens, i) { return this._or(tokens, i); }

  _or(tokens, i) {
    let [a, ni] = this._and(tokens, i);
    while (ni < tokens.length && tokens[ni].type === 'WORD' && tokens[ni].value === 'OR') {
      const [b, ni2] = this._and(tokens, ni + 1);
      a = (this._truthy(a) || this._truthy(b)) ? -1 : 0;
      ni = ni2;
    }
    return [a, ni];
  }

  _and(tokens, i) {
    let [a, ni] = this._not(tokens, i);
    while (ni < tokens.length && tokens[ni].type === 'WORD' && tokens[ni].value === 'AND') {
      const [b, ni2] = this._not(tokens, ni + 1);
      a = (this._truthy(a) && this._truthy(b)) ? -1 : 0;
      ni = ni2;
    }
    return [a, ni];
  }

  _not(tokens, i) {
    if (tokens[i] && tokens[i].type === 'WORD' && tokens[i].value === 'NOT') {
      const [v, ni] = this._compare(tokens, i + 1);
      return [this._truthy(v) ? 0 : -1, ni];
    }
    return this._compare(tokens, i);
  }

  _compare(tokens, i) {
    let [a, ni] = this._add(tokens, i);
    while (ni < tokens.length && tokens[ni].type === 'OP' && ['=', '<>', '<', '>', '<=', '>='].includes(tokens[ni].value)) {
      const op = tokens[ni].value;
      const [b, ni2] = this._add(tokens, ni + 1);
      a = this._cmp(a, op, b) ? -1 : 0;
      ni = ni2;
    }
    return [a, ni];
  }

  _cmp(a, op, b) {
    switch (op) {
      case '=': return a === b || a == b; // eslint-disable-line
      case '<>': return a !== b;
      case '<': return a < b;
      case '>': return a > b;
      case '<=': return a <= b;
      case '>=': return a >= b;
    }
    return false;
  }

  _add(tokens, i) {
    let [a, ni] = this._mul(tokens, i);
    while (ni < tokens.length && tokens[ni].type === 'OP' && ['+', '-'].includes(tokens[ni].value)) {
      const op = tokens[ni].value;
      const [b, ni2] = this._mul(tokens, ni + 1);
      a = op === '+' ? (typeof a === 'string' || typeof b === 'string' ? String(a) + String(b) : a + b) : a - b;
      ni = ni2;
    }
    return [a, ni];
  }

  _mul(tokens, i) {
    let [a, ni] = this._unary(tokens, i);
    while (ni < tokens.length && tokens[ni].type === 'OP' && ['*', '/', '\\', '^'].includes(tokens[ni].value) ||
           (tokens[ni] && tokens[ni].type === 'WORD' && tokens[ni].value === 'MOD')) {
      const op = tokens[ni].value;
      const [b, ni2] = this._unary(tokens, ni + 1);
      if (op === '*') a = a * b;
      else if (op === '/') a = a / b;
      else if (op === '\\') a = Math.trunc(a / b);
      else if (op === '^') a = Math.pow(a, b);
      else if (op === 'MOD') a = a % b;
      ni = ni2;
    }
    return [a, ni];
  }

  _unary(tokens, i) {
    if (tokens[i] && tokens[i].type === 'OP' && tokens[i].value === '-') {
      const [v, ni] = this._primary(tokens, i + 1);
      return [-v, ni];
    }
    if (tokens[i] && tokens[i].type === 'OP' && tokens[i].value === '+') {
      return this._primary(tokens, i + 1);
    }
    return this._primary(tokens, i);
  }

  _primary(tokens, i) {
    if (i >= tokens.length) return [0, i];
    const tok = tokens[i];

    if (tok.type === 'NUM') return [tok.value, i + 1];
    if (tok.type === 'STRING') return [tok.value, i + 1];

    // Parentheses
    if (tok.type === 'OP' && tok.value === '(') {
      const [v, ni] = this._expr(tokens, i + 1);
      return [v, ni + 1]; // skip ')'
    }

    // Built-in functions
    if (tok.type === 'WORD') {
      const name = tok.value;
      // Functions with one arg
      const oneArg = { ABS: Math.abs, INT: Math.trunc, SQR: Math.sqrt, SGN: Math.sign,
                       'STR$': v => ' ' + v, 'VAL': Number, 'CHR$': v => String.fromCharCode(v),
                       'ASC': v => v.charCodeAt(0), 'LEN': v => v.length,
                       'UCASE$': v => String(v).toUpperCase(), 'LCASE$': v => String(v).toLowerCase(),
                       'TRIM$': v => String(v).trim(), 'SPACE$': v => ' '.repeat(v) };
      if (name === 'RND') {
        if (tokens[i + 1] && tokens[i + 1].value === '(') {
          const [, ni] = this._expr(tokens, i + 2);
          return [Math.random(), ni + 1];
        }
        return [Math.random(), i + 1];
      }
      if (oneArg[name] !== undefined) {
        const [v, ni] = this._expr(tokens, i + 2); // skip '('
        return [oneArg[name](v), ni + 1]; // skip ')'
      }
      // LEFT$(s, n) / RIGHT$(s, n) / MID$(s, start[, len])
      if (name === 'LEFT$') {
        const [s, i2] = this._expr(tokens, i + 2);
        const [n, i3] = this._expr(tokens, i2 + 1); // skip ','
        return [String(s).substring(0, n), i3 + 1];
      }
      if (name === 'RIGHT$') {
        const [s, i2] = this._expr(tokens, i + 2);
        const [n, i3] = this._expr(tokens, i2 + 1);
        return [String(s).slice(-n), i3 + 1];
      }
      if (name === 'MID$') {
        const [s, i2] = this._expr(tokens, i + 2);
        const [start, i3] = this._expr(tokens, i2 + 1);
        if (tokens[i3] && tokens[i3].value === ',') {
          const [len, i4] = this._expr(tokens, i3 + 1);
          return [String(s).substr(start - 1, len), i4 + 1];
        }
        return [String(s).substring(start - 1), i3 + 1];
      }
      if (name === 'STRING$') {
        const [n, i2] = this._expr(tokens, i + 2);
        const [c, i3] = this._expr(tokens, i2 + 1);
        const ch = typeof c === 'string' ? c[0] : String.fromCharCode(c);
        return [ch.repeat(n), i3 + 1];
      }
      if (name === 'INSTR') {
        const [s, i2] = this._expr(tokens, i + 2);
        const [sub, i3] = this._expr(tokens, i2 + 1);
        return [String(s).indexOf(String(sub)) + 1, i3 + 1];
      }
      // Variable or array
      if (tokens[i + 1] && tokens[i + 1].value === '(') {
        const [idx, ni] = this._expr(tokens, i + 2);
        const arr = this.arrays[name] || [];
        return [arr[Math.round(idx)] || 0, ni + 1];
      }
      const val = this.vars[name];
      return [val !== undefined ? val : (name.endsWith('$') ? '' : 0), i + 1];
    }

    return [0, i + 1];
  }

  _truthy(v) { return v !== 0 && v !== '' && v !== false && v != null; }
  _numStr(n) {
    if (Number.isInteger(n)) return String(n);
    return parseFloat(n.toPrecision(10)).toString();
  }
}

// ─── TUI Shell ────────────────────────────────────────────────────────────────

export default class QBCommand {
  description() { return `Mini QuickBASIC interpreter (type HELP)`; }
  help(term) {
    term.writeln('Usage: qb [file.bas]');
    term.writeln('Starts an interactive BASIC environment.');
  }

  execute(term, params, currentDirectory) {
    return new Promise((resolve) => {
      const basic = new BasicInterpreter(
        str => term.write(str),
        () => readLine(term)
      );

      let inputBuf = '';
      let inputResolver = null;
      let shellInputResolver = null;
      let inInput = false;

      function readLine(t) {
        return new Promise(res => { inputResolver = res; inInput = true; });
      }

      const prompt = () => term.write(`${green}Ok${reset}\r\n${cyan}>${reset} `);

      // Try to load file if given
      if (params && params.trim()) {
        const filePath = PrepareInternal(params.trim(), currentDirectory);
        try {
          if (window.fs.existsSync(filePath)) {
            const src = window.fs.readFileSync(filePath, 'utf8');
            basic.load(src);
            term.write(`${green}Loaded: ${params.trim()}${reset}\r\n`);
          } else {
            term.write(`${red}File not found: ${params.trim()}${reset}\r\n`);
          }
        } catch (e) {
          term.write(`${red}${e.message}${reset}\r\n`);
        }
      }

      term.write(clr + BANNER);
      prompt();

      let line = '';
      let cursorPos = 0;
      const history = [];
      let histIdx = -1;

      const saveDispose = term.onData(async (data) => {
        // Forward to inputCb if waiting
        if (inInput) {
          for (const ch of data) {
            const code = ch.charCodeAt(0);
            if (code === 13) { // Enter
              term.write('\r\n');
              const val = inputBuf;
              inputBuf = '';
              inInput = false;
              if (inputResolver) { inputResolver(val); inputResolver = null; }
            } else if (code === 127 || code === 8) {
              if (inputBuf.length > 0) {
                inputBuf = inputBuf.slice(0, -1);
                term.write('\b \b');
              }
            } else if (code >= 32) {
              inputBuf += ch;
              term.write(ch);
            }
          }
          return;
        }

        if (data === '\x1b') { // ESC - exit
          term.write('\r\n');
          saveDispose.dispose();
          term.write(`${reset}${green}Goodbye.${reset}\r\n`);
          resolve();
          return;
        }

        if (data === '\r' || data === '\n') {
          term.write('\r\n');
          const cmd = line.trim();
          history.unshift(cmd);
          histIdx = -1;
          line = ''; cursorPos = 0;
          if (cmd) await handleCommand(cmd);
          if (!basic.running) prompt();
          return;
        }

        // Arrow keys
        if (data === '\x1b[A') { // Up
          if (histIdx < history.length - 1) {
            histIdx++;
            term.write('\r' + CSI + 'K' + `${cyan}>${reset} ` + history[histIdx]);
            line = history[histIdx]; cursorPos = line.length;
          }
          return;
        }
        if (data === '\x1b[B') { // Down
          if (histIdx > 0) { histIdx--; const s = history[histIdx]; term.write('\r' + CSI + 'K' + `${cyan}>${reset} ` + s); line = s; cursorPos = s.length; }
          else { histIdx = -1; term.write('\r' + CSI + 'K' + `${cyan}>${reset} `); line = ''; cursorPos = 0; }
          return;
        }

        // Backspace
        if (data === '\x7f' || data === '\b') {
          if (cursorPos > 0) {
            line = line.slice(0, cursorPos - 1) + line.slice(cursorPos);
            cursorPos--;
            term.write('\b' + line.slice(cursorPos) + ' ' + CSI + `${line.slice(cursorPos).length + 1}D`);
          }
          return;
        }

        // Printable
        const code = data.charCodeAt(0);
        if (code >= 32) {
          line = line.slice(0, cursorPos) + data + line.slice(cursorPos);
          cursorPos++;
          term.write(data + line.slice(cursorPos) + (line.slice(cursorPos) ? CSI + `${line.slice(cursorPos).length}D` : ''));
        }
      });

      async function handleCommand(cmd) {
        // Numbered line → store in program
        const numbered = cmd.match(/^(\d+)\s*(.*)/);
        if (numbered) {
          const no = parseInt(numbered[1]);
          const body = numbered[2].trimEnd();
          if (body === '') delete basic.lines[no];
          else basic.lines[no] = body;
          return;
        }

        const upper = cmd.toUpperCase();
        const keyword = upper.split(/\s+/)[0];

        if (keyword === 'RUN') { await basic.run(); return; }
        if (keyword === 'LIST') { term.write(basic.listText() + '\r\n'); return; }
        if (keyword === 'NEW') { basic.reset(); term.write('Program cleared.\r\n'); return; }
        if (keyword === 'CLS') { term.write(clr); return; }
        if (keyword === 'QUIT' || keyword === 'EXIT' || keyword === 'SYSTEM') {
          saveDispose.dispose();
          term.write(`${reset}${green}Goodbye.${reset}\r\n`);
          resolve();
          return;
        }

        if (keyword === 'SAVE') {
          const mFile = cmd.match(/SAVE\s+"([^"]+)"/i);
          if (!mFile) { term.write(`${red}Usage: SAVE "filename"${reset}\r\n`); return; }
          const fp = PrepareInternal(mFile[1], currentDirectory);
          try {
            window.fs.writeFileSync(fp, basic.listText().replace(/\r\n/g, '\n'));
            term.write(`${green}Saved: ${mFile[1]}${reset}\r\n`);
          } catch (e) {
            term.write(`${red}${e.message}${reset}\r\n`);
          }
          return;
        }

        if (keyword === 'LOAD') {
          const mFile = cmd.match(/LOAD\s+"([^"]+)"/i);
          if (!mFile) { term.write(`${red}Usage: LOAD "filename"${reset}\r\n`); return; }
          const fp = PrepareInternal(mFile[1], currentDirectory);
          try {
            const src = window.fs.readFileSync(fp, 'utf8');
            basic.reset();
            basic.load(src);
            term.write(`${green}Loaded: ${mFile[1]}${reset}\r\n`);
          } catch (e) {
            term.write(`${red}${e.message}${reset}\r\n`);
          }
          return;
        }

        if (keyword === 'HELP') {
          term.write([
            `${bold}${cyan}QB Commands:${reset}`,
            `  ${yellow}RUN${reset}           - Execute the loaded program`,
            `  ${yellow}LIST${reset}          - Show program listing`,
            `  ${yellow}NEW${reset}           - Clear the program`,
            `  ${yellow}LOAD "file"${reset}   - Load .bas file from filesystem`,
            `  ${yellow}SAVE "file"${reset}   - Save program to filesystem`,
            `  ${yellow}CLS${reset}           - Clear screen`,
            `  ${yellow}QUIT${reset}          - Exit QB`,
            `  ${yellow}ESC${reset}           - Exit QB`,
            `${bold}${cyan}BASIC Statements:${reset}`,
            `  PRINT, INPUT, LET, IF..THEN..ELSE, GOTO, GOSUB, RETURN`,
            `  FOR..TO..STEP, NEXT, DIM, REM, END, CLS`,
            `${bold}${cyan}Functions:${reset}`,
            `  ABS INT SQR RND SGN STR$ VAL CHR$ ASC LEN`,
            `  LEFT$ RIGHT$ MID$ UCASE$ LCASE$ TRIM$ SPACE$ STRING$ INSTR`,
            '',
          ].join('\r\n'));
          return;
        }

        // Direct statement execution (immediate mode)
        try {
          await basic._execLine(cmd.replace(/^\d+\s*/, ''), 0);
        } catch (e) {
          term.write(`${red}${e.message}${reset}\r\n`);
        }
      }
    });
  }
}
