import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const store = new Map();
const context = {
  console,
  Date,
  Promise,
  localStorage: {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  },
  Drive: {
    isConnected() {
      return false;
    },
    syncKey() {
      return Promise.resolve();
    },
  },
};
context.globalThis = context;
vm.createContext(context);

function loadScript(relativePath, exportName) {
  const code = fs.readFileSync(path.join(root, relativePath), 'utf8');
  vm.runInContext(`${code}\nglobalThis.${exportName} = ${exportName};`, context, { filename: relativePath });
  return context[exportName];
}

const Storage = loadScript('js/storage.js', 'Storage');
const SampleData = loadScript('js/sample-data.js', 'SampleData');

await SampleData.seedIfEmpty();

const installation = Storage.get('installation', {});
assert.equal(installation.seeded, true);
assert.equal(installation.intentionally_empty, true);
assert.equal(typeof installation.seeded_at, 'string');

for (const key of ['profile', 'jobs', 'resume', 'deep_dive', 'sessions', 'usc', 'milestones']) {
  assert.equal(Storage.get(key, null), null, `${key} must not receive sample data`);
}

Storage.set('profile', { name: 'Real User', target_roles: ['Data Analyst'] });
const firstMarker = Storage.get('installation');
await SampleData.seedIfEmpty();

assert.equal(
  JSON.stringify(Storage.get('profile')),
  JSON.stringify({ name: 'Real User', target_roles: ['Data Analyst'] }),
);
assert.equal(JSON.stringify(Storage.get('installation')), JSON.stringify(firstMarker));

console.log('Sample data regression tests passed.');
