import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const local = new Map();
const drive = new Map();
const context = {
  console,
  Date,
  Math,
  Number,
  String,
  Array,
  Object,
  RegExp,
  Set,
  Promise,
  localStorage: {
    getItem(key) {
      return local.has(key) ? local.get(key) : null;
    },
    setItem(key, value) {
      local.set(key, String(value));
    },
    removeItem(key) {
      local.delete(key);
    },
  },
  document: {
    getElementById() {
      return null;
    },
  },
  Drive: {
    isConnected() {
      return true;
    },
    async syncKey(key, value) {
      drive.set(key, JSON.parse(JSON.stringify(value)));
    },
    async readKey(key) {
      return drive.has(key) ? JSON.parse(JSON.stringify(drive.get(key))) : null;
    },
  },
  UI: {
    notify() {},
  },
  fetch() {
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ count: 0 }) });
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
const Gauges = loadScript('js/views/gauges.js', 'Gauges');
const WorkflowPages = loadScript('js/views/workflow-pages.js', 'WorkflowPages');

for (const gaugeId of ['followups', 'networking', 'usc_eller', 'interview_prep', 'linkedin']) {
  assert.equal(Gauges.__testLocalValidate(gaugeId, 'abc').valid, true, `${gaugeId} accepts 3 characters`);
  assert.equal(Gauges.__testLocalValidate(gaugeId, '  ab  ').valid, false, `${gaugeId} rejects 2 characters`);
  const result = await Gauges.logWorkflowActivity(gaugeId, { description: 'abc' });
  assert.equal(result.ok, true, `${gaugeId} log accepts a brief note`);
}

const pageCases = [
  ['followups', 'abc'],
  ['networking', 'met'],
  ['usc_eller', 'dm sent'],
  ['interview_prep', 'SQL'],
  ['linkedin', 'post'],
];

const progress = {};
for (const [key, note] of pageCases) {
  const page = { key };
  const entry = WorkflowPages.__testHistoryEntryFromPayload(page, { description: note });
  assert.equal(entry.description, note, `${key} preserves an unparsed raw note`);
  assert.equal(WorkflowPages.__testActivityHistoryDisplay(page, entry), note, `${key} displays the raw note`);
  progress[key === 'followups' ? 'followup_history' : `${key}_history`] = [{
    id: key,
    date: new Date().toISOString(),
    ...entry,
  }];
}

await Storage.set('progress', progress);
assert.equal(JSON.stringify(drive.get('progress')), JSON.stringify(progress), 'brief notes sync to Drive');

local.delete('jsc_progress');
await Storage.syncFromDrive();
assert.equal(JSON.stringify(Storage.get('progress')), JSON.stringify(progress), 'brief notes survive restart');

const workflowSource = fs.readFileSync(path.join(root, 'js/views/workflow-pages.js'), 'utf8');
assert.match(workflowSource, /Company and name are optional\./);

const jobsSource = fs.readFileSync(path.join(root, 'js/views/jobs.js'), 'utf8');
assert.match(jobsSource, /Company and role are required/);

console.log('Phase 3 history note tests passed.');
