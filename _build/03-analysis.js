/* ================================================================
   FINANCE SUITE — 03-analysis.js
   Company Rating, Statement Analyzer, Valuation Workbench,
   Bonds & Rates, Buybacks.
   Plain JS, concatenated after 00-core.js and 02-research.js.
   Uses globals: Util, RealData, DATA_BADGE, lastClose, fundVal,
   fundFYs, STOCK_TICKERS, ex, EX, Charts, fieldRow, emptyBox,
   numInput, textInput, Router, NAV_PARENT.
   FilingLib (02-research.js) is optional — guarded everywhere.
   No <script> tags in this file.
   ================================================================ */
(function(){
'use strict';

/* ---------------- EX entries (ra- prefixed, no clashes) ---------------- */
(function raRegEX(){
  var A=function(k,t,what,why,good){ EX.add(k,t,what,why,good); };
  A('ra-netmargin','Net margin','Net income divided by revenue: the cents of profit kept from each dollar of sales after every cost.','It is the bottom-line efficiency of the whole business.','Higher is better; 20%+ is strong in most industries. Compare with peers.');
  A('ra-assetturn','Asset turnover','Revenue divided by total assets: how many dollars of sales each dollar of assets produces.','Shows how hard the company\u2019s assets are working to generate sales.','Higher is better; retailers score high, utilities low.');
  A('ra-eqmult','Equity multiplier','Total assets divided by shareholder equity: how much of the assets are funded by debt.','The leverage leg of DuPont \u2014 it boosts ROE but adds risk.','Near 1 means little debt; a high number means debt-driven returns.');
  A('ra-wc','Working capital','Current assets minus current liabilities: the short-term cash cushion.','Positive means bills due within a year are covered; negative can signal stress.','Positive and stable is healthy.');
  A('ra-mve','Market value of equity','Share price multiplied by shares outstanding: what the market thinks the equity is worth.','Altman\u2019s formula weighs it against liabilities as a market-confidence check.','Bigger than total liabilities is reassuring.');
  A('ra-retearn','Retained earnings','All past profits kept in the business instead of paid out as dividends.','A long profitable history builds this up; losses shrink it.','Large and growing signals a history of real profits.');
  A('ra-cagr','CAGR','Compound annual growth rate: the steady yearly pace that would get from the old number to the new one.','Smooths bumpy year-to-year growth into one comparable yearly rate.','Higher is better; negative means the line is shrinking.');
  A('ra-cashconv','Cash conversion','Operating cash flow divided by net income: how much of the reported profit arrives as cash.','Profit on paper means little if the cash never shows up.','Above 1 is healthy; well below 1 for years is a warning sign.');
  A('ra-tv','Terminal value','The estimated value of all cash flows beyond the forecast years, in a DCF.','Most of a DCF\u2019s answer often comes from this single number \u2014 which is why DCFs are so sensitive to assumptions.','A smaller share of total value means less guesswork is driving the answer.');
  A('ra-mos','Margin of safety','Buying below your estimated fair value so that mistakes in your math hurt less.','If fair value is $100 and you pay $75, you hold a 25% cushion against being wrong.','A bigger cushion for shakier assumptions.');
  A('ra-bprice','Bond price','What a bond is worth today: all its future coupon payments plus the face value, shrunk back at the market\u2019s required yield.','When market yields rise, a bond\u2019s fixed payments are worth less \u2014 so its price falls.','Paying below the $1,000 face value means the yield beats the coupon rate.');
  A('ra-macaulay','Macaulay duration','The weighted-average time until a bond\u2019s payments arrive, measured in years.','It doubles as rate sensitivity: the price moves about \u2212duration% for each 1-point yield move.','Shorter duration means calmer prices when rates move.');
  A('ra-ratescen','Rate scenarios','What-if math showing how prices and costs change if interest rates move.','Rates touch everything \u2014 bond prices, stock valuations, and company borrowing costs.','Use scenarios to see the risk before rates actually move.');
  A('ra-fed','Fed rate moves','The Federal Reserve sets a benchmark rate that ripples into loans, bonds, and mortgages.','Hikes cool borrowing and spending; cuts encourage it. Markets reprice on expectations, not just the move itself.','Neither is simply \u201cgood\u201d \u2014 it depends whether you borrow, save, or own stocks.');
  A('ra-epsuplift','EPS uplift','How much earnings per share rises when buybacks shrink the share count.','Fewer shares split the same profit, so each remaining share\u2019s slice grows.','Real value only if the shares were bought back cheaply.');
  A('ra-debtpay','Debt paydown','Using cash to retire debt early instead of keeping it to maturity.','Less debt means less interest and less risk \u2014 but cash spent can\u2019t fund growth.','Good when debt is expensive or heavy; costly if it starves good investments.');
  A('ra-sharetrend','Share count trend','Whether shares outstanding are shrinking (buybacks at work) or growing (new shares issued).','Shrinking flatters EPS; growing dilutes existing holders.','A steady shrink alongside rising profit is usually shareholder-friendly.');
  A('ra-fcfstart','Starting cash flow','The cash number a DCF grows into the future, year by year.','The whole valuation scales with this input \u2014 weak input, weak answer.','Use a normal, sustainable year, not a one-off spike.');
})();

/* ---------------- shared helpers (ra prefix) ---------------- */
var RA_FIELDS=[
  ['revenue','Revenue'],['net_income','Net income'],['gross_profit','Gross profit'],
  ['op_income','Operating income'],['assets','Total assets'],['cur_assets','Current assets'],
  ['cur_liab','Current liabilities'],['total_liab','Total liabilities'],['lt_debt','Long-term debt'],
  ['retained','Retained earnings'],['op_cash','Operating cash flow'],['shares_dil','Diluted shares'],
  ['interest_exp','Interest expense']
];
function raIsNum(v){ return v!=null && v!=='' && !isNaN(Number(v)); }
/* Figure lookup with data priority: uploaded filing figures > RealData fundamentals. */
function raFig(t, field, fy){
  var val=null, src='built-in SEC data';
  if(typeof FilingLib!=='undefined' && FilingLib){
    try{
      var uf=FilingLib.figuresFor(t);
      var fv=uf && uf.figures ? uf.figures[field] : null;
      if(fv!=null && fv!=='' && !(typeof fv==='number' && isNaN(fv))){
        if(typeof fv==='object'){
          if(Array.isArray(fv)){
            /* FilingLib shape: [{fy:'2025', val:123}, ...] — pick requested FY, else latest */
            var hit=null;
            for(var ai=0;ai<fv.length;ai++){ if(fv[ai]&&String(fv[ai].fy)===String(fy)){ hit=fv[ai]; break; } }
            if(!hit&&fv.length) hit=fv[0];
            fv = (hit&&raIsNum(hit.val)) ? hit.val : null;
          }
          else if(raIsNum(fv.val)){ fv=fv.val; }
          else{
            var c=(fv[fy]!=null?fv[fy]:fv[String(fy)]);
            if(c==null){ var ks=Object.keys(fv); for(var i=0;i<ks.length;i++){ if(fv[ks[i]]!=null){ c=fv[ks[i]]; break; } } }
            fv=c;
          }
        }
        if(raIsNum(fv)){ val=Number(fv); src='uploaded filing'; }
      }
    }catch(e){ /* filing read failed — fall through to built-in data */ }
  }
  if(val==null){
    var v=fundVal(t, field, fy);
    if(raIsNum(v)) val=Number(v);
  }
  return {val:val, src:src, fy:fy};
}
function raFigMap(t, fy){
  var m={}; RA_FIELDS.forEach(function(f){ m[f[0]]=raFig(t,f[0],fy); });
  return m;
}
function raFys(t){
  var fys={};
  (fundFYs(t)||[]).forEach(function(y){ fys[String(y)]=1; });
  if(typeof FilingLib!=='undefined'&&FilingLib){
    try{
      var uf=FilingLib.figuresFor(t);
      if(uf&&uf.figures){
        Object.keys(uf.figures).forEach(function(k){
          var arr=uf.figures[k];
          if(Array.isArray(arr)) arr.forEach(function(r){ if(r&&r.fy) fys[String(r.fy)]=1; });
        });
      }
    }catch(e){}
  }
  return Object.keys(fys).sort(function(a,b){ return parseFloat(b)-parseFloat(a); });
}
function raCoName(t){
  var f=(RealData.fundamentals||{})[t];
  return (f && f.name) ? f.name : t;
}
function raCagr(vNow, vThen, years){
  if(!raIsNum(vNow)||!raIsNum(vThen)||!years) return null;
  vNow=Number(vNow); vThen=Number(vThen);
  if(vThen<=0||vNow<=0) return null;
  return Math.pow(vNow/vThen, 1/years)-1;
}
function raArrow(cur, prev){
  if(!raIsNum(cur)||!raIsNum(prev)) return '<span class="small">n/a</span>';
  cur=Number(cur); prev=Number(prev);
  if(cur>prev) return '<span style="color:#3fb950;font-weight:700">\u2191</span>';
  if(cur<prev) return '<span style="color:#f85149;font-weight:700">\u2193</span>';
  return '<span class="small">\u2192</span>';
}
function raSrcTag(src){
  return ' <span class="tag" title="Where this number came from">'+Util.esc(src)+'</span>';
}
function raRuleTag(){
  return ' <span class="tag" title="Computed by fixed rules from the numbers above, not by judgment">assistive (rule-based)</span>';
}
function raVal(v, fmt){
  if(!raIsNum(v)) return 'data unavailable';
  if(fmt==='money') return Util.money(Number(v));
  if(fmt==='pct') return Util.pct(Number(v));
  if(fmt==='x') return Util.num(Number(v),2)+'\u00d7';
  if(fmt==='int') return Util.num(Number(v),0);
  return Util.num(Number(v));
}
function raRoute(name, render, after){
  render.after=after;
  Router.routes[name]=render;
}
function raPassBadge(ok){
  if(ok==null) return '<span class="badge b-neutral">n/a</span>';
  return ok ? '<span class="badge b-ok">pass</span>' : '<span class="badge b-bad">fail</span>';
}

/* ================= RATING: Company Rating scorecard ================= */
function raRatingData(t){
  var fys=raFys(t);
  var fy0=fys[0], fy1=fys[1], fy2=fys[2];
  var F0=fy0?raFigMap(t,fy0):{}, F1=fy1?raFigMap(t,fy1):{}, F2=fy2?raFigMap(t,fy2):{};
  var price=lastClose(t);
  function g(F,f){ return (F[f]&&raIsNum(F[f].val))?Number(F[f].val):null; }
  /* ---- Piotroski F-Score (9 checks) ---- */
  var ni0=g(F0,'net_income'), oc0=g(F0,'op_cash'), a0=g(F0,'assets'),
      ni1=g(F1,'net_income'), a1=g(F1,'assets');
  var ca0=g(F0,'cur_assets'), cl0=g(F0,'cur_liab'), ca1=g(F1,'cur_assets'), cl1=g(F1,'cur_liab');
  var ltd0=g(F0,'lt_debt'), ltd1=g(F1,'lt_debt'), s0=g(F0,'shares_dil'), s1=g(F1,'shares_dil');
  var gp0=g(F0,'gross_profit'), r0=g(F0,'revenue'), gp1=g(F1,'gross_profit'), r1=g(F1,'revenue');
  var checks=[];
  function chk(label, formula, ok){ checks.push({label:label, formula:formula, ok:ok}); }
  chk('Net income above zero', 'net income '+fy0+' > 0', ni0==null?null:ni0>0);
  chk('Operating cash flow above zero', 'operating cash flow '+fy0+' > 0', oc0==null?null:oc0>0);
  chk('Return on assets rising', 'ROA '+fy0+' > ROA '+fy1,
      (ni0==null||a0==null||!a0||ni1==null||a1==null||!a1)?null:(ni0/a0)>(ni1/a1));
  chk('Cash flow beats profit', 'operating cash flow '+fy0+' > net income '+fy0,
      (oc0==null||ni0==null)?null:oc0>ni0);
  chk('Long-term debt falling', 'long-term debt '+fy0+' < '+fy1,
      (ltd0==null||ltd1==null)?null:ltd0<ltd1);
  chk('Current ratio rising', 'current ratio '+fy0+' > '+fy1,
      (ca0==null||cl0==null||!cl0||ca1==null||cl1==null||!cl1)?null:(ca0/cl0)>(ca1/cl1));
  chk('Shares not increasing', 'diluted shares '+fy0+' \u2264 '+fy1,
      (s0==null||s1==null)?null:s0<=s1);
  chk('Gross margin rising', 'gross margin '+fy0+' > '+fy1,
      (gp0==null||r0==null||!r0||gp1==null||r1==null||!r1)?null:(gp0/r0)>(gp1/r1));
  chk('Asset turnover rising', 'asset turnover '+fy0+' > '+fy1,
      (r0==null||a0==null||!a0||r1==null||a1==null||!a1)?null:(r0/a0)>(r1/a1));
  var fsScore=0, fsNA=0;
  checks.forEach(function(c){ if(c.ok==null) fsNA++; else if(c.ok) fsScore++; });
  /* ---- Altman Z-Score ---- */
  var wc=(ca0!=null&&cl0!=null)?ca0-cl0:null, ta=a0, re=g(F0,'retained'),
      ebit=g(F0,'op_income'), tl=g(F0,'total_liab'), sales=r0;
  var mve=(price!=null&&s0!=null)?price*s0:null;
  var z=null, zParts=null;
  if(wc!=null&&ta&&re!=null&&ebit!=null&&tl&&sales!=null&&mve!=null){
    var p1=wc/ta, p2=re/ta, p3=ebit/ta, p4=mve/tl, p5=sales/ta;
    z=1.2*p1+1.4*p2+3.3*p3+0.6*p4+1.0*p5;
    zParts=[['1.2 \u00d7 working capital / assets',1.2*p1],['1.4 \u00d7 retained earnings / assets',1.4*p2],
            ['3.3 \u00d7 EBIT / assets',3.3*p3],['0.6 \u00d7 market equity / liabilities',0.6*p4],
            ['1.0 \u00d7 sales / assets',1.0*p5]];
  }
  var zZone=z==null?'n/a':(z>2.99?'safe':(z>=1.81?'grey':'distress'));
  /* ---- DuPont ---- */
  var eq=(ta!=null&&tl!=null)?ta-tl:null;
  var roe=(ni0!=null&&eq)?ni0/eq:null,
      nm=(ni0!=null&&r0)?ni0/r0:null,
      at=(r0!=null&&ta)?r0/ta:null,
      em=(ta!=null&&eq)?ta/eq:null;
  /* ---- Interest coverage ---- */
  var ie=g(F0,'interest_exp');
  var intcov=(ebit!=null&&ie)?ebit/ie:null;
  /* ---- 3-yr trends ---- */
  var r2=g(F2,'revenue'), ni2=g(F2,'net_income');
  var revCagr=raCagr(r0,r2,2), niCagr=raCagr(ni0,ni2,2);
  var nm2=(ni2!=null&&r2)?ni2/r2:null, gm0=(gp0!=null&&r0)?gp0/r0:null, gm2=(g(F2,'gross_profit')!=null&&r2)?g(F2,'gross_profit')/r2:null;
  var cr0=(ca0!=null&&cl0)?ca0/cl0:null;
  var de=(tl!=null&&eq)?tl/eq:null;
  return {t:t, name:raCoName(t), fys:fys, fy0:fy0, fy1:fy1, fy2:fy2, F0:F0, F1:F1, price:price,
    fs:{checks:checks, score:fsScore, na:fsNA},
    altman:{z:z, parts:zParts, zone:zZone, wc:wc, ta:ta, re:re, ebit:ebit, mve:mve, tl:tl, sales:sales},
    dupont:{roe:roe, nm:nm, at:at, em:em, eq:eq},
    intcov:intcov, intExp:ie,
    trends:{revCagr:revCagr, niCagr:niCagr, nm0:nm, nm2:nm2, gm0:gm0, gm2:gm2, cr0:cr0, de:de, r0:r0, r2:r2, ni0:ni0, ni2:ni2}};
}
function raRatingVerdict(d){
  var s=[], w=[], n=[];
  var fs=d.fs;
  if(fs.na<9){
    if(fs.score>=7) s.push('Strong Piotroski F-Score of '+fs.score+'/9 \u2014 the statements clear most quality checks (profits, cash flow, balance-sheet trends).');
    else if(fs.score<=3) w.push('Weak Piotroski F-Score of '+fs.score+'/9 \u2014 several quality checks fail, which has historically marked weaker businesses.');
    else n.push('A middling Piotroski F-Score of '+fs.score+'/9 \u2014 some quality checks pass, some do not.');
  } else n.push('Piotroski F-Score could not be computed \u2014 too many figures are missing.');
  var z=d.altman.z;
  if(z!=null){
    if(z>2.99) s.push('Altman Z-Score of '+z.toFixed(2)+' sits in the safe zone \u2014 bankruptcy risk looks low on these measures.');
    else if(z>=1.81) n.push('Altman Z-Score of '+z.toFixed(2)+' is in the grey zone \u2014 neither clearly safe nor distressed.');
    else w.push('Altman Z-Score of '+z.toFixed(2)+' is in the distress zone \u2014 the finances resemble past bankruptcies; treat with caution.');
  } else n.push('Altman Z-Score: data unavailable \u2014 a needed figure is missing.');
  var ic=d.intcov;
  if(ic!=null){
    if(ic>=5) s.push('Interest coverage of '+ic.toFixed(1)+'\u00d7 \u2014 operating profit covers interest comfortably.');
    else if(ic>=1.5) n.push('Interest coverage of '+ic.toFixed(1)+'\u00d7 \u2014 interest is covered but without much slack.');
    else w.push('Interest coverage of '+ic.toFixed(1)+'\u00d7 \u2014 interest eats most of operating profit; debt is a burden here.');
  } else n.push('Interest coverage: data unavailable (interest expense not reported).');
  var roe=d.dupont.roe;
  if(roe!=null){
    if(roe>=0.15) s.push('Return on equity of '+Util.pct(roe)+' \u2014 the business earns strongly on owners\u2019 money.');
    else if(roe>=0) n.push('Return on equity of '+Util.pct(roe)+' \u2014 positive but not exceptional.');
    else w.push('Negative return on equity ('+Util.pct(roe)+') \u2014 the business is losing owners\u2019 money.');
  }
  var rc=d.trends.revCagr;
  if(rc!=null){
    if(rc>0.05) s.push('Revenue compounding at '+Util.pct(rc)+' a year over three years \u2014 the top line is growing.');
    else if(rc<0) w.push('Revenue shrinking about '+Util.pct(Math.abs(rc))+' a year over three years \u2014 the business is getting smaller.');
    else n.push('Revenue roughly flat over three years ('+Util.pct(rc)+' a year).');
  }
  var cr=d.trends.cr0;
  if(cr!=null && cr<1) w.push('Current ratio of '+cr.toFixed(2)+' is below 1.0 \u2014 short-term bills exceed short-term resources.');
  var de=d.trends.de;
  if(de!=null && de>2) w.push('Debt-to-equity of '+de.toFixed(2)+' \u2014 the company leans heavily on debt.');
  var nm0=d.trends.nm0, nm2=d.trends.nm2;
  if(nm0!=null&&nm2!=null){
    if(nm0>nm2) s.push('Net margin widened from '+Util.pct(nm2)+' to '+Util.pct(nm0)+' over three years \u2014 profitability is improving.');
    else if(nm0<nm2) w.push('Net margin narrowed from '+Util.pct(nm2)+' to '+Util.pct(nm0)+' over three years \u2014 costs are growing faster than sales.');
  }
  var headline = w.length>=3 ? 'On paper, this company shows several warning signs.'
    : (s.length>=w.length+2 && s.length>0 ? 'On paper, this looks like a financially solid company.'
    : 'A mixed picture \u2014 strengths and flags sit side by side.');
  return {s:s, w:w, n:n, headline:headline};
}
function raRatingRender(param){
  if(!STOCK_TICKERS.length) return '<div class="panel">'+emptyBox('No company data is available.')+'</div>';
  var t=param?String(param).toUpperCase().trim():STOCK_TICKERS[0];
  if(!t) t=STOCK_TICKERS[0];
  var d=raRatingData(t), v=raRatingVerdict(d);
  var usedFiling=false;
  RA_FIELDS.forEach(function(f){ if(d.F0[f[0]]&&d.F0[f[0]].src==='uploaded filing') usedFiling=true; });
  var h='';
  h+='<div class="panel"><h2>'+ex('piotroski','Company Rating')+' \u2014 '+Util.esc(d.name)+' ('+Util.esc(t)+')</h2>'+DATA_BADGE;
  if(!d.fys.length) h+='<div class="alert warn"><b>No bundled SEC data for '+Util.esc(t)+'.</b> Upload its 10-K on the <a href="#/sec-upload">SEC Filing Upload</a> page to rate it \u2014 every check below shows \u201cdata unavailable\u201d rather than a guess.</div>';
  h+='<p class="small">A scorecard built only from reported financial figures \u2014 no forecasts, no opinions.'+raRuleTag()+'</p>';
  h+=fieldRow('Company', '<div style="display:flex;gap:8px">'+tickerInput('ra-rating-sel', t)+'<button class="btn sm" id="ra-rating-go">Load</button></div>',
    'Figures: '+(usedFiling?'your <b>uploaded filing</b> where available, otherwise ':'')+'built-in SEC filing data (as of 2026-09-25). Each number below is tagged with its source. '+tickerHint());
  /* score cards */
  var fsBadge=d.fs.score>=7?'b-ok':(d.fs.score<=3?'b-bad':'b-warn');
  var zBadge=d.altman.zone==='safe'?'b-ok':(d.altman.zone==='distress'?'b-bad':(d.altman.zone==='grey'?'b-warn':'b-neutral'));
  h+='<div class="grid g4">'
    +'<div class="kpi"><div class="k">'+ex('piotroski','Piotroski F-Score')+'</div><div class="v"><span class="score">'+d.fs.score+'</span><span class="small">/9</span></div><div class="d">'+(d.fs.na?d.fs.na+' check(s) lacked data':'all 9 checks had data')+'</div><div class="bar"><i style="width:'+(d.fs.score/9*100)+'%"></i></div></div>'
    +'<div class="kpi"><div class="k">'+ex('altman','Altman Z-Score')+'</div><div class="v">'+(d.altman.z==null?'data unavailable':d.altman.z.toFixed(2))+'</div><div class="d"><span class="badge '+zBadge+'">'+Util.esc(d.altman.zone)+'</span></div></div>'
    +'<div class="kpi"><div class="k">'+ex('roe','Return on equity')+'</div><div class="v">'+(d.dupont.roe==null?'data unavailable':Util.pct(d.dupont.roe))+'</div><div class="d">via '+ex('dupont','DuPont')+' breakdown below</div></div>'
    +'<div class="kpi"><div class="k">'+ex('intcov','Interest coverage')+'</div><div class="v">'+(d.intcov==null?'data unavailable':d.intcov.toFixed(1)+'\u00d7')+'</div><div class="d">operating income \u00f7 interest expense</div></div>'
    +'</div></div>';
  /* Piotroski detail */
  h+='<div class="panel"><h2>'+ex('piotroski','Piotroski F-Score')+' \u2014 '+d.fs.score+' / 9'+raRuleTag()+'</h2>';
  h+='<p class="small">Nine yes/no checks on the financial statements. Each passed check earns one point. 8\u20139 is strong, 0\u20132 is weak.</p>';
  h+='<table class="tbl"><tr><th>Check</th><th>Formula</th><th class="num">Result</th></tr>';
  d.fs.checks.forEach(function(c){
    h+='<tr><td>'+Util.esc(c.label)+'</td><td class="mono small">'+Util.esc(c.formula)+'</td><td class="num">'+raPassBadge(c.ok)+'</td></tr>';
  });
  h+='</table></div>';
  /* Altman detail */
  h+='<div class="panel"><h2>'+ex('altman','Altman Z-Score')+': '+(d.altman.z==null?'data unavailable':d.altman.z.toFixed(2))+' <span class="badge '+zBadge+'">'+Util.esc(d.altman.zone)+'</span></h2>';
  h+='<p class="mono small">Z = 1.2\u00d7(WC/TA) + 1.4\u00d7(RE/TA) + 3.3\u00d7(EBIT/TA) + 0.6\u00d7(MVE/TL) + 1.0\u00d7(Sales/TA)</p>';
  h+='<p class="small">Zones: above 2.99 = safe \u00b7 1.81\u20132.99 = grey \u00b7 below 1.81 = distress. Uses operating income as EBIT; market equity = share price \u00d7 shares.</p>';
  if(d.altman.parts){
    h+='<table class="tbl"><tr><th>Component</th><th class="num">Contribution</th></tr>';
    d.altman.parts.forEach(function(p){ h+='<tr><td>'+Util.esc(p[0])+'</td><td class="num">'+p[1].toFixed(3)+'</td></tr>'; });
    h+='</table>';
    var sOf=function(f){ return (d.F0[f]&&d.F0[f].src)||'built-in SEC data'; };
    h+='<p class="small">Inputs ('+Util.esc(d.fy0||'')+'): working capital '+raVal(d.altman.wc,'money')+raSrcTag(sOf('cur_assets'))
      +' \u00b7 retained earnings '+raVal(d.altman.re,'money')+raSrcTag(sOf('retained'))
      +' \u00b7 EBIT '+raVal(d.altman.ebit,'money')+raSrcTag(sOf('op_income'))
      +' \u00b7 market equity '+raVal(d.altman.mve,'money')+raSrcTag('market data \u00d7 '+sOf('shares_dil'))
      +' \u00b7 liabilities '+raVal(d.altman.tl,'money')+raSrcTag(sOf('total_liab'))
      +' \u00b7 sales '+raVal(d.altman.sales,'money')+raSrcTag(sOf('revenue'))
      +' \u00b7 assets '+raVal(d.altman.ta,'money')+raSrcTag(sOf('assets'))+'.</p>';
  } else {
    h+=emptyBox('Z-Score: data unavailable \u2014 at least one required figure is missing for '+Util.esc(d.fy0||'the latest year')+'.');
  }
  h+='</div>';
  /* DuPont */
  h+='<div class="panel"><h2>'+ex('dupont','DuPont breakdown')+' of '+ex('roe','ROE')+'</h2>';
  if(d.dupont.roe!=null){
    h+='<p class="mono">ROE = net margin \u00d7 asset turnover \u00d7 equity multiplier</p>';
    h+='<p class="mono">'+Util.pct(d.dupont.roe)+' = '+Util.pct(d.dupont.nm)+' \u00d7 '+Util.num(d.dupont.at)+' \u00d7 '+Util.num(d.dupont.em)+'</p>';
    h+='<table class="tbl"><tr><th>Leg</th><th class="num">Value</th><th>Plain English</th></tr>'
      +'<tr><td>'+ex('ra-netmargin','Net margin')+'</td><td class="num">'+Util.pct(d.dupont.nm)+'</td><td class="small">Profit kept per dollar of sales.</td></tr>'
      +'<tr><td>'+ex('ra-assetturn','Asset turnover')+'</td><td class="num">'+Util.num(d.dupont.at)+'\u00d7</td><td class="small">Sales squeezed from each dollar of assets.</td></tr>'
      +'<tr><td>'+ex('ra-eqmult','Equity multiplier')+'</td><td class="num">'+Util.num(d.dupont.em)+'\u00d7</td><td class="small">How much debt juices the return.</td></tr></table>';
    var emNote=d.dupont.em!=null&&d.dupont.em>2?'High ROE here leans on leverage \u2014 debt-driven returns are fragile.':(d.dupont.nm!=null&&d.dupont.nm>0.15?'ROE is powered by strong margins \u2014 the quality kind of return.':'');
    if(emNote) h+='<p class="rule-note">'+Util.esc(emNote)+raRuleTag()+'</p>';
  } else h+=emptyBox('DuPont: data unavailable \u2014 a required figure is missing.');
  h+='</div>';
  /* trends */
  h+='<div class="panel"><h2>Three-year trends'+raRuleTag()+'</h2>';
  h+='<table class="tbl"><tr><th>Trend</th><th class="num">'+Util.esc(d.fy2||'')+' \u2192 '+Util.esc(d.fy0||'')+'</th><th class="num">Read</th></tr>'
    +'<tr><td>'+ex('revenue','Revenue')+' '+ex('ra-cagr','CAGR')+'</td><td class="num">'+(d.trends.revCagr==null?'data unavailable':Util.pct(d.trends.revCagr))+'</td><td class="num">'+raArrow(d.trends.r0,d.trends.r2)+'</td></tr>'
    +'<tr><td>'+ex('netincome','Net income')+' '+ex('ra-cagr','CAGR')+'</td><td class="num">'+(d.trends.niCagr==null?'data unavailable':Util.pct(d.trends.niCagr))+'</td><td class="num">'+raArrow(d.trends.ni0,d.trends.ni2)+'</td></tr>'
    +'<tr><td>'+ex('ra-netmargin','Net margin')+'</td><td class="num">'+(d.trends.nm2==null?'data unavailable':Util.pct(d.trends.nm2)+' \u2192 '+Util.pct(d.trends.nm0))+'</td><td class="num">'+raArrow(d.trends.nm0,d.trends.nm2)+'</td></tr>'
    +'<tr><td>'+ex('grossmargin','Gross margin')+'</td><td class="num">'+(d.trends.gm2==null?'data unavailable':Util.pct(d.trends.gm2)+' \u2192 '+Util.pct(d.trends.gm0))+'</td><td class="num">'+raArrow(d.trends.gm0,d.trends.gm2)+'</td></tr>'
    +'<tr><td>'+ex('intcov','Interest coverage')+' ('+Util.esc(d.fy0||'')+')</td><td class="num">'+(d.intcov==null?'data unavailable':d.intcov.toFixed(1)+'\u00d7')+'</td><td class="small num">interest expense '+raVal(d.intExp,'money')+'</td></tr>'
    +'</table><p class="hint">CAGR needs positive values at both ends; \u201cdata unavailable\u201d means a figure was missing or not positive.</p></div>';
  /* verdict */
  h+='<div class="panel"><h2>Plain-English verdict'+raRuleTag()+'</h2>';
  h+='<p><b>'+Util.esc(v.headline)+'</b></p>';
  if(v.s.length){ h+='<h3>Strengths</h3><ul>'; v.s.forEach(function(x){ h+='<li>'+Util.esc(x)+'</li>'; }); h+='</ul>'; }
  if(v.w.length){ h+='<h3>Weaknesses</h3><ul>'; v.w.forEach(function(x){ h+='<li>'+Util.esc(x)+'</li>'; }); h+='</ul>'; }
  if(v.n.length){ h+='<h3>Notes</h3><ul>'; v.n.forEach(function(x){ h+='<li>'+Util.esc(x)+'</li>'; }); h+='</ul>'; }
  h+='</div>';
  /* formula box */
  h+='<details class="exp"><summary>Every formula used on this page</summary><div class="body"><ul class="mono small">'
    +'<li>Piotroski: 1 point per passed check (9 checks listed above).</li>'
    +'<li>Altman Z = 1.2\u00d7(WC/TA)+1.4\u00d7(RE/TA)+3.3\u00d7(EBIT/TA)+0.6\u00d7(MVE/TL)+1.0\u00d7(Sales/TA); EBIT = operating income; MVE = share price \u00d7 diluted shares.</li>'
    +'<li>DuPont: ROE = (net income/revenue) \u00d7 (revenue/assets) \u00d7 (assets/equity); equity = assets \u2212 total liabilities.</li>'
    +'<li>Interest coverage = operating income \u00f7 interest expense.</li>'
    +'<li>3-yr CAGR = (value now \u00f7 value 2 years ago)<sup>1/2</sup> \u2212 1.</li>'
    +'<li>Current ratio = current assets \u00f7 current liabilities; D/E = total liabilities \u00f7 equity.</li>'
    +'</ul></div></details>';
  h+='<div class="alert warn"><b>Honesty box:</b> What numbers can\u2019t capture: management quality, competitive moat, industry shifts, fraud \u2014 this score grades the past, not the future.</div>';
  return h;
}
function raRatingAfter(){
  var sel=document.getElementById('ra-rating-sel');
  if(sel) sel.addEventListener('change', function(){ Router.go('#/rating/'+encodeURIComponent(sel.value)); });
}
raRoute('rating', raRatingRender, raRatingAfter);
raRoute('rating-ticker', raRatingRender, raRatingAfter);

/* ================= STATEMENTS: Financial Statement Analyzer ================= */
function raStmtTickerData(t){
  var fys=raFys(t).slice(0,3);
  var years=fys.map(function(fy){
    var m=raFigMap(t,fy), figs={}, src={};
    RA_FIELDS.forEach(function(f){ figs[f[0]]=raIsNum(m[f[0]].val)?Number(m[f[0]].val):null; src[f[0]]=m[f[0]].src; });
    return {label:String(fy), figs:figs, src:src};
  });
  return {title:raCoName(t)+' ('+t+')', years:years};
}
function raStmtCustomForm(){
  var h='<div class="grid g3">';
  h+=fieldRow('Company name', textInput('ra-c-name','','e.g. Acme Corp'));
  h+=fieldRow('CIK (optional)', textInput('ra-c-cik','','e.g. 0001234567'));
  var nums=[['revenue','Revenue'],['net_income','Net income'],['gross_profit','Gross profit'],
    ['op_income','Operating income'],['assets','Total assets'],['cur_assets','Current assets'],
    ['cur_liab','Current liabilities'],['total_liab','Total liabilities'],['lt_debt','Long-term debt'],
    ['retained','Retained earnings'],['op_cash','Operating cash flow'],['shares_dil','Diluted shares'],
    ['interest_exp','Interest expense (optional)']];
  nums.forEach(function(n){ h+=fieldRow(n[1], numInput('ra-c-'+n[0],''), 'Dollars, e.g. 150000000'); });
  h+='</div><button class="btn" id="ra-stmt-go">Analyze these figures</button> '
    +'<span class="hint">One year of figures \u2014 ratios work, multi-year trends will show \u201cdata unavailable\u201d.</span>';
  return h;
}
function raStmtCustomData(){
  var figs={}, src={};
  RA_FIELDS.forEach(function(f){
    var el=document.getElementById('ra-c-'+f[0]);
    var v=el?el.value:'';
    figs[f[0]]=raIsNum(v)?Number(v):null; src[f[0]]='your entry';
  });
  var nmEl=document.getElementById('ra-c-name');
  var nm=nmEl&&nmEl.value?nmEl.value:'Custom company';
  return {title:nm+' (manual entry)', years:[{label:'your entry', figs:figs, src:src}]};
}
function raStmtSrcNote(years){
  var bits=years.map(function(y){
    var filing=RA_FIELDS.filter(function(f){ return y.src[f[0]]==='uploaded filing'; }).map(function(f){ return f[1]; });
    var note=filing.length ? 'uploaded filing ('+filing.join(', ')+') + built-in SEC data' : 'built-in SEC data';
    return y.label+': '+note;
  });
  return '<p class="small">Figure sources \u2014 '+Util.esc(bits.join(' \u00b7 '))+'.</p>';
}
function raStmtHTML(data){
  var years=data.years;
  var y0=years[0].figs, yn=years[years.length-1].figs;
  var gaps=years.length-1;
  function f(F,k){ return raIsNum(F[k])?Number(F[k]):null; }
  var rev=f(y0,'revenue'), ni=f(y0,'net_income'), gp=f(y0,'gross_profit'), op=f(y0,'op_income');
  var a=f(y0,'assets'), ca=f(y0,'cur_assets'), cl=f(y0,'cur_liab'), tl=f(y0,'total_liab');
  var ie=f(y0,'interest_exp'), oc=f(y0,'op_cash');
  var eq=(a!=null&&tl!=null)?a-tl:null;
  var revN=f(yn,'revenue'), niN=f(yn,'net_income'), tlN=f(yn,'total_liab'), aN=f(yn,'assets');
  var eqN=(aN!=null&&tlN!=null)?aN-tlN:null;
  var caN=f(yn,'cur_assets'), clN=f(yn,'cur_liab');
  var gm=(gp!=null&&rev)?gp/rev:null, om=(op!=null&&rev)?op/rev:null, nm=(ni!=null&&rev)?ni/rev:null;
  var roe=(ni!=null&&eq)?ni/eq:null, roa=(ni!=null&&a)?ni/a:null;
  var cr=(ca!=null&&cl)?ca/cl:null, de=(tl!=null&&eq)?tl/eq:null;
  var ic=(op!=null&&ie)?op/ie:null, ato=(rev!=null&&a)?rev/a:null;
  var revCagr=gaps?raCagr(rev,revN,gaps):null, niCagr=gaps?raCagr(ni,niN,gaps):null;
  var cc=(oc!=null&&ni)?oc/ni:null;
  var nmN=(f(yn,'net_income')!=null&&revN)?f(yn,'net_income')/revN:null;
  var deN=(tlN!=null&&eqN)?tlN/eqN:null, crN=(caN!=null&&clN)?caN/clN:null;
  function read(val, bands){ // bands: [[threshold, text], ...] first match wins (val>=threshold)
    if(val==null) return 'data unavailable';
    for(var i=0;i<bands.length;i++) if(val>=bands[i][0]) return bands[i][1];
    return bands[bands.length-1][1];
  }
  var rows=[
    [ex('grossmargin','Gross margin'), gm==null?'data unavailable':Util.pct(gm),
      read(gm,[[0.5,'Wide \u2014 the core product is very profitable.'],[0.3,'Healthy.'],[0.15,'Thin \u2014 typical of low-margin industries.'],[-99,'Very thin or negative.']])],
    [ex('opmargin','Operating margin'), om==null?'data unavailable':Util.pct(om),
      read(om,[[0.2,'Strong operating efficiency.'],[0.1,'Decent.'],[0,'Thin.'],[-99,'Losing money on operations.']])],
    [ex('ra-netmargin','Net margin'), nm==null?'data unavailable':Util.pct(nm),
      read(nm,[[0.2,'Excellent bottom-line efficiency.'],[0.1,'Solid.'],[0,'Thin.'],[-99,'Losing money overall.']])],
    [ex('roe','Return on equity (ROE)'), roe==null?'data unavailable':Util.pct(roe),
      read(roe,[[0.15,'Strong return on owners\u2019 money.'],[0,'Positive.'],[-99,'Negative \u2014 losing owners\u2019 money.']])],
    [ex('roa','Return on assets (ROA)'), roa==null?'data unavailable':Util.pct(roa),
      read(roa,[[0.1,'Efficient use of assets.'],[0.03,'Modest.'],[-99,'Weak.']])],
    [ex('current','Current ratio'), cr==null?'data unavailable':cr.toFixed(2)+'\u00d7',
      read(cr,[[1.5,'Comfortable short-term cushion.'],[1,'Adequate.'],[-99,'Below 1 \u2014 short-term strain.']])],
    [ex('de','Debt-to-equity'), de==null?'data unavailable':de.toFixed(2)+'\u00d7',
      read(de,[[2,'Heavily debt-funded.'],[1,'Leveraged.'],[-99,'Conservative funding.']])],
    [ex('intcov','Interest coverage'), ic==null?'data unavailable':ic.toFixed(1)+'\u00d7',
      ic==null?'data unavailable (interest expense not reported)':read(ic,[[5,'Comfortable.'],[1.5,'Covered, with little slack.'],[-99,'Strained \u2014 interest is a burden.']])],
    [ex('ra-assetturn','Asset turnover'), ato==null?'data unavailable':ato.toFixed(2)+'\u00d7',
      read(ato,[[1,'Assets working hard.'],[0.5,'Moderate.'],[-99,'Asset-heavy business.']])],
    [ex('revenue','Revenue')+' '+ex('ra-cagr','CAGR')+' ('+gaps+'-yr)', revCagr==null?'data unavailable':Util.pct(revCagr),
      read(revCagr,[[0.1,'Fast growth.'],[0.03,'Steady growth.'],[0,'Roughly flat.'],[-99,'Shrinking.']])],
    [ex('netincome','Net income')+' '+ex('ra-cagr','CAGR')+' ('+gaps+'-yr)', niCagr==null?'data unavailable':Util.pct(niCagr),
      read(niCagr,[[0.1,'Fast profit growth.'],[0.03,'Steady profit growth.'],[0,'Roughly flat.'],[-99,'Profits shrinking.']])],
    [ex('ra-cashconv','Cash conversion')+' (op. cash \u00f7 net income)', cc==null?'data unavailable':cc.toFixed(2)+'\u00d7',
      cc==null?'data unavailable':read(cc,[[1.2,'Profit converts to cash well.'],[0.8,'Roughly in line with profit.'],[-99,'Profit isn\u2019t turning into cash \u2014 watch this.']])]
  ];
  var h='<h3>'+Util.esc(data.title)+'</h3>'+raStmtSrcNote(years);
  h+='<table class="tbl"><tr><th>Ratio ('+Util.esc(years[0].label)+')</th><th class="num">Value</th><th>Plain-English read'+raRuleTag()+'</th></tr>';
  rows.forEach(function(r){ h+='<tr><td>'+r[0]+'</td><td class="num">'+r[1]+'</td><td class="small">'+Util.esc(r[2])+'</td></tr>'; });
  h+='</table>';
  /* charts */
  var labels=years.map(function(y){ return y.label; }).reverse();
  function series(k){ return years.map(function(y){ return raIsNum(y.figs[k])?Number(y.figs[k]):0; }).reverse(); }
  h+='<div class="grid g3">'
    +'<div><h3>'+ex('revenue','Revenue')+'</h3>'+Charts.vbar(labels, series('revenue'), 360, 190)+'</div>'
    +'<div><h3>'+ex('netincome','Net income')+'</h3>'+Charts.vbar(labels, series('net_income'), 360, 190)+'</div>'
    +'<div><h3>'+ex('fcf','Operating cash flow')+'</h3>'+Charts.vbar(labels, series('op_cash'), 360, 190)+'</div>'
    +'</div>';
  /* rule-based commentary */
  var c=[];
  if(nm!=null&&nmN!=null){
    c.push(nm>nmN?'Margins expanding: net margin rose from '+Util.pct(nmN)+' to '+Util.pct(nm)+'.'
                 :(nm<nmN?'Margins contracting: net margin fell from '+Util.pct(nmN)+' to '+Util.pct(nm)+' \u2014 costs are outpacing sales.'
                 :'Net margin flat at '+Util.pct(nm)+'.'));
  } else c.push('Margin trend: data unavailable.');
  if(de!=null&&deN!=null){
    c.push(de>deN?'Leverage rising: debt-to-equity moved from '+deN.toFixed(2)+'\u00d7 to '+de.toFixed(2)+'\u00d7.'
                 :(de<deN?'Leverage falling: debt-to-equity moved from '+deN.toFixed(2)+'\u00d7 to '+de.toFixed(2)+'\u00d7 \u2014 the balance sheet is getting safer.'
                 :'Leverage steady at '+de.toFixed(2)+'\u00d7.'));
  } else c.push('Leverage trend: data unavailable.');
  if(cc!=null) c.push(cc>=1?'Cash conversion is healthy: operating cash flow ('+Util.money(oc)+') exceeds net income ('+Util.money(ni)+').'
                           :'Cash conversion is weak: operating cash flow ('+Util.money(oc)+') trails net income ('+Util.money(ni)+') \u2014 profit isn\u2019t fully turning into cash.');
  else c.push('Cash conversion: data unavailable.');
  if(revCagr!=null&&niCagr!=null){
    if(revCagr>0&&niCagr<0) c.push('Sales are growing but profit is shrinking \u2014 costs are rising faster than revenue.');
    else if(revCagr>0&&niCagr>revCagr) c.push('Profit is growing faster than sales \u2014 the business is getting more efficient as it scales.');
    else if(revCagr<0&&niCagr>0) c.push('Sales shrinking but profit growing \u2014 cost cuts are doing the work, not growth.');
  }
  if(cr!=null&&crN!=null&&cr<crN) c.push('Short-term liquidity tightened: current ratio slipped from '+crN.toFixed(2)+'\u00d7 to '+cr.toFixed(2)+'\u00d7.');
  h+='<h3>What the numbers suggest'+raRuleTag()+'</h3><ul>';
  c.forEach(function(x){ h+='<li>'+Util.esc(x)+'</li>'; });
  h+='</ul><p class="hint">Rule-based reads from the figures above \u2014 they describe the past, not the future.</p>';
  return h;
}
function raStmtRender(param){
  if(!STOCK_TICKERS.length) return '<div class="panel">'+emptyBox('No company data is available.')+'</div>';
  var t=param?String(param).toUpperCase().trim():STOCK_TICKERS[0];
  if(!t) t=STOCK_TICKERS[0];
  var hasData=raFys(t).length>0;
  var h='<div class="panel"><h2>Financial Statement Analyzer</h2>'+DATA_BADGE;
  h+='<p class="small">Ratios, three-year trends, and plain-English reads \\u2014 computed from reported figures only.'+raRuleTag()+'</p>';
  h+=fieldRow('Company', '<div style="display:flex;gap:8px">'+tickerInput('ra-stmt-sel', t)+'<button class="btn sm" id="ra-stmt-load">Load</button></div>',
    'Enter any ticker \\u2014 if we have its SEC data, it loads below.'+tickerHint());
  if(!hasData) h+='<div class="alert warn"><b>No bundled SEC data for '+Util.esc(t)+'.</b> Enter figures manually below.</div>';
  h+='<div id="ra-stmt-custom" style="'+(hasData?'display:none;':'')+'margin-bottom:14px">'+raStmtCustomForm()+'</div>';
  h+='<div id="ra-stmt-out"></div></div>';
  return h;
}
function raStmtAfter(){
  var sel=document.getElementById('ra-stmt-sel');
  var customBox=document.getElementById('ra-stmt-custom');
  var out=document.getElementById('ra-stmt-out');
  if(!sel||!out) return;
  function showFor(t){
    if(raFys(t).length>0){ if(customBox) customBox.style.display='none'; out.innerHTML=raStmtHTML(raStmtTickerData(t)); }
    else{ if(customBox) customBox.style.display=''; out.innerHTML=''; }
  }
  function reload(){ var t=tickerVal('ra-stmt-sel'); if(t) Router.go('#/statements/'+encodeURIComponent(t)); }
  sel.addEventListener('change', reload);
  var load=document.getElementById('ra-stmt-load');
  if(load) load.addEventListener('click', reload);
  var go=document.getElementById('ra-stmt-go');
  if(go) go.addEventListener('click', function(){ out.innerHTML=raStmtHTML(raStmtCustomData()); });
  showFor(tickerVal('ra-stmt-sel')||STOCK_TICKERS[0]);
}
raRoute('statements', raStmtRender, raStmtAfter);

/* ================= VALUATION: Valuation Workbench ================= */
function raValPrefill(t){
  var fys=raFys(t), fy0=fys[0], fy2=fys[2];
  var price=lastClose(t);
  var ni=raIsNum(raFig(t,'net_income',fy0).val)?Number(raFig(t,'net_income',fy0).val):null;
  var sh=raIsNum(raFig(t,'shares_dil',fy0).val)?Number(raFig(t,'shares_dil',fy0).val):null;
  var oc=raIsNum(raFig(t,'op_cash',fy0).val)?Number(raFig(t,'op_cash',fy0).val):null;
  var r0=raIsNum(raFig(t,'revenue',fy0).val)?Number(raFig(t,'revenue',fy0).val):null;
  var r2=fy2&&raIsNum(raFig(t,'revenue',fy2).val)?Number(raFig(t,'revenue',fy2).val):null;
  var cagr=raCagr(r0,r2,2);
  var g=cagr==null?8:Math.round(Util.clamp(cagr*100,0,25)*10)/10;
  var eps=(ni!=null&&sh)?ni/sh:null;
  var assets=raIsNum(raFig(t,'assets',fy0).val)?Number(raFig(t,'assets',fy0).val):null;
  var liab=raIsNum(raFig(t,'total_liab',fy0).val)?Number(raFig(t,'total_liab',fy0).val):null;
  var bvps=(assets!=null&&liab!=null&&sh)?(assets-liab)/sh:null;
  return {price:price, eps:eps, fcf:oc, shares:sh, g:g, bvps:bvps};
}
function raValRender(){
  if(!STOCK_TICKERS.length) return '<div class="panel">'+emptyBox('No company data is available.')+'</div>';
  var t=STOCK_TICKERS[0], p=raValPrefill(t);
  var h='<div class="panel"><h2>'+ex('dcf','Valuation Workbench')+'</h2>'+DATA_BADGE;
  h+='<p class="small">Estimate what a company might be worth with a simple discounted cash flow and a P/E cross-check. Every input is editable \u2014 change an assumption and watch the answer move.'+raRuleTag()+'</p>';
  h+='<div class="grid g2"><div>'
    +fieldRow('Company (prefills price, EPS, book value, cash flow, shares)', '<div style="display:flex;gap:8px">'+tickerInput('ra-v-ticker', t)+'<button class="btn sm" id="ra-v-ticker-load">Load</button></div>', 'Price = latest close \\u00b7 EPS = net income \\u00f7 diluted shares \\u00b7 book = (assets \\u2212 liabilities) \\u00f7 diluted shares \\u00b7 cash = operating cash flow (used as a free-cash-flow proxy). '+tickerHint())
    +fieldRow('Current share price ($)', numInput('ra-v-price', p.price==null?'':p.price.toFixed(2),'0.01'))
    +fieldRow('EPS \u2014 earnings per share ($)', numInput('ra-v-eps', p.eps==null?'':p.eps.toFixed(2),'0.01'))
    +fieldRow('Book value per share ($)', numInput('ra-v-bvps', p.bvps==null?'':p.bvps.toFixed(2),'0.01'), 'Prefilled as (total assets \u2212 total liabilities) \u00f7 diluted shares.')
    +fieldRow(ex('ra-fcfstart','Starting yearly cash flow')+' ($)', numInput('ra-v-fcf', p.fcf==null?'':Math.round(p.fcf), '1'), 'Prefilled with operating cash flow \u2014 a proxy, since capital spending isn\u2019t in the dataset.')
    +fieldRow('Diluted shares outstanding', numInput('ra-v-shares', p.shares==null?'':Math.round(p.shares),'1'))
    +'</div><div>'
    +fieldRow('Cash-flow growth, years 1\u20135 (% per year)', numInput('ra-v-g', p.g,'0.1'), 'Prefilled from the 3-year revenue CAGR when available.')
    +fieldRow(ex('wacc','Discount rate')+' (% per year)', numInput('ra-v-r', 10,'0.1'), 'Higher = future cash counts for less. 8\u201312% is a common range.')
    +fieldRow('Terminal growth after year 5 (% per year)', numInput('ra-v-tg', 3,'0.1'), 'Must be below the discount rate \u2014 often 2\u20134%, near long-run economic growth.')
    +fieldRow('P/E multiple for the cross-check', numInput('ra-v-pe', 20,'0.5'), 'Fair value = EPS \u00d7 this multiple.')
    +fieldRow('P/B multiple for the cross-check', numInput('ra-v-pbm', 1.5,'0.1'), 'Fair value = book value/share \u00d7 this multiple. Banks are usually judged on P/B \u2014 1\u20132\u00d7 book is a common range.')
    +fieldRow(ex('ra-mos','Margin of safety')+': <span id="ra-v-mosval">25%</span>',
      '<input type="range" id="ra-v-mos" min="0" max="60" step="1" value="25" style="width:100%">',
      'Only pay up to fair value \u00d7 (1 \u2212 margin of safety).')
    +'<button class="btn" id="ra-v-go">Calculate</button>'
    +'</div></div></div>';
  h+='<div id="ra-v-out"></div>';
  h+='<div class="alert warn"><b>Honesty note:</b> Small changes in growth/discount assumptions swing DCF hugely \u2014 this is a thinking tool, not a price target.</div>';
  return h;
}
function raValCalc(){
  function num(id){ var el=document.getElementById(id); var v=el?parseFloat(el.value):NaN; return isNaN(v)?null:v; }
  var price=num('ra-v-price'), eps=num('ra-v-eps'), fcf0=num('ra-v-fcf'), shares=num('ra-v-shares');
  var bvps=num('ra-v-bvps'), pbm=num('ra-v-pbm');
  var g=num('ra-v-g'), r=num('ra-v-r'), tg=num('ra-v-tg'), pe=num('ra-v-pe');
  var mosEl=document.getElementById('ra-v-mos'), mos=mosEl?parseFloat(mosEl.value)/100:0.25;
  var mosVal=document.getElementById('ra-v-mosval'); if(mosVal) mosVal.textContent=Math.round(mos*100)+'%';
  var out=document.getElementById('ra-v-out'); if(!out) return;
  var h='';
  var ok=fcf0!=null&&shares&&g!=null&&r!=null&&tg!=null;
  if(!ok){ out.innerHTML='<div class="panel">'+emptyBox('Fill in cash flow, shares, growth, discount rate, and terminal growth to calculate.')+'</div>'; return; }
  g/=100; r/=100; tg/=100;
  /* ---- DCF ---- */
  h+='<div class="panel"><h2>'+ex('dcf','5-year DCF')+raRuleTag()+'</h2>';
  h+='<p class="mono small">FCF<sub>t</sub> = FCF<sub>0</sub> \u00d7 (1+g)<sup>t</sup> \u00b7 PV<sub>t</sub> = FCF<sub>t</sub> \u00f7 (1+r)<sup>t</sup> \u00b7 TV = FCF<sub>5</sub>\u00d7(1+g<sub>t</sub>) \u00f7 (r\u2212g<sub>t</sub>)</p>';
  if(fcf0<=0) h+='<div class="alert warn">Starting cash flow is not positive \u2014 a growth DCF on negative cash flow is not meaningful. The table below is arithmetic only.</div>';
  var sumPV=0, rows='';
  for(var yr=1;yr<=5;yr++){
    var fcf=fcf0*Math.pow(1+g,yr), df=1/Math.pow(1+r,yr), pv=fcf*df;
    sumPV+=pv;
    rows+='<tr><td class="num">'+yr+'</td><td class="num">'+Util.money(fcf)+'</td><td class="num">'+df.toFixed(4)+'</td><td class="num">'+Util.money(pv)+'</td></tr>';
  }
  var tv=null, pvTv=null;
  if(r>tg){ tv=fcf0*Math.pow(1+g,5)*(1+tg)/(r-tg); pvTv=tv/Math.pow(1+r,5); }
  var ev=sumPV+(pvTv||0), fair=(shares&&shares>0)?ev/shares:null;
  h+='<table class="tbl"><tr><th class="num">Year</th><th class="num">Projected cash flow</th><th class="num">Discount factor</th><th class="num">Present value</th></tr>'+rows;
  if(tv!=null) h+='<tr><td class="num">TV</td><td class="num">'+ex('ra-tv','Terminal value')+': '+Util.money(tv)+'</td><td class="num">'+(1/Math.pow(1+r,5)).toFixed(4)+'</td><td class="num">'+Util.money(pvTv)+'</td></tr>';
  else h+='<tr><td colspan="4">'+emptyBox('Terminal value: data unavailable \u2014 the discount rate must exceed terminal growth.')+'</td></tr>';
  h+='<tr><td colspan="3"><b>Total enterprise value (simplified)</b></td><td class="num"><b>'+Util.money(ev)+'</b></td></tr></table>';
  h+='<p class="hint">Simplified: treats operating cash flow as the cash to discount, ignores debt/cash adjustments, and values equity directly. Fair value per share = '+Util.money(ev)+' \u00f7 '+Util.num(shares,0)+' shares.</p>';
  /* ---- P/E cross-check ---- */
  var peFair=(eps!=null&&pe!=null)?eps*pe:null;
  h+='<h2>P/E cross-check</h2>';
  h+='<p>Fair value = EPS \u00d7 multiple = '+(eps==null?'data unavailable':'$'+eps.toFixed(2))+' \u00d7 '+(pe==null?'?':pe)+' = <b>'+(peFair==null?'data unavailable':'$'+peFair.toFixed(2))+'</b></p>';
  /* ---- P/B cross-check ---- */
  var curPB=(price&&bvps&&bvps>0)?price/bvps:null;
  var pbFair=(bvps!=null&&bvps>0&&pbm!=null)?bvps*pbm:null;
  h+='<h2>P/B cross-check</h2>';
  h+='<p>Book value per share = (assets \u2212 liabilities) \u00f7 shares = '+(bvps==null?'data unavailable':'$'+bvps.toFixed(2))+'</p>';
  h+='<p>Current P/B = price \u00f7 book value = '+(curPB==null?'data unavailable':curPB.toFixed(2)+'\u00d7')+'</p>';
  if(pbFair!=null) h+='<p>Fair value = BVPS \u00d7 target multiple = $'+bvps.toFixed(2)+' \u00d7 '+pbm+' = <b>$'+pbFair.toFixed(2)+'</b></p>';
  else h+='<p class="small hint">Enter a target P/B multiple above to get a P/B fair value.</p>';
  /* ---- verdict ---- */
  h+='<h2>Verdict'+raRuleTag()+'</h2>';
  var dcfOK=fair!=null&&fair>0&&fcf0>0;
  if(dcfOK&&price!=null&&price>0){
    var upside=fair/price-1, target=fair*(1-mos);
    h+='<div class="grid g3">'
      +'<div class="kpi"><div class="k">DCF fair value / share</div><div class="v">$'+fair.toFixed(2)+'</div></div>'
      +'<div class="kpi"><div class="k">Current price</div><div class="v">$'+price.toFixed(2)+'</div></div>'
      +'<div class="kpi"><div class="k">Implied upside / downside</div><div class="v" style="color:'+(upside>=0?'#3fb950':'#f85149')+'">'+(upside>=0?'+':'')+Util.pct(upside)+'</div></div>'
      +'</div>';
    h+='<p>'+(upside>=0
      ?'The DCF estimate sits <b>'+Util.pct(upside)+'</b> <b>above</b> the current price \u2014 on these assumptions the stock looks undervalued.'
      :'The DCF estimate sits <b>'+Util.pct(Math.abs(upside))+'</b> <b>below</b> the current price \u2014 on these assumptions the stock looks overvalued.')+'</p>';
    h+='<p>With your '+Math.round(mos*100)+'% '+ex('ra-mos','margin of safety')+', the most you would pay is <b>$'+target.toFixed(2)+'</b> per share.</p>';
    if(peFair!=null&&fair>0) h+='<p class="small">P/E cross-check says $'+peFair.toFixed(2)+' \u2014 '+(Math.abs(peFair-fair)/Math.abs(fair)<0.25?'roughly in line with the DCF.':'quite different from the DCF, which tells you the two methods disagree on this one.')+'</p>';
  } else if(fair!=null&&fair<=0){
    h+=emptyBox('No verdict from the DCF \u2014 it produced a negative fair value, which is not a price. This happens when starting cash flow is negative (banks like SOFI report lending as an operating cash outflow, so operating cash flow is the wrong proxy). Judge this one on the P/E and P/B cross-checks above.');
  } else h+=emptyBox('Verdict: data unavailable \u2014 need a valid fair value and current price.');
  h+='</div>';
  out.innerHTML=h;
}
function raValAfter(){
  var go=document.getElementById('ra-v-go');
  if(go) go.addEventListener('click', raValCalc);
  var mos=document.getElementById('ra-v-mos');
  if(mos) mos.addEventListener('input', raValCalc);
  function raValReflow(){
    var p=raValPrefill(tickerVal('ra-v-ticker'));
    function set(id,v,dec){ var el=document.getElementById(id); if(el) el.value=(v==null?'':Number(v).toFixed(dec==null?2:dec)); }
    set('ra-v-price',p.price,2); set('ra-v-eps',p.eps,2); set('ra-v-bvps',p.bvps,2);
    set('ra-v-fcf',p.fcf==null?null:Math.round(p.fcf),0);
    set('ra-v-shares',p.shares==null?null:Math.round(p.shares),0);
    set('ra-v-g',p.g,1);
    raValCalc();
  }
  var tick=document.getElementById('ra-v-ticker');
  if(tick) tick.addEventListener('change', raValReflow);
  var vload=document.getElementById('ra-v-ticker-load');
  if(vload) vload.addEventListener('click', raValReflow);
  raValCalc();
}
raRoute('valuation', raValRender, raValAfter);

/* ================= BONDS: Bonds & Rates ================= */
function raBondPrice(face, couponPct, years, ytmPct, freq){
  var c=face*(couponPct/100)/freq, y=(ytmPct/100)/freq, n=Math.max(1,Math.round(years*freq));
  var pv=0;
  for(var i=1;i<=n;i++) pv+=c/Math.pow(1+y,i);
  pv+=face/Math.pow(1+y,n);
  return pv;
}
function raBondMacaulay(face, couponPct, years, ytmPct, freq){
  var c=face*(couponPct/100)/freq, y=(ytmPct/100)/freq, n=Math.max(1,Math.round(years*freq));
  var price=raBondPrice(face,couponPct,years,ytmPct,freq), wsum=0;
  for(var i=1;i<=n;i++){ var cf=(i===n?c+face:c); wsum+=(i/freq)*cf/Math.pow(1+y,i); }
  return price>0?wsum/price:null;
}
function raBondYTM(face, couponPct, years, price, freq){
  if(!(price>0)) return null;
  var lo=-0.5, hi=10, mid=0;
  for(var i=0;i<120;i++){
    mid=(lo+hi)/2;
    var p=raBondPrice(face,couponPct,years,mid*100,freq);
    if(p>price) lo=mid; else hi=mid;
  }
  return mid*100;
}
function raDCF(fcf0,g,r,tg,shares){
  if(!(fcf0>0)||!(shares>0)||g==null||r==null||tg==null) return null;
  var sumPV=0;
  for(var yr=1;yr<=5;yr++) sumPV+=fcf0*Math.pow(1+g,yr)/Math.pow(1+r,yr);
  var tv=(r>tg)?fcf0*Math.pow(1+g,5)*(1+tg)/(r-tg):null;
  var ev=sumPV+(tv?tv/Math.pow(1+r,5):0);
  return ev/shares;
}
function raFreqOptions(id, sel){
  return '<select class="in" id="'+id+'">'
    +'<option value="1"'+(sel==1?' selected':'')+'>Annual (1/yr)</option>'
    +'<option value="2"'+(sel==2?' selected':'')+'>Semi-annual (2/yr)</option>'
    +'<option value="4"'+(sel==4?' selected':'')+'>Quarterly (4/yr)</option></select>';
}
function raBondsRender(){
  var h='<div class="panel"><h2>'+ex('ra-bprice','Bonds & Rates')+'</h2>'+DATA_BADGE;
  h+='<p class="small">How bonds work, what they are worth, and what happens when interest rates move.</p></div>';
  /* (a) education */
  h+='<div class="panel"><h2>Bond basics, in plain English</h2>';
  h+='<details class="exp"><summary>What is a bond?</summary><div class="body"><p>A bond is an IOU you buy. A company or government borrows money from you, promises to pay it back on a fixed date (maturity), and pays you interest along the way. Unlike a stock, you do not own part of the business \u2014 you are a lender.</p></div></details>';
  h+='<details class="exp"><summary>'+ex('coupon','Coupon')+' \u2014 the bond\u2019s paycheck</summary><div class="body"><p>The coupon is the fixed interest rate printed on the bond, paid on its face value. A $1,000 bond with a 5% coupon pays $50 a year (often $25 every six months), no matter what happens to market interest rates. The payment never changes \u2014 only the bond\u2019s market price does.</p></div></details>';
  h+='<details class="exp"><summary>'+ex('ytm','Yield')+' \u2014 what you actually earn</summary><div class="body"><p>Yield to maturity is your total yearly return if you hold the bond to the end and get paid in full. If you buy a $1,000 bond for $900, your yield is higher than its coupon \u2014 you collect the coupons <i>plus</i> a $100 gain at maturity. Yield is how bonds are compared.</p></div></details>';
  h+='<details class="exp"><summary>Price vs. interest rates \u2014 the seesaw</summary><div class="body"><p>Bond prices and market interest rates move in opposite directions. When new bonds pay 6%, nobody wants your old 4% bond at full price \u2014 its price falls until its yield matches 6%. When rates fall, your old higher-coupon bond becomes more valuable and its price rises. Longer maturities swing harder.</p></div></details>';
  h+='</div>';
  /* (b)+(d) price calculator + duration */
  h+='<div class="panel"><h2>'+ex('ra-bprice','Bond price calculator')+'</h2>';
  h+='<div class="grid g3">'
    +fieldRow('Face value ($)', numInput('ra-b-face',1000,'1'))
    +fieldRow(ex('coupon','Coupon rate')+' (% per year)', numInput('ra-b-coupon',5,'0.1'))
    +fieldRow('Years to maturity', numInput('ra-b-years',10,'0.5'))
    +fieldRow(ex('ytm','Yield to maturity (YTM)')+' (% per year)', numInput('ra-b-ytm',4,'0.1'))
    +fieldRow('Payments per year', raFreqOptions('ra-b-freq',2))
    +'<div style="align-self:end"><button class="btn" id="ra-b-go">Price this bond</button></div>'
    +'</div><div id="ra-b-out" style="margin-top:10px"></div></div>';
  /* (c) YTM solver */
  h+='<div class="panel"><h2>'+ex('ytm','Yield from price')+' \u2014 solve it backwards</h2>';
  h+='<p class="small">You see a bond trading at some price. What yield does that imply? Solved by bisection: the calculator tries yields until the price formula matches.</p>';
  h+='<div class="grid g3">'
    +fieldRow('Face value ($)', numInput('ra-y-face',1000,'1'))
    +fieldRow(ex('coupon','Coupon rate')+' (% per year)', numInput('ra-y-coupon',5,'0.1'))
    +fieldRow('Years to maturity', numInput('ra-y-years',10,'0.5'))
    +fieldRow('Market price ($)', numInput('ra-y-price',950,'1'))
    +fieldRow('Payments per year', raFreqOptions('ra-y-freq',2))
    +'<div style="align-self:end"><button class="btn" id="ra-y-go">Solve for YTM</button></div>'
    +'</div><div id="ra-y-out" style="margin-top:10px"></div></div>';
  /* (e) rate scenario */
  h+='<div class="panel"><h2>'+ex('ra-ratescen','Rate scenario tool')+'</h2>';
  var rsP=raValPrefill(STOCK_TICKERS[0]||'');
  h+='<p class="small">Pick a real stock, type in today\u2019s 10-year Treasury yield, then shock rates with the slider \u2014 see what a hike or cut does to its DCF value, to a bond, and to a company\u2019s borrowing cost. Uses the bond inputs above.</p>';
  h+=fieldRow('Rate change (percentage points): <span id="ra-r-dval">+0.0%</span>',
    '<input type="range" id="ra-r-delta" min="-3" max="3" step="0.25" value="0" style="width:100%">',
    'Drag to \u00b13 points. A hike (+) raises the discount rate; a cut (\u2212) lowers it.');
  h+='<div class="grid g2"><div>'
    +fieldRow('Stock (prefills cash flow, growth, shares)', STOCK_TICKERS.length?tickerInput('ra-r-stock', STOCK_TICKERS[0]):emptyBox('No company data.'), tickerHint())
    +fieldRow('Yearly cash flow ($)', numInput('ra-r-cf', rsP.fcf==null?'':Math.round(rsP.fcf),'1'), 'Prefilled with operating cash flow.')
    +fieldRow('Cash-flow growth (%/yr)', numInput('ra-r-g', rsP.g,'0.1'), 'Prefilled from the 3-year revenue CAGR.')
    +fieldRow('Diluted shares', numInput('ra-r-shares', rsP.shares==null?'':Math.round(rsP.shares),'1'))
    +'</div><div>'
    +fieldRow('10-year Treasury yield (%/yr)', numInput('ra-r-y10', 4,'0.1'), 'Type in today\u2019s 10-year yield \u2014 the anchor for the discount rate.')
    +fieldRow(ex('erp','Equity risk premium')+' (%/yr)', numInput('ra-r-erp', 5,'0.1'), 'Extra return investors demand for holding stocks over safe bonds. 4\u20136% is typical.')
    +fieldRow('Terminal growth after year 5 (%/yr)', numInput('ra-r-tg', 3,'0.1'))
    +fieldRow('Real company for borrowing cost', STOCK_TICKERS.length?tickerInput('ra-r-ticker', STOCK_TICKERS[0]):emptyBox('No company data.'))
    +'</div></div>';
  h+='<div id="ra-r-out" style="margin-top:10px"></div>';
  h+='<p class="hint">Discount rate = 10-year yield + equity risk premium. Company panel: illustrative only \u2014 it assumes <i>all</i> of the company\u2019s liabilities reprice at once, which never happens in practice (most debt is fixed-rate). Stock panel: a 5-year DCF, meaningless when starting cash flow is not positive (banks).</p></div>';
  /* (f) Fed explainer */
  h+='<div class="panel"><h2>'+ex('ra-fed','What the Fed does, in plain English')+'</h2>';
  h+='<p>The Federal Reserve sets a benchmark short-term interest rate. Banks, bond markets, and lenders take their cue from it, so the move ripples outward:</p><ul>'
    +'<li><b>Rate hike:</b> borrowing gets pricier \u2014 mortgages, car loans, and company debt all cost more. Existing bond prices fall. Stocks usually wobble because future profits are discounted at higher rates, lowering valuations. Savers earn more on cash.</li>'
    +'<li><b>Rate cut:</b> borrowing gets cheaper \u2014 spending and investment pick up. Existing bond prices rise. Stocks tend to get a lift as discount rates fall. Savers earn less.</li></ul>'
    +'<p class="small">The Fed usually hikes to cool inflation and cuts to support a weak economy. Markets move on <i>expectations</i> of the next decision as much as the decision itself.</p></div>';
  return h;
}
function raBondsAfter(){
  function num(id){ var el=document.getElementById(id); var v=el?parseFloat(el.value):NaN; return isNaN(v)?null:v; }
  /* (b) price */
  var bgo=document.getElementById('ra-b-go');
  if(bgo) bgo.addEventListener('click', function(){
    var out=document.getElementById('ra-b-out');
    var face=num('ra-b-face'), cp=num('ra-b-coupon'), yrs=num('ra-b-years'), ytm=num('ra-b-ytm');
    var freq=parseInt((document.getElementById('ra-b-freq')||{value:'2'}).value,10)||2;
    if(face==null||cp==null||yrs==null||ytm==null||yrs<=0){ out.innerHTML=emptyBox('Fill in all bond inputs.'); return; }
    var price=raBondPrice(face,cp,yrs,ytm,freq);
    var mac=raBondMacaulay(face,cp,yrs,ytm,freq);
    var mod=mac!=null?mac/(1+(ytm/100)/freq):null;
    var vs=price>face*1.001?'premium \u2014 you pay extra because the coupon beats the market yield.'
      :(price<face*0.999?'discount \u2014 the coupon lags the market yield, so you buy cheap.'
      :'about par \u2014 coupon and yield roughly match.');
    out.innerHTML='<div class="grid g3">'
      +'<div class="kpi"><div class="k">'+ex('ra-bprice','Bond price')+'</div><div class="v">$'+price.toFixed(2)+'</div><div class="d">'+Util.esc(vs)+'</div></div>'
      +'<div class="kpi"><div class="k">'+ex('ra-macaulay','Macaulay duration')+'</div><div class="v">'+(mac==null?'data unavailable':mac.toFixed(2)+' yrs')+'</div><div class="d">modified: '+(mod==null?'n/a':mod.toFixed(2))+'</div></div>'
      +'<div class="kpi"><div class="k">Rate intuition</div><div class="v">'+(mod==null?'n/a':'\u2248 \u2212'+mod.toFixed(1)+'%')+'</div><div class="d">price move if yields rise 1 point</div></div>'
      +'</div>'
      +'<details class="exp"><summary>Formula used</summary><div class="body"><p class="mono small">P = C\u00d7[1\u2212(1+y)<sup>\u2212n</sup>]/y + F/(1+y)<sup>n</sup></p>'
      +'<p class="small">C = coupon per period ($'+(face*cp/100/freq).toFixed(2)+'), y = '+(ytm/freq).toFixed(3)+'% per period, n = '+Math.round(yrs*freq)+' periods, F = $'+face+'. '
      +'Macaulay duration = \u03a3 t\u00d7PV(payment<sub>t</sub>) \u00f7 price.</p></div></details>';
    raRateScenario();
  });
  /* (c) YTM */
  var ygo=document.getElementById('ra-y-go');
  if(ygo) ygo.addEventListener('click', function(){
    var out=document.getElementById('ra-y-out');
    var face=num('ra-y-face'), cp=num('ra-y-coupon'), yrs=num('ra-y-years'), px=num('ra-y-price');
    var freq=parseInt((document.getElementById('ra-y-freq')||{value:'2'}).value,10)||2;
    if(face==null||cp==null||yrs==null||px==null||yrs<=0||px<=0){ out.innerHTML=emptyBox('Fill in all inputs (price must be positive).'); return; }
    var ytm=raBondYTM(face,cp,yrs,px,freq);
    out.innerHTML='<div class="kpi"><div class="k">'+ex('ytm','Implied yield to maturity')+'</div><div class="v">'+(ytm==null?'data unavailable':ytm.toFixed(2)+'% per year')+'</div>'
      +'<div class="d">Found by bisection: yields were tried until the price formula matched $'+px.toFixed(2)+'.</div></div>';
  });
  /* (e) scenario */
  function raRateScenario(){
    var out=document.getElementById('ra-r-out'); if(!out) return;
    var dEl=document.getElementById('ra-r-delta');
    var delta=dEl?parseFloat(dEl.value):0;
    var dval=document.getElementById('ra-r-dval');
    if(dval) dval.textContent=(delta>=0?'+':'')+delta.toFixed(2).replace(/\.?0+$/,'')+'%';
    var face=num('ra-b-face'), cp=num('ra-b-coupon'), yrs=num('ra-b-years'), ytm=num('ra-b-ytm');
    var freq=parseInt((document.getElementById('ra-b-freq')||{value:'2'}).value,10)||2;
    var cf=num('ra-r-cf'), sg=num('ra-r-g'), sh=num('ra-r-shares'), tg=num('ra-r-tg');
    var y10=num('ra-r-y10'), erp=num('ra-r-erp');
    var baseR=(y10!=null&&erp!=null)?(y10+erp):null;
    var st=tickerVal('ra-r-stock')||STOCK_TICKERS[0];
    var h='<div class="grid g3">';
    /* bond */
    if(face!=null&&cp!=null&&yrs!=null&&ytm!=null&&yrs>0){
      var p0=raBondPrice(face,cp,yrs,ytm,freq), p1=raBondPrice(face,cp,yrs,ytm+delta,freq);
      var chg=(p1/p0-1)*100;
      h+='<div class="kpi"><div class="k">Sample bond price</div><div class="v">$'+p0.toFixed(2)+' \u2192 $'+p1.toFixed(2)+'</div>'
        +'<div class="d">'+(chg>=0?'+':'')+chg.toFixed(1)+'% when rates move '+(delta>=0?'+':'')+delta+'pt</div></div>';
    } else h+='<div class="kpi"><div class="k">Sample bond price</div><div class="v">data unavailable</div><div class="d">price the bond above first</div></div>';
    /* stock: specific ticker, 5-yr DCF shocked by the slider */
    var f0=(cf!=null&&sg!=null&&sh&&tg!=null&&baseR!=null)?raDCF(cf,sg/100,baseR/100,tg/100,sh):null;
    if(f0!=null&&st){
      var px=lastClose(st);
      var rS=baseR+delta;
      var f1=(rS>0)?raDCF(cf,sg/100,rS/100,tg/100,sh):null;
      var schg=f1!=null?(f1/f0-1)*100:null;
      h+='<div class="kpi"><div class="k">'+Util.esc(st)+' DCF fair value / share</div><div class="v">$'+f0.toFixed(2)+' \u2192 '+(f1==null?'data unavailable':'$'+f1.toFixed(2))+'</div>'
        +'<div class="d">discount '+baseR.toFixed(1)+'% \u2192 '+rS.toFixed(1)+'% \u00b7 '+(schg==null?'shocked rate must stay positive':(schg>=0?'+':'')+schg.toFixed(1)+'%')
        +(px?' \u00b7 current price $'+px.toFixed(2):'')+'</div></div>';
    } else h+='<div class="kpi"><div class="k">Stock DCF value</div><div class="v">data unavailable</div><div class="d">'
      +((cf!=null&&cf<=0)?'starting cash flow is not positive \u2014 DCF not meaningful (common for banks)':'need cash flow, growth, shares, 10-year yield, and ERP')+'</div></div>';
    /* company */
    var t=tickerVal('ra-r-ticker')||STOCK_TICKERS[0];
    if(t){
      var fys=raFys(t), fy0=fys[0];
      var ie=raIsNum(raFig(t,'interest_exp',fy0).val)?Number(raFig(t,'interest_exp',fy0).val):null;
      var tl=raIsNum(raFig(t,'total_liab',fy0).val)?Number(raFig(t,'total_liab',fy0).val):null;
      var op=raIsNum(raFig(t,'op_income',fy0).val)?Number(raFig(t,'op_income',fy0).val):null;
      if(ie!=null&&tl&&op!=null){
        var rate=ie/tl, ie2=tl*(rate+0.02);
        var c0=op/ie, c2=op/ie2;
        h+='<div class="kpi"><div class="k">'+Util.esc(t)+' borrowing cost (illustrative)</div>'
          +'<div class="v">'+Util.pct(rate)+' \u2192 '+Util.pct(rate+0.02)+'</div>'
          +'<div class="d">interest '+Util.money(ie)+' \u2192 '+Util.money(ie2)+' \u00b7 coverage '+c0.toFixed(1)+'\u00d7 \u2192 '+c2.toFixed(1)+'\u00d7 at +2pt</div></div>';
      } else h+='<div class="kpi"><div class="k">'+Util.esc(t)+' borrowing cost</div><div class="v">data unavailable</div><div class="d">interest expense or liabilities not reported</div></div>';
    } else h+='<div class="kpi"><div class="k">Company borrowing cost</div><div class="v">data unavailable</div></div>';
    h+='</div>';
    /* shock table: fair value across the rate range */
    if(f0!=null&&baseR!=null){
      var deltas=[-3,-2,-1,0,1,2,3];
      var rows=deltas.map(function(d){
        var rr=baseR+d, fv=(rr>0)?raDCF(cf,sg/100,rr/100,tg/100,sh):null;
        var pc=fv!=null?(fv/f0-1)*100:null;
        return '<tr'+(d===0?' style="background:rgba(88,166,255,.08)"':'')+'><td class="num">'+(d>0?'+':'')+d.toFixed(1)+'pp</td><td class="num">'+rr.toFixed(1)+'%</td>'
          +'<td class="num">'+(fv==null?'data unavailable':'$'+fv.toFixed(2))+'</td>'
          +'<td class="num" style="color:'+(pc==null?'inherit':(pc>=0?'var(--green)':'var(--red)'))+'">'+(pc==null?'\u2014':(pc>=0?'+':'')+pc.toFixed(1)+'%')+'</td></tr>';
      }).join('');
      var up1=raDCF(cf,sg/100,(baseR+1)/100,tg/100,sh), dn1=raDCF(cf,sg/100,(baseR-1)/100,tg/100,sh);
      var sUp=up1!=null?((up1/f0-1)*100):null, sDn=dn1!=null?((dn1/f0-1)*100):null;
      h+='<h3 style="margin:14px 0 6px">What a hike or cut does to '+Util.esc(st)+'</h3>'
        +'<p class="small">A <b>1-point hike</b> (discount '+baseR.toFixed(1)+'% \u2192 '+(baseR+1).toFixed(1)+'%) '+(sUp==null?'cannot be computed here':(sUp<=0?'cuts':'moves')+' fair value by <b style="color:var(--'+(sUp<=0?'red':'green')+')">'+sUp.toFixed(1)+'%</b>')
        +' \u00b7 a <b>1-point cut</b> '+(sDn==null?'cannot be computed here':(sDn>=0?'lifts':'moves')+' it by <b style="color:var(--'+(sDn>=0?'green':'red')+')">'+(sDn>=0?'+':'')+sDn.toFixed(1)+'%</b>')+'.</p>'
        +'<table class="tbl"><thead><tr><th class="num">Rate shift</th><th class="num">Discount rate</th><th class="num">Fair value / share</th><th class="num">vs base</th></tr></thead><tbody>'+rows+'</tbody></table>'
        +'<div style="margin-top:8px">'+Charts.line(deltas.map(function(d){ var rr=baseR+d; return {y: rr>0?raDCF(cf,sg/100,rr/100,tg/100,sh):null}; }),720,180,'#4d9fff')+'</div>'
        +'<p class="hint">Fair value falls as rates rise because future cash is discounted harder \u2014 fast growers (cash far in the future) swing the most. This is DCF arithmetic, not a prediction: real stocks also react to <i>why</i> rates moved.</p>';
    }
    out.innerHTML=h;
  }
  var dEl=document.getElementById('ra-r-delta');
  if(dEl) dEl.addEventListener('input', raRateScenario);
  ['ra-r-cf','ra-r-g','ra-r-shares','ra-r-tg','ra-r-y10','ra-r-erp'].forEach(function(id){ var el=document.getElementById(id); if(el) el.addEventListener('input', raRateScenario); });
  var ssel=document.getElementById('ra-r-stock');
  if(ssel) ssel.addEventListener('change', function(){
    var pp=raValPrefill(tickerVal('ra-r-stock'));
    function set(id,v,dec){ var el=document.getElementById(id); if(el) el.value=(v==null?'':Number(v).toFixed(dec==null?2:dec)); }
    set('ra-r-cf',pp.fcf==null?null:Math.round(pp.fcf),0);
    set('ra-r-g',pp.g,1);
    set('ra-r-shares',pp.shares==null?null:Math.round(pp.shares),0);
    raRateScenario();
  });
  var tsel=document.getElementById('ra-r-ticker');
  if(tsel) tsel.addEventListener('change', raRateScenario);
  raRateScenario();
}
raRoute('bonds', raBondsRender, raBondsAfter);

/* ================= BUYBACKS ================= */
function raBuyRender(){
  if(!STOCK_TICKERS.length) return '<div class="panel">'+emptyBox('No company data is available.')+'</div>';
  var t=STOCK_TICKERS[0], fy0=raFys(t)[0];
  var sh=raIsNum(raFig(t,'shares_dil',fy0).val)?Math.round(Number(raFig(t,'shares_dil',fy0).val)):null;
  var px=lastClose(t);
  var debt=raIsNum(raFig(t,'lt_debt',fy0).val)?Math.round(Number(raFig(t,'lt_debt',fy0).val))
    :(raIsNum(raFig(t,'total_liab',fy0).val)?Math.round(Number(raFig(t,'total_liab',fy0).val)):null);
  var h='<div class="panel"><h2>'+ex('buyback','Stock buybacks')+'</h2>'+DATA_BADGE;
  h+='<p class="small">What happens to your shares \u2014 and to earnings per share \u2014 when a company buys back its own stock.</p></div>';
  /* (a) buyback calculator */
  h+='<div class="panel"><h2>'+ex('buyback','Buyback calculator')+'</h2>';
  h+='<div class="grid g3">'
    +fieldRow('Company (prefills shares & price)', tickerInput('ra-bb-ticker', t))
    +fieldRow('Shares outstanding', numInput('ra-bb-shares', sh==null?'':sh,'1'))
    +fieldRow('Share price ($)', numInput('ra-bb-price', px==null?'':px.toFixed(2),'0.01'))
    +fieldRow('Buyback amount ($)', numInput('ra-bb-amt', 1000000000,'1'), 'How much the company spends repurchasing shares.')
    +fieldRow('Your shares held', numInput('ra-bb-yours', 100,'1'), 'To see your ownership % rise.')
    +'<div style="align-self:end"><button class="btn" id="ra-bb-go">Calculate</button></div>'
    +'</div><div id="ra-bb-out" style="margin-top:10px"></div>';
  h+='<details class="exp"><summary>Why companies buy back shares \u2014 and when it is good or bad</summary><div class="body"><ul>'
    +'<li><b>Why:</b> to return spare cash to owners, to signal the shares look cheap, or to offset new shares given to employees.</li>'
    +'<li><b>Good:</b> when the stock is genuinely cheap and the business has no better use for the cash \u2014 each remaining share owns more of the company.</li>'
    +'<li><b>Bad:</b> when the company overpays at the top, borrows heavily to fund it, or starves research and investment to flatter EPS.</li>'
    +'</ul></div></details></div>';
  /* (b) debt paydown */
  h+='<div class="panel"><h2>'+ex('ra-debtpay','Debt paydown')+' (bond buyback)</h2>';
  h+='<div class="grid g3">'
    +fieldRow('Company (prefills debt)', tickerInput('ra-db-ticker', t), 'Prefills long-term debt, else total liabilities.')
    +fieldRow('Debt before ($)', numInput('ra-db-debt', debt==null?'':debt,'1'))
    +fieldRow('Amount retired ($)', numInput('ra-db-amt', 500000000,'1'))
    +fieldRow('Interest rate on that debt (%/yr)', numInput('ra-db-rate', 5,'0.1'))
    +'<div style="align-self:end"><button class="btn" id="ra-db-go">Calculate</button></div>'
    +'</div><div id="ra-db-out" style="margin-top:10px"></div></div>';
  /* (c) share trend */
  h+='<div class="panel"><h2>'+ex('ra-sharetrend','Share count trend')+' \u2014 is the company buying back?</h2>';
  h+=fieldRow('Company', tickerInput('ra-st-ticker', t),
    'Diluted shares outstanding over the last three reported years. Shrinking = buybacks (or similar) at work.');
  h+='<div id="ra-st-out"></div></div>';
  return h;
}
function raBuyAfter(){
  function num(id){ var el=document.getElementById(id); var v=el?parseFloat(el.value):NaN; return isNaN(v)?null:v; }
  /* (a) */
  function bbPrefill(t){
    var fy0=raFys(t)[0];
    var sh=raIsNum(raFig(t,'shares_dil',fy0).val)?Math.round(Number(raFig(t,'shares_dil',fy0).val)):null;
    var px=lastClose(t);
    var sEl=document.getElementById('ra-bb-shares'), pEl=document.getElementById('ra-bb-price');
    if(sEl) sEl.value=sh==null?'':sh;
    if(pEl) pEl.value=px==null?'':px.toFixed(2);
  }
  function bbCalc(){
    var out=document.getElementById('ra-bb-out');
    var shares=num('ra-bb-shares'), price=num('ra-bb-price'), amt=num('ra-bb-amt'), yours=num('ra-bb-yours');
    if(!(shares>0)||!(price>0)||!(amt>0)){ out.innerHTML=emptyBox('Enter positive shares, price, and buyback amount.'); return; }
    var retired=amt/price, ns=shares-retired;
    if(ns<=0){ out.innerHTML=emptyBox('That buyback would retire every share \u2014 lower the amount.'); return; }
    var uplift=(shares/ns-1)*100;
    var own0=(yours>0)?yours/shares*100:null, own1=(yours>0)?yours/ns*100:null;
    out.innerHTML='<div class="grid g4">'
      +'<div class="kpi"><div class="k">Shares retired</div><div class="v">'+Util.num(retired,0)+'</div><div class="d">'+Util.pct(retired/shares)+' of the company</div></div>'
      +'<div class="kpi"><div class="k">New share count</div><div class="v">'+Util.num(ns,0)+'</div><div class="d">was '+Util.num(shares,0)+'</div></div>'
      +'<div class="kpi"><div class="k">'+ex('ra-epsuplift','EPS uplift')+'</div><div class="v" style="color:#3fb950">+'+uplift.toFixed(2)+'%</div><div class="d">same profit, fewer shares</div></div>'
      +'<div class="kpi"><div class="k">Your ownership</div><div class="v">'+(own0==null?'n/a':own0.toFixed(3)+'% \u2192 '+own1.toFixed(3)+'%')+'</div><div class="d">your slice grows without buying more</div></div>'
      +'</div><p class="rule-note">Math: new shares = old \u2212 (buyback $ \u00f7 price); EPS uplift = old/new \u2212 1.'+raRuleTag()+'</p>';
  }
  var bbt=document.getElementById('ra-bb-ticker');
  if(bbt) bbt.addEventListener('change', function(){ bbPrefill(tickerVal('ra-bb-ticker')); bbCalc(); });
  var bbgo=document.getElementById('ra-bb-go');
  if(bbgo) bbgo.addEventListener('click', bbCalc);
  /* (b) */
  function dbPrefill(t){
    var fy0=raFys(t)[0];
    var debt=raIsNum(raFig(t,'lt_debt',fy0).val)?Math.round(Number(raFig(t,'lt_debt',fy0).val))
      :(raIsNum(raFig(t,'total_liab',fy0).val)?Math.round(Number(raFig(t,'total_liab',fy0).val)):null);
    var el=document.getElementById('ra-db-debt');
    if(el) el.value=debt==null?'':debt;
  }
  function dbCalc(){
    var out=document.getElementById('ra-db-out');
    var t=tickerVal('ra-db-ticker')||null;
    var debt=num('ra-db-debt'), amt=num('ra-db-amt'), rate=num('ra-db-rate');
    if(!(debt>0)||!(amt>0)||rate==null){ out.innerHTML=emptyBox('Enter debt, a positive retirement amount, and the interest rate.'); return; }
    if(amt>debt){ out.innerHTML=emptyBox('You cannot retire more debt than exists.'); return; }
    var saved=amt*rate/100, after=debt-amt;
    var eq=null, de0=null, de1=null;
    if(t){
      var fy0=raFys(t)[0];
      var a=raIsNum(raFig(t,'assets',fy0).val)?Number(raFig(t,'assets',fy0).val):null;
      var tl=raIsNum(raFig(t,'total_liab',fy0).val)?Number(raFig(t,'total_liab',fy0).val):null;
      if(a!=null&&tl!=null&&a-tl>0){ eq=a-tl; de0=tl/eq; de1=(tl-amt)/eq; }
    }
    out.innerHTML='<div class="grid g4">'
      +'<div class="kpi"><div class="k">Debt after</div><div class="v">'+Util.money(after)+'</div><div class="d">was '+Util.money(debt)+'</div></div>'
      +'<div class="kpi"><div class="k">Interest saved / year</div><div class="v" style="color:#3fb950">'+Util.money(saved)+'</div><div class="d">'+Util.num(rate,2)+'% of '+Util.money(amt)+'</div></div>'
      +'<div class="kpi"><div class="k">'+ex('de','D/E')+' before</div><div class="v">'+(de0==null?'data unavailable':de0.toFixed(2)+'\u00d7')+'</div></div>'
      +'<div class="kpi"><div class="k">'+ex('de','D/E')+' after</div><div class="v">'+(de1==null?'data unavailable':de1.toFixed(2)+'\u00d7')+'</div><div class="d">equity = assets \u2212 liabilities</div></div>'
      +'</div><p class="rule-note">Annual interest saved = amount retired \u00d7 interest rate.'+raRuleTag()+'</p>';
  }
  var dbt=document.getElementById('ra-db-ticker');
  if(dbt) dbt.addEventListener('change', function(){ dbPrefill(tickerVal('ra-db-ticker')); dbCalc(); });
  var dbgo=document.getElementById('ra-db-go');
  if(dbgo) dbgo.addEventListener('click', dbCalc);
  /* (c) */
  function stShow(){
    var out=document.getElementById('ra-st-out');
    var t=tickerVal('ra-st-ticker')||STOCK_TICKERS[0];
    var fys=raFys(t).slice(0,3);
    if(!fys.length){ out.innerHTML=emptyBox('No share data for '+Util.esc(t)+'.'); return; }
    var vals=fys.map(function(fy){ var v=raFig(t,'shares_dil',fy).val; return raIsNum(v)?Number(v):null; });
    if(vals.some(function(v){ return v==null; })){ out.innerHTML=emptyBox('Share count: data unavailable for one or more years.'); return; }
    var labels=fys.slice().reverse(), series=vals.slice().reverse();
    var chg=(vals[0]/vals[vals.length-1]-1)*100;
    var read=chg<-1?'Shares outstanding shrank '+Math.abs(chg).toFixed(1)+'% over this period \u2014 buybacks are happening (fewer shares split the profit).'
      :(chg>1?'Shares outstanding grew '+chg.toFixed(1)+'% \u2014 the company issued new shares, diluting existing holders.'
      :'Share count roughly flat ('+(chg>=0?'+':'')+chg.toFixed(1)+'%) \u2014 no meaningful buyback or dilution.');
    out.innerHTML=Charts.vbar(labels, series, 460, 120)
      +'<p><b>Plain-English read:</b> '+Util.esc(read)+raRuleTag()+'</p>'
      +'<p class="small">Source: '+(raFig(t,'shares_dil',fys[0]).src==='uploaded filing'?'uploaded filing + ':'')+'built-in SEC data.</p>';
  }
  var stt=document.getElementById('ra-st-ticker');
  if(stt) stt.addEventListener('change', stShow);
  bbCalc(); dbCalc(); stShow();
}
raRoute('buybacks', raBuyRender, raBuyAfter);

})();
