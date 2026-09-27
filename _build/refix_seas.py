#!/usr/bin/env python3
"""Re-fetch seasonality with trailing 15y of monthly bars; update data/discovery.js in place."""
import json, os, sys, time, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from concurrent.futures import ThreadPoolExecutor
import collect_discovery as C

HERE = os.path.dirname(os.path.abspath(__file__))
for p in glob.glob(os.path.join(HERE, '.cache-discovery', 'yt_*.json')):
    os.remove(p)
print('cleared yt cache', flush=True)
IN = os.path.join(HERE, 'data', 'discovery.js')
raw = open(IN).read()
payload = json.loads(raw.split('window.__DISCOVERY__ = ', 1)[1].rstrip().rstrip(';'))
stocks = payload['stocks']
syms = sorted(stocks.keys())
t0 = time.time()
with ThreadPoolExecutor(max_workers=8) as ex:
    for sym, res in zip(syms, ex.map(C.seasonality, syms)):
        s = res[1]
        if s['avg']: stocks[sym]['seas'] = s
ok = sum(1 for v in stocks.values() if v.get('seas'))
print('seas ok: %d (%.0fs)' % (ok, time.time() - t0), flush=True)
if ok < 400:
    print('REFUSING: too few; keeping previous discovery.js'); sys.exit(1)
js = 'window.__DISCOVERY__ = ' + json.dumps(payload, separators=(',', ':')) + ';'
open(IN, 'w').write(js)
print('wrote %s (%d bytes)' % (IN, len(js)))
