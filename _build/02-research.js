/* ================================================================
   FINANCE SUITE — 02-research.js
   Research Terminal, SEC Filing Upload (XBRL / companyfacts / 10-K
   heuristic / SEC EDGAR fetch), Filing Detective (before/after),
   Earnings Call workspace.
   Uses ONLY globals from 00-core.js. All names prefixed rs.
   No <script> tags. No invented data: RealData or user uploads only.
   ================================================================ */

/* ---------------- shared bits ---------------- */
const rsFIG_LABELS = {
  revenue:'Revenue', net_income:'Net income', gross_profit:'Gross profit',
  op_income:'Operating income', assets:'Total assets', cur_assets:'Current assets',
  cur_liab:'Current liabilities', total_liab:'Total liabilities', lt_debt:'Long-term debt',
  retained:'Retained earnings', op_cash:'Operating cash flow',
  shares_dil:'Diluted shares outstanding', interest_exp:'Interest expense'
};
const rsFIG_ORDER = Object.keys(rsFIG_LABELS);

/* XBRL tags, priority order per figure */
const rsXBRL_MAP = [
  {field:'revenue',     tags:['Revenues','RevenueFromContractWithCustomerExcludingAssessedTax','SalesRevenueNet']},
  {field:'net_income',  tags:['NetIncomeLoss']},
  {field:'gross_profit',tags:['GrossProfit']},
  {field:'op_income',   tags:['OperatingIncomeLoss']},
  {field:'assets',      tags:['Assets']},
  {field:'cur_assets',  tags:['AssetsCurrent']},
  {field:'cur_liab',    tags:['LiabilitiesCurrent']},
  {field:'total_liab',  tags:['Liabilities']},
  {field:'lt_debt',     tags:['LongTermDebt','LongTermDebtNoncurrent']},
  {field:'retained',    tags:['RetainedEarningsAccumulatedDeficit']},
  {field:'op_cash',     tags:['NetCashProvidedByUsedInOperatingActivities']},
  {field:'shares_dil',  tags:['WeightedAverageNumberOfDilutedSharesOutstanding']},
  {field:'interest_exp',tags:['InterestExpense','InterestCostsIncurred']}
];

if(!EX.get('xbrl')) EX.add('xbrl','XBRL','A tagged data format the SEC requires: every number in a filing carries a machine-readable label like us-gaap:Revenues.','Because numbers are labeled, software can pull them out precisely instead of guessing from text.','Upload the XBRL version of a filing for the most accurate auto-parse.');
EX.add('cagr','CAGR','Compound annual growth rate: the steady yearly growth rate that would take the start value to the end value.','It smooths bumpy year-to-year changes into one average rate so you can compare growth fairly.','Higher is better, but check whether growth came from sales or from one-off items.');

/* per-company business summaries — factual, no numbers, from general knowledge */
const rsSUMMARY = {
  AAPL:'Apple designs and sells consumer electronics, software, and services. Its best-known products are the iPhone, Mac, iPad, and Apple Watch. It also earns recurring revenue from services such as the App Store, Apple Music, iCloud, and Apple Pay.',
  AMD:'Advanced Micro Devices designs processors for computers, servers, and graphics. Its Ryzen and EPYC chips compete with Intel in PCs and data centers, while Radeon GPUs serve gamers. It is fabless, meaning outside foundries manufacture its chips.',
  AMZN:'Amazon runs one of the world\u2019s largest online retail businesses and the AWS cloud computing platform. It also earns money from advertising, subscriptions like Prime, and devices. AWS is its highest-margin major segment.',
  AVGO:'Broadcom makes semiconductors for networking, broadband, storage, and wireless devices. It also sells enterprise infrastructure software, including the VMware virtualization products it acquired. Many of its chips go into data centers and telecom equipment.',
  GOOGL:'Alphabet is the parent of Google. Most of its revenue comes from advertising on Google Search and YouTube. It also sells cloud services through Google Cloud, the Android operating system, and hardware such as Pixel phones.',
  JPM:'JPMorgan Chase is the largest bank in the United States by assets. It serves consumers and small businesses with checking, savings, credit cards, and mortgages, and serves companies with investment banking and trading. It also runs a large asset and wealth management business.',
  LLY:'Eli Lilly is a pharmaceutical company that discovers and sells prescription drugs. It is known for diabetes and weight-management medicines such as Mounjaro and Zepbound. Its portfolio also includes treatments for cancer, immune disorders, and Alzheimer\u2019s disease.',
  META:'Meta Platforms owns Facebook, Instagram, WhatsApp, and Messenger. Nearly all of its revenue comes from digital advertising. It also invests heavily in Reality Labs, which builds virtual and augmented reality hardware.',
  MSFT:'Microsoft sells software and cloud services to businesses and consumers. Its biggest products are Windows, Microsoft 365 (Office), and the Azure cloud platform. It also owns LinkedIn and the Xbox gaming business.',
  SOFI:'SoFi Technologies is a digital-first bank and personal finance company. It makes money mostly from lending (student, personal, and home loans) through net interest income, plus fees from its Invest brokerage, credit cards, and its technology platform (Galileo and Technisys) sold to other financial institutions. It operates SoFi Bank, an FDIC-insured national bank.',
  NFLX:'Netflix is a subscription streaming service for movies and TV shows. It produces much of its own content and now offers a lower-priced plan with advertising. It earns revenue in nearly every country in the world.',
  NVDA:'NVIDIA designs graphics processors (GPUs) that power gaming PCs and, more importantly, data centers running artificial intelligence. Its CUDA software platform keeps developers tied to its chips. It also sells networking and automotive products.',
  TSLA:'Tesla makes electric vehicles, including the Model 3, Model Y, Model S, Model X, and Cybertruck. It also sells solar panels and battery storage for homes and utilities. It is developing self-driving software and robotaxi services.',
  WMT:'Walmart is the world\u2019s largest retailer by revenue, selling groceries and general merchandise through stores and online. Its low-price strategy targets everyday shoppers. It also runs membership (Walmart+) and a growing advertising business.',
  XOM:'Exxon Mobil is one of the world\u2019s largest oil and gas companies. It explores for and produces crude oil and natural gas, refines fuel, and makes chemicals and lubricants. Its profits rise and fall with energy prices.'
};

function rsSharesLatest(t){
  const fys=fundFYs(t); if(!fys.length) return null;
  return fundVal(t,'shares_dil',fys[0]);
}
function rsMarketCap(t){
  const p=lastClose(t), s=rsSharesLatest(t);
  return (p==null||s==null)?null:p*s;
}
function rsEPS(t){
  const fys=fundFYs(t); if(!fys.length) return null;
  const ni=fundVal(t,'net_income',fys[0]), s=fundVal(t,'shares_dil',fys[0]);
  return (ni==null||s==null||!s)?null:ni/s;
}
function rsOneYrChg(t){
  const bars=(RealData.prices||{})[t]; if(!bars||bars.length<2) return null;
  const w=bars.slice(-252), a=w[0].c, b=w[w.length-1].c;
  return a? (b-a)/a : null;
}
function rsRevenueCAGR(t){
  const f=(RealData.fundamentals||{})[t]; if(!f||!f.revenue||f.revenue.length<2) return null;
  const r=[...f.revenue].sort((a,b)=>a.fy<b.fy?-1:1);
  const first=r[0], last=r[r.length-1];
  if(first.val==null||last.val==null||first.val<=0||last.val<=0) return null;
  const yrs=r.length-1;
  return {cagr: Math.pow(last.val/first.val, 1/yrs)-1, from:first.fy, to:last.fy};
}
function rsGrossMarginLatest(t){
  const fys=fundFYs(t); if(!fys.length) return null;
  const gp=fundVal(t,'gross_profit',fys[0]), rv=fundVal(t,'revenue',fys[0]);
  return (gp==null||rv==null||!rv)?null:gp/rv;
}
function rsDatedFilingSort(a,b){
  return String(b.uploaded||'').localeCompare(String(a.uploaded||'')) ||
         String(b.fyEnd||'').localeCompare(String(a.fyEnd||''));
}

/* ================================================================
   1. ROUTE: research — ticker grid + compare
   ================================================================ */
function rsRenderResearch(){
  const cards = STOCK_TICKERS.map(t=>{
    const f=(RealData.fundamentals||{})[t]||{};
    const p=lastClose(t), chg=rsOneYrChg(t);
    const bars=(RealData.prices||{})[t]||[];
    const spark=Charts.line(bars.slice(-60).map(b=>({y:b.c})), 180, 48, chg!=null&&chg<0?'#f85149':'#3fb950');
    const chgTxt = chg==null?'—':(chg>=0?'+':'')+Util.pct(chg,1);
    const chgCol = chg==null?'':(chg>=0?'color:#3fb950':'color:#f85149');
    return '<div class="panel rs-card" data-ticker="'+Util.esc(t)+'" style="cursor:pointer" title="Open '+Util.esc(t)+' dossier">'+
      '<div style="display:flex;justify-content:space-between;align-items:start">'+
        '<div><div class="mono" style="font-weight:700;font-size:15px">'+Util.esc(t)+'</div>'+
        '<div class="small">'+Util.esc(f.name||'')+'</div></div>'+
        '<label class="small" style="cursor:pointer" title="Add to comparison"><input type="checkbox" class="rs-cmp" value="'+Util.esc(t)+'"> compare</label>'+
      '</div>'+
      '<div style="margin:8px 0 2px"><span class="num" style="font-size:18px;font-weight:700">'+Util.money(p)+'</span>'+
      ' <span class="small" style="'+chgCol+'">'+chgTxt+' (1-yr)</span></div>'+
      spark+
    '</div>';
  }).join('');
  return DATA_BADGE+
    '<div class="panel"><h2>Research Terminal</h2>'+
    '<p class="hint">Click a card to open the full dossier. Tick <b>compare</b> on up to 4 cards to compare them below. '+
    ex('marketcap','Market cap')+' · '+ex('pe','P/E')+' · '+ex('grossmargin','Gross margin')+' — figures below come from bundled price &amp; fundamentals data.</p></div>'+
    '<div class="panel"><h3>Look up any ticker</h3>'+
      '<div class="frow" style="max-width:440px"><label class="f">Ticker</label>'+
      '<div style="display:flex;gap:8px">'+tickerInput('rs-any-ticker','','e.g. CELH')+'<button class="btn" id="rs-any-go">Open dossier</button></div>'+
      '<div class="hint">'+tickerHint()+' Dossiers for tickers outside the bundled set show a live chart and an honest \u201cdata unavailable\u201d for fundamentals.</div></div></div>'+
    '<div class="grid g4" id="rs-cards">'+cards+'</div>'+
    '<div class="panel" id="rs-compare-wrap" style="margin-top:14px;display:none">'+
      '<h3>Comparison <span class="small hint">— rule-based from bundled data</span></h3>'+
      '<div id="rs-compare"></div>'+
    '</div>';
}
function rsRenderCompareTable(tickers){
  const rows=[
    {label:ex('marketcap','Market cap'), fn:t=>Util.money(rsMarketCap(t))},
    {label:'Last close', fn:t=>Util.money(lastClose(t))},
    {label:ex('pe','P/E'), fn:t=>{const e=rsEPS(t),p=lastClose(t); return (e&&e>0&&p!=null)?Util.num(p/e,1):'—';}},
    {label:ex('eps','EPS (latest FY)'), fn:t=>{const e=rsEPS(t); return e==null?'—':'$'+Util.num(e,2);}},
    {label:ex('revenue','Revenue (latest FY)'), fn:t=>{const f=fundFYs(t)[0]; return f?Util.money(fundVal(t,'revenue',f)):'—';}},
    {label:'Revenue CAGR', fn:t=>{const c=rsRevenueCAGR(t); return c?Util.pct(c.cagr,1)+' <span class="small">('+Util.esc(c.from)+'→'+Util.esc(c.to)+')</span>':'—';}},
    {label:ex('grossmargin','Gross margin'), fn:t=>Util.pct(rsGrossMarginLatest(t),1)},
    {label:ex('netincome','Net income (latest FY)'), fn:t=>{const f=fundFYs(t)[0]; return f?Util.money(fundVal(t,'net_income',f)):'—';}}
  ];
  let h='<table class="tbl"><tr><th>Metric</th>'+tickers.map(t=>'<th class="num">'+Util.esc(t)+'</th>').join('')+'</tr>';
  rows.forEach(r=>{ h+='<tr><td>'+r.label+'</td>'+tickers.map(t=>'<td class="num">'+r.fn(t)+'</td>').join('')+'</tr>'; });
  return h+'</table>'+DATA_BADGE;
}
function rsAfterResearch(){
  const anyGo=document.getElementById('rs-any-go');
  if(anyGo){
    const openAny=function(){
      const t=tickerVal('rs-any-ticker');
      if(t) Router.go('#/research-ticker/'+encodeURIComponent(t));
    };
    anyGo.addEventListener('click',openAny);
    const anyIn=document.getElementById('rs-any-ticker');
    if(anyIn) anyIn.addEventListener('keydown',function(e){ if(e.key==='Enter') openAny(); });
  }
  const wrap=document.getElementById('rs-cards');
  if(!wrap) return;
  wrap.addEventListener('click', e=>{
    if(e.target.closest('.rs-cmp')) return; // checkbox handled separately
    const card=e.target.closest('.rs-card');
    if(card) Router.go('#/research-ticker/'+encodeURIComponent(card.dataset.ticker));
  });
  wrap.addEventListener('change', e=>{
    if(!e.target.classList.contains('rs-cmp')) return;
    e.stopPropagation();
    const boxes=[...wrap.querySelectorAll('.rs-cmp')];
    const picked=boxes.filter(b=>b.checked).map(b=>b.value);
    if(picked.length>4){ e.target.checked=false; alert('Comparison is limited to 4 companies.'); return; }
    boxes.forEach(b=>{ b.disabled=!b.checked&&picked.length>=4; });
    const sel=[...wrap.querySelectorAll('.rs-cmp:checked')].map(b=>b.value);
    const w=document.getElementById('rs-compare-wrap');
    if(sel.length<2){ w.style.display='none'; return; }
    w.style.display='block';
    document.getElementById('rs-compare').innerHTML=rsRenderCompareTable(sel);
    w.scrollIntoView({behavior:'smooth',block:'nearest'});
  });
}
Router.routes['research']=rsRenderResearch;
rsRenderResearch.after=rsAfterResearch;

/* ================================================================
   2. ROUTE: research-ticker — full dossier
   ================================================================ */
function rsRenderTicker(param){
  const t=String(param||'').toUpperCase().trim();
  if(!t) return '<div class="alert err">No ticker given. <a href="#/research">Back to Research Terminal</a></div>';
  if(STOCK_TICKERS.indexOf(t)<0){
    /* Any-ticker path: live chart online, honest gap for bundled data. Nothing is invented. */
    return DATA_BADGE+
    '<div class="panel"><a href="#/research" class="small">\u2190 Research Terminal</a>'+
    '<h2 style="margin:6px 0 2px"><span class="mono badge">'+Util.esc(t)+'</span></h2>'+
    '<div class="alert warn"><b>No bundled data for '+Util.esc(t)+'.</b> This ticker is outside the '+STOCK_TICKERS.length+
    ' bundled stocks, so fundamentals, ratios, and offline price history are <b>data unavailable</b> \u2014 nothing is estimated or invented. '+
    'You can: (1) view the live chart below (needs internet), (2) upload its 10-K on the <a href="#/sec-upload">SEC Filing Upload</a> page to analyze it with the Statement Analyzer, Rating, and Valuation tools.</div></div>'+
    '<div class="panel"><h3>Price chart \u2014 '+Util.esc(t)+' <span class="tag">needs internet</span></h3>'+tvEmbedHTML('rs-tv-any')+'</div>';
  }
  const f=(RealData.fundamentals||{})[t]||{};
  const bars=(RealData.prices||{})[t]||[];
  const p=lastClose(t);
  const dayChg = bars.length>1 ? (bars[bars.length-1].c-bars[bars.length-2].c)/bars[bars.length-2].c : null;
  const cap=rsMarketCap(t), eps=rsEPS(t);
  const fys=[...fundFYs(t)].sort().reverse(); // newest first
  const lat=fys[0];
  const gv=(field,fy)=>fundVal(t,field,fy);
  const M=v=>v==null?'data unavailable':Util.money(v);

  /* key stats */
  const revL=gv('revenue',lat), niL=gv('net_income',lat), gpL=gv('gross_profit',lat),
        oiL=gv('op_income',lat), aL=gv('assets',lat), tlL=gv('total_liab',lat),
        caL=gv('cur_assets',lat), clL=gv('cur_liab',lat), ieL=gv('interest_exp',lat);
  const equity=(aL!=null&&tlL!=null)?aL-tlL:null;
  const pe=(p!=null&&eps&&eps>0)?p/eps:null;
  const stats=[
    [ex('marketcap','Market cap'), cap==null?'data unavailable':Util.money(cap)],
    [ex('pe','P/E ratio'), pe==null?'data unavailable':Util.num(pe,1)],
    [ex('eps','EPS (latest FY '+Util.esc(lat||'')+')'), eps==null?'data unavailable':'$'+Util.num(eps,2)],
    [ex('revenue','Revenue (latest FY)'), M(revL)],
    [ex('netincome','Net income (latest FY)'), M(niL)],
    [ex('grossmargin','Gross margin'), (gpL!=null&&revL)?Util.pct(gpL/revL,1):'data unavailable'],
    [ex('opmargin','Operating margin'), (oiL!=null&&revL&&revL)?Util.pct(oiL/revL,1):'data unavailable'],
    [ex('roe','ROE'), (niL!=null&&equity&&equity>0)?Util.pct(niL/equity,1):'data unavailable'],
    [ex('de','Debt-to-equity'), (tlL!=null&&equity&&equity>0)?Util.num(tlL/equity,2):'data unavailable'],
    [ex('current','Current ratio'), (caL!=null&&clL&&clL)?Util.num(caL/clL,2):'data unavailable'],
    [ex('intcov','Interest coverage'), (oiL!=null&&ieL&&ieL)?Util.num(oiL/ieL,1)+'\u00d7':'data unavailable']
  ];
  const statRows=stats.map(s=>'<tr><td>'+s[0]+'</td><td class="num">'+s[1]+'</td></tr>').join('');

  /* 3-yr table */
  const yrs3=fys.slice(0,3);
  const t3='<table class="tbl"><tr><th></th>'+yrs3.map(y=>'<th class="num">FY '+Util.esc(y)+'</th>').join('')+'</tr>'+
    '<tr><td>'+ex('revenue','Revenue')+'</td>'+yrs3.map(y=>'<td class="num">'+M(gv('revenue',y))+'</td>').join('')+'</tr>'+
    '<tr><td>'+ex('netincome','Net income')+'</td>'+yrs3.map(y=>'<td class="num">'+M(gv('net_income',y))+'</td>').join('')+'</tr></table>';

  const revVals=yrs3.slice().reverse().map(y=>gv('revenue',y));
  const niVals=yrs3.slice().reverse().map(y=>gv('net_income',y));
  const revLab=yrs3.slice().reverse();
  const revChart = revVals.every(v=>v==null)? emptyBox('data unavailable') : Charts.vbar(revLab, revVals.map(v=>v||0), 340, 190, '#58a6ff');
  const niChart  = niVals.every(v=>v==null)? emptyBox('data unavailable') : Charts.vbar(revLab, niVals.map(v=>v||0), 340, 190, '#bc8cff');

  const dc=(dayChg==null)?'<span class="small">—</span>':'<span class="small" style="color:'+(dayChg>=0?'#3fb950':'#f85149')+'">'+(dayChg>=0?'+':'')+Util.pct(dayChg,2)+' today</span>';

  return DATA_BADGE+
    '<div class="panel"><a href="#/research" class="small">\u2190 Research Terminal</a>'+
    '<h2 style="margin:6px 0 2px">'+Util.esc(f.name||t)+' <span class="mono badge">'+Util.esc(t)+'</span></h2>'+
    '<div style="margin:6px 0"><span class="num" style="font-size:24px;font-weight:700">'+Util.money(p)+'</span> '+dc+'</div>'+
    '<div class="small">Market cap: <b>'+(cap==null?'data unavailable':Util.money(cap))+'</b> · CIK: <span class="mono">'+Util.esc(f.cik||'—')+'</span></div>'+
    '<div style="margin-top:10px"><button class="btn sm" id="rs-btn-rate">\u2b50 Rate this company</button> '+
    '<button class="btn sm" id="rs-btn-val">\u2696 Open valuation</button></div></div>'+
    '<div class="panel"><h3>Price — last 12 months</h3><div id="rs-lw" class="lw-chart" style="height:300px"></div></div>'+
    '<div class="grid g2">'+
      '<div class="panel"><h3>Key stats <span class="small hint">(latest FY '+Util.esc(lat||'—')+')</span></h3>'+
        '<table class="tbl">'+statRows+'</table><div class="hint">Ratios are computed from bundled fundamentals (SEC-sourced). &ldquo;data unavailable&rdquo; means the field was missing.</div></div>'+
      '<div class="panel"><h3>Last 3 fiscal years</h3>'+t3+
        '<div class="grid g2" style="margin-top:10px"><div><div class="small"><b>Revenue</b></div>'+revChart+'</div>'+
        '<div><div class="small"><b>Net income</b></div>'+niChart+'</div></div></div>'+
    '</div>'+
    '<div class="panel"><h3>What this company does</h3><p>'+Util.esc(rsSUMMARY[t]||'Business summary unavailable.')+'</p>'+
    '<div class="hint">General-knowledge summary, not filing data. Figures and ratios above come from the bundled dataset ('+DATA_BADGE.replace(/<[^>]+>/g,'').trim()+').</div></div>';
}
function rsAfterTicker(param){
  const t=String(param||'').toUpperCase();
  if(STOCK_TICKERS.indexOf(t)<0){ tvEmbedAfter('rs-tv-any', t, []); return; }
  const br=document.getElementById('rs-btn-rate');
  const bv=document.getElementById('rs-btn-val');
  if(br) br.addEventListener('click',()=>Router.go('#/rating-ticker/'+encodeURIComponent(t)));
  if(bv) bv.addEventListener('click',()=>Router.go('#/valuation'));
  lwCandles('rs-lw', ((RealData.prices||{})[t]||[]).slice(-252), {h:300, volume:true});
}
Router.routes['research-ticker']=rsRenderTicker;
rsRenderTicker.after=rsAfterTicker;

/* ================================================================
   Filing library (global, shared with other chunks)
   ================================================================ */
const FilingLib = {
  list(){ Store.load(); return (Store.db.filings||[]).slice().sort(rsDatedFilingSort); },
  get(id){ return this.list().find(f=>f.id===id)||null; },
  /* most recent uploaded filing for a ticker, or null (callers fall back to RealData) */
  figuresFor(ticker){
    const t=String(ticker||'').toUpperCase();
    const hits=this.list().filter(f=>String(f.ticker||'').toUpperCase()===t);
    return hits.length?hits[0]:null;
  }
};

/* ================================================================
   3. ROUTE: sec-upload — XBRL / companyfacts / 10-K heuristic / SEC fetch
   ================================================================ */
function rsNumFromText(s){
  if(s==null) return null;
  let x=String(s).trim();
  let neg=false;
  if(/^\(.*\)$/.test(x)){ neg=true; x=x.slice(1,-1); }
  x=x.replace(/[$,\s\u00a0]/g,'');
  if(!/^-?\d+(\.\d+)?$/.test(x)) return null;
  const v=parseFloat(x);
  return neg?-Math.abs(v):v;
}

function rsParseXBRLInstance(text){
  const doc=new DOMParser().parseFromString(text,'application/xml');
  if(doc.getElementsByTagName('parsererror').length) throw new Error('File is not valid XML.');
  const els=doc.getElementsByTagName('*');
  const ctxYear={};
  for(let i=0;i<els.length;i++){
    const el=els[i];
    const ln=el.localName||String(el.tagName).split(':').pop();
    if(ln!=='context') continue;
    const id=el.getAttribute('id'); if(!id) continue;
    for(const c of el.children){
      const cl=c.localName||String(c.tagName).split(':').pop();
      if(cl!=='period') continue;
      for(const pc of c.children){
        const pl=pc.localName||String(pc.tagName).split(':').pop();
        if(pl==='endDate'){
          const m=/^(\d{4})-\d{2}-\d{2}$/.exec(pc.textContent.trim());
          if(m) ctxYear[id]=m[1];
        }
      }
    }
  }
  const figures={}, usedTag={};
  rsXBRL_MAP.forEach(mp=>{
    figures[mp.field]=[];
    for(const tag of mp.tags){
      const byYear={};
      for(let i=0;i<els.length;i++){
        const el=els[i];
        const ln=el.localName||String(el.tagName).split(':').pop();
        if(ln!==tag) continue;
        const ctx=el.getAttribute('contextRef');
        const fy=ctxYear[ctx]; if(!fy) continue;
        let v=rsNumFromText(el.textContent);
        if(v==null) continue;
        /* NOTE: per the EDGAR XBRL Guide, "decimals" describes rounding accuracy,
           it is NOT a scale factor — the reported value is used as-is. */
        const sign=el.getAttribute('sign');
        if(sign==='-') v=-Math.abs(v);
        byYear[fy]=v; /* latest occurrence wins */
      }
      const fys=Object.keys(byYear).sort().reverse().slice(0,3);
      if(fys.length){
        usedTag[mp.field]=tag;
        figures[mp.field]=fys.map(fy=>({fy:fy,val:byYear[fy],tag:tag}));
        break; /* first tag in priority list wins */
      }
    }
  });
  const anyFy=rsFIG_ORDER.flatMap(k=>figures[k].map(r=>r.fy));
  if(!anyFy.length) throw new Error('No recognized us-gaap facts found in this file.');
  return {figures:figures, fyEnd:anyFy.sort().reverse()[0], usedTag:usedTag};
}

function rsParseCompanyFacts(obj){
  const facts=((obj||{}).facts||{})['us-gaap'];
  if(!facts) throw new Error('Not an EDGAR companyfacts file (missing facts.us-gaap).');
  const figures={}, usedTag={};
  rsXBRL_MAP.forEach(mp=>{
    let best=null, bestTag=null;
    for(const tag of mp.tags){
      const entry=facts[tag]; if(!entry||!entry.units) continue;
      const cand={}; /* fy -> {val, filed, form} */
      Object.keys(entry.units).forEach(u=>{
        (entry.units[u]||[]).forEach(r=>{
          const fy=String(r.fy||String(r.end||'').slice(0,4)||'');
          if(!/^\d{4}$/.test(fy)||r.val==null) return;
          const prev=cand[fy];
          const score=(r.form==='10-K'?2:(r.form==='10-Q'?1:0));
          const prevScore=prev?(prev.form==='10-K'?2:(prev.form==='10-Q'?1:0)):-1;
          if(!prev||score>prevScore||(score===prevScore&&String(r.filed||'')>String(prev.filed||'')))
            cand[fy]={val:r.val,filed:r.filed||'',form:r.form||''};
        });
      });
      const fys=Object.keys(cand).sort().reverse().slice(0,3);
      if(fys.length){
        best=fys.map(fy=>({fy:fy,val:cand[fy].val,tag:tag,form:cand[fy].form}));
        bestTag=tag;
        break;
      }
    }
    figures[mp.field]=best||[];
    if(bestTag) usedTag[mp.field]=bestTag;
  });
  const anyFy=rsFIG_ORDER.flatMap(k=>figures[k].map(r=>r.fy));
  if(!anyFy.length) throw new Error('No recognized us-gaap facts found in this file.');
  return {figures:figures, fyEnd:anyFy.sort().reverse()[0], usedTag:usedTag};
}

/* heuristic regexes for raw 10-K text/HTML */
const rsHEUR_PATTERNS = [
  {field:'revenue',  rx:[/total\s+net\s+revenues?/i,/net\s+revenues?/i,/total\s+revenues?/i,/total\s+net\s+sales/i,/net\s+sales/i,/total\s+sales/i]},
  {field:'net_income',rx:[/net\s+income\s*(\(loss\))?/i,/net\s+earnings/i,/net\s+income\s+attributable/i]},
  {field:'gross_profit',rx:[/gross\s+profit/i]},
  {field:'op_income', rx:[/operating\s+income/i,/income\s+from\s+operations/i]},
  {field:'assets',    rx:[/total\s+assets/i]},
  {field:'cur_assets',rx:[/total\s+current\s+assets/i]},
  {field:'cur_liab',  rx:[/total\s+current\s+liabilities/i]},
  {field:'total_liab',rx:[/total\s+liabilities(?!(\s+and))/i]},
  {field:'lt_debt',   rx:[/long[-\s]term\s+debt/i]},
  {field:'retained',  rx:[/retained\s+earnings/i]},
  {field:'op_cash',   rx:[/net\s+cash\s+provided\s+by\s+operating\s+activities/i,/cash\s+provided\s+by\s+operating\s+activities/i]},
  {field:'shares_dil',rx:[/weighted[-\s]?average[\s\S]{0,40}?diluted[\s\S]{0,20}?shares/i,/diluted[\s\S]{0,30}?weighted[-\s]?average\s+shares/i]},
  {field:'interest_exp',rx:[/interest\s+expense/i]}
];
function rsStripHtml(s){ return String(s).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' '); }
function rsHeuristicParse(text){
  const plain=rsStripHtml(text).slice(0,2000000);
  const figures={};
  rsHEUR_PATTERNS.forEach(p=>{
    figures[p.field]=[];
    for(const rx of p.rx){
      rx.lastIndex=0;
      const m=rx.exec(plain);
      if(!m) continue;
      const window_=plain.slice(m.index, m.index+400);
      const dm=/\$\s*\(?\s*([\d,]+(?:\.\d+)?)\s*\)?/.exec(window_) || /\(?\b([\d,]{4,}(?:\.\d+)?)\)?/.exec(window_);
      if(!dm) continue;
      let v=rsNumFromText(dm[1]);
      if(v==null) continue;
      if(window_.indexOf('(')!==-1 && window_.indexOf(dm[1])>window_.indexOf('(')) v=-Math.abs(v);
      figures[p.field]=[{fy:'?',val:v,heuristic:true}];
      break;
    }
  });
  let fy=null;
  const fm=/for\s+the\s+fiscal\s+year\s+ended[^\d]{0,40}?(\d{4})/i.exec(plain) ||
           /fiscal\s+year\s+ended[^\d]{0,40}?(\d{4})/i.exec(plain) ||
           /year\s+ended\s+[A-Za-z]+\s+\d{1,2},?\s*(\d{4})/i.exec(plain);
  if(fm) fy=fm[1];
  rsFIG_ORDER.forEach(k=>{ figures[k].forEach(r=>{ if(fy) r.fy=fy; }); });
  const found=rsFIG_ORDER.some(k=>figures[k].length);
  if(!found) throw new Error('Heuristic scan found no figures. Try the XBRL or companyfacts upload instead.');
  return {figures:figures, fyEnd:fy||'unknown'};
}

function rsFilingSummary(f){
  const n=rsFIG_ORDER.filter(k=>(f.figures[k]||[]).length).length;
  return n+' figures · FY '+Util.esc(f.fyEnd||'?')+' · '+Util.esc(f.source||'')+' · uploaded '+Util.esc(f.uploaded||'');
}

function rsRenderSecUpload(){
  const saved=FilingLib.list();
  const savedHtml = saved.length ? saved.map(f=>
    '<div class="panel" style="margin:8px 0"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px">'+
    '<div><b>'+Util.esc(f.ticker||'?')+'</b> — '+Util.esc(f.company||'')+'<br>'+
    '<span class="small">'+rsFilingSummary(f)+'</span><br>'+
    '<span class="tag">'+Util.esc(f.confidence||'')+'</span></div>'+
    '<button class="btn sm rs-del-fil" data-id="'+Util.esc(f.id)+'">Delete</button></div></div>'
  ).join('') : emptyBox('No filings saved yet. Upload one above.');

  return DATA_BADGE+
  '<div class="panel"><h2>SEC Filing Upload</h2>'+
  '<p class="hint">Bring your own filing data — nothing is sent anywhere; files are parsed in your browser and stored only in this app (localStorage). '+
  'XBRL-tagged uploads are parsed precisely. Raw 10-K text is scanned with heuristics and every figure is flagged <b>verify</b>.</p>'+
  '<p>'+ex('xbrl','What is XBRL?')+'</p></div>'+

  '<div class="grid g2">'+
  '<div class="panel"><h3>A. Upload XBRL instance (.xml)</h3>'+
    '<p class="hint">From the EDGAR filing index, open the \u201cFinancial Report\u201d (R files) and save the XML instance document, then upload it here.</p>'+
    fieldRow('XBRL instance file','<input type="file" id="rs-f-xbrl" accept=".xml,.xbrl,text/xml">')+
    '<button class="btn" id="rs-b-xbrl">Parse XBRL</button></div>'+
  '<div class="panel"><h3>B. Upload EDGAR companyfacts (.json)</h3>'+
    '<p class="hint">Download from the SEC companyfacts API for a company, or save a previous fetch. Easiest parse — same XBRL-tagged precision.</p>'+
    fieldRow('companyfacts JSON file','<input type="file" id="rs-f-facts" accept=".json,application/json">')+
    '<button class="btn" id="rs-b-facts">Parse companyfacts</button></div>'+
  '</div>'+
  '<div class="grid g2">'+
  '<div class="panel"><h3>C. Upload raw 10-K (.htm / .txt)</h3>'+
    '<p class="hint">Heuristic scan — <b>every figure is flagged &ldquo;verify — heuristic parse, confirm against the filing&rdquo;</b>. Use only as a starting point.</p>'+
    fieldRow('10-K file','<input type="file" id="rs-f-htm" accept=".htm,.html,.txt">')+
    '<button class="btn" id="rs-b-htm">Heuristic scan</button></div>'+
  '<div class="panel"><h3>D. Fetch by ticker <span class="small hint">(needs internet)</span></h3>'+
    '<p class="hint">Pulls the company\u2019s full XBRL fact history straight from SEC EDGAR. Offline? Use a file upload instead.</p>'+
    fieldRow('Ticker', textInput('rs-f-ticker','','e.g. AAPL'))+
    '<button class="btn" id="rs-b-fetch">Fetch from SEC EDGAR</button>'+
    '<div class="small hint" style="margin-top:6px">Endpoint: <span class="mono">https://data.sec.gov/api/xbrl/companyfacts/</span></div></div>'+
  '</div>'+

  '<div class="panel"><h3>Extracted figures</h3><div id="rs-extract-out">'+emptyBox('Parse or fetch a filing to see extracted figures here.')+'</div></div>'+

  '<div class="panel"><h3>Saved filings <span class="small hint">(localStorage)</span></h3><div id="rs-saved">'+savedHtml+'</div></div>';
}

function rsReadFile(inputId, cb){
  const inp=document.getElementById(inputId);
  const f=inp&&inp.files&&inp.files[0];
  if(!f){ rsExtractError('Choose a file first.'); return; }
  if(f.size>15*1024*1024){ rsExtractError('File too large (over 15 MB).'); return; }
  const r=new FileReader();
  r.onload=()=>cb(f.name, String(r.result||''));
  r.onerror=()=>rsExtractError('Could not read the file.');
  r.readAsText(f);
}
function rsExtractError(msg){
  document.getElementById('rs-extract-out').innerHTML='<div class="alert err">'+Util.esc(msg)+'</div>';
}
function rsShowExtracted(res, sourceLabel, confidence, company, ticker){
  const rows=rsFIG_ORDER.map(k=>{
    const arr=res.figures[k]||[];
    const cell=arr.length
      ? arr.map(r=>'<span class="num">'+Util.money(r.val)+'</span> <span class="small">FY '+Util.esc(r.fy)+'</span>'+(r.tag?' <span class="small mono">'+Util.esc(r.tag)+'</span>':'')).join('<br>')
      : '<span class="hint">not found</span>';
    return '<tr><td>'+Util.esc(rsFIG_LABELS[k])+'</td><td class="num">'+cell+'</td>'+
      '<td><span class="tag">'+Util.esc(confidence)+'</span></td></tr>';
  }).join('');
  const t=(ticker||'').toUpperCase();
  document.getElementById('rs-extract-out').innerHTML=
    '<div class="alert '+(confidence.indexOf('verify')===0?'warn':'ok')+'">Source: <b>'+Util.esc(sourceLabel)+'</b> · Confidence: <b>'+Util.esc(confidence)+'</b>'+(res.fyEnd?' · Latest FY: '+Util.esc(res.fyEnd):'')+'</div>'+
    '<table class="tbl"><tr><th>Figure</th><th class="num">Value</th><th>Confidence</th></tr>'+rows+'</table>'+
    '<div style="margin-top:10px" class="grid g2">'+
      fieldRow('Ticker for this filing', textInput('rs-save-ticker', t, 'e.g. AAPL'))+
      fieldRow('Company name', textInput('rs-save-company', company||'', 'e.g. Apple Inc.'))+
    '</div>'+
    '<button class="btn" id="rs-b-save">Save filing to library</button>';
  document.getElementById('rs-b-save').addEventListener('click',()=>{
    const tk=document.getElementById('rs-save-ticker').value.trim().toUpperCase();
    const cn=document.getElementById('rs-save-company').value.trim();
    if(!tk){ alert('Enter a ticker before saving.'); return; }
    Store.load();
    Store.db.filings.push({
      id:Util.uid('fil'), ticker:tk, company:cn||tk,
      fyEnd:res.fyEnd||'unknown', source:sourceLabel, confidence:confidence,
      figures:res.figures, uploaded:Util.today()
    });
    Store.save();
    Router.render();
  });
}

function rsAfterSecUpload(){
  const wire=(btnId,fileId,parseFn,sourceFor)=>{
    const b=document.getElementById(btnId);
    if(!b) return;
    b.addEventListener('click',()=>rsReadFile(fileId,(name,text)=>{
      let res;
      try{ res=parseFn(text); }
      catch(e){ rsExtractError(e.message); return; }
      rsShowExtracted(res, sourceFor(name), parseFn===rsHeuristicParse?'verify — heuristic parse, confirm against the filing':'precise (XBRL-tagged)', '', '');
    }));
  };
  wire('rs-b-xbrl','rs-f-xbrl',rsParseXBRLInstance,name=>'XBRL instance upload ('+name+')');
  wire('rs-b-facts','rs-f-facts',t=>rsParseCompanyFacts(JSON.parse(t)),()=>'EDGAR companyfacts JSON upload');
  wire('rs-b-htm','rs-f-htm',rsHeuristicParse,name=>'10-K heuristic scan ('+name+')');

  const bf=document.getElementById('rs-b-fetch');
  if(bf) bf.addEventListener('click',()=>{
    const t=document.getElementById('rs-f-ticker').value.trim().toUpperCase();
    const out=document.getElementById('rs-extract-out');
    if(!t){ rsExtractError('Enter a ticker first.'); return; }
    const f=(RealData.fundamentals||{})[t];
    if(!f||!f.cik){ rsExtractError('No CIK for '+t+' in the bundled dataset — upload a file instead.'); return; }
    const cik=String(f.cik).padStart(10,'0');
    const url='https://data.sec.gov/api/xbrl/companyfacts/CIK'+cik+'.json';
    out.innerHTML='<div class="hint">Fetching '+Util.esc(url)+' …</div>';
    fetch(url,{headers:{'User-Agent':'FinanceSuite personal research tool','Accept-Encoding':'gzip','Host':'data.sec.gov'}})
      .then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(j=>{
        let res;
        try{ res=rsParseCompanyFacts(j); }
        catch(e){ rsExtractError(e.message); return; }
        rsShowExtracted(res,'SEC EDGAR online fetch ('+url+')','precise (XBRL-tagged)', f.name||t, t);
      })
      .catch(()=>{
        out.innerHTML='<div class="alert err">Could not reach SEC EDGAR — you may be offline; use file upload instead.</div>';
      });
  });

  const saved=document.getElementById('rs-saved');
  if(saved) saved.addEventListener('click',e=>{
    const b=e.target.closest('.rs-del-fil'); if(!b) return;
    if(!confirm('Delete this saved filing?')) return;
    Store.load();
    Store.db.filings=(Store.db.filings||[]).filter(x=>x.id!==b.dataset.id);
    Store.save();
    Router.render();
  });
}
Router.routes['sec-upload']=rsRenderSecUpload;
rsRenderSecUpload.after=rsAfterSecUpload;

/* ================================================================
   4. ROUTE: filings — Filing Detective (before/after)
   ================================================================ */
function rsAutoNote(field, oldV, newV, chg){
  /* rule-based notes, labeled as such by caller */
  const pc=Util.pct(chg,1);
  switch(field){
    case 'revenue': return chg>0?'Revenue grew '+pc+' — top-line expansion':'Revenue fell '+pc+' — top-line contraction';
    case 'net_income': return chg>0?'Net income up '+pc+' — profitability improving':'Net income down '+pc+' — profitability weakening';
    case 'gross_profit': return chg>0?'Gross profit up '+pc:'Gross profit down '+pc;
    case 'op_income': return chg>0?'Operating income up '+pc+' — core business stronger':'Operating income down '+pc+' — core business weaker';
    case 'assets': return 'Assets '+(chg>0?'up ':'down ')+pc;
    case 'lt_debt': return chg>0?'LT debt up '+pc+' — leverage rising':'LT debt down '+pc+' — debt paydown';
    case 'total_liab': return chg>0?'Total liabilities up '+pc:'Total liabilities down '+pc;
    case 'retained': return chg>0?'Retained earnings up '+pc+' — profits accumulating':'Retained earnings down '+pc;
    case 'op_cash': return chg>0?'Operating cash flow up '+pc+' — cash generation improving':'Operating cash flow down '+pc+' — cash generation weakening';
    case 'shares_dil': return chg>0?'Share count up '+pc+' — possible dilution or fewer buybacks':'Share count down '+pc+' — buybacks shrinking the share count';
    case 'interest_exp': return chg>0?'Interest expense up '+pc+' — debt getting costlier':'Interest expense down '+pc;
    default: return 'Changed '+pc;
  }
}
function rsFigSource(figs, field){
  /* figures in RealData shape {field:[{fy,val}]} or filing shape */
  const arr=(figs||{})[field]||[];
  if(!arr.length) return null;
  return arr.slice().sort((a,b)=>String(a.fy)<String(b.fy)?1:-1)[0];
}
function rsCompareSources(aFigs, aLabel, bFigs, bLabel){
  const rows=[];
  rsFIG_ORDER.forEach(k=>{
    const a=rsFigSource(aFigs,k), b=rsFigSource(bFigs,k);
    if(!a||!b) return;
    const d=b.val-a.val;
    const chg=(a.val!==0)?d/Math.abs(a.val):null;
    rows.push({field:k,label:rsFIG_LABELS[k],a:a,b:b,d:d,chg:chg,
      note:(chg==null?'—':'Rule-based note: '+rsAutoNote(k,a.val,b.val,chg))});
  });
  if(!rows.length) return '<div class="alert warn">No overlapping figures between the two sources.</div>';
  let h='<table class="tbl"><tr><th>Figure</th><th class="num">Before<br><span class="small">'+Util.esc(aLabel)+'</span></th>'+
    '<th class="num">After<br><span class="small">'+Util.esc(bLabel)+'</span></th>'+
    '<th class="num">Δ $</th><th class="num">Δ %</th><th>Rule-based note</th></tr>';
  rows.forEach(r=>{
    const dcol=r.d===0?'':(r.d>0?'color:#3fb950':'color:#f85149');
    h+='<tr><td>'+Util.esc(r.label)+'</td>'+
      '<td class="num">'+Util.money(r.a.val)+' <span class="small">FY '+Util.esc(r.a.fy)+'</span></td>'+
      '<td class="num">'+Util.money(r.b.val)+' <span class="small">FY '+Util.esc(r.b.fy)+'</span></td>'+
      '<td class="num" style="'+dcol+'">'+(r.d>=0?'+':'')+Util.money(r.d)+'</td>'+
      '<td class="num" style="'+dcol+'">'+Util.pct(r.chg,1)+'</td>'+
      '<td class="small">'+Util.esc(r.note)+'</td></tr>';
  });
  return h+'</table><div class="hint">Notes are generated by fixed rules from the numbers above — <b>assistive (rule-based), not analysis or advice</b>. '+
    'Every figure carries its source label; confirm against the original filing.</div>';
}

function rsRenderFilings(){
  const saved=FilingLib.list();
  if(saved.length<1)
    return DATA_BADGE+'<div class="panel"><h2>Filing Detective</h2>'+
      '<div class="alert warn"><b>How to use:</b> upload at least one filing on the <a href="#/sec-upload">SEC Filing Upload</a> page, then come back here. '+
      'You can compare two saved filings, or compare one filing against the bundled RealData fundamentals for the same ticker.</div></div>';
  const opts=saved.map(f=>'<option value="'+Util.esc(f.id)+'">'+Util.esc(f.ticker)+' · '+Util.esc(f.source)+' · FY '+Util.esc(f.fyEnd)+' ('+Util.esc(f.uploaded)+')</option>').join('');
  return DATA_BADGE+
  '<div class="panel"><h2>Filing Detective</h2>'+
  '<p class="hint">Pick two sources and see what changed, figure by figure. Notes are <b>rule-based</b> (fixed templates), not AI analysis.</p>'+
  '<div class="grid g2">'+
    fieldRow('Source A (before)','<select class="in" id="rs-fa">'+opts+'</select>')+
    fieldRow('Source B (after)','<select class="in" id="rs-fb"><option value="__real__">RealData fundamentals baseline (same ticker)</option>'+opts+'</select>')+
  '</div>'+
  '<button class="btn" id="rs-b-cmp">Compare</button></div>'+
  '<div class="panel"><h3>Delta table</h3><div id="rs-delta">'+emptyBox('Choose two sources and press Compare.')+'</div></div>';
}
function rsAfterFilings(){
  const b=document.getElementById('rs-b-cmp');
  if(!b) return;
  b.addEventListener('click',()=>{
    const fa=FilingLib.get(document.getElementById('rs-fa').value);
    const fbVal=document.getElementById('rs-fb').value;
    if(!fa){ document.getElementById('rs-delta').innerHTML='<div class="alert err">Pick source A.</div>'; return; }
    let bFigs, bLabel;
    if(fbVal==='__real__'){
      bFigs=(RealData.fundamentals||{})[fa.ticker];
      bLabel='RealData baseline · '+fa.ticker;
      if(!bFigs){ document.getElementById('rs-delta').innerHTML='<div class="alert err">No RealData fundamentals for '+Util.esc(fa.ticker)+'.</div>'; return; }
    }else{
      const fb=FilingLib.get(fbVal);
      if(!fb||fb.id===fa.id){ document.getElementById('rs-delta').innerHTML='<div class="alert err">Pick a different source B.</div>'; return; }
      bFigs=fb.figures; bLabel=fb.source+' · FY '+fb.fyEnd;
    }
    const aLabel=fa.source+' · FY '+fa.fyEnd;
    document.getElementById('rs-delta').innerHTML=rsCompareSources(fa.figures,aLabel,bFigs,bLabel);
  });
}
Router.routes['filings']=rsRenderFilings;
rsRenderFilings.after=rsAfterFilings;

/* ================================================================
   5. ROUTE: earnings — Earnings call workspace
   ================================================================ */
const rsBULL_WORDS=['growth','record','raised guidance','raise guidance','margin expansion','beat','beats','outperform','strong demand','backlog','expansion','momentum','tailwind','accelerat'];
const rsBEAR_WORDS=['headwind','cut guidance','lower guidance','guidance cut','decline','declines','layoffs','miss','misses','weak','slowdown','restructuring','impairment','uncertain','pressure'];

function rsHighlight(text){
  let h=Util.esc(text);
  let bull=0, bear=0;
  const mark=(words,cls,cntFn)=>{
    words.slice().sort((a,b)=>b.length-a.length).forEach(w=>{
      const rx=new RegExp('('+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi');
      h=h.replace(rx,(m)=>{ cntFn(); return '<span class="'+cls+'">'+m+'</span>'; });
    });
  };
  mark(rsBULL_WORDS,'rs-bull',()=>bull++);
  mark(rsBEAR_WORDS,'rs-bear',()=>bear++);
  return {html:h,bull:bull,bear:bear};
}

function rsRenderEarnings(){
  const saved=(Store.db.transcripts||[]);
  const tickOpts=STOCK_TICKERS.map(t=>'<option value="'+Util.esc(t)+'">'+Util.esc(t)+'</option>').join('');
  const listHtml=saved.length?saved.slice().reverse().map(n=>
    '<div class="panel" style="margin:8px 0"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px">'+
    '<div><b class="mono">'+Util.esc(n.ticker)+'</b> <span class="small">'+Util.esc(n.date||'')+'</span><br>'+
    '<span class="small">Revenue result: '+Util.esc(n.revenueResult||'—')+' · Guidance: '+Util.esc(n.guidance||'—')+
    ' · <span class="rs-bull">'+n.bullCount+' bullish hits</span> / <span class="rs-bear">'+n.bearCount+' bearish hits</span></span></div>'+
    '<div><button class="btn sm rs-view-n" data-id="'+Util.esc(n.id)+'">View</button> '+
    '<button class="btn sm rs-del-n" data-id="'+Util.esc(n.id)+'">Delete</button></div></div></div>'
  ).join(''):emptyBox('No saved call notes yet.');
  return DATA_BADGE+
  '<div class="panel"><h2>Earnings Call Workspace</h2>'+
  '<p class="hint">Paste a transcript or your own call notes. Keyword highlighting is <b>keyword highlighting only — not sentiment analysis</b>; it counts word hits, nothing more. '+
  'Then fill in the guided extraction and save it per ticker. Everything stays in this app.</p>'+
  fieldRow('Ticker',tickerInput('rs-e-ticker','','e.g. AAPL'))+
  fieldRow('Transcript / call notes (paste here)','<textarea class="in" id="rs-e-text" rows="8" placeholder="Paste earnings call transcript or your notes…"></textarea>')+
  '<button class="btn" id="rs-b-hl">Highlight keywords</button></div>'+
  '<div class="panel"><h3>Keyword hits <span class="small hint">— keyword highlighting only, not sentiment analysis</span></h3>'+
  '<div id="rs-e-out">'+emptyBox('Press \u201cHighlight keywords\u201d to see matches.')+'</div></div>'+
  '<div class="panel"><h3>Guided extraction <span class="small hint">— assistive (rule-based) form, your own words</span></h3>'+
  '<div class="grid g2">'+
    fieldRow('Revenue result vs expectations','<select class="in" id="rs-e-rev"><option value="">—</option><option>Beat</option><option>Met</option><option>Missed</option><option>Unclear</option></select>')+
    fieldRow('Guidance','<select class="in" id="rs-e-gui"><option value="">—</option><option>Raised</option><option>Maintained</option><option>Lowered</option><option>Unclear</option></select>')+
  '</div>'+
  fieldRow('Margin commentary',textInput('rs-e-margin','','e.g. gross margin expanded on mix…'))+
  fieldRow('Key risks mentioned','<textarea class="in" id="rs-e-risks" rows="3" placeholder="e.g. tariffs, weak China demand…"></textarea>')+
  '<button class="btn" id="rs-b-save-n">Save call notes</button></div>'+
  '<div class="panel"><h3>Saved call notes</h3><div id="rs-e-list">'+listHtml+'</div><div id="rs-e-view"></div></div>';
}

function rsAfterEarnings(){
  let lastCounts={bull:0,bear:0};
  const hb=document.getElementById('rs-b-hl');
  if(hb) hb.addEventListener('click',()=>{
    const txt=document.getElementById('rs-e-text').value;
    if(!txt.trim()){ document.getElementById('rs-e-out').innerHTML=emptyBox('Paste some text first.'); return; }
    const r=rsHighlight(txt);
    lastCounts={bull:r.bull,bear:r.bear};
    document.getElementById('rs-e-out').innerHTML=
      '<div style="margin-bottom:8px"><span class="tag"><span class="rs-bull">'+r.bull+' bullish word hits</span></span> '+
      '<span class="tag"><span class="rs-bear">'+r.bear+' bearish word hits</span></span> '+
      '<span class="small hint">keyword highlighting only — not sentiment analysis</span></div>'+
      '<div class="panel" style="white-space:pre-wrap;max-height:320px;overflow:auto">'+r.html+'</div>';
  });
  const sb=document.getElementById('rs-b-save-n');
  if(sb) sb.addEventListener('click',()=>{
    const t=document.getElementById('rs-e-ticker').value;
    const txt=document.getElementById('rs-e-text').value.trim();
    if(!txt){ alert('Paste transcript/notes before saving.'); return; }
    const r=rsHighlight(txt);
    Store.load();
    Store.db.transcripts.push({
      id:Util.uid('tr'), ticker:t, date:Util.today(),
      revenueResult:document.getElementById('rs-e-rev').value,
      guidance:document.getElementById('rs-e-gui').value,
      marginNotes:document.getElementById('rs-e-margin').value.trim(),
      risks:document.getElementById('rs-e-risks').value.trim(),
      bullCount:r.bull, bearCount:r.bear,
      excerpt:txt.slice(0,2000)
    });
    Store.save();
    Router.render();
  });
  const list=document.getElementById('rs-e-list');
  if(list) list.addEventListener('click',e=>{
    const dv=e.target.closest('.rs-del-n');
    const vw=e.target.closest('.rs-view-n');
    if(dv){
      if(!confirm('Delete these call notes?')) return;
      Store.load();
      Store.db.transcripts=(Store.db.transcripts||[]).filter(x=>x.id!==dv.dataset.id);
      Store.save(); Router.render(); return;
    }
    if(vw){
      const n=(Store.db.transcripts||[]).find(x=>x.id===vw.dataset.id);
      if(!n) return;
      document.getElementById('rs-e-view').innerHTML=
        '<div class="panel" style="margin-top:10px"><h4>'+Util.esc(n.ticker)+' — '+Util.esc(n.date)+'</h4>'+
        '<p class="small"><b>Revenue result:</b> '+Util.esc(n.revenueResult||'—')+' · <b>Guidance:</b> '+Util.esc(n.guidance||'—')+'<br>'+
        '<b>Margin commentary:</b> '+Util.esc(n.marginNotes||'—')+'<br><b>Key risks:</b> '+Util.esc(n.risks||'—')+'<br>'+
        '<b>Keyword hits:</b> '+n.bullCount+' bullish / '+n.bearCount+' bearish (keyword highlighting only — not sentiment analysis)</p>'+
        '<div class="hint" style="white-space:pre-wrap;max-height:260px;overflow:auto">'+Util.esc(n.excerpt||'')+'</div></div>';
      document.getElementById('rs-e-view').scrollIntoView({behavior:'smooth'});
    }
  });
}
Router.routes['earnings']=rsRenderEarnings;
rsRenderEarnings.after=rsAfterEarnings;
