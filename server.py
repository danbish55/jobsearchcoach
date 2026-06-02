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
from io import BytesIO
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
JL_PROCESS = None
JL_LOCK = threading.Lock()


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
            'corinnejobcoach' in normalized
            or 'corinnejobcoach' in normalized_cwd
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


def _load_config_unlocked():
    bundled = _read_config_file(BUNDLED_CONFIG_FILE)
    user = _read_config_file(CONFIG_FILE)
    cfg = {}
    cfg.update(bundled)
    cfg.update(user)
    for key in ('google_client_id', 'google_client_secret'):
        if bundled.get(key):
            cfg[key] = bundled[key]
    return cfg


def _read_config_file(path):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


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
    configured = (load_config().get('jl_path') or '').strip()
    if configured:
        configured = os.path.expanduser(configured)
        cli_path = os.path.join(configured, 'src', 'job_leads_tool', 'cli.py')
        if os.path.exists(cli_path):
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
            return candidate
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
        'python3',
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
        elif path == '/api/jl-output':
            self._job_leads_output()
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
        elif path == '/api/token-exchange':
            self._token_exchange(body)
        elif path == '/api/token-refresh':
            self._token_refresh()
        elif path == '/api/start-jl':
            self._start_jl(body)
        elif path == '/api/jl/run-cycle':
            self._jl_run_cycle()
        elif path == '/api/extract-resume':
            self._extract_resume(body)
        elif path == '/api/claude':
            self._claude_proxy(body)
        else:
            self.send_response(404)
            self.end_headers()

    def _read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        return json.loads(self.rfile.read(length)) if length else {}

    def _start_jl(self, body):
        force = bool(body.get('force'))
        result = _start_job_leads_tool(force=force)
        status = 200 if result.get('ok') else 500
        self._json(result, status)

    def _jl_run_cycle(self):
        try:
            repo_dir = _job_leads_tool_dir_required()
            cmd = _job_leads_run_cycle_command(repo_dir)
            result = subprocess.run(
                cmd,
                cwd=repo_dir,
                env=_job_leads_env(repo_dir),
                text=True,
                capture_output=True,
                timeout=120,
            )
        except subprocess.TimeoutExpired as exc:
            self._json({
                'success': False,
                'error': 'JobLeadsTool run-cycle timed out after 120 seconds.',
                'output': (exc.stdout or '')[-4000:],
                'stderr': (exc.stderr or '')[-4000:],
            }, 504)
            return
        except Exception as exc:
            self._json({'success': False, 'error': str(exc)}, 500)
            return

        combined_output = '\n'.join(
            part for part in [result.stdout.strip(), result.stderr.strip()] if part
        )

        if result.returncode != 0:
            self._json({
                'success': False,
                'error': f'JobLeadsTool run-cycle failed with exit code {result.returncode}.',
                'output': combined_output[-8000:],
            }, 500)
            return

        self._json({
            'success': True,
            'output': combined_output,
            'lead_counts': self._jl_lead_counts(),
        })

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

    with socketserver.ThreadingTCPServer(('', selected_port), AppHandler) as httpd:
        print(f'\n  JobSearchCoach running at http://localhost:{selected_port}\n')
        print('  Press Ctrl+C to stop.\n')
        threading.Timer(1.2, lambda: webbrowser.open(f'http://localhost:{selected_port}')).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\n  Session ended. Good luck!\n')


if __name__ == '__main__':
    main()
