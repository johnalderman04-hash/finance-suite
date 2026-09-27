/* ================================================================
   FINANCE SUITE — 01-overview.js
   Routes: home, markets, holdings, news, watchlist.
   Uses globals from 00-core.js only. Adds EX explainer entries and
   Router.routes entries. No <script> tags. Fully offline (bundled data).
   ================================================================ */

/* ---------------- explainers used by this chunk ---------------- */
(function ovExplain(){
  EX.add('allocation','Allocation',
    'How your money is split across your holdings, shown as each position\'s share of total portfolio value.',
    'Allocation is what actually decides your risk and return — a 50% position moves your portfolio far more than a 2% one.',
    'No single "right" mix exists; the flag here is concentration risk, e.g. one stock above 25%.');
  EX.add('concentration','Concentration',
    'How much of your portfolio sits in your largest position (top holding %) and your three largest combined (top-3 %).',
    'Concentration is the fastest way to win big or lose big — a few large positions dominate everything else you own.',
    'Lower concentration means steadier results; very high concentration is a bet, not a portfolio.');
  EX.add('costbasis','Average cost',
    'Your average purchase price per share, including every buy of that holding.',
    'Gain/loss is measured against this number — it is the only fair benchmark for "am I up or down?"',
    'A falling average cost can mean you bought dips; a rising one can mean you chased. Neither is good or bad alone.');
  EX.add('sparkline','Sparkline',
    'A tiny chart of the last 60 daily closing prices — the recent trend at a glance.',
    'It answers "which way has this been drifting?" faster than reading a column of numbers.',
    'Up-and-to-the-right is a recent uptrend; choppy or falling shows recent weakness. It says nothing about tomorrow.');
  EX.add('fundvalue','Paper fund value',
    'Your paper fund\'s total value: cash on hand plus every open position valued at the latest close (or your manual price override).',
    'It is the scoreboard for your practice trading — one number that captures all your decisions.',
    'Above your $100,000 starting cash means the strategy is ahead; below means it is behind. It is practice money, so losses are tuition.');
})();

/* ---------------- shared helpers (ov- prefix) ---------------- */
function ovEnsure(){ if(!Store.db) Store.load(); }
function ovBars(t){ return (RealData.prices||{})[t]||[]; }
function ovCloses(t){ return ovBars(t).map(b=>b.c); }
function ovCloseBack(t, back){
  const b=ovBars(t); if(!b.length) return null;
  const i=b.length-1-back; return i<0?null:b[i].c;
}
/* % change between the latest close and `back` trading days earlier */
function ovChg(t, back){
  const now=ovCloseBack(t,0), then=ovCloseBack(t,back);
  if(now==null||then==null||then===0) return null;
  return (now-then)/then;
}
function ovChgBadge(x){
  if(x==null||isNaN(x)) return '<span class="badge b-neutral">data unavailable</span>';
  return '<span class="badge '+(x>=0?'b-ok':'b-bad')+'">'+Util.pct(x,1)+'</span>';
}
function ovPriceCell(t){
  const p=lastClose(t);
  return p==null?'<span class="badge b-neutral">data unavailable</span>':'<span class="mono">$'+Util.num(p,2)+'</span>';
}
var OV_SECTORS=['Energy','Materials','Industrials','Consumer Discretionary','Consumer Staples',
  'Health Care','Financials','Information Technology','Communication Services','Utilities','Real Estate'];
function ovWatchList(){
  ovEnsure();
  if(!Store.db.watchlist.length){ Store.db.watchlist=STOCK_TICKERS.slice(); Store.save(); }
  return Store.db.watchlist;
}

/* ---------------- route: home ---------------- */
function ovHome(){
  ovEnsure();
  const wl=Store.db.watchlist.length?Store.db.watchlist:STOCK_TICKERS.slice();
  const h=new Date().getHours();
  const greet=h<12?'Good morning':(h<18?'Good afternoon':'Good evening');
  const syms=['SPY','QQQ','AAPL','NVDA','MSFT','TSLA'];
  const rows=syms.map(function(t){
    const c=lastClose(t);
    return '<tr><td class="mono"><b>'+Util.esc(t)+'</b></td><td class="num">'+(c==null?'—':'$'+Util.num(c,2))+'</td>'+
      '<td class="num">'+ovChgBadge(ovChg(t,1))+'</td>'+
      '<td class="num">'+ovChgBadge(ovChg(t,21))+'</td>'+
      '<td class="num">'+ovChgBadge(ovChg(t,252))+'</td></tr>';
  }).join('');
  return ''+
  '<div class="panel">'+
    '<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">'+
      '<div style="font-size:44px;line-height:1">🐦‍⬛</div>'+
      '<div><h2 style="margin:0">'+greet+' — your suite at a glance</h2>'+
      '<div class="small hint">Crow logo placeholder — swap this mark for your own brand. Nothing on this page needs the internet: every number below comes from the bundled data pack.</div></div>'+
    '</div>'+
    '<div style="margin-top:10px">'+DATA_BADGE+'</div>'+
  '</div>'+
  '<div class="grid g4">'+
    '<div class="kpi"><div class="k">Bundled tickers</div>'+
      '<div class="v">'+STOCK_TICKERS.length+'</div>'+
      '<div class="d">with SEC + price data</div></div>'+
    '<div class="kpi"><div class="k">Open theses</div>'+
      '<div class="v">'+Store.db.theses.length+'</div>'+
      '<div class="d"><a href="#/theses">Track an investment thesis</a></div></div>'+
    '<div class="kpi"><div class="k">Watchlist</div>'+
      '<div class="v">'+wl.length+'</div>'+
      '<div class="d"><a href="#/watchlist">Manage watchlist</a></div></div>'+
    '<div class="kpi"><div class="k">Congress filings tracked</div>'+
      '<div class="v">'+Store.db.congress.length+'</div>'+
      '<div class="d"><a href="#/congress">View Congress trading</a></div></div>'+
  '</div>'+
  '<div class="panel"><h3>Market snapshot</h3>'+
    '<div class="small hint">Last close and % changes computed from the bundled daily bars (2024-09-25 → 2026-09-25). 1-mo ≈ 21 trading days, 1-yr ≈ 252 trading days.</div>'+
    '<table class="tbl"><thead><tr><th>Symbol</th><th class="num">Last close</th><th class="num">1-day</th><th class="num">1-mo</th><th class="num">1-yr</th></tr></thead>'+
    '<tbody>'+rows+'</tbody></table>'+
    '<div style="margin-top:8px">'+DATA_BADGE+'</div>'+
  '</div>'+
  '<div class="grid g3">'+
    '<div class="panel"><h3>'+'<span class="ico">'+icon('chart_candlestick')+'</span> '+'📈 Markets</h3><p class="small">Offline chart viewer for every bundled ticker, plus SPY &amp; QQQ candles.</p><a class="btn ghost sm" href="#/markets">Open Markets</a></div>'+
    '<div class="panel"><h3>'+'<span class="ico">'+icon('briefcase')+'</span> '+'🧺 Holdings Analyzer</h3><p class="small">Add your positions, tag sectors, and check allocation and concentration risk.</p><a class="btn ghost sm" href="#/holdings">Open Analyzer</a></div>'+
    '<div class="panel"><h3>'+'<span class="ico">'+icon('newspaper')+'</span> '+'📰 Market News</h3><p class="small">Live news lives on the open web — quick links to market news front pages.</p><a class="btn ghost sm" href="#/news">Open Links</a></div>'+
    '<div class="panel"><h3>'+'<span class="ico">'+icon('eye')+'</span> '+'👀 Watchlist</h3><p class="small">Your tickers with last close, 1d/1w/1mo/1y moves, and 60-day sparklines.</p><a class="btn ghost sm" href="#/watchlist">Open Watchlist</a></div>'+
    '<div class="panel"><h3>'+'<span class="ico">'+icon('microscope')+'</span> '+'🔬 Research Terminal</h3><p class="small">Deep-dive any ticker: price history, fundamentals, and valuation.</p><a class="btn ghost sm" href="#/research">Open Research</a></div>'+
  '</div>';
}
Router.routes['home']=ovHome;

/* ---------------- route: markets ---------------- */
function ovMarkets(){
  ovEnsure();
  return ''+
  '<div class="panel"><h3>Live chart <span class="tag">needs internet</span></h3>'+
    '<div class="frow" style="max-width:340px"><label class="f">TradingView symbol</label>'+
    '<div style="display:flex;gap:8px"><input class="in" id="ov-tv-sym" value="SPY"><button class="btn sm" id="ov-tv-go">Load</button></div>'+
    '<div class="hint">Examples: SPY, AAPL, NVDA, TSLA</div></div>'+
    '<div class="tv-wrap"><div id="ov-tv-box" style="height:480px;background:#0d1117;border-radius:8px"></div></div>'+
    '<div id="ov-tv-box-note" class="small hint" style="margin-top:6px">Loading TradingView\u2026 if you are offline, a bundled-data chart appears instead.</div>'+
    '<div class="rule-note">This TradingView embed is the only network call on this page — everything else works fully offline. Add a free API key in Settings for optional live quotes.</div>'
    +'<div class="panel"><h3>Live quotes <span class="tag">optional</span></h3>'
    +'<div id="ov-lq" class="small hint">Checking for an API key\u2026</div>'
    +'<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">'
    +'<button class="btn sm ghost" id="ov-lq-refresh">Refresh</button>'
    +'<a class="btn sm ghost" href="#/settings">Add API key</a></div>'
    +'<div id="ov-lq-note" class="small hint" style="margin-top:6px"></div></div>'+
    '<div class="panel"><h3>Crypto <span class="tag">free \u00b7 no key</span></h3>'
    +'<div id="ov-lq-crypto" class="small hint">Loading crypto prices\u2026</div>'
    +'<div class="small hint" style="margin-top:6px">CoinGecko free API \u2014 fetched when you open this page, no key needed.</div></div>'+
  '</div>'+
  '<div class="panel"><h3>Chart viewer (offline)</h3>'+
    '<div class="small hint">Offline charts drawn from the bundled daily bars (2024-09-25 → 2026-09-25). No network calls on this page.</div>'+
    '<div class="frow"><label class="f">Symbol</label>'+
      '<select class="in" id="ov-m-sym" style="max-width:220px"></select> '+
      '<span style="display:inline-flex;gap:6px;flex-wrap:wrap">'+
        '<button class="btn sm ghost" data-ov-span="63">3M</button>'+
        '<button class="btn sm ghost" data-ov-span="126">6M</button>'+
        '<button class="btn sm" data-ov-span="252">1Y</button>'+
        '<button class="btn sm ghost" data-ov-span="0">Max</button>'+
      '</span>'+
    '</div>'+
    '<div id="ov-m-chart" class="lw-chart" style="height:340px"></div>'+
    '<div style="margin-top:8px">'+DATA_BADGE+'</div>'+
  '</div>'+uxHeatmap()+
  '<div class="panel"><h3>SPY — S&P 500 ETF</h3>'+
    '<div id="ov-spy" class="lw-chart" style="height:280px"></div>'+
    '<div style="margin-top:8px">'+DATA_BADGE+'</div></div>'+
  '<div class="panel"><h3>QQQ — Nasdaq-100 ETF</h3>'+
    '<div id="ov-qqq" class="lw-chart" style="height:280px"></div>'+
    '<div style="margin-top:8px">'+DATA_BADGE+'</div></div>';
}
function ovMarketsAfter(){
  /* --- live quotes (optional API key; 60s cache) --- */
  (function(){
    var box=document.getElementById('ov-lq'); if(!box) return;
    var syms=['SPY','QQQ','DIA','AAPL','MSFT','NVDA','TSLA','META','AMZN','AMD','SOFI'];
    function draw(force){
      box.innerHTML='<span class="small hint">Fetching\u2026</span>';
      LiveQuotes.get(syms, force).then(function(res){
        var prov=LiveQuotes.provider(), note=document.getElementById('ov-lq-note');
        if(!prov){
          box.innerHTML='<span class="small hint">No API key set \u2014 the charts below use the bundled 2026-09-25 snapshot. <a href="#/settings">Add a free key in Settings</a> for live quotes.</span>';
          if(note) note.textContent='';
          return;
        }
        box.innerHTML=syms.map(function(s){ return LiveQuotes.row(s,res[s]); }).join('');
        var qs=syms.map(function(s){ return res[s]; }).filter(function(r){ return r.ok; }).map(function(r){ return r.q; });
        if(note) note.innerHTML=qs.length?LiveQuotes.badge({t:Math.max.apply(null,qs.map(function(q){ return q.t; })),src:qs[0].src}):'<span class="small hint">Could not reach the provider.</span>';
      }).catch(function(e){
        box.innerHTML='<span class="small hint">Live quotes failed: '+Util.esc(String((e&&e.message)||e).slice(0,120))+'</span>';
      });
    }
    var rf=document.getElementById('ov-lq-refresh');
    if(rf) rf.addEventListener('click',function(){ draw(true); });
    draw(false);
  })();
  /* --- crypto quotes (CoinGecko free API, no key, open CORS) --- */
  (function(){
    var box=document.getElementById('ov-lq-crypto'); if(!box) return;
    var ids=[['bitcoin','BTC'],['ethereum','ETH'],['solana','SOL']];
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true',{cache:'no-store'})
      .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(function(j){
        box.innerHTML=ids.map(function(pair){
          var d=j[pair[0]];
          if(!d) return '';
          var chg=d.usd_24h_change||0, up=chg>=0;
          return '<div class="lq-row"><b>'+pair[1]+'</b>'
            +'<span class="mono">$'+Util.num(d.usd, d.usd<10?3:2)+'</span>'
            +'<span class="mono" style="color:var(--'+(up?'green':'red')+')">'+(up?'+':'')+chg.toFixed(2)+'% (24h)</span>'
            +'<span class="tag '+(up?'b-ok':'b-bad')+'">LIVE</span> <span class="small hint">CoinGecko</span></div>';
        }).join('');
      })
      .catch(function(){ box.innerHTML='<span class="small hint">Crypto quotes unavailable right now.</span>'; });
  })();
  /* --- TradingView embed (dark) with offline fallback --- */
  (function(){
    const box=document.getElementById('ov-tv-box'); if(!box||box.dataset.tv) return; box.dataset.tv='1';
    let sym='SPY';
    function draw(){ tvEmbedAfter('ov-tv-box', sym, ovBars(sym)); }
    draw();
    const go=document.getElementById('ov-tv-go');
    if(go) go.addEventListener('click',function(){
      sym=document.getElementById('ov-tv-sym').value.trim().toUpperCase()||'SPY';
      box.innerHTML=''; draw();
    });
  })();
  /* --- offline chart viewer (Lightweight Charts, bundled bars) --- */
  (function(){
    const sel=document.getElementById('ov-m-sym'); if(!sel||sel.dataset.wired) return; sel.dataset.wired='1';
    const syms=Object.keys(RealData.prices||{}).filter(function(t){ return (RealData.prices[t]||[]).length>20; }).sort();
    sel.innerHTML=syms.map(function(t){ return '<option value="'+Util.esc(t)+'"'+(t==='SPY'?' selected':'')+'>'+Util.esc(t)+'</option>'; }).join('');
    let span=252;
    function draw(){
      const t=sel.value||'SPY';
      const bars=ovBars(t);
      lwCandles('ov-m-chart', span?bars.slice(-span):bars, {h:340, volume:true});
    }
    sel.addEventListener('change',draw);
    document.querySelectorAll('[data-ov-span]').forEach(function(b){
      b.addEventListener('click',function(){
        span=parseInt(b.getAttribute('data-ov-span'),10)||0;
        document.querySelectorAll('[data-ov-span]').forEach(function(x){ x.className='btn sm ghost'; });
        b.className='btn sm';
        draw();
      });
    });
    draw();
    lwCandles('ov-spy', ovBars('SPY').slice(-252), {h:280, volume:true});
    lwCandles('ov-qqq', ovBars('QQQ').slice(-252), {h:280, volume:true});
  })();
}
Router.routes['markets']=ovMarkets;
Router.routes['markets'].after=function(){ ovMarketsAfter(); };

/* ---------------- route: holdings ---------------- */
function ovHoldRow(h){
  const t=String(h.ticker||'').toUpperCase();
  const px=lastClose(t);
  const mv=px==null?null:h.shares*px;
  const cost=Number(h.cost);
  const hasCost=!isNaN(cost)&&cost>0&&px!=null;
  const g$=hasCost?(px-cost)*h.shares:null;
  const gpc=hasCost?(px-cost)/cost:null;
  const sectorOpts=OV_SECTORS.map(function(s){
    return '<option value="'+Util.esc(s)+'"'+(h.sector===s?' selected':'')+'>'+Util.esc(s)+'</option>';
  }).join('');
  return '<tr>'+
    '<td class="mono"><b>'+Util.esc(t)+'</b></td>'+
    '<td class="num">'+Util.num(h.shares,4)+'</td>'+
    '<td><select class="in" data-ov-hsector="'+h.id+'" style="min-width:150px">'+sectorOpts+'</select></td>'+
    '<td class="num">'+ovPriceCell(t)+'</td>'+
    '<td class="num">'+(mv==null?'—':Util.money(mv))+'</td>'+
    '<td class="num">'+(isNaN(cost)||!cost?'—':'$'+Util.num(cost,2))+'</td>'+
    '<td class="num">'+(g$==null?'—':'<span class="badge '+(g$>=0?'b-ok':'b-bad')+'">'+(g$>=0?'+':'')+Util.money(g$)+'</span>')+'</td>'+
    '<td class="num">'+(gpc==null?'—':'<span class="badge '+(gpc>=0?'b-ok':'b-bad')+'">'+Util.pct(gpc,1)+'</span>')+'</td>'+
    '<td><button class="btn sm danger" data-ov-hdel="'+h.id+'">Remove</button></td>'+
  '</tr>';
}
function ovHoldings(){
  ovEnsure();
  const hs=Store.db.holdings||[];
  const tickOpts=STOCK_TICKERS.map(function(t){ return '<option value="'+Util.esc(t)+'">'+Util.esc(t)+'</option>'; }).join('');
  const sectorOpts=OV_SECTORS.map(function(s){ return '<option value="'+Util.esc(s)+'">'+Util.esc(s)+'</option>'; }).join('');
  const rows=hs.map(ovHoldRow).join('');
  /* allocation + analysis over holdings that have a bundled price */
  const priced=hs.map(function(h){
    const t=String(h.ticker||'').toUpperCase(), px=lastClose(t);
    return { h:h, t:t, mv:px==null?null:h.shares*px };
  }).filter(function(x){ return x.mv!=null; });
  const total=priced.reduce(function(a,x){ return a+x.mv; },0);
  const ranked=priced.slice().sort(function(a,b){ return b.mv-a.mv; });
  let allocHtml, analysisHtml;
  if(!ranked.length){
    allocHtml=emptyBox('Add holdings with bundled prices to see allocation.');
    analysisHtml=emptyBox('No priced holdings to analyze yet.');
  }else{
    const weights=ranked.map(function(x){ return total?x.mv/total:0; });
    allocHtml=Charts.vbar(ranked.map(function(x){ return x.t; }),ranked.map(function(x){ return x.mv; }),720,220)+
      '<div class="chart-cap">'+ranked.map(function(x,i){ return Util.esc(x.t)+': '+Util.pct(weights[i],1); }).join(' · ')+'</div>'+
      (priced.length<hs.length?'<div class="hint">Custom tickers without bundled prices are excluded from allocation.</div>':'');
    const top1=weights[0]||0, top3=weights.slice(0,3).reduce(function(a,w){ return a+w; },0);
    const flags=ranked.filter(function(x,i){ return weights[i]>0.25; });
    const secW={};
    ranked.forEach(function(x,i){ secW[x.h.sector||'Untagged']=(secW[x.h.sector||'Untagged']||0)+weights[i]; });
    const secRows=Object.keys(secW).sort(function(a,b){ return secW[b]-secW[a]; }).map(function(s){
      return '<tr><td>'+Util.esc(s)+'</td><td class="num">'+Util.pct(secW[s],1)+'</td></tr>';
    }).join('');
    analysisHtml=
      '<div class="grid g3">'+
        '<div class="kpi"><div class="k">'+ex('concentration','Top holding')+'</div><div class="v">'+Util.pct(top1,1)+'</div><div class="d">'+Util.esc(ranked[0].t)+'</div></div>'+
        '<div class="kpi"><div class="k">'+ex('concentration','Top 3 combined')+'</div><div class="v">'+Util.pct(top3,1)+'</div><div class="d">largest three positions</div></div>'+
        '<div class="kpi"><div class="k">Positions</div><div class="v">'+ranked.length+'</div><div class="d">priced holdings</div></div>'+
      '</div>'+
      (flags.length?'<div class="alert warn">⚠ Single-stock concentration: '+flags.map(function(x,i){
          const idx=ranked.indexOf(x);
          return '<b>'+Util.esc(x.t)+'</b> is '+Util.pct(weights[idx],1)+' of your portfolio (over the 25% watch level)';
        }).join('; ')+'.</div>':'<div class="alert ok">No single position exceeds 25% — concentration looks reasonable.</div>')+
      '<h4>Sector weights</h4>'+
      '<table class="tbl"><thead><tr><th>Sector</th><th class="num">Weight</th></tr></thead><tbody>'+secRows+'</tbody></table>'+
      '<div class="hint">Shown against <b>no benchmark</b> — your call. These are simple rule-based checks on your own inputs, not advice.</div>';
  }
  return ''+
  '<div class="panel"><h3>Add a holding</h3>'+
    '<div class="frow"><label class="f">Ticker</label>'+
      '<select class="in" id="ov-h-sym" style="max-width:200px">'+tickOpts+'</select> '+
      textInput('ov-h-custom','','or type a custom ticker')+
      '<div class="hint">Custom tickers are stored as-is; price, value, and gains show "data unavailable" when no bundled data exists.</div></div>'+
    '<div class="grid g3">'+
      '<div>'+fieldRow('Shares',numInput('ov-h-shares','',0.0001),'')+'</div>'+
      '<div>'+fieldRow(ex('costbasis','Avg cost per share ($)'),numInput('ov-h-cost','',0.01),'Optional — needed for gain/loss.')+'</div>'+
      '<div>'+fieldRow('Sector tag','<select class="in" id="ov-h-sector">'+sectorOpts+'</select>','Your own tag for the analysis below.')+'</div>'+
    '</div>'+
    '<button class="btn" id="ov-h-add">Add holding</button>'+
  '</div>'+
  '<div class="panel"><h3>Positions</h3>'+
    (hs.length?'<table class="tbl"><thead><tr><th>Holding</th><th class="num">Shares</th><th>Sector</th><th class="num">Last price</th><th class="num">Market value</th><th class="num">'+ex('costbasis','Avg cost')+'</th><th class="num">Gain/Loss $</th><th class="num">Gain/Loss %</th><th></th></tr></thead>'+
    '<tbody>'+rows+'</tbody></table>':'')+
    (!hs.length?emptyBox('No holdings yet — add your first position above.'):'')+
    '<div style="margin-top:10px">'+DATA_BADGE+'</div>'+
  '</div>'+
  '<div class="panel"><h3>'+ex('allocation','Allocation')+'</h3>'+
    '<div>'+allocHtml+'</div>'+
  '</div>'+
  '<div class="panel"><h3>Exposure analysis <span class="badge b-info">assistive (rule-based)</span></h3>'+
    '<div>'+analysisHtml+'</div>'+
  '</div>'+
  '<div class="panel"><h3>Export</h3>'+
    '<button class="btn ghost" id="ov-h-csv" '+(hs.length?'':'disabled')+'>Export holdings CSV</button>'+
  '</div>';
}
function ovHoldingsAfter(){
  const add=document.getElementById('ov-h-add'); if(!add) return;
  add.addEventListener('click',function(){
    const sel=document.getElementById('ov-h-sym');
    const custom=(document.getElementById('ov-h-custom').value||'').trim().toUpperCase();
    const ticker=custom||sel.value;
    const shares=Number(document.getElementById('ov-h-shares').value);
    const cost=Number(document.getElementById('ov-h-cost').value);
    const sector=document.getElementById('ov-h-sector').value;
    if(!ticker){ alert('Enter a ticker.'); return; }
    if(!shares||shares<=0||isNaN(shares)){ alert('Enter a number of shares greater than zero.'); return; }
    Store.db.holdings.push({ id:Util.uid('h'), ticker:ticker, shares:shares,
      cost:(cost&&cost>0&&!isNaN(cost))?cost:null, sector:sector });
    Store.save();
    Router.render();
  });
  document.querySelectorAll('[data-ov-hdel]').forEach(function(b){
    b.addEventListener('click',function(){
      const id=b.getAttribute('data-ov-hdel');
      Store.db.holdings=Store.db.holdings.filter(function(h){ return h.id!==id; });
      Store.save(); Router.render();
    });
  });
  document.querySelectorAll('[data-ov-hsector]').forEach(function(s){
    s.addEventListener('change',function(){
      const id=s.getAttribute('data-ov-hsector');
      const h=Store.db.holdings.find(function(x){ return x.id===id; });
      if(h){ h.sector=s.value; Store.save(); Router.render(); }
    });
  });
  const csv=document.getElementById('ov-h-csv');
  if(csv&&!csv.disabled){
    csv.addEventListener('click',function(){
      const q=function(v){ return '"'+String(v==null?'':v).replace(/"/g,'""')+'"'; };
      const lines=['ticker,shares,avg_cost,last_price,market_value,gain_loss_dollar,gain_loss_pct,sector'];
      Store.db.holdings.forEach(function(h){
        const t=String(h.ticker||'').toUpperCase(), px=lastClose(t);
        const mv=px==null?null:h.shares*px;
        const cost=Number(h.cost), hasCost=!isNaN(cost)&&cost>0&&px!=null;
        const g$=hasCost?(px-cost)*h.shares:null, gpc=hasCost?(px-cost)/cost:null;
        lines.push([t,h.shares,cost||'',px==null?'':px.toFixed(2),mv==null?'':mv.toFixed(2),
          g$==null?'':g$.toFixed(2),gpc==null?'':(gpc*100).toFixed(2)+'%',h.sector||''].map(q).join(','));
      });
      Util.download('holdings-2026-09-25.csv',lines.join('\n'),'text/csv');
    });
  }
}
ovHoldings.after=ovHoldingsAfter;
Router.routes['holdings']=ovHoldings;

/* ---------------- route: news — live free aggregator ---------------- */
/* Sources verified 2026-09-25 with live CORS tests: only feeds that send
   Access-Control-Allow-Origin are fetched. Everything else is classified
   browser-incompatible (no proxies, per architecture rules). Polls every 4 min. */
var NEWS_FEEDS=[
  {id:'tickertick', label:'TickerTick', kind:'json', url:'https://api.tickertick.com/feed?n=120'},
  {id:'cnbc-top',   label:'CNBC', kind:'rss', url:'https://www.cnbc.com/id/100003114/device/rss/rss.html'},
  {id:'cnbc-econ',  label:'CNBC', kind:'rss', url:'https://www.cnbc.com/id/10000664/device/rss/rss.html'},
  {id:'cnbc-mkt',   label:'CNBC', kind:'rss', url:'https://www.cnbc.com/id/19854910/device/rss/rss.html'},
  {id:'yahoo-top',  label:'Yahoo Finance', kind:'rss', url:'https://finance.yahoo.com/rss/topstories'},
  {id:'yahoo-idx',  label:'Yahoo Finance', kind:'rss', url:'https://finance.yahoo.com/news/rssindex'}
];
var NEWS_INCOMPATIBLE=[
  ['Nasdaq RSS','no CORS headers — browser blocks the response'],
  ['MarketWatch RSS','no CORS headers (feed moved to dowjones.io, still no CORS)'],
  ['WSJ RSS','no CORS headers'],
  ['Seeking Alpha RSS','no CORS headers'],
  ['Benzinga','no CORS headers'],
  ['CoinDesk / CoinTelegraph','no CORS headers'],
  ['Federal Reserve feeds','no CORS headers'],
  ['Google News RSS','no CORS headers'],
  ['ECB / FXStreet / OilPrice','no CORS headers']
];
var News={items:[], srcStat:{}, lastPoll:0, prevStart:0, timer:null, cat:'All', co:'', q:'', secFilings:[], secMsg:'', ttLast:null, ttLastCo:null, moreMsg:''};
function newsTimeAgo(ms){
  if(!ms) return 'time not provided';
  var d=Date.now()-ms;
  if(d<0) d=0;
  var m=Math.floor(d/60000);
  if(m<1) return 'just now';
  if(m<60) return m+' min ago';
  var h=Math.floor(m/60);
  if(h<24) return h+' h ago';
  var days=Math.floor(h/24);
  if(days===1) return 'yesterday';
  if(days<7) return days+' days ago';
  return new Date(ms).toLocaleDateString();
}
function newsCat(title, desc){
  var t=((title||'')+' '+(desc||'')).toLowerCase();
  var has=function(){ for(var i=0;i<arguments.length;i++) if(t.indexOf(arguments[i])>=0) return true; return false; };
  if(has('fomc','federal reserve','powell','fed chair','fed governor','fed official')) return 'Federal Reserve';
  if(has('rate hike','rate cut','rate decision','interest rate','treasury yield','10-year','bond yield')) return 'Interest Rates';
  if(has('earnings',' quarterly ','eps ','revenue ','guidance','beats estimates','misses estimates','profit warning','quarterly results')) return 'Earnings';
  if(has('merger','acquisition','acquires ','takeover','buyout','merger agreement')) return 'M&A';
  if(has(' ipo ','goes public',' spac ','direct listing')) return 'IPOs';
  if(has('bitcoin','ethereum',' crypto','blockchain','dogecoin')) return 'Crypto';
  if(has('crude','oil prices','gold prices','copper ','natural gas','opec','commodities')) return 'Commodities';
  if(has('bond market','corporate bond','junk bond','treasury ')) return 'Bonds';
  if(has('inflation',' cpi ','jobs report','unemployment',' gdp ','recession','payrolls','consumer spending','retail sales')) return 'Economy';
  if(has('artificial intelligence','semiconductor',' chip ',' chips ')) return 'Technology';
  if(has('s&p','dow jones','nasdaq composite','wall street','stocks rally','stocks fall','selloff','stock futures')) return 'Breaking Markets';
  return 'Stocks';
}
function newsKey(u){
  try{ var a=document.createElement('a'); a.href=u; return (a.hostname+' '+a.pathname).toLowerCase().replace(/\/$/,''); }
  catch(e){ return String(u).toLowerCase(); }
}
function newsParseRSS(txt, feed){
  var out=[];
  try{
    var doc=new DOMParser().parseFromString(txt,'text/xml');
    var items=doc.getElementsByTagName('item');
    for(var i=0;i<items.length;i++){
      var it=items[i];
      var g=function(tag){ var n=it.getElementsByTagName(tag)[0]; return n?n.textContent.trim():''; };
      var title=g('title'), link=g('link');
      if(!title||!link) continue;
      var pd=g('pubDate')||g('updated')||g('dc:date');
      var ms=pd?Date.parse(pd):null; if(ms!=null&&isNaN(ms)) ms=null;
      var desc=g('description'); if(desc.length>220) desc=desc.slice(0,220)+'\u2026';
      out.push({title:title, url:link, src:feed.label, time:ms, desc:desc, tickers:[], cat:newsCat(title,desc)});
    }
  }catch(e){}
  return out;
}
function newsTTMinId(arr){
  try{
    var min=null;
    for(var i=0;i<arr.length;i++){
      var v=BigInt(arr[i].id);
      if(min===null||v<min) min=v;
    }
    if(min!==null&&(News.ttLast===null||min<BigInt(News.ttLast))) News.ttLast=String(min);
  }catch(e){}
}
function newsParseTT(json){
  var out=[];
  try{
    var arr=json.stories||[];
    newsTTMinId(arr);
    for(var i=0;i<arr.length;i++){
      var st=arr[i];
      if(!st.title||!st.url) continue;
      var tk=(st.tickers||[]).map(function(x){ return String(x).toUpperCase(); });
      out.push({title:st.title, url:st.url, src:st.site||'TickerTick', time:st.time||null,
        desc:(st.description||'').slice(0,220), tickers:tk, cat:newsCat(st.title,st.description)});
    }
  }catch(e){}
  return out;
}
function newsMerge(list, pollStart){
  var seen={};
  News.items.forEach(function(x){ seen[newsKey(x.url)]=1; });
  var added=0;
  list.forEach(function(x){
    var k=newsKey(x.url);
    if(seen[k]) return;
    seen[k]=1;
    x.isNew=(!News.firstPoll&&x.time&&x.time>News.prevStart)?1:0;
    added++;
    News.items.push(x);
  });
  News.items.sort(function(a,b){ return (b.time||0)-(a.time||0); });
  if(News.items.length>400) News.items.length=400;
  return added;
}
function newsPoll(manual){
  var pollStart=Date.now();
  News.prevStart=News.lastPoll||0;
  News.firstPoll=!News.lastPoll;
  var done=0;
  NEWS_FEEDS.forEach(function(feed){
    fetch(feed.url,{cache:'no-store'}).then(function(r){
      if(!r.ok) throw new Error('HTTP '+r.status);
      return feed.kind==='json'?r.json():r.text();
    }).then(function(data){
      var list=feed.kind==='json'?newsParseTT(data):newsParseRSS(data,feed);
      var fresh=newsMerge(list,pollStart);
      News.srcStat[feed.id]={ok:1, n:list.length, at:Date.now()};
    }).catch(function(){
      News.srcStat[feed.id]={ok:0, at:Date.now()};
    }).then(function(){
      done++;
      if(done===NEWS_FEEDS.length){
        News.lastPoll=pollStart;
        if(News.co) newsSECFilings(News.co,true);
        else if(String(Router.current||'').indexOf('news')>=0) Router.render();
      }
    });
  });
}
function newsCoFeed(more){
  var t=News.co; if(!t) return;
  var url='https://api.tickertick.com/feed?q='+encodeURIComponent('z:'+t.toLowerCase())+'&n=120'
    +(more&&News.ttLastCo?'&last='+encodeURIComponent(News.ttLastCo):'');
  if(!more){ News.ttLastCo=null; News.moreMsg='Searching stories for '+t+'\u2026'; }
  else News.moreMsg='Loading older '+t+' stories\u2026';
  Router.render();
  fetch(url,{cache:'no-store'})
    .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
    .then(function(j){
      var arr=j.stories||[];
      try{
        var min=null;
        for(var i=0;i<arr.length;i++){ var v=BigInt(arr[i].id); if(min===null||v<min) min=v; }
        if(min!==null&&(News.ttLastCo===null||min<BigInt(News.ttLastCo))) News.ttLastCo=String(min);
      }catch(e){}
      var added=newsMerge(newsParseTT(j),Date.now());
      News.moreMsg=added?('Found '+added+' '+t+' stories.'):(more?'No more '+t+' stories further back.':'No stories found for '+t+'.');
    })
    .catch(function(){ News.moreMsg='Could not search '+t+' stories right now.'; })
    .then(function(){ if(String(Router.current||'').indexOf('news')>=0) Router.render(); });
}
function newsMore(){
  if(!News.ttLast){ News.moreMsg='Nothing more to load.'; Router.render(); return; }
  News.moreMsg='Loading older stories\u2026'; Router.render();
  fetch('https://api.tickertick.com/feed?n=120&last='+encodeURIComponent(News.ttLast),{cache:'no-store'})
    .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
    .then(function(j){
      var list=newsParseTT(j);
      var added=newsMerge(list,Date.now());
      News.moreMsg=added?('Loaded '+added+' older stories.'):'No more stories found further back.';
    })
    .catch(function(){ News.moreMsg='Could not load older stories right now.'; })
    .then(function(){ if(String(Router.current||'').indexOf('news')>=0) Router.render(); });
}
function newsTimer(){
  if(News.timer) return;
  News.timer=setInterval(function(){
    if(document.hidden) return;
    if(Date.now()-News.lastPoll>=4*60*1000) newsPoll(false);
  }, 30000);
  document.addEventListener('visibilitychange', function(){
    if(!document.hidden && Date.now()-News.lastPoll>=4*60*1000) newsPoll(false);
  });
}
function newsCoName(t){
  try{ var f=(RealData.fundamentals||{})[t]; if(f&&f.name) return f.name.replace(/,?\s+(Inc|Corp|Corporation|Company|Co|LLC|Ltd|PLC|Holdings|Group|Technologies|Technology)\.?$/i,''); }catch(e){}
  return t;
}
function newsMatchCo(x, t){
  var up=t.toUpperCase();
  for(var i=0;i<(x.tickers||[]).length;i++) if(x.tickers[i]===up) return true;
  var nm=newsCoName(t).toLowerCase();
  var hay=(x.title+' '+(x.desc||'')).toLowerCase();
  if(hay.indexOf(up.toLowerCase())>=0) return true;
  if(nm&&nm.length>2&&hay.indexOf(nm)>=0) return true;
  return false;
}
function newsSECFilings(t, silent){
  News.secFilings=[]; News.secMsg='loading\u2026';
  var cik=null;
  try{ var f=(RealData.fundamentals||{})[t.toUpperCase()]; if(f&&f.cik) cik=String(f.cik); }catch(e){}
  if(!cik){ News.secMsg='No SEC data for '+t+'.'; if(!silent&&String(Router.current||'').indexOf('news')>=0) Router.render(); return; }
  while(cik.length<10) cik='0'+cik;
  fetch('https://data.sec.gov/submissions/CIK'+cik+'.json',{cache:'no-store',headers:{'Accept':'application/json'}})
    .then(function(r){ if(!r.ok) throw 0; return r.json(); })
    .then(function(j){
      var rec=j.filings&&j.filings.recent; var out=[];
      if(rec&&rec.form){
        var keep={'8-K':1,'10-Q':1,'10-K':1,'6-K':1,'DEF 14A':1,'S-1':1,'S-3':1};
        for(var i=0;i<rec.form.length&&out.length<10;i++){
          if(!keep[rec.form[i]]) continue;
          var acc=rec.accessionNumber[i].replace(/-/g,'');
          out.push({form:rec.form[i], date:rec.filingDate[i],
            desc:rec.primaryDocDescription[i]||'',
            url:'https://www.sec.gov/Archives/edgar/data/'+parseInt(cik,10)+'/'+acc+'/'+rec.primaryDocument[i]});
        }
      }
      News.secFilings=out;
      News.secMsg=out.length?'':'No recent major filings found.';
    }).catch(function(){ News.secMsg='SEC feed unavailable right now.'; })
    .then(function(){ if(String(Router.current||'').indexOf('news')>=0) Router.render(); });
}
var NW_POS=['beat','beats','upgrade','upgrades','rally','rallies','surge','surges','soar','soars','jump','jumps','record','breakthrough','growth','expands','expansion','profit','profits','bullish','strong','optimism','optimistic','outperform','raise','raises','raised'];
var NW_NEG=['miss','misses','downgrade','downgrades','plunge','plunges','tumble','tumbles','probe','probes','lawsuit','fraud','cut','cuts','cutting','layoff','layoffs','warning','warns','slump','crash','bearish','recall','scandal','bankrupt','default','plummet','plummets','weak'];
function newsSentiment(list){
  var p=0,n=0;
  list.forEach(function(x){
    var hay=(x.title+' '+(x.desc||'')).toLowerCase();
    var ps=NW_POS.some(function(w){ return hay.indexOf(w)>=0; });
    var ns=NW_NEG.some(function(w){ return hay.indexOf(w)>=0; });
    if(ps&&!ns) p++; else if(ns&&!ps) n++;
  });
  return {p:p,n:n,tot:p+n};
}
function newsSentHTML(list){
  var s=newsSentiment(list);
  if(!s.tot) return '';
  var pp=Math.round(s.p/s.tot*100);
  var label=s.p>s.n*1.5?'Bullish-leaning':(s.n>s.p*1.5?'Bearish-leaning':'Mixed');
  var col=s.p>=s.n?'var(--green)':'var(--red)';
  return '<div class="panel" style="padding:10px 12px;margin-bottom:8px"><div class="small" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'
    +'<b>Headline mood:</b> <span class="tag" style="border-color:'+col+';color:'+col+'">'+label+'</span>'
    +'<span class="hint">'+s.p+' positive / '+s.n+' negative of '+s.tot+' scored headlines</span></div>'
    +'<div style="height:8px;background:#21262d;border-radius:4px;margin-top:8px;overflow:hidden;display:flex">'
    +'<div style="width:'+pp+'%;background:var(--green)"></div><div style="width:'+(100-pp)+'%;background:var(--red)"></div></div>'
    +'<div class="small hint" style="margin-top:4px">Keyword heuristic over the headlines shown — not a model, not a signal.</div></div>';
}
function ovNews(){
  newsTimer();
  if(!News.lastPoll && !News._started){ News._started=1; newsPoll(false); }
  var h='<div class="panel"><h2><span class="ico">'+icon('newspaper')+'</span> Market News '+DATA_BADGE+'</h2>';
  h+='<p class="small">Live headlines from free sources \u2014 refreshed automatically every ~4 minutes. No accounts, no keys, no backend.</p>';
  var ago=News.lastPoll?newsTimeAgo(News.lastPoll):'never';
  var okN=NEWS_FEEDS.filter(function(f){ return News.srcStat[f.id]&&News.srcStat[f.id].ok; }).length;
  h+='<div class="small" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:6px 0">'
    +'<span>Last refresh: <b>'+Util.esc(ago)+'</b></span>'
    +'<span>Sources up: <b>'+okN+'/'+NEWS_FEEDS.length+'</b></span>'
    +'<button class="btn sm" id="nw-refresh">Refresh now</button></div>';
  /* company mode */
  h+='<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0">'
    +'<span class="small"><b>Company mode:</b></span>'
    +tickerInput('nw-co', News.co||'', 'e.g. SOFI')
    +'<button class="btn sm" id="nw-co-go">Filter</button>'
    +(News.co?'<button class="btn sm ghost" id="nw-co-clear">Clear</button>':'')
    +'</div>'
  +'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0">'
  +'<span class="small"><b>Search headlines:</b></span>'
  +'<input class="in" id="nw-q" placeholder="e.g. HNST, tariffs, bitcoin" value="'+Util.esc(News.q||'')+'" style="max-width:260px">'
  +'<button class="btn sm" id="nw-q-go">Search</button>'
  +(News.q?'<button class="btn sm ghost" id="nw-q-clear">Clear</button>':'')
  +(News.co?'<button class="btn sm ghost" id="nw-more" title="Page further back through TickerTick for older stories">Load older stories</button>':'')
  +(News.moreMsg?'<span class="small">'+Util.esc(News.moreMsg)+'</span>':'')
  +'</div>';
  if(!News.lastPoll && !News.items.length){
    h+='<div class="panel">'+emptyBox('Fetching live headlines\u2026 (first load takes a few seconds)')+'</div>';
  } else {
    var list=News.items;
    if(News.co) list=list.filter(function(x){ return newsMatchCo(x, News.co); });
    if(News.q){
      var toks=News.q.toLowerCase().split(/\s+/).filter(Boolean);
      list=list.filter(function(x){
        var hay=(x.title+' '+(x.desc||'')+' '+x.src+' '+(x.tickers||[]).join(' ')).toLowerCase();
        return toks.every(function(t){ return hay.indexOf(t)>=0; });
      });
    }
    var cats=['All'];
    News.items.forEach(function(x){ if(cats.indexOf(x.cat)<0) cats.push(x.cat); });
    h+='<div class="small" style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0">'
      +cats.map(function(c){ return '<button class="btn sm'+(News.cat===c?'':' ghost')+'" data-ncat="'+Util.esc(c)+'">'+Util.esc(c)+'</button>'; }).join('')+'</div>';
    if(News.cat!=='All') list=list.filter(function(x){ return x.cat===News.cat; });
    h+=newsSentHTML(list);
    if(!list.length){
      h+='<div class="panel">'+emptyBox(News.co?('No current company news available for '+Util.esc(News.co.toUpperCase())+'. Try \u201cLoad older stories\u201d to page further back, or clear the filter.'):((News.q||News.cat!=='All')?('Nothing matches. Try fewer words or clear the search.'):'No headlines in this category right now.'))+'</div>';
    } else {
      h+='<div>'+list.slice(0,80).map(function(x){
        return '<div class="panel" style="padding:10px 12px;margin-bottom:8px"><div style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap">'
          +'<a href="'+Util.esc(x.url)+'" target="_blank" rel="noopener" style="font-weight:600">'+Util.esc(x.title)+'</a>'
          +(x.isNew?'<span class="badge" style="background:var(--green);color:#0a0f14;font-size:10px">NEW</span>':'')
          +'</div><div class="small" style="margin-top:4px;color:var(--muted)">'
          +Util.esc(x.src)+' \u00b7 '+Util.esc(x.cat)+' \u00b7 '+Util.esc(newsTimeAgo(x.time))+'</div>'
          +(x.desc?'<div class="small" style="margin-top:4px">'+Util.esc(x.desc)+'</div>':'')+'</div>';
      }).join('')+'</div>';
    }
    /* SEC filings in company mode */
    if(News.co){
      h+='<div class="panel"><h3>Recent SEC filings \u2014 '+Util.esc(News.co.toUpperCase())+'</h3>';
      if(News.secMsg==='loading\u2026') h+=emptyBox('Loading SEC filings\u2026');
      else if(!News.secFilings.length) h+=emptyBox(Util.esc(News.secMsg||'No filings.'));
      else h+='<table class="tbl"><tr><th>Form</th><th>Filed</th><th>Description</th></tr>'
        +News.secFilings.map(function(f){
          return '<tr><td><b>'+Util.esc(f.form)+'</b></td><td class="mono">'+Util.esc(f.date)+'</td>'
            +'<td><a href="'+Util.esc(f.url)+'" target="_blank" rel="noopener">'+Util.esc(f.desc||f.form)+' \u2197</a></td></tr>';
        }).join('')+'</table>';
      h+='<p class="hint">Filed dates come straight from SEC EDGAR \u2014 never estimated.</p></div>';
    }
  }
  /* source status */
  h+='<details class="exp"><summary>Source status ('+okN+'/'+NEWS_FEEDS.length+' reachable)</summary><div class="body"><table class="tbl"><tr><th>Source</th><th>Status</th><th>Items</th></tr>'
    +NEWS_FEEDS.map(function(f){
      var st=News.srcStat[f.id];
      return '<tr><td>'+Util.esc(f.label)+'</td><td>'+(st?(st.ok?'<span style="color:var(--green)">up</span>':'<span style="color:var(--red)">unavailable right now</span>'):'not polled yet')+'</td>'
        +'<td class="num">'+(st&&st.ok?st.n:'\u2014')+'</td></tr>';
    }).join('')+'</table>'
    +'<p class="small" style="margin-top:8px"><b>Browser-incompatible \u2014 requires server-side retrieval</b> (not used; no proxy added, per architecture):</p><ul class="small">'
    +NEWS_INCOMPATIBLE.map(function(x){ return '<li>'+Util.esc(x[0])+' \u2014 '+Util.esc(x[1])+'</li>'; }).join('')+'</ul></div></details>';
  h+='</div>';
  return h;
}
function ovNewsAfter(){
  var r=document.getElementById('nw-refresh');
  if(r) r.addEventListener('click', function(){ newsPoll(true); });
  var go=document.getElementById('nw-co-go');
  if(go) go.addEventListener('click', function(){
    var t=tickerVal('nw-co');
    News.co=t?t.toUpperCase():''; News.cat='All'; News.q='';
    if(News.co){ newsCoFeed(false); newsSECFilings(News.co,false); }
    else { News.ttLastCo=null; News.moreMsg=''; Router.render(); }
  });
  var cl=document.getElementById('nw-co-clear');
  if(cl) cl.addEventListener('click', function(){ News.co=''; News.cat='All'; News.q=''; News.moreMsg=''; News.secFilings=[]; Router.render(); });
  var qgo=document.getElementById('nw-q-go');
  var qi=document.getElementById('nw-q');
  function doQ(){ News.q=qi?qi.value.trim():''; News.moreMsg=''; Router.render(); var nq=document.getElementById('nw-q'); if(nq){ nq.focus(); nq.setSelectionRange(nq.value.length,nq.value.length); } }
  if(qgo) qgo.addEventListener('click', doQ);
  if(qi) qi.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); doQ(); } });
  var qc=document.getElementById('nw-q-clear');
  if(qc) qc.addEventListener('click', function(){ News.q=''; News.moreMsg=''; Router.render(); });
  var more=document.getElementById('nw-more');
  if(more) more.addEventListener('click', function(){ if(News.co) newsCoFeed(true); else newsMore(); });
  var ti=document.getElementById('nw-co');
  if(ti) ti.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); if(go) go.click(); } });
  Array.prototype.forEach.call(document.querySelectorAll('[data-ncat]'), function(b){
    b.addEventListener('click', function(){ News.cat=b.getAttribute('data-ncat'); Router.render(); });
  });
}
Router.routes['news']=ovNews;
Router.routes['news'].after=function(){ ovNewsAfter(); };


/* ---------------- route: watchlist ---------------- */
function ovWatch(){
  ovEnsure();
  const list=ovWatchList();
  const rows=list.map(function(t){
    const tk=String(t).toUpperCase();
    const name=((RealData.fundamentals||{})[tk]||{}).name||'—';
    const lc=lastClose(tk);
    const bars=ovBars(tk).slice(-60);
    const d1=ovChg(tk,1), d7=ovChg(tk,5), d30=ovChg(tk,21), d365=ovChg(tk,252);
    const col=d1!=null&&d1>=0?'#3fb950':'#f85149';
    const spark=bars.length?Charts.line(bars.map(function(b){ return {y:b.c}; }),150,44,col):'<div class="empty">data unavailable</div>';
    return '<tr><td class="mono"><b>'+Util.esc(tk)+'</b></td><td>'+Util.esc(name)+'</td>'+
      '<td class="num">'+(lc==null?'—':'$'+Util.num(lc,2))+'</td>'+
      '<td class="num">'+ovChgBadge(d1)+'</td><td class="num">'+ovChgBadge(d7)+'</td>'+
      '<td class="num">'+ovChgBadge(d30)+'</td><td class="num">'+ovChgBadge(d365)+'</td>'+
      '<td>'+spark+'</td>'+
      '<td><button class="btn sm danger" data-ov-wdel="'+Util.esc(tk)+'">Remove</button></td></tr>';
  }).join('');
  return ''+
  '<div class="panel"><h3>Watchlist</h3>'+
    '<div class="small hint">Defaults to the 15 covered stocks. Add any ticker from the bundled data pack; changes and sparklines are computed from bundled daily bars.</div>'+
    '<div class="frow"><label class="f">Add ticker</label>'+
      textInput('ov-w-add','','e.g. AAPL')+' '+
      '<button class="btn" id="ov-w-go">Add</button></div>'+
    (list.length?'<table class="tbl"><thead><tr><th>Ticker</th><th>Company</th><th class="num">Last close</th><th class="num">1-day</th><th class="num">1-wk</th><th class="num">1-mo</th><th class="num">1-yr</th><th>'+ex('sparkline','Trend (60d)')+'</th><th></th></tr></thead>'+
    '<tbody>'+rows+'</tbody></table>':emptyBox('Your watchlist is empty — add a ticker above.'))+
    '<div style="margin-top:10px">'+DATA_BADGE+'</div>'+
  '</div>';
}
function ovWatchAfter(){
  const go=document.getElementById('ov-w-go'); if(!go) return;
  function add(){
    const inp=document.getElementById('ov-w-add');
    const t=(inp.value||'').trim().toUpperCase();
    if(!t) return;
    const list=ovWatchList();
    if(list.some(function(x){ return String(x).toUpperCase()===t; })){ alert(t+' is already on your watchlist.'); return; }
    list.push(t); Store.save(); Router.render();
  }
  go.addEventListener('click',add);
  document.getElementById('ov-w-add').addEventListener('keydown',function(e){ if(e.key==='Enter') add(); });
  document.querySelectorAll('[data-ov-wdel]').forEach(function(b){
    b.addEventListener('click',function(){
      const t=b.getAttribute('data-ov-wdel');
      Store.db.watchlist=Store.db.watchlist.filter(function(x){ return String(x).toUpperCase()!==t; });
      Store.save(); Router.render();
    });
  });
}
ovWatch.after=ovWatchAfter;
Router.routes['watchlist']=ovWatch;
