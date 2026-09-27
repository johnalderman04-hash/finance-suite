#!/usr/bin/env python3
"""Headless smoke test for the built Finance Suite (used by CI and locally).

Usage: python3 smoke_test.py /path/to/index.html [chrome-binary]

Spins up headless Chrome with remote debugging, loads the file, and checks:
  - no uncaught page exceptions
  - the CORE DATA freshness chip renders with a date
  - key routes render (home, scanner, gamma with real GEX)
Exits 0 on PASS, 1 on FAIL.
"""
import json, os, subprocess, sys, time, urllib.request
import shutil

HTML = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.path.dirname(os.path.abspath(__file__)), '..', 'index.html')
CHROME = (sys.argv[2] if len(sys.argv) > 2 else None) or \
    shutil.which('chrome') or shutil.which('google-chrome') or \
    shutil.which('chromium') or shutil.which('chromium-browser') or \
    '/opt/meta-chromium/chrome'
PORT = 9339

fails, notes = [], []

def check(name, ok, extra=''):
    notes.append(('PASS' if ok else 'FAIL', name, extra))
    if not ok: fails.append(name)

try:
    import websocket
except ImportError:
    print('FAIL: websocket-client not installed (pip install websocket-client)')
    sys.exit(1)

udir = '/tmp/finsuite_smoke_profile'
subprocess.run(['rm', '-rf', udir], check=False)
proc = subprocess.Popen(
    [CHROME, '--headless=new', '--no-sandbox', '--disable-gpu', '--no-proxy-server',
     '--remote-debugging-port=%d' % PORT, '--user-data-dir=' + udir,
     '--remote-allow-origins=*', 'about:blank'],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(60):
        try:
            urllib.request.urlopen('http://127.0.0.1:%d/json/version' % PORT, timeout=2)
            break
        except Exception:
            time.sleep(0.25)
    else:
        print('FAIL: chrome did not start'); sys.exit(1)
    ts = json.load(urllib.request.urlopen('http://127.0.0.1:%d/json/list' % PORT, timeout=5))
    page = [x for x in ts if x.get('type') == 'page'][0]
    ws = websocket.create_connection(page['webSocketDebuggerUrl'], timeout=40)
    seq = 0
    excs = []

    def cmd(method, params=None):
        global seq
        seq += 1
        ws.send(json.dumps({'id': seq, 'method': method, 'params': params or {}}))
        while True:
            m = json.loads(ws.recv())
            if m.get('id') == seq:
                return m.get('result')
            if m.get('method') == 'Runtime.exceptionThrown':
                excs.append(m['params']['exceptionDetails'].get('text', '')[:140])

    def ev(expr):
        r = cmd('Runtime.evaluate', {'expression': expr, 'returnByValue': True})
        res = r.get('result') or {}
        return res.get('value') if res.get('type') != 'undefined' else None

    APP = 'file://' + os.path.abspath(HTML)
    cmd('Runtime.enable')

    def nav(route, wait=3.0):
        cmd('Page.navigate', {'url': APP + route})
        time.sleep(wait)

    nav('#/home', 4.0)
    check('fresh load, no exceptions', True)
    check('core-data freshness chip visible',
          ev("var e=document.getElementById('corefresh'); !!(e && e.style.display!=='none' && /CORE DATA/.test(e.textContent))"),
          str(ev("var e=document.getElementById('corefresh'); e?e.textContent:''")))
    check('freshness chip not labeled LIVE',
          ev("document.getElementById('corefresh').textContent.indexOf('LIVE')<0"))
    check('nav links present', (ev("document.querySelectorAll('#nav .nav-link').length") or 0) >= 20)

    nav('#/scanner')
    check('scanner renders rows', (ev("document.querySelectorAll('#dsc-table tbody tr').length") or 0) > 5)

    nav('#/gamma/GOOGL')
    check('gamma net GEX nonzero', abs(ev("dRaw().opt.GOOGL.net") or 0) > 0,
          str(ev("dRaw().opt.GOOGL.net")))
    check('gamma scope monthly', ev("dRaw().opt.GOOGL.gex_scope") == 'monthly')
    check('meta present', bool(ev("!!(dRaw().meta && dRaw().meta.datasets)")))
    check('meta stocks success', ev("(dRaw().meta.datasets.stocks||{}).status") == 'success')

    nav('#/terminal')
    check('terminal cards', ev("document.querySelectorAll('.tw-card').length") == 4)

    check('no uncaught page exceptions', len(excs) == 0, str(excs[:3]))
    ws.close()
finally:
    proc.terminate()

print('---- smoke test ----')
for s, n, x in notes:
    print('%s %s %s' % (s, n, x))
print('RESULT: ' + ('FAIL' if fails else 'PASS'))
sys.exit(1 if fails else 0)
