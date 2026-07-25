/* Storage — localStorage primary, Google Drive sync layer */
const Storage = (() => {
  const PREFIX = 'jsc_';
  const DRIVE_KEYS = [
    'installation',
    'profile',
    'candidate_profile',
    'progress',
    'sessions',
    'coach_current_session',
    'milestones',
    'jobs',
    'usc',
    'resume',
    'deep_dive',
    'cover_letters',
    'gauges',
    'gauge_settings',
    'job_target_tracker',
    'chat_memory',
    'linkedin_li_at',
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

  const DRIVE_DEBOUNCE_MS = 2500;
  const _drivePending = new Map();
  let _driveFlushTimer = null;
  let _driveFlushPromise = Promise.resolve();

  function _scheduleDriveFlush() {
    if (_driveFlushTimer) return _driveFlushPromise;
    _driveFlushPromise = new Promise(resolve => {
      _driveFlushTimer = setTimeout(async () => {
        _driveFlushTimer = null;
        const batch = [..._drivePending.entries()];
        _drivePending.clear();
        for (const [pendingKey, pendingValue] of batch) {
          try {
            await Drive.syncKey(pendingKey, pendingValue);
          } catch {}
        }
        resolve();
      }, DRIVE_DEBOUNCE_MS);
    });
    return _driveFlushPromise;
  }

  function set(key, value, options = {}) {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    if (!Drive.isConnected()) return Promise.resolve();
    if (options.immediate) {
      _drivePending.delete(key);
      return Drive.syncKey(key, value);
    }
    _drivePending.set(key, value);
    return _scheduleDriveFlush();
  }

  function remove(key, options = {}) {
    localStorage.removeItem(PREFIX + key);
    if (!Drive.isConnected()) return Promise.resolve();
    if (options.immediate) {
      _drivePending.delete(key);
      return Drive.syncKey(key, null);
    }
    _drivePending.set(key, null);
    return _scheduleDriveFlush();
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
    await Promise.all(DRIVE_KEYS.map(async key => {
      const driveData = await Drive.readKey(key);
      if (driveData !== null) {
        localStorage.setItem(PREFIX + key, JSON.stringify(driveData));
      }
    }));
  }

  async function flushDriveSync() {
    if (_driveFlushTimer) {
      clearTimeout(_driveFlushTimer);
      _driveFlushTimer = null;
    }
    const batch = [..._drivePending.entries()];
    _drivePending.clear();
    if (!Drive.isConnected() || !batch.length) return;
    for (const [pendingKey, pendingValue] of batch) {
      try {
        await Drive.syncKey(pendingKey, pendingValue);
      } catch {}
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

  async function clearUserData({ preserveLocal = false } = {}) {
    const keys = DRIVE_KEYS.filter(key => key !== 'installation');
    const results = await Promise.allSettled(keys.map(key => {
      if (preserveLocal && Drive.isConnected()) return Drive.syncKey(key, null);
      return remove(key);
    }));
    return results
      .map((result, index) => ({ result, key: keys[index] }))
      .filter(item => item.result.status === 'rejected')
      .map(item => item.key);
  }

  return { get, set, remove, merge, syncFromDrive, syncAllToDrive, flushDriveSync, clearUserData };
})();
