import path from "path-browserify";

// ─── ANSI helpers ─────────────────────────────────────────────────────────────
const CSI = '\x1b[';
const RESET = CSI + '0m';
const BOLD = CSI + '1m';
const DIM = CSI + '2m';
const REVERSE = CSI + '7m';
const FG_WHITE = CSI + '37m';
const FG_CYAN = CSI + '36m';
const FG_YELLOW = CSI + '33m';
const FG_GREEN = CSI + '32m';
const FG_BLACK = CSI + '30m';
const BG_BLACK = CSI + '40m';
const BG_BLUE = CSI + '44m';
const BG_CYAN = CSI + '46m';

const goto = (r, c) => `${CSI}${r};${c}H`;
const clearScreen = () => `${CSI}2J${CSI}H`;
const hideCursor = () => `${CSI}?25l`;
const showCursor = () => `${CSI}?25h`;

const ROWS = 24;
const COLS = 80;
const AUDIO_EXTENSIONS = ['.mp3', '.ogg', '.wav', '.flac', '.aac'];

// ─── Player Command ───────────────────────────────────────────────────────────
export default class PlayerCommand {
  description() { return "Music player — reads audio from BrowserFS /music/"; }
  help(term) {
    term.writeln("Usage: player");
    term.writeln("  Upload audio files first with: upload");
    term.writeln("  Files should be placed in /music/");
    term.writeln("");
    term.writeln("  Space      Play / Pause");
    term.writeln("  ↑ ↓        Previous / Next track");
    term.writeln("  ← →        Seek -5s / +5s");
    term.writeln("  + -        Volume up / down");
    term.writeln("  s          Toggle shuffle");
    term.writeln("  r          Toggle repeat");
    term.writeln("  Esc        Quit player");
  }

  execute(term, params, currentDirectory, setDirectory) {
    // ── Ensure /music directory ───────────────────────────────────────────────
    try {
      if (!window.fs.existsSync('/music')) window.fs.mkdirSync('/music');
    } catch {}

    // ── Scan playlist ─────────────────────────────────────────────────────────
    let playlist = [];
    try {
      const entries = window.fs.readdirSync('/music');
      playlist = entries.filter(f => AUDIO_EXTENSIONS.some(ext => f.toLowerCase().endsWith(ext)));
    } catch {}

    const state = {
      trackIdx: 0,
      playing: false,
      shuffle: false,
      repeat: false,
      volume: 0.8,
      status: '',
      playlistScroll: 0,
      audio: null,
      objectUrls: {},
    };

    const PLAYLIST_ROWS = ROWS - 12; // rows visible in playlist box

    // ── Beat animation state ──────────────────────────────────────────────────
    const BAR_COUNT = 20;
    let beatBars = Array(BAR_COUNT).fill(0);
    let animFrame = null;

    const animateBars = () => {
      if (!state.playing) {
        beatBars = Array(BAR_COUNT).fill(0);
        return;
      }
      beatBars = beatBars.map(v => {
        const target = Math.random() * 8;
        return v + (target - v) * 0.4;
      });
      renderProgressRow();
      animFrame = setTimeout(animateBars, 100);
    };

    const stopAnim = () => {
      if (animFrame !== null) { clearTimeout(animFrame); animFrame = null; }
    };

    // ── Audio engine ──────────────────────────────────────────────────────────
    const getOrCreateUrl = (trackName) => {
      if (state.objectUrls[trackName]) return state.objectUrls[trackName];
      try {
        const buf = window.fs.readFileSync(`/music/${trackName}`);
        const blob = new Blob([buf]);
        const url = URL.createObjectURL(blob);
        state.objectUrls[trackName] = url;
        return url;
      } catch {
        return null;
      }
    };

    const loadTrack = (idx) => {
      stopAnim();
      if (state.audio) {
        state.audio.pause();
        state.audio.src = '';
        state.audio = null;
      }
      if (playlist.length === 0) return;
      const name = playlist[idx];
      const url = getOrCreateUrl(name);
      if (!url) {
        state.status = `Cannot read: ${name}`;
        return;
      }
      const audio = new Audio(url);
      audio.volume = state.volume;
      audio.loop = state.repeat;
      state.audio = audio;

      audio.addEventListener('ended', () => {
        if (state.repeat) return; // loop handles it
        nextTrack();
      });
      audio.addEventListener('error', () => {
        state.status = `Playback error: ${name}`;
        renderAll();
      });
    };

    const playPause = () => {
      if (!state.audio) {
        if (playlist.length === 0) { state.status = 'No tracks in /music/'; renderAll(); return; }
        loadTrack(state.trackIdx);
      }
      if (state.playing) {
        state.audio.pause();
        state.playing = false;
        stopAnim();
      } else {
        state.audio.play().catch(e => { state.status = `Error: ${e.message}`; });
        state.playing = true;
        animateBars();
      }
      renderAll();
    };

    const nextTrack = () => {
      stopAnim();
      if (state.shuffle) {
        state.trackIdx = Math.floor(Math.random() * playlist.length);
      } else {
        state.trackIdx = (state.trackIdx + 1) % playlist.length;
      }
      loadTrack(state.trackIdx);
      if (state.playing) {
        state.audio.play().catch(() => {});
        animateBars();
      }
      ensureScroll();
      renderAll();
    };

    const prevTrack = () => {
      stopAnim();
      state.trackIdx = (state.trackIdx - 1 + playlist.length) % playlist.length;
      loadTrack(state.trackIdx);
      if (state.playing) {
        state.audio.play().catch(() => {});
        animateBars();
      }
      ensureScroll();
      renderAll();
    };

    const seek = (delta) => {
      if (state.audio) state.audio.currentTime = Math.max(0, state.audio.currentTime + delta);
    };

    const setVolume = (delta) => {
      state.volume = Math.min(1, Math.max(0, state.volume + delta));
      if (state.audio) state.audio.volume = state.volume;
    };

    const ensureScroll = () => {
      if (state.trackIdx < state.playlistScroll) state.playlistScroll = state.trackIdx;
      if (state.trackIdx >= state.playlistScroll + PLAYLIST_ROWS) state.playlistScroll = state.trackIdx - PLAYLIST_ROWS + 1;
    };

    const fmtTime = (sec) => {
      if (!isFinite(sec)) return '--:--';
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    };

    // ── Render helpers ────────────────────────────────────────────────────────
    const renderProgressRow = () => {
      if (!state.audio) return;
      const dur = state.audio.duration || 0;
      const cur = state.audio.currentTime || 0;
      const pct = dur > 0 ? cur / dur : 0;
      const BAR_W = 40;
      const filled = Math.round(pct * BAR_W);
      const bar = '█'.repeat(filled) + '░'.repeat(BAR_W - filled);

      // Visualiser bars
      let vizRow = '';
      for (let i = 0; i < BAR_COUNT; i++) {
        const h = Math.min(8, Math.round(beatBars[i]));
        const chars = ['▁','▂','▃','▄','▅','▆','▇','█'];
        vizRow += FG_GREEN + (chars[h] || ' ');
      }
      vizRow += RESET;

      let out = goto(7, 2) + FG_CYAN + bar + RESET + ' ' + FG_YELLOW + fmtTime(cur) + '/' + fmtTime(dur) + RESET;
      out += goto(9, 2) + vizRow;
      term.write(out);
    };

    const renderAll = () => {
      let out = hideCursor() + clearScreen();

      // ── Title ────────────────────────────────────────────────────────
      out += goto(1, 1) + BG_BLUE + FG_WHITE + BOLD;
      out += '╔' + '═'.repeat(COLS - 2) + '╗' + RESET;
      const titleLine = '♪  NE-PLAYER  ♪';
      const titlePad = Math.floor((COLS - titleLine.length) / 2);
      out += goto(2, 1) + BG_BLUE + FG_WHITE + BOLD +
             '║' + ' '.repeat(titlePad) + titleLine + ' '.repeat(COLS - 2 - titlePad - titleLine.length) + '║' + RESET;
      out += goto(3, 1) + BG_BLUE + FG_WHITE + BOLD + '╚' + '═'.repeat(COLS - 2) + '╝' + RESET;

      // ── Now playing ───────────────────────────────────────────────────
      const trackName = playlist.length > 0 ? playlist[state.trackIdx] : '(no tracks)';
      const playIcon = state.playing ? '▶' : '⏸';
      const shuffleIcon = state.shuffle ? '[S]' : '   ';
      const repeatIcon = state.repeat ? '[R]' : '   ';
      const volBars = Math.round(state.volume * 10);
      const volStr = '█'.repeat(volBars) + '░'.repeat(10 - volBars);
      out += goto(5, 2) + FG_WHITE + BOLD + `${playIcon}  Now playing: ` + FG_YELLOW + trackName + RESET;
      out += goto(6, 2) + FG_WHITE + `Vol: ${FG_GREEN}${volStr}${RESET}  ${shuffleIcon}  ${repeatIcon}`;

      // ── Progress bar placeholder (will be overwritten by renderProgressRow) ─
      out += goto(7, 2) + FG_CYAN + '░'.repeat(40) + RESET + ' ' + FG_YELLOW + '--:-- / --:--' + RESET;

      // ── Visualiser placeholder ────────────────────────────────────────────
      out += goto(9, 2) + DIM + FG_GREEN + '▁'.repeat(BAR_COUNT) + RESET;

      // ── Playlist box ───────────────────────────────────────────────────────
      const boxTop = 11;
      out += goto(boxTop, 1) + FG_WHITE + '╔' + '═'.repeat(COLS - 2) + '╗' + RESET;
      out += goto(boxTop + 1, 1) + FG_WHITE + '║' + BOLD + FG_CYAN + '  Playlist'.padEnd(COLS - 2, ' ') + RESET + FG_WHITE + '║' + RESET;
      out += goto(boxTop + 2, 1) + FG_WHITE + '╠' + '═'.repeat(COLS - 2) + '╣' + RESET;

      for (let i = 0; i < PLAYLIST_ROWS; i++) {
        const idx = i + state.playlistScroll;
        const isActive = idx === state.trackIdx;
        out += goto(boxTop + 3 + i, 1) + FG_WHITE + '║' + RESET;
        if (idx < playlist.length) {
          const numTxt = String(idx + 1).padStart(3, ' ');
          const icon = isActive ? (state.playing ? '▶ ' : '⏸ ') : '  ';
          const trackLine = ` ${numTxt}. ${icon}${playlist[idx]}`;
          if (isActive) {
            out += REVERSE + FG_BLACK + BG_CYAN + trackLine.padEnd(COLS - 2, ' ') + RESET;
          } else {
            out += FG_WHITE + trackLine.padEnd(COLS - 2, ' ') + RESET;
          }
        } else {
          out += ' '.repeat(COLS - 2);
        }
        out += FG_WHITE + '║' + RESET;
      }
      out += goto(boxTop + 3 + PLAYLIST_ROWS, 1) + FG_WHITE + '╚' + '═'.repeat(COLS - 2) + '╝' + RESET;

      // ── Status bar ────────────────────────────────────────────────────────
      out += goto(ROWS - 1, 1) + BG_BLUE + FG_WHITE;
      const statusText = state.status || 'Space:Play/Pause  ↑↓:Track  ←→:Seek  +-:Vol  s:Shuffle  r:Repeat  Esc:Quit';
      out += (' ' + statusText).padEnd(COLS, ' ') + RESET;
      state.status = ''; // clear one-shot status messages

      if (playlist.length === 0) {
        out += goto(5, 2) + FG_WHITE + 'No audio files found in /music/' + RESET;
        out += goto(6, 2) + DIM + FG_WHITE + 'Use the "upload" command to add .mp3/.ogg/.wav files, then run player.' + RESET;
      }

      term.write(out);
      renderProgressRow();
    };

    // ── Initial render ────────────────────────────────────────────────────────
    if (playlist.length > 0) loadTrack(0);
    renderAll();

    // ── Progress poll (update progress bar every second while playing) ────────
    const progressInterval = setInterval(() => {
      if (state.playing) renderProgressRow();
    }, 1000);

    const disposable = term.onData((key) => {
      switch (key) {
        case '\x1b': // Esc — quit
          stopAnim();
          clearInterval(progressInterval);
          if (state.audio) { state.audio.pause(); state.audio.src = ''; }
          Object.values(state.objectUrls).forEach(u => URL.revokeObjectURL(u));
          disposable.dispose();
          term.write(showCursor() + clearScreen());
          return;

        case ' ': playPause(); break;

        case '\x1b[A': prevTrack(); break; // Up
        case '\x1b[B': nextTrack(); break; // Down

        case '\x1b[D': seek(-5); break;   // Left
        case '\x1b[C': seek(5);  break;   // Right

        case '+': case '=': setVolume(0.05); renderAll(); break;
        case '-': setVolume(-0.05); renderAll(); break;

        case 's': case 'S':
          state.shuffle = !state.shuffle;
          state.status = state.shuffle ? 'Shuffle: ON' : 'Shuffle: OFF';
          renderAll();
          break;

        case 'r': case 'R':
          state.repeat = !state.repeat;
          if (state.audio) state.audio.loop = state.repeat;
          state.status = state.repeat ? 'Repeat: ON' : 'Repeat: OFF';
          renderAll();
          break;

        default: break;
      }
    });
  }
}
