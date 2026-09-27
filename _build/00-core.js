/* ================================================================
   FINANCE SUITE — 00-core.js
   Dark professional theme. Shared: CSS, Util, EX explainers, Store,
   Router/NAV, Charts (SVG), form helpers, boot.
   Contract for module chunks: they may USE all globals below and must
   only ADD: EX.reg(...) entries and Router.routes[...] entries.
   Plain JS, concatenated. No <script> tags in this file.
   ================================================================ */

/* ---------------- Util ---------------- */
const Util = {
  esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
  uid(p){ return (p||'id')+'_'+Math.random().toString(36).slice(2,9); },
  money(n){
    if(n==null||isNaN(n)) return '—';
    const a=Math.abs(n), s=n<0?'-':'';
    if(a>=1e12) return s+'$'+(a/1e12).toFixed(2)+'T';
    if(a>=1e9)  return s+'$'+(a/1e9).toFixed(2)+'B';
    if(a>=1e6)  return s+'$'+(a/1e6).toFixed(2)+'M';
    if(a>=1e3)  return s+'$'+(a/1e3).toFixed(1)+'K';
    return s+'$'+a.toFixed(2);
  },
  num(n,d){ if(n==null||isNaN(n)) return '—'; return Number(n).toLocaleString('en-US',{maximumFractionDigits:d==null?2:d}); },
  pct(x,d){ if(x==null||isNaN(x)) return '—'; return (x*100).toFixed(d==null?1:d)+'%'; },
  clamp(v,a,b){ return Math.max(a,Math.min(b,v)); },
  today(){ return new Date().toISOString().slice(0,10); },
  download(name, text, type){
    const b=new Blob([text],{type:type||'text/plain'}); const a=document.createElement('a');
    a.href=URL.createObjectURL(b); a.download=name; document.body.appendChild(a); a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},400);
  }
};

/* ---------------- RealData (inlined at build) ---------------- */
const RealData = window.REALDATA || {meta:{pulled:'2026-09-25'}, prices:{}, fundamentals:{}};
const DATA_BADGE = '<span class="asof">Market &amp; filing data as of 2026-09-25 · Sources: Yahoo Finance, SEC EDGAR</span>';
function lastClose(t){
  const b=(RealData.prices||{})[t]; if(!b||!b.length) return null;
  return b[b.length-1].c;
}
function fundVal(t, field, fy){
  const f=(RealData.fundamentals||{})[t]; if(!f) return null;
  const arr=f[field]||[]; const r=arr.find(r=>r.fy===String(fy))||arr[0];
  return r?r.val:null;
}
function fundFYs(t){
  const f=(RealData.fundamentals||{})[t]; if(!f||!f.revenue) return [];
  return f.revenue.map(r=>r.fy);
}
const STOCK_TICKERS = Object.keys(RealData.fundamentals||{}).sort();

/* ---------------- EX: plain-English explainers ---------------- */
const EX = {
  reg:{},
  add(key, t, what, why, good){ this.reg[key]={t,what,why,good}; },
  get(key){ return this.reg[key]; }
};
function ex(key, label){
  const e=EX.get(key);
  if(!e) return Util.esc(label||'');
  return Util.esc(label||e.t)+' <button class="exq" data-ex="'+Util.esc(key)+'" title="What does this mean?" aria-label="Explain">?</button>';
}
(function registerCoreExplain(){
  const A=(k,t,what,why,good)=>EX.add(k,t,what,why,good);
  A('marketcap','Market cap','The total value of all of a company\u2019s shares added together (share price \u00d7 number of shares).','It tells you how big the company is in the stock market\u2019s eyes.','Bigger usually means more stable; smaller can mean more room to grow \u2014 and more risk.');
  A('pe','P/E ratio','Share price divided by earnings per share. A P/E of 20 means investors pay $20 for every $1 of yearly profit.','It shows how expensive the stock is relative to what the company earns.','Lower than similar companies can mean cheaper; very high means investors expect a lot of growth.');
  A('eps','EPS','Earnings per share: the company\u2019s profit divided by its number of shares.','It\u2019s your slice of the profit for each share you own.','Rising EPS over time is what long-term investors want to see.');
  A('revenue','Revenue','All the money a company brings in from selling its products or services, before any costs.','It\u2019s the top line \u2014 growth here means the business is expanding.','Steady growth year after year is a healthy sign.');
  A('netincome','Net income','What\u2019s left after ALL costs, interest, and taxes. The bottom line.','This is the actual profit the company keeps.','Positive and growing is good; losses mean the business spends more than it makes.');
  A('grossmargin','Gross margin','(Revenue \u2212 cost of making the goods) \u00f7 revenue. The profit left before office and admin costs.','Shows how profitable the core product is.','Higher is better; software often 70%+, retailers under 30%.');
  A('opmargin','Operating margin','Operating profit \u00f7 revenue. Profit after running costs but before interest and taxes.','Shows how efficiently management runs the business.','Higher and stable is better.');
  A('roe','ROE','Return on equity: net income \u00f7 shareholder equity. Profit earned per dollar owners put in.','Measures how well the company uses its owners\u2019 money.','Above ~15% consistently is strong (see DuPont for why).');
  A('roa','ROA','Return on assets: net income \u00f7 total assets.','How efficiently the company squeezes profit from everything it owns.','Higher is better; compare within the same industry.');
  A('de','Debt-to-equity','Total liabilities \u00f7 shareholder equity.','How much of the company is funded by debt versus owners\u2019 money.','Lower is safer; high debt magnifies both gains and trouble.');
  A('current','Current ratio','Current assets \u00f7 current liabilities. Can it pay bills due within a year?','A quick health check on short-term cash safety.','Above 1.0 is fine; below 1.0 can signal cash stress.');
  A('intcov','Interest coverage','Operating income \u00f7 interest expense. How many times profit covers interest payments.','Shows whether debt payments are comfortable or a burden.','Above 3\u00d7 is comfortable; under 1.5\u00d7 is risky.');
  A('fcf','Free cash flow','Operating cash flow minus spending on equipment/factories. Cash the company can actually use freely.','It\u2019s the cash available for dividends, buybacks, or paying down debt.','Positive and growing is one of the best signs of health.');
  A('divyield','Dividend yield','Yearly dividend per share \u00f7 share price.','The cash income you get just for holding the stock.','Higher pays more income, but an extremely high yield can warn of a coming cut.');
  A('ytm','Yield to maturity','The total yearly return you\u2019d earn holding a bond until it matures, if the issuer pays everything.','It\u2019s the standard way to compare bonds.','Higher yield usually means higher risk of not getting paid back.');
  A('coupon','Coupon','The fixed interest a bond pays each year, as a % of its face value.','It\u2019s the bond\u2019s regular paycheck.','A 5% coupon on $1,000 pays $50 a year.');
  A('duration','Duration','Roughly: how many years until you get your money back, weighted by payments. Also the bond\u2019s sensitivity to rate changes.','A duration of 5 means a 1% rate rise drops the bond\u2019s price about 5%.','Shorter duration = less pain when rates rise.');
  A('dcf','DCF','Discounted cash flow: estimating what a company is worth by projecting its future cash and shrinking it back to today\u2019s dollars.','A dollar next year is worth less than a dollar today, so future cash gets discounted.','It\u2019s sensitive to guesses \u2014 small changes in growth assumptions swing the answer a lot.');
  A('wacc','Discount rate / WACC','The yearly % used to shrink future cash to today\u2019s value. WACC blends the cost of debt and equity.','Higher rates (like after Fed hikes) lower what future cash is worth today \u2014 so valuations fall.','There\u2019s no single right number; 8\u201312% is a common range for big companies.');
  A('piotroski','Piotroski F-Score','A 9-point checklist of financial strength: profits, cash flow, debt, margins, and efficiency trends. One point per test passed.','It was designed to separate strong companies from weak ones using only the financial statements.','8\u20139 is strong, 0\u20132 is weak. It\u2019s backward-looking \u2014 it grades the past, not the future.');
  A('altman','Altman Z-Score','A formula mixing working capital, retained earnings, profits, and leverage to estimate bankruptcy risk.','It flags companies whose finances look like past bankruptcies.','Above 2.99 = safer zone; below 1.81 = distress zone. Works best for manufacturers.');
  A('dupont','DuPont analysis','Breaks ROE into three parts: profit margin \u00d7 asset turnover \u00d7 leverage.','It reveals WHY returns are high \u2014 great margins, efficient assets, or just lots of debt.','High ROE from margins/efficiency is quality; high ROE from heavy debt is fragile.');
  A('beta','Beta','How much the stock swings compared to the whole market. Market = 1.0.','Beta 1.5 means roughly 50% bigger moves than the market, up and down.','Neither good nor bad \u2014 it just measures bumpiness.');
  A('ma','Moving average','The average price over the last N days, updated daily. Smooths out noise.','Traders watch whether price sits above or below it to judge the trend.','Price above a rising average suggests an uptrend; below a falling one, a downtrend.');
  A('buyback','Share buyback','The company buys its own shares and retires them, so fewer shares exist.','Your slice of the company gets bigger without you buying more \u2014 EPS rises even if profit doesn\u2019t.','Good when shares are cheap; wasteful when the company overpays for its own stock.');
  A('bondbuyback','Bond buyback','The company buys back its own bonds (debt) before they mature.','It shrinks debt and future interest payments, making the balance sheet safer.','Good when the company has spare cash and wants less leverage.');
  A('congress-trade','Congressional stock trading','Members of Congress must publicly disclose their stock trades (STOCK Act), usually within 30\u201345 days.','People watch these filings for ideas \u2014 but disclosures are delayed, and a trade isn\u2019t proof of inside knowledge.','Treat as a starting point for research, never as a buy signal on its own.');
  A('ratehike','Rate hike','The Federal Reserve raising its benchmark interest rate.','It makes borrowing costlier: mortgages, company loans, and bond yields all tend to rise. Stocks often fall because future profits are discounted at higher rates.','Savers earn more; borrowers and growth stocks feel pain.');
  A('xbrl','XBRL','A tagged data format the SEC requires: every number in a filing carries a machine-readable label like us-gaap:Revenues.','Because numbers are labeled, software can pull them out precisely instead of guessing from text.','Upload the XBRL version of a filing for the most accurate auto-parse.');
  A('statement-type','Statement types','Prediction = a specific call about the future. Recommendation = buy/sell advice. Opinion/education/news/speculation are softer.','Only specific, checkable claims can be proven right or wrong \u2014 vague talk can\u2019t be graded.','Judge creators on predictions with targets AND deadlines, not vibes.');
})();

/* explainer modal (event delegation) */
document.addEventListener('click', function(e){
  const b=e.target.closest('.exq');
  if(b){
    const k=b.getAttribute('data-ex'), d=EX.get(k);
    if(!d) return;
    showModal('<h3>'+Util.esc(d.t)+'</h3>'+
      '<p><b>What it is:</b> '+Util.esc(d.what)+'</p>'+
      '<p><b>Why it matters:</b> '+Util.esc(d.why)+'</p>'+
      '<p><b>Good vs bad:</b> '+Util.esc(d.good)+'</p>');
    return;
  }
  if(e.target.closest('[data-close-modal]')) closeModal();
});
function showModal(html){
  closeModal();
  const d=document.createElement('div'); d.className='modal-back'; d.id='modal';
  d.innerHTML='<div class="modal" role="dialog"><button class="btn sm" data-close-modal style="float:right">Close</button>'+html+'</div>';
  d.addEventListener('click',ev=>{ if(ev.target===d) closeModal(); });
  document.body.appendChild(d);
}
function closeModal(){ const m=document.getElementById('modal'); if(m) m.remove(); }

/* ---------------- Store ---------------- */
const Store = {
  KEY:'finsuite_db_v1', db:null,
  blank(){ return { version:1,
    holdings:[], watchlist:[],
    theses:[], ideas:[], briefs:[],
    filings:[], transcripts:[], congress:[],
    wheel:[], rothContrib:[],
    deepdive:{},
    workspaces:[],
    settings:{}
  };},
  load(){
    try{ const raw=localStorage.getItem(this.KEY); this.db = raw?JSON.parse(raw):this.blank(); }
    catch(e){ this.db=this.blank(); }
    if(!this.db||this.db.version!==1) this.db=this.blank();
    const b=this.blank();
    for(const k of Object.keys(b)) if(this.db[k]==null) this.db[k]=b[k];
    return this.db;
  },
  save(){ try{ localStorage.setItem(this.KEY, JSON.stringify(this.db)); }catch(e){ console.warn('save failed', e); } },
  exportJSON(){ return JSON.stringify(this.db,null,2); },
  importJSON(text){
    const o=JSON.parse(text);
    if(!o||o.version!==1) throw new Error('Not a valid Finance Suite v1 backup file.');
    this.db=Object.assign(this.blank(),o); this.save();
  },
  resetAll(){ this.db=this.blank(); this.save(); }
};

/* ---------------- Charts (SVG, no libraries) ---------------- */
const Charts = {
  candles(bars, w, h){
    w=w||720; h=h||260;
    if(!bars||!bars.length) return '<div class="empty">data unavailable</div>';
    const n=bars.length, lo=Math.min(...bars.map(b=>b.l)), hi=Math.max(...bars.map(b=>b.h));
    const pad=(hi-lo)*0.08||1, y=v=>h-8-((v-(lo-pad))/((hi-lo)+2*pad))*(h-16);
    const cw=(w-40)/n;
    let s='<svg viewBox="0 0 '+w+' '+h+'" class="chart" preserveAspectRatio="none">';
    for(let i=0;i<n;i++){
      const b=bars[i], x=30+i*cw+cw*0.2, ww=Math.max(1,cw*0.6);
      const up=b.c>=b.o, col=up?'#3fb950':'#f85149';
      s+='<line x1="'+(x+ww/2)+'" y1="'+y(b.h)+'" x2="'+(x+ww/2)+'" y2="'+y(b.l)+'" stroke="'+col+'" stroke-width="1"/>';
      s+='<rect x="'+x+'" y="'+y(Math.max(b.o,b.c))+'" width="'+ww+'" height="'+Math.max(1,Math.abs(y(b.o)-y(b.c)))+'" fill="'+col+'"/>';
    }
    const last=bars[n-1];
    s+='<text x="'+(w-4)+'" y="'+(y(last.c)-4)+'" text-anchor="end" class="chart-lab">$'+last.c.toFixed(2)+'</text></svg>';
    return s+'<div class="chart-cap">'+Util.esc(bars[0].d)+' \u2192 '+Util.esc(bars[n-1].d)+' · '+n+' trading days</div>';
  },
  line(series, w, h, color){
    w=w||720; h=h||220; color=color||'#58a6ff';
    const pts=series.filter(p=>p.y!=null); if(!pts.length) return '<div class="empty">data unavailable</div>';
    const lo=Math.min(...pts.map(p=>p.y)), hi=Math.max(...pts.map(p=>p.y));
    const pad=(hi-lo)*0.1||1, X=i=>30+i/(pts.length-1||1)*(w-50), Y=v=>h-14-((v-(lo-pad))/((hi-lo)+2*pad))*(h-28);
    let d='M'+X(0)+' '+Y(pts[0].y);
    for(let i=1;i<pts.length;i++) d+=' L'+X(i)+' '+Y(pts[i].y);
    return '<svg viewBox="0 0 '+w+' '+h+'" class="chart"><path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="2"/></svg>';
  },
  vbar(labels, values, w, h, color){
    w=w||720; h=h||200; color=color||'#58a6ff';
    if(!values.length) return '<div class="empty">data unavailable</div>';
    const mx=Math.max(...values.map(Math.abs),1), bw=(w-40)/values.length;
    let s='<svg viewBox="0 0 '+w+' '+h+'" class="chart">';
    values.forEach((v,i)=>{
      const bh=Math.abs(v)/mx*(h-30), x=30+i*bw+2;
      s+='<rect x="'+x+'" y="'+(h-20-bh)+'" width="'+(bw-4)+'" height="'+bh+'" fill="'+(v<0?'#f85149':color)+'"><title>'+Util.esc(labels[i])+': '+Util.money(v)+'</title></rect>';
    });
    return s+'</svg><div class="chart-cap">'+labels.map(Util.esc).join(' · ')+'</div>';
  }
};

/* ---------------- TradingView embed (dark) ---------------- */
/* tvEmbedHTML('box-id') in markup; call tvEmbedAfter('box-id', symbol, bars) after render.
   theme:'dark' always. If TradingView is unreachable, falls back to bundled offline
   bars (when given); otherwise an honest unavailable message. Idempotent. */
function tvEmbedHTML(id){
  return '<div id="'+id+'" style="min-height:420px;background:#0d1117;border-radius:8px"></div>'+
    '<div class="small hint" id="'+id+'-note" style="margin-top:6px">Loading TradingView\u2026 if you are offline, a bundled-data chart appears instead.</div>';
}
function tvEmbedAfter(id, symbol, bars){
  var box=document.getElementById(id), note=document.getElementById(id+'-note');
  if(!box) return;
  function fallback(reason){
    var msg=(bars&&bars.length)
      ? 'Showing the offline chart from bundled data instead.</div>'+Charts.candles(bars.slice(-252),720,400)
      : 'No bundled price data for this ticker either \u2014 the chart is unavailable offline.</div>';
    box.innerHTML='<div class="alert warn">TradingView could not load ('+Util.esc(reason)+'). '+msg;
    if(note) note.textContent='Offline mode.';
  }
  function build(){
    try{
      if(typeof TradingView==='undefined') throw new Error('blocked');
      box.innerHTML='';
      new TradingView.widget({container_id:id, autosize:true, symbol:symbol, interval:'D',
        theme:'dark', style:'1', locale:'en', allow_symbol_change:true,
        backgroundColor:'rgba(13,17,23,1)'});
      if(note) note.textContent='Live TradingView chart (needs internet). Symbol can be changed inside the chart.';
    }catch(e){ fallback(e.message||'error'); }
  }
  if(typeof TradingView!=='undefined'){ build(); return; }
  if(!document.getElementById('tradingview-tvjs')){
    var s=document.createElement('script');
    s.id='tradingview-tvjs'; s.src='https://s3.tradingview.com/tv.js';
    s.onload=function(){ setTimeout(build,300); };
    s.onerror=function(){ fallback('network blocked'); };
    document.head.appendChild(s);
  } else { setTimeout(build,300); }
  setTimeout(function(){ if(typeof TradingView==='undefined'&&!box.querySelector('iframe')&&!box.querySelector('svg')) fallback('timed out'); },12000);
}

/* ---------------- form helpers ---------------- */
function fieldRow(label, inner, hint){
  return '<div class="frow"><label class="f">'+label+'</label>'+inner+(hint?'<div class="hint">'+hint+'</div>':'')+'</div>';
}

/* ---------------- optional live market-data providers ----------------
   Keys are typed in by the user on the Settings page and stored ONLY in
   this browser's localStorage (Store.db.settings.apikeys). They are never
   written into this file. Everything on the site works without them. */
const LiveQuotes = {
  TTL: 60000,
  cache: {},
  keys(){ return (Store.db.settings&&Store.db.settings.apikeys)||{}; },
  provider(){
    const k=this.keys();
    if(k.finnhub) return 'finnhub';
    if(k.alphavantage) return 'alphavantage';
    return null;
  },
  async finnhub(sym){
    const r=await fetch('https://finnhub.io/api/v1/quote?symbol='+encodeURIComponent(sym)+'&token='+encodeURIComponent(this.keys().finnhub));
    if(!r.ok) throw new Error('Finnhub refused the request (HTTP '+r.status+' \u2014 check the key)');
    const j=await r.json();
    if(j.error) throw new Error('Finnhub: '+j.error);
    if(j.c==null) throw new Error('No quote returned for '+sym);
    return {px:j.c, chg:j.d, chgp:j.dp, t:j.t?j.t*1000:Date.now(), src:'Finnhub'};
  },
  async av(sym){
    const r=await fetch('https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol='+encodeURIComponent(sym)+'&apikey='+encodeURIComponent(this.keys().alphavantage));
    if(!r.ok) throw new Error('Alpha Vantage refused the request (HTTP '+r.status+' \u2014 check the key)');
    const j=await r.json(), q=j['Global Quote']||{};
    if(!q['05. price']) throw new Error(j.Note||j.Information||('No quote returned for '+sym));
    const lt=q['07. latest trading day'];
    return {px:parseFloat(q['05. price']), chg:parseFloat(q['09. change']),
      chgp:parseFloat(String(q['10. change percent']||'').replace('%','')),
      t:lt?Date.parse(lt+'T16:00:00-04:00'):Date.now(), src:'Alpha Vantage'};
  },
  async get(syms, force){
    const out={}, prov=this.provider();
    await Promise.all(syms.map(async (s)=>{
      const sym=String(s).toUpperCase(), c=this.cache[sym];
      if(!force&&c&&(Date.now()-c.fetched)<this.TTL){ out[sym]={ok:true,q:c}; return; }
      if(!prov){ out[sym]={ok:false,why:'no-key'}; return; }
      try{
        const q=prov==='finnhub'?await this.finnhub(sym):await this.av(sym);
        q.fetched=Date.now(); this.cache[sym]=q; out[sym]={ok:true,q:q};
      }catch(e){ out[sym]={ok:false,why:String((e&&e.message)||e).slice(0,140)}; }
    }));
    return out;
  },
  badge(q){
    if(!q) return '';
    const live=(Date.now()-q.t)<15*60*1000;
    return '<span class="tag '+(live?'b-ok':'b-warn')+'">'+(live?'LIVE':'DELAYED')+'</span>'
      +' <span class="small hint">'+Util.esc(q.src)+' \u00B7 '+new Date(q.t).toLocaleTimeString()+'</span>';
  },
  row(s, res){
    if(!res.ok) return '<div class="lq-row"><b>'+Util.esc(s)+'</b><span class="small hint">'
      +(res.why==='no-key'?'no API key set':Util.esc(res.why))+'</span></div>';
    const q=res.q, up=(q.chg||0)>=0;
    return '<div class="lq-row"><b>'+Util.esc(s)+'</b>'
      +'<span class="mono">'+Util.num(q.px,2)+'</span>'
      +'<span class="mono" style="color:var(--'+(up?'green':'red')+')">'+(up?'+':'')+Util.num(q.chg,2)+' ('+(up?'+':'')+Util.num(q.chgp,2)+'%)</span>'
      +'<span>'+this.badge(q)+'</span></div>';
  }
};
function emptyBox(msg){ return '<div class="empty">'+Util.esc(msg||'Nothing here yet.')+'</div>'; }
function numInput(id, val, step){ return '<input class="in" type="number" id="'+id+'" value="'+(val==null?'':val)+'" step="'+(step||'any')+'">'; }
function textInput(id, val, ph){ return '<input class="in" type="text" id="'+id+'" value="'+Util.esc(val==null?'':val)+'" placeholder="'+Util.esc(ph||'')+'">'; }
/* free-text ticker input with bundled-ticker suggestions (datalist) */
function tickerInput(id, val, ph){
  var dlid=id+'-dl';
  var opts=((typeof STOCK_TICKERS!=='undefined'&&STOCK_TICKERS)||[]).map(function(x){ return '<option value="'+Util.esc(x)+'">'; }).join('');
  return '<input class="in mono" type="text" id="'+id+'" list="'+dlid+'" value="'+Util.esc(val==null?'':val)+'" placeholder="'+Util.esc(ph||'e.g. AAPL or CELH')+'" style="text-transform:uppercase" autocapitalize="characters" autocorrect="off" spellcheck="false">'
    +'<datalist id="'+dlid+'">'+opts+'</datalist>';
}
function tickerVal(id){
  var el=document.getElementById(id);
  return el?String(el.value||'').trim().toUpperCase():'';
}
function tickerHint(){
  return 'Type any ticker (e.g. CELH). Bundled SEC & price data prefills where available; otherwise fields stay manual and show \u201cdata unavailable\u201d \u2014 nothing is invented.';
}

/* Lucide icons (ISC license, https://lucide.dev) — curated subset, inlined. */
const ICONS={
  archive: '<rect width="20" height="5" x="2" y="3" rx="1" /> <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" /> <path d="M10 12h4" />',
  banknote: '<rect width="20" height="12" x="2" y="6" rx="2" /> <circle cx="12" cy="12" r="2" /> <path d="M6 12h.01M18 12h.01" />',
  book_open: '<path d="M12 7v14" /> <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />',
  bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />',
  briefcase: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /> <rect width="20" height="14" x="2" y="6" rx="2" />',
  chart_candlestick: '<path d="M9 5v4" /> <rect width="4" height="6" x="7" y="9" rx="1" /> <path d="M9 15v2" /> <path d="M17 3v2" /> <rect width="4" height="8" x="15" y="5" rx="1" /> <path d="M17 13v3" /> <path d="M3 3v16a2 2 0 0 0 2 2h16" />',
  chart_column: '<path d="M3 3v16a2 2 0 0 0 2 2h16" /> <path d="M18 17V9" /> <path d="M13 17V5" /> <path d="M8 17v-3" />',
  chevron_right: '<path d="m9 18 6-6-6-6" />',
  clock: '<circle cx="12" cy="12" r="10" /> <polyline points="12 6 12 12 16 14" />',
  compass: '<path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" /> <circle cx="12" cy="12" r="10" />',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2" /> <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />',
  corner_down_left: '<polyline points="9 10 4 15 9 20" /> <path d="M20 4v7a4 4 0 0 1-4 4H4" />',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /> <polyline points="7 10 12 15 17 10" /> <line x1="12" x2="12" y1="15" y2="3" />',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /> <circle cx="12" cy="12" r="3" />',
  file_search: '<path d="M14 2v4a2 2 0 0 0 2 2h4" /> <path d="M4.268 21a2 2 0 0 0 1.727 1H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3" /> <path d="m9 18-1.5-1.5" /> <circle cx="5" cy="14" r="3" />',
  file_text: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /> <path d="M14 2v4a2 2 0 0 0 2 2h4" /> <path d="M10 9H8" /> <path d="M16 13H8" /> <path d="M16 17H8" />',
  house: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /> <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />',
  keyboard: '<path d="M10 8h.01" /> <path d="M12 12h.01" /> <path d="M14 8h.01" /> <path d="M16 12h.01" /> <path d="M18 8h.01" /> <path d="M6 8h.01" /> <path d="M7 16h10" /> <path d="M8 12h.01" /> <rect width="20" height="16" x="2" y="4" rx="2" />',
  landmark: '<line x1="3" x2="21" y1="22" y2="22" /> <line x1="6" x2="6" y1="18" y2="11" /> <line x1="10" x2="10" y1="18" y2="11" /> <line x1="14" x2="14" y1="18" y2="11" /> <line x1="18" x2="18" y1="18" y2="11" /> <polygon points="12 2 20 7 4 7" />',
  layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" /> <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" /> <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /> <path d="M19 10v2a7 7 0 0 1-14 0v-2" /> <line x1="12" x2="12" y1="19" y2="22" />',
  microscope: '<path d="M6 18h8" /> <path d="M3 22h18" /> <path d="M14 22a7 7 0 1 0 0-14h-1" /> <path d="M9 14h2" /> <path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z" /> <path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3" />',
  newspaper: '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" /> <path d="M18 14h-8" /> <path d="M15 18h-5" /> <path d="M10 6h8v4h-8V6Z" />',
  percent: '<line x1="19" x2="5" y1="5" y2="19" /> <circle cx="6.5" cy="6.5" r="2.5" /> <circle cx="17.5" cy="17.5" r="2.5" />',
  plus: '<path d="M5 12h14" /> <path d="M12 5v14" />',
  scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /> <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /> <path d="M7 21h10" /> <path d="M12 3v18" /> <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />',
  scan_search: '<path d="M3 7V5a2 2 0 0 1 2-2h2" /> <path d="M17 3h2a2 2 0 0 1 2 2v2" /> <path d="M21 17v2a2 2 0 0 1-2 2h-2" /> <path d="M7 21H5a2 2 0 0 1-2-2v-2" /> <circle cx="12" cy="12" r="3" /> <path d="m16 16-1.9-1.9" />',
  search: '<circle cx="11" cy="11" r="8" /> <path d="m21 21-4.3-4.3" />',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /> <circle cx="12" cy="12" r="3" />',
  sprout: '<path d="M7 20h10" /> <path d="M10 20c5.5-2.5.8-6.4 3-10" /> <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" /> <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />',
  star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />',
  swords: '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" /> <line x1="13" x2="19" y1="19" y2="13" /> <line x1="16" x2="20" y1="16" y2="20" /> <line x1="19" x2="21" y1="21" y2="19" /> <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" /> <line x1="5" x2="9" y1="14" y2="18" /> <line x1="7" x2="4" y1="17" y2="20" /> <line x1="3" x2="5" y1="19" y2="21" />',
  trash_2: '<path d="M3 6h18" /> <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /> <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /> <line x1="10" x2="10" y1="11" y2="17" /> <line x1="14" x2="14" y1="11" y2="17" />',
  triangle_alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /> <path d="M12 9v4" /> <path d="M12 17h.01" />',
  undo_2: '<path d="M9 14 4 9l5-5" /> <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /> <polyline points="17 8 12 3 7 8" /> <line x1="12" x2="12" y1="3" y2="15" />',
  x: '<path d="M18 6 6 18" /> <path d="m6 6 12 12" />',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />'
};
function icon(n, size){
  const p = ICONS[n] || ICONS.search;
  const s = size || 16;
  return '<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>';
}

/* ---------------- NAV ---------------- */
const NAV = [
  {sec:'Overview'},
  {id:'home', title:'Home', icon:'house', crumb:'suite / home'},
  {id:'markets', title:'Markets', icon:'chart_candlestick', crumb:'suite / markets'},
  {id:'holdings', title:'Holdings Analyzer', icon:'briefcase', crumb:'suite / holdings'},
  {id:'news', title:'Market News', icon:'newspaper', crumb:'suite / news'},
  {sec:'Research'},
  {id:'research', title:'Research Terminal', icon:'microscope', crumb:'suite / research'},
  {id:'sec-upload', title:'SEC Filing Upload', icon:'upload', crumb:'suite / sec upload'},
  {id:'rating', title:'Company Rating', icon:'star', crumb:'suite / rating'},
  {id:'filings', title:'Filing Detective', icon:'file_search', crumb:'suite / filings'},
  {id:'earnings', title:'Earnings Calls', icon:'mic', crumb:'suite / earnings'},
  {sec:'Analysis'},
  {id:'statements', title:'Statement Analyzer', icon:'chart_column', crumb:'suite / statements'},
  {id:'valuation', title:'Valuation Workbench', icon:'scale', crumb:'suite / valuation'},
  {id:'options', title:'Options Lab', icon:'layers', crumb:'suite / options'},
  {id:'bonds', title:'Bonds & Rates', icon:'percent', crumb:'suite / bonds'},
  {id:'buybacks', title:'Buybacks', icon:'undo_2', crumb:'suite / buybacks'},
  {id:'deepdive', title:'Company Deep Dive', icon:'scan_search', crumb:'suite / deep dive'},
  {sec:'Planning'},
  {id:'dividends', title:'Dividend Planner', icon:'banknote', crumb:'suite / dividends'},
  {id:'roth', title:'Roth IRA Planner', icon:'sprout', crumb:'suite / roth'},
  {id:'congress', title:'Congress Trading', icon:'landmark', crumb:'suite / congress'},
  {sec:'Lab'},
  {id:'theses', title:'Thesis Tracker', icon:'compass', crumb:'suite / theses'},
  {id:'graveyard', title:'Idea Graveyard', icon:'archive', crumb:'suite / graveyard'},
  {id:'briefing', title:'What Changed', icon:'file_text', crumb:'suite / briefing'},
  {id:'similar', title:'Find Similar', icon:'scan_search', crumb:'suite / similar'},
  {sec:'System'},
  {id:'glossary', title:'Glossary', icon:'book_open', crumb:'suite / glossary'},
  {id:'settings', title:'Backup & Data', icon:'settings', crumb:'suite / settings'},
];
const NAV_PARENT = {
  'research-ticker':'research','filing-view':'filings','thesis':'theses','thesis-new':'theses',
'similar-view':'similar',
  'briefing-view':'briefing','watchlist':'research','rating-ticker':'rating'
};

/* ---------------- Router ---------------- */
const Router = {
  routes:{}, current:'home',
  go(h){ location.hash=h; },
  render(){
    const h=(location.hash||'#/home').replace(/^#\/?/,'');
    const parts=h.split('/'), name=parts[0]||'home', param=decodeURIComponent(parts.slice(1).join('/')||'');
    const fn=this.routes[name]||this.routes['home'];
    this.current=name;
    const navId=NAV_PARENT[name]||name;
    document.querySelectorAll('#nav .nav-link').forEach(el=>el.classList.toggle('active', el.dataset.route===navId));
    const navItem=NAV.find(n=>n.id===navId);
    document.getElementById('page-title').textContent=navItem?navItem.title:'Home';
    document.getElementById('page-crumb').textContent=navItem?navItem.crumb:'suite';
    const view=document.getElementById('view');
    try{ view.innerHTML=fn(param); }
    catch(e){ view.innerHTML='<div class="alert err">This section failed to render: '+Util.esc(e.message)+'</div>'; console.error(e); }
    if(fn&&fn.after){ try{ fn.after(param); }catch(e){ console.error(e); } }
    window.scrollTo(0,0);
  }
};
function renderNav(){
  const el=document.getElementById('nav');
  el.innerHTML=NAV.map(n=>n.sec
    ? '<div class="nav-sec">'+Util.esc(n.sec)+'</div>'
    : '<div class="nav-link" data-route="'+n.id+'"><span class="ico">'+icon(n.icon)+'</span>'+Util.esc(n.title)+'</div>'
  ).join('');
  el.querySelectorAll('.nav-link').forEach(a=>a.addEventListener('click',()=>Router.go('#/'+a.dataset.route)));
}

/* ---------------- boot ---------------- */
/* NOTE: boot lives in 99-boot.js (last chunk) so all routes are registered first. */
