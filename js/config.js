/* Config — reads server-side status, writes config via local server proxy */
const Config = (() => {
  let _status = null;

  async function load() {
    try {
      const r = await fetch('/api/status');
      _status = await r.json();
      return _status;
    } catch {
      // Server not running — shouldn't happen, but graceful fallback
      _status = { has_api_key: false, has_drive: false, profile_complete: false, google_client_id: '' };
      return _status;
    }
  }

  async function save(updates) {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    await load(); // Refresh status
  }

  function get() { return _status; }
  function hasApiKey() { return _status && _status.has_api_key; }
  function hasDrive()  { return _status && _status.has_drive; }
  function profileComplete() { return _status && _status.profile_complete; }

  return { load, save, get, hasApiKey, hasDrive, profileComplete };
})();
