/* ================================================================
   FINANCE SUITE — 08-ux.js
   Terminal UX: Lightweight Charts helper, market heatmap, Ctrl+K
   command palette, keyboard shortcuts, saved workspace presets.
   Uses globals from 00-core.js (Util, Store, NAV, Router, Charts,
   DATA_BADGE, STOCK_TICKERS, RealData, icon). No <script> tags.
   ================================================================ */

/* ---------------- Lightweight Charts helper ----------------
   Renders an interactive dark candlestick chart (crosshair, zoom)
   from bundled bars. Falls back to the built-in SVG candles when
   the library is unavailable, so charts never go blank. */
function lwCandles(id, bars, opts){
  opts=opts||{};
  const el=document.getElementById(id); if(!el) return false;
  const data=(bars||[]).filter(function(b){ return b&&b.o!=null&&b.h!=null&&b.l!=null&&b.c!=null; })
    .map(function(b){ return {time:b.d, open:b.o, high:b.h, low:b.l, close:b.c}; });
  if(!data.length){ el.innerHTML=emptyBox('No price data for this symbol.'); return false; }
  const svgFallback=function(){ el.innerHTML=Charts.candles(bars, el.clientWidth||720, opts.h||280); };
  const LW=window.LightweightCharts;
  if(!LW){ svgFallback(); return true; }
  try{
    if(el._lwChart){ try{ el._lwChart.remove(); }catch(e){}
      window.__lwCharts=(window.__lwCharts||[]).filter(function(c){ return c!==el._lwChart; });
      el._lwChart=null; }
    el.innerHTML='';
    const chart=LW.createChart(el, {
      width: el.clientWidth||720, height: opts.h||300,
      layout:{ backgroundColor:'rgba(0,0,0,0)', textColor:'#8b949e', fontSize:11,
               fontFamily:'Inter,system-ui,-apple-system,sans-serif' },
      grid:{ vertLines:{color:'rgba(48,54,61,0.45)'}, horzLines:{color:'rgba(48,54,61,0.45)'} },
      crosshair:{ vertLine:{color:'#8b949e',labelBackgroundColor:'#21262d'},
                  horzLine:{color:'#8b949e',labelBackgroundColor:'#21262d'} },
      rightPriceScale:{ borderColor:'#30363d' },
      timeScale:{ borderColor:'#30363d', timeVisible:false }
    });
    chart.addCandlestickSeries({
      upColor:'#3fb950', downColor:'#f85149',
      wickUpColor:'#3fb950', wickDownColor:'#f85149',
      borderVisible:false, priceLineVisible:false
    }).setData(data);
    if(opts.volume){
      const vols=(bars||[]).filter(function(b){ return b&&b.v!=null; })
        .map(function(b){ return {time:b.d, value:b.v,
          color: b.c>=b.o?'rgba(63,185,80,0.45)':'rgba(248,81,73,0.45)'}; });
      if(vols.length){
        chart.addHistogramSeries({ priceScaleId:'vol', priceFormat:{type:'volume'} }).setData(vols);
        chart.priceScale('vol').applyOptions({ scaleMargins:{top:0.84, bottom:0} });
      }
    }
    chart.timeScale().fitContent();
    el._lwChart=chart;
    (window.__lwCharts=window.__lwCharts||[]).push(chart);
    if(el.clientWidth && typeof ResizeObserver!=='undefined'){
      const ro=new ResizeObserver(function(){ try{ chart.applyOptions({width:el.clientWidth}); }catch(e){} });
      ro.observe(el);
      (window.__lwRO=window.__lwRO||[]).push(ro);
    }
    return true;
  }catch(e){ svgFallback(); return true; }
}
/* drop chart instances on navigation so canvases don't leak */
window.addEventListener('hashchange', function(){
  (window.__lwCharts||[]).forEach(function(c){ try{ c.remove(); }catch(e){} });
  window.__lwCharts=[];
  (window.__lwRO||[]).forEach(function(r){ try{ r.disconnect(); }catch(e){} });
  window.__lwRO=[];
});

/* ---------------- market snapshot heatmap ----------------
   Real data only: 1-day change per bundled ticker from the
   bundled bars. Honest "snapshot, not live" label. */
function uxHeatmap(){
  const rows=(STOCK_TICKERS||[]).map(function(t){
    const b=(RealData.prices||{})[t]||[];
    if(b.length<2) return null;
    return {t:t, ch:(b[b.length-1].c-b[b.length-2].c)/b[b.length-2].c};
  }).filter(Boolean).sort(function(a,b){ return b.ch-a.ch; });
  if(!rows.length) return '';
  const cells=rows.map(function(x){
    const up=x.ch>=0, mag=Math.min(1, Math.abs(x.ch)/0.04);
    const bg=up?'rgba(63,185,80,'+(0.10+0.55*mag).toFixed(2)+')'
               :'rgba(248,81,73,'+(0.10+0.55*mag).toFixed(2)+')';
    return '<a class="hm-cell" style="background:'+bg+'" href="#/research-ticker/'+Util.esc(x.t)+'">'+
      '<b>'+Util.esc(x.t)+'</b>'+
      '<span style="color:'+(up?'#3fb950':'#f85149')+'">'+(up?'+':'')+Util.pct(x.ch,2)+'</span></a>';
  }).join('');
  return '<div class="panel"><h3><span class="ico">'+icon('zap')+'</span>Market snapshot</h3>'+
    '<div class="small hint" style="margin-bottom:10px">1-day change for the '+rows.length+
    ' bundled tickers, computed from the static bundled bars — a snapshot, not live prices. Click a tile for the dossier.</div>'+
    '<div class="hm">'+cells+'</div><div style="margin-top:8px">'+DATA_BADGE+'</div></div>';
}

/* ---------------- workspace presets (localStorage) ---------------- */
function uxWorkspaces(){ Store.load(); return Store.db.workspaces||[]; }
function uxWorkspaceChips(){
  const ws=uxWorkspaces();
  const chips=ws.map(function(w,i){
    return '<span class="ws-chip" data-wsgo="'+i+'">'+icon('bookmark',13)+' '+Util.esc(w.name)+
      ' <span class="x" data-wsdel="'+i+'" title="Delete workspace">'+icon('x',13)+'</span></span>';
  }).join('');
  return '<div class="panel"><h3><span class="ico">'+icon('bookmark')+'</span>Workspaces</h3>'+
    '<div class="small hint" style="margin-bottom:10px">Saved views — pick up exactly where you left off. Stored only in this browser.</div>'+
    '<div class="ws-chips">'+
    (chips||'<span class="small hint">No workspaces yet — press <kbd>Ctrl K</kbd> then “Save current view as workspace”.</span>')+
    '</div></div>';
}
function uxAfterChips(){
  document.querySelectorAll('[data-wsgo]').forEach(function(el){
    el.addEventListener('click', function(e){
      if(e.target.closest('[data-wsdel]')) return;
      const w=uxWorkspaces()[parseInt(el.getAttribute('data-wsgo'),10)];
      if(w&&w.hash) location.hash=w.hash;
    });
  });
  document.querySelectorAll('[data-wsdel]').forEach(function(el){
    el.addEventListener('click', function(e){
      e.stopPropagation();
      Store.load();
      Store.db.workspaces.splice(parseInt(el.getAttribute('data-wsdel'),10),1);
      Store.save(); Router.render();
    });
  });
}
/* append the workspace panel to the home route */
(function uxWrapHome(){
  const orig=Router.routes['home'];
  if(!orig||orig.__uxWrapped) return;
  const wrapped=function(p){ return orig(p)+uxWorkspaceChips(); };
  wrapped.__uxWrapped=true;
  wrapped.after=function(p){ if(orig.after) orig.after(p); uxAfterChips(); };
  Router.routes['home']=wrapped;
})();

/* ---------------- command palette (Ctrl+K) ---------------- */
const CMDK={open:false, mode:'cmd', items:[], sel:0};
function cmdkBuildDOM(){
  if(document.getElementById('cmdk')) return;
  const d=document.createElement('div'); d.id='cmdk';
  d.innerHTML='<div class="cmdk-box" role="dialog" aria-label="Command palette">'+
    '<div class="cmdk-input">'+icon('search',18)+
    '<input id="cmdk-q" placeholder="Type a command, page, or ticker…" autocomplete="off" spellcheck="false">'+
    '<kbd>esc</kbd></div>'+
    '<div class="cmdk-list" id="cmdk-list"></div>'+
    '<div class="cmdk-foot"><span><kbd>↑↓</kbd> navigate</span><span><kbd>↵</kbd> run</span>'+
    '<span><kbd>/</kbd> ticker jump</span><span style="margin-left:auto">Ctrl+K</span></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click', function(e){ if(e.target===d) cmdkClose(); });
  const q=document.getElementById('cmdk-q');
  q.addEventListener('input', function(){ cmdkRender(q.value); });
  q.addEventListener('keydown', function(e){
    if(e.key==='ArrowDown'){ e.preventDefault(); cmdkMove(1); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); cmdkMove(-1); }
    else if(e.key==='Enter'){ e.preventDefault(); cmdkRun(); }
    else if(e.key==='Escape'){ cmdkClose(); }
  });
}
function cmdkItems(q){
  q=(q||'').trim();
  const items=[];
  const tm=q.replace(/^\$/,'').toUpperCase();
  if(q && /^[A-Z.]{1,7}$/.test(tm)){
    items.push({sec:'Ticker', icon:'scan_search', label:'Deep dive '+tm, hint:'Company Deep Dive',
      run:function(){ Router.go('#/deepdive/'+encodeURIComponent(tm)); }});
    items.push({sec:'Ticker', icon:'microscope', label:'Research '+tm, hint:'Research Terminal',
      run:function(){ Router.go('#/research-ticker/'+encodeURIComponent(tm)); }});
    items.push({sec:'Ticker', icon:'star', label:'Add '+tm+' to watchlist', hint:'Watchlist',
      run:function(){
        Store.load();
        const w=Store.db.watchlist||[];
        if(w.map(function(x){ return String(x).toUpperCase(); }).indexOf(tm)<0){ w.push(tm); Store.db.watchlist=w; Store.save(); }
        Router.go('#/watchlist');
      }});
  }
  const ql=q.toLowerCase();
  NAV.forEach(function(n){
    if(n.sec) return;
    if(q && n.title.toLowerCase().indexOf(ql)<0 && n.id.toLowerCase().indexOf(ql)<0) return;
    items.push({sec:'Go to', icon:n.icon||'search', label:n.title, hint:n.crumb,
      run:(function(id){ return function(){ Router.go('#/'+id); }; })(n.id)});
  });
  uxWorkspaces().forEach(function(w,i){
    if(q && w.name.toLowerCase().indexOf(ql)<0) return;
    items.push({sec:'Workspace', icon:'bookmark', label:w.name, hint:w.hash, wsDel:i,
      run:(function(h){ return function(){ location.hash=h; }; })(w.hash)});
  });
  [
    {icon:'download', label:'Export backup (JSON)', hint:'downloads your data',
      run:function(){ Util.download('finsuite-backup-'+Util.today()+'.json', Store.exportJSON(), 'application/json'); }},
    {icon:'bookmark', label:'Save current view as workspace', hint:'Workspaces',
      run:function(){ cmdkSaveMode(); }},
    {icon:'keyboard', label:'Keyboard shortcuts', hint:'?',
      run:function(){ scutsOpen(); }},
    {icon:'settings', label:'Backup & Data', hint:'suite / settings',
      run:function(){ Router.go('#/settings'); }}
  ].forEach(function(a){
    if(!q || a.label.toLowerCase().indexOf(ql)>=0) items.push(Object.assign({sec:'Action'}, a));
  });
  return items;
}
function cmdkRender(q){
  const list=document.getElementById('cmdk-list'); if(!list) return;
  if(CMDK.mode==='save'){
    list.innerHTML='<div class="cmdk-sec">Name this workspace</div>'+
      '<div class="cmdk-empty">Press <kbd>↵</kbd> to save the current view (“'+
      Util.esc(location.hash||'#/home')+'”) as <b>'+Util.esc(q||'Untitled')+'</b>.</div>';
    return;
  }
  CMDK.items=cmdkItems(q); CMDK.sel=0;
  if(!CMDK.items.length){
    list.innerHTML='<div class="cmdk-empty">No matches. Try a page name or a ticker like <b>AAPL</b>.</div>';
    return;
  }
  let lastSec='';
  list.innerHTML=CMDK.items.map(function(it,i){
    const sec=it.sec!==lastSec?'<div class="cmdk-sec">'+Util.esc(it.sec)+'</div>':'';
    lastSec=it.sec;
    const del=it.wsDel!=null?' <span class="x" data-cmdkdel="'+i+'" title="Delete workspace" style="color:#8b949e;cursor:pointer">×</span>':'';
    return sec+'<div class="cmdk-item'+(i===0?' sel':'')+'" data-cmdk="'+i+'"><span class="ico">'+
      icon(it.icon)+'</span>'+Util.esc(it.label)+del+'<small>'+Util.esc(it.hint||'')+'</small></div>';
  }).join('');
  list.querySelectorAll('[data-cmdkdel]').forEach(function(x){
    x.addEventListener('click', function(e){
      e.stopPropagation();
      const it=CMDK.items[parseInt(x.getAttribute('data-cmdkdel'),10)];
      if(it&&it.wsDel!=null){
        Store.load(); Store.db.workspaces.splice(it.wsDel,1); Store.save();
        cmdkRender(document.getElementById('cmdk-q').value);
      }
    });
  });
  list.querySelectorAll('.cmdk-item').forEach(function(el){
    el.addEventListener('click', function(e){
      if(e.target.closest('[data-cmdkdel]')) return;
      CMDK.sel=parseInt(el.getAttribute('data-cmdk'),10); cmdkRun();
    });
    el.addEventListener('mousemove', function(){ cmdkSel(parseInt(el.getAttribute('data-cmdk'),10)); });
  });
}
function cmdkSel(i){
  CMDK.sel=i;
  document.querySelectorAll('#cmdk-list .cmdk-item').forEach(function(el){
    el.classList.toggle('sel', parseInt(el.getAttribute('data-cmdk'),10)===i);
  });
}
function cmdkMove(d){
  if(!CMDK.items.length) return;
  cmdkSel((CMDK.sel+d+CMDK.items.length)%CMDK.items.length);
  const el=document.querySelector('#cmdk-list .cmdk-item.sel');
  if(el&&el.scrollIntoView) el.scrollIntoView({block:'nearest'});
}
function cmdkRun(){
  if(CMDK.mode==='save'){
    const name=(document.getElementById('cmdk-q').value.trim()||'Untitled').slice(0,60);
    Store.load();
    Store.db.workspaces=Store.db.workspaces||[];
    Store.db.workspaces.push({name:name, hash:location.hash||'#/home', ts:Date.now()});
    Store.save();
    CMDK.mode='cmd'; cmdkClose();
    return;
  }
  const it=CMDK.items[CMDK.sel]; if(!it) return;
  cmdkClose(); it.run();
}
function cmdkOpen(prefill){
  cmdkBuildDOM();
  CMDK.open=true; CMDK.mode='cmd';
  document.getElementById('cmdk').classList.add('open');
  const q=document.getElementById('cmdk-q');
  q.value=prefill||''; q.placeholder='Type a command, page, or ticker…';
  cmdkRender(q.value);
  setTimeout(function(){ q.focus(); q.select(); }, 0);
}
function cmdkClose(){
  CMDK.open=false; CMDK.mode='cmd';
  const d=document.getElementById('cmdk'); if(d) d.classList.remove('open');
}
function cmdkToggle(){ CMDK.open?cmdkClose():cmdkOpen(''); }
function cmdkSaveMode(){
  CMDK.mode='save';
  const q=document.getElementById('cmdk-q');
  q.value=''; q.placeholder='Workspace name…';
  cmdkRender(''); q.focus();
}

/* ---------------- shortcuts help (?) ---------------- */
function scutsOpen(){
  let m=document.getElementById('scuts');
  if(!m){
    m=document.createElement('div'); m.id='scuts';
    const rows=[
      ['Ctrl / ⌘ + K','Command palette — pages, tickers, actions'],
      ['/','Ticker jump — type a symbol, jump to Deep Dive / Research'],
      ['?','This shortcut reference'],
      ['↑ ↓ then ↵','Move in the palette, run the selection'],
      ['g then g','Gamma Exposure'],
      ['g then s','Market Scanner'],
      ['g then n','Market News'],
      ['g then m','Markets'],
      ['g then p','Portfolio Lab'],
      ['g then c','Company Deep Dive'],
      ['g then w','Watchlist'],
      ['g then t','Terminal workspaces'],
      ['g then h','Home'],
      ['Esc','Close palette, drawer, or dialog']
    ].map(function(r){ return '<tr><td><kbd>'+r[0]+'</kbd></td><td>'+r[1]+'</td></tr>'; }).join('');
    m.innerHTML='<div class="scuts-box"><h3 style="margin-top:0"><span class="ico">'+icon('keyboard')+
      '</span>Keyboard shortcuts</h3><table>'+rows+
      '</table><div style="margin-top:14px;text-align:right"><button class="btn sm" id="scuts-x">Close</button></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function(e){ if(e.target===m) scutsClose(); });
    document.getElementById('scuts-x').addEventListener('click', scutsClose);
  }
  m.classList.add('open');
}
function scutsClose(){ const m=document.getElementById('scuts'); if(m) m.classList.remove('open'); }

/* ---------------- global keys + topbar button ---------------- */
function uxInField(){
  const a=document.activeElement;
  return a&&(/(INPUT|TEXTAREA|SELECT)/.test(a.tagName)||a.isContentEditable);
}
document.addEventListener('keydown', function(e){
  const k=e.key;
  if((e.ctrlKey||e.metaKey)&&k.toLowerCase()==='k'){ e.preventDefault(); cmdkToggle(); return; }
  if(k==='Escape'){ cmdkClose(); scutsClose(); return; }
  if(uxInField()||e.ctrlKey||e.metaKey||e.altKey) return;
  if(k==='?'){ e.preventDefault(); scutsOpen(); }
  else if(k==='/'){ e.preventDefault(); cmdkOpen('$'); }
});
(function uxTopbar(){
  cmdkBuildDOM();
  const tb=document.getElementById('topbar');
  if(tb&&!document.getElementById('cmdk-btn')){
    const b=document.createElement('button');
    b.id='cmdk-btn'; b.className='btn sm ghost';
    b.style.marginLeft='auto';
    b.innerHTML=icon('search',14)+'<span style="margin:0 6px">Command</span><kbd>Ctrl K</kbd>';
    b.addEventListener('click', function(){ cmdkToggle(); });
    tb.appendChild(b);
  }
})();

/* ================================================================
   Passcode lock — a screen lock, NOT encryption.
   The SHA-256 hash lives in this browser's localStorage (never in
   the file). Anyone who can edit the file or its stored data can
   bypass it. It keeps casual snoopers out, nothing more.
   Unlock lasts for the browser session only (sessionStorage).
   ================================================================ */
async function pcHash(str){
  try{
    if(window.crypto&&crypto.subtle){
      const b=await crypto.subtle.digest('SHA-256', new TextEncoder().encode('finsuite|'+str));
      return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');
    }
  }catch(e){}
  let h1=0xdeadbeef,h2=0x41c6ce57; const t='finsuite|'+str;
  for(let i=0;i<t.length;i++){ const ch=t.charCodeAt(i); h1=Math.imul(h1^ch,2654435761); h2=Math.imul(h2^ch,1597334677); }
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return (h2>>>0).toString(16).padStart(8,'0')+(h1>>>0).toString(16).padStart(8,'0');
}
function pcIsSet(){ return !!((Store.db.settings||{}).pcHash); }
function pcUnlocked(){ try{ return sessionStorage.getItem('finsuite_unlocked')==='1'; }catch(e){ return false; } }
function pcMarkUnlocked(){ try{ sessionStorage.setItem('finsuite_unlocked','1'); }catch(e){} }
function pcShowLock(){
  if(document.getElementById('pc-lock')) return;
  const d=document.createElement('div'); d.id='pc-lock';
  d.innerHTML='<div class="pc-card"><div class="pc-logo">Finance Suite</div>'
    +'<p class="hint">This copy is passcode-protected.</p>'
    +'<input class="in" type="password" id="pc-in" placeholder="Enter passcode" autocomplete="off">'
    +'<div id="pc-err" class="small" style="color:var(--red);min-height:18px"></div>'
    +'<button class="btn" id="pc-go">Unlock</button></div>';
  document.body.appendChild(d);
  const inp=document.getElementById('pc-in'); inp.focus();
  async function tryUnlock(){
    const h=await pcHash(inp.value||'');
    if(h===((Store.db.settings||{}).pcHash||'')){ pcMarkUnlocked(); d.remove(); }
    else{ document.getElementById('pc-err').textContent='Wrong passcode.'; inp.value=''; inp.focus(); }
  }
  document.getElementById('pc-go').addEventListener('click',tryUnlock);
  inp.addEventListener('keydown',e=>{ if(e.key==='Enter') tryUnlock(); });
}
function pcLockNow(){ try{ sessionStorage.removeItem('finsuite_unlocked'); }catch(e){} pcShowLock(); }
