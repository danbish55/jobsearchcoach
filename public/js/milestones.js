/* Milestones — USC Trojan playbook system */
const Milestones = (() => {

  const MISSION_DEFS = [
    {
      id: 'dossier',
      codename: 'RESUME',
      title: 'Resume Ready',
      icon: '📁',
      briefing: 'Every Trojan needs a resume that opens doors. Yours is your first impression — sharp, targeted, and error-free. Marshall grads don\'t send sloppy resumes.',
      nextBriefing: 'Resume locked in. You\'ve earned a break — take a walk, grab a coffee, celebrate this milestone. Then come back ready for the next play.',
      tasks: [
        { id: 'resume_draft',     label: 'Resume draft complete' },
        { id: 'coach_reviewed',   label: 'Coach has reviewed your resume' },
        { id: 'tailored',         label: 'Tailored for target roles' },
        { id: 'proofread',        label: 'Proofread — zero errors' },
      ],
    },
    {
      id: 'network',
      codename: 'TROJAN NETWORK',
      title: 'Trojan Network Built',
      icon: '🕸️',
      briefing: 'Your USC Marshall network is the most powerful recruiting asset you have. People open doors that job boards never will. Build the connections that matter.',
      nextBriefing: 'Network activated. Step away and recharge — Fight On spirit is sustainable, not sprint-and-crash. Good things are moving.',
      tasks: [
        { id: 'linkedin_updated', label: 'LinkedIn profile updated' },
        { id: 'alumni_5',         label: '5 USC alumni messaged' },
        { id: 'coffee_chat',      label: 'Coffee chat completed' },
        { id: 'career_center',    label: 'USC Career Center visited' },
      ],
    },
    {
      id: 'deploy',
      codename: 'BLITZ',
      title: 'Applications in Motion',
      icon: '🚀',
      briefing: 'A Marshall Trojan plays the full field. Get your applications moving — quality AND quantity both matter. Don\'t wait for a perfect moment that never comes.',
      nextBriefing: 'Applications rolling. Take a breather before the next phase. You did the work — now let it land.',
      tasks: [
        { id: 'first_app',  label: 'First application submitted' },
        { id: 'apps_10',    label: '10 applications submitted' },
        { id: 'apps_25',    label: '25 applications submitted' },
      ],
    },
    {
      id: 'interview',
      codename: 'PRESSURE TEST',
      title: 'Interview Conquered',
      icon: '🎤',
      briefing: 'Show them why you\'re the Trojan for this role. Tell your story with confidence. Prepare your answers. Know the company cold. USC Marshall trained you for exactly this.',
      nextBriefing: 'Interview handled. You showed up prepared and composed — that\'s the Trojan standard. Recharge and stay ready for the next round.',
      tasks: [
        { id: 'phone_screen',    label: 'Phone screen completed' },
        { id: 'formal_interview', label: 'Full interview completed' },
        { id: 'thank_you',       label: 'Thank-you notes sent' },
      ],
    },
    {
      id: 'negotiate',
      codename: 'ENDZONE',
      title: 'Terms Secured',
      icon: '🤝',
      briefing: 'Never accept the first offer. You have leverage — use it calmly and professionally. Know your number. State your case. Get what you deserve.',
      nextBriefing: 'Terms locked. That was the most important conversation of this whole search. Take your victory lap — you earned it.',
      tasks: [
        { id: 'offer_received',  label: 'Offer received' },
        { id: 'counter_made',    label: 'Negotiation strategy executed' },
        { id: 'offer_accepted',  label: 'Final offer accepted' },
      ],
    },
    {
      id: 'extraction',
      codename: 'FIGHT ON',
      title: 'Placed: Fight On!',
      icon: '🏆',
      briefing: 'Trojan, you did it. You secured the role. USC Marshall produced another winner — and that winner is you. The real work starts now.',
      nextBriefing: 'Placed and thriving. Full Fight On status earned. Take tonight off, celebrate with people who love you, and come back tomorrow as a working professional.',
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
      active_mission_id: null,
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
    if (_data.active_mission_id === undefined) _data.active_mission_id = null;
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
  function _firstIncompleteMission() {
    for (const def of MISSION_DEFS) {
      if (!getMissionState(def.id).complete) return def;
    }
    return MISSION_DEFS[MISSION_DEFS.length - 1]; // all done - show last
  }

  // Returns the manually selected mission, or the first incomplete mission.
  function getCurrentMission() {
    const active = MISSION_DEFS.find(def => def.id === _data.active_mission_id);
    return active || _firstIncompleteMission();
  }

  function setCurrentMission(missionId) {
    const def = MISSION_DEFS.find(m => m.id === missionId);
    if (!def) return null;
    _data.active_mission_id = missionId;
    _save();
    return def;
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
        if (_data.active_mission_id === missionId) {
          _data.active_mission_id = _firstIncompleteMission().id;
        }
        _save();
        return { justCompleted: true, mission: def };
      }
      if (!allDone && state.complete) {
        state.complete = false;
        state.unlocked_at = null;
        _data.active_mission_id = missionId;
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

    return `Current phase: ${current.codename} — ${current.title} (${progress.pct}% complete, ${progress.done}/${progress.total} tasks done).
Overall progress: ${overall.done}/${overall.total} phases complete.${completedNames ? `\nCompleted phases: ${completedNames}.` : ''}`;
  }

  return { init, getDefs, getMissionState, getMissionProgress, getCurrentMission, setCurrentMission, toggleTask, getOverallProgress, buildContextSummary };
})();
