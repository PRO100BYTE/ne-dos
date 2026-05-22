const CONFIG_DIR = '/.config';
const CONFIG_FILE = '/.config/sculk.session.json';

function ensureConfigDir() {
  if (!window.fs.existsSync(CONFIG_DIR)) window.fs.mkdirSync(CONFIG_DIR);
}

function loadConfig() {
  try {
    return JSON.parse(window.fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {
      storeApi: 'http://localhost:8787',
      session: '',
      account: null,
    };
  }
}

function saveConfig(config) {
  ensureConfigDir();
  window.fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function apiUrl(base, path) {
  return `${String(base || 'http://localhost:8787').replace(/\/$/, '')}${path}`;
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

export default class SculkCommand {
  description() {
    return 'Authorize with Sculk ID and manage .nedos Passport session';
  }

  help(term) {
    term.writeln('');
    term.writeln('Usage:');
    term.writeln('  sculk config [storeApiUrl]');
    term.writeln('  sculk authorize                 Open Sculk authorize page');
    term.writeln('  sculk callback                  Show callback URL');
    term.writeln('  sculk auth token <token>');
    term.writeln('  sculk auth code <code>');
    term.writeln('  sculk account                   Show linked .nedos Passport account');
    term.writeln('  sculk logout');
  }

  async execute(term, params) {
    const action = String(params[1] || '').toLowerCase();
    const config = loadConfig();

    if (!action) {
      this.help(term);
      return;
    }

    if (action === 'config') {
      const value = params[2];
      if (value) {
        config.storeApi = value;
        saveConfig(config);
      }
      term.writeln(`Store API: ${config.storeApi}`);
      return;
    }

    if (action === 'authorize') {
      try {
        const data = await fetchJson(apiUrl(config.storeApi, '/api/auth/sculk/config'));
        const target = data.authorizeUrl;
        if (target) {
          window.open(target, '_blank', 'noopener,noreferrer');
          term.writeln(`Opened: ${target}`);
        } else {
          term.writeln('Authorize URL is not available');
        }
      } catch (error) {
        term.writeln(`Error: ${error.message}`);
      }
      return;
    }

    if (action === 'callback') {
      try {
        const data = await fetchJson(apiUrl(config.storeApi, '/api/auth/sculk/config'));
        term.writeln(`Callback URL: ${data.callbackUrl || 'http://localhost:8787/api/auth/sculk/callback'}`);
      } catch (error) {
        term.writeln(`Error: ${error.message}`);
      }
      return;
    }

    if (action === 'auth') {
      const mode = String(params[2] || '').toLowerCase();
      const value = String(params[3] || '');
      if ((mode !== 'token' && mode !== 'code') || !value) {
        term.writeln('Usage: sculk auth token <token>');
        term.writeln('   or: sculk auth code <code>');
        return;
      }

      try {
        const payload = { mode, [mode === 'token' ? 'token' : 'code']: value };
        const data = await fetchJson(apiUrl(config.storeApi, '/api/auth/sculk/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        config.session = data.session;
        config.account = data.account || null;
        saveConfig(config);
        window.__nedosPassportSession = data.session;
        term.writeln(`Signed in as ${(data.account && (data.account.displayName || data.account.username)) || 'NE-DOS user'}`);
      } catch (error) {
        if (error.status === 409 && error.body && error.body.code === 'SCULK_NOT_LINKED') {
          term.writeln('Sculk ID is not linked to .nedos Passport.');
          term.writeln('Please link existing NE-DOS account or register a new one in NE-DOS Store.');
          return;
        }
        term.writeln(`Error: ${error.message}`);
      }
      return;
    }

    if (action === 'account') {
      if (!config.session) {
        term.writeln('No active session. Use: sculk auth token <token>');
        return;
      }
      try {
        const data = await fetchJson(apiUrl(config.storeApi, '/api/auth/session'), {
          headers: { 'x-nedos-session': config.session },
        });
        config.account = data.account || null;
        saveConfig(config);
        term.writeln(`Account: ${(data.account && (data.account.displayName || data.account.username)) || 'Unknown'}`);
        term.writeln(`Roles: ${((data.account && data.account.roles) || []).join(', ') || 'none'}`);
      } catch (error) {
        term.writeln(`Error: ${error.message}`);
      }
      return;
    }

    if (action === 'logout') {
      config.session = '';
      config.account = null;
      saveConfig(config);
      window.__nedosPassportSession = '';
      term.writeln('Signed out');
      return;
    }

    this.help(term);
  }
}
