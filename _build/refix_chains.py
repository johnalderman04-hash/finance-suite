#!/usr/bin/env python3
"""Re-fetch CBOE chains with the corrected flat-schema parser and rebuild
data/discovery.js in place. Preserves stocks + existing stoch fields.
Refuses to write if too few valid chains come back."""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from concurrent.futures import ThreadPoolExecutor
import collect_discovery as C

HERE = os.path.dirname(os.path.abspath(__file__))
IN = os.path.join(HERE, 'data', 'discovery.js')
raw = open(IN).read()
payload = json.loads(raw.split('window.__DISCOVERY__ = ', 1)[1].rstrip().rstrip(';'))
stocks = payload['stocks']
opt_syms = sorted(stocks.keys(), key=lambda s: -stocks[s]['mc'])[:75]
old_opt = payload.get('opt') or {}
opt = {}
print('re-fetching %d chains...' % len(opt_syms), flush=True)
t0 = time.time()
with ThreadPoolExecutor(max_workers=8) as ex:
    for sym, ch in zip(opt_syms, ex.map(C.cboe_chain, opt_syms)):
        agg = C.aggregate_options(ch)
        if agg:
            if sym in old_opt and old_opt[sym].get('stoch'):
                agg['stoch'] = old_opt[sym]['stoch']
            opt[sym] = agg
print('chains ok: %d (%.0fs)' % (len(opt), time.time() - t0), flush=True)
nvalid = sum(1 for v in opt.values() if v.get('net'))
print('non-zero net GEX: %d' % nvalid)
if nvalid < 20:
    print('REFUSING: too few valid chains; keeping previous discovery.js'); sys.exit(1)
payload['opt'] = opt
js = 'window.__DISCOVERY__ = ' + json.dumps(payload, separators=(',', ':')) + ';'
open(IN, 'w').write(js)
print('wrote %s (%d bytes, %d stocks, %d opt)' % (IN, len(js), len(stocks), len(opt)))
