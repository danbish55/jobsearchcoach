import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

function createHarness({ connected = false, driveMarker = null, failKey = '', failMarker = false } = {}) {
  const store = new Map();
  const driveWrites = [];
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
        return connected;
      },
      readKey(key) {
        return Promise.resolve(key === 'installation' ? driveMarker : null);
      },
      syncKey(key, value) {
        driveWrites.push({ key, value });
        if (key === failKey || (key === 'installation' && failMarker)) {
          return Promise.reject(new Error(`sync failed for ${key}`));
        }
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

  return {
    store,
    driveWrites,
    Storage: loadScript('js/storage.js', 'Storage'),
    SampleData: loadScript('js/sample-data.js', 'SampleData'),
  };
}

{
  const { Storage, SampleData } = createHarness();
  Storage.set('profile', { name: 'Legacy Sample' });
  Storage.set('candidate_profile', { target_roles: ['Old Role'] });

  assert.equal(
    JSON.stringify(await SampleData.prepareStorage(false)),
    JSON.stringify({ ready: true, migrated: true }),
  );
  assert.equal(Storage.get('profile', null), null);
  assert.equal(Storage.get('candidate_profile', null), null);

  const installation = Storage.get('installation', {});
  assert.equal(installation.seeded, true);
  assert.equal(installation.intentionally_empty, true);
  assert.equal(installation.data_policy, 'no_samples_v1');
  assert.equal(typeof installation.seeded_at, 'string');
}

{
  const { Storage, SampleData } = createHarness();
  await SampleData.markInitialized();
  Storage.set('profile', { name: 'Real User', target_roles: ['Data Analyst'] });
  const firstMarker = Storage.get('installation');

  assert.equal(
    JSON.stringify(await SampleData.prepareStorage(false)),
    JSON.stringify({ ready: true, migrated: false }),
  );
  await SampleData.seedIfEmpty();

  assert.equal(
    JSON.stringify(Storage.get('profile')),
    JSON.stringify({ name: 'Real User', target_roles: ['Data Analyst'] }),
  );
  assert.equal(JSON.stringify(Storage.get('installation')), JSON.stringify(firstMarker));
}

{
  const { Storage, SampleData, driveWrites } = createHarness({ connected: true });
  Storage.set('profile', { name: 'New User' });

  assert.equal(
    JSON.stringify(await SampleData.prepareStorage(true, { preserveLocal: true })),
    JSON.stringify({ ready: true, migrated: true }),
  );
  assert.equal(Storage.get('profile', {}).name, 'New User');
  assert.ok(driveWrites.some(write => write.key === 'profile' && write.value === null));
  assert.equal(Storage.get('installation', {}).data_policy, 'no_samples_v1');
}

{
  const { store, Storage, SampleData } = createHarness({ connected: true, failKey: 'jobs' });
  store.set('jsc_jobs', JSON.stringify({ applications: [{ company: 'Old Sample' }] }));

  assert.equal(
    JSON.stringify(await SampleData.prepareStorage(true)),
    JSON.stringify({ ready: false, migrated: false }),
  );
  const installation = Storage.get('installation', {});
  assert.equal(installation.cleanup_pending, true);
  assert.ok(installation.failed_keys.includes('jobs'));
  assert.equal(installation.data_policy, undefined);
}

{
  const { Storage, SampleData } = createHarness({ connected: true, failMarker: true });

  assert.equal(
    JSON.stringify(await SampleData.prepareStorage(true)),
    JSON.stringify({ ready: false, migrated: false }),
  );
  const installation = Storage.get('installation', {});
  assert.equal(installation.cleanup_pending, true);
  assert.equal(installation.data_policy, undefined);
}

console.log('Sample data regression tests passed.');
