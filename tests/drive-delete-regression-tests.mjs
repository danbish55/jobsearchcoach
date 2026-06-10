import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const requests = [];
const context = {
  console,
  Promise,
  URLSearchParams,
  Config: {
    hasDrive() {
      return true;
    },
  },
  window: {
    location: { origin: 'http://localhost:8765' },
    addEventListener() {},
    removeEventListener() {},
  },
  clearInterval,
  clearTimeout,
  setInterval,
  setTimeout,
  async fetch(url, options = {}) {
    requests.push({ url, options });
    if (url === '/api/token-refresh') {
      return { ok: true, json: async () => ({ access_token: 'test-token' }) };
    }
    if (String(url).includes('/drive/v3/files?spaces=appDataFolder')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ files: [{ id: 'profile-file-id', name: 'jsc_profile.json' }] }),
      };
    }
    if (url === 'https://www.googleapis.com/drive/v3/files/profile-file-id') {
      return { ok: true, status: 204 };
    }
    throw new Error(`Unexpected request: ${url}`);
  },
};
context.globalThis = context;
vm.createContext(context);

const code = fs.readFileSync(path.join(root, 'js/drive.js'), 'utf8');
vm.runInContext(`${code}\nglobalThis.Drive = Drive;`, context, { filename: 'js/drive.js' });

assert.equal(await context.Drive.init(), true);
await context.Drive.syncKey('profile', null);

const deletion = requests.find(request => request.options.method === 'DELETE');
assert.ok(deletion, 'Removing a key must issue a Drive DELETE request');
assert.equal(deletion.url, 'https://www.googleapis.com/drive/v3/files/profile-file-id');
assert.equal(deletion.options.headers.Authorization, 'Bearer test-token');

console.log('Drive delete regression tests passed.');
