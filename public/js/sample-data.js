/* SampleData - starter examples for first-launch demos */
const SampleData = (() => {
  const DISABLED_KEY = 'jsc_sample_data_disabled';
  const DATA_POLICY = 'no_samples_v1';

  function _marker(overrides = {}) {
    return {
      seeded: true,
      seeded_at: new Date().toISOString(),
      intentionally_empty: true,
      data_policy: DATA_POLICY,
      ...overrides,
    };
  }

  async function _saveMarker(marker) {
    try {
      await Storage.set('installation', marker);
      return true;
    } catch (err) {
      localStorage.setItem('jsc_installation', JSON.stringify({
        seeded: false,
        cleanup_pending: true,
        cleanup_error: err.message || 'Drive marker sync failed',
      }));
      console.warn('JobSearchCoach installation marker could not sync:', err);
      return false;
    }
  }

  async function prepareStorage(driveConnected, { preserveLocal = false } = {}) {
    const localMarker = Storage.get('installation', {});
    let driveMarker = null;
    if (driveConnected) {
      try {
        driveMarker = await Drive.readKey('installation');
      } catch (err) {
        console.warn('JobSearchCoach could not read its Drive installation marker:', err);
      }
    }

    const policyCurrent =
      localMarker.data_policy === DATA_POLICY ||
      driveMarker?.data_policy === DATA_POLICY;
    if (policyCurrent && !localMarker.cleanup_pending && !driveMarker?.cleanup_pending) {
      return { ready: true, migrated: false };
    }

    const failedKeys = await Storage.clearUserData({ preserveLocal });
    if (failedKeys.length > 0) {
      localStorage.setItem('jsc_installation', JSON.stringify({
        seeded: false,
        cleanup_pending: true,
        failed_keys: failedKeys,
      }));
      console.warn('JobSearchCoach data cleanup remains pending for:', failedKeys);
      return { ready: false, migrated: false };
    }

    const markerSaved = await _saveMarker(_marker());
    return { ready: markerSaved, migrated: markerSaved };
  }

  async function seedIfEmpty() {
    const installation = Storage.get('installation', {});
    if (installation.cleanup_pending || installation.data_policy === DATA_POLICY) return;

    // Sample records are intentionally disabled. This Drive-backed marker keeps
    // fresh installs and resets empty until the user enters real data.
    await _saveMarker(_marker());
  }

  async function resetToEmpty() {
    const failedKeys = await Storage.clearUserData();
    if (failedKeys.length > 0) {
      localStorage.setItem('jsc_installation', JSON.stringify({
        seeded: false,
        cleanup_pending: true,
        failed_keys: failedKeys,
      }));
      return { ok: false, failedKeys };
    }
    const markerSaved = await _saveMarker(_marker({ reset_at: new Date().toISOString() }));
    return { ok: markerSaved, failedKeys: markerSaved ? [] : ['installation'] };
  }

  async function markInitialized() {
    if (Storage.get('installation', {}).data_policy === DATA_POLICY) return true;
    return _saveMarker(_marker({ initialized_at: new Date().toISOString() }));
  }

  function disableAfterReset() {
    localStorage.setItem(DISABLED_KEY, 'true');
  }

  function _isEmptyObject(value) {
    return !value || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);
  }

  function _seedProfile() {
    const profile = Storage.get('profile', {});
    Storage.set('profile', {
      name: profile.name || 'Corinne',
      student_email: profile.student_email || 'corinne@example.com',
      school: profile.school || 'USC Marshall',
      grad_year: profile.grad_year || '2026',
      major: profile.major || 'MSBA',
      target_roles: profile.target_roles?.length ? profile.target_roles : ['Data Analyst', 'Business Intelligence Analyst', 'Product Analyst'],
      target_industries: profile.target_industries?.length ? profile.target_industries : ['Technology', 'Entertainment', 'Healthcare', 'Aerospace'],
      parent1_name: profile.parent1_name || 'Dad',
      parent1_email: profile.parent1_email || 'contact@example.com',
      parent2_name: profile.parent2_name || 'Mom',
      parent2_email: profile.parent2_email || 'supporter@example.com',
      ...profile,
    });
  }

  function _seedJobs() {
    const current = Storage.get('jobs', { applications: [] });
    if (Array.isArray(current.applications) && current.applications.length > 0) return;
    Storage.set('jobs', {
      applications: [
        { company: 'Google', role: 'Data Analyst, YouTube', date: '2026-05-20', status: 'applied', url: 'https://careers.google.com', notes: 'Sample entry: Tier 1 target. Look for USC alumni referral path.' },
        { company: 'Disney', role: 'Business Insights Analyst', date: '2026-05-21', status: 'phone', url: 'https://jobs.disneycareers.com', notes: 'Sample entry: Burbank / Glendale target. Entertainment analytics angle.' },
        { company: 'Kaiser Permanente', role: 'Healthcare Data Analyst', date: '2026-05-22', status: 'applied', url: 'https://jobs.kaiserpermanente.org', notes: 'Sample entry: Healthcare analytics, likely strong MIS fit.' },
        { company: 'Snap', role: 'Product Analyst', date: '2026-05-23', status: 'interview', url: 'https://careers.snap.com', notes: 'Sample entry: Product analytics plus psychology background.' },
        { company: 'Deloitte S&A', role: 'Analytics Consultant', date: '2026-05-24', status: 'applied', url: 'https://jobs2.deloitte.com', notes: 'Sample entry: Strategy and Analytics practice only.' },
        { company: 'Northrop Grumman', role: 'Business Intelligence Analyst', date: '2026-05-25', status: 'applied', url: 'https://www.northropgrumman.com/careers', notes: 'Sample entry: Aerospace analytics; citizenship and clearance may help.' },
        { company: 'Netflix', role: 'Data & Insights Analyst', date: '2026-05-26', status: 'applied', url: 'https://jobs.netflix.com', notes: 'Sample entry: Strong comp, competitive funnel.' },
        { company: 'ServiceTitan', role: 'Revenue Operations Analyst', date: '2026-05-27', status: 'phone', url: 'https://www.servicetitan.com/careers', notes: 'Sample entry: Enterprise SaaS, Glendale.' },
        { company: 'Capital Group', role: 'Investment Analytics Associate', date: '2026-05-28', status: 'applied', url: 'https://www.capitalgroup.com/individual/careers.html', notes: 'Sample entry: Financial services analytics.' },
        { company: 'GoodRx', role: 'Data Analyst', date: '2026-05-29', status: 'applied', url: 'https://www.goodrx.com/jobs', notes: 'Sample entry: Healthcare marketplace analytics.' },
      ],
    });
  }

  // Legacy jsc_gauges sample counters are intentionally not seeded anymore.
  // Gauge counts are derived from application rows, workflow history, and the resume folder.

  function _seedResume() {
    const current = Storage.get('resume', {});
    if (!_isEmptyObject(current) && (current.coach_feedback || current.resume_text)) return;
    Storage.set('resume', {
      sections: { contact: 92, summary: 72, experience: 68, education: 88, skills: 78, projects: 64, extras: 55 },
      notes: 'Sample resume record for demonstration only.',
      file_name: 'Corinne_Bish_Analytics_Resume_SAMPLE.pdf',
      resume_text: _sampleResumeText(),
      coach_reviewed: true,
      coach_feedback: {
        feedback: {
          contact: 'Contact section is complete and recruiter-ready. Add a portfolio link if available.',
          summary: 'The summary has a clear analytics direction but should be more specific about tools and target roles.',
          experience: 'Experience is relevant but needs stronger metrics, clearer datasets, and sharper business outcomes.',
          education: 'Education is strong and should stay prominent because USC Marshall MSBA is a major signal.',
          skills: 'Skills list is solid. Group tools by analytics, database, visualization, and business methods.',
          projects: 'Projects are promising but need clearer business questions and links to finished work.',
          extras: 'Extras are useful but should not crowd out analytics evidence.',
        },
        overall_notes: 'Strong foundation for analytics roles. The biggest improvement opportunity is converting responsibilities into quantified impact bullets.',
      },
      coach_notes: 'Strong foundation for analytics roles. Tighten metrics and make each bullet defensible in an interview.',
      last_updated: new Date().toISOString(),
    });
  }

  function _seedDeepDive() {
    const current = Storage.get('deep_dive', {});
    if (!_isEmptyObject(current) && (current.deep_dive_conversation?.length || current.resume_text)) return;
    Storage.set('deep_dive', {
      deep_dive_completed: false,
      deep_dive_date: null,
      deep_dive_conversation: [
        { role: 'assistant', content: 'Sample deep dive: Your strongest signal is the MSBA plus MIS combination. The weakest area is that several bullets describe tasks without proving business impact. For the dashboard project, who used the dashboard and what decision did it support?' },
        { role: 'user', content: 'It was used by a student project team to compare customer segments and decide which audience to prioritize.' },
        { role: 'assistant', content: 'Good. Now we need scale. How many records, segments, or variables were involved? Even an estimate is better than leaving the bullet vague.' },
      ],
      resume_score_history: [
        { version: 1, score: 72, date: new Date().toISOString(), section_scores: { contact: 92, summary: 72, experience: 68, education: 88, skills: 78, projects: 64, extras: 55 } },
      ],
      suggested_rewrites: [
        {
          section: 'Projects',
          original: 'Built dashboard to analyze customer data.',
          suggested: 'Built Tableau dashboard analyzing customer-segment behavior to identify priority audiences and support go-to-market recommendations.',
        },
      ],
      accepted_rewrites: [],
      resume_text: _sampleResumeText(),
      pending_rescore_file_name: '',
      pending_rescore_text: '',
    });
  }

  function _seedJobTargetTracker() {
    const current = Storage.get('job_target_tracker', {});
    if (!_isEmptyObject(current)) return;
    Storage.set('job_target_tracker', {
      Google: { status: 'applied', notes: 'Sample: find USC alum in YouTube analytics before follow-up.' },
      Disney: { status: 'following', notes: 'Sample: follow up with recruiter after business insights application.' },
      Snap: { status: 'interviewing', notes: 'Sample: prep product metrics and experimentation stories.' },
      'Kaiser Permanente': { status: 'applied', notes: 'Sample: emphasize healthcare analytics and MIS background.' },
      ServiceTitan: { status: 'following', notes: 'Sample: search RevOps analyst contacts in Glendale.' },
      GoodRx: { status: 'not-applied', notes: 'Sample: check open analytics roles this week.' },
    });
  }

  function _seedSessions() {
    const current = Storage.get('sessions', { sessions: [], compressed: [] });
    if ((current.sessions || []).length || (current.compressed || []).length) return;
    Storage.set('sessions', {
      compressed: [
        'Sample summary: Corinne discussed targeting LA analytics roles with a compensation floor near $100K and a preferred range of $115K-$130K. The coach recommended focusing first on Tier 1 companies, USC/Eller networking, and resume bullets with measurable business impact.',
      ],
      sessions: [{
        id: Date.now() - 86400000,
        date: new Date(Date.now() - 86400000).toISOString(),
        messages: [
          { role: 'user', content: 'I am worried my resume sounds too entry-level for data analyst roles.' },
          { role: 'assistant', content: 'That is exactly what the resume work is for. The goal is not to inflate it; it is to make the real analytics evidence easier for a recruiter to see.' },
          { role: 'user', content: 'I also need to get better about networking without feeling awkward.' },
          { role: 'assistant', content: 'Then we make it concrete: two alumni messages, one cohort message, and one follow-up this week. Small reps, not a vague personality test.' },
        ],
      }],
    });
  }

  function _seedUSC() {
    const current = Storage.get('usc', {});
    if (!_isEmptyObject(current)) return;
    Storage.set('usc', { alumni_dms: 3, coffee_chats: 1, events_attended: 1, career_center_visits: 1 });
  }

  function _seedMilestones() {
    const current = Storage.get('milestones', {});
    if (!_isEmptyObject(current)) return;
    Storage.set('milestones', {
      active_mission_id: 'deploy',
      missions: {
        dossier: { complete: false, unlocked_at: null, tasks: { resume_draft: true, coach_reviewed: true, tailored: false, proofread: false } },
        network: { complete: false, unlocked_at: null, tasks: { linkedin_updated: true, alumni_5: false, coffee_chat: true, career_center: false } },
        deploy: { complete: false, unlocked_at: null, tasks: { first_app: true, apps_10: true, apps_25: false } },
        interview: { complete: false, unlocked_at: null, tasks: { phone_screen: true, formal_interview: false, thank_you: false } },
        negotiate: { complete: false, unlocked_at: null, tasks: { offer_received: false, counter_made: false, offer_accepted: false } },
        extraction: { complete: false, unlocked_at: null, tasks: { start_confirmed: false, first_day: false, reported_back: false } },
      },
    });
  }

  function _seedMissionDiscussions() {
    const samples = {
      dossier: [
        { role: 'assistant', content: 'Sample mission note: What part of your resume feels most likely to undersell you right now?' },
        { role: 'user', content: 'Probably the project bullets. They say what I made but not why it mattered.' },
      ],
      network: [
        { role: 'assistant', content: 'Sample mission note: For networking, the first win is not getting a job. It is getting a useful conversation. Who feels easiest to message first?' },
      ],
      deploy: [
        { role: 'assistant', content: 'Sample mission note: Applications work best when they are targeted, tracked, and followed up. Which Tier 1 company deserves the next focused pass?' },
      ],
      interview: [
        { role: 'assistant', content: 'Sample mission note: Pick one project and explain the business question, data, method, result, and recommendation in under 60 seconds.' },
      ],
      negotiate: [
        { role: 'assistant', content: 'Sample mission note: Before an offer arrives, know your floor, target, and walk-away logic so the decision is calmer later.' },
      ],
      extraction: [
        { role: 'assistant', content: 'Sample mission note: Once the role is secured, the final step is starting well and reporting back what worked.' },
      ],
    };
    Object.entries(samples).forEach(([key, messages]) => {
      const storageKey = `mission_discussion_${key}`;
      const current = Storage.get(storageKey, []);
      if (!Array.isArray(current) || current.length === 0) Storage.set(storageKey, messages);
    });
  }

  function _sampleResumeText() {
    return `CORINNE BISH
Los Angeles, CA | corinne@example.com | LinkedIn: linkedin.com/in/example

SUMMARY
USC Marshall MSBA candidate with MIS background focused on data analytics, business intelligence, and product insights roles in Los Angeles.

EDUCATION
University of Southern California, Marshall School of Business - M.S. Business Analytics
University of Arizona, Eller College of Management - B.S. Management Information Systems

EXPERIENCE
Data Analytics Project Lead
- Built dashboard to analyze customer data.
- Cleaned data in SQL and Excel for project analysis.
- Presented findings to project stakeholders.

PROJECTS
Customer Segmentation Dashboard
- Used Tableau and SQL to compare customer segments and recommend target audience priorities.

SKILLS
SQL, Python, Tableau, Excel, statistics, data visualization, stakeholder communication`;
  }

  return { prepareStorage, seedIfEmpty, resetToEmpty, markInitialized, disableAfterReset };
})();
