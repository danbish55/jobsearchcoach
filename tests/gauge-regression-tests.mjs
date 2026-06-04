import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

const store = new Map();
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
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  },
  document: {
    getElementById() {
      return null;
    },
  },
  Drive: {
    isConnected() {
      return false;
    },
    syncKey() {},
  },
  UI: {
    updateSidebar() {},
    notify() {},
  },
  Milestones: {
    getMissionState() {
      return { tasks: {} };
    },
    toggleTask() {
      return { justCompleted: false };
    },
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
const Jobs = loadScript('js/views/jobs.js', 'Jobs');
const JobLeads = loadScript('js/views/leads.js', 'JobLeads');

function resetStorage() {
  store.clear();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function testJobLeadApplyWritesOneApplication() {
  resetStorage();
  Storage.set('jobs', { applications: [] });

  const lead = {
    lead_id: 'lead-123',
    tier: 'tier_1',
    score: 92,
    lead: {
      id: 'lead-123',
      company: 'Acme Analytics',
      title: 'Data Analyst',
      url: 'https://example.com/jobs/lead-123',
      source: 'manual',
    },
  };

  const before = Storage.get('jobs', { applications: [] }).applications.length;
  JobLeads.__testRecordJscApplication(lead);
  JobLeads.__testRecordJscApplication(lead);

  const applications = Storage.get('jobs', { applications: [] }).applications;
  assert.equal(applications.length - before, 1);
  assert.equal(Gauges.countWeeklyApplications(applications, new Date(`${today()}T12:00:00`)), 1);
}

function testHistoryDeletionDecrementsGaugeCount() {
  resetStorage();
  Storage.set('progress', {
    followup_history: [
      { id: 'one', date: new Date().toISOString(), description: 'Acme, Jane Doe, Sent a concise follow-up note today.' },
      { id: 'two', date: new Date().toISOString(), description: 'Beta, John Doe, Followed up with recruiter after applying.' },
    ],
  });

  assert.equal(Gauges.countHistoryEntries('followups'), 2);
  const progress = Storage.get('progress', {});
  Storage.merge('progress', {
    followup_history: progress.followup_history.filter(entry => entry.id !== 'one'),
  });
  assert.equal(Gauges.countHistoryEntries('followups'), 1);
}

function testGaugeLayoutIsLockedToOriginalThreeRows() {
  resetStorage();
  const html = Gauges.renderBand();
  const labels = [...html.matchAll(/aria-label="([^"]+) gauge/g)].map(match => match[1]);

  assert.deepEqual(labels, [
    'Resume Variants',
    'Portfolio',
    'Side Hustle',
    'General Networking',
    'USC/Eller',
    'LinkedIn',
    'Weekly Applications',
    'Follow-Ups',
    'Interview Prep',
    'Interviews',
  ]);
  assert.equal((html.match(/class="gauge-grid-row"/g) || []).length, 3);
}

testJobLeadApplyWritesOneApplication();
testHistoryDeletionDecrementsGaugeCount();
testGaugeLayoutIsLockedToOriginalThreeRows();

console.log('Gauge regression tests passed.');
