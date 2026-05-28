/* Google Drive — App Data folder sync */
const Drive = (() => {
  const FOLDER = 'appDataFolder';
  let _accessToken = null;
  let _fileCache = {}; // filename → Drive file ID

  function isConnected() {
    return Config.hasDrive() && !!_accessToken;
  }

  async function init() {
    if (!Config.hasDrive()) return false;
    try {
      const r = await fetch('/api/token-refresh', { method: 'POST' });
      const data = await r.json();
      if (data.access_token) {
        _accessToken = data.access_token;
        return true;
      }
    } catch {}
    return false;
  }

  // Receive OAuth code from popup window
  function handleOAuthCode(code) {
    return fetch('/api/token-exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }).then(r => r.json());
  }

  // Open Google OAuth popup
  function startOAuth(clientId) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `http://localhost:8765/oauth2callback`,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive.appdata',
      access_type: 'offline',
      prompt: 'consent',
    });
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    const popup = window.open(url, 'GoogleAuth', 'width=500,height=650,left=200,top=100');
    if (!popup) {
      return Promise.reject(new Error('The Google sign-in popup was blocked. Please allow popups for JobSearchCoach and try again.'));
    }

    return new Promise((resolve, reject) => {
      let checkClosed = null;
      const cleanup = () => {
        clearTimeout(timeout);
        if (checkClosed) clearInterval(checkClosed);
        window.removeEventListener('message', handler);
      };
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Auth timeout'));
      }, 120000);
      async function handler(e) {
        if (e.origin !== window.location.origin) return;
        if (e.data && e.data.type === 'oauth_code') {
          cleanup();
          try {
            const result = await handleOAuthCode(e.data.code);
            if (!result.ok) {
              throw new Error(result.error || 'Google did not return a usable sign-in token.');
            }
            resolve(result);
          } catch (err) {
            reject(err);
          }
        }
      }
      window.addEventListener('message', handler);
      // Detect popup close without completing
      checkClosed = setInterval(() => {
        if (popup.closed) {
          cleanup();
          reject(new Error('Google sign-in window was closed before setup finished'));
        }
      }, 1000);
    });
  }

  async function _apiCall(method, path, body = null, retried = false) {
    if (!_accessToken) return null;
    const opts = {
      method,
      headers: { Authorization: `Bearer ${_accessToken}` },
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const r = await fetch(`https://www.googleapis.com/drive/v3${path}`, opts);
    if (r.status === 401) {
      // Token expired — refresh
      if (retried) return null;
      const refreshed = await init();
      if (!refreshed) {
        _accessToken = null;
        return null;
      }
      return _apiCall(method, path, body, true);
    }
    if (!r.ok) return null;
    return r.json();
  }

  async function _findFile(filename) {
    if (_fileCache[filename]) return _fileCache[filename];
    const q = encodeURIComponent(`name='${filename}' and trashed=false`);
    const data = await _apiCall('GET', `/files?spaces=${FOLDER}&q=${q}&fields=files(id)`);
    if (data && data.files && data.files.length > 0) {
      _fileCache[filename] = data.files[0].id;
      return data.files[0].id;
    }
    return null;
  }

  async function readKey(key) {
    const filename = `jsc_${key}.json`;
    const fileId = await _findFile(filename);
    if (!fileId) return null;
    const r = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${_accessToken}` } }
    );
    if (!r.ok) return null;
    return r.json();
  }

  async function syncKey(key, value) {
    if (!_accessToken) return;
    const filename = `jsc_${key}.json`;
    const fileId = await _findFile(filename);
    const content = JSON.stringify(value);

    if (fileId) {
      // Update existing file
      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${_accessToken}`,
          'Content-Type': 'application/json',
        },
        body: content,
      });
    } else {
      // Create new file in appDataFolder
      const meta = JSON.stringify({ name: filename, parents: [FOLDER] });
      const boundary = 'boundary123';
      const body = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
      const r = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${_accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body,
        }
      );
      const created = await r.json();
      if (created.id) _fileCache[filename] = created.id;
    }
  }

  return { isConnected, init, startOAuth, readKey, syncKey };
})();
