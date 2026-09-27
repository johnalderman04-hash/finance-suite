/* ================================================================
   FINANCE SUITE — 04-planning.js
   Planning routes: Options Lab, Dividend Planner, Roth IRA Planner,
   Congress Trading tracker.
   Uses globals from 00-core.js only. Plain JS, no <script> tags.
   All calculators are assistive (rule-based): they run fixed formulas
   on user input. This file gives no advice and makes no live calls.
   ================================================================ */

/* ---------------- explainers ---------------- */
(function plRegisterExplain(){
  const A=(k,t,what,why,good)=>EX.add(k,t,what,why,good);
  A('pl-coveredcall','Covered call',
    'You own (or buy) 100 shares of a stock and sell one call option against them. The buyer pays you a premium for the right to buy your shares at the strike price.',
    'You collect cash up front and give up some upside: if the stock soars past the strike, your shares get "called away" at the strike price.',
    'Good when you think the stock will stay flat or rise modestly. Bad when you expect a big rally — you would miss it.');
  A('pl-cashput','Cash-secured put',
    'You sell a put option and set aside enough cash to buy 100 shares at the strike price. You keep the premium.',
    'If the stock falls below the strike, you must buy the shares at the strike — which is why the cash is "secured" (reserved) up front.',
    'Good if you would be happy owning the stock at the strike price anyway. Bad if the stock collapses far below the strike.');
  A('pl-wheel','The wheel',
    'A repeating cycle: (1) sell cash-secured puts until you are assigned shares, then (2) sell covered calls against those shares until they are called away. Then start over.',
    'Each loop collects option premium, so the strategy generates income while you wait — first to get shares, then to sell them.',
    'Good for stocks you like long-term and expect to trade sideways. Bad in a strong downtrend (you keep getting assigned at falling prices) or a strong rally (shares get called away early).');
  A('pl-callspread','Bull call spread',
    'You buy a call at a lower strike and sell a call at a higher strike on the same stock and expiry. The sold call partly pays for the bought call, so the cost (net debit) is lower than a lone call.',
    'It bets on a moderate rise with defined risk: your max loss is capped at what you paid, and your max profit is capped by the higher strike.',
    'Good when you expect a modest, not explosive, move up. Bad if the stock barely moves (you lose the debit) or if you expect a huge rally (profit is capped).');
  A('pl-protput','Protective put',
    'You own 100 shares and buy a put option: the right to sell at the strike price. It works like insurance on the stock.',
    'If the stock crashes, the put gains value and offsets the loss — your floor is roughly the strike price minus the premium paid.',
    'Good when you want to hold through uncertain times but cap the downside. Bad when the stock drifts sideways, because the premium you paid decays away.');
  A('pl-premium','Option premium',
    'The price the option buyer pays the seller, quoted per share (one contract = 100 shares).',
    'The seller keeps it no matter what happens. It is the income in covered calls, cash-secured puts, and the wheel.',
    'Higher premium usually means the market expects bigger price swings — more income, more risk.');
  A('pl-breakeven','Breakeven',
    'The stock price at expiry where the strategy makes exactly $0 — neither profit nor loss.',
    'Everything above or below it (depending on the strategy) decides whether the trade wins or loses.',
    'Compare it to the current price to see how much room you have before the trade turns red.');
  A('pl-dividend','Dividend',
    'Cash a company pays its shareholders, usually quarterly, out of its profits.',
    'It is income you receive just for holding the stock — independent of whether the share price moves.',
    'Reliable and growing dividends signal a healthy company; a dividend that looks too high can warn of a cut.');
  A('pl-drip','DRIP (dividend reinvestment)',
    'Instead of taking dividends as cash, you automatically use them to buy more shares of the same stock.',
    'More shares earn more dividends next time, so income compounds — small now, much bigger later.',
    'Powerful over many years; the tradeoff is you give up the cash income today.');
  A('pl-yieldcost','Yield on cost',
    'Annual dividends received divided by what YOU originally paid for the shares (your cost basis).',
    'It measures the income your invested dollars are producing, ignoring today\'s price.',
    'Rising yield on cost over the years means your original investment is working harder for you.');
  A('pl-roth','Roth IRA',
    'A retirement account you fund with after-tax dollars: you pay tax on the money going in, but qualified withdrawals in retirement are generally tax-free if IRS rules are met — check current IRS rules.',
    'Because withdrawals are generally tax-free, every dollar of growth stays yours. That makes decades of compounding especially powerful.',
    'Generally best when you expect to be in the same or a higher tax bracket in retirement. Contribution limits and income eligibility are set by the IRS each year — verify for the current year.');
  A('pl-stockact','STOCK Act',
    'A 2012 law requiring members of Congress to publicly disclose their stock trades, generally within 30–45 days of the trade.',
    'It was meant to discourage trading on nonpublic information and let the public see what lawmakers are buying and selling.',
    'Useful as a starting point for research — but disclosures are DELAYED by design, and a trade is not proof of inside information.');
})();

/* ---------------- shared helpers ---------------- */
function plNum(id){
  const el=document.getElementById(id);
  if(!el) return NaN;
  const v=parseFloat(String(el.value).replace(/[$,]/g,''));
  return v;
}
function plErr(msg){
  const el=document.getElementById('pl-alert');
  if(el){ el.innerHTML='<div class="alert err">'+Util.esc(msg)+'</div>'; }
  return false;
}
function plClearErr(){
  const el=document.getElementById('pl-alert');
  if(el) el.innerHTML='';
}
function plTickerOptions(sel){
  const ts=(STOCK_TICKERS&&STOCK_TICKERS.length)?STOCK_TICKERS:['SPY','QQQ'];
  return ts.map(t=>'<option value="'+Util.esc(t)+'"'+(t===sel?' selected':'')+'>'+Util.esc(t)+'</option>').join('');
}
function plFmtSigned(n){ return (n<0?'-':'')+Util.money(Math.abs(n)); }

/* ================================================================
   ROUTE 1 — OPTIONS LAB
   ================================================================ */
const plStrategies = {
  covered: {
    name:'Covered Call',
    exKey:'pl-coveredcall',
    how:'<p>You <b>own 100 shares</b> and <b>sell 1 call</b> at the strike. You keep the '+
      ex('pl-premium','premium')+' no matter what.</p><ul>'+
      '<li><b>Stock stays below the strike:</b> the call expires worthless. You keep your shares <i>and</i> the premium.</li>'+
      '<li><b>Stock rises above the strike:</b> your shares are "called away" — sold at the strike price. Your profit is capped.</li>'+
      '<li><b>Stock falls:</b> you still own the shares and feel the full drop; the premium only softens it a little.</li></ul>',
    fields:[
      {key:'strike', label:'Strike price ($)', def:'', hint:'Price at which your shares could be called away.'},
      {key:'prem', label:'Premium received per share ($)', def:'', hint:'Cash you collect up front, per share.'},
      {key:'n', label:'Contracts', def:'1', hint:'1 contract covers 100 shares.'}
    ],
    payoff(S,p,S0){ return 100*p.n*(p.prem + Math.min(S,p.strike) - S0); },
    stats(p,S0){
      return {
        maxP: 100*p.n*(p.strike - S0 + p.prem),
        maxL: -100*p.n*(S0 - p.prem),
        be: [S0 - p.prem],
        beNote:'Profit is capped at the strike; loss is the stock falling to $0 minus the premium cushion.'
      };
    }
  },
  cashput: {
    name:'Cash-Secured Put',
    exKey:'pl-cashput',
    how:'<p>You <b>sell 1 put</b> at the strike and <b>set aside strike × 100 in cash</b> in case you are assigned. You keep the '+
      ex('pl-premium','premium')+' either way.</p><ul>'+
      '<li><b>Stock stays above the strike:</b> the put expires worthless. You keep the premium, buy nothing.</li>'+
      '<li><b>Stock falls below the strike:</b> you are assigned — you must buy 100 shares at the strike price (above the market price). Your effective cost is strike − premium.</li>'+
      '<li><b>Stock falls a lot:</b> you own shares bought at the strike and ride the full drop, softened only by the premium.</li></ul>',
    fields:[
      {key:'strike', label:'Strike price ($)', def:'', hint:'Price at which you could be forced to buy 100 shares.'},
      {key:'prem', label:'Premium received per share ($)', def:'', hint:'Cash you collect up front, per share.'},
      {key:'n', label:'Contracts', def:'1', hint:'1 contract obligates you to buy 100 shares if assigned.'}
    ],
    payoff(S,p){ return 100*p.n*(p.prem - Math.max(p.strike - S, 0)); },
    stats(p){
      return {
        maxP: 100*p.n*p.prem,
        maxL: -100*p.n*(p.strike - p.prem),
        be: [p.strike - p.prem],
        beNote:'Max profit is just the premium. Max loss is the stock falling to $0 minus the premium.'
      };
    }
  },
  wheel: {
    name:'The Wheel',
    exKey:'pl-wheel',
    how:'<p>The wheel is a <b>cycle</b>, not a single trade. Plain-English walkthrough:</p>'+
      '<ol><li><b>Phase 1 — sell cash-secured puts.</b> Pick a stock you would happily own. Sell puts at a strike below today\'s price and collect premium. If the stock stays up, the puts expire and you repeat — pure income.</li>'+
      '<li><b>Assignment.</b> If the stock drops below your put strike, you are assigned: you now own 100 shares per contract at (strike − put premium) effective cost.</li>'+
      '<li><b>Phase 2 — sell covered calls.</b> Sell calls at or above your cost basis and collect more premium. If the stock rises past the call strike, your shares are called away at a profit.</li>'+
      '<li><b>Repeat.</b> Back to selling puts. Each full loop banks two premiums plus any stock gain.</li></ol>'+
      '<p>The visualizer below models <b>one leg at a time</b>: pick the <b>put leg</b> to see the income phase (selling puts until assignment), or the <b>call leg</b> to see the assignment phase (selling covered calls against the assigned shares).</p>',
    legs:{
      put:{
        name:'Cash-secured put',
        fields:[
          {key:'putStrike', label:'Put strike ($)', def:'', hint:'Strike of the cash-secured put you sell.'},
          {key:'putPrem', label:'Put premium per share ($)', def:'', hint:'Premium collected on the put.'},
          {key:'n', label:'Contracts', def:'1', hint:'1 contract obligates you to buy 100 shares if assigned.'}
        ],
        payoff(S,p){ return 100*p.n*(p.putPrem - Math.max(p.putStrike - S, 0)); },
        stats(p){
          return {
            maxP: 100*p.n*p.putPrem,
            maxL: -100*p.n*(p.putStrike - p.putPrem),
            be: [p.putStrike - p.putPrem],
            beNote:'If the put expires worthless, profit is just the premium.'
          };
        }
      },
      call:{
        name:'Covered call',
        fields:[
          {key:'callStrike', label:'Call strike ($)', def:'', hint:'Strike of the covered call sold after assignment.'},
          {key:'callPrem', label:'Call premium per share ($)', def:'', hint:'Premium collected on the call.'},
          {key:'n', label:'Contracts', def:'1', hint:'1 contract covers 100 shares.'}
        ],
        payoff(S,p,S0){ return 100*p.n*(Math.min(S,p.callStrike) - S0 + p.callPrem); },
        stats(p,S0){
          return {
            maxP: 100*p.n*(p.callStrike - S0 + p.callPrem),
            maxL: -100*p.n*(S0 - p.callPrem),
            be: [S0 - p.callPrem],
            beNote:'Assumes you own the shares at the entered stock price.'
          };
        }
      }
    },
    get fields(){ return this.legs[plWheelLeg()].fields; },
    payoff(S,p,S0){ return this.legs[plWheelLeg()].payoff(S,p,S0); },
    stats(p,S0){ return this.legs[plWheelLeg()].stats(p,S0); }
  },
  spread: {
    name:'Bull Call Spread',
    exKey:'pl-callspread',
    how:'<p>You <b>buy a call at the lower strike</b> and <b>sell a call at the higher strike</b> (same stock, same expiry). The sold call offsets part of the cost.</p><ul>'+
      '<li><b>Stock below the lower strike:</b> both calls expire worthless — you lose the net debit you paid.</li>'+
      '<li><b>Stock between the strikes:</b> partial profit; the bought call gains value while the sold call is still cheap.</li>'+
      '<li><b>Stock above the higher strike:</b> max profit — capped at (strike gap − net debit).</li></ul>',
    fields:[
      {key:'buyStrike', label:'Buy call strike — lower ($)', def:'', hint:'Strike of the call you buy.'},
      {key:'buyPrem', label:'Buy call premium per share ($)', def:'', hint:'What you pay for the lower-strike call.'},
      {key:'sellStrike', label:'Sell call strike — higher ($)', def:'', hint:'Strike of the call you sell (must be above the buy strike).'},
      {key:'sellPrem', label:'Sell call premium per share ($)', def:'', hint:'What you collect for the higher-strike call.'},
      {key:'n', label:'Contracts', def:'1', hint:'Contracts (each spread = 2 options).'}
    ],
    payoff(S,p){
      const d=p.buyPrem-p.sellPrem;
      return 100*p.n*(Math.max(S-p.buyStrike,0) - Math.max(S-p.sellStrike,0) - d);
    },
    stats(p){
      const d=p.buyPrem-p.sellPrem;
      return {
        maxP: 100*p.n*(p.sellStrike - p.buyStrike - d),
        maxL: -100*p.n*d,
        be: [p.buyStrike + d],
        beNote:'Net debit = buy premium − sell premium. Loss is capped at the debit; profit is capped by the strike gap.'
      };
    }
  },
  protput: {
    name:'Protective Put',
    exKey:'pl-protput',
    how:'<p>You <b>own 100 shares</b> and <b>buy a put</b> at the strike. Think of the premium as an insurance payment.</p><ul>'+
      '<li><b>Stock rises:</b> the put expires worthless; you keep the stock gains minus the premium paid.</li>'+
      '<li><b>Stock falls to the strike:</b> you are at the floor — losses stop growing.</li>'+
      '<li><b>Stock crashes below the strike:</b> the put gains $1 per $1 of drop, offsetting the stock loss. Your floor holds.</li></ul>',
    fields:[
      {key:'strike', label:'Put strike ($)', def:'', hint:'Your price floor.'},
      {key:'prem', label:'Put premium paid per share ($)', def:'', hint:'Cost of the insurance, per share.'},
      {key:'n', label:'Contracts', def:'1', hint:'1 contract protects 100 shares.'}
    ],
    payoff(S,p,S0){ return 100*p.n*(Math.max(S,p.strike) - S0 - p.prem); },
    stats(p,S0){
      return {
        maxP: Infinity,
        maxL: -100*p.n*(S0 - p.strike + p.prem),
        be: [S0 + p.prem],
        beNote:'Upside is unlimited (minus the premium). The floor is strike − premium paid.'
      };
    }
  }
};

function plOptionsHTML(){
  const stratOpts=Object.keys(plStrategies).map(k=>
    '<option value="'+k+'">'+Util.esc(plStrategies[k].name)+'</option>').join('');
  return '<div class="panel"><h2>Options Strategy Lab</h2>'+
    DATA_BADGE+
    '<p class="hint">Assistive (rule-based) educational payoff visualizer. Enter strikes and premiums; it draws the profit/loss at expiry and computes max profit, max loss, and '+
    ex('pl-breakeven','breakeven')+'(s). <b>Options involve risk; this is not advice.</b></p>'+
    '<div id="pl-alert"></div>'+
    '<div class="grid g2">'+
    '<div>'+fieldRow('Strategy', '<select class="in" id="plOpt-strat">'+stratOpts+'</select>')+'</div>'+
    '<div>'+fieldRow('Ticker (optional — fills in the latest close as the stock price)',
      tickerInput('plOpt-ticker',''))+'</div>'+
    '</div>'+
    fieldRow('Stock price today ($)', numInput('plOpt-s0','',0.01), 'Prefilled from the latest close when you pick a ticker; you can override it.')+
    '<div id="plOpt-fields"></div>'+
    '<div><button class="btn" id="plOpt-calc">Draw payoff diagram</button></div>'+
    '<div id="plOpt-how" style="margin-top:12px"></div>'+
    '<div id="plOpt-out" style="margin-top:12px"></div>'+
    '</div>'
    +qBsPanelHTML();
}
function plWheelLeg(){
  const r=document.querySelector('input[name="plOpt-leg"]:checked');
  return (r && (r.value==='put'||r.value==='call')) ? r.value : 'put';
}
function plOptionsFields(){
  const k=document.getElementById('plOpt-strat').value;
  const st=plStrategies[k];
  let html='';
  if(k==='wheel'){
    const leg=plWheelLeg();
    html+='<div style="margin:0 0 12px"><b>Model which leg:</b> '+
      '<label style="margin-right:16px"><input type="radio" name="plOpt-leg" value="put"'+(leg==='put'?' checked':'')+'> Cash-secured put</label>'+
      '<label><input type="radio" name="plOpt-leg" value="call"'+(leg==='call'?' checked':'')+'> Covered call</label></div>';
  }
  html+=st.fields.map(f=>
    fieldRow(f.label, numInput('plOpt-f_'+f.key, f.def, 0.01), f.hint)).join('');
  document.getElementById('plOpt-fields').innerHTML=html;
  document.getElementById('plOpt-how').innerHTML=
    '<details class="exp"><summary>How this works in plain English — '+Util.esc(st.name)+'</summary>'+st.how+'</details>';
  if(k==='wheel'){
    document.querySelectorAll('input[name="plOpt-leg"]').forEach(r=>
      r.addEventListener('change',plOptionsFields));
  }
}
function plOptionsCalc(){
  plClearErr();
  const k=document.getElementById('plOpt-strat').value;
  const st=plStrategies[k];
  const S0=plNum('plOpt-s0');
  if(!(S0>0)) return plErr('Enter a valid stock price greater than 0.');
  const p={};
  for(const f of st.fields){
    const v=plNum('plOpt-f_'+f.key);
    if(!(v>=0)||isNaN(v)) return plErr('Enter a valid number for "'+f.label+'".');
    p[f.key]=v;
  }
  if(!(p.n>0)) return plErr('Contracts must be at least 1.');
  if(k==='spread' && !(p.sellStrike>p.buyStrike)) return plErr('For a bull call spread the sell strike must be above the buy strike.');
  if(k==='wheel'){
    const leg=plWheelLeg();
    if(leg==='put' && !(p.putStrike>0)) return plErr('Enter a valid put strike greater than 0.');
    if(leg==='call' && !(p.callStrike>0)) return plErr('Enter a valid call strike greater than 0.');
  }
  const stats=st.stats(p,S0);
  // price range for diagram
  const strikes=Object.keys(p).filter(x=>/strike/i.test(x)).map(x=>p[x]).filter(v=>v>0);
  const loRef=Math.min(S0,...strikes), hiRef=Math.max(S0,...strikes);
  const lo=Math.max(0.01, loRef*0.5), hi=hiRef*1.5;
  const N=80, series=[];
  for(let i=0;i<N;i++){
    const S=lo+(hi-lo)*i/(N-1);
    series.push({y: st.payoff(S,p,S0)});
  }
  const maxPY=stats.maxP===Infinity?'unlimited upside':Util.money(stats.maxP);
  const beTxt=stats.be.map(b=>'$'+b.toFixed(2)).join(' and ');
  // scenarios
  const scen=[
    {label:'Price jumps 30%', S:S0*1.3, desc:''},
    {label:'Price stays flat', S:S0, desc:''},
    {label:'Price drops 30%', S:S0*0.7, desc:''}
  ];
  const scenRows=scen.map(sc=>{
    const pl=st.payoff(sc.S,p,S0);
    const verdict=pl>0?'a profit':(pl<0?'a loss':'breakeven');
    return '<tr><td>'+Util.esc(sc.label)+' ($'+sc.S.toFixed(2)+')</td><td class="num" style="color:'+(pl<0?'#f85149':'#3fb950')+'">'+plFmtSigned(pl)+'</td><td>That is '+verdict+' of '+Util.money(Math.abs(pl))+'.</td></tr>';
  }).join('');
  document.getElementById('plOpt-out').innerHTML=
    '<h3>Payoff at expiry — '+Util.esc(st.name)+'</h3>'+
    '<div class="grid g4">'+
    '<div class="kpi"><div class="k">Max profit</div><div class="v">'+maxPY+'</div></div>'+
    '<div class="kpi"><div class="k">Max loss</div><div class="v">'+Util.money(stats.maxL)+'</div></div>'+
    '<div class="kpi"><div class="k">'+ex('pl-breakeven','Breakeven')+'</div><div class="v">'+Util.esc(beTxt)+'</div></div>'+
    '<div class="kpi"><div class="k">Contracts</div><div class="v">'+Util.num(p.n,0)+'</div></div>'+
    '</div>'+
    '<p class="hint">'+Util.esc(stats.beNote)+'</p>'+
    '<h3>Profit / loss diagram</h3>'+
    Charts.line(series,720,240,'#58a6ff')+
    '<p class="hint">Horizontal: stock price at expiry from $'+lo.toFixed(2)+' to $'+hi.toFixed(2)+'. Vertical: total profit/loss for '+Util.num(p.n,0)+' contract(s) (100 shares each).</p>'+
    '<h3>What happens if…</h3>'+
    '<table class="tbl"><thead><tr><th>Scenario</th><th>P/L at expiry</th><th>Plain English</th></tr></thead><tbody>'+scenRows+'</tbody></table>'+
    '<p class="hint">Educational payoff visualizer only — not advice. Real options have time decay, early assignment, and bid/ask spreads this chart ignores.</p>';
}
function plOptionsAfter(){
  const wire=()=>{
    const tEl=document.getElementById('plOpt-ticker');
    const sEl=document.getElementById('plOpt-strat');
    const cEl=document.getElementById('plOpt-calc');
    if(!tEl||!sEl||!cEl) return;
    tEl.addEventListener('change',()=>{
      const t=tickerVal('plOpt-ticker');
      if(t){ const c=lastClose(t); if(c!=null) document.getElementById('plOpt-s0').value=c.toFixed(2); }
    });
    sEl.addEventListener('change',plOptionsFields);
    cEl.addEventListener('click',plOptionsCalc);
    plOptionsFields();
  };
  wire();
  if(typeof qBsAfter==='function') qBsAfter();
}
Router.routes['options']=function(){ return plOptionsHTML(); };
Router.routes['options'].after=function(){ plOptionsAfter(); };

/* ================================================================
   ROUTE 2 — DIVIDEND PLANNER
   ================================================================ */
function plDivLoad(){
  const s=(Store.db&&Store.db.settings)||{};
  if(!Array.isArray(s.plDiv)) s.plDiv=[];
  return s.plDiv;
}
function plDivSave(arr){
  if(!Store.db.settings) Store.db.settings={};
  Store.db.settings.plDiv=arr;
  Store.save();
}
function plDivHTML(){
  return '<div class="panel"><h2>Dividend Income Planner</h2>'+
    '<p class="hint">Assistive (rule-based) planner. Add positions you own or are considering. Annual dividend per share is <b>user-entered</b> — enter it from a reliable quote; dividend figures are not bundled with this site.</p>'+
    '<div id="pl-alert"></div>'+
    '<h3>Add a position</h3>'+
    '<div class="grid g4">'+
    '<div>'+fieldRow('Ticker', '<select class="in" id="plDiv-ticker"><option value="">—</option>'+plTickerOptions('')+'</select>'+textInput('plDiv-tickerFree','','or type ticker'))+'</div>'+
    '<div>'+fieldRow('Shares', numInput('plDiv-shares','',1))+'</div>'+
    '<div>'+fieldRow('Annual dividend / share ($)', numInput('plDiv-divps','',0.0001), 'Yearly total per share, from a reliable quote.')+'</div>'+
    '<div>'+fieldRow('Your cost basis / share ($)', numInput('plDiv-cost','',0.01), 'What you paid per share. Needed for yield on cost.')+'</div>'+
    '</div>'+
    fieldRow('Reinvest price / share ($) — for DRIP math', numInput('plDiv-price','',0.01), 'Defaults to the latest close of the ticker when available; otherwise enter a price.')+
    '<div><button class="btn" id="plDiv-add">Add position</button></div>'+
    '<h3>Your positions</h3><div id="plDiv-table"></div>'+
    '<h3>Summary</h3><div id="plDiv-kpis"></div>'+
    '<h3>'+ex('pl-drip','DRIP')+' projection</h3>'+
    '<div class="grid g2">'+
    '<div>'+fieldRow('Years to project', numInput('plDiv-years','10',1))+'</div>'+
    '<div>'+fieldRow('Income goal — target annual income ($)', numInput('plDiv-goal','',1), 'Optional. Shows the gap vs your projected income.')+'</div>'+
    '</div>'+
    '<div><button class="btn" id="plDiv-proj">Run projection</button></div>'+
    '<div id="plDiv-out" style="margin-top:12px"></div>'+
    '</div>';
}
function plDivRowHTML(r,i){
  const income=r.shares*r.divps;
  const yoc=(r.cost>0)?(r.divps/r.cost):null;
  const px=(r.price>0)?r.price:lastClose(r.ticker);
  return '<tr>'+
    '<td><span class="tag">'+Util.esc(r.ticker)+'</span></td>'+
    '<td class="num">'+Util.num(r.shares,2)+'</td>'+
    '<td class="num">'+Util.money(r.divps)+'</td>'+
    '<td class="num">'+Util.money(r.cost)+'</td>'+
    '<td class="num">'+(px!=null?Util.money(px):'—')+'</td>'+
    '<td class="num">'+Util.money(income)+'</td>'+
    '<td class="num">'+(yoc!=null?Util.pct(yoc):'—')+'</td>'+
    '<td><button class="btn sm" data-pldiv-del="'+i+'">Delete</button></td></tr>';
}
function plDivRender(){
  const arr=plDivLoad();
  const tbl=document.getElementById('plDiv-table');
  if(!tbl) return;
  if(!arr.length){
    tbl.innerHTML=emptyBox('No positions yet. Add one above to start planning.');
    document.getElementById('plDiv-kpis').innerHTML='';
  }else{
    let totInc=0, totCost=0;
    const rows=arr.map((r,i)=>{
      totInc+=r.shares*r.divps; totCost+=r.shares*r.cost;
      return plDivRowHTML(r,i);
    }).join('');
    tbl.innerHTML='<table class="tbl"><thead><tr><th>Ticker</th><th>Shares</th><th>Div/share</th><th>Cost/share</th><th>Reinvest price</th><th>Annual income</th><th>'+ex('pl-yieldcost','Yield on cost')+'</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>';
    const blend=totCost>0?totInc/totCost:null;
    document.getElementById('plDiv-kpis').innerHTML='<div class="grid g4">'+
      '<div class="kpi"><div class="k">Total annual income</div><div class="v">'+Util.money(totInc)+'</div></div>'+
      '<div class="kpi"><div class="k">Monthly average</div><div class="v">'+Util.money(totInc/12)+'</div></div>'+
      '<div class="kpi"><div class="k">Total cost basis</div><div class="v">'+Util.money(totCost)+'</div></div>'+
      '<div class="kpi"><div class="k">Blended '+ex('pl-yieldcost','yield on cost')+'</div><div class="v">'+(blend!=null?Util.pct(blend):'—')+'</div></div>'+
      '</div>';
  }
  tbl.querySelectorAll('[data-pldiv-del]').forEach(b=>{
    b.addEventListener('click',()=>{
      const a=plDivLoad(); a.splice(parseInt(b.getAttribute('data-pldiv-del'),10),1);
      plDivSave(a); plDivRender();
      document.getElementById('plDiv-out').innerHTML='';
    });
  });
}
function plDivProject(){
  plClearErr();
  const arr=plDivLoad();
  if(!arr.length) return plErr('Add at least one position first.');
  const yrs=Math.floor(plNum('plDiv-years'));
  if(!(yrs>=1&&yrs<=50)) return plErr('Projection years must be between 1 and 50.');
  const goal=plNum('plDiv-goal');
  // current income
  const curInc=arr.reduce((s,r)=>s+r.shares*r.divps,0);
  // DRIP projection: price assumed constant per position
  let rows='', totSharesEnd=0, dripIncEnd=0;
  const sims=arr.map(r=>{
    let px=(r.price>0)?r.price:lastClose(r.ticker);
    if(!(px>0)) px=null;
    return {r, px, shares:r.shares};
  });
  const bad=sims.filter(s=>!s.px);
  for(let y=1;y<=yrs;y++){
    let yrDripInc=0, yrCashInc=0, yrShares=0;
    for(const s of sims){
      const div=s.shares*s.r.divps;
      yrCashInc+=div;
      if(s.px){ s.shares+=div/s.px; }
      yrDripInc+=s.shares*s.r.divps;
      yrShares+=s.shares;
    }
    if(y===1||y===yrs||yrs<=12||y%5===0||y%Math.ceil(yrs/8)===0){
      rows+='<tr><td class="num">'+y+'</td><td class="num">'+Util.num(yrShares,2)+'</td>'+
        '<td class="num">'+Util.money(yrCashInc)+'</td><td class="num">'+Util.money(yrDripInc)+'</td></tr>';
    }
    if(y===yrs){ totSharesEnd=yrShares; dripIncEnd=yrDripInc; }
  }
  let goalHTML='';
  if(goal>0){
    const gapCur=goal-curInc, gapDrip=goal-dripIncEnd;
    goalHTML='<h3>Income goal check</h3><div class="grid g3">'+
      '<div class="kpi"><div class="k">Target annual income</div><div class="v">'+Util.money(goal)+'</div></div>'+
      '<div class="kpi"><div class="k">Gap vs today\'s income</div><div class="v">'+(gapCur>0?Util.money(gapCur)+' short':Util.money(-gapCur)+' over')+'</div></div>'+
      '<div class="kpi"><div class="k">Gap vs year-'+yrs+' DRIP income</div><div class="v">'+(gapDrip>0?Util.money(gapDrip)+' short':Util.money(-gapDrip)+' over')+'</div></div>'+
      '</div>';
  }
  document.getElementById('plDiv-out').innerHTML=
    '<h3>Projection — '+yrs+' years '+(document.getElementById('plDiv-years')?'':'')+'</h3>'+
    '<p class="hint"><b>Projection, not a promise.</b> Assumes dividends per share stay flat, the reinvest price never changes, and no taxes or fees. Real dividends get raised, cut, or suspended.</p>'+
    (bad.length?'<div class="alert">No reinvest price available for '+bad.map(s=>Util.esc(s.r.ticker)).join(', ')+' — those positions grow by cash income only. Enter a price to include them in DRIP math.</div>':'')+
    '<div class="grid g3">'+
    '<div class="kpi"><div class="k">Income today (cash)</div><div class="v">'+Util.money(curInc)+'</div></div>'+
    '<div class="kpi"><div class="k">Income in year '+yrs+' (cash, no DRIP)</div><div class="v">'+Util.money(curInc)+'</div></div>'+
    '<div class="kpi"><div class="k">Income in year '+yrs+' (with DRIP)</div><div class="v">'+Util.money(dripIncEnd)+'</div></div>'+
    '</div>'+
    '<table class="tbl"><thead><tr><th>Year</th><th>Total shares (DRIP)</th><th>Annual income — cash</th><th>Annual income — DRIP</th></tr></thead><tbody>'+rows+'</tbody></table>'+
    goalHTML;
}
function plDivAfter(){
  const add=document.getElementById('plDiv-add');
  const tickSel=document.getElementById('plDiv-ticker');
  const priceEl=document.getElementById('plDiv-price');
  tickSel.addEventListener('change',()=>{
    const t=tickSel.value||document.getElementById('plDiv-tickerFree').value.trim().toUpperCase();
    if(t){ const c=lastClose(t); if(c!=null&&!priceEl.value) priceEl.value=c.toFixed(2); }
  });
  add.addEventListener('click',()=>{
    plClearErr();
    const sel=tickSel.value;
    const free=document.getElementById('plDiv-tickerFree').value.trim().toUpperCase();
    const ticker=sel||free;
    if(!ticker) return plErr('Enter or pick a ticker.');
    const shares=plNum('plDiv-shares'), divps=plNum('plDiv-divps'),
          cost=plNum('plDiv-cost'), price=plNum('plDiv-price');
    if(!(shares>0)) return plErr('Shares must be greater than 0.');
    if(!(divps>=0)||isNaN(divps)) return plErr('Annual dividend per share must be 0 or more.');
    if(!(cost>=0)||isNaN(cost)) return plErr('Cost basis per share must be 0 or more.');
    let px=price;
    if(!(px>0)){ const c=lastClose(ticker); px=c!=null?c:0; }
    const arr=plDivLoad();
    arr.push({ticker, shares, divps, cost, price:px});
    plDivSave(arr);
    ['plDiv-shares','plDiv-divps','plDiv-cost','plDiv-price','plDiv-tickerFree'].forEach(id=>{document.getElementById(id).value='';});
    tickSel.value='';
    plDivRender();
  });
  document.getElementById('plDiv-proj').addEventListener('click',plDivProject);
  plDivRender();
}
Router.routes['dividends']=function(){ return plDivHTML(); };
Router.routes['dividends'].after=function(){ plDivAfter(); };

/* ================================================================
   ROUTE 3 — ROTH IRA PLANNER
   ================================================================ */
function plRothHTML(){
  return '<div class="panel"><h2>Roth IRA Planner</h2>'+
    '<p class="hint">Assistive (rule-based) projection. '+ex('pl-roth','What is a Roth IRA?')+'</p>'+
    '<details class="exp"><summary>How a Roth IRA works in plain English</summary>'+
    '<p>A Roth IRA is a retirement account with a tax tradeoff: you contribute <b>after-tax</b> dollars (no deduction today), but qualified withdrawals in retirement are <b>generally tax-free</b> if IRS rules are met — check current IRS rules.</p>'+
    '<ul><li><b>Why after-tax matters:</b> in a regular (traditional) account you may get a tax break now but pay tax when you withdraw. In a Roth you pay now and keep all the growth later.</li>'+
    '<li><b>Who it suits:</b> generally, savers who expect to be in the same or a higher tax bracket in retirement than they are now.</li>'+
    '<li><b>Limits:</b> the IRS sets a yearly contribution limit and income cutoffs — verify the current year\'s numbers; the default below is editable.</li></ul></details>'+
    '<div id="pl-alert"></div>'+
    '<div class="grid g3">'+
    '<div>'+fieldRow('Current age', numInput('plRoth-age','',1))+'</div>'+
    '<div>'+fieldRow('Retirement age', numInput('plRoth-ret','',1))+'</div>'+
    '<div>'+fieldRow('Current balance ($)', numInput('plRoth-bal','',1))+'</div>'+
    '<div>'+fieldRow('Yearly contribution ($)', numInput('plRoth-contrib','7000',1), 'IRS sets yearly limits — verify for the current year.')+'</div>'+
    '<div>'+fieldRow('Expected annual return (%)', numInput('plRoth-ret2','7',0.1), 'A guess about average yearly growth. The S&P 500 has averaged roughly 7–10% a year over long periods, before inflation.')+'</div>'+
    '</div>'+
    '<div><button class="btn" id="plRoth-calc">Project my Roth</button></div>'+
    '<div id="plRoth-out" style="margin-top:12px"></div>'+
    '</div>'
    +qRothTrackHTML();
}
function plRothCalc(){
  plClearErr();
  const age=plNum('plRoth-age'), ret=plNum('plRoth-ret'), bal0=plNum('plRoth-bal'),
        contrib=plNum('plRoth-contrib'), ratePct=plNum('plRoth-ret2');
  if(!(age>=0&&age<120)) return plErr('Enter a valid current age.');
  if(!(ret>age&&ret<=120)) return plErr('Retirement age must be greater than your current age.');
  if(!(bal0>=0)||isNaN(bal0)) return plErr('Current balance must be 0 or more.');
  if(!(contrib>=0)||isNaN(contrib)) return plErr('Yearly contribution must be 0 or more.');
  if(isNaN(ratePct)||ratePct<-50||ratePct>50) return plErr('Expected return should be between -50% and 50%.');
  const r=ratePct/100, yrs=Math.round(ret-age);
  let bal=bal0, totContrib=0, rows='', series=[];
  for(let y=1;y<=yrs;y++){
    const start=bal;
    bal=(bal+contrib)*(1+r);          // contribution at start of year
    totContrib+=contrib;
    const growth=bal-start-contrib;
    series.push({y:bal});
    if(yrs<=30||y<=5||y===yrs||y%Math.ceil(yrs/12)===0){
      rows+='<tr><td class="num">'+y+'</td><td class="num">'+(age+y)+'</td>'+
        '<td class="num">'+Util.money(contrib)+'</td><td class="num">'+Util.money(growth)+'</td>'+
        '<td class="num">'+Util.money(bal)+'</td></tr>';
    }
  }
  const totGrowth=bal-bal0-totContrib;
  document.getElementById('plRoth-out').innerHTML=
    '<h3>Projection to age '+ret+' — '+yrs+' years</h3>'+
    '<p class="hint"><b>Projection, not a prediction.</b> Assumes a constant '+Util.num(ratePct,1)+'% return every year, contributions at the start of each year, and no taxes, fees, or withdrawals. Real returns bounce around.</p>'+
    '<div class="grid g4">'+
    '<div class="kpi"><div class="k">Balance at retirement</div><div class="v">'+Util.money(bal)+'</div></div>'+
    '<div class="kpi"><div class="k">Total contributions</div><div class="v">'+Util.money(totContrib)+'</div></div>'+
    '<div class="kpi"><div class="k">Growth (compounding)</div><div class="v">'+Util.money(totGrowth)+'</div></div>'+
    '<div class="kpi"><div class="k">Starting balance</div><div class="v">'+Util.money(bal0)+'</div></div>'+
    '</div>'+
    '<h3>Balance growth</h3>'+
    Charts.line(series,720,240,'#3fb950')+
    '<p class="hint">Each point is the projected balance at the end of that year.</p>'+
    '<h3>Year by year</h3>'+
    '<table class="tbl"><thead><tr><th>Year</th><th>Age</th><th>Contribution</th><th>Growth</th><th>End balance</th></tr></thead><tbody>'+rows+'</tbody></table>';
}
function plRothAfter(){
  document.getElementById('plRoth-calc').addEventListener('click',plRothCalc);
  if(typeof qRothTrackAfter==='function') qRothTrackAfter();
}
Router.routes['roth']=function(){ return plRothHTML(); };
Router.routes['roth'].after=function(){ plRothAfter(); };

/* ================================================================
   ROUTE 4 — CONGRESS TRADING TRACKER
   ================================================================ */
const plCongRanges=[
  '$1,001 – $15,000','$15,001 – $50,000','$50,001 – $100,000',
  '$100,001 – $250,000','$250,001 – $500,000','$500,001 – $1,000,000',
  '$1,000,001 – $5,000,000','$5,000,001 – $25,000,000',
  '$25,000,001 – $50,000,000','Over $50,000,000'
];
function plCongressHTML(){
  const rangeOpts=plCongRanges.map(r=>'<option value="'+Util.esc(r)+'">'+Util.esc(r)+'</option>').join('');
  return '<div class="panel"><h2>Congress Trading Tracker</h2>'+
    DATA_BADGE+
    '<h3>Live congressional trading sources</h3>'+
    '<p class="hint">External sites that track disclosures. Nothing from them is copied into this page — click through to browse. Remember: every source below is <b>delayed by design</b>, because the filings it reads are published weeks after the trade happens.</p>'+
    '<div class="grid g3">'+
    '<a href="https://www.capitoltrades.com" target="_blank" rel="noopener" style="display:block;background:var(--panel2);border:1px solid var(--border);border-radius:10px;padding:14px;text-decoration:none;color:var(--text)"><b style="color:var(--link)">Capitol Trades &#8599;</b><p style="margin:8px 0 0">Searchable database of stock trades disclosed by members of Congress under the STOCK Act, with per-politician profiles and trade history.</p><p class="hint" style="margin:8px 0 0">STOCK Act disclosures are filed weeks after the trade — delayed by design.</p></a>'+
    '<a href="https://www.quiverquant.com/congresstrading" target="_blank" rel="noopener" style="display:block;background:var(--panel2);border:1px solid var(--border);border-radius:10px;padding:14px;text-decoration:none;color:var(--text)"><b style="color:var(--link)">Quiver Quantitative &#8599;</b><p style="margin:8px 0 0">Congressional trading dashboard that tracks disclosed lawmaker trades and backtests how closely following them would have performed.</p><p class="hint" style="margin:8px 0 0">Built from delayed STOCK Act filings — delayed by design.</p></a>'+
    '<a href="https://openinsider.com" target="_blank" rel="noopener" style="display:block;background:var(--panel2);border:1px solid var(--border);border-radius:10px;padding:14px;text-decoration:none;color:var(--text)"><b style="color:var(--link)">OpenInsider &#8599;</b><p style="margin:8px 0 0">Screener for insider buys and sells by company officers, directors, and large shareholders, from SEC Form 4 filings. <b>Note: this tracks corporate insider trading, not congressional trading.</b></p><p class="hint" style="margin:8px 0 0">Form 4 filings are published after the trade — delayed by design.</p></a>'+
    '</div>'+
    '<details class="exp"><summary>'+ex('pl-stockact','STOCK Act')+' — what the law requires, in plain English</summary>'+
    '<p>The STOCK Act (2012) says members of Congress and senior staff must <b>publicly disclose stock trades, generally within 30–45 days</b> of the trade.</p>'+
    '<ul><li><b>Where official records live:</b> for the <b>House</b>, the Office of the Clerk\'s financial disclosure reports; for the <b>Senate</b>, the Senate Financial Disclosure system (efd). Those are the primary sources — anything else is secondhand.</li>'+
    '<li><b>Disclosures are DELAYED by design.</b> By the time you see a filing, the trade is weeks old. You cannot trade "with" a member in real time.</li>'+
    '<li><b>A trade is not proof of inside information.</b> Members trade for all kinds of ordinary reasons — rebalancing, diversification, a spouse\'s account. Treat any filing as a <b>starting point for your own research only</b>, never as a buy or sell signal by itself.</li></ul></details>'+
    '<div id="pl-alert"></div>'+
    '<h3>Log a disclosure</h3>'+
    '<p class="hint">Your personal research log, saved in this browser only. It starts empty — <b>no trades are pre-loaded and none are fabricated</b>. Paste the official source link from the Clerk or Senate disclosure system.</p>'+
    '<div class="grid g3">'+
    '<div>'+fieldRow('Date filed', '<input class="in" type="date" id="plCong-date" value="'+Util.today()+'">')+'</div>'+
    '<div>'+fieldRow('Member name', textInput('plCong-member','','e.g. Jane Smith'))+'</div>'+
    '<div>'+fieldRow('Chamber', '<select class="in" id="plCong-chamber"><option>House</option><option>Senate</option></select>')+'</div>'+
    '<div>'+fieldRow('Ticker', textInput('plCong-ticker','','e.g. AAPL'))+'</div>'+
    '<div>'+fieldRow('Buy / Sell', '<select class="in" id="plCong-side"><option>Buy</option><option>Sell</option><option>Buy (partial)</option><option>Sell (partial)</option></select>')+'</div>'+
    '<div>'+fieldRow('Amount range', '<select class="in" id="plCong-range">'+rangeOpts+'</select>')+'</div>'+
    '</div>'+
    fieldRow('Source link (official disclosure)', textInput('plCong-src','','Paste the official Clerk/Senate filing link'), 'Paste the link from the House Office of the Clerk or Senate Financial Disclosure site.')+
    '<div><button class="btn" id="plCong-add">Add to log</button></div>'+
    '<h3>Your log</h3><div id="plCong-table"></div>'+
    '<h3>How to look one up — step by step</h3>'+
    '<ol>'+
    '<li><b>House trades:</b> go to the House Office of the Clerk\'s financial disclosure reports section and search by the member\'s name. Open the periodic transaction report (PTR) — that is the form used for stock trades.</li>'+
    '<li><b>Senate trades:</b> go to the Senate Financial Disclosure system (efd) and search by the senator\'s name for periodic transaction reports.</li>'+
    '<li><b>Read the filing itself:</b> note the <i>transaction date</i> (when the trade happened) versus the <i>filing date</i> (when it was disclosed) — the gap is the delay.</li>'+
    '<li><b>Check the amount range:</b> filings report ranges (like $15,001–$50,000), not exact dollar amounts.</li>'+
    '<li><b>Do your own research:</b> look at the company\'s financials and news before drawing any conclusion. Remember: delayed disclosure, ordinary motives, starting point only.</li>'+
    '</ol>'+
    '</div>';
}
function plCongRender(){
  const arr=Store.db.congress||[];
  const el=document.getElementById('plCong-table');
  if(!el) return;
  if(!arr.length){
    el.innerHTML=emptyBox('Your log is empty. Add a disclosure above when you find one in the official records.');
    return;
  }
  const rows=arr.map((t,i)=>
    '<tr><td class="mono">'+Util.esc(t.date)+'</td><td>'+Util.esc(t.member)+'</td>'+
    '<td>'+Util.esc(t.chamber)+'</td><td><span class="tag">'+Util.esc(t.ticker)+'</span></td>'+
    '<td>'+Util.esc(t.side)+'</td><td>'+Util.esc(t.range)+'</td>'+
    '<td>'+(t.src?'<span class="small mono">'+Util.esc(t.src.length>42?t.src.slice(0,42)+'…':t.src)+'</span>':'<span class="hint">—</span>')+'</td>'+
    '<td><button class="btn sm" data-plcong-del="'+i+'">Delete</button></td></tr>'
  ).join('');
  el.innerHTML='<table class="tbl"><thead><tr><th>Date filed</th><th>Member</th><th>Chamber</th><th>Ticker</th><th>Buy/Sell</th><th>Amount range</th><th>Source</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>'+
    '<p class="hint">'+arr.length+' entr'+(arr.length===1?'y':'ies')+' logged. Stored locally in this browser.</p>';
  el.querySelectorAll('[data-plcong-del]').forEach(b=>{
    b.addEventListener('click',()=>{
      Store.db.congress.splice(parseInt(b.getAttribute('data-plcong-del'),10),1);
      Store.save(); plCongRender();
    });
  });
}
function plCongAfter(){
  document.getElementById('plCong-add').addEventListener('click',()=>{
    plClearErr();
    const date=document.getElementById('plCong-date').value||Util.today();
    const member=document.getElementById('plCong-member').value.trim();
    const chamber=document.getElementById('plCong-chamber').value;
    const ticker=document.getElementById('plCong-ticker').value.trim().toUpperCase();
    const side=document.getElementById('plCong-side').value;
    const range=document.getElementById('plCong-range').value;
    const src=document.getElementById('plCong-src').value.trim();
    if(!member) return plErr('Enter the member\'s name.');
    if(!ticker) return plErr('Enter a ticker.');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) return plErr('Enter a valid filing date.');
    Store.db.congress.push({date, member, chamber, ticker, side, range, src});
    Store.save();
    ['plCong-member','plCong-ticker','plCong-src'].forEach(id=>{document.getElementById(id).value='';});
    document.getElementById('plCong-date').value=Util.today();
    plCongRender();
  });
  plCongRender();
}
Router.routes['congress']=function(){ return plCongressHTML(); };
Router.routes['congress'].after=function(){ plCongAfter(); };
