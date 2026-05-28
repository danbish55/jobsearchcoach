#!/usr/bin/env python3
"""JobSearchCoach — Local Server v1.0"""

import http.server
import socketserver
import json
import os
import threading
import webbrowser
import urllib.request
import urllib.parse
import html as html_lib
import tempfile
from urllib.parse import urlparse, parse_qs

PORT = 8765
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, 'config.json')
CONFIG_LOCK = threading.Lock()


def load_config():
    with CONFIG_LOCK:
        return _load_config_unlocked()


def save_config(updates):
    with CONFIG_LOCK:
        cfg = _load_config_unlocked()
        cfg.update(updates)
        fd, tmp_path = tempfile.mkstemp(prefix='config.', suffix='.tmp', dir=BASE_DIR, text=True)
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as f:
                json.dump(cfg, f, indent=2)
                f.write('\n')
            os.replace(tmp_path, CONFIG_FILE)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)


def _load_config_unlocked():
    try:
        with open(CONFIG_FILE, encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


class AppHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

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
            self._json({
                'has_api_key': bool(cfg.get('anthropic_api_key')),
                'has_drive': bool(cfg.get('google_refresh_token')),
                'google_client_id': cfg.get('google_client_id', ''),
                'profile_complete': cfg.get('profile_complete', False),
            })
        elif path == '/api/context':
            ctx_path = os.path.join(BASE_DIR, 'context', 'corinne_claude_context.md')
            try:
                with open(ctx_path, encoding='utf-8') as f:
                    content = f.read()
                self._json({'content': content})
            except FileNotFoundError:
                self._json({'content': '', 'error': 'context file not found'})
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
        elif path == '/api/claude':
            self._claude_proxy(body)
        else:
            self.send_response(404)
            self.end_headers()

    def _read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        return json.loads(self.rfile.read(length)) if length else {}

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
    window.opener.postMessage({{type:'oauth_code',code:oauthCode}}, 'http://localhost:{PORT}');
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
            'redirect_uri': f'http://localhost:{PORT}/oauth2callback',
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
        except Exception as e:
            self._json({'ok': False, 'error': str(e)}, 500)

    def _claude_proxy(self, payload):
        cfg = load_config()
        api_key = cfg.get('anthropic_api_key', '')
        if not api_key:
            self._json({'error': 'No API key configured'}, 401)
            return

        body = json.dumps(payload).encode()
        req = urllib.request.Request(
            'https://api.anthropic.com/v1/messages',
            data=body, method='POST',
            headers={
                'x-api-key': api_key,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            }
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
    with socketserver.ThreadingTCPServer(('', PORT), AppHandler) as httpd:
        print(f'\n  JobSearchCoach running at http://localhost:{PORT}\n')
        print('  Press Ctrl+C to stop.\n')
        threading.Timer(1.2, lambda: webbrowser.open(f'http://localhost:{PORT}')).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\n  Session ended. Good luck!\n')


if __name__ == '__main__':
    main()
