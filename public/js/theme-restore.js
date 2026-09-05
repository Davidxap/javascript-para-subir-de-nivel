// theme-restore.js — reaplica el tema personalizado tras navegar entre capítulos
(function() {
  function restore() {
    try {
      var t = localStorage.getItem('jpsn-theme');
      if (!t) return;
      document.documentElement.setAttribute('data-custom-theme', t);
      if (['mocha','dracula','one-dark','gruvbox','nord','tokyo-night','everforest','kanagawa'].indexOf(t) !== -1) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else if (t === 'light' || t === 'github-light' || t === 'solarized-light' || t === 'flexoki-light' || t === 'rose-pine-dawn') {
        document.documentElement.setAttribute('data-theme', 'light');
      }
      var sel = document.getElementById('theme-select');
      if (sel) sel.value = t;
    } catch (e) {}
  }
  document.addEventListener('astro:page-load', restore);
  document.addEventListener('astro:after-swap', restore);
})();
