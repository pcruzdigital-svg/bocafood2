// js/modules/marketing.js
window.Modules = window.Modules || {};
Modules.Marketing = (function () {
  'use strict';

  var _activeSub = 'promocoes';
  var _promos = [];
  var _cupons = [];
  var _upsells = [];
  var _reviews = [];
  var _products = [];
  var _editingId = null;

  var TABS = [
    { key: 'promocoes', label: '🎯 Promoções' },
    { key: 'cupons', label: '🎟️ Cupons' },
    { key: 'upsell', label: '⬆️ Upsell' },
    { key: 'avaliacoes', label: '⭐ Avaliações' }
  ];

  var PROMO_TYPES = [
    { key: '2x1', label: '2x1', desc: 'Compre 2, pague 1' },
    { key: 'pct', label: '% Desc.', desc: 'Desconto em percentagem' },
    { key: 'eur', label: '€ Desc.', desc: 'Desconto em valor fixo' },
    { key: 'add1', label: '+1 Grátis', desc: 'Item adicional grátis' },
    { key: 'extra_combo', label: 'Combo Extra', desc: 'Produto extra ao combinar' },
    { key: 'upgrade', label: 'Upgrade', desc: 'Upgrade automático de produto' },
    { key: 'pack', label: 'Pack', desc: 'Preço especial em pack' }
  ];

  function render(sub) {
    _activeSub = sub || 'promocoes';
    var app = document.getElementById('app');
    app.innerHTML = '<div id="marketing-root" style="display:flex;flex-direction:column;height:100%;">' +
      '<div style="background:#fff;border-bottom:1px solid #F2EDED;padding:0 24px;">' +
      '<h1 style="font-family:\'League Spartan\',sans-serif;font-size:24px;font-weight:800;padding:20px 0 0;">📣 Marketing</h1>' +
      '<div id="marketing-tabs" style="display:flex;gap:0;"></div>' +
      '</div>' +
      '<div id="marketing-content" style="flex:1;overflow-y:auto;padding:24px;"></div>' +
      '</div>';

    _renderTabs();
    _loadSub(_activeSub);
  }

  function _renderTabs() {
    var el = document.getElementById('marketing-tabs');
    el.innerHTML = TABS.map(function (t) {
      var active = t.key === _activeSub;
      return '<button data-key="' + t.key + '" onclick="Modules.Marketing._switchSub(\'' + t.key + '\')" style="padding:12px 18px;border:none;background:transparent;font-size:13px;font-weight:700;cursor:pointer;border-bottom:3px solid ' + (active ? '#C4362A' : 'transparent') + ';color:' + (active ? '#C4362A' : '#8A7E7C') + ';font-family:inherit;transition:all .15s;white-space:nowrap;">' + t.label + '</button>';
    }).join('');
  }

  function _switchSub(key) {
    _activeSub = key;
    _renderTabs();
    _loadSub(key);
    Router.navigate('marketing/' + key);
  }

  function _loadSub(key) {
    var content = document.getElementById('marketing-content');
    content.innerHTML = '<div style="text-align:center;padding:40px;color:#8A7E7C;">Carregando...</div>';
    if (key === 'promocoes') _renderPromos();
    else if (key === 'cupons') _renderCupons();
    else if (key === 'upsell') _renderUpsell();
    else if (key === 'avaliacoes') _renderAvaliacoes();
  }

  // ── PROMOÇÕES ─────────────────────────────────────────────────────────────
  function _renderPromos() {
    Promise.all([DB.getAll('promotions'), DB.getAll('products')]).then(function (r) {
      _promos = r[0] || [];
      _products = r[1] || [];
      _paintPromos();
    });
  }

  function _paintPromos() {
    var content = document.getElementById('marketing-content');
    if (!content) return;
    content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">' +
      '<h2 style="font-size:20px;font-weight:800;">Promoções (' + _promos.length + ')</h2>' +
      '<button onclick="Modules.Marketing._openPromoModal(null)" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Nova Promoção</button>' +
      '</div>' +
      (_promos.length === 0 ? UI.emptyState('Nenhuma promoção ainda', '🎯') :
        '<div style="display:flex;flex-direction:column;gap:10px;">' +
        _promos.map(function (p) { return _promoRowHTML(p); }).join('') + '</div>');
  }

  function _promoRowHTML(p) {
    var typeInfo = PROMO_TYPES.find(function (t) { return t.key === p.type; }) || { label: p.type };
    var COLOR_MAP = { '2x1': '#C4362A', 'pct': '#1A9E5A', 'eur': '#4338CA', 'add1': '#D97706', 'extra_combo': '#0891B2', 'upgrade': '#7C3AED', 'pack': '#DB2777' };
    var color = COLOR_MAP[p.type] || '#8A7E7C';
    return '<div style="background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.06);padding:14px 16px;display:flex;align-items:center;gap:12px;' + (p.active === false ? 'opacity:.6;' : '') + '">' +
      '<div style="flex:1;min-width:0;">' +
      '<div style="font-size:14px;font-weight:700;">' + p.name + '</div>' +
      '<div style="display:flex;align-items:center;gap:6px;margin-top:5px;flex-wrap:wrap;">' +
      '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:' + color + '20;color:' + color + ';">' + typeInfo.label + '</span>' +
      (p.value ? '<span style="font-size:11px;color:#8A7E7C;">Valor: ' + (p.type === 'pct' ? p.value + '%' : UI.fmt(p.value)) + '</span>' : '') +
      (p.productName ? '<span style="font-size:11px;color:#8A7E7C;">Produto: ' + p.productName + '</span>' : '') +
      '</div></div>' +
      '<div style="display:flex;gap:8px;align-items:center;">' +
      '<button onclick="Modules.Marketing._togglePromo(\'' + p.id + '\')" style="padding:6px 12px;border-radius:20px;border:none;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;background:' + (p.active !== false ? '#EDFAF3' : '#F2EDED') + ';color:' + (p.active !== false ? '#1A9E5A' : '#8A7E7C') + ';">' + (p.active !== false ? '● Ativa' : '○ Inativa') + '</button>' +
      '<button onclick="Modules.Marketing._openPromoModal(\'' + p.id + '\')" style="width:30px;height:30px;border-radius:8px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;">✏️</button>' +
      '<button onclick="Modules.Marketing._deletePromo(\'' + p.id + '\')" style="width:30px;height:30px;border-radius:8px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;">🗑️</button>' +
      '</div></div>';
  }

  function _openPromoModal(id) {
    _editingId = id;
    var p = id ? (_promos.find(function (x) { return x.id === id; }) || {}) : { type: 'pct', active: true };
    var prodOptions = _products.map(function (prod) {
      return '<option value="' + prod.id + '"' + (p.productId === prod.id ? ' selected' : '') + '>' + (prod.emoji || '') + ' ' + prod.name + '</option>';
    }).join('');

    var body = '<div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Nome da Promoção *</label><input id="prm-name" type="text" value="' + (p.name || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:8px;">Tipo de Promoção</label>' +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">' +
      PROMO_TYPES.map(function (t) {
        return '<button type="button" data-ptype="' + t.key + '" onclick="Modules.Marketing._selectPromoType(\'' + t.key + '\')" style="padding:8px 4px;border:1.5px solid ' + (p.type === t.key ? '#C4362A' : '#D4C8C6') + ';border-radius:9px;font-size:11px;font-weight:700;cursor:pointer;background:' + (p.type === t.key ? '#FFF0EE' : '#fff') + ';color:' + (p.type === t.key ? '#C4362A' : '#8A7E7C') + ';font-family:inherit;text-align:center;transition:all .15s;">' + t.label + '</button>';
      }).join('') + '</div></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Valor (% ou €)</label><input id="prm-value" type="number" step="0.01" value="' + (p.value || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Pedido Mínimo (€)</label><input id="prm-min" type="number" step="0.01" value="' + (p.minOrder || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '</div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Produto Aplicado</label>' +
      '<select id="prm-product" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"><option value="">Todos os produtos</option>' + prodOptions + '</select></div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:#F2EDED;border-radius:10px;">' +
      '<div><div style="font-size:13px;font-weight:600;">Promoção Ativa</div></div>' +
      '<button type="button" id="prm-active-toggle" onclick="Modules.Marketing._togglePromoActive()" style="width:42px;height:24px;border-radius:12px;border:none;cursor:pointer;position:relative;transition:background .2s;background:' + (p.active !== false ? '#C4362A' : '#D4C8C6') + ';">' +
      '<span style="position:absolute;top:3px;left:3px;width:18px;height:18px;background:#fff;border-radius:50%;transition:transform .2s;display:block;transform:translateX(' + (p.active !== false ? '18px' : '0') + ');box-shadow:0 1px 4px rgba(0,0,0,.2);"></span></button>' +
      '</div></div>';

    window._promoType = p.type || 'pct';
    window._promoActive = p.active !== false;
    var footer = '<button onclick="Modules.Marketing._savePromo()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">' + (id ? 'Atualizar' : 'Criar Promoção') + '</button>';
    window._promoModal = UI.modal({ title: id ? 'Editar Promoção' : 'Nova Promoção', body: body, footer: footer });
  }

  function _selectPromoType(type) {
    window._promoType = type;
    document.querySelectorAll('[data-ptype]').forEach(function (btn) {
      var active = btn.dataset.ptype === type;
      btn.style.borderColor = active ? '#C4362A' : '#D4C8C6';
      btn.style.background = active ? '#FFF0EE' : '#fff';
      btn.style.color = active ? '#C4362A' : '#8A7E7C';
    });
  }

  function _togglePromoActive() {
    window._promoActive = !window._promoActive;
    var btn = document.getElementById('prm-active-toggle');
    if (btn) {
      btn.style.background = window._promoActive ? '#C4362A' : '#D4C8C6';
      var span = btn.querySelector('span');
      if (span) span.style.transform = 'translateX(' + (window._promoActive ? '18px' : '0') + ')';
    }
  }

  function _savePromo() {
    var name = (document.getElementById('prm-name') || {}).value || '';
    if (!name) { UI.toast('Nome é obrigatório', 'error'); return; }
    var productId = (document.getElementById('prm-product') || {}).value || '';
    var product = productId ? _products.find(function (p) { return p.id === productId; }) : null;
    var data = {
      name: name,
      type: window._promoType || 'pct',
      value: parseFloat((document.getElementById('prm-value') || {}).value) || 0,
      minOrder: parseFloat((document.getElementById('prm-min') || {}).value) || 0,
      productId: productId,
      productName: product ? product.name : '',
      active: window._promoActive !== false
    };
    var op = _editingId ? DB.update('promotions', _editingId, data) : DB.add('promotions', data);
    op.then(function () {
      UI.toast('Promoção salva!', 'success');
      if (window._promoModal) window._promoModal.close();
      _renderPromos();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _togglePromo(id) {
    var p = _promos.find(function (x) { return x.id === id; });
    if (!p) return;
    DB.update('promotions', id, { active: p.active === false }).then(function () {
      _renderPromos();
    });
  }

  function _deletePromo(id) {
    UI.confirm('Eliminar esta promoção?').then(function (yes) {
      if (!yes) return;
      DB.remove('promotions', id).then(function () { UI.toast('Eliminado', 'info'); _renderPromos(); });
    });
  }

  // ── CUPONS ────────────────────────────────────────────────────────────────
  function _renderCupons() {
    DB.getAll('coupons').then(function (data) {
      _cupons = data || [];
      _paintCupons();
    });
  }

  function _paintCupons() {
    var content = document.getElementById('marketing-content');
    if (!content) return;
    content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">' +
      '<h2 style="font-size:20px;font-weight:800;">Cupons (' + _cupons.length + ')</h2>' +
      '<button onclick="Modules.Marketing._openCuponModal(null)" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Novo Cupom</button>' +
      '</div>' +
      (_cupons.length === 0 ? UI.emptyState('Nenhum cupom ainda', '🎟️') :
        '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
        '<thead><tr style="background:#F2EDED;">' +
        ['Código','Tipo','Valor','Pedido Mín.','Máx. Usos','Validade','Usos',''].map(function (h) {
          return '<th style="padding:12px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;white-space:nowrap;">' + h + '</th>';
        }).join('') + '</tr></thead><tbody>' +
        _cupons.map(function (c) {
          var expired = c.expiry && new Date(c.expiry) < new Date();
          return '<tr style="border-top:1px solid #F2EDED;' + (expired ? 'opacity:.6;' : '') + '">' +
            '<td style="padding:12px 14px;font-size:13px;font-weight:800;font-family:\'Courier New\',monospace;letter-spacing:1px;">' + c.code + '</td>' +
            '<td style="padding:12px 14px;font-size:12px;">' + UI.badge(c.type === 'pct' ? 'Percentagem' : 'Valor Fixo', c.type === 'pct' ? 'green' : 'blue') + '</td>' +
            '<td style="padding:12px 14px;font-size:13px;font-weight:700;">' + (c.type === 'pct' ? c.value + '%' : UI.fmt(c.value)) + '</td>' +
            '<td style="padding:12px 14px;font-size:13px;">' + (c.minOrder ? UI.fmt(c.minOrder) : '—') + '</td>' +
            '<td style="padding:12px 14px;font-size:13px;">' + (c.maxUses || '∞') + '</td>' +
            '<td style="padding:12px 14px;font-size:12px;">' + (c.expiry ? UI.fmtDate(new Date(c.expiry)) : '—') + (expired ? ' ' + UI.badge('Expirado', 'red') : '') + '</td>' +
            '<td style="padding:12px 14px;font-size:13px;">' + (c.usesCount || 0) + '</td>' +
            '<td style="padding:12px 8px;white-space:nowrap;">' +
            '<button onclick="Modules.Marketing._openCuponModal(\'' + c.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;margin-right:4px;">✏️</button>' +
            '<button onclick="Modules.Marketing._deleteCupon(\'' + c.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;">🗑️</button>' +
            '</td></tr>';
        }).join('') + '</tbody></table></div>');
  }

  function _openCuponModal(id) {
    _editingId = id;
    var c = id ? (_cupons.find(function (x) { return x.id === id; }) || {}) : { type: 'pct' };
    var body = '<div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Código do Cupom *</label><input id="cup-code" type="text" value="' + (c.code || '') + '" placeholder="BRASIL10" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;text-transform:uppercase;" oninput="this.value=this.value.toUpperCase()"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Tipo</label><select id="cup-type" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"><option value="pct"' + (c.type === 'pct' ? ' selected' : '') + '>Percentagem (%)</option><option value="eur"' + (c.type === 'eur' ? ' selected' : '') + '>Valor Fixo (€)</option></select></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Valor</label><input id="cup-value" type="number" step="0.01" value="' + (c.value || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Pedido Mínimo (€)</label><input id="cup-min" type="number" step="0.01" value="' + (c.minOrder || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Máx. Usos</label><input id="cup-max" type="number" value="' + (c.maxUses || '') + '" placeholder="Ilimitado" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Validade</label><input id="cup-expiry" type="date" value="' + (c.expiry || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '</div></div>';

    var footer = '<button onclick="Modules.Marketing._saveCupon()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">' + (id ? 'Atualizar' : 'Criar Cupom') + '</button>';
    window._cupomModal = UI.modal({ title: id ? 'Editar Cupom' : 'Novo Cupom', body: body, footer: footer });
  }

  function _saveCupon() {
    var code = (document.getElementById('cup-code') || {}).value || '';
    if (!code) { UI.toast('Código é obrigatório', 'error'); return; }
    var data = {
      code: code.toUpperCase(),
      type: (document.getElementById('cup-type') || {}).value || 'pct',
      value: parseFloat((document.getElementById('cup-value') || {}).value) || 0,
      minOrder: parseFloat((document.getElementById('cup-min') || {}).value) || 0,
      maxUses: parseInt((document.getElementById('cup-max') || {}).value) || null,
      expiry: (document.getElementById('cup-expiry') || {}).value || null,
      usesCount: _editingId ? ((_cupons.find(function (c) { return c.id === _editingId; }) || {}).usesCount || 0) : 0
    };
    var op = _editingId ? DB.update('coupons', _editingId, data) : DB.add('coupons', data);
    op.then(function () {
      UI.toast('Cupom salvo!', 'success');
      if (window._cupomModal) window._cupomModal.close();
      _renderCupons();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _deleteCupon(id) {
    UI.confirm('Eliminar este cupom?').then(function (yes) {
      if (!yes) return;
      DB.remove('coupons', id).then(function () { UI.toast('Eliminado', 'info'); _renderCupons(); });
    });
  }

  // ── UPSELL ────────────────────────────────────────────────────────────────
  function _renderUpsell() {
    Promise.all([DB.getAll('upsellRules'), DB.getAll('products')]).then(function (r) {
      _upsells = r[0] || [];
      _products = r[1] || [];
      _paintUpsell();
    });
  }

  function _paintUpsell() {
    var content = document.getElementById('marketing-content');
    if (!content) return;
    var TRIGGERS = { 'on_add': 'Ao adicionar', 'cart_min': 'Valor mínimo no carrinho', 'before_send': 'Antes de enviar' };
    content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">' +
      '<h2 style="font-size:20px;font-weight:800;">Regras de Upsell (' + _upsells.length + ')</h2>' +
      '<button onclick="Modules.Marketing._openUpsellModal(null)" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Nova Regra</button>' +
      '</div>' +
      '<p style="font-size:12px;color:#8A7E7C;margin-bottom:16px;">Sugira produtos adicionais automaticamente para aumentar o ticket médio.</p>' +
      (_upsells.length === 0 ? UI.emptyState('Nenhuma regra de upsell', '⬆️') :
        '<div style="display:flex;flex-direction:column;gap:10px;">' +
        _upsells.map(function (u) {
          var prod = _products.find(function (p) { return p.id === u.productId; });
          return '<div style="background:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 2px 8px rgba(0,0,0,.06);display:flex;align-items:center;gap:12px;">' +
            '<div style="flex:1;">' +
            '<div style="font-size:14px;font-weight:700;">' + (prod ? prod.name : '?') + (u.discount ? ' — ' + u.discount + '% desc.' : '') + '</div>' +
            '<div style="font-size:11px;color:#8A7E7C;margin-top:3px;">Trigger: ' + (TRIGGERS[u.trigger] || u.trigger) + (u.cartMin ? ' · Mínimo: ' + UI.fmt(u.cartMin) : '') + '</div>' +
            '</div>' +
            '<button onclick="Modules.Marketing._openUpsellModal(\'' + u.id + '\')" style="width:30px;height:30px;border-radius:8px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;">✏️</button>' +
            '<button onclick="Modules.Marketing._deleteUpsell(\'' + u.id + '\')" style="width:30px;height:30px;border-radius:8px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;">🗑️</button>' +
            '</div>';
        }).join('') + '</div>');
  }

  function _openUpsellModal(id) {
    _editingId = id;
    var u = id ? (_upsells.find(function (x) { return x.id === id; }) || {}) : { trigger: 'on_add' };
    var prodOptions = _products.map(function (p) {
      return '<option value="' + p.id + '"' + (u.productId === p.id ? ' selected' : '') + '>' + (p.emoji || '') + ' ' + p.name + '</option>';
    }).join('');

    var body = '<div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Produto a Sugerir *</label>' +
      '<select id="ups-product" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"><option value="">Selecionar produto</option>' + prodOptions + '</select></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Desconto (%)</label><input id="ups-disc" type="number" step="1" value="' + (u.discount || '') + '" placeholder="0" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Trigger</label>' +
      '<select id="ups-trigger" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;">' +
      '<option value="on_add"' + (u.trigger === 'on_add' ? ' selected' : '') + '>Ao adicionar produto</option>' +
      '<option value="cart_min"' + (u.trigger === 'cart_min' ? ' selected' : '') + '>Valor mínimo no carrinho</option>' +
      '<option value="before_send"' + (u.trigger === 'before_send' ? ' selected' : '') + '>Antes de enviar pedido</option>' +
      '</select></div>' +
      '</div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Valor Mínimo do Carrinho (€)</label><input id="ups-min" type="number" step="0.01" value="' + (u.cartMin || '') + '" placeholder="Apenas para trigger de valor mínimo" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '</div>';

    var footer = '<button onclick="Modules.Marketing._saveUpsell()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">' + (id ? 'Atualizar' : 'Criar Regra') + '</button>';
    window._upsellModal = UI.modal({ title: id ? 'Editar Upsell' : 'Nova Regra de Upsell', body: body, footer: footer });
  }

  function _saveUpsell() {
    var productId = (document.getElementById('ups-product') || {}).value || '';
    if (!productId) { UI.toast('Selecione um produto', 'error'); return; }
    var data = {
      productId: productId,
      discount: parseFloat((document.getElementById('ups-disc') || {}).value) || 0,
      trigger: (document.getElementById('ups-trigger') || {}).value || 'on_add',
      cartMin: parseFloat((document.getElementById('ups-min') || {}).value) || 0
    };
    var op = _editingId ? DB.update('upsellRules', _editingId, data) : DB.add('upsellRules', data);
    op.then(function () {
      UI.toast('Regra salva!', 'success');
      if (window._upsellModal) window._upsellModal.close();
      _renderUpsell();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _deleteUpsell(id) {
    UI.confirm('Eliminar esta regra?').then(function (yes) {
      if (!yes) return;
      DB.remove('upsellRules', id).then(function () { UI.toast('Eliminado', 'info'); _renderUpsell(); });
    });
  }

  // ── AVALIAÇÕES ────────────────────────────────────────────────────────────
  function _renderAvaliacoes() {
    DB.getAll('reviews').then(function (data) {
      _reviews = (data || []).sort(function (a, b) {
        var ta = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : 0;
        var tb = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : 0;
        return tb - ta;
      });
      _paintAvaliacoes();
    });
  }

  function _paintAvaliacoes() {
    var content = document.getElementById('marketing-content');
    if (!content) return;
    var pending = _reviews.filter(function (r) { return !r.approved && !r.rejected; }).length;
    content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">' +
      '<h2 style="font-size:20px;font-weight:800;">Avaliações (' + _reviews.length + ')' +
      (pending > 0 ? ' <span style="font-size:13px;font-weight:700;padding:2px 9px;border-radius:20px;background:#FFF0EE;color:#C4362A;">' + pending + ' pendentes</span>' : '') + '</h2>' +
      '</div>' +
      (_reviews.length === 0 ? UI.emptyState('Nenhuma avaliação ainda', '⭐') :
        '<div style="display:flex;flex-direction:column;gap:12px;">' +
        _reviews.map(function (r) {
          var stars = '★'.repeat(r.rating || 0) + '☆'.repeat(5 - (r.rating || 0));
          var statusLabel = r.approved ? UI.badge('Aprovada', 'green') : r.rejected ? UI.badge('Rejeitada', 'red') : UI.badge('Pendente', 'orange');
          return '<div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
            '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;">' +
            '<div>' +
            '<div style="font-size:14px;font-weight:700;">' + (r.customerName || 'Cliente') + '</div>' +
            '<div style="color:#D97706;font-size:16px;">' + stars + ' <span style="font-size:12px;color:#8A7E7C;font-weight:600;">(' + (r.rating || 0) + '/5)</span></div>' +
            '<div style="font-size:11px;color:#8A7E7C;">' + UI.fmtDate(r.createdAt) + '</div>' +
            '</div>' + statusLabel + '</div>' +
            (r.comment ? '<p style="font-size:13px;color:#1a1a1a;margin-bottom:10px;line-height:1.5;">"' + r.comment + '"</p>' : '') +
            (r.reply ? '<div style="background:#F2EDED;border-radius:9px;padding:10px;margin-bottom:10px;font-size:12px;"><strong>↩️ Resposta:</strong> ' + r.reply + '</div>' : '') +
            (!r.approved && !r.rejected ? '<div style="display:flex;gap:8px;">' +
              '<button onclick="Modules.Marketing._approveReview(\'' + r.id + '\')" style="flex:1;padding:9px;border-radius:9px;border:none;background:#EDFAF3;color:#1A9E5A;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">✅ Aprovar</button>' +
              '<button onclick="Modules.Marketing._rejectReview(\'' + r.id + '\')" style="flex:1;padding:9px;border-radius:9px;border:none;background:#FFF0EE;color:#C4362A;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">❌ Rejeitar</button>' +
              '<button onclick="Modules.Marketing._replyReview(\'' + r.id + '\')" style="flex:1;padding:9px;border-radius:9px;border:none;background:#EEF4FF;color:#2563EB;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">↩️ Responder</button>' +
              '</div>' :
              '<button onclick="Modules.Marketing._replyReview(\'' + r.id + '\')" style="padding:9px 16px;border-radius:9px;border:none;background:#EEF4FF;color:#2563EB;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">↩️ ' + (r.reply ? 'Editar Resposta' : 'Responder') + '</button>') +
            '</div>';
        }).join('') + '</div>');
  }

  function _approveReview(id) {
    DB.update('reviews', id, { approved: true, rejected: false }).then(function () {
      UI.toast('Avaliação aprovada', 'success'); _renderAvaliacoes();
    });
  }

  function _rejectReview(id) {
    DB.update('reviews', id, { rejected: true, approved: false }).then(function () {
      UI.toast('Avaliação rejeitada', 'info'); _renderAvaliacoes();
    });
  }

  function _replyReview(id) {
    var r = _reviews.find(function (x) { return x.id === id; });
    var body = '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Resposta</label>' +
      '<textarea id="rev-reply" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;min-height:100px;resize:vertical;">' + (r ? (r.reply || '') : '') + '</textarea></div>';
    var footer = '<button onclick="Modules.Marketing._saveReply(\'' + id + '\')" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Salvar Resposta</button>';
    window._replyModal = UI.modal({ title: 'Responder Avaliação', body: body, footer: footer });
  }

  function _saveReply(id) {
    var reply = (document.getElementById('rev-reply') || {}).value || '';
    DB.update('reviews', id, { reply: reply }).then(function () {
      UI.toast('Resposta salva!', 'success');
      if (window._replyModal) window._replyModal.close();
      _renderAvaliacoes();
    });
  }

  function destroy() {}

  return {
    render: render, destroy: destroy,
    _switchSub: _switchSub,
    _openPromoModal: _openPromoModal, _selectPromoType: _selectPromoType, _togglePromoActive: _togglePromoActive, _savePromo: _savePromo, _togglePromo: _togglePromo, _deletePromo: _deletePromo,
    _openCuponModal: _openCuponModal, _saveCupon: _saveCupon, _deleteCupon: _deleteCupon,
    _openUpsellModal: _openUpsellModal, _saveUpsell: _saveUpsell, _deleteUpsell: _deleteUpsell,
    _approveReview: _approveReview, _rejectReview: _rejectReview, _replyReview: _replyReview, _saveReply: _saveReply
  };
})();
