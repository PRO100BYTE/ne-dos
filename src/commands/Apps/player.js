import path from "path-browserify";
import { GetDriveRoot, PrepareInternal } from "../Filesystem/StorageManager";

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
    term.writeln("  Upload audio first: upload  (saves to current drive \\music)");
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
    term.writeln("  v            Visualizer sensitivity (Low/Normal/High)");
    term.writeln("  t            Visualizer turbo mode (extra punch)");
    term.writeln("  Esc          Quit player");
  }

  execute(term, params, currentDirectory, setDirectory) {
    return new Promise((resolve) => {
    const COLS = term.cols;
    const ROWS = term.rows;

    if (term._setAppMode) term._setAppMode(true);

    // ── Layout constants ───────────────────────────────────────────────────────
    const VIZ_ROWS      = 11;                       // rows for the visualizer (+5 for extra punch)
    let VIZ_COLS        = Math.max(16, term.cols);  // full-width frequency bands (dynamic on resize)
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

    const driveRoot = GetDriveRoot(currentDirectory);
    const musicDir = (driveRoot === '/' ? '/music' : `${driveRoot}/music`);

    // ── Ensure <drive>/music ──────────────────────────────────────────────────
    try { if (!window.fs.existsSync(musicDir)) window.fs.mkdirSync(musicDir); } catch {}

    // ── Build playlist ────────────────────────────────────────────────────────
    let playlist = [];
    let startIdx = 0;
    
    // If a track name/path was given as param, try to use it directly or find it in /music
    if (params[1]) {
      const preparedArg = PrepareInternal(params[1]);
      const targetPath = preparedArg.startsWith('/') ? preparedArg : path.join(musicDir, preparedArg);
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
        playlist = window.fs.readdirSync(musicDir)
          .filter(f => AUDIO_EXT.some(e => f.toLowerCase().endsWith(e)))
          .sort();
      } catch {}
    } else if (playlist.length === 1) {
      // If we loaded a single file, now also add other files from /music to the playlist
      try {
        const otherFiles = window.fs.readdirSync(musicDir)
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
      vizSensitivity: 'Low',
      vizTurbo:      false,
    };
    let isExiting = false;
    let audioEndedHandler = null;
    let audioErrorHandler = null;
    let appCleanupHook = null;

    const setStatus = (msg) => {
      if (isExiting) return;
      state.status = msg;
      if (state.statusTimeout) clearTimeout(state.statusTimeout);
      if (msg) {
        state.statusTimeout = setTimeout(() => {
          if (isExiting) return;
          state.status = '';
          renderAll();
        }, 3000);
      }
    };

    // ── Visualizer bars ───────────────────────────────────────────────────────
    let beatBars  = Array(VIZ_COLS).fill(0);
    let barEnvelope = Array(VIZ_COLS).fill(0);
    let animFrame = null;
    let audioCtx = null;
    let analyser = null;
    let sourceNode = null;
    let freqData = null;
    let prevFreqData = null;
    let vizPeak = 0.08;

    const ensureVizWidth = () => {
      const colsNow = Math.max(16, term.cols);
      if (colsNow === VIZ_COLS) return;
      if (colsNow > VIZ_COLS) {
        beatBars = beatBars.concat(Array(colsNow - VIZ_COLS).fill(0));
        barEnvelope = barEnvelope.concat(Array(colsNow - VIZ_COLS).fill(0));
      } else {
        beatBars = beatBars.slice(0, colsNow);
        barEnvelope = barEnvelope.slice(0, colsNow);
      }
      VIZ_COLS = colsNow;
    };

    const cleanupAudioGraph = () => {
      try { if (sourceNode) sourceNode.disconnect(); } catch {}
      try { if (analyser) analyser.disconnect(); } catch {}
      sourceNode = null;
      analyser = null;
      freqData = null;
      prevFreqData = null;
      vizPeak = 0.08;
      if (audioCtx) {
        const ctx = audioCtx;
        audioCtx = null;
        try { ctx.close(); } catch {}
      }
    };

    const setupAudioGraph = (audio) => {
      cleanupAudioGraph();
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audioCtx = new Ctx();
        sourceNode = audioCtx.createMediaElementSource(audio);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.56;
        sourceNode.connect(analyser);
        analyser.connect(audioCtx.destination);
        freqData = new Uint8Array(analyser.frequencyBinCount);
        prevFreqData = new Uint8Array(analyser.frequencyBinCount);
      } catch {
        cleanupAudioGraph();
      }
    };

    const stopAnim = () => {
      if (animFrame !== null) { clearTimeout(animFrame); animFrame = null; }
    };

    const animateBars = () => {
      if (isExiting) return;
      ensureVizWidth();
      if (!state.playing) {
        // Keep rendering while paused so bars fall smoothly instead of vanishing.
        barEnvelope = barEnvelope.map(v => Math.max(0, v * 0.74));
        beatBars = beatBars.map((v, i) => {
          const envRows = Math.min(VIZ_ROWS, barEnvelope[i] * VIZ_ROWS);
          return Math.max(envRows, v * 0.70);
        });
        term.write(hideCursor() + renderViz());

        // Stop timer only after bars have visually faded out.
        const stillVisible = barEnvelope.some(v => v > 0.01) || beatBars.some(v => v > 0.05);
        if (stillVisible) {
          animFrame = setTimeout(animateBars, state.vizTurbo ? 24 : 33);
        } else {
          animFrame = null;
        }
        return;
      }

      if (analyser && freqData) {
        analyser.getByteFrequencyData(freqData);
        const bins = freqData.length;
        let frameMean = 0;
        const profiles = {
          Low:    { sMul: 1.00, rise: 0.72, fall: 0.52, gainMin: 0.90, gainMax: 1.30, capRows: VIZ_ROWS * 0.94, gate: 0.010, gamma: 0.90, targetMean: 0.36 },
          Normal: { sMul: 1.08, rise: 0.80, fall: 0.48, gainMin: 0.84, gainMax: 1.34, capRows: VIZ_ROWS * 0.96, gate: 0.008, gamma: 0.88, targetMean: 0.39 },
          High:   { sMul: 1.24, rise: 0.90, fall: 0.44, gainMin: 0.92, gainMax: 1.42, capRows: VIZ_ROWS * 0.99, gate: 0.006, gamma: 0.84, targetMean: 0.43 },
        };
        const baseProfile = profiles[state.vizSensitivity] || profiles.Low;
        const profile = state.vizTurbo
          ? {
              ...baseProfile,
              sMul: baseProfile.sMul * 1.18,
              rise: Math.min(0.97, baseProfile.rise * 1.16),
              fall: Math.min(0.78, baseProfile.fall * 1.28),
              gainMax: baseProfile.gainMax * 1.10,
              gate: Math.max(0.003, baseProfile.gate * 0.75),
              targetMean: baseProfile.targetMean * 1.12,
            }
          : baseProfile;

        for (let i = 0; i < VIZ_COLS; i++) {
          // Frequency mapping that keeps energy distributed across the whole width.
          const from = i / VIZ_COLS;
          const to = (i + 1) / VIZ_COLS;
          const start = Math.max(0, Math.min(bins - 1, Math.floor(Math.pow(from, 1.28) * (bins - 1))));
          const end = Math.max(start + 1, Math.min(bins, Math.floor(Math.pow(to, 1.28) * (bins - 1))));
          let sum = 0;
          let flux = 0;
          for (let j = start; j < end; j++) sum += freqData[j];
          for (let j = start; j < end; j++) flux += Math.abs(freqData[j] - prevFreqData[j]);
          const avg = sum / (end - start);
          const delta = flux / (end - start);

          // Dynamic range shaping with lightweight noise gate and transient boost.
          const avgNorm = Math.max(0, (avg - 8) / 240);
          const deltaNorm = Math.max(0, (delta - 4) / 230);
          const bandPos = i / VIZ_COLS;
          const lowKick = 1.20 - Math.min(0.26, bandPos * 0.26);
          const bandTilt = (0.98 + bandPos * 0.10) * lowKick;
          const raw = (avgNorm * 0.66 + deltaNorm * 0.34) * bandTilt * profile.sMul;
          const gated = Math.max(0, raw - profile.gate);
          const target = Math.pow(Math.min(1, gated), profile.gamma);
          frameMean += target;

          // Fast rise, slower fall for a lively but readable spectrum.
          if (target > barEnvelope[i]) {
            barEnvelope[i] += (target - barEnvelope[i]) * profile.rise;
          } else {
            barEnvelope[i] += (target - barEnvelope[i]) * profile.fall;
          }
        }

        // Adaptive normalization by average energy (not peak), so the whole width breathes.
        frameMean = frameMean / Math.max(1, VIZ_COLS);
        vizPeak = Math.max(frameMean, vizPeak * 0.93);
        const meanGain = profile.targetMean / Math.max(vizPeak, 0.05);
        const gain = Math.max(profile.gainMin, Math.min(profile.gainMax, meanGain));
        for (let i = 0; i < VIZ_COLS; i++) {
          const scaled = Math.max(0, Math.min(1, barEnvelope[i] * gain));
          beatBars[i] = Math.min(profile.capRows, scaled * VIZ_ROWS);
        }

        prevFreqData.set(freqData);
      } else {
        barEnvelope = barEnvelope.map(v => Math.max(0, v * 0.58));
        beatBars = beatBars.map(v => Math.max(0, v * 0.56));
      }

      term.write(hideCursor() + renderViz());
      animFrame = setTimeout(animateBars, state.vizTurbo ? 24 : 33);
    };

    // Render the visualizer in-place (no clearScreen, just overwrite the rows)
    const renderViz = () => {
      ensureVizWidth();
      let out = '';
      const BLOCKS = ' ▁▂▃▄▅▆▇█';
      for (let vr = 0; vr < VIZ_ROWS; vr++) {
        out += goto(VIZ_START_ROW + vr, 1);
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
          out += color + ch + RESET;
        }
      }
      return out;
    };

    // ── Audio engine ──────────────────────────────────────────────────────────
    const getUrl = (name) => {
      if (state.objectUrls[name]) return state.objectUrls[name];
      try {
        const filePath = name.startsWith('/') ? name : `${musicDir}/${name}`;
        const buf  = window.fs.readFileSync(filePath);
        const url  = URL.createObjectURL(new Blob([buf]));
        state.objectUrls[name] = url;
        return url;
      } catch { return null; }
    };

    const getFileInfo = (name) => {
      try {
        const st   = window.fs.statSync(`${musicDir}/${name}`);
        const ext  = path.extname(name).toUpperCase().slice(1) || '?';
        return { size: st.size, ext };
      } catch { return { size: 0, ext: '?' }; }
    };

    const loadTrack = (idx, autoPlay = false) => {
      stopAnim();
      if (state.audio) {
        if (audioEndedHandler) state.audio.removeEventListener('ended', audioEndedHandler);
        if (audioErrorHandler) state.audio.removeEventListener('error', audioErrorHandler);
        state.audio.pause();
        state.audio.src = '';
        state.audio = null;
      }
      cleanupAudioGraph();
      if (!playlist.length) return;
      const url = getUrl(playlist[idx]);
      if (!url) { setStatus(`Cannot load: ${playlist[idx]}`); return; }
      const audio = new Audio(url);
      audio.volume = state.volume;
      audio.loop   = state.repeat;
      state.audio  = audio;
      setupAudioGraph(audio);
      audioEndedHandler = () => {
        if (isExiting) return;
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
      };
      audioErrorHandler = () => {
        if (isExiting) return;
        setStatus(`Error loading: ${playlist[idx]}`);
        renderAll();
      };
      audio.addEventListener('ended', audioEndedHandler);
      audio.addEventListener('error', audioErrorHandler);
      if (autoPlay) {
        if (audioCtx && audioCtx.state === 'suspended') {
          audioCtx.resume().catch(() => {});
        }
        audio.play().catch(e => { setStatus(`Play error: ${e.message}`); });
        state.playing = true;
        animateBars();
      }
    };

    const playPause = () => {
      if (!playlist.length) { setStatus(`No audio files in ${musicDir}`); renderAll(); return; }
      if (!state.audio) loadTrack(state.trackIdx);
      if (state.playing) {
        state.audio.pause(); state.playing = false;
        // Keep animation loop alive briefly so spectrum falls smoothly.
        if (animFrame === null) animateBars();
      } else {
        if (audioCtx && audioCtx.state === 'suspended') {
          audioCtx.resume().catch(() => {});
        }
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
      if (isExiting) return;
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
      if (isExiting) return;
      ensureVizWidth();
      const trackName = playlist.length > 0 ? playlist[state.trackIdx] : '(no tracks)';
      const playIcon  = state.playing ? '▶' : '⏸';
      const volPct    = Math.round(state.volume * 100);
      const volBars   = Math.round(state.volume * 20);
      const volStr    = '█'.repeat(volBars) + '░'.repeat(20 - volBars);
      const shuffleOn = state.shuffle   ? BOLD + FG_CYAN  + '[SHUFFLE]' + RESET : DIM + FG_WHITE + '[shuffle]' + RESET;
      const repeatOn  = state.repeat    ? BOLD + FG_YELLOW + '[REPEAT 1]' + RESET : DIM + FG_WHITE + '[repeat1]' + RESET;
      const repAllOn  = state.repeatAll ? BOLD + FG_GREEN  + '[REPEAT ALL]' + RESET : DIM + FG_WHITE + '[repeat∞]' + RESET;
      const turboOn   = state.vizTurbo  ? BOLD + FG_MAGENTA + '[TURBO]' + RESET : DIM + FG_WHITE + '[turbo]' + RESET;

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
              '   ' + shuffleOn + '  ' + repeatOn + '  ' + repAllOn + '  ' + turboOn;

      // ── Separator ────────────────────────────────────────────────────────
      out += goto(10, 1) + DIM + FG_WHITE + '─'.repeat(COLS) + RESET;

      // ── Visualizer placeholder ────────────────────────────────────────────
      for (let vr = 0; vr < VIZ_ROWS; vr++) {
        out += goto(VIZ_START_ROW + vr, 1) + DIM + FG_GREEN + '░'.repeat(VIZ_COLS) + RESET;
      }

      // ── Separator ────────────────────────────────────────────────────────
      out += goto(SEP_ROW3, 1) + DIM + FG_WHITE + '─'.repeat(COLS) + RESET;

      // ── Playlist ─────────────────────────────────────────────────────────
      const plTitle = '  Playlist' + (playlist.length > 0 ? ` (${playlist.length} tracks)` : '') +
                      '      [0-9] Jump to track #  [↑↓] Navigate playlist';
      out += goto(PL_HDR_ROW, 1) + BOLD + FG_CYAN + plTitle.padEnd(COLS, ' ') + RESET;

      if (playlist.length === 0) {
        out += goto(PL_START_ROW, 3) + DIM + FG_WHITE + `No audio files found in ${musicDir}` + RESET;
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
        'Space:Play/Pause  ↑↓:Track  ←→:Seek  Shift+←→:Seek30s  +-:Vol  s:Shuffle  r:Rep1  a:Rep∞  v:Sens  t:Turbo  Esc:Quit';
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
      if (isExiting) return;
      isExiting = true;
      stopAnim();
      clearInterval(progressInterval);
      if (state.statusTimeout) clearTimeout(state.statusTimeout);
      if (state.audio) {
        if (audioEndedHandler) state.audio.removeEventListener('ended', audioEndedHandler);
        if (audioErrorHandler) state.audio.removeEventListener('error', audioErrorHandler);
        state.audio.pause();
        state.audio.src = '';
      }
      cleanupAudioGraph();
      Object.values(state.objectUrls).forEach(u => URL.revokeObjectURL(u));
      if (window.__nedosActiveAppCleanup === appCleanupHook) {
        window.__nedosActiveAppCleanup = null;
      }
      if (disposable) disposable.dispose();
      if (term._setAppMode) term._setAppMode(false);
      term.write(showCursor() + clearScreen());
      resolve();
    };

    // Let the shell force-close this app on dev reload/unmount.
    appCleanupHook = () => {
      try { doExit(); } catch {}
    };
    window.__nedosActiveAppCleanup = appCleanupHook;

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

        case 'v': case 'V': {
          state.vizSensitivity = state.vizSensitivity === 'Low'
            ? 'Normal'
            : (state.vizSensitivity === 'Normal' ? 'High' : 'Low');
          setStatus(`Visualizer sensitivity: ${state.vizSensitivity}`);
          renderAll();
          break;
        }

        case 't': case 'T':
          state.vizTurbo = !state.vizTurbo;
          setStatus(`Visualizer turbo: ${state.vizTurbo ? 'ON' : 'OFF'}`);
          renderAll();
          break;

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
