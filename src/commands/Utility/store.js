const CONFIG_DIR = '/.config';
const CONFIG_FILE = '/.config/sculk.session.json';

function ensureConfigDir() {
  if (!window.fs.existsSync(CONFIG_DIR)) window.fs.mkdirSync(CONFIG_DIR);
}

function ensureAppsDir() {
  if (!window.fs.existsSync('/apps')) window.fs.mkdirSync('/apps');
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

function absoluteSource(base, sourceUrl) {
  if (String(sourceUrl || '').startsWith('http://') || String(sourceUrl || '').startsWith('https://')) {
    return sourceUrl;
  }
  return apiUrl(base, sourceUrl);
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function registerFromSource(slug, source) {
  const blob = new Blob([source], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);
  try {
    const mod = await import(/* webpackIgnore: true */ blobUrl);
    if (mod && typeof mod.default === 'function') {
      window.registeredCommands[slug] = new mod.default();
      return true;
    }
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
  return false;
}

export default class StoreCommand {
  description() {
    return 'NE-DOS Store integration: search, inspect and install commands';
  }

  help(term) {
    term.writeln('');
    term.writeln('Usage:');
    term.writeln('  store config [storeApiUrl]');
    term.writeln('  store search [query]');
    term.writeln('  store info <slug>');
    term.writeln('  store install <slug>');
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

    if (action === 'search') {
      const query = params.slice(2).join(' ').trim();
      try {
        const url = apiUrl(config.storeApi, `/api/commands${query ? `?query=${encodeURIComponent(query)}` : ''}`);
        const data = await fetchJson(url);
        const items = (data.items || []).slice(0, 12);
        if (!items.length) {
          term.writeln('No commands found');
          return;
        }
        items.forEach((item) => {
          term.writeln(`${item.slug.padEnd(16)}  ${item.version.padEnd(8)}  ${item.description}`);
        });
      } catch (error) {
        term.writeln(`Error: ${error.message}`);
      }
      return;
    }

    if (action === 'info') {
      const slug = String(params[2] || '').trim();
      if (!slug) {
        term.writeln('Usage: store info <slug>');
        return;
      }
      try {
        const data = await fetchJson(apiUrl(config.storeApi, `/api/commands/${encodeURIComponent(slug)}`));
        term.writeln(`Name: ${data.name}`);
        term.writeln(`Version: ${data.version}`);
        term.writeln(`Origin: ${data.origin}`);
        term.writeln(`Category: ${data.category}`);
        term.writeln(`Source: ${data.sourceUrl}`);
        term.writeln(`Description: ${data.description}`);
      } catch (error) {
        term.writeln(`Error: ${error.message}`);
      }
      return;
    }

    if (action === 'install') {
      const slug = String(params[2] || '').trim();
      if (!slug) {
        term.writeln('Usage: store install <slug>');
        return;
      }
      try {
        const hint = await fetchJson(apiUrl(config.storeApi, `/api/commands/${encodeURIComponent(slug)}/install`));
        const sourceRes = await fetch(absoluteSource(config.storeApi, hint.sourceUrl));
        if (!sourceRes.ok) throw new Error(`Failed to download package: HTTP ${sourceRes.status}`);
        const source = await sourceRes.text();

        ensureAppsDir();
        const target = `/apps/${slug}.js`;
        window.fs.writeFileSync(target, source);

        const registered = await registerFromSource(slug, source);
        await fetch(apiUrl(config.storeApi, `/api/commands/${encodeURIComponent(slug)}/install-track`), { method: 'POST' }).catch(() => {});

        term.writeln(`Saved: ${target}`);
        if (registered) {
          term.writeln(`Registered command: ${slug}`);
        } else {
          term.writeln('Saved package, but auto-register failed.');
          term.writeln(`You can load manually from source: ${hint.sourceUrl}`);
        }
      } catch (error) {
        term.writeln(`Error: ${error.message}`);
      }
      return;
    }

    this.help(term);
  }
}
