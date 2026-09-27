/* ================================================================
   FINANCE SUITE — 05-lab.js (Lab chunk)
   Routes: theses, thesis, thesis-new, graveyard, briefing,
   briefing-view, similar, glossary, settings.
   Plain JS, concatenated after 00-core.js. No <script> tags.
   Rules honored: RealData/user input only, "data unavailable" for
   missing fields, rule-based helpers labeled "assistive (rule-based)",
   no AI/live claims, no external URLs.
   ================================================================ */

/* ---------------- Lab explainers ---------------- */
(function registerLabExplain(){
  const A=(k,t,what,why,good)=>EX.add(k,t,what,why,good);
  A('lb-fifo','FIFO accounting','First-in, first-out: when you sell shares, the shares you bought earliest are counted as sold first.','It decides which purchase price your profit is measured against when you sell part of a position.','FIFO is the standard default; it keeps realized profit math consistent and auditable.');
  A('lb-thesis','Investment thesis','A written, checkable claim about why a stock should do well \u2014 specific enough that you can later say it was right or wrong.','Writing it down stops hindsight: you can\u2019t quietly rewrite why you bought.','A good thesis has falsifiable claims with dates, not vibes.');
  A('lb-health','Thesis health','The share of a thesis\u2019s claims currently marked \u2018true\u2019.','It\u2019s a quick read on whether your original reasoning is holding up.','Health should fall sometimes \u2014 claims that never break were probably too vague to test.');
  A('lb-graveyard','Idea graveyard','A log of stock ideas you considered but did NOT buy, plus ones you bought and closed.','Reviewing skipped ideas teaches you whether your filters help or just make you miss winners.','The graveyard only works if you log ideas before you know the outcome.');
  A('lb-briefing','What Changed Today','A short manual briefing you write yourself: headline, what happened, and why it matters to you.','Forcing yourself to write the \u2018so what\u2019 turns news noise into an actual view.','Good briefings are short and opinionated; bad ones are just headlines.');
  A('lb-similar','Find similar stocks','Ranks the 15 covered stocks by how alike their financial profiles are across 8 axes (P/E, size, growth, margins, returns, leverage, efficiency).','It finds comparable companies so you can sanity-check a valuation against real peers.','Similarity is about financial shape, not business quality \u2014 always read the actual business too.');
})();

/* ---------------- Lab shared helpers ---------------- */
function lbByDate(a,b){ return a.date<b.date?-1:(a.date>b.date?1:0); }
function lbTradeTickers(){
  const s=new Set(STOCK_TICKERS||[]);
  ['SPY','QQQ'].forEach(t=>{ if((RealData.prices||{})[t]&&RealData.prices[t].length) s.add(t); });
  return Array.from(s).sort();
}
function lbTickerOptions(sel){
  return lbTradeTickers().map(t=>'<option value="'+Util.esc(t)+'"'+(t===sel?' selected':'')+'>'+Util.esc(t)+'</option>').join('');
}
function lbCoName(t){
  const f=(RealData.fundamentals||{})[t];
  return f&&f.name?f.name:t;
}
function lbDateInput(id,val){
  return '<input class="in" type="date" id="'+id+'" value="'+Util.esc(val||Util.today())+'" min="2024-09-25" max="2026-09-25">';
}
function lbDelBtn(kind,id,label){
  return '<button class="btn sm danger" data-lb-delkind="'+kind+'" data-lb-delid="'+Util.esc(id)+'">'+Util.esc(label||'Delete')+'</button>';
}
/* global delegation for lab delete buttons + back links */
document.addEventListener('click', function(e){
  const d=e.target.closest('[data-lb-delkind]');
  if(!d) return;
  const kind=d.getAttribute('data-lb-delkind'), id=d.getAttribute('data-lb-delid');
  if(!confirm('Delete this record? This cannot be undone.')) return;
  const db=Store.db;
  if(kind==='thesis'){ db.theses=(db.theses||[]).filter(t=>t.id!==id); }
  else if(kind==='idea'){ db.ideas=(db.ideas||[]).filter(t=>t.id!==id); }
  else if(kind==='brief'){ db.briefs=(db.briefs||[]).filter(t=>t.id!==id); }
  Store.save();
  Router.render();
});

/* ================= THESES ================= */
function lbThesisHealth(th){
  const n=(th.claims||[]).length;
  if(!n) return 0;
  return th.claims.filter(c=>c.status==='true').length/n;
}
function lbRenderTheses(){
  const ths=Store.db.theses||[];
  let h='<h2>Thesis Tracker '+ex('lb-thesis','')+'</h2>'+DATA_BADGE;
  h+='<div class="frow"><a class="btn" href="#/thesis-new">New thesis</a></div>';
  if(!ths.length) return h+emptyBox('No theses yet. Write your first one \u2014 a thesis is a falsifiable claim, not a feeling.');
  h+='<div class="grid g2">';
  for(const th of ths.slice().sort((a,b)=>(b.created||'').localeCompare(a.created||''))){
    const hp=lbThesisHealth(th), n=(th.claims||[]).length;
    const open=(th.claims||[]).filter(c=>c.status==='open').length;
    h+='<div class="panel"><h3>'+Util.esc(th.title)+'</h3>'
      +'<div class="small">'+Util.esc(th.ticker)+' \u00b7 '+Util.esc(lbCoName(th.ticker))+' \u00b7 created '+Util.esc(th.created||'')+'</div>'
      +'<div class="bar" style="margin-top:8px"><i style="width:'+Math.round(hp*100)+'%"></i></div>'
      +'<div class="small">Health '+ex('lb-health','')+': '+Util.pct(hp)+' ('+(th.claims||[]).filter(c=>c.status==='true').length+'/'+n+' claims true, '+open+' open)</div>'
      +'<div class="frow" style="margin-top:10px"><a class="btn sm ghost" href="#/thesis/'+Util.esc(th.id)+'">Open &amp; check in</a> '+lbDelBtn('thesis',th.id)+'</div></div>';
  }
  return h+'</div>';
}
function lbRenderThesisNew(){
  let h='<h2>New thesis</h2>';
  h+='<div class="panel"><div class="grid g2">';
  h+=fieldRow('Ticker','<select class="in" id="lb-tn-ticker">'+lbTickerOptions()+'</select>');
  h+=fieldRow('Title', textInput('lb-tn-title','','e.g. \u201cXYZ can compound earnings at 15%\u201d'));
  h+='</div>';
  h+=fieldRow('Claims (one per line)', '<textarea class="in" id="lb-tn-claims" rows="5"></textarea>',
    'Write claims that could be proven wrong, e.g. \u201cRevenue grows &gt;10% in FY2026\u201d. Vague claims can never break, which makes them useless.');
  h+='<div id="lb-tn-msg"></div><button class="btn" id="lb-tn-save">Save thesis</button> <a class="btn ghost" href="#/theses">Cancel</a></div>';
  return h;
}
function lbRenderThesis(id){
  const th=(Store.db.theses||[]).find(t=>t.id===id);
  if(!th) return '<div class="alert err">Thesis not found.</div><a class="btn ghost" href="#/theses">Back</a>';
  const hp=lbThesisHealth(th);
  const badge=s=>({open:'b-info','true':'b-ok',broken:'b-bad',unclear:'b-warn'}[s]||'b-neutral');
  let h='<h2>'+Util.esc(th.title)+'</h2><div class="asof">'+Util.esc(th.ticker)+' \u00b7 created '+Util.esc(th.created||'')+'</div>';
  h+='<div class="panel"><h3>Health '+ex('lb-health','')+'</h3><div class="score">'+Util.pct(hp)+'</div><div class="bar"><i style="width:'+Math.round(hp*100)+'%"></i></div></div>';
  h+='<div class="panel"><h3>Claims</h3>';
  for(const c of (th.claims||[])){
    h+='<details class="exp"><summary><span class="badge '+badge(c.status)+'">'+c.status+'</span> '+Util.esc(c.text)+'</summary><div class="body">';
    const hist=(c.history||[]).slice().sort(lbByDate).reverse();
    if(!hist.length) h+='<div class="small">No check-ins yet.</div>';
    else h+='<table class="tbl"><tr><th>Date</th><th>Status</th><th>Measured</th><th>Note</th></tr>'+hist.map(x=>'<tr><td class="mono">'+Util.esc(x.date)+'</td><td><span class="badge '+badge(x.status)+'">'+x.status+'</span></td><td class="mono">'+(x.actual==null?'—':Util.esc(String(x.actual)))+'</td><td>'+Util.esc(x.note||'')+'</td></tr>').join('')+'</table>';
    h+='</div></details>';
  }
  h+='</div>';
  h+='<div class="panel"><h3>Check in</h3><div id="lb-th-msg"></div><div class="grid g2">';
  h+=fieldRow('Claim','<select class="in" id="lb-th-claim">'+(th.claims||[]).map(c=>'<option value="'+Util.esc(c.id)+'">'+Util.esc(c.text.slice(0,80))+'</option>').join('')+'</select>');
  h+=fieldRow('Measured value (optional)','<input class="in" id="lb-th-actual" placeholder="e.g. 17.2 — the actual reported number">',
    'If the claim states a threshold like “> 15%”, the status is auto-checked against your measured value.');
  h+=fieldRow('Status','<select class="in" id="lb-th-status"><option value="open">open</option><option value="true">true</option><option value="broken">broken</option><option value="unclear">unclear</option></select>');
  h+=fieldRow('Date',lbDateInput('lb-th-date'));
  h+=fieldRow('Note',textInput('lb-th-note','','What did you observe? Cite the evidence.'));
  h+='</div><button class="btn" id="lb-th-save">Save check-in</button> <a class="btn ghost" href="#/theses">Back to list</a></div>';
  return h;
}
function lbThesisAfter(param){
  const $=id=>document.getElementById(id);
  if(param==='new'||document.getElementById('lb-tn-save')){
    const sv=$('lb-tn-save');
    if(sv) sv.addEventListener('click',()=>{
      const ticker=$('lb-tn-ticker').value, title=$('lb-tn-title').value.trim();
      const claims=$('lb-tn-claims').value.split('\n').map(s=>s.trim()).filter(Boolean);
      if(!title){ $('lb-tn-msg').innerHTML='<div class="alert err">Give the thesis a title.</div>'; return; }
      if(!claims.length){ $('lb-tn-msg').innerHTML='<div class="alert err">Add at least one falsifiable claim.</div>'; return; }
      const th={id:Util.uid('th'),ticker,title,created:Util.today(),
        claims:claims.map(c=>({id:Util.uid('cl'),text:c,status:'open',history:[]}))};
      Store.db.theses.push(th); Store.save();
      Router.go('#/thesis/'+th.id);
    });
  }
  const ck=$('lb-th-save');
  if(ck) ck.addEventListener('click',()=>{
    const th=(Store.db.theses||[]).find(t=>t.id===param);
    if(!th) return;
    const cl=(th.claims||[]).find(c=>c.id===$('lb-th-claim').value);
    if(!cl) return;
    let status=$('lb-th-status').value;
    const date=$('lb-th-date').value||Util.today(), note=$('lb-th-note').value.trim();
    const actualRaw=$('lb-th-actual').value.trim();
    /* thesis-vs-reality: auto-evaluate "claim OP number" against a measured value */
    let actual=null, autoNote='';
    if(actualRaw!==''){
      const av=parseFloat(actualRaw.replace('%',''));
      const m=String(cl.text||'').match(/(>=|<=|>|<|=)\s*([\d.]+)\s*%?/);
      if(!isNaN(av)&&m){
        actual=av;
        const tgt=parseFloat(m[2]), op=m[1];
        const pass=op==='>'?av>tgt:op==='<'?av<tgt:op==='>='?av>=tgt:op==='<='?av<=tgt:av===tgt;
        if(status==='open') status=pass?'true':'broken';
        autoNote='Measured '+av+' vs claim "'+m[0].trim()+'" → '+(pass?'PASS':'FAIL')+'. ';
      } else actual=actualRaw;
    }
    cl.status=status; cl.history.push({date,status,note:autoNote+note,actual:actual});
    Store.save(); Router.render();
  });
}
Router.routes['theses']=function(){ return lbRenderTheses(); };
Router.routes['thesis-new']=function(){ return lbRenderThesisNew(); };
Router.routes['thesis-new'].after=function(){ lbThesisAfter('new'); };
Router.routes['thesis']=function(p){ return lbRenderThesis(p); };
Router.routes['thesis'].after=function(p){ lbThesisAfter(p); };

/* ================= GRAVEYARD ================= */
function lbRenderGraveyard(){
  const ideas=Store.db.ideas||[], today=Util.today();
  const closed=ideas.filter(i=>i.outcome&&i.outcome!=='open');
  const boughtClosed=closed.filter(i=>i.bought&&i.returnPct!=null&&!isNaN(i.returnPct));
  const winRate=boughtClosed.length?boughtClosed.filter(i=>i.returnPct>0).length/boughtClosed.length:null;
  const avgRet=closed.filter(i=>i.returnPct!=null&&!isNaN(i.returnPct));
  let h='<h2>Idea Graveyard '+ex('lb-graveyard','')+'</h2>'+DATA_BADGE;
  h+='<div class="grid g4" style="margin-bottom:14px">';
  h+='<div class="kpi"><div class="k">Ideas logged</div><div class="v">'+ideas.length+'</div></div>';
  h+='<div class="kpi"><div class="k">Bought win rate</div><div class="v">'+(winRate==null?'\u2014':Util.pct(winRate))+'</div><div class="d">'+boughtClosed.length+' closed bought ideas</div></div>';
  h+='<div class="kpi"><div class="k">Avg return (closed)</div><div class="v">'+(avgRet.length?Util.pct(avgRet.reduce((a,i)=>a+i.returnPct,0)/avgRet.length):'\u2014')+'</div><div class="d">'+avgRet.length+' closed ideas</div></div>';
  h+='<div class="kpi"><div class="k">Review due</div><div class="v">'+ideas.filter(i=>(!i.outcome||i.outcome==='open')&&i.reviewDue&&i.reviewDue<=today).length+'</div><div class="d">due \u2264 today</div></div>';
  h+='</div>';
  h+='<div class="panel"><h3>Log an idea</h3><div id="lb-gy-msg"></div><div class="grid g2">';
  h+=fieldRow('Ticker','<select class="in" id="lb-gy-ticker">'+lbTickerOptions()+'</select>');
  h+=fieldRow('Title',textInput('lb-gy-title','','One-line idea'));
  h+=fieldRow('Thesis','<textarea class="in" id="lb-gy-thesis" rows="2"></textarea>','Why was this interesting?');
  h+=fieldRow('Date considered',lbDateInput('lb-gy-date'));
  h+=fieldRow('Did you buy it?','<select class="in" id="lb-gy-bought"><option value="no">No \u2014 skipped</option><option value="yes">Yes \u2014 bought</option></select>');
  h+=fieldRow('Review due',lbDateInput('lb-gy-due'),'When you\u2019ll revisit this idea and grade it.');
  h+='</div><button class="btn" id="lb-gy-save">Log idea</button></div>';
  h+='<div class="panel"><h3>All ideas</h3>';
  if(!ideas.length) h+=emptyBox('The graveyard is empty. Log ideas before you know the outcome \u2014 that\u2019s the whole point.');
  else{
    h+='<table class="tbl"><tr><th>Date</th><th>Ticker</th><th>Idea</th><th>Status</th><th>Review</th><th class="num">Return</th><th>Outcome</th><th></th></tr>';
    for(const i of ideas.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''))){
      const due=i.reviewDue&&i.reviewDue<=today&&(!i.outcome||i.outcome==='open');
      h+='<tr'+(due?' style="background:var(--amberbg)"':'')+'><td class="mono">'+Util.esc(i.date||'')+'</td>'
        +'<td><b>'+Util.esc(i.ticker)+'</b></td><td>'+Util.esc(i.title)+'<div class="small">'+Util.esc(i.thesis||'')+'</div></td>'
        +'<td><span class="badge '+(i.bought?'b-info':'b-neutral')+'">'+(i.bought?'bought':'skipped')+'</span></td>'
        +'<td>'+(i.reviewDue?('<span class="badge '+(due?'b-warn':'b-neutral')+'">'+Util.esc(i.reviewDue)+(due?' \u2014 due':'')+'</span>'):'\u2014')+'</td>'
        +'<td class="num">'+(i.returnPct!=null&&i.returnPct!==''?Util.pct(i.returnPct):'\u2014')+'</td>'
        +'<td><span class="small">'+Util.esc(i.outcome&&i.outcome!=='open'?i.outcome:'open')+'</span></td>'
        +'<td style="white-space:nowrap"><button class="btn sm ghost" data-lb-gyrev="'+Util.esc(i.id)+'">Record outcome</button> '+lbDelBtn('idea',i.id)+'</td></tr>';
    }
    h+='</table>';
  }
  h+='</div>';
  h+='<div id="lb-gy-modal"></div>';
  return h;
}
function lbGraveyardAfter(){
  const $=id=>document.getElementById(id);
  $('lb-gy-save').addEventListener('click',()=>{
    const title=$('lb-gy-title').value.trim();
    if(!title){ $('lb-gy-msg').innerHTML='<div class="alert err">Give the idea a title.</div>'; return; }
    Store.db.ideas.push({id:Util.uid('gy'),ticker:$('lb-gy-ticker').value,title,
      thesis:$('lb-gy-thesis').value.trim(),date:$('lb-gy-date').value||Util.today(),
      bought:$('lb-gy-bought').value==='yes',reviewDue:$('lb-gy-due').value||null,
      outcome:'open',returnPct:null});
    Store.save(); Router.render();
  });
  document.querySelectorAll('[data-lb-gyrev]').forEach(b=>b.addEventListener('click',()=>{
    const id=b.getAttribute('data-lb-gyrev');
    const idea=(Store.db.ideas||[]).find(i=>i.id===id); if(!idea) return;
    const ret=prompt('Return as a decimal (e.g. 0.12 for +12%, -0.05 for -5%). Leave blank if unknown:','');
    const oc=prompt('Outcome label (e.g. bought-won, bought-lost, skipped-missed, skipped-avoided):',idea.outcome==='open'?'':idea.outcome);
    if(oc===null) return;
    idea.outcome=oc.trim()||'open';
    idea.returnPct=(ret!==null&&ret.trim()!=='')?parseFloat(ret.trim()):null;
    Store.save(); Router.render();
  }));
}
Router.routes['graveyard']=function(){ return lbRenderGraveyard(); };
Router.routes['graveyard'].after=function(){ lbGraveyardAfter(); };

/* ================= BRIEFING ================= */
function lbBriefingItemFields(idx){
  return '<div class="panel" style="background:var(--panel2)" data-lb-bitem="'+idx+'"><h3>Item '+(idx+1)+'</h3>'
    +fieldRow('Headline',textInput('lb-bi-head-'+idx,'','What happened, in one line'))
    +fieldRow('What happened','<textarea class="in" id="lb-bi-what-'+idx+'" rows="2"></textarea>','The facts, briefly.')
    +fieldRow('So what','<textarea class="in" id="lb-bi-so-'+idx+'" rows="2"></textarea>','Why it matters to you and your positions.')
    +'</div>';
}
function lbRenderBriefing(){
  const briefs=(Store.db.briefs||[]).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  let h='<h2>What Changed Today '+ex('lb-briefing','')+'</h2>'+DATA_BADGE;
  h+='<div class="panel"><h3>Write a briefing</h3><div id="lb-br-items">'+lbBriefingItemFields(0)+'</div>';
  h+='<div class="frow"><button class="btn sm ghost" id="lb-br-additem">+ Add item</button></div>';
  h+=fieldRow('Briefing date',lbDateInput('lb-br-date'));
  h+='<div id="lb-br-msg"></div><button class="btn" id="lb-br-save">Save briefing</button></div>';
  h+='<div class="panel"><h3>History</h3>';
  if(!briefs.length) h+=emptyBox('No briefings written yet.');
  else{
    h+='<table class="tbl"><tr><th>Date</th><th class="num">Items</th><th></th></tr>';
    for(const b of briefs) h+='<tr><td class="mono">'+Util.esc(b.date)+'</td><td class="num">'+(b.items||[]).length+'</td>'
      +'<td><a class="btn sm ghost" href="#/briefing-view/'+Util.esc(b.id)+'">View / print</a> '+lbDelBtn('brief',b.id)+'</td></tr>';
    h+='</table>';
  }
  h+='</div>';
  return h;
}
function lbRenderBriefingView(id){
  const b=(Store.db.briefs||[]).find(x=>x.id===id);
  if(!b) return '<div class="alert err">Briefing not found.</div><a class="btn ghost" href="#/briefing">Back</a>';
  let h='<div class="frow"><button class="btn" id="lb-br-print">Print</button> <a class="btn ghost" href="#/briefing">Back</a></div>';
  h+='<h2>What Changed \u2014 '+Util.esc(b.date)+'</h2>';
  for(const it of (b.items||[])){
    h+='<div class="panel"><h3>'+Util.esc(it.headline)+'</h3>'
      +'<p><b>What happened:</b> '+Util.esc(it.what)+'</p>'
      +'<p><b>So what:</b> '+Util.esc(it.so)+'</p></div>';
  }
  return h;
}
function lbBriefingAfter(){
  const $=id=>document.getElementById(id);
  let n=1;
  $('lb-br-additem').addEventListener('click',()=>{ $('lb-br-items').insertAdjacentHTML('beforeend',lbBriefingItemFields(n)); n++; });
  $('lb-br-save').addEventListener('click',()=>{
    const items=[];
    for(let i=0;i<n;i++){
      const head=$('lb-bi-head-'+i), what=$('lb-bi-what-'+i), so=$('lb-bi-so-'+i);
      if(!head) continue;
      if(head.value.trim()||what.value.trim()||so.value.trim())
        items.push({headline:head.value.trim(),what:what.value.trim(),so:so.value.trim()});
    }
    if(!items.length){ $('lb-br-msg').innerHTML='<div class="alert err">Write at least one item.</div>'; return; }
    const b={id:Util.uid('br'),date:$('lb-br-date').value||Util.today(),items,created:Util.today()};
    Store.db.briefs.push(b); Store.save();
    Router.go('#/briefing-view/'+b.id);
  });
  const pr=$('lb-br-print');
  if(pr) pr.addEventListener('click',()=>window.print());
}
Router.routes['briefing']=function(){ return lbRenderBriefing(); };
Router.routes['briefing'].after=function(){ lbBriefingAfter(); };
Router.routes['briefing-view']=function(p){ return lbRenderBriefingView(p); };
Router.routes['briefing-view'].after=function(){ lbBriefingAfter(); };

/* ================= DEBATE ================= */


/* ================= SIMILAR — find stocks like this ================= */
function lbFArr(t,names){
  const f=(RealData.fundamentals||{})[t]; if(!f) return null;
  for(const n of names){ if(Array.isArray(f[n])&&f[n].length) return f[n]; }
  return null;
}
function lbFYVal(arr,fy){
  if(!arr) return null;
  const r=arr.find(r=>String(r.fy)===String(fy))||arr[0];
  return r?r.val:null;
}
function lbLatestFY(t){
  const rev=lbFArr(t,['revenue','Revenue','totalRevenue']);
  return rev&&rev.length?rev[0].fy:null;
}
function lbSimRaw(t){
  const fy=lbLatestFY(t);
  const rev=lbFYVal(lbFArr(t,['revenue','Revenue','totalRevenue']),fy);
  const ni=lbFYVal(lbFArr(t,['netIncome','NetIncome','netincome']),fy);
  const gp=lbFYVal(lbFArr(t,['grossProfit','GrossProfit','grossprofit']),fy);
  const eq=lbFYVal(lbFArr(t,['equity','Equity','totalEquity','shareholderEquity']),fy);
  const liab=lbFYVal(lbFArr(t,['liabilities','Liabilities','totalLiabilities']),fy);
  const ta=lbFYVal(lbFArr(t,['totalAssets','TotalAssets','assets']),fy);
  const shares=lbFYVal(lbFArr(t,['shares','sharesOutstanding','SharesOutstanding']),fy);
  const lc=lastClose(t);
  const pe=(lc!=null&&shares&&ni&&ni>0)?(lc*shares)/ni:null;
  const mcap=(lc!=null&&shares)?lc*shares:null;
  const revArr=lbFArr(t,['revenue','Revenue','totalRevenue']);
  let cagr=null;
  if(revArr&&revArr.length>=4){
    const v0=revArr[3]&&revArr[3].val, v3=revArr[0]&&revArr[0].val;
    if(v0&&v0>0&&v3) cagr=Math.pow(v3/v0,1/3)-1;
  }
  return {
    pe:pe, mcap:mcap, revCagr:cagr,
    netMargin:(rev&&ni)?ni/rev:null,
    roe:(eq&&ni)?ni/eq:null,
    de:(eq&&liab)?liab/eq:null,
    grossMargin:(rev&&gp)?gp/rev:null,
    assetTurn:(ta&&rev)?rev/ta:null
  };
}
function lbSimAxes(){
  return [
    {key:'pe',label:'P/E',fmt:v=>v==null?'\u2014':v.toFixed(1)},
    {key:'mcap',label:'Market cap',fmt:v=>v==null?'\u2014':Util.money(v)},
    {key:'revCagr',label:'Revenue CAGR 3y',fmt:v=>v==null?'\u2014':Util.pct(v)},
    {key:'netMargin',label:'Net margin',fmt:v=>v==null?'\u2014':Util.pct(v)},
    {key:'roe',label:'ROE',fmt:v=>v==null?'\u2014':Util.pct(v)},
    {key:'de',label:'D/E',fmt:v=>v==null?'\u2014':v.toFixed(2)},
    {key:'grossMargin',label:'Gross margin',fmt:v=>v==null?'\u2014':Util.pct(v)},
    {key:'assetTurn',label:'Asset turnover',fmt:v=>v==null?'\u2014':v.toFixed(2)}
  ];
}
function lbSimScore(target,other,axes,norms){
  let sum=0,n=0; const diffs={};
  for(const ax of axes){
    const tv=target[ax.key], ov=other[ax.key];
    if(tv==null||ov==null) continue;
    const mm=norms[ax.key]; if(!mm||mm.max===mm.min){ diffs[ax.key]=0; sum+=0; n++; continue; }
    const d=Math.abs((tv-mm.min)/(mm.max-mm.min)-(ov-mm.min)/(mm.max-mm.min));
    diffs[ax.key]=d; sum+=d; n++;
  }
  return {score:n?1-sum/n:null,diffs,axesUsed:n};
}
function lbRenderSimilar(sel){
  const uni=(STOCK_TICKERS||[]).slice().sort();
  let h='<h2>Find Stocks Like This '+ex('lb-similar','')+'</h2>'+DATA_BADGE;
  h+='<div class="panel"><h3>Pick a stock</h3><div class="grid g2">'
    +fieldRow('Target','<div style="display:flex;gap:8px">'+tickerInput('lb-sim-t',sel||'','e.g. AAPL')+'<button class="btn sm" id="lb-sim-go">Find similar</button></div>')
    +'<div class="frow"><label class="f">&nbsp;</label><span class="hint">Similarity only works across the 15 bundled stocks; any other ticker shows \u201cdata unavailable\u201d.</span></div></div>'
    +'<div class="hint">Assistive (rule-based): 8-axis similarity across the 15 covered stocks. Axes with missing data for either stock are skipped.</div></div>';
  if(sel&&uni.indexOf(sel)>=0){
    const axes=lbSimAxes();
    const raws={}; uni.forEach(t=>raws[t]=lbSimRaw(t));
    const norms={};
    for(const ax of axes){
      const vs=uni.map(t=>raws[t][ax.key]).filter(v=>v!=null&&isFinite(v));
      norms[ax.key]=vs.length?{min:Math.min.apply(null,vs),max:Math.max.apply(null,vs)}:null;
    }
    const rows=uni.filter(t=>t!==sel).map(t=>{
      const r=lbSimScore(raws[sel],raws[t],axes,norms);
      let topAx=null,topD=-1;
      for(const ax of axes){ const d=r.diffs[ax.key]; if(d!=null&&d>topD){topD=d;topAx=ax;} }
      return {t,score:r.score,axesUsed:r.axesUsed,diffs:r.diffs,topAx};
    }).sort((a,b)=>(b.score==null?-1:b.score)-(a.score==null?-1:a.score));
    h+='<div class="panel"><h3>Similarity formula</h3>'
      +'<p class="mono">score = 1 \u2212 mean( |norm(target<sub>axis</sub>) \u2212 norm(other<sub>axis</sub>)| )</p>'
      +'<p class="small">Each axis is normalized 0\u20131 across the 15 stocks (min\u2013max). Only axes with data for <b>both</b> stocks count. 1.00 = identical financial shape, 0.00 = as different as possible. This is a rule-based comparison of financial shape, not a quality ranking.</p></div>';
    h+='<div class="panel"><h3>Ranked matches for '+Util.esc(sel)+'</h3>';
    h+='<table class="tbl"><tr><th>#</th><th>Ticker</th><th class="num">Similarity</th><th>Differs mainly on</th><th></th></tr>';
    rows.forEach((r,i)=>{
      const read=r.topAx?('differs mainly on <b>'+Util.esc(r.topAx.label)+'</b> ('+r.topAx.label+': '+r.topAx.fmt(raws[sel][r.topAx.key])+' vs '+r.topAx.fmt(raws[r.t][r.topAx.key])+')'):'data unavailable';
      h+='<tr><td>'+(i+1)+'</td><td><b>'+Util.esc(r.t)+'</b><div class="small">'+Util.esc(lbCoName(r.t))+'</div></td>'
        +'<td class="num">'+(r.score==null?'\u2014':Util.pct(r.score,0)+' <span class="small">('+r.axesUsed+'/8 axes)</span>')+'</td>'
        +'<td class="small">Assistive (rule-based): '+read+'</td>'
        +'<td><details class="exp" style="margin:0"><summary class="small">axis table</summary><div class="body"><table class="tbl">'
        +'<tr><th>Axis</th><th class="num">'+Util.esc(sel)+'</th><th class="num">'+Util.esc(r.t)+'</th><th class="num">|\u0394 norm|</th></tr>'
        +axes.map(ax=>{
          const tv=raws[sel][ax.key], ov=raws[r.t][ax.key], d=r.diffs[ax.key];
          return '<tr><td>'+Util.esc(ax.label)+'</td><td class="num">'+(tv==null?'data unavailable':ax.fmt(tv))+'</td>'
            +'<td class="num">'+(ov==null?'data unavailable':ax.fmt(ov))+'</td>'
            +'<td class="num">'+(d==null?'\u2014':d.toFixed(2))+'</td></tr>';
        }).join('')+'</table></div></details></td></tr>';
    });
    h+='</table></div>';
  }
  else if(sel){
    h+='<div class="alert warn"><b>'+Util.esc(sel)+'</b> is not one of the 15 bundled stocks \u2014 similarity data unavailable. Pick a covered ticker from the suggestions.</div>';
  }
  return h;
}
function lbSimilarAfter(){
  const go=document.getElementById('lb-sim-go');
  const run=()=>{ const t=tickerVal('lb-sim-t'); if(t) Router.go('#/similar/'+encodeURIComponent(t)); };
  if(go) go.addEventListener('click',run);
  const ti=document.getElementById('lb-sim-t');
  if(ti) ti.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); run(); } });
}
Router.routes['similar']=function(p){ return lbRenderSimilar(p||null); };
Router.routes['similar'].after=function(){ lbSimilarAfter(); };

/* ================= GLOSSARY ================= */
function lbRenderGlossary(){
  const keys=Object.keys(EX.reg).sort();
  let h='<h2>Glossary</h2>'+DATA_BADGE;
  h+='<div class="panel">'+fieldRow('Search',textInput('lb-g-q','','Type to filter terms\u2026'))+'<div id="lb-g-count" class="small"></div></div>';
  h+='<div class="grid g2" id="lb-g-list">';
  for(const k of keys){
    const e=EX.reg[k];
    h+='<div class="panel" data-lb-gterm="'+Util.esc((e.t+' '+e.what+' '+e.why).toLowerCase())+'"><h3>'+Util.esc(e.t)+'</h3>'
      +'<p><b>What it is:</b> '+Util.esc(e.what)+'</p>'
      +'<p><b>Why it matters:</b> '+Util.esc(e.why)+'</p>'
      +'<p><b>Good vs bad:</b> '+Util.esc(e.good)+'</p></div>';
  }
  h+='</div>';
  return h;
}
function lbGlossaryAfter(){
  const q=document.getElementById('lb-g-q'), list=document.getElementById('lb-g-list');
  const upd=()=>{
    const s=q.value.trim().toLowerCase(); let n=0;
    list.querySelectorAll('[data-lb-gterm]').forEach(el=>{
      const hit=!s||el.getAttribute('data-lb-gterm').indexOf(s)>=0;
      el.style.display=hit?'':'none'; if(hit) n++;
    });
    document.getElementById('lb-g-count').textContent=n+' term(s)';
  };
  q.addEventListener('input',upd); upd();
}
Router.routes['glossary']=function(){ return lbRenderGlossary(); };
Router.routes['glossary'].after=function(){ lbGlossaryAfter(); };

/* ================= SETTINGS ================= */
function lbRenderSettings(){
  const prices=RealData.prices||{}, tk=Object.keys(prices);
  const bars=tk.length?prices[tk[0]].length:0;
  const nFundamentals=Object.keys(RealData.fundamentals||{}).length;
  let h='<h2>Backup &amp; Data</h2>'+DATA_BADGE;
  h+='<div class="grid g2">';
  h+='<div class="panel"><h3>Backup</h3>'
    +'<div class="frow"><button class="btn" id="lb-se-export">Export JSON</button></div>'
    +fieldRow('Import JSON','<input class="in" type="file" id="lb-se-file" accept=".json,application/json">','Replaces all your saved data. A backup you export first is the only undo.')
    +'<div id="lb-se-msg"></div></div>';
  h+='<div class="panel"><h3>Danger zone</h3>'
    +'<p class="small">Resetting clears everything you logged: theses, ideas, and briefings. The bundled market &amp; filing data is built in and unaffected.</p>'
    +'<button class="btn danger" id="lb-se-reset">Reset user data</button></div>';
  h+='</div>';
  h+='<div class="panel"><h3>Passcode lock</h3>'
    +'<p class="small">Lock this copy behind a passcode \u2014 it will ask every time you open the file in a new browser session. '
    +'The passcode is stored only in this browser\u2019s local storage, as a hash \u2014 never in the file. '
    +'<b>Honest limit:</b> this is a screen lock, not encryption. Anyone who can edit the file or its stored data can bypass it; it keeps casual snoopers out, nothing more.</p>'
    +'<div id="pc-set-wrap"></div></div>';
  h+='<div class="panel"><h3>Live market data (optional)</h3>'
    +'<p class="small">Paste your own free API key to get live quotes on the Markets page. The key is stored only in this browser\u2019s local storage \u2014 it is never written into this file and is sent only to the provider\u2019s API. Everything on the site works without it.</p>'
    +fieldRow('Finnhub key (recommended \u2014 free tier, real-time US quotes)',
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><input class="in" type="password" id="lb-se-fh" placeholder="paste key" autocomplete="off" style="max-width:260px">'
      +'<button class="btn sm" id="lb-se-fh-save">Save</button><button class="btn sm ghost" id="lb-se-fh-test">Test</button></div>'
      +'<div class="hint">Free at finnhub.io \u2014 60 calls/minute on the free tier. Quotes are cached for 60 seconds.</div>'
      +'<div id="lb-se-fh-msg" class="small" style="margin-top:4px"></div>')
    +fieldRow('Alpha Vantage key (alternative \u2014 25 requests/day free)',
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><input class="in" type="password" id="lb-se-av" placeholder="paste key" autocomplete="off" style="max-width:260px">'
      +'<button class="btn sm" id="lb-se-av-save">Save</button><button class="btn sm ghost" id="lb-se-av-test">Test</button></div>'
      +'<div id="lb-se-av-msg" class="small" style="margin-top:4px"></div>')
    +'</div>';
  h+='<div class="panel"><h3>Data info</h3><table class="tbl">'
    +'<tr><th>Item</th><th>Detail</th></tr>'
    +'<tr><td>As of</td><td class="mono">2026-09-25</td></tr>'
    +'<tr><td>Sources</td><td>Yahoo Finance, SEC EDGAR</td></tr>'
    +'<tr><td>Price bars</td><td>'+tk.length+' tickers \u00d7 ~'+bars+' bars ('+Util.esc(tk.sort().join(', '))+')</td></tr>'
    +'<tr><td>10-K fundamentals</td><td>'+nFundamentals+' tickers</td></tr>'
    +'<tr><td>Your saved data</td><td class="mono">'+Store.KEY+'</td></tr>'
    +'</table></div>';
  h+='<div class="panel"><h3>How to refresh the data</h3>'
    +'<p class="small">This file is a snapshot: prices run 2024-09-25 through 2026-09-25. A future build can re-pull fresh bars and fundamentals and rebuild the bundle; your logged data (theses, ideas, briefings) lives separately in your browser and carries over untouched.</p></div>';
  return h;
}
function lbSettingsAfter(){
  const $=id=>document.getElementById(id);
  /* --- passcode lock UI --- */
  function pcSetForm(isNew){
    const form=$('pc-set-form'); if(!form) return;
    form.innerHTML=fieldRow(isNew?'New passcode (min 4 characters)':'New passcode',
      '<input class="in" type="password" id="pc-n1" autocomplete="new-password" style="max-width:220px">')
      +fieldRow('Confirm passcode','<input class="in" type="password" id="pc-n2" autocomplete="new-password" style="max-width:220px">')
      +'<button class="btn sm" id="pc-save">'+(isNew?'Set passcode':'Save new passcode')+'</button>';
    $('pc-save').addEventListener('click', async ()=>{
      const a=$('pc-n1').value, b=$('pc-n2').value, msg=$('pc-set-msg');
      if(a.length<4){ msg.innerHTML='<span style="color:var(--red)">Use at least 4 characters.</span>'; return; }
      if(a!==b){ msg.innerHTML='<span style="color:var(--red)">Passcodes do not match.</span>'; return; }
      if(!Store.db.settings) Store.db.settings={};
      Store.db.settings.pcHash=await pcHash(a); Store.save(); pcMarkUnlocked();
      pcSettingsUI();
    });
  }
  function pcSettingsUI(){
    const wrap=$('pc-set-wrap'); if(!wrap) return;
    if(pcIsSet()){
      wrap.innerHTML='<p><span class="badge b-ok">ON</span> <span class="hint">Passcode is set.</span></p>'
        +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
        +'<button class="btn sm" id="pc-change">Change passcode</button>'
        +'<button class="btn sm ghost" id="pc-locknow">Lock now</button>'
        +'<button class="btn sm danger" id="pc-remove">Remove passcode</button></div>'
        +'<div id="pc-set-form" style="margin-top:8px"></div><div id="pc-set-msg" class="small" style="margin-top:6px"></div>';
      $('pc-change').addEventListener('click',()=>pcSetForm(false));
      $('pc-locknow').addEventListener('click',()=>pcLockNow());
      $('pc-remove').addEventListener('click',()=>{
        if(!confirm('Remove the passcode?')) return;
        delete Store.db.settings.pcHash; Store.save(); pcSettingsUI();
      });
    } else {
      wrap.innerHTML='<div id="pc-set-form"></div><div id="pc-set-msg" class="small" style="margin-top:6px"></div>';
      pcSetForm(true);
    }
  }
  if(typeof pcIsSet==='function') pcSettingsUI();
  /* --- API keys (stored only in this browser) --- */
  function apikeys(){ Store.db.settings.apikeys=Store.db.settings.apikeys||{}; return Store.db.settings.apikeys; }
  function keyMsg(id, ok, txt){ const el=$(id); if(el) el.innerHTML='<span class="badge '+(ok?'b-ok':'b-bad')+'">'+(ok?'OK':'Error')+'</span> <span class="hint">'+Util.esc(txt)+'</span>'; }
  [['fh','finnhub','lb-se-fh','lb-se-fh-msg'],['av','alphavantage','lb-se-av','lb-se-av-msg']].forEach(function(cfg){
    const input=$(cfg[2]);
    if(input&&apikeys()[cfg[1]]) input.placeholder='key saved \u2014 paste to replace';
    const sv=$(cfg[2]+'-save')||$('lb-se-'+cfg[0]+'-save');
    if(sv) sv.addEventListener('click',()=>{
      const v=(input.value||'').trim();
      if(v){ apikeys()[cfg[1]]=v; input.value=''; input.placeholder='key saved \u2014 paste to replace'; }
      else { delete apikeys()[cfg[1]]; input.placeholder='paste key'; }
      Store.save(); keyMsg(cfg[3], true, v?'Key saved in this browser only.':'Key removed.');
    });
    const ts=$(cfg[2]+'-test')||$('lb-se-'+cfg[0]+'-test');
    if(ts) ts.addEventListener('click', async ()=>{
      const typed=(input.value||'').trim(), saved=apikeys()[cfg[1]];
      const key=typed||saved;
      if(!key){ keyMsg(cfg[3], false, 'Paste a key first.'); return; }
      keyMsg(cfg[3], true, 'Testing\u2026');
      const keep=saved;
      try{
        apikeys()[cfg[1]]=key;
        const res=await LiveQuotes.get(['AAPL'], true);
        const r=res.AAPL;
        if(r.ok) keyMsg(cfg[3], true, 'Connected \u2014 AAPL '+Util.num(r.q.px,2)+' via '+r.q.src+'.');
        else keyMsg(cfg[3], false, r.why==='no-key'?'No key.':r.why);
      }catch(e){ keyMsg(cfg[3], false, String((e&&e.message)||e).slice(0,120)); }
      if(keep) apikeys()[cfg[1]]=keep; else delete apikeys()[cfg[1]];
    });
  });
  $('lb-se-export').addEventListener('click',()=>{
    Util.download('finsuite-backup-'+Util.today()+'.json', Store.exportJSON(), 'application/json');
  });
  $('lb-se-file').addEventListener('change',ev=>{
    const f=ev.target.files[0]; if(!f) return;
    const r=new FileReader();
    r.onload=()=>{
      try{
        if(!confirm('Replace ALL saved data with this backup file?')) return;
        Store.importJSON(r.result);
        $('lb-se-msg').innerHTML='<div class="alert ok">Import successful.</div>';
        setTimeout(()=>Router.go('#/home'),600);
      }catch(e){
        $('lb-se-msg').innerHTML='<div class="alert err">Import failed: '+Util.esc(e.message)+'</div>';
      }
    };
    r.readAsText(f);
  });
  $('lb-se-reset').addEventListener('click',()=>{
    if(!confirm('Reset ALL user data (theses, ideas, briefings)? Bundled market data is unaffected.')) return;
    if(!confirm('Really sure? This cannot be undone.')) return;
    Store.resetAll(); Router.go('#/home');
  });
}
Router.routes['settings']=function(){ return lbRenderSettings(); };
Router.routes['settings'].after=function(){ lbSettingsAfter(); };
