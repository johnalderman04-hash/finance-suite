#!/usr/bin/env python3
"""Validation gate for the Finance Suite discovery bundle.

Usage: python3 validate_data.py [path/to/discovery.js] [--prev path/to/previous/discovery.js]

Checks row counts, duplicates, missing data, impossible values, malformed
chains, freshness metadata, and (against --prev) sudden explosions/collapses.
Exits 0 on PASS, 1 on FAIL. A FAIL must block deployment.
"""
import json, os, sys
from datetime import date

PATH = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else \
    os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'discovery.js')
PREV = None
if '--prev' in sys.argv:
    PREV = sys.argv[sys.argv.index('--prev') + 1]

fails, warns, info = [], [], []

def fail(msg): fails.append(msg)
def warn(msg): warns.append(msg)
def note(msg): info.append(msg)

def load(p):
    raw = open(p).read()
    try:
        return json.loads(raw.split('window.__DISCOVERY__ = ', 1)[1].rstrip().rstrip(';'))
    except Exception as e:
        fail('broken JSON in %s: %s' % (p, str(e)[:100]))
        return None

def main():
    size = os.path.getsize(PATH)
    note('file: %s (%d bytes)' % (PATH, size))
    if size > 8 * 1024 * 1024:
        fail('file unexpectedly large: %d bytes (limit 8MB)' % size)
    if size < 50_000:
        fail('file unexpectedly small: %d bytes (expected >50KB)' % size)

    p = load(PATH)
    if p is None:
        return report()
    if not isinstance(p, dict):
        fail('payload is not a JSON object'); return report()
    for k in ('asof', 'stocks', 'opt', 'meta'):
        if k not in p: fail('missing top-level key: %s' % k)

    # --- freshness date ---
    try:
        d = date.fromisoformat(str(p.get('asof', ''))[:10])
        age = (date.today() - d).days
        note('asof: %s (%d days old)' % (d.isoformat(), age))
        if age < 0 or age > 3: fail('asof date out of range: %s' % d.isoformat())
    except Exception:
        fail('asof is not a valid date: %r' % p.get('asof'))

    stocks = p.get('stocks')
    if not isinstance(stocks, dict) or not stocks:
        fail('stocks dataset empty or not an object'); return report()
    n = len(stocks)
    note('stocks: %d records' % n)
    # explosion / collapse guards (absolute)
    if n < 400: fail('too few stocks: %d (floor 400)' % n)
    if n > 1500: fail('too many stocks: %d (ceiling 1500 — possible duplicate explosion)' % n)

    bad_price = bad_mc = missing_fields = 0
    bad_seas = 0
    syms = set()
    for sym, s in stocks.items():
        if sym in syms: fail('duplicate ticker: %s' % sym)  # cannot happen in JSON objects, kept as guard
        syms.add(sym)
        if not isinstance(s, dict): missing_fields += 1; continue
        for f in ('n', 'p', 'mc', 'sec'):
            if f not in s: missing_fields += 1; break
        try:
            px = float(s.get('p', 0))
            if not (0 < px < 1_000_000): bad_price += 1
        except Exception: bad_price += 1
        try:
            mc = float(s.get('mc', 0))
            if not (0 < mc <= 100_000): bad_mc += 1  # mc stored in $B
        except Exception: bad_mc += 1
        seas = s.get('seas')
        if seas:
            a, ps = seas.get('avg') or [], seas.get('pos') or []
            if len(a) != 12 or len(ps) != 12: bad_seas += 1
            elif any(not (-100 <= x <= 500) for x in a): bad_seas += 1
            elif any(not (0 <= x <= 100) for x in ps): bad_seas += 1
    if missing_fields: fail('%d stocks missing required fields (n/p/mc/sec)' % missing_fields)
    if bad_price: fail('%d stocks with impossible prices' % bad_price)
    if bad_mc: fail('%d stocks with impossible market caps' % bad_mc)
    if bad_seas: warn('%d stocks with malformed seasonality arrays' % bad_seas)
    note('field/price/mc/seasantity: %d/%d/%d bad, %d bad seas' %
         (missing_fields, bad_price, bad_mc, bad_seas))

    # --- options ---
    opt = p.get('opt')
    if not isinstance(opt, dict): fail('opt dataset not an object')
    else:
        no = len(opt)
        note('options chains: %d' % no)
        if no > 120: fail('too many option chains: %d (ceiling 120)' % no)
        bad_chain = 0
        for sym, o in opt.items():
            if not isinstance(o, dict):
                bad_chain += 1; continue
            try:
                ks, gs = o.get('k') or [], o.get('g') or []
                if not ks or len(ks) != len(gs): bad_chain += 1; continue
                if float(o.get('spot', 0)) <= 0: bad_chain += 1; continue
                if o.get('gex_scope') not in ('monthly', 'nearest'): bad_chain += 1; continue
                if any(ks[i] >= ks[i + 1] for i in range(len(ks) - 1)): bad_chain += 1
            except Exception: bad_chain += 1
        if bad_chain: fail('%d malformed option chains' % bad_chain)
        else: note('option chains well-formed: %d' % no)

    # --- freshness metadata ---
    meta = p.get('meta') or {}
    ds = meta.get('datasets') or {}
    for name in ('stocks', 'seasonality', 'options', 'stochastic'):
        d = ds.get(name)
        if not d:
            warn('meta.datasets.%s missing' % name); continue
        for f in ('source', 'collectedAt', 'dataDate', 'status', 'recordCount'):
            if f not in d: fail('meta.datasets.%s missing field %s' % (name, f))
        note('meta.%-11s %-7s %s' % (name, d.get('status'), d.get('source', '')[:46]))
    st = (ds.get('stocks') or {}).get('status')
    if st != 'success': fail('stocks dataset status is %r (must be success)' % st)
    ost = (ds.get('options') or {}).get('status')
    if ost == 'failed': fail('options dataset status is failed')
    if ost in ('partial', 'stale'):
        warn('options dataset is %s — site will label it accordingly' % ost)

    # --- vs previous bundle: explosion/collapse detection ---
    if PREV and os.path.exists(PREV):
        q = load(PREV)
        if q:
            pn, qn = len(q.get('stocks') or {}), len(q.get('opt') or {})
            for label, new, old in (('stocks', n, pn), ('opt chains', len(opt or {}), qn)):
                if old and new:
                    r = new / old
                    note('%s: %d now vs %d prev (ratio %.2f)' % (label, new, old, r))
                    if r > 2.0: fail('%s exploded: %.1fx previous' % (label, r))
                    if r < 0.5: fail('%s collapsed: %.1fx previous' % (label, r))
            ps = os.path.getsize(PREV)
            if ps and size:
                r = size / ps
                note('file size ratio: %.2f' % r)
                if r > 3.0: fail('file size exploded: %.1fx previous' % r)
                if r < 0.3: fail('file size collapsed: %.1fx previous' % r)
    return report()

def report():
    print('---- discovery bundle validation ----')
    for m in info: print('  ' + m)
    for m in warns: print('  WARN: ' + m)
    for m in fails: print('  FAIL: ' + m)
    print('RESULT: ' + ('FAIL' if fails else 'PASS'))
    return 1 if fails else 0

if __name__ == '__main__':
    sys.exit(main())
