/* Storage — localStorage primary, Google Drive sync layer */
const Storage = (() => {
  const PREFIX = 'jsc_';
  const DRIVE_KEYS = [
    'profile',
    'sessions',
    'milestones',
    'jobs',
    'usc',
    'resume',
    'deep_dive',
    'gauges',
    'job_target_tracker',
    'mission_discussion_dossier',
    'mission_discussion_network',
    'mission_discussion_deploy',
    'mission_discussion_interview',
    'mission_discussion_negotiate',
    'mission_discussion_extraction',
  ];

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
    if (Drive.isConnected()) {
      Drive.syncKey(key, null);
    }
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
    for (const key of DRIVE_KEYS) {
      const driveData = await Drive.readKey(key);
      if (driveData !== null) {
        localStorage.setItem(PREFIX + key, JSON.stringify(driveData));
      }
    }
  }

  async function syncAllToDrive() {
    if (!Drive.isConnected()) return;
    for (const key of DRIVE_KEYS) {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw !== null) {
        try {
          await Drive.syncKey(key, JSON.parse(raw));
        } catch {}
      }
    }
  }

  return { get, set, remove, merge, syncFromDrive, syncAllToDrive };
})();
