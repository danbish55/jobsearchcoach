JobSearchCoach

JobSearchCoach is a personalized job-search command center built for Corinne Bish as a father/daughter software project. It began as a practical way to organize one new graduate's job search and grew into a full local web app that combines coaching, resume tools, progress tracking, job-lead scoring, and AI-assisted career support in one place.

The project is intentionally personal: it was designed around Corinne's background as a USC Marshall MSBA graduate with a University of Arizona Eller MIS foundation, and around the real workflows of applying for early-career analytics roles. The goal was not to build a generic job board. It was to build a tool that helps one person stay organized, improve her materials, find better-fit roles, and keep momentum through a difficult process.

What the app does

- Provides a dashboard for job-search progress, weekly goals, milestones, and a daily mission briefing.
- Offers an AI coach interface for job-search questions, planning, and encouragement.
- Reviews resumes, scores resume completeness, and supports a Resume Deep Dive interview for strengthening bullets.
- Tracks applications, follow ups, networking, USC/Eller outreach, interview prep, LinkedIn activity, side hustle activity, and job targets.
- Generates optional progress reports that can be shared with supporters.
- Includes an Intelligence/Resources page for market intel, strategy content, and video recommendations.
- Integrates with a bundled JobLeadsTool pipeline that gathers, filters, scores, and displays job leads.
- Supports manual job entry, lead approval/rejection, application workflow notes, and cover letter drafting.

Tech stack

- Front end: HTML, CSS, and vanilla JavaScript for the local app interface.
- Backend/local server: Python 3, using a lightweight local HTTP server in server.py.
- App/API layer: Next.js 14, React 18, and TypeScript for newer API routes and packaged app support.
- AI integration: Anthropic Claude API, routed through server-side endpoints so prompts and keys are not handled directly in the browser.
- Persistence: browser localStorage plus Google Drive app-data sync for progress, settings, history, saved resources, and coaching state.
- Job leads engine: bundled Python JobLeadsTool package with YAML configuration, SQLite storage, source connectors, scoring logic, and regression tests.
- Data/config: JSON for app progress and settings, YAML for candidate/job-search profile configuration.
- Testing: JavaScript regression tests for app behavior and Python pytest tests for JobLeadsTool scoring and ingestion.
- Packaging: local launcher scripts and installer/update helpers for Windows and macOS-style local installs.

How it is built

JobSearchCoach runs as a local-first web app. The user starts a local server, then uses the app in a browser at localhost. Most of the user interface lives in modular JavaScript view files under js/views, with shared UI, storage, Drive sync, Claude, and app-routing helpers under js.

The Python server handles local endpoints for Claude calls, resume/document extraction, Google Drive configuration support, and JobLeadsTool integration. The bundled JobLeadsTool lives inside the same repository and provides the job-search pipeline: source collection, normalization, fit scoring, red-flag detection, approval state, manual lead ingestion, and SQLite-backed persistence.

The app is designed around a continuous job-search workflow rather than one-off tasks. Progress data persists between sessions, AI coaching can use saved context, resume work can feed back into score history, and job leads can move from discovery to review to application support.

Father/daughter project

This repo is also a record of a collaboration. Dan built and refined the tool with Corinne's actual job search in mind, using iterative feedback from the person who would use it every day. The result is part software project and part support system: a practical app built with care, specificity, and a lot of real-world problem solving.

For recruiters

This project demonstrates full-stack product thinking on a small, personal scale: local app architecture, API integration, AI workflow design, persistent user state, data normalization, job-lead scoring, UX iteration, testing, and packaging. It also shows how a technical project can be shaped around a real user, real constraints, and an actual outcome instead of an abstract demo.
