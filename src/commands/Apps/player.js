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
const FG_BLUE    = CSI + '34m';
const FG_MAGENTA = CSI + '35m';
const BG_BLACK   = CSI + '40m';
const BG_BLUE    = CSI + '44m';
const BG_CYAN    = CSI + '46m';

const goto        = (r, c) => `${CSI}${r};${c}H`;
const clearScreen = ()     => `${CSI}2J${CSI}H`;
const hideCursor  = ()     => `${CSI}?25l`;
const showCursor  = ()     => `${CSI}?25h`;

const AUDIO_EXT   = ['.mp3', '.ogg', '.wav', '.flac', '.aac', '.m4a'];
// Use only the most informative part of FFT to avoid a "dead" right edge.
const SPECTRUM_BIN_CUTOFF = 0.80;

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
    term.writeln("  w            Toggle visualizer mode (Bars / Oscilloscope / Fire / Mirror / Pulse / Rain / Wave)");
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
      vizMode:       'bars',  // 'bars' | 'oscilloscope' | 'fire' | 'mirror' | 'pulse' | 'rain' | 'wave'
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
    let oscData = null;  // Time domain data for oscilloscope
    let oscNormSmoothed = Array(VIZ_COLS).fill(0);
    let oscAmpSmooth = 0.42;
    let fireCols = Array(VIZ_COLS).fill(0).map(() => Array(VIZ_ROWS).fill(0));
    let rainDrops = Array(VIZ_COLS).fill(0).map(() => ({ y: Math.random() * VIZ_ROWS, speed: 0.6 + Math.random() * 1.4, head: 0 }));
    let vizPeak = 0.08;

    const ensureVizWidth = () => {
      const colsNow = Math.max(16, term.cols);
      if (colsNow === VIZ_COLS) return;
      if (colsNow > VIZ_COLS) {
        beatBars = beatBars.concat(Array(colsNow - VIZ_COLS).fill(0));
        barEnvelope = barEnvelope.concat(Array(colsNow - VIZ_COLS).fill(0));
        oscNormSmoothed = oscNormSmoothed.concat(Array(colsNow - VIZ_COLS).fill(0));
        fireCols = fireCols.concat(Array(colsNow - VIZ_COLS).fill(0).map(() => Array(VIZ_ROWS).fill(0)));
        rainDrops = rainDrops.concat(Array(colsNow - VIZ_COLS).fill(0).map(() => ({ y: Math.random() * VIZ_ROWS, speed: 0.6 + Math.random() * 1.4, head: 0 })));
      } else {
        beatBars = beatBars.slice(0, colsNow);
        barEnvelope = barEnvelope.slice(0, colsNow);
        oscNormSmoothed = oscNormSmoothed.slice(0, colsNow);
        fireCols = fireCols.slice(0, colsNow);
        rainDrops = rainDrops.slice(0, colsNow);
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
      oscNormSmoothed = Array(VIZ_COLS).fill(0);
      oscAmpSmooth = 0.42;
      fireCols = Array(VIZ_COLS).fill(0).map(() => Array(VIZ_ROWS).fill(0));
      rainDrops = Array(VIZ_COLS).fill(0).map(() => ({ y: Math.random() * VIZ_ROWS, speed: 0.6 + Math.random() * 1.4, head: 0 }));
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
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.56;
        sourceNode.connect(analyser);
        analyser.connect(audioCtx.destination);
        freqData = new Uint8Array(analyser.frequencyBinCount);
        prevFreqData = new Uint8Array(analyser.frequencyBinCount);
        oscData = new Uint8Array(analyser.fftSize);
      } catch {
        cleanupAudioGraph();
      }
    };

    const stopAnim = () => {
      if (animFrame !== null) { clearTimeout(animFrame); animFrame = null; }
    };

    const getVizFrame = () => {
      return { left: 1, drawCols: VIZ_COLS };
    };

    const mapLocalToGlobalCol = (localCol, localCols) => {
      if (localCols <= 1) return 0;
      return Math.max(0, Math.min(VIZ_COLS - 1, Math.round((localCol / (localCols - 1)) * (VIZ_COLS - 1))));
    };

    const updateFire = () => {
      ensureVizWidth();
      const cooling = state.vizTurbo ? 0.05 : 0.07;
      const diffusion = state.vizTurbo ? 0.82 : 0.74;
      const sparkBase = state.vizTurbo ? 0.42 : 0.32;

      // Cool and move heat mostly straight upward (minimal side drift).
      for (let x = 0; x < VIZ_COLS; x++) {
        for (let y = 0; y < VIZ_ROWS - 1; y++) {
          const below = fireCols[x][Math.min(VIZ_ROWS - 1, y + 1)];
          const below2 = fireCols[x][Math.min(VIZ_ROWS - 1, y + 2)] || below;
          const carry = (below * 0.78 + below2 * 0.22) * diffusion;
          const noise = (Math.random() - 0.5) * 0.015;
          fireCols[x][y] = Math.max(0, carry - cooling + noise);
        }
      }

      // Bottom sparks are driven by audio energy per column.
      for (let x = 0; x < VIZ_COLS; x++) {
        const barNorm = Math.max(0, Math.min(1, (beatBars[x] || 0) / VIZ_ROWS));
        const randomKick = Math.random() * 0.22;
        const spark = sparkBase + barNorm * 0.85 + randomKick;
        fireCols[x][VIZ_ROWS - 1] = Math.max(0, Math.min(1, spark));
      }
    };

    const decayFire = () => {
      ensureVizWidth();
      const decay = state.vizTurbo ? 0.91 : 0.88;
      const cool = state.vizTurbo ? 0.02 : 0.028;
      for (let x = 0; x < VIZ_COLS; x++) {
        for (let y = 0; y < VIZ_ROWS; y++) {
          fireCols[x][y] = Math.max(0, fireCols[x][y] * decay - cool);
        }
      }
    };

    const fireVisible = () => {
      for (let x = 0; x < VIZ_COLS; x++) {
        for (let y = 0; y < VIZ_ROWS; y++) {
          if (fireCols[x][y] > 0.03) return true;
        }
      }
      return false;
    };

    const updateRain = () => {
      ensureVizWidth();
      for (let x = 0; x < VIZ_COLS; x++) {
        const d = rainDrops[x];
        const energy = Math.max(0, Math.min(1, (beatBars[x] || 0) / VIZ_ROWS));
        d.speed = 0.45 + energy * 1.8 + (state.vizTurbo ? 0.4 : 0);
        d.y += d.speed * 0.28;
        d.head = energy;
        if (d.y >= VIZ_ROWS + 2) {
          d.y = -Math.random() * 3;
          d.speed = 0.5 + Math.random() * 1.6;
          d.head = 0;
        }
      }
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
        decayFire();
        term.write(hideCursor() + renderViz());

        // Stop timer only after bars have visually faded out.
        const stillVisible =
          barEnvelope.some(v => v > 0.01) ||
          beatBars.some(v => v > 0.05) ||
          fireVisible();
        if (stillVisible) {
          animFrame = setTimeout(animateBars, state.vizTurbo ? 16 : 20);
        } else {
          animFrame = null;
        }
        return;
      }

      if (analyser && freqData) {
        analyser.getByteFrequencyData(freqData);
         if (oscData) analyser.getByteTimeDomainData(oscData);
        const bins = freqData.length;
        const activeBins = Math.max(16, Math.min(bins, Math.floor(bins * SPECTRUM_BIN_CUTOFF)));
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
          // Linear spectrum mapping: lows (left), mids (center), highs (right).
          const start = Math.max(0, Math.min(activeBins - 1, Math.floor((i / VIZ_COLS) * activeBins)));
          const end = Math.max(start + 1, Math.min(activeBins, Math.floor(((i + 1) / VIZ_COLS) * activeBins)));
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
          const highBoost = 0.94 + bandPos * 0.58;
          const midBoost = 1 + Math.exp(-Math.pow((bandPos - 0.50) / 0.23, 2)) * 0.12;
          const lowTrim = 1 - Math.max(0, (0.24 - bandPos)) * 0.34;
          const bandTilt = highBoost * midBoost * lowTrim;
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

        // Keep low/mid/high zones visually balanced so the spectrum does not collapse to the left.
        const third = Math.max(1, Math.floor(VIZ_COLS / 3));
        const avgRange = (from, to) => {
          let sum = 0;
          let count = 0;
          for (let i = from; i < to; i++) {
            sum += barEnvelope[i] || 0;
            count += 1;
          }
          return count ? (sum / count) : 0;
        };
        const lowAvg = avgRange(0, third);
        const midAvg = avgRange(third, Math.min(VIZ_COLS, third * 2));
        const highAvg = avgRange(Math.min(VIZ_COLS, third * 2), VIZ_COLS);
        const meanAvg = Math.max(0.0001, (lowAvg + midAvg + highAvg) / 3);

        const lowComp = Math.max(0.78, Math.min(1.08, meanAvg / Math.max(lowAvg, 0.0001)));
        const midComp = Math.max(0.90, Math.min(1.22, meanAvg / Math.max(midAvg, 0.0001)));
        const highComp = Math.max(1.00, Math.min(1.36, meanAvg / Math.max(highAvg, 0.0001)));

        for (let i = 0; i < VIZ_COLS; i++) {
          const comp = i < third ? lowComp : (i < third * 2 ? midComp : highComp);
          barEnvelope[i] = Math.max(0, Math.min(1, barEnvelope[i] * comp));
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

      updateFire();
      updateRain();

      term.write(hideCursor() + renderViz());
      animFrame = setTimeout(animateBars, state.vizTurbo ? 16 : 20);
    };

    // Render oscilloscope (time-domain waveform)
    const renderOscilloscope = () => {
      ensureVizWidth();
      let out = '';
      const frame = getVizFrame();
      if (!oscData || !state.playing) {
        // Draw empty oscilloscope baseline
        const centerRow = VIZ_START_ROW + Math.floor(VIZ_ROWS / 2);
        for (let row = VIZ_START_ROW; row < VIZ_START_ROW + VIZ_ROWS; row++) {
          out += goto(row, frame.left);
          if (row === centerRow) {
            out += DIM + FG_CYAN + '┄'.repeat(frame.drawCols) + RESET;
          } else {
            out += ' '.repeat(frame.drawCols);
          }
        }
        return out;
      }
      
      const centerRowOffset = Math.floor(VIZ_ROWS / 2);
      const maxAmp = 128;

      // Lock to a stable zero-crossing so waveform does not "jump" frame-to-frame.
      const targetStart = Math.floor(oscData.length * 0.18);
      const targetEnd = Math.floor(oscData.length * 0.82);
      let zeroStart = targetStart;
      for (let i = targetStart + 1; i < targetEnd; i++) {
        const prev = oscData[i - 1] - 128;
        const curr = oscData[i] - 128;
        if (prev <= 0 && curr > 0) {
          zeroStart = i;
          break;
        }
      }
      const visibleSamples = Math.max(frame.drawCols * 2, Math.floor(oscData.length * 0.56));
      const sampleStep = visibleSamples / Math.max(1, frame.drawCols - 1);

      // Clear visualizer area + draw center baseline
      for (let row = 0; row < VIZ_ROWS; row++) {
        out += goto(VIZ_START_ROW + row, frame.left);
        if (row === centerRowOffset) {
          out += DIM + FG_CYAN + '┄'.repeat(frame.drawCols) + RESET;
        } else {
          out += ' '.repeat(frame.drawCols);
        }
      }

      // Map osc samples into terminal rows with temporal + spatial smoothing
      const timeSmooth = state.vizTurbo ? 0.44 : 0.30;
      const waveNorm = new Array(frame.drawCols);

      // Dynamic vertical normalization by peak amplitude for realistic response.
      let framePeak = 0.05;
      for (let i = 0; i < oscData.length; i++) {
        const n = Math.abs((oscData[i] - 128) / maxAmp);
        if (n > framePeak) framePeak = n;
      }
      oscAmpSmooth = oscAmpSmooth + (framePeak - oscAmpSmooth) * (state.vizTurbo ? 0.18 : 0.12);
      const ampGain = 0.68 / Math.max(0.08, oscAmpSmooth);

      for (let col = 0; col < frame.drawCols; col++) {
        const samplePos = zeroStart + col * sampleStep;
        const i0 = Math.max(0, Math.min(oscData.length - 1, Math.floor(samplePos)));
        const i1 = Math.max(0, Math.min(oscData.length - 1, i0 + 1));
        const frac = samplePos - i0;
        const v0 = (oscData[i0] - 128) / maxAmp;
        const v1 = (oscData[i1] - 128) / maxAmp;
        const interp = v0 + (v1 - v0) * frac;
        const rawNorm = Math.max(-1, Math.min(1, interp * ampGain));
        const dstCol = mapLocalToGlobalCol(col, frame.drawCols);
        oscNormSmoothed[dstCol] = oscNormSmoothed[dstCol] + (rawNorm - oscNormSmoothed[dstCol]) * timeSmooth;
        waveNorm[col] = oscNormSmoothed[dstCol];
      }

      for (let col = 0; col < frame.drawCols; col++) {
        const left = waveNorm[Math.max(0, col - 1)] || waveNorm[col] || 0;
        const curr = waveNorm[col] || 0;
        const right = waveNorm[Math.min(frame.drawCols - 1, col + 1)] || waveNorm[col] || 0;
        waveNorm[col] = (left + curr * 2 + right) / 4;
      }

      // Convert smoothed waveform to rows
      const waveRows = new Array(frame.drawCols);
      for (let col = 0; col < frame.drawCols; col++) {
        const normalized = waveNorm[col];
        const rowOffset = centerRowOffset - Math.round(normalized * (VIZ_ROWS / 2 - 1));
        waveRows[col] = Math.max(0, Math.min(VIZ_ROWS - 1, rowOffset));
      }

      const drawLineChar = (rowOffset, col, ch) => {
        out += goto(VIZ_START_ROW + rowOffset, frame.left + col);
        out += BOLD + FG_GREEN + ch + RESET;
      };

      // Draw connected waveform instead of separate dots
      drawLineChar(waveRows[0], 0, '─');
      for (let col = 1; col < frame.drawCols; col++) {
        const prev = waveRows[col - 1];
        const curr = waveRows[col];
        if (curr === prev) {
          drawLineChar(curr, col, '─');
          continue;
        }

        const step = curr > prev ? 1 : -1;
        let row = prev;
        while (row !== curr) {
          row += step;
          drawLineChar(row, col, step > 0 ? '╲' : '╱');
        }
      }
      
      return out;
    };

    const renderMirror = () => {
      ensureVizWidth();
      const frame = getVizFrame();
      let out = '';
      const mid = Math.floor(VIZ_ROWS / 2);

      for (let row = 0; row < VIZ_ROWS; row++) {
        out += goto(VIZ_START_ROW + row, frame.left) + ' '.repeat(frame.drawCols);
      }

      for (let col = 0; col < frame.drawCols; col++) {
        const src = mapLocalToGlobalCol(col, frame.drawCols);
        const h = Math.max(0, Math.min(mid, Math.round((beatBars[src] || 0) * (mid / VIZ_ROWS))));
        for (let i = 0; i < h; i++) {
          const up = mid - 1 - i;
          const down = mid + i;
          const ch = i === h - 1 ? '█' : '▓';
          out += goto(VIZ_START_ROW + up, frame.left + col) + BOLD + FG_CYAN + ch + RESET;
          if (down < VIZ_ROWS) {
            out += goto(VIZ_START_ROW + down, frame.left + col) + BOLD + FG_MAGENTA + ch + RESET;
          }
        }
      }
      return out;
    };

    const renderPulse = () => {
      ensureVizWidth();
      const frame = getVizFrame();
      let out = '';
      const centerRow = Math.floor(VIZ_ROWS / 2);
      const centerCol = Math.floor(frame.drawCols / 2);
      const lowBand = beatBars.slice(0, Math.max(2, Math.floor(VIZ_COLS * 0.18)));
      const energy = lowBand.length ? lowBand.reduce((a, b) => a + b, 0) / (lowBand.length * VIZ_ROWS) : 0;
      const t = Date.now() * 0.006;

      for (let row = 0; row < VIZ_ROWS; row++) {
        out += goto(VIZ_START_ROW + row, frame.left);
        for (let col = 0; col < frame.drawCols; col++) {
          const dx = (col - centerCol) / Math.max(1, frame.drawCols / 2);
          const dy = (row - centerRow) / Math.max(1, VIZ_ROWS / 2);
          const d = Math.sqrt(dx * dx + dy * dy);
          const wave = Math.sin((d * 13.0) - t * (1.6 + energy * 2.1));
          const glow = wave * 0.5 + 0.5;
          const val = glow * (0.35 + energy * 1.2);
          if (val > 0.82) out += BOLD + FG_WHITE + '█' + RESET;
          else if (val > 0.64) out += BOLD + FG_CYAN + '▓' + RESET;
          else if (val > 0.46) out += FG_CYAN + '▒' + RESET;
          else if (val > 0.30) out += DIM + FG_BLUE + '░' + RESET;
          else out += ' ';
        }
      }
      return out;
    };

    const renderRain = () => {
      ensureVizWidth();
      const frame = getVizFrame();
      let out = '';
      for (let row = 0; row < VIZ_ROWS; row++) {
        out += goto(VIZ_START_ROW + row, frame.left);
        for (let col = 0; col < frame.drawCols; col++) {
          const srcCol = mapLocalToGlobalCol(col, frame.drawCols);
          const drop = rainDrops[srcCol];
          const y = drop.y;
          const headRow = Math.round(y);
          const tail1 = headRow - 1;
          const tail2 = headRow - 2;
          if (row === headRow) {
            const color = drop.head > 0.65 ? BOLD + FG_WHITE : BOLD + FG_CYAN;
            out += color + '█' + RESET;
          } else if (row === tail1) {
            out += FG_CYAN + '▓' + RESET;
          } else if (row === tail2) {
            out += DIM + FG_BLUE + '▒' + RESET;
          } else {
            out += ' ';
          }
        }
      }
      return out;
    };

    const renderWave = () => {
      ensureVizWidth();
      const frame = getVizFrame();
      let out = '';
      const mid = Math.floor(VIZ_ROWS / 2);
      const t = Date.now() * 0.0045;

      for (let row = 0; row < VIZ_ROWS; row++) {
        out += goto(VIZ_START_ROW + row, frame.left) + ' '.repeat(frame.drawCols);
      }

      for (let col = 0; col < frame.drawCols; col++) {
        const src = mapLocalToGlobalCol(col, frame.drawCols);
        const spectrum = Math.max(0, Math.min(1, (beatBars[src] || 0) / VIZ_ROWS));
        const phase = t + col * 0.16;
        const wave = Math.sin(phase) * 0.42 + Math.sin(phase * 0.5) * 0.22;
        const row = Math.max(0, Math.min(VIZ_ROWS - 1, Math.round(mid - (wave + (spectrum - 0.5) * 0.9) * (VIZ_ROWS * 0.42))));
        out += goto(VIZ_START_ROW + row, frame.left + col) + BOLD + FG_MAGENTA + '█' + RESET;
        for (let y = row + 1; y < VIZ_ROWS; y++) {
          const dist = y - row;
          if (dist === 1) out += goto(VIZ_START_ROW + y, frame.left + col) + FG_CYAN + '▓' + RESET;
          else if (dist <= 3) out += goto(VIZ_START_ROW + y, frame.left + col) + DIM + FG_BLUE + '▒' + RESET;
        }
      }
      return out;
    };

    const renderFire = () => {
      ensureVizWidth();
      let out = '';
      const frame = getVizFrame();
      const toGlyph = (v) => {
        if (v < 0.08) return DIM + FG_BLACK + ' ' + RESET;
        if (v < 0.18) return DIM + FG_RED + '░' + RESET;
        if (v < 0.34) return FG_RED + '▒' + RESET;
        if (v < 0.54) return BOLD + FG_RED + '▓' + RESET;
        if (v < 0.74) return BOLD + FG_YELLOW + '▓' + RESET;
        return BOLD + FG_WHITE + '█' + RESET;
      };

      for (let row = 0; row < VIZ_ROWS; row++) {
        out += goto(VIZ_START_ROW + row, frame.left);
        for (let col = 0; col < frame.drawCols; col++) {
          const srcCol = mapLocalToGlobalCol(col, frame.drawCols);
          const y = row;
          const flicker = (Math.random() - 0.5) * 0.05;
          const heat = Math.max(0, Math.min(1, fireCols[srcCol][y] + flicker));
          out += toGlyph(heat);
        }
      }
      return out;
    };

    // Render the visualizer in-place (no clearScreen, just overwrite the rows)
    const renderViz = () => {
      let out = '';
      for (let vr = 0; vr < VIZ_ROWS; vr++) {
        out += goto(VIZ_START_ROW + vr, 1) + ' '.repeat(VIZ_COLS);
      }

      if (state.vizMode === 'oscilloscope') {
        return out + renderOscilloscope();
      }
      if (state.vizMode === 'fire') {
        return out + renderFire();
      }
      if (state.vizMode === 'mirror') {
        return out + renderMirror();
      }
      if (state.vizMode === 'pulse') {
        return out + renderPulse();
      }
      if (state.vizMode === 'rain') {
        return out + renderRain();
      }
      if (state.vizMode === 'wave') {
        return out + renderWave();
      }
      
      ensureVizWidth();
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
      const modeLabel = state.vizMode === 'bars'
        ? 'BARS'
        : (state.vizMode === 'oscilloscope'
          ? 'OSC'
          : (state.vizMode === 'fire'
            ? 'FIRE'
            : (state.vizMode === 'mirror' ? 'MIRROR' : (state.vizMode === 'pulse' ? 'PULSE' : (state.vizMode === 'rain' ? 'RAIN' : 'WAVE')))));
      const modeOn    = BOLD + FG_CYAN + `[${modeLabel}]` + RESET;

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
              '   ' + shuffleOn + '  ' + repeatOn + '  ' + repAllOn + '  ' + turboOn + '  ' + modeOn;

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
        'Space:Play/Pause  ↑↓:Track  ←→:Seek  Shift+←→:Seek30s  +-:Vol  s:Shuffle  r:Rep1  a:Rep∞  v:Sens  t:Turbo  w:VizMode  Esc:Quit';
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

        case 'w': case 'W': {
          const modeOrder = ['bars', 'oscilloscope', 'fire', 'mirror', 'pulse', 'rain', 'wave'];
          const curr = Math.max(0, modeOrder.indexOf(state.vizMode));
          state.vizMode = modeOrder[(curr + 1) % modeOrder.length];
          const modeName = state.vizMode === 'bars'
            ? 'Bars'
            : (state.vizMode === 'oscilloscope'
              ? 'Oscilloscope'
              : (state.vizMode === 'fire'
                ? 'Fire'
                : (state.vizMode === 'mirror' ? 'Mirror' : (state.vizMode === 'pulse' ? 'Pulse' : (state.vizMode === 'rain' ? 'Rain' : 'Wave')))));
          setStatus(`Visualizer mode: ${modeName}`);
          renderAll();
          break;
        }

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
