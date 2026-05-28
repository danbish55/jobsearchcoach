/* Milestones — 007 mission system */
const Milestones = (() => {

  const MISSION_DEFS = [
    {
      id: 'dossier',
      codename: 'DOSSIER',
      title: 'Resume Dossier Complete',
      icon: '📁',
      briefing: 'Every field agent needs a bulletproof cover identity. Your resume is that identity — it must be sharp, tailored, and error-free.',
      nextBriefing: 'Intelligence network next. No agent operates alone.',
      tasks: [
        { id: 'resume_draft',     label: 'Resume draft complete' },
        { id: 'coach_reviewed',   label: 'Coach has reviewed your resume' },
        { id: 'tailored',         label: 'Tailored for target roles' },
        { id: 'proofread',        label: 'Proofread — zero errors' },
      ],
    },
    {
      id: 'network',
      codename: 'NETWORK',
      title: 'Intelligence Network Established',
      icon: '🕸️',
      briefing: 'Classified intelligence travels through people, not job boards. Build your network of contacts inside your target companies.',
      nextBriefing: 'Network secured. Time to go operational — deploy applications.',
      tasks: [
        { id: 'linkedin_updated', label: 'LinkedIn profile updated' },
        { id: 'alumni_5',         label: '5 USC alumni messaged' },
        { id: 'coffee_chat',      label: 'Coffee chat completed' },
        { id: 'career_center',    label: 'USC Career Center visited' },
      ],
    },
    {
      id: 'deploy',
      codename: 'DEPLOY',
      title: 'Applications Deployed',
      icon: '🚀',
      briefing: 'Covert operations require volume and precision. Get your applications into the field. Quality AND quantity both matter.',
      nextBriefing: 'Applications are live. Prepare for incoming contact — they will call.',
      tasks: [
        { id: 'first_app',  label: 'First application submitted' },
        { id: 'apps_10',    label: '10 applications submitted' },
        { id: 'apps_25',    label: '25 applications submitted' },
      ],
    },
    {
      id: 'interview',
      codename: 'INTERVIEW',
      title: 'Field Interrogation Survived',
      icon: '🎤',
      briefing: 'They want to know if you are the right asset. Prove it. Tell your story with confidence. Prepare your answers. Know the company cold.',
      nextBriefing: 'You passed interrogation. Now: secure your terms.',
      tasks: [
        { id: 'phone_screen',    label: 'Phone screen completed' },
        { id: 'formal_interview', label: 'Full interview completed' },
        { id: 'thank_you',       label: 'Thank-you notes sent' },
      ],
    },
    {
      id: 'negotiate',
      codename: 'NEGOTIATE',
      title: 'Terms Secured',
      icon: '🤝',
      briefing: 'Never accept the first offer. You have leverage — use it calmly and professionally. Know your number. State your case. Get what you deserve.',
      nextBriefing: 'Terms accepted. Mission complete — report to HQ.',
      tasks: [
        { id: 'offer_received',  label: 'Offer received' },
        { id: 'counter_made',    label: 'Negotiation strategy executed' },
        { id: 'offer_accepted',  label: 'Final offer accepted' },
      ],
    },
    {
      id: 'extraction',
      codename: 'EXTRACTION',
      title: 'Mission Complete: Placed',
      icon: '🏆',
      briefing: 'Agent, you have successfully completed your mission. You have secured your position. The world is your next assignment.',
      nextBriefing: 'Congratulations. Report back to update your Coach on how you are settling in.',
      tasks: [
        { id: 'start_confirmed', label: 'Start date confirmed' },
        { id: 'first_day',       label: 'First day completed' },
        { id: 'reported_back',   label: 'Reported back to Coach' },
      ],
    },
  ];

  let _data = null;

  function _defaultData() {
    return {
      missions: MISSION_DEFS.reduce((acc, m) => {
        acc[m.id] = {
          complete: false,
          unlocked_at: null,
          tasks: m.tasks.reduce((t, task) => { t[task.id] = false; return t; }, {}),
        };
        return acc;
      }, {}),
    };
  }

  function init() {
    _data = Storage.get('milestones', _defaultData());
    // Ensure all mission defs exist (handles app updates adding new missions)
    for (const m of MISSION_DEFS) {
      if (!_data.missions[m.id]) {
        _data.missions[m.id] = { complete: false, unlocked_at: null, tasks: {} };
      }
      for (const t of m.tasks) {
        if (_data.missions[m.id].tasks[t.id] === undefined) {
          _data.missions[m.id].tasks[t.id] = false;
        }
      }
    }
    _save();
  }

  function _save() {
    Storage.set('milestones', _data);
  }

  function getDefs() { return MISSION_DEFS; }

  function getMissionState(missionId) {
    return _data.missions[missionId] || { complete: false, tasks: {} };
  }

  function getMissionProgress(missionId) {
    const def = MISSION_DEFS.find(m => m.id === missionId);
    if (!def) return { done: 0, total: 0, pct: 0 };
    const state = getMissionState(missionId);
    const done = def.tasks.filter(t => state.tasks[t.id]).length;
    const total = def.tasks.length;
    return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }

  // Returns the first incomplete mission
  function getCurrentMission() {
    for (const def of MISSION_DEFS) {
      if (!getMissionState(def.id).complete) return def;
    }
    return MISSION_DEFS[MISSION_DEFS.length - 1]; // all done — show last
  }

  function toggleTask(missionId, taskId) {
    const state = _data.missions[missionId];
    if (!state) return false;
    state.tasks[taskId] = !state.tasks[taskId];

    // Check if mission is now complete
    const def = MISSION_DEFS.find(m => m.id === missionId);
    if (def) {
      const allDone = def.tasks.every(t => state.tasks[t.id]);
      if (allDone && !state.complete) {
        state.complete = true;
        state.unlocked_at = new Date().toISOString();
        _save();
        return { justCompleted: true, mission: def };
      }
    }
    _save();
    return { justCompleted: false };
  }

  function getOverallProgress() {
    const total = MISSION_DEFS.length;
    const done = MISSION_DEFS.filter(m => _data.missions[m.id]?.complete).length;
    return { done, total, pct: Math.round((done / total) * 100) };
  }

  // Build a text summary for Claude context
  function buildContextSummary() {
    const current = getCurrentMission();
    const progress = getMissionProgress(current.id);
    const overall = getOverallProgress();
    const completedNames = MISSION_DEFS
      .filter(m => _data.missions[m.id]?.complete)
      .map(m => m.codename)
      .join(', ');

    return `Current mission: ${current.codename} — ${current.title} (${progress.pct}% complete, ${progress.done}/${progress.total} tasks done).
Overall progress: ${overall.done}/${overall.total} missions complete.${completedNames ? `\nCompleted missions: ${completedNames}.` : ''}`;
  }

  return { init, getDefs, getMissionState, getMissionProgress, getCurrentMission, toggleTask, getOverallProgress, buildContextSummary };
})();
