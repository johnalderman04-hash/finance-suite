/* ================================================================
   11-terminal.js — terminal-grade upgrades for the existing app.
   Freshness system, methodology drawer, source panel, offline pill,
   what-changed engine, command-palette extensions, g-sequences,
   and the Terminal workspace route.
   100% static. No libraries. No backend. No fake data.
   ================================================================ */

/* ---------------- 1. DATA FRESHNESS SYSTEM ---------------- */
const FRESH_META={
  'LIVE':      {cls:'f-live',  desc:'Streaming/real-time from the provider'},
  'NEAR-LIVE': {cls:'f-near',  desc:'Polled within the last few minutes'},
  'DELAYED':   {cls:'f-delay', desc:'Provider-delayed data (e.g. 15-min)'},
  'DAILY':     {cls:'f-daily', desc:'Refreshed once per day on rebuild'},
  'HISTORICAL':{cls:'f-hist',  desc:'Bundled historical snapshot'},
  'UNAVAILABLE':{cls:'f-na',   desc:'Could not be retrieved'}
};
const Fresh={
  badge:function(state, title){
    var m=FRESH_META[state]||FRESH_META.UNAVAILABLE;
    return '<span class="fresh '+m.cls+'" title="'+Util.esc(title||m.desc)+'">'+state+'</span>';
  },
  age:function(ts){
    if(ts==null||ts===''||isNaN(Number(ts))) return 'date unknown';
    var t=Number(ts), now=Date.now(), d=now-t;
    if(d<0) d=0;
    if(d<5000) return 'just now';
    if(d<60000) return Math.floor(d/1000)+' sec ago';
    if(d<3600000) return Math.floor(d/60000)+' min ago';
    if(d<86400000) return Math.floor(d/3600000)+' hr ago';
    var dt=new Date(t);
    return dt.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  },
  /* "$378.42 · 42 sec ago · Finnhub" */
  line:function(state, source, ts){
    return this.badge(state)+' <span class="small hint">'+Util.esc(source||'')
      +(ts!=null?' · '+Util.esc(this.age(ts)):'')+'</span>';
  }
};

/* ---------------- 2. SOURCE & METHODOLOGY DRAWER ---------------- */
const MINFO={
  gex:{t:'Net Gamma Exposure (GEX)', what:'Estimated dealer gamma positioning by strike, in $B of hedge flow per 1% spot move, combined across the three nearest standard monthly expirations (third Fridays). Positive = dealers long gamma (calmer, pinning); negative = dealers short gamma (choppier).',
    how:'Σ over the three nearest expirations: call OI × call γ − put OI × put γ, times spot² / 10⁹. Calls add, puts subtract (retail convention).',
    src:'CBOE delayed options chains, bundled at rebuild', lim:'Dealer positioning is inferred, not directly observed. Delayed and frozen at the bundle date — not for trade timing.'},
  flip:{t:'Gamma Flip', what:'Approximate strike where cumulative net gamma (three nearest monthlies) crosses from negative to positive — the level under which dealer hedging flips from calming to amplifying. Approximation: coarse strike grid, delayed chain.',
    how:'Strikes sorted ascending; running total of net gamma; first strike where the total ≥ 0.',
    src:'CBOE delayed options chains, bundled at rebuild', lim:'Approximation — true flip revalues gamma as spot moves. Moves with the bundle date.'},
  callwall:{t:'Call Wall (gamma)', what:'Strike with the heaviest positive (call) gamma — expected resistance.',
    how:'Max of net-gamma values > 0 across strikes in the three nearest expirations combined.',
    src:'CBOE delayed options chains, bundled at rebuild', lim:'Gamma wall ≠ open-interest wall. Delayed snapshot.'},
  putwall:{t:'Put Wall (gamma)', what:'Strike with the heaviest negative (put) gamma — expected support.',
    how:'Max of |net-gamma| values < 0 across strikes in the three nearest expirations combined.',
    src:'CBOE delayed options chains, bundled at rebuild', lim:'Gamma wall ≠ open-interest wall. Delayed snapshot.'},
  oiwall:{t:'OI Wall', what:'Strike with the largest open interest for calls (or puts) — where the most contracts are outstanding.',
    how:'Max of summed call (or put) open interest by strike across the three nearest expirations.',
    src:'CBOE delayed options chains, bundled at rebuild', lim:'Open interest updates overnight (OCC); static intraday. Different metric from gamma walls.'},
  maxpain:{t:'Max Pain', what:'Strike minimizing total payout to option holders at expiration — the price that hurts option owners most.',
    how:'For each strike P: Σ calls OI×max(P−K,0) + Σ puts OI×max(K−P,0). Minimum wins.',
    src:'CBOE delayed options chains, bundled at rebuild', lim:'Theoretical; pinning is a tendency, not a guarantee. Delayed snapshot.'},
  iv:{t:'IV30', what:'Average implied volatility of the delayed chain, ~30-day.',
    how:'Mean of contract IVs near 30 days to expiry from the CBOE delayed chain.',
    src:'CBOE delayed options chains', lim:'Delayed; model-dependent (CBOE).'},
  hv:{t:'Historical Volatility', what:'Annualized realized volatility of log returns.',
    how:'Std dev of daily log returns × √252, over the trailing window.',
    src:'Yahoo Finance monthly/daily bars, bundled', lim:'Backward-looking; not a forecast.'},
  analyst:{t:'Analyst Consensus', what:'Mean recommendation and price target from covering analysts.',
    how:'Nasdaq analyst endpoint: consensus label, analyst count, mean target; upside vs snapshot price.',
    src:'Nasdaq (free endpoint), bundled at rebuild', lim:'Analysts are often slow and herd. Snapshot, not live.'},
  pe:{t:'P/E Ratio', what:'Price per share ÷ earnings per share (trailing).',
    how:'Snapshot price ÷ (net income ÷ diluted shares) from bundled SEC fundamentals.',
    src:'SEC EDGAR via bundled fundamentals', lim:'Meaningless when earnings ≤ 0. Trailing, not forward.'},
  ev_ebitda:{t:'EV / EBIT (approx)', what:'Enterprise value ÷ operating income — a capital-structure-neutral multiple.',
    how:'(market cap + long-term debt) ÷ operating income. Cash is not subtracted (no cash field) so EV is approximate; EBIT used for EBITDA.',
    src:'Bundled SEC fundamentals + snapshot price', lim:'Approximation. Distorts for financials and negative EBIT.'},
  fcf_yield:{t:'FCF Yield', what:'Free cash flow per share ÷ price — the cash earnings yield.',
    how:'Operating cash flow (used as FCF proxy; no capex field) ÷ market cap.',
    src:'Bundled SEC fundamentals', lim:'Uses operating cash flow, not true FCF. One-year snapshot.'},
  roic:{t:'ROIC (approx)', what:'Return on invested capital — how well the business turns capital into operating profit.',
    how:'Operating income × (1 − 21%) ÷ (long-term debt + book equity).',
    src:'Bundled SEC fundamentals', lim:'Rough: flat 21% tax, book values. Weak for financials.'},
  roe:{t:'ROE', what:'Return on equity — net income ÷ shareholder equity.',
    how:'Net income ÷ (total assets − total liabilities), latest fiscal year.',
    src:'Bundled SEC fundamentals', lim:'Leverage inflates ROE; check Debt/EBITDA alongside.'},
  revdcf:{t:'Reverse DCF', what:'The growth the current price already implies — what you must believe for the stock to be fairly valued.',
    how:'Solves the DCF for the growth rate that equates model value to the snapshot price, holding margin/discount/terminal growth fixed.',
    src:'Valuation Workbench (your inputs) + snapshot price', lim:'Output only as good as your margin/discount assumptions.'},
  seas:{t:'Seasonality', what:'Average monthly return and hit-rate per calendar month, over up to 15 years of monthly bars (fewer for younger listings).',
    how:'For each calendar month: mean of (month-end ÷ prior month-end − 1) and % of positive months, up to 10 years of Yahoo monthly bars.',
    src:'Yahoo Finance monthly bars, bundled', lim:'History rhymes; regimes change. Small samples for young stocks.'},
  stoch:{t:'Stochastic (14,3)', what:'Weekly momentum oscillator: where price sits in its 14-week range.',
    how:'%K = 100×(close − lowest low)/(highest high − lowest low); %D = 3-week SMA of %K.',
    src:'Yahoo Finance weekly bars, bundled', lim:'Oscillators whipsaw in trends. <20 oversold, >80 overbought.'}
};
function mi(key){
  if(!MINFO[key]) return '';
  return ' <button class="mi" data-mi="'+key+'" title="Source & methodology" aria-label="About this metric">i</button>';
}
const Minfo={
  open:function(key){
    var m=MINFO[key]; if(!m) return;
    var d=document.getElementById('minfo-drawer');
    if(!d){
      d=document.createElement('div'); d.id='minfo-drawer';
      d.innerHTML='<div class="minfo-head"><b>Source &amp; Methodology</b><button class="btn sm ghost" id="minfo-x">Close</button></div><div class="minfo-body" id="minfo-body"></div>';
      document.body.appendChild(d);
      document.getElementById('minfo-x').addEventListener('click', Minfo.close);
    }
    document.getElementById('minfo-body').innerHTML=
      '<h3>'+Util.esc(m.t)+'</h3>'+
      '<div class="minfo-sec"><b>What it means</b><p>'+Util.esc(m.what)+'</p></div>'+
      '<div class="minfo-sec"><b>How this site calculates it</b><p>'+Util.esc(m.how)+'</p></div>'+
      '<div class="minfo-sec"><b>Data source</b><p>'+Util.esc(m.src)+'</p></div>'+
      (m.upd?'<div class="minfo-sec"><b>Last update</b><p>'+Util.esc(m.upd)+'</p></div>':'')+
      '<div class="minfo-sec"><b>Limitations</b><p>'+Util.esc(m.lim)+'</p></div>';
    d.classList.add('open');
  },
  close:function(){ var d=document.getElementById('minfo-drawer'); if(d) d.classList.remove('open'); }
};
document.addEventListener('click', function(e){
  var b=e.target.closest?e.target.closest('[data-mi]'):null;
  if(b){ e.preventDefault(); Minfo.open(b.getAttribute('data-mi')); }
});

/* ---------------- 3. HONEST EMPTY STATES ---------------- */
function emptyState(title, body, lastSnap){
  return '<div class="empty-state"><b>'+Util.esc(title)+'</b><p>'+body+'</p>'
    +(lastSnap?'<p class="small hint">Last available snapshot: '+Util.esc(lastSnap)+'</p>':'')+'</div>';
}

/* ---------------- 4. SOURCE PANEL ---------------- */
const SrcPanel={
  open:function(){
    var d=document.getElementById('src-drawer');
    if(!d){
      d=document.createElement('div'); d.id='src-drawer';
      d.innerHTML='<div class="minfo-head"><b>Data Sources</b><button class="btn sm ghost" id="src-x">Close</button></div><div class="minfo-body" id="src-body"></div>';
      document.body.appendChild(d);
      document.getElementById('src-x').addEventListener('click', SrcPanel.close);
    }
    var rows=[];
    var prov=(typeof LiveQuotes!=='undefined')?LiveQuotes.provider():null;
    rows.push(['Price quotes', prov?(prov==='finnhub'?'Finnhub':'Alpha Vantage'):'Bundled daily bars (real-data.json, Sep 2026)',
      prov?'LIVE':'HISTORICAL', prov?'key in your browser · 60s cache':'frozen at build']);
    rows.push(['Fundamentals','SEC EDGAR via real-data.json (bundled Sep 25, 2026)','HISTORICAL','3 fiscal years per ticker']);
    var dr=(typeof dRaw!=='undefined')?dRaw():null;
    rows.push(['Scanner / seasonality / analyst',
      dr?('Nasdaq + Yahoo Finance, bundled '+dr.asof):'Not bundled in this file',
      dr?'DAILY':'UNAVAILABLE', dr?'Nasdaq screener, analyst & summary endpoints; Yahoo monthly bars':'rebuild to include']);
    rows.push(['Options / GEX',
      dr&&dr.opt?('CBOE delayed chains, bundled '+dr.asof):'Not bundled in this file',
      dr&&dr.opt?'DELAYED':'UNAVAILABLE', dr&&dr.opt?'delayed ~15 min at capture; 3 nearest expirations':'rebuild to include']);
    rows.push(['Market news','TickerTick API + CNBC/Yahoo RSS + SEC EDGAR','NEAR-LIVE','re-polled every 4 min while page is open']);
    rows.push(['Crypto','CoinGecko free API','NEAR-LIVE','fetched when Markets page opens; no key']);
    rows.push(['History','Browser-local snapshots (this device only)','HISTORICAL','saved when you view scanner/gamma pages']);
    document.getElementById('src-body').innerHTML=
      '<p class="small hint">Every number in this terminal comes from one of these. Nothing is invented; unavailable data is labeled, not filled in.</p>'+
      '<table class="tbl"><thead><tr><th>Data</th><th>Source</th><th>State</th><th>Note</th></tr></thead><tbody>'+
      rows.map(function(r){ return '<tr><td><b>'+Util.esc(r[0])+'</b></td><td>'+Util.esc(r[1])+'</td><td>'+Fresh.badge(r[2])+'</td><td class="small hint">'+Util.esc(r[3])+'</td></tr>'; }).join('')+
      '</tbody></table>';
    d.classList.add('open');
  },
  close:function(){ var d=document.getElementById('src-drawer'); if(d) d.classList.remove('open'); }
};

/* ---------------- 5. OFFLINE PILL + TOPBAR ---------------- */
const Net={
  render:function(){
    var el=document.getElementById('net-pill'); if(!el) return;
    var on=navigator.onLine;
    el.className='net-pill '+(on?'on':'off');
    el.title=on?'Browser reports an internet connection':'Browser reports no internet connection — bundled data and your saved work still work';
    el.innerHTML='<span class="dot"></span>'+(on?'ONLINE':'OFFLINE');
  },
  init:function(){
    var tb=document.getElementById('topbar'); if(!tb) return;
    if(!document.getElementById('net-pill')){
      var p=document.createElement('span'); p.id='net-pill'; p.className='net-pill on';
      tb.appendChild(p);
    }
    if(!document.getElementById('src-btn')){
      var b=document.createElement('button'); b.id='src-btn'; b.className='btn sm ghost';
      b.innerHTML='Sources'; b.title='Data sources used by this terminal';
      b.addEventListener('click', SrcPanel.open);
      tb.appendChild(b);
    }
    this.render();
    window.addEventListener('online', function(){ Net.render(); });
    window.addEventListener('offline', function(){ Net.render(); });
  }
};

/* ---------------- 6. WHAT-CHANGED ENGINE ----------------
   Browser-local snapshots; compares newest vs previous bundle. */
const Hist={
  KEY:'finsuite_hist_v1',
  all:function(){ try{ return JSON.parse(localStorage.getItem(this.KEY)||'{}'); }catch(e){ return {}; } },
  get:function(sym){ return this.all()[String(sym).toUpperCase()]||null; },
  /* save only when the bundle date is newer — no duplicate snapshots */
  save:function(sym, snap){
    sym=String(sym).toUpperCase();
    var h=this.all(), prev=h[sym]||{};
    if(prev.asof && snap.asof && prev.asof>=snap.asof) return prev;
    var merged={};
    ['asof','price','target','upside','ar','net','flip','callwall','putwall','maxpain','iv30','callprem','putprem'].forEach(function(k){
      merged[k]=(snap[k]!=null&&snap[k]!==''&&!(typeof snap[k]==='number'&&isNaN(snap[k])))?snap[k]:prev[k];
    });
    h[sym]=merged;
    try{ localStorage.setItem(this.KEY, JSON.stringify(h)); }catch(e){}
    return merged;
  }
};
const WC={
  fmt$:function(v){ return v==null?'—':'$'+Number(v).toFixed(2); },
  rows:function(sym){
    var cur=this._cur[sym]; if(!cur) return null;
    var prev=cur.prev; if(!prev||!prev.asof||prev.asof===cur.asof) return [];
    function numRow(label, pk, ck, fmt, invert){
      var a=prev[pk], b=cur[ck==null?pk:ck];
      if(a==null||b==null) return null;
      var d=b-a, up=d>0, flat=d===0;
      return {label:label, prev:fmt(a), cur:fmt(b), chg:(flat?'unchanged':(up?'+':'')+fmt(d).replace('$','$')), pct:(a!==0&&typeof a==='number'&&typeof b==='number')?(d/Math.abs(a)*100):null, dir:flat?'flat':(up!==!!invert?'up':'down')};
    }
    var out=[];
    var pr=numRow('Price','price',null,WC.fmt$); if(pr) out.push(pr);
    var gx=numRow('Net GEX ($B / 1%)','net',null,function(v){return (v>=0?'+':'')+Number(v).toFixed(2);}); if(gx) out.push(gx);
    ['flip|Gamma Flip','callwall|Call Wall (γ)','putwall|Put Wall (γ)','maxpain|Max Pain'].forEach(function(x){
      var p=x.split('|'), r=numRow(p[1],p[0],null,WC.fmt$); if(r) out.push(r);
    });
    var iv=numRow('IV30','iv30',null,function(v){return Number(v).toFixed(1)+'%';}); if(iv) out.push(iv);
    var tg=numRow('Mean Target','target',null,WC.fmt$); if(tg) out.push(tg);
    return out;
  },
  panel:function(sym, curSnap){
    /* Read the previously saved snapshot, render the comparison, THEN save
       the current one. Saving first would overwrite prev and the comparison
       could never show changes. */
    sym=String(sym).toUpperCase();
    var prev=Hist.get(sym);
    this._cur=this._cur||{};
    this._cur[sym]={asof:curSnap.asof, prev:prev, price:curSnap.price, target:curSnap.target,
      upside:curSnap.upside, net:curSnap.net, flip:curSnap.flip, callwall:curSnap.callwall,
      putwall:curSnap.putwall, maxpain:curSnap.maxpain, iv30:curSnap.iv30};
    var rows=this.rows(sym);
    var h='<div class="panel" style="margin-top:14px"><h3><span class="ico">'+icon('file_text')+'</span> What Changed</h3>';
    if(!prev||!prev.asof){
      h+=emptyState('No previous snapshot available yet.',
        'This compares the current bundle against the last one you viewed. Visit this page again after the next data refresh and changes will appear here. Nothing is estimated in the meantime.');
    } else if(prev.asof===curSnap.asof){
      h+='<p class="small hint">Snapshot '+Util.esc(curSnap.asof)+' matches your saved snapshot — no newer bundle viewed yet.</p>';
    } else if(!rows.length){
      h+='<p class="small hint">Previous snapshot '+Util.esc(prev.asof)+' found, but no comparable metrics overlapped.</p>';
    } else {
      h+='<p class="small hint">Current bundle '+Util.esc(curSnap.asof)+' vs your saved snapshot '+Util.esc(prev.asof)+'.</p>'
        +'<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Metric</th><th>Then ('+Util.esc(prev.asof)+')</th><th>Now</th><th>Change</th></tr></thead><tbody>'
        +rows.map(function(r){
          var col=r.dir==='flat'?'#8b949e':(r.dir==='up'?'#3fb950':'#f85149');
          return '<tr><td><b>'+Util.esc(r.label)+'</b></td><td class="mono">'+Util.esc(r.prev)+'</td><td class="mono"><b>'+Util.esc(r.cur)+'</b></td>'
            +'<td class="mono" style="color:'+col+'">'+(r.dir==='flat'?'—':Util.esc(r.chg)+(r.pct!=null?' ('+(r.pct>=0?'+':'')+r.pct.toFixed(1)+'%)':''))+'</td></tr>';
        }).join('')+'</tbody></table></div>';
    }
    Hist.save(sym, curSnap); /* save after rendering, so next visit can compare */
    return h+'</div>';
  }
};

/* ---------------- 7. COMMAND PALETTE EXTENSIONS ---------------- */
(function(){
  if(typeof cmdkItems==='undefined') return;
  const _orig=cmdkItems;
  cmdkItems=function(q){
    var items=_orig(q);
    q=(q||'').trim();
    var m=q.match(/^([a-z][a-z0-9.]{0,6})\s+(options?|gamma|gex|valuation|value|news|screener|scanner|research|company|terminal)$/i);
    if(m){
      var tm=m[1].toUpperCase(), kind=m[2].toLowerCase(), extra=[];
      function go(hash){ return function(){ Router.go(hash); }; }
      if(/^(options|gamma|gex)$/.test(kind)) extra.push({sec:'Ticker',icon:'chart_column',label:tm+' — Gamma Exposure',hint:'options analytics',run:go('#/gamma/'+tm)});
      else if(/^screener|scanner$/.test(kind)) extra.push({sec:'Ticker',icon:'zap',label:tm+' — Scanner detail',hint:'seasonality & scores',run:go('#/scanner/'+tm)});
      else if(/^valuation|value$/.test(kind)) extra.push({sec:'Ticker',icon:'scale',label:tm+' — Valuation Workbench',hint:'DCF & multiples',run:go('#/valuation')});
      else if(/^news$/.test(kind)) extra.push({sec:'Ticker',icon:'newspaper',label:tm+' — News',hint:'company news',run:go('#/news')});
      else if(/^research|company$/.test(kind)) extra.push({sec:'Ticker',icon:'microscope',label:tm+' — Research Mode',hint:'workspace',run:go('#/rmode/'+tm)});
      else if(/^terminal$/.test(kind)) extra.push({sec:'Ticker',icon:'zap',label:tm+' — Terminal',hint:'workspace',run:go('#/terminal')});
      items=extra.concat(items);
    }
    if(q){
      var ql=q.toLowerCase();
      if('terminal'.indexOf(ql)===0||'workspace'.indexOf(ql)===0)
        items.unshift({sec:'Go to',icon:'zap',label:'Terminal',hint:'widget workspaces',run:function(){ Router.go('#/terminal'); }});
    }
    return items;
  };
})();

/* ---------------- 8. g-SEQUENCE SHORTCUTS ---------------- */
(function(){
  var pending=0, hintEl=null;
  function hint(on){
    if(on&&!hintEl){ hintEl=document.createElement('div'); hintEl.id='g-hint'; hintEl.textContent='g…'; document.body.appendChild(hintEl); }
    if(!on&&hintEl){ hintEl.remove(); hintEl=null; }
  }
  var MAP={g:'#/gamma',s:'#/scanner',n:'#/news',m:'#/markets',p:'#/portlab',c:'#/deepdive',w:'#/watchlist',t:'#/terminal',h:'#/home',r:'#/research'};
  document.addEventListener('keydown', function(e){
    if(uxInField()||e.ctrlKey||e.metaKey||e.altKey) return;
    var now=Date.now();
    if(pending&&now-pending>900){ pending=0; hint(false); }
    var k=(e.key||'').toLowerCase();
    if(!pending){
      if(k==='g'&&!e.repeat){ pending=now; hint(true); }
      return;
    }
    pending=0; hint(false);
    if(MAP[k]){ e.preventDefault(); Router.go(MAP[k]); }
  });
})();

/* ---------------- 9. TERMINAL WORKSPACES ---------------- */
const TW={
  presets:{
    RESEARCH:['news','picks','watch','gex'],
    TRADING:['quotes','watch','crypto','heat'],
    OPTIONS:['gex','quotes','picks','news'],
    MACRO:['news','crypto','heat','quotes'],
    PORTFOLIO:['port','watch','quotes','news']
  },
  state:function(){
    Store.load();
    if(!Store.db.tw) Store.db.tw={active:'RESEARCH', layouts:{}};
    return Store.db.tw;
  },
  layout:function(name){
    var st=this.state();
    if(!st.layouts[name]) st.layouts[name]=this.presets[name].map(function(id){ return {id:id,size:'M',hidden:false}; });
    return st.layouts[name];
  },
  save:function(){ Store.save(); },
  defs:{
    quotes:{t:'Live Quotes', src:'Finnhub / Alpha Vantage · key in your browser', render:function(){
      return '<div class="tw-live" data-twq="SPY,QQQ,DIA,AAPL,MSFT,NVDA"><span class="small hint">Loading…</span></div>'; }},
    watch:{t:'Watchlist', src:'Your saved tickers · bundled prices', render:function(){
      Store.load(); var wl=(Store.db.watchlist||[]).slice(0,8);
      if(!wl.length) return emptyState('Watchlist is empty.','Add tickers from any page or with Ctrl+K → "Add X to watchlist".');
      return '<table class="tbl">'+wl.map(function(s){
        var px=null;
        if(typeof dGet!=='undefined'){ var d=dGet(s); if(d) px=d.price; }
        if(px==null&&typeof RealData!=='undefined'){ var b=(RealData.prices||{})[s]; if(b&&b.length) px=b[b.length-1].c; }
        return '<tr><td><a href="#/scanner/'+Util.esc(s)+'"><b>'+Util.esc(s)+'</b></a></td><td class="num mono">'+(px==null?'—':'$'+Number(px).toFixed(2))+'</td></tr>';
      }).join('')+'</table>'; }},
    news:{t:'Market News', src:'TickerTick · polled', render:function(){
      return '<div class="tw-live" data-twn="1"><span class="small hint">Loading headlines…</span></div>'; }},
    picks:{t:'Scanner Top Picks', src:'Bundled discovery snapshot', render:function(){
      if(typeof dStocks==='undefined'||typeof dScoreFor==='undefined') return emptyState('Scanner data unavailable.','The discovery bundle is not in this file. Rebuild with discovery data.');
      var rows=dStocks().map(function(s){ return {s:s,sc:dScoreFor('wheel',s).score}; })
        .sort(function(a,b){ return b.sc-a.sc; }).slice(0,6);
      if(!rows.length) return emptyState('No scanner rows.','Discovery bundle present but empty.');
      return '<table class="tbl">'+rows.map(function(r){
        return '<tr><td><a href="#/scanner/'+Util.esc(r.s.sym)+'"><b>'+Util.esc(r.s.sym)+'</b></a></td><td class="small dim">'+Util.esc(r.s.name||'').slice(0,22)+'</td><td class="num"><b>'+r.sc+'</b></td></tr>';
      }).join('')+'</table>'; }},
    gex:{t:'GEX Leaders', src:'CBOE delayed · bundled', render:function(){
      if(typeof dRaw==='undefined') return emptyState('Options data unavailable.','No discovery bundle in this file.');
      var r=dRaw(); if(!r||!r.opt) return emptyState('Options data unavailable.','The required options chain could not be retrieved.', r&&r.asof);
      var rows=Object.keys(r.opt).map(function(s){ return {s:s,o:r.opt[s]}; })
        .sort(function(a,b){ return Math.abs(b.o.net)-Math.abs(a.o.net); }).slice(0,6);
      return '<table class="tbl"><thead><tr><th></th><th class="num">Net GEX $M/1%</th><th class="num">Flip</th></tr></thead>'+
        rows.map(function(x){
          var m=x.o.net*1000;
          return '<tr><td><a href="#/gamma/'+Util.esc(x.s)+'"><b>'+Util.esc(x.s)+'</b></a></td><td class="num mono" style="color:'+(m>=0?'#3fb950':'#f85149')+'">'+(m>=0?'+':'')+m.toFixed(1)+'</td><td class="num mono">'+(x.o.flip?'$'+x.o.flip.toFixed(0):'—')+'</td></tr>';
        }).join('')+'</table>'; }},
    crypto:{t:'Crypto', src:'CoinGecko · no key', render:function(){
      return '<div class="tw-live" data-twc="1"><span class="small hint">Loading…</span></div>'; }},
    port:{t:'Portfolio Snapshot', src:'Your saved holdings · this browser', render:function(){
      Store.load(); var hs=Store.db.holdings||[];
      if(!hs.length) return emptyState('No holdings saved.','Add positions in the Holdings Analyzer to see a snapshot here.');
      var n=hs.length, val=0, known=0;
      hs.forEach(function(hh){
        var q=Number(hh.qty||0), px=null;
        if(typeof dGet!=='undefined'){ var d=dGet(hh.sym||hh.ticker); if(d) px=d.price; }
        if(px!=null){ val+=q*px; known++; }
      });
      return '<div class="tw-kpis"><div><span>'+n+'</span>positions</div><div><span>'+(known?('$'+val.toLocaleString(undefined,{maximumFractionDigits:0})):'—')+'</span>'+(known?'est. value (bundled px)':'value needs prices')+'</div></div>'
        +'<p style="margin-top:8px"><a class="btn sm ghost" href="#/holdings">Open Holdings Analyzer</a></p>'; }},
    heat:{t:'Market Heatmap', src:'Bundled bars · 1-day', render:function(){
      return (typeof uxHeatmap!=='undefined')?uxHeatmap():emptyState('Heatmap unavailable.','Chart helper not loaded.'); }}
  },
  after:function(){
    var self=this;
    /* live widgets */
    document.querySelectorAll('[data-twq]').forEach(function(el){
      var syms=el.getAttribute('data-twq').split(',');
      if(typeof LiveQuotes==='undefined'||!LiveQuotes.provider()){
        el.innerHTML='<span class="small hint">No API key — <a href="#/settings">add a free key in Settings</a> for live quotes.</span>'; return;
      }
      LiveQuotes.get(syms).then(function(res){
        el.innerHTML=syms.map(function(s){ return LiveQuotes.row(s,res[s]); }).join('');
      });
    });
    document.querySelectorAll('[data-twn]').forEach(function(el){
      fetch('https://api.tickertick.com/feed?n=12',{cache:'no-store'}).then(function(r){ return r.json(); })
        .then(function(j){
          var items=(j&&j.items)||[];
          if(!items.length){ el.innerHTML='<span class="small hint">No headlines right now.</span>'; return; }
          el.innerHTML='<ul class="tw-news">'+items.slice(0,8).map(function(it){
            var u=(it.u||it.url||'#');
            return '<li><a href="'+Util.esc(u)+'" target="_blank" rel="noopener">'+Util.esc(it.t||it.title||'(untitled)')+'</a> <span class="small dim">'+Util.esc(it.s||it.source||'')+'</span></li>';
          }).join('')+'</ul>';
        }).catch(function(){ el.innerHTML='<span class="small hint">News feed unreachable — you may be offline.</span>'; });
    });
    document.querySelectorAll('[data-twc]').forEach(function(el){
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true',{cache:'no-store'})
        .then(function(r){ return r.json(); }).then(function(j){
          el.innerHTML=[['bitcoin','BTC'],['ethereum','ETH'],['solana','SOL']].map(function(x){
            var d=j[x[0]]||{}, ch=d.usd_24h_change||0, up=ch>=0;
            return '<div class="lq-row"><b>'+x[1]+'</b><span class="mono">$'+Number(d.usd||0).toLocaleString(undefined,{maximumFractionDigits:0})+'</span><span class="mono" style="color:var(--'+(up?'green':'red')+')">'+(up?'+':'')+ch.toFixed(1)+'%</span></div>';
          }).join('');
        }).catch(function(){ el.innerHTML='<span class="small hint">CoinGecko unreachable — you may be offline.</span>'; });
    });
    /* drag reorder */
    var dragIx=null;
    document.querySelectorAll('.tw-card').forEach(function(card){
      var hd=card.querySelector('.tw-head');
      hd.setAttribute('draggable','true');
      hd.addEventListener('dragstart', function(e){ dragIx=parseInt(card.getAttribute('data-ix'),10); e.dataTransfer.effectAllowed='move'; });
      card.addEventListener('dragover', function(e){ e.preventDefault(); card.classList.add('tw-drop'); });
      card.addEventListener('dragleave', function(){ card.classList.remove('tw-drop'); });
      card.addEventListener('drop', function(e){
        e.preventDefault(); card.classList.remove('tw-drop');
        var to=parseInt(card.getAttribute('data-ix'),10);
        if(dragIx==null||dragIx===to) return;
        var L=TW.layout(TW.state().active), it=L.splice(dragIx,1)[0];
        L.splice(to,0,it); TW.save(); Router.render();
      });
    });
    document.querySelectorAll('[data-tw-size]').forEach(function(b){
      b.addEventListener('click', function(){
        var L=TW.layout(TW.state().active), it=L[parseInt(b.getAttribute('data-tw-size'),10)];
        it.size=it.size==='S'?'M':(it.size==='M'?'L':'S'); TW.save(); Router.render();
      });
    });
    document.querySelectorAll('[data-tw-hide]').forEach(function(b){
      b.addEventListener('click', function(){
        var L=TW.layout(TW.state().active); L[parseInt(b.getAttribute('data-tw-hide'),10)].hidden=true; TW.save(); Router.render();
      });
    });
    document.querySelectorAll('[data-tw-show]').forEach(function(b){
      b.addEventListener('click', function(){
        var L=TW.layout(TW.state().active); L[parseInt(b.getAttribute('data-tw-show'),10)].hidden=false; TW.save(); Router.render();
      });
    });
    document.querySelectorAll('[data-tw-tab]').forEach(function(b){
      b.addEventListener('click', function(){
        TW.state().active=b.getAttribute('data-tw-tab'); TW.save(); Router.render();
      });
    });
    var rs=document.getElementById('tw-reset');
    if(rs) rs.addEventListener('click', function(){
      var st=TW.state(); delete st.layouts[st.active]; TW.save(); Router.render();
    });
  },
  html:function(){
    var st=this.state(), active=st.active, L=this.layout(active);
    var h='<div class="panel"><h2><span class="ico">'+icon('zap')+'</span> Terminal</h2>'
      +'<p class="hint">Widget workspaces. Drag a panel by its header to reorder · <b>S/M/L</b> resizes · hide and re-add anytime. Layouts live only in this browser.</p>'
      +'<div class="tw-tabs">'+Object.keys(this.presets).map(function(p){
          return '<button class="btn sm'+(p===active?'':' ghost')+'" data-tw-tab="'+p+'">'+p+'</button>';
        }).join('')
        +'<button class="btn sm ghost" id="tw-reset" style="margin-left:auto" title="Reset this workspace to its preset">Reset</button></div>';
    var hidden=L.map(function(w,i){ return {w:w,i:i}; }).filter(function(x){ return x.w.hidden; });
    if(hidden.length){
      h+='<div class="small hint" style="margin:8px 0">Hidden: '+hidden.map(function(x){
        return '<button class="btn sm ghost" data-tw-show="'+x.i+'">+ '+Util.esc(TW.defs[x.w.id]?TW.defs[x.w.id].t:x.w.id)+'</button>';
      }).join(' ')+'</div>';
    }
    h+='</div><div class="tw-grid">';
    L.forEach(function(w,i){
      if(w.hidden) return;
      var def=TW.defs[w.id]; if(!def) return;
      var span=w.size==='S'?'tw-s4':(w.size==='L'?'tw-s12':'tw-s6');
      h+='<div class="tw-card '+span+'" data-ix="'+i+'">'
        +'<div class="tw-head"><span class="tw-grip" title="Drag to reorder">⠿</span><b>'+Util.esc(def.t)+'</b>'
        +'<span class="tw-ctl"><button class="btn sm ghost" data-tw-size="'+i+'" title="Cycle size S/M/L">'+w.size+'</button>'
        +'<button class="btn sm ghost" data-tw-hide="'+i+'" title="Hide panel">–</button></span></div>'
        +'<div class="small hint" style="margin-bottom:6px">'+Util.esc(def.src)+'</div>'
        +'<div class="tw-body">'+def.render()+'</div></div>';
    });
    return h+'</div>';
  }
};
Router.routes['terminal']=function(){ return TW.html(); };
Router.routes['terminal'].after=function(){ TW.after(); };
(function(){
  var ix=NAV.findIndex(function(n){ return n.id==='home'; });
  NAV.splice(ix<0?0:ix+1,0,{id:'terminal', title:'Terminal', icon:'zap', crumb:'suite / terminal'});
})();

/* Esc also closes drawers */
document.addEventListener('keydown', function(e){
  if(e.key==='Escape'){ Minfo.close(); SrcPanel.close(); }
});

/* init topbar extras after boot */
(function(){
  function init(){ Net.init(); CoreFresh.init(); }
  if(document.readyState==='complete') init();
  else window.addEventListener('load', init);
  setTimeout(init, 1500);
})();

/* ---------------- CORE DATA freshness chip ----------------
   Shows when the bundled (DAILY, not live) dataset was rebuilt.
   Reads window.__DISCOVERY__.meta written by the daily collector. */
var CoreFresh={
  render:function(){
    var el=document.getElementById('corefresh'); if(!el) return;
    var m=null; try{ m=((typeof dRaw==='function'?dRaw():null)||{}).meta||null; }catch(e){ m=null; }
    if(!m||!m.asof){ el.style.display='none'; return; }
    el.style.display='';
    var ds=m.datasets||{};
    var optSt=(ds.options||{}).status||'?', stkSt=(ds.stocks||{}).status||'?';
    var stale=(optSt==='stale'||optSt==='partial');
    var label='CORE DATA · '+m.asof+(stale?' · options '+optSt:'');
    el.innerHTML='<span class="dot"></span>'+label;
    el.className='corefresh'+(stale?' stale':'');
    el.title='Bundled market data (DAILY — not live). Rebuilt '+(m.collectedAt||m.asof)+
      '. Stocks: '+stkSt+' ('+((ds.stocks||{}).recordCount||'?')+'), options: '+optSt+
      ' ('+((ds.options||{}).recordCount||'?')+'). Live layers (news, quotes) update on their own.';
  },
  init:function(){
    var tb=document.getElementById('topbar'); if(!tb) return;
    if(!document.getElementById('corefresh')){
      var c=document.createElement('span'); c.id='corefresh'; c.className='corefresh';
      tb.appendChild(c);
    }
    this.render();
  }
};
