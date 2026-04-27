// js/core/ui.js
window.UI = (function () {
  'use strict';

  // ── Toast ─────────────────────────────────────────────────────────────────
  var _toastTimer = null;

  function toast(msg, type) {
    type = type || 'success';
    var colors = { success: '#1A9E5A', error: '#C4362A', info: '#2563EB', warning: '#D97706' };
    var el = document.getElementById('ui-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ui-toast';
      el.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;padding:12px 20px;border-radius:10px;color:#fff;font-size:14px;font-weight:600;max-width:320px;box-shadow:0 4px 20px rgba(0,0,0,.2);transition:opacity .3s,transform .3s;opacity:0;transform:translateY(-8px);pointer-events:none;font-family:inherit;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.background = colors[type] || colors.success;
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
    el.style.pointerEvents = 'auto';
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-8px)';
      el.style.pointerEvents = 'none';
    }, 3000);
  }

  // ── Confirm Modal ──────────────────────────────────────────────────────────
  function confirm(msg) {
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:8000;display:flex;align-items:center;justify-content:center;padding:20px;';
      overlay.innerHTML = '<div style="background:#fff;border-radius:16px;padding:28px;max-width:380px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);">' +
        '<p style="font-size:16px;font-weight:600;color:#1a1a1a;margin-bottom:24px;line-height:1.5;">' + msg + '</p>' +
        '<div style="display:flex;gap:10px;">' +
        '<button id="ui-confirm-no" style="flex:1;padding:12px;border-radius:10px;border:1.5px solid #D4C8C6;background:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Cancelar</button>' +
        '<button id="ui-confirm-yes" style="flex:1;padding:12px;border-radius:10px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Confirmar</button>' +
        '</div></div>';
      document.body.appendChild(overlay);
      overlay.querySelector('#ui-confirm-yes').onclick = function () { document.body.removeChild(overlay); resolve(true); };
      overlay.querySelector('#ui-confirm-no').onclick = function () { document.body.removeChild(overlay); resolve(false); };
      overlay.onclick = function (e) { if (e.target === overlay) { document.body.removeChild(overlay); resolve(false); } };
    });
  }

  // ── Generic Modal ──────────────────────────────────────────────────────────
  function modal(opts) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:7000;display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;transition:opacity .25s;';
    var maxW = opts.maxWidth || '560px';
    overlay.innerHTML = '<div style="background:#fff;border-radius:16px;width:100%;max-width:' + maxW + ';max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);transition:transform .25s;transform:scale(.96);">' +
      '<div style="padding:24px 24px 0;display:flex;align-items:center;justify-content:space-between;">' +
      '<h2 style="font-family:\'League Spartan\',sans-serif;font-size:20px;font-weight:800;">' + (opts.title || '') + '</h2>' +
      '<button class="ui-modal-close" style="background:#F2EDED;border:none;border-radius:50%;width:32px;height:32px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">✕</button>' +
      '</div>' +
      '<div style="padding:20px 24px;">' + (opts.body || '') + '</div>' +
      (opts.footer ? '<div style="padding:0 24px 24px;">' + opts.footer + '</div>' : '') +
      '</div>';
    document.body.appendChild(overlay);

    var inner = overlay.querySelector('div');
    requestAnimationFrame(function () {
      overlay.style.opacity = '1';
      inner.style.transform = 'scale(1)';
    });

    function close() {
      overlay.style.opacity = '0';
      inner.style.transform = 'scale(.96)';
      setTimeout(function () { if (overlay.parentNode) document.body.removeChild(overlay); }, 250);
    }

    overlay.querySelector('.ui-modal-close').onclick = close;
    overlay.onclick = function (e) { if (e.target === overlay) close(); };

    return { close: close, el: overlay };
  }

  // ── Loading Spinner ────────────────────────────────────────────────────────
  function loading(show) {
    var el = document.getElementById('ui-loading');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ui-loading';
      el.innerHTML = '<div style="width:44px;height:44px;border:4px solid rgba(196,54,42,.2);border-top-color:#C4362A;border-radius:50%;animation:uiSpin .7s linear infinite;"></div>';
      el.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,.75);z-index:9998;display:flex;align-items:center;justify-content:center;';
      if (!document.getElementById('ui-spin-style')) {
        var style = document.createElement('style');
        style.id = 'ui-spin-style';
        style.textContent = '@keyframes uiSpin{to{transform:rotate(360deg)}}';
        document.head.appendChild(style);
      }
      document.body.appendChild(el);
    }
    el.style.display = show ? 'flex' : 'none';
  }

  // ── Formatters ─────────────────────────────────────────────────────────────
  function fmt(val) {
    var n = parseFloat(val) || 0;
    return '€' + n.toFixed(2).replace('.', ',');
  }

  function fmtDate(ts) {
    if (!ts) return '—';
    var d;
    if (ts && typeof ts.toDate === 'function') d = ts.toDate();
    else if (ts instanceof Date) d = ts;
    else d = new Date(ts);
    var dd = String(d.getDate()).padStart(2, '0');
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var yyyy = d.getFullYear();
    return dd + '/' + mm + '/' + yyyy;
  }

  function fmtDateTime(ts) {
    if (!ts) return '—';
    var d;
    if (ts && typeof ts.toDate === 'function') d = ts.toDate();
    else if (ts instanceof Date) d = ts;
    else d = new Date(ts);
    return fmtDate(ts) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments;
      var ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  function emptyState(msg, icon) {
    return '<div style="text-align:center;padding:60px 20px;color:#8A7E7C;">' +
      '<div style="font-size:48px;margin-bottom:12px;">' + (icon || '📭') + '</div>' +
      '<p style="font-size:15px;font-weight:600;">' + msg + '</p>' +
      '</div>';
  }

  function badge(text, color) {
    var bg = color || '#F2EDED';
    var fg = '#1a1a1a';
    if (color === 'red') { bg = '#FFF0EE'; fg = '#C4362A'; }
    if (color === 'green') { bg = '#EDFAF3'; fg = '#1A9E5A'; }
    if (color === 'blue') { bg = '#EEF4FF'; fg = '#3B5BDB'; }
    if (color === 'orange') { bg = '#FFF7ED'; fg = '#D97706'; }
    if (color === 'gray') { bg = '#F1F5F9'; fg = '#64748B'; }
    return '<span style="display:inline-flex;align-items:center;font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px;background:' + bg + ';color:' + fg + ';">' + text + '</span>';
  }

  // ── Sub-tab renderer ───────────────────────────────────────────────────────
  function renderSubTabs(containerId, tabs, activeTab, onSelect) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = tabs.map(function (t) {
      return '<button class="subtab' + (t.key === activeTab ? ' subtab-active' : '') + '" data-key="' + t.key + '" style="' +
        'padding:9px 18px;border:none;background:transparent;font-size:13px;font-weight:700;cursor:pointer;' +
        'border-bottom:3px solid ' + (t.key === activeTab ? '#C4362A' : 'transparent') + ';' +
        'color:' + (t.key === activeTab ? '#C4362A' : '#8A7E7C') + ';margin-bottom:-1px;font-family:inherit;transition:all .15s;">' +
        t.label + '</button>';
    }).join('');
    el.querySelectorAll('.subtab').forEach(function (btn) {
      btn.onclick = function () {
        el.querySelectorAll('.subtab').forEach(function (b) {
          b.style.borderBottomColor = 'transparent';
          b.style.color = '#8A7E7C';
        });
        btn.style.borderBottomColor = '#C4362A';
        btn.style.color = '#C4362A';
        onSelect(btn.dataset.key);
      };
    });
  }

  return { toast, confirm, modal, loading, fmt, fmtDate, fmtDateTime, debounce, emptyState, badge, renderSubTabs };
})();
