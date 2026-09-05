// interactive.js — Run + Copy buttons on every JS code block
(function() {
  'use strict';

  function init() {
    document.querySelectorAll('pre code').forEach(el => {
      if (el.closest('.interactive-done')) return;

      const lang = el.className.match(/language-(javascript|js)/);
      const pre = el.closest('pre');
      if (!pre) return;

      // Mark as processed
      pre.classList.add('interactive-done');

      // Only add buttons to javascript/js blocks
      if (!lang) return;

      const code = el.textContent;

      // === Run Button ===
      const runBtn = createBtn('▶ Run', 'cr-inline-run', pre, function() {
        let out = pre.querySelector('.cr-inline-out');
        if (!out) {
          out = document.createElement('pre');
          out.className = 'cr-inline-out';
          pre.appendChild(out);
        }
        out.hidden = false;
        out.textContent = '⏳ Running...';

        setTimeout(() => {
          try {
            const logs = [];
            const iframe = document.createElement('iframe');
            iframe.sandbox = 'allow-scripts';
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
            const win = iframe.contentWindow;

            win.console.log = (...args) => logs.push(args.map(fmt).join(' '));
            win.console.error = (...args) => logs.push('✗ ' + args.map(fmt).join(' '));
            win.console.warn = (...args) => logs.push('⚠ ' + args.map(fmt).join(' '));
            win.console.info = (...args) => logs.push('ℹ ' + args.map(fmt).join(' '));

            win.eval(code);
            out.textContent = logs.length ? logs.join('\n') : '✓ (no output)';
          } catch (e) {
            out.textContent = `⚠ ${e.name}: ${e.message}\n  at ${e.stack?.split('\n').at(-1) || 'unknown'}`;
          } finally {
            iframe.remove();
          }
        }, 10);
      });

      // === Copy Button ===
      const copyBtn = createBtn('Copy', 'cr-inline-copy', pre, function() {
        navigator.clipboard.writeText(code).then(() => {
          copyBtn.textContent = '✓ Copied';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.textContent = 'Copy';
            copyBtn.classList.remove('copied');
          }, 2000);
        }).catch(() => {
          // Fallback
          const ta = document.createElement('textarea');
          ta.value = code;
          ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
          copyBtn.textContent = '✓ Copied';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.textContent = 'Copy';
            copyBtn.classList.remove('copied');
          }, 2000);
        });
      });
    });
  }

  function createBtn(label, cls, parent, handler) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.className = cls;
    btn.setAttribute('aria-label', label);
    parent.style.position = 'relative';
    parent.appendChild(btn);
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      handler.call(this);
    });
    return btn;
  }

  function fmt(v) {
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    if (typeof v === 'object') { try { return JSON.stringify(v); } catch { return String(v); } }
    return String(v);
  }

  // Run on DOM ready and on Astro page transitions
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  document.addEventListener('astro:page-load', init);

  // Smooth scroll to top button
  scrollTopBtn();
  function scrollTopBtn() {
    if (document.getElementById('back-to-top')) return;
    const btn = document.createElement('button');
    btn.id = 'back-to-top'; btn.className='back-to-top-btn';
    btn.textContent = '↑ Top';
    btn.style.cssText = `
      position:fixed;bottom:24px;right:24px;
      font-size:11px;font-weight:700;letter-spacing:0.06em;
      text-transform:uppercase;padding:6px 12px;border-radius:8px;
      border:1px solid var(--sl-color-hairline);
      background:var(--sl-color-accent);color:#11111b;
      cursor:pointer;opacity:0;pointer-events:none;
      transition:opacity 0.25s;z-index:9999;font-family:inherit;
    `;
    document.body.appendChild(btn);
    window.addEventListener('scroll', () => {
      const show = window.scrollY > 400;
      btn.style.opacity = show ? '0.85' : '0';
      btn.style.pointerEvents = show ? 'auto' : 'none';
    });
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }
})();
