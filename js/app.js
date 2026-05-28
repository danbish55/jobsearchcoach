/* App — main controller, routing, initialization */
const App = (() => {
  let _currentView = 'dashboard';

  async function init() {
    // Load server-side config status
    const status = await Config.load();

    // First run: no API key or profile
    if (!status.has_api_key || !status.profile_complete) {
      Onboarding.start();
      return;
    }

    launch();
  }

  async function launch() {
    // Load coaching context file fresh from disk
    await Claude.loadContext();

    // Initialize Drive if connected
    if (Config.hasDrive()) {
      await Drive.init();
      await Storage.syncFromDrive();
    }

    // Initialize milestone data
    Milestones.init();

    // Initialize gauge data (weekly reset check)
    Gauges.init();

    // Show the app shell
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('onboarding-overlay').classList.add('hidden');

    // Initialize UI (wires sidebar nav, gauge, etc.)
    UI.init();

    // Initialize coach (but don't render yet — happens on navigate)
    Coach.init();

    // Navigate to last view or dashboard
    const lastView = sessionStorage.getItem('jsc_last_view') || 'dashboard';
    navigate(lastView);

    // If first launch after onboarding, show coach automatically
    const profile = Storage.get('profile', {});
    if (profile._just_onboarded) {
      Storage.merge('profile', { _just_onboarded: false });
      navigate('coach');
    }
  }

  function navigate(viewId) {
    _currentView = viewId;
    sessionStorage.setItem('jsc_last_view', viewId);
    UI.showView(viewId);

    // Render the view
    switch (viewId) {
      case 'dashboard': Dashboard.render(); break;
      case 'coach':     /* Coach already initialized, messages persist */; break;
      case 'resume':    Resume.render(); break;
      case 'jobs':      Jobs.render(); break;
      case 'report':    Report.render(); break;
      case 'settings':  Settings.render(); break;
      case 'mission-discussion': MissionDiscussion.render(); break;
      case 'workflow-followups':
      case 'workflow-networking':
      case 'workflow-usc-eller':
      case 'workflow-interview-prep':
      case 'workflow-linkedin':
      case 'workflow-side-hustle':
        WorkflowPages.render(viewId);
        break;
      case 'job-target-tracker':
        JobTargetTracker.render();
        break;
    }
  }

  function getCurrentView() { return _currentView; }

  // Kick off
  document.addEventListener('DOMContentLoaded', init);

  return { init, launch, navigate, getCurrentView };
})();
