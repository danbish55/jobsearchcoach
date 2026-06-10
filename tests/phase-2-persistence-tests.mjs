import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const storageCode = fs.readFileSync(path.join(root, 'js/storage.js'), 'utf8');

function createStorageHarness({ driveData = {} } = {}) {
  const local = new Map();
  const writes = new Map();
  const context = {
    console,
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
    Drive: {
      isConnected() {
        return true;
      },
      async syncKey(key, value) {
        writes.set(key, JSON.parse(JSON.stringify(value)));
      },
      async readKey(key) {
        return Object.prototype.hasOwnProperty.call(driveData, key)
          ? JSON.parse(JSON.stringify(driveData[key]))
          : null;
      },
    },
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(`${storageCode}\nglobalThis.Storage = Storage;`, context, { filename: 'js/storage.js' });
  return { Storage: context.Storage, local, writes };
}

const values = {
  jobs: { applications: [{ company: 'Acme', role: 'Data Analyst' }] },
  resume: { file_name: 'resume.docx', notes: 'Tailor this version.' },
  deep_dive: { deep_dive_conversation: [{ role: 'user', content: 'My answer' }] },
  job_target_tracker: { Google: { notes: 'Contact recruiter.' } },
  progress: {
    followup_history: [{ id: 'f1', description: 'Sent follow up' }],
    networking_history: [{ id: 'n1', description: 'Met analyst' }],
    usc_eller_history: [{ id: 'u1', description: 'Messaged alum' }],
    interview_prep_history: [{ id: 'i1', description: 'Practiced SQL' }],
    linkedin_history: [{ id: 'l1', description: 'Posted project' }],
    side_hustle_history: [{ id: 's1', note: 'Dashboard gig' }],
  },
  mission_discussion_dossier: [{ role: 'user', content: 'Resume concern' }],
  mission_discussion_network: [{ role: 'user', content: 'Networking concern' }],
  mission_discussion_deploy: [{ role: 'user', content: 'Application concern' }],
  mission_discussion_interview: [{ role: 'user', content: 'Interview concern' }],
  mission_discussion_negotiate: [{ role: 'user', content: 'Offer concern' }],
  mission_discussion_extraction: [{ role: 'user', content: 'First-day concern' }],
  coach_current_session: [{ role: 'user', content: 'Current coach message' }],
  sessions: { sessions: [{ id: 1, messages: [{ role: 'user', content: 'Saved session' }] }], compressed: [] },
  gauge_settings: { apps_target: 12 },
  gauges: { portfolio: 2 },
  milestones: { active_mission_id: 'deploy', missions: {} },
  profile: { name: 'Corinne', target_roles: ['Data Analyst'] },
  candidate_profile: {
    target_roles: ['Associate Data Analyst'],
    skills: ['SQL'],
    scoring_weights: { title_match_weight: 40 },
  },
};

const firstMachine = createStorageHarness();
for (const [key, value] of Object.entries(values)) {
  await firstMachine.Storage.set(key, value);
  assert.equal(
    JSON.stringify(firstMachine.Storage.get(key)),
    JSON.stringify(value),
    `${key} must save locally`,
  );
  assert.equal(
    JSON.stringify(firstMachine.writes.get(key)),
    JSON.stringify(value),
    `${key} must save to Drive`,
  );
}

const secondMachine = createStorageHarness({ driveData: Object.fromEntries(firstMachine.writes) });
await secondMachine.Storage.syncFromDrive();
for (const [key, value] of Object.entries(values)) {
  assert.equal(
    JSON.stringify(secondMachine.Storage.get(key)),
    JSON.stringify(value),
    `${key} must round-trip to a second machine`,
  );
}

const settingsStore = new Map([
  ['profile', values.profile],
  ['candidate_profile', values.candidate_profile],
  ['coach_current_session', values.coach_current_session],
]);
const settingsContext = {
  console,
  Date,
  Number,
  String,
  Array,
  Object,
  Promise,
  localStorage: {
    getItem() {
      return null;
    },
    setItem() {},
  },
  sessionStorage: {
    getItem() {
      return null;
    },
    setItem() {},
  },
  Storage: {
    get(key, fallback) {
      return settingsStore.has(key) ? settingsStore.get(key) : fallback;
    },
  },
  Config: {
    get() {
      return {};
    },
  },
};
settingsContext.globalThis = settingsContext;
vm.createContext(settingsContext);
const settingsCode = fs.readFileSync(path.join(root, 'js/views/settings.js'), 'utf8');
vm.runInContext(`${settingsCode}\nglobalThis.Settings = Settings;`, settingsContext, { filename: 'js/views/settings.js' });

assert.equal(settingsContext.Settings.__testHasCandidateProfileData(values.candidate_profile), true);
assert.equal(settingsContext.Settings.__testHasCandidateProfileData({}), false);

const backup = settingsContext.Settings.__testCollectData();
assert.equal(JSON.stringify(backup.candidate_profile), JSON.stringify(values.candidate_profile));
assert.equal(JSON.stringify(backup.coach_current_session), JSON.stringify(values.coach_current_session));

const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
assert.match(appSource, /await _syncCandidateProfileToServer\(\)/);
assert.match(appSource, /fetch\('\/api\/jl\/save-profile'/);

const pageStorageContracts = [
  ['js/views/jobs.js', /Storage\.set\('jobs'/],
  ['js/views/resume.js', /Storage\.set\('resume'/],
  ['js/views/resume-deep-dive.js', /Storage\.set\('deep_dive'/],
  ['js/views/job-target-tracker.js', /Storage\.set\(STORAGE_KEY/],
  ['js/views/workflow-pages.js', /Storage\.merge\('progress'/],
  ['js/views/mission-discussion.js', /Storage\.set\(`mission_discussion_\$\{_missionId\}`/],
  ['js/views/coach.js', /Storage\.set\('coach_current_session'/],
  ['js/views/gauges.js', /Storage\.get\('gauge_settings'/],
  ['js/milestones.js', /Storage\.set\('milestones'/],
  ['js/views/settings.js', /Storage\.set\('candidate_profile'/],
];
for (const [file, pattern] of pageStorageContracts) {
  assert.match(fs.readFileSync(path.join(root, file), 'utf8'), pattern, `${file} must use Storage`);
}

console.log('Phase 2 persistence tests passed.');
