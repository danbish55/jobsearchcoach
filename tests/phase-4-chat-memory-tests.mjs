import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const memorySource = fs.readFileSync(path.join(root, 'js/chat-memory.js'), 'utf8');
const claudeSource = fs.readFileSync(path.join(root, 'js/claude.js'), 'utf8');
const stored = new Map();
const writes = [];
const modelRequests = [];

const localStorage = {
  getItem(key) {
    return stored.has(key) ? stored.get(key) : null;
  },
  setItem(key, value) {
    stored.set(key, value);
  },
  removeItem(key) {
    stored.delete(key);
  },
};

const document = {
  body: { appendChild() {} },
  visibilityState: 'visible',
  addEventListener() {},
  createElement() {
    return { setAttribute() {}, style: {}, textContent: '' };
  },
  getElementById() {
    return null;
  },
};

const context = {
  console,
  Date,
  JSON,
  Promise,
  localStorage,
  document,
  window: { addEventListener() {} },
  setInterval() {
    return 1;
  },
  clearInterval() {},
  Config: { claudeModel: () => 'test-model' },
  Storage: {
    get(key, fallback) {
      const raw = localStorage.getItem(`jsc_${key}`);
      return raw === null ? fallback : JSON.parse(raw);
    },
    set(key, value) {
      writes.push({ key, value: structuredClone(value) });
      localStorage.setItem(`jsc_${key}`, JSON.stringify(value));
      return Promise.resolve();
    },
  },
  fetch: async (_url, options) => {
    modelRequests.push(JSON.parse(options.body));
    return {
      ok: true,
      json: async () => ({
        content: [{
          text: '- Corinne discussed a Google data analyst referral with Coach.\n- Next: draft a networking message.',
        }],
      }),
    };
  },
};
vm.createContext(context);
vm.runInContext(`${memorySource}\n;globalThis.ChatMemory = ChatMemory;`, context);

assert.deepEqual(
  JSON.parse(JSON.stringify(context.ChatMemory.load())),
  { summary: '', pending: [], updated_at: '' },
  'a fresh install starts with empty chat memory'
);

context.ChatMemory.mount('coach');
context.ChatMemory.appendMessage('user', 'I have a Google data analyst referral.', 'coach');
context.ChatMemory.appendMessage('assistant', 'Let us draft the outreach next.', 'coach');
await context.ChatMemory.flushPending();

assert.equal(modelRequests.length, 0, 'the periodic/cheap flush never calls Claude');
assert.equal(writes.at(-1).key, 'chat_memory');
assert.equal(writes.at(-1).value.pending.length, 2);
assert.equal(writes.at(-1).value.summary, '');

await context.ChatMemory.regenerate();
const consolidated = context.Storage.get('chat_memory');
assert.equal(modelRequests.length, 1, 'exit regeneration calls Claude once');
assert.match(modelRequests[0].messages[0].content, /Google data analyst referral/);
assert.match(consolidated.summary, /Google data analyst referral/);
assert.deepEqual(consolidated.pending, [], 'successfully summarized messages leave pending');

for (let i = 0; i < 250; i += 1) {
  context.ChatMemory.appendMessage('user', `Uncapped detail ${i}`, 'coach');
}
await context.ChatMemory.flushPending();
assert.equal(
  context.Storage.get('chat_memory').pending.length,
  250,
  'raw pending messages are not truncated or capped'
);

context.Storage.get = (key, fallback) => {
  if (key === 'profile') return { name: 'Corinne', target_roles: ['Data Analyst'] };
  if (key === 'jobs') return { applications: [] };
  if (key === 'usc') return {};
  return fallback;
};
context.Milestones = { buildContextSummary: () => 'Network mission active' };
vm.runInContext(`${claudeSource}\n;globalThis.Claude = Claude;`, context);
const systemPrompt = context.Claude.buildSystemPrompt();
assert.match(systemPrompt, /## Shared Coaching Memory/);
assert.match(systemPrompt, /Google data analyst referral/);
assert.ok(
  systemPrompt.indexOf('## Shared Coaching Memory') < systemPrompt.indexOf('## Live Session Data'),
  'shared memory appears before live stats'
);

const storageSource = fs.readFileSync(path.join(root, 'js/storage.js'), 'utf8');
const settingsSource = fs.readFileSync(path.join(root, 'js/views/settings.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const workflowSource = fs.readFileSync(path.join(root, 'js/views/workflow-pages.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(storageSource, /'chat_memory'/, 'chat memory is a Drive/reset key');
assert.match(settingsSource, /chat_memory:\s*Storage\.get\('chat_memory'/, 'backups include chat memory');
assert.match(settingsSource, /_restoreKey\('chat_memory'/, 'backups restore chat memory');
assert.match(memorySource, /FLUSH_INTERVAL_MS = 30000/);
assert.match(memorySource, /visibilitychange/);
assert.match(memorySource, /beforeunload/);
assert.match(appSource, /ChatMemory\.unmount\(\{ consolidate: true \}\)/);
assert.match(appSource, /ChatMemory\.mount\(viewId\)/);
assert.match(workflowSource, /system: `\$\{Claude\.buildSystemPrompt\(\)\}/);
assert.match(workflowSource, /ChatMemory\.appendMessage\('user', text, viewId\)/);
assert.ok(
  indexSource.indexOf('js/claude.js') < indexSource.indexOf('js/chat-memory.js') &&
    indexSource.indexOf('js/chat-memory.js') < indexSource.indexOf('js/views/coach.js'),
  'chat memory loads after Claude and before chat views'
);

for (const file of [
  'js/views/coach.js',
  'js/views/resume-deep-dive.js',
  'js/views/job-target-tracker.js',
  'js/views/workflow-pages.js',
  'js/views/mission-discussion.js',
]) {
  assert.match(
    fs.readFileSync(path.join(root, file), 'utf8'),
    /ChatMemory\.appendMessage/,
    `${file} records shared memory`
  );
}

console.log('Phase 4 shared chat memory tests passed.');
