#!/usr/bin/env python3
"""Build data/discovery.js: market scanner universe + seasonality + analyst + options.
Free sources: Nasdaq screener, Nasdaq analyst API, Yahoo chart (monthly/weekly), CBOE delayed quotes.
Run: python3 collect_discovery.py   (writes data/discovery.js)
"""
import json, math, os, re, statistics, sys, time, random
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone
import urllib.request

OUT = os.path.join(os.path.dirname(__file__), 'data', 'discovery.js')
CACHE = os.path.join(os.path.dirname(__file__), '.cache-discovery')
os.makedirs(CACHE, exist_ok=True)

UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*'}

def get(url, timeout=25, headers=None, retries=3):
    h = dict(UA); h.update(headers or {})
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=h)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read().decode('utf-8', 'replace')
        except Exception as e:
            last = e
            time.sleep(1.0 + random.random() * i)
    raise last

def cache_get(key):
    p = os.path.join(CACHE, key + '.json')
    if os.path.exists(p):
        try:
            with open(p) as f: return json.load(f)
        except Exception: return None
    return None

def cache_put(key, obj):
    try:
        with open(os.path.join(CACHE, key + '.json'), 'w') as f:
            json.dump(obj, f)
    except Exception: pass

def pct(a, b):
    return round((a - b) / b * 100, 2) if b else 0

# ---------- 1. Nasdaq screener ----------
def nasdaq_screener():
    # download=true returns the entire listing in one response; no pagination needed
    url = 'https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=25&offset=0&download=true'
    d = json.loads(get(url, retries=5))
    return (d.get('data') or {}).get('rows') or []

def clean_num(s):
    if s is None: return 0
    s = str(s).replace('$', '').replace(',', '').strip()
    if s in ('--', '', 'N/A', 'n/a'): return 0
    mult = 1
    if s.endswith('B'): mult, s = 1e9, s[:-1]
    elif s.endswith('M'): mult, s = 1e6, s[:-1]
    elif s.endswith('K'): mult, s = 1e3, s[:-1]
    elif s.endswith('T'): mult, s = 1e12, s[:-1]
    try: return float(s) * mult
    except Exception: return 0

# ---------- 2. Nasdaq analyst consensus + summary ----------
def nasdaq_analyst(sym):
    key = 'na_' + sym
    c = cache_get(key)
    if c is not None: return c
    try:
        d = json.loads(get('https://api.nasdaq.com/api/analyst/%s/ratings' % sym))
        info = (d.get('data') or {}).get('summary') or {}
        out = {'consensus': info.get('consensusLabel') or info.get('consensus') or '',
               'n': int(info.get('numAnalysts') or 0)}
    except Exception:
        out = {'consensus': '', 'n': 0}
    cache_put(key, out); return out

def nasdaq_summary(sym):
    key = 'ns_' + sym
    c = cache_get(key)
    if c is not None: return c
    try:
        d = json.loads(get('https://api.nasdaq.com/api/quote/%s/summary?assetclass=stocks' % sym))
        dd = (d.get('data') or {}).get('summaryData') or {}
        def val(k):
            v = (dd.get(k) or {}).get('value'); return clean_num(v)
        out = {'target': val('TargetPrice'), 'avgvol': val('AverageVolume'),
               'divy': val('DividendYield'), 'mcap': val('MarketCap'),
               'pe': val('PERatio'), 'beta': val('Beta')}
    except Exception:
        out = {'target': 0, 'avgvol': 0, 'divy': 0, 'mcap': 0, 'pe': 0, 'beta': 0}
    cache_put(key, out); return out

# ---------- 3. Yahoo monthly history (10y) ----------
def yahoo_monthly(sym):
    key = 'ym_' + sym
    c = cache_get(key)
    if c is not None: return c
    try:
        u = ('https://query1.finance.yahoo.com/v8/finance/chart/%s?period1=0&period2=9999999999'
             '&interval=1mo&events=div' % sym)
        d = json.loads(get(u))
        r = (d.get('chart') or {}).get('result') or [{}]
        q = (r[0].get('indicators') or {}).get('quote') or [{}]
        q = q[0]
        out = {'c': [x for x in (q.get('close') or []) if x],
               'h': [x for x in (q.get('high') or []) if x],
               'l': [x for x in (q.get('low') or []) if x]}
    except Exception:
        out = {'c': [], 'h': [], 'l': []}
    cache_put(key, out); return out

# ---------- 3b. Yahoo weekly history (3y) for stochastic ----------
def yahoo_weekly(sym):
    key = 'yw_' + sym
    c = cache_get(key)
    if c is not None: return c
    try:
        u = ('https://query1.finance.yahoo.com/v8/finance/chart/%s?range=3y&interval=1wk' % sym)
        d = json.loads(get(u))
        r = (d.get('chart') or {}).get('result') or [{}]
        q = (r[0].get('indicators') or {}).get('quote') or [{}]
        q = q[0]
        bars = []
        for h, l, c in zip(q.get('high') or [], q.get('low') or [], q.get('close') or []):
            if h and l and c: bars.append([round(h, 2), round(l, 2), round(c, 2)])
        out = {'bars': bars}
    except Exception:
        out = {'bars': []}
    cache_put(key, out); return out

def stochastic(bars, n=14, smooth=3):
    """Weekly stochastic %K/%D series; returns (k_series, d_series)."""
    if len(bars) < n + smooth: return [], []
    ks = []
    for i in range(n - 1, len(bars)):
        win = bars[i - n + 1:i + 1]
        hh = max(b[0] for b in win); ll = min(b[1] for b in win); c = bars[i][2]
        ks.append(100 * (c - ll) / (hh - ll) if hh > ll else 50)
    def sma(x, p):
        return [sum(x[i - p + 1:i + 1]) / p for i in range(p - 1, len(x))]
    k = sma(ks, smooth); d = sma(k, smooth)
    return k, d

# ---------- 4. CBOE delayed options chain ----------
# Schema (verified 2026-09-26): data.options is a FLAT list of contracts.
# Each has 'option' = OCC symbol like 'GOOGL260928C00265000'
# (<root><YYMMDD><C|P><strike*1000, 8 digits>), plus bid/ask/iv/
# open_interest/volume/delta/gamma. data.current_price = spot,
# data.iv30 already in percent, data.last_trade_time = quote time.
OCC_RE = re.compile(r'^([A-Z./]+?)(\d{6})([CP])(\d{8})$')
def cboe_chain(sym):
    key = 'cboe_' + sym
    c = cache_get(key)
    if c is not None: return c
    try:
        d = json.loads(get('https://cdn-api.cboe.com/api/global/delayed_quotes/options/%s.json' % sym))
        data = d.get('data') or {}
        raw = data.get('options') or []
        spot = float(data.get('current_price') or data.get('close') or 0)
        iv30 = float(data.get('iv30') or 0)  # already percent
        tick_time = data.get('last_trade_time') or ''
        by_exp = {}
        for o in raw:
            m = OCC_RE.match(str(o.get('option') or ''))
            if not m: continue
            yymmdd = m.group(2)
            exp = '20%s-%s-%s' % (yymmdd[:2], yymmdd[2:4], yymmdd[4:6])
            try:
                opt = {
                    'k': int(m.group(4)) / 1000.0,
                    't': m.group(3),
                    'iv': round(float(o.get('iv') or 0) * 100, 1),
                    'de': round(float(o.get('delta') or 0), 3),
                    'ga': float(o.get('gamma') or 0),
                    'v': int(float(o.get('volume') or 0)),
                    'oi': int(float(o.get('open_interest') or 0)),
                    'b': float(o.get('bid') or 0),
                    'a': float(o.get('ask') or 0),
                }
            except Exception: continue
            by_exp.setdefault(exp, []).append(opt)
        exps = [{'exp': e, 'opts': by_exp[e]} for e in sorted(by_exp)]
        out = {'spot': spot, 'iv30': round(iv30, 1), 'tick_time': tick_time, 'exps': exps}
    except Exception as e:
        out = {'spot': 0, 'iv30': 0, 'exps': [], 'err': str(e)[:60]}
    cache_put(key, out); return out

def _is_std_monthly(d):
    """True if d is the third Friday of its month (standard monthly expiration)."""
    import calendar as _cal
    fridays = [w[_cal.FRIDAY] for w in _cal.monthcalendar(d.year, d.month) if w[_cal.FRIDAY]]
    return len(fridays) >= 3 and d.day == fridays[2]

def aggregate_options(chain):
    """Per-ticker summary over the 3 nearest STANDARD MONTHLY expirations:
    combined GEX by strike, walls, gamma flip, plus LEAP contract, call/put
    premium, unusual activity (those scan all expirations)."""
    exps = chain.get('exps') or []
    if not exps: return None
    spot = chain.get('spot') or 0
    today = date.today()
    dated = []
    for e in exps:
        try:
            ed = datetime.strptime(e['exp'][:10], '%Y-%m-%d').date()
            dte = (ed - today).days
        except Exception:
            ed, dte = None, 0
        e['_dte'] = dte
        e['_monthly'] = bool(ed) and _is_std_monthly(ed)
        dated.append((dte, e))
    monthly = [e for dte, e in sorted(dated, key=lambda x: x[0]) if dte > 0 and e['_monthly']][:3]
    if len(monthly) >= 2:
        use, gex_scope = monthly, 'monthly'
    else:  # fallback: not enough monthlies listed — use nearest expirations and say so
        use = [e for dte, e in sorted(dated, key=lambda x: x[0]) if dte > 0][:3]
        gex_scope = 'nearest'
    combo, expnets, unusual = {}, [], []
    call_oi, put_oi = {}, {}
    call_prem = put_prem = 0.0
    best_leap = None
    for e in exps:
        dte = e['_dte']
        net = 0.0
        for o in e['opts']:
            mid = (o['b'] + o['a']) / 2
            if o['v'] and mid:
                if o['t'] == 'C': call_prem += o['v'] * mid * 100
                else: put_prem += o['v'] * mid * 100
            if e in use and o['oi'] > 0:
                if o['t'] == 'C': call_oi[o['k']] = call_oi.get(o['k'], 0) + o['oi']
                else: put_oi[o['k']] = put_oi.get(o['k'], 0) + o['oi']
            if e in use and o['oi'] > 0 and o['ga'] > 0:
                g = o['oi'] * o['ga'] * (spot ** 2) / 1e9  # $B of hedge flow per 1% spot move
                if o['t'] == 'P': g = -g
                net += g
                combo[o['k']] = combo.get(o['k'], 0) + g
            if o['t'] == 'C' and 300 <= dte <= 500 and 0.55 <= o['de'] <= 0.85 and mid > 0:
                score = abs(dte - 365) + abs(o['de'] - 0.70) * 500
                if best_leap is None or score < best_leap[0]:
                    best_leap = (score, {'exp': e['exp'][:10], 'dte': dte, 'strike': o['k'],
                                         'delta': o['de'], 'bid': o['b'], 'ask': o['a'],
                                         'iv': o['iv'], 'mid': round(mid, 2)})
            if o['v'] >= 500 and o['oi'] > 0 and o['v'] >= 3 * o['oi']:
                unusual.append({'k': o['k'], 't': o['t'], 'v': o['v'], 'oi': o['oi'],
                                'iv': o['iv'], 'exp': e['exp'][:10], 'dte': dte})
        if net:
            expnets.append({'exp': e['exp'][:10], 'dte': dte, 'net': round(net, 3)})
    ks = sorted(combo.keys())
    gs = [round(combo[k], 4) for k in ks]
    tot = round(sum(combo.values()), 2)
    calls = [(k, g) for k, g in zip(ks, gs) if g > 0]
    puts = [(k, g) for k, g in zip(ks, gs) if g < 0]
    cw = max(calls, key=lambda x: x[1])[0] if calls else 0
    pw = max(puts, key=lambda x: abs(x[1]))[0] if puts else 0
    flip = None
    if tot > 0:
        cum = 0.0
        for k, g in zip(ks, gs):
            cum += g
            if cum >= 0:
                flip = k; break
    leap = None
    if best_leap:
        l = best_leap[1]
        l['breakeven'] = round(l['strike'] + l['mid'], 2)
        l['costpct'] = round(l['mid'] / spot * 100, 1) if spot else 0
        l['bepct'] = round((l['breakeven'] - spot) / spot * 100, 1) if spot else 0
        leap = l
    unusual.sort(key=lambda x: x['v'] / max(x['oi'], 1), reverse=True)
    # OI walls (largest open interest) and max pain over the 3-expiry combo
    coiwall = max(call_oi, key=call_oi.get) if call_oi else 0
    poiwall = max(put_oi, key=put_oi.get) if put_oi else 0
    maxpain = None
    if call_oi or put_oi:
        allk = sorted(set(call_oi) | set(put_oi))
        best = None
        for p in allk:
            payout = 0.0
            for k, oi in call_oi.items():
                if p > k: payout += oi * (p - k)
            for k, oi in put_oi.items():
                if k > p: payout += oi * (k - p)
            if best is None or payout < best[0]: best = (payout, p)
        maxpain = round(best[1], 2) if best else None
    return {
        'spot': round(spot, 2),
        'iv30': chain.get('iv30') or 0,
        'gex_scope': gex_scope,  # 'monthly' = 3 nearest standard monthlies; 'nearest' = fallback
        'gex_exps': [e['exp'][:10] for e in use],
        'k': [round(k, 2) for k in ks],
        'g': gs,
        'net': tot,
        'callwall': round(cw, 2),
        'putwall': round(pw, 2),
        'flip': round(flip, 2) if flip else None,
        'coiwall': round(coiwall, 2),
        'poiwall': round(poiwall, 2),
        'maxpain': maxpain,
        'expnets': expnets[:6],
        'unusual': unusual[:12],
        'leap': leap,
        'callprem': round(call_prem / 1e6, 1),
        'putprem': round(put_prem / 1e6, 1),
    }

# ---------- stats ----------
def compute_stats(closes, highs, lows):
    out = {'mom6': 0, 'mom12': 0, 'hv': 0, 'hi52': 0, 'lo52': 0, 'n': len(closes)}
    if len(closes) >= 7:
        out['mom6'] = pct(closes[-1], closes[-7])
    if len(closes) >= 13:
        out['mom12'] = pct(closes[-1], closes[-13])
    if len(highs) >= 12:
        out['hi52'] = round(max(highs[-12:]), 2)
    if len(lows) >= 12:
        out['lo52'] = round(min(lows[-12:]), 2)
    if len(closes) >= 25:
        lr = [math.log(closes[i] / closes[i - 1]) for i in range(1, len(closes)) if closes[i - 1] > 0]
        if len(lr) > 12:
            out['hv'] = round(statistics.pstdev(lr) * math.sqrt(12) * 100, 1)
    return out

def process(sym):
    try:
        an = nasdaq_analyst(sym)
        sm = nasdaq_summary(sym)
        yh = yahoo_monthly(sym)
        st = compute_stats(yh['c'], yh['h'], yh['l'])
        return sym, {'an': an, 'sm': sm, 'st': st}
    except Exception as e:
        return sym, {'err': str(e)[:80]}

def seasonality(sym):
    """Calendar-month avg return + hit rate over trailing 15y of monthly bars."""
    key = 'yt_' + sym
    c = cache_get(key)
    if c is not None: return sym, c
    try:
        u = ('https://query1.finance.yahoo.com/v8/finance/chart/%s?period1=0&period2=9999999999'
             '&interval=1mo' % sym)
        d = json.loads(get(u))
        r = (d.get('chart') or {}).get('result') or [{}]
        ts = r[0].get('timestamp') or []
        q = ((r[0].get('indicators') or {}).get('quote') or [{}])[0]
        cl = [x for x in (q.get('close') or []) if x]
        n = min(len(ts), len(cl))
        # trailing 15y
        if n > 180:
            ts = ts[-180:]; cl = cl[-180:]; n = 180
        months = [datetime.fromtimestamp(ts[i], tz=timezone.utc).month for i in range(n)]
        rets = {m: [] for m in range(1, 13)}
        for i in range(1, n):
            if cl[i - 1] > 0:
                rets[months[i]].append((cl[i] - cl[i - 1]) / cl[i - 1] * 100)
        out = {'avg': [round(statistics.mean(rets[m]), 2) if rets[m] else 0 for m in range(1, 13)],
               'pos': [round(100 * sum(1 for x in rets[m] if x > 0) / len(rets[m])) if rets[m] else 0
                       for m in range(1, 13)]}
    except Exception:
        out = {'avg': [], 'pos': []}
    cache_put(key, out); return sym, out

def stale_merge_opt(opt, opt_status, out_path):
    """Partial-failure safety: a failed options phase must not wipe yesterday's
    valid chains. Returns (opt, status, note)."""
    note = ''
    if opt_status == 'failed' and os.path.exists(out_path):
        try:
            prev_raw = open(out_path).read()
            prev = json.loads(prev_raw.split('window.__DISCOVERY__ = ', 1)[1].rstrip().rstrip(';'))
            prev_opt = prev.get('opt') or {}
            if len(prev_opt) >= 20:
                opt = prev_opt
                opt_status = 'stale'
                note = 'CBOE fetch failed; kept %d chains from previous bundle (%s)' % (
                    len(opt), (prev.get('meta') or {}).get('asof', prev.get('asof', '?')))
                print('   STALE-MERGE: ' + note, flush=True)
            else:
                note = 'CBOE fetch failed and previous bundle had too few chains to reuse'
        except Exception as e:
            note = 'CBOE fetch failed; previous bundle unreadable: %s' % str(e)[:80]
    return opt, opt_status, note

def main():
    t0 = time.time()
    print('1) Nasdaq screener…', flush=True)
    rows = nasdaq_screener()
    print('   listings: %d' % len(rows), flush=True)
    cands = []
    for r in rows:
        sym = (r.get('symbol') or '').strip().upper()
        if not sym or any(c in sym for c in ['^', '/', ' ', '=']): continue
        price = clean_num(r.get('lastsale'))
        mcap = clean_num(r.get('marketCap'))
        if price < 5 or mcap < 2e9: continue
        cands.append({'s': sym, 'n': r.get('name') or '', 'p': price,
                      'mc': mcap, 'sec': r.get('sector') or '', 'ind': r.get('industry') or '',
                      'cty': r.get('country') or '', 'vol': clean_num(r.get('volume'))})
    seen = {}
    for c in cands:
        if c['s'] not in seen or c['mc'] > seen[c['s']]['mc']:
            seen[c['s']] = c
    cands = sorted(seen.values(), key=lambda x: -x['mc'])[:650]
    print('   candidates: %d' % len(cands), flush=True)

    print('2) per-ticker analyst + summary + history…', flush=True)
    stocks = {}
    with ThreadPoolExecutor(max_workers=12) as ex:
        for sym, res in ex.map(process, [c['s'] for c in cands]):
            c = next(x for x in cands if x['s'] == sym)
            st = res.get('st') or {}
            if res.get('err') or st.get('n', 0) < 25:
                continue
            stocks[sym] = {
                'n': c['n'][:60], 'p': c['p'], 'mc': round(c['mc'] / 1e9, 2),
                'sec': c['sec'], 'ind': c['ind'], 'cty': c['cty'], 'vol': c['vol'],
                'con': res['an']['consensus'], 'anN': res['an']['n'],
                'tgt': round(res['sm']['target'], 2), 'avgvol': res['sm']['avgvol'],
                'divy': res['sm']['divy'], 'pe': res['sm']['pe'], 'beta': res['sm']['beta'],
                'mom6': st['mom6'], 'mom12': st['mom12'], 'hv': st['hv'],
                'hi52': st['hi52'], 'lo52': st['lo52'],
            }
    print('   kept: %d (%.0fs)' % (len(stocks), time.time() - t0), flush=True)

    print('3) seasonality…', flush=True)
    with ThreadPoolExecutor(max_workers=8) as ex:
        for sym, s in ex.map(seasonality, list(stocks.keys())):
            if s['avg']: stocks[sym]['seas'] = s
    print('   seas ok: %d' % sum(1 for v in stocks.values() if v.get('seas')), flush=True)

    opt_syms = sorted(stocks.keys(), key=lambda s: -stocks[s]['mc'])[:75]
    print('4) CBOE chains (%d)…' % len(opt_syms), flush=True)
    opt = {}
    with ThreadPoolExecutor(max_workers=4) as ex:
        for sym, ch in zip(opt_syms, ex.map(cboe_chain, opt_syms)):
            agg = aggregate_options(ch)
            if agg: opt[sym] = agg
    print('   chains ok: %d' % len(opt), flush=True)

    print('5) weekly stochastic…', flush=True)
    with ThreadPoolExecutor(max_workers=8) as ex:
        for sym, w in zip(opt_syms, ex.map(yahoo_weekly, opt_syms)):
            bars = w.get('bars') or []
            if bars and sym in opt:
                k, d = stochastic(bars)
                if k and d:
                    opt[sym]['stoch'] = {'k': [round(x, 1) for x in k[-52:]],
                                         'd': [round(x, 1) for x in d[-52:]]}
    print('   stoch ok: %d' % sum(1 for v in opt.values() if v.get('stoch')), flush=True)

    # ---- freshness metadata + per-dataset status ----
    now_utc = datetime.now(timezone.utc)
    collected_at = now_utc.strftime('%Y-%m-%dT%H:%M:%SZ')
    data_date = date.today().isoformat()
    n_stocks = len(stocks)
    n_seas = sum(1 for v in stocks.values() if v.get('seas'))
    n_opt = len(opt)
    n_stoch = sum(1 for v in opt.values() if v.get('stoch'))

    def _ds(source, status, record_count, note=''):
        d = {'source': source, 'collectedAt': collected_at, 'dataDate': data_date,
             'status': status, 'recordCount': record_count}
        if note: d['note'] = note
        return d

    stocks_status = 'success' if n_stocks >= 400 else 'failed'
    seas_status = ('success' if (n_stocks and n_seas / n_stocks >= 0.9) else
                   'partial' if n_seas >= 100 else 'failed')
    if n_opt >= 60:
        opt_status = 'success'
    elif n_opt >= 20:
        opt_status = 'partial'
    else:
        opt_status = 'failed'
    stoch_status = 'success' if n_opt and n_stoch / max(n_opt, 1) >= 0.8 else 'partial'

    opt, opt_status, opt_note = stale_merge_opt(opt, opt_status, OUT)

    meta = {
        'asof': data_date,
        'collectedAt': collected_at,
        'datasets': {
            'stocks': _ds('Nasdaq API screener + analyst/summary endpoints',
                          stocks_status, n_stocks),
            'seasonality': _ds('Yahoo Finance chart API (monthly bars)',
                               seas_status, n_seas),
            'options': _ds('CBOE delayed quotes API (options chains)',
                           opt_status, len(opt), opt_note),
            'stochastic': _ds('Yahoo Finance chart API (weekly bars)',
                              stoch_status, n_stoch),
        },
    }

    payload = {'asof': data_date, 'stocks': stocks, 'opt': opt,
               'count': n_stocks, 'meta': meta}
    if stocks_status == 'failed':
        print('ERROR: only %d stocks collected (expected 400+). Refusing to write discovery.js '
              'so a previous good snapshot is kept.' % n_stocks, flush=True)
        sys.exit(1)
    if opt_status == 'failed':
        print('ERROR: options collection failed (%d chains) with no reusable previous bundle. '
              'Refusing to deploy corrupted data.' % n_opt, flush=True)
        sys.exit(1)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    js = 'window.__DISCOVERY__ = ' + json.dumps(payload, separators=(',', ':')) + ';'
    with open(OUT, 'w') as f: f.write(js)
    print('wrote %s (%d bytes, %d stocks, %d opt) in %.0fs'
          % (OUT, len(js), n_stocks, len(opt), time.time() - t0), flush=True)
    for k, d in meta['datasets'].items():
        print('   meta.%-11s %-7s %d%s' % (k, d['status'], d['recordCount'],
                                          ' — ' + d['note'] if d.get('note') else ''), flush=True)

if __name__ == '__main__':
    main()
