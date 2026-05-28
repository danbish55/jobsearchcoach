/* Storage — localStorage primary, Google Drive sync layer */
const Storage = (() => {
  const PREFIX = 'jsc_';

  function get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function set(key, value) {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    if (Drive.isConnected()) {
      Drive.syncKey(key, value); // fire-and-forget Drive sync
    }
  }

  function remove(key) {
    localStorage.removeItem(PREFIX + key);
  }

  // Merge an object into an existing stored object
  function merge(key, updates, fallback = {}) {
    const current = get(key, fallback);
    const merged = { ...current, ...updates };
    set(key, merged);
    return merged;
  }

  // Called on startup to pull Drive data into localStorage
  async function syncFromDrive() {
    if (!Drive.isConnected()) return;
    const keys = ['profile', 'sessions', 'milestones', 'jobs', 'usc', 'resume'];
    for (const key of keys) {
      const driveData = await Drive.readKey(key);
      if (driveData !== null) {
        localStorage.setItem(PREFIX + key, JSON.stringify(driveData));
      }
    }
  }

  return { get, set, remove, merge, syncFromDrive };
})();
