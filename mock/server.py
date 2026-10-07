"""Tiny stand-in for the SpoofHub v3 API, used for local UI testing.
Loads fixture files from FIXTURES (defaults to ./fixtures). API key is 'testkey'.
Run:  python3 mock/server.py   then sign in with address http://127.0.0.1:8787
"""
import json, os, re, copy
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

FIX = os.environ.get('FIXTURES', os.path.join(os.path.dirname(__file__), 'fixtures'))
def load(n, default):
    p = os.path.join(FIX, n)
    return json.load(open(p)) if os.path.exists(p) else default

ME = 9811882231
people = load('people.json', [{"id": ME, "first_name": "Test", "last_name": "User", "email": "test@example.com", "initials": "TU", "profile_color": "#CC3344", "suspended": False, "role_name": "Member"},
                              {"id": 111, "first_name": "Other", "last_name": "Person", "email": "other@example.com", "initials": "OP", "profile_color": "#3344CC", "suspended": False}])
tasks = load('alltodo.json', []) + load('alltodo_mine.json', [])
base_task = tasks[0] if tasks else {"ticket": "1", "id": 1, "title": "t", "description": None, "start_date": None, "due_date": None, "estimated_hours": None, "estimated_mins": None, "logged_hours": 32, "logged_mins": None, "updated_at": "2026-07-29T12:08:33+00:00", "created_at": "2026-07-16T04:31:56+00:00", "completed": False, "assigned": [], "by_me": False, "template": False, "timesheet_id": None, "project": {"id": 9533994962, "name": "Organizational Activities"}, "creator": {"id": 1}, "list": {"id": 270715557486, "name": "Hiring Operations"}, "workflow": {"id": 2370975710, "name": "3-stage Kanban workflow"}, "stage": {"id": 6950484625, "name": "Backlog"}}
for i in range(1, 8):
    t = copy.deepcopy(base_task); t.update(id=900000 + i, ticket=str(30000 + i), title=f'Synthetic task {i}', assigned=[ME] if i % 2 else [],
        list={'id': 270715557486, 'name': 'Hiring Operations'}, timesheet_id=10476260757 if i % 3 == 0 else None,
        due_date='2026-09-10' if i == 1 else None, by_me=(i == 2), creator={'id': ME}, completed=False)
    tasks.append(t)
timesheets = load('timesheets.json', [{"id": 10471199627, "title": "Coding", "archived": False, "private": False, "assigned": []}, {"id": 10476260757, "title": "Interviews", "archived": False, "private": False, "assigned": []}])
todolists = load('todolists.json', [{"id": 270715557486, "title": "Hiring Operations", "archived": False}, {"id": 270700564057, "title": "Meetings Training", "archived": False}])
alltime = load('alltime.json', [])
alltime.append({"by_me": True, "id": 777001, "status": "billable", "description": "Reproduced the bug", "date": "2026-09-18", "logged_hours": 1, "logged_mins": 15,
                "timesheet": {"id": 10471199627, "title": "Coding"}, "task": {"list_id": 270715557486, "list_name": "Hiring Operations", "task_id": 900001, "task_name": "Synthetic task 1"},
                "project": {"id": 9533994962, "name": "Organizational Activities"}, "creator": {"id": ME}})
projects = [{"id": 9580929145, "title": "FC - FamNme Backend/Admin", "archived": False, "color": "#03A9F4", "assigned": [ME], "template": False},
            {"id": 9581010557, "title": "FC - Microsites Aggregator", "archived": False, "color": "#FFEB3B", "assigned": [ME], "template": False},
            {"id": 9533994962, "title": "Organizational Activities", "archived": False, "color": "#CDDC39", "assigned": [ME, 8206255563], "template": False}]
workflows = load('workflows.json', [{"id": 2370975710, "title": "3-stage Kanban workflow", "is_default": True, "workflow_stages": [
    {"id": 6950484625, "title": "Backlog", "is_default": True}, {"id": 6950498194, "title": "In progress", "is_default": False}, {"id": 6950511762, "title": "Done", "is_default": True}]}])
stage_titles = {str(st['id']): st['title'] for wf in workflows for st in wf.get('workflow_stages', [])}
KEY = 'testkey'; counter = [0]; log = []; FAIL_429_AT = {5}

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*'); self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE, PUT'); self.send_header('Access-Control-Allow-Headers', 'X-API-KEY,Accept,Content-Type,User-Agent,X-Comp-Url')
    def _json(self, obj, status=200, extra=None):
        body = json.dumps(obj).encode(); self.send_response(status); self._cors(); self.send_header('Content-Type', 'application/json')
        for k, v in (extra or {}).items(): self.send_header(k, v)
        self.end_headers(); self.wfile.write(body)
    def do_OPTIONS(self): self.send_response(204); self._cors(); self.end_headers()
    def _auth(self):
        if self.headers.get('X-API-KEY') != KEY: self._json({"success": False, "status": False, "code": 1001, "message": "WRONG ACCESS TOKEN"}); return False
        return True
    def do_GET(self):
        u = urlparse(self.path); q = parse_qs(u.query); path = u.path
        if path == '/__log': return self._json(log)
        if not self._auth(): return
        log.append(('GET', path))
        if path.endswith('/people'): return self._json(people)
        if path.endswith('/projects'): return self._json(projects)
        if path.endswith('/workflows'):
            if not self.headers.get('X-Comp-Url'): return self._json({"success": False, "status": False, "code": 1202, "message": "INCOMPLETE HEADERS COMPANY URL MISSING"})
            return self._json(workflows)
        if path.endswith('/alltodo'):
            start = int(q.get('start', ['0'])[0]); limit = int(q.get('limit', ['100'])[0]); rows = [t for t in tasks if not t.get('completed')]
            if 'projects' in q: rows = [t for t in rows if str(t['project']['id']) == q['projects'][0]]
            return self._json(rows[start:start + limit])
        if path.endswith('/alltime'):
            start = int(q.get('start', ['0'])[0]); return self._json(alltime[start:start + 100])
        if re.search(r'/projects/\d+/timesheets$', path): return self._json(timesheets)
        if re.search(r'/projects/\d+/todolists$', path): return self._json(todolists)
        self._json({"code": 1301, "message": "Invalid request", "response_code": 200})
    def _body(self):
        n = int(self.headers.get('Content-Length') or 0); return json.loads(self.rfile.read(n) or b'{}')
    def do_POST(self):
        if not self._auth(): return
        path = urlparse(self.path).path; body = self._body(); counter[0] += 1; log.append(('POST', path, body))
        if counter[0] in FAIL_429_AT: FAIL_429_AT.discard(counter[0]); return self._json({}, 429, {'Retry-After': '3'})
        if re.search(r'/time$', path):
            if body.get('description') == 'FAILME': return self._json({"code": 2033, "message": "Value of the custom field does not match its type."})
            e = {"id": 800000 + counter[0], "status": body.get('status'), "description": body.get('description'), "date": body.get('date'), "logged_hours": body.get('logged_hours'), "logged_mins": body.get('logged_mins'),
                 "timesheet": {"id": body.get('timesheet_id')}, "task": {"task_id": body.get('task_id'), "list_id": body.get('list_id')}, "project": {"id": body.get('project')}, "creator": {"id": ME}, "by_me": True}
            alltime.append(e); return self._json(e)
        m = re.search(r'/projects/(\d+)/todolists/(\d+)/tasks$', path)
        if m:
            t = copy.deepcopy(base_task); t.update(id=950000 + counter[0], ticket=str(40000 + counter[0]), title=body.get('title'), assigned=body.get('assigned', []), logged_hours=None, logged_mins=None, by_me=True, creator={'id': ME}, completed=False)
            t['project'] = {"id": int(m.group(1)), "name": "Organizational Activities"}; t['list'] = {"id": int(m.group(2)), "name": next((l['title'] for l in todolists if str(l['id']) == m.group(2)), '?')}
            tasks.insert(0, t); return self._json(t)
        self._json({"code": 1301, "message": "Invalid request", "response_code": 200})
    def do_PUT(self):
        if not self._auth(): return
        path = urlparse(self.path).path; body = self._body(); counter[0] += 1; log.append(('PUT', path, body))
        m = re.search(r'/time/(\d+)$', path)
        if m:
            for e in alltime:
                if str(e['id']) == m.group(1): e.update({k: v for k, v in body.items() if k in ('date', 'logged_hours', 'logged_mins', 'status', 'description')}); return self._json(e)
            return self._json(alltime)
        m = re.search(r'/tasks/(\d+)$', path)
        if m:
            for t in tasks:
                if str(t['id']) == m.group(1):
                    if 'completed' in body: t['completed'] = body['completed']
                    if 'stage' in body:
                        sid = str(body['stage'])
                        if sid not in stage_titles: return self._json({"code": 1301, "message": "Invalid request", "response_code": 200})
                        t['stage'] = {'id': int(sid), 'name': stage_titles[sid]}  # deliberately does NOT auto-complete on the last stage
                    return self._json(t)
        self._json({"code": 1301, "message": "Invalid request", "response_code": 200})
    def do_DELETE(self):
        if not self._auth(): return
        path = urlparse(self.path).path; counter[0] += 1; log.append(('DELETE', path))
        m = re.search(r'/time/(\d+)$', path)
        if m:
            alltime[:] = [e for e in alltime if str(e['id']) != m.group(1)]; self.send_response(204); self._cors(); self.end_headers(); return
        self._json({"code": 1301, "message": "Invalid request", "response_code": 200})

if __name__ == '__main__':
    print('mock SpoofHub on http://127.0.0.1:8787  (API key: testkey)')
    ThreadingHTTPServer(('127.0.0.1', 8787), H).serve_forever()
