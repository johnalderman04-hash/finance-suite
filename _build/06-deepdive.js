/* ================================================================
   FINANCE SUITE — 06-deepdive.js
   Company Deep Dive route (#/deepdive and #/deepdive/:ticker).
   16 computed sections + rule-based Q&A. All figures come from
   bundled SEC data, uploaded filings (FilingLib, guarded), or
   user-entered manual figures — never invented. No scores, no
   buy/sell calls. Plain JS, concatenated after the other chunks.
   Uses globals: Util, RealData, DATA_BADGE, lastClose, fundVal,
   fundFYs, STOCK_TICKERS, EX/ex, showModal, Store, Charts,
   fieldRow, emptyBox, numInput, textInput, tickerInput, tickerVal,
   tickerHint, NAV, Router.
   No <script> tags in this file.
   ================================================================ */
(function(){
'use strict';

/* ---------------- EX entries (dd- prefixed, no clashes) ---------------- */
(function ddRegEX(){
  var A=function(k,t,what,why,good){ EX.add(k,t,what,why,good); };
  A('dd-biz','Business model','What the company sells, who pays for it, and where the money comes from.','You cannot judge a company\u2019s numbers without knowing how it makes money.','A clear, simple description you could explain in one sentence.');
  A('dd-revqual','Revenue quality','Whether sales growth is fast, steady, and speeding up — or slowing down.','Growing revenue means more customers or higher prices; the pattern matters more than one year.','Faster growth that is also accelerating, backed by repeat (recurring) sales.');
  A('dd-profit','Profitability','How much of each sales dollar survives as gross, operating, and net profit, plus returns on assets and capital.','Margins show pricing power and cost control; returns show how hard the money is working.','High, stable margins and ROIC well above the cost of capital.');
  A('dd-cashq','Cash flow quality','Whether reported profit actually arrives as cash in the bank.','Profit on paper means little if customers pay late or inventory piles up.','Operating cash flow at or above net income, year after year.');
  A('dd-stress','Balance sheet stress test','What happens to debt payments and cash if sales fall or interest rates rise.','Debt is fine until conditions change — this checks the cushion before they do.','Interest covered several times over even in a bad year.');
  A('dd-moat','Moat','A lasting edge that stops competitors from copying the business and eroding profits.','Without an edge, high profits attract rivals and margins fade.','An edge backed by hard evidence, not adjectives.');
  A('dd-peers','Competitor comparison','The same metrics for rival companies, side by side.','A 40% margin is meaningless alone — it matters whether rivals earn 20% or 60%.','Better or improving versus peers, not just versus its own past.');
  A('dd-mgmt','Management','What the people running the company have actually done with shareholder money.','Promises are cheap; the share count, retained profits, and pay tell the real story.','Shares shrinking, profits retained and reinvested well, sensible pay.');
  A('dd-capalloc','Capital allocation','Where the cash went each year: reinvested, used to buy back shares, or paid out.','Every dollar has three jobs — grow the business, reward owners, or sit idle.','Cash flowing to the highest-return use, with buybacks done when shares are cheap.');
  A('dd-dcf','DCF valuation','Estimating worth by projecting future cash and shrinking it back to today\u2019s dollars.','It forces you to state your growth and return assumptions out loud.','A range of answers under different assumptions — never one magic number.');
  A('dd-revdcf','Reverse DCF','Starting from today\u2019s share price and solving backwards for the growth the market already expects.','It turns \u201coverpriced?\u201d into a checkable question: is that growth realistic?','Implied growth at or below what the company has actually delivered before.');
  A('dd-scen','Bull / base / bear scenarios','Three futures — good, middle, bad — each with its own growth, margin, and exit multiple.','One forecast is a guess; three show how much the answer depends on being right.','A comfortable result even in the bear case, or a clear reason the risk is worth it.');
  A('dd-risk','Risk map','Everything that could go wrong, each tied to evidence and something to watch.','Writing risks down stops you from forgetting them when the story sounds good.','Few flags, each with a monitorable tripwire.');
  A('dd-missing','What the market is missing','Comparing the share-price move with what revenue, profit, and cash actually did.','Price and fundamentals often disagree — the gap is where the market\u2019s real bet lives.','Neutral: divergence is information, not a signal by itself.');
  A('dd-chg','Change detector','Two fiscal years side by side, every key line marked better, worse, or flat.','Trends hide in tables of raw numbers; color makes them visible.','More green than red across the lines that matter.');
  A('dd-thesis','Thesis builder','Your bull case and bear case in your own words, drafted from the flags above.','A written thesis can be checked later — a feeling cannot.','Both sides argued honestly, with tripwires for when to change your mind.');
  A('dd-quality','Quality scores','Two classic accounting-based scores computed from the filings: the Piotroski F-Score (nine tests of financial strength) and the Altman Z-Score (bankruptcy-risk gauge).','They compress several years of statements into one quality read — useful, but backward-looking.','A high F-Score and a Z-Score in the safe zone.');
  A('dd-insider','Insider transactions','Recent SEC Forms 3, 4, and 5 — filings officers, directors, and large owners must make when they trade company stock.','Insiders buying with their own money is a stronger signal than anything they say on a call.','Clustered insider buying; beware heavy selling into strength.');
  A('dd-qa','Company Q&A','Plain questions answered straight from the computed sections with the figures cited.','It keeps every answer traceable to a number and a rule.','Answers that show their work.');
})();

/* ---------------- shared helpers (dd prefix) ---------------- */
var DD_FIELDS=['revenue','net_income','gross_profit','op_income','assets','cur_assets',
  'cur_liab','total_liab','lt_debt','retained','op_cash','shares_dil','interest_exp'];
var DD_FIELD_LABEL={revenue:'Revenue',net_income:'Net income',gross_profit:'Gross profit',
  op_income:'Operating income',assets:'Total assets',cur_assets:'Current assets',
  cur_liab:'Current liabilities',total_liab:'Total liabilities',lt_debt:'Long-term debt',
  retained:'Retained earnings',op_cash:'Operating cash flow',shares_dil:'Diluted shares',
  interest_exp:'Interest expense'};
function ddNum(v){ return v!=null && v!=='' && !isNaN(Number(v)); }
function ddE(s){ return Util.esc(s); }
function ddMoney(v){ return ddNum(v)?Util.money(Number(v)):'data unavailable'; }
function ddPct(v,d){ return ddNum(v)?Util.pct(Number(v),d):'data unavailable'; }
function ddHasData(t){ return !!((RealData.fundamentals||{})[t]); }
function ddCoName(t){ var f=(RealData.fundamentals||{})[t]; return (f&&f.name)?f.name:t; }
function ddCik(t){ var f=(RealData.fundamentals||{})[t]; return (f&&f.cik)?f.cik:'data unavailable'; }

/* per-ticker user store; created on demand, saved on every change */
function ddGet(t){
  var db=Store.db;
  if(!db.deepdive) db.deepdive={};
  if(!db.deepdive[t]) db.deepdive[t]={};
  var s=db.deepdive[t];
  if(!s.moat) s.moat={};
  if(!Array.isArray(s.risks)) s.risks=[];
  if(!s.mgmt) s.mgmt={};
  if(!s.biz) s.biz={desc:'',segments:[],geo:'',customers:''};
  if(!Array.isArray(s.biz.segments)) s.biz.segments=[];
  if(!s.scenarios) s.scenarios={bull:{g:15,m:25,mult:20},base:{g:8,m:22,mult:16},bear:{g:2,m:18,mult:12}};
  if(!s.thesis) s.thesis={bull:'',bear:'',vars:'',triggers:''};
  if(!s.dcf) s.dcf={g:8,m:25,r:10,tg:3};
  if(!Array.isArray(s.peers)) s.peers=[];
  if(!Array.isArray(s.manual)) s.manual=[];
  return s;
}
function ddSave(){ Store.save(); }
function ddSet(t,path,val){
  var s=ddGet(t), parts=String(path).split('.'), o=s;
  for(var i=0;i<parts.length-1;i++){ if(o[parts[i]]==null||typeof o[parts[i]]!=='object') o[parts[i]]={}; o=o[parts[i]]; }
  o[parts[parts.length-1]]=val;
  ddSave();
}

/* Figure lookup with priority: uploaded filing > built-in SEC data > user-entered manual. */
function ddFig(t,field,fy){
  var val=null, src='built-in SEC data';
  if(typeof FilingLib!=='undefined'&&FilingLib){
    try{
      var uf=FilingLib.figuresFor(t);
      var fv=uf&&uf.figures?uf.figures[field]:null;
      if(fv!=null&&fv!==''&&!(typeof fv==='number'&&isNaN(fv))){
        if(typeof fv==='object'){
          if(Array.isArray(fv)){
            var hit=null;
            for(var i=0;i<fv.length;i++){ if(fv[i]&&String(fv[i].fy)===String(fy)){ hit=fv[i]; break; } }
            if(!hit&&fv.length) hit=fv[0];
            fv=(hit&&ddNum(hit.val))?hit.val:null;
          } else if(ddNum(fv.val)){ fv=fv.val; }
          else{
            var c=(fv[fy]!=null?fv[fy]:fv[String(fy)]);
            if(c==null){ var ks=Object.keys(fv); for(var j=0;j<ks.length;j++){ if(fv[ks[j]]!=null){ c=fv[ks[j]]; break; } } }
            fv=c;
          }
        }
        if(ddNum(fv)){ val=Number(fv); src='uploaded filing'; }
      }
    }catch(e){ /* fall through */ }
  }
  if(val==null){
    if(ddHasData(t)){
      var v=fundVal(t,field,fy);
      if(ddNum(v)) val=Number(v);
    } else {
      var m=(ddGet(t).manual||[]);
      for(var k=0;k<m.length;k++){
        if(String(m[k].fy)===String(fy)&&ddNum(m[k][field])){ val=Number(m[k][field]); src='user-entered'; break; }
      }
    }
  }
  return {val:val, src:src};
}
function ddFys(t){
  var set={};
  (fundFYs(t)||[]).forEach(function(y){ set[String(y)]=1; });
  (ddGet(t).manual||[]).forEach(function(r){ if(r.fy) set[String(r.fy)]=1; });
  if(typeof FilingLib!=='undefined'&&FilingLib){
    try{
      var uf=FilingLib.figuresFor(t);
      if(uf&&uf.figures) Object.keys(uf.figures).forEach(function(k){
        var a=uf.figures[k];
        if(Array.isArray(a)) a.forEach(function(r){ if(r&&r.fy) set[String(r.fy)]=1; });
      });
    }catch(e){}
  }
  return Object.keys(set).sort(function(a,b){ return parseFloat(b)-parseFloat(a); });
}
/* one row per FY, newest first */
function ddSeries(t){
  return ddFys(t).map(function(fy){
    var r={fy:fy};
    DD_FIELDS.forEach(function(f){ r[f]=ddFig(t,f,fy).val; });
    return r;
  });
}
function ddYoY(series,field){
  var out={};
  for(var i=0;i<series.length-1;i++){
    var a=series[i][field], b=series[i+1][field];
    out[series[i].fy]=(ddNum(a)&&ddNum(b)&&Number(b)!==0)?(Number(a)/Number(b)-1):null;
  }
  return out;
}
function ddCagr(now,then,yrs){
  if(!ddNum(now)||!ddNum(then)||!yrs) return null;
  now=Number(now); then=Number(then);
  if(now<=0||then<=0) return null;
  return Math.pow(now/then,1/yrs)-1;
}
function ddPrice(t){
  var p=lastClose(t);
  if(ddNum(p)) return {val:Number(p), src:'bundled price data'};
  var m=(ddGet(t).manual||[]);
  if(m.length&&ddNum(m[0].price)) return {val:Number(m[0].price), src:'user-entered'};
  return {val:null, src:'data unavailable'};
}
/* calendar year-end close from bundled bars (approximation — stated in UI) */
function ddYearEndClose(t,calYear){
  var bars=(RealData.prices||{})[t];
  if(!bars||!bars.length) return null;
  var cut=String(calYear)+'-12-31', best=null;
  for(var i=0;i<bars.length;i++){ if(bars[i].d<=cut) best=bars[i]; else break; }
  return best?best.c:null;
}
function ddOneYrPriceChg(t){
  var bars=(RealData.prices||{})[t];
  if(!bars||bars.length<260) return null;
  var last=bars[bars.length-1], old=bars[bars.length-253];
  if(!ddNum(last.c)||!ddNum(old.c)||!Number(old.c)) return null;
  return {chg:Number(last.c)/Number(old.c)-1, from:old.d, to:last.d};
}

/* ---------------- small HTML builders ---------------- */
function ddSec(id,num,title,intro,body){
  return '<section class="panel" id="'+id+'" style="margin-bottom:16px"><h3>'+num+'. '+ddE(title)+'</h3>'
    +'<p class="small">'+intro+'</p>'+body+'</section>';
}
function ddTbl(heads,rows){
  var h='<div style="overflow-x:auto"><table class="tbl"><tr>';
  heads.forEach(function(x){ h+='<th>'+x+'</th>'; });
  h+='</tr>';
  rows.forEach(function(r){ h+='<tr>'; r.forEach(function(c){ h+='<td>'+c+'</td>'; }); h+='</tr>'; });
  return h+'</table></div>';
}
function ddRule(txt){ return '<p class="rule-note">'+txt+'</p>'; }
function ddFlagDot(kind){
  if(kind==='g') return '<span title="favorable">\U0001F7E2</span>';
  if(kind==='r') return '<span title="unfavorable">\U0001F534</span>';
  return '<span title="flat / unavailable">\U0001F7E1</span>';
}
/* direction-aware change cell: returns {pct, dot} */
function ddChgCell(now,prev,goodWhen){
  if(!ddNum(now)||!ddNum(prev)||!Number(prev)) return {txt:'data unavailable',dot:'y'};
  var ch=(Number(now)-Number(prev))/Math.abs(Number(prev));
  var txt=(ch>=0?'+':'')+(ch*100).toFixed(1)+'%';
  var dot='y';
  if(Math.abs(ch)<0.01) dot='y';
  else if(goodWhen==='up') dot=ch>0?'g':'r';
  else if(goodWhen==='down') dot=ch<0?'g':'r';
  return {txt:txt,dot:dot};
}

/* one-sentence business summaries for bundled tickers (editable in section 1) */
var DD_DESC={
  AAPL:'Apple designs and sells iPhones, Macs, wearables, and high-margin services like the App Store and subscriptions.',
  MSFT:'Microsoft sells software and cloud services anchored by Azure, Office 365, and Windows.',
  NVDA:'NVIDIA designs graphics processors and data-center chips, with most profit now coming from data-center sales.',
  AMZN:'Amazon earns most of its profit from AWS cloud services while online and physical retail drive the bulk of sales.',
  META:'Meta Platforms earns nearly all its revenue from advertising on Facebook, Instagram, and WhatsApp.',
  GOOGL:'Alphabet earns most revenue from Google advertising, with Google Cloud and YouTube growing fast.',
  TSLA:'Tesla makes electric vehicles and energy-storage products, with services and software adding higher-margin revenue.',
  AMD:'Advanced Micro Devices designs CPUs and GPUs for PCs, data centers, and gaming consoles.',
  NFLX:'Netflix is a subscription streaming service for movies and TV shows, now adding an advertising tier.',
  AVGO:'Broadcom sells semiconductors and infrastructure software, grown largely through acquisitions.',
  JPM:'JPMorgan Chase is the largest US bank, earning from lending, investment banking, trading, and asset management.',
  XOM:'Exxon Mobil explores for and produces oil and gas and refines petroleum into fuels and chemicals.',
  LLY:'Eli Lilly develops and sells prescription medicines, led by diabetes and obesity treatments.',
  WMT:'Walmart is the world\u2019s largest retailer, selling groceries and general merchandise in stores and online.',
  SOFI:'SoFi Technologies is a digital financial-services company offering banking, lending, and investing through its app.'
};
var DD_PEERS={
  NVDA:['AMD','AVGO'], AMD:['NVDA','AVGO'], AAPL:['MSFT'], MSFT:['AAPL','GOOGL'],
  GOOGL:['META','MSFT'], META:['GOOGL'], AMZN:['MSFT','GOOGL'],
  TSLA:[], NFLX:[], AVGO:['NVDA','AMD'], JPM:[], XOM:[], LLY:[], WMT:[], SOFI:[]
};
var DD_MOAT=[
  ['switching','Switching costs'],['network','Network effects'],['brand','Brand'],
  ['costadv','Cost advantage'],['scale','Economies of scale'],['distribution','Distribution'],
  ['ip','Intellectual property'],['regulatory','Regulatory barriers'],['lockin','Customer lock-in']
];
var DD_STRENGTHS=['Unknown','Weak','Moderate','Strong'];

/* ================================================================
   SECTION 1 — Business Model Breakdown
   ================================================================ */
function ddS1(t){
  var s=ddGet(t), bundled=ddHasData(t);
  var desc=(s.biz.desc!=null&&s.biz.desc!=='')?s.biz.desc:(DD_DESC[t]||'');
  var h=ddSec('dd-s1',1,ex('dd-biz','Business Model Breakdown'),
    'What the company sells, who pays, and where the revenue comes from. The description below is a plain summary — edit it in your own words; it is saved per ticker.',
    '<table class="tbl"><tr><th>Company</th><th>CIK</th><th>Data source</th></tr>'
    +'<tr><td><b>'+ddE(ddCoName(t))+'</b> ('+ddE(t)+')</td><td class="mono">'+ddE(ddCik(t))+'</td>'
    +'<td>'+(bundled?'built-in SEC data':(s.manual.length?'user-entered figures':'no figures yet'))+'</td></tr></table>'
    +fieldRow('Business description',
      '<textarea class="in" rows="3" style="width:100%" data-dd-f="biz.desc" placeholder="In your own words: what does this company sell, and who pays for it?">'+ddE(desc)+'</textarea>',
      bundled&&DD_DESC[t]&&!s.biz.desc?'Prefilled with a one-line summary — edit freely; your text is saved.':'Your words, saved per ticker.')
  );
  /* segments */
  var segs=s.biz.segments||[];
  var tot=segs.reduce(function(a,g){ return a+(ddNum(g.pct)?Number(g.pct):0); },0);
  var segRows=segs.map(function(g,i){
    var w=ddNum(g.pct)?Math.max(0,Math.min(100,Number(g.pct))):0;
    return '<div style="display:flex;align-items:center;gap:8px;margin:4px 0">'
      +'<div style="width:180px" class="small">'+ddE(g.name||'(unnamed)')+'</div>'
      +'<div style="flex:1;background:#161b22;border-radius:4px;height:14px"><div style="height:14px;border-radius:4px;background:#58a6ff;width:'+w+'%"></div></div>'
      +'<div class="mono small" style="width:56px;text-align:right">'+ddE(String(g.pct||0))+'%</div>'
      +'<button class="btn sm" data-dd-act="segdel" data-dd-i="'+i+'">remove</button></div>';
  }).join('');
  h+='<div class="panel" style="margin-top:10px"><h3>Revenue by segment</h3>'
    +'<p class="small">Break revenue into the pieces you care about (from the 10-K segment note). Percentages should add to about 100%.</p>'
    +'<div id="dd-seg-list">'+(segRows||emptyBox('No segments added yet.'))+'</div>'
    +'<div class="small" style="margin:6px 0">Total: <b class="mono">'+tot.toFixed(1)+'%</b>'
    +(Math.abs(tot-100)>2&&segs.length?' <span class="badge" style="background:#5a2d2d;color:#f0b0b0">does not sum to ~100%</span>':'')+'</div>'
    +'<div class="grid g3">'+fieldRow('Segment name',textInput('dd-seg-name','','e.g. iPhone'))
    +fieldRow('% of revenue',numInput('dd-seg-pct','',1))
    +'<div class="frow"><label class="f">&nbsp;</label><button class="btn" data-dd-act="segadd">Add segment</button></div></div></div>';
  h+='<div class="grid g2" style="margin-top:10px">'
    +'<div class="panel"><h3>Geography</h3>'
    +fieldRow('Where the money comes from',
      '<textarea class="in" rows="2" style="width:100%" data-dd-f="biz.geo" placeholder="e.g. ~45% Americas, 25% Europe, 30% Asia-Pacific (10-K geographic note)">'+ddE(s.biz.geo||'')+'</textarea>')+'</div>'
    +'<div class="panel"><h3>Customers &amp; suppliers</h3>'
    +fieldRow('Key customers / concentration',
      '<textarea class="in" rows="2" style="width:100%" data-dd-f="biz.customers" placeholder="e.g. no single customer over 10% of revenue (10-K risk factors)">'+ddE(s.biz.customers||'')+'</textarea>')+'</div>'
    +'</div>';
  h+='</section>';
  return h;
}

/* ================================================================
   SECTION 2 — Revenue Quality
   ================================================================ */
function ddS2(t){
  var series=ddSeries(t), s0=series[0];
  var body='';
  if(series.length<2||!ddNum(s0.revenue)){
    body=emptyBox('Need at least two fiscal years of revenue to judge growth quality.');
  } else {
    var yoy=ddYoY(series,'revenue');
    var fys=series.map(function(r){ return r.fy; });
    var g0=yoy[fys[0]], g1=yoy[fys[1]];
    var cagr=series.length>=3?ddCagr(series[0].revenue,series[series.length-1].revenue,series.length-1):null;
    var accel=(ddNum(g0)&&ddNum(g1))?(g0-g1):null;
    var rows=fys.map(function(fy,i){
      return ['FY '+fy, ddMoney(series[i].revenue), i<fys.length-1?ddPct(yoy[fy]):'<span class="small">—</span>'];
    });
    body=ddTbl(['Fiscal year','Revenue','YoY growth'],rows);
    body+=ddRule('YoY growth = (this year \u2212 last year) \u00F7 last year. CAGR = (new \u00F7 old)<sup>1/years</sup> \u2212 1. Acceleration = latest YoY \u2212 prior YoY.');
    if(ddNum(g0)) body+='<div class="grid g3" style="margin:10px 0">'
      +'<div class="kpi"><div class="k">Latest YoY growth</div><div class="v">'+ddPct(g0)+'</div><div class="d">FY '+fys[0]+' vs FY '+fys[1]+'</div></div>'
      +'<div class="kpi"><div class="k">'+(series.length-1)+'-yr CAGR</div><div class="v">'+ddPct(cagr)+'</div><div class="d">FY '+fys[fys.length-1]+' \u2192 FY '+fys[0]+'</div></div>'
      +'<div class="kpi"><div class="k">Acceleration</div><div class="v">'+ddPct(accel)+'</div><div class="d">latest YoY minus prior YoY</div></div></div>';
    /* rule-generated paragraph — evidence only, no score */
    var p='<h3>How good is the company\u2019s growth?</h3><ul class="small">';
    if(ddNum(g0)&&ddNum(g1)){
      p+='<li>Revenue grew '+ddPct(g0)+' in FY '+fys[0]+', after '+ddPct(g1)+' in FY '+fys[1]+'.</li>';
      p+='<li>Growth '+(accel>0.005?'accelerated':'decelerated')+' by '+ddPct(Math.abs(accel))+' ('+(accel>0.005?'latest pace is faster than the prior year':'the pace is slowing even if sales still rose')+').</li>';
    }
    if(ddNum(cagr)) p+='<li>The '+(series.length-1)+'-year compound pace is '+ddPct(cagr)+' per year — the steady rate that connects FY '+fys[fys.length-1]+' to FY '+fys[0]+'.</li>';
    if(ddNum(g0)&&g0<0) p+='<li>Revenue shrank in the latest year. A deep dive should ask whether that is cyclical, competitive, or structural — the numbers alone cannot say.</li>';
    p+='</ul>';
    body+=p;
    body+=Charts.vbar(fys.slice().reverse(), series.map(function(r){ return ddNum(r.revenue)?Number(r.revenue):0; }).reverse(), 720, 180, '#58a6ff');
  }
  var s=ddGet(t);
  body+='<div class="grid g2" style="margin-top:10px"><div class="panel"><h3>Your estimates</h3>'
    +fieldRow('Recurring revenue % (your estimate)',
      '<input class="in" type="number" data-dd-f="revq.recurring" data-dd-num="1" value="'+ddE(s.revq&&s.revq.recurring!=null?s.revq.recurring:'')+'" step="1" min="0" max="100">',
      'Share of revenue that repeats without re-selling (subscriptions, contracts). Not in the dataset — your judgment.')
    +'</div><div class="panel"><h3>Pricing vs volume</h3>'
    +fieldRow('Note',
      '<textarea class="in" rows="2" style="width:100%" data-dd-f="revq.pvnote" placeholder="Is growth coming from higher prices, more units, or acquisitions? (10-K MD&A)">'+ddE(s.revq&&s.revq.pvnote?s.revq.pvnote:'')+'</textarea>')+'</div></div>';
  return ddSec('dd-s2',2,ex('dd-revqual','Revenue Quality'),
    'Fast growth is good; accelerating growth on a recurring base is better. Below: year-by-year growth, the multi-year compound pace, and whether the pace is speeding up or slowing down.',
    body+'</section>');
}

/* ================================================================
   SECTION 3 — Profitability
   ================================================================ */
function ddMargins(r){
  var m={};
  if(ddNum(r.revenue)&&Number(r.revenue)!==0){
    var rev=Number(r.revenue);
    m.gross=ddNum(r.gross_profit)?Number(r.gross_profit)/rev:null;
    m.op=ddNum(r.op_income)?Number(r.op_income)/rev:null;
    m.net=ddNum(r.net_income)?Number(r.net_income)/rev:null;
    m.fcf=ddNum(r.op_cash)?Number(r.op_cash)/rev:null;
  }
  m.roe=(ddNum(r.net_income)&&ddNum(r.assets)&&ddNum(r.total_liab)&&(Number(r.assets)-Number(r.total_liab))!==0)
    ?Number(r.net_income)/(Number(r.assets)-Number(r.total_liab)):null;
  m.roa=(ddNum(r.net_income)&&ddNum(r.assets)&&Number(r.assets)!==0)?Number(r.net_income)/Number(r.assets):null;
  m.roic=(ddNum(r.op_income)&&ddNum(r.assets)&&ddNum(r.cur_liab)&&(Number(r.assets)-Number(r.cur_liab))>0)
    ?Number(r.op_income)*0.79/(Number(r.assets)-Number(r.cur_liab)):null;
  return m;
}
function ddS3(t){
  var series=ddSeries(t);
  var body='';
  if(!series.length||!ddNum(series[0].revenue)){
    body=emptyBox('No revenue figures available — profitability cannot be computed.');
  } else {
    var ms=series.map(ddMargins);
    var rows=[
      ['Gross margin', ms.map(function(m){ return ddPct(m.gross); })],
      ['Operating margin', ms.map(function(m){ return ddPct(m.op); })],
      ['Net margin', ms.map(function(m){ return ddPct(m.net); })],
      ['ROIC', ms.map(function(m){ return ddPct(m.roic); })],
      ['ROE', ms.map(function(m){ return ddPct(m.roe); })],
      ['ROA', ms.map(function(m){ return ddPct(m.roa); })],
      ['FCF-proxy margin (op. cash flow \u00F7 revenue)', ms.map(function(m){ return ddPct(m.fcf); })]
    ];
    var heads=['Metric'].concat(series.map(function(r){ return 'FY '+r.fy; }));
    body=ddTbl(heads, rows.map(function(r){ return [r[0]].concat(r[1]); }));
    body+=ddRule('ROIC = operating income \u00D7 (1 \u2212 21% tax) \u00F7 (total assets \u2212 current liabilities). The 21% is the US federal corporate rate — an assumption, not the company\u2019s actual tax rate. FCF-proxy margin uses operating cash flow because capital expenditure is not in this dataset (it overstates true free cash flow).');
    /* divergence explainer */
    if(series.length>=2){
      var m0=ms[0], m1=ms[1], yoy=ddYoY(series,'revenue');
      var g=yoy[series[0].fy], notes=[];
      if(ddNum(g)&&g>0&&ddNum(m0.op)&&ddNum(m1.op)&&m0.op<m1.op-0.005)
        notes.push('Revenue rose '+ddPct(g)+' but operating margin fell from '+ddPct(m1.op)+' to '+ddPct(m0.op)+' — operating costs grew faster than sales. Check whether SG&amp;A or R&amp;D stepped up in the 10-K.');
      if(ddNum(g)&&g>0&&ddNum(m0.net)&&ddNum(m1.net)&&m0.net<m1.net-0.005&&!(ddNum(m0.op)&&ddNum(m1.op)&&m0.op<m1.op-0.005))
        notes.push('Sales grew but net margin slipped from '+ddPct(m1.net)+' to '+ddPct(m0.net)+' while operating margin held — the drag came below the operating line (interest, taxes, or other items).');
      if(ddNum(m0.gross)&&ddNum(m1.gross)&&m0.gross<m1.gross-0.005&&ddNum(m0.op)&&ddNum(m1.op)&&m0.op>=m1.op-0.005)
        notes.push('Gross margin slipped from '+ddPct(m1.gross)+' to '+ddPct(m0.gross)+' but operating margin held — the company offset weaker product economics with tighter operating expenses.');
      if(ddNum(m0.op)&&ddNum(m1.op)&&m0.op>m1.op+0.01)
        notes.push('Operating margin expanded from '+ddPct(m1.op)+' to '+ddPct(m0.op)+' — each new dollar of sales carried more profit, a sign of operating leverage or pricing power.');
      if(ddNum(m0.roic)&&m0.roic>0.15)
        notes.push('ROIC of '+ddPct(m0.roic)+' clears 15% — the business earns well above a typical cost of capital on the money tied up in it.');
      else if(ddNum(m0.roic)&&m0.roic<0.08)
        notes.push('ROIC of '+ddPct(m0.roic)+' is modest — the business ties up a lot of capital for each dollar of operating profit.');
      if(notes.length) body+='<h3>What the pattern says</h3><ul class="small">'+notes.map(function(n){ return '<li>'+n+'</li>'; }).join('')+'</ul>';
    }
  }
  return ddSec('dd-s3',3,ex('dd-profit','Profitability'),
    'Margins show how much of each sales dollar survives each layer of cost; ROIC/ROE/ROA show how hard the invested money works.',
    body+'</section>');
}

/* ================================================================
   SECTION 4 — Cash Flow Quality
   ================================================================ */
function ddS4(t){
  var series=ddSeries(t);
  var body='';
  if(!series.length){
    body=emptyBox('No figures available.');
  } else {
    var rows=series.map(function(r){
      return ['FY '+r.fy, ddMoney(r.net_income), ddMoney(r.op_cash),
        (ddNum(r.net_income)&&ddNum(r.op_cash)&&Number(r.net_income)!==0)?ddPct(Number(r.op_cash)/Number(r.net_income)):'data unavailable'];
    });
    body=ddTbl(['Fiscal year','Net income','Operating cash flow','OCF \u00F7 NI'],rows);
    body+=ddRule('Cash conversion = operating cash flow \u00F7 net income. Above 1 means profit arrived as cash; persistently below 1 means profit is tied up somewhere (receivables, inventory, timing).');
    var last3=series.slice(0,3), below=0, belowFys=[];
    last3.forEach(function(r){
      if(ddNum(r.net_income)&&ddNum(r.op_cash)&&Number(r.op_cash)<Number(r.net_income)){ below++; belowFys.push('FY '+r.fy); }
    });
    var flags=[];
    if(below>=2) flags.push('<b>Flag:</b> operating cash flow was below net income in '+below+' of the last '+last3.length+' years ('+belowFys.join(', ')+'). Rule: OCF &lt; NI in 2+ years suggests profits are arriving slower as cash. Common accounting reasons — not wrongdoing — include customers paying later (receivables up), inventory builds, or revenue recognized before cash arrives. For banks and lenders (e.g. loan originations sit in operating cash flow), negative or lumpy OCF can be normal.');
    else if(below===1) flags.push('Operating cash flow trailed net income in one recent year ('+belowFys.join(', ')+') — worth watching, but a single year is often timing.');
    else if(last3.length) flags.push('Operating cash flow covered net income in each of the last '+last3.length+' years — reported profit is arriving as cash.');
    flags.push('<b>Stock-based compensation:</b> not in this dataset — it appears in the 10-K cash-flow statement\u2019s operating section and the notes. A company can report strong profit while paying staff in shares instead of cash.');
    flags.push('<b>Capital expenditure:</b> not in this dataset, so true free cash flow (OCF \u2212 capex) cannot be computed. The \u201CFCF-proxy\u201D used on this page is operating cash flow, which overstates true free cash flow.');
    flags.push('<b>Debt issuance vs cash generation:</b> not in this dataset — the financing section of the 10-K cash-flow statement shows whether the company funds itself by borrowing.');
    body+='<ul class="small">'+flags.map(function(f){ return '<li>'+f+'</li>'; }).join('')+'</ul>';
  }
  return ddSec('dd-s4',4,ex('dd-cashq','Cash Flow Quality'),
    'Profit is an opinion; cash is closer to a fact. This section checks whether the earnings on the income statement actually showed up in the bank.',
    body+'</section>');
}

/* ================================================================
   SECTION 5 — Balance Sheet Stress Test
   ================================================================ */
function ddDebtEbitda(r){
  if(!ddNum(r.total_liab)||!ddNum(r.op_income)||Number(r.op_income)<=0) return null;
  return Number(r.total_liab)/Number(r.op_income);
}
function ddIntCov(r){
  if(!ddNum(r.op_income)||!ddNum(r.interest_exp)||Number(r.interest_exp)<=0) return null;
  return Number(r.op_income)/Number(r.interest_exp);
}
function ddS5(t){
  var series=ddSeries(t), r=series[0]||{};
  var body='';
  if(!series.length){
    body=emptyBox('No figures available.');
  } else {
    var cur=ddNum(r.cur_assets)&&ddNum(r.cur_liab)&&Number(r.cur_liab)!==0?Number(r.cur_assets)/Number(r.cur_liab):null;
    var de=ddDebtEbitda(r), ic=ddIntCov(r);
    var shYoy=ddYoY(series,'shares_dil'), shChg=shYoy[r.fy];
    var assets=ddNum(r.assets)?Number(r.assets):null, liab=ddNum(r.total_liab)?Number(r.total_liab):null;
    var equity=(assets!=null&&liab!=null)?assets-liab:null;
    var shN=ddNum(r.shares_dil)?Number(r.shares_dil):null;
    var bvps=(equity!=null&&shN)?equity/shN:null;
    var px=(typeof lastClose==='function')?lastClose(t):null;
    var pb=(bvps&&bvps>0&&px)?px/bvps:null;
    var rows=[
      ['Liquid-assets proxy (current assets)', ddMoney(r.cur_assets)],
      ['Total liabilities', ddMoney(r.total_liab)],
      ['Long-term debt', ddMoney(r.lt_debt)],
      ['Total equity, computed (assets \u2212 liabilities)', equity==null?'data unavailable':ddMoney(equity)],
      ['Book value per share (equity \u00F7 diluted shares)', bvps==null?'data unavailable':'$'+bvps.toFixed(2)],
      ['Price \u00F7 book (P/B)', pb==null?'data unavailable':pb.toFixed(2)+'\u00D7'],
      ['Current ratio (current assets \u00F7 current liabilities)', ddNum(cur)?cur.toFixed(2)+'\u00D7':'data unavailable'],
      ['Debt \u00F7 operating income (EBIT proxy)', ddNum(de)?de.toFixed(2)+'\u00D7':'data unavailable'],
      ['Interest coverage (operating income \u00F7 interest)', ddNum(ic)?ic.toFixed(1)+'\u00D7':'data unavailable'],
      ['Diluted shares, latest YoY change', ddNum(shChg)?ddPct(shChg):'data unavailable']
    ];
    body=ddTbl(['Measure','Latest FY '+r.fy],rows);
    body+=ddRule('Debt \u00F7 EBITDA uses operating income as the EBIT proxy because depreciation detail is not in this dataset — an assumption that understates true EBITDA. Current assets stand in for liquid resources; they include inventory and receivables, not just cash. Equity is computed as total assets \u2212 total liabilities (the accounting identity) \u2014 it is not reported directly in the dataset.');
    var notes=[];
    if(pb) notes.push('P/B is '+pb.toFixed(2)+'\u00D7 \u2014 you pay $'+pb.toFixed(2)+' for each $1 of book value. Banks and insurers are usually judged on book value more than earnings.');
    if(ddNum(ic)&&ic<3) notes.push('Interest coverage of '+ic.toFixed(1)+'\u00D7 is thin (rule: under 3\u00D7 flags) — operating profit covers interest only '+ic.toFixed(1)+' times.');
    else if(ddNum(ic)) notes.push('Interest coverage of '+ic.toFixed(1)+'\u00D7 — debt payments look comfortable at current profit.');
    if(ddNum(de)&&de>4) notes.push('Debt is '+de.toFixed(1)+'\u00D7 operating income (rule: over 4\u00D7 flags) — leverage is high relative to earnings power.');
    if(ddNum(shChg)&&shChg>0.05) notes.push('Shares grew '+ddPct(shChg)+' in one year (rule: over 5% flags dilution) — a jump this large in a single year is usually a stock split or acquisition, not creeping dilution; the 10-K cover page confirms.');
    else if(ddNum(shChg)&&shChg<-0.02) notes.push('Shares shrank '+ddPct(Math.abs(shChg))+' — consistent with buybacks retiring stock.');
    notes.push('<b>Goodwill &amp; intangibles:</b> not broken out in this dataset — the 10-K balance sheet shows whether assets are real or acquisition premiums.');
    if(notes.length) body+='<ul class="small">'+notes.map(function(n){ return '<li>'+n+'</li>'; }).join('')+'</ul>';
    /* interactive stress sliders */
    var debtBase=ddNum(r.lt_debt)?Number(r.lt_debt):(ddNum(r.total_liab)?Number(r.total_liab):null);
    var debtLabel=ddNum(r.lt_debt)?'long-term debt':'total liabilities';
    body+='<div class="panel" style="margin-top:10px"><h3>What-if stress</h3>'
      +'<p class="small">Drag the sliders — the pro-forma numbers update instantly. Formulas are shown; every input is an assumption, not a forecast.</p>'
      +fieldRow('Revenue fall: <b class="mono" id="dd-st-rev-v">20%</b>',
        '<input type="range" id="dd-st-rev" min="0" max="40" step="5" value="20" style="width:100%" data-dd-re="stress">')
      +fieldRow('Rate rise: <b class="mono" id="dd-st-rate-v">+2.0pp</b>',
        '<input type="range" id="dd-st-rate" min="0" max="5" step="0.5" value="2" style="width:100%" data-dd-re="stress">')
      +'<div id="dd-st-out"></div>'
      +'<input type="hidden" id="dd-st-debt" value="'+(debtBase==null?'':debtBase)+'">'
      +'<input type="hidden" id="dd-st-op" value="'+(ddNum(r.op_income)?r.op_income:'')+'">'
      +'<input type="hidden" id="dd-st-ie" value="'+(ddNum(r.interest_exp)?r.interest_exp:'')+'">'
      +'<input type="hidden" id="dd-st-ocf" value="'+(ddNum(r.op_cash)?r.op_cash:'')+'">'
      +ddRule('Stressed operating income = operating income \u00D7 (1 \u2212 revenue fall). Stressed interest = '+ddE(debtLabel)+' \u00D7 (implied rate + rate rise), where implied rate = interest expense \u00F7 '+ddE(debtLabel)+'. Coverage = stressed operating income \u00F7 stressed interest. Est. cash after interest = stressed operating cash flow \u2212 stressed interest.')
      +'</div>';
  }
  return ddSec('dd-s5',5,ex('dd-stress','Balance Sheet Stress Test'),
    'Debt is comfortable until it isn\u2019t. This section measures the cushion — then lets you shrink it with the sliders.',
    body+'</section>');
}
function ddRenderStress(){
  var out=document.getElementById('dd-st-out'); if(!out) return;
  var revEl=document.getElementById('dd-st-rev'), rateEl=document.getElementById('dd-st-rate');
  var d=revEl?Number(revEl.value)/100:0.2, p=rateEl?Number(rateEl.value)/100:0.02;
  var rv=document.getElementById('dd-st-rev-v'); if(rv) rv.textContent=Math.round(d*100)+'%';
  var rt=document.getElementById('dd-st-rate-v'); if(rt) rt.textContent='+'+(p*100).toFixed(1)+'pp';
  function hv(id){ var e=document.getElementById(id); return e&&e.value!==''?Number(e.value):null; }
  var debt=hv('dd-st-debt'), op=hv('dd-st-op'), ie=hv('dd-st-ie'), ocf=hv('dd-st-ocf');
  if(debt==null||op==null||ie==null){
    out.innerHTML=emptyBox('Stress math needs operating income, interest expense, and debt — one or more is unavailable for this company.');
    return;
  }
  var implied=debt!==0?ie/debt:null;
  var sOp=op*(1-d), sInt=implied==null?ie*(1+p*4):debt*(implied+p);
  var cov=sInt>0?sOp/sInt:null;
  var cash=ocf==null?null:ocf*(1-d)-sInt;
  out.innerHTML='<div class="grid g3" style="margin-top:8px">'
    +'<div class="kpi"><div class="k">Stressed interest coverage</div><div class="v">'+(cov==null?'data unavailable':cov.toFixed(1)+'\u00D7')+'</div><div class="d">was '+(ie>0?(op/ie).toFixed(1)+'\u00D7':'n/a')+'</div></div>'
    +'<div class="kpi"><div class="k">Stressed interest bill</div><div class="v">'+Util.money(sInt)+'</div><div class="d">was '+Util.money(ie)+'</div></div>'
    +'<div class="kpi"><div class="k">Est. cash after interest</div><div class="v">'+(cash==null?'data unavailable':Util.money(cash))+'</div><div class="d">stressed OCF-proxy minus stressed interest</div></div></div>'
    +(cov!=null&&cov<1.5?'<div class="alert warn">Under this stress, operating income covers interest only '+cov.toFixed(1)+'\u00D7 — below the 1.5\u00D7 comfort line. This is arithmetic on assumptions, not a prediction.</div>':'');
}

/* ================================================================
   SECTION 6 — Moat
   ================================================================ */
function ddS6(t){
  var s=ddGet(t);
  var cards=DD_MOAT.map(function(c){
    var key=c[0], saved=s.moat[key]||{};
    var str=saved.s||'Unknown', ev=saved.ev||'';
    var opts=DD_STRENGTHS.map(function(x){
      return '<option value="'+x+'"'+(x===str?' selected':'')+'>'+x+'</option>';
    }).join('');
    var badge=str==='Strong'?'<span class="badge" style="background:#1a3a24;color:#7ee2a0">Strong</span>'
      :str==='Moderate'?'<span class="badge" style="background:#3a331a;color:#e2c87e">Moderate</span>'
      :str==='Weak'?'<span class="badge" style="background:#3a1a1a;color:#e28a7e">Weak</span>'
      :'<span class="badge" style="background:#232c3b;color:#8b949e">Unknown</span>';
    return '<div class="panel"><h3>'+ddE(c[1])+' '+badge+'</h3>'
      +fieldRow('Strength','<select class="in" data-dd-moat-s="'+key+'">'+opts+'</select>')
      +fieldRow('Evidence',
        '<textarea class="in" rows="2" style="width:100%" data-dd-moat-e="'+key+'" placeholder="Cite a filing fact, not an adjective — e.g. \u201C10-K: 82% of revenue under multi-year contracts\u201D, not \u201Csticky product\u201D.">'+ddE(ev)+'</textarea>')
      +'</div>';
  }).join('');
  var scored=DD_MOAT.filter(function(c){ return (s.moat[c[0]]||{}).s==='Strong'; }).length;
  return ddSec('dd-s6',6,ex('dd-moat','Moat'),
    'Nine places a lasting edge can hide. Rate each one — but a rating without evidence is just an opinion, so every row demands a cited fact. Saved per ticker.',
    '<p class="small">Criteria rated <b>Strong</b> with evidence: <b>'+scored+' / 9</b>. A moat is a conclusion you argue for, not a number — the evidence column is the point.</p>'
    +'<div class="grid g3">'+cards+'</div></section>');
}

/* ================================================================
   SECTION 7 — Competitors
   ================================================================ */
function ddPeerRows(t){
  var peers=[t].concat(DD_PEERS[t]||[]).concat((ddGet(t).peers||[]));
  var seen={};
  peers=peers.filter(function(x){ x=String(x).toUpperCase(); if(seen[x]) return false; seen[x]=1; return true; });
  return peers;
}
function ddPeerMetrics(p){
  var series=ddSeries(p), r=series[0]||{};
  var yoy=ddYoY(series,'revenue'), g=yoy[r.fy];
  var m=ddMargins(r);
  var price=ddPrice(p).val;
  var eps=(ddNum(r.net_income)&&ddNum(r.shares_dil)&&Number(r.shares_dil)!==0)?Number(r.net_income)/Number(r.shares_dil):null;
  var pe=(ddNum(price)&&ddNum(eps)&&eps>0)?price/eps:null;
  var mcap=(ddNum(price)&&ddNum(r.shares_dil))?price*Number(r.shares_dil):null;
  var ev=(ddNum(mcap)&&ddNum(r.total_liab)&&ddNum(r.cur_assets))?mcap+Number(r.total_liab)-Number(r.cur_assets):null;
  var evebitda=(ddNum(ev)&&ddNum(r.op_income)&&Number(r.op_income)>0)?ev/Number(r.op_income):null;
  return {has:series.length>0&&ddNum(r.revenue), rev_g:g, m:m, pe:pe, evebitda:evebitda,
    debt_ebitda:ddDebtEbitda(r), name:ddCoName(p)};
}
function ddS7(t){
  var peers=ddPeerRows(t);
  var mets={}; peers.forEach(function(p){ mets[p]=ddPeerMetrics(p); });
  var sub=mets[t];
  var heads=['Company','Rev growth','Gross margin','Op margin','FCF-proxy margin','ROIC','P/E','EV/EBITDA','Debt/EBITDA'];
  var rows=peers.map(function(p){
    var x=mets[p];
    if(!x.has) return ['<b>'+ddE(p)+'</b>'].concat(heads.slice(1).map(function(){ return 'data unavailable'; }));
    return ['<b>'+ddE(p)+'</b><div class="small">'+ddE(x.name)+'</div>',
      ddPct(x.rev_g), ddPct(x.m.gross), ddPct(x.m.op), ddPct(x.m.fcf),
      ddPct(x.m.roic), x.pe==null?'data unavailable':x.pe.toFixed(1)+'\u00D7',
      x.evebitda==null?'data unavailable':x.evebitda.toFixed(1)+'\u00D7',
      x.debt_ebitda==null?'data unavailable':x.debt_ebitda.toFixed(1)+'\u00D7'];
  });
  var body=ddTbl(heads,rows);
  body+=ddRule('P/E = share price \u00F7 (net income \u00F7 diluted shares), latest fiscal year. EV = market cap + total liabilities \u2212 current assets (current assets stand in for cash — an approximation). EV/EBITDA uses operating income as the EBITDA proxy. \u201CData unavailable\u201D means the peer has no bundled figures — nothing is estimated.');
  /* rule-generated notes on why differences exist */
  var notes=[];
  if(sub.has){
    peers.forEach(function(p){
      if(p===t) return;
      var x=mets[p]; if(!x.has) return;
      var bits=[];
      if(ddNum(sub.m.gross)&&ddNum(x.m.gross)&&Math.abs(sub.m.gross-x.m.gross)>0.08)
        bits.push('gross margin '+ddPct(sub.m.gross)+' vs '+ddPct(x.m.gross)+' — a '+(Math.abs(sub.m.gross-x.m.gross)*100).toFixed(0)+'pp gap usually comes from different product mix or pricing power');
      if(ddNum(sub.rev_g)&&ddNum(x.rev_g)&&Math.abs(sub.rev_g-x.rev_g)>0.08)
        bits.push('revenue growth '+ddPct(sub.rev_g)+' vs '+ddPct(x.rev_g)+' — different growth phases or end markets');
      if(ddNum(sub.pe)&&ddNum(x.pe)&&Math.abs(sub.pe-x.pe)>8)
        bits.push('P/E '+sub.pe.toFixed(0)+'\u00D7 vs '+x.pe.toFixed(0)+'\u00D7 — the market is paying for faster expected growth, lower risk, or both');
      if(bits.length) notes.push('<b>'+ddE(t)+' vs '+ddE(p)+':</b> '+bits.join('; ')+'.');
    });
  }
  if(notes.length) body+='<h3>Reading the gaps</h3><ul class="small">'+notes.map(function(n){ return '<li>'+n+'</li>'; }).join('')+'</ul>';
  else if(peers.length>1) body+='<p class="small">Peers are close enough on the headline metrics that no large gap stands out — the differences, if any, live in the segment and moat sections.</p>';
  var manual=(ddGet(t).peers||[]).map(function(p,i){
    return '<span class="tag">'+ddE(p)+' <button class="btn sm" data-dd-act="peerdel" data-dd-i="'+i+'" title="Remove">\u00D7</button></span>';
  }).join(' ');
  body+='<div class="panel" style="margin-top:10px"><h3>Peer list</h3>'
    +'<p class="small">Built-in peers: '+((DD_PEERS[t]||[]).join(', ')||'none — add your own')+'. '+tickerHint()+'</p>'
    +'<div style="margin-bottom:8px">'+(manual||'<span class="small">No manual peers added.</span>')+'</div>'
    +'<div class="grid g2">'+fieldRow('Add peer ticker',tickerInput('dd-peer-add','','e.g. CELH'))
    +'<div class="frow"><label class="f">&nbsp;</label><button class="btn" data-dd-act="peeradd">Add peer</button></div></div></div>';
  return ddSec('dd-s7',7,ex('dd-peers','Competitors'),
    'Every metric above is more meaningful next to a rival\u2019s. Peers without bundled data show as \u201Cdata unavailable\u201D — never estimated.',
    body+'</section>');
}

/* ================================================================
   SECTION 8 — Management
   ================================================================ */
function ddS8(t){
  var s=ddGet(t), m=s.mgmt, series=ddSeries(t);
  var body='<div class="panel"><h3>What has management actually done with shareholder capital?</h3>'
    +'<p class="small">Promises are cheap. The share count, retained profits, and pay tell the real story.</p>'
    +'<div class="grid g2">'
    +fieldRow('CEO', textInput('dd-m-ceo',m.ceo||'','Name'))
    +fieldRow('Tenure', textInput('dd-m-tenure',m.tenure||'','e.g. CEO since 2019'))
    +fieldRow('Insider ownership % (your research)', numInput('dd-m-insider',m.insider,'0.1'))
    +fieldRow('Compensation notes', textInput('dd-m-comp',m.comp||'','e.g. mostly stock-based; see proxy statement'))
    +'</div>'
    +fieldRow('Notes', '<textarea class="in" rows="2" style="width:100%" id="dd-m-notes" placeholder="Capital allocation track record, red flags, things to verify\u2026">'+ddE(m.notes||'')+'</textarea>')
    +'</div>';
  if(series.length>=2){
    var shYoy=ddYoY(series,'shares_dil');
    var first=series[series.length-1], last=series[0];
    var shChg=(ddNum(first.shares_dil)&&ddNum(last.shares_dil)&&Number(first.shares_dil)!==0)
      ?(Number(last.shares_dil)/Number(first.shares_dil)-1):null;
    var retChg=(ddNum(first.retained)&&ddNum(last.retained))
      ?(Number(last.retained)-Number(first.retained)):null;
    var rows=series.map(function(r){
      return ['FY '+r.fy, ddNum(r.shares_dil)?Util.num(Number(r.shares_dil),0):'data unavailable',
        ddNum(shYoy[r.fy])?ddPct(shYoy[r.fy]):'<span class="small">—</span>',
        ddMoney(r.retained)];
    });
    body+='<div class="panel" style="margin-top:10px"><h3>Computed from the filings</h3>'
      +ddTbl(['Fiscal year','Diluted shares','YoY change','Retained earnings'],rows)
      +ddRule('Share change = (this year \u2212 last year) \u00F7 last year. A shrinking count is consistent with buybacks; a growing count means dilution. A sudden one-year jump of 50%+ is usually a stock split or acquisition — the 10-K cover page confirms.');
    var read=[];
    if(ddNum(shChg)){
      if(shChg<-0.02) read.push('Shares shrank '+ddPct(Math.abs(shChg))+' from FY '+first.fy+' to FY '+last.fy+' — management returned capital by retiring stock.');
      else if(shChg>0.05) read.push('Shares grew '+ddPct(shChg)+' from FY '+first.fy+' to FY '+last.fy+' — existing holders were diluted (check whether a split or acquisition explains a sudden jump).');
      else read.push('Share count barely moved ('+ddPct(shChg)+') from FY '+first.fy+' to FY '+last.fy+' — neither meaningful buybacks nor dilution.');
    }
    if(ddNum(retChg)) read.push('Retained earnings moved '+Util.money(retChg)+' over the period — '+(retChg>=0?'profits were kept in the business rather than paid out.':'losses ate into the accumulated cushion.'));
    read.push('<b>Dividend history:</b> not in this dataset — the 10-K statement of shareholders\u2019 equity (or the cash-flow financing section) shows dividends paid.');
    if(read.length) body+='<ul class="small">'+read.map(function(x){ return '<li>'+x+'</li>'; }).join('')+'</ul>';
    body+='</div>';
  } else {
    body+='<div class="alert warn">Fewer than two fiscal years of figures — the share-count and retained-earnings trend needs more history.</div>';
  }
  return ddSec('dd-s8',8,ex('dd-mgmt','Management'),
    'Judge managers by what they did with the money, not what they said on the call. Manual fields are your research; the table below is computed.',
    body+'</section>');
}

/* ================================================================
   SECTION 9 — Capital Allocation
   ================================================================ */
function ddS9(t){
  var series=ddSeries(t);
  var body='';
  if(series.length<1){
    body=emptyBox('No figures available.');
  } else {
    var shYoy=ddYoY(series,'shares_dil');
    var rows=series.map(function(r,i){
      var dRet=null;
      if(i<series.length-1&&ddNum(r.retained)&&ddNum(series[i+1].retained))
        dRet=Number(r.retained)-Number(series[i+1].retained);
      return ['FY '+r.fy, ddMoney(r.op_cash),
        ddNum(shYoy[r.fy])?ddPct(shYoy[r.fy]):'<span class="small">—</span>',
        dRet==null?'data unavailable':Util.money(dRet)];
    });
    body=ddTbl(['Fiscal year','Operating cash flow','Share-count change','Retained earnings change'],rows);
    var reads=[];
    series.slice(0,Math.min(3,series.length)).forEach(function(r){
      var c=shYoy[r.fy];
      if(ddNum(c)&&c<-0.02&&ddNum(r.op_cash)&&Number(r.op_cash)>0)
        reads.push('FY '+r.fy+': shares \u2212'+ddPct(Math.abs(c))+', OCF '+Util.money(Number(r.op_cash))+' \u2014 buyback footprint.');
      else if(ddNum(c)&&c>0.05)
        reads.push('FY '+r.fy+': shares +'+ddPct(c)+' \u2014 dilution (often a split/acquisition; confirm in the 10-K).');
    });
    if(reads.length) body+='<p class="small" style="margin:6px 0">'+reads.join(' \u00b7 ')+'</p>';
    body+='<p class="hint">Share-count change = (this year \u2212 last year) \u00F7 last year. Buyback dollars, dividends, capex and debt paydown are not in this dataset \u2014 they live in the 10-K cash-flow statement.</p>';
  }
  return ddSec('dd-s9',9,ex('dd-capalloc','Capital Allocation'),
    'Where did the cash go? This dataset shows the footprints (share count, retained earnings), not the spending itself.',
    body+'</section>');
}

/* ================================================================
   SECTION 10 — Valuation Engine (DCF + multiples)
   ================================================================ */
function ddDcfMath(t){
  var s=ddGet(t), d=s.dcf;
  var series=ddSeries(t), r=series[0]||{};
  var rev0=ddNum(r.revenue)?Number(r.revenue):null;
  var sh=ddNum(r.shares_dil)?Number(r.shares_dil):null;
  var g=ddNum(d.g)?Number(d.g)/100:null, m=ddNum(d.m)?Number(d.m)/100:null,
      dr=ddNum(d.r)?Number(d.r)/100:null, tg=ddNum(d.tg)?Number(d.tg)/100:null;
  if(rev0==null||sh==null||g==null||m==null||dr==null||tg==null) return null;
  function one(gg){
    var pv=0, fcf=0;
    for(var n=1;n<=5;n++){ fcf=rev0*Math.pow(1+gg,n)*m; pv+=fcf/Math.pow(1+dr,n); }
    var tv=(dr>tg)?fcf*(1+tg)/(dr-tg):null;
    var ev=pv+(tv==null?0:tv/Math.pow(1+dr,5));
    /* equity bridge: EV + liquid-assets proxy − total liabilities */
    var bridge=(ddNum(r.cur_assets)&&ddNum(r.total_liab))?Number(r.cur_assets)-Number(r.total_liab):0;
    return {ev:ev, tv:tv, pv:pv, eq:ev+bridge, ps:(ev+bridge)/sh, fcf5:fcf};
  }
  return {base:one(g), low:one(g-0.02), high:one(g+0.02), rev0:rev0, sh:sh, r:r,
    bridged:(ddNum(r.cur_assets)&&ddNum(r.total_liab))};
}
function ddS10(t){
  var s=ddGet(t), d=s.dcf;
  var body='<div class="panel"><h3>DCF inputs</h3>'
    +'<p class="small">Five-year projection of operating-cash-flow proxy, discounted back. The output is a <b>range</b> (growth \u00B1 2pp) — never one \u201Cfair value\u201D.</p>'
    +'<div class="grid g4">'
    +fieldRow('Revenue growth %/yr', '<input class="in" type="number" data-dd-f="dcf.g" data-dd-num="1" data-dd-re="dcf" value="'+ddE(d.g)+'" step="0.5">')
    +fieldRow('FCF-proxy margin %', '<input class="in" type="number" data-dd-f="dcf.m" data-dd-num="1" data-dd-re="dcf" value="'+ddE(d.m)+'" step="0.5">')
    +fieldRow('Discount rate %', '<input class="in" type="number" data-dd-f="dcf.r" data-dd-num="1" data-dd-re="dcf" value="'+ddE(d.r)+'" step="0.5">')
    +fieldRow('Terminal growth %', '<input class="in" type="number" data-dd-f="dcf.tg" data-dd-num="1" data-dd-re="dcf" value="'+ddE(d.tg)+'" step="0.25">')
    +'</div><div id="dd-dcf-out"></div>'
    +ddRule('FCF<sub>n</sub> = revenue<sub>0</sub> \u00D7 (1+g)<sup>n</sup> \u00D7 margin. PV = \u03A3 FCF<sub>n</sub>/(1+r)<sup>n</sup>. Terminal value = FCF<sub>5</sub>\u00D7(1+g<sub>t</sub>)/(r\u2212g<sub>t</sub>), discounted 5 years. Equity = EV + current assets \u2212 total liabilities; per-share = equity \u00F7 diluted shares. \u201CFCF\u201D here is the operating-cash-flow proxy (capex unavailable).')
    +'</div>';
  /* multiples: current + history */
  var series=ddSeries(t), r=series[0]||{};
  var price=ddPrice(t).val;
  var eps=(ddNum(r.net_income)&&ddNum(r.shares_dil)&&Number(r.shares_dil)!==0)?Number(r.net_income)/Number(r.shares_dil):null;
  var mcap=(ddNum(price)&&ddNum(r.shares_dil))?price*Number(r.shares_dil):null;
  var cur=[];
  cur.push(['P/E (price \u00F7 EPS)', (ddNum(price)&&ddNum(eps)&&eps>0)?(price/eps).toFixed(1)+'\u00D7':'data unavailable']);
  cur.push(['P / FCF-proxy (market cap \u00F7 operating cash flow)', (ddNum(mcap)&&ddNum(r.op_cash)&&Number(r.op_cash)>0)?(mcap/Number(r.op_cash)).toFixed(1)+'\u00D7':'data unavailable']);
  var evSales=(ddNum(mcap)&&ddNum(r.total_liab)&&ddNum(r.cur_assets)&&ddNum(r.revenue)&&Number(r.revenue)>0)
    ?((mcap+Number(r.total_liab)-Number(r.cur_assets))/Number(r.revenue)):null;
  cur.push(['EV / Sales', evSales==null?'data unavailable':evSales.toFixed(1)+'\u00D7']);
  body+='<div class="panel" style="margin-top:10px"><h3>Multiples — now vs history</h3>'
    +ddTbl(['Multiple','Current (price '+ (ddNum(price)?'$'+Number(price).toFixed(2):'n/a') +', latest FY)'],cur);
  if(ddHasData(t)&&series.length>1){
    var hrows=series.map(function(rr){
      var calY=parseInt(rr.fy,10);
      var yc=ddYearEndClose(t,calY);
      var heps=(ddNum(rr.net_income)&&ddNum(rr.shares_dil)&&Number(rr.shares_dil)!==0)?Number(rr.net_income)/Number(rr.shares_dil):null;
      var hpe=(ddNum(yc)&&ddNum(heps)&&heps>0)?(yc/heps).toFixed(1)+'\u00D7':'data unavailable';
      var hmcap=(ddNum(yc)&&ddNum(rr.shares_dil))?yc*Number(rr.shares_dil):null;
      var hev=(ddNum(hmcap)&&ddNum(rr.total_liab)&&ddNum(rr.cur_assets))?hmcap+Number(rr.total_liab)-Number(rr.cur_assets):null;
      var hevs=(ddNum(hev)&&ddNum(rr.revenue)&&Number(rr.revenue)>0)?(hev/Number(rr.revenue)).toFixed(1)+'\u00D7':'data unavailable';
      return ['FY '+rr.fy, ddNum(yc)?'$'+yc.toFixed(2):'data unavailable', hpe, hevs];
    });
    body+=ddTbl(['Fiscal year','Calendar year-end close','P/E then','EV/Sales then'],hrows);
    body+=ddRule('Historical multiples use the calendar year-end close \u00D7 that year\u2019s diluted shares — shares are taken as reported per year; a crude but transparent history. Current price: '+ddE(ddPrice(t).src)+'.');
  } else {
    body+=ddRule('Historical multiples need bundled price bars and several fiscal years — unavailable here.');
  }
  body+='</div>';
  return ddSec('dd-s10',10,ex('dd-dcf','Valuation Engine'),
    'Two lenses: a DCF that forces your assumptions into the open, and multiples that show what you pay per dollar of earnings, cash, and sales — now and in the past.',
    body+'</section>');
}
function ddRenderDcf(){
  var out=document.getElementById('dd-dcf-out'); if(!out) return;
  var t=ddCur();
  var d=ddDcfMath(t);
  if(!d){ out.innerHTML=emptyBox('DCF needs revenue, diluted shares, and all four inputs — something is missing.'); return; }
  function kpi(label,v,sub){
    return '<div class="kpi"><div class="k">'+label+'</div><div class="v">'+v+'</div><div class="d">'+sub+'</div></div>';
  }
  out.innerHTML='<div class="grid g3" style="margin-top:10px">'
    +kpi('Low (growth \u22122pp)','$'+d.low.ps.toFixed(2)+' / share','per-share value')
    +kpi('Base','$'+d.base.ps.toFixed(2)+' / share','per-share value')
    +kpi('High (growth +2pp)','$'+d.high.ps.toFixed(2)+' / share','per-share value')
    +'</div>'
    +'<p class="rule-note">Range width: $'+(d.high.ps-d.low.ps).toFixed(2)+' — that spread is the model telling you how much rides on the growth guess.'
    +(d.bridged?'':' Equity bridge skipped: current assets or total liabilities unavailable.')
    +' This is a model output from your inputs, not a fact and not advice.</p>';
}

/* ================================================================
   SECTION 11 — Reverse DCF
   ================================================================ */
function ddRevDcf(t){
  var s=ddGet(t), d=s.dcf;
  var series=ddSeries(t), r=series[0]||{};
  var price=ddPrice(t).val;
  var sh=ddNum(r.shares_dil)?Number(r.shares_dil):null;
  var fcf0=ddNum(r.op_cash)?Number(r.op_cash):null;
  var dr=ddNum(d.r)?Number(d.r)/100:0.10;
  var m=ddNum(d.m)?Number(d.m)/100:(ddNum(r.op_cash)&&ddNum(r.revenue)&&Number(r.revenue)!==0?Number(r.op_cash)/Number(r.revenue):null);
  if(price==null||sh==null) return {err:'Needs a share price and diluted shares — unavailable.'};
  if(fcf0==null||fcf0<=0) return {err:'Needs positive operating cash flow as the FCF proxy — latest OCF is '+(fcf0==null?'unavailable':'not positive')+', so the equation has no meaningful solution.'};
  var V=price*sh;
  var g=(V*dr-fcf0)/(V+fcf0);
  var cagr=series.length>=2?ddCagr(series[0].revenue,series[series.length-1].revenue,series.length-1):null;
  return {V:V, fcf0:fcf0, dr:dr, g:g, m:m, cagr:cagr, nYrs:series.length-1, price:price, sh:sh};
}
function ddS11(t){
  var s=ddGet(t);
  var body='<div class="panel"><p class="small">Instead of guessing growth and getting a value, start from today\u2019s market cap and solve for the perpetual growth the price already implies. Uses your discount rate and FCF-proxy margin from the Valuation Engine.</p>'
    +'<div class="grid g2">'
    +fieldRow('Discount rate % (shared with DCF)', '<input class="in" type="number" data-dd-f="dcf.r" data-dd-num="1" data-dd-re="revdcf" value="'+ddE(s.dcf.r)+'" step="0.5">')
    +fieldRow('FCF-proxy margin % (shared with DCF)', '<input class="in" type="number" data-dd-f="dcf.m" data-dd-num="1" data-dd-re="revdcf" value="'+ddE(s.dcf.m)+'" step="0.5">')
    +'</div><div id="dd-revdcf-out"></div>'
    +ddRule('Gordon-style: value = FCF\u00D7(1+g)/(r\u2212g). Solved for g: g = (V\u00D7r \u2212 FCF)/(V + FCF), where V = market cap and FCF = latest operating-cash-flow proxy. With a stable margin, implied perpetual revenue growth \u2248 g.')
    +'</div>';
  return ddSec('dd-s11',11,ex('dd-revdcf','Reverse DCF'),
    'What must be true for today\u2019s price to make sense? This runs the valuation backwards — price in, required growth out.',
    body+'</section>');
}
function ddRenderRevDcf(){
  var out=document.getElementById('dd-revdcf-out'); if(!out) return;
  var t=ddCur();
  var r=ddRevDcf(t);
  if(r.err){ out.innerHTML=emptyBox(r.err); return; }
  var verdict;
  if(r.g>=r.dr) verdict='The implied growth ('+ddPct(r.g)+') is at or above the discount rate — the perpetuity math breaks down, which itself says the price demands extraordinary growth.';
  else if(r.cagr!=null){
    verdict='The price implies perpetual growth of <b>'+ddPct(r.g)+'</b>. Actual revenue CAGR was '+ddPct(r.cagr)+' over the last '+r.nYrs+' year(s) — '+
      (r.g>r.cagr+0.02?'the market is pricing in growth well above what the company has delivered. Perpetual growth above history is a high bar.':
       r.g<r.cagr-0.02?'implied growth sits below the historical pace, so the bar looks achievable on past form — if the business hasn\u2019t structurally changed.':
       'implied growth is roughly in line with the historical pace.');
  } else verdict='The price implies perpetual growth of <b>'+ddPct(r.g)+'</b>. Not enough history to compare against — check the 10-K trend yourself.';
  out.innerHTML='<div class="grid g3" style="margin-top:8px">'
    +'<div class="kpi"><div class="k">Market cap</div><div class="v">'+Util.money(r.V)+'</div><div class="d">$'+r.price.toFixed(2)+' \u00D7 '+Util.num(r.sh,0)+' shares</div></div>'
    +'<div class="kpi"><div class="k">Implied perpetual growth</div><div class="v">'+ddPct(r.g)+'</div><div class="d">at '+ddPct(r.dr,1)+' discount rate</div></div>'
    +'<div class="kpi"><div class="k">Historical revenue CAGR</div><div class="v">'+ddPct(r.cagr)+'</div><div class="d">last '+r.nYrs+' year(s)</div></div></div>'
    +'<p class="small">'+verdict+'</p>'
    +'<p class="rule-note">Model output, not a fact. It assumes the latest operating-cash-flow proxy grows forever at g with a stable margin — reality includes cycles, competition, and capex.</p>';
}

/* ================================================================
   SECTION 12 — Bull / Base / Bear
   ================================================================ */
function ddS12(t){
  var s=ddGet(t);
  function row(key,label){
    var sc=s.scenarios[key];
    return '<tr><td><b>'+label+'</b></td>'
      +'<td><input class="in" type="number" style="width:90px" data-dd-f="scenarios.'+key+'.g" data-dd-num="1" data-dd-re="scen" value="'+ddE(sc.g)+'" step="0.5"></td>'
      +'<td><input class="in" type="number" style="width:90px" data-dd-f="scenarios.'+key+'.m" data-dd-num="1" data-dd-re="scen" value="'+ddE(sc.m)+'" step="0.5"></td>'
      +'<td><input class="in" type="number" style="width:90px" data-dd-f="scenarios.'+key+'.mult" data-dd-num="1" data-dd-re="scen" value="'+ddE(sc.mult)+'" step="1"></td></tr>';
  }
  var body='<div class="panel"><p class="small">One forecast is a guess; three show how much the answer depends on being right. Every assumption stays visible — edit any cell.</p>'
    +'<div style="overflow-x:auto"><table class="tbl"><tr><th>Scenario</th><th>Revenue growth %/yr</th><th>FCF-proxy margin %</th><th>Exit FCF multiple</th></tr>'
    +row('bull','Bull')+row('base','Base')+row('bear','Bear')+'</table></div>'
    +'<div id="dd-scen-out"></div>'
    +ddRule('Year-5 FCF-proxy = revenue<sub>0</sub> \u00D7 (1+g)<sup>5</sup> \u00D7 margin. Implied equity = FCF<sub>5</sub> \u00D7 exit multiple + current assets \u2212 total liabilities. Per share = equity \u00F7 diluted shares.')
    +'</div>';
  return ddSec('dd-s12',12,ex('dd-scen','Bull / Base / Bear'),
    'Three futures, each fully specified. The spread between bull and bear is the honest size of your uncertainty.',
    body+'</section>');
}
function ddRenderScen(){
  var out=document.getElementById('dd-scen-out'); if(!out) return;
  var t=ddCur(), s=ddGet(t);
  var series=ddSeries(t), r=series[0]||{};
  var rev0=ddNum(r.revenue)?Number(r.revenue):null, sh=ddNum(r.shares_dil)?Number(r.shares_dil):null;
  if(rev0==null||sh==null){ out.innerHTML=emptyBox('Needs revenue and diluted shares — unavailable.'); return; }
  var bridge=(ddNum(r.cur_assets)&&ddNum(r.total_liab))?Number(r.cur_assets)-Number(r.total_liab):0;
  function one(key){
    var sc=s.scenarios[key];
    var g=ddNum(sc.g)?Number(sc.g)/100:0, m=ddNum(sc.m)?Number(sc.m)/100:0, mult=ddNum(sc.mult)?Number(sc.mult):0;
    var fcf5=rev0*Math.pow(1+g,5)*m;
    var ps=(fcf5*mult+bridge)/sh;
    return '<div class="kpi"><div class="k">'+key+'</div><div class="v">$'+ps.toFixed(2)+'</div><div class="d">FCF<sub>5</sub> '+Util.money(fcf5)+' \u00D7 '+mult+'\u00D7</div></div>';
  }
  out.innerHTML='<div class="grid g3" style="margin-top:8px">'+one('bull')+one('base')+one('bear')+'</div>'
    +'<p class="rule-note">Implied values per share under each scenario\u2019s assumptions — scenarios, not predictions.</p>';
}

/* ================================================================
   SECTION 13 — Risk Map
   ================================================================ */
function ddAutoRisks(t){
  var series=ddSeries(t), r=series[0]||{}, out=[];
  var de=ddDebtEbitda(r), ic=ddIntCov(r);
  if(ddNum(de)&&de>4) out.push({risk:'High leverage',ev:'Debt \u00F7 operating income = '+de.toFixed(1)+'\u00D7 (rule: > 4\u00D7 flags). Total liabilities '+Util.money(Number(r.total_liab))+'.',impact:'Debt payments eat cash that could fund growth; a downturn hits harder.',watch:'Debt trend and interest coverage each year.'});
  if(ddNum(ic)&&ic<3) out.push({risk:'Thin interest coverage',ev:'Operating income covers interest '+ic.toFixed(1)+'\u00D7 (rule: < 3\u00D7 flags). Interest expense '+Util.money(Number(r.interest_exp))+'.',impact:'Rate rises or profit dips could strain payments.',watch:'Interest expense and coverage in the next 10-K.'});
  var shYoy=ddYoY(series,'shares_dil');
  series.slice(0,3).forEach(function(rr){
    var c=shYoy[rr.fy];
    if(ddNum(c)&&c>0.5){ out.push({risk:'Sudden share-count jump (likely a split)',ev:'Diluted shares grew '+ddPct(c)+' in FY '+rr.fy+' — a jump over 50% in one year is usually a stock split or acquisition, not creeping dilution. Confirm on the 10-K cover page.',impact:'If a split, economically neutral (same pie, more slices); if an issuance, existing holders own less.',watch:'10-K cover page: shares outstanding and any split history.'}); }
    else if(ddNum(c)&&c>0.05){ out.push({risk:'Share dilution',ev:'Diluted shares grew '+ddPct(c)+' in FY '+rr.fy+' (rule: > 5%/yr flags).',impact:'Each existing share owns a smaller slice of the business.',watch:'Share count and the 10-K\u2019s explanation (split? acquisition? issuance?).'}); }
  });
  if(ddNum(r.retained)&&Number(r.retained)<0) out.push({risk:'Negative retained earnings',ev:'Retained earnings '+Util.money(Number(r.retained))+' — accumulated losses exceed accumulated profits.',impact:'The business has destroyed more value than it kept; dividends and buybacks have less cushion.',watch:'Whether retained earnings turn and stay positive.'});
  var below=series.slice(0,3).filter(function(rr){ return ddNum(rr.op_cash)&&ddNum(rr.net_income)&&Number(rr.op_cash)<Number(rr.net_income); });
  if(below.length) out.push({risk:'Profit not converting to cash',ev:'Operating cash flow trailed net income in '+below.map(function(rr){ return 'FY '+rr.fy; }).join(', ')+'. (For banks and lenders this pattern can be normal — loan originations flow through operating cash flow.)',impact:'Reported profit may be tied up in receivables or inventory.',watch:'Cash conversion (OCF \u00F7 NI) each year — see section 4.'});
  return out;
}
function ddS13(t){
  var auto=ddAutoRisks(t), s=ddGet(t);
  var rows=auto.map(function(x){
    return ['<b>'+ddE(x.risk)+'</b> <span class="tag">auto</span>', ddE(x.ev), ddE(x.impact), ddE(x.watch), ''];
  });
  (s.risks||[]).forEach(function(x,i){
    rows.push(['<b>'+ddE(x.risk||'')+'</b> <span class="tag">yours</span>', ddE(x.ev||''), ddE(x.impact||''), ddE(x.watch||''),
      '<button class="btn sm" data-dd-act="rkdel" data-dd-i="'+i+'">remove</button>']);
  });
  var body=rows.length?ddTbl(['Risk','Evidence','Potential impact','What to monitor',''],rows):emptyBox('No automatic flags fired and none added yet — that is information too, not a clean bill of health.');
  body+=ddRule('Automatic flags fire on fixed rules stated in the Evidence column. They are starting points — confirm each in the filing before acting on it.');
  body+='<div class="panel" style="margin-top:10px"><h3>Add your own risk</h3><div class="grid g2">'
    +fieldRow('Risk',textInput('dd-rk-risk','','e.g. Customer concentration'))
    +fieldRow('Evidence',textInput('dd-rk-ev','','The fact that makes you worry'))
    +fieldRow('Potential impact',textInput('dd-rk-impact','','What happens if it hits'))
    +fieldRow('What to monitor',textInput('dd-rk-watch','','The tripwire you will check'))
    +'</div><button class="btn" data-dd-act="rkadd">Add risk</button><div id="dd-risk-list"></div></div>';
  return ddSec('dd-s13',13,ex('dd-risk','Risk Map'),
    'Everything that could go wrong, each tied to evidence and a tripwire. Write them down now — while the story still sounds good.',
    body+'</section>');
}

/* ================================================================
   SECTION 14 — What's the Market Missing?
   ================================================================ */
function ddS14(t){
  var body='';
  var pc=ddOneYrPriceChg(t);
  var series=ddSeries(t), yoyR=ddYoY(series,'revenue'), yoyN=ddYoY(series,'net_income'), yoyO=ddYoY(series,'op_cash');
  if(!pc||!series.length||!ddNum(yoyR[series[0].fy])){
    body=emptyBox('Needs ~1 year of price bars and two fiscal years — unavailable here.');
  } else {
    var fy=series[0].fy, pr=pc.chg, rr=yoyR[fy], nn=yoyN[fy], oo=yoyO[fy];
    body='<div class="grid g4">'
      +'<div class="kpi"><div class="k">Share price, ~1 yr</div><div class="v">'+ddPct(pr)+'</div><div class="d">'+ddE(pc.from)+' \u2192 '+ddE(pc.to)+'</div></div>'
      +'<div class="kpi"><div class="k">Revenue growth</div><div class="v">'+ddPct(rr)+'</div><div class="d">FY '+fy+'</div></div>'
      +'<div class="kpi"><div class="k">Net income growth</div><div class="v">'+ddPct(nn)+'</div><div class="d">FY '+fy+'</div></div>'
      +'<div class="kpi"><div class="k">Operating cash flow growth</div><div class="v">'+ddPct(oo)+'</div><div class="d">FY '+fy+'</div></div></div>';
    var p='<p class="small">Over the last ~year the share price moved '+ddPct(pr)+' while revenue grew '+ddPct(rr)+', net income '+ddPct(nn)+', and operating cash flow '+ddPct(oo)+'. ';
    if(ddNum(pr)&&ddNum(rr)&&pr<0&&rr>0)
      p+='Price fell while sales grew — the market is pricing in something the trailing figures don\u2019t show: expected slowdown, multiple compression, sector rotation, or a risk not yet in the numbers.';
    else if(ddNum(pr)&&ddNum(rr)&&pr>0.2&&rr<0.05)
      p+='Price rose strongly while sales barely moved — the market is paying for expected future growth, not current results. The reverse-DCF (section 11) quantifies that expectation.';
    else if(ddNum(pr)&&ddNum(rr)&&Math.abs(pr-rr)<0.1)
      p+='Price and revenue moved roughly together — no big divergence between the market\u2019s verdict and the trailing figures this year.';
    else
      p+='Price and fundamentals disagree in degree — divergence is information about what the market expects, not a signal by itself.';
    p+='</p>';
    body+=p+ddRule('Price change uses ~252 trading days of bundled bars ending 2026-09-25. Fundamentals are trailing fiscal-year figures — they describe the past; price describes expectations.');
  }
  return ddSec('dd-s14',14,ex('dd-missing','What\u2019s the Market Missing?'),
    'Price looks forward; financial statements look back. When they disagree, the gap — not either side alone — is the interesting part.',
    body+'</section>');
}

/* ================================================================
   SECTION 15 — Change Detector
   ================================================================ */
function ddS15(t){
  var fys=ddFys(t);
  var opts=fys.map(function(f){ return '<option value="'+ddE(f)+'">'+ddE(f)+'</option>'; }).join('');
  var body='<div class="grid g2">'
    +fieldRow('Earlier fiscal year','<select class="in" id="dd-chg-a" data-dd-re="chg">'+opts+'</select>')
    +fieldRow('Later fiscal year','<select class="in" id="dd-chg-b" data-dd-re="chg">'+opts+'</select>')
    +'</div><div id="dd-chg-out"></div>'
    +ddRule('Change = (later \u2212 earlier) \u00F7 |earlier|. \U0001F7E2 favorable, \U0001F534 unfavorable, \U0001F7E1 flat (<1%) or unavailable. \u201CFavorable\u201D follows the metric: revenue up is good, debt up is bad. Quarterly changes need 10-Q uploads on the SEC Filing Upload page — this dataset is annual.');
  return ddSec('dd-s15',15,ex('dd-chg','Change Detector'),
    'Pick two fiscal years. Every key line, marked better, worse, or flat — trends you would miss scanning raw tables.',
    body+'</section>');
}
function ddRenderChg(){
  var out=document.getElementById('dd-chg-out'); if(!out) return;
  var t=ddCur(), a=document.getElementById('dd-chg-a'), b=document.getElementById('dd-chg-b');
  if(!a||!b){ out.innerHTML=''; return; }
  var fa=a.value, fb=b.value;
  if(fa===fb){ out.innerHTML=emptyBox('Pick two different fiscal years.'); return; }
  var series=ddSeries(t);
  function row(fy){ for(var i=0;i<series.length;i++) if(series[i].fy===fy) return series[i]; return {}; }
  var ra=row(fa), rb=row(fb);
  var defs=[
    ['Revenue','revenue','up',1],['Gross margin',null,'up',0],['Operating margin',null,'up',0],
    ['Net margin',null,'up',0],['Operating cash flow','op_cash','up',1],
    ['Total liabilities','total_liab','down',1],['Long-term debt','lt_debt','down',1],
    ['Diluted shares','shares_dil','down',1],['Retained earnings','retained','up',1],
    ['Interest coverage',null,'up',0],['Current ratio',null,'up',0],['ROIC',null,'up',0]
  ];
  var rows=defs.map(function(d){
    var label=d[0], key=d[1], dir=d[2], isMoney=d[3], va, vb, disp;
    if(key){ va=ra[key]; vb=rb[key]; disp=isMoney?ddMoney(vb):ddE(String(vb==null?'data unavailable':vb)); }
    else{
      var ma=ddMargins(ra), mb=ddMargins(rb);
      var mk={'Gross margin':'gross','Operating margin':'op','Net margin':'net','Interest coverage':'ic','Current ratio':'cr','ROIC':'roic'}[label];
      if(mk==='ic'){ va=ddIntCov(ra); vb=ddIntCov(rb); }
      else if(mk==='cr'){ va=(ddNum(ra.cur_assets)&&ddNum(ra.cur_liab)&&Number(ra.cur_liab)!==0)?Number(ra.cur_assets)/Number(ra.cur_liab):null; vb=(ddNum(rb.cur_assets)&&ddNum(rb.cur_liab)&&Number(rb.cur_liab)!==0)?Number(rb.cur_assets)/Number(rb.cur_liab):null; }
      else{ va=ma[mk]; vb=mb[mk]; }
      disp=(mk==='ic'||mk==='cr')?(ddNum(vb)?Number(vb).toFixed(1)+'\u00D7':'data unavailable'):ddPct(vb);
    }
    var c=ddChgCell(vb,va,dir);
    var da=isMoney?ddMoney(va):(key?ddE(String(va==null?'data unavailable':va)):((label==='Interest coverage'||label==='Current ratio')?(ddNum(va)?Number(va).toFixed(1)+'\u00D7':'data unavailable'):ddPct(va)));
    return [ddFlagDot(c.dot)+' '+ddE(label), da, disp, c.txt];
  });
  out.innerHTML=ddTbl(['Metric','FY '+ddE(fa),'FY '+ddE(fb),'Change'],rows);
}

/* ================================================================
   SECTION 16 — Thesis Builder
   ================================================================ */
function ddAutoThesis(t){
  var bull=[], bear=[];
  var series=ddSeries(t), r=series[0]||{};
  var yoy=ddYoY(series,'revenue'), g=yoy[r.fy];
  var m=ddMargins(r), ms=series.map(ddMargins);
  if(ddNum(g)&&g>0.1) bull.push('Revenue grew '+ddPct(g)+' in FY '+r.fy+' (section 2) — the business is expanding faster than most large caps.');
  if(ddNum(m.roic)&&m.roic>0.15) bull.push('ROIC of '+ddPct(m.roic)+' (section 3) — each dollar tied up in the business earns a strong return.');
  if(ms.length>1&&ddNum(ms[0].op)&&ddNum(ms[1].op)&&ms[0].op>ms[1].op+0.01) bull.push('Operating margin expanded from '+ddPct(ms[1].op)+' to '+ddPct(ms[0].op)+' (section 3) — scale or pricing power is showing up.');
  var ic=ddIntCov(r);
  if(ddNum(ic)&&ic>5) bull.push('Interest coverage '+ic.toFixed(1)+'\u00D7 (section 5) — the balance sheet can fund itself through a rough patch.');
  if(ddNum(g)&&g<0) bear.push('Revenue shrank '+ddPct(Math.abs(g))+' in FY '+r.fy+' (section 2) — the top line is going the wrong way.');
  var below=series.slice(0,3).filter(function(rr){ return ddNum(rr.op_cash)&&ddNum(rr.net_income)&&Number(rr.op_cash)<Number(rr.net_income); });
  if(below.length>=2) bear.push('Operating cash flow trailed net income in '+below.length+' of the last 3 years (section 4) — profit isn\u2019t fully arriving as cash.');
  var de=ddDebtEbitda(r);
  if(ddNum(de)&&de>4) bear.push('Debt is '+de.toFixed(1)+'\u00D7 operating income (section 5/13) — leverage leaves little room for error.');
  if(ddNum(ic)&&ic<3) bear.push('Interest coverage of only '+ic.toFixed(1)+'\u00D7 (section 5/13) — debt service is already a burden.');
  if(ms.length>1&&ddNum(ms[0].net)&&ddNum(ms[1].net)&&ms[0].net<ms[1].net-0.01) bear.push('Net margin compressed from '+ddPct(ms[1].net)+' to '+ddPct(ms[0].net)+' (section 3) — profitability is eroding.');
  return {bull:bull,bear:bear};
}
function ddS16(t){
  var s=ddGet(t), th=s.thesis, auto=ddAutoThesis(t);
  function ta(id,val,ph,seed){
    var v=(val!=null&&val!=='')?val:seed.join('\n\u2022 ');
    if(v&&seed.length&&!(val!=null&&val!=='')) v='\u2022 '+v;
    return '<textarea class="in" rows="5" style="width:100%" data-dd-f="thesis.'+id+'" placeholder="'+ddE(ph)+'">'+ddE(v)+'</textarea>';
  }
  var body='<p class="small">Drafted from this page\u2019s computed flags — each bullet cites its section. Edit freely; these are your words, saved per ticker. No buy/sell ratings here — a thesis is an argument, not a verdict.</p>'
    +'<div class="grid g2"><div class="panel"><h3>Bull case</h3>'
    +ta('bull',th.bull,'Why this could work out\u2026',auto.bull)+'</div>'
    +'<div class="panel"><h3>Bear case</h3>'
    +ta('bear',th.bear,'Why this could go wrong\u2026',auto.bear)+'</div></div>'
    +'<div class="grid g2" style="margin-top:10px"><div class="panel"><h3>Key variables</h3>'
    +'<textarea class="in" rows="3" style="width:100%" data-dd-f="thesis.vars" placeholder="The 2\u20133 things that matter most — e.g. data-center demand, pricing, debt refinancing.">'+ddE(th.vars||'')+'</textarea></div>'
    +'<div class="panel"><h3>Reassess if\u2026</h3>'
    +'<textarea class="in" rows="3" style="width:100%" data-dd-f="thesis.triggers" placeholder="Tripwires that would change your mind — e.g. \u201Cif operating margin falls below 30% two years running\u201D.">'+ddE(th.triggers||'')+'</textarea></div></div>';
  return ddSec('dd-s16',16,ex('dd-thesis','Thesis Builder'),
    'Your argument in writing — bull and bear, the variables that matter, and the tripwires that would change your mind.',
    body+'</section>');
}

/* ================================================================
   "Ask the Company Anything" — rule-based Q&A over computed data
   ================================================================ */
function ddQAAnswer(t,q){
  var L=String(q||'').toLowerCase().trim();
  if(!L) return 'Type a question above, then Ask.';
  var series=ddSeries(t), r=series[0]||{}, n=series.length;
  var yoyR=ddYoY(series,'revenue'), yoyN=ddYoY(series,'net_income'), yoyO=ddYoY(series,'op_cash');
  var m0=ddMargins(r), ms=series.map(ddMargins);
  var fy=r.fy||'latest', pf=n>1?series[1].fy:'prior';
  function goto(sec){ return ' <button class="btn sm" data-dd-act="goto" data-dd-goto="dd-s'+sec+'">see section '+sec+'</button>'; }
  /* margins fell / rose */
  if(/margin/.test(L)){
    var dir=/fell|fall|drop|declin|down|shrink|shrank|compress|worse|deteriorat/.test(L)?'down'
      :/rose|rise|risen|increas|improv|up|expand|better|grew/.test(L)?'up':null;
    if(n<2||!ddNum(r.revenue)) return 'Not enough history to explain a margin move — need two fiscal years of revenue.'+goto(3);
    var parts=['FY '+fy+' vs FY '+pf+': gross '+ddPct(m0.gross)+' (was '+ddPct(ms[1].gross)+'), operating '+ddPct(m0.op)+' (was '+ddPct(ms[1].op)+'), net '+ddPct(m0.net)+' (was '+ddPct(ms[1].net)+').'];
    if(dir==='down'){
      if(ddNum(m0.gross)&&ddNum(ms[1].gross)&&m0.gross<ms[1].gross-0.005) parts.push('Gross margin fell, so the cost of making/selling the product rose faster than sales — check cost of revenue in the 10-K.');
      else if(ddNum(m0.op)&&ddNum(ms[1].op)&&m0.op<ms[1].op-0.005) parts.push('Gross margin held but operating margin fell — operating expenses (SG&A, R&D) grew faster than sales.');
      else if(ddNum(m0.net)&&ddNum(ms[1].net)&&m0.net<ms[1].net-0.005) parts.push('Operating margin held but net margin fell — the drag is below the operating line: interest, taxes, or other items.');
      else parts.push('No single margin layer moved much — the change you see may be rounding or a mix effect across segments.');
    } else if(dir==='up'){
      if(ddNum(m0.op)&&ddNum(ms[1].op)&&m0.op>ms[1].op+0.005) parts.push('Operating margin expanded — each new sales dollar carried more profit (operating leverage or pricing power).');
      else parts.push('Margins are roughly flat year over year — stability, not expansion.');
    } else parts.push('Ask "why did margins fall" or "why did margins rise" for the directional read.');
    return parts.join(' ')+goto(3);
  }
  /* stock comp */
  if(/stock.comp|share.based|sbc|share based|equity comp/.test(L))
    return 'Stock-based compensation is <b>not in this dataset</b>, so no dollar figure can be given. You\u2019ll find it in the 10-K: the cash-flow statement\u2019s operating section (added back to net income) and the notes on share-based payments.'+goto(4);
  /* FCF if growth falls to X% */
  var gm=L.match(/growth falls? to\s*(\d+(?:\.\d+)?)\s*%/);
  if(gm&&/fcf|free cash|cash flow/.test(L)){
    var x=Number(gm[1])/100;
    if(!ddNum(r.revenue)||!ddNum(m0.fcf)) return 'Need revenue and operating cash flow to run that scenario.'+goto(10);
    var revN=Number(r.revenue)*(1+x), fcfN=revN*m0.fcf;
    var gNow=yoyR[fy];
    return 'Holding the latest FCF-proxy margin ('+ddPct(m0.fcf)+') constant: revenue of '+Util.money(Number(r.revenue))+' growing '+gm[1]+'% gives '+Util.money(revN)+' of sales and about <b>'+Util.money(fcfN)+'</b> of FCF-proxy next year'
      +(ddNum(gNow)?' (vs '+Util.money(Number(r.revenue)*(1+gNow)*m0.fcf)+' at the current '+ddPct(gNow)+' pace)':'')
      +'. Margin is assumed unchanged — in reality slower growth often compresses margins.'+goto(10);
  }
  /* valuation sense */
  if(/make sense|valuation|worth it|justify|justified|priced in|overvalued|undervalued|expensive|cheap/.test(L)){
    var rd=ddRevDcf(t);
    if(rd.err) return ddE(rd.err)+goto(11);
    return 'Reverse-DCF read (section 11): market cap '+Util.money(rd.V)+', latest FCF-proxy '+Util.money(rd.fcf0)+
      ' — the price implies perpetual growth of <b>'+ddPct(rd.g)+'</b> at a '+ddPct(rd.dr,1)+' discount rate'+
      (rd.cagr!=null?', vs actual revenue CAGR of '+ddPct(rd.cagr)+' over '+rd.nYrs+' year(s)':'')+
      '. Whether that is realistic is your call — compare it with the moat (section 6) and risks (section 13).'+goto(11);
  }
  /* dividend */
  if(/dividend/.test(L))
    return 'Dividend safety <b>cannot be judged from this dataset</b> — dividends paid are not included. Check the 10-K cash-flow statement\u2019s financing section and the statement of shareholders\u2019 equity; compare dividends against operating cash flow, not just net income.'+goto(9);
  /* debt */
  if(/debt|indebt|leverag|borrow|owe/.test(L)){
    var de=ddDebtEbitda(r), ic=ddIntCov(r);
    return 'Total liabilities '+ddMoney(r.total_liab)+', of which long-term debt '+ddMoney(r.lt_debt)+
      '. Debt \u00F7 operating income: '+(ddNum(de)?de.toFixed(1)+'\u00D7':'data unavailable')+
      '; interest coverage: '+(ddNum(ic)?ic.toFixed(1)+'\u00D7 (rule of thumb: above 3\u00D7 is comfortable)':'data unavailable')+'.'+goto(5);
  }
  /* accelerating */
  if(/accelerat/.test(L)){
    if(n<3||!ddNum(yoyR[fy])||!ddNum(yoyR[pf])) return 'Acceleration needs three fiscal years of revenue — not available here.'+goto(2);
    var acc=yoyR[fy]-yoyR[pf];
    return (acc>0.005?'Yes — ':'No — ')+'revenue growth was '+ddPct(yoyR[pf])+' in FY '+pf+' and '+ddPct(yoyR[fy]+'')+' in FY '+fy+', so growth '+(acc>0.005?'accelerated':'decelerated')+' by '+ddPct(Math.abs(acc))+'.'+goto(2);
  }
  /* OCF vs NI */
  if(/ocf|operating cash|different|differ/.test(L)&&/net income|profit|ni\b/.test(L)||/why.*cash.*(less|more|lower|higher)/.test(L)){
    if(!ddNum(r.op_cash)||!ddNum(r.net_income)) return 'Need both operating cash flow and net income for the latest year — unavailable.'+goto(4);
    var diff=Number(r.op_cash)-Number(r.net_income);
    return 'FY '+fy+': net income '+Util.money(Number(r.net_income))+' vs operating cash flow '+Util.money(Number(r.op_cash))+' — a '+Util.money(Math.abs(diff))+' gap '+(diff>=0?'(more cash than profit)':'(less cash than profit)')+'. '+
      'Usual accounting reasons: customers paying later (receivables), inventory builds, revenue recognized before cash arrives, or large non-cash charges. One year is often timing; repeated gaps deserve section 4.'+goto(4);
  }
  /* fallback with section suggestion */
  var sug='16';
  if(/risk/.test(L)) sug='13'; else if(/moat|competitive|edge/.test(L)) sug='6';
  else if(/growth|revenue/.test(L)) sug='2'; else if(/ceo|management/.test(L)) sug='8';
  else if(/scenario|bull|bear/.test(L)) sug='12'; else if(/balance|stress/.test(L)) sug='5';
  return 'I can answer from the sections above — try the <b>section '+sug+'</b> tab, or ask about margins, debt, dividends, growth vs price, or cash conversion.'+goto(sug);
}
function ddQA(t){
  var body='<div class="panel"><p class="rule-note" style="font-style:normal"><b>Computed from company data with transparent rules — not AI.</b> Every answer below is generated by fixed rules over the figures on this page, with the numbers cited. It cannot read filings or know anything outside this dataset.</p>'
    +'<div class="grid g3" style="align-items:end">'
    +fieldRow('Ask about this company','<input class="in" type="text" id="dd-qa-q" placeholder="e.g. Why did margins fall?  How indebted is it?  Is growth accelerating?">')
    +'<div class="frow"><label class="f">&nbsp;</label><button class="btn" data-dd-act="qa">Ask</button></div>'
    +'<div class="small">Try: \u201Cwhat must happen for today\u2019s valuation to make sense\u201D \u00B7 \u201Cwhat happens to FCF if growth falls to 3%\u201D \u00B7 \u201Cwhy is OCF different from net income\u201D</div></div>'
    +'<div id="dd-qa-out" style="margin-top:10px"></div></div>';
  return ddSec('dd-qa','Q&A',ex('dd-qa','Ask the Company Anything'),
    'Plain questions, rule-based answers, figures cited. If it can\u2019t be answered from the data, it says so.',
    body+'</section>');
}

/* ================================================================
   Manual figure entry (tickers with no bundled data)
   ================================================================ */
function ddManualPanel(t){
  var s=ddGet(t);
  var rows=(s.manual||[]).map(function(m,i){
    return '<tr><td class="mono">FY '+ddE(m.fy)+'</td><td class="num">'+Util.money(Number(m.revenue))+'</td>'
      +'<td class="num">'+Util.money(Number(m.net_income))+'</td><td class="num">'+Util.money(Number(m.assets))+'</td>'
      +'<td class="num">'+Util.money(Number(m.total_liab))+'</td><td class="num">'+Util.num(Number(m.shares_dil),0)+'</td>'
      +'<td class="num">'+(ddNum(m.price)?'$'+Number(m.price).toFixed(2):'—')+'</td>'
      +'<td><button class="btn sm" data-dd-act="mdel" data-dd-i="'+i+'">remove</button></td></tr>';
  }).join('');
  return '<div class="panel"><h3>Enter key figures manually <span class="tag">user-entered</span></h3>'
    +'<p class="small">No bundled SEC data for <b>'+ddE(t)+'</b> — enter key figures manually below (or upload its 10-K on the SEC Filing Upload page). Everything you enter is labeled <b>user-entered</b> and feeds the calculators on this page. Values in USD; shares as a plain count.</p>'
    +'<div class="grid g4">'
    +fieldRow('Fiscal year',textInput('dd-m-fy','','e.g. 2025'))
    +fieldRow('Revenue (USD)',numInput('dd-m-rev','','1'))
    +fieldRow('Net income (USD)',numInput('dd-m-ni','','1'))
    +fieldRow('Total assets (USD)',numInput('dd-m-assets','','1'))
    +fieldRow('Total liabilities (USD)',numInput('dd-m-liab','','1'))
    +fieldRow('Diluted shares (count)',numInput('dd-m-sh','','1'))
    +fieldRow('Share price (USD)',numInput('dd-m-price','','0.01'))
    +'<div class="frow"><label class="f">&nbsp;</label><button class="btn" data-dd-act="madd">Add / update FY</button></div>'
    +'</div>'
    +(rows?'<div style="overflow-x:auto;margin-top:8px"><table class="tbl"><tr><th>FY</th><th class="num">Revenue</th><th class="num">Net income</th><th class="num">Assets</th><th class="num">Liabilities</th><th class="num">Shares</th><th class="num">Price</th><th></th></tr>'+rows+'</table></div>':'')
    +'</div>';
}

/* ================================================================
   Page render + after (event delegation)
   ================================================================ */
function ddCur(){ var v=document.getElementById('view'); return v?v.getAttribute('data-dd-t'):null; }
var DD_IDMAP={'dd-m-ceo':'mgmt.ceo','dd-m-tenure':'mgmt.tenure','dd-m-insider':'mgmt.insider',
  'dd-m-comp':'mgmt.comp','dd-m-notes':'mgmt.notes'};

function ddRenderNoTicker(){
  return '<h2>Company Deep Dive</h2>'+DATA_BADGE
    +'<div class="panel"><h3>Pick a company</h3><p class="small">'+tickerHint()+'</p>'
    +'<div class="grid g2" style="align-items:end">'
    +fieldRow('Ticker',tickerInput('dd-t','','e.g. AAPL or CELH'))
    +'<div class="frow"><label class="f">&nbsp;</label><button class="btn" data-dd-act="go">Load deep dive</button></div>'
    +'</div></div>'
    +'<div class="panel"><h3>What this page does</h3><p class="small">Eighteen computed sections — business model, revenue quality, profitability, cash quality, balance-sheet stress, moat checklist, competitors, management, capital allocation, valuation, reverse-DCF, scenarios, risks, price-vs-fundamentals, change detection, a thesis builder, quality scores (Piotroski/Altman), and insider transactions — plus a rule-based Q&amp;A. Bundled tickers prefill from SEC data; anything else runs on figures you enter, clearly labeled.</p></div>';
}
function ddRenderTicker(t){
  t=String(t||'').toUpperCase();
  var bundled=ddHasData(t), s=ddGet(t);
  var h='<h2>Company Deep Dive — '+ddE(t)+'</h2>'+DATA_BADGE;
  h+='<div class="panel"><div class="grid g2" style="align-items:end">'
    +fieldRow('Ticker',tickerInput('dd-t',t,'e.g. AAPL'))
    +'<div class="frow"><label class="f">&nbsp;</label><button class="btn" data-dd-act="go">Load</button></div></div>'
    +'<p class="small">'+tickerHint()+'</p></div>';
  if(!bundled&&!s.manual.length&&!(typeof FilingLib!=='undefined'&&FilingLib&&FilingLib.figuresFor(t)&&FilingLib.figuresFor(t).figures)){
    h+='<div class="alert warn"><b>No bundled SEC data for '+ddE(t)+'</b> — enter key figures manually below (or upload its 10-K on the SEC Filing Upload page). Sections below will show \u201Cdata unavailable\u201D until figures exist.</div>';
    h+=ddManualPanel(t);
  } else if(!bundled){
    h+=ddManualPanel(t);
  }
  /* section nav (JS scroll — hash anchors would fight the Router) */
  var nav=[['dd-s1','1 Business'],['dd-s2','2 Revenue'],['dd-s3','3 Profit'],['dd-s4','4 Cash'],
    ['dd-s5','5 Balance sheet'],['dd-s6','6 Moat'],['dd-s7','7 Peers'],['dd-s8','8 Management'],
    ['dd-s9','9 Cap. allocation'],['dd-s10','10 Valuation'],['dd-s11','11 Reverse DCF'],['dd-s12','12 Scenarios'],
    ['dd-s13','13 Risks'],['dd-s14','14 Market view'],['dd-s15','15 Changes'],['dd-s16','16 Thesis'],['dd-s17','17 Quality'],['dd-s18','18 Insider'],['dd-qa','Q&A']];
  h+='<div class="panel"><div class="small" style="line-height:2.1">'
    +nav.map(function(x){ return '<button class="btn sm" data-dd-act="goto" data-dd-goto="'+x[0]+'" style="margin:2px">'+x[1]+'</button>'; }).join('')
    +'</div></div>';
  h+=ddS1(t)+ddS2(t)+ddS3(t)+ddS4(t)+ddS5(t)+ddS6(t)+ddS7(t)+ddS8(t)
    +ddS9(t)+ddS10(t)+ddS11(t)+ddS12(t)+ddS13(t)+ddS14(t)+ddS15(t)+ddS16(t)+ddS17(t)+ddS18(t)+ddQA(t);
  return h;
}
function ddRender(p){
  return p?ddRenderTicker(p):ddRenderNoTicker();
}

function ddAfter(p){
  var view=document.getElementById('view');
  view.setAttribute('data-dd-t', p?String(p).toUpperCase():'');
  try{ if(p&&typeof ddInsiderLoad==='function') ddInsiderLoad(String(p).toUpperCase()); }catch(e){}
  if(!view.getAttribute('data-dd-bound')){
    view.setAttribute('data-dd-bound','1');
    /* ---- input / change: save + recompute ---- */
    var onEdit=function(e){
      var el=e.target;
      if(!el||!el.getAttribute) return;
      var t=ddCur(); if(!t) return;
      var handled=false;
      var f=el.getAttribute('data-dd-f');
      if(f){
        var v=el.type==='number'||el.getAttribute('data-dd-num')?(el.value===''?null:Number(el.value)):el.value;
        ddSet(t,f,v); handled=true;
      }
      var idm=el.id&&DD_IDMAP[el.id];
      if(idm){
        var v2=el.type==='number'?(el.value===''?null:Number(el.value)):el.value;
        ddSet(t,idm,v2); handled=true;
      }
      var ms=el.getAttribute('data-dd-moat-s');
      if(ms){ var s=ddGet(t); if(!s.moat[ms]) s.moat[ms]={}; s.moat[ms].s=el.value; ddSave(); handled=true; }
      var me=el.getAttribute('data-dd-moat-e');
      if(me){ var s2=ddGet(t); if(!s2.moat[me]) s2.moat[me]={}; s2.moat[me].ev=el.value; ddSave(); handled=true; }
      var re=el.getAttribute('data-dd-re');
      if(re==='dcf'){ ddRenderDcf(); }
      else if(re==='revdcf'){ ddRenderRevDcf(); }
      else if(re==='scen'){ ddRenderScen(); }
      else if(re==='stress'){ ddRenderStress(); }
      else if(re==='chg'){ ddRenderChg(); }
      if(!handled) return;
    };
    view.addEventListener('input',onEdit);
    view.addEventListener('change',onEdit);
    /* ---- clicks ---- */
    view.addEventListener('click',function(e){
      var b=e.target.closest?e.target.closest('[data-dd-act]'):null;
      if(!b) return;
      var act=b.getAttribute('data-dd-act'), t=ddCur();
      function rerender(){ Router.render(); }
      if(act==='go'){
        var nt=tickerVal('dd-t');
        if(nt) Router.go('#/deepdive/'+encodeURIComponent(nt));
        return;
      }
      if(act==='goto'){
        var tgt=document.getElementById(b.getAttribute('data-dd-goto'));
        if(tgt) tgt.scrollIntoView({behavior:'smooth',block:'start'});
        return;
      }
      if(!t) return;
      var s=ddGet(t);
      function val(id){ var el=document.getElementById(id); return el?el.value.trim():''; }
      if(act==='segadd'){
        var nm=val('dd-seg-name'), pc=val('dd-seg-pct');
        if(nm&&ddNum(pc)){ s.biz.segments.push({name:nm,pct:Number(pc)}); ddSave(); rerender(); }
        return;
      }
      if(act==='segdel'){ s.biz.segments.splice(Number(b.getAttribute('data-dd-i')),1); ddSave(); rerender(); return; }
      if(act==='peeradd'){
        var pt=tickerVal('dd-peer-add');
        if(pt&&pt!==t&&s.peers.indexOf(pt)<0){ s.peers.push(pt); ddSave(); rerender(); }
        return;
      }
      if(act==='peerdel'){ s.peers.splice(Number(b.getAttribute('data-dd-i')),1); ddSave(); rerender(); return; }
      if(act==='madd'){
        var fy=val('dd-m-fy');
        if(!fy) return;
        var row={fy:fy};
        [['dd-m-rev','revenue'],['dd-m-ni','net_income'],['dd-m-assets','assets'],['dd-m-liab','total_liab'],['dd-m-sh','shares_dil'],['dd-m-price','price']]
          .forEach(function(pair){ var vv=val(pair[0]); row[pair[1]]=vv===''?null:Number(vv); });
        var ix=-1;
        s.manual.forEach(function(m,i){ if(String(m.fy)===String(fy)) ix=i; });
        if(ix>=0) s.manual[ix]=row; else s.manual.push(row);
        s.manual.sort(function(a,b2){ return parseFloat(b2.fy)-parseFloat(a.fy); });
        ddSave(); rerender(); return;
      }
      if(act==='mdel'){ s.manual.splice(Number(b.getAttribute('data-dd-i')),1); ddSave(); rerender(); return; }
      if(act==='rkadd'){
        var rk={risk:val('dd-rk-risk'),ev:val('dd-rk-ev'),impact:val('dd-rk-impact'),watch:val('dd-rk-watch')};
        if(rk.risk){ s.risks.push(rk); ddSave(); rerender(); }
        return;
      }
      if(act==='rkdel'){ s.risks.splice(Number(b.getAttribute('data-dd-i')),1); ddSave(); rerender(); return; }
      if(act==='qa'){
        var q=val('dd-qa-q');
        var out=document.getElementById('dd-qa-out');
        if(out) out.innerHTML='<div class="panel"><p>'+ddQAAnswer(t,q)+'</p></div>';
        return;
      }
    });
    /* enter key on ticker + question inputs */
    view.addEventListener('keydown',function(e){
      if(e.key!=='Enter') return;
      if(e.target&&e.target.id==='dd-t'){ e.preventDefault(); var nt=tickerVal('dd-t'); if(nt) Router.go('#/deepdive/'+encodeURIComponent(nt)); }
      if(e.target&&e.target.id==='dd-qa-q'){ e.preventDefault(); var t=ddCur(); var out=document.getElementById('dd-qa-out'); if(out&&t) out.innerHTML='<div class="panel"><p>'+ddQAAnswer(t,e.target.value)+'</p></div>'; }
      if(e.target&&e.target.id==='dd-peer-add'){ e.preventDefault(); var t2=ddCur(); var pt=tickerVal('dd-peer-add'); if(t2&&pt&&pt!==t2){ var s=ddGet(t2); if(s.peers.indexOf(pt)<0){ s.peers.push(pt); ddSave(); Router.render(); } } }
    });
  }
  /* initial computes for the visible dynamic boxes */
  ddRenderDcf(); ddRenderRevDcf(); ddRenderScen(); ddRenderStress(); ddRenderChg();
}

/* ============================================================
   DEEP DIVE §17 — quality scores, §18 — insider transactions
   ============================================================ */
function ddS17(t){
  if(!ddHasData(t)) return '';
  var fs=qPiotroski(t), az=qAltman(t);
  var body='<p class="small">Two classic accounting-based scores, computed from the bundled filings. '
    +'They summarize quality and distress risk — they do not predict returns.</p>';
  /* Piotroski */
  body+='<h3>Piotroski F-Score '+(fs.score==null?'<span class="tag">n/a</span>':'<span class="tag '+(fs.score>=7?'b-ok':fs.score>=4?'b-warn':'b-bad')+'">'+fs.score+' / 9 — '+qFLabel(fs.score)+'</span>')+'</h3>';
  if(fs.parts.length){
    body+='<table class="tbl"><tbody>'+fs.parts.map(function(p){
      return '<tr><td>'+ddE(p.name)+'</td><td class="num">'+(p.pass?'<span style="color:var(--green)">✓</span>':'<span style="color:var(--red)">✗</span>')+'</td></tr>';
    }).join('')+'</tbody></table>';
  } else body+='<p class="small hint">data unavailable</p>';
  /* Altman */
  body+='<h3 style="margin-top:10px">Altman Z-Score '+(az.z==null?'<span class="tag">n/a</span>':'<span class="tag '+(az.z>2.99?'b-ok':az.z>1.81?'b-warn':'b-bad')+'">'+az.z.toFixed(2)+' — '+qZLabel(az.z)+'</span>')+'</h3>';
  if(az.parts.length){
    body+='<table class="tbl"><thead><tr><th>Component</th><th class="num">Value</th><th class="num">Weight</th></tr></thead><tbody>'
      +az.parts.map(function(p){ return '<tr><td>'+ddE(p.k)+'</td><td class="num mono">'+p.v.toFixed(3)+'</td><td class="num mono">'+p.w+'</td></tr>'; }).join('')
      +'</tbody></table>'
      +'<p class="small hint">Z = 1.2·WC/TA + 1.4·RE/TA + 3.3·EBIT/TA + 0.6·MVE/TL + 1.0·Sales/TA. '
      +'Zones: &gt;2.99 safe, 1.81–2.99 grey, &lt;1.81 distress. Designed for manufacturers — banks and insurers (e.g. JPM) score oddly by construction.</p>';
  } else body+='<p class="small hint">data unavailable</p>';
  return ddSec('dd-s17',17,ex('dd-quality','Quality scores'),'',body);
}
function ddS18(t){
  if(!ddHasData(t)) return '';
  var body='<p class="small">Recent insider filings (Forms 3, 4, 5) pulled live from SEC EDGAR. '
    +'Filing-level detail (buy vs sell, shares, prices) is in the linked SEC document.</p>'
    +'<div id="dd-insider"><span class="small hint">Loading insider filings…</span></div>';
  return ddSec('dd-s18',18,ex('dd-insider','Insider transactions'),'',body);
}
function ddInsiderLoad(t){
  var box=document.getElementById('dd-insider'); if(!box) return;
  var f=(RealData.fundamentals||{})[t];
  if(!f||!f.cik){ box.innerHTML='<span class="small hint">No CIK — insider data unavailable.</span>'; return; }
  var cik=String(f.cik); while(cik.length<10) cik='0'+cik;
  fetch('https://data.sec.gov/submissions/CIK'+cik+'.json',{cache:'no-store',headers:{'Accept':'application/json'}})
    .then(function(r){ if(!r.ok) throw 0; return r.json(); })
    .then(function(j){
      var rec=j.filings&&j.filings.recent, out=[];
      if(rec&&rec.form){
        for(var i=0;i<rec.form.length&&out.length<10;i++){
          if(['3','4','5'].indexOf(rec.form[i])<0) continue;
          var acc=String(rec.accessionNumber[i]).replace(/-/g,'');
          out.push({form:rec.form[i], date:rec.filingDate[i], desc:rec.primaryDocDescription[i]||'',
            url:'https://www.sec.gov/Archives/edgar/data/'+parseInt(cik,10)+'/'+acc+'/'+rec.primaryDocument[i]});
        }
      }
      box.innerHTML=out.length
        ? '<table class="tbl"><thead><tr><th>Form</th><th>Date</th><th>Description</th></tr></thead><tbody>'
          +out.map(function(o){
              return '<tr><td><b>'+Util.esc(o.form)+'</b></td><td class="mono">'+Util.esc(o.date)+'</td>'
                +'<td><a href="'+Util.esc(o.url)+'" target="_blank" rel="noopener">'+Util.esc(o.desc||'Open filing')+'</a></td></tr>';
            }).join('')+'</tbody></table>'
        : '<span class="small hint">No recent insider filings (Forms 3/4/5) found.</span>';
    })
    .catch(function(){ box.innerHTML='<span class="small hint">SEC feed unavailable right now.</span>'; });
}

Router.routes['deepdive']=function(p){ return ddRender(p||null); };
Router.routes['deepdive'].after=function(p){ ddAfter(p||null); };

/* per-ticker notes store shared with Research Mode (12-research.js) */
window.ddGet=ddGet; window.ddSave=ddSave; window.DD_DESC=DD_DESC;

})();
