import path from "path-browserify";

const normalizeSlashes = (p) => p.replaceAll('\\', '/').replace(/\/+/g, '/');

export const GetDriveRoot = (dir) => {
  const d = normalizeSlashes(dir || '/');
  if (d === '/tempfs' || d.startsWith('/tempfs/')) return '/tempfs';
  if (d === '/netboot' || d.startsWith('/netboot/')) return '/netboot';
  return '/';
};

export const FormatDirectory = (dir) => {
  const d = normalizeSlashes(dir || '/');
  if (d === '/tempfs') return 'T:\\';
  if (d.startsWith('/tempfs/')) return 'T:' + d.substring('/tempfs'.length).replaceAll('/', '\\');
  if (d === '/netboot') return 'N:\\';
  if (d.startsWith('/netboot/')) return 'N:' + d.substring('/netboot'.length).replaceAll('/', '\\');
  return 'C:' + d.replaceAll('/', '\\');
};

export const PrepareInternal = (dir) => {
  let d = normalizeSlashes((dir || '').trim());
  if (!d) return d;

  // Explicit drive prefix always wins
  const m = d.match(/^([A-Za-z]):(.*)$/);
  if (m) {
    const drive = m[1].toUpperCase();
    const tailRaw = m[2] || '/';
    const tail = tailRaw.startsWith('/') ? tailRaw : '/' + tailRaw;
    if (drive === 'T') return normalizeSlashes('/tempfs' + tail);
    if (drive === 'N') return normalizeSlashes('/netboot' + tail);
    return normalizeSlashes(tail);
  }

  // Absolute slash path is scoped to active drive root (except C:)
  if (d.startsWith('/')) {
    const activeRoot = window.__nedosCurrentDriveRoot || '/';
    if (activeRoot !== '/' && d !== '/tempfs' && d !== '/netboot' && !d.startsWith('/tempfs/') && !d.startsWith('/netboot/')) {
      return normalizeSlashes(activeRoot + d);
    }
    return d;
  }

  return d;
};

export const ResolveInCurrentDrive = (currentDirectory, rawPath) => {
  const prepared = PrepareInternal(rawPath);
  const resolved = normalizeSlashes(path.resolve(currentDirectory, prepared));
  const root = GetDriveRoot(currentDirectory);
  if (root === '/') return resolved;
  if (resolved === root || resolved.startsWith(root + '/')) return resolved;
  return root;
};