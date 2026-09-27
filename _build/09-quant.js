/* ============================================================
   09-quant.js — Quant Lab
   Screener, Portfolio Lab (efficient frontier / correlation /
   backtester), Wheel tracker, Black-Scholes pricer, Roth
   contribution tracker, Deep-Dive quality scores + insider feed.
   All math is client-side; formulas follow the standard
   textbook/OSS definitions (QuantLib-style Black-Scholes,
   TA-Lib Wilder RSI conventions, quantstats-style backtest
   metrics). No data is invented: every figure comes from the
   bundled SEC snapshot, the bundled daily bars, or user input.
   ============================================================ */

/* ---------------- shared quant helpers ---------------- */
function qFval(t, key, i){
  try{
    var f=(RealData.fundamentals||{})[t];
    if(!f||!f[key]||!f[key][i==null?0:i]) return null;
    var v=Number(f[key][i==null?0:i].val);
    return isNaN(v)?null:v;
  }catch(e){ return null; }
}
function qCloses(t){
  var bars=(RealData.prices||{})[t]||[];
  return bars.map(function(b){ return Number(b.a); }).filter(function(v){ return v>0; });
}
function qLogRets(t){
  var c=qCloses(t), out=[];
  for(var i=1;i<c.length;i++) out.push(Math.log(c[i]/c[i-1]));
  return out;
}
function qMean(a){ return a.length?a.reduce(function(x,y){return x+y;},0)/a.length:0; }
function qStd(a){
  if(a.length<2) return 0;
  var m=qMean(a), s=0;
  for(var i=0;i<a.length;i++) s+=(a[i]-m)*(a[i]-m);
  return Math.sqrt(s/(a.length-1));
}

/* ---------------- Piotroski F-Score (0-9) ----------------
   Nine binary tests on the last two fiscal years. */
function qPiotroski(t){
  var g=function(k,i){ return qFval(t,k,i); };
  var parts=[], score=0;
  function tst(name, ok){
    parts.push({name:name, pass:!!ok});
    if(ok) score++;
  }
  var ni0=g('net_income',0), ni1=g('net_income',1),
      a0=g('assets',0), a1=g('assets',1),
      oc0=g('op_cash',0),
      ltd0=g('lt_debt',0), ltd1=g('lt_debt',1),
      ca0=g('cur_assets',0), ca1=g('cur_assets',1),
      cl0=g('cur_liab',0), cl1=g('cur_liab',1),
      sh0=g('shares_dil',0), sh1=g('shares_dil',1),
      gp0=g('gross_profit',0), gp1=g('gross_profit',1),
      rev0=g('revenue',0), rev1=g('revenue',1);
  var need=[ni0,ni1,a0,a1,oc0,ltd0,ltd1,ca0,ca1,cl0,cl1,sh0,sh1,gp0,gp1,rev0,rev1];
  for(var i=0;i<need.length;i++) if(need[i]==null) return {score:null, parts:[], note:'missing data'};
  var roa0=ni0/a0, roa1=ni1/a1;
  tst('ROA positive', roa0>0);
  tst('Operating cash flow positive', oc0>0);
  tst('ROA improving', roa0>roa1);
  tst('Cash flow > net income (accrual quality)', oc0>ni0);
  tst('Leverage falling (LT debt / assets)', (ltd0/a0)<(ltd1/a1));
  tst('Current ratio improving', (ca0/cl0)>(ca1/cl1));
  tst('No new shares issued', sh0<=sh1);
  tst('Gross margin improving', (gp0/rev0)>(gp1/rev1));
  tst('Asset turnover improving', (rev0/a0)>(rev1/a1));
  return {score:score, parts:parts, note:''};
}
function qFLabel(s){
  if(s==null) return 'n/a';
  if(s>=7) return 'Strong (7-9)';
  if(s>=4) return 'Average (4-6)';
  return 'Weak (0-3)';
}

/* ---------------- Altman Z-Score ----------------
   Z = 1.2*WC/TA + 1.4*RE/TA + 3.3*EBIT/TA + 0.6*MVE/TL + 1.0*Sales/TA
   Zones: >2.99 safe, 1.81-2.99 grey, <1.81 distress.
   Built for manufacturers; banks/insurers read oddly — flagged. */
function qAltman(t){
  var g=function(k){ return qFval(t,k,0); };
  var px=lastClose(t);
  var ta=g('assets'), wc=g('cur_assets')-g('cur_liab'), re=g('retained'),
      ebit=g('op_income'), tl=g('total_liab'), sales=g('revenue'),
      sh=g('shares_dil');
  var need=[ta,wc,re,ebit,tl,sales,sh,px];
  for(var i=0;i<need.length;i++) if(need[i]==null||isNaN(need[i])) return {z:null, parts:[], note:'missing data'};
  if(ta===0||tl===0) return {z:null, parts:[], note:'missing data'};
  var mve=px*sh;
  var x1=wc/ta, x2=re/ta, x3=ebit/ta, x4=mve/tl, x5=sales/ta;
  var z=1.2*x1+1.4*x2+3.3*x3+0.6*x4+1.0*x5;
  return {z:z, parts:[
    {k:'Working capital / assets', v:x1, w:'1.2x'},
    {k:'Retained earnings / assets', v:x2, w:'1.4x'},
    {k:'EBIT / assets', v:x3, w:'3.3x'},
    {k:'Market equity / liabilities', v:x4, w:'0.6x'},
    {k:'Sales / assets', v:x5, w:'1.0x'}
  ], note:''};
}
function qZLabel(z){
  if(z==null) return 'n/a';
  if(z>2.99) return 'Safe zone';
  if(z>1.81) return 'Grey zone';
  return 'Distress zone';
}

/* ============================================================
   STOCK SCREENER
   ============================================================ */
var QScr={sort:'mktcap', dir:-1, fMinPE:'', fMaxPE:'', fMaxPB:'', fMinROE:'', fMinF:''};
function qScreenerMetrics(){
  var out=[];
  var tickers=Object.keys(RealData.fundamentals||{}).sort();
  tickers.forEach(function(t){
    var px=lastClose(t), sh=qFval(t,'shares_dil',0),
        ni=qFval(t,'net_income',0), rev=qFval(t,'revenue',0),
        rev1=qFval(t,'revenue',1),
        a=qFval(t,'assets',0), tl=qFval(t,'total_liab',0),
        ca=qFval(t,'cur_assets',0), cl=qFval(t,'cur_liab',0);
    var eq=(a!=null&&tl!=null)?a-tl:null;
    var eps=(ni!=null&&sh)?ni/sh:null;
    var m={
      t:t, px:px,
      mktcap:(px!=null&&sh)?px*sh:null,
      pe:(px!=null&&eps&&eps>0)?px/eps:null,
      pb:(px!=null&&eq&&sh&&eq>0)?px/(eq/sh):null,
      roe:(ni!=null&&eq&&eq>0)?ni/eq:null,
      pm:(ni!=null&&rev)?ni/rev:null,
      rg:(rev!=null&&rev1)?rev/rev1-1:null,
      cr:(ca!=null&&cl)?ca/cl:null,
      de:(tl!=null&&eq&&eq>0)?tl/eq:null
    };
    var fs=qPiotroski(t); m.fscore=fs.score;
    var az=qAltman(t); m.z=az.z;
    out.push(m);
  });
  return out;
}
function qScreenerHTML(){
  var h='<div class="panel"><h2><span class="ico">'+icon('filter')+'</span> Stock Screener '+DATA_BADGE+'</h2>'
    +'<p class="hint">Every metric is computed from the bundled SEC filings snapshot plus the last offline close — nothing is fetched, nothing is invented. '
    +'Covers the '+Object.keys(RealData.fundamentals||{}).length+' bundled tickers.</p>'
    +'<div class="grid g4">'
    +'<div>'+fieldRow('Max P/E', numInput('qsc-maxpe',QScr.fMaxPE,1))+'</div>'
    +'<div>'+fieldRow('Max P/B', numInput('qsc-maxpb',QScr.fMaxPB,0.1))+'</div>'
    +'<div>'+fieldRow('Min ROE (%)', numInput('qsc-minroe',QScr.fMinROE,1))+'</div>'
    +'<div>'+fieldRow('Min F-Score', numInput('qsc-minf',QScr.fMinF,1))+'</div>'
    +'</div>'
    +'<div class="frow" style="margin:8px 0"><label class="f">Sort by</label>'
    +'<select class="in" id="qsc-sort" style="max-width:220px">'
    +[['mktcap','Market cap'],['pe','P/E'],['pb','P/B'],['roe','ROE'],['pm','Profit margin'],['rg','Revenue growth'],['fscore','F-Score'],['z','Z-Score']]
      .map(function(o){ return '<option value="'+o[0]+'"'+(QScr.sort===o[0]?' selected':'')+'>'+o[1]+'</option>'; }).join('')
    +'</select> <button class="btn sm ghost" id="qsc-dir">'+(QScr.dir<0?'↓ desc':'↑ asc')+'</button>'
    +' <button class="btn sm" id="qsc-go">Apply</button>'
    +' <button class="btn sm ghost" id="qsc-clear">Reset</button></div>'
    +'<div id="qsc-table"></div>'
    +'<p class="small hint" style="margin-top:8px">F-Score: 7–9 strong, 4–6 average, 0–3 weak. '
    +'Z-Score: &gt;2.99 safe, 1.81–2.99 grey, &lt;1.81 distress (built for manufacturers — banks like JPM read oddly). '
    +'P/E is blank when earnings are negative.</p>'
    +'</div>';
  return h;
}
function qScreenerDraw(){
  var box=document.getElementById('qsc-table'); if(!box) return;
  var rows=qScreenerMetrics().filter(function(m){
    if(QScr.fMaxPE!==''&&!(m.pe!=null&&m.pe<=Number(QScr.fMaxPE))) return false;
    if(QScr.fMaxPB!==''&&!(m.pb!=null&&m.pb<=Number(QScr.fMaxPB))) return false;
    if(QScr.fMinROE!==''&&!(m.roe!=null&&m.roe>=Number(QScr.fMinROE)/100)) return false;
    if(QScr.fMinF!==''&&!(m.fscore!=null&&m.fscore>=Number(QScr.fMinF))) return false;
    return true;
  });
  rows.sort(function(a,b){
    var va=a[QScr.sort], vb=b[QScr.sort];
    va=(va==null)?(QScr.dir<0?-Infinity:Infinity):va;
    vb=(vb==null)?(QScr.dir<0?-Infinity:Infinity):vb;
    return (va-vb)*QScr.dir;
  });
  function cell(v, fmt){
    if(v==null||isNaN(v)) return '<td class="num hint">—</td>';
    return '<td class="num">'+fmt(v)+'</td>';
  }
  function fBadge(s){
    if(s==null) return '<td class="num hint">—</td>';
    var c=s>=7?'b-ok':(s>=4?'b-warn':'b-bad');
    return '<td class="num"><span class="tag '+c+'">'+s+'</span></td>';
  }
  function zBadge(z){
    if(z==null||isNaN(z)) return '<td class="num hint">—</td>';
    var c=z>2.99?'b-ok':(z>1.81?'b-warn':'b-bad');
    return '<td class="num"><span class="tag '+c+'">'+z.toFixed(2)+'</span></td>';
  }
  var h='<div style="overflow-x:auto"><table class="tbl"><thead><tr>'
    +'<th>Ticker</th><th class="num">Price</th><th class="num">Mkt cap</th><th class="num">P/E</th><th class="num">P/B</th>'
    +'<th class="num">ROE</th><th class="num">Margin</th><th class="num">Rev gr</th><th class="num">Curr</th><th class="num">D/E</th>'
    +'<th class="num">F</th><th class="num">Z</th></tr></thead><tbody>';
  rows.forEach(function(m){
    h+='<tr><td><b><a href="#/deepdive/'+m.t+'">'+m.t+'</a></b></td>'
      +cell(m.px,function(v){return '$'+v.toFixed(2);})
      +cell(m.mktcap,function(v){return Util.money(v);})
      +cell(m.pe,function(v){return v.toFixed(1);})
      +cell(m.pb,function(v){return v.toFixed(2);})
      +cell(m.roe,function(v){return (v*100).toFixed(1)+'%';})
      +cell(m.pm,function(v){return (v*100).toFixed(1)+'%';})
      +cell(m.rg,function(v){return (v*100).toFixed(1)+'%';})
      +cell(m.cr,function(v){return v.toFixed(2);})
      +cell(m.de,function(v){return v.toFixed(2);})
      +fBadge(m.fscore)+zBadge(m.z)+'</tr>';
  });
  h+='</tbody></table></div><p class="small hint">'+rows.length+' tickers match.</p>';
  box.innerHTML=h;
}
function qScreenerAfter(){
  function read(){
    QScr.fMaxPE=document.getElementById('qsc-maxpe').value.trim();
    QScr.fMaxPB=document.getElementById('qsc-maxpb').value.trim();
    QScr.fMinROE=document.getElementById('qsc-minroe').value.trim();
    QScr.fMinF=document.getElementById('qsc-minf').value.trim();
    QScr.sort=document.getElementById('qsc-sort').value;
  }
  document.getElementById('qsc-go').addEventListener('click',function(){ read(); qScreenerDraw(); });
  document.getElementById('qsc-dir').addEventListener('click',function(){ read(); QScr.dir*=-1; this.textContent=(QScr.dir<0?'↓ desc':'↑ asc'); qScreenerDraw(); });
  document.getElementById('qsc-clear').addEventListener('click',function(){
    QScr={sort:'mktcap',dir:-1,fMinPE:'',fMaxPE:'',fMaxPB:'',fMinROE:'',fMinF:''}; Router.render();
  });
  qScreenerDraw();
}
Router.routes['screener']=function(){ return qScreenerHTML(); };
Router.routes['screener'].after=function(){ qScreenerAfter(); };

/* ============================================================
   PORTFOLIO LAB — efficient frontier, correlation, backtester
   Uses the bundled 502-day adjusted closes. All in-sample.
   ============================================================ */
var QPort={tab:'frontier'};
function qPortHTML(){
  var tabs=[['frontier','Efficient Frontier'],['corr','Correlation'],['backtest','Backtester']];
  var h='<div class="panel"><h2><span class="ico">'+icon('pie_chart')+'</span> Portfolio Lab '+DATA_BADGE+'</h2>'
    +'<p class="hint">Built on the bundled 502 daily bars (2024-09-25 → 2026-09-25), dividend/split-adjusted. '
    +'Expected returns are <b>historical averages</b> — the past does not predict the future, and this is not advice.</p>'
    +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">'
    +tabs.map(function(t){ return '<button class="btn sm'+(QPort.tab===t[0]?'':' ghost')+'" data-qp-tab="'+t[0]+'">'+t[1]+'</button>'; }).join('')
    +'</div><div id="qp-body"></div></div>';
  return h;
}
function qAlignRets(){
  var syms=Object.keys(RealData.prices||{}).sort();
  var all=syms.map(function(s){ return {s:s, r:qLogRets(s)}; }).filter(function(x){ return x.r.length>50; });
  var n=Math.min.apply(null, all.map(function(x){ return x.r.length; }));
  all.forEach(function(x){ x.r=x.r.slice(x.r.length-n); });
  return {syms:all.map(function(x){return x.s;}), rets:all.map(function(x){return x.r;}), n:n};
}
function qCov(rets){
  var m=rets.length, n=rets[0].length, mu=rets.map(qMean), C=[];
  for(var i=0;i<m;i++){ C.push([]);
    for(var j=0;j<m;j++){
      var s=0;
      for(var k=0;k<n;k++) s+=(rets[i][k]-mu[i])*(rets[j][k]-mu[j]);
      C[i].push(s/(n-1));
    }
  }
  return {C:C, mu:mu};
}
function qFrontierRun(nPort, rf){
  var al=qAlignRets(), syms=al.syms, rets=al.rets, m=syms.length;
  var cv=qCov(rets), C=cv.C, muA=cv.mu.map(function(x){ return x*252; });
  var pts=[], best=null, minv=null;
  for(var p=0;p<nPort;p++){
    var w=[], tot=0;
    for(var i=0;i<m;i++){ var e=-Math.log(Math.random()); w.push(e); tot+=e; }
    for(var j=0;j<m;j++) w[j]/=tot;
    var rp=0;
    for(var a=0;a<m;a++) rp+=w[a]*muA[a];
    var vv=0;
    for(var b=0;b<m;b++) for(var c=0;c<m;c++) vv+=w[b]*w[c]*C[b][c];
    var vol=Math.sqrt(Math.max(vv,0))*Math.sqrt(252);
    if(vol<=0) continue;
    var sh=(rp-rf)/vol;
    var pt={w:w, rp:rp, vol:vol, sh:sh};
    pts.push(pt);
    if(!best||sh>best.sh) best=pt;
    if(!minv||vol<minv.vol) minv=pt;
  }
  return {syms:syms, pts:pts, best:best, minv:minv, rf:rf};
}
function qFrontierSVG(fr){
  var W=720,H=320, pts=fr.pts;
  if(!pts.length) return '<div class="empty">no portfolios</div>';
  var vols=pts.map(function(p){return p.vol;}), rps=pts.map(function(p){return p.rp;});
  var loV=Math.min.apply(null,vols), hiV=Math.max.apply(null,vols),
      loR=Math.min.apply(null,rps), hiR=Math.max.apply(null,rps);
  var padV=(hiV-loV)*0.06||0.01, padR=(hiR-loR)*0.08||0.01;
  var X=function(v){ return 46+(v-(loV-padV))/((hiV-loV)+2*padV)*(W-66); };
  var Y=function(v){ return H-30-((v-(loR-padR))/((hiR-loR)+2*padR))*(H-50); };
  var shs=pts.map(function(p){return p.sh;});
  var loS=Math.min.apply(null,shs), hiS=Math.max.apply(null,shs);
  function col(sh){
    var t=(sh-loS)/((hiS-loS)||1);
    var r=Math.round(248-140*t), g=Math.round(81+120*t), b=Math.round(73+20*t);
    return 'rgb('+r+','+g+','+b+')';
  }
  var s='<svg viewBox="0 0 '+W+' '+H+'" class="chart">';
  pts.forEach(function(p){
    s+='<circle cx="'+X(p.vol).toFixed(1)+'" cy="'+Y(p.rp).toFixed(1)+'" r="2.6" fill="'+col(p.sh)+'" opacity="0.75"/>';
  });
  [['minv','#f0b429','Min volatility'],['best','#3fb950','Max Sharpe']].forEach(function(k){
    var p=fr[k[0]]; if(!p) return;
    s+='<circle cx="'+X(p.vol).toFixed(1)+'" cy="'+Y(p.rp).toFixed(1)+'" r="6" fill="none" stroke="'+k[1]+'" stroke-width="2.5"/>'
      +'<text x="'+(X(p.vol)+9)+'" y="'+(Y(p.rp)-7)+'" class="chart-lab" fill="'+k[1]+'">'+k[2]+'</text>';
  });
  s+='<text x="'+(W/2)+'" y="'+(H-6)+'" text-anchor="middle" class="chart-lab">Annualized volatility</text>';
  s+='<text x="10" y="'+(H/2)+'" text-anchor="middle" class="chart-lab" transform="rotate(-90 10 '+(H/2)+')">Annualized return</text></svg>';
  return s;
}
function qWeightsTable(fr, p, title, color){
  if(!p) return '';
  var rows=fr.syms.map(function(s,i){ return {s:s, w:p.w[i]}; })
    .filter(function(x){ return x.w>0.005; })
    .sort(function(a,b){ return b.w-a.w; });
  return '<div class="panel"><h3 style="color:'+color+'">'+title+'</h3>'
    +'<p class="small">Expected return <b>'+(p.rp*100).toFixed(1)+'%</b> · Volatility <b>'+(p.vol*100).toFixed(1)+'%</b> · Sharpe <b>'+p.sh.toFixed(2)+'</b> (rf '+(fr.rf*100).toFixed(1)+'%)</p>'
    +'<table class="tbl"><thead><tr><th>Ticker</th><th class="num">Weight</th></tr></thead><tbody>'
    +rows.map(function(x){ return '<tr><td><b>'+x.s+'</b></td><td class="num">'+(x.w*100).toFixed(1)+'%</td></tr>'; }).join('')
    +'</tbody></table></div>';
}
function qFrontierBody(){
  return '<div class="grid g3">'
    +'<div>'+fieldRow('Risk-free rate (%)', numInput('qp-rf','4',0.1), 'For the Sharpe ratio.')+'</div>'
    +'<div>'+fieldRow('Random portfolios', numInput('qp-n','3000',500), '1000–8000.')+'</div>'
    +'<div style="align-self:end"><button class="btn sm" id="qp-run">Run frontier</button></div></div>'
    +'<div id="qp-out" style="margin-top:10px"><span class="small hint">Press “Run frontier”.</span></div>';
}
function qFrontierDraw(){
  var box=document.getElementById('qp-out'); if(!box) return;
  var rf=Number(document.getElementById('qp-rf').value||4)/100;
  var n=Math.max(1000,Math.min(8000,Math.round(Number(document.getElementById('qp-n').value||3000))));
  box.innerHTML='<span class="small hint">Simulating '+n+' portfolios…</span>';
  setTimeout(function(){
    var fr=qFrontierRun(n, rf);
    var h=qFrontierSVG(fr)
      +'<p class="small hint">Each dot is a random long-only portfolio, colored by Sharpe ratio (red → green). '
      +'Weights are random — this illustrates the tradeoff, it does not recommend an allocation.</p>'
      +'<div class="grid g2" style="margin-top:8px">'
      +qWeightsTable(fr, fr.best, '★ Max Sharpe portfolio', '#3fb950')
      +qWeightsTable(fr, fr.minv, 'Min-volatility portfolio', '#f0b429')
      +'</div>';
    box.innerHTML=h;
  },30);
}
function qCorrBody(){
  var al=qAlignRets(), syms=al.syms, rets=al.rets, m=syms.length;
  var cv=qCov(rets), C=cv.C;
  var sd=[]; for(var i=0;i<m;i++) sd.push(Math.sqrt(Math.max(C[i][i],1e-12)));
  function cell(r){
    var t=Math.max(-1,Math.min(1,r));
    var g=Math.round(120+100*t), rd=Math.round(120-60*t);
    var bg='rgba('+rd+','+g+',90,0.55)';
    return '<td class="num" style="background:'+bg+'" title="'+r.toFixed(3)+'">'+r.toFixed(2)+'</td>';
  }
  var h='<div style="overflow-x:auto"><table class="tbl"><thead><tr><th></th>'
    +syms.map(function(s){ return '<th class="num">'+s+'</th>'; }).join('')+'</tr></thead><tbody>';
  for(var i=0;i<m;i++){
    h+='<tr><td><b>'+syms[i]+'</b></td>';
    for(var j=0;j<m;j++) h+=cell(C[i][j]/(sd[i]*sd[j]));
    h+='</tr>';
  }
  h+='</tbody></table></div><p class="small hint">Pearson correlation of daily log returns over the shared window. Green = moves together, red = moves apart.</p>';
  return h;
}
/* ---------------- backtester (quantstats-style metrics) ---------------- */
function qSMA(arr, n){
  var out=[];
  for(var i=0;i<arr.length;i++){
    if(i<n-1){ out.push(null); continue; }
    var s=0; for(var j=i-n+1;j<=i;j++) s+=arr[j];
    out.push(s/n);
  }
  return out;
}
function qBacktest(t, fast, slow, capital){
  var bars=(RealData.prices||{})[t]||[];
  var cl=bars.map(function(b){ return Number(b.a); }).filter(function(v){ return v>0; });
  if(cl.length<slow+5) return {err:'not enough data'};
  var sf=qSMA(cl,fast), ss=qSMA(cl,slow);
  var pos=0, entry=0, cash=capital, shares=0, trades=[], eq=[];
  for(var i=1;i<cl.length;i++){
    if(sf[i]==null||ss[i]==null||sf[i-1]==null||ss[i-1]==null){ eq.push(cash+shares*cl[i]); continue; }
    var bull=sf[i]>ss[i], wasBull=sf[i-1]>ss[i-1];
    if(!pos&&bull&&!wasBull){ shares=cash/cl[i]; entry=cl[i]; cash=0; pos=1; trades.push({side:'buy', px:cl[i], i:i}); }
    else if(pos&&!bull&&wasBull){
      cash=shares*cl[i]; var r=(cl[i]-entry)/entry;
      trades[trades.length-1].ret=r; trades.push({side:'sell', px:cl[i], i:i, ret:r});
      shares=0; pos=0;
    }
    eq.push(cash+shares*cl[i]);
  }
  if(pos){ cash=shares*cl[cl.length-1]; var r2=(cl[cl.length-1]-entry)/entry;
    if(trades.length) trades[trades.length-1].ret=r2; shares=0; }
  var eqR=eq.map(function(v){ return v/capital; });
  var totR=eq[eq.length-1]/capital-1;
  var yrs=cl.length/252, cagr=Math.pow(eq[eq.length-1]/capital,1/yrs)-1;
  var dr=[]; for(var k=1;k<eq.length;k++) dr.push(eq[k]/eq[k-1]-1);
  var sharpe=dr.length>1?qMean(dr)/qStd(dr)*Math.sqrt(252):0;
  var dn=dr.filter(function(x){ return x<0; });
  var sortino=dn.length>1?qMean(dr)/(qStd(dn)||1e-9)*Math.sqrt(252):0;
  var peak=eqR[0], maxdd=0;
  eqR.forEach(function(v){ if(v>peak)peak=v; var dd=(peak-v)/peak; if(dd>maxdd)maxdd=dd; });
  var roundTrips=trades.filter(function(x){ return x.ret!=null; });
  var wins=roundTrips.filter(function(x){ return x.ret>0; }).length;
  var gp=roundTrips.filter(function(x){return x.ret>0;}).reduce(function(a,x){return a+x.ret;},0);
  var gl=Math.abs(roundTrips.filter(function(x){return x.ret<=0;}).reduce(function(a,x){return a+x.ret;},0));
  var bh=cl[cl.length-1]/cl[0]-1;
  return {
    strat:{totR:totR,cagr:cagr,sharpe:sharpe,sortino:sortino,maxdd:maxdd,
      win:roundTrips.length?wins/roundTrips.length:null,
      pf:gl>0?gp/gl:(gp>0?Infinity:null), n:roundTrips.length},
    bh:{totR:bh, cagr:Math.pow(1+bh,1/yrs)-1},
    eq:eq, cl:cl, t:t, capital:capital
  };
}
function qBacktestBody(){
  var opts=Object.keys(RealData.prices||{}).sort().map(function(s){
    return '<option value="'+s+'"'+(s==='SPY'?' selected':'')+'>'+s+'</option>'; }).join('');
  return '<div class="grid g4">'
    +'<div>'+fieldRow('Ticker', '<select class="in" id="qb-t">'+opts+'</select>')+'</div>'
    +'<div>'+fieldRow('Fast SMA', numInput('qb-fast','20',1))+'</div>'
    +'<div>'+fieldRow('Slow SMA', numInput('qb-slow','100',1))+'</div>'
    +'<div>'+fieldRow('Capital ($)', numInput('qb-cap','10000',100))+'</div>'
    +'</div><div style="margin:8px 0"><button class="btn sm" id="qb-run">Run backtest</button></div>'
    +'<div id="qb-out"><span class="small hint">Long-only SMA crossover on adjusted closes. Signals trade at the close. '
    +'In-sample, no commissions, no slippage — treat it as a laboratory, not a promise.</span></div>';
}
function qBacktestDraw(){
  var box=document.getElementById('qb-out'); if(!box) return;
  var t=document.getElementById('qb-t').value,
      fast=Math.max(2,Math.round(Number(document.getElementById('qb-fast').value||20))),
      slow=Math.max(fast+1,Math.round(Number(document.getElementById('qb-slow').value||100))),
      cap=Math.max(100,Number(document.getElementById('qb-cap').value||10000));
  var r=qBacktest(t,fast,slow,cap);
  if(r.err){ box.innerHTML='<div class="empty">'+Util.esc(r.err)+'</div>'; return; }
  function row(k,sv,bv,fmt){
    return '<tr><td>'+k+'</td><td class="num">'+fmt(sv)+'</td><td class="num">'+fmt(bv)+'</td></tr>';
  }
  var pct=function(v){ return v==null?'—':(v*100).toFixed(1)+'%'; };
  var h='<div class="grid g2"><div class="panel"><h3>Equity curve (growth of $1)</h3>'
    +Charts.line(r.eq.map(function(v,i){ return {y:v/cap}; }),720,220,'#58a6ff')
    +'<p class="small hint">Blue: SMA('+fast+','+slow+') strategy. Buy-and-hold returned '+(r.bh.totR*100).toFixed(1)+'% over the same window.</p></div>'
    +'<div class="panel"><h3>Metrics — strategy vs buy-and-hold</h3>'
    +'<table class="tbl"><thead><tr><th></th><th class="num">Strategy</th><th class="num">Buy &amp; hold</th></tr></thead><tbody>'
    +row('Total return',r.strat.totR,r.bh.totR,pct)
    +row('CAGR',r.strat.cagr,r.bh.cagr,pct)
    +row('Sharpe',r.strat.sharpe,null,function(v){return v==null?'—':v.toFixed(2);})
    +row('Sortino',r.strat.sortino,null,function(v){return v==null?'—':v.toFixed(2);})
    +row('Max drawdown',r.strat.maxdd,null,pct)
    +row('Win rate',r.strat.win,null,pct)
    +row('Profit factor',r.strat.pf,null,function(v){return v==null?'—':(v===Infinity?'∞':v.toFixed(2));})
    +row('Round trips',r.strat.n,null,function(v){return v;})
    +'</tbody></table>'
    +'<p class="small hint">Sharpe/Sortino annualized from daily returns. In-sample on '+r.cl.length+' trading days; no costs modeled.</p>'
    +'</div></div>';
  box.innerHTML=h;
}
function qPortBody(){
  var el=document.getElementById('qp-body'); if(!el) return;
  if(QPort.tab==='frontier'){ el.innerHTML=qFrontierBody(); document.getElementById('qp-run').addEventListener('click',qFrontierDraw); }
  else if(QPort.tab==='corr'){ el.innerHTML=qCorrBody(); }
  else { el.innerHTML=qBacktestBody(); document.getElementById('qb-run').addEventListener('click',qBacktestDraw); }
}
function qPortAfter(){
  document.querySelectorAll('[data-qp-tab]').forEach(function(b){
    b.addEventListener('click',function(){ QPort.tab=b.getAttribute('data-qp-tab'); Router.render(); });
  });
  qPortBody();
}
Router.routes['portlab']=function(){ return qPortHTML(); };
Router.routes['portlab'].after=function(){ qPortAfter(); };

/* ============================================================
   WHEEL TRACKER — cash-secured put → assignment → covered call
   ============================================================ */
function qWheelList(){ return Store.db.wheel||(Store.db.wheel=[]); }
function qWheelHTML(){
  var h='<div class="panel"><h2><span class="ico">'+icon('repeat')+'</span> Wheel Strategy Tracker '+DATA_BADGE+'</h2>'
    +'<p class="hint">Track one wheel cycle per position: sell a cash-secured put, get assigned, sell covered calls against the shares, close it out. '
    +'Premiums, cost basis, and realized P/L are computed from your entries — nothing is priced automatically. <b>Options involve risk; this is not advice.</b></p>'
    +'<div id="pl-alert"></div>'
    +'<h3>Open a new wheel</h3>'
    +'<div class="grid g4">'
    +'<div>'+fieldRow('Ticker', tickerInput('qw-ticker',''))+'</div>'
    +'<div>'+fieldRow('Contracts', numInput('qw-n','1',1))+'</div>'
    +'<div>'+fieldRow('CSP strike ($)', numInput('qw-k','',0.5))+'</div>'
    +'<div>'+fieldRow('CSP premium / share ($)', numInput('qw-prem','',0.01))+'</div>'
    +'</div>'
    +fieldRow('CSP expiry', textInput('qw-exp','','e.g. 2026-10-17'))
    +'<div><button class="btn" id="qw-add">Start wheel</button></div>'
    +'<h3>Positions</h3><div id="qw-list"></div>'
    +'</div>';
  return h;
}
function qWheelPrem(pos){
  return (pos.events||[]).reduce(function(a,e){ return a+Number(e.premium||0); },0)*Number(pos.contracts||1)*100;
}
function qWheelBasis(pos){
  if(pos.assignedPrice==null) return null;
  return Number(pos.assignedPrice)-qWheelPrem(pos)/(Number(pos.contracts||1)*100);
}
function qWheelDraw(){
  var box=document.getElementById('qw-list'); if(!box) return;
  var list=qWheelList();
  if(!list.length){ box.innerHTML=emptyBox('No wheel positions yet.'); return; }
  var h='';
  list.forEach(function(p,ix){
    var prem=qWheelPrem(p), basis=qWheelBasis(p), shares=Number(p.contracts||1)*100;
    var status=p.status||'CSP open';
    var evHtml=(p.events||[]).map(function(e){
      return '<div class="small">'+Util.esc(e.kind)+' — strike $'+Number(e.strike).toFixed(2)
        +' · premium $'+Number(e.premium).toFixed(2)+'/sh · exp '+Util.esc(e.expiry||'—')+'</div>';
    }).join('');
    var kpis='<div class="small">Premiums collected: <b class="mono">$'+prem.toFixed(2)+'</b>'
      +(basis!=null?' · Cost basis: <b class="mono">$'+basis.toFixed(2)+'/sh</b>':'')
      +(p.status==='Closed'&&p.closeProceeds!=null?(' · <b>Realized P/L: <span style="color:var(--'+(((Number(p.closeProceeds)-basis*shares)>=0)?'green':'red')+')">$'+(Number(p.closeProceeds)-basis*shares).toFixed(2)+'</span></b>'):'')
      +'</div>';
    h+='<div class="panel" style="margin-bottom:10px"><h3>'+Util.esc(p.ticker)+' × '+p.contracts
      +' <span class="tag '+(p.status==='Closed'?'':'b-ok')+'">'+Util.esc(status)+'</span></h3>'
      +evHtml+kpis
      +(p.note?'<p class="small hint">'+Util.esc(p.note)+'</p>':'')
      +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">'
      +(p.status!=='Closed'?'<button class="btn sm ghost" data-qw="assign" data-i="'+ix+'">Record assignment</button>':'')
      +(p.status!=='Closed'?'<button class="btn sm ghost" data-qw="cc" data-i="'+ix+'">Sell covered call</button>':'')
      +(p.status!=='Closed'?'<button class="btn sm ghost" data-qw="close" data-i="'+ix+'">Close position</button>':'')
      +'<button class="btn sm ghost" data-qw="note" data-i="'+ix+'">Note</button>'
      +'<button class="btn sm ghost" data-qw="del" data-i="'+ix+'" style="color:var(--red)">Delete</button>'
      +'</div></div>';
  });
  box.innerHTML=h;
  box.querySelectorAll('[data-qw]').forEach(function(b){
    b.addEventListener('click',function(){
      var ix=Number(b.getAttribute('data-i')), act=b.getAttribute('data-qw'), p=qWheelList()[ix];
      if(!p) return;
      if(act==='del'){ if(confirm('Delete this wheel position?')){ qWheelList().splice(ix,1); Store.save(); qWheelDraw(); } return; }
      if(act==='note'){ var n=prompt('Note for '+p.ticker+':', p.note||''); if(n!=null){ p.note=n; Store.save(); qWheelDraw(); } return; }
      if(act==='assign'){
        var ap=prompt('Assignment price per share (= put strike):', p.events&&p.events[0]?p.events[0].strike:'');
        if(ap==null||ap==='') return;
        p.assignedPrice=Number(ap); p.assignedDate=new Date().toISOString().slice(0,10);
        p.status='Assigned — writing CCs'; Store.save(); qWheelDraw(); return;
      }
      if(act==='cc'){
        var k=prompt('Call strike ($):'); if(k==null||k==='') return;
        var pr=prompt('Call premium per share ($):'); if(pr==null||pr==='') return;
        var ex=prompt('Call expiry (e.g. 2026-11-21):',''); if(ex==null) return;
        p.events.push({kind:'CC', strike:Number(k), premium:Number(pr), expiry:ex});
        Store.save(); qWheelDraw(); return;
      }
      if(act==='close'){
        var b2=qWheelBasis(p);
        var cp=prompt('Closing proceeds — total $ received (shares sold + any last premium):'); if(cp==null||cp==='') return;
        p.closeProceeds=Number(cp); p.closedDate=new Date().toISOString().slice(0,10); p.status='Closed';
        Store.save(); qWheelDraw(); return;
      }
    });
  });
}
function qWheelAfter(){
  document.getElementById('qw-add').addEventListener('click',function(){
    var t=tickerVal('qw-ticker');
    var n=Math.max(1,Math.round(Number(document.getElementById('qw-n').value||1)));
    var k=Number(document.getElementById('qw-k').value), pr=Number(document.getElementById('qw-prem').value);
    var ex=document.getElementById('qw-exp').value.trim();
    if(!t||!(k>0)||!(pr>=0)){ alert('Enter a ticker, a strike, and a premium.'); return; }
    qWheelList().unshift({id:'w'+Date.now(), ticker:t, contracts:n, status:'CSP open',
      events:[{kind:'CSP', strike:k, premium:pr, expiry:ex}], assignedPrice:null, note:''});
    Store.save(); qWheelDraw();
    document.getElementById('qw-ticker').value='';
  });
  qWheelDraw();
}
Router.routes['wheel']=function(){ return qWheelHTML(); };
Router.routes['wheel'].after=function(){ qWheelAfter(); };

/* ============================================================
   BLACK-SCHOLES pricer + Greeks (QuantLib-parity formulas)
   N(x): Abramowitz & Stegun 7.1.26. Dividend yield q supported.
   ============================================================ */
function qN(x){
  var a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  var s=x<0?-1:1, ax=Math.abs(x)/Math.sqrt(2), t=1/(1+p*ax);
  var y=1-((((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t)*Math.exp(-ax*ax);
  return 0.5*(1+s*y);
}
function qBS(S,K,T,r,q,sig,isCall){
  if(!(S>0)||!(K>0)||!(T>0)||!(sig>0)) return null;
  var d1=(Math.log(S/K)+(r-q+0.5*sig*sig)*T)/(sig*Math.sqrt(T));
  var d2=d1-sig*Math.sqrt(T);
  var Nd1=qN(d1), Nd2=qN(d2), phi=Math.exp(-0.5*d1*d1)/Math.sqrt(2*Math.PI);
  var dfq=Math.exp(-q*T), dfr=Math.exp(-r*T);
  var price=isCall? S*dfq*Nd1-K*dfr*Nd2 : K*dfr*(1-Nd2)-S*dfq*(1-Nd1);
  var delta=(isCall?Nd1:Nd1-1)*dfq;
  var gamma=dfq*phi/(S*sig*Math.sqrt(T));
  var vega=S*dfq*phi*Math.sqrt(T)/100;
  var thetaC=(-(S*dfq*phi*sig)/(2*Math.sqrt(T)) - r*K*dfr*Nd2 + q*S*dfq*Nd1)/365;
  var thetaP=(-(S*dfq*phi*sig)/(2*Math.sqrt(T)) + r*K*dfr*(1-Nd2) - q*S*dfq*(1-Nd1))/365;
  var rhoC=K*T*dfr*Nd2/100, rhoP=-K*T*dfr*(1-Nd2)/100;
  return {price:price, delta:delta, gamma:gamma, theta:isCall?thetaC:thetaP, vega:vega, rho:isCall?rhoC:rhoP,
    intrinsic:isCall?Math.max(S-K,0):Math.max(K-S,0)};
}
function qBsPanelHTML(){
  return '<div class="panel" style="margin-top:16px"><h3>Black-Scholes pricer + Greeks</h3>'
    +'<p class="hint">Prices a European call/put from your inputs — the same closed-form model QuantLib implements. '
    +'Volatility is <b>your</b> estimate (implied vol is not bundled); this is educational, not advice.</p>'
    +'<div class="grid g4">'
    +'<div>'+fieldRow('Ticker (fills stock price)', tickerInput('qbs-ticker',''))+'</div>'
    +'<div>'+fieldRow('Stock price ($)', numInput('qbs-s','',0.01))+'</div>'
    +'<div>'+fieldRow('Strike ($)', numInput('qbs-k','',0.5))+'</div>'
    +'<div>'+fieldRow('Type', '<select class="in" id="qbs-type"><option value="call">Call</option><option value="put">Put</option></select>')+'</div>'
    +'<div>'+fieldRow('Days to expiry', numInput('qbs-d','30',1))+'</div>'
    +'<div>'+fieldRow('Volatility (%)', numInput('qbs-v','40',1), 'Annualized. Your estimate.')+'</div>'
    +'<div>'+fieldRow('Risk-free rate (%)', numInput('qbs-r','4',0.1))+'</div>'
    +'<div>'+fieldRow('Dividend yield (%)', numInput('qbs-q','0',0.1))+'</div>'
    +'</div><div style="margin:8px 0"><button class="btn sm" id="qbs-go">Price option</button></div>'
    +'<div id="qbs-out"></div></div>';
}
function qBsAfter(){
  var go=document.getElementById('qbs-go'); if(!go) return;
  var tk=document.getElementById('qbs-ticker');
  if(tk) tk.addEventListener('change',function(){
    var t=tickerVal('qbs-ticker'), c=t?lastClose(t):null;
    if(c!=null) document.getElementById('qbs-s').value=c.toFixed(2);
  });
  go.addEventListener('click',function(){
    var S=Number(document.getElementById('qbs-s').value),
        K=Number(document.getElementById('qbs-k').value),
        T=Number(document.getElementById('qbs-d').value)/365,
        v=Number(document.getElementById('qbs-v').value)/100,
        r=Number(document.getElementById('qbs-r').value)/100,
        q=Number(document.getElementById('qbs-q').value)/100,
        isCall=document.getElementById('qbs-type').value==='call';
    var out=document.getElementById('qbs-out');
    var bs=qBS(S,K,T,r,q,v,isCall);
    if(!bs){ out.innerHTML='<div class="empty">Enter a positive stock price, strike, days, and volatility.</div>'; return; }
    var tv=bs.price-bs.intrinsic;
    out.innerHTML='<div class="grid g2"><div class="panel"><h3>Theoretical value</h3>'
      +'<p style="font-size:28px" class="mono">$'+bs.price.toFixed(2)+'</p>'
      +'<p class="small">Intrinsic <b class="mono">$'+bs.intrinsic.toFixed(2)+'</b> · Time value <b class="mono">$'+tv.toFixed(2)+'</b></p></div>'
      +'<div class="panel"><h3>Greeks</h3><table class="tbl"><tbody>'
      +'<tr><td>Delta</td><td class="num mono">'+bs.delta.toFixed(3)+'</td></tr>'
      +'<tr><td>Gamma</td><td class="num mono">'+bs.gamma.toFixed(4)+'</td></tr>'
      +'<tr><td>Theta <span class="hint">/day</span></td><td class="num mono">'+bs.theta.toFixed(3)+'</td></tr>'
      +'<tr><td>Vega <span class="hint">/1% vol</span></td><td class="num mono">'+bs.vega.toFixed(3)+'</td></tr>'
      +'<tr><td>Rho <span class="hint">/1% rate</span></td><td class="num mono">'+bs.rho.toFixed(3)+'</td></tr>'
      +'</tbody></table></div></div>'
      +'<p class="small hint">European exercise, constant volatility, no early exercise — an American option can be worth slightly more. '
      +'Compare against a live quote before trading; a big gap usually means your vol estimate differs from the market\u2019s.</p>';
  });
}

/* ============================================================
   ROTH IRA contribution tracker (limits verified: IRS Notice
   2025-67/2025-71 — 2025: $7,000/$8,000 · 2026: $7,500/$8,600)
   ============================================================ */
var ROTH_LIM={2024:{u50:7000,o50:8000},2025:{u50:7000,o50:8000},2026:{u50:7500,o50:8600}};
function qRothList(){ return Store.db.rothContrib||(Store.db.rothContrib=[]); }
function qRothTrackHTML(){
  var yrs=Object.keys(ROTH_LIM).sort().reverse();
  return '<div class="panel" style="margin-top:16px"><h3>Contribution tracker</h3>'
    +'<p class="hint">Log what you actually contributed each tax year and see your remaining room. Limits verified against IRS notices: '
    +'2025 — $7,000 (under 50) / $8,000 (50+); 2026 — $7,500 / $8,600. Income phaseouts also apply — this tracker does not check them.</p>'
    +'<div class="grid g3">'
    +'<div>'+fieldRow('Tax year', '<select class="in" id="qrt-year">'+yrs.map(function(y){return '<option>'+y+'</option>';}).join('')+'</select>')+'</div>'
    +'<div>'+fieldRow('Amount ($)', numInput('qrt-amt','',1))+'</div>'
    +'<div>'+fieldRow('Age 50+ this year?', '<select class="in" id="qrt-50"><option value="0">No</option><option value="1">Yes</option></select>')+'</div>'
    +'</div><div style="margin:8px 0"><button class="btn sm" id="qrt-add">Log contribution</button></div>'
    +'<div id="qrt-table"></div></div>';
}
function qRothTrackDraw(){
  var box=document.getElementById('qrt-table'); if(!box) return;
  var list=qRothList();
  var byY={};
  list.forEach(function(e){ (byY[e.year]=byY[e.year]||[]).push(e); });
  var yrs=Object.keys(ROTH_LIM).sort().reverse();
  var h='<table class="tbl"><thead><tr><th>Year</th><th class="num">Contributed</th><th class="num">Limit</th><th class="num">Room left</th><th></th></tr></thead><tbody>';
  yrs.forEach(function(y){
    var es=byY[y]||[];
    var tot=es.reduce(function(a,e){ return a+Number(e.amount||0); },0);
    var lim=ROTH_LIM[y][(es[0]&&es[0].o50)?'o50':'u50'];
    var left=lim-tot;
    h+='<tr><td><b>'+y+'</b></td><td class="num mono">$'+tot.toLocaleString()+'</td>'
      +'<td class="num mono">$'+lim.toLocaleString()+'</td>'
      +'<td class="num mono" style="color:var(--'+(left<0?'red':'green')+')">$'+left.toLocaleString()+'</td>'
      +'<td class="small">'+es.map(function(e,i){
          return '<span class="tag">$'+Number(e.amount).toLocaleString()+' <a href="javascript:void(0)" data-qrt-del="'+y+':'+list.indexOf(e)+'" style="color:var(--red)">×</a></span> ';
        }).join('')+'</td></tr>';
  });
  h+='</tbody></table>';
  if(!list.length) h+='<p class="small hint">Nothing logged yet.</p>';
  box.innerHTML=h;
  box.querySelectorAll('[data-qrt-del]').forEach(function(a){
    a.addEventListener('click',function(){
      var ix=Number(a.getAttribute('data-qrt-del').split(':')[1]);
      qRothList().splice(ix,1); Store.save(); qRothTrackDraw();
    });
  });
}
function qRothTrackAfter(){
  var add=document.getElementById('qrt-add'); if(!add) return;
  add.addEventListener('click',function(){
    var y=document.getElementById('qrt-year').value;
    var amt=Number(document.getElementById('qrt-amt').value);
    var o50=document.getElementById('qrt-50').value==='1';
    if(!(amt>0)){ alert('Enter an amount.'); return; }
    qRothList().push({year:y, amount:amt, o50:o50?1:0, date:new Date().toISOString().slice(0,10)});
    Store.save(); qRothTrackDraw();
    document.getElementById('qrt-amt').value='';
  });
  qRothTrackDraw();
}

/* ---------------- NAV + Store wiring ---------------- */
(function(){
  var add=[
    {id:'screener', title:'Stock Screener', icon:'filter', crumb:'suite / screener'},
    {id:'portlab', title:'Portfolio Lab', icon:'pie_chart', crumb:'suite / portfolio lab'},
    {id:'wheel', title:'Wheel Tracker', icon:'repeat', crumb:'suite / wheel'}
  ];
  var ix=NAV.findIndex(function(n){ return n.id==='options'; });
  var args=[ix<0?NAV.length:ix+1, 0].concat(add);
  Array.prototype.splice.apply(NAV, args);
})();
