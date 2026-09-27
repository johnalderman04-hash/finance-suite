/* 10-discovery.js — Market Scanner + Gamma Exposure (bundled discovery snapshot) */
'use strict';

/* ---------------- data access ---------------- */
function dRaw(){ return window.__DISCOVERY__||null; }
var AR_MAP={'Strong Buy':4,'Buy':3,'Hold':2,'Underperform':1,'Sell':0};
var _dStocks=null;
function dStocks(){
  if(_dStocks) return _dStocks;
  _dStocks=[];
  var r=dRaw();
  if(!r||!r.stocks) return _dStocks;
  Object.keys(r.stocks).forEach(function(sym){
    var o=r.stocks[sym];
    var ar=(o.con&&AR_MAP[o.con]!=null)?AR_MAP[o.con]:null;
    _dStocks.push({
      sym:sym, name:o.n||'', sector:o.sec||'', ind:o.ind||'', price:o.p||0,
      mcap:(o.mc||0)*1e9, yield:o.divy||0, target:o.tgt||0,
      upside:(o.tgt&&o.p)?(o.tgt-o.p)/o.p*100:null,
      ar:ar, arn:o.anN||0, mom12:o.mom12, mom6:o.mom6, hv:o.hv,
      hi52:o.hi52||0, lo52:o.lo52||0,
      seas:(o.seas&&o.seas.avg)||[], hit:(o.seas&&o.seas.pos)||[],
      dvol:(o.p||0)*(o.vol||0), avgvol:o.avgvol||0, pe:o.pe||0, beta:o.beta||0
    });
  });
  return _dStocks;
}
function dGet(sym){
  var ss=dStocks();
  for(var i=0;i<ss.length;i++) if(ss[i].sym===sym) return ss[i];
  return null;
}
function dBadge(){
  var r=dRaw();
  if(!r) return '';
  return Fresh.badge('DAILY','Refreshed when the file is rebuilt')+' '+Fresh.badge('DELAYED','Options: CBOE delayed chains')+' '
    +'<span class="asof">Discovery data as of '+Util.esc(r.asof)+' · Sources: Nasdaq, Yahoo Finance, CBOE (delayed) · refreshes when the file is rebuilt</span>';
}
var AR_TXT=['Sell','Underperform','Hold','Buy','Strong Buy'];
function dArTxt(ar){ return ar==null?'n/a':(AR_TXT[ar]||'n/a'); }
function dArColor(ar){
  if(ar==null) return '#8b949e';
  if(ar>=3) return '#3fb950'; if(ar===2) return '#f0b429'; return '#f85149';
}
var MON3=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/* ---------------- strategy scores (0-100, transparent heuristics) ---------------- */
function dScoreWheel(s){
  var parts=[];
  function add(max, ok, label){ parts.push({label:label, got:ok?max:0, max:max}); return ok?max:0; }
  var sc=0;
  sc+=add(25, s.price>=5&&s.price<=150, 'Price $5–$150 (assignment-friendly)');
  sc+=add(20, s.mcap>=10e9, 'Market cap ≥ $10B (liquid)');
  sc+=add(20, s.hv!=null&&s.hv>=15&&s.hv<=50, 'Hist. volatility 15–50% (premium worth collecting)');
  sc+=add(10, (s.yield||0)>0, 'Pays a dividend');
  sc+=add(15, s.ar==null||s.ar>=2, 'Analyst consensus not Sell');
  sc+=add(10, (s.dvol||0)>=50e6, 'Dollar volume ≥ $50M/day');
  return {score:sc, parts:parts};
}
function dScoreLeaps(s){
  // Five-category model (my own formulas; weights shown). Not affiliated with any paid product.
  var o=(dRaw().opt||{})[s.sym]||{};
  var cats=[];
  // Trend 25%: 12m + 6m momentum + position vs 52w high
  var t=0;
  if(s.mom12!=null) t+= s.mom12>30?45 : s.mom12>10?35 : s.mom12>0?22 : 8;
  if(s.mom6!=null) t+= s.mom6>10?30 : s.mom6>0?20 : 8;
  if(s.hi52&&s.price){ var off=(s.hi52-s.price)/s.hi52*100; t+= off<10?25 : off<25?18 : 8; }
  cats.push({name:'Trend', w:25, score:Math.min(100,Math.round(t)),
             note:'12m/6m momentum, distance from 52-week high'});
  // Implied vol 15%: lower = cheaper LEAPS
  var iv=(o.iv30||0)>0?o.iv30:s.hv, ivl=(o.iv30||0)>0?'IV30 (CBOE delayed)':'hist. vol proxy (no IV in snapshot)';
  var v= iv==null?50 : iv<25?100 : iv<35?75 : iv<50?50 : 25;
  cats.push({name:'Implied vol', w:15, score:v, note:'lower = cheaper LEAPS · '+ivl});
  // Quality 25%: analyst rating, size, dividend, target upside
  var q=0;
  q+= s.ar==null?15 : s.ar>=4?45 : s.ar>=3?35 : s.ar>=2?22 : 8;
  q+= s.mcap>=100e9?30 : s.mcap>=20e9?24 : s.mcap>=2e9?14 : 6;
  q+= (s.yield||0)>0?15:5;
  q+= s.upside!=null&&s.upside>15?10 : s.upside!=null&&s.upside>0?6 : 2;
  cats.push({name:'Quality', w:25, score:Math.min(100,Math.round(q)),
             note:'analyst rating, market cap, dividend, target upside'});
  // Entry 15%: % off 52w high + next-month seasonality
  var e=50, offH=null, um=dUpcomingMonth();
  if(s.hi52&&s.price){ offH=(s.hi52-s.price)/s.hi52*100;
    e= offH>=8&&offH<=20?100 : offH<5?55 : offH<30?70 : 35; }
  if(s.seas[um]!=null) e=Math.max(0,Math.min(100, e+(s.seas[um]>0?8:-8)));
  cats.push({name:'Entry', w:15, score:Math.round(e),
             note:offH==null?'n/a':offH.toFixed(1)+'% off 52w high · '+MON3[um]+' seasonality '+(s.seas[um]==null?'n/a':(s.seas[um]>=0?'+':'')+s.seas[um].toFixed(1)+'%')});
  // Option economics 20%: 1y ~0.70Δ call cost, breakeven vs analyst target
  var oe=50, oel='no options snapshot for this ticker — neutral';
  if(o.leap&&s.price){
    var l=o.leap; oe=0;
    oe+= l.costpct<15?40 : l.costpct<25?26 : 12;
    var cush=(s.target&&l.breakeven)?(s.target-l.breakeven)/s.target*100:null;
    oe+= cush==null?20 : cush>5?40 : cush>0?28 : 10;
    oe+= Math.abs((l.delta||0.7)-0.70)<0.08?20:12;
    oel='1y ~0.70Δ call · breakeven $'+l.breakeven.toFixed(2)+' ('+(l.bepct>=0?'+':'')+l.bepct+'%)';
  }
  cats.push({name:'Option economics', w:20, score:Math.round(oe), note:oel});
  var sc=Math.round(cats.reduce(function(a,c){ return a+c.score*c.w/100; },0));
  return {score:sc, cats:cats};
}
function dScoreSpread(s){
  var parts=[];
  function add(max, ok, label){ parts.push({label:label, got:ok?max:0, max:max}); return ok?max:0; }
  var sc=0;
  sc+=add(30, s.hv!=null&&s.hv>=30, 'Hist. volatility ≥ 30% (premium-rich)');
  sc+=add(25, (s.dvol||0)>=100e6, 'Dollar volume ≥ $100M/day');
  sc+=add(15, s.price>=25, 'Price ≥ $25 (spread width practical)');
  sc+=add(15, s.ar==null||s.ar>=2, 'Analyst consensus not Sell');
  sc+=add(15, s.mom12!=null&&s.mom12>0, '12-month momentum positive');
  return {score:sc, parts:parts};
}
function dScoreFor(preset, s){
  if(preset==='leaps') return dScoreLeaps(s);
  if(preset==='spreads') return dScoreSpread(s);
  return dScoreWheel(s);
}
function dScoreBadge(sc){
  var c=sc>=70?'b-ok':sc>=45?'b-warn':'';
  return '<span class="tag '+c+'"><b>'+sc+'</b></span>';
}

/* ---------------- seasonality ---------------- */
function dSeasSVG(s, hlMonth){
  var W=680,H=210, n=12;
  var vals=s.seas.map(function(v){ return v==null?0:v; });
  var mx=Math.max.apply(null, vals.map(function(v){return Math.abs(v);}).concat([1]));
  var bw=(W-40)/n;
  var X=function(i){ return 30+i*bw; };
  var Y0=H-34-(H-70)/2;
  var yy=function(v){ return Y0-(v/mx)*((H-70)/2); };
  var h='<svg viewBox="0 0 '+W+' '+H+'" class="chart">';
  h+='<line x1="30" y1="'+Y0+'" x2="'+(W-10)+'" y2="'+Y0+'" stroke="#30363d"/>';
  for(var i=0;i<12;i++){
    var v=s.seas[i], hit=s.hit[i];
    var x=X(i)+3, w=bw-6;
    var y1=yy(Math.max(v,0)), y2=yy(Math.min(v,0));
    var col=v>0?'#3fb950':v<0?'#f85149':'#30363d';
    if(hlMonth===i){ h+='<rect x="'+X(i)+'" y="8" width="'+bw+'" height="'+(H-42)+'" fill="#f0b429" opacity="0.08"/>'; }
    h+='<rect x="'+x.toFixed(1)+'" y="'+Math.min(y1,y2).toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+Math.max(Math.abs(y2-y1),2).toFixed(1)+'" fill="'+col+'" opacity="0.85"/>';
    if(v!=null){
      h+='<text x="'+(x+w/2).toFixed(1)+'" y="'+(v>=0?Math.min(y1,y2)-5:Math.max(y1,y2)+13).toFixed(1)+'" text-anchor="middle" class="chart-lab" fill="'+col+'">'+v.toFixed(1)+'%</text>';
      if(hit!=null) h+='<text x="'+(x+w/2).toFixed(1)+'" y="'+(H-20).toFixed(1)+'" text-anchor="middle" class="chart-lab" fill="#8b949e">'+hit.toFixed(0)+'%</text>';
    }
    h+='<text x="'+(x+w/2).toFixed(1)+'" y="'+(H-8).toFixed(1)+'" text-anchor="middle" class="chart-lab" fill="'+(hlMonth===i?'#f0b429':'#8b949e')+'">'+MON3[i]+'</text>';
  }
  h+='<text x="34" y="18" class="chart-lab" fill="#8b949e">avg monthly return (10y) · lower number = % of years positive</text></svg>';
  return h;
}
function dSeasBest(s){
  var order=[];
  for(var i=0;i<12;i++) if(s.seas[i]!=null) order.push({m:i, v:s.seas[i], h:s.hit[i]});
  order.sort(function(a,b){ return b.v-a.v; });
  return order;
}
function dUpcomingMonth(){
  var m=new Date().getMonth();
  return (m+1)%12;
}

/* ---------------- LEAP economics box ---------------- */
function dLeapBox(s){
  var o=(dRaw().opt||{})[s.sym];
  if(!o||!o.leap) return '<p class="small dim">No LEAP snapshot for '+Util.esc(s.sym)+'. Options snapshots cover the 75 most liquid names — the rest score on Trend/Quality/Entry only.</p>';
  var l=o.leap;
  var cush=s.target?((s.target-l.breakeven)/s.target*100):null;
  var cards=[
    ['LEAP strike','$'+l.strike.toFixed(2)+' · '+l.dte+'d','#e6edf3','~0.70Δ call · Δ '+l.delta.toFixed(2)],
    ['Breakeven','$'+l.breakeven.toFixed(2)+' ('+(l.bepct>=0?'+':'')+l.bepct+'%)', l.bepct<=12?'#3fb950':'#f0b429','strike + $'+l.mid.toFixed(2)+' premium'],
    ['Cost (% of spot)',l.costpct.toFixed(1)+'%','#a371f7','$'+l.mid.toFixed(2)+' premium'],
    ['Cushion vs target', cush==null?'—':(cush>=0?'+':'')+cush.toFixed(1)+'%', cush!=null&&cush>=0?'#3fb950':'#f85149', s.target?('target $'+s.target.toFixed(2)):'no target in snapshot'],
    ['IV at LEAP expiry',l.iv.toFixed(1)+'%','#8b949e','vs 30-day '+(o.iv30?o.iv30.toFixed(1)+'%':'n/a')+(o.iv30&&l.iv>o.iv30?' · back month richer':'')]
  ];
  return '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:8px 0">'
    +cards.map(function(c){
      return '<div class="panel" style="padding:10px 12px;margin:0"><div class="small dim">'+c[0]+'</div><div style="font-size:17px;font-weight:700;color:'+c[2]+'">'+c[1]+'</div><div class="small dim">'+c[3]+'</div></div>';
    }).join('')+'</div>'
    +'<p class="small hint">Standardized ~1-year, ~0.70-delta call from the delayed CBOE snapshot (not live). Breakeven = strike + premium.</p>';
}

/* ============================================================
   MARKET SCANNER
   ============================================================ */
var DScr={preset:'wheel', minP:'5', maxP:'', minMc:'', sector:'', minAr:'', minScore:'', sort:'score', dir:-1, detail:null, seasM:''};
function dSectors(){
  var seen={}, out=[];
  dStocks().forEach(function(s){ if(s.sector&&!seen[s.sector]){ seen[s.sector]=1; out.push(s.sector); } });
  return out.sort();
}
function dScannerHTML(){
  if(!dRaw()) return '<div class="panel"><h2>Market Scanner</h2><div class="empty">Discovery data is not bundled in this file. Rebuild the file to include it.</div></div>';
  var presets=[['wheel','Wheel'],['leaps','LEAPS'],['spreads','Credit Spreads'],['swing','Swing'],['seas','Seasonality'],['all','All']];
  var h='<div class="panel"><h2><span class="ico">'+icon('zap')+'</span> Market Scanner '+dBadge()+'</h2>'
    +'<p class="hint">'+dStocks().length+' US stocks priced ≥ $5. Suitability scores blend bundled history, liquidity and analyst consensus — '
    +'they are <b>not</b> based on live options chains and are not recommendations. Seasonality = average monthly return over the last 10 years. '
    +'LEAPS tab uses a 5-category model (Trend 25 · Implied vol 15 · Quality 25 · Entry 15 · Option economics 20); option economics uses the delayed CBOE snapshot for the 75 most liquid names.</p>'
    +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">'
    +presets.map(function(p){ return '<button class="btn sm'+(DScr.preset===p[0]?'':' ghost')+'" data-dsc-preset="'+p[0]+'">'+p[1]+'</button>'; }).join('')
    +'</div>'
    +'<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:10px">'
    +'<label class="f">Min price ($)<input class="in" id="dsc-minp" type="number" min="0" step="1" value="'+Util.esc(DScr.minP)+'"></label>'
    +'<label class="f">Max price ($)<input class="in" id="dsc-maxp" type="number" min="0" step="1" value="'+Util.esc(DScr.maxP)+'" placeholder="any"></label>'
    +'<label class="f">Min mkt cap ($B)<input class="in" id="dsc-minmc" type="number" min="0" step="1" value="'+Util.esc(DScr.minMc)+'" placeholder="any"></label>'
    +'<label class="f">Sector<select class="in" id="dsc-sector"><option value="">All sectors</option>'
    +dSectors().map(function(s){ return '<option value="'+Util.esc(s)+'"'+(DScr.sector===s?' selected':'')+'>'+Util.esc(s)+'</option>'; }).join('')
    +'</select></label>'
    +'<label class="f">Analyst<select class="in" id="dsc-minar"><option value="">Any</option>'
    +'<option value="2"'+(DScr.minAr==='2'?' selected':'')+'>Hold or better</option>'
    +'<option value="3"'+(DScr.minAr==='3'?' selected':'')+'>Buy or better</option></select></label>'
    +'<label class="f">Min score<input class="in" id="dsc-minscore" type="number" min="0" max="100" step="5" value="'+Util.esc(DScr.minScore)+'" placeholder="0"></label>'
    +'<label class="f">Sort by<select class="in" id="dsc-sort">'
    +[['score','Score'],['price','Price'],['mcap','Market cap'],['upside','Target upside'],['mom12','12m momentum'],['hv','Volatility'],['seas','Seasonality (next mo)']].map(function(o){
        return '<option value="'+o[0]+'"'+(DScr.sort===o[0]?' selected':'')+'>'+o[1]+'</option>'; }).join('')
    +'</select></label>'
    +(DScr.preset==='seas'?'<label class="f">Season month<select class="in" id="dsc-seasm">'+MON3.map(function(m,i){
        return '<option value="'+i+'"'+(String(DScr.seasM)===''&&i===dUpcomingMonth()||String(DScr.seasM)===String(i)?' selected':'')+'>'+m+'</option>'; }).join('')+'</select></label>':'')
    +'</div>'
    +'<div style="display:flex;gap:8px;margin-bottom:10px"><button class="btn sm" id="dsc-go">Apply</button>'
    +'<button class="btn sm ghost" id="dsc-dir">'+(DScr.dir<0?'↓ desc':'↑ asc')+'</button>'
    +'<button class="btn sm ghost" id="dsc-clear">Clear</button>'
    +'<button class="btn sm ghost" id="dsc-csv">Export CSV</button></div>'
    +'<div id="dsc-table"></div><div id="dsc-detail"></div></div>';
  return h;
}
function dFiltered(){
  var minP=parseFloat(DScr.minP), maxP=parseFloat(DScr.maxP),
      minMc=parseFloat(DScr.minMc), minAr=parseInt(DScr.minAr,10),
      minScore=parseFloat(DScr.minScore);
  var rows=dStocks().map(function(s){
    var sc=dScoreFor(DScr.preset==='all'?'wheel':DScr.preset, s);
    return {s:s, score:sc.score, parts:sc.parts, cats:sc.cats};
  });
  rows=rows.filter(function(r){
    var s=r.s;
    if(!isNaN(minP)&&s.price<minP) return false;
    if(!isNaN(maxP)&&s.price>maxP) return false;
    if(!isNaN(minMc)&&s.mcap<minMc*1e9) return false;
    if(DScr.sector&&s.sector!==DScr.sector) return false;
    if(!isNaN(minAr)&&(s.ar==null||s.ar<minAr)) return false;
    if(!isNaN(minScore)&&r.score<minScore) return false;
    return true;
  });
  var um=dUpcomingMonth();
  function key(r){
    var s=r.s;
    switch(DScr.sort){
      case 'price': return s.price;
      case 'mcap': return s.mcap;
      case 'upside': return s.upside==null?-1e9:s.upside;
      case 'mom12': return s.mom12==null?-1e9:s.mom12;
      case 'hv': return s.hv==null?-1e9:s.hv;
      case 'seas': return (s.seas[um]==null?-1e9:s.seas[um]);
      default: return r.score;
    }
  }
  if(DScr.preset==='swing'){
    rows.forEach(function(r){ r.score=r.s.mom6==null?0:Math.max(0,Math.min(100,50+r.s.mom6*2)); });
    if(DScr.sort==='score') rows.sort(function(a,b){ return (b.s.mom6||-1e9)-(a.s.mom6||-1e9); });
    else rows.sort(function(a,b){ return (key(b)-key(a))*(DScr.dir<0?1:-1); });
  } else if(DScr.preset==='seas'){
    var sm=DScr.seasM==='' ? um : parseInt(DScr.seasM,10);
    rows.forEach(function(r){ r.seasM=sm; });
    rows.sort(function(a,b){
      var av=a.s.seas[sm]==null?-1e9:a.s.seas[sm], bv=b.s.seas[sm]==null?-1e9:b.s.seas[sm];
      return (bv-av)*(DScr.dir<0?1:-1);
    });
  } else {
    rows.sort(function(a,b){ return (key(b)-key(a))*(DScr.dir<0?1:-1); });
  }
  return rows;
}
function dScannerDraw(){
  var box=document.getElementById('dsc-table'); if(!box) return;
  var rows=dFiltered().slice(0,400);
  var um=dUpcomingMonth();
  var showScore=(DScr.preset==='wheel'||DScr.preset==='leaps'||DScr.preset==='spreads');
  var h='<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Symbol</th><th>Price</th><th>Mkt Cap</th>'
    +'<th>Analyst</th><th>Target Upside</th>'
    +(showScore?'<th>'+({wheel:'Wheel',leaps:'LEAPS',spreads:'Spread'})[DScr.preset]+' Score</th>':'')
    +(DScr.preset==='swing'?'<th>Swing (6m)</th>':'')
    +(DScr.preset==='seas'?'<th>'+MON3[DScr.seasM==='' ? um : parseInt(DScr.seasM,10)]+' Avg</th>':'')
    +'<th>'+MON3[um]+' Avg</th><th>12m Mom</th><th>HV</th></tr></thead><tbody>';
  rows.forEach(function(r){
    var s=r.s;
    var seasTxt=s.seas[um]==null?'—':(s.seas[um]>=0?'+':'')+s.seas[um].toFixed(1)+'%';
    h+='<tr data-dsc-sym="'+s.sym+'" style="cursor:pointer">'
      +'<td><b>'+Util.esc(s.sym)+'</b><div class="small dim">'+Util.esc(s.name)+'</div></td>'
      +'<td>$'+s.price.toFixed(2)+'</td>'
      +'<td>'+Util.money(s.mcap)+'</td>'
      +'<td><span style="color:'+dArColor(s.ar)+'">'+dArTxt(s.ar)+'</span>'+(s.arn?' <span class="small dim">('+s.arn+')</span>':'')+'</td>'
      +'<td>'+(s.upside==null?'—':'<span style="color:'+(s.upside>=0?'#3fb950':'#f85149')+'">'+(s.upside>=0?'+':'')+s.upside.toFixed(1)+'%</span>')+'</td>'
      +(showScore?'<td>'+dScoreBadge(r.score)+'</td>':'')
      +(DScr.preset==='swing'?'<td>'+(s.mom6==null?'—':(s.mom6>=0?'+':'')+s.mom6.toFixed(1)+'%')+'</td>':'')
      +(DScr.preset==='seas'?'<td>'+(s.seas[r.seasM]==null?'—':(s.seas[r.seasM]>=0?'+':'')+s.seas[r.seasM].toFixed(1)+'%')+'</td>':'')
      +'<td>'+seasTxt+'</td>'
      +'<td>'+(s.mom12==null?'—':(s.mom12>=0?'+':'')+s.mom12.toFixed(1)+'%')+'</td>'
      +'<td>'+(s.hv==null?'—':s.hv.toFixed(1)+'%')+'</td></tr>';
  });
  h+='</tbody></table></div><p class="small hint">Showing '+rows.length+' of '+dFiltered().length+' matches (capped at 400). Click a row for seasonality, analyst and score detail.</p>';
  box.innerHTML=h;
  box.querySelectorAll('tr[data-dsc-sym]').forEach(function(tr){
    tr.addEventListener('click', function(){ DScr.detail=tr.getAttribute('data-dsc-sym'); dDetailDraw(); });
  });
  dDetailDraw();
}
function dDetailDraw(){
  var box=document.getElementById('dsc-detail'); if(!box) return;
  if(!DScr.detail){ box.innerHTML=''; return; }
  var s=dGet(DScr.detail);
  if(!s){ box.innerHTML=''; return; }
  var r0=dRaw();
  var o0=r0&&r0.opt?r0.opt[s.sym]:null;
  /* NOTE: no Hist.save here — WC.panel reads the previous snapshot, renders
     the comparison, and saves the current one itself. */
  var um=dUpcomingMonth();
  var best=dSeasBest(s);
  var preset=DScr.preset;
  var sc=dScoreFor(preset==='all'?'wheel':preset, s);
  var scLbl=({wheel:'Wheel',leaps:'LEAPS',spreads:'Credit Spreads'})[preset]||null;
  var h='<div class="panel" style="margin-top:12px"><h3>'+Util.esc(s.sym)+' <span class="small dim">'+Util.esc(s.name)+' · '+Util.esc(s.sector||'—')+'</span>'
    +' <a class="btn sm ghost" href="#/rmode/'+Util.esc(s.sym)+'" style="margin-left:8px">Research Mode →</a></h3>'
    +'<div class="grid" style="grid-template-columns:1fr 1fr;gap:14px">'
    +'<div><h4>Seasonality (15y monthly)</h4>'+dSeasSVG(s, um)
    +'<p class="small hint">Best: '+(best.length?MON3[best[0].m]+' (+'+best[0].v.toFixed(1)+'%, '+best[0].h.toFixed(0)+'% hit)':'—')
    +' · Worst: '+(best.length?MON3[best[best.length-1].m]+' ('+best[best.length-1].v.toFixed(1)+'%)':'—')+'</p></div>'
    +'<div><h4>Analyst consensus</h4>'
    +'<p><b style="color:'+dArColor(s.ar)+'">'+dArTxt(s.ar)+'</b>'+(s.arn?' <span class="small dim">· '+s.arn+' analysts (Nasdaq)</span>':'')+'</p>'
    +(s.target?'<p class="small">Mean target $'+s.target.toFixed(2)+' → '+(s.upside>=0?'+':'')+s.upside.toFixed(1)+'% upside at $'+s.price.toFixed(2)+'</p>':'<p class="small dim">No mean target in snapshot.</p>');
  if(scLbl){
    h+='<h4 style="margin-top:10px">'+scLbl+' score: '+sc.score+'/100</h4>';
    if(sc.cats){
      h+=sc.cats.map(function(c){
        return '<div class="small" style="margin:4px 0"><div style="display:flex;justify-content:space-between;gap:8px">'
          +'<span><b>'+Util.esc(c.name)+'</b> <span class="dim">'+c.w+'%</span></span><span><b>'+c.score+'</b></span></div>'
          +'<div style="height:6px;background:#21262d;border-radius:3px"><div style="height:6px;width:'+c.score+'%;background:'+(c.score>=70?'#3fb950':c.score>=45?'#f0b429':'#f85149')+';border-radius:3px"></div></div>'
          +'<div class="dim">'+Util.esc(c.note)+'</div></div>';
      }).join('');
    } else if(sc.parts){
      h+=sc.parts.map(function(p){
        return '<div class="small" style="display:flex;justify-content:space-between;gap:8px;padding:2px 0;border-bottom:1px solid #21262d">'
          +'<span style="color:'+(p.got>0?'#3fb950':'#8b949e')+'">'+(p.got>0?'✓':'○')+' '+Util.esc(p.label)+'</span><span class="dim">'+p.got+'/'+p.max+'</span></div>';
      }).join('');
    }
  }
  if(preset==='leaps'){
    h+='<h4 style="margin-top:10px">LEAP economics (~1-year 0.70Δ call)</h4>'+dLeapBox(s)
      +'<p class="small"><a href="#/gamma">Open '+Util.esc(s.sym)+' on the Gamma Exposure page →</a></p>';
  }
  h+='<h4 style="margin-top:10px">Key stats</h4>'
    +'<p class="small">Price $'+s.price.toFixed(2)+' · Mkt cap '+Util.money(s.mcap)+' · HV '+(s.hv==null?'—':s.hv.toFixed(1)+'%')
    +' · 12m '+(s.mom12==null?'—':(s.mom12>=0?'+':'')+s.mom12.toFixed(1)+'%')
    +' · 6m '+(s.mom6==null?'—':(s.mom6>=0?'+':'')+s.mom6.toFixed(1)+'%')
    +(s.hi52?' · 52w $'+s.lo52.toFixed(2)+'–$'+s.hi52.toFixed(2):'')
    +(s.yield?' · Div '+s.yield.toFixed(2)+'%':'')+'</p>'
    +'<p class="small hint">Scores use bundled snapshot data only — not live options chains, not advice.</p>'
    +'<div id="dsc-live" class="small hint"></div>'
    +'</div>'+WC.panel(s.sym,{asof:r0?r0.asof:null, price:s.price, target:s.target, upside:s.upside,
      net:o0?o0.net:null, flip:o0?o0.flip:null, callwall:o0?o0.callwall:null, putwall:o0?o0.putwall:null,
      maxpain:o0?o0.maxpain:null, iv30:o0?o0.iv30:null})+'</div>';
  box.innerHTML=h;
  (function(){
    var el=document.getElementById('dsc-live'); if(!el) return;
    var r0=dRaw();
    el.innerHTML='Snapshot price $'+s.price.toFixed(2)+' (bundled '+Util.esc(r0.asof)+').';
    if(typeof LiveQuotes==='undefined'||!LiveQuotes.provider()){ el.innerHTML+=' <span class="dim">Add a free API key in Settings for a live quote.</span>'; return; }
    LiveQuotes.get([s.sym]).then(function(res){
      var box2=document.getElementById('dsc-live'); if(!box2) return;
      var q=res[s.sym];
      if(q&&q.ok) box2.innerHTML='Snapshot $'+s.price.toFixed(2)+' ('+Util.esc(r0.asof)+') · <b>Live $'+Util.num(q.q.px,2)+'</b> '+LiveQuotes.badge(q.q);
    }).catch(function(){});
  })();
}
function dExportCSV(){
  var rows=dFiltered(), r=dRaw();
  var head=['symbol','name','sector','price','mktcap','analyst','n_analysts','mean_target','upside_pct','hv_pct','mom6_pct','mom12_pct','hi52','lo52','div_yield','score'];
  function q(v){ v=(v==null?'':String(v)); return '"'+v.replace(/"/g,'""')+'"'; }
  function f(v,d){ return v==null?'':Number(v).toFixed(d==null?2:d); }
  var lines=[head.join(',')].concat(rows.map(function(x){
    var s=x.s;
    return [s.sym,q(s.name),q(s.sector||''),f(s.price),Math.round(s.mcap||0),q(dArTxt(s.ar)),s.arn||'',
      f(s.target),s.upside==null?'':s.upside.toFixed(1),s.hv==null?'':s.hv.toFixed(1),
      s.mom6==null?'':s.mom6.toFixed(1),s.mom12==null?'':s.mom12.toFixed(1),
      f(s.hi52),f(s.lo52),s.yield==null?'':s.yield.toFixed(2),x.score].join(',');
  }));
  var blob=new Blob([lines.join('\n')],{type:'text/csv'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='finance-suite-scanner-'+(r&&r.asof||'snapshot')+'.csv';
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },500);
}
function dScannerAfter(){
  function read(){
    DScr.minP=document.getElementById('dsc-minp').value.trim();
    DScr.maxP=document.getElementById('dsc-maxp').value.trim();
    DScr.minMc=document.getElementById('dsc-minmc').value.trim();
    DScr.sector=document.getElementById('dsc-sector').value;
    DScr.minAr=document.getElementById('dsc-minar').value;
    DScr.minScore=document.getElementById('dsc-minscore').value.trim();
    DScr.sort=document.getElementById('dsc-sort').value;
    var sm=document.getElementById('dsc-seasm'); if(sm) DScr.seasM=sm.value;
  }
  document.querySelectorAll('[data-dsc-preset]').forEach(function(b){
    b.addEventListener('click', function(){ read(); DScr.preset=b.getAttribute('data-dsc-preset'); DScr.detail=null; Router.render(); });
  });
  document.getElementById('dsc-go').addEventListener('click', function(){ read(); DScr.detail=null; dScannerDraw(); });
  document.getElementById('dsc-csv').addEventListener('click', function(){ read(); dExportCSV(); });
  document.getElementById('dsc-dir').addEventListener('click', function(){ read(); DScr.dir*=-1; this.textContent=(DScr.dir<0?'↓ desc':'↑ asc'); dScannerDraw(); });
  document.getElementById('dsc-clear').addEventListener('click', function(){
    DScr={preset:DScr.preset, minP:'5', maxP:'', minMc:'', sector:'', minAr:'', minScore:'', sort:'score', dir:-1, detail:null, seasM:''};
    Router.render();
  });
  dScannerDraw();
}
Router.routes['scanner']=function(param){ if(param) DScr.detail=String(param).toUpperCase(); return dScannerHTML(); };
Router.routes['scanner'].after=function(){ dScannerAfter(); };

/* ============================================================
   GAMMA EXPOSURE (GEX) — CBOE delayed chains, bundled snapshot
   ============================================================ */
var DGX={sym:'AAPL'};
function dOptSyms(){
  var r=dRaw(); return r&&r.opt?Object.keys(r.opt).sort():[];
}
function dGammaHTML(){
  var syms=dOptSyms();
  if(!syms.length) return '<div class="panel"><h2>Gamma Exposure</h2><div class="empty">Options snapshots are not bundled in this file. Rebuild the file to include them.</div></div>';
  var unknown=null;
  if(syms.indexOf(DGX.sym)<0){ if(DGX.sym&&DGX.sym!==syms[0]) unknown=DGX.sym; DGX.sym=syms[0]; }
  var h='<div class="panel"><h2><span class="ico">'+icon('chart_column')+'</span> Gamma Exposure '+dBadge()+'</h2>'
    +'<p class="hint">Net dealer gamma by strike, combined across the <b>three nearest monthly expirations</b>, from CBOE <b>delayed</b> options chains (bundled snapshot — not live). '
    +'Positive gamma = dealers long gamma (calmer, pinning); negative = short gamma (choppier). For education, not trading advice. '
    +mi('gex')+'</p>'
    +(unknown?'<div class="alert warn">No options snapshot for <b>'+Util.esc(unknown)+'</b> — snapshots cover the '+syms.length+' most liquid names. Showing '+Util.esc(DGX.sym)+' instead; pick another ticker below.</div>':'')
    +'<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:10px">'
    +'<label class="f">Ticker<input class="in" id="dgx-sym" list="dgx-syms" value="'+Util.esc(DGX.sym)+'" style="text-transform:uppercase"><datalist id="dgx-syms">'
    +syms.map(function(s){ return '<option value="'+s+'">'; }).join('')+'</datalist></label>'
    +'<button class="btn sm" id="dgx-go">Load</button></div>'
    +'<div id="dgx-body"></div></div>';
  return h;
}
function dGexSVG(sym, o){
  var ks=o.k, gs=o.g, S=o.spot, n=ks.length;
  var W=760,H=300;
  var vals=gs.map(function(g){ return g*1000; }); // collector stores $B per 1% move → $M per 1% move
  var mx=Math.max.apply(null, vals.map(function(v){return Math.abs(v);}).concat([0.01]));
  var L=56,R=14,T=26,B=40;
  var X=function(i){ return L+i*(W-L-R)/Math.max(n-1,1); };
  var Y=function(v){ return T+(1-(v+mx)/(2*mx))*(H-T-B); };
  var h='<svg viewBox="0 0 '+W+' '+H+'" class="chart">';
  h+='<line x1="'+L+'" y1="'+Y(0)+'" x2="'+(W-R)+'" y2="'+Y(0)+'" stroke="#30363d"/>';
  var bw=Math.max(2,(W-L-R)/n*0.62);
  for(var i=0;i<n;i++){
    var x=X(i)-bw/2, y1=Y(Math.max(vals[i],0)), y2=Y(Math.min(vals[i],0));
    h+='<rect x="'+x.toFixed(1)+'" y="'+Math.min(y1,y2).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(Math.abs(y2-y1),1.5).toFixed(1)+'" fill="'+(vals[i]>=0?'#3fb950':'#f85149')+'" opacity="0.8"/>';
  }
  function vline(k, color, label){
    var i=0,best=1e18;
    for(var j=0;j<n;j++){ var d=Math.abs(ks[j]-k); if(d<best){best=d;i=j;} }
    var x=X(i);
    h+='<line x1="'+x+'" y1="'+T+'" x2="'+x+'" y2="'+(H-B)+'" stroke="'+color+'" stroke-dasharray="5,4" stroke-width="1.5"/>';
    h+='<text x="'+x+'" y="'+(T-8)+'" text-anchor="middle" class="chart-lab" fill="'+color+'">'+label+'</text>';
  }
  vline(S,'#e6edf3','Spot $'+S.toFixed(0));
  if(o.flip!=null) vline(o.flip,'#f0b429','Flip $'+o.flip.toFixed(0));
  if(o.callwall) vline(o.callwall,'#3fb950','Call wall $'+o.callwall.toFixed(0));
  if(o.putwall) vline(o.putwall,'#f85149','Put wall $'+o.putwall.toFixed(0));
  if(o.maxpain!=null) vline(o.maxpain,'#58a6ff','Max pain $'+o.maxpain.toFixed(0));
  var step=Math.max(1,Math.ceil(n/14));
  for(var q=0;q<n;q+=step){
    h+='<text x="'+X(q).toFixed(1)+'" y="'+(H-B+16).toFixed(1)+'" text-anchor="middle" class="chart-lab" fill="#8b949e">$'+ks[q].toFixed(0)+'</text>';
  }
  h+='<text x="'+L+'" y="14" class="chart-lab" fill="#8b949e">Net gamma $M / 1% move · 3 nearest expirations combined</text>';
  h+='<text x="'+L+'" y="'+(H-6)+'" class="chart-lab" fill="#8b949e">Strike</text></svg>';
  return h;
}
function dStochHTML(o){
  var st=o.stoch;
  if(!st||!st.k||!st.k.length) return '<p class="small dim">No weekly stochastic in snapshot.</p>';
  var K=st.k[st.k.length-1], D=st.d[st.d.length-1];
  var zone=K<20?'oversold (<20)':K>80?'overbought (>80)':'neutral (20–80)';
  var dir=K>D?'%K above %D (momentum up)':K<D?'%K below %D (momentum down)':'%K ≈ %D';
  var W=520,H=140,n=st.k.length,L=34,R=54,T=14,B=24;
  var X=function(i){ return L+i*(W-L-R)/Math.max(n-1,1); };
  var Y=function(v){ return T+(1-v/100)*(H-T-B); };
  function line(arr,color,dash){
    return '<polyline fill="none" stroke="'+color+'" stroke-width="2"'+(dash?' stroke-dasharray="5,4"':'')+' points="'
      +arr.map(function(v,i){ return X(i).toFixed(1)+','+Y(v).toFixed(1); }).join(' ')+'"/>';
  }
  var h='<svg viewBox="0 0 '+W+' '+H+'" class="chart">'
    +'<rect x="'+L+'" y="'+Y(80)+'" width="'+(W-L-R)+'" height="'+(Y(20)-Y(80))+'" fill="#f0b429" opacity="0.08"/>'
    +'<line x1="'+L+'" y1="'+Y(80)+'" x2="'+(W-R)+'" y2="'+Y(80)+'" stroke="#30363d"/>'
    +'<line x1="'+L+'" y1="'+Y(20)+'" x2="'+(W-R)+'" y2="'+Y(20)+'" stroke="#30363d"/>'
    +line(st.k,'#e6edf3',false)+line(st.d,'#8b949e',true)
    +'<text x="'+(W-4)+'" y="'+(Y(K)-6)+'" text-anchor="end" class="chart-lab" fill="#e6edf3">%K '+K.toFixed(1)+'</text>'
    +'<text x="'+(W-4)+'" y="'+(Y(D)+12)+'" text-anchor="end" class="chart-lab" fill="#8b949e">%D '+D.toFixed(1)+'</text>'
    +'<text x="'+L+'" y="'+(H-8)+'" class="chart-lab" fill="#8b949e">Weekly stochastic (14,3), trailing 52 weeks · %K solid · %D dashed</text></svg>';
  return h+'<p class="small"><b>%K '+K.toFixed(1)+'</b> · %D '+D.toFixed(1)+' — '+zone+', '+dir+'.</p>'
    +'<p class="small dim">From weekly bars in the snapshot; 20–80 is the neutral band.</p>';
}
function dGexLive(sym, S, asof){
  var el=document.getElementById('dgx-live'); if(!el) return;
  el.innerHTML='Snapshot spot $'+S.toFixed(2)+' (bundled '+Util.esc(asof)+').';
  if(typeof LiveQuotes==='undefined'||!LiveQuotes.provider()){
    el.innerHTML+=' <span class="dim">Add a free API key in Settings for a live quote.</span>'; return;
  }
  el.innerHTML+=' <span class="dim">Fetching live quote…</span>';
  LiveQuotes.get([sym]).then(function(res){
    var box=document.getElementById('dgx-live'); if(!box) return;
    var q=res[sym];
    if(q&&q.ok) box.innerHTML='Snapshot spot $'+S.toFixed(2)+' (bundled '+Util.esc(asof)+') · <b>Live $'+Util.num(q.q.px,2)+'</b> '+LiveQuotes.badge(q.q);
  }).catch(function(){});
}
function dGammaDraw(){
  var box=document.getElementById('dgx-body'); if(!box) return;
  var sym=DGX.sym.toUpperCase(), r=dRaw();
  if(!r.opt[sym]){ box.innerHTML='<div class="empty">No options snapshot for '+Util.esc(sym)+'. Snapshots cover the '+dOptSyms().length+' most liquid names.</div>'; return; }
  var o=r.opt[sym], S=o.spot;
  var netM=o.net*1000; // $B → $M per 1% move
  var cards=[
    ['Net GEX',(netM>=0?'+':'')+netM.toFixed(1)+'M',(netM>=0?'#3fb950':'#f85149'), netM>=0?'dealers long gamma':'dealers short gamma','gex'],
    ['Gamma Flip', o.flip==null?'—':'$'+o.flip.toFixed(2), '#f0b429', o.flip==null?'no cross in range':(S>=o.flip?'spot above flip':'spot below flip'),'flip'],
    ['Call Wall', o.callwall?'$'+o.callwall.toFixed(2):'—','#3fb950','heaviest call gamma','callwall'],
    ['Put Wall', o.putwall?'$'+o.putwall.toFixed(2):'—','#f85149','heaviest put gamma','putwall'],
    ['Max Pain', o.maxpain!=null?'$'+o.maxpain.toFixed(2):'—','#58a6ff','strike minimizing option-holder payout','maxpain'],
    ['Call OI Wall', o.coiwall?'$'+o.coiwall.toFixed(2):'—','#3fb950','largest call open interest','oiwall'],
    ['Put OI Wall', o.poiwall?'$'+o.poiwall.toFixed(2):'—','#f85149','largest put open interest','oiwall'],
    ['Calls premium','$'+o.callprem.toFixed(1)+'M','#3fb950','volume × mid, all expiries',null],
    ['Puts premium','$'+o.putprem.toFixed(1)+'M','#f85149','volume × mid, all expiries',null],
    ['IV30', (o.iv30||0).toFixed(1)+'%','#a371f7','CBOE delayed','iv']
  ];
  var h='<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:12px">'
    +cards.map(function(c){
      return '<div class="panel" style="padding:10px 12px;margin:0"><div class="small dim">'+c[0]+' '+(c[4]&&typeof mi==='function'?mi(c[4]):'')+'</div><div style="font-size:20px;font-weight:700;color:'+c[2]+'">'+c[1]+'</div><div class="small dim">'+c[3]+'</div></div>';
    }).join('')+'</div>';
  h+='<p class="small hint">● Spot $'+S.toFixed(2)+(o.flip==null?'':(S>=o.flip?' is <b>above</b>':' is <b>below</b>')+' the gamma flip ($'+o.flip.toFixed(2)+') — '
    +'hedging '+(o.flip!=null&&S>=o.flip?'<b>leans against</b> price: expect calmer, range-bound trade and pinning toward big strikes.'
    :'amplifies moves: expect choppier trade.'))
    +' Support: put wall $'+(o.putwall?o.putwall.toFixed(2):'—')+' · Resistance: call wall $'+(o.callwall?o.callwall.toFixed(2):'—')+'.</p>'
  +'<p class="small hint">GEX scope: '+(o.gex_scope==='monthly'
    ?'three nearest <b>monthly</b> expirations'+(o.gex_exps&&o.gex_exps.length?' ('+o.gex_exps.map(function(x){return Util.esc(x);}).join(' · ')+')':'')
    :'three nearest expirations (fewer than two standard monthlies listed)')+'.</p>';
  h+=WC.panel(sym,{asof:r.asof, price:o.spot, net:o.net, flip:o.flip,
    callwall:o.callwall, putwall:o.putwall, maxpain:o.maxpain, iv30:o.iv30,
    callprem:o.callprem, putprem:o.putprem});
  h+='<div id="dgx-live" class="small hint" style="margin:6px 0"></div>';
  h+=dGexSVG(sym, o);
  h+='<div class="grid" style="grid-template-columns:1fr 1fr;gap:14px;margin-top:14px"><div><h4>Weekly stochastic</h4>'+dStochHTML(o)+'</div>';
  var s=dGet(sym);
  h+='<div><h4>LEAP economics (~1-year 0.70Δ call)</h4>'+(s?dLeapBox(s):'<p class="small dim">n/a</p>')+'</div></div>';
  h+='<h4 style="margin-top:14px">Unusual activity (vol ≥ 3× OI, ≥500 contracts)</h4>';
  if(o.unusual&&o.unusual.length){
    h+='<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Expiry</th><th>Strike</th><th>Type</th><th>Volume</th><th>Open Int</th><th>Vol/OI</th><th>IV</th></tr></thead><tbody>'
      +o.unusual.map(function(u){
        return '<tr><td>'+Util.esc(u.exp)+'</td><td>$'+u.k.toFixed(2)+'</td><td>'+(u.t==='C'?'Call':'Put')+'</td><td>'+Util.num(u.v)+'</td><td>'+Util.num(u.oi)+'</td><td>'+(u.v/Math.max(u.oi,1)).toFixed(1)+'×</td><td>'+u.iv.toFixed(0)+'%</td></tr>';
      }).join('')+'</tbody></table></div>';
  } else h+='<p class="small dim">No unusual contracts in this snapshot.</p>';
  if(o.expnets&&o.expnets.length){
    h+='<h4 style="margin-top:14px">Net GEX by expiration ($B per 1% move)</h4>'
      +'<p class="small">'+o.expnets.map(function(e){ return Util.esc(e.exp)+' ('+e.dte+'d): <b style="color:'+(e.net>=0?'#3fb950':'#f85149')+'">'+(e.net>=0?'+':'')+e.net.toFixed(2)+'</b>'; }).join(' · ')+'</p>';
  }
  h+='<p class="small hint" style="margin-top:8px">Delayed CBOE data, bundled '+Util.esc(r.asof)+'. Gamma math: net Γ = Σ(call γ×OI − put γ×OI) × spot² / 10⁹ = $B of dealer hedge flow per 1% spot move; chart shows $M per 1% move. Walls/flip/max pain from the three nearest monthly expirations combined (per-ticker scope shown below when different). Max pain = strike minimizing total option-holder payout at expiry.</p>';
  box.innerHTML=h;
  dGexLive(sym, S, r.asof);
}
function dGammaAfter(){
  var go=document.getElementById('dgx-go');
  function load(){
    var v=document.getElementById('dgx-sym').value.trim().toUpperCase();
    if(v){ DGX.sym=v; }
    dGammaDraw();
  }
  go.addEventListener('click', load);
  document.getElementById('dgx-sym').addEventListener('keydown', function(e){ if(e.key==='Enter') load(); });
  dGammaDraw();
}
Router.routes['gamma']=function(param){ if(param) DGX.sym=String(param).toUpperCase(); return dGammaHTML(); };
Router.routes['gamma'].after=function(){ dGammaAfter(); };

/* ---------------- NAV wiring ---------------- */
(function(){
  var ix=NAV.findIndex(function(n){ return n.id==='options'; });
  var at=ix<0?NAV.length:ix+1;
  NAV.splice(at,0,{id:'gamma', title:'Gamma Exposure', icon:'chart_column', crumb:'suite / gamma'});
  var ix2=NAV.findIndex(function(n){ return n.id==='wheel'; });
  NAV.splice(ix2<0?NAV.length:ix2+1,0,{id:'scanner', title:'Market Scanner', icon:'zap', crumb:'suite / scanner'});
})();
