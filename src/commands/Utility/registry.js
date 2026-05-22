const CONFIG_DIR = '/.config';
const CONFIG_FILE = '/.config/sculk.session.json';
const DEFAULT_REGISTRY_NAME = 'default';
const DEFAULT_REGISTRY_URL = 'https://store.ne-dos.ru';

function ensureConfigDir() {
  if (!window.fs.existsSync(CONFIG_DIR)) window.fs.mkdirSync(CONFIG_DIR);
}

function loadConfig() {
  try {
    return JSON.parse(window.fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {
      storeApi: DEFAULT_REGISTRY_URL,
      registries: {
        [DEFAULT_REGISTRY_NAME]: DEFAULT_REGISTRY_URL,
      },
      activeRegistry: DEFAULT_REGISTRY_NAME,
      session: '',
      account: null,
    };
  }
}

function saveConfig(config) {
  ensureConfigDir();
  window.fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function normalizeUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/\/$/, '');
  }
  return `https://${trimmed}`.replace(/\/$/, '');
}

function normalizeState(config) {
  if (!config.registries || typeof config.registries !== 'object') {
    config.registries = {};
  }

  if (!config.registries[DEFAULT_REGISTRY_NAME]) {
    config.registries[DEFAULT_REGISTRY_NAME] = DEFAULT_REGISTRY_URL;
  }

  if (!config.activeRegistry || !config.registries[config.activeRegistry]) {
    config.activeRegistry = DEFAULT_REGISTRY_NAME;
  }

  return config;
}

export default class RegistryCommand {
  description() {
    return 'Manage NE-DOS Store registries';
  }

  help(term) {
    term.writeln('');
    term.writeln('Usage:');
    term.writeln('  registry list');
    term.writeln('  registry current');
    term.writeln('  registry add <name> <url>');
    term.writeln('  registry remove <name>');
    term.writeln('  registry use <name>');
  }

  execute(term, params) {
    const action = String(params[1] || 'list').toLowerCase();
    const config = normalizeState(loadConfig());

    if (action === 'list') {
      const names = Object.keys(config.registries).sort((a, b) => a.localeCompare(b));
      if (!names.length) {
        term.writeln('No registries configured');
        return;
      }

      names.forEach((name) => {
        const marker = name === config.activeRegistry ? '*' : ' ';
        term.writeln(`${marker} ${name.padEnd(16)} ${config.registries[name]}`);
      });
      return;
    }

    if (action === 'current') {
      const name = config.activeRegistry;
      term.writeln(`Active registry: ${name}`);
      term.writeln(`URL: ${config.registries[name]}`);
      return;
    }

    if (action === 'add') {
      const name = String(params[2] || '').trim().toLowerCase();
      const url = normalizeUrl(params[3]);

      if (!name || !url) {
        term.writeln('Usage: registry add <name> <url>');
        return;
      }

      try {
        // URL() ensures user input is a valid absolute URL.
        const parsed = new URL(url);
        config.registries[name] = parsed.toString().replace(/\/$/, '');
        saveConfig(config);
        term.writeln(`Added registry: ${name} -> ${config.registries[name]}`);
      } catch {
        term.writeln('Invalid URL');
      }
      return;
    }

    if (action === 'remove') {
      const name = String(params[2] || '').trim().toLowerCase();
      if (!name) {
        term.writeln('Usage: registry remove <name>');
        return;
      }

      if (name === DEFAULT_REGISTRY_NAME) {
        term.writeln('Cannot remove default registry');
        return;
      }

      if (!config.registries[name]) {
        term.writeln(`Registry not found: ${name}`);
        return;
      }

      delete config.registries[name];
      if (config.activeRegistry === name) {
        config.activeRegistry = DEFAULT_REGISTRY_NAME;
      }
      saveConfig(config);
      term.writeln(`Removed registry: ${name}`);
      return;
    }

    if (action === 'use') {
      const name = String(params[2] || '').trim().toLowerCase();
      if (!name) {
        term.writeln('Usage: registry use <name>');
        return;
      }

      if (!config.registries[name]) {
        term.writeln(`Registry not found: ${name}`);
        return;
      }

      config.activeRegistry = name;
      config.storeApi = config.registries[name];
      saveConfig(config);
      term.writeln(`Active registry set to: ${name}`);
      term.writeln(`URL: ${config.registries[name]}`);
      return;
    }

    this.help(term);
  }
}