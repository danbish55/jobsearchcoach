#!/usr/bin/env python3
"""JobSearchCoach — Local Server v1.0"""

import http.server
import socketserver
import os
import json
import shutil
import threading
import tempfile
import webbrowser
import urllib.request
import urllib.parse
import html as html_lib
import base64
import zipfile
import xml.etree.ElementTree as ET
import subprocess
import time
import socket
import signal
import re
import sys
import ast
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
from pathlib import Path
from urllib.parse import urlparse, parse_qs

DEFAULT_PORT = 8765
PORT_SEARCH_WINDOW = 10
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BUNDLED_CONFIG_FILE = os.path.join(BASE_DIR, 'config.json')
USER_CONFIG_DIR = (
    os.path.join(os.environ.get('APPDATA', os.path.expanduser('~')), 'JobSearchCoach')
    if os.name == 'nt'
    else os.path.join(os.path.expanduser('~'), 'Library', 'Application Support', 'JobSearchCoach')
)
CONFIG_FILE = os.path.join(USER_CONFIG_DIR, 'config.json')
CONFIG_LOCK = threading.Lock()
_CONFIG_CACHE = None
_CONFIG_CACHE_KEY = None
_JL_TOOL_DIR_CACHE = None
_RESUMES_FOLDER_CACHE = None
JL_PROCESS = None
JL_LOCK = threading.Lock()
ADZUNA_APP_ID = 'd785bcf0'


def _desired_port():
    env_port = os.environ.get('JSC_PORT')
    if not env_port:
        env_port = os.environ.get('PORT')
    if not env_port:
        return DEFAULT_PORT
    try:
        value = int(env_port)
        if 1024 <= value <= 65535:
            return value
    except ValueError:
        pass
    return DEFAULT_PORT


def _is_port_free(port):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind(('127.0.0.1', port))
        return True
    except OSError:
        return False


def _is_jsc_or_jl_command(pid, command):
    normalized = command.lower()
    try:
        cwd = os.path.realpath(os.readlink(f'/proc/{pid}/cwd'))
    except (OSError, IOError):
        cwd = ''
    normalized_cwd = cwd.lower()

    if 'server.py' in normalized:
        return (
            'jobsearchcoach' in normalized
            or 'jobsearchcoach' in normalized_cwd
            or 'jsc' in normalized_cwd
        )

    if 'job_leads_tool' in normalized:
        return (
            ('run-cycle' in normalized or 'cli.py' in normalized or 'job_leads_tool.cli' in normalized)
            or 'jobleadstool' in normalized_cwd
            or 'jobleadstool' in normalized
        )

    return False


def _pid_is_running(pid):
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def _process_cmdline(pid):
    try:
        with open(f'/proc/{pid}/cmdline', 'rb') as f:
            return f.read().replace(b'\x00', b' ').decode('utf-8', errors='ignore')
    except (OSError, IOError):
        return ''


def _list_listening_pids(port):
    try:
        raw = subprocess.check_output(['ss', '-ltnp'], stderr=subprocess.DEVNULL, text=True)
    except Exception:
        return []

    target = f':{port}'
    pids = set()
    for line in raw.splitlines():
        if target not in line or 'users:(' not in line:
            continue
        for match in re.finditer(r'pid=(\d+),', line):
            try:
                pids.add(int(match.group(1)))
            except (ValueError, TypeError):
                continue
    return sorted(pids)


def _terminate_jsc_jl_processes_on_port(port):
    pids = _list_listening_pids(port)
    terminated = []

    for pid in pids:
        if not _pid_is_running(pid):
            continue
        if pid == os.getpid():
            continue

        cmd = _process_cmdline(pid)
        if not _is_jsc_or_jl_command(pid, cmd):
            continue

        print(f'  Terminating prior JSC/JL process on port {port}: pid={pid}')
        try:
            os.kill(pid, signal.SIGTERM)
            terminated.append(pid)
        except OSError:
            continue

    if not terminated:
        return []

    time.sleep(0.2)
    for pid in terminated:
        if _pid_is_running(pid):
            try:
                os.kill(pid, signal.SIGKILL)
            except OSError:
                continue

    time.sleep(0.1)
    still_running = [pid for pid in terminated if _pid_is_running(pid)]
    if still_running:
        print(f'  Warning: could not terminate process(es) on port {port}: {still_running}')

    return [pid for pid in terminated if not _pid_is_running(pid)]


def _resolve_server_port():
    preferred = _desired_port()
    if not _is_port_free(preferred):
        _terminate_jsc_jl_processes_on_port(preferred)

    last = preferred + max(PORT_SEARCH_WINDOW - 1, 0)
    for port in range(preferred, last + 1):
        if _is_port_free(port):
            return port, preferred, port != preferred
    raise RuntimeError(f'No free port found in range {preferred}-{last}')


def load_config():
    with CONFIG_LOCK:
        return _load_config_unlocked()


def save_config(updates):
    global _CONFIG_CACHE, _CONFIG_CACHE_KEY, _RESUMES_FOLDER_CACHE
    with CONFIG_LOCK:
        cfg = _load_config_unlocked()
        cfg.update(updates)
        os.makedirs(USER_CONFIG_DIR, exist_ok=True)
        fd, tmp_path = tempfile.mkstemp(prefix='config.', suffix='.tmp', dir=USER_CONFIG_DIR, text=True)
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as f:
                json.dump(cfg, f, indent=2)
                f.write('\n')
            os.replace(tmp_path, CONFIG_FILE)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        _CONFIG_CACHE = None
        _CONFIG_CACHE_KEY = None
        if 'resumes_folder' in updates:
            _RESUMES_FOLDER_CACHE = None


def _config_cache_key():
    parts = []
    for path in (BUNDLED_CONFIG_FILE, CONFIG_FILE):
        try:
            stat = os.stat(path)
            parts.append((path, stat.st_mtime_ns, stat.st_size))
        except FileNotFoundError:
            parts.append((path, None, None))
    return tuple(parts)


def _load_config_unlocked():
    global _CONFIG_CACHE, _CONFIG_CACHE_KEY
    cache_key = _config_cache_key()
    if _CONFIG_CACHE is not None and _CONFIG_CACHE_KEY == cache_key:
        return dict(_CONFIG_CACHE)
    bundled = _read_config_file(BUNDLED_CONFIG_FILE)
    user = _read_config_file(CONFIG_FILE)
    cfg = {}
    cfg.update(bundled)
    cfg.update(user)
    for key in ('google_client_id', 'google_client_secret'):
        if bundled.get(key):
            cfg[key] = bundled[key]
    _CONFIG_CACHE = dict(cfg)
    _CONFIG_CACHE_KEY = cache_key
    return dict(cfg)


def _read_config_file(path):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


# ── Apify / LinkedIn Radar ─────────────────────────────────────────────────

_APIFY_ACTOR = 'curious_coder~linkedin-jobs-scraper'
_APIFY_BASE  = 'https://api.apify.com/v2'


def _default_apify_config():
    return {
        'role_keyword': 'Data Analyst',
        'min_results': 50,
        'score_excellent_threshold': 90,
        'score_strong_threshold': 70,
        'titles': {
            'tier1': [
                'Entry Level Data Analyst', 'Junior Data Analyst', 'Associate Data Analyst',
                'Data Analyst', 'Data Coordinator', 'Business Intelligence Analyst',
                'Junior Business Analyst', 'Associate Business Analyst', 'Business Analyst',
                'Business Systems Analyst',
            ],
            'tier2': [
                'Product Analyst', 'Associate Product Analyst', 'Operations Analyst',
                'Associate Operations Analyst', 'Reporting Analyst', 'Research Analyst',
                'Compliance Analyst', 'Data Operations Specialist',
                'Data Visualization Analyst', 'Analytics Engineer',
            ],
            'tier3': [
                'Operations Specialist', 'Analytics Consultant', 'Technology Consultant',
            ],
        },
        'skills': {
            'tier1': ['SQL', 'Python', 'Tableau', 'statistical analysis', 'data visualization'],
            'tier2': ['Power BI', 'Excel', 'machine learning', 'data modeling', 'ETL', 'business intelligence'],
            'tier3': ['database management', 'optimization', 'requirements analysis', 'systems analysis', 'A/B test', 'forecasting'],
        },
        'keywords': {
            'tier1': ['new grad', 'recent graduate', 'no experience required'],
            'tier2': ['entry level', '0-2 years', '0 to 2 years', '1-2 years', 'junior', 'associate'],
            'tier3': ["master's preferred", 'MSBA', 'MBA', 'advanced degree'],
        },
        'locations': {
            'tier1': [
                'West Hollywood', 'Silver Lake', 'Los Feliz', 'Koreatown', 'Hollywood',
                'Century City', 'Brentwood', 'Westwood', 'Beverly Hills', 'Culver City',
                'Santa Monica', 'Playa Vista', 'Marina del Rey', 'Venice', 'El Segundo',
                'Manhattan Beach', 'Hermosa Beach', 'Redondo Beach', 'Torrance', 'Hawthorne',
                'Inglewood', 'Burbank', 'Glendale', 'Pasadena', 'Alhambra', 'San Gabriel',
                'Arcadia', 'Studio City', 'Sherman Oaks', 'Encino', 'North Hollywood',
                'Van Nuys', 'Long Beach', 'Downey', 'Carson', 'Los Angeles',
                'Irvine', 'Anaheim', 'Orange County', 'Costa Mesa', 'Newport Beach',
                'Huntington Beach', 'Fullerton', 'Brea', 'Santa Ana', 'Garden Grove',
                'San Diego', 'La Jolla', 'Chula Vista', 'Carlsbad', 'Oceanside',
                'Escondido', 'Del Mar', 'Encinitas', 'El Cajon', 'National City',
            ],
            'tier2': [
                'Dallas', 'Fort Worth', 'DFW', 'Plano', 'Irving', 'Frisco', 'McKinney', 'Arlington',
                'Austin', 'Round Rock',
                'Denver', 'Boulder', 'Aurora', 'Lakewood',
                'Seattle', 'Bellevue', 'Redmond', 'Kirkland', 'Tacoma',
                'Salt Lake City', 'Provo', 'Sandy',
                'Portland', 'Beaverton', 'Hillsboro',
                'Houston', 'Sugar Land', 'The Woodlands', 'Katy',
                'St. Louis', 'Saint Louis',
            ],
            'tier3': ['Las Vegas', 'Henderson', 'Summerlin'],
        },
        'scoring': {
            'skills_max': 40,
            'experience_max': 30,
            'trajectory_max': 20,
            'preference_max': 10,
            'title_tier1_pts': 20,
            'title_tier2_pts': 12,
            'title_tier3_pts': 5,
            'skill_tier1_weight': 10,
            'skill_tier2_weight': 6,
            'skill_tier3_weight': 3,
            'keyword_tier1_pts': 30,
            'keyword_tier2_pts': 28,
            'keyword_tier3_bonus': 5,
            'exp_default_pts': 10,
            'senior_title_penalty': 15,
            'exp_3yr_penalty': 6,
            'exp_4yr_penalty': 12,
            'exp_5yr_penalty': 18,
            'exp_7yr_penalty': 25,
            'min_score_threshold': 40,
            'location_remote_pts': 8,
            'location_tier1_pts': 9,
            'location_tier2_pts': 7,
            'location_tier3_pts': 5,
            'location_ambiguous_pts': 2,
            'location_non_preferred_pts': 0,
        },
    }


def _deep_merge(base, override):
    result = dict(base)
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def _score_apify_job(item, cfg):
    titles_cfg    = cfg.get('titles', {})
    skills_cfg    = cfg.get('skills', {})
    keywords_cfg  = cfg.get('keywords', {})
    locations_cfg = cfg.get('locations', {})
    scoring       = cfg.get('scoring', {})

    desc      = (item.get('description') or '').lower()
    title     = (item.get('title') or '').lower()
    location  = (item.get('location') or '').lower()
    seniority = (item.get('seniorityLevel') or '').lower()

    # ── Skills (max 40 pts) ──────────────────────────────────────────────
    skills_max     = int(scoring.get('skills_max', 40))
    w1             = int(scoring.get('skill_tier1_weight', 10))
    w2             = int(scoring.get('skill_tier2_weight', 6))
    w3             = int(scoring.get('skill_tier3_weight', 3))
    matched_skills = []
    matched_weight = 0
    total_possible = 0
    for skill in skills_cfg.get('tier1', []):
        total_possible += w1
        if skill.lower() in desc:
            matched_weight += w1
            matched_skills.append(skill)
    for skill in skills_cfg.get('tier2', []):
        total_possible += w2
        if skill.lower() in desc:
            matched_weight += w2
            matched_skills.append(skill)
    for skill in skills_cfg.get('tier3', []):
        total_possible += w3
        if skill.lower() in desc:
            matched_weight += w3
            matched_skills.append(skill)
    if total_possible:
        skills_score = min(skills_max, round((matched_weight / total_possible) * skills_max * 1.6))
    else:
        skills_score = 0

    # ── Experience (max 30 pts) ──────────────────────────────────────────
    exp_max = int(scoring.get('experience_max', 30))
    kw1 = [k.lower() for k in keywords_cfg.get('tier1', [])]
    kw2 = [k.lower() for k in keywords_cfg.get('tier2', [])]
    kw3 = [k.lower() for k in keywords_cfg.get('tier3', [])]
    if any(k in desc for k in kw1):
        exp_score = int(scoring.get('keyword_tier1_pts', 30))
    elif any(k in desc for k in kw2):
        exp_score = int(scoring.get('keyword_tier2_pts', 28))
    else:
        exp_score = int(scoring.get('exp_default_pts', 10))
    if seniority in ('entry level', 'entry-level', 'internship'):
        exp_score = min(exp_score + 3, exp_max)
    if any(k in desc for k in kw3):
        exp_score = min(exp_score + int(scoring.get('keyword_tier3_bonus', 5)), exp_max)
    # Penalize explicit year requirements
    import re as _re
    plus_m  = _re.search(r'\b(\d+)\s*\+\s*years?\b', desc)
    range_m = _re.search(r'\b(\d+)\s*[-–]\s*\d+\s*years?\b', desc)
    min_yrs = int(plus_m.group(1)) if plus_m else (int(range_m.group(1)) if range_m else 0)
    if   min_yrs >= 7: exp_score -= int(scoring.get('exp_7yr_penalty', 25))
    elif min_yrs >= 5: exp_score -= int(scoring.get('exp_5yr_penalty', 18))
    elif min_yrs >= 4: exp_score -= int(scoring.get('exp_4yr_penalty', 12))
    elif min_yrs >= 3: exp_score -= int(scoring.get('exp_3yr_penalty', 6))
    exp_score = max(0, min(exp_score, exp_max))

    # ── Trajectory (max 20 pts) ──────────────────────────────────────────
    traj_max = int(scoring.get('trajectory_max', 20))
    t1 = [t.lower() for t in titles_cfg.get('tier1', [])]
    t2 = [t.lower() for t in titles_cfg.get('tier2', [])]
    t3 = [t.lower() for t in titles_cfg.get('tier3', [])]
    if any(t in title for t in t1):
        traj_score = int(scoring.get('title_tier1_pts', 20))
    elif any(t in title for t in t2):
        traj_score = int(scoring.get('title_tier2_pts', 12))
    elif any(t in title for t in t3):
        traj_score = int(scoring.get('title_tier3_pts', 5))
    else:
        traj_score = 5
    # Penalize senior/leadership titles
    if _re.search(r'\b(senior|sr\.?|lead|manager|director|principal|head of|vp|vice president|chief|staff)\b', title):
        traj_score -= int(scoring.get('senior_title_penalty', 15))

    # ── Preference / location (max 10 pts) ──────────────────────────────
    pref_max     = int(scoring.get('preference_max', 10))
    remote_terms = ['remote', 'hybrid', 'wfh', 'work from home', 'telework', 'telecommute', 'virtual']
    is_remote    = any(s in location for s in remote_terms) or any(s in desc for s in remote_terms)
    if is_remote:
        pref_score = int(scoring.get('location_remote_pts', 8))
    else:
        loc1 = [l.lower() for l in locations_cfg.get('tier1', [])]
        loc2 = [l.lower() for l in locations_cfg.get('tier2', [])]
        loc3 = [l.lower() for l in locations_cfg.get('tier3', [])]
        if any(l in location for l in loc1):
            pref_score = int(scoring.get('location_tier1_pts', 9))
        elif any(l in location for l in loc2):
            pref_score = int(scoring.get('location_tier2_pts', 7))
        elif any(l in location for l in loc3):
            pref_score = int(scoring.get('location_tier3_pts', 5))
        elif not location.strip() or location.strip() in ('united states', 'us', 'usa'):
            pref_score = int(scoring.get('location_ambiguous_pts', 2))
        else:
            pref_score = int(scoring.get('location_non_preferred_pts', -15))
    salary = str(item.get('salary') or '').strip()
    if salary and salary.lower() not in ('null', 'none', ''):
        pref_score = min(pref_score + 1, pref_max)
    pref_score = min(pref_score, pref_max)

    # ── Total ─────────────────────────────────────────────────────────────
    total  = max(0, min(100, skills_score + exp_score + traj_score + pref_score))
    job_id = str(item.get('id') or '')
    link   = item.get('link') or item.get('jobUrl') or ''
    url    = f'https://www.linkedin.com/jobs/view/{job_id}' if job_id else link

    return {
        'id':              job_id,
        'title':           item.get('title') or '',
        'company':         item.get('companyName') or item.get('company') or '',
        'location':        item.get('location') or '',
        'url':             url,
        'salary':          salary or None,
        'applicantsCount': item.get('applicantsCount'),
        'seniorityLevel':  item.get('seniorityLevel') or '',
        'employmentType':  item.get('employmentType') or '',
        'postedAt':        item.get('postedAt') or '',
        'description':     (item.get('description') or '')[:4000],
        'score':           total,
        'score_breakdown': {
            'skills':     skills_score,
            'experience': exp_score,
            'trajectory': traj_score,
            'preference': pref_score,
        },
        'skills_matched': matched_skills,
    }


def _status_payload(bundled, user, cfg, server_port=None):
    install_id = str(bundled.get('install_build_id') or '').strip()
    api_key = str(user.get('anthropic_api_key') or cfg.get('anthropic_api_key') or '').strip()
    has_api_key = bool(api_key)
    if install_id:
        setup_complete = user.get('completed_install_id') == install_id and has_api_key
    else:
        setup_complete = has_api_key and bool(cfg.get('profile_complete', False))
    return {
        'has_api_key': has_api_key,
        'has_drive': bool(cfg.get('google_refresh_token')),
        'google_client_id': cfg.get('google_client_id', ''),
        'claude_model': cfg.get('claude_model', ''),
        'profile_complete': setup_complete,
        'setup_complete': setup_complete,
        'install_build_id': install_id,
        'port': server_port,
    }



def _find_job_leads_tool_dir():
    global _JL_TOOL_DIR_CACHE
    if _JL_TOOL_DIR_CACHE is not None:
        return _JL_TOOL_DIR_CACHE
    # JobLeadsTool ships inside the app folder; that copy always wins over a
    # configured jl_path left behind by an old two-repo install.
    bundled = os.path.join(BASE_DIR, 'JobLeadsTool')
    if os.path.exists(os.path.join(bundled, 'src', 'job_leads_tool', 'cli.py')):
        _JL_TOOL_DIR_CACHE = bundled
        return bundled

    configured = (load_config().get('jl_path') or '').strip()
    if configured:
        configured = os.path.expanduser(configured)
        cli_path = os.path.join(configured, 'src', 'job_leads_tool', 'cli.py')
        if os.path.exists(cli_path):
            _JL_TOOL_DIR_CACHE = configured
            return configured

    candidates = [
        os.path.normpath(os.path.join(BASE_DIR, '..', 'JobLeadsTool')),
        '/mnt/c/code/corinne/jobleadstool',
        '/mnt/c/code/Corinne/JobLeadsTool',
        '/mnt/c/code/JobLeadsTool',
        '/mnt/c/code/jobleadstool',
    ]
    for candidate in candidates:
        candidate = os.path.expanduser(candidate)
        cli_path = os.path.join(candidate, 'src', 'job_leads_tool', 'cli.py')
        if os.path.exists(cli_path):
            _JL_TOOL_DIR_CACHE = candidate
            return candidate
    _JL_TOOL_DIR_CACHE = None
    return None


def _start_job_leads_tool(force=False):
    global JL_PROCESS
    repo_dir = _find_job_leads_tool_dir()
    if not repo_dir:
        return {'ok': False, 'error': 'JobLeadsTool path not found for local JL startup.'}

    profile_path = os.path.join(repo_dir, 'config', 'candidate_profile.yaml')
    if not os.path.exists(profile_path):
        return {'ok': False, 'error': 'candidate_profile.yaml not found in JobLeadsTool/config.'}

    if not force:
        with JL_LOCK:
            if JL_PROCESS is not None and JL_PROCESS.poll() is None:
                return {
                    'ok': True,
                    'status': 'already_running',
                    'pid': JL_PROCESS.pid,
                    'open_url': '/api/jl-output?view=review',
                }

    outputs = {
        'data': os.path.join(repo_dir, 'data'),
        'outputs': os.path.join(repo_dir, 'outputs'),
    }
    os.makedirs(outputs['data'], exist_ok=True)
    os.makedirs(outputs['outputs'], exist_ok=True)

    cmd = [
        sys.executable,
        '-m',
        'job_leads_tool.cli',
        'run-cycle',
        '--profile', profile_path,
        '--db', os.path.join(repo_dir, 'data', 'leads.db'),
        '--health-out', os.path.join(repo_dir, 'outputs', 'source_health.json'),
        '--scored-out', os.path.join(repo_dir, 'outputs', 'scored_leads.json'),
        '--review-html', os.path.join(repo_dir, 'outputs', 'review_dashboard_cycle.html'),
        '--digest-out', os.path.join(repo_dir, 'outputs', 'digest_cycle.txt'),
    ]

    env = os.environ.copy()
    env['PYTHONPATH'] = os.path.join(repo_dir, 'src')
    if existing_path := os.environ.get('PYTHONPATH'):
        if existing_path:
            env['PYTHONPATH'] = env['PYTHONPATH'] + os.pathsep + existing_path

    try:
        proc = subprocess.Popen(
            cmd,
            cwd=repo_dir,
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
        )
    except Exception as e:
        return {'ok': False, 'error': f'Could not start JobLeadsTool: {e}'}

    with JL_LOCK:
        JL_PROCESS = proc

    time.sleep(0.25)
    if proc.poll() is not None:
        err_text = proc.stderr.read().strip() if proc.stderr else ''
        if proc.returncode == 0:
            return {
                'ok': True,
                'status': 'completed',
                'pid': proc.pid,
                'repo': repo_dir,
                'command': ' '.join(cmd),
                'open_url': '/api/jl-output?view=review',
            }
        return {
            'ok': False,
            'error': 'JobLeadsTool exited early before startup completed.',
            'exit_code': proc.returncode,
            'stderr': err_text[:2000] if err_text else None,
        }

    return {
        'ok': True,
        'status': 'started',
        'pid': proc.pid,
        'repo': repo_dir,
        'command': ' '.join(cmd),
        'open_url': '/api/jl-output?view=review',
    }


def _job_leads_output_path(view: str) -> str | None:
    repo_dir = _find_job_leads_tool_dir()
    if not repo_dir:
        return None

    view_to_file = {
        'review': os.path.join(repo_dir, 'outputs', 'review_dashboard_cycle.html'),
        'scored': os.path.join(repo_dir, 'outputs', 'scored_leads.json'),
        'health': os.path.join(repo_dir, 'outputs', 'source_health.json'),
        'digest': os.path.join(repo_dir, 'outputs', 'digest_cycle.txt'),
    }
    return view_to_file.get(view)


def _job_leads_tool_dir_required():
    repo_dir = _find_job_leads_tool_dir()
    if not repo_dir:
        raise FileNotFoundError('JobLeadsTool path not found. Set jl_path in config.json.')
    return repo_dir


def _job_leads_env(repo_dir):
    env = os.environ.copy()
    src_dir = os.path.join(repo_dir, 'src')
    env['PYTHONPATH'] = src_dir
    if existing_path := os.environ.get('PYTHONPATH'):
        if existing_path:
            env['PYTHONPATH'] = env['PYTHONPATH'] + os.pathsep + existing_path
    return env


def _job_leads_run_cycle_command(repo_dir):
    profile_path = os.path.join(repo_dir, 'config', 'candidate_profile.yaml')
    if not os.path.exists(profile_path):
        raise FileNotFoundError('candidate_profile.yaml not found in JobLeadsTool/config.')

    return [
        sys.executable,
        '-m',
        'job_leads_tool.cli',
        'run-cycle',
        '--profile', profile_path,
        '--db', os.path.join(repo_dir, 'data', 'leads.db'),
        '--health-out', os.path.join(repo_dir, 'outputs', 'source_health.json'),
        '--scored-out', os.path.join(repo_dir, 'outputs', 'scored_leads.json'),
        '--review-html', os.path.join(repo_dir, 'outputs', 'review_dashboard_cycle.html'),
        '--digest-out', os.path.join(repo_dir, 'outputs', 'digest_cycle.txt'),
    ]


def _job_leads_db_path(repo_dir):
    return Path(repo_dir) / 'data' / 'leads.db'


def _job_leads_deleted_ids_path(repo_dir):
    return Path(repo_dir) / 'data' / 'deleted_leads.json'


def _default_resumes_folder():
    return os.path.join('~', 'Documents', 'Resumes')


def _resolve_resumes_folder():
    global _RESUMES_FOLDER_CACHE
    if _RESUMES_FOLDER_CACHE:
        return _RESUMES_FOLDER_CACHE
    cfg = load_config()
    configured = (cfg.get('resumes_folder') or '').strip()
    if not configured:
        configured = _default_resumes_folder()
        save_config({'resumes_folder': configured})
    _RESUMES_FOLDER_CACHE = os.path.abspath(os.path.expanduser(configured))
    return _RESUMES_FOLDER_CACHE


_RESUME_FILE_EXTENSIONS = {'.pdf', '.doc', '.docx', '.txt', '.rtf', '.md', '.pages'}


def _count_resume_files():
    folder = _resolve_resumes_folder()
    if not os.path.isdir(folder):
        return {'path': folder, 'count': 0}
    count = 0
    for name in os.listdir(folder):
        if name.startswith('.'):
            continue
        full_path = os.path.join(folder, name)
        if not os.path.isfile(full_path):
            continue
        _, ext = os.path.splitext(name.lower())
        if ext in _RESUME_FILE_EXTENSIONS:
            count += 1
    return {'path': folder, 'count': count}


def _sort_scored_leads(leads):
    def score_value(item):
        try:
            return int(item.get('score') or item.get('fit_score') or 0)
        except (TypeError, ValueError):
            return 0
    return sorted(leads if isinstance(leads, list) else [], key=score_value, reverse=True)

class AppHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def _server_port(self):
        server_address = getattr(self.server, 'server_address', ('', DEFAULT_PORT))
        try:
            return int(server_address[1])
        except (IndexError, TypeError, ValueError):
            return DEFAULT_PORT

    def log_message(self, *args):
        pass  # Quiet server — no log noise

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/status':
            cfg = load_config()
            bundled = _read_config_file(BUNDLED_CONFIG_FILE)
            user = _read_config_file(CONFIG_FILE)
            self._json(_status_payload(bundled, user, cfg, server_port=self._server_port()))
        elif path == '/api/context':
            ctx_path = os.path.join(BASE_DIR, 'context', 'corinne_claude_context.md')
            try:
                with open(ctx_path, encoding='utf-8') as f:
                    content = f.read()
                self._json({'content': content})
            except FileNotFoundError:
                self._json({'content': '', 'error': 'context file not found'})
        elif path == '/api/jl/profile':
            self._jl_profile()
        elif path == '/api/config/sources':
            self._config_sources()
        elif path == '/api/jl-output':
            self._job_leads_output()
        elif path == '/api/open-folder':
            self._open_folder()
        elif path == '/api/resumes/count':
            self._resume_count()
        elif path == '/api/apify/output':
            self._apify_output()
        elif path == '/api/apify/config':
            self._apify_config_get()
        elif path == '/oauth2callback':
            self._oauth_callback(urlparse(self.path).query)
        else:
            super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            body = self._read_body()
        except json.JSONDecodeError:
            self._json({'ok': False, 'error': 'Invalid JSON request body'}, 400)
            return

        if path == '/api/config':
            save_config(body)
            self._json({'ok': True})
        elif path == '/api/config/sources':
            self._save_config_sources(body)
        elif path == '/api/token-exchange':
            self._token_exchange(body)
        elif path == '/api/token-refresh':
            self._token_refresh()
        elif path == '/api/start-jl':
            self._start_jl(body)
        elif path == '/api/jl/run-cycle':
            self._jl_run_cycle()
        elif path == '/api/jl/approve':
            self._jl_transition(body, 'approved')
        elif path == '/api/jl/reject':
            self._jl_transition(body, 'rejected')
        elif path == '/api/jl/apply':
            self._jl_apply(body)
        elif path == '/api/jl/delete':
            self._jl_delete(body)
        elif path == '/api/jl/add-manual':
            self._jl_add_manual(body)
        elif path == '/api/jl/save-profile':
            self._jl_save_profile(body)
        elif path == '/api/jl/reset-profile':
            self._jl_reset_profile()
        elif path == '/api/extract-resume':
            self._extract_resume(body)
        elif path == '/api/claude':
            self._claude_proxy(body)
        elif path == '/api/apify/run':
            self._apify_run()
        elif path == '/api/apify/state':
            self._apify_state(body)
        elif path == '/api/apify/delete':
            self._apify_delete(body)
        elif path == '/api/apify/config':
            self._apify_config_save(body)
        else:
            self.send_response(404)
            self.end_headers()

    def _read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        return json.loads(self.rfile.read(length)) if length else {}

    def _save_config_sources(self, body):
        incoming = body.get('sources') if isinstance(body.get('sources'), dict) else {}
        if not isinstance(incoming, dict):
            self._json({'ok': False, 'error': 'sources must be an object'}, 400)
            return

        current = load_config().get('job_sources') or {}
        if not isinstance(current, dict):
            current = {}

        next_sources = {}
        for key, label, requires_key in (
            ('greenhouse', 'Greenhouse', False),
            ('lever', 'Lever', False),
            ('usajobs', 'USAJOBS', True),
            ('adzuna', 'Adzuna', True),
            ('the_muse', 'The Muse', False),
            ('indeed_rss', 'Indeed RSS', False),
            ('built_in_la', 'Built In LA', False),
        ):
            source_in = incoming.get(key) if isinstance(incoming.get(key), dict) else {}
            source_current = current.get(key) if isinstance(current.get(key), dict) else {}
            stored_key = ''
            if requires_key:
                raw_key = str(source_in.get('api_key') or '').strip()
                if raw_key and raw_key != '***':
                    stored_key = raw_key
                elif source_current.get('api_key'):
                    stored_key = source_current.get('api_key')
            next_source = {
                'label': label,
                'enabled': bool(source_in.get('enabled')) or bool(stored_key),
            }
            if requires_key:
                next_source['api_key'] = stored_key
            next_sources[key] = next_source

        save_config({'job_sources': next_sources})
        self._json({'ok': True})

    def _resume_count(self):
        try:
            payload = _count_resume_files()
            self._json({'ok': True, **payload})
        except Exception as exc:
            self._json({'ok': False, 'error': str(exc), 'count': 0}, 500)

    def _start_jl(self, body):
        force = bool(body.get('force'))
        result = _start_job_leads_tool(force=force)
        status = 200 if result.get('ok') else 500
        self._json(result, status)

    def _jl_profile(self):
        try:
            repo_dir = _job_leads_tool_dir_required()
            drive_profile = self._try_load_jl_drive_profile(repo_dir)
            if drive_profile is not None:
                self._json({'ok': True, 'profile': drive_profile, 'source': 'drive'})
                return
            self._json({'ok': True, 'profile': self._load_jl_local_profile(repo_dir), 'source': 'local'})
        except FileNotFoundError as exc:
            self._json({'ok': False, 'error': str(exc)}, 404)
        except Exception as exc:
            self._json({'ok': False, 'error': f'Could not load JobLeadsTool profile: {exc}'}, 500)

    def _config_sources(self):
        try:
            sources = self._masked_job_sources(load_config().get('job_sources') or {})
            health = {}
            try:
                health = self._read_jl_output_json('health')
            except Exception:
                health = {}
            self._json({'ok': True, 'sources': sources, 'health': health})
        except Exception as exc:
            self._json({'ok': False, 'error': f'Could not load source config: {exc}'}, 500)

    def _masked_job_sources(self, stored_sources):
        if not isinstance(stored_sources, dict):
            stored_sources = {}
        masked = {}
        for key, label, requires_key in (
            ('greenhouse', 'Greenhouse', False),
            ('lever', 'Lever', False),
            ('usajobs', 'USAJOBS', True),
            ('adzuna', 'Adzuna', True),
            ('the_muse', 'The Muse', False),
            ('indeed_rss', 'Indeed RSS', False),
            ('built_in_la', 'Built In LA', False),
        ):
            source = stored_sources.get(key) if isinstance(stored_sources.get(key), dict) else {}
            masked_source = {
                'label': label,
                'enabled': bool(source.get('enabled')),
            }
            if requires_key:
                masked_source['api_key'] = '***' if source.get('api_key') else ''
                masked_source['has_api_key'] = bool(source.get('api_key'))
            masked[key] = masked_source
        return masked

    def _jl_save_profile(self, body):
        profile = body.get('profile') if isinstance(body.get('profile'), dict) else body
        if not isinstance(profile, dict):
            self._json({'ok': False, 'error': 'profile is required'}, 400)
            return

        try:
            repo_dir = _job_leads_tool_dir_required()
            drive_result = self._try_save_jl_drive_profile(repo_dir, profile)
            if drive_result is not None:
                self._json({'ok': True, 'saved_to': 'drive', 'result': drive_result})
                return

            profile_path = self._save_jl_local_profile(repo_dir, profile)
        except FileNotFoundError as exc:
            self._json({'ok': False, 'error': str(exc)}, 404)
            return
        except Exception as exc:
            self._json({'ok': False, 'error': f'Could not save JobLeadsTool profile: {exc}'}, 500)
            return

        self._json({'ok': True, 'saved_to': 'local', 'path': profile_path})

    def _jl_reset_profile(self):
        try:
            repo_dir = _job_leads_tool_dir_required()
            result = subprocess.run(
                ['git', '-C', repo_dir, 'show', 'HEAD:config/candidate_profile.yaml'],
                check=True,
                capture_output=True,
                text=True,
            )
            profile_path = os.path.join(repo_dir, 'config', 'candidate_profile.yaml')
            os.makedirs(os.path.dirname(profile_path), exist_ok=True)
            with open(profile_path, 'w', encoding='utf-8') as profile_file:
                profile_file.write(result.stdout)
            profile = self._load_jl_local_profile(repo_dir)
            self._try_save_jl_drive_profile(repo_dir, profile)
            self._json({'ok': True, 'profile': profile, 'source': 'committed-default'})
        except FileNotFoundError as exc:
            self._json({'ok': False, 'error': str(exc)}, 404)
        except subprocess.CalledProcessError as exc:
            detail = (exc.stderr or '').strip() or 'Could not read the committed Job Leads profile.'
            self._json({'ok': False, 'error': detail}, 500)
        except Exception as exc:
            self._json({'ok': False, 'error': f'Could not reset JobLeadsTool profile: {exc}'}, 500)

    def _try_save_jl_drive_profile(self, repo_dir, profile):
        src_dir = os.path.join(repo_dir, 'src')
        if src_dir not in sys.path:
            sys.path.insert(0, src_dir)
        try:
            from job_leads_tool import drive_store
        except Exception:
            return None
        save_fn = getattr(drive_store, 'save_profile', None)
        if not callable(save_fn):
            return None
        return save_fn(self._drive_service_payload(), profile)

    def _try_load_jl_drive_profile(self, repo_dir):
        src_dir = os.path.join(repo_dir, 'src')
        if src_dir not in sys.path:
            sys.path.insert(0, src_dir)
        try:
            from job_leads_tool import drive_store
        except Exception:
            return None
        load_fn = getattr(drive_store, 'load_profile', None)
        if not callable(load_fn):
            return None
        return load_fn(self._drive_service_payload())

    def _load_jl_local_profile(self, repo_dir):
        profile_path = os.path.join(repo_dir, 'config', 'candidate_profile.yaml')
        if not os.path.exists(profile_path):
            raise FileNotFoundError('candidate_profile.yaml not found in JobLeadsTool/config.')
        with open(profile_path, 'r', encoding='utf-8') as profile_file:
            raw = profile_file.read()
        try:
            import yaml
            data = yaml.safe_load(raw) or {}
        except ImportError:
            data = self._parse_simple_yaml(raw)
        if not isinstance(data, dict):
            raise ValueError('candidate_profile.yaml must contain an object.')
        return data

    def _parse_simple_yaml(self, raw):
        data = {}
        list_key = None
        for raw_line in raw.splitlines():
            line = raw_line.strip()
            if not line or line.startswith('#'):
                continue
            if line.startswith('- ') and list_key:
                data[list_key].append(self._parse_simple_yaml_value(line[2:].strip()))
                continue
            if raw_line[:1].isspace() or ':' not in line:
                continue
            key, value = line.split(':', 1)
            key = key.strip()
            value = value.strip()
            if not value:
                data[key] = []
                list_key = key
            else:
                data[key] = self._parse_simple_yaml_value(value)
                list_key = None
        return data

    def _parse_simple_yaml_value(self, value):
        if value[:1] in ('"', "'"):
            try:
                return ast.literal_eval(value)
            except (SyntaxError, ValueError):
                return value.strip('"\'')
        lowered = value.lower()
        if lowered in ('true', 'false'):
            return lowered == 'true'
        try:
            return int(value)
        except ValueError:
            try:
                return float(value)
            except ValueError:
                return value

    def _save_jl_local_profile(self, repo_dir, profile):
        config_dir = os.path.join(repo_dir, 'config')
        os.makedirs(config_dir, exist_ok=True)
        profile_path = os.path.join(config_dir, 'candidate_profile.yaml')
        local_profile = self._jl_yaml_profile_payload(profile)
        with open(profile_path, 'w', encoding='utf-8') as profile_file:
            profile_file.write(self._simple_yaml(local_profile))
        return profile_path

    def _jl_yaml_profile_payload(self, profile):
        def list_value(*keys):
            for key in keys:
                value = profile.get(key)
                if isinstance(value, list):
                    return [str(item).strip() for item in value if str(item).strip()]
            return []

        return {
            'name': str(profile.get('name') or 'Corinne').strip() or 'Corinne',
            'target_titles': list_value('target_titles', 'target_roles'),
            'skills': list_value('skills'),
            'preferred_locations': list_value('preferred_locations'),
            'must_have_keywords': list_value('must_have_keywords'),
            'preferred_keywords': list_value('preferred_keywords'),
            'excluded_keywords': list_value('excluded_keywords'),
        }

    def _simple_yaml(self, data):
        lines = []
        for key, value in data.items():
            if isinstance(value, list):
                if value:
                    lines.append(f'{key}:')
                    for item in value:
                        lines.append(f'  - {json.dumps(item)}')
                else:
                    lines.append(f'{key}: []')
            else:
                lines.append(f'{key}: {json.dumps(value)}')
        return '\n'.join(lines) + '\n'

    def _open_folder(self):
        query = parse_qs(urlparse(self.path).query)
        folder_type = (query.get('type') or [''])[0]
        if folder_type != 'resumes':
            self._json({'error': f'Unknown folder type: {folder_type}'}, 400)
            return

        try:
            folder_path = _resolve_resumes_folder()
            os.makedirs(folder_path, exist_ok=True)
            for name in ('Resume_v1.pdf', 'Resume_v2.pdf', 'Resume_v3.pdf'):
                placeholder = os.path.join(folder_path, name)
                if not os.path.exists(placeholder):
                    open(placeholder, 'ab').close()

            if os.name == 'nt':
                try:
                    subprocess.Popen(['explorer.exe', folder_path], shell=False)
                except Exception:
                    os.startfile(folder_path)
            elif sys.platform == 'darwin':
                subprocess.run(['open', folder_path], check=False)
            else:
                subprocess.run(['xdg-open', folder_path], check=False)
        except Exception as exc:
            self._json({'success': False, 'error': str(exc)}, 500)
            return

        self._json({'success': True, 'path': folder_path})

    def _jl_run_cycle(self):
        try:
            repo_dir = _job_leads_tool_dir_required()
            result = self._run_jl_cycle_direct(repo_dir)
        except Exception as exc:
            self._json({'success': False, 'error': str(exc)}, 500)
            return

        self._json({
            'success': True,
            'output': json.dumps(result, indent=2),
            'lead_counts': self._jl_lead_counts(),
        })

    def _run_jl_cycle_direct(self, repo_dir):
        src_dir = os.path.join(repo_dir, 'src')
        if src_dir not in sys.path:
            sys.path.insert(0, src_dir)

        from job_leads_tool.cli import _score_from_db
        from job_leads_tool.reporting import write_dashboard_html
        from job_leads_tool.sources_runner import run_sources_to_sqlite, write_source_health

        db_path = Path(repo_dir) / 'data' / 'leads.db'
        health_path = Path(repo_dir) / 'outputs' / 'source_health.json'
        scored_path = Path(repo_dir) / 'outputs' / 'scored_leads.json'
        review_path = Path(repo_dir) / 'outputs' / 'review_dashboard_cycle.html'
        digest_path = Path(repo_dir) / 'outputs' / 'digest_cycle.txt'
        profile_path = Path(repo_dir) / 'config' / 'candidate_profile.yaml'

        self._jl_source_filter_profile = self._load_jl_local_profile(repo_dir)
        sources = self._configured_jl_sources(repo_dir)
        source_health = run_sources_to_sqlite(db_path, sources)
        notes = getattr(self, '_jl_source_notes', [])
        if notes:
            source_health.setdefault('sources', []).extend(notes)
            source_health['total'] = len(source_health.get('sources') or [])
        current_lead_ids = self._current_jl_source_ids(repo_dir, source_health)
        current_lead_ids.update(self._existing_jl_scored_output_ids(scored_path))
        health = self._public_jl_health(source_health)
        write_source_health(health_path, health)

        scored = _score_from_db(profile_path, db_path)
        deleted_ids = self._load_jl_deleted_ids(repo_dir)
        scored = [
            item for item in scored
            if str((item.get('lead') or item).get('id') or item.get('lead_id') or item.get('id') or '') in current_lead_ids
            and str((item.get('lead') or item).get('id') or item.get('lead_id') or item.get('id') or '') not in deleted_ids
        ]
        scored = [
            item for item in scored
            if not self._scored_jl_item_excluded_by_profile(item)
        ]
        scored_path.parent.mkdir(parents=True, exist_ok=True)
        scored_path.write_text(json.dumps(scored, indent=2), encoding='utf-8')
        write_dashboard_html(scored_path, review_path)

        digest_path.parent.mkdir(parents=True, exist_ok=True)
        digest_path.write_text(
            f"Live JL cycle complete.\nSources run: {health.get('total', 0)}\nScored leads: {len(scored)}\n",
            encoding='utf-8',
        )
        return {
            'db': str(db_path),
            'health_out': str(health_path),
            'scored_out': str(scored_path),
            'review_html': str(review_path),
            'digest_out': str(digest_path),
            'sources': [source.as_dict() for source in sources],
            'scored_count': len(scored),
        }

    def _current_jl_source_ids(self, repo_dir, source_health=None):
        ids = set()
        if isinstance(source_health, dict):
            for row in source_health.get('sources') or []:
                if not isinstance(row, dict):
                    continue
                for lead in row.get('_leads') or []:
                    lead_id = getattr(lead, 'id', None)
                    if lead_id:
                        ids.add(str(lead_id))
        for path in (Path(repo_dir) / 'data').glob('*_live.json'):
            try:
                payload = json.loads(path.read_text(encoding='utf-8'))
            except Exception:
                continue
            jobs = payload.get('jobs') if isinstance(payload, dict) else []
            if not isinstance(jobs, list):
                continue
            for job in jobs:
                if isinstance(job, dict) and job.get('id'):
                    ids.add(str(job.get('id')))
        ids.update(self._manual_jl_lead_ids(repo_dir))
        return ids

    def _manual_jl_lead_ids(self, repo_dir):
        db_path = _job_leads_db_path(repo_dir)
        if not os.path.exists(db_path):
            return set()
        src_dir = os.path.join(repo_dir, 'src')
        if src_dir not in sys.path:
            sys.path.insert(0, src_dir)
        try:
            from job_leads_tool.sqlite_store import connect
        except Exception:
            return set()
        conn = connect(db_path)
        try:
            rows = conn.execute("SELECT id FROM leads WHERE source = 'manual'").fetchall()
            return {str(row['id']) for row in rows if row['id']}
        finally:
            conn.close()

    def _public_jl_health(self, health):
        if not isinstance(health, dict):
            return {}
        cleaned = dict(health)
        rows = []
        for item in cleaned.get('sources') or []:
            if isinstance(item, dict):
                public_item = {key: value for key, value in item.items() if key != '_leads'}
                rows.append(public_item)
        cleaned['sources'] = rows
        return cleaned

    def _configured_jl_sources(self, repo_dir):
        src_dir = os.path.join(repo_dir, 'src')
        if src_dir not in sys.path:
            sys.path.insert(0, src_dir)
        from job_leads_tool.sources_registry import SourceDefinition

        cfg_sources = load_config().get('job_sources') or {}
        if not isinstance(cfg_sources, dict):
            cfg_sources = {}
        self._jl_source_notes = []

        any_enabled = any(isinstance(source, dict) and source.get('enabled') for source in cfg_sources.values())
        sources = []
        fetch_tasks = []

        greenhouse = cfg_sources.get('greenhouse') if isinstance(cfg_sources.get('greenhouse'), dict) else {}
        if greenhouse.get('enabled') or not any_enabled:
            fetch_tasks.append(('greenhouse', lambda: self._write_greenhouse_source(repo_dir)))

        lever = cfg_sources.get('lever') if isinstance(cfg_sources.get('lever'), dict) else {}
        if lever.get('enabled') or not any_enabled:
            fetch_tasks.append(('lever', lambda: self._write_lever_source(repo_dir)))

        usajobs = cfg_sources.get('usajobs') if isinstance(cfg_sources.get('usajobs'), dict) else {}
        usajobs_key = str(usajobs.get('api_key') or '').strip()
        usajobs_enabled = bool(usajobs.get('enabled')) or bool(usajobs_key)
        if usajobs_enabled and usajobs_key:
            fetch_tasks.append(('usajobs', lambda: self._write_usajobs_source(repo_dir, usajobs_key)))
        elif usajobs_enabled:
            self._jl_source_notes.append({
                'source_id': 'usajobs',
                'label': 'USAJOBS',
                'status': 'error',
                'error': 'USAJOBS API key required in Settings.',
                'incoming': 0,
            })

        the_muse = cfg_sources.get('the_muse') if isinstance(cfg_sources.get('the_muse'), dict) else {}
        if the_muse.get('enabled') or not any_enabled:
            fetch_tasks.append(('the_muse', lambda: self._write_themuse_source(repo_dir)))

        indeed = cfg_sources.get('indeed_rss') if isinstance(cfg_sources.get('indeed_rss'), dict) else {}
        if indeed.get('enabled'):
            fetch_tasks.append(('indeed_rss', lambda: self._write_indeed_source(repo_dir)))

        built_in = cfg_sources.get('built_in_la') if isinstance(cfg_sources.get('built_in_la'), dict) else {}
        if built_in.get('enabled') or not any_enabled:
            fetch_tasks.append(('built_in_la', lambda: self._write_builtin_la_source(repo_dir)))

        adzuna = cfg_sources.get('adzuna') if isinstance(cfg_sources.get('adzuna'), dict) else {}
        adzuna_key = str(adzuna.get('api_key') or '').strip()
        adzuna_enabled = bool(adzuna.get('enabled')) or bool(adzuna_key)
        if adzuna_enabled and adzuna_key:
            fetch_tasks.append(('adzuna', lambda: self._write_adzuna_source(repo_dir, adzuna_key)))
        elif adzuna_enabled:
            self._jl_source_notes.append({
                'source_id': 'adzuna',
                'label': 'Adzuna',
                'status': 'error',
                'error': 'Adzuna credentials required. Use app_id:app_key in Settings.',
                'incoming': 0,
            })

        fetched = {}
        fetch_errors = {}
        if fetch_tasks:
            max_workers = min(8, len(fetch_tasks))
            with ThreadPoolExecutor(max_workers=max_workers) as pool:
                future_map = {pool.submit(task): source_id for source_id, task in fetch_tasks}
                for future in as_completed(future_map):
                    source_id = future_map[future]
                    try:
                        fetched[source_id] = future.result()
                    except Exception as exc:
                        fetch_errors[source_id] = exc

        source_specs = {
            'greenhouse': ('Greenhouse', 'greenhouse'),
            'lever': ('Lever', 'lever'),
            'usajobs': ('USAJOBS', 'usajobs'),
            'the_muse': ('The Muse', 'the_muse'),
            'built_in_la': ('Built In LA', 'built_in_la'),
            'adzuna': ('Adzuna', 'adzuna'),
        }
        for source_id, (label, source_name) in source_specs.items():
            if source_id in fetch_errors:
                self._jl_source_notes.append({
                    'source_id': source_id,
                    'label': label,
                    'status': 'error',
                    'error': str(fetch_errors[source_id]),
                    'incoming': 0,
                })
                continue
            path = fetched.get(source_id)
            if not path:
                continue
            sources.append(SourceDefinition(
                source_id=source_id,
                label=label,
                source=str(path),
                source_type='json',
                enabled=True,
                source_name=source_name,
            ))

        indeed_path = fetched.get('indeed_rss')
        if 'indeed_rss' in fetch_errors:
            self._jl_source_notes.append({
                'source_id': 'indeed_rss',
                'label': 'Indeed RSS',
                'status': 'error',
                'error': str(fetch_errors['indeed_rss']),
                'incoming': 0,
            })
        elif indeed_path:
            sources.append(SourceDefinition(
                source_id='indeed_rss',
                label='Indeed RSS',
                source=str(indeed_path),
                source_type='json',
                enabled=True,
                source_name='indeed_rss',
            ))

        return sources

    def _write_greenhouse_source(self, repo_dir):
        boards = {
            'riotgames': 'Riot Games',
            'andurilindustries': 'Anduril',
            'databricks': 'Databricks',
            'figma': 'Figma',
            'scaleai': 'Scale AI',
        }
        jobs = []
        seen_ids = set()
        for token, company_name in boards.items():
            url = f'https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true'
            req = urllib.request.Request(url, headers={'User-Agent': 'JobSearchCoach/1.0', 'Accept': 'application/json'})
            try:
                with urllib.request.urlopen(req, timeout=20) as response:
                    payload = json.loads(response.read().decode('utf-8', errors='ignore'))
            except Exception as exc:
                self._jl_source_notes.append({
                    'source_id': 'greenhouse',
                    'label': 'Greenhouse',
                    'status': 'warning',
                    'error': f'{company_name}: {exc}',
                    'incoming': 0,
                })
                continue
            for item in payload.get('jobs', []) if isinstance(payload, dict) else []:
                job_id = str(item.get('id') or item.get('absolute_url') or '')
                if not job_id or job_id in seen_ids:
                    continue
                if self._generic_is_not_entry_level_role(item):
                    continue
                if not self._generic_location_allowed(item):
                    continue
                if not self._generic_is_relevant_degree_role(item):
                    continue
                seen_ids.add(job_id)
                jobs.append(self._greenhouse_job_payload(item, company_name))

        output = Path(repo_dir) / 'data' / 'greenhouse_live.json'
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps({'jobs': jobs}, indent=2), encoding='utf-8')
        return output

    def _greenhouse_job_payload(self, item, company_name):
        location = item.get('location') if isinstance(item.get('location'), dict) else {}
        content = item.get('content') or ''
        return {
            'id': f"greenhouse-{item.get('id') or item.get('absolute_url') or item.get('title')}",
            'title': item.get('title') or '',
            'company': company_name,
            'location': location.get('name') or '',
            'salary': self._salary_or_scan(self._greenhouse_salary(item), item),
            'level': self._greenhouse_level(item),
            'job_type': self._greenhouse_job_type(item),
            'url': item.get('absolute_url') or '',
            'posted_at': item.get('updated_at') or '',
            'description': re.sub(r'<[^>]+>', ' ', content).strip(),
        }

    def _write_lever_source(self, repo_dir):
        sites = {
            'cimgroup': 'CIM Group',
            'sambatv': 'Samba TV',
            'kabam': 'Kabam',
            'contentsquare': 'Contentsquare',
            'xsolla': 'Xsolla',
            'bellwetheram-2': 'Bellwether',
            'AMIRI': 'AMIRI',
        }
        jobs = []
        seen_ids = set()
        for site, company_name in sites.items():
            url = f'https://api.lever.co/v0/postings/{urllib.parse.quote(site)}?mode=json'
            req = urllib.request.Request(url, headers={'User-Agent': 'JobSearchCoach/1.0', 'Accept': 'application/json'})
            try:
                with urllib.request.urlopen(req, timeout=20) as response:
                    payload = json.loads(response.read().decode('utf-8', errors='ignore'))
            except Exception as exc:
                self._jl_source_notes.append({
                    'source_id': 'lever',
                    'label': 'Lever',
                    'status': 'warning',
                    'error': f'{company_name}: {exc}',
                    'incoming': 0,
                })
                continue
            for item in payload if isinstance(payload, list) else []:
                job_id = str(item.get('id') or item.get('hostedUrl') or item.get('text') or '')
                if not job_id or job_id in seen_ids:
                    continue
                if self._generic_is_not_entry_level_role(item):
                    continue
                if not self._generic_location_allowed(item):
                    continue
                if not self._generic_is_relevant_degree_role(item):
                    continue
                seen_ids.add(job_id)
                jobs.append(self._lever_job_payload(item, company_name))

        output = Path(repo_dir) / 'data' / 'lever_live.json'
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps({'jobs': jobs}, indent=2), encoding='utf-8')
        return output

    def _lever_job_payload(self, item, company_name):
        categories = item.get('categories') if isinstance(item.get('categories'), dict) else {}
        lists = item.get('lists') if isinstance(item.get('lists'), list) else []
        description_parts = [item.get('descriptionPlain') or item.get('description') or '']
        for block in lists:
            if isinstance(block, dict):
                description_parts.append(block.get('text') or '')
                description_parts.extend(str(content) for content in block.get('content') or [])
        return {
            'id': f"lever-{item.get('id') or item.get('hostedUrl') or item.get('text')}",
            'title': item.get('text') or '',
            'company': company_name,
            'location': categories.get('location') or '',
            'salary': self._salary_or_scan(None, item),
            'level': self._lever_level(item),
            'job_type': self._lever_job_type(item),
            'url': item.get('hostedUrl') or item.get('applyUrl') or '',
            'posted_at': item.get('createdAt') or '',
            'description': re.sub(r'<[^>]+>', ' ', ' '.join(description_parts)).strip(),
        }

    def _write_usajobs_source(self, repo_dir, api_key):
        queries = ('data analyst', 'business analyst', 'information technology specialist', 'program analyst')
        locations = ('Los Angeles, California', 'Irvine, California', 'San Diego, California')
        jobs = []
        seen_ids = set()
        for query_text in queries:
            for location in locations:
                query = urllib.parse.urlencode({
                    'Keyword': query_text,
                    'LocationName': location,
                    'ResultsPerPage': 25,
                    'Page': 1,
                })
                url = f'https://data.usajobs.gov/api/Search?{query}'
                req = urllib.request.Request(url, headers={
                    'User-Agent': 'JobSearchCoach',
                    'Authorization-Key': api_key,
                    'Accept': 'application/json',
                })
                with urllib.request.urlopen(req, timeout=20) as response:
                    payload = json.loads(response.read().decode('utf-8', errors='ignore'))
                items = (((payload.get('SearchResult') or {}).get('SearchResultItems')) or []) if isinstance(payload, dict) else []
                for wrapper in items:
                    item = wrapper.get('MatchedObjectDescriptor') if isinstance(wrapper, dict) else {}
                    if not isinstance(item, dict):
                        continue
                    job_id = str(item.get('PositionID') or item.get('PositionURI') or '')
                    if not job_id or job_id in seen_ids:
                        continue
                    if self._generic_is_not_entry_level_role(item):
                        continue
                    if not self._usajobs_grade_allowed(item):
                        continue
                    if not self._usajobs_location_allowed(item):
                        continue
                    seen_ids.add(job_id)
                    jobs.append(self._usajobs_job_payload(item))

        output = Path(repo_dir) / 'data' / 'usajobs_live.json'
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps({'jobs': jobs}, indent=2), encoding='utf-8')
        return output

    def _usajobs_grade_allowed(self, item):
        grades = []
        for detail in item.get('UserArea', {}).get('Details', {}).get('LowGrade', []):
            grades.append(str(detail))
        for detail in item.get('UserArea', {}).get('Details', {}).get('HighGrade', []):
            grades.append(str(detail))
        text = ' '.join(grades)
        numbers = [int(value) for value in re.findall(r'\d+', text)]
        return not numbers or min(numbers) <= 9

    def _usajobs_job_payload(self, item):
        org = item.get('OrganizationName') or item.get('DepartmentName') or 'USAJOBS'
        location_text = self._usajobs_display_location(item)
        remuneration = item.get('PositionRemuneration') if isinstance(item.get('PositionRemuneration'), list) else []
        salary = ''
        if remuneration and isinstance(remuneration[0], dict):
            salary = f"{remuneration[0].get('MinimumRange') or ''}-{remuneration[0].get('MaximumRange') or ''}".strip('-')
        return {
            'id': f"usajobs-{item.get('PositionID') or item.get('PositionURI') or item.get('PositionTitle')}",
            'title': item.get('PositionTitle') or '',
            'company': org,
            'location': location_text,
            'salary': self._salary_or_scan(salary or None, item),
            'level': self._usajobs_level(item),
            'job_type': self._usajobs_job_type(item),
            'url': item.get('PositionURI') or '',
            'posted_at': item.get('PublicationStartDate') or '',
            'description': item.get('QualificationSummary') or item.get('UserArea', {}).get('Details', {}).get('JobSummary') or '',
        }

    def _usajobs_location_allowed(self, item):
        if self._usajobs_has_flexible_work_site(item):
            return True
        locations = item.get('PositionLocation') if isinstance(item.get('PositionLocation'), list) else []
        if not locations:
            return self._generic_location_allowed(item)
        return any(
            self._generic_location_allowed({'location': loc.get('LocationName', '')})
            for loc in locations
            if isinstance(loc, dict) and loc.get('LocationName')
        )

    def _usajobs_display_location(self, item):
        locations = item.get('PositionLocation') if isinstance(item.get('PositionLocation'), list) else []
        names = [
            loc.get('LocationName', '')
            for loc in locations
            if isinstance(loc, dict) and loc.get('LocationName')
        ]
        if not names:
            return self._generic_location_text(item)
        if self._usajobs_has_flexible_work_site(item):
            return names[0]
        for name in names:
            if self._generic_location_allowed({'location': name}):
                return name
        return names[0]

    def _usajobs_has_flexible_work_site(self, item):
        details = item.get('UserArea', {}).get('Details', {}) if isinstance(item.get('UserArea'), dict) else {}
        work_site = self._usajobs_detail_by_name(details, 'worksiteoption', 'worksiteoptions').lower()
        telework = details.get('TeleworkEligible')
        remote = details.get('RemoteIndicator')
        return (
            telework is True
            or str(telework).lower() == 'true'
            or remote is True
            or str(remote).lower() == 'true'
            or 'telework' in work_site
            or 'remote' in work_site
        )

    def _write_indeed_source(self, repo_dir):
        src_dir = os.path.join(repo_dir, 'src')
        if src_dir not in sys.path:
            sys.path.insert(0, src_dir)
        from job_leads_tool.connectors import load_rss_source

        queries = ('data analyst', 'business analyst', 'business intelligence analyst', 'product analyst')
        locations = ('Los Angeles, CA', 'Irvine, CA', 'San Diego, CA')
        jobs = []
        seen_ids = set()
        errors = []

        for query_text in queries:
            for location in locations:
                query = urllib.parse.urlencode({'q': query_text, 'l': location})
                url = f'https://rss.indeed.com/rss?{query}'
                try:
                    raw_jobs = load_rss_source(url)
                except Exception as exc:
                    errors.append(str(exc))
                    continue
                for item in raw_jobs:
                    job_id = str(item.get('id') or item.get('url') or item.get('title') or '')
                    if not job_id or job_id in seen_ids:
                        continue
                    if self._generic_is_not_entry_level_role(item):
                        continue
                    if not self._generic_is_relevant_degree_role(item):
                        continue
                    seen_ids.add(job_id)
                    jobs.append({
                        'id': f"indeed-{job_id}",
                        'title': item.get('title') or '',
                        'company': item.get('company') or '',
                        'location': item.get('location') or location,
                        'salary': self._salary_or_scan(item.get('salary'), item),
                        'level': item.get('level') or self._infer_job_level(item),
                        'job_type': item.get('job_type') or self._infer_job_type(item),
                        'url': item.get('url') or '',
                        'posted_at': item.get('posted_at') or '',
                        'description': item.get('description') or '',
                    })

        if not jobs and errors:
            self._jl_source_notes.append({
                'source_id': 'indeed_rss',
                'label': 'Indeed RSS',
                'status': 'error',
                'error': f"Indeed RSS unavailable: {errors[0]}",
                'incoming': 0,
            })
            return None

        output = Path(repo_dir) / 'data' / 'indeed_rss_live.json'
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps({'jobs': jobs}, indent=2), encoding='utf-8')
        return output

    def _write_builtin_la_source(self, repo_dir):
        src_dir = os.path.join(repo_dir, 'src')
        if src_dir not in sys.path:
            sys.path.insert(0, src_dir)
        from job_leads_tool.connectors import load_rss_source

        raw_jobs = load_rss_source('https://www.builtinla.com/jobs/data-analytics')
        jobs = []
        seen_ids = set()
        for item in raw_jobs:
            job_id = str(item.get('id') or item.get('url') or item.get('title') or '')
            if not job_id or job_id in seen_ids:
                continue
            if self._generic_is_not_entry_level_role(item):
                continue
            if not self._generic_is_relevant_degree_role(item):
                continue
            seen_ids.add(job_id)
            jobs.append({
                'id': f"builtinla-{job_id}",
                'title': item.get('title') or '',
                'company': item.get('company') or '',
                'location': item.get('location') or 'Los Angeles, CA',
                'salary': self._salary_or_scan(item.get('salary'), item),
                'level': item.get('level') or self._infer_job_level(item),
                'job_type': item.get('job_type') or self._infer_job_type(item),
                'url': item.get('url') or '',
                'posted_at': item.get('posted_at') or '',
                'description': item.get('description') or '',
            })

        output = Path(repo_dir) / 'data' / 'built_in_la_live.json'
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps({'jobs': jobs}, indent=2), encoding='utf-8')
        return output

    def _write_adzuna_source(self, repo_dir, api_key):
        credentials = self._parse_adzuna_credentials(api_key)
        if not credentials:
            raise ValueError('Adzuna source requires credentials formatted as app_id:app_key.')
        app_id, app_key = credentials
        queries = ('data analyst', 'business analyst', 'business intelligence analyst', 'product analyst')
        locations = ('Los Angeles, CA', 'Irvine, CA', 'San Diego, CA')
        seen_ids = set()
        jobs = []

        for query_text in queries:
            for location in locations:
                query = urllib.parse.urlencode({
                    'app_id': app_id,
                    'app_key': app_key,
                    'results_per_page': 25,
                    'what': query_text,
                    'where': location,
                    'sort_by': 'date',
                    'content-type': 'application/json',
                })
                url = f'https://api.adzuna.com/v1/api/jobs/us/search/1?{query}'
                req = urllib.request.Request(url, headers={'User-Agent': 'JobSearchCoach/1.0'})
                with urllib.request.urlopen(req, timeout=20) as response:
                    payload = json.loads(response.read().decode('utf-8', errors='ignore'))

                for item in payload.get('results', []) if isinstance(payload, dict) else []:
                    job_id = str(item.get('id') or item.get('redirect_url') or '')
                    if not job_id or job_id in seen_ids:
                        continue
                    job_payload = self._adzuna_job_payload(item)
                    if self._adzuna_is_not_entry_level_role(job_payload):
                        continue
                    seen_ids.add(job_id)
                    jobs.append(job_payload)

        output = Path(repo_dir) / 'data' / 'adzuna_live.json'
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps({'jobs': jobs}, indent=2), encoding='utf-8')
        return output

    def _parse_adzuna_credentials(self, api_key):
        raw = str(api_key or '').strip()
        if not raw:
            return None
        labeled = {}
        for line in re.split(r'[\r\n]+', raw):
            match = re.match(r'\s*(app[_\s-]*id|application[_\s-]*id|id|app[_\s-]*key|application[_\s-]*key|key)\s*[:=]\s*(.+?)\s*$', line, flags=re.I)
            if match:
                label = re.sub(r'[^a-z]', '', match.group(1).lower())
                value = match.group(2).strip()
                if 'id' in label and 'key' not in label:
                    labeled['id'] = value
                elif 'key' in label:
                    labeled['key'] = value
        if labeled.get('id') and labeled.get('key'):
            return labeled['id'], labeled['key']
        for separator in (':', '|', ','):
            if separator in raw:
                left, right = raw.split(separator, 1)
                left = left.strip()
                right = right.strip()
                if left and right:
                    return left, right
        parts = [part.strip() for part in re.split(r'\s+', raw) if part.strip()]
        if len(parts) == 2:
            return parts[0], parts[1]
        if len(parts) == 1:
            return ADZUNA_APP_ID, parts[0]
        return None

    def _adzuna_is_not_entry_level_role(self, item):
        return self._generic_is_not_entry_level_role(item)

    def _adzuna_job_payload(self, item):
        company = item.get('company') if isinstance(item.get('company'), dict) else {}
        location = item.get('location') if isinstance(item.get('location'), dict) else {}
        salary = ''
        if item.get('salary_min') or item.get('salary_max'):
            salary = f"{item.get('salary_min') or ''}-{item.get('salary_max') or ''}".strip('-')
        url = item.get('redirect_url') or ''
        description = re.sub(r'<[^>]+>', ' ', item.get('description') or '').strip()
        detail_description = self._adzuna_detail_description(url, description)
        if detail_description and detail_description not in description:
            description = f'{description} {detail_description}'.strip()
        return {
            'id': f"adzuna-{item.get('id') or item.get('redirect_url') or item.get('title')}",
            'title': item.get('title') or '',
            'company': company.get('display_name') or '',
            'location': location.get('display_name') or '',
            'salary': self._salary_or_scan(salary or None, item),
            'level': self._infer_job_level(item),
            'job_type': self._infer_job_type(item),
            'url': url,
            'posted_at': item.get('created') or '',
            'description': description,
        }

    def _adzuna_detail_description(self, url, api_description):
        if not url:
            return ''
        if len(str(api_description or '')) >= 1500 and '…' not in str(api_description or ''):
            return ''
        url = self._adzuna_detail_fetch_url(url)
        cache = getattr(self, '_adzuna_detail_cache', None)
        if not isinstance(cache, dict):
            cache = {}
            self._adzuna_detail_cache = cache
        if url in cache:
            return cache[url]
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 JobSearchCoach/1.0'})
            with urllib.request.urlopen(req, timeout=12) as response:
                html = response.read().decode('utf-8', errors='ignore')
        except Exception:
            cache[url] = ''
            return ''
        for pattern in (
            r'<script\b[^>]*>.*?</script>',
            r'<style\b[^>]*>.*?</style>',
            r'<nav\b[^>]*>.*?</nav>',
            r'<footer\b[^>]*>.*?</footer>',
        ):
            html = re.sub(pattern, ' ', html, flags=re.I | re.S)
        text = html_lib.unescape(re.sub(r'<[^>]+>', ' ', html))
        text = re.sub(r'\s+', ' ', text).strip()
        cache[url] = text[:12000]
        return cache[url]

    def _adzuna_detail_fetch_url(self, url):
        text = str(url or '')
        match = re.search(r'/land/ad/(\d+)', text)
        if match:
            return f'https://www.adzuna.com/details/{match.group(1)}?utm_medium=api&utm_source={ADZUNA_APP_ID}'
        return text

    def _write_themuse_source(self, repo_dir):
        categories = [
            'Data and Analytics',
            'Business Operations',
            'Computer and IT',
            'Product Management',
        ]
        locations = [
            'Los Angeles, CA',
            'Irvine, CA',
            'Orange County, CA',
            'San Diego, CA',
        ]
        seen_ids = set()
        jobs = []

        for category in categories:
            for location in locations:
                for page in range(1, 3):
                    query = urllib.parse.urlencode({
                        'page': page,
                        'category': category,
                        'location': location,
                    })
                    url = f'https://www.themuse.com/api/public/jobs?{query}'
                    req = urllib.request.Request(url, headers={'User-Agent': 'JobSearchCoach/1.0'})
                    with urllib.request.urlopen(req, timeout=20) as response:
                        payload = json.loads(response.read().decode('utf-8', errors='ignore'))

                    for item in payload.get('results', []):
                        job_id = str(item.get('id') or '')
                        if not job_id or job_id in seen_ids:
                            continue
                        if self._themuse_is_not_entry_level_role(item):
                            continue
                        if not self._themuse_location_allowed(item):
                            continue
                        if not self._themuse_is_relevant_degree_role(item):
                            continue
                        seen_ids.add(job_id)
                        jobs.append(self._themuse_job_payload(item))

        output = Path(repo_dir) / 'data' / 'the_muse_live.json'
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps({'jobs': jobs}, indent=2), encoding='utf-8')
        return output

    def _themuse_is_not_entry_level_role(self, item):
        levels = item.get('levels') if isinstance(item.get('levels'), list) else []
        level_text = ' '.join(
            f"{level.get('name', '')} {level.get('short_name', '')}"
            for level in levels
            if isinstance(level, dict)
        ).lower()
        title = str(item.get('name') or '').lower()
        blocked_level_terms = ('senior', 'executive')
        blocked_title_terms = (
            'senior',
            'sr.',
            'sr ',
            'principal',
            'staff',
            'lead',
            'manager',
            'director',
            'architect',
            'head of',
            'vice president',
            'vp ',
        )
        return (
            any(term in level_text for term in blocked_level_terms)
            or any(term in title for term in blocked_title_terms)
            or self._generic_is_not_entry_level_role(item)
        )

    def _themuse_location_allowed(self, item):
        return self._generic_location_allowed(item)

    def _generic_location_allowed(self, item):
        location_text = self._generic_location_text(item)
        location_l = location_text.strip().lower()
        if location_l in ('flexible / remote', 'remote', 'remote usa', 'united states') or 'hybrid' in location_l:
            return True
        if self._location_has_disallowed_state(location_text):
            return False
        allowed_terms = (
            'west hollywood',
            'silver lake',
            'los feliz',
            'koreatown',
            'mid-wilshire',
            'la brea',
            'hancock park',
            'larchmont',
            'hollywood',
            'century city',
            'brentwood',
            'westwood',
            'beverly hills',
            'playa vista',
            'marina del rey',
            'venice',
            'el segundo',
            'manhattan beach',
            'hermosa beach',
            'redondo beach',
            'hawthorne',
            'inglewood',
            'alhambra',
            'san gabriel',
            'arcadia',
            'monrovia',
            'studio city',
            'sherman oaks',
            'encino',
            'north hollywood',
            'van nuys',
            'chatsworth',
            'downey',
            'compton',
            'carson',
            'los angeles',
            'santa monica',
            'culver city',
            'burbank',
            'glendale',
            'pasadena',
            'irvine',
            'orange county',
            'anaheim',
            'costa mesa',
            'newport beach',
            'long beach',
            'torrance',
            'carlsbad',
            'oceanside',
            'encinitas',
            'san diego',
            'la jolla',
            'chula vista',
            'escondido',
            'del mar',
            'el cajon',
            'national city',
            'dallas',
            'fort worth',
            'dfw',
            'plano',
            'irving',
            'frisco',
            'mckinney',
            'arlington tx',
            'austin',
            'round rock',
            'seattle',
            'bellevue',
            'redmond',
            'kirkland',
            'tacoma',
            'portland',
            'beaverton',
            'hillsboro',
            'denver',
            'boulder',
            'aurora co',
            'lakewood co',
            'salt lake city',
            'provo',
            'sandy ut',
            'las vegas',
            'henderson nv',
            'summerlin',
        )
        profile_terms = tuple(term.lower() for term in self._jl_profile_terms('preferred_locations'))
        return any(term in location_l for term in (profile_terms or allowed_terms))

    def _location_has_disallowed_state(self, location_text):
        allowed_states = {'CA', 'TX', 'WA', 'OR', 'CO', 'UT', 'NV'}
        state_names = {
            'california': 'CA',
            'texas': 'TX',
            'washington': 'WA',
            'oregon': 'OR',
            'colorado': 'CO',
            'utah': 'UT',
            'nevada': 'NV',
        }
        found = set()
        for part in str(location_text or '').split(',')[1:]:
            cleaned = re.sub(r'\b(united states|usa|us)\b', '', part, flags=re.I).strip()
            if re.fullmatch(r'[A-Z]{2}', cleaned):
                found.add(cleaned)
            else:
                normalized = cleaned.lower()
                if normalized in state_names:
                    found.add(state_names[normalized])
        return bool(found) and not any(state in allowed_states for state in found)

    def _generic_location_text(self, item):
        if not isinstance(item, dict):
            return ''
        if isinstance(item.get('location'), dict):
            return str(item.get('location', {}).get('name') or item.get('location', {}).get('display_name') or '')
        if isinstance(item.get('location'), str):
            return item.get('location') or ''
        if isinstance(item.get('locations'), list):
            return ', '.join(
                loc.get('name', '')
                for loc in item.get('locations') or []
                if isinstance(loc, dict) and loc.get('name')
            )
        categories = item.get('categories') if isinstance(item.get('categories'), dict) else {}
        if categories.get('location'):
            return str(categories.get('location'))
        return ''

    def _preferred_location_display_from_names(self, names):
        clean_names = [str(name or '').strip() for name in names if str(name or '').strip()]
        for name in clean_names:
            if self._generic_location_allowed({'location': name}):
                return name
        return clean_names[0] if clean_names else ''

    def _themuse_is_relevant_degree_role(self, item):
        return self._generic_is_relevant_degree_role(item)

    def _generic_is_not_entry_level_role(self, item):
        text = self._generic_search_text(item).lower()
        blocked_terms = (
            'senior',
            'sr.',
            'sr ',
            'principal',
            'staff',
            'lead',
            'manager',
            'director',
            'architect',
            'head of',
            'vice president',
            'vp ',
        )
        if any(term in text for term in blocked_terms):
            return True
        return any(
            self._jl_profile_term_matches(text, term)
            for term in self._jl_profile_terms('excluded_keywords')
        )

    def _generic_is_relevant_degree_role(self, item):
        text = self._generic_search_text(item).lower()
        relevant_terms = (
            'analyst',
            'analytics',
            'business intelligence',
            'data analyst',
            'data analytics',
            'data operations',
            'data specialist',
            'data quality',
            'reporting',
            'insights',
            'operations analyst',
            'operations specialist',
            'product analyst',
            'product operations',
            'systems analyst',
            'business systems',
            'database analyst',
            'bi ',
            'compliance',
            'technology analyst',
            'technical compliance',
            'it ',
            'financial analyst',
            'planning analyst',
            'support analyst',
            'asset administrator',
            'intern',
            'early career',
        )
        blocked_terms = (
            'shopper',
            'installer',
            'technician',
            'assistant',
            'software engineer',
            'data engineer',
            'platform engineer',
            'security engineer',
            'quality engineer',
            'infrastructure engineer',
            'medical science',
            'clinical medicine',
            'chemistry',
            'philosophy',
            'law',
        )
        profile_terms = (
            self._jl_profile_terms('target_titles')
            + self._jl_profile_terms('skills')
            + self._jl_profile_terms('must_have_keywords')
            + self._jl_profile_terms('preferred_keywords')
        )
        matches_profile = any(
            self._jl_profile_term_matches(text, term)
            for term in profile_terms
        )
        matches_fallback = any(term in text for term in relevant_terms)
        return (matches_profile or matches_fallback) and not any(term in text for term in blocked_terms)

    def _scored_jl_item_excluded_by_profile(self, item):
        lead = item.get('lead') if isinstance(item, dict) and isinstance(item.get('lead'), dict) else item
        if not isinstance(lead, dict):
            return False
        return self._generic_is_not_entry_level_role(lead)

    def _jl_profile_terms(self, key):
        profile = getattr(self, '_jl_source_filter_profile', None)
        if not isinstance(profile, dict):
            return []
        value = profile.get(key)
        if not isinstance(value, list):
            return []
        return [str(term).strip() for term in value if str(term).strip()]

    def _jl_profile_term_matches(self, text, term):
        term_l = str(term or '').strip().lower()
        if not term_l:
            return False
        normalized_text = re.sub(r'\s+', ' ', str(text or '').lower())
        year_match = re.fullmatch(r'(\d+)\s*\+?\s*years?', term_l)
        if year_match:
            year_value = year_match.group(1)
            year_words = {
                '5': 'five',
                '6': 'six',
                '7': 'seven',
                '8': 'eight',
                '9': 'nine',
                '10': 'ten',
            }
            years = rf'(?:{re.escape(year_value)}|{year_words.get(year_value, re.escape(year_value))})'
            patterns = (
                rf'\b{years}\s*\+\s*(?:years?|yrs?)\b',
                rf'\b{years}\s*(?:or more|plus)\s*(?:years?|yrs?)\b',
                rf'\b(?:at least|minimum(?: of)?|requires?|required)\s+{years}\s*(?:years?|yrs?)\b',
                rf'\b{years}\s*(?:years?|yrs?)\s+(?:of\s+)?(?:\w+\s+){{0,4}}(?:experience|required)\b',
            )
            if any(re.search(pattern, normalized_text, flags=re.I) for pattern in patterns):
                return True
            threshold = int(year_value)
            for range_match in re.finditer(r'\b(\d+)\s*(?:-|to)\s*(\d+)\s*(?:years?|yrs?)\b', normalized_text, flags=re.I):
                low = int(range_match.group(1))
                high = int(range_match.group(2))
                if high >= threshold and low >= 2:
                    return True
            return False
        return term_l in normalized_text

    def _generic_search_text(self, item):
        if not isinstance(item, dict):
            return ''
        parts = [
            self._generic_title_text(item),
            self._generic_location_text(item),
            str(item.get('company') or item.get('company_name') or item.get('OrganizationName') or item.get('DepartmentName') or ''),
            self._salary_scan_text(item),
        ]
        lead = item.get('lead') if isinstance(item.get('lead'), dict) else None
        if lead:
            parts.extend([
                self._generic_title_text(lead),
                self._generic_location_text(lead),
                str(lead.get('company') or ''),
                self._salary_scan_text(lead),
            ])
        text = ' '.join(str(part or '') for part in parts)
        return re.sub(r'\s+', ' ', text).strip()

    def _generic_title_text(self, item):
        if not isinstance(item, dict):
            return ''
        return str(item.get('name') or item.get('title') or item.get('text') or item.get('PositionTitle') or '')

    def _greenhouse_salary(self, item):
        for metadata in item.get('metadata') or []:
            if not isinstance(metadata, dict):
                continue
            name = str(metadata.get('name') or '').lower()
            value = metadata.get('value')
            if value in (None, '', []):
                continue
            if any(term in name for term in ('salary', 'compensation', 'pay range', 'location range')):
                if isinstance(value, list):
                    value = ', '.join(str(part) for part in value if part)
                return str(value)
        return None

    def _salary_or_scan(self, salary, item):
        if salary:
            return str(salary)
        return self._scan_salary_text(self._salary_scan_text(item))

    def _salary_scan_text(self, item):
        if not isinstance(item, dict):
            return ''
        parts = []
        for key in (
            'title',
            'name',
            'text',
            'description',
            'descriptionPlain',
            'content',
            'contents',
            'QualificationSummary',
        ):
            value = item.get(key)
            if value:
                parts.append(str(value))
        for block in item.get('lists') or []:
            if isinstance(block, dict):
                parts.append(str(block.get('text') or ''))
                parts.extend(str(content) for content in block.get('content') or [])
        for metadata in item.get('metadata') or []:
            if isinstance(metadata, dict) and metadata.get('value'):
                value = metadata.get('value')
                if isinstance(value, list):
                    parts.extend(str(part) for part in value if part)
                else:
                    parts.append(str(value))
        user_area = item.get('UserArea') if isinstance(item.get('UserArea'), dict) else {}
        details = user_area.get('Details') if isinstance(user_area.get('Details'), dict) else {}
        for key in ('JobSummary', 'MajorDuties', 'Evaluations', 'Requirements'):
            value = details.get(key)
            if value:
                parts.append(str(value))
        text = ' '.join(parts)
        for _ in range(3):
            next_text = html_lib.unescape(text)
            if next_text == text:
                break
            text = next_text
        text = re.sub(r'<[^>]+>', ' ', text)
        return re.sub(r'\s+', ' ', text).strip()

    def _scan_salary_text(self, text):
        if not text:
            return None
        patterns = [
            r'\$\s?\d{2,3}(?:,\d{3})?(?:\.\d{2})?\s?(?:-|–|—|to)\s?\$\s?\d{2,3}(?:,\d{3})?(?:\.\d{2})?\s?(?:per\s+year|annually|a\s+year|/year|per\s+hour|hourly|/hr)?',
            r'(?:minimum|min)\s*:?\s*\$\s?\d{2,3}(?:,\d{3})?(?:\.\d{2})?.{0,80}?(?:maximum|max)\s*:?\s*\$\s?\d{2,3}(?:,\d{3})?(?:\.\d{2})?',
            r'\$\s?\d{2,3}(?:,\d{3})?(?:\.\d{2})?\s?(?:per\s+year|annually|a\s+year|/year|per\s+hour|hourly|/hr)',
            r'\$\s?\d{2,3}k\s?(?:-|–|—|to)\s?\$\s?\d{2,3}k',
            r'\d{2,3}k\s?(?:-|–|—|to)\s?\d{2,3}k',
            r'\$\s?\d{2,3}(?:\.\d{2})?\s?(?:-|–|—|to)\s?\$\s?\d{2,3}(?:\.\d{2})?\s?(?:per\s+hour|hourly|/hr)',
        ]
        for pattern in patterns:
            match = re.search(pattern, text, flags=re.I)
            if match:
                salary = re.sub(r'\s+', ' ', match.group(0)).strip()
                salary = re.sub(r'(?i)(minimum|min)\s*:?\s*', '', salary)
                salary = re.sub(r'(?i)\s*(maximum|max)\s*:?\s*', ' - ', salary)
                return salary.strip()
        return None

    def _greenhouse_level(self, item):
        for metadata in item.get('metadata') or []:
            if not isinstance(metadata, dict):
                continue
            name = str(metadata.get('name') or '').lower()
            value = metadata.get('value')
            if value in (None, '', []):
                continue
            if 'level' in name or 'department name' in name:
                if isinstance(value, list):
                    value = ', '.join(str(part) for part in value if part)
                return self._normalize_level(str(value), item)
        return self._infer_job_level(item)

    def _greenhouse_job_type(self, item):
        metadata_type = self._metadata_value(item, ('employment type', 'workplace type', 'job type'))
        return self._normalize_job_type(metadata_type, item)

    def _lever_level(self, item):
        return self._infer_job_level(item)

    def _lever_job_type(self, item):
        categories = item.get('categories') if isinstance(item.get('categories'), dict) else {}
        explicit = ' '.join(
            str(part or '')
            for part in (categories.get('commitment'), item.get('workplaceType'), categories.get('location'))
        )
        return self._normalize_job_type(explicit, item)

    def _themuse_level(self, item):
        levels = item.get('levels') if isinstance(item.get('levels'), list) else []
        names = [
            str(level.get('name') or level.get('short_name') or '')
            for level in levels
            if isinstance(level, dict)
        ]
        return self._normalize_level(', '.join(name for name in names if name), item)

    def _themuse_job_type(self, item):
        explicit = str(item.get('type') or '')
        return self._normalize_job_type(explicit, item)

    def _usajobs_level(self, item):
        details = item.get('UserArea', {}).get('Details', {}) if isinstance(item.get('UserArea'), dict) else {}
        grades = []
        for key in ('LowGrade', 'HighGrade'):
            value = details.get(key)
            if isinstance(value, list):
                grades.extend(str(part) for part in value if part)
            elif value:
                grades.append(str(value))
        if grades:
            return f"GS {'-'.join(grades)}"
        return self._infer_job_level({'title': item.get('PositionTitle') or ''})

    def _usajobs_job_type(self, item):
        details = item.get('UserArea', {}).get('Details', {}) if isinstance(item.get('UserArea'), dict) else {}
        work_site = self._usajobs_detail_by_name(details, 'worksiteoption', 'worksiteoptions')
        telework = details.get('TeleworkEligible')
        remote = details.get('RemoteIndicator')
        explicit = ' '.join(str(part or '') for part in (
            work_site,
            details.get('PositionScheduleType'),
            'telework eligible' if telework is True or str(telework).lower() == 'true' else '',
            'remote' if remote is True or str(remote).lower() == 'true' else '',
        ))
        return self._normalize_job_type(explicit, {'title': item.get('PositionTitle') or '', 'location': self._generic_location_text(item)})

    def _usajobs_detail_by_name(self, details, *names):
        if not isinstance(details, dict):
            return ''
        wanted = set(names)
        for key, value in details.items():
            normalized = re.sub(r'[^a-z0-9]+', '', str(key).lower())
            if normalized not in wanted:
                continue
            if isinstance(value, list):
                return ' '.join(str(part) for part in value if part)
            return str(value or '')
        return ''

    def _infer_job_level(self, item):
        return self._normalize_level('', item)

    def _infer_job_type(self, item):
        return self._normalize_job_type('', item)

    def _metadata_value(self, item, names):
        for metadata in item.get('metadata') or []:
            if not isinstance(metadata, dict):
                continue
            name = str(metadata.get('name') or '').lower()
            value = metadata.get('value')
            if value in (None, '', []):
                continue
            if any(term in name for term in names):
                if isinstance(value, list):
                    return ', '.join(str(part) for part in value if part)
                return str(value)
        return ''

    def _normalize_level(self, value, item):
        text = f"{value or ''} {self._generic_title_text(item)}".lower()
        if any(term in text for term in ('intern', 'internship')):
            return 'Internship'
        if any(term in text for term in ('entry level', 'early career', 'new grad', 'graduate', 'junior', 'jr.')):
            return 'Entry Level'
        if any(term in text for term in ('associate', 'coordinator')):
            return 'Associate'
        if any(term in text for term in ('mid level', 'mid-level')):
            return 'Mid Level'
        return 'Not listed'

    def _normalize_job_type(self, value, item):
        location = self._generic_location_text(item)
        text = f"{value or ''} {self._generic_title_text(item)} {location}".lower()
        types = []
        if any(term in text for term in ('intern', 'internship')):
            types.append('Internship')
        if any(term in text for term in ('contract', 'contractor', 'temporary', 'temp ')):
            types.append('Contract')
        if any(term in text for term in ('part-time', 'part time')):
            types.append('Part-time')
        elif any(term in text for term in ('full-time', 'full time', 'fulltime', 'full time')):
            types.append('Full-time')
        if any(term in text for term in ('remote', 'flexible / remote')):
            types.append('Remote')
        elif 'telework eligible' in text:
            types.append('Telework eligible')
        elif any(term in text for term in ('hybrid',)):
            types.append('Hybrid')
        elif location:
            types.append('On-site')
        seen = []
        for item_type in types:
            if item_type not in seen:
                seen.append(item_type)
        return ' / '.join(seen) if seen else 'Not listed'

    def _themuse_job_payload(self, item):
            company = item.get('company') if isinstance(item.get('company'), dict) else {}
            refs = item.get('refs') if isinstance(item.get('refs'), dict) else {}
            locations = item.get('locations') if isinstance(item.get('locations'), list) else []
            location_names = [loc.get('name', '') for loc in locations if isinstance(loc, dict) and loc.get('name')]
            return {
                'id': f"themuse-{item.get('id') or refs.get('landing_page') or item.get('name')}",
                'title': item.get('name') or '',
                'company': company.get('name') or '',
                'location': self._preferred_location_display_from_names(location_names),
                'salary': self._salary_or_scan(None, item),
                'level': self._themuse_level(item),
                'job_type': self._themuse_job_type(item),
                'url': refs.get('landing_page') or refs.get('apply') or '',
                'posted_at': item.get('publication_date') or '',
                'description': re.sub(r'<[^>]+>', ' ', item.get('contents') or '').strip(),
            }

    def _jl_apply(self, body):
        lead_id = (body.get('lead_id') or '').strip()
        override_duplicate = body.get('override_duplicate') is True
        if not lead_id:
            self._json({'error': 'lead_id is required'}, 400)
            return

        try:
            updated = self._apply_jl_lead(lead_id, override_duplicate=override_duplicate)
        except FileNotFoundError as exc:
            self._json({'error': str(exc)}, 404)
            return
        except ValueError as exc:
            message = str(exc)
            lower_message = message.lower()
            if 'lead not found' in lower_message:
                self._json({'error': 'Lead not found'}, 404)
            elif 'duplicate-company-role' in lower_message:
                existing_id = message.split('existing_lead_id:', 1)[1].strip() if 'existing_lead_id:' in message else ''
                payload = {'error': 'Duplicate application'}
                if existing_id:
                    payload['existing_lead_id'] = existing_id
                self._json(payload, 409)
            elif 'invalid transition' in lower_message:
                self._json({'error': 'Invalid transition'}, 400)
            else:
                self._json({'error': message}, 400)
            return
        except Exception as exc:
            self._json({'error': f'Could not apply lead: {exc}'}, 500)
            return

        self._json(updated)

    def _jl_add_manual(self, body):
        url = str(body.get('url') or '').strip()
        raw_text = str(body.get('raw_text') or '').strip()
        title = str(body.get('title') or '').strip()
        company = str(body.get('company') or '').strip()
        location = str(body.get('location') or '').strip()

        fetched = {'text': '', 'title': '', 'h1': ''}
        fetch_error = ''
        if url:
            try:
                fetched = self._fetch_manual_job_content(url)
            except Exception as exc:
                fetch_error = str(exc)

        source_text = fetched.get('text') if len(fetched.get('text') or '') >= 200 else ''
        if url and fetched.get('text') and not source_text:
            fetch_error = f"Fetched page text was too short ({len(fetched.get('text') or '')} characters)."
        if not source_text and raw_text:
            source_text = raw_text
        if not source_text:
            detail = f" Fetch detail: {fetch_error}" if fetch_error else ''
            self._json({
                'success': False,
                'error': f'Could not retrieve job content. Please paste the job description text into the Job Description field and resubmit.{detail}',
                'fetch_error': fetch_error,
            }, 400)
            return

        try:
            repo_dir = _job_leads_tool_dir_required()
            db_path = _job_leads_db_path(repo_dir)
            db_path.parent.mkdir(parents=True, exist_ok=True)
            src_dir = os.path.join(repo_dir, 'src')
            if src_dir not in sys.path:
                sys.path.insert(0, src_dir)

            from job_leads_tool.cli import load_profile
            from job_leads_tool.manual import build_manual_scored_lead
            from job_leads_tool.models import JobLead
            from job_leads_tool.sqlite_store import connect, upsert_leads

            conn = connect(db_path)
            try:
                if url:
                    existing = conn.execute('SELECT id FROM leads WHERE url = ? LIMIT 1', (url,)).fetchone()
                    if existing is not None:
                        existing_id = str(existing['id'] or '')
                        deleted_ids = self._load_jl_deleted_ids(repo_dir)
                        scored_ids = self._existing_jl_scored_output_ids(Path(repo_dir) / 'outputs' / 'scored_leads.json')
                        if existing_id in deleted_ids or existing_id not in scored_ids:
                            conn.execute('DELETE FROM leads WHERE id = ?', (existing_id,))
                            conn.commit()
                            self._remove_jl_scored_output_lead(existing_id)
                        else:
                            self._json({'success': False, 'error': 'This job is already in your leads list.'}, 409)
                            return

                profile = load_profile(Path(repo_dir) / 'config' / 'candidate_profile.yaml')
                scored = build_manual_scored_lead(
                    profile,
                    raw_text=source_text,
                    url=url,
                    title=title,
                    company=company,
                    location=location,
                    page_title=fetched.get('title') or '',
                    h1=fetched.get('h1') or '',
                )
                lead_data = scored.get('lead') or {}
                lead = JobLead(
                    id=lead_data.get('id') or scored.get('lead_id'),
                    source='manual',
                    company=lead_data.get('company') or '',
                    title=lead_data.get('title') or '',
                    location=lead_data.get('location') or '',
                    salary=lead_data.get('salary'),
                    url=lead_data.get('url') or url,
                    posted_at=lead_data.get('posted_at'),
                    description=lead_data.get('description') or source_text,
                    content_hash=lead_data.get('content_hash') or '',
                    level=lead_data.get('level'),
                    job_type=lead_data.get('job_type'),
                    ingested_at=lead_data.get('ingested_at'),
                    approval_state=lead_data.get('approval_state') or 'pending_review',
                )
                upsert_leads(conn, [lead])
            finally:
                conn.close()

            lead_id = str(scored.get('lead_id') or (scored.get('lead') or {}).get('id') or '')
            deleted_ids = self._load_jl_deleted_ids(repo_dir)
            if lead_id in deleted_ids:
                deleted_ids.remove(lead_id)
                self._save_jl_deleted_ids(repo_dir, deleted_ids)
            refreshed_match = self._append_jl_manual_scored_output(repo_dir, scored)
        except Exception as exc:
            self._json({'success': False, 'error': f'Could not add manual job: {exc}'}, 500)
            return

        self._json({'success': True, 'lead': refreshed_match})

    def _fetch_manual_job_content(self, url):
        try:
            import requests
        except Exception as exc:
            raise RuntimeError(f'requests is unavailable: {exc}')
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
        response = requests.get(url, headers=headers, timeout=18)
        if response.status_code >= 400:
            raise RuntimeError(f'Fetch returned HTTP {response.status_code}')
        html = response.text or ''
        return self._visible_text_from_html(html)

    def _visible_text_from_html(self, html):
        title = ''
        h1 = ''
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, 'html.parser')
            for tag in soup(['script', 'style', 'noscript', 'svg']):
                tag.decompose()
            title = soup.title.get_text(' ', strip=True) if soup.title else ''
            h1_tag = soup.find('h1')
            h1 = h1_tag.get_text(' ', strip=True) if h1_tag else ''
            text = soup.get_text(' ', strip=True)
        except Exception:
            title_match = re.search(r'<title[^>]*>(.*?)</title>', html, flags=re.I | re.S)
            title = html_lib.unescape(re.sub(r'<[^>]+>', ' ', title_match.group(1))).strip() if title_match else ''
            h1_match = re.search(r'<h1[^>]*>(.*?)</h1>', html, flags=re.I | re.S)
            h1 = html_lib.unescape(re.sub(r'<[^>]+>', ' ', h1_match.group(1))).strip() if h1_match else ''
            cleaned = html
            for pattern in (r'<script\b[^>]*>.*?</script>', r'<style\b[^>]*>.*?</style>', r'<noscript\b[^>]*>.*?</noscript>'):
                cleaned = re.sub(pattern, ' ', cleaned, flags=re.I | re.S)
            text = html_lib.unescape(re.sub(r'<[^>]+>', ' ', cleaned))
            text = re.sub(r'\s+', ' ', text).strip()
        return {'text': text, 'title': title, 'h1': h1}

    def _jl_transition(self, body, new_state):
        lead_id = (body.get('lead_id') or '').strip()
        if not lead_id:
            self._json({'error': 'lead_id is required'}, 400)
            return

        try:
            updated = self._transition_jl_lead(lead_id, new_state)
        except FileNotFoundError as exc:
            self._json({'error': str(exc)}, 404)
            return
        except ValueError as exc:
            message = str(exc)
            if 'lead not found' in message.lower():
                self._json({'error': 'Lead not found'}, 404)
            elif 'invalid transition' in message.lower():
                self._json({'error': 'Invalid transition'}, 400)
            else:
                self._json({'error': message}, 400)
            return
        except Exception as exc:
            self._json({'error': f'Could not update lead state: {exc}'}, 500)
            return

        self._json(updated)

    def _jl_delete(self, body):
        lead_id = (body.get('lead_id') or '').strip()
        if not lead_id:
            self._json({'error': 'lead_id is required'}, 400)
            return

        try:
            result = self._delete_jl_lead(lead_id)
        except FileNotFoundError as exc:
            self._json({'error': str(exc)}, 404)
            return
        except Exception as exc:
            self._json({'error': f'Could not delete lead: {exc}'}, 500)
            return

        self._json(result)

    def _apply_jl_lead(self, lead_id, override_duplicate=False):
        repo_dir = _job_leads_tool_dir_required()
        drive_updated = self._try_apply_jl_drive_lead(repo_dir, lead_id)
        if drive_updated is not None:
            return drive_updated

        db_path = _job_leads_db_path(repo_dir)
        if not os.path.exists(db_path):
            raise FileNotFoundError('JobLeadsTool leads database not found.')

        src_dir = os.path.join(repo_dir, 'src')
        if src_dir not in sys.path:
            sys.path.insert(0, src_dir)

        from job_leads_tool.normalization import normalize_company
        from job_leads_tool.policy import normalize_role_track
        from job_leads_tool.sqlite_store import (
            connect,
            get_lead,
            has_company_role_application,
            list_leads,
            transition_state,
        )

        conn = connect(db_path)
        try:
            lead = get_lead(conn, lead_id)
            if lead is None:
                raise ValueError('lead not found')

            company_norm = normalize_company(lead.get('company'))
            role_track = normalize_role_track(lead.get('title'))
            if not override_duplicate:
                for row in list_leads(conn, state='applied'):
                    if (
                        row.get('id') != lead_id
                        and normalize_company(row.get('company')) == company_norm
                        and normalize_role_track(row.get('title')) == role_track
                    ):
                        raise ValueError(f'duplicate-company-role apply blocked. existing_lead_id: {row.get("id")}')

                if has_company_role_application(conn, company_norm, role_track):
                    raise ValueError('duplicate-company-role apply blocked.')

            transition_state(conn, lead_id, 'applied')
            updated = get_lead(conn, lead_id)
        finally:
            conn.close()

        self._sync_jl_scored_output_state(lead_id, 'applied')
        return self._updated_jl_lead_payload(lead_id, updated or {'id': lead_id, 'approval_state': 'applied'})

    def _transition_jl_lead(self, lead_id, new_state):
        repo_dir = _job_leads_tool_dir_required()
        drive_updated = self._try_transition_jl_drive_lead(repo_dir, lead_id, new_state)
        if drive_updated is not None:
            return drive_updated

        db_path = _job_leads_db_path(repo_dir)
        if not os.path.exists(db_path):
            raise FileNotFoundError('JobLeadsTool leads database not found.')

        src_dir = os.path.join(repo_dir, 'src')
        if src_dir not in sys.path:
            sys.path.insert(0, src_dir)

        from job_leads_tool.sqlite_store import connect, get_lead, transition_state

        conn = connect(db_path)
        try:
            existing = get_lead(conn, lead_id)
            if existing is None:
                raise ValueError('lead not found')
            transition_state(conn, lead_id, new_state)
            updated = get_lead(conn, lead_id)
        finally:
            conn.close()

        self._sync_jl_scored_output_state(lead_id, new_state)
        return self._updated_jl_lead_payload(lead_id, updated or {'id': lead_id, 'approval_state': new_state})

    def _delete_jl_lead(self, lead_id):
        repo_dir = _job_leads_tool_dir_required()
        db_path = _job_leads_db_path(repo_dir)

        src_dir = os.path.join(repo_dir, 'src')
        if src_dir not in sys.path:
            sys.path.insert(0, src_dir)

        deleted_ids = self._load_jl_deleted_ids(repo_dir)
        deleted_ids.add(lead_id)
        self._save_jl_deleted_ids(repo_dir, deleted_ids)

        lead_url = self._jl_scored_output_lead_url(lead_id)
        db_deleted = False
        if os.path.exists(db_path):
            from job_leads_tool.sqlite_store import connect
            conn = connect(db_path)
            try:
                if lead_url:
                    existing = conn.execute("SELECT id FROM leads WHERE url = ?", (lead_url,)).fetchall()
                    deleted_ids.update(str(row['id']) for row in existing if row['id'])
                    self._save_jl_deleted_ids(repo_dir, deleted_ids)
                    cur = conn.execute("DELETE FROM leads WHERE id = ? OR url = ?", (lead_id, lead_url))
                else:
                    cur = conn.execute("DELETE FROM leads WHERE id = ?", (lead_id,))
                conn.commit()
                db_deleted = cur.rowcount > 0
            finally:
                conn.close()

        scored_deleted = self._remove_jl_scored_output_lead(lead_id)
        return {
            'ok': True,
            'lead_id': lead_id,
            'db_deleted': db_deleted,
            'scored_deleted': scored_deleted,
        }

    def _try_transition_jl_drive_lead(self, repo_dir, lead_id, new_state):
        src_dir = os.path.join(repo_dir, 'src')
        if src_dir not in sys.path:
            sys.path.insert(0, src_dir)
        try:
            from job_leads_tool import drive_store
        except Exception:
            return None
        transition_fn = getattr(drive_store, 'transition_lead', None)
        if not callable(transition_fn):
            return None
        return transition_fn(self._drive_service_payload(), lead_id, new_state)

    def _try_apply_jl_drive_lead(self, repo_dir, lead_id):
        src_dir = os.path.join(repo_dir, 'src')
        if src_dir not in sys.path:
            sys.path.insert(0, src_dir)
        try:
            from job_leads_tool import drive_store
        except Exception:
            return None
        apply_fn = getattr(drive_store, 'apply_lead', None)
        if not callable(apply_fn):
            return None
        return apply_fn(self._drive_service_payload(), lead_id)

    def _sync_jl_scored_output_state(self, lead_id, new_state):
        path = _job_leads_output_path('scored')
        if not path or not os.path.exists(path):
            return
        with open(path, 'r', encoding='utf-8') as output_file:
            scored = json.load(output_file)
        if not isinstance(scored, list):
            return

        changed = False
        for item in scored:
            lead = item.get('lead') if isinstance(item.get('lead'), dict) else item
            if str(lead.get('id') or item.get('id') or '') != lead_id:
                continue
            lead['approval_state'] = new_state
            if isinstance(item, dict):
                item['approval_state'] = new_state
            changed = True

        if changed:
            with open(path, 'w', encoding='utf-8') as output_file:
                json.dump(scored, output_file, indent=2)

    def _load_jl_deleted_ids(self, repo_dir):
        path = _job_leads_deleted_ids_path(repo_dir)
        if not path.exists():
            return set()
        try:
            payload = json.loads(path.read_text(encoding='utf-8'))
        except Exception:
            return set()
        if isinstance(payload, list):
            return {str(item) for item in payload if item}
        if isinstance(payload, dict) and isinstance(payload.get('ids'), list):
            return {str(item) for item in payload.get('ids') if item}
        return set()

    def _save_jl_deleted_ids(self, repo_dir, deleted_ids):
        path = _job_leads_deleted_ids_path(repo_dir)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(sorted(deleted_ids), indent=2), encoding='utf-8')

    def _jl_scored_output_lead_url(self, lead_id):
        path = _job_leads_output_path('scored')
        if not path or not os.path.exists(path):
            return ''
        try:
            with open(path, 'r', encoding='utf-8') as output_file:
                scored = json.load(output_file)
        except Exception:
            return ''
        if not isinstance(scored, list):
            return ''
        for item in scored:
            if not isinstance(item, dict):
                continue
            lead = item.get('lead') if isinstance(item.get('lead'), dict) else item
            item_id = str(lead.get('id') or item.get('lead_id') or item.get('id') or '')
            if item_id == lead_id:
                return str(lead.get('url') or '')
        return ''

    def _remove_jl_scored_output_lead(self, lead_id):
        path = _job_leads_output_path('scored')
        if not path or not os.path.exists(path):
            return False
        with open(path, 'r', encoding='utf-8') as output_file:
            scored = json.load(output_file)
        if not isinstance(scored, list):
            return False

        kept = []
        for item in scored:
            if not isinstance(item, dict):
                kept.append(item)
                continue
            lead = item.get('lead') if isinstance(item.get('lead'), dict) else item
            item_id = str(lead.get('id') or item.get('lead_id') or item.get('id') or '')
            if item_id != lead_id:
                kept.append(item)
        if len(kept) == len(scored):
            return False
        with open(path, 'w', encoding='utf-8') as output_file:
            json.dump(kept, output_file, indent=2)
        return True

    def _updated_jl_lead_payload(self, lead_id, db_lead):
        scored = self._load_jl_scored_leads()
        for item in scored:
            lead = item.get('lead') if isinstance(item.get('lead'), dict) else item
            if str(lead.get('id') or item.get('id') or '') == lead_id:
                return item
        return db_lead

    def _jl_lead_counts(self):
        try:
            scored = self._load_jl_scored_leads()
        except Exception:
            scored = []
        counts = {
            'total': len(scored),
            'tier_1': 0,
            'tier_2': 0,
            'tier_3': 0,
            'pending_review': 0,
            'approved': 0,
            'rejected': 0,
            'applied': 0,
        }
        for item in scored:
            tier = item.get('tier')
            if tier in counts:
                counts[tier] += 1
            lead = item.get('lead') if isinstance(item.get('lead'), dict) else item
            state = lead.get('approval_state') or item.get('approval_state')
            if state in counts:
                counts[state] += 1
        return counts

    def _job_leads_output(self):
        query = parse_qs(urlparse(self.path).query)
        view = (query.get('view') or ['scored'])[0]
        try:
            if view == 'scored':
                self._json(_sort_scored_leads(self._load_jl_scored_leads()))
                return
            if view == 'digest':
                text = self._read_jl_output_text('digest')
                self._json({'text': text})
                return
            if view == 'health':
                self._json(self._read_jl_output_json('health'))
                return
            if view == 'review':
                path = _job_leads_output_path('review')
                if not path or not os.path.exists(path):
                    self._json({'error': 'Requested JobLeadsTool review output not found.'}, 404)
                    return
                with open(path, 'r', encoding='utf-8') as output_file:
                    data = output_file.read()
                self.send_response(200)
                self.send_header('Content-type', 'text/html; charset=utf-8')
                self.end_headers()
                self.wfile.write(data.encode('utf-8'))
                return
            self._json({'error': f'Unknown JobLeadsTool output view: {view}'}, 400)
        except FileNotFoundError as exc:
            self._json({'error': str(exc)}, 404)
        except Exception as exc:
            self._json({'error': f'Could not load JobLeadsTool output: {exc}'}, 500)

    def _load_jl_scored_leads(self):
        repo_dir = _find_job_leads_tool_dir()
        if not repo_dir:
            raise FileNotFoundError('JobLeadsTool path not found. Set jl_path in config.json.')

        drive_leads = self._try_load_jl_drive_leads(repo_dir)
        if drive_leads is not None:
            return drive_leads

        path = _job_leads_output_path('scored')
        if not path or not os.path.exists(path):
            raise FileNotFoundError('JobLeadsTool scored output not found.')
        with open(path, 'r', encoding='utf-8') as output_file:
            data = json.load(output_file)
        return data if isinstance(data, list) else []

    def _refresh_jl_scored_output(self, repo_dir):
        src_dir = os.path.join(repo_dir, 'src')
        if src_dir not in sys.path:
            sys.path.insert(0, src_dir)
        from job_leads_tool.cli import _score_from_db

        profile_path = Path(repo_dir) / 'config' / 'candidate_profile.yaml'
        db_path = _job_leads_db_path(repo_dir)
        scored_path = Path(repo_dir) / 'outputs' / 'scored_leads.json'
        self._jl_source_filter_profile = self._load_jl_local_profile(repo_dir)
        scored = _score_from_db(profile_path, db_path)
        deleted_ids = self._load_jl_deleted_ids(repo_dir)
        current_ids = self._current_jl_source_ids(repo_dir)
        current_ids.update(self._existing_jl_scored_output_ids(scored_path))
        if current_ids:
            scored = [
                item for item in scored
                if str((item.get('lead') or item).get('id') or item.get('lead_id') or item.get('id') or '') in current_ids
                and str((item.get('lead') or item).get('id') or item.get('lead_id') or item.get('id') or '') not in deleted_ids
            ]
        scored = [
            item for item in scored
            if not self._scored_jl_item_excluded_by_profile(item)
        ]
        scored_path.parent.mkdir(parents=True, exist_ok=True)
        scored_path.write_text(json.dumps(scored, indent=2), encoding='utf-8')
        return scored

    def _append_jl_manual_scored_output(self, repo_dir, scored):
        scored_path = Path(repo_dir) / 'outputs' / 'scored_leads.json'
        rows = []
        if scored_path.exists():
            try:
                existing = json.loads(scored_path.read_text(encoding='utf-8'))
                if isinstance(existing, list):
                    rows = existing
            except Exception:
                rows = []
        lead_id = str(scored.get('lead_id') or (scored.get('lead') or {}).get('id') or '')
        rows = [
            row for row in rows
            if str(row.get('lead_id') or (row.get('lead') or {}).get('id') or '') != lead_id
        ]
        rows.append(scored)
        rows = _sort_scored_leads(rows)
        scored_path.parent.mkdir(parents=True, exist_ok=True)
        scored_path.write_text(json.dumps(rows, indent=2), encoding='utf-8')
        return next(
            (row for row in rows if str(row.get('lead_id') or (row.get('lead') or {}).get('id') or '') == lead_id),
            scored,
        )

    def _existing_jl_scored_output_ids(self, scored_path):
        if not scored_path.exists():
            return set()
        try:
            rows = json.loads(scored_path.read_text(encoding='utf-8'))
        except Exception:
            return set()
        ids = set()
        for item in rows if isinstance(rows, list) else []:
            lead = item.get('lead') if isinstance(item, dict) and isinstance(item.get('lead'), dict) else item
            lead_id = (lead or {}).get('id') or item.get('lead_id') if isinstance(item, dict) else ''
            if lead_id:
                ids.add(str(lead_id))
        return ids

    def _try_load_jl_drive_leads(self, repo_dir):
        src_dir = os.path.join(repo_dir, 'src')
        if src_dir not in sys.path:
            sys.path.insert(0, src_dir)
        try:
            from job_leads_tool import drive_store
        except Exception:
            return None
        if not hasattr(drive_store, 'load_leads'):
            return None
        try:
            return drive_store.load_leads(self._drive_service_payload())
        except Exception:
            return None

    def _drive_service_payload(self):
        cfg = load_config()
        return {
            'access_token': cfg.get('google_access_token', ''),
            'refresh_token': cfg.get('google_refresh_token', ''),
            'client_id': cfg.get('google_client_id', ''),
            'client_secret': cfg.get('google_client_secret', ''),
        }

    def _read_jl_output_text(self, view):
        path = _job_leads_output_path(view)
        if not path or not os.path.exists(path):
            raise FileNotFoundError(f'JobLeadsTool {view} output not found.')
        with open(path, 'r', encoding='utf-8') as output_file:
            return output_file.read()

    def _read_jl_output_json(self, view):
        path = _job_leads_output_path(view)
        if not path or not os.path.exists(path):
            raise FileNotFoundError(f'JobLeadsTool {view} output not found.')
        with open(path, 'r', encoding='utf-8') as output_file:
            return json.load(output_file)

    def _oauth_callback(self, query_string):
        params = parse_qs(query_string)
        code = params.get('code', [None])[0]
        error = params.get('error', [None])[0]

        if error:
            msg = f'<h2 style="color:#e74c3c">Auth Error: {html_lib.escape(error)}</h2><p>You can close this window and try again.</p>'
        elif code:
            msg = f'<h2 style="color:#FFCC00">&#10003; Google Drive Connected!</h2><p>This window will close automatically...</p>'
        else:
            msg = '<h2>No authorization code received.</h2>'

        code_json = json.dumps(code or '')
        page_html = f'''<!DOCTYPE html><html>
<head><title>JobSearchCoach</title>
<style>
  body{{font-family:system-ui,sans-serif;background:#1a1a2e;color:#e8eaf0;
       display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}}
  div{{padding:40px;background:#16213e;border-radius:12px;border:1px solid rgba(255,204,0,0.3)}}
</style></head>
<body><div>{msg}</div>
<script>
  const oauthCode = {code_json};
  if(window.opener && oauthCode){{
    window.opener.postMessage({{type:'oauth_code',code:oauthCode}}, 'http://localhost:{self._server_port()}');
  }}
  setTimeout(()=>window.close(), 2000);
</script></body></html>'''

        self.send_response(200)
        self.send_header('Content-type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(page_html.encode())

    def _token_exchange(self, data):
        cfg = load_config()
        params = urllib.parse.urlencode({
            'code': data.get('code', ''),
            'client_id': cfg.get('google_client_id', ''),
            'client_secret': cfg.get('google_client_secret', ''),
            'redirect_uri': f'http://localhost:{self._server_port()}/oauth2callback',
            'grant_type': 'authorization_code'
        }).encode()
        try:
            req = urllib.request.Request(
                'https://oauth2.googleapis.com/token',
                data=params, method='POST'
            )
            with urllib.request.urlopen(req) as r:
                tokens = json.loads(r.read())
            save_config({
                'google_access_token': tokens.get('access_token'),
                'google_refresh_token': tokens.get('refresh_token'),
            })
            self._json({'ok': True})
        except urllib.error.HTTPError as e:
            self._json({'ok': False, 'error': self._google_error_message(e)}, e.code)
        except Exception as e:
            self._json({'ok': False, 'error': str(e)}, 500)

    def _token_refresh(self):
        cfg = load_config()
        params = urllib.parse.urlencode({
            'refresh_token': cfg.get('google_refresh_token', ''),
            'client_id': cfg.get('google_client_id', ''),
            'client_secret': cfg.get('google_client_secret', ''),
            'grant_type': 'refresh_token'
        }).encode()
        try:
            req = urllib.request.Request(
                'https://oauth2.googleapis.com/token',
                data=params, method='POST'
            )
            with urllib.request.urlopen(req) as r:
                tokens = json.loads(r.read())
            save_config({'google_access_token': tokens.get('access_token')})
            self._json({'access_token': tokens.get('access_token')})
        except urllib.error.HTTPError as e:
            self._json({'ok': False, 'error': self._google_error_message(e)}, e.code)
        except Exception as e:
            self._json({'ok': False, 'error': str(e)}, 500)

    def _google_error_message(self, error):
        try:
            payload = json.loads(error.read().decode('utf-8'))
            code = payload.get('error')
            description = payload.get('error_description')
            if code and description:
                return f'Google OAuth error: {code} - {description}'
            if code:
                return f'Google OAuth error: {code}'
        except Exception:
            pass
        return f'Google OAuth HTTP {error.code}: {error.reason}'

    def _extract_resume(self, payload):
        filename = (payload.get('filename') or '').lower()
        encoded = payload.get('data') or ''
        if not filename.endswith('.docx'):
            self._json({'ok': False, 'error': 'Only .docx files are supported by the local extractor'}, 400)
            return
        try:
            raw = base64.b64decode(encoded, validate=True)
            text = self._extract_docx_text(raw)
            if not text.strip():
                self._json({'ok': False, 'error': 'No readable text found in the .docx file'}, 400)
                return
            self._json({'ok': True, 'text': text})
        except Exception as e:
            self._json({'ok': False, 'error': f'Could not read .docx file: {e}'}, 400)

    def _extract_docx_text(self, raw):
        with zipfile.ZipFile(BytesIO(raw)) as zf:
            names = ['word/document.xml']
            names.extend(
                name for name in sorted(zf.namelist())
                if name.startswith('word/header') and name.endswith('.xml')
            )
            names.extend(
                name for name in sorted(zf.namelist())
                if name.startswith('word/footer') and name.endswith('.xml')
            )
            chunks = [self._extract_docx_xml_text(zf.read(name)) for name in names if name in zf.namelist()]
        return '\n'.join(chunk for chunk in chunks if chunk)

    def _extract_docx_xml_text(self, xml_bytes):
        root = ET.fromstring(xml_bytes)
        paragraphs = []
        for para in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
            parts = []
            for node in para.iter():
                if node.tag.endswith('}t') and node.text:
                    parts.append(node.text)
                elif node.tag.endswith('}tab'):
                    parts.append('\t')
                elif node.tag.endswith('}br'):
                    parts.append('\n')
            line = ''.join(parts).strip()
            if line:
                paragraphs.append(line)
        return '\n'.join(paragraphs)

    def _claude_proxy(self, payload):
        cfg = load_config()
        api_key = cfg.get('anthropic_api_key', '')
        if not api_key:
            self._json({'error': 'No API key configured'}, 401)
            return

        body = json.dumps(payload).encode()
        headers = {
            'x-api-key': api_key,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        }
        if payload.get('tools'):
            headers['anthropic-beta'] = 'web-search-2025-03-05'
        req = urllib.request.Request(
            'https://api.anthropic.com/v1/messages',
            data=body, method='POST',
            headers=headers
        )

        is_stream = payload.get('stream', False)
        try:
            with urllib.request.urlopen(req) as r:
                if is_stream:
                    self.send_response(200)
                    self.send_header('Content-type', 'text/event-stream')
                    self.send_header('Cache-Control', 'no-cache')
                    self._cors()
                    self.end_headers()
                    while True:
                        chunk = r.read(512)
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                        self.wfile.flush()
                else:
                    data = r.read()
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.send_header('Content-Length', len(data))
                    self._cors()
                    self.end_headers()
                    self.wfile.write(data)
        except urllib.error.HTTPError as e:
            err_body = e.read()
            self.send_response(e.code)
            self.send_header('Content-type', 'application/json')
            self._cors()
            self.end_headers()
            self.wfile.write(err_body)
        except Exception as e:
            self._json({'error': str(e)}, 500)

    # ── Apify / LinkedIn Radar methods ────────────────────────────────────

    def _apify_data_dir(self):
        path = os.path.join(BASE_DIR, 'data')
        os.makedirs(path, exist_ok=True)
        return path

    def _apify_scored_path(self):
        return os.path.join(self._apify_data_dir(), 'apify_scored.json')

    def _apify_states_path(self):
        return os.path.join(self._apify_data_dir(), 'apify_states.json')

    def _apify_load_states(self):
        path = self._apify_states_path()
        if not os.path.exists(path):
            return {}
        try:
            with open(path, encoding='utf-8') as f:
                data = json.load(f)
            return data if isinstance(data, dict) else {}
        except Exception:
            return {}

    def _apify_save_states(self, states):
        with open(self._apify_states_path(), 'w', encoding='utf-8') as f:
            json.dump(states, f, indent=2)

    def _apify_load_scored(self):
        path = self._apify_scored_path()
        if not os.path.exists(path):
            return []
        try:
            with open(path, encoding='utf-8') as f:
                data = json.load(f)
            return data if isinstance(data, list) else []
        except Exception:
            return []

    def _apify_output(self):
        try:
            jobs   = self._apify_load_scored()
            states = self._apify_load_states()
            for job in jobs:
                job['approval_state'] = states.get(str(job.get('id') or ''), 'pending_review')
            self._json(jobs)
        except Exception as exc:
            self._json({'error': str(exc)}, 500)

    def _apify_config_get(self):
        cfg        = load_config()
        apify_cfg  = cfg.get('apify_config') or {}
        token_raw  = str(cfg.get('apify_token') or '').strip()
        self._json({
            'ok':        True,
            'has_token': bool(token_raw),
            'config':    _deep_merge(_default_apify_config(), apify_cfg),
        })

    def _apify_config_save(self, body):
        updates = {}
        token = str(body.get('apify_token') or '').strip()
        if token and token != '***':
            updates['apify_token'] = token
        incoming = body.get('apify_config')
        if isinstance(incoming, dict):
            current = load_config().get('apify_config') or {}
            updates['apify_config'] = _deep_merge(current, incoming)
        if updates:
            save_config(updates)
        self._json({'ok': True})

    def _apify_run(self):
        import datetime
        cfg       = load_config()
        token     = str(cfg.get('apify_token') or '').strip()
        if not token:
            self._json({'ok': False, 'error': 'Apify token not configured. Add it in Settings → LinkedIn Radar.'}, 400)
            return
        apify_cfg = _deep_merge(_default_apify_config(), cfg.get('apify_config') or {})
        role      = str(apify_cfg.get('role_keyword') or 'Data Analyst').strip()
        count     = int(apify_cfg.get('min_results') or 50)
        li_url    = (
            f'https://www.linkedin.com/jobs/search/?keywords={urllib.parse.quote(role)}'
            f'&location=United+States&f_E=2&f_JT=F&position=1&pageNum=0'
        )
        try:
            actor_url = f'{_APIFY_BASE}/acts/{_APIFY_ACTOR}/runs?waitForFinish=300'
            payload   = json.dumps({'urls': [li_url], 'count': count, 'scrapeCompany': False}).encode('utf-8')
            req       = urllib.request.Request(
                actor_url, data=payload, method='POST',
                headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
            )
            with urllib.request.urlopen(req, timeout=320) as resp:
                run_data = json.loads(resp.read().decode('utf-8'))
            dataset_id = (run_data.get('data') or {}).get('defaultDatasetId') or ''
            if not dataset_id:
                raise ValueError('No dataset ID returned from Apify run.')
            items_url = f'{_APIFY_BASE}/datasets/{dataset_id}/items?limit={count + 100}'
            req2 = urllib.request.Request(
                items_url, headers={'Authorization': f'Bearer {token}'},
            )
            with urllib.request.urlopen(req2, timeout=60) as resp2:
                items = json.loads(resp2.read().decode('utf-8'))
            if not isinstance(items, list):
                raise ValueError('Unexpected Apify response format.')
            min_threshold = int((apify_cfg.get('scoring') or {}).get('min_score_threshold', 40))
            scored = [_score_apify_job(item, apify_cfg) for item in items]
            scored = [j for j in scored if j.get('score', 0) >= min_threshold]
            scored.sort(key=lambda x: x.get('score', 0), reverse=True)
            with open(self._apify_scored_path(), 'w', encoding='utf-8') as f:
                json.dump(scored, f, indent=2)
            self._json({
                'ok':         True,
                'count':      len(scored),
                'dataset_id': dataset_id,
                'fetched_at': datetime.datetime.utcnow().isoformat() + 'Z',
            })
        except urllib.error.HTTPError as exc:
            err_body = exc.read().decode('utf-8', errors='ignore')
            try:
                msg = json.loads(err_body).get('error', {}).get('message') or err_body
            except Exception:
                msg = err_body[:500]
            self._json({'ok': False, 'error': f'Apify API error {exc.code}: {msg}'}, 500)
        except Exception as exc:
            self._json({'ok': False, 'error': str(exc)}, 500)

    def _apify_state(self, body):
        lead_id = str(body.get('lead_id') or '').strip()
        state   = str(body.get('state') or '').strip()
        if not lead_id or state not in ('approved', 'rejected', 'pending_review'):
            self._json({'ok': False, 'error': 'lead_id and valid state required'}, 400)
            return
        states = self._apify_load_states()
        states[lead_id] = state
        self._apify_save_states(states)
        self._json({'ok': True, 'lead_id': lead_id, 'state': state})

    def _apify_delete(self, body):
        lead_id = str(body.get('lead_id') or '').strip()
        if not lead_id:
            self._json({'ok': False, 'error': 'lead_id required'}, 400)
            return
        scored = [j for j in self._apify_load_scored() if str(j.get('id') or '') != lead_id]
        with open(self._apify_scored_path(), 'w', encoding='utf-8') as f:
            json.dump(scored, f, indent=2)
        states = self._apify_load_states()
        states.pop(lead_id, None)
        self._apify_save_states(states)
        self._json({'ok': True})

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-type', 'application/json')
        self.send_header('Content-Length', len(body))
        self._cors()
        self.end_headers()
        self.wfile.write(body)


def main():
    os.chdir(BASE_DIR)
    socketserver.TCPServer.allow_reuse_address = True
    try:
        selected_port, preferred_port, fallback_used = _resolve_server_port()
    except RuntimeError as exc:
        print(f'\n  {exc}\n')
        return

    if fallback_used:
        print(f'\n  Preferred port {preferred_port} is unavailable; selected port {selected_port} instead.')
    else:
        print(f'\n  Preferred port {preferred_port} is available.\n')

    with socketserver.ThreadingTCPServer(('127.0.0.1', selected_port), AppHandler) as httpd:
        print(f'\n  JobSearchCoach running at http://localhost:{selected_port}\n')
        print('  Press Ctrl+C to stop.\n')
        threading.Timer(1.2, lambda: webbrowser.open(f'http://localhost:{selected_port}')).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\n  Session ended. Good luck!\n')


if __name__ == '__main__':
    main()
