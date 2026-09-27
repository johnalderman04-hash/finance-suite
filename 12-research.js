/* ================================================================
   12-research.js — Research Mode: a per-company workspace composing
   auto metrics + the deep-dive's per-ticker notes store + what-changed.
   Static only. Notes in localStorage. No scores, no recommendations.
   ================================================================ */
function rmLast(a){ return (a&&a.length)?a[a.length-1]:null; }
function rmPrev(a){ return (a&&a.length>1)?a[a.length-2]:null; }
function rmDiv(a,b){ return (a!=null&&b!=null&&b!==0)?a/b:null; }

/* fundamentals accessor over bundled SEC data */
function rmFund(t){
  var R=(typeof RealData!=='undefined')?RealData:{};
  var f=(R.fundamentals||{})[t];
  if(!f) return null;
  var rev=rmLast(f.revenue), revP=rmPrev(f.revenue);
  var ni=rmLast(f.net_income), niP=rmPrev(f.net_income);
  var ocf=rmLast(f.op_cash), ocfP=rmPrev(f.op_cash);
  var gp=rmLast(f.gross_profit), oi=rmLast(f.op_income);
  var assets=rmLast(f.assets), tliab=rmLast(f.total_liab), ltdebt=rmLast(f.lt_debt);
  var ca=rmLast(f.cur_assets), cl=rmLast(f.cur_liab), iexp=rmLast(f.interest_exp);
  var sh=rmLast(f.shares_dil), shP=rmPrev(f.shares_dil);
  var eq=(assets!=null&&tliab!=null)?assets-tliab:null;
  var price=null, mcap=null;
  if(typeof dGet!=='undefined'){ var d=dGet(t); if(d){ price=d.price; mcap=d.mcap*1e9; } }
  if(price==null){ var b=(R.prices||{})[t]; if(b&&b.length) price=b[b.length-1].c; }
  if(mcap==null&&price!=null&&sh) mcap=price*sh;
  var eps=rmDiv(ni,sh), epsP=rmDiv(niP,shP);
  return {
    name:f.name||t, price:price, mcap:mcap,
    revenue:rev, revGrowth:rmDiv(rev-revP,revP),
    epsGrowth:rmDiv(eps-epsP,epsP),
    fcf:ocf, fcfGrowth:rmDiv(ocf-ocfP,ocfP), fcfMargin:rmDiv(ocf,rev), fcfYield:rmDiv(ocf,mcap),
    grossMargin:rmDiv(gp,rev), opMargin:rmDiv(oi,rev), netMargin:rmDiv(ni,rev),
    roic:rmDiv(oi!=null?oi*0.79:null,(ltdebt!=null&&eq!=null)?ltdebt+eq:null),
    roe:rmDiv(ni,eq),
    debtEbitda:rmDiv(ltdebt,oi), curRatio:rmDiv(ca,cl), intCov:rmDiv(oi,iexp),
    pe:rmDiv(price,eps), evEbit:rmDiv(mcap!=null&&ltdebt!=null?mcap+ltdebt:null,oi),
    evSales:rmDiv(mcap!=null&&ltdebt!=null?mcap+ltdebt:null,rev),
    pFcf:rmDiv(price,rmDiv(ocf,sh)),
    ltdebt:ltdebt, equity:eq
  };
}
function rmBars(t){
  var R=(typeof RealData!=='undefined')?RealData:{};
  return (R.prices||{})[t]||[];
}
/* objective scorecard — display only, no rating, no recommendation */
function rmScorecard(t, F){
  function cell(v, fmt){
    if(v==null||isNaN(v)) return '<span class="dim">data unavailable</span>';
    return fmt(v);
  }
  function pct1(v){ return (v>=0?'+':'')+(v*100).toFixed(1)+'%'; }
  function row(label, v, fmt, mik){
    return '<tr><td>'+label+(mik?mi(mik):'')+'</td><td class="num mono">'+cell(v,fmt)+'</td></tr>';
  }
  var bars=rmBars(t), mom='';
  if(bars.length>=200){
    var px=bars[bars.length-1].c;
    function sma(n){ var s=bars.slice(-n), sum=0; for(var i=0;i<s.length;i++) sum+=s[i].c; return sum/s.length; }
    var s50=sma(50), s200=sma(200);
    var hi=0, lo=1e18;
    bars.slice(-252).forEach(function(x){ if(x.h>hi)hi=x.h; if(x.l<lo)lo=x.l; });
    mom='<table class="tbl"><tbody>'
      +row('Price vs 50-day avg', px/s50-1, pct1)
      +row('Price vs 200-day avg', px/s200-1, pct1)
      +row('52-week position', hi>lo?(px-lo)/(hi-lo):null, function(v){ return (v*100).toFixed(0)+'% of range'; })
      +'</tbody></table>';
  } else mom=emptyState('Momentum unavailable.','Not enough bundled price history for this ticker.');
  function money(v){ return Util.money(v); }
  var h='<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px">';
  h+='<div class="panel" style="margin:0"><h4>Growth</h4><table class="tbl"><tbody>'
    +row('Revenue growth',F.revGrowth,pct1)+row('EPS growth',F.epsGrowth,pct1)+row('FCF growth',F.fcfGrowth,pct1)
    +'</tbody></table></div>';
  h+='<div class="panel" style="margin:0"><h4>Profitability</h4><table class="tbl"><tbody>'
    +row('Gross margin',F.grossMargin,pct1)+row('Operating margin',F.opMargin,pct1)+row('Net margin',F.netMargin,pct1)
    +row('ROIC (approx)',F.roic,pct1,'roic')+row('ROE',F.roe,pct1,'roe')
    +'</tbody></table></div>';
  h+='<div class="panel" style="margin:0"><h4>Balance Sheet</h4><table class="tbl"><tbody>'
    +row('LT debt / EBIT (approx)',F.debtEbitda,function(v){return v.toFixed(1)+'×';})
    +row('Current ratio',F.curRatio,function(v){return v.toFixed(2)+'×';})
    +row('Interest coverage',F.intCov,function(v){return v.toFixed(1)+'×';})
    +'</tbody></table></div>';
  h+='<div class="panel" style="margin:0"><h4>Cash Flow</h4><table class="tbl"><tbody>'
    +row('Operating cash flow',F.fcf,money)+row('FCF margin',F.fcfMargin,pct1)+row('FCF yield',F.fcfYield,pct1,'fcf_yield')
    +'</tbody></table></div>';
  h+='<div class="panel" style="margin:0"><h4>Valuation</h4><table class="tbl"><tbody>'
    +row('P/E (trailing)',F.pe,function(v){return v.toFixed(1)+'×';},'pe')
    +row('EV / EBIT (approx)',F.evEbit,function(v){return v.toFixed(1)+'×';},'ev_ebitda')
    +row('EV / Sales (approx)',F.evSales,function(v){return v.toFixed(1)+'×';})
    +row('Price / FCF',F.pFcf,function(v){return v.toFixed(1)+'×';})
    +'</tbody></table></div>';
  h+='<div class="panel" style="margin:0"><h4>Momentum</h4>'+mom+'</div>';
  return h+'</div>'
    +'<p class="small hint" style="margin-top:8px">Objective metrics only — no buy/sell score, no recommendation. FCF uses operating cash flow (no capex field in the bundle). EV ≈ market cap + long-term debt (cash not subtracted). ROIC uses a flat 21% tax.</p>';
}

function rmOptionsMini(sym){
  var r=(typeof dRaw!=='undefined')?dRaw():null;
  var o=r&&r.opt?r.opt[sym]:null;
  if(!o) return emptyState('Options data unavailable.',
    'The required options chain could not be retrieved for this ticker. Live options flow requires a licensed market-data source — this terminal does not fabricate it.',
    r&&r.asof);
  var m=o.net*1000;
  return '<div class="tw-kpis">'
    +'<div><span style="color:'+(m>=0?'#3fb950':'#f85149')+'">'+(m>=0?'+':'')+m.toFixed(1)+'M</span>net GEX / 1%'+mi('gex')+'</div>'
    +'<div><span>'+(o.flip?'$'+o.flip.toFixed(0):'—')+'</span>gamma flip'+mi('flip')+'</div>'
    +'<div><span>$'+(o.callwall?o.callwall.toFixed(0):'—')+' / $'+(o.putwall?o.putwall.toFixed(0):'—')+'</span>call / put wall (γ)'+mi('callwall')+'</div>'
    +'<div><span>'+(o.maxpain!=null?'$'+o.maxpain.toFixed(0):'—')+'</span>max pain'+mi('maxpain')+'</div>'
    +'<div><span>'+(o.iv30||0).toFixed(0)+'%</span>IV30'+mi('iv')+'</div>'
    +'</div><p style="margin-top:8px"><a class="btn sm ghost" href="#/gamma/'+Util.esc(sym)+'">Open full Gamma Exposure →</a></p>';
}

function rmHTML(sym){
  sym=String(sym||'').toUpperCase();
  var F=rmFund(sym);
  var r=(typeof dRaw!=='undefined')?dRaw():null;
  var s=(typeof ddGet!=='undefined')?ddGet(sym):null;
  var th=s?s.thesis:{};
  var h='<div class="panel"><h2><span class="ico">'+icon('microscope')+'</span> Research Mode — '+Util.esc(sym)+'</h2>';
  if(!F) return h+emptyState('No company data for '+sym+'.','Neither the discovery bundle nor the fundamentals bundle covers this ticker.')+'</div>';
  var asof=r?r.asof:null;
  h+='<p>'+Fresh.badge('WEEKDAYS','Scanner/seasonality snapshot')+' '+Fresh.badge('HISTORICAL','SEC fundamentals bundle')+' '
    +'<span class="small hint">'+Util.esc(F.name)+' · snapshot '+(asof?Util.esc(asof):'2026-09-25')+'</span></p>'
    +'<p><a class="btn sm ghost" href="#/deepdive/'+Util.esc(sym)+'">Deep Dive</a> '
    +'<a class="btn sm ghost" href="#/scanner/'+Util.esc(sym)+'">Scanner</a> '
    +'<a class="btn sm ghost" href="#/gamma/'+Util.esc(sym)+'">Gamma</a> '
    +'<a class="btn sm ghost" href="#/valuation">Valuation Workbench</a></p></div>';

  /* COMPANY */
  h+='<div class="panel"><h3>Company</h3><div class="tw-kpis">'
    +'<div><span>'+(F.price!=null?'$'+F.price.toFixed(2):'—')+'</span>price</div>'
    +'<div><span>'+(F.mcap!=null?Util.money(F.mcap):'—')+'</span>market cap</div>'
    +'<div><span>'+(F.revenue!=null?Util.money(F.revenue):'—')+'</span>revenue (FY)</div>'
    +'<div><span>'+(F.revGrowth!=null?((F.revGrowth>=0?'+':'')+(F.revGrowth*100).toFixed(1)+'%'):'—')+'</span>revenue growth</div>'
    +'<div><span>'+(F.opMargin!=null?(F.opMargin*100).toFixed(1)+'%':'—')+'</span>operating margin</div>'
    +'<div><span>'+(F.fcf!=null?Util.money(F.fcf):'—')+'</span>operating cash flow</div>'
    +'<div><span>'+(F.ltdebt!=null?Util.money(F.ltdebt):'—')+'</span>long-term debt</div>'
    +'<div><span>'+(F.pe!=null?F.pe.toFixed(1)+'×':'—')+'</span>trailing P/E'+mi('pe')+'</div>'
    +'</div></div>';

  /* BUSINESS */
  var bizDesc=(s&&s.biz&&s.biz.desc)||((typeof DD_DESC!=='undefined'&&DD_DESC[sym])||'');
  h+='<div class="panel"><h3>Business</h3>'
    +'<p class="small hint">Your notes, saved per ticker in this browser. '+(bizDesc&&s&&!s.biz.desc?'Prefilled with a one-line summary — edit freely.':'')+'</p>'
    +'<label class="f">Business model &amp; revenue sources<textarea class="in" rows="4" style="width:100%" id="rm-biz" placeholder="What the company sells, who pays, where revenue comes from…">'+Util.esc(bizDesc||'')+'</textarea></label>'
    +'<div style="margin-top:8px"><button class="btn sm" id="rm-biz-save">Save business notes</button> <span class="small hint" id="rm-biz-msg"></span></div></div>';

  /* VALUATION + SCORECARD */
  h+='<div class="panel"><h3>Objective Scorecard</h3>'+rmScorecard(sym,F)+'</div>';

  /* OPTIONS */
  h+='<div class="panel"><h3>Options</h3>'+rmOptionsMini(sym)+'</div>';

  /* WHAT CHANGED — WC.panel reads the previous snapshot, renders the
     comparison, and saves the current one itself (save-after-render). */
  if(r&&r.stocks){
    var d=(typeof dGet!=='undefined')?dGet(sym):null;
    var o=r.opt?r.opt[sym]:null;
    h+=WC.panel(sym,{asof:r.asof, price:d?d.price:(F.price||null), target:d?d.target:null, upside:d?d.upside:null,
      net:o?o.net:null, flip:o?o.flip:null, callwall:o?o.callwall:null, putwall:o?o.putwall:null, maxpain:o?o.maxpain:null, iv30:o?o.iv30:null});
  }

  /* RISKS / THESIS / CASES — same per-ticker store as the Deep Dive */
  function ta(id, val, label, ph){
    return '<label class="f">'+label+'<textarea class="in" rows="4" style="width:100%" id="'+id+'" placeholder="'+Util.esc(ph||'')+'">'+Util.esc(val||'')+'</textarea></label>';
  }
  var risks=(s&&s.risks)||[];
  h+='<div class="panel"><h3>Risks</h3>'
    +(risks.length?'<ul>'+risks.map(function(x){ return '<li>'+Util.esc(x.risk||x)+' <span class="small dim">'+Util.esc(x.date||'')+'</span> <button class="btn sm ghost" data-rm-riskdel="'+Util.esc(x.id||'')+'">remove</button></li>'; }).join('')+'</ul>':'<p class="small hint">No risks recorded yet.</p>')
    +'<div style="display:flex;gap:8px;margin-top:8px"><input class="in" id="rm-risk-in" placeholder="Add a risk…" style="flex:1"><button class="btn sm" id="rm-risk-add">Add</button></div></div>';
  h+='<div class="panel"><h3>Thesis</h3>'+ta('rm-thesis', th.main||th.vars, 'Investment thesis', 'The core claim this investment rests on…')
    +'<div style="margin-top:8px"><button class="btn sm" id="rm-thesis-save">Save thesis</button> <span class="small hint" id="rm-thesis-msg"></span></div></div>';
  h+='<div class="panel"><h3>Bull / Base / Bear</h3><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">'
    +'<div>'+ta('rm-bull', th.bull, 'Bull case', 'What goes right…')+'</div>'
    +'<div>'+ta('rm-base', th.base, 'Base case', 'The likely middle path…')+'</div>'
    +'<div>'+ta('rm-bear', th.bear, 'Bear case', 'What goes wrong…')+'</div>'
    +'</div><div style="margin-top:8px"><button class="btn sm" id="rm-cases-save">Save cases</button> <span class="small hint" id="rm-cases-msg"></span> '
    +'<span class="small hint">Track falsifiable claims from these cases in the <a href="#/theses">Thesis Tracker</a>.</span></div></div>';
  return h;
}
function rmAfter(sym){
  sym=String(sym||'').toUpperCase();
  function msg(id, t){ var el=document.getElementById(id); if(el) el.textContent=t; }
  var b=document.getElementById('rm-biz-save');
  if(b) b.addEventListener('click', function(){
    var s=ddGet(sym); s.biz.desc=document.getElementById('rm-biz').value; Store.save();
    msg('rm-biz-msg','Saved '+new Date().toLocaleTimeString()+'.');
  });
  var ts=document.getElementById('rm-thesis-save');
  if(ts) ts.addEventListener('click', function(){
    var s=ddGet(sym); s.thesis.main=document.getElementById('rm-thesis').value; Store.save();
    msg('rm-thesis-msg','Saved '+new Date().toLocaleTimeString()+'.');
  });
  var cs=document.getElementById('rm-cases-save');
  if(cs) cs.addEventListener('click', function(){
    var s=ddGet(sym);
    s.thesis.bull=document.getElementById('rm-bull').value;
    s.thesis.base=document.getElementById('rm-base').value;
    s.thesis.bear=document.getElementById('rm-bear').value;
    Store.save(); msg('rm-cases-msg','Saved '+new Date().toLocaleTimeString()+'.');
  });
  var ra=document.getElementById('rm-risk-add');
  if(ra) ra.addEventListener('click', function(){
    var v=document.getElementById('rm-risk-in').value.trim(); if(!v) return;
    var s=ddGet(sym); s.risks.push({id:Util.uid('rk'), risk:v, date:Util.today()}); Store.save(); Router.render();
  });
  document.querySelectorAll('[data-rm-riskdel]').forEach(function(x){
    x.addEventListener('click', function(){
      var id=x.getAttribute('data-rm-riskdel'), s=ddGet(sym);
      s.risks=s.risks.filter(function(r){ return r.id!==id; }); Store.save(); Router.render();
    });
  });
}
Router.routes['rmode']=function(param){
  if(!param) return '<div class="panel"><h2>Research Mode</h2><p class="hint">Pick a company: press <kbd>Ctrl K</kbd> and type a ticker, e.g. <b>GOOGL research</b>.</p></div>';
  return rmHTML(param);
};
Router.routes['rmode'].after=function(param){ if(param) rmAfter(param); };
(function(){
  var ix=NAV.findIndex(function(n){ return n.id==='deepdive'; });
  NAV.splice(ix<0?NAV.length:ix+1,0,{id:'rmode', title:'Research Mode', icon:'microscope', crumb:'suite / research mode'});
})();
