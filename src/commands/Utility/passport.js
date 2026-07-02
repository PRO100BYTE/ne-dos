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

export default class PassportCommand {
  description() {
    return 'Manage local .nedos Passport account for NE-DOS Store';
  }

  help(term) {
    term.writeln('');
    term.writeln('Usage:');
    term.writeln('  passport config [storeApiUrl]');
    term.writeln('  passport register <username> <password> [displayName]');
    term.writeln('  passport login <username> <password>');
    term.writeln('  passport whoami');
    term.writeln('  passport logout');
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

    if (action === 'register') {
      const username = String(params[2] || '').trim();
      const password = String(params[3] || '');
      const displayName = params.slice(4).join(' ').trim();
      if (!username || !password) {
        term.writeln('Usage: passport register <username> <password> [displayName]');
        return;
      }
      try {
        const data = await fetchJson(apiUrl(config.storeApi, '/api/auth/passport/register'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, displayName }),
        });
        config.session = data.session;
        config.account = data.account || null;
        saveConfig(config);
        window.__nedosPassportSession = data.session;
        term.writeln(`Registered and signed in: ${username}`);
      } catch (error) {
        term.writeln(`Error: ${error.message}`);
      }
      return;
    }

    if (action === 'login') {
      const username = String(params[2] || '').trim();
      const password = String(params[3] || '');
      if (!username || !password) {
        term.writeln('Usage: passport login <username> <password>');
        return;
      }
      try {
        const data = await fetchJson(apiUrl(config.storeApi, '/api/auth/passport/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        config.session = data.session;
        config.account = data.account || null;
        saveConfig(config);
        window.__nedosPassportSession = data.session;
        term.writeln(`Signed in as ${(data.account && (data.account.displayName || data.account.username)) || username}`);
      } catch (error) {
        term.writeln(`Error: ${error.message}`);
      }
      return;
    }

    if (action === 'whoami') {
      if (!config.session) {
        term.writeln('No active .nedos Passport session');
        return;
      }
      try {
        const data = await fetchJson(apiUrl(config.storeApi, '/api/auth/session'), {
          headers: { 'x-nedos-session': config.session },
        });
        config.account = data.account || null;
        saveConfig(config);
        term.writeln(`User: ${(data.account && (data.account.displayName || data.account.username)) || 'Unknown'}`);
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
