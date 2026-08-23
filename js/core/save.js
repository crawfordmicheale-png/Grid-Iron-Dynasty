// Save/load. The league serialises to a plain JSON tree -- every cross-reference
// in the model is an id string rather than an object pointer, so there are no
// cycles to break here and a save file is human-readable.

export const SAVE_VERSION = 1;
const PREFIX = 'gid.save.';
const INDEX_KEY = 'gid.saves';

function storage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    localStorage.setItem('gid.probe', '1');
    localStorage.removeItem('gid.probe');
    return localStorage;
  } catch {
    return null; // private window, blocked storage, headless node
  }
}

export function envelope(state, meta = {}) {
  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    meta,
    state,
  };
}

export function listSaves() {
  const store = storage();
  if (!store) return [];
  try {
    return JSON.parse(store.getItem(INDEX_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeIndex(entries) {
  const store = storage();
  if (!store) return;
  store.setItem(INDEX_KEY, JSON.stringify(entries));
}

export function saveGame(slot, state, meta = {}) {
  const store = storage();
  const env = envelope(state, meta);
  if (!store) return { ok: false, reason: 'storage-unavailable', envelope: env };
  try {
    store.setItem(PREFIX + slot, JSON.stringify(env));
  } catch (err) {
    return { ok: false, reason: 'quota', error: String(err), envelope: env };
  }
  const index = listSaves().filter((s) => s.slot !== slot);
  index.push({ slot, savedAt: env.savedAt, meta });
  index.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
  writeIndex(index);
  return { ok: true, envelope: env };
}

export function loadGame(slot) {
  const store = storage();
  if (!store) return null;
  const raw = store.getItem(PREFIX + slot);
  if (!raw) return null;
  let env;
  try {
    env = JSON.parse(raw);
  } catch {
    return null;
  }
  return migrate(env);
}

export function deleteSave(slot) {
  const store = storage();
  if (!store) return;
  store.removeItem(PREFIX + slot);
  writeIndex(listSaves().filter((s) => s.slot !== slot));
}

// Forward-migration hook. Each version bump appends a step so old franchises
// survive an update instead of being thrown away.
const MIGRATIONS = {
  // 1: (env) => { ...; env.version = 2; return env; }
};

export function migrate(env) {
  if (!env || typeof env !== 'object') return null;
  let cur = env;
  while (cur.version < SAVE_VERSION && MIGRATIONS[cur.version]) {
    cur = MIGRATIONS[cur.version](cur);
  }
  if (cur.version > SAVE_VERSION) {
    return { ...cur, incompatible: true };
  }
  return cur;
}

export function toJSON(state, meta = {}) {
  return JSON.stringify(envelope(state, meta), null, 2);
}

export function fromJSON(text) {
  try {
    return migrate(JSON.parse(text));
  } catch {
    return null;
  }
}
