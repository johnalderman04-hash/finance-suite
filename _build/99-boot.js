/* ================================================================
   99-boot.js — runs LAST, after every chunk registered its routes.
   ================================================================ */
(function finsuiteBoot(){
  Store.load();
  renderNav();
  if(!location.hash) location.hash='#/home';
  window.addEventListener('hashchange', function(){ Router.render(); });
  Router.render();
  if(typeof pcIsSet==='function'&&pcIsSet()&&!pcUnlocked()) pcShowLock();
})();
