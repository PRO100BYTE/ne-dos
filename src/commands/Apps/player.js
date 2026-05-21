import path from "path-browserify";

// ─── ANSI helpers ─────────────────────────────────────────────────────────────
const CSI     = '\x1b[';
const RESET   = CSI + '0m';
const BOLD    = CSI + '1m';
const DIM     = CSI + '2m';
const REVERSE = CSI + '7m';
const FG_WHITE   = CSI + '37m';
const FG_CYAN    = CSI + '36m';
const FG_YELLOW  = CSI + '33m';
const FG_GREEN   = CSI + '32m';
const FG_RED     = CSI + '31m';
const FG_BLACK   = CSI + '30m';
const FG_MAGENTA = CSI + '35m';
const BG_BLACK   = CSI + '40m';
const BG_BLUE    = CSI + '44m';
const BG_CYAN    = CSI + '46m';

const goto        = (r, c) => `${CSI}${r};${c}H`;
const clearScreen = ()     => `${CSI}2J${CSI}H`;
const hideCursor  = ()     => `${CSI}?25l`;
const showCursor  = ()     => `${CSI}?25h`;

const AUDIO_EXT   = ['.mp3', '.ogg', '.wav', '.flac', '.aac', '.m4a'];

// ─── Player Command ───────────────────────────────────────────────────────────
export default class PlayerCommand {
  description() { return "Music player — reads audio from BrowserFS /music/"; }
  help(term) {
    term.writeln("Usage: player [trackname]");
    term.writeln("");
    term.writeln("  Upload audio first: upload  (saves to /music/)");
    term.writeln("");
    term.writeln("  Space        Play / Pause");
    term.writeln("  ↑ / ↓        Previous / Next track");
    term.writeln("  ← / →        Seek -5s / +5s");
    term.writeln("  Shift+← / →  Seek -30s / +30s");
    term.writeln("  + / -        Volume +5% / -5%");
    term.writeln("  0..9         Jump to track #");
    term.writeln("  s            Toggle shuffle");
    term.writeln("  r            Toggle repeat (one track)");
    term.writeln("  a            Repeat all");
    term.writeln("  Esc          Quit player");
  }

  execute(term, params, currentDirectory, setDirectory) {
    return new Promise((resolve) => {
    const COLS = term.cols;
    const ROWS = term.rows;

    if (term._setAppMode) term._setAppMode(true);

    // ── Layout constants ───────────────────────────────────────────────────────
    const VIZ_ROWS      = 3;                        // rows for the visualizer
    const VIZ_COLS      = Math.floor((COLS - 4) / 2); // bars, each 2 chars wide
    const HDR_ROWS      = 3;                        // title header rows 1-3
    // Row 4: separator
    // Row 5: now playing
    // Row 6: file info
    // Row 7: separator
    // Row 8: progress bar
    // Row 9: volume/flags
    // Row 10: separator
    // Rows 11..10+VIZ_ROWS: visualizer
    const VIZ_START_ROW = 11;
    const SEP_ROW3      = VIZ_START_ROW + VIZ_ROWS; // separator after viz
    const PL_HDR_ROW    = SEP_ROW3 + 1;             // "Playlist" header
    const PL_START_ROW  = PL_HDR_ROW + 1;           // first track row
    const CTRL_ROW      = ROWS;                      // controls hint on last row
    const PL_ROWS       = Math.max(2, CTRL_ROW - PL_START_ROW); // playlist entries

    // ── Ensure /music ─────────────────────────────────────────────────────────
    try { if (!window.fs.existsSync('/music')) window.fs.mkdirSync('/music'); } catch {}

    // ── Build playlist ────────────────────────────────────────────────────────
    let playlist = [];
    let startIdx = 0;
    
    // If a track name/path was given as param, try to use it directly or find it in /music
    if (params[1]) {
      const targetPath = params[1].startsWith('/') ? params[1] : `/music/${params[1]}`;
      try {
        const st = window.fs.statSync(targetPath);
        if (!st.isDirectory()) {
          // Load just this file
          const filename = path.basename(targetPath);
          playlist = [filename];
          startIdx = 0;
        }
      } catch {}
    }
    
    // If no specific file loaded, scan /music directory
    if (!playlist.length) {
      try {
        playlist = window.fs.readdirSync('/music')
          .filter(f => AUDIO_EXT.some(e => f.toLowerCase().endsWith(e)))
          .sort();
      } catch {}
    } else if (playlist.length === 1) {
      // If we loaded a single file, now also add other files from /music to the playlist
      try {
        const otherFiles = window.fs.readdirSync('/music')
          .filter(f => AUDIO_EXT.some(e => f.toLowerCase().endsWith(e)) && f !== playlist[0])
          .sort();
        playlist = [playlist[0], ...otherFiles];
      } catch {}
    }

    // ── State ─────────────────────────────────────────────────────────────────
    const state = {
      trackIdx:      startIdx,
      playing:       false,
      shuffle:       false,
      repeat:        false,   // repeat one
      repeatAll:     false,   // repeat all
      volume:        0.8,
      status:        '',
      statusTimeout: null,   // timer for auto-clearing status
      plScroll:      0,
      audio:         null,
      objectUrls:    {},
    };

    const setStatus = (msg) => {
      state.status = msg;
      if (state.statusTimeout) clearTimeout(state.statusTimeout);
      if (msg) {
        state.statusTimeout = setTimeout(() => {
          state.status = '';
          renderAll();
        }, 3000);
      }
    };

    // ── Visualizer bars ───────────────────────────────────────────────────────
    let beatBars  = Array(VIZ_COLS).fill(0);
    let animFrame = null;

    const stopAnim = () => {
      if (animFrame !== null) { clearTimeout(animFrame); animFrame = null; }
    };

    const animateBars = () => {
      if (!state.playing) { beatBars = Array(VIZ_COLS).fill(0); return; }
      beatBars = beatBars.map(v => {
        const target = Math.random() * VIZ_ROWS;
        return v + (target - v) * 0.35;
      });
      term.write(hideCursor() + renderViz());
      animFrame = setTimeout(animateBars, 80);
    };

    // Render the visualizer in-place (no clearScreen, just overwrite the rows)
    const renderViz = () => {
      let out = '';
      const BLOCKS = ' ▁▂▃▄▅▆▇█';
      for (let vr = 0; vr < VIZ_ROWS; vr++) {
        out += goto(VIZ_START_ROW + vr, 3);
        const threshold = VIZ_ROWS - vr; // top row = VIZ_ROWS, bottom = 1
        for (let i = 0; i < VIZ_COLS; i++) {
          const barH = beatBars[i] || 0;          // 0..VIZ_ROWS
          const diff = barH - (threshold - 1);    // how much above this floor
          let ch, color;
          if (diff <= 0) {
            ch = '░'; color = DIM + FG_GREEN;
          } else if (diff >= 1) {
            ch = '█';
            color = threshold === VIZ_ROWS ? (BOLD + FG_RED)
                  : threshold === 2        ? (BOLD + FG_YELLOW)
                  :                         (BOLD + FG_GREEN);
          } else {
            const idx = Math.min(8, Math.round(diff * 8));
            ch = BLOCKS[idx];
            color = threshold === VIZ_ROWS ? FG_RED
                  : threshold === 2        ? FG_YELLOW
                  :                         FG_GREEN;
          }
          out += color + ch + ch + RESET; // 2 chars per bar
        }
      }
      return out;
    };

    // ── Audio engine ──────────────────────────────────────────────────────────
    const getUrl = (name) => {
      if (state.objectUrls[name]) return state.objectUrls[name];
      try {
        const filePath = name.startsWith('/') ? name : `/music/${name}`;
        const buf  = window.fs.readFileSync(filePath);
        const url  = URL.createObjectURL(new Blob([buf]));
        state.objectUrls[name] = url;
        return url;
      } catch { return null; }
    };

    const getFileInfo = (name) => {
      try {
        const st   = window.fs.statSync(`/music/${name}`);
        const ext  = path.extname(name).toUpperCase().slice(1) || '?';
        return { size: st.size, ext };
      } catch { return { size: 0, ext: '?' }; }
    };

    const loadTrack = (idx, autoPlay = false) => {
      stopAnim();
      if (state.audio) { state.audio.pause(); state.audio.src = ''; state.audio = null; }
      if (!playlist.length) return;
      const url = getUrl(playlist[idx]);
      if (!url) { state.status = `Cannot load: ${playlist[idx]}`; return; }
      const audio = new Audio(url);
      audio.volume = state.volume;
      audio.loop   = state.repeat;
      state.audio  = audio;
      audio.addEventListener('ended', () => {
        if (state.repeat) {
          // Repeat one: reload current track
          audio.currentTime = 0;
          audio.play().catch(e => setStatus(`Play error: ${e.message}`));
          return;
        }
        // Move to next track
        if (state.shuffle) {
          state.trackIdx = Math.floor(Math.random() * playlist.length);
        } else {
          state.trackIdx = (state.trackIdx + 1) % playlist.length;
        }
        // Auto-advance to next without error
        loadTrack(state.trackIdx, true);
        ensurePlScroll(); renderAll();
      });
      audio.addEventListener('error', () => {
        setStatus(`Error loading: ${playlist[idx]}`);
        renderAll();
      });
      if (autoPlay) {
        audio.play().catch(e => { state.status = `Play error: ${e.message}`; });
        state.playing = true;
        animateBars();
      }
    };

    const playPause = () => {
      if (!playlist.length) { setStatus('No audio files in /music/'); renderAll(); return; }
      if (!state.audio) loadTrack(state.trackIdx);
      if (state.playing) {
        state.audio.pause(); state.playing = false; stopAnim();
      } else {
        state.audio.play().catch(e => { setStatus(`Play error: ${e.message}`); });
        state.playing = true; animateBars();
      }
      renderAll();
    };

    const nextTrack = (auto = false) => {
      stopAnim();
      if (state.shuffle && !auto) {
        state.trackIdx = Math.floor(Math.random() * playlist.length);
      } else {
        state.trackIdx = (state.trackIdx + 1) % playlist.length;
      }
      loadTrack(state.trackIdx, state.playing);
      ensurePlScroll(); renderAll();
    };

    const prevTrack = () => {
      stopAnim();
      // If more than 3 seconds in, restart; otherwise go to previous
      if (state.audio && (state.audio.currentTime || 0) > 3) {
        state.audio.currentTime = 0;
        renderAll(); return;
      }
      state.trackIdx = (state.trackIdx - 1 + playlist.length) % playlist.length;
      loadTrack(state.trackIdx, state.playing);
      ensurePlScroll(); renderAll();
    };

    const jumpToTrack = (idx) => {
      if (idx < 0 || idx >= playlist.length) return;
      stopAnim(); state.trackIdx = idx;
      loadTrack(state.trackIdx, state.playing);
      ensurePlScroll(); renderAll();
    };

    const seek = (delta) => {
      if (state.audio) state.audio.currentTime = Math.max(0, (state.audio.currentTime || 0) + delta);
    };

    const setVolume = (delta) => {
      state.volume = Math.min(1, Math.max(0, state.volume + delta));
      if (state.audio) state.audio.volume = state.volume;
    };

    const ensurePlScroll = () => {
      if (state.trackIdx < state.plScroll) state.plScroll = state.trackIdx;
      if (state.trackIdx >= state.plScroll + PL_ROWS) state.plScroll = state.trackIdx - PL_ROWS + 1;
    };

    const fmtTime = (s) => {
      if (!isFinite(s) || s < 0) return '--:--';
      const m = Math.floor(s / 60), sec = Math.floor(s % 60);
      return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };

    const fmtSize = (bytes) => {
      if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
      if (bytes >= 1024)    return (bytes / 1024).toFixed(1) + ' KB';
      return bytes + ' B';
    };

    // ── Render progress row only (called by interval + anim) ─────────────────
    const renderProgressRow = () => {
      if (!state.audio) return;
      const dur = state.audio.duration || 0;
      const cur = state.audio.currentTime || 0;
      const pct = dur > 0 ? cur / dur : 0;
      const BAR_W = COLS - 20;
      const filled = Math.round(pct * BAR_W);
      const bar = '█'.repeat(filled) + '░'.repeat(BAR_W - filled);
      const timeStr = `${fmtTime(cur)} / ${fmtTime(dur)}`;
      termWrite(goto(8, 3) + BOLD + FG_CYAN + bar + RESET + ' ' + FG_YELLOW + timeStr + RESET);
    };

    const termWrite = (s) => term.write(s);

    // ── Full screen render ────────────────────────────────────────────────────
    const renderAll = () => {
      const trackName = playlist.length > 0 ? playlist[state.trackIdx] : '(no tracks)';
      const playIcon  = state.playing ? '▶' : '⏸';
      const volPct    = Math.round(state.volume * 100);
      const volBars   = Math.round(state.volume * 20);
      const volStr    = '█'.repeat(volBars) + '░'.repeat(20 - volBars);
      const shuffleOn = state.shuffle   ? BOLD + FG_CYAN  + '[SHUFFLE]' + RESET : DIM + FG_WHITE + '[shuffle]' + RESET;
      const repeatOn  = state.repeat    ? BOLD + FG_YELLOW + '[REPEAT 1]' + RESET : DIM + FG_WHITE + '[repeat1]' + RESET;
      const repAllOn  = state.repeatAll ? BOLD + FG_GREEN  + '[REPEAT ALL]' + RESET : DIM + FG_WHITE + '[repeat∞]' + RESET;

      let out = hideCursor() + clearScreen();

      // ── Title header ─────────────────────────────────────────────────────
      out += goto(1, 1) + BG_BLUE + FG_WHITE + BOLD;
      out += '╔' + '═'.repeat(COLS - 2) + '╗' + RESET;
      const hdr = '♪  NE-PLAYER  v1.3  ♪';
      const hdrPad = Math.floor((COLS - hdr.length) / 2);
      out += goto(2, 1) + BG_BLUE + FG_WHITE + BOLD +
             '║' + ' '.repeat(hdrPad) + hdr + ' '.repeat(COLS - 2 - hdrPad - hdr.length) + '║' + RESET;
      out += goto(3, 1) + BG_BLUE + FG_WHITE + BOLD + '╚' + '═'.repeat(COLS - 2) + '╝' + RESET;

      // ── Separator ────────────────────────────────────────────────────────
      out += goto(4, 1) + DIM + FG_WHITE + '─'.repeat(COLS) + RESET;

      // ── Now playing ──────────────────────────────────────────────────────
      const trackDisp = trackName.length > COLS - 22
        ? trackName.slice(0, COLS - 25) + '…'
        : trackName;
      out += goto(5, 2) + BOLD + FG_WHITE + `${playIcon}  Now playing: ` + BOLD + FG_YELLOW + trackDisp + RESET;

      if (playlist.length > 0) {
        const info = getFileInfo(trackName);
        const trackNum = `Track ${state.trackIdx + 1} of ${playlist.length}`;
        out += goto(6, 5) + DIM + FG_WHITE + `${trackNum}  │  Format: ${info.ext}  │  Size: ${fmtSize(info.size)}` + RESET;
      }

      // ── Separator ────────────────────────────────────────────────────────
      out += goto(7, 1) + DIM + FG_WHITE + '─'.repeat(COLS) + RESET;

      // ── Progress bar (placeholder; updated by renderProgressRow) ─────────
      out += goto(8, 3) + BOLD + FG_CYAN + '░'.repeat(COLS - 20) + RESET + ' ' + FG_YELLOW + '--:-- / --:--' + RESET;

      // ── Volume + flags ────────────────────────────────────────────────────
      out += goto(9, 2) + FG_WHITE + 'Vol: ' + FG_GREEN + volStr + RESET +
             ' ' + FG_YELLOW + `${volPct}%` + RESET +
             '   ' + shuffleOn + '  ' + repeatOn + '  ' + repAllOn;

      // ── Separator ────────────────────────────────────────────────────────
      out += goto(10, 1) + DIM + FG_WHITE + '─'.repeat(COLS) + RESET;

      // ── Visualizer placeholder ────────────────────────────────────────────
      for (let vr = 0; vr < VIZ_ROWS; vr++) {
        out += goto(VIZ_START_ROW + vr, 3) + DIM + FG_GREEN + '░░'.repeat(VIZ_COLS) + RESET;
      }

      // ── Separator ────────────────────────────────────────────────────────
      out += goto(SEP_ROW3, 1) + DIM + FG_WHITE + '─'.repeat(COLS) + RESET;

      // ── Playlist ─────────────────────────────────────────────────────────
      const plTitle = '  Playlist' + (playlist.length > 0 ? ` (${playlist.length} tracks)` : '') +
                      '      [0-9] Jump to track #  [↑↓] Navigate playlist';
      out += goto(PL_HDR_ROW, 1) + BOLD + FG_CYAN + plTitle.padEnd(COLS, ' ') + RESET;

      if (playlist.length === 0) {
        out += goto(PL_START_ROW, 3) + DIM + FG_WHITE + 'No audio files found in /music/' + RESET;
        out += goto(PL_START_ROW + 1, 3) + DIM + FG_WHITE + 'Use the "upload" command to add .mp3 / .ogg / .wav files.' + RESET;
      } else {
        for (let i = 0; i < PL_ROWS; i++) {
          const idx      = i + state.plScroll;
          const isActive = idx === state.trackIdx;
          out += goto(PL_START_ROW + i, 1);
          if (idx >= playlist.length) {
            out += ' '.repeat(COLS) + RESET;
            continue;
          }
          const numStr   = String(idx + 1).padStart(4, ' ');
          const icon     = isActive ? (state.playing ? '▶ ' : '⏸ ') : '  ';
          const nameDisp = playlist[idx].length > COLS - 12
            ? playlist[idx].slice(0, COLS - 15) + '…'
            : playlist[idx];
          const line = `${numStr}. ${icon}${nameDisp}`;
          if (isActive) {
            out += REVERSE + BG_CYAN + FG_BLACK + line.padEnd(COLS, ' ') + RESET;
          } else {
            out += (idx % 2 === 0 ? FG_WHITE : DIM + FG_WHITE) + line.padEnd(COLS, ' ') + RESET;
          }
        }
      }

      // ── Controls bar ──────────────────────────────────────────────────────
      out += goto(CTRL_ROW, 1) + BG_BLUE + FG_WHITE;
      const statusText = state.status ||
        'Space:Play/Pause  ↑↓:Track  ←→:Seek  Shift+←→:Seek30s  +-:Vol  s:Shuffle  r:Rep1  a:Rep∞  Esc:Quit';
      out += (' ' + statusText).padEnd(COLS, ' ') + RESET;

      term.write(out);
      renderProgressRow();
      if (state.playing) term.write(renderViz());
    };

    // ── Init ─────────────────────────────────────────────────────────────────
    if (playlist.length > 0) loadTrack(startIdx);
    renderAll();

    // Progress polling
    const progressInterval = setInterval(() => {
      if (state.playing) renderProgressRow();
    }, 1000);

    // ── Exit helper ───────────────────────────────────────────────────────────
    const doExit = () => {
      stopAnim();
      clearInterval(progressInterval);
      if (state.audio) { state.audio.pause(); state.audio.src = ''; }
      Object.values(state.objectUrls).forEach(u => URL.revokeObjectURL(u));
      if (disposable) disposable.dispose();
      if (term._setAppMode) term._setAppMode(false);
      term.write(showCursor() + clearScreen());
      resolve();
    };

    // ── Input handler ─────────────────────────────────────────────────────────
    let disposable;
    disposable = term.onData((key) => {
      switch (key) {
        // Quit
        case '\x1b': doExit(); return;

        case ' ':                  playPause();                                break;
        case '\x1b[A':             prevTrack();                                break; // Up
        case '\x1b[B':             nextTrack();                                break; // Down
        case '\x1b[D':             seek(-5);  renderAll();                     break; // ←
        case '\x1b[C':             seek(5);   renderAll();                     break; // →
        case '\x1b[1;2D':          seek(-30); renderAll();                     break; // Shift+←
        case '\x1b[1;2C':          seek(30);  renderAll();                     break; // Shift+→
        case '+': case '=':        setVolume(0.05); renderAll();               break;
        case '-':                  setVolume(-0.05); renderAll();              break;

        case 's': case 'S':
          state.shuffle   = !state.shuffle;
          if (state.shuffle) state.repeatAll = false; // Disable repeat all when shuffle is on
          setStatus(state.shuffle ? 'Shuffle: ON' : 'Shuffle: OFF');
          renderAll(); break;

        case 'r': case 'R':
          state.repeat = !state.repeat;
          if (state.audio) state.audio.loop = false; // Manual repeat handling in 'ended' event
          setStatus(state.repeat ? 'Repeat one: ON' : 'Repeat one: OFF');
          renderAll(); break;

        case 'a': case 'A':
          state.repeatAll = !state.repeatAll;
          if (state.repeatAll) state.shuffle = false; // Disable shuffle when repeat all is on
          setStatus(state.repeatAll ? 'Repeat all: ON' : 'Repeat all: OFF');
          renderAll(); break;

        default:
          // Number keys 0-9: jump to track
          if (key >= '1' && key <= '9') {
            jumpToTrack(parseInt(key, 10) - 1);
          } else if (key === '0') {
            jumpToTrack(9);
          }
          break;
      }
    });
    }); // end Promise
  }
}
