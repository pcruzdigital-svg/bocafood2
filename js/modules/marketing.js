// js/modules/marketing.js
window.Modules = window.Modules || {};
Modules.Marketing = (function () {
  'use strict';

  var _activeSub = 'promocoes';
  var _promos = [];
  var _cupons = [];
  var _upsells = [];
  var _customers = [];
  var _reviews = [];
  var _products = [];
  var _orders = [];
  var _events = [];
  var _pointsConfig = null;
  var _pointsMovements = [];
  var _editingId = null;
  var _moneyConfig = { desiredMarginPct: 60, minMarginPct: 40 };
  var _reviewUi = {
    query: '',
    status: 'all',
    period: 'all',
    stars: 'all',
    periodStart: '',
    periodEnd: ''
  };
  var _upsellPerfUi = {
    period: 'last30',
    periodStart: '',
    periodEnd: ''
  };
  var _upsellUi = {
    query: '',
    status: 'all',
    types: [],
    benefits: [],
    period: 'all',
    periodStart: '',
    periodEnd: '',
    productQuery: ''
  };
  var _promoUi = {
    query: '',
    status: 'all',
    type: 'all',
    period: 'all'
  };
  var firstText = window.firstText || function () {
    for (var i = 0; i < arguments.length; i += 1) {
      var v = arguments[i];
      if (typeof v === 'string' && v.trim()) return v;
    }
    return '';
  };

  var TABS = [
    { key: 'promocoes', title: 'Vender mais rápido', subtitle: 'Promoções' },
    { key: 'upsell', title: 'Aumentar valor do pedido', subtitle: 'Upsell' },
    { key: 'cupons', title: 'Atrair clientes', subtitle: 'Cupons' },
    { key: 'pontos', title: 'Fidelizar clientes', subtitle: 'Programa de Pontos' }
  ];

  var PROMO_TYPES = [
    { key: 'pct', label: 'Desconto (%)', hint: 'Mais volume de vendas', icon: '%' },
    { key: 'eur', label: 'Desconto (€)', hint: 'Controle direto do valor', icon: '€' },
    { key: '2x1', label: '2 por 1', hint: 'Aumentar giro rápido', icon: '2x1' },
    { key: 'add1', label: 'Leve mais', hint: 'Fazer o cliente comprar mais', icon: '+' },
    { key: 'frete', label: 'Frete grátis', hint: 'Libera frete ao atingir valor mínimo', icon: '🚚' }
  ];

  var PROMO_TYPE_FALLBACKS = {
    extra_combo: { key: 'add1', label: 'Combo extra', hint: 'Oferta combinada', icon: '+' },
    upgrade: { key: 'add1', label: 'Upgrade', hint: 'Oferta superior', icon: '↑' },
    pack: { key: '2x1', label: 'Pack', hint: 'Pacote promocional', icon: '▣' },
    fixed: { key: 'fixed', label: 'Preço fixo', hint: 'Oferta do dia', icon: '€' }
  };

  function render(sub) {
    _activeSub = sub || 'promocoes';
    var app = document.getElementById('app');
    app.innerHTML = '<div id="marketing-root" style="display:flex;flex-direction:column;height:100%;">' +
      '<div style="background:#fff;border-bottom:1px solid #F2EDED;padding:0 24px;">' +
      '<h1 style="font-family:\'League Spartan\',sans-serif;font-size:24px;font-weight:800;padding:20px 0 0;">Ações de Vendas</h1>' +
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
      return '<button data-key="' + t.key + '" onclick="Modules.Marketing._switchSub(\'' + t.key + '\')" style="padding:12px 18px 11px;border:none;background:transparent;cursor:pointer;border-bottom:3px solid ' + (active ? '#C4362A' : 'transparent') + ';color:' + (active ? '#C4362A' : '#8A7E7C') + ';font-family:inherit;transition:all .15s;white-space:nowrap;text-align:left;display:flex;flex-direction:column;align-items:flex-start;gap:2px;">' +
        '<span style="font-size:13px;font-weight:800;line-height:1.15;">' + t.title + '</span>' +
        '<span style="font-size:11px;font-weight:700;line-height:1.1;color:' + (active ? '#C4362A' : '#9A8F8D') + ';">' + t.subtitle + '</span>' +
      '</button>';
    }).join('');
  }

  function _subActionLabel() {
    if (_activeSub === 'promocoes') return '+ Nova Promoção';
    if (_activeSub === 'upsell') return '+ Nova Sugestão';
    if (_activeSub === 'cupons') return '+ Novo Cupom';
    if (_activeSub === 'pontos') return '+ Configurar Programa';
    return 'Configurar Avaliações';
  }

  function _reviewAction() {
    var url = _reviewPublicUrl();
    if (url) {
      window.open(url, '_blank');
      return;
    }
    UI.toast('Use esta seção para aprovar e responder avaliações.', 'info');
  }

  function _reviewPublicUrl() {
    var params = new URLSearchParams(window.location.search || '');
    var tenant = params.get('tenant') || params.get('tenantId') || params.get('uid') || window.PUBLISHED_TENANT_ID || '';
    return tenant ? ('review.html?tenant=' + encodeURIComponent(tenant)) : 'review.html';
  }

  function _normalizeMoneyConfig(c) {
    c = c || {};
    return {
      desiredMarginPct: _promoNumber(c.desiredMarginPct != null ? c.desiredMarginPct : c.margemDesejadaPct != null ? c.margemDesejadaPct : 60),
      minMarginPct: _promoNumber(c.minMarginPct != null ? c.minMarginPct : c.margemMinimaPct != null ? c.margemMinimaPct : 40)
    };
  }

  function _safeGetAll(col) {
    return Promise.resolve().then(function () {
      return DB.getAll(col);
    }).catch(function () {
      return [];
    });
  }

  function _safeGetDocRoot(col, id) {
    return Promise.resolve().then(function () {
      return DB.getDocRoot(col, id);
    }).catch(function () {
      return null;
    });
  }

  function _pointsDefaultConfig() {
    return {
      earnPerEuro: 1,
      redeemRate: 10,
      minimumPointsToUse: 50,
      maxDiscountPct: 20,
      pointsExpire: false,
      autoApply: false
    };
  }

  function _pointsNumber(value) {
    var str = String(value == null ? '' : value).trim();
    if (!str) return 0;
    var cleaned = str.replace(/[^\d,.-]/g, '');
    if (!cleaned) return 0;
    var lastComma = cleaned.lastIndexOf(',');
    var lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    else cleaned = cleaned.replace(/,/g, '');
    var n = parseFloat(cleaned);
    return isFinite(n) ? n : 0;
  }

  function _normalizePointsConfig(raw) {
    raw = raw || {};
    var defaults = _pointsDefaultConfig();
    return {
      earnPerEuro: Math.max(1, Math.round(_pointsNumber(raw.earnPerEuro != null ? raw.earnPerEuro : raw.pointsPerEuro != null ? raw.pointsPerEuro : raw.earnRate != null ? raw.earnRate : defaults.earnPerEuro) || defaults.earnPerEuro)),
      redeemRate: Math.max(1, Math.round(_pointsNumber(raw.redeemRate != null ? raw.redeemRate : raw.pointsPerDiscountEuro != null ? raw.pointsPerDiscountEuro : raw.redeemPointsRate != null ? raw.redeemPointsRate : defaults.redeemRate) || defaults.redeemRate)),
      minimumPointsToUse: Math.max(0, Math.round(_pointsNumber(raw.minimumPointsToUse != null ? raw.minimumPointsToUse : raw.minPointsToUse != null ? raw.minPointsToUse : defaults.minimumPointsToUse) || defaults.minimumPointsToUse)),
      maxDiscountPct: Math.max(0, Math.min(100, _pointsNumber(raw.maxDiscountPct != null ? raw.maxDiscountPct : raw.maxDiscountPercent != null ? raw.maxDiscountPercent : defaults.maxDiscountPct) || defaults.maxDiscountPct)),
      pointsExpire: raw.pointsExpire === true || raw.pointsExpire === 'true',
      autoApply: raw.autoApply === true || raw.autoApply === 'true'
    };
  }

  function _pointsConfigData() {
    return _pointsConfig ? Object.assign({}, _pointsConfig) : _pointsDefaultConfig();
  }

  function _pointsCustomerBalance(customer) {
    return Math.max(0, Math.floor(_pointsNumber(customer && (customer.points != null ? customer.points : customer.pointsBalance != null ? customer.pointsBalance : 0))));
  }

  function _pointsOrderSubtotal(order) {
    if (!order) return 0;
    var subtotal = _pointsNumber(order.subtotal != null ? order.subtotal : order.originalSubtotal != null ? order.originalSubtotal : order.finalSubtotal != null ? order.finalSubtotal : order.total != null ? order.total : 0);
    if (subtotal > 0) return subtotal;
    var items = Array.isArray(order.items) ? order.items : [];
    return items.reduce(function (sum, item) {
      var qty = Math.max(1, Math.floor(_pointsNumber(item.qty != null ? item.qty : item.quantity != null ? item.quantity : 1) || 1));
      var original = _pointsNumber(item.originalUnitPrice != null ? item.originalUnitPrice : item.originalPrice != null ? item.originalPrice : item.priceOriginal != null ? item.priceOriginal : item.price != null ? item.price : item.unitPrice != null ? item.unitPrice : 0);
      var subtotalItem = _pointsNumber(item.originalTotal != null ? item.originalTotal : item.originalSubtotal != null ? item.originalSubtotal : item.total != null ? item.total : item.subtotal != null ? item.subtotal : 0);
      if (!subtotalItem && original) subtotalItem = original * qty;
      return sum + subtotalItem;
    }, 0);
  }

  function _pointsOrderFinalValue(order) {
    if (!order) return 0;
    return Math.max(0, _pointsNumber(order.total != null ? order.total : order.finalSubtotal != null ? order.finalSubtotal : order.subtotal != null ? order.subtotal : 0));
  }

  function _pointsDiscountByBalance(balance, subtotal) {
    var cfg = _pointsConfigData();
    var maxByPoints = Math.floor(balance / cfg.redeemRate);
    var maxBySubtotal = Math.floor((_pointsNumber(subtotal) * cfg.maxDiscountPct) / 100);
    var discount = Math.min(maxByPoints, maxBySubtotal);
    return {
      discount: Math.max(0, discount),
      pointsUsed: Math.max(0, discount * cfg.redeemRate)
    };
  }

  function _pointsMovementLabel(type) {
    if (type === 'used') return 'Uso de pontos';
    if (type === 'earned') return 'Ganho de pontos';
    return _title(type || 'Movimento');
  }

  function _pointsOrderContext(order, customer) {
    order = order || {};
    customer = customer || null;
    var cfg = _pointsConfigData();
    var balance = _pointsCustomerBalance(customer);
    var subtotal = _pointsOrderSubtotal(order);
    var generated = Math.max(0, Math.floor(_pointsOrderFinalValue(order) * cfg.earnPerEuro));
    var usage = _pointsDiscountByBalance(balance, subtotal);
    var used = Math.max(0, _pointsNumber(order.pointsUsed || order.pointsDiscountPoints || 0));
    var discountApplied = Math.max(0, _pointsNumber(order.pointsDiscountTotal || order.pointsDiscount || 0));
    var before = _pointsNumber(order.pointsBalanceBefore || balance);
    var after = _pointsNumber(order.pointsBalanceAfter != null ? order.pointsBalanceAfter : Math.max(0, balance - used));
    var eligible = !!(customer && balance >= cfg.minimumPointsToUse && usage.discount > 0);
    return {
      cfg: cfg,
      linked: !!customer,
      balance: balance,
      subtotal: subtotal,
      generated: generated,
      pointsUsed: used,
      discountApplied: discountApplied,
      availableDiscount: usage.discount,
      pointsNeeded: usage.pointsUsed,
      before: before,
      after: after,
      eligible: eligible,
      enough: balance >= cfg.minimumPointsToUse
    };
  }

  function _pointsFindCustomerByPhone(order) {
    var phone = String(order && (order.phone || order.customerPhone || order.whatsapp || '')).replace(/\D/g, '');
    if (!phone) return null;
    return (_customers || []).find(function (c) {
      return String(c.phone || c.whatsapp || '').replace(/\D/g, '') === phone;
    }) || null;
  }

  function _pointsCustomerMovements(customerId) {
    var id = String(customerId || '').trim();
    if (!id) return [];
    return (_pointsMovements || []).filter(function (m) {
      return String(m.customerId || m.clientId || '') === id;
    }).sort(function (a, b) {
      return _pointsDateValue(b.createdAt || b.date || b.updatedAt) - _pointsDateValue(a.createdAt || a.date || a.updatedAt);
    });
  }

  function _pointsDateValue(v) {
    if (!v) return 0;
    try {
      if (v && typeof v.toDate === 'function') return v.toDate().getTime();
      var d = new Date(v);
      return isFinite(d.getTime()) ? d.getTime() : 0;
    } catch (e) {
      return 0;
    }
  }

  function _pointsLoad() {
    return Promise.all([
      _safeGetDocRoot('config', 'pontos_program'),
      _safeGetAll('store_customers'),
      _safeGetAll('orders'),
      _safeGetAll('points_movements')
    ]).then(function (res) {
      _pointsConfig = _normalizePointsConfig(res[0] || {});
      _customers = Array.isArray(res[1]) ? res[1] : [];
      _orders = Array.isArray(res[2]) ? res[2] : [];
      _pointsMovements = Array.isArray(res[3]) ? res[3] : [];
      return { config: _pointsConfig, customers: _customers, orders: _orders, movements: _pointsMovements };
    }).catch(function (err) {
      console.error('[Marketing] points load failed', err);
      _pointsConfig = _normalizePointsConfig({});
      _customers = [];
      _orders = [];
      _pointsMovements = [];
      return { config: _pointsConfig, customers: _customers, orders: _orders, movements: _pointsMovements };
    });
  }

  function _pointsRefresh() {
    if (_activeSub !== 'pontos') return Promise.resolve(false);
    return _pointsLoad().then(function () {
      _paintPontos();
      return true;
    });
  }

  function _pointsSummary(list) {
    var customers = Array.isArray(list) ? list : (_customers || []);
    var positive = customers.filter(function (c) { return _pointsCustomerBalance(c) > 0; });
    var totalBalance = positive.reduce(function (sum, c) { return sum + _pointsCustomerBalance(c); }, 0);
    var totalMovements = (_pointsMovements || []).length;
    var earned = (_pointsMovements || []).filter(function (m) { return String(m.type || '') === 'earned'; }).reduce(function (sum, m) { return sum + Math.max(0, _pointsNumber(m.pointsEarned != null ? m.pointsEarned : m.points || 0)); }, 0);
    var used = (_pointsMovements || []).filter(function (m) { return String(m.type || '') === 'used'; }).reduce(function (sum, m) { return sum + Math.max(0, _pointsNumber(m.pointsUsed != null ? m.pointsUsed : m.points || 0)); }, 0);
    var customersReady = customers.filter(function (c) {
      return _pointsCustomerBalance(c) >= _pointsConfigData().minimumPointsToUse;
    }).length;
    return {
      customers: customers.length,
      activeCustomers: positive.length,
      totalBalance: totalBalance,
      movements: totalMovements,
      earned: earned,
      used: used,
      ready: customersReady
    };
  }

  function _pointsConfigHtml() {
    var cfg = _pointsConfigData();
    return '<section style="background:#fff;border:1px solid #EEE6E4;border-radius:16px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.04);">' +
      '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:12px;">' +
        '<div>' +
          '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Configuração do programa</div>' +
          '<div style="font-size:18px;font-weight:900;color:#1A1A1A;">Regras padrão de pontos</div>' +
          '<div style="font-size:12px;color:#8A7E7C;line-height:1.5;margin-top:4px;">O desconto nunca é aplicado automaticamente.</div>' +
        '</div>' +
        '<button onclick="Modules.Marketing._openPointsConfigModal()" style="background:#C4362A;color:#fff;border:none;padding:10px 16px;border-radius:20px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">Editar configuração</button>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">' +
        '<div style="background:#FAF8F8;border:1px solid #F2EDED;border-radius:14px;padding:12px;"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Ganho</div><div style="font-size:16px;font-weight:900;color:#1A1A1A;">' + cfg.earnPerEuro + ' ponto(s)</div><div style="font-size:11px;color:#8A7E7C;margin-top:4px;">a cada €1,00 finalizado</div></div>' +
        '<div style="background:#FAF8F8;border:1px solid #F2EDED;border-radius:14px;padding:12px;"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Resgate</div><div style="font-size:16px;font-weight:900;color:#1A1A1A;">10 pontos = €1,00</div><div style="font-size:11px;color:#8A7E7C;margin-top:4px;">mínimo para usar: ' + cfg.minimumPointsToUse + ' pontos</div></div>' +
        '<div style="background:#FAF8F8;border:1px solid #F2EDED;border-radius:14px;padding:12px;"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Limite</div><div style="font-size:16px;font-weight:900;color:#1A1A1A;">' + cfg.maxDiscountPct + '%</div><div style="font-size:11px;color:#8A7E7C;margin-top:4px;">máximo por pedido</div></div>' +
        '<div style="background:#FAF8F8;border:1px solid #F2EDED;border-radius:14px;padding:12px;"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Expiração</div><div style="font-size:16px;font-weight:900;color:#1A1A1A;">Não expira</div><div style="font-size:11px;color:#8A7E7C;margin-top:4px;">' + (cfg.autoApply ? 'Aplicação automática ativa' : 'Aplicação manual') + '</div></div>' +
      '</div>' +
    '</section>';
  }

  function _pointsCustomersHtml() {
    var list = (_customers || []).slice().sort(function (a, b) {
      return _pointsCustomerBalance(b) - _pointsCustomerBalance(a) || String(a.name || '').localeCompare(String(b.name || ''));
    }).filter(function (c) { return _pointsCustomerBalance(c) > 0; }).slice(0, 8);
    if (!list.length) {
      return '<section style="background:#fff;border:1px solid #EEE6E4;border-radius:16px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.04);"><div style="font-size:14px;color:#8A7E7C;">Ainda não há clientes com saldo de pontos.</div></section>';
    }
    return '<section style="background:#fff;border:1px solid #EEE6E4;border-radius:16px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.04);"><div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;">Clientes com pontos</div><div style="display:flex;flex-direction:column;gap:10px;">' + list.map(function (c) {
      var balance = _pointsCustomerBalance(c);
      return '<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;padding:10px 12px;border:1px solid #F2EDED;border-radius:12px;background:#FAF8F8;">' +
        '<div style="min-width:0;">' +
          '<div style="font-size:14px;font-weight:900;color:#1A1A1A;">' + _esc(c.name || 'Cliente') + '</div>' +
          '<div style="font-size:11px;color:#8A7E7C;margin-top:2px;">' + (c.phone ? _esc(c.phone) : 'Sem telefone') + '</div>' +
        '</div>' +
        '<div style="text-align:right;">' +
          '<div style="font-size:18px;font-weight:900;color:#C4362A;">' + balance + '</div>' +
          '<div style="font-size:11px;color:#8A7E7C;">' + UI.fmt(Math.floor(balance / _pointsConfigData().redeemRate)) + ' de desconto</div>' +
        '</div>' +
      '</div>';
    }).join('') + '</div></section>';
  }

  function _pointsMovementHtml(movement) {
    var ts = _pointsDateValue(movement.createdAt || movement.date || movement.updatedAt);
    var points = _pointsNumber(movement.pointsUsed != null ? movement.pointsUsed : movement.pointsEarned != null ? movement.pointsEarned : movement.points || 0);
    var sign = String(movement.type || '') === 'used' ? '-' : '+';
    var customerName = movement.customerName || movement.name || 'Cliente';
    var orderLabel = movement.orderDisplay || movement.orderLabel || movement.orderId || '—';
    return '<div style="display:grid;grid-template-columns:112px 1fr auto;gap:12px;padding:10px 0;border-top:1px solid #F2EDED;align-items:center;">' +
      '<div style="font-size:11px;color:#8A7E7C;font-weight:900;">' + _esc(ts ? UI.fmtDate(new Date(ts)) : '-') + '</div>' +
      '<div style="min-width:0;">' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
          '<strong style="font-size:13px;">' + _esc(customerName) + '</strong>' +
          UI.badge(_pointsMovementLabel(movement.type || ''), String(movement.type || '') === 'used' ? 'orange' : 'green') +
        '</div>' +
        '<div style="font-size:12px;color:#8A7E7C;margin-top:3px;line-height:1.45;">Pedido: ' + _esc(orderLabel) + '</div>' +
      '</div>' +
      '<div style="text-align:right;">' +
        '<div style="font-size:14px;font-weight:900;color:' + (String(movement.type || '') === 'used' ? '#C4362A' : '#1A9E5A') + ';">' + sign + points + '</div>' +
        '<div style="font-size:11px;color:#8A7E7C;">Saldo: ' + _esc(_pointsNumber(movement.balanceAfter || movement.afterBalance || 0)) + '</div>' +
      '</div>' +
    '</div>';
  }

  function _pointsMovementsHtml() {
    var list = (_pointsMovements || []).slice().sort(function (a, b) {
      return _pointsDateValue(b.createdAt || b.date || b.updatedAt) - _pointsDateValue(a.createdAt || a.date || a.updatedAt);
    }).slice(0, 12);
    if (!list.length) {
      return '<section style="background:#fff;border:1px solid #EEE6E4;border-radius:16px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.04);"><div style="font-size:14px;color:#8A7E7C;">Sem movimentos registrados ainda.</div></section>';
    }
    return '<section style="background:#fff;border:1px solid #EEE6E4;border-radius:16px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.04);"><div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Movimentos recentes</div>' + list.map(_pointsMovementHtml).join('') + '</section>';
  }

  function _openPointsConfigModal() {
    var cfg = _pointsConfigData();
    var body = '<div style="display:flex;flex-direction:column;gap:12px;">' +
      '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">' +
        _field('pp-earn', 'Pontos por €1,00', cfg.earnPerEuro, 'number') +
        _field('pp-min', 'Pontos mínimos para usar', cfg.minimumPointsToUse, 'number') +
        _field('pp-maxpct', 'Desconto máximo por pedido (%)', cfg.maxDiscountPct, 'number') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">' +
        '<div style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:14px;padding:12px 14px;"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Conversão</div><div style="font-size:16px;font-weight:900;color:#1A1A1A;">10 pontos = €1,00</div></div>' +
        '<div style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:14px;padding:12px 14px;"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Aplicação</div><div style="font-size:16px;font-weight:900;color:#1A1A1A;">Manual apenas</div></div>' +
      '</div>' +
      '<div style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:14px;padding:14px;">' +
        '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Regras fixas</div>' +
        '<div style="font-size:13px;line-height:1.6;color:#1A1A1A;">' +
          '<div>• Pontos não expiram.</div>' +
          '<div>• O desconto nunca é aplicado automaticamente.</div>' +
          '<div>• O cliente ganha pontos apenas quando o pedido é marcado como entregue.</div>' +
        '</div>' +
      '</div>' +
    '</div>';
    var footer = '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;">' +
      '<button onclick="Modules.Marketing._savePointsConfig()" style="padding:12px 16px;border:none;border-radius:12px;background:#C4362A;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;">Salvar configuração</button>' +
      '<button onclick="if(window._pointsConfigModal)window._pointsConfigModal.close()" style="padding:12px 16px;border:1.5px solid #D4C8C6;border-radius:12px;background:#fff;color:#1A1A1A;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;">Fechar</button>' +
    '</div>';
    window._pointsConfigModal = UI.modal({ title: 'Programa de Pontos', body: body, footer: footer, maxWidth: '760px' });
  }

  function _savePointsConfig() {
    var cfg = {
      earnPerEuro: Math.max(1, Math.round(_pointsNumber((_doc('pp-earn') || {}).value || 1) || 1)),
      redeemRate: 10,
      minimumPointsToUse: Math.max(0, Math.round(_pointsNumber((_doc('pp-min') || {}).value || 50) || 50)),
      maxDiscountPct: Math.max(0, Math.min(100, _pointsNumber((_doc('pp-maxpct') || {}).value || 20) || 20)),
      pointsExpire: false,
      autoApply: false
    };
    _pointsConfig = _normalizePointsConfig(cfg);
    DB.setDocRoot('config', 'pontos_program', _pointsConfig).then(function () {
      UI.toast('Configuração de pontos salva.', 'success');
      if (window._pointsConfigModal) window._pointsConfigModal.close();
      if (_activeSub === 'pontos') _paintPontos();
    }).catch(function (err) {
      UI.toast('Erro ao salvar pontos: ' + err.message, 'error');
    });
  }

  function _doc(id) {
    return document.getElementById(id);
  }

  function _pointsOrderBlockHtml(order, customer) {
    order = order || {};
    customer = customer || null;
    var ctx = _pointsOrderContext(order, customer);
    var customerLabel = customer && customer.name ? customer.name : '—';
    if (!ctx.linked) {
      return '<div style="background:#FFF8F1;border:1px solid #F3D9C7;border-radius:16px;padding:14px;">' +
        '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;">Programa de Pontos</div>' +
        '<div style="font-size:14px;font-weight:900;color:#1A1A1A;margin-bottom:6px;">Vincula o registra al cliente para activar el programa de puntos.</div>' +
        '<div style="font-size:13px;color:#5D514F;line-height:1.45;">Este pedido ainda não está ligado a um cliente com saldo de pontos.</div>' +
      '</div>';
    }
    var applied = ctx.pointsUsed > 0 && ctx.discountApplied > 0;
    return '<div style="background:#fff;border:1px solid #F2EDED;border-radius:16px;padding:14px;">' +
      '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:10px;">' +
        '<div>' +
          '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;">Programa de Pontos</div>' +
          '<div style="font-size:14px;font-weight:900;color:#1A1A1A;">' + _esc(customerLabel) + '</div>' +
        '</div>' +
        UI.badge('Saldo: ' + ctx.balance + ' pts', 'blue') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;">' +
        '<div style="background:#FAF8F8;border:1px solid #F2EDED;border-radius:12px;padding:10px;"><div style="font-size:10px;color:#8A7E7C;font-weight:900;text-transform:uppercase;margin-bottom:4px;">Saldo atual</div><div style="font-size:16px;font-weight:900;color:#1A1A1A;">' + ctx.balance + ' pts</div></div>' +
        '<div style="background:#FAF8F8;border:1px solid #F2EDED;border-radius:12px;padding:10px;"><div style="font-size:10px;color:#8A7E7C;font-weight:900;text-transform:uppercase;margin-bottom:4px;">Desconto disponível</div><div style="font-size:16px;font-weight:900;color:#1A9E5A;">' + UI.fmt(ctx.availableDiscount) + '</div></div>' +
        '<div style="background:#FAF8F8;border:1px solid #F2EDED;border-radius:12px;padding:10px;"><div style="font-size:10px;color:#8A7E7C;font-weight:900;text-transform:uppercase;margin-bottom:4px;">Pontos que este pedido gera</div><div style="font-size:16px;font-weight:900;color:#1A1A1A;">' + ctx.generated + ' pts</div></div>' +
        '<div style="background:#FAF8F8;border:1px solid #F2EDED;border-radius:12px;padding:10px;"><div style="font-size:10px;color:#8A7E7C;font-weight:900;text-transform:uppercase;margin-bottom:4px;">Pontos usados</div><div style="font-size:16px;font-weight:900;color:#C4362A;">' + (ctx.pointsUsed || 0) + ' pts</div></div>' +
        '<div style="background:#FAF8F8;border:1px solid #F2EDED;border-radius:12px;padding:10px;"><div style="font-size:10px;color:#8A7E7C;font-weight:900;text-transform:uppercase;margin-bottom:4px;">Desconto por pontos</div><div style="font-size:16px;font-weight:900;color:#1A1A1A;">' + UI.fmt(ctx.discountApplied || 0) + '</div></div>' +
      '</div>' +
      '<div style="margin-top:10px;font-size:12px;color:#8A7E7C;line-height:1.45;">' + (ctx.enough ? (applied ? 'Desconto já aplicado neste pedido.' : 'Clique para aplicar o maior desconto permitido por esta regra.') : 'Este cliente aún no tiene puntos suficientes para usar descuento.') + '</div>' +
      (!applied && ctx.eligible ? '<div style="margin-top:10px;display:flex;justify-content:flex-end;"><button onclick="Modules.Pedidos._applyPointsDiscount(\'' + _esc(order.id || '') + '\')" style="border:none;background:#C4362A;color:#fff;border-radius:12px;padding:10px 14px;font-size:13px;font-weight:800;cursor:pointer;">Aplicar desconto com pontos</button></div>' : '') +
      '<div style="display:none" data-points-balance="' + ctx.balance + '"></div>' +
    '</div>';
  }

  function _pointsApplyDiscount(orderId, orderData, customerData) {
    var order = orderData || null;
    var customer = customerData || null;
    var loadOrder = order ? Promise.resolve(order) : DB.getDoc('orders', orderId);
    return loadOrder.then(function (ord) {
      if (!ord) throw new Error('Pedido não encontrado');
      var ensureCustomers = function () {
        if (_customers && _customers.length) return Promise.resolve(_customers);
        return DB.getAll('store_customers').catch(function () { return []; }).then(function (rows) {
          _customers = Array.isArray(rows) ? rows : [];
          return _customers;
        });
      };
      return ensureCustomers().then(function (customers) {
        if (!customer) {
          customer = (customers || []).find(function (c) { return String(c.id || '') === String(ord.customerId || ord.clientId || ''); }) || _pointsFindCustomerByPhone(ord) || null;
        }
        if (!customer) throw new Error('Cliente não vinculado ao pedido');
        if (_pointsNumber(ord.pointsUsed || 0) > 0 || _pointsNumber(ord.pointsDiscountTotal || 0) > 0 || ord.pointsAppliedAt) {
          throw new Error('Desconto por pontos já aplicado neste pedido.');
        }
        var cfg = _pointsConfigData();
        var balance = _pointsCustomerBalance(customer);
        if (balance < cfg.minimumPointsToUse) throw new Error('Este cliente aún no tiene puntos suficientes para usar descuento.');
        var subtotal = _pointsOrderSubtotal(ord);
        var discountData = _pointsDiscountByBalance(balance, subtotal);
        if (!discountData.discount || !discountData.pointsUsed) throw new Error('Este cliente aún no tiene puntos suficientes para usar descuento.');
        var pointsUsed = discountData.pointsUsed;
        var discountValue = discountData.discount;
        var before = balance;
        var after = Math.max(0, before - pointsUsed);
        var totalNow = Math.max(0, _pointsOrderFinalValue(ord) - discountValue);
        var customerId = String(customer.id || '');
        var movement = {
          customerId: customerId,
          customerName: customer.name || ord.customerName || ord.clientName || 'Cliente',
          orderId: String(ord.id || orderId || ''),
          orderDisplay: ord.orderNumber || ord.number || ord.reference || String(ord.id || orderId || ''),
          type: 'used',
          pointsUsed: pointsUsed,
          discountValue: discountValue,
          balanceBefore: before,
          balanceAfter: after,
          valueConsidered: subtotal,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          note: 'Aplicação de desconto por pontos'
        };
        var orderUpdate = {
          customerId: ord.customerId || ord.clientId || customerId,
          clientId: ord.customerId || ord.clientId || customerId,
          customerName: customer.name || ord.customerName || ord.clientName || 'Cliente',
          clientName: customer.name || ord.customerName || ord.clientName || 'Cliente',
          pointsUsed: pointsUsed,
          pointsDiscountTotal: discountValue,
          pointsBalanceBefore: before,
          pointsBalanceAfter: after,
          discountTotal: _pointsNumber(ord.discountTotal || 0) + discountValue,
          total: totalNow,
          finalSubtotal: Math.max(0, _pointsOrderSubtotal(ord) - (_pointsNumber(ord.discountTotal || 0) + discountValue)),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        var customerUpdate = {
          points: after,
          pointsBalance: after,
          pointsUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        return Promise.all([
          DB.update('orders', ord.id || orderId, orderUpdate),
          DB.update('store_customers', customerId, customerUpdate),
          DB.add('points_movements', movement)
        ]).then(function () {
          if (ord.id && _orders && _orders.length) {
            _orders = _orders.map(function (o) {
              if (String(o.id || '') !== String(ord.id || orderId || '')) return o;
              return Object.assign({}, o, orderUpdate, { pointsAppliedAt: new Date().toISOString() });
            });
          }
          if (_customers && _customers.length) {
            _customers = _customers.map(function (c) {
              if (String(c.id || '') !== customerId) return c;
              return Object.assign({}, c, customerUpdate);
            });
          }
          if (_activeSub === 'pontos') _pointsRefresh();
          return { discount: discountValue, pointsUsed: pointsUsed, balanceBefore: before, balanceAfter: after };
        });
      });
    });
  }

  function _pointsGrantForOrder(orderId, orderData, customerData) {
    var order = orderData || null;
    var customer = customerData || null;
    var loadOrder = order ? Promise.resolve(order) : DB.getDoc('orders', orderId);
    return loadOrder.then(function (ord) {
      if (!ord) return false;
      var status = String(ord.status || '').trim();
      if (status !== 'Entregado') return false;
      if (ord.pointsAwardedAt || _pointsNumber(ord.pointsEarned || 0) > 0) return false;
      var ensureCustomers = function () {
        if (_customers && _customers.length) return Promise.resolve(_customers);
        return DB.getAll('store_customers').catch(function () { return []; }).then(function (rows) {
          _customers = Array.isArray(rows) ? rows : [];
          return _customers;
        });
      };
      return ensureCustomers().then(function (customers) {
        if (!customer) {
          customer = (customers || []).find(function (c) { return String(c.id || '') === String(ord.customerId || ord.clientId || ''); }) || _pointsFindCustomerByPhone(ord) || null;
        }
        if (!customer) return false;
        var cfg = _pointsConfigData();
        var earned = Math.max(0, Math.floor(_pointsOrderFinalValue(ord) * cfg.earnPerEuro));
        if (!(earned > 0)) return false;
        var before = _pointsCustomerBalance(customer);
        var after = before + earned;
        var customerId = String(customer.id || '');
        var movement = {
          customerId: customerId,
          customerName: customer.name || ord.customerName || ord.clientName || 'Cliente',
          orderId: String(ord.id || orderId || ''),
          orderDisplay: ord.orderNumber || ord.number || ord.reference || String(ord.id || orderId || ''),
          type: 'earned',
          pointsEarned: earned,
          balanceBefore: before,
          balanceAfter: after,
          valueConsidered: _pointsOrderFinalValue(ord),
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          note: 'Ganho automático ao marcar como entregue'
        };
        return Promise.all([
          DB.update('store_customers', customerId, {
            points: after,
            pointsBalance: after,
            pointsUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }),
          DB.update('orders', ord.id || orderId, {
            customerId: ord.customerId || ord.clientId || customerId,
            clientId: ord.customerId || ord.clientId || customerId,
            customerName: customer.name || ord.customerName || ord.clientName || 'Cliente',
            clientName: customer.name || ord.customerName || ord.clientName || 'Cliente',
            pointsEarned: earned,
            pointsAwardedAt: firebase.firestore.FieldValue.serverTimestamp(),
            pointsBalanceBefore: before,
            pointsBalanceAfter: after,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }),
          DB.add('points_movements', movement)
        ]).then(function () {
          if (_customers && _customers.length) {
            _customers = _customers.map(function (c) {
              if (String(c.id || '') !== customerId) return c;
              return Object.assign({}, c, { points: after, pointsBalance: after });
            });
          }
          if (_orders && _orders.length) {
            _orders = _orders.map(function (o) {
              if (String(o.id || '') !== String(ord.id || orderId || '')) return o;
              return Object.assign({}, o, {
                pointsEarned: earned,
                pointsAwardedAt: new Date().toISOString(),
                pointsBalanceBefore: before,
                pointsBalanceAfter: after
              });
            });
          }
          if (_activeSub === 'pontos') _pointsRefresh();
          return true;
        });
      });
    }).catch(function (err) {
      console.warn('[Marketing] points grant failed', err);
      return false;
    });
  }

  function _setReviewSearch(value) { _reviewUi.query = String(value || ''); _paintAvaliacoes(); }
  function _setReviewStatus(value) { _reviewUi.status = value || 'all'; _paintAvaliacoes(); }
  function _setReviewPeriod(value) { _reviewUi.period = value || 'all'; _paintAvaliacoes(); }
  function _setReviewStars(value) { _reviewUi.stars = value || 'all'; _paintAvaliacoes(); }
  function _setReviewPeriodStart(value) { _reviewUi.periodStart = value || ''; _paintAvaliacoes(); }
  function _setReviewPeriodEnd(value) { _reviewUi.periodEnd = value || ''; _paintAvaliacoes(); }

  function _reviewDateValue(v) {
    if (!v) return 0;
    try {
      if (v && typeof v.toDate === 'function') return v.toDate().getTime();
      var d = new Date(v);
      return isFinite(d.getTime()) ? d.getTime() : 0;
    } catch (e) {
      return 0;
    }
  }

  function _reviewTodayBase() {
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function _reviewPeriodRange(period) {
    var key = String(period || 'all').toLowerCase();
    var today = _reviewTodayBase();
    var start = 0;
    var end = 0;
    if (key === 'today') {
      start = new Date(today.getTime()).getTime();
      end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).getTime();
    } else if (key === 'yesterday') {
      start = new Date(today.getTime() - 86400000).setHours(0, 0, 0, 0);
      end = new Date(today.getTime() - 1).setHours(23, 59, 59, 999);
    } else if (key === 'last7') {
      start = new Date(today.getTime() - 6 * 86400000).getTime();
      end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).getTime();
    } else if (key === 'last30') {
      start = new Date(today.getTime() - 29 * 86400000).getTime();
      end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).getTime();
    } else if (key === 'thismonth') {
      start = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
    } else if (key === 'lastmonth') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1).getTime();
      end = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999).getTime();
    } else if (key === 'custom') {
      start = _reviewDateValue(_reviewUi.periodStart);
      end = _reviewDateValue(_reviewUi.periodEnd);
      if (start) start = new Date(start).setHours(0, 0, 0, 0);
      if (end) end = new Date(end).setHours(23, 59, 59, 999);
    }
    return { key: key, start: start, end: end };
  }

  function _reviewStatusLabel(review) {
    if (review.approved || review.status === 'approved') return { key: 'approved', label: 'Aprovada', tone: '#1A9E5A', bg: '#EDFAF3' };
    if (review.rejected || review.status === 'rejected') return { key: 'rejected', label: 'Rejeitada', tone: '#C4362A', bg: '#FFF0EE' };
    return { key: 'pending', label: 'Pendente', tone: '#D97706', bg: '#FFF8E8' };
  }

  function _reviewSourceLabel(review) {
    var src = String(review.source || '').toLowerCase();
    if (src === 'public-review') return 'Página pública';
    if (src === 'form') return 'Formulário';
    if (src === 'admin') return 'Admin';
    return '—';
  }

  function _reviewMatchesFilters(review) {
    var q = String(_reviewUi.query || '').trim().toLowerCase();
    var status = String(_reviewUi.status || 'all');
    var stars = String(_reviewUi.stars || 'all');
    var ts = _reviewDateValue(review.createdAt || review.approvedAt || review.updatedAt);
    var range = _reviewPeriodRange(_reviewUi.period);
    var reviewStatus = _reviewStatusLabel(review).key;
    var starValue = Number(review.stars || review.rating || 0) || 0;
    if (q) {
      var text = [
        review.name || '',
        review.customerName || '',
        review.productName || '',
        review.comment || '',
        review.reply || '',
        reviewStatus,
        _reviewSourceLabel(review)
      ].join(' ').toLowerCase();
      if (text.indexOf(q) < 0) return false;
    }
    if (status !== 'all' && reviewStatus !== status) return false;
    if (stars !== 'all' && starValue !== Number(stars)) return false;
    if (range.key !== 'all') {
      if (!ts) return false;
      if (range.start && ts < range.start) return false;
      if (range.end && ts > range.end) return false;
    }
    return true;
  }

  function _reviewFilteredList() {
    return (_reviews || []).filter(_reviewMatchesFilters).sort(function (a, b) {
      return _reviewDateValue(b.createdAt || b.approvedAt || b.updatedAt) - _reviewDateValue(a.createdAt || a.approvedAt || a.updatedAt);
    });
  }

  function _reviewSummary(list) {
    var reviews = Array.isArray(list) ? list : [];
    var approved = reviews.filter(function (r) { return _reviewStatusLabel(r).key === 'approved'; }).length;
    var pending = reviews.filter(function (r) { return _reviewStatusLabel(r).key === 'pending'; }).length;
    var replied = reviews.filter(function (r) { return !!(r.reply && String(r.reply).trim()); }).length;
    var avg = reviews.length ? reviews.reduce(function (sum, r) { return sum + (Number(r.stars || r.rating || 0) || 0); }, 0) / reviews.length : 0;
    return {
      total: reviews.length,
      approved: approved,
      pending: pending,
      replied: replied,
      avg: avg,
      replyRate: reviews.length ? (replied / reviews.length) * 100 : 0
    };
  }

  function _reviewToolbarHtml(summary) {
    var customHtml = _reviewUi.period === 'custom'
      ? '<div style="grid-column:1 / -1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:-2px;">' +
          '<label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;"><span style="display:block;margin-bottom:4px;">Data inicial</span><input type="date" value="' + _esc(_reviewUi.periodStart || '') + '" onchange="Modules.Marketing._setReviewPeriodStart(this.value)" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:12px;background:#fff;font-size:13px;font-family:inherit;outline:none;"></label>' +
          '<label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;"><span style="display:block;margin-bottom:4px;">Data final</span><input type="date" value="' + _esc(_reviewUi.periodEnd || '') + '" onchange="Modules.Marketing._setReviewPeriodEnd(this.value)" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:12px;background:#fff;font-size:13px;font-family:inherit;outline:none;"></label>' +
        '</div>'
      : '';
    return '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:16px;padding:14px 16px;margin-bottom:14px;">' +
      '<div style="display:grid;grid-template-columns:1.4fr .9fr .9fr 1fr;gap:10px;align-items:end;">' +
        '<div><label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;margin-bottom:4px;">Buscar por cliente, produto, comentário ou status</label><input id="rev-search" type="search" value="' + _esc(_reviewUi.query || '') + '" oninput="Modules.Marketing._setReviewSearch(this.value)" placeholder="Buscar por cliente, produto, comentário ou status" style="width:100%;padding:11px 14px;border:1.5px solid #D4C8C6;border-radius:999px;background:#fff;font-size:13px;font-family:inherit;outline:none;"></div>' +
        '<label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;"><span style="display:block;margin-bottom:4px;">Status</span><select onchange="Modules.Marketing._setReviewStatus(this.value)" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:12px;background:#fff;font-size:13px;font-family:inherit;outline:none;"><option value="all"' + (_reviewUi.status === 'all' ? ' selected' : '') + '>Todas</option><option value="pending"' + (_reviewUi.status === 'pending' ? ' selected' : '') + '>Pendentes</option><option value="approved"' + (_reviewUi.status === 'approved' ? ' selected' : '') + '>Aprovadas</option><option value="rejected"' + (_reviewUi.status === 'rejected' ? ' selected' : '') + '>Rejeitadas</option></select></label>' +
        '<label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;"><span style="display:block;margin-bottom:4px;">Período</span><select onchange="Modules.Marketing._setReviewPeriod(this.value)" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:12px;background:#fff;font-size:13px;font-family:inherit;outline:none;"><option value="all"' + (_reviewUi.period === 'all' ? ' selected' : '') + '>Todos</option><option value="today"' + (_reviewUi.period === 'today' ? ' selected' : '') + '>Hoje</option><option value="yesterday"' + (_reviewUi.period === 'yesterday' ? ' selected' : '') + '>Ontem</option><option value="last7"' + (_reviewUi.period === 'last7' ? ' selected' : '') + '>Últimos 7 dias</option><option value="last30"' + (_reviewUi.period === 'last30' ? ' selected' : '') + '>Últimos 30 dias</option><option value="thismonth"' + (_reviewUi.period === 'thismonth' ? ' selected' : '') + '>Este mês</option><option value="lastmonth"' + (_reviewUi.period === 'lastmonth' ? ' selected' : '') + '>Mês passado</option><option value="custom"' + (_reviewUi.period === 'custom' ? ' selected' : '') + '>Personalizado</option></select></label>' +
        '<label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;"><span style="display:block;margin-bottom:4px;">Nota</span><select onchange="Modules.Marketing._setReviewStars(this.value)" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:12px;background:#fff;font-size:13px;font-family:inherit;outline:none;"><option value="all"' + (_reviewUi.stars === 'all' ? ' selected' : '') + '>Todas</option><option value="5"' + (_reviewUi.stars === '5' ? ' selected' : '') + '>5 estrelas</option><option value="4"' + (_reviewUi.stars === '4' ? ' selected' : '') + '>4 estrelas</option><option value="3"' + (_reviewUi.stars === '3' ? ' selected' : '') + '>3 estrelas</option><option value="2"' + (_reviewUi.stars === '2' ? ' selected' : '') + '>2 estrelas</option><option value="1"' + (_reviewUi.stars === '1' ? ' selected' : '') + '>1 estrela</option></select></label>' +
        customHtml +
      '</div>' +
    '</div>';
  }

  function _reviewCardHtml(review) {
    var status = _reviewStatusLabel(review);
    var stars = '★'.repeat(review.stars || review.rating || 0) + '☆'.repeat(5 - (review.stars || review.rating || 0));
    var text = String(review.comment || '').trim();
    var reply = String(review.reply || '').trim();
    var source = _reviewSourceLabel(review);
    var dateText = UI.fmtDate(review.createdAt || review.approvedAt || review.updatedAt || '');
    return '<div class="review-card" onclick="Modules.Marketing._openReviewModal(\'' + _esc(String(review.id || '')) + '\', \'view\')" style="background:#fff;border:1px solid #EEE6E4;border-radius:16px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.05);cursor:pointer;display:flex;flex-direction:column;gap:12px;">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">' +
        '<div style="min-width:0;flex:1;">' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">' +
            '<span style="font-size:10px;font-weight:900;padding:4px 8px;border-radius:999px;background:' + status.bg + ';color:' + status.tone + ';">' + _esc(status.label) + '</span>' +
            '<span style="font-size:10px;font-weight:900;padding:4px 8px;border-radius:999px;background:#F2EDED;color:#8A7E7C;">' + _esc(source) + '</span>' +
          '</div>' +
          '<div style="font-size:14px;font-weight:800;color:#1A1A1A;line-height:1.25;">' + _esc(review.name || review.customerName || 'Cliente') + '</div>' +
          '<div style="margin-top:4px;color:#D97706;font-size:16px;">' + _esc(stars) + ' <span style="font-size:12px;color:#8A7E7C;font-weight:600;">(' + (review.stars || review.rating || 0) + '/5)</span></div>' +
        '</div>' +
        '<div style="text-align:right;flex-shrink:0;">' +
          '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">' + _esc(dateText || '—') + '</div>' +
          '<div style="font-size:11px;color:#8A7E7C;margin-top:4px;">' + _esc(review.productName || 'Sem produto') + '</div>' +
        '</div>' +
      '</div>' +
      (text ? '<div style="font-size:13px;color:#1A1A1A;line-height:1.55;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;">"' + _esc(text) + '"</div>' : '') +
      (reply ? '<div style="background:#F8F5F5;border:1px solid #EEE6E4;border-radius:12px;padding:10px 12px;font-size:12px;color:#1A1A1A;line-height:1.5;">' +
        '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Resposta</div>' +
        _esc(reply) +
      '</div>' : '') +
      '<div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;" onclick="event.stopPropagation()">' +
        '<button onclick="Modules.Marketing._approveReview(\'' + _esc(String(review.id || '')) + '\')" style="padding:7px 12px;border:none;border-radius:12px;background:#EDFAF3;color:#1A9E5A;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">Aprovar</button>' +
        '<button onclick="Modules.Marketing._rejectReview(\'' + _esc(String(review.id || '')) + '\')" style="padding:7px 12px;border:none;border-radius:12px;background:#FFF0EE;color:#C4362A;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">Rejeitar</button>' +
      '</div>' +
    '</div>';
  }

  function _openReviewModal(id, mode) {
    var review = _reviews.find(function (x) { return String(x.id) === String(id); });
    if (!review) return;
    var status = _reviewStatusLabel(review);
    var stars = '★'.repeat(review.stars || review.rating || 0) + '☆'.repeat(5 - (review.stars || review.rating || 0));
    var dateText = UI.fmtDate(review.createdAt || review.approvedAt || review.updatedAt || '');
    var body = '<div style="display:flex;flex-direction:column;gap:14px;">' +
      '<section style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">' +
          '<div>' +
            '<div style="font-size:24px;font-weight:900;line-height:1.1;color:#1A1A1A;">' + _esc(review.name || review.customerName || 'Cliente') + '</div>' +
            '<div style="margin-top:8px;color:#D97706;font-size:18px;">' + _esc(stars) + ' <span style="font-size:12px;color:#8A7E7C;font-weight:600;">(' + (review.stars || review.rating || 0) + '/5)</span></div>' +
          '</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">' +
            '<span style="font-size:10px;font-weight:900;padding:4px 8px;border-radius:999px;background:' + status.bg + ';color:' + status.tone + ';">' + _esc(status.label) + '</span>' +
            '<span style="font-size:10px;font-weight:900;padding:4px 8px;border-radius:999px;background:#F2EDED;color:#8A7E7C;">' + _esc(_reviewSourceLabel(review)) + '</span>' +
          '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-top:12px;">' +
          '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Produto</div><div style="font-size:12px;font-weight:700;color:#1A1A1A;">' + _esc(review.productName || '—') + '</div></div>' +
          '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Data</div><div style="font-size:12px;font-weight:700;color:#1A1A1A;">' + _esc(dateText || '—') + '</div></div>' +
          '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Status</div><div style="font-size:12px;font-weight:700;color:#1A1A1A;">' + _esc(status.label) + '</div></div>' +
        '</div>' +
      '</section>' +
      '<section style="background:#fff;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">' +
        '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Comentário</div>' +
        '<div style="font-size:13px;color:#1A1A1A;line-height:1.65;">' + _esc(review.comment || '—') + '</div>' +
      '</section>' +
      '<section style="background:#fff;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">' +
        '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Resposta</div>' +
        '<div style="font-size:13px;color:#1A1A1A;line-height:1.65;">' + (review.reply ? _esc(review.reply) : 'Sem resposta ainda.') + '</div>' +
      '</section>' +
    '</div>';
    var footer = '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
      '<button onclick="Modules.Marketing._approveReview(\'' + _esc(String(review.id)) + '\')" style="flex:1;min-width:130px;padding:13px;border:none;border-radius:11px;background:#EDFAF3;color:#1A9E5A;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Aprovar</button>' +
      '<button onclick="Modules.Marketing._rejectReview(\'' + _esc(String(review.id)) + '\')" style="flex:1;min-width:130px;padding:13px;border:none;border-radius:11px;background:#FFF0EE;color:#C4362A;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Rejeitar</button>' +
      '<button onclick="if(window._reviewModal)window._reviewModal.close()" style="flex:1;min-width:120px;padding:13px;border-radius:11px;border:1.5px solid #D4C8C6;background:#fff;color:#1A1A1A;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Fechar</button>' +
    '</div>';
    if (window._reviewModal && typeof window._reviewModal.close === 'function') window._reviewModal.close();
    window._reviewModal = UI.modal({
      title: mode === 'edit' ? 'Editar Avaliação' : 'Resumo da Avaliação',
      body: body,
      footer: footer
    });
  }

  function _uniqueList(list) {
    var seen = {};
    return (list || []).map(String).filter(function (id) {
      if (!id) return false;
      if (seen[id]) return false;
      seen[id] = true;
      return true;
    });
  }

  function _marketingCostRaw(raw) {
    raw = raw || {};
    return raw.cost != null ? raw.cost :
      (raw.custo != null ? raw.custo :
      (raw.purchasePrice != null ? raw.purchasePrice :
      (raw.preco_compra != null ? raw.preco_compra :
      (raw.custo_atual != null ? raw.custo_atual :
      (raw.custoAtual != null ? raw.custoAtual :
      (raw.precoCompra != null ? raw.precoCompra :
      (raw.custoCompra != null ? raw.custoCompra :
      (raw.purchase_price != null ? raw.purchase_price : 0))))))));
  }

  function _normalizeMarketingProduct(raw, source, fallbackIndex) {
    raw = raw || {};
    var id = raw.id != null && raw.id !== '' ? raw.id :
      (raw._id != null && raw._id !== '' ? raw._id :
      (raw.productId != null && raw.productId !== '' ? raw.productId :
      (raw.product_id != null && raw.product_id !== '' ? raw.product_id :
      (raw.code != null && raw.code !== '' ? raw.code :
      (raw.slug != null && raw.slug !== '' ? raw.slug :
      (raw.sku != null && raw.sku !== '' ? raw.sku :
      (source ? (source + '_' + fallbackIndex) : '')))))));
    var name = firstText(raw.name, raw.title, raw.productName, raw.nome, raw.label, raw.description, raw.shortDesc, raw.desc, 'Produto');
    var category = firstText(raw.category, raw.categoryName, raw.categoryLabel, raw.categoryTitle, raw.categoryId, raw.categoria, '');
    var tags = Array.isArray(raw.tags) ? raw.tags : [];
    var cost = _marketingCostRaw(raw);
    return {
      id: id,
      name: name,
      title: firstText(raw.title, name),
      price: raw.price != null ? raw.price : (raw.salePrice != null ? raw.salePrice : (raw.valor != null ? raw.valor : (raw.preco != null ? raw.preco : 0))),
      cost: cost,
      purchasePrice: raw.purchasePrice != null ? raw.purchasePrice : cost,
      preco_compra: raw.preco_compra != null ? raw.preco_compra : cost,
      custo_atual: raw.custo_atual != null ? raw.custo_atual : cost,
      custo: raw.custo != null ? raw.custo : cost,
      custoAtual: raw.custoAtual != null ? raw.custoAtual : cost,
      category: category,
      categoryId: raw.categoryId || raw.categoriaId || raw.category || '',
      stock: raw.stock != null ? raw.stock : (raw.estoque != null ? raw.estoque : null),
      tags: tags,
      imageBase64: raw.imageBase64 || raw.imageUrl || raw.image || raw.img || '',
      promo: raw.promo && typeof raw.promo === 'object' ? raw.promo : null,
      source: source || '',
      raw: raw
    };
  }

  function _mergeMarketingProducts(groups) {
    var out = [];
    var seen = {};
    (groups || []).forEach(function (group, idx) {
      (group || []).forEach(function (item, itemIdx) {
        var normalized = _normalizeMarketingProduct(item, 'src' + idx, itemIdx);
        if (!normalized.id) return;
        if (seen[normalized.id]) return;
        seen[normalized.id] = true;
        out.push(normalized);
      });
    });
    return out;
  }

  function _loadMarketingProducts() {
    return Promise.all([
      _safeGetAll('products'),
      _safeGetAll('produtos'),
      _safeGetAll('produtos_prontos'),
      _safeGetAll('fichasTecnicas')
    ]).then(function (groups) {
      return _mergeMarketingProducts(groups);
    }).catch(function () {
      return [];
    });
  }

  function _derivePromoFromProduct(product, index) {
    if (!product || !product.promo || typeof product.promo !== 'object') return null;
    var promo = product.promo;
    var normalized = null;
    try {
      normalized = _normalizePromoRecord(promo, promo.id || promo._id || promo.promoId || ('product_' + String(product.id || index)));
    } catch (err) {
      console.warn('[Marketing] promo derivation failed', err);
      return null;
    }
    normalized.applyTo = normalized.applyTo || 'selected';
    normalized.scope = normalized.scope || 'produtos_selecionados';
    normalized.productIds = _uniqueList((normalized.productIds || []).concat([String(product.id || '')]));
    normalized.productId = normalized.productId || String(product.id || '');
    normalized.productName = normalized.productName || product.name || product.title || '';
    normalized.active = normalized.active !== false;
    return normalized;
  }

  function _mergePromoLists(groups, derivedFromProducts) {
    var out = [];
    var seen = {};
    function addPromo(item) {
      if (!item) return;
      var normalized;
      try {
        normalized = _normalizePromoRecord(item, item.id || item._id || item.promoId || '');
      } catch (err) {
        console.warn('[Marketing] promo normalization failed', err);
        return;
      }
      var id = String(normalized.id || '');
      var key = id || (normalized.name || '') + '|' + (normalized.type || '') + '|' + (normalized.startDate || '') + '|' + (normalized.endDate || '') + '|' + (normalized.valuePercentual != null ? normalized.valuePercentual : normalized.valueDesconto != null ? normalized.valueDesconto : normalized.value || '');
      if (seen[key]) {
        var existing = seen[key];
        existing.productIds = _uniqueList((existing.productIds || []).concat(normalized.productIds || []));
        if (!existing.productId && normalized.productId) existing.productId = normalized.productId;
        if (!existing.productName && normalized.productName) existing.productName = normalized.productName;
        return;
      }
      seen[key] = normalized;
      out.push(normalized);
    }

    (groups || []).forEach(function (group) {
      (group || []).forEach(addPromo);
    });
    (derivedFromProducts || []).forEach(addPromo);
    return out;
  }

  function _normalizePromoRecord(promo, idFallback) {
    promo = promo || {};
    var rawType = promo.type != null ? promo.type : (promo.tipo != null ? promo.tipo : promo.discountType);
    var productIds = [];
    if (Array.isArray(promo.productIds)) productIds = productIds.concat(promo.productIds);
    if (promo.productId != null && promo.productId !== '') productIds.push(promo.productId);
    if (Array.isArray(promo.selectedProductIds)) productIds = productIds.concat(promo.selectedProductIds);
    if (Array.isArray(promo.suggestedProductIds)) productIds = productIds.concat(promo.suggestedProductIds);
    if (Array.isArray(promo.suggestedIds)) productIds = productIds.concat(promo.suggestedIds);
    productIds = productIds.map(String).filter(Boolean);
    var seen = {};
    productIds = productIds.filter(function (id) { if (seen[id]) return false; seen[id] = true; return true; });

    var active = promo.active;
    if (active == null) {
      if (promo.status != null) {
        var st = String(promo.status).toLowerCase();
        active = !(st === 'pausada' || st === 'paused' || st === 'inativa' || st === 'inactive' || st === 'finalizada' || st === 'expired');
      } else {
        active = true;
      }
    }

    return Object.assign({}, promo, {
      id: promo.id || promo._id || idFallback || '',
      name: firstText(promo.name, promo.title, promo.nome, promo.label, promo.description),
      type: _normalizePromoType(rawType || promo.type),
      active: active !== false,
      startDate: promo.startDate || promo.startsAt || promo.dataInicio || promo.inicio || '',
      endDate: promo.endDate || promo.endsAt || promo.dataFim || promo.fim || '',
      applyTo: promo.applyTo || (promo.scope === 'produtos_selecionados' ? 'selected' : 'all'),
      scope: promo.scope || (productIds.length ? 'produtos_selecionados' : 'todos_produtos'),
      productIds: productIds,
      productId: promo.productId || (productIds[0] || ''),
      productName: firstText(promo.productName, promo.product || promo.produto || ''),
      valuePercentual: promo.valuePercentual != null ? promo.valuePercentual : promo.discountPct != null ? promo.discountPct : promo.pctValue != null ? promo.pctValue : promo.value,
      valueDesconto: promo.valueDesconto != null ? promo.valueDesconto : promo.eurValue != null ? promo.eurValue : promo.fixedDiscount != null ? promo.fixedDiscount : promo.value,
      fixedPrice: promo.fixedPrice != null ? promo.fixedPrice : promo.finalPrice != null ? promo.finalPrice : promo.offerPrice != null ? promo.offerPrice : promo.priceFixed != null ? promo.priceFixed : '',
      leveQtd: promo.leveQtd != null ? promo.leveQtd : promo.leve != null ? promo.leve : '',
      pagueQtd: promo.pagueQtd != null ? promo.pagueQtd : promo.pague != null ? promo.pague : ''
    });
  }

  function _promoAutoTags(promo) {
    var type = _normalizePromoType(promo && promo.type);
    if (type === 'pct') return [{ key: 'promo_desconto_percentual', label: 'promo_desconto_percentual' }, { key: 'oferta', label: 'oferta' }];
    if (type === 'eur') return [{ key: 'promo_desconto_valor', label: 'promo_desconto_valor' }, { key: 'oferta', label: 'oferta' }];
    if (type === '2x1') return [{ key: 'promo_2x1', label: 'promo_2x1' }, { key: 'giro_rapido', label: 'giro_rapido' }];
    if (type === 'add1') return [{ key: 'promo_leve_mais', label: 'promo_leve_mais' }, { key: 'ticket_medio', label: 'ticket_medio' }];
    if (type === 'fixed') return [{ key: 'promo_oferta_dia', label: 'promo_oferta_dia' }, { key: 'oferta', label: 'oferta' }];
    if (type === 'frete') return [{ key: 'promo_frete_gratis', label: 'promo_frete_gratis' }, { key: 'oferta', label: 'oferta' }];
    return [{ key: 'oferta', label: 'oferta' }];
  }

  function _promoTypeLabel(type) {
    var t = _normalizePromoType(type);
    if (t === 'pct') return 'Desconto (%)';
    if (t === 'eur') return 'Desconto (€)';
    if (t === '2x1') return 'Leve 2 pague 1';
    if (t === 'add1') return 'Leve mais';
    if (t === 'fixed') return 'Preço fixo';
    if (t === 'frete') return 'Frete grátis';
    return 'Promoção';
  }

  function _promoStatusInfo(promo) {
    var now = Date.now();
    var start = _promoDateValue(promo && (promo.startDate || promo.startsAt));
    var end = _promoDateValue(promo && (promo.endDate || promo.endsAt));
    var active = promo && promo.active !== false;
    if (start && start > now) return { key: 'scheduled', label: 'Agendada', tone: '#3B82F6', bg: '#EEF4FF' };
    if (end && end < now) return { key: active ? 'expired' : 'finalized', label: active ? 'Expirada' : 'Finalizada', tone: '#8A7E7C', bg: '#F2EDED' };
    if (!active) return { key: 'paused', label: 'Pausada', tone: '#D97706', bg: '#FFF8E8' };
    return { key: 'active', label: 'Ativa', tone: '#1A9E5A', bg: '#EDFAF3' };
  }

  function _promoDateValue(v) {
    if (!v) return 0;
    if (typeof v === 'number' && isFinite(v)) return v;
    if (v && typeof v.toDate === 'function') {
      try { return v.toDate().getTime(); } catch (e) { return 0; }
    }
    var d = new Date(v);
    return isFinite(d.getTime()) ? d.getTime() : 0;
  }

  function _promoStartOfDay(ts) {
    var d = ts ? new Date(ts) : new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function _promoStartOfWeek(ts) {
    var d = ts ? new Date(ts) : new Date();
    d.setHours(0, 0, 0, 0);
    var day = d.getDay() || 7;
    d.setDate(d.getDate() - (day - 1));
    return d.getTime();
  }

  function _promoStartOfMonth(ts) {
    var d = ts ? new Date(ts) : new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(1);
    return d.getTime();
  }

  function _promoEndOfDay(ts) {
    var d = ts ? new Date(ts) : new Date();
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }

  function _promoResolvedTypeLabel(p) {
    return _promoTypeLabel(p && p.type);
  }

  function _promoEndTs(promo) {
    return _promoDateValue(promo && (promo.endDate || promo.endsAt));
  }

  function _promoStartTs(promo) {
    return _promoDateValue(promo && (promo.startDate || promo.startsAt));
  }

  function _promoProductIds(promo) {
    if (!promo) return [];
    if (Array.isArray(promo.productIds) && promo.productIds.length) return promo.productIds.map(String).filter(Boolean);
    if (promo.productId != null && promo.productId !== '') return [String(promo.productId)];
    return [];
  }

  function _promoProductsForPromo(promo) {
    var ids = _promoProductIds(promo);
    if (!ids.length) return [];
    var set = {};
    ids.forEach(function (id) { set[String(id)] = true; });
    return (_products || []).filter(function (prod) { return set[String(prod.id)]; });
  }

  function _promoMatchesProduct(promo, product) {
    if (!promo || !product) return false;
    var active = promo.active !== false;
    var now = Date.now();
    var start = _promoStartTs(promo);
    var end = _promoEndTs(promo);
    if (start && start > now) return false;
    if (end && end < now) return false;
    if (promo.applyTo === 'all' || promo.scope === 'todos_produtos') return true;
    var ids = _promoProductIds(promo);
    return ids.indexOf(String(product.id)) >= 0;
  }

  function _promoVisibleStatus(promo) {
    return _promoStatusInfo(promo).key;
  }

  function _promoSearchText(promo) {
    var tags = _promoAutoTags(promo).map(function (t) { return t.label; }).join(' ');
    var products = _promoProductsForPromo(promo).slice(0, 4).map(function (p) { return p.name || ''; }).join(' ');
    return [
      promo.name || '',
      _promoResolvedTypeLabel(promo),
      promo.valuePercentual != null ? String(promo.valuePercentual) : '',
      promo.valueDesconto != null ? String(promo.valueDesconto) : '',
      promo.discountPct != null ? String(promo.discountPct) : '',
      promo.fixedPrice != null ? String(promo.fixedPrice) : '',
      promo.value != null ? String(promo.value) : '',
      promo.active !== false ? 'ativa' : 'pausada',
      _promoStatusInfo(promo).label,
      tags,
      products,
      promo.productName || '',
      promo.startDate || promo.startsAt || '',
      promo.endDate || promo.endsAt || ''
    ].join(' ').toLowerCase();
  }

  function _promoMatchesSearch(promo) {
    var q = (_promoUi.query || '').trim().toLowerCase();
    if (!q) return true;
    return _promoSearchText(promo).indexOf(q) >= 0;
  }

  function _promoMatchesStatus(promo) {
    var filter = _promoUi.status || 'all';
    if (filter === 'all') return true;
    return _promoVisibleStatus(promo) === filter;
  }

  function _promoMatchesType(promo) {
    var filter = _promoUi.type || 'all';
    if (filter === 'all') return true;
    return _normalizePromoType(promo && promo.type) === filter;
  }

  function _promoMatchesPeriod(promo) {
    var filter = _promoUi.period || 'all';
    if (filter === 'all') return true;
    var now = Date.now();
    var start = _promoStartTs(promo);
    var end = _promoEndTs(promo);
    if (filter === 'today') {
      var startDay = _promoStartOfDay(now);
      var endDay = _promoEndOfDay(now);
      return (start && start >= startDay && start <= endDay) || (end && end >= startDay && end <= endDay);
    }
    if (filter === 'week') {
      return (start && start >= _promoStartOfWeek(now)) || (end && end >= _promoStartOfWeek(now));
    }
    if (filter === 'month') {
      return (start && start >= _promoStartOfMonth(now)) || (end && end >= _promoStartOfMonth(now));
    }
    if (filter === 'scheduled') return _promoStatusInfo(promo).key === 'scheduled';
    if (filter === 'expired') return _promoStatusInfo(promo).key === 'expired' || _promoStatusInfo(promo).key === 'finalized';
    if (filter === 'custom') {
      var rangeStart = _promoDateValue(_promoUi.periodStart);
      var rangeEnd = _promoDateValue(_promoUi.periodEnd);
      if (!rangeStart && !rangeEnd) return true;
      if (!rangeStart) rangeStart = 0;
      if (!rangeEnd) rangeEnd = now;
      if (rangeStart > rangeEnd) {
        var swap = rangeStart;
        rangeStart = rangeEnd;
        rangeEnd = swap;
      }
      var promoStart = start || 0;
      var promoEnd = end || now;
      if (!start && !end) return _promoStatusInfo(promo).key === 'active' || _promoStatusInfo(promo).key === 'scheduled' || _promoStatusInfo(promo).key === 'paused';
      return promoEnd >= rangeStart && promoStart <= rangeEnd;
    }
    return true;
  }

  function _promoFilteredList() {
    return (_promos || []).slice().sort(function (a, b) {
      return _promoDateValue(b.updatedAt || b.createdAt || b.startDate || 0) - _promoDateValue(a.updatedAt || a.createdAt || a.startDate || 0);
    }).filter(function (promo) {
      return _promoMatchesSearch(promo) && _promoMatchesStatus(promo) && _promoMatchesType(promo) && _promoMatchesPeriod(promo);
    });
  }

  function _promoSummary(list) {
    var promos = list || _promoFilteredList();
    var active = promos.filter(function (p) { return _promoStatusInfo(p).key === 'active'; }).length;
    var scheduled = promos.filter(function (p) { return _promoStatusInfo(p).key === 'scheduled'; }).length;
    var expired = promos.filter(function (p) { return _promoStatusInfo(p).key === 'expired' || _promoStatusInfo(p).key === 'finalized'; }).length;
    var products = {};
    promos.forEach(function (promo) {
      _promoProductsForPromo(promo).forEach(function (p) { products[String(p.id)] = true; });
    });
    return {
      active: active,
      products: Object.keys(products).length,
      scheduled: scheduled,
      expired: expired
    };
  }

  function _promoSummaryHtml(summary) {
    summary = summary || _promoSummary();
    return '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px;">' +
      '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;box-shadow:0 1px 6px rgba(0,0,0,.03);"><div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Promoções ativas</div><div style="font-size:22px;font-weight:900;color:#1A9E5A;margin-top:4px;">' + summary.active + '</div></div>' +
      '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;box-shadow:0 1px 6px rgba(0,0,0,.03);"><div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Produtos em promoção</div><div style="font-size:22px;font-weight:900;color:#1A1A1A;margin-top:4px;">' + summary.products + '</div></div>' +
      '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;box-shadow:0 1px 6px rgba(0,0,0,.03);"><div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Promoções agendadas</div><div style="font-size:22px;font-weight:900;color:#3B82F6;margin-top:4px;">' + summary.scheduled + '</div></div>' +
      '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;box-shadow:0 1px 6px rgba(0,0,0,.03);"><div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Promoções expiradas</div><div style="font-size:22px;font-weight:900;color:#C4362A;margin-top:4px;">' + summary.expired + '</div></div>' +
    '</div>';
  }

  function _promoToolbarHtml() {
    var customHtml = _promoUi.period === 'custom'
      ? '<div style="grid-column:1 / -1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:-2px;">' +
          '<label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;"><span style="display:block;margin-bottom:4px;">Data inicial</span><input type="date" value="' + _esc(_promoUi.periodStart || '') + '" onchange="Modules.Marketing._setPromoPeriodStart(this.value)" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:12px;background:#fff;font-size:13px;font-family:inherit;outline:none;"></label>' +
          '<label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;"><span style="display:block;margin-bottom:4px;">Data final</span><input type="date" value="' + _esc(_promoUi.periodEnd || '') + '" onchange="Modules.Marketing._setPromoPeriodEnd(this.value)" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:12px;background:#fff;font-size:13px;font-family:inherit;outline:none;"></label>' +
        '</div>'
      : '';
    return '<div style="display:grid;grid-template-columns:1.4fr .9fr .9fr .9fr;gap:10px;margin-bottom:14px;align-items:end;">' +
      '<div><label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;margin-bottom:4px;">Buscar por promoção, produto, tipo ou tag</label><input id="prm-search" type="search" value="' + _esc(_promoUi.query || '') + '" oninput="Modules.Marketing._setPromoSearch(this.value)" placeholder="Buscar por promoção, produto, tipo ou tag" style="width:100%;padding:11px 14px;border:1.5px solid #D4C8C6;border-radius:999px;background:#fff;font-size:13px;font-family:inherit;outline:none;"></div>' +
      '<label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;"><span style="display:block;margin-bottom:4px;">Status</span><select onchange="Modules.Marketing._setPromoStatus(this.value)" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:12px;background:#fff;font-size:13px;font-family:inherit;outline:none;"><option value="all"' + (_promoUi.status === 'all' ? ' selected' : '') + '>Todas</option><option value="active"' + (_promoUi.status === 'active' ? ' selected' : '') + '>Ativas</option><option value="scheduled"' + (_promoUi.status === 'scheduled' ? ' selected' : '') + '>Agendadas</option><option value="paused"' + (_promoUi.status === 'paused' ? ' selected' : '') + '>Pausadas</option><option value="finalized"' + (_promoUi.status === 'finalized' ? ' selected' : '') + '>Finalizadas</option><option value="expired"' + (_promoUi.status === 'expired' ? ' selected' : '') + '>Expiradas</option></select></label>' +
      '<label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;"><span style="display:block;margin-bottom:4px;">Tipo de promoção</span><select onchange="Modules.Marketing._setPromoTypeFilter(this.value)" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:12px;background:#fff;font-size:13px;font-family:inherit;outline:none;"><option value="all"' + (_promoUi.type === 'all' ? ' selected' : '') + '>Todos</option><option value="pct"' + (_promoUi.type === 'pct' ? ' selected' : '') + '>Desconto (%)</option><option value="eur"' + (_promoUi.type === 'eur' ? ' selected' : '') + '>Desconto (€)</option><option value="2x1"' + (_promoUi.type === '2x1' ? ' selected' : '') + '>Leve 2 pague 1</option><option value="add1"' + (_promoUi.type === 'add1' ? ' selected' : '') + '>Leve mais</option><option value="frete"' + (_promoUi.type === 'frete' ? ' selected' : '') + '>Frete grátis</option></select></label>' +
      '<label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;"><span style="display:block;margin-bottom:4px;">Período</span><select onchange="Modules.Marketing._setPromoPeriod(this.value)" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:12px;background:#fff;font-size:13px;font-family:inherit;outline:none;"><option value="all"' + (_promoUi.period === 'all' ? ' selected' : '') + '>Todos</option><option value="today"' + (_promoUi.period === 'today' ? ' selected' : '') + '>Hoje</option><option value="week"' + (_promoUi.period === 'week' ? ' selected' : '') + '>Esta semana</option><option value="month"' + (_promoUi.period === 'month' ? ' selected' : '') + '>Este mês</option><option value="scheduled"' + (_promoUi.period === 'scheduled' ? ' selected' : '') + '>Agendadas</option><option value="expired"' + (_promoUi.period === 'expired' ? ' selected' : '') + '>Expiradas</option><option value="custom"' + (_promoUi.period === 'custom' ? ' selected' : '') + '>Personalizado</option></select></label>' +
      customHtml +
    '</div>';
  }

  function _promoEmptyStateHtml() {
    return '<div style="background:#fff;border:1px dashed #E4D7D4;border-radius:16px;padding:28px;text-align:center;">' +
      '<div style="font-size:18px;font-weight:900;color:#1A1A1A;margin-bottom:6px;">Nenhuma promoção criada ainda</div>' +
      '<div style="font-size:13px;color:#8A7E7C;line-height:1.5;margin-bottom:16px;">Crie promoções para destacar produtos, aumentar pedidos e testar ofertas.</div>' +
      '<button onclick="Modules.Marketing._openPromoModal(null, \'edit\')" style="background:#C4362A;color:#fff;border:none;padding:11px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Criar primeira promoção</button>' +
    '</div>';
  }

  function _promoSetFilter(key, value) {
    _promoUi[key] = value;
    _paintPromos();
  }

  function _setPromoSearch(value) { _promoSetFilter('query', value || ''); }
  function _setPromoStatus(value) { _promoSetFilter('status', value || 'all'); }
  function _setPromoTypeFilter(value) { _promoSetFilter('type', value || 'all'); }
  function _setPromoPeriod(value) { _promoSetFilter('period', value || 'all'); }
  function _setPromoPeriodStart(value) { _promoUi.periodStart = value || ''; _paintPromos(); }
  function _setPromoPeriodEnd(value) { _promoUi.periodEnd = value || ''; _paintPromos(); }

  function _promoStatusTone(statusKey) {
    if (statusKey === 'active') return { bg: '#EDFAF3', color: '#1A9E5A' };
    if (statusKey === 'scheduled') return { bg: '#EEF4FF', color: '#3B82F6' };
    if (statusKey === 'paused') return { bg: '#FFF8E8', color: '#D97706' };
    if (statusKey === 'expired') return { bg: '#FFF0EE', color: '#C4362A' };
    return { bg: '#F2EDED', color: '#8A7E7C' };
  }

  function _promoCardMetaTagHtml(promo) {
    return _promoAutoTags(promo).map(function (tag) {
      return '<span style="font-size:10px;font-weight:900;padding:4px 8px;border-radius:999px;background:#FFF0EE;color:#C4362A;">' + _esc(tag.label) + '</span>';
    }).join('');
  }

  function _promoCardAlertList(promo) {
    return _promoAlerts(promo).slice(0, 2).map(function (a) {
      return '<div style="font-size:11px;color:' + a.color + ';font-weight:700;">' + _esc(a.text) + '</div>';
    }).join('');
  }

  function _promoMainProductsHtml(promo) {
    var ids = _promoProductsForPromo(promo);
    if (!ids.length) return '<span style="font-size:11px;color:#8A7E7C;">Sem produto vinculado</span>';
    var first = ids.slice(0, 3).map(function (p) { return _esc(p.name || 'Produto'); }).join(' · ');
    return '<span style="font-size:11px;color:#8A7E7C;">' + first + (ids.length > 3 ? ' +' + (ids.length - 3) : '') + '</span>';
  }

  function _promoCardHTML(promo) {
    var status = _promoStatusInfo(promo);
    var tone = _promoStatusTone(status.key);
    var typeLabel = _promoTypeLabel(promo.type);
    var normalizedType = _normalizePromoType(promo.type);
    var valueLabel = normalizedType === 'pct'
      ? (_promoLegacyPct(promo) > 0 ? _promoLegacyPct(promo) + '%' : '—')
      : normalizedType === 'eur'
        ? (_promoLegacyEur(promo) > 0 ? UI.fmt(_promoLegacyEur(promo)) : '—')
        : normalizedType === 'fixed'
          ? (_promoLegacyFixedPrice(promo) > 0 ? UI.fmt(_promoLegacyFixedPrice(promo)) : '—')
          : normalizedType === '2x1'
            ? 'Leve 2 pague 1'
            : normalizedType === 'add1'
              ? ('Leve ' + (promo.leveQtd || 0) + ', pague ' + (promo.pagueQtd || 0))
              : normalizedType === 'frete'
                ? (promo.minOrder > 0 ? 'Frete grátis a partir de ' + UI.fmt(promo.minOrder) : 'Frete grátis')
              : '—';
    var dates = [
      promo.startDate || promo.startsAt ? 'Início: ' + UI.fmtDate(new Date(promo.startDate || promo.startsAt)) : 'Início: —',
      promo.endDate || promo.endsAt ? 'Fim: ' + UI.fmtDate(new Date(promo.endDate || promo.endsAt)) : 'Fim: —'
    ];
    var productCount = _promoProductsForPromo(promo).length;
    var mainProducts = _promoMainProductsHtml(promo);
    var alerts = _promoCardAlertList(promo);
    var insight = _promoInsight(promo);
    var promoIdArg = _esc(String(promo.id));
    var activeLabel = status.key === 'active' || status.key === 'scheduled' ? 'Pausar' : 'Ativar';
    return '<div class="promo-card" onclick="Modules.Marketing._openPromoModal(\'' + promoIdArg + '\', \'view\')" style="background:#fff;border:1px solid #EEE6E4;border-radius:16px;padding:14px 16px;box-shadow:0 2px 8px rgba(0,0,0,.05);cursor:pointer;display:flex;gap:14px;align-items:flex-start;">' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;">' +
          '<div style="min-width:0;">' +
            '<div style="font-size:15px;font-weight:800;color:#1A1A1A;line-height:1.25;">' + _esc(promo.name || 'Promoção') + '</div>' +
            '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:6px;">' +
              '<span style="font-size:10px;font-weight:900;padding:4px 8px;border-radius:999px;background:' + (normalizedType === 'pct' ? '#EDFAF3' : normalizedType === 'eur' ? '#EEF4FF' : normalizedType === '2x1' ? '#FFF0EE' : normalizedType === 'fixed' ? '#FFF8E8' : '#FFF8E8') + ';color:' + (normalizedType === 'pct' ? '#1A9E5A' : normalizedType === 'eur' ? '#3B82F6' : normalizedType === '2x1' ? '#C4362A' : normalizedType === 'fixed' ? '#D97706' : '#D97706') + ';">' + _esc(typeLabel) + '</span>' +
              '<span style="font-size:10px;font-weight:900;padding:4px 8px;border-radius:999px;background:' + tone.bg + ';color:' + tone.color + ';">' + _esc(status.label) + '</span>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;min-width:160px;">' +
            '<div style="font-size:12px;font-weight:800;color:#1A1A1A;">' + _esc(valueLabel) + '</div>' +
            '<div style="font-size:11px;color:#8A7E7C;text-align:right;">' + productCount + ' produto' + (productCount === 1 ? '' : 's') + ' vinculado' + (productCount === 1 ? '' : 's') + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px;">' +
          '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Início</div><div style="font-size:12px;font-weight:700;color:#1A1A1A;">' + dates[0].replace('Início: ', '') + '</div></div>' +
          '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Fim</div><div style="font-size:12px;font-weight:700;color:#1A1A1A;">' + dates[1].replace('Fim: ', '') + '</div></div>' +
          '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Produto principal</div><div style="font-size:12px;font-weight:700;color:#1A1A1A;">' + mainProducts + '</div></div>' +
        '</div>' +
        (alerts ? '<div style="margin-top:10px;display:flex;flex-direction:column;gap:4px;">' + alerts + '</div>' : '') +
        (insight ? '<div style="margin-top:10px;font-size:12px;font-weight:800;color:' + insight.color + ';">' + _esc(insight.text) + '</div>' : '') +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;min-width:180px;">' +
        '<button onclick="event.stopPropagation();Modules.Marketing._openPromoModal(\'' + promoIdArg + '\', \'view\')" style="padding:7px 12px;border:none;border-radius:12px;background:#F2EDED;color:#1A1A1A;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">Ver detalhes</button>' +
        '<button onclick="event.stopPropagation();Modules.Marketing._openPromoModal(\'' + promoIdArg + '\', \'edit\')" style="padding:7px 12px;border:none;border-radius:12px;background:#EEF4FF;color:#3B82F6;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">Editar</button>' +
        '<button onclick="event.stopPropagation();Modules.Marketing._togglePromoStatus(\'' + promoIdArg + '\')" style="padding:7px 12px;border:none;border-radius:12px;background:' + (promo.active !== false ? '#FFF8E8' : '#EDFAF3') + ';color:' + (promo.active !== false ? '#D97706' : '#1A9E5A') + ';font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">' + activeLabel + '</button>' +
        '<button onclick="event.stopPropagation();Modules.Marketing._duplicatePromo(\'' + promoIdArg + '\')" style="padding:7px 12px;border:none;border-radius:12px;background:#F2EDED;color:#8A7E7C;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">Duplicar</button>' +
        '<button onclick="event.stopPropagation();Modules.Marketing._deletePromo(\'' + promoIdArg + '\')" style="padding:7px 12px;border:none;border-radius:12px;background:#FFF0EE;color:#C4362A;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">Excluir</button>' +
      '</div>' +
    '</div>';
  }

  function _promoAlertScore(promo) {
    var alerts = _promoAlerts(promo);
    var score = 0;
    alerts.forEach(function (a) {
      if (a.level === 'danger') score += 3;
      else if (a.level === 'warning') score += 1;
    });
    return score;
  }

  function _orderTs(order) {
    if (!order) return 0;
    var raw = order.createdAt || order.updatedAt || order.date || order.data || 0;
    if (typeof raw === 'number') return raw;
    if (raw && typeof raw.toDate === 'function') {
      try { return raw.toDate().getTime(); } catch (e) { return 0; }
    }
    var d = new Date(raw);
    return isFinite(d.getTime()) ? d.getTime() : 0;
  }

  function _orderItems(order) {
    return Array.isArray(order && order.items) ? order.items : [];
  }

  function _promoIdText(promo) {
    return String(promo && (promo.id || promo._id || promo.slug || promo.code || '') || '');
  }

  function _orderMatchesPromo(order, promo) {
    if (!order || !promo) return false;
    var promoId = _promoIdText(promo);
    var promoName = String(firstText(promo.name, promo.title, _promoTypeLabel(promo.type)) || '').toLowerCase();
    var orderPromoIds = Array.isArray(order.promoIds) ? order.promoIds.map(String) : [];
    if (!orderPromoIds.length && order.promoSummary && Array.isArray(order.promoSummary.ids)) {
      orderPromoIds = order.promoSummary.ids.map(String);
    }
    if (promoId && orderPromoIds.indexOf(promoId) >= 0) return true;
    return _orderItems(order).some(function (item) {
      var itemPromoId = String(item && (item.promoId || item.promo_id || item.promo || ''));
      var itemPromoName = String(firstText(item && item.promoName, item && item.promo_name, item && item.promoTitle, '')).toLowerCase();
      return (promoId && itemPromoId === promoId) || (promoName && itemPromoName && itemPromoName.indexOf(promoName) >= 0);
    });
  }

  function _orderPromoRevenue(order, promo) {
    var total = 0;
    var promoId = _promoIdText(promo);
    var promoName = String(firstText(promo.name, promo.title, _promoTypeLabel(promo.type)) || '').toLowerCase();
    _orderItems(order).forEach(function (item) {
      var itemPromoId = String(item && (item.promoId || item.promo_id || item.promo || ''));
      var itemPromoName = String(firstText(item && item.promoName, item && item.promo_name, item && item.promoTitle, '')).toLowerCase();
      var matches = (promoId && itemPromoId === promoId) || (promoName && itemPromoName && itemPromoName.indexOf(promoName) >= 0);
      if (!matches) return;
      var v = item && (item.promoTotal != null ? item.promoTotal : item.total != null ? item.total : item.price != null ? (item.price * (_promoNumber(item.qty || 1) || 1)) : 0);
      total += _promoNumber(v);
    });
    return total;
  }

  function _promoSalesStats(promo) {
    var now = Date.now();
    var day = 24 * 60 * 60 * 1000;
    var currentStart = now - (30 * day);
    var prevStart = now - (60 * day);
    var currentOrders = 0;
    var prevOrders = 0;
    var currentRevenue = 0;
    var prevRevenue = 0;
    var currentItems = 0;
    var prevItems = 0;

    (_orders || []).forEach(function (order) {
      if (!_orderMatchesPromo(order, promo)) return;
      var ts = _orderTs(order);
      var revenue = _orderPromoRevenue(order, promo);
      var items = _orderItems(order).reduce(function (sum, item) {
        var itemPromoId = String(item && (item.promoId || item.promo_id || item.promo || ''));
        var itemPromoName = String(firstText(item && item.promoName, item && item.promo_name, item && item.promoTitle, '')).toLowerCase();
        var promoId = _promoIdText(promo);
        var promoName = String(firstText(promo.name, promo.title, _promoTypeLabel(promo.type)) || '').toLowerCase();
        var matches = (promoId && itemPromoId === promoId) || (promoName && itemPromoName && itemPromoName.indexOf(promoName) >= 0);
        return sum + (matches ? (_promoNumber(item && item.qty != null ? item.qty : 1) || 1) : 0);
      }, 0);

      if (ts >= currentStart) {
        currentOrders += 1;
        currentRevenue += revenue;
        currentItems += items;
      } else if (ts >= prevStart && ts < currentStart) {
        prevOrders += 1;
        prevRevenue += revenue;
        prevItems += items;
      }
    });

    return {
      currentOrders: currentOrders,
      prevOrders: prevOrders,
      currentRevenue: currentRevenue,
      prevRevenue: prevRevenue,
      currentItems: currentItems,
      prevItems: prevItems
    };
  }

  function _promoSalesSummaryHtml(promo) {
    var stats = _promoSalesStats(promo);
    var growth = stats.prevRevenue > 0 ? ((stats.currentRevenue - stats.prevRevenue) / stats.prevRevenue) * 100 : null;
    var growthLabel = growth == null
      ? 'Sem base anterior'
      : (growth >= 0 ? '+' : '') + growth.toFixed(0) + '% vs. período anterior';
    var growthColor = growth == null ? '#8A7E7C' : growth >= 0 ? '#1A9E5A' : '#C4362A';
    var badgeBg = growth == null ? '#F2EDED' : growth >= 0 ? '#EDFAF3' : '#FFF0EE';
    return '<section style="background:#fff;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">' +
      '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Resumo de vendas</div>' +
      '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;">' +
        '<div style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;">' +
          '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Pedidos</div>' +
          '<div style="font-size:22px;font-weight:900;color:#1A1A1A;margin-top:4px;">' + stats.currentOrders + '</div>' +
          '<div style="font-size:11px;color:#8A7E7C;margin-top:3px;">' + stats.prevOrders + ' no período anterior</div>' +
        '</div>' +
        '<div style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;">' +
          '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Faturamento</div>' +
          '<div style="font-size:22px;font-weight:900;color:#1A1A1A;margin-top:4px;">' + UI.fmt(stats.currentRevenue) + '</div>' +
          '<div style="font-size:11px;color:#8A7E7C;margin-top:3px;">' + UI.fmt(stats.prevRevenue) + ' no período anterior</div>' +
        '</div>' +
        '<div style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;">' +
          '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Desconto total</div>' +
          '<div style="font-size:22px;font-weight:900;color:#C4362A;margin-top:4px;">-' + UI.fmt(stats.currentRevenue > 0 ? _promoSalesDiscount(promo) : 0) + '</div>' +
          '<div style="font-size:11px;color:#8A7E7C;margin-top:3px;">Somando descontos dos pedidos vinculados</div>' +
        '</div>' +
        '<div style="background:' + badgeBg + ';border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;">' +
          '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Variação</div>' +
          '<div style="font-size:18px;font-weight:900;color:' + growthColor + ';margin-top:6px;">' + growthLabel + '</div>' +
          '<div style="font-size:11px;color:#8A7E7C;margin-top:3px;">Últimos 30 dias vs. 30 dias anteriores</div>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function _promoSalesDiscount(promo) {
    var total = 0;
    (_orders || []).forEach(function (order) {
      if (!_orderMatchesPromo(order, promo)) return;
      _orderItems(order).forEach(function (item) {
        var itemPromoId = String(item && (item.promoId || item.promo_id || item.promo || ''));
        var itemPromoName = String(firstText(item && item.promoName, item && item.promo_name, item && item.promoTitle, '')).toLowerCase();
        var promoId = _promoIdText(promo);
        var promoName = String(firstText(promo.name, promo.title, _promoTypeLabel(promo.type)) || '').toLowerCase();
        var matches = (promoId && itemPromoId === promoId) || (promoName && itemPromoName && itemPromoName.indexOf(promoName) >= 0);
        if (!matches) return;
        total += _promoNumber(item && item.discount != null ? item.discount : 0);
      });
    });
    return total > 0 ? total : 0;
  }

  function _promoSalesInsight(promo) {
    var stats = _promoSalesStats(promo);
    var growth = stats.prevRevenue > 0 ? ((stats.currentRevenue - stats.prevRevenue) / stats.prevRevenue) * 100 : null;
    var statusKey = _promoStatusInfo(promo).key;

    if (!stats.currentOrders && !stats.prevOrders) {
      if (statusKey === 'active') {
        return { text: 'Ainda sem pedidos nesta promoção. A análise de vendas aparece quando entrar base suficiente.', color: '#8A7E7C' };
      }
      return { text: 'Sem pedidos suficientes para analisar vendas nesta promoção.', color: '#8A7E7C' };
    }

    if (growth != null && growth >= 15 && stats.currentOrders >= 3) {
      return { text: 'Promoção em alta: ' + stats.currentOrders + ' pedidos nos últimos 30 dias, +' + growth.toFixed(0) + '% vs. o período anterior.', color: '#1A9E5A' };
    }
    if (growth != null && growth <= -15 && stats.prevOrders > 0) {
      return { text: 'Promoção em queda: ' + stats.currentOrders + ' pedidos nos últimos 30 dias, ' + growth.toFixed(0) + '% vs. o período anterior.', color: '#C4362A' };
    }
    if (stats.currentOrders > 0) {
      return { text: 'Vendas recentes: ' + stats.currentOrders + ' pedidos e ' + stats.currentItems + ' itens em 30 dias. Ainda sem variação forte.', color: '#D97706' };
    }
    return { text: 'Sem vendas recentes nesta promoção. Vale revisar destaque, preço ou visibilidade.', color: '#D97706' };
  }

  function _promoInsight(promo, alerts) {
    alerts = alerts || _promoAlerts(promo);
    var score = _promoAlertScore(promo);
    if (score >= 4) return { text: 'Sugestão: tire essa promoção do ar ou reduza o desconto. Ela pode estar prejudicando a margem.', color: '#C4362A' };
    if (score >= 2) return { text: 'Sugestão: essa promoção precisa de atenção. Verifique margem e validade.', color: '#D97706' };
    return _promoSalesInsight(promo);
  }

  function _promoAlerts(promo) {
    var list = [];
    var status = _promoStatusInfo(promo);
    if (!promo.endDate && !promo.endsAt) list.push({ level: 'warning', color: '#D97706', text: 'Promoção sem data de término.' });
    if (status.key === 'scheduled') list.push({ level: 'warning', color: '#3B82F6', text: 'Promoção agendada.' });
    if (status.key === 'paused') list.push({ level: 'warning', color: '#D97706', text: 'Promoção pausada.' });
    if (status.key === 'expired' || status.key === 'finalized') list.push({ level: 'danger', color: '#C4362A', text: 'Promoção expirada.' });

    (_promoProductsForPromo(promo) || []).forEach(function (product) {
      var cost = _promoCostForProduct(product);
      var price = _promoBasePrice(product);
      var hasPrice = price > 0;
      var hasStock = product.stock != null ? product.stock : (product.estoque != null ? product.estoque : null);
      var calc = _promoDiscountForProduct(product, {
        type: _normalizePromoType(promo.type),
        value: promo.valuePercentual != null ? promo.valuePercentual : promo.valueDesconto != null ? promo.valueDesconto : promo.discountPct != null ? promo.discountPct : promo.fixedPrice != null ? promo.fixedPrice : promo.value,
        pctValue: promo.valuePercentual != null ? promo.valuePercentual : promo.discountPct != null ? promo.discountPct : promo.value,
        eurValue: promo.valueDesconto != null ? promo.valueDesconto : promo.value,
        fixedPrice: promo.fixedPrice != null ? promo.fixedPrice : promo.finalPrice != null ? promo.finalPrice : '',
        leveQtd: promo.leveQtd,
        pagueQtd: promo.pagueQtd
      });
      if (!hasPrice) list.push({ level: 'warning', color: '#D97706', text: 'Produto sem preço configurado.' });
      if (hasStock === 0) list.push({ level: 'warning', color: '#D97706', text: 'Produto sem estoque.' });
      if (calc.original > 0 && cost > 0) {
        var marginAfter = calc.final > 0 ? ((calc.final - cost) / calc.final) * 100 : -100;
        var marginBefore = ((calc.original - cost) / calc.original) * 100;
        var minMargin = _moneyConfig.minMarginPct;
        var desiredMargin = _moneyConfig.desiredMarginPct;
        if (calc.final < cost) {
          list.push({ level: 'danger', color: '#C4362A', text: 'Atenção: essa promoção pode dar prejuízo.' });
        } else if (marginAfter < minMargin) {
          list.push({ level: 'danger', color: '#C4362A', text: 'Margem abaixo da regra mínima.' });
        } else if (marginAfter < desiredMargin) {
          list.push({ level: 'warning', color: '#D97706', text: 'Margem perto do limite desejado.' });
        }
        if (marginBefore >= desiredMargin && marginAfter < desiredMargin) {
          list.push({ level: 'warning', color: '#D97706', text: 'Promoção reduz a margem de um produto saudável.' });
        }
      } else if (price > 0 && cost <= 0) {
        list.push({ level: 'warning', color: '#8A7E7C', text: 'Custo não informado. Não foi possível calcular margem.' });
      }
    });

    var uniq = [];
    list.forEach(function (item) {
      var key = item.text;
      if (!uniq.some(function (x) { return x.text === key; })) uniq.push(item);
    });
    return uniq;
  }

  function _promoImpactByProductHtml(promo) {
    var products = _promoProductsForPromo(promo);
    if (!products.length) {
      return '<div style="font-size:13px;color:#8A7E7C;">Sem produtos vinculados para calcular impacto.</div>';
    }
    return '<div style="display:flex;flex-direction:column;gap:10px;">' + products.map(function (product) {
      var calc = _promoDiscountForProduct(product, {
        type: _normalizePromoType(promo.type),
        value: promo.valuePercentual != null ? promo.valuePercentual : promo.valueDesconto != null ? promo.valueDesconto : promo.discountPct != null ? promo.discountPct : promo.fixedPrice != null ? promo.fixedPrice : promo.value,
        pctValue: promo.valuePercentual != null ? promo.valuePercentual : promo.discountPct != null ? promo.discountPct : promo.value,
        eurValue: promo.valueDesconto != null ? promo.valueDesconto : promo.value,
        fixedPrice: promo.fixedPrice != null ? promo.fixedPrice : promo.finalPrice != null ? promo.finalPrice : '',
        leveQtd: promo.leveQtd,
        pagueQtd: promo.pagueQtd
      });
      var cost = _promoCostForProduct(product);
      var price = _promoBasePrice(product);
      var noCost = cost <= 0;
      var profitBefore = noCost ? null : (price - cost);
      var profitAfter = noCost ? null : (calc.final - cost);
      var marginBefore = noCost || price <= 0 ? null : (profitBefore / price) * 100;
      var marginAfter = noCost || calc.final <= 0 ? null : (profitAfter / calc.final) * 100;
      var alertTxt = noCost ? 'Custo não informado. Não foi possível calcular margem.' : '';
      return '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;">' +
        '<div style="font-size:13px;font-weight:800;color:#1A1A1A;">' + _esc(product.name || 'Produto') + '</div>' +
        '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">' + UI.fmt(price) + ' → ' + UI.fmt(calc.final) + ' · Desconto: ' + UI.fmt(calc.discount) + '</div>' +
        '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">Custo: ' + (noCost ? '—' : UI.fmt(cost)) + '</div>' +
        '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">Lucro estimado antes: ' + (profitBefore == null ? '—' : UI.fmt(profitBefore)) + ' · depois: ' + (profitAfter == null ? '—' : UI.fmt(profitAfter)) + '</div>' +
        '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">Margem antes: ' + (marginBefore == null ? '—' : marginBefore.toFixed(1).replace('.', ',') + '%') + ' · depois: ' + (marginAfter == null ? '—' : marginAfter.toFixed(1).replace('.', ',') + '%') + '</div>' +
        (alertTxt ? '<div style="font-size:12px;color:#D97706;font-weight:700;margin-top:6px;">' + _esc(alertTxt) + '</div>' : '') +
      '</div>';
    }).join('') + '</div>';
  }

  function _promoHistoryHtml(promo) {
    var history = promo && (promo.history || promo.logs || promo.events || promo.audit);
    if (!Array.isArray(history) || !history.length) {
      return '<div style="font-size:13px;color:#8A7E7C;">Sem histórico simples registrado.</div>';
    }
    return '<div style="display:flex;flex-direction:column;gap:8px;">' + history.slice(0, 5).map(function (item) {
      var label = typeof item === 'string' ? item : (item.action || item.label || item.text || 'Evento');
      var date = item && (item.date || item.createdAt || item.at) ? UI.fmtDate(new Date(item.date || item.createdAt || item.at)) : '';
      return '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:10px;padding:10px 12px;"><div style="font-size:13px;font-weight:700;color:#1A1A1A;">' + _esc(label) + '</div>' + (date ? '<div style="font-size:11px;color:#8A7E7C;margin-top:3px;">' + _esc(date) + '</div>' : '') + '</div>';
    }).join('') + '</div>';
  }

  function _promoViewModalHtml(promo) {
    var status = _promoStatusInfo(promo);
    var tags = _promoAutoTags(promo).map(function (t) {
      return '<span style="font-size:10px;font-weight:900;padding:4px 8px;border-radius:999px;background:#FFF0EE;color:#C4362A;">' + _esc(t.label) + '</span>';
    }).join('');
    var typeLabel = _promoTypeLabel(promo.type);
    var valueLabel = promo.type === 'pct'
      ? (promo.valuePercentual != null ? promo.valuePercentual + '%' : (promo.value != null ? promo.value + '%' : '—'))
      : promo.type === 'eur'
        ? (promo.valueDesconto != null ? UI.fmt(promo.valueDesconto) : (promo.value != null ? UI.fmt(promo.value) : '—'))
        : promo.type === '2x1'
          ? 'Leve 2, pague 1'
          : promo.type === 'add1'
            ? ('Leve ' + (promo.leveQtd || 0) + ', pague ' + (promo.pagueQtd || 0))
            : '—';
    var info = [
      '<div style="font-size:12px;color:#8A7E7C;">Tipo: ' + _esc(typeLabel) + '</div>',
      '<div style="font-size:12px;color:#8A7E7C;">Valor promocional: ' + _esc(valueLabel) + '</div>',
      '<div style="font-size:12px;color:#8A7E7C;">Início: ' + (promo.startDate || promo.startsAt ? _esc(UI.fmtDate(new Date(promo.startDate || promo.startsAt))) : '—') + '</div>',
      '<div style="font-size:12px;color:#8A7E7C;">Fim: ' + (promo.endDate || promo.endsAt ? _esc(UI.fmtDate(new Date(promo.endDate || promo.endsAt))) : '—') + '</div>',
      '<div style="font-size:12px;color:#8A7E7C;">' + _promoProductsForPromo(promo).length + ' produtos vinculados</div>'
    ].join('');
    var alerts = _promoAlerts(promo);
    var alertHtml = alerts.length ? '<div style="display:flex;flex-direction:column;gap:6px;">' + alerts.map(function (a) {
      return '<div style="padding:10px 12px;border-radius:10px;background:' + (a.level === 'danger' ? '#FFF0EE' : a.level === 'warning' ? '#FFF8E8' : '#F2EDED') + ';color:' + a.color + ';font-size:12px;font-weight:700;">' + _esc(a.text) + '</div>';
    }).join('') + '</div>' : '<div style="font-size:13px;color:#8A7E7C;">Sem alertas relevantes.</div>';
    return '<div style="display:flex;flex-direction:column;gap:14px;">' +
      '<section style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">' +
          '<div><div style="font-size:24px;font-weight:900;line-height:1.1;color:#1A1A1A;">' + _esc(promo.name || 'Promoção') + '</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;"><span style="font-size:10px;font-weight:900;padding:4px 8px;border-radius:999px;background:' + _promoStatusTone(status.key).bg + ';color:' + _promoStatusTone(status.key).color + ';">' + _esc(status.label) + '</span></div></div>' +
          '<div style="text-align:right;"><div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Valor</div><div style="font-size:24px;font-weight:900;color:#C4362A;">' + _esc(valueLabel) + '</div></div>' +
        '</div>' +
        '<div style="margin-top:10px;font-size:12px;color:#8A7E7C;">' + _esc(typeLabel) + '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px;">' +
          '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Início</div><div style="font-size:12px;font-weight:700;">' + (promo.startDate || promo.startsAt ? _esc(UI.fmtDate(new Date(promo.startDate || promo.startsAt))) : '—') + '</div></div>' +
          '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Fim</div><div style="font-size:12px;font-weight:700;">' + (promo.endDate || promo.endsAt ? _esc(UI.fmtDate(new Date(promo.endDate || promo.endsAt))) : '—') + '</div></div>' +
          '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Produtos</div><div style="font-size:12px;font-weight:700;">' + _promoProductsForPromo(promo).length + '</div></div>' +
        '</div>' +
      '</section>' +
      _promoSalesSummaryHtml(promo) +
      '<section style="background:#fff;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">' +
        '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Alertas</div>' +
        alertHtml +
      '</section>' +
      '<section style="background:#fff;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">' +
        '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Impacto por produto</div>' +
        _promoImpactByProductHtml(promo) +
      '</section>' +
      '<section style="background:#fff;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">' +
        '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Histórico</div>' +
        _promoHistoryHtml(promo) +
      '</section>' +
    '</div>';
  }

  function _promoEditModalHtml(promo) {
    var normalizedType = _normalizePromoType(promo.type || 'pct');
    var todayIso = new Date().toISOString().slice(0, 10);
    var minLabel = normalizedType === 'frete' ? 'Valor mínimo para frete grátis' : 'Pedido mínimo (opcional)';
    var minHelp = normalizedType === 'frete' ? 'O frete fica grátis quando o pedido atingir este valor.' : 'Use pedido mínimo para proteger sua margem';
    var selectedIds = _promoProductIds(promo);
    var selectedSet = {};
    selectedIds.forEach(function (id) { selectedSet[String(id)] = true; });
    var prodListHtml = _products.length === 0
      ? '<p style="font-size:12px;color:#8A7E7C;margin:0;">Nenhum produto cadastrado.</p>'
      : _products.map(function (prod) {
          var checked = selectedSet[String(prod.id)] || false;
          return '<label data-product-name="' + _esc(String(prod.name || '').toLowerCase()) + '" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #EEE6E4;border-radius:12px;background:#fff;cursor:pointer;">' +
            '<input type="checkbox" class="prm-product-check" data-product-id="' + prod.id + '" data-product-name="' + _esc(prod.name) + '" ' + (checked ? 'checked' : '') + ' style="width:16px;height:16px;accent-color:#C4362A;">' +
            '<div style="min-width:0;flex:1;">' +
            '<div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(prod.name) + '</div>' +
            '<div style="font-size:11px;color:#8A7E7C;">Refere-se a este produto na promoção</div>' +
            '</div>' +
            '</label>';
        }).join('');

    return `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <section style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">
          <div style="font-size:24px;font-weight:900;line-height:1.1;color:#1A1A1A;">${_esc(promo && promo.id ? 'Editar promoção' : 'Criar promoção para vender mais rápido')}</div>
          <div style="font-size:12px;color:#8A7E7C;margin-top:6px;">Ative uma oferta para aumentar suas vendas agora</div>
          <div style="margin-top:12px;">
            <label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Nome da promoção</label>
            <input id="prm-name" type="text" value="${_esc(promo.name || '')}" placeholder="Ex: Oferta de fim de semana" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;">
          </div>
        </section>

        <section style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">
          <div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Como você quer vender mais?</div>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
            ${PROMO_TYPES.map(function (t) {
              var active = normalizedType === t.key;
              return `<button type="button" data-ptype="${t.key}" onclick="Modules.Marketing._selectPromoType('${t.key}');Modules.Marketing._refreshPromoPreview();" style="min-height:84px;padding:12px;border:1.5px solid ${active ? '#C4362A' : '#D4C8C6'};border-radius:14px;background:${active ? '#FFF0EE' : '#fff'};color:${active ? '#C4362A' : '#1A1A1A'};font-family:inherit;cursor:pointer;text-align:left;display:flex;flex-direction:column;gap:6px;justify-content:center;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span class="${active ? 'icon-active' : 'icon-inactive'}" data-promo-icon="${t.key}">${_esc(t.icon)}</span>
                  <span style="font-size:13px;font-weight:800;">${_esc(t.label)}</span>
                </div>
                <div style="font-size:11px;color:#8A7E7C;">${_esc(t.hint)}</div>
              </button>`;
            }).join('')}
          </div>
        </section>

        <section style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">
          <div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Definir oferta</div>
          <div id="prm-offer-fields"></div>
          <div style="margin-top:10px;">
            <label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">${minLabel}</label>
            <input id="prm-min" type="number" step="0.01" value="${promo.minOrder || ''}" oninput="Modules.Marketing._refreshPromoPreview()" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;">
            <div style="font-size:11px;color:#8A7E7C;margin-top:4px;">${minHelp}</div>
          </div>
        </section>

        <section style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">
          <div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Período da promoção</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Início</label>
              <input id="prm-start" type="date" min="${todayIso}" value="${promo.startDate || promo.startsAt || ''}" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;">
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Fim</label>
              <input id="prm-end" type="date" min="${todayIso}" value="${promo.endDate || promo.endsAt || ''}" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;">
            </div>
          </div>
        </section>

        <section style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">
          <div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Onde aplicar essa promoção?</div>
          <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:12px;">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;font-weight:700;"><input type="radio" name="prm-apply" value="all"${(promo.applyTo || !promo.productIds || !promo.productIds.length) !== 'selected' ? ' checked' : ''} onchange="Modules.Marketing._refreshPromoPreview()" style="accent-color:#C4362A;"> Todos os produtos</label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;font-weight:700;"><input type="radio" name="prm-apply" value="selected"${(promo.applyTo === 'selected' || (promo.productIds && promo.productIds.length)) ? ' checked' : ''} onchange="Modules.Marketing._refreshPromoPreview()" style="accent-color:#C4362A;"> Selecionar produtos</label>
          </div>
          <div id="prm-products-panel" style="display:${(promo.applyTo === 'selected' || (promo.productIds && promo.productIds.length)) ? 'block' : 'none'};">
            <input id="prm-product-search" type="text" placeholder="Buscar produto..." oninput="Modules.Marketing._filterPromoProducts()" style="width:100%;padding:10px 14px;border:1.5px solid #D4C8C6;border-radius:999px;background:#fff;font-size:13px;font-family:inherit;outline:none;margin-bottom:10px;">
            <div id="prm-products-count" style="font-size:11px;font-weight:700;color:#8A7E7C;margin:0 0 10px;">0 produtos selecionados</div>
            <div id="prm-product-list" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;max-height:220px;overflow:auto;">${prodListHtml}</div>
          </div>
        </section>

        <section style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">
          <div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Regras adicionais</div>
          <textarea id="prm-rules" style="width:100%;min-height:88px;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:13px;font-family:inherit;outline:none;resize:vertical;background:#fff;" placeholder="Ex: aplicar só à noite, não combinar com cupom, etc.">${_esc(promo.rulesText || promo.rules || '')}</textarea>
        </section>

        <section style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div>
            <div style="font-size:13px;font-weight:700;">Status da promoção</div>
            <div style="font-size:11px;color:#8A7E7C;">Ativa, pausada ou agendada</div>
          </div>
          <button type="button" id="prm-active-toggle" onclick="Modules.Marketing._togglePromoActive()" style="width:42px;height:24px;border-radius:12px;border:none;cursor:pointer;position:relative;transition:background .2s;background:${promo.active !== false ? '#C4362A' : '#D4C8C6'};"><span style="position:absolute;top:3px;left:3px;width:18px;height:18px;background:#fff;border-radius:50%;transition:transform .2s;display:block;transform:translateX(${promo.active !== false ? '18px' : '0'});box-shadow:0 1px 4px rgba(0,0,0,.2);"></span></button>
        </section>

        <section style="background:#fff;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">
          <div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Impacto da promoção</div>
          <div id="prm-impact" style="margin-top:10px;font-size:13px;line-height:1.55;color:#1A1A1A;"></div>
        </section>
      </div>`;
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
    else if (key === 'pontos') _renderPontos();
    else if (key === 'avaliacoes') _renderAvaliacoes();
  }

  function _renderPontos() {
    _pointsLoad().then(function () {
      _paintPontos();
    });
  }

  function _paintPontos() {
    var content = document.getElementById('marketing-content');
    if (!content) return;
    var summary = _pointsSummary(_customers);
    var cfg = _pointsConfigData();
    var actionNote = summary.activeCustomers ? 'Clientes com saldo pronto para resgate.' : 'Ainda sem clientes com saldo de pontos.';
    content.innerHTML =
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px;">' +
        '<div><h2 style="font-size:20px;font-weight:800;margin-bottom:4px;">Programa de Pontos</h2><p style="font-size:12px;color:#8A7E7C;line-height:1.5;max-width:740px;">Acumule pontos por pedidos finalizados, converta em desconto futuro e acompanhe cada movimento sem aplicar desconto automático.</p></div>' +
        '<button onclick="Modules.Marketing._openPointsConfigModal()" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">' + _subActionLabel() + '</button>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:14px;">' +
        '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:14px;padding:12px 14px;box-shadow:0 2px 8px rgba(0,0,0,.04);"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Clientes com pontos</div><div style="font-size:22px;font-weight:900;color:#1A1A1A;margin-top:4px;">' + summary.activeCustomers + '</div><div style="font-size:11px;color:#8A7E7C;margin-top:3px;">' + actionNote + '</div></div>' +
        '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:14px;padding:12px 14px;box-shadow:0 2px 8px rgba(0,0,0,.04);"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Pontos em circulação</div><div style="font-size:22px;font-weight:900;color:#1A1A1A;margin-top:4px;">' + summary.totalBalance + '</div><div style="font-size:11px;color:#8A7E7C;margin-top:3px;">saldo acumulado em clientes</div></div>' +
        '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:14px;padding:12px 14px;box-shadow:0 2px 8px rgba(0,0,0,.04);"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Pontos gerados</div><div style="font-size:22px;font-weight:900;color:#1A9E5A;margin-top:4px;">' + summary.earned + '</div><div style="font-size:11px;color:#8A7E7C;margin-top:3px;">movimentos de ganho</div></div>' +
        '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:14px;padding:12px 14px;box-shadow:0 2px 8px rgba(0,0,0,.04);"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Pontos usados</div><div style="font-size:22px;font-weight:900;color:#C4362A;margin-top:4px;">' + summary.used + '</div><div style="font-size:11px;color:#8A7E7C;margin-top:3px;">resgates realizados</div></div>' +
        '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:14px;padding:12px 14px;box-shadow:0 2px 8px rgba(0,0,0,.04);"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Clientes elegíveis</div><div style="font-size:22px;font-weight:900;color:#1A1A1A;margin-top:4px;">' + summary.ready + '</div><div style="font-size:11px;color:#8A7E7C;margin-top:3px;">com saldo mínimo para usar</div></div>' +
        '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:14px;padding:12px 14px;box-shadow:0 2px 8px rgba(0,0,0,.04);"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Movimentos</div><div style="font-size:22px;font-weight:900;color:#1A1A1A;margin-top:4px;">' + summary.movements + '</div><div style="font-size:11px;color:#8A7E7C;margin-top:3px;">histórico registrado</div></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1.05fr .95fr;gap:14px;align-items:start;">' +
        '<div style="display:flex;flex-direction:column;gap:14px;">' +
          _pointsConfigHtml() +
          _pointsMovementsHtml() +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:14px;">' +
          _pointsCustomersHtml() +
          '<section style="background:#fff;border:1px solid #EEE6E4;border-radius:16px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.04);"><div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Resumo da regra</div><div style="font-size:13px;line-height:1.6;color:#1A1A1A;"><div>• ' + cfg.earnPerEuro + ' ponto por €1,00 finalizado.</div><div>• 10 pontos = €1,00 de desconto.</div><div>• Mínimo de ' + cfg.minimumPointsToUse + ' pontos para resgatar.</div><div>• Limite de ' + cfg.maxDiscountPct + '% do subtotal por pedido.</div><div>• Resgate sempre manual.</div></div></section>' +
        '</div>' +
      '</div>';
  }

  // ── PROMOÇÕES ─────────────────────────────────────────────────────────────
  function _renderPromos() {
    Promise.all([
      _safeGetAll('promotions'),
      _safeGetAll('promocoes'),
      _loadMarketingProducts(),
      _safeGetDocRoot('config', 'dinheiro')
    ]).then(function (r) {
      var promosA = Array.isArray(r[0]) ? r[0] : [];
      var promosB = Array.isArray(r[1]) ? r[1] : [];
      _products = Array.isArray(r[2]) ? r[2] : [];
      _promos = _mergePromoLists([promosA, promosB], _products.map(function (product, idx) {
        return _derivePromoFromProduct(product, idx);
      }));
      _moneyConfig = _normalizeMoneyConfig(r[3] || {});
      _orders = [];
      try {
        _paintPromos();
      } catch (paintErr) {
        console.error('[Marketing] _paintPromos failed', paintErr);
        var content = document.getElementById('marketing-content');
        if (content) {
          content.innerHTML = '<div style="background:#fff;border:1px solid #F2EDED;border-radius:14px;padding:16px;color:#C4362A;font-size:13px;">Erro ao renderizar promoções. Verifique a base de dados no console.</div>';
        }
      }
      _safeGetAll('orders').then(function (orders) {
        _orders = orders || [];
        try { _paintPromos(); } catch (e) { console.error('[Marketing] repaint promos after orders failed', e); }
      });
    }).catch(function (err) {
      console.error('[Marketing] _renderPromos failed', err);
      _promos = [];
      _products = [];
      _orders = [];
      _moneyConfig = _normalizeMoneyConfig({});
      _paintPromos();
    });
  }

  function _paintPromos() {
    var content = document.getElementById('marketing-content');
    if (!content) return;
    var filtered = _promoFilteredList();
    var summary = _promoSummary(_promos);
    content.innerHTML =
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px;">' +
        '<div><h2 style="font-size:20px;font-weight:800;margin-bottom:4px;">Promoções (' + _promos.length + ')</h2><p style="font-size:12px;color:#8A7E7C;">Crie, acompanhe e ajuste ofertas sem perder a margem.</p></div>' +
        '<button onclick="Modules.Marketing._openPromoModal(null, \'edit\')" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">' + _subActionLabel() + '</button>' +
      '</div>' +
      _promoSummaryHtml(summary) +
      _promoToolbarHtml() +
      (filtered.length === 0 ? _promoEmptyStateHtml() :
        '<div style="display:flex;flex-direction:column;gap:10px;">' +
        filtered.map(function (p) { return _promoCardHTML(p); }).join('') + '</div>');
  }

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m];
    });
  }

  function _promoTypeInfo(type) {
    var t = _normalizePromoType(type);
    var base = PROMO_TYPES.find(function (x) { return x.key === t; }) || PROMO_TYPE_FALLBACKS[type];
    if (base) return base;
    return { key: t || 'pct', label: 'Promoção', hint: 'Oferta ativa', icon: '•' };
  }

  function _normalizePromoType(type) {
    if (type === 'pct' || type === 'eur' || type === '2x1' || type === 'add1' || type === 'frete') return type;
    if (type === 'fixed' || type === 'oferta_dia' || type === 'preco_fixo' || type === 'price_fixed') return 'fixed';
    if (type === 'desconto_percentual' || type === 'percentual' || type === 'percent') return 'pct';
    if (type === 'desconto_valor' || type === 'valor_fixo' || type === 'valor' || type === 'fixed_discount') return 'eur';
    if (type === 'leve_mais' || type === 'promo_leve_mais' || type === 'combo_extra' || type === 'combo_sugerido') return 'add1';
    if (type === 'extra_combo' || type === 'upgrade') return 'add1';
    if (type === 'pack') return '2x1';
    if (type === 'frete_gratis' || type === 'free_shipping' || type === 'shipping_free') return 'frete';
    return 'pct';
  }

  function _promoLegacyPct(promo) {
    if (!promo) return 0;
    return _promoNumber(
      promo.discountPct != null ? promo.discountPct :
      promo.pctValue != null ? promo.pctValue :
      promo.valuePercentual != null ? promo.valuePercentual :
      (promo.type === 'pct' && promo.value != null ? promo.value : 0)
    );
  }

  function _promoLegacyEur(promo) {
    if (!promo) return 0;
    return _promoNumber(
      promo.valueDesconto != null ? promo.valueDesconto :
      promo.eurValue != null ? promo.eurValue :
      (promo.type === 'eur' && promo.value != null ? promo.value : 0)
    );
  }

  function _promoLegacyFixedPrice(promo) {
    if (!promo) return 0;
    return _promoNumber(
      promo.fixedPrice != null ? promo.fixedPrice :
      promo.finalPrice != null ? promo.finalPrice :
      promo.offerPrice != null ? promo.offerPrice :
      promo.priceFixed != null ? promo.priceFixed : 0
    );
  }

  function _promoNumber(value) {
    var str = String(value == null ? '' : value).trim();
    if (!str) return 0;
    var cleaned = str.replace(/[^\d,.-]/g, '');
    if (!cleaned) return 0;
    var lastComma = cleaned.lastIndexOf(',');
    var lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
    var n = parseFloat(cleaned);
    return isFinite(n) ? n : 0;
  }

  function _promoBasePrice(product) {
    if (!product) return 0;
    var raw = product.price != null ? product.price :
      (product.salePrice != null ? product.salePrice :
      (product.valor != null ? product.valor :
      (product.preco != null ? product.preco :
      (product.precoVenda != null ? product.precoVenda :
      (product.sale_price != null ? product.sale_price : 0)))));
    return _promoNumber(raw);
  }

  function _promoSelectedProductIds() {
    return Array.prototype.slice.call(document.querySelectorAll('.prm-product-check:checked'))
      .map(function (input) { return String(input.dataset.productId || input.value || ''); })
      .filter(Boolean);
  }

  function _promoSelectedProducts() {
    var ids = _promoSelectedProductIds();
    if (!ids.length) return [];
    var set = {};
    ids.forEach(function (id) { set[id] = true; });
    return (_products || []).filter(function (prod) { return set[String(prod.id)]; });
  }

  function _promoState() {
    var type = _normalizePromoType(window._promoType || 'pct');
    var value = _promoNumber((document.getElementById('prm-value') || {}).value);
    var pctValue = _promoNumber((document.getElementById('prm-pct') || {}).value);
    var eurValue = _promoNumber((document.getElementById('prm-eur') || {}).value);
    var leveQtd = parseInt((document.getElementById('prm-leve') || {}).value, 10) || 0;
    var pagueQtd = parseInt((document.getElementById('prm-pague') || {}).value, 10) || 0;
    var minOrder = _promoNumber((document.getElementById('prm-min') || {}).value);
    var applyRadio = document.querySelector('input[name="prm-apply"]:checked');
    var applyTo = applyRadio ? applyRadio.value : 'all';
    var selectedProducts = _promoSelectedProducts();
    var reference = null;
    if (applyTo === 'selected') {
      reference = selectedProducts[0] || null;
    } else if (window._promoBase && window._promoBase.productId) {
      reference = (_products || []).find(function (p) { return String(p.id) === String(window._promoBase.productId); }) || null;
    }
    if (!reference && applyTo !== 'selected') reference = (_products || [])[0] || null;
    var basePrice = _promoBasePrice(reference);
    var newPrice = basePrice;
    var discount = 0;
    if (type === 'pct') {
      value = pctValue;
      discount = basePrice * (value / 100);
      newPrice = Math.max(basePrice - discount, 0);
    } else if (type === 'eur') {
      value = eurValue;
      discount = value;
      newPrice = Math.max(basePrice - value, 0);
    } else if (type === '2x1') {
      discount = basePrice / 2;
      newPrice = basePrice > 0 ? basePrice / 2 : 0;
    } else if (type === 'add1') {
      discount = leveQtd > pagueQtd && basePrice > 0 ? basePrice * ((leveQtd - pagueQtd) / leveQtd) : 0;
      newPrice = Math.max(basePrice - discount, 0);
    } else if (type === 'frete') {
      discount = 0;
      newPrice = basePrice;
    }
    return {
      type: type,
      info: _promoTypeInfo(type),
      value: value,
      pctValue: pctValue,
      eurValue: eurValue,
      leveQtd: leveQtd,
      pagueQtd: pagueQtd,
      minOrder: minOrder,
      applyTo: applyTo,
      selectedProducts: selectedProducts,
      reference: reference,
      basePrice: basePrice,
      newPrice: newPrice,
      discount: discount
    };
  }

  function _promoPreviewHtml(state) {
    if (state.type === 'frete') {
      var minText = state.minOrder > 0 ? 'Frete grátis a partir de ' + UI.fmt(state.minOrder) : 'Frete grátis';
      return '<div style="background:#fff;border:1px solid #F2E1DE;border-radius:16px;padding:14px;box-shadow:0 2px 10px rgba(0,0,0,.04);">' +
        '<div style="display:flex;gap:12px;align-items:flex-start;">' +
          '<div style="width:74px;height:74px;border-radius:14px;background:#F2EDED;overflow:hidden;flex:0 0 auto;display:flex;align-items:center;justify-content:center;color:#8A7E7C;font-size:11px;font-weight:800;">🚚</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">' +
              '<span style="font-size:10px;font-weight:800;padding:4px 8px;border-radius:999px;background:#FFF0EE;color:#C4362A;">🔥 Oferta</span>' +
              '<span style="font-size:10px;font-weight:800;padding:4px 8px;border-radius:999px;background:#F2EDED;color:#8A7E7C;">Frete grátis</span>' +
              (window._promoActive !== false ? '<span style="font-size:10px;font-weight:800;padding:4px 8px;border-radius:999px;background:#EDFAF3;color:#1A9E5A;">Ativa</span>' : '<span style="font-size:10px;font-weight:800;padding:4px 8px;border-radius:999px;background:#F2EDED;color:#8A7E7C;">Inativa</span>') +
            '</div>' +
            '<div style="font-size:16px;font-weight:800;line-height:1.25;color:#1A1A1A;">Frete grátis</div>' +
            '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;line-height:1.45;">O frete fica grátis quando o pedido atinge o valor mínimo configurado.</div>' +
          '</div>' +
        '</div>' +
        '<div style="margin-top:12px;display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;">' +
          '<div style="font-size:13px;color:#8A7E7C;text-decoration:line-through;">' + (state.minOrder > 0 ? UI.fmt(state.minOrder) : '—') + '</div>' +
          '<div style="font-size:28px;font-weight:900;line-height:1;color:#C4362A;">€0,00</div>' +
          '<div style="font-size:12px;color:#8A7E7C;">Frete zerado no pedido</div>' +
        '</div>' +
        (state.minOrder > 0 ? '<div style="margin-top:8px;font-size:11px;color:#8A7E7C;">Pedido mínimo: ' + UI.fmt(state.minOrder) + '</div>' : '') +
      '</div>';
    }
    if (!state.reference) {
      return '<div style="background:#fff;border:1px dashed #E4D7D4;border-radius:14px;padding:14px;color:#8A7E7C;font-size:13px;line-height:1.5;">' +
        (state.applyTo === 'selected' ? 'Selecione um produto para ver o preview.' : 'Escolha um produto para calcular a promoção.') +
        '</div>';
    }

    var ref = state.reference;
    var name = ref.name || ref.title || 'Produto';
    var img = ref.imageBase64 || ref.imageUrl || ref.image || ref.picture || '';
    var kindLabel = state.type === 'pct'
      ? (state.value + '% OFF')
      : state.type === 'eur'
        ? (UI.fmt(state.value) + ' de desconto')
        : state.type === '2x1'
          ? ('Leve 2, pague 1')
          : ('Leve ' + (state.leveQtd || 0) + ', pague ' + (state.pagueQtd || 0));
    var offerLabel = '🔥 Oferta';
    var priceText = UI.fmt(state.newPrice || 0);
    var originalText = UI.fmt(state.basePrice || 0);

    return '<div style="background:#fff;border:1px solid #F2E1DE;border-radius:16px;padding:14px;box-shadow:0 2px 10px rgba(0,0,0,.04);">' +
      '<div style="display:flex;gap:12px;align-items:flex-start;">' +
        '<div style="width:74px;height:74px;border-radius:14px;background:#F2EDED;overflow:hidden;flex:0 0 auto;display:flex;align-items:center;justify-content:center;color:#8A7E7C;font-size:11px;font-weight:800;">' +
          (img ? '<img src="' + _esc(img) + '" alt="" style="width:100%;height:100%;object-fit:cover;">' : 'Sem imagem') +
        '</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">' +
            '<span style="font-size:10px;font-weight:800;padding:4px 8px;border-radius:999px;background:#FFF0EE;color:#C4362A;">' + offerLabel + '</span>' +
            '<span style="font-size:10px;font-weight:800;padding:4px 8px;border-radius:999px;background:#F2EDED;color:#8A7E7C;">' + (state.applyTo === 'selected' ? 'Selecionados' : 'Todos') + '</span>' +
            (window._promoActive !== false ? '<span style="font-size:10px;font-weight:800;padding:4px 8px;border-radius:999px;background:#EDFAF3;color:#1A9E5A;">Ativa</span>' : '<span style="font-size:10px;font-weight:800;padding:4px 8px;border-radius:999px;background:#F2EDED;color:#8A7E7C;">Inativa</span>') +
          '</div>' +
          '<div style="font-size:16px;font-weight:800;line-height:1.25;color:#1A1A1A;">' + _esc(name) + '</div>' +
          '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;line-height:1.45;">' + _esc(state.info.hint) + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="margin-top:12px;display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;">' +
        '<div style="font-size:13px;color:#8A7E7C;text-decoration:line-through;">' + originalText + '</div>' +
        '<div style="font-size:28px;font-weight:900;line-height:1;color:#C4362A;">' + priceText + '</div>' +
        '<div style="font-size:12px;color:#8A7E7C;">' + kindLabel + '</div>' +
      '</div>' +
      (state.minOrder > 0 ? '<div style="margin-top:8px;font-size:11px;color:#8A7E7C;">Pedido mínimo: ' + UI.fmt(state.minOrder) + '</div>' : '') +
    '</div>';
  }

  function _promoCostForProduct(product) {
    if (!product) return 0;
    var raw = _marketingCostRaw(product);
    return _promoNumber(raw);
  }

  function _promoDiscountForProduct(product, state) {
    var base = _promoBasePrice(product);
    if (!(base > 0)) return { original: 0, final: 0, discount: 0, unitText: '' };
    var final = base;
    var discount = 0;

    if (state.type === 'pct') {
      discount = base * ((_promoNumber(state.pctValue != null ? state.pctValue : state.value) || 0) / 100);
      final = Math.max(base - discount, 0);
    } else if (state.type === 'eur') {
      discount = _promoNumber(state.eurValue != null ? state.eurValue : state.value) || 0;
      final = Math.max(base - discount, 0);
    } else if (state.type === 'fixed') {
      final = Math.max(Math.min(_promoNumber(state.fixedPrice != null ? state.fixedPrice : state.value) || base, base), 0);
      discount = Math.max(base - final, 0);
    } else if (state.type === '2x1') {
      final = base / 2;
      discount = base - final;
    } else if (state.type === 'add1') {
      var leve = parseInt(state.leveQtd || 0, 10) || 0;
      var pague = parseInt(state.pagueQtd || 0, 10) || 0;
      if (leve > 0 && pague > leve) {
        final = base * (pague / leve);
        discount = base - final;
      }
    }

    return {
      original: base,
      final: final,
      discount: discount,
      cost: _promoCostForProduct(product),
      margin: _promoCostForProduct(product) > 0 ? final - _promoCostForProduct(product) : null
    };
  }

  function _promoTargetProducts(state) {
    if (state.applyTo === 'selected') return state.selectedProducts || [];
    return (_products || []).slice(0, 3);
  }

  function _promoItemImpactHtml(product, state) {
    var calc = _promoDiscountForProduct(product, state);
    var name = product.name || product.title || 'Produto';
    if (!(calc.original > 0)) {
      return '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;">' +
        '<div style="font-size:13px;font-weight:800;color:#1A1A1A;">' + _esc(name) + '</div>' +
        '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">Sem preço definido para calcular o impacto.</div>' +
      '</div>';
    }

    if (state.type === 'frete') {
      return '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;">' +
        '<div style="font-size:13px;font-weight:800;color:#1A1A1A;">' + _esc(name) + '</div>' +
        '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">Frete grátis quando o pedido atingir o valor mínimo configurado.</div>' +
        (state.minOrder > 0 ? '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">Pedido mínimo: ' + UI.fmt(state.minOrder) + '</div>' : '') +
      '</div>';
    }

    var priceLine = UI.fmt(calc.original) + ' → ' + UI.fmt(calc.final);
    var discountLine = calc.discount > 0 ? 'Desconto: ' + UI.fmt(calc.discount) : 'Sem desconto aplicado';
    var marginLine = calc.margin != null
      ? 'Margem estimada: ' + UI.fmt(calc.margin)
      : '';

    if (state.type === '2x1') {
      return '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;">' +
        '<div style="font-size:13px;font-weight:800;color:#1A1A1A;">' + _esc(name) + '</div>' +
        '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">' + priceLine + '</div>' +
        '<div style="font-size:12px;color:#C4362A;font-weight:700;margin-top:4px;">Cliente leva 2 e paga 1</div>' +
        (marginLine ? '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">' + marginLine + '</div>' : '') +
      '</div>';
    }

    if (state.type === 'add1') {
      return '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;">' +
        '<div style="font-size:13px;font-weight:800;color:#1A1A1A;">' + _esc(name) + '</div>' +
        '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">' + priceLine + '</div>' +
        '<div style="font-size:12px;color:#C4362A;font-weight:700;margin-top:4px;">Leve ' + (state.leveQtd || 0) + ', pague ' + (state.pagueQtd || 0) + '</div>' +
        (marginLine ? '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">' + marginLine + '</div>' : '') +
      '</div>';
    }

    return '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;">' +
      '<div style="font-size:13px;font-weight:800;color:#1A1A1A;">' + _esc(name) + '</div>' +
      '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">Preço: ' + priceLine + '</div>' +
      '<div style="font-size:12px;color:#C4362A;font-weight:700;margin-top:4px;">' + discountLine + '</div>' +
      (marginLine ? '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">' + marginLine + '</div>' : '') +
    '</div>';
  }

  function _promoImpactHtml(state) {
    var targets = _promoTargetProducts(state);
    if (!targets.length) {
      return '<div style="color:#8A7E7C;font-size:13px;line-height:1.5;">Selecione um produto para calcular o impacto.</div>';
    }
    var header = state.applyTo === 'selected'
      ? 'Impacto por produto selecionado'
      : 'Impacto estimado nos principais produtos';
    return '<div style="display:flex;flex-direction:column;gap:10px;">' +
      '<div style="font-size:12px;color:#8A7E7C;margin-bottom:2px;">' + header + '</div>' +
      targets.map(function (product) {
        return _promoItemImpactHtml(product, state);
      }).join('') +
    '</div>';
  }

  function _refreshPromoPreview() {
    var panel = document.getElementById('prm-products-panel');
    var applyRadio = document.querySelector('input[name="prm-apply"]:checked');
    var applyTo = applyRadio ? applyRadio.value : 'all';
    if (panel) panel.style.display = applyTo === 'selected' ? 'block' : 'none';

    var state = _promoState();
    var preview = document.getElementById('prm-preview');
    var impact = document.getElementById('prm-impact');
    var count = document.getElementById('prm-products-count');
    if (count) count.textContent = _promoSelectedProductIds().length + ' produtos selecionados';
    _renderPromoOfferFields();
    if (preview) preview.innerHTML = _promoPreviewHtml(state);
    if (impact) impact.innerHTML = _promoImpactHtml(state);
  }

  function _filterPromoProducts() {
    var search = ((document.getElementById('prm-product-search') || {}).value || '').trim().toLowerCase();
    var rows = document.querySelectorAll('#prm-product-list label');
    Array.prototype.forEach.call(rows, function (row) {
      var text = String(row.dataset.productName || row.textContent || '').toLowerCase();
      row.style.display = !search || text.indexOf(search) !== -1 ? 'flex' : 'none';
    });
  }

  function _renderPromoOfferFields() {
    var host = document.getElementById('prm-offer-fields');
    if (!host) return;
    var type = _normalizePromoType(window._promoType || 'pct');
    var base = window._promoBase || {};
    var pctEl = document.getElementById('prm-pct');
    var eurEl = document.getElementById('prm-eur');
    var leveEl = document.getElementById('prm-leve');
    var pagueEl = document.getElementById('prm-pague');
    var pctValue = pctEl ? pctEl.value : (base.valuePercentual != null ? base.valuePercentual : (type === 'pct' ? (base.value || '') : ''));
    var eurValue = eurEl ? eurEl.value : (base.valueDesconto != null ? base.valueDesconto : (type === 'eur' ? (base.value || '') : ''));
    var leveQtd = leveEl ? leveEl.value : (base.leveQtd != null ? base.leveQtd : '');
    var pagueQtd = pagueEl ? pagueEl.value : (base.pagueQtd != null ? base.pagueQtd : '');

    if (type === 'pct') {
      host.innerHTML = '<div style="display:grid;grid-template-columns:1fr auto;gap:12px;align-items:end;">' +
        '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Percentual de desconto</label>' +
        '<input id="prm-pct" type="number" step="0.01" value="' + (pctValue || '') + '" placeholder="Ex: 10" oninput="Modules.Marketing._refreshPromoPreview()" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;">' +
        '</div><div style="padding:10px 12px;border-radius:10px;background:#F2EDED;font-size:13px;font-weight:800;color:#8A7E7C;">%</div></div>';
      return;
    }

    if (type === 'eur') {
      host.innerHTML = '<div style="display:grid;grid-template-columns:1fr auto;gap:12px;align-items:end;">' +
        '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Valor do desconto</label>' +
        '<input id="prm-eur" type="text" inputmode="decimal" value="' + (eurValue || '') + '" placeholder="Ex: 2,00" oninput="Modules.Marketing._refreshPromoPreview()" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;">' +
        '</div><div style="padding:10px 12px;border-radius:10px;background:#F2EDED;font-size:13px;font-weight:800;color:#8A7E7C;">€</div></div>';
      return;
    }

    if (type === '2x1') {
      host.innerHTML = '<div style="background:#FFF8F7;border:1px solid #F2E1DE;border-radius:12px;padding:12px 14px;color:#1A1A1A;font-size:13px;line-height:1.5;">O cliente compra 2 unidades e paga 1.</div>' +
        '<div style="margin-top:10px;font-size:12px;color:#8A7E7C;">Exija produto aplicado para definir onde a oferta vale.</div>';
      return;
    }

    if (type === 'add1') {
      host.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
        '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Leve</label>' +
        '<input id="prm-leve" type="number" min="2" step="1" value="' + (leveQtd || '') + '" placeholder="Ex: 3" oninput="Modules.Marketing._refreshPromoPreview()" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;">' +
        '</div><div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Pague</label>' +
        '<input id="prm-pague" type="number" min="0" step="1" value="' + (pagueQtd || '') + '" placeholder="Ex: 2" oninput="Modules.Marketing._refreshPromoPreview()" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;">' +
        '</div></div>' +
        '<div style="margin-top:10px;background:#FFF8F7;border:1px solid #F2E1DE;border-radius:12px;padding:12px 14px;color:#1A1A1A;font-size:13px;line-height:1.5;">Exemplo: Leve 3, pague 2.</div>';
      return;
    }

    if (type === 'frete') {
      host.innerHTML = '<div style="display:grid;grid-template-columns:1fr auto;gap:12px;align-items:end;">' +
        '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Valor mínimo para frete grátis</label>' +
        '<input id="prm-min" type="number" step="0.01" value="' + (base.minOrder || '') + '" placeholder="Ex: 20,00" oninput="Modules.Marketing._refreshPromoPreview()" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;">' +
        '</div><div style="padding:10px 12px;border-radius:10px;background:#F2EDED;font-size:13px;font-weight:800;color:#8A7E7C;">🚚</div></div>' +
        '<div style="margin-top:10px;background:#FFF8F7;border:1px solid #F2E1DE;border-radius:12px;padding:12px 14px;color:#1A1A1A;font-size:13px;line-height:1.5;">O frete fica grátis quando o pedido atingir este valor.</div>';
      return;
    }

    host.innerHTML = '';
  }

  function _openPromoModal(id, mode) {
    _editingId = id;
    var promo = id ? (_promos.find(function (x) { return String(x.id) === String(id); }) || {}) : { type: 'pct', active: true };
    var editMode = mode === 'edit' || (!id && mode !== 'view');
    var title = editMode ? (id ? 'Editar promoção' : 'Criar promoção para vender mais rápido') : 'Resumo da promoção';
    var body = editMode ? _promoEditModalHtml(promo) : _promoViewModalHtml(promo);
    var footer = editMode
      ? '<div style="display:flex;gap:10px;flex-wrap:wrap;"><button onclick="Modules.Marketing._savePromo()" style="flex:1;min-width:180px;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Salvar alterações</button><button onclick="if(window._promoModal)window._promoModal.close()" style="flex:1;min-width:120px;padding:13px;border-radius:11px;border:1.5px solid #D4C8C6;background:#fff;color:#1A1A1A;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Cancelar</button><button onclick="Modules.Marketing._deletePromo(\'' + (id || '') + '\')" style="flex:1;min-width:120px;padding:13px;border-radius:11px;border:none;background:#FFF0EE;color:#C4362A;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Excluir promoção</button></div>'
      : '<div style="display:flex;gap:10px;flex-wrap:wrap;"><button onclick="Modules.Marketing._openPromoModal(\'' + (id || '') + '\', \'edit\')" style="flex:1;min-width:140px;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Editar</button><button onclick="Modules.Marketing._duplicatePromo(\'' + (id || '') + '\')" style="flex:1;min-width:120px;padding:13px;border-radius:11px;border:1.5px solid #D4C8C6;background:#fff;color:#1A1A1A;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Duplicar</button><button onclick="Modules.Marketing._togglePromoStatus(\'' + (id || '') + '\')" style="flex:1;min-width:120px;padding:13px;border-radius:11px;border:none;background:' + (promo.active !== false ? '#FFF8E8' : '#EDFAF3') + ';color:' + (promo.active !== false ? '#D97706' : '#1A9E5A') + ';font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">' + (promo.active !== false ? 'Pausar' : 'Ativar') + '</button><button onclick="if(window._promoModal)window._promoModal.close()" style="flex:1;min-width:120px;padding:13px;border-radius:11px;border:1.5px solid #D4C8C6;background:#fff;color:#1A1A1A;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Fechar</button></div>';

    if (window._promoModal) window._promoModal.close();
    window._promoType = _normalizePromoType(promo.type || 'pct');
    window._promoActive = promo.active !== false;
    window._promoBase = promo;
    window._promoModal = UI.modal({ title: title, body: body, footer: footer });
    if (editMode) {
      _renderPromoOfferFields();
      setTimeout(function () { _refreshPromoPreview(); }, 80);
    }
  }

  function _selectPromoType(type) {
    window._promoType = _normalizePromoType(type);
    document.querySelectorAll('[data-ptype]').forEach(function (btn) {
      var active = btn.dataset.ptype === window._promoType;
      btn.style.borderColor = active ? '#C4362A' : '#D4C8C6';
      btn.style.background = active ? '#FFF0EE' : '#fff';
      btn.style.color = active ? '#C4362A' : '#8A7E7C';
    });
    document.querySelectorAll('[data-promo-icon]').forEach(function (icon) {
      var active = icon.dataset.promoIcon === window._promoType;
      icon.className = active ? 'icon-active' : 'icon-inactive';
    });
    _renderPromoOfferFields();
    _refreshPromoPreview();
  }

  function _togglePromoActive() {
    window._promoActive = !window._promoActive;
    var btn = document.getElementById('prm-active-toggle');
    if (btn) {
      btn.style.background = window._promoActive ? '#C4362A' : '#D4C8C6';
      var span = btn.querySelector('span');
      if (span) span.style.transform = 'translateX(' + (window._promoActive ? '18px' : '0') + ')';
    }
    _refreshPromoPreview();
  }

  function _togglePromoStatus(id) {
    var p = (_promos || []).find(function (x) { return String(x.id) === String(id); });
    if (!p) return;
    var nextActive = p.active === false;
    var data = { active: nextActive };
    if (nextActive) {
      var endTs = _promoEndTs(p);
      if (endTs && endTs < Date.now()) data.endDate = '';
    }
    DB.update('promotions', id, data).then(function () {
      _renderPromos();
      if (Modules.Catalogo && typeof Modules.Catalogo._refreshProductPromotions === 'function') Modules.Catalogo._refreshProductPromotions();
    });
  }

  function _duplicatePromo(id) {
    var p = (_promos || []).find(function (x) { return String(x.id) === String(id); });
    if (!p) return;
    var copy = {};
    Object.keys(p).forEach(function (key) {
      if (key === 'id' || key === 'createdAt' || key === 'updatedAt') return;
      copy[key] = p[key];
    });
    copy.name = (p.name || 'Promoção') + ' (cópia)';
    copy.active = false;
    copy.startDate = '';
    copy.endDate = '';
    copy.applyTo = p.applyTo || 'all';
    copy.scope = p.scope || (copy.applyTo === 'selected' ? 'produtos_selecionados' : 'todos_produtos');
    copy.rulesText = p.rulesText || p.rules || '';
    copy.autoTags = _promoAutoTags(copy).map(function (t) { return t.key; });
    DB.add('promotions', copy).then(function () {
      UI.toast('Promoção duplicada', 'success');
      _renderPromos();
      if (Modules.Catalogo && typeof Modules.Catalogo._refreshProductPromotions === 'function') Modules.Catalogo._refreshProductPromotions();
    });
  }

  function _savePromo() {
    var name = (document.getElementById('prm-name') || {}).value || '';
    if (!name) { UI.toast('Nome é obrigatório', 'error'); return; }
    var type = _normalizePromoType(window._promoType || 'pct');
    var applyEl = document.querySelector('input[name="prm-apply"]:checked');
    var applyTo = applyEl ? applyEl.value : 'all';
    var productIds = applyTo === 'selected' ? _promoSelectedProductIds() : [];
    if (applyTo === 'selected' && productIds.length === 0) {
      UI.toast('Selecione ao menos um produto', 'error');
      return;
    }
    var pctValue = _promoNumber((document.getElementById('prm-pct') || {}).value);
    var eurValue = _promoNumber((document.getElementById('prm-eur') || {}).value);
    var leveQtd = parseInt((document.getElementById('prm-leve') || {}).value, 10) || 0;
    var pagueQtd = parseInt((document.getElementById('prm-pague') || {}).value, 10) || 0;
    var startDate = (document.getElementById('prm-start') || {}).value || '';
    var endDate = (document.getElementById('prm-end') || {}).value || '';
    var todayIso = new Date().toISOString().slice(0, 10);
    if (type === 'pct' && !(pctValue > 0)) { UI.toast('Informe o percentual de desconto', 'error'); return; }
    if (type === 'eur' && !(eurValue > 0)) { UI.toast('Informe o valor do desconto', 'error'); return; }
    if (type === 'add1' && !(leveQtd > 0 && leveQtd > pagueQtd)) { UI.toast('Leve deve ser maior que pague', 'error'); return; }
    if (type === 'frete' && !(parseFloat((document.getElementById('prm-min') || {}).value) > 0)) { UI.toast('Informe o valor mínimo para frete grátis', 'error'); return; }
    if (startDate && startDate < todayIso) { UI.toast('A data de início não pode ser anterior a hoje.', 'error'); return; }
    if (endDate && endDate < todayIso) { UI.toast('A data de fim não pode ser anterior a hoje.', 'error'); return; }
    if (startDate && endDate && endDate < startDate) { UI.toast('A data de fim deve ser igual ou posterior à data de início.', 'error'); return; }
    var product = productIds.length ? _products.find(function (p) { return String(p.id) === String(productIds[0]); }) : null;
    var minOrder = parseFloat((document.getElementById('prm-min') || {}).value) || 0;
    var data = {
      name: name,
      type: type,
      value: type === 'pct' ? pctValue : type === 'eur' ? eurValue : (type === 'add1' ? leveQtd : (type === 'frete' ? minOrder : 0)),
      valuePercentual: type === 'pct' ? pctValue : 0,
      valueDesconto: type === 'eur' ? eurValue : 0,
      leveQtd: type === 'add1' ? leveQtd : 0,
      pagueQtd: type === 'add1' ? pagueQtd : 0,
      minOrder: minOrder,
      startDate: startDate,
      endDate: endDate,
      scope: applyTo === 'selected' ? 'produtos_selecionados' : 'todos_produtos',
      applyTo: applyTo,
      productIds: productIds,
      productId: product ? product.id : '',
      productName: product ? product.name : '',
      rulesText: (document.getElementById('prm-rules') || {}).value || '',
      autoTags: _promoAutoTags({ type: type }).map(function (t) { return t.key; }),
      active: window._promoActive !== false
    };
    var op = _editingId ? DB.update('promotions', _editingId, data) : DB.add('promotions', data);
    op.then(function () {
      UI.toast('Promoção salva!', 'success');
      if (window._promoModal) window._promoModal.close();
      _renderPromos();
      if (Modules.Catalogo && typeof Modules.Catalogo._refreshProductPromotions === 'function') Modules.Catalogo._refreshProductPromotions();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _togglePromo(id) {
    _togglePromoStatus(id);
  }

  function _deletePromo(id) {
    UI.confirm('Eliminar esta promoção?').then(function (yes) {
      if (!yes) return;
      DB.remove('promotions', id).then(function () {
        UI.toast('Eliminado', 'info');
        _renderPromos();
        if (Modules.Catalogo && typeof Modules.Catalogo._refreshProductPromotions === 'function') Modules.Catalogo._refreshProductPromotions();
      });
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
      '<button onclick="Modules.Marketing._openCuponModal(null)" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">' + _subActionLabel() + '</button>' +
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
  function _upsellTypeInfo(type) {
    var t = String(type || '').toLowerCase();
    var map = {
      complemento: {
        key: 'complemento',
        label: 'Complemento',
        tag: 'upsell_complemento',
        tone: '#1A9E5A',
        desc: 'Sugere um produto complementar quando o cliente escolhe determinado produto.',
        example: 'Coxinha → Guaraná.'
      },
      upgrade: {
        key: 'upgrade',
        label: 'Upgrade',
        tag: 'upsell_upgrade',
        tone: '#3B82F6',
        desc: 'Sugere uma versão maior, melhor ou mais completa do produto.',
        example: 'Coxinha normal → Coxinha XL.'
      },
      combo_sugerido: {
        key: 'combo_sugerido',
        label: 'Combo sugerido',
        tag: 'upsell_combo_sugerido',
        tone: '#C4362A',
        desc: 'Sugere montar uma combinação com outros produtos.',
        example: 'Adicionar bebida + sobremesa.'
      },
      carrinho: {
        key: 'carrinho',
        label: 'Carrinho',
        tag: 'upsell_carrinho',
        tone: '#D97706',
        desc: 'Sugere produtos adicionais quando o cliente está no carrinho.',
        example: 'Sugerir sobremesa antes de finalizar.'
      },
      valor_minimo: {
        key: 'valor_minimo',
        label: 'Completar valor mínimo',
        tag: 'upsell_valor_minimo',
        tone: '#8A7E7C',
        desc: 'Sugere produtos para o cliente alcançar um valor mínimo configurado.',
        example: 'Faltan 3,50 € para completar tu pedido.'
      }
    };
    return map[t] || map.complemento;
  }

  function _upsellBenefitInfo(type) {
    var t = String(type || '').toLowerCase();
    var map = {
      none: {
        key: 'none',
        label: 'Sem benefício',
        desc: 'Sem incentivo para o cliente.',
        example: 'También te puede gustar',
        tag: 'upsell_sem_beneficio'
      },
      special_price: {
        key: 'special_price',
        label: 'Preço especial (legado)',
        desc: 'Regra antiga. Revise e converta para um benefício compatível.',
        example: 'Versão antiga que precisa de revisão',
        tag: 'upsell_preco_especial'
      },
      pct: {
        key: 'pct',
        label: 'Desconto em %',
        desc: 'Aplica desconto percentual no produto sugerido.',
        example: 'Añade brigadeiro con 20% de descuento',
        tag: 'upsell_desconto_pct'
      },
      eur: {
        key: 'eur',
        label: 'Desconto em €',
        desc: 'Aplica desconto fixo no produto sugerido.',
        example: 'Añade una bebida y ahorra 0,50 €',
        tag: 'upsell_desconto_valor'
      },
      combo_fixed: {
        key: 'combo_fixed',
        label: 'Combo com preço fechado',
        desc: 'Aplica preço fechado ao conjunto.',
        example: 'Coxinha + Guaraná por 6,90 €',
        tag: 'upsell_combo_fechado'
      },
      bundle_less_pay_more: {
        key: 'bundle_less_pay_more',
        label: 'Leve mais pagando menos',
        desc: 'Sugere mais unidades com preço melhor.',
        example: 'Añade 2 unidades más por solo 3,00 €',
        tag: 'upsell_leve_mais_paga_menos'
      },
      gift: {
        key: 'gift',
        label: 'Brinde condicionado',
        desc: 'Entrega um brinde quando a condição for atendida.',
        example: 'Añade una bebida y llévate un brigadeiro gratis',
        tag: 'upsell_brinde_condicionado'
      },
      cart_goal: {
        key: 'cart_goal',
        label: 'Completar valor para ganhar benefício',
        desc: 'Incentiva completar o carrinho para liberar um benefício.',
        example: 'Faltan 3,50 € para ganar entrega gratis',
        tag: 'upsell_completar_valor'
      },
      frete: {
        key: 'frete',
        label: 'Frete grátis',
        desc: 'Entrega grátis ao atingir o valor mínimo configurado.',
        example: 'Faltan 3,50 € para ganar entrega gratis',
        tag: 'upsell_frete_gratis'
      }
    };
    return map[t] || map.none;
  }

  function _upsellLocationInfo() {
    return [
      { key: 'popup', label: 'Popup do produto' },
      { key: 'detail', label: 'Modal do produto' },
      { key: 'cart', label: 'Carrinho' }
    ];
  }

  function _upsellLocationKey(value) {
    var v = String(value || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!v) return '';
    if (v === 'detail' || v === 'product' || v === 'produto' || v === 'modaldoproduto' || v === 'modal') return 'detail';
    if (v === 'popup' || v === 'pop-up' || v === 'popupdoproduto') return 'popup';
    if (v === 'cart' || v === 'carrinho' || v === 'basket' || v === 'bag') return 'cart';
    if (v === 'checkout' || v === 'finalizar' || v === 'finalizacao' || v === 'finalização') return 'checkout';
    if (v === 'todos' || v === 'all') return 'all';
    return v;
  }

  function _upsellLocationsNormalize(list) {
    var seen = {};
    return (list || []).map(_upsellLocationKey).filter(function (v) {
      if (!v) return false;
      if (seen[v]) return false;
      seen[v] = true;
      return true;
    });
  }

  function _upsellLocationLabel(value) {
    var key = _upsellLocationKey(value);
    var info = _upsellLocationInfo().find(function (x) { return x.key === key; });
    return info ? info.label : String(value || '').trim() || '—';
  }

  function _upsellLocationLabels(list) {
    var labels = _upsellLocationsNormalize(list).map(_upsellLocationLabel).filter(Boolean);
    return labels.length ? labels.join(' · ') : 'Modal do produto · Carrinho';
  }

  function _upsellLocationChooserHtml(rule) {
    rule = _upsellRule(rule || {});
    var current = _upsellLocationsNormalize(rule.locations || []);
    return '<div style="grid-column:1 / -1;">' +
      '<div style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Locais de exibição</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;">' + _upsellLocationInfo().map(function (loc) {
        var checked = current.indexOf(loc.key) >= 0;
        return '<label style="display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:138px;min-height:42px;padding:9px 14px;border:1px solid ' + (checked ? '#C4362A' : '#EEE6E4') + ';border-radius:999px;background:' + (checked ? '#FFF0EE' : '#fff') + ';font-size:12px;font-weight:700;color:#1A1A1A;cursor:pointer;line-height:1.2;text-align:center;">' +
          '<input type="checkbox" class="ups-location-check" data-location="' + loc.key + '" ' + (checked ? 'checked' : '') + ' style="width:16px;height:16px;accent-color:#C4362A;">' +
          _esc(loc.label) +
        '</label>';
      }).join('') + '</div>' +
    '</div>';
  }

  function _openUpsellShell(opts) {
    opts = opts || {};
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:7000;display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;transition:opacity .22s ease;';
    var maxWidth = opts.maxWidth || '980px';
    var title = opts.title || '';
    var body = opts.body || '';
    var footer = opts.footer || '';
    overlay.innerHTML = '<div style="background:#fff;width:100%;max-width:' + maxWidth + ';max-height:calc(100vh - 32px);display:flex;flex-direction:column;overflow:hidden;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.3);transform:scale(.98);transition:transform .22s ease;">' +
      '<div style="flex:0 0 auto;padding:20px 24px 16px;border-bottom:1px solid #EEE6E4;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;background:#fff;">' +
        '<div style="min-width:0;">' +
          '<div style="font-family:\'League Spartan\',sans-serif;font-size:22px;font-weight:800;line-height:1.15;color:#1A1A1A;">' + _esc(title) + '</div>' +
          '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">' + _esc(opts.subtitle || '') + '</div>' +
        '</div>' +
        '<button class="ui-upsell-close" style="background:#F2EDED;border:none;border-radius:50%;width:34px;height:34px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">✕</button>' +
      '</div>' +
      '<div class="ui-upsell-scroll" style="flex:1 1 auto;overflow-y:auto;padding:20px 24px;background:#FAF8F8;">' + body + '</div>' +
      (footer ? '<div style="flex:0 0 auto;padding:16px 24px 20px;border-top:1px solid #EEE6E4;background:#fff;">' + footer + '</div>' : '') +
    '</div>';
    document.body.appendChild(overlay);

    var inner = overlay.firstElementChild;
    requestAnimationFrame(function () {
      overlay.style.opacity = '1';
      inner.style.transform = 'scale(1)';
    });

    function close() {
      overlay.style.opacity = '0';
      inner.style.transform = 'scale(.98)';
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 220);
    }

    overlay.querySelector('.ui-upsell-close').onclick = close;
    overlay.onclick = function (e) {
      if (e.target === overlay) close();
    };

    return { close: close, el: overlay };
  }

  function _upsellBenefitHelpText(key) {
    var texts = {
      none: 'Apenas uma recomendação simples, sem incentivo para o cliente.',
      special_price: 'Preço especial legado. Revise esta regra antes de ativar.',
      pct: 'Desconto percentual aplicado só nesta sugestão.',
      eur: 'Desconto fixo aplicado só nesta sugestão.',
      combo_fixed: 'Os produtos entram juntos com preço fechado.',
      bundle_less_pay_more: 'O cliente leva mais unidades por um valor melhor.',
      gift: 'O cliente recebe um brinde ao cumprir a condição.',
      cart_goal: 'O cliente recebe um incentivo ao atingir o valor mínimo.',
      frete: 'O pedido ganha frete grátis ao atingir o valor mínimo.'
    };
    return texts[key] || texts.none;
  }

  function _upsellBenefitOptionsForType(type) {
    var t = String(type || '').toLowerCase();
    if (t === 'complemento') return ['none', 'pct', 'eur', 'combo_fixed'];
    if (t === 'upgrade') return ['pct', 'eur', 'bundle_less_pay_more'];
    if (t === 'combo_sugerido') return ['combo_fixed', 'pct', 'eur', 'gift'];
    if (t === 'carrinho') return ['none', 'pct', 'eur', 'combo_fixed'];
    if (t === 'valor_minimo') return ['cart_goal', 'gift', 'eur', 'frete'];
    return [];
  }

  function _upsellBenefitAllowedForType(type, benefit) {
    var list = _upsellBenefitOptionsForType(type);
    return list.indexOf(String(benefit || '').toLowerCase()) >= 0;
  }

  function _upsellBenefitSelectorHtml(rule) {
    rule = _upsellRule(rule || {});
    var type = String(window._upsellType || rule.type || '').trim();
    var current = typeof window._upsellBenefit === 'string' ? String(window._upsellBenefit).trim() : String(rule.benefitType || '').trim();
    var allowed = _upsellBenefitOptionsForType(type);
    var legacyBenefit = rule.benefitType === 'special_price' || current === 'special_price';
    if (current === 'special_price' || (current && allowed.indexOf(current) < 0)) current = '';
    if (!type) {
      return '<div style="display:grid;grid-template-columns:minmax(0,1fr);gap:8px;">' +
        '<label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;">Benefício</label>' +
        '<input id="ups-benefit-type" type="hidden" value="">' +
        '<div style="font-size:12px;color:#8A7E7C;line-height:1.5;background:#F8F5F5;border:1px dashed #E4D7D4;border-radius:12px;padding:12px 14px;">Selecione primeiro o tipo de upsell.</div>' +
      '</div>';
    }
    return '<div style="display:flex;flex-direction:column;gap:10px;">' +
      '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;">Benefício</div>' +
      '<input id="ups-benefit-type" type="hidden" value="' + _esc(current) + '">' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;">' + allowed.map(function (b) {
        var bi = _upsellBenefitInfo(b);
        var active = bi.key === current;
        return '<button type="button" data-benefit-pick="1" data-benefit-key="' + bi.key + '" onclick="Modules.Marketing._pickUpsellBenefit(\'' + bi.key + '\', event)" style="padding:9px 12px;border-radius:999px;border:1.5px solid ' + (active ? '#C4362A' : '#EEE6E4') + ';background:' + (active ? '#FFF0EE' : '#fff') + ';color:' + (active ? '#C4362A' : '#1A1A1A') + ';font-size:12px;font-weight:800;font-family:inherit;cursor:pointer;">' + _esc(bi.label) + '</button>';
      }).join('') + '</div>' +
      (current ? '<div style="font-size:12px;color:#8A7E7C;line-height:1.5;">A aba selecionada define os campos abaixo.</div>' : '<div style="font-size:12px;color:#8A7E7C;line-height:1.5;background:#F8F5F5;border:1px dashed #E4D7D4;border-radius:12px;padding:12px 14px;">Escolha uma aba para configurar os campos da regra.</div>') +
      (legacyBenefit ? '<div style="font-size:12px;color:#8A7E7C;line-height:1.5;background:#FFF8E8;border:1px solid #F2D9A6;border-radius:12px;padding:12px 14px;">Regra legada detectada. Revise antes de ativar.</div>' : '') +
    '</div>';
  }

  function _upsellBenefitSectionHtml(rule) {
    return '<div style="display:flex;flex-direction:column;gap:12px;">' +
      _upsellBenefitSelectorHtml(rule) +
      '<div id="ups-benefit-fields">' + _upsellBenefitFieldsHtml(rule) + '</div>' +
    '</div>';
  }

  function _syncUpsellBenefitUI() {
    var type = String(window._upsellType || '').trim();
    var current = String(window._upsellBenefit || '').trim();
    var allowed = _upsellBenefitOptionsForType(type);
    if (current === 'special_price' || (current && allowed.indexOf(current) < 0)) current = '';
    var hidden = document.getElementById('ups-benefit-type');
    if (hidden) hidden.value = current;

    document.querySelectorAll('[data-benefit-pick]').forEach(function (btn) {
      var active = btn.dataset.benefitKey === current;
      btn.style.borderColor = active ? '#C4362A' : '#EEE6E4';
      btn.style.background = active ? '#FFF0EE' : '#fff';
      btn.style.color = active ? '#C4362A' : '#1A1A1A';
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    document.querySelectorAll('[data-ups-benefit-section]').forEach(function (section) {
      var key = section.getAttribute('data-ups-benefit-section') || '';
      section.style.display = current === key ? 'block' : 'none';
    });
  }

  function _upsellItemProductId(item) {
    return String(item && (item.id || item.productId || item.product_id || item.productID || item.product || item.suggestedProductId || item.sku || '') || '');
  }

  function _upsellOrderMatchesRule(order, rule) {
    var ids = _upsellRuleProducts(rule).map(function (p) { return String(p.id); }).filter(Boolean);
    if (!ids.length) return false;
    return _orderItems(order).some(function (item) {
      return ids.indexOf(_upsellItemProductId(item)) >= 0;
    });
  }

  function _upsellSalesStats(rule) {
    var perf = _upsellRulePerformance(rule);
    return {
      currentOrders: perf.conversoes,
      prevOrders: perf.prev.conversoes,
      currentRevenue: perf.receita,
      prevRevenue: perf.prev.revenue,
      currentItems: perf.adicionados,
      prevItems: perf.prev.carrinho,
      growth: perf.revenueDelta,
      clickRate: perf.clickRate,
      addRate: perf.addRate,
      convRate: perf.convRate,
      prevClickRate: perf.prevClickRate,
      prevAddRate: perf.prevAddRate,
      prevConvRate: perf.prevConvRate
    };
  }

  function _upsellSalesSummaryHtml(rule) {
    var sales = _upsellSalesStats(rule);
    var growth = sales.growth;
    var growthLabel = growth == null
      ? 'Sem base anterior'
      : (growth >= 0 ? '+' : '') + growth.toFixed(0) + '% vs. período anterior';
    var growthColor = growth == null ? '#8A7E7C' : growth >= 0 ? '#1A9E5A' : '#C4362A';
    var badgeBg = growth == null ? '#F2EDED' : growth >= 0 ? '#EDFAF3' : '#FFF0EE';
    return '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;">' +
      '<div style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;">' +
        '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Pedidos</div>' +
        '<div style="font-size:22px;font-weight:900;color:#1A1A1A;margin-top:4px;">' + sales.currentOrders + '</div>' +
        '<div style="font-size:11px;color:#8A7E7C;margin-top:3px;">' + sales.prevOrders + ' no período anterior</div>' +
      '</div>' +
      '<div style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;">' +
        '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Faturamento</div>' +
        '<div style="font-size:22px;font-weight:900;color:#1A1A1A;margin-top:4px;">' + UI.fmt(sales.currentRevenue) + '</div>' +
        '<div style="font-size:11px;color:#8A7E7C;margin-top:3px;">' + UI.fmt(sales.prevRevenue) + ' no período anterior</div>' +
      '</div>' +
      '<div style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;">' +
        '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Itens</div>' +
        '<div style="font-size:22px;font-weight:900;color:#1A1A1A;margin-top:4px;">' + sales.currentItems + '</div>' +
        '<div style="font-size:11px;color:#8A7E7C;margin-top:3px;">' + sales.prevItems + ' no período anterior</div>' +
      '</div>' +
      '<div style="background:' + badgeBg + ';border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;">' +
        '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Variação</div>' +
        '<div style="font-size:18px;font-weight:900;color:' + growthColor + ';margin-top:6px;">' + growthLabel + '</div>' +
        '<div style="font-size:11px;color:#8A7E7C;margin-top:3px;">Últimos 30 dias vs. 30 dias anteriores</div>' +
      '</div>' +
    '</div>';
  }

  function _upsellImpactSummary(rule) {
    var products = _upsellRuleProducts(rule);
    var totals = {
      original: 0,
      final: 0,
      discount: 0,
      cost: 0,
      profitBefore: 0,
      profitAfter: 0,
      costCount: 0,
      missingCost: 0
    };
    products.forEach(function (p) {
      var calc = _upsellBenefitCalcForProduct(p, rule);
      if (!calc) return;
      totals.original += calc.original;
      totals.final += calc.final;
      totals.discount += calc.discount;
      if (calc.cost > 0) {
        totals.cost += calc.cost;
        totals.costCount += 1;
        if (calc.profitBefore != null) totals.profitBefore += calc.profitBefore;
        if (calc.profitAfter != null) totals.profitAfter += calc.profitAfter;
      } else {
        totals.missingCost += 1;
      }
    });
    var marginBefore = totals.costCount > 0 && totals.original > 0 ? ((totals.original - totals.cost) / totals.original) * 100 : null;
    var marginAfter = totals.costCount > 0 && totals.final > 0 ? ((totals.final - totals.cost) / totals.final) * 100 : null;
    return {
      original: totals.original,
      final: totals.final,
      discount: totals.discount,
      cost: totals.cost,
      profitBefore: totals.costCount > 0 ? totals.profitBefore : null,
      profitAfter: totals.costCount > 0 ? totals.profitAfter : null,
      marginBefore: marginBefore,
      marginAfter: marginAfter,
      costCount: totals.costCount,
      missingCost: totals.missingCost,
      hasCost: totals.costCount > 0,
      productsCount: products.length
    };
  }

  function _upsellAnalysisStatus(rule, sales, impact) {
    var status = _upsellStatusInfo(rule).key;
    var minMargin = parseFloat(rule.minMarginPct || _moneyConfig.minMarginPct || 40) || 0;
    if (status === 'scheduled') return { key: 'scheduled', label: 'Agendada', text: 'Upsell agendado.', color: '#3B82F6' };
    if (status === 'paused') return { key: 'paused', label: 'Pausada', text: 'Upsell pausado.', color: '#D97706' };
    if (status === 'expired') return { key: 'expired', label: 'Expirada', text: 'Upsell expirado.', color: '#C4362A' };
    if (rule.benefitType === 'special_price') return { key: 'legacy', label: 'Regra legada', text: 'Regra legada: revise antes de ativar.', color: '#D97706' };
    if (!impact.productsCount) return { key: 'incomplete', label: 'Regra incompleta', text: 'Regra incompleta: revise antes de ativar.', color: '#D97706' };
    if (rule.benefitType === 'none') return { key: 'none', label: 'Sem benefício', text: 'Sem benefício: essa regra é apenas uma sugestão, sem incentivo.', color: '#8A7E7C' };
    if (!impact.hasCost) return { key: 'incomplete', label: 'Regra incompleta', text: 'Custo não informado. Margem não calculada.', color: '#D97706' };
    if (impact.marginAfter != null && impact.marginAfter < minMargin) return { key: 'risk', label: 'Risco de prejuízo', text: 'Risco de prejuízo: não recomendado ativar.', color: '#C4362A' };
    if (impact.marginAfter != null && impact.marginAfter < minMargin + 5) return { key: 'tight', label: 'Margem apertada', text: 'Margem apertada: benefício reduz a margem. Revise.', color: '#D97706' };
    if (!sales.currentOrders && !sales.prevOrders) return { key: 'incomplete', label: 'Regra incompleta', text: 'Sem base suficiente para analisar vendas.', color: '#8A7E7C' };
    if (sales.growth != null && sales.growth < -10) return { key: 'weak', label: 'Benefício fraco', text: 'Benefício fraco: o cliente pode não perceber vantagem suficiente.', color: '#8A7E7C' };
    if (sales.growth != null && sales.growth >= 15 && sales.currentOrders >= 3) return { key: 'good', label: 'Bom upsell', text: 'Bom upsell: benefício atrativo e margem segura.', color: '#1A9E5A' };
    if (sales.currentOrders > 0) return { key: 'attention', label: 'Atenção', text: 'Atenção: revise margem ou configuração.', color: '#D97706' };
    return { key: 'attention', label: 'Atenção', text: 'Atenção: revise margem ou configuração.', color: '#D97706' };
  }

  function _upsellOrderImpactText(rule, impact) {
    if (rule.benefitType === 'cart_goal') {
      return rule.minCartValue > 0 ? ('Faltan ' + UI.fmt(Math.max(rule.minCartValue - _upsellCartSubtotal(), 0)) + ' para completar tu pedido.') : 'Completa tu pedido para ganhar o benefício.';
    }
    if (rule.benefitType === 'gift') return 'Añade y gana un regalo condicionado.';
    if (impact.productsCount <= 0) return 'Impacto estimado: selecione produtos sugeridos';
    return 'Impacto estimado: +' + UI.fmt(Math.max(impact.final, 0)) + ' no pedido';
  }

  function _upsellBenefitLine(rule, impact) {
    if (rule.benefitType === 'none') return 'Recomendação simples';
    if (rule.benefitType === 'special_price' && impact.original > 0) return 'De ' + UI.fmt(impact.original) + ' por ' + UI.fmt(impact.final);
    if (rule.benefitType === 'pct' && impact.original > 0) return String(Math.round(rule.benefitValue || 0)) + '% de descuento';
    if (rule.benefitType === 'eur' && impact.original > 0) return 'Ahorra ' + UI.fmt(impact.discount);
    if (rule.benefitType === 'combo_fixed' && impact.original > 0) return 'De ' + UI.fmt(impact.original) + ' por ' + UI.fmt(impact.final);
    if (rule.benefitType === 'bundle_less_pay_more') {
      var qty = Math.max(2, parseInt(rule.bundleQty || rule.leveQtd || 2, 10) || 2);
      var pay = Math.max(1, parseInt(rule.bundlePay || rule.pagueQtd || qty - 1, 10) || Math.max(1, qty - 1));
      return 'Leve ' + qty + ', pague ' + pay;
    }
    if (rule.benefitType === 'gift') return 'Añade y gana un ' + (_upsellRuleProducts(rule)[0] ? _upsellRuleProducts(rule)[0].name : 'brinde');
    if (rule.benefitType === 'cart_goal' && rule.minCartValue > 0) return 'Faltan ' + UI.fmt(Math.max(rule.minCartValue - _upsellCartSubtotal(), 0)) + ' para ganar beneficio';
    return 'Sem benefício';
  }

  function _upsellSearchText(rule) {
    var sales = _upsellSalesStats(rule);
    var impact = _upsellImpactSummary(rule);
    var status = _upsellAnalysisStatus(rule, sales, impact);
    var tags = [rule.autoTag, rule.benefitTag, rule.tag, status.label].filter(Boolean).join(' ');
    var products = _upsellRuleProducts(rule).slice(0, 5).map(function (p) { return p.name || ''; }).join(' ');
    return [
      rule.name || '',
      rule.typeLabel || '',
      rule.benefitLabel || '',
      _upsellRuleTriggerText(rule) || '',
      rule.triggerCategory || '',
      products || '',
      rule.message || '',
      _upsellRuleLocationText(rule) || '',
      _upsellRulePeriodText(rule) || '',
      tags
    ].join(' ').toLowerCase();
  }

  function _upsellMatchesSearch(rule) {
    var q = String(_upsellUi.query || '').trim().toLowerCase();
    if (!q) return true;
    return _upsellSearchText(rule).indexOf(q) >= 0;
  }

  function _upsellMatchesStatus(rule) {
    var filter = _upsellUi.status || 'all';
    if (filter === 'all') return true;
    return _upsellStatusInfo(rule).key === filter;
  }

  function _upsellMatchesTypes(rule) {
    var list = Array.isArray(_upsellUi.types) ? _upsellUi.types.slice() : [];
    if (!list.length) return true;
    return list.indexOf(rule.type) >= 0;
  }

  function _upsellMatchesBenefits(rule) {
    var list = Array.isArray(_upsellUi.benefits) ? _upsellUi.benefits.slice() : [];
    if (!list.length) return true;
    return list.indexOf(rule.benefitType || 'none') >= 0;
  }

  function _upsellMatchesPeriod(rule) {
    var filter = _upsellUi.period || 'all';
    if (filter === 'all') return true;
    var now = Date.now();
    var start = _promoDateValue(rule.startDate || rule.startsAt);
    var end = _promoDateValue(rule.endDate || rule.endsAt);
    if (filter === 'today') {
      var startDay = _promoStartOfDay(now);
      var endDay = _promoEndOfDay(now);
      return (start && start >= startDay && start <= endDay) || (end && end >= startDay && end <= endDay);
    }
    if (filter === 'week') {
      return (start && start >= _promoStartOfWeek(now)) || (end && end >= _promoStartOfWeek(now));
    }
    if (filter === 'month') {
      return (start && start >= _promoStartOfMonth(now)) || (end && end >= _promoStartOfMonth(now));
    }
    if (filter === 'scheduled') return _upsellStatusInfo(rule).key === 'scheduled';
    if (filter === 'expired') return _upsellStatusInfo(rule).key === 'expired';
    if (filter === 'custom') {
      var rangeStart = _promoDateValue(_upsellUi.periodStart);
      var rangeEnd = _promoDateValue(_upsellUi.periodEnd);
      if (!rangeStart && !rangeEnd) return true;
      if (!rangeStart) rangeStart = 0;
      if (!rangeEnd) rangeEnd = now;
      if (rangeStart > rangeEnd) {
        var swap = rangeStart;
        rangeStart = rangeEnd;
        rangeEnd = swap;
      }
      var ruleStart = start || 0;
      var ruleEnd = end || now;
      return ruleEnd >= rangeStart && ruleStart <= rangeEnd;
    }
    return true;
  }

  function _upsellFilteredList() {
    return (_upsells || []).slice().sort(function (a, b) {
      return _promoDateValue(b.updatedAt || b.createdAt || b.startDate || 0) - _promoDateValue(a.updatedAt || a.createdAt || a.startDate || 0);
    }).filter(function (rule) {
      return _upsellMatchesSearch(rule) && _upsellMatchesStatus(rule) && _upsellMatchesTypes(rule) && _upsellMatchesBenefits(rule) && _upsellMatchesPeriod(rule);
    });
  }

  function _upsellSummary(list) {
    var rules = list || _upsells || [];
    var active = 0;
    var scheduled = 0;
    var pausedExpired = 0;
    var productIds = {};
    rules.forEach(function (rule) {
      var st = _upsellStatusInfo(rule).key;
      if (st === 'active') active += 1;
      if (st === 'scheduled') scheduled += 1;
      if (st === 'paused' || st === 'expired') pausedExpired += 1;
      _upsellRuleProducts(rule).forEach(function (p) { productIds[String(p.id)] = true; });
      _upsellRule(rule).triggerProductIds.forEach(function (id) { productIds[String(id)] = true; });
    });
    return {
      active: active,
      products: Object.keys(productIds).length,
      scheduled: scheduled,
      pausedExpired: pausedExpired
    };
  }

  function _upsellSummaryHtml(summary) {
    summary = summary || _upsellSummary();
    return '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px;">' +
      '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;box-shadow:0 1px 6px rgba(0,0,0,.03);"><div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Upsells ativos</div><div style="font-size:22px;font-weight:900;color:#1A9E5A;margin-top:4px;">' + summary.active + '</div></div>' +
      '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;box-shadow:0 1px 6px rgba(0,0,0,.03);"><div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Produtos com upsell</div><div style="font-size:22px;font-weight:900;color:#1A1A1A;margin-top:4px;">' + summary.products + '</div></div>' +
      '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;box-shadow:0 1px 6px rgba(0,0,0,.03);"><div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Upsells agendados</div><div style="font-size:22px;font-weight:900;color:#3B82F6;margin-top:4px;">' + summary.scheduled + '</div></div>' +
      '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;box-shadow:0 1px 6px rgba(0,0,0,.03);"><div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Upsells pausados ou expirados</div><div style="font-size:22px;font-weight:900;color:#C4362A;margin-top:4px;">' + summary.pausedExpired + '</div></div>' +
    '</div>';
  }

  function _upsellPerfRange() {
    var period = _upsellPerfUi.period || 'last30';
    var now = Date.now();
    var day = 24 * 60 * 60 * 1000;
    var start = 0;
    var end = now;
    var prevStart = 0;
    var prevEnd = 0;
    var compare = true;
    var label = 'Últimos 30 dias';

    function startOfMonth(ts) {
      var d = new Date(ts || now);
      d.setHours(0, 0, 0, 0);
      d.setDate(1);
      return d.getTime();
    }
    function endOfMonth(ts) {
      var d = new Date(ts || now);
      d.setHours(23, 59, 59, 999);
      d.setMonth(d.getMonth() + 1, 0);
      return d.getTime();
    }
    function firstDayPrevMonth(ts) {
      var d = new Date(ts || now);
      d.setHours(0, 0, 0, 0);
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      return d.getTime();
    }
    function lastDayPrevMonth(ts) {
      var d = new Date(ts || now);
      d.setHours(23, 59, 59, 999);
      d.setDate(0);
      return d.getTime();
    }

    if (period === 'today') {
      start = _promoStartOfDay(now);
      end = _promoEndOfDay(now);
      prevStart = _promoStartOfDay(now - day);
      prevEnd = _promoEndOfDay(now - day);
      label = 'Hoje';
    } else if (period === 'yesterday') {
      start = _promoStartOfDay(now - day);
      end = _promoEndOfDay(now - day);
      prevStart = _promoStartOfDay(now - (2 * day));
      prevEnd = _promoEndOfDay(now - (2 * day));
      label = 'Ontem';
    } else if (period === 'last7') {
      start = _promoStartOfDay(now - (6 * day));
      end = _promoEndOfDay(now);
      prevStart = _promoStartOfDay(now - (13 * day));
      prevEnd = _promoEndOfDay(now - (7 * day));
      label = 'Últimos 7 dias';
    } else if (period === 'last30') {
      start = _promoStartOfDay(now - (29 * day));
      end = _promoEndOfDay(now);
      prevStart = _promoStartOfDay(now - (59 * day));
      prevEnd = _promoEndOfDay(now - (30 * day));
      label = 'Últimos 30 dias';
    } else if (period === 'thismonth') {
      start = startOfMonth(now);
      end = _promoEndOfDay(now);
      prevStart = firstDayPrevMonth(now);
      prevEnd = lastDayPrevMonth(now);
      label = 'Este mês';
    } else if (period === 'lastmonth') {
      start = firstDayPrevMonth(now);
      end = lastDayPrevMonth(now);
      prevStart = startOfMonth(firstDayPrevMonth(now));
      prevEnd = lastDayPrevMonth(start);
      label = 'Mês passado';
    } else if (period === 'custom') {
      start = _promoDateValue(_upsellPerfUi.periodStart);
      end = _promoDateValue(_upsellPerfUi.periodEnd);
      label = 'Personalizado';
      if (!start && !end) {
        compare = false;
        start = 0;
        end = now;
      } else {
        if (!start) start = end;
        if (!end) end = start;
        if (start > end) {
          var swap = start;
          start = end;
          end = swap;
        }
        var span = Math.max(1, end - start);
        prevEnd = start - 1;
        prevStart = Math.max(0, prevEnd - span);
      }
    } else {
      compare = false;
      label = 'Todos';
    }

    return {
      key: period,
      label: label,
      start: start,
      end: end,
      prevStart: prevStart,
      prevEnd: prevEnd,
      compare: compare && prevEnd > prevStart
    };
  }

  function _upsellEventTs(ev) {
    if (!ev) return 0;
    if (typeof ev.timestamp === 'number' && isFinite(ev.timestamp)) return ev.timestamp;
    if (typeof ev.ts === 'number' && isFinite(ev.ts)) return ev.ts;
    if (ev.createdAt && typeof ev.createdAt.toDate === 'function') {
      try { return ev.createdAt.toDate().getTime(); } catch (e) {}
    }
    if (typeof ev.createdAt === 'number' && isFinite(ev.createdAt)) return ev.createdAt;
    return _promoDateValue(ev.createdAt || ev.date || ev.time || ev.when || 0);
  }

  function _upsellEventRuleId(ev) {
    return String(ev && (ev.ruleId || ev.upsellRuleId || ev.id || ev.rule || '') || '');
  }

  function _upsellEventLocation(ev) {
    return String(ev && (ev.location || ev.displayLocation || ev.place || ev.context || '') || '').toLowerCase();
  }

  function _upsellEventType(ev) {
    return String(ev && (ev.eventType || ev.type || ev.name || '') || '').toLowerCase();
  }

  function _upsellEventProductValue(ev) {
    return _promoNumber(ev && (ev.value != null ? ev.value : ev.finalPrice != null ? ev.finalPrice : ev.finalUpsellPrice != null ? ev.finalUpsellPrice : ev.productValue != null ? ev.productValue : ev.originalPrice != null ? ev.originalPrice : 0));
  }

  function _upsellEventMatchesRange(ev, range) {
    var ts = _upsellEventTs(ev);
    return ts >= (range && range.start || 0) && ts <= (range && range.end || Date.now());
  }

  function _upsellEventMatchesPrevRange(ev, range) {
    if (!range || !range.compare) return false;
    var ts = _upsellEventTs(ev);
    return ts >= range.prevStart && ts <= range.prevEnd;
  }

  function _upsellRulePerfBuckets(rule, range) {
    rule = _upsellRule(rule || {});
    range = range || _upsellPerfRange();
    var buckets = {
      current: { disparados: 0, clicados: 0, carrinho: 0, conversoes: 0, receita: 0, margem: 0, margemCount: 0, products: {}, locations: {}, channels: {}, gatilhos: {}, clicksByLocation: {}, addByLocation: {}, convByLocation: {}, revenueByLocation: {}, marginByLocation: {} },
      prev: { disparados: 0, clicados: 0, carrinho: 0, conversoes: 0, receita: 0, margem: 0, margemCount: 0, products: {}, locations: {}, channels: {}, gatilhos: {}, clicksByLocation: {}, addByLocation: {}, convByLocation: {}, revenueByLocation: {}, marginByLocation: {} }
    };

    function touch(bucket, ev) {
      var eventType = _upsellEventType(ev);
      var location = _upsellEventLocation(ev) || 'detail';
      var productId = String(ev && (ev.productId || ev.suggestedProductId || ev.product || ev.itemId || '') || '');
      var triggerId = String(ev && (ev.triggerProductId || ev.triggerId || ev.gatilhoId || '') || '');
      var channel = String(ev && (ev.channel || ev.canal || '') || '').toLowerCase();
      var value = _upsellEventProductValue(ev);
      var savings = _promoNumber(ev && (ev.savings != null ? ev.savings : ev.economy != null ? ev.economy : ev.benefitValue != null ? ev.benefitValue : 0));
      var margin = _promoNumber(ev && (ev.margin != null ? ev.margin : ev.marginValue != null ? ev.marginValue : 0));

      bucket.products[productId] = true;
      bucket.locations[location] = true;
      if (channel) bucket.channels[channel] = true;
      if (triggerId) bucket.gatilhos[triggerId] = true;

      if (eventType === 'upsell_disparado') {
        bucket.disparados += 1;
      } else if (eventType === 'upsell_clicado') {
        bucket.clicados += 1;
        bucket.clicksByLocation[location] = (bucket.clicksByLocation[location] || 0) + 1;
      } else if (eventType === 'upsell_adicionado_carrinho') {
        bucket.carrinho += 1;
        bucket.addByLocation[location] = (bucket.addByLocation[location] || 0) + 1;
      } else if (eventType === 'upsell_convertido') {
        bucket.conversoes += 1;
        bucket.revenue += value;
        bucket.convByLocation[location] = (bucket.convByLocation[location] || 0) + 1;
        bucket.revenueByLocation[location] = (bucket.revenueByLocation[location] || 0) + value;
        if (margin > 0) {
          bucket.margem += margin;
          bucket.margemCount += 1;
          bucket.marginByLocation[location] = (bucket.marginByLocation[location] || 0) + margin;
        } else if (savings > 0) {
          bucket.margem += savings;
        }
      }
    }

    (_events || []).forEach(function (ev) {
      if (_upsellEventRuleId(ev) !== String(rule.id || '')) return;
      if (_upsellEventMatchesRange(ev, range)) touch(buckets.current, ev);
      if (_upsellEventMatchesPrevRange(ev, range)) touch(buckets.prev, ev);
    });

    buckets.current.disparoSet = Object.keys(buckets.current.products).length;
    buckets.prev.disparoSet = Object.keys(buckets.prev.products).length;
    return buckets;
  }

  function _upsellRulePerformance(rule, range) {
    rule = _upsellRule(rule || {});
    range = range || _upsellPerfRange();
    var buckets = _upsellRulePerfBuckets(rule, range);
    var cur = buckets.current;
    var prev = buckets.prev;
    var disparos = cur.disparados;
    var cliques = cur.clicados;
    var adicionados = cur.carrinho;
    var conversoes = cur.conversoes;
    var receita = cur.revenue;
    var margem = cur.margem;
    var margemCount = cur.margemCount;
    var clickRate = disparos > 0 ? (cliques / disparos) * 100 : null;
    var addRate = disparos > 0 ? (adicionados / disparos) * 100 : null;
    var convRate = disparos > 0 ? (conversoes / disparos) * 100 : null;
    var prevClickRate = prev.disparados > 0 ? (prev.clicados / prev.disparados) * 100 : null;
    var prevAddRate = prev.disparados > 0 ? (prev.carrinho / prev.disparados) * 100 : null;
    var prevConvRate = prev.disparados > 0 ? (prev.conversoes / prev.disparados) * 100 : null;
    var revenueDelta = prev.revenue > 0 ? ((receita - prev.revenue) / prev.revenue) * 100 : null;
    var conversionDelta = prevConvRate != null && convRate != null ? convRate - prevConvRate : null;
    var bestLocation = Object.keys(cur.convByLocation).sort(function (a, b) { return cur.convByLocation[b] - cur.convByLocation[a]; })[0] || '';
    var bestChannel = Object.keys(cur.channels).sort(function (a, b) { return cur.channels[b] - cur.channels[a]; })[0] || '';
    var bestTrigger = Object.keys(cur.gatilhos).sort(function (a, b) { return cur.gatilhos[b] - cur.gatilhos[a]; })[0] || '';
    return {
      range: range,
      current: cur,
      prev: prev,
      disparos: disparos,
      cliques: cliques,
      adicionados: adicionados,
      conversoes: conversoes,
      receita: receita,
      margem: margem,
      margemCount: margemCount,
      clickRate: clickRate,
      addRate: addRate,
      convRate: convRate,
      prevClickRate: prevClickRate,
      prevAddRate: prevAddRate,
      prevConvRate: prevConvRate,
      revenueDelta: revenueDelta,
      conversionDelta: conversionDelta,
      bestLocation: bestLocation,
      bestChannel: bestChannel,
      bestTrigger: bestTrigger,
      hasPrevious: range.compare && (prev.disparados > 0 || prev.clicados > 0 || prev.carrinho > 0 || prev.conversoes > 0 || prev.revenue > 0)
    };
  }

  function _upsellPerfTrendText(current, previous) {
    if (previous == null || previous === 0 || current == null) return 'Sem dados anteriores';
    var delta = ((current - previous) / previous) * 100;
    if (!isFinite(delta)) return 'Sem dados anteriores';
    var prefix = delta >= 0 ? '+' : '';
    return prefix + delta.toFixed(0) + '% vs período anterior';
  }

  function _upsellPerfStatus(metric) {
    if (!metric) return { text: 'Sem dados suficientes', tone: '#8A7E7C', bg: '#F2EDED' };
    if (metric.disparos < 10) return { text: 'Sem dados suficientes', tone: '#8A7E7C', bg: '#F2EDED' };
    if (metric.conversoes === 0 && metric.cliques > 0) return { text: 'Clientes demonstram interesse, mas não finalizam com esse upsell.', tone: '#D97706', bg: '#FFF8E8' };
    if (metric.conversoes > 0 && metric.convRate != null && metric.convRate < 6) return { text: 'Baixa conversão', tone: '#D97706', bg: '#FFF8E8' };
    if (metric.margem > 0 && metric.convRate != null && metric.convRate >= 10) return { text: 'Bom desempenho', tone: '#1A9E5A', bg: '#EDFAF3' };
    if (metric.margemCount > 0 && metric.margem < (metric.receita * 0.15)) return { text: 'Margem baixa', tone: '#C4362A', bg: '#FFF0EE' };
    return { text: 'Bom desempenho', tone: '#1A9E5A', bg: '#EDFAF3' };
  }

  function _upsellPerformanceSummary(list) {
    var rules = list || _upsells || [];
    var totals = {
      disparos: 0,
      cliques: 0,
      adicionados: 0,
      conversoes: 0,
      receita: 0,
      margem: 0,
      margemCount: 0
    };
    var best = null;
    rules.forEach(function (rule) {
      var perf = _upsellRulePerformance(rule);
      totals.disparos += perf.disparos;
      totals.cliques += perf.cliques;
      totals.adicionados += perf.adicionados;
      totals.conversoes += perf.conversoes;
      totals.receita += perf.receita;
      totals.margem += perf.margem;
      totals.margemCount += perf.margemCount;
      if (!best || perf.conversoes > best.conversoes || (perf.conversoes === best.conversoes && perf.convRate != null && (best.convRate == null || perf.convRate > best.convRate))) {
        best = {
          id: rule.id,
          name: rule.name || 'Upsell',
          typeLabel: rule.typeLabel || _upsellTypeLabel(rule.type),
          conversoes: perf.conversoes,
          convRate: perf.convRate,
          revenue: perf.receita,
          rule: rule
        };
      }
    });
    totals.convRate = totals.disparos > 0 ? (totals.conversoes / totals.disparos) * 100 : null;
    totals.marginRate = totals.receita > 0 ? (totals.margem / totals.receita) * 100 : null;
    totals.best = best;
    totals.alert = _upsellPerfStatus(totals);
    return totals;
  }

  function _upsellMetricDeltaHtml(current, previous) {
    if (previous == null || previous === 0 || current == null) return '<div style="font-size:11px;color:#8A7E7C;margin-top:4px;">Sem dados anteriores</div>';
    var delta = ((current - previous) / previous) * 100;
    if (!isFinite(delta)) return '<div style="font-size:11px;color:#8A7E7C;margin-top:4px;">Sem dados anteriores</div>';
    var color = delta >= 0 ? '#1A9E5A' : '#C4362A';
    return '<div style="font-size:11px;font-weight:700;color:' + color + ';margin-top:4px;">' + (delta >= 0 ? '+' : '') + delta.toFixed(0) + '% vs período anterior</div>';
  }

  function _upsellPerformanceCard(title, value, sub, current, previous, tone, extra) {
    return '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;box-shadow:0 1px 6px rgba(0,0,0,.03);">' +
      '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">' + _esc(title) + '</div>' +
      '<div style="font-size:24px;font-weight:900;color:#1A1A1A;margin-top:4px;">' + _esc(value) + '</div>' +
      '<div style="font-size:12px;color:#8A7E7C;margin-top:3px;line-height:1.45;">' + _esc(sub) + '</div>' +
      _upsellMetricDeltaHtml(current, previous) +
      (extra ? '<div style="font-size:11px;font-weight:800;color:' + (tone || '#8A7E7C') + ';margin-top:6px;">' + _esc(extra) + '</div>' : '') +
    '</div>';
  }

  function _upsellPerformanceSectionHtml() {
    var range = _upsellPerfRange();
    var perf = _upsellPerformanceSummary(_upsells);
    var bestLine = perf.best ? (perf.best.name + ' · ' + perf.best.conversoes + ' conversões') : 'Sem dados suficientes';
    var compareLabel = range.compare ? _upsellPerfTrendText(perf.disparos, perf.prev.disparos) : 'Sem dados anteriores';
    var cards = [
      {
        title: 'Upsells disparados',
        value: String(perf.disparos),
        sub: 'Sugestões exibidas no período',
        current: perf.disparos,
        prev: perf.prev.disparados,
        extra: compareLabel
      },
      {
        title: 'Cliques no upsell',
        value: String(perf.cliques),
        sub: 'Cliques no botão da sugestão',
        current: perf.cliques,
        prev: perf.prev.clicados,
        extra: _upsellPerfTrendText(perf.cliques, perf.prev.clicados)
      },
      {
        title: 'Adicionados ao carrinho',
        value: String(perf.adicionados),
        sub: 'Produtos adicionados via upsell',
        current: perf.adicionados,
        prev: perf.prev.carrinho,
        extra: _upsellPerfTrendText(perf.adicionados, perf.prev.carrinho)
      },
      {
        title: 'Conversões reais',
        value: String(perf.conversoes),
        sub: 'Pedidos finalizados com upsell',
        current: perf.conversoes,
        prev: perf.prev.conversoes,
        extra: _upsellPerfTrendText(perf.conversoes, perf.prev.conversoes)
      },
      {
        title: 'Taxa de conversão',
        value: perf.convRate == null ? '—' : perf.convRate.toFixed(1).replace('.', ',') + '%',
        sub: 'Conversões sobre disparos',
        current: perf.convRate,
        prev: perf.prevConvRate,
        extra: perf.convRate == null ? 'Sem dados anteriores' : _upsellPerfTrendText(perf.convRate, perf.prevConvRate)
      },
      {
        title: 'Receita extra gerada',
        value: UI.fmt(perf.receita),
        sub: 'Pedidos com upsell finalizado',
        current: perf.receita,
        prev: perf.prev.revenue,
        extra: _upsellPerfTrendText(perf.receita, perf.prev.revenue)
      },
      {
        title: 'Margem estimada',
        value: perf.margem > 0 ? UI.fmt(perf.margem) : '—',
        sub: perf.margemCount > 0 ? 'Margem somada dos itens vendidos' : 'Custo não informado',
        current: perf.margem,
        prev: perf.prev.margem,
        extra: perf.margemCount > 0 ? _upsellPerfTrendText(perf.margem, perf.prev.margem) : 'Sem dados anteriores'
      },
      {
        title: 'Melhor upsell',
        value: perf.best ? perf.best.name : '—',
        sub: perf.best ? perf.best.typeLabel + ' · ' + (perf.best.conversoes || 0) + ' conversões' : 'Sem base suficiente',
        current: perf.best ? perf.best.conversoes : null,
        prev: null,
        extra: bestLine
      }
    ];
    var html = '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:16px;padding:16px 16px 14px;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,0,0,.04);">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px;">' +
        '<div><div style="font-size:18px;font-weight:900;color:#1A1A1A;">Desempenho do Upsell</div><div style="font-size:12px;color:#8A7E7C;line-height:1.45;">' + _esc(range.label + ' · métricas com comparação com o período anterior equivalente.') + '</div></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">' +
          '<label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;"><span style="display:block;margin-bottom:4px;">Período</span><select onchange="Modules.Marketing._setUpsellPerfPeriod(this.value)" style="min-width:180px;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:12px;background:#fff;font-size:13px;font-family:inherit;outline:none;"><option value="today"' + (range.key === 'today' ? ' selected' : '') + '>Hoje</option><option value="yesterday"' + (range.key === 'yesterday' ? ' selected' : '') + '>Ontem</option><option value="last7"' + (range.key === 'last7' ? ' selected' : '') + '>Últimos 7 dias</option><option value="last30"' + (range.key === 'last30' ? ' selected' : '') + '>Últimos 30 dias</option><option value="thismonth"' + (range.key === 'thismonth' ? ' selected' : '') + '>Este mês</option><option value="lastmonth"' + (range.key === 'lastmonth' ? ' selected' : '') + '>Mês passado</option><option value="custom"' + (range.key === 'custom' ? ' selected' : '') + '>Personalizado</option></select></label>' +
        '</div>' +
      '</div>' +
      (range.key === 'custom'
        ? '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:12px;">' +
            '<label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;"><span style="display:block;margin-bottom:4px;">Data inicial</span><input type="date" value="' + _esc(_upsellPerfUi.periodStart || '') + '" onchange="Modules.Marketing._setUpsellPerfStart(this.value)" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:12px;background:#fff;font-size:13px;font-family:inherit;outline:none;"></label>' +
            '<label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;"><span style="display:block;margin-bottom:4px;">Data final</span><input type="date" value="' + _esc(_upsellPerfUi.periodEnd || '') + '" onchange="Modules.Marketing._setUpsellPerfEnd(this.value)" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:12px;background:#fff;font-size:13px;font-family:inherit;outline:none;"></label>' +
          '</div>'
        : '') +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;">' +
        cards.map(function (card) { return _upsellPerformanceCard(card.title, card.value, card.sub, card.current, card.prev, '#1A1A1A', card.extra); }).join('') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:10px;">' +
        '<div style="background:' + perf.alert.bg + ';border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Alerta de desempenho</div><div style="font-size:13px;font-weight:800;color:' + perf.alert.tone + ';margin-top:4px;line-height:1.4;">' + _esc(perf.alert.text) + '</div></div>' +
        '<div style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Melhor local de exibição</div><div style="font-size:13px;font-weight:800;color:#1A1A1A;margin-top:4px;">' + _esc(perf.bestLocation || '—') + '</div></div>' +
        '<div style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Melhor canal</div><div style="font-size:13px;font-weight:800;color:#1A1A1A;margin-top:4px;">' + _esc(perf.bestChannel || '—') + '</div></div>' +
        '<div style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Melhor gatilho</div><div style="font-size:13px;font-weight:800;color:#1A1A1A;margin-top:4px;">' + _esc(perf.bestTrigger || '—') + '</div></div>' +
      '</div>' +
    '</div>';
    return html;
  }

  function _upsellToggleArrayFilter(key, value, checked) {
    var list = Array.isArray(_upsellUi[key]) ? _upsellUi[key].slice() : [];
    if (String(value) === 'all') {
      _upsellUi[key] = [];
      _paintUpsell();
      return;
    }
    if (checked) {
      list = list.filter(function (x) { return String(x) !== 'all'; });
      if (list.indexOf(value) < 0) list.push(value);
    } else {
      list = list.filter(function (x) { return String(x) !== String(value); });
    }
    _upsellUi[key] = list;
    _paintUpsell();
  }

  function _setUpsellSearch(value) { _upsellUi.query = value || ''; _paintUpsell(); }
  function _setUpsellStatus(value) { _upsellUi.status = value || 'all'; _paintUpsell(); }
  function _setUpsellPeriod(value) { _upsellUi.period = value || 'all'; _paintUpsell(); }
  function _setUpsellPeriodStart(value) { _upsellUi.periodStart = value || ''; _paintUpsell(); }
  function _setUpsellPeriodEnd(value) { _upsellUi.periodEnd = value || ''; _paintUpsell(); }
  function _setUpsellPerfPeriod(value) { _upsellPerfUi.period = value || 'last30'; _paintUpsell(); }
  function _setUpsellPerfStart(value) { _upsellPerfUi.periodStart = value || ''; _paintUpsell(); }
  function _setUpsellPerfEnd(value) { _upsellPerfUi.periodEnd = value || ''; _paintUpsell(); }

  function _upsellToolbarHtml() {
    var customHtml = _upsellUi.period === 'custom'
      ? '<div style="grid-column:1 / -1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:-2px;">' +
          '<label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;"><span style="display:block;margin-bottom:4px;">Data inicial</span><input type="date" value="' + _esc(_upsellUi.periodStart || '') + '" onchange="Modules.Marketing._setUpsellPeriodStart(this.value)" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:12px;background:#fff;font-size:13px;font-family:inherit;outline:none;"></label>' +
          '<label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;"><span style="display:block;margin-bottom:4px;">Data final</span><input type="date" value="' + _esc(_upsellUi.periodEnd || '') + '" onchange="Modules.Marketing._setUpsellPeriodEnd(this.value)" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:12px;background:#fff;font-size:13px;font-family:inherit;outline:none;"></label>' +
        '</div>'
      : '';
    return '<div style="display:grid;grid-template-columns:1.4fr .9fr 1fr;gap:10px;margin-bottom:14px;align-items:end;">' +
      '<div><label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;margin-bottom:4px;">Buscar por regra, produto, tipo ou tag</label><input id="ups-search" type="search" value="' + _esc(_upsellUi.query || '') + '" oninput="Modules.Marketing._setUpsellSearch(this.value)" placeholder="Buscar por regra, produto, tipo ou tag" style="width:100%;padding:11px 14px;border:1.5px solid #D4C8C6;border-radius:999px;background:#fff;font-size:13px;font-family:inherit;outline:none;"></div>' +
      '<label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;"><span style="display:block;margin-bottom:4px;">Status</span><select onchange="Modules.Marketing._setUpsellStatus(this.value)" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:12px;background:#fff;font-size:13px;font-family:inherit;outline:none;"><option value="all"' + (_upsellUi.status === 'all' ? ' selected' : '') + '>Todas</option><option value="active"' + (_upsellUi.status === 'active' ? ' selected' : '') + '>Ativas</option><option value="scheduled"' + (_upsellUi.status === 'scheduled' ? ' selected' : '') + '>Agendadas</option><option value="paused"' + (_upsellUi.status === 'paused' ? ' selected' : '') + '>Pausadas</option><option value="expired"' + (_upsellUi.status === 'expired' ? ' selected' : '') + '>Expiradas</option></select></label>' +
      '<label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;"><span style="display:block;margin-bottom:4px;">Período</span><select onchange="Modules.Marketing._setUpsellPeriod(this.value)" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:12px;background:#fff;font-size:13px;font-family:inherit;outline:none;"><option value="all"' + (_upsellUi.period === 'all' ? ' selected' : '') + '>Todos</option><option value="today"' + (_upsellUi.period === 'today' ? ' selected' : '') + '>Hoje</option><option value="week"' + (_upsellUi.period === 'week' ? ' selected' : '') + '>Esta semana</option><option value="month"' + (_upsellUi.period === 'month' ? ' selected' : '') + '>Este mês</option><option value="scheduled"' + (_upsellUi.period === 'scheduled' ? ' selected' : '') + '>Agendadas</option><option value="expired"' + (_upsellUi.period === 'expired' ? ' selected' : '') + '>Expiradas</option><option value="custom"' + (_upsellUi.period === 'custom' ? ' selected' : '') + '>Personalizado</option></select></label>' +
      customHtml +
    '</div>';
  }

  function _upsellBenefitFieldsHtml(rule) {
    rule = _upsellRule(rule || {});
    var type = String(window._upsellType || rule.type || '').trim();
    var current = typeof window._upsellBenefit === 'string' ? String(window._upsellBenefit).trim() : String(rule.benefitType || '').trim();
    var allowed = _upsellBenefitOptionsForType(type);
    var legacyBenefit = rule.benefitType === 'special_price';
    var invalidBenefit = !!current && allowed.indexOf(current) < 0;
    if (current === 'special_price' || invalidBenefit) current = '';
    var selected = Array.prototype.slice.call(document.querySelectorAll('.ups-prod-check:checked')).map(function (i) {
      return (_products || []).find(function (p) { return String(p.id) === String(i.dataset.id); }) || null;
    }).filter(Boolean);
    if (!selected.length) selected = _upsellRuleProducts(rule);
    var ref = selected[0] || null;
    var selectedBenefit = current;
    var refCalc = ref ? _upsellBenefitCalcForProduct(ref, Object.assign({}, rule, { type: type, benefitType: selectedBenefit || rule.benefitType })) : null;
    var hasType = !!type;
    function section(title, key, content, note, isWide) {
      var active = hasType && current === key;
      var visible = active;
      return '<div data-ups-benefit-section="' + key + '" style="grid-column:' + (isWide ? '1 / -1' : 'auto') + ';display:' + (visible ? 'block' : 'none') + ';background:#fff;border:1px solid #C4362A;border-radius:12px;padding:12px 14px;">' +
        '<div style="margin-bottom:10px;">' +
          '<div style="font-size:11px;font-weight:900;color:#C4362A;text-transform:uppercase;">' + _esc(title) + '</div>' +
          '<div style="font-size:12px;color:#8A7E7C;line-height:1.45;margin-top:4px;">' + _esc(note || '') + '</div>' +
        '</div>' +
        content(false, active) +
      '</div>';
    }
    var html = [];
    if (legacyBenefit) {
      html.push('<div style="grid-column:1 / -1;background:#FFF8E8;border:1px solid #F2D9A6;border-radius:12px;padding:12px 14px;font-size:12px;color:#8A7E7C;line-height:1.5;">Regra legada detectada. Escolha outro benefício para salvar ou ativar esta sugestão.</div>');
    }
    if (invalidBenefit || (current && !allowed.length)) {
      html.push('<div style="grid-column:1 / -1;background:#FFF0EE;border:1px solid #F5C2B7;border-radius:12px;padding:12px 14px;font-size:12px;color:#C4362A;line-height:1.5;">Benefício incompatível com o tipo de upsell selecionado.</div>');
    }
    if (!hasType) {
      html.push('<div style="grid-column:1 / -1;background:#F2EDED;border:1px dashed #D4C8C6;border-radius:12px;padding:12px 14px;font-size:12px;color:#8A7E7C;line-height:1.5;">Selecione primeiro o tipo de upsell.</div>');
    }
    html.push(
      section('Sem benefício', 'none', function (locked) {
        return '<div style="font-size:12px;line-height:1.5;color:#8A7E7C;">Essa regra será apenas uma recomendação simples, sem incentivo para o cliente.</div>' +
          '<div style="margin-top:10px;">' +
            '<label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Mensagem ao cliente</label>' +
            '<input id="ups-msg-none" type="text" value="' + _esc(rule.message || 'También te puede gustar') + '" ' + (locked ? 'disabled' : '') + ' placeholder="También te puede gustar" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:' + (locked ? '#F7F4F4' : '#fff') + ';font-size:13px;font-family:inherit;outline:none;">' +
          '</div>';
      }, _upsellBenefitHelpText('none'), true)
    );
    html.push(
      section('Desconto em %', 'pct', function (locked) {
        return '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">' +
          '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Percentual de desconto</label><input id="ups-benefit-value" type="text" inputmode="decimal" value="' + (rule.benefitValue || '') + '" placeholder="Ex: 10" ' + (locked ? 'disabled' : '') + ' style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:' + (locked ? '#F7F4F4' : '#fff') + ';font-size:13px;font-family:inherit;outline:none;"></div>' +
          '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Mensagem ao cliente</label><input id="ups-msg-pct" type="text" value="' + _esc(rule.message || 'También te puede gustar') + '" placeholder="También te puede gustar" ' + (locked ? 'disabled' : '') + ' style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:' + (locked ? '#F7F4F4' : '#fff') + ';font-size:13px;font-family:inherit;outline:none;"></div>' +
        '</div>';
      }, _upsellBenefitHelpText('pct'))
    );
    html.push(
      section('Desconto em €', 'eur', function (locked) {
        return '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">' +
          '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Valor do desconto</label><input id="ups-benefit-value" type="text" inputmode="decimal" value="' + (rule.benefitValue || '') + '" placeholder="Ex: 0,50" ' + (locked ? 'disabled' : '') + ' style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:' + (locked ? '#F7F4F4' : '#fff') + ';font-size:13px;font-family:inherit;outline:none;"></div>' +
          '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Mensagem ao cliente</label><input id="ups-msg-eur" type="text" value="' + _esc(rule.message || 'También te puede gustar') + '" placeholder="También te puede gustar" ' + (locked ? 'disabled' : '') + ' style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:' + (locked ? '#F7F4F4' : '#fff') + ';font-size:13px;font-family:inherit;outline:none;"></div>' +
        '</div>';
      }, _upsellBenefitHelpText('eur'))
    );
    html.push(
      section('Combo com preço fechado', 'combo_fixed', function (locked) {
        var totalNormal = selected.length ? selected.reduce(function (sum, p) { return sum + _promoBasePrice(p); }, 0) : 0;
        return '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">' +
          '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Preço fechado do combo</label><input id="ups-final-price" type="text" inputmode="decimal" value="' + (rule.finalUpsellPrice || '') + '" placeholder="Ex: 6,90" ' + (locked ? 'disabled' : '') + ' style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:' + (locked ? '#F7F4F4' : '#fff') + ';font-size:13px;font-family:inherit;outline:none;"></div>' +
          '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Mensagem ao cliente</label><input id="ups-msg-combo" type="text" value="' + _esc(rule.message || 'También te puede gustar') + '" placeholder="También te puede gustar" ' + (locked ? 'disabled' : '') + ' style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:' + (locked ? '#F7F4F4' : '#fff') + ';font-size:13px;font-family:inherit;outline:none;"></div>' +
        '</div>' +
        '<div style="margin-top:10px;background:#fff;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;font-size:12px;color:#1A1A1A;line-height:1.55;">' +
          '<div><strong>Total normal dos produtos:</strong> ' + (selected.length ? UI.fmt(totalNormal) : 'Selecione produtos sugeridos') + '</div>' +
          '<div><strong>Preço final:</strong> ' + (rule.finalUpsellPrice > 0 ? UI.fmt(rule.finalUpsellPrice) : '—') + '</div>' +
          '<div><strong>Diferença do combo:</strong> ' + (selected.length && rule.finalUpsellPrice > 0 ? UI.fmt(Math.max(totalNormal - _promoNumber(rule.finalUpsellPrice || 0), 0)) : '—') + '</div>' +
          '<div style="margin-top:4px;color:#8A7E7C;">Produtos oferecidos juntos com preço fechado.</div>' +
        '</div>';
      }, _upsellBenefitHelpText('combo_fixed'))
    );
    html.push(
      section('Leve mais pagando menos', 'bundle_less_pay_more', function (locked) {
        return '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">' +
          '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Quantidade adicional</label><input id="ups-bundle-qty" type="number" step="1" min="1" value="' + (rule.bundleQty || rule.leveQtd || '') + '" placeholder="Ex: 3" ' + (locked ? 'disabled' : '') + ' style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:' + (locked ? '#F7F4F4' : '#fff') + ';font-size:13px;font-family:inherit;outline:none;"></div>' +
          '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Preço especial da quantidade adicional</label><input id="ups-bundle-pay" type="number" step="1" min="1" value="' + (rule.bundlePay || rule.pagueQtd || '') + '" placeholder="Ex: 2" ' + (locked ? 'disabled' : '') + ' style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:' + (locked ? '#F7F4F4' : '#fff') + ';font-size:13px;font-family:inherit;outline:none;"></div>' +
        '</div>' +
        '<div style="margin-top:10px;background:#fff;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;font-size:12px;color:#1A1A1A;line-height:1.55;">' +
          '<div style="color:#8A7E7C;">' + _esc(_upsellBenefitHelpText('bundle_less_pay_more')) + '</div>' +
          '<div style="margin-top:4px;color:#8A7E7C;">Exemplo: Leve 3, pague 2.</div>' +
        '</div>';
      }, _upsellBenefitHelpText('bundle_less_pay_more'))
    );
    html.push(
      section('Brinde condicionado', 'gift', function (locked) {
        var giftKind = String(rule.giftConditionType || rule.giftCondition || 'trigger').trim() || 'trigger';
        var giftQty = parseInt(rule.giftQty || rule.giftQuantity || 0, 10) || 0;
        var giftMin = _promoNumber(rule.giftMinCartValue || rule.giftMinValue || 0);
        return '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">' +
          '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Produto brinde</label><select id="ups-gift-product" ' + (locked ? 'disabled' : '') + ' style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:' + (locked ? '#F7F4F4' : '#fff') + ';font-size:13px;font-family:inherit;outline:none;"><option value="">—</option>' + _products.map(function (p) { return '<option value="' + _esc(String(p.id)) + '"' + (String(rule.giftProductId || '') === String(p.id) ? ' selected' : '') + '>' + _esc(p.name || 'Produto') + '</option>'; }).join('') + '</select></div>' +
          '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Condição para liberar o brinde</label><select id="ups-gift-condition-type" onchange="Modules.Marketing._syncUpsellBenefitDetails()" ' + (locked ? 'disabled' : '') + ' style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:' + (locked ? '#F7F4F4' : '#fff') + ';font-size:13px;font-family:inherit;outline:none;">' +
            '<option value="trigger"' + (giftKind === 'trigger' ? ' selected' : '') + '>Ao comprar o produto gatilho</option>' +
            '<option value="selected"' + (giftKind === 'selected' ? ' selected' : '') + '>Ao levar o produto sugerido</option>' +
            '<option value="qty"' + (giftKind === 'qty' ? ' selected' : '') + '>Ao comprar quantidade mínima</option>' +
            '<option value="mincart"' + (giftKind === 'mincart' ? ' selected' : '') + '>Ao atingir valor mínimo</option>' +
          '</select></div>' +
          '<div data-ups-gift-extra="qty" style="display:' + (giftKind === 'qty' ? 'block' : 'none') + ';"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Quantidade mínima</label><input id="ups-gift-qty" type="number" min="1" step="1" value="' + giftQty + '" placeholder="Ex: 2" ' + (locked ? 'disabled' : '') + ' style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:' + (locked ? '#F7F4F4' : '#fff') + ';font-size:13px;font-family:inherit;outline:none;"></div>' +
          '<div data-ups-gift-extra="mincart" style="display:' + (giftKind === 'mincart' ? 'block' : 'none') + ';"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Valor mínimo do carrinho</label><input id="ups-gift-min-cart" type="text" inputmode="decimal" value="' + (giftMin || '') + '" placeholder="Ex: 20,00" ' + (locked ? 'disabled' : '') + ' style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:' + (locked ? '#F7F4F4' : '#fff') + ';font-size:13px;font-family:inherit;outline:none;"></div>' +
          '<div data-ups-gift-extra="note" style="grid-column:1 / -1;background:#fff;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;font-size:12px;color:#1A1A1A;line-height:1.55;">' +
            '<div style="color:#8A7E7C;">' + _esc(_upsellBenefitHelpText('gift')) + '</div>' +
          '</div>' +
        '</div>';
      }, _upsellBenefitHelpText('gift'))
    );
    html.push(
      section('Completar valor para ganhar benefício', 'cart_goal', function (locked) {
        var cartKind = String(rule.cartGoalBenefitType || rule.cartGoalBenefit || 'frete').trim() || 'frete';
        var cartValue = _promoNumber(rule.cartGoalBenefitValue || rule.benefitValue || 0);
        return '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">' +
          '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Valor mínimo do carrinho</label><input id="ups-cart-min" type="text" inputmode="decimal" value="' + (rule.minCartValue || '') + '" placeholder="Ex: 20,00" ' + (locked ? 'disabled' : '') + ' style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:' + (locked ? '#F7F4F4' : '#fff') + ';font-size:13px;font-family:inherit;outline:none;"></div>' +
          '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Benefício concedido</label><select id="ups-cart-benefit" onchange="Modules.Marketing._syncUpsellBenefitDetails()" ' + (locked ? 'disabled' : '') + ' style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:' + (locked ? '#F7F4F4' : '#fff') + ';font-size:13px;font-family:inherit;outline:none;">' +
            '<option value="frete"' + (cartKind === 'frete' ? ' selected' : '') + '>Frete grátis</option>' +
            '<option value="pct"' + (cartKind === 'pct' ? ' selected' : '') + '>Desconto em %</option>' +
            '<option value="eur"' + (cartKind === 'eur' ? ' selected' : '') + '>Desconto em €</option>' +
            '<option value="gift"' + (cartKind === 'gift' ? ' selected' : '') + '>Brinde</option>' +
          '</select></div>' +
          '<div data-ups-cart-extra="value" style="display:' + ((cartKind === 'pct' || cartKind === 'eur') ? 'block' : 'none') + ';"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Valor do benefício</label><input id="ups-cart-benefit-value" type="text" inputmode="decimal" value="' + (cartValue || '') + '" placeholder="' + (cartKind === 'pct' ? 'Ex: 10' : 'Ex: 0,50') + '" ' + (locked ? 'disabled' : '') + ' style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:' + (locked ? '#F7F4F4' : '#fff') + ';font-size:13px;font-family:inherit;outline:none;"></div>' +
          '<div data-ups-cart-extra="gift" style="display:' + (cartKind === 'gift' ? 'block' : 'none') + ';"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Produto brinde</label><select id="ups-cart-gift-product" ' + (locked ? 'disabled' : '') + ' style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:' + (locked ? '#F7F4F4' : '#fff') + ';font-size:13px;font-family:inherit;outline:none;"><option value="">—</option>' + _products.map(function (p) { return '<option value="' + _esc(String(p.id)) + '"' + (String(rule.cartGoalGiftProductId || '') === String(p.id) ? ' selected' : '') + '>' + _esc(p.name || 'Produto') + '</option>'; }).join('') + '</select></div>' +
          '<div style="grid-column:1 / -1;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Mensagem exibida ao cliente</label><input id="ups-cart-message" type="text" value="' + _esc(rule.cartGoalMessage || rule.message || 'También te puede gustar') + '" placeholder="También te puede gustar" ' + (locked ? 'disabled' : '') + ' style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:' + (locked ? '#F7F4F4' : '#fff') + ';font-size:13px;font-family:inherit;outline:none;"></div>' +
          '<div style="grid-column:1 / -1;background:#fff;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;font-size:12px;color:#1A1A1A;line-height:1.55;">' +
            '<div style="color:#8A7E7C;">' + _esc(_upsellBenefitHelpText('cart_goal')) + '</div>' +
          '</div>' +
        '</div>';
      }, _upsellBenefitHelpText('cart_goal'))
    );
    html.push('<div id="ups-benefit-reference" style="grid-column:1 / -1;">' + _upsellBenefitReferenceHtml(rule, selected, current) + '</div>');
    return '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">' + html.join('') + '</div>';
  }

  function _upsellStatusInfo(rule) {
    var now = Date.now();
    var start = _promoDateValue(rule && (rule.startDate || rule.startsAt));
    var end = _promoDateValue(rule && (rule.endDate || rule.endsAt));
    if (start && start > now) return { key: 'scheduled', label: 'Agendada', color: '#3B82F6', bg: '#EEF4FF' };
    if (end && end < now) return { key: 'expired', label: 'Expirada', color: '#C4362A', bg: '#FFF0EE' };
    if (rule && rule.active === false) return { key: 'paused', label: 'Pausada', color: '#D97706', bg: '#FFF8E8' };
    return { key: 'active', label: 'Ativa', color: '#1A9E5A', bg: '#EDFAF3' };
  }

  function _upsellRule(rule) {
    rule = rule || {};
    var typeInfo = _upsellTypeInfo(rule.type || rule.upsellType || 'complemento');
    var benefitInfo = _upsellBenefitInfo(rule.benefitType || rule.benefit || 'none');
    var productIds = [];
    if (Array.isArray(rule.productIds) && rule.productIds.length) productIds = productIds.concat(rule.productIds);
    if (!productIds.length && rule.productId != null && rule.productId !== '') productIds.push(rule.productId);
    if (!productIds.length && Array.isArray(rule.suggestedProductIds) && rule.suggestedProductIds.length) productIds = productIds.concat(rule.suggestedProductIds);
    if (!productIds.length && Array.isArray(rule.suggestedIds) && rule.suggestedIds.length) productIds = productIds.concat(rule.suggestedIds);
    productIds = productIds.map(String).filter(Boolean);
    var seen = {};
    productIds = productIds.filter(function (id) { if (seen[id]) return false; seen[id] = true; return true; });
    var triggerProductIds = [];
    if (rule.triggerProductId != null && rule.triggerProductId !== '') triggerProductIds.push(String(rule.triggerProductId));
    if (Array.isArray(rule.triggerProductIds)) triggerProductIds = triggerProductIds.concat(rule.triggerProductIds.map(String));
    var channels = Array.isArray(rule.channels) ? rule.channels : String(rule.channelsText || rule.channel || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var locations = Array.isArray(rule.locations) ? rule.locations : String(rule.displayLocations || rule.locationsText || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    locations = _upsellLocationsNormalize(locations);
    var message = String(rule.message || rule.customerMessage || '').trim() || 'También te puede gustar';
    return {
      raw: rule,
      id: rule.id,
      name: String(rule.name || rule.title || 'Sugestión').trim(),
      type: typeInfo.key,
      typeLabel: typeInfo.label,
      typeDesc: typeInfo.desc,
      typeExample: typeInfo.example,
      tag: typeInfo.tag,
      tagLabel: typeInfo.tag,
      tone: typeInfo.tone,
      benefitType: benefitInfo.key,
      benefitLabel: benefitInfo.label,
      benefitDesc: benefitInfo.desc,
      benefitExample: benefitInfo.example,
      benefitTag: benefitInfo.tag,
      active: rule.active !== false,
      status: rule.status || '',
      triggerProductIds: triggerProductIds,
      triggerCategory: String(rule.triggerCategory || rule.trigger_category || rule.categoryTrigger || '').trim(),
      productIds: productIds,
      locations: locations,
      message: message,
      startDate: rule.startDate || rule.startsAt || '',
      endDate: rule.endDate || rule.endsAt || '',
      priority: parseInt(rule.priority || 0, 10) || 0,
      displayLimit: parseInt(rule.displayLimit || rule.limit || 0, 10) || 0,
      minMarginPct: parseFloat(rule.minMarginPct || rule.marginMinPct || 0) || 0,
      benefitValue: parseFloat(rule.benefitValue || rule.discountValue || rule.value || 0) || 0,
      specialPrice: rule.specialPrice != null ? _promoNumber(rule.specialPrice) : (rule.fixedPrice != null ? _promoNumber(rule.fixedPrice) : 0),
      originalPrice: rule.originalPrice != null ? _promoNumber(rule.originalPrice) : 0,
      finalUpsellPrice: rule.finalUpsellPrice != null ? _promoNumber(rule.finalUpsellPrice) : 0,
      giftProductId: rule.giftProductId || rule.giftId || '',
      giftCondition: String(rule.giftCondition || rule.giftConditionText || '').trim(),
      minCartValue: parseFloat(rule.minCartValue || rule.cartMinValue || rule.cartMin || 0) || 0,
      cartGoalBenefit: String(rule.cartGoalBenefit || rule.cartBenefit || '').trim(),
      cartGoalMessage: String(rule.cartGoalMessage || rule.message || '').trim(),
      benefitContextOnly: rule.benefitContextOnly !== false,
      promotionId: rule.promotionId || rule.promoId || '',
      autoTag: rule.autoTag || typeInfo.tag,
      triggerLabel: String(rule.triggerLabel || '').trim(),
      extraProducts: productIds.slice(1)
    };
  }

  function _upsellRuleProducts(rule) {
    rule = _upsellRule(rule);
    return rule.productIds.map(function (id) { return (_products || []).find(function (p) { return String(p.id) === String(id); }); }).filter(Boolean);
  }

  function _upsellBenefitCalcForProduct(product, rule) {
    rule = _upsellRule(rule);
    var original = _promoBasePrice(product);
    if (!(original > 0)) return null;
    var cost = _promoCostForProduct(product);
    var benefit = _upsellBenefitInfo(rule.benefitType || 'none');
    var final = original;
    var discount = 0;
    var note = benefit.example || '';

    if (benefit.key === 'special_price') {
      final = rule.specialPrice > 0 ? rule.specialPrice : original;
      discount = Math.max(original - final, 0);
    } else if (benefit.key === 'pct') {
      discount = original * (Math.max(rule.benefitValue || 0, 0) / 100);
      final = Math.max(original - discount, 0);
    } else if (benefit.key === 'eur') {
      discount = Math.max(rule.benefitValue || 0, 0);
      final = Math.max(original - discount, 0);
    } else if (benefit.key === 'combo_fixed') {
      var comboProducts = _upsellRuleProducts(rule);
      var comboTotal = comboProducts.reduce(function (sum, p) { return sum + _promoBasePrice(p); }, 0);
      if (comboTotal > 0 && rule.finalUpsellPrice > 0) {
        var comboRatio = rule.finalUpsellPrice / comboTotal;
        final = Math.max(original * comboRatio, 0);
        discount = Math.max(original - final, 0);
      } else {
        final = rule.finalUpsellPrice > 0 ? rule.finalUpsellPrice : original;
        discount = Math.max(original - final, 0);
      }
    } else if (benefit.key === 'bundle_less_pay_more') {
      var qty = Math.max(2, parseInt(rule.bundleQty || rule.leveQtd || 2, 10) || 2);
      var pay = Math.max(1, parseInt(rule.bundlePay || rule.pagueQtd || qty - 1, 10) || (qty - 1));
      if (qty > pay) {
        final = Math.max((original * pay) / qty, 0);
        discount = Math.max(original - final, 0);
        note = 'Leve ' + qty + ', pague ' + pay;
      }
    } else if (benefit.key === 'gift' || benefit.key === 'cart_goal' || benefit.key === 'none') {
      final = original;
      discount = 0;
    }

    var profitBefore = cost > 0 ? Math.max(original - cost, 0) : null;
    var profitAfter = cost > 0 ? Math.max(final - cost, 0) : null;
    var marginBefore = cost > 0 ? ((original - cost) / original) * 100 : null;
    var marginAfter = cost > 0 && final > 0 ? ((final - cost) / final) * 100 : null;
    return {
      original: original,
      final: Math.max(final, 0),
      discount: Math.max(discount, 0),
      cost: cost,
      profitBefore: profitBefore,
      profitAfter: profitAfter,
      marginBefore: marginBefore,
      marginAfter: marginAfter,
      note: note,
      benefit: benefit
    };
  }

  function _upsellRuleActive(rule) {
    return _upsellStatusInfo(rule).key === 'active';
  }

  function _upsellRuleChannelOk(rule, context) {
    var channels = (rule.channels || []).map(function (s) { return String(s).toLowerCase(); });
    if (!channels.length) return true;
    var current = String(context || 'site').toLowerCase();
    if (current === 'detail' || current === 'product') current = 'site';
    if (current === 'checkout') current = 'checkout';
    if (current === 'cart') current = 'carrinho';
    return channels.indexOf(current) >= 0 || channels.indexOf('todos') >= 0 || channels.indexOf('all') >= 0;
  }

  function _upsellRuleLocationOk(rule, context) {
    var locations = _upsellLocationsNormalize(rule.locations || []);
    if (!locations.length) return true;
    var current = _upsellLocationKey(context || 'detail');
    return locations.indexOf(current) >= 0 || locations.indexOf('todos') >= 0 || locations.indexOf('all') >= 0;
  }

  function _upsellRuleMatchesTrigger(rule, context, triggerProduct) {
    if (!rule) return false;
    var active = _upsellRuleActive(rule);
    if (!active) return false;
    if (!_upsellRuleChannelOk(rule, context)) return false;
    if (!_upsellRuleLocationOk(rule, context)) return false;
    var st = _upsellStatusInfo(rule).key;
    if (st === 'scheduled' || st === 'expired' || st === 'paused') return false;
    if (rule.triggerProductIds && rule.triggerProductIds.length) {
      if (!triggerProduct) return false;
      if (rule.triggerProductIds.indexOf(String(triggerProduct.id)) < 0) return false;
    }
    if (rule.triggerCategory && triggerProduct) {
      var c = String(triggerProduct.category || triggerProduct.categoryId || '').toLowerCase();
      if (c !== String(rule.triggerCategory).toLowerCase()) return false;
    }
    return true;
  }

  function _upsellRuleImpact(rule) {
    var products = _upsellRuleProducts(rule);
    if (!products.length) return { text: 'Regra incompleta: revise antes de ativar.', color: '#D97706' };
    if (rule.benefitType === 'none') return { text: 'Sem benefício: essa regra é apenas uma sugestão, sem incentivo.', color: '#8A7E7C' };
    var minMargin = parseFloat(rule.minMarginPct || _moneyConfig.minMarginPct || 40) || 0;
    var risky = false;
    var attention = false;
    var incomplete = false;
    products.forEach(function (p) {
      var calc = _upsellBenefitCalcForProduct(p, rule);
      if (!calc || !(calc.original > 0)) { incomplete = true; return; }
      if (calc.cost > 0 && calc.final > 0) {
        var margin = calc.marginAfter;
        if (minMargin > 0 && margin < minMargin) risky = true;
        else if (minMargin > 0 && margin < minMargin + 5) attention = true;
      }
    });
    if (incomplete) return { text: 'Regra incompleta: revise antes de ativar.', color: '#D97706' };
    if (risky) return { text: 'Risco: esse upsell pode reduzir demais a margem.', color: '#C4362A' };
    if (attention) return { text: 'Atenção: revise margem ou configuração.', color: '#D97706' };
    return { text: 'Bom upsell: benefício atrativo e margem segura.', color: '#1A9E5A' };
  }

  function _upsellRuleEstimate(rule) {
    var products = _upsellRuleProducts(rule);
    if (!products.length) return '';
    var sum = products.reduce(function (acc, p) {
      var calc = _upsellBenefitCalcForProduct(p, rule);
      var price = calc ? calc.final : _promoBasePrice(p);
      var cost = calc ? calc.cost : _promoCostForProduct(p);
      acc.total += price;
      acc.cost += cost > 0 ? cost : 0;
      return acc;
    }, { total: 0, cost: 0 });
    var profit = sum.cost > 0 ? Math.max(sum.total - sum.cost, 0) : null;
    return profit != null ? '+ ' + UI.fmt(profit) + ' no pedido' : 'Impacto estimado: depende do produto';
  }

  function _upsellRuleTriggerText(rule) {
    var parts = [];
    if (rule.triggerLabel) parts.push(rule.triggerLabel);
    else if (rule.triggerProductIds && rule.triggerProductIds.length) {
      parts.push(rule.triggerProductIds.map(function (id) { var p = (_products || []).find(function (x) { return String(x.id) === String(id); }); return p ? p.name : ''; }).filter(Boolean).join(' · '));
    }
    if (!parts.length) parts.push('Carrinho');
    return parts.join(' · ');
  }

  function _upsellRuleLocationText(rule) {
    return _upsellLocationLabels(rule.locations || []);
  }

  function _upsellRulePeriodText(rule) {
    var s = rule.startDate ? UI.fmtDate(new Date(rule.startDate)) : '—';
    var e = rule.endDate ? UI.fmtDate(new Date(rule.endDate)) : '—';
    return s + ' → ' + e;
  }

  function _upsellCardHtml(raw) {
    var rule = _upsellRule(raw);
    var status = _upsellStatusInfo(rule);
    var perf = _upsellRulePerformance(rule);
    var sales = _upsellSalesStats(rule);
    var impact = _upsellImpactSummary(rule);
    var quality = _upsellAnalysisStatus(rule, sales, impact);
    var perfAlert = _upsellPerfStatus(perf);
    var products = _upsellRuleProducts(rule);
    var trigger = _upsellRuleTriggerText(rule);
    var productText = products.length ? products.slice(0, 2).map(function (p) { return p.name; }).join(' · ') + (products.length > 2 ? ' +' + (products.length - 2) : '') : '—';
    var benefitText = rule.benefitLabel || 'Sem benefício';
    var benefitLine = _upsellBenefitLine(rule, impact);
    var alert = quality.text;
    var analysisTone = quality.color;
    var periodText = _upsellRulePeriodText(rule);
    var salesGrowth = sales.growth == null ? 'Sem base anterior' : (sales.growth >= 0 ? '+' : '') + sales.growth.toFixed(0) + '% vs. 30 dias anteriores';
    var marginText = impact.hasCost && impact.marginAfter != null ? impact.marginAfter.toFixed(1).replace('.', ',') + '%' : '—';
    var impactText = _upsellOrderImpactText(rule, impact);
    var savingsText = impact.discount > 0 ? UI.fmt(impact.discount) : '—';
    var priceLine = impact.productsCount ? ('De ' + UI.fmt(impact.original) + ' por ' + UI.fmt(impact.final)) : '—';
    return '<div class="upsell-card" onclick="Modules.Marketing._openUpsellModal(\'' + _esc(String(rule.id)) + '\', \'view\')" style="display:flex;gap:14px;align-items:flex-start;background:#fff;border:1px solid #EEE6E4;border-radius:16px;padding:14px 16px;box-shadow:0 2px 8px rgba(0,0,0,.05);cursor:pointer;">' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;">' +
          '<div style="min-width:0;flex:1;">' +
            '<div style="font-size:15px;font-weight:800;color:#1A1A1A;line-height:1.25;">' + _esc(rule.name) + '</div>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">' +
              '<span style="font-size:10px;font-weight:900;padding:4px 8px;border-radius:999px;background:' + status.bg + ';color:' + status.color + ';">' + _esc(status.label) + '</span>' +
              '<span style="font-size:10px;font-weight:900;padding:4px 8px;border-radius:999px;background:#EEF4FF;color:#3B82F6;">' + _esc(rule.typeLabel) + '</span>' +
              '<span style="font-size:10px;font-weight:900;padding:4px 8px;border-radius:999px;background:#FFF0EE;color:#C4362A;">' + _esc(benefitText) + '</span>' +
            '</div>' +
            '<div style="margin-top:8px;font-size:12px;font-weight:800;color:' + analysisTone + ';line-height:1.45;">' + _esc(alert) + '</div>' +
            '<div style="margin-top:4px;font-size:12px;color:#8A7E7C;line-height:1.45;">' + _esc(sales.currentOrders > 0 ? ('Vendas vinculadas: ' + sales.currentOrders + ' pedidos · ' + sales.currentItems + ' itens · ' + salesGrowth) : 'Sem base suficiente para analisar vendas.') + '</div>' +
          '</div>' +
          '<div style="text-align:right;min-width:150px;">' +
            '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Benefício</div>' +
            '<div style="font-size:13px;font-weight:800;color:#1A1A1A;">' + _esc(rule.benefitLabel || 'Sem benefício') + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-top:12px;">' +
          '<div style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:12px;padding:10px 12px;"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Disparos</div><div style="font-size:18px;font-weight:900;color:#1A1A1A;margin-top:4px;">' + perf.disparos + '</div><div style="font-size:11px;color:#8A7E7C;">' + _esc(_upsellPerfTrendText(perf.disparos, perf.prev.disparados)) + '</div></div>' +
          '<div style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:12px;padding:10px 12px;"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Cliques</div><div style="font-size:18px;font-weight:900;color:#1A1A1A;margin-top:4px;">' + perf.cliques + '</div><div style="font-size:11px;color:#8A7E7C;">' + _esc(_upsellPerfTrendText(perf.cliques, perf.prev.clicados)) + '</div></div>' +
          '<div style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:12px;padding:10px 12px;"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Carrinho</div><div style="font-size:18px;font-weight:900;color:#1A1A1A;margin-top:4px;">' + perf.adicionados + '</div><div style="font-size:11px;color:#8A7E7C;">' + _esc(_upsellPerfTrendText(perf.adicionados, perf.prev.carrinho)) + '</div></div>' +
          '<div style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:12px;padding:10px 12px;"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Conversões</div><div style="font-size:18px;font-weight:900;color:#1A1A1A;margin-top:4px;">' + perf.conversoes + '</div><div style="font-size:11px;color:#8A7E7C;">' + _esc(_upsellPerfTrendText(perf.conversoes, perf.prev.conversoes)) + '</div></div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:10px;padding:10px 12px;border-radius:12px;background:' + perfAlert.bg + ';border:1px solid #EEE6E4;">' +
          '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Status do upsell</div>' +
          '<div style="font-size:13px;font-weight:800;color:' + perfAlert.tone + ';">' + _esc(perfAlert.text) + '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:12px;">' +
          '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Período</div><div style="font-size:12px;font-weight:700;color:#1A1A1A;">' + _esc(periodText) + '</div></div>' +
          '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Gatilho</div><div style="font-size:12px;font-weight:700;color:#1A1A1A;">' + _esc(trigger) + '</div></div>' +
          '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Sugestão</div><div style="font-size:12px;font-weight:700;color:#1A1A1A;">' + _esc(productText) + '</div></div>' +
          '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Preço / benefício</div><div style="font-size:12px;font-weight:700;color:#1A1A1A;">' + _esc(benefitLine) + '</div></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-top:12px;">' +
          '<div style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;">' +
            '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Impacto estimado</div>' +
            '<div style="font-size:13px;font-weight:800;color:#1A1A1A;margin-top:4px;">' + _esc(impactText) + '</div>' +
          '</div>' +
          '<div style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;">' +
            '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Cliente economiza</div>' +
            '<div style="font-size:13px;font-weight:800;color:#1A1A1A;margin-top:4px;">' + _esc(savingsText) + '</div>' +
          '</div>' +
          '<div style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;">' +
            '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Margem após benefício</div>' +
            '<div style="font-size:13px;font-weight:800;color:#1A1A1A;margin-top:4px;">' + _esc(marginText) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;min-width:180px;">' +
        '<button onclick="event.stopPropagation();Modules.Marketing._openUpsellModal(\'' + _esc(String(rule.id)) + '\', \'view\')" style="padding:7px 12px;border:none;border-radius:12px;background:#F2EDED;color:#1A1A1A;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">Ver detalhes</button>' +
        '<button onclick="event.stopPropagation();Modules.Marketing._openUpsellModal(\'' + _esc(String(rule.id)) + '\', \'edit\')" style="padding:7px 12px;border:none;border-radius:12px;background:#EEF4FF;color:#3B82F6;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">Editar</button>' +
        '<button onclick="event.stopPropagation();Modules.Marketing._toggleUpsellStatus(\'' + _esc(String(rule.id)) + '\')" style="padding:7px 12px;border:none;border-radius:12px;background:' + (status.key === 'active' ? '#FFF8E8' : '#EDFAF3') + ';color:' + (status.key === 'active' ? '#D97706' : '#1A9E5A') + ';font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">' + (status.key === 'active' ? 'Pausar' : 'Ativar') + '</button>' +
        '<button onclick="event.stopPropagation();Modules.Marketing._duplicateUpsell(\'' + _esc(String(rule.id)) + '\')" style="padding:7px 12px;border:none;border-radius:12px;background:#F2EDED;color:#8A7E7C;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">Duplicar</button>' +
        '<button onclick="event.stopPropagation();Modules.Marketing._deleteUpsell(\'' + _esc(String(rule.id)) + '\')" style="padding:7px 12px;border:none;border-radius:12px;background:#FFF0EE;color:#C4362A;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">Excluir</button>' +
      '</div>' +
    '</div>';
  }

  function _upsellEmptyStateHtml() {
    return '<div style="background:#fff;border:1px dashed #E4D7D4;border-radius:16px;padding:28px;text-align:center;">' +
      '<div style="font-size:18px;font-weight:900;color:#1A1A1A;margin-bottom:6px;">Nenhuma sugestão criada ainda</div>' +
      '<div style="font-size:13px;color:#8A7E7C;line-height:1.5;margin-bottom:16px;">Crie sugestões com benefício para aumentar o valor médio dos pedidos.</div>' +
      '<button onclick="Modules.Marketing._openUpsellModal(null, \'edit\')" style="background:#C4362A;color:#fff;border:none;padding:11px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Criar primeira sugestão</button>' + '</div>';
  }

  function _renderUpsell() {
    Promise.all([DB.getAll('upsellRules'), _loadMarketingProducts(), DB.getDocRoot('config', 'dinheiro'), _safeGetAll('orders'), _safeGetAll('upsellEvents')]).then(function (r) {
      try {
        _upsells = (r[0] || []).map(_upsellRule);
        _products = Array.isArray(r[1]) ? r[1] : [];
        _moneyConfig = _normalizeMoneyConfig(r[2] || {});
        _orders = Array.isArray(r[3]) ? r[3] : [];
        _events = Array.isArray(r[4]) ? r[4] : [];
        _paintUpsell();
      } catch (err) {
        console.error('[Marketing] _renderUpsell paint failed', err);
        _upsells = Array.isArray(r[0]) ? r[0].map(_upsellRule) : [];
        _products = Array.isArray(r[1]) ? r[1] : [];
        _moneyConfig = _normalizeMoneyConfig(r[2] || {});
        _orders = Array.isArray(r[3]) ? r[3] : [];
        _events = Array.isArray(r[4]) ? r[4] : [];
        _paintUpsell();
      }
    }).catch(function (err) {
      console.error('[Marketing] _renderUpsell failed', err);
      _upsells = [];
      _products = [];
      _orders = [];
      _events = [];
      _moneyConfig = _normalizeMoneyConfig({});
      _paintUpsell();
    });
  }

  function _paintUpsell() {
    var content = document.getElementById('marketing-content');
    if (!content) return;
    try {
      var filtered = _upsellFilteredList();
      var summary = _upsellSummary(_upsells);
      var perfHtml = '';
      var summaryHtml = '';
      var toolbarHtml = '';
      var cardsHtml = '';
      try { perfHtml = _upsellPerformanceSectionHtml(); } catch (e1) { console.error('[Marketing] upsell perf block failed', e1); perfHtml = ''; }
      try { summaryHtml = _upsellSummaryHtml(summary); } catch (e2) { console.error('[Marketing] upsell summary block failed', e2); summaryHtml = ''; }
      try { toolbarHtml = _upsellToolbarHtml(); } catch (e3) { console.error('[Marketing] upsell toolbar block failed', e3); toolbarHtml = ''; }
      try {
        cardsHtml = filtered.length === 0 ? _upsellEmptyStateHtml() : '<div style="display:flex;flex-direction:column;gap:10px;">' +
          filtered.map(function (u) {
            try {
              return _upsellCardHtml(u);
            } catch (cardErr) {
              console.error('[Marketing] upsell card failed', u && u.id, cardErr);
              return '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:16px;padding:14px 16px;color:#8A7E7C;font-size:13px;">' + _esc(u && u.name ? u.name : 'Upsell') + ' com erro ao renderizar.</div>';
            }
          }).join('') + '</div>';
      } catch (e4) {
        console.error('[Marketing] upsell cards block failed', e4);
        cardsHtml = _upsellEmptyStateHtml();
      }
      content.innerHTML = '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px;">' +
        '<div><h2 style="font-size:20px;font-weight:800;margin-bottom:4px;">Regras de Upsell (' + _upsells.length + ')</h2><p style="font-size:12px;color:#8A7E7C;">Crie, acompanhe e ajuste sugestões com benefício para aumentar o ticket médio.</p></div>' +
        '<button onclick="Modules.Marketing._openUpsellModal(null, \'edit\')" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">' + _subActionLabel() + '</button>' +
        '</div>' +
        perfHtml +
        summaryHtml +
        toolbarHtml +
        cardsHtml;
    } catch (err) {
      console.error('[Marketing] _paintUpsell failed', err);
      content.innerHTML = '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:16px;padding:24px;">' +
        '<div style="font-size:18px;font-weight:900;color:#1A1A1A;margin-bottom:6px;">Upsell carregado com aviso</div>' +
        '<div style="font-size:13px;color:#8A7E7C;line-height:1.5;margin-bottom:14px;">Houve um erro ao montar a lista completa, mas os dados ainda podem ser exibidos parcialmente.</div>' +
        '<button onclick="Modules.Marketing._renderUpsell()" style="background:#C4362A;color:#fff;border:none;padding:10px 16px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Recarregar</button>' +
      '</div>';
    }
  }

  function _upsellProductOptions(selectedIds, triggerOnly) {
    selectedIds = (selectedIds || []).map(String);
    return (_products || []).map(function (p) {
      var selected = selectedIds.indexOf(String(p.id)) >= 0;
      var disabled = triggerOnly && selectedIds.length && !selected;
      var text = [
        p.name || '',
        p.category || p.categoryName || p.categoryLabel || '',
        p.desc || p.shortDesc || '',
        UI.fmt(_promoBasePrice(p))
      ].join(' ').toLowerCase();
      return '<label data-ups-product-text="' + _esc(text) + '" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #EEE6E4;border-radius:12px;background:' + (selected ? '#FFF0EE' : '#fff') + ';cursor:pointer;">' +
        '<input type="checkbox" class="ups-prod-check" data-id="' + _esc(String(p.id)) + '" ' + (selected ? 'checked' : '') + ' onchange="Modules.Marketing._refreshUpsellAnalysis();Modules.Marketing._syncUpsellProductSearch()" style="width:16px;height:16px;accent-color:#C4362A;"' + (disabled ? ' disabled' : '') + '>' +
        '<div style="min-width:0;flex:1;">' +
          '<div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(p.name || 'Produto') + '</div>' +
          '<div style="font-size:11px;color:#8A7E7C;">' + UI.fmt(_promoBasePrice(p)) + '</div>' +
        '</div>' +
      '</label>';
    }).join('');
  }

  function _upsellModalAnalysis(ruleOrType, selectedIds, minMarginPct) {
    var rule = typeof ruleOrType === 'object' ? ruleOrType : { type: ruleOrType };
    rule = _upsellRule(rule);
    var ids = (selectedIds || []).map(String);
    if (!ids.length) return '<div style="font-size:13px;color:#8A7E7C;">Selecione produtos sugeridos para calcular a margem.</div>';
    var items = ids.map(function (id) { return (_products || []).find(function (p) { return String(p.id) === String(id); }); }).filter(Boolean);
    if (!items.length) return '<div style="font-size:13px;color:#8A7E7C;">Selecione produtos sugeridos para calcular a margem.</div>';
    var msg = items.map(function (p) {
      var calc = _upsellBenefitCalcForProduct(p, rule);
      var price = calc ? calc.original : _promoBasePrice(p);
      var final = calc ? calc.final : price;
      var discount = calc ? calc.discount : 0;
      var cost = calc ? calc.cost : _promoCostForProduct(p);
      if (!(price > 0)) return '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;"><div style="font-size:13px;font-weight:800;color:#1A1A1A;">' + _esc(p.name || 'Produto') + '</div><div style="font-size:12px;color:#8A7E7C;margin-top:4px;">Produto sem preço configurado. Não foi possível calcular a margem.</div></div>';
      var profit = cost > 0 ? price - cost : null;
      var profitAfter = cost > 0 ? final - cost : null;
      var margin = cost > 0 ? ((price - cost) / price) * 100 : null;
      var marginAfter = cost > 0 && final > 0 ? ((final - cost) / final) * 100 : null;
      var status = cost <= 0 ? 'Margem não calculada' : marginAfter < minMarginPct ? 'Essa sugestão pode gerar prejuízo ou ficar abaixo da margem mínima.' : marginAfter < minMarginPct + 5 ? 'Essa sugestão está próxima da margem mínima. Revise antes de ativar.' : 'Essa sugestão mantém a margem mínima configurada.';
      return '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;">' +
        '<div style="font-size:13px;font-weight:800;color:#1A1A1A;">' + _esc(p.name || 'Produto') + '</div>' +
        '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">Preço original: ' + UI.fmt(price) + '</div>' +
        '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">Preço com benefício: ' + UI.fmt(final) + '</div>' +
        '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">Desconto aplicado: ' + UI.fmt(discount) + '</div>' +
        '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">Custo: ' + (cost > 0 ? UI.fmt(cost) : '—') + '</div>' +
        '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">Lucro estimado antes: ' + (profit != null ? UI.fmt(profit) : '—') + ' · depois: ' + (profitAfter != null ? UI.fmt(profitAfter) : '—') + '</div>' +
        '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">Margem estimada antes: ' + (margin != null ? margin.toFixed(1).replace('.', ',') + '%' : '—') + ' · depois: ' + (marginAfter != null ? marginAfter.toFixed(1).replace('.', ',') + '%' : '—') + '</div>' +
        '<div style="font-size:12px;color:' + (marginAfter != null && marginAfter < minMarginPct ? '#C4362A' : '#1A9E5A') + ';font-weight:700;margin-top:6px;">' + _esc(status) + '</div>' +
      '</div>';
    }).join('');
    return '<div style="display:flex;flex-direction:column;gap:8px;">' + msg + '</div>';
  }

  function _openUpsellModal(id, mode) {
    _editingId = id;
    var rule = id ? (_upsells.find(function (x) { return String(x.id) === String(id); }) || {}) : { type: 'complemento', active: true, productIds: [], locations: ['detail', 'cart'], priority: 1, displayLimit: 2, message: 'También te puede gustar' };
    rule = _upsellRule(rule);
    var editMode = mode === 'edit' || (!id && mode !== 'view');
    var selectedIds = rule.productIds.slice();
    var body;
    if (editMode) {
      body = '<div style="display:flex;flex-direction:column;gap:14px;">' +
        '<section style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">' +
          '<div style="font-size:18px;font-weight:900;line-height:1.15;color:#1A1A1A;">Dados principais</div>' +
          '<div style="font-size:12px;color:#8A7E7C;margin-top:6px;">Nomeie a regra e escolha a lógica que o cliente vai ver.</div>' +
          '<div style="margin-top:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Nome da regra</label><input id="ups-name" type="text" value="' + _esc(rule.name) + '" placeholder="Ex: Aumentar pedido com bebida" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;"></div>' +
        '</section>' +
        '<section style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">' +
          '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Tipo de upsell</div>' +
          '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">' + ['complemento','upgrade','combo_sugerido','carrinho','valor_minimo'].map(function (t) {
            var info = _upsellTypeInfo(t);
            var active = info.key === rule.type;
            return '<button type="button" data-upstype="' + info.key + '" onclick="Modules.Marketing._selectUpsellType(\'' + info.key + '\')" style="padding:12px;border:1.5px solid ' + (active ? '#C4362A' : '#D4C8C6') + ';border-radius:14px;background:' + (active ? '#FFF0EE' : '#fff') + ';text-align:left;font-family:inherit;cursor:pointer;">' +
              '<div style="display:flex;align-items:center;gap:8px;"><span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:' + (active ? '#C4362A' : '#F2EDED') + ';color:' + (active ? '#fff' : '#8A7E7C') + ';font-size:12px;font-weight:900;">' + _esc(info.label.slice(0,2).toUpperCase()) + '</span><span style="font-size:13px;font-weight:800;color:' + (active ? '#C4362A' : '#1A1A1A') + ';">' + _esc(info.label) + '</span></div>' +
              '<div style="font-size:11px;color:#8A7E7C;margin-top:6px;">' + _esc(info.desc) + '</div>' +
            '</button>';
          }).join('') + '</div>' +
        '</section>' +
        '<section style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">' +
          '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Benefício da sugestão</div>' +
          '<div id="ups-benefit-block">' + _upsellBenefitSectionHtml(rule) + '</div>' +
        '</section>' +
        '<section style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">' +
          '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Configurações da regra</div>' +
          '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">' +
            '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Produto gatilho</label><select id="ups-trigger-product" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:#fff;font-size:13px;font-family:inherit;outline:none;"><option value="">—</option>' + _products.map(function (p) { return '<option value="' + _esc(String(p.id)) + '"' + (rule.triggerProductIds.indexOf(String(p.id)) >= 0 ? ' selected' : '') + '>' + _esc(p.name || 'Produto') + '</option>'; }).join('') + '</select></div>' +
            '<div style="grid-column:1 / -1"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Produtos sugeridos</label><input id="ups-product-search" type="search" placeholder="Buscar produto sugerido..." oninput="Modules.Marketing._setUpsellProductSearch(this.value)" style="width:100%;padding:10px 14px;border:1.5px solid #D4C8C6;border-radius:999px;background:#fff;font-size:13px;font-family:inherit;outline:none;margin-bottom:10px;"><div id="ups-product-count" style="font-size:11px;font-weight:700;color:#8A7E7C;margin:0 0 10px;">' + selectedIds.length + ' produtos selecionados</div><div id="ups-product-list" style="max-height:220px;overflow:auto;border:1px solid #EEE6E4;border-radius:12px;padding:10px;background:#fff;">' + _upsellProductOptions(selectedIds) + '</div></div>' +
            _upsellLocationChooserHtml(rule) +
            '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Momento da exibição</label><select id="ups-moment" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:#fff;font-size:13px;font-family:inherit;outline:none;"><option value="trigger"' + (String(rule.displayMoment || '').toLowerCase() !== 'whatsapp' ? ' selected' : '') + '>Ao acionar o gatilho</option><option value="whatsapp"' + (String(rule.displayMoment || '').toLowerCase() === 'whatsapp' ? ' selected' : '') + '>Ao clicar no WhatsApp</option></select></div>' +
            '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Mensagem ao cliente</label><input id="ups-message" type="text" value="' + _esc(rule.message) + '" placeholder="También te puede gustar" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:#fff;font-size:13px;font-family:inherit;outline:none;"></div>' +
            '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Prioridade</label><input id="ups-priority" type="number" step="1" min="0" value="' + rule.priority + '" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:#fff;font-size:13px;font-family:inherit;outline:none;"></div>' +
            '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Limite de exibição</label><input id="ups-limit" type="number" step="1" min="0" value="' + rule.displayLimit + '" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:#fff;font-size:13px;font-family:inherit;outline:none;"></div>' +
            '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Data de início</label><input id="ups-start" type="date" value="' + (rule.startDate || '') + '" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:#fff;font-size:13px;font-family:inherit;outline:none;"></div>' +
            '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Data de fim</label><input id="ups-end" type="date" value="' + (rule.endDate || '') + '" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:#fff;font-size:13px;font-family:inherit;outline:none;"></div>' +
          '</div>' +
        '</section>' +
        '<section style="background:#fff;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">' +
          '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Produtos selecionados para upsell</div>' +
          '<div style="font-size:13px;color:#8A7E7C;line-height:1.55;margin-bottom:10px;">' + _esc((rule.benefitDesc || '') + ' ' + (rule.benefitExample || '')) + '</div>' +
          '<div id="ups-analysis" style="display:flex;flex-direction:column;gap:8px;">' + _upsellModalAnalysis(rule, selectedIds, parseFloat(rule.minMarginPct || _moneyConfig.minMarginPct || 40) || 40) + '</div>' +
        '</section>' +
      '</div>';
    } else {
      var sales = _upsellSalesStats(rule);
      var impact = _upsellImpactSummary(rule);
      var quality = _upsellAnalysisStatus(rule, sales, impact);
      var productList = _upsellRuleProducts(rule);
      var productText = productList.length ? productList.slice(0, 3).map(function (p) { return p.name; }).join(' · ') + (productList.length > 3 ? ' +' + (productList.length - 3) : '') : '—';
      var benefitLine = _upsellBenefitLine(rule, impact);
      var salesLine = sales.currentOrders > 0
        ? (sales.currentOrders + ' pedidos · ' + sales.currentItems + ' itens · ' + (sales.growth == null ? 'Sem base anterior' : (sales.growth >= 0 ? '+' : '') + sales.growth.toFixed(0) + '% vs. 30 dias anteriores'))
        : 'Sem base suficiente para analisar vendas.';
      var marginText = impact.hasCost && impact.marginAfter != null ? impact.marginAfter.toFixed(1).replace('.', ',') + '%' : '—';
      var impactText = _upsellOrderImpactText(rule, impact);
      var savingsText = impact.discount > 0 ? UI.fmt(impact.discount) : '—';
      body = '<div style="display:flex;flex-direction:column;gap:14px;">' +
        '<section style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">' +
          '<div style="font-size:24px;font-weight:900;line-height:1.1;color:#1A1A1A;">' + _esc(rule.name) + '</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">' +
            '<span style="font-size:10px;font-weight:900;padding:4px 8px;border-radius:999px;background:' + _upsellStatusInfo(rule).bg + ';color:' + _upsellStatusInfo(rule).color + ';">' + _esc(_upsellStatusInfo(rule).label) + '</span>' +
            '<span style="font-size:10px;font-weight:900;padding:4px 8px;border-radius:999px;background:#EEF4FF;color:#3B82F6;">' + _esc(rule.typeLabel) + '</span>' +
            '<span style="font-size:10px;font-weight:900;padding:4px 8px;border-radius:999px;background:#FFF0EE;color:#C4362A;">' + _esc(rule.benefitLabel || 'Sem benefício') + '</span>' +
          '</div>' +
          '<div style="margin-top:10px;font-size:12px;color:#8A7E7C;">' + _esc(quality.text) + '</div>' +
          '<div style="margin-top:4px;font-size:12px;color:#8A7E7C;">' + _esc(salesLine) + '</div>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:12px;">' +
            '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Tipo de upsell</div><div style="font-size:12px;font-weight:700;color:#1A1A1A;">' + _esc(rule.typeLabel) + '</div></div>' +
            '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Tipo de benefício</div><div style="font-size:12px;font-weight:700;color:#1A1A1A;">' + _esc(rule.benefitLabel || 'Sem benefício') + '</div></div>' +
            '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Produto gatilho</div><div style="font-size:12px;font-weight:700;color:#1A1A1A;">' + _esc(_upsellRuleTriggerText(rule)) + '</div></div>' +
            '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Produto sugerido</div><div style="font-size:12px;font-weight:700;color:#1A1A1A;">' + _esc(productText) + '</div></div>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:12px;">' +
            '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Período</div><div style="font-size:12px;font-weight:700;color:#1A1A1A;">' + _esc(_upsellRulePeriodText(rule)) + '</div></div>' +
            '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Locais de exibição</div><div style="font-size:12px;font-weight:700;color:#1A1A1A;">' + _esc(_upsellRuleLocationText(rule)) + '</div></div>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:12px;">' +
            '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;">' +
              '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Preço / benefício</div>' +
              '<div style="font-size:13px;font-weight:800;color:#1A1A1A;margin-top:4px;">' + _esc(benefitLine) + '</div>' +
            '</div>' +
            '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;">' +
              '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Impacto estimado</div>' +
              '<div style="font-size:13px;font-weight:800;color:#1A1A1A;margin-top:4px;">' + _esc(impactText) + '</div>' +
            '</div>' +
            '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;">' +
              '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Cliente economiza</div>' +
              '<div style="font-size:13px;font-weight:800;color:#1A1A1A;margin-top:4px;">' + _esc(savingsText) + '</div>' +
            '</div>' +
            '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;">' +
              '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Margem após benefício</div>' +
              '<div style="font-size:13px;font-weight:800;color:#1A1A1A;margin-top:4px;">' + _esc(marginText) + '</div>' +
            '</div>' +
          '</div>' +
          '<div style="margin-top:12px;font-size:12px;color:#8A7E7C;line-height:1.5;">Mensagem ao cliente: ' + _esc(rule.message || 'También te puede gustar') + '</div>' +
        '</section>' +
        '<section style="background:#fff;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">' +
          '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Resumo de vendas</div>' +
          _upsellSalesSummaryHtml(rule) +
        '</section>' +
        '<section style="background:#fff;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">' +
          '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Impacto por produto</div>' +
          _upsellModalAnalysis(rule, rule.productIds, rule.minMarginPct || _moneyConfig.minMarginPct || 40) +
        '</section>' +
      '</div>';
    }

    var footer = editMode
      ? '<div style="display:flex;gap:10px;flex-wrap:wrap;"><button onclick="Modules.Marketing._saveUpsell()" style="flex:1;min-width:180px;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Salvar alterações</button><button onclick="if(window._upsellModal)window._upsellModal.close()" style="flex:1;min-width:120px;padding:13px;border-radius:11px;border:1.5px solid #D4C8C6;background:#fff;color:#1A1A1A;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Cancelar</button><button onclick="Modules.Marketing._deleteUpsell(\'' + (id || '') + '\')" style="flex:1;min-width:120px;padding:13px;border-radius:11px;border:none;background:#FFF0EE;color:#C4362A;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Excluir sugestão</button></div>'
      : '<div style="display:flex;gap:10px;flex-wrap:wrap;"><button onclick="Modules.Marketing._openUpsellModal(\'' + (id || '') + '\', \'edit\')" style="flex:1;min-width:140px;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Editar</button><button onclick="Modules.Marketing._duplicateUpsell(\'' + (id || '') + '\')" style="flex:1;min-width:120px;padding:13px;border-radius:11px;border:1.5px solid #D4C8C6;background:#fff;color:#1A1A1A;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Duplicar</button><button onclick="Modules.Marketing._toggleUpsellStatus(\'' + (id || '') + '\')" style="flex:1;min-width:120px;padding:13px;border-radius:11px;border:none;background:' + (_upsellStatusInfo(rule).key === 'active' ? '#FFF8E8' : '#EDFAF3') + ';color:' + (_upsellStatusInfo(rule).key === 'active' ? '#D97706' : '#1A9E5A') + ';font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">' + (_upsellStatusInfo(rule).key === 'active' ? 'Pausar' : 'Ativar') + '</button><button onclick="if(window._upsellModal)window._upsellModal.close()" style="flex:1;min-width:120px;padding:13px;border-radius:11px;border:1.5px solid #D4C8C6;background:#fff;color:#1A1A1A;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Fechar</button></div>';

    if (window._upsellModal && typeof window._upsellModal.close === 'function') window._upsellModal.close();
    window._upsellType = rule.type;
    window._upsellBenefit = rule.benefitType || 'none';
    window._upsellActive = rule.active !== false;
    window._upsellBase = rule;
    window._upsellModal = _openUpsellShell({
      title: editMode ? (id ? 'Editar Sugestão' : 'Nova Sugestão') : 'Resumo da Sugestão',
      subtitle: editMode ? 'Ajuste a lógica da sugestão e o benefício mostrado ao cliente.' : 'Visualize o desempenho, o benefício e a configuração da regra.',
      body: body,
      footer: footer,
      maxWidth: editMode ? '1120px' : '980px'
    });
    if (editMode) {
      setTimeout(function () { _syncUpsellBenefitUI(); _refreshUpsellAnalysis(); }, 100);
    }
  }

  function _selectUpsellType(type) {
    window._upsellType = _upsellTypeInfo(type).key;
    window._upsellBenefit = '';
    document.querySelectorAll('[data-upstype]').forEach(function (btn) {
      var active = btn.dataset.upstype === window._upsellType;
      btn.style.borderColor = active ? '#C4362A' : '#D4C8C6';
      btn.style.background = active ? '#FFF0EE' : '#fff';
      btn.style.color = active ? '#C4362A' : '#1A1A1A';
    });
    _syncUpsellBenefitUI();
    _refreshUpsellAnalysis();
  }

  function _selectUpsellBenefit(type) {
    var currentType = String(window._upsellType || '').trim();
    var key = _upsellBenefitInfo(type).key;
    if (!currentType) {
      window._upsellBenefit = '';
      UI.toast('Selecione primeiro o tipo de upsell', 'error');
      return;
    }
    if (key === 'special_price') {
      window._upsellBenefit = '';
      UI.toast('Preço especial é legado. Revise a regra.', 'error');
      _syncUpsellBenefitUI();
      _refreshUpsellAnalysis();
      return;
    }
    if (!_upsellBenefitAllowedForType(currentType, key)) {
      window._upsellBenefit = '';
      UI.toast('Benefício incompatível com o tipo de upsell', 'error');
      _syncUpsellBenefitUI();
      _refreshUpsellAnalysis();
      return;
    }
    window._upsellBenefit = key;
    _syncUpsellBenefitUI();
    _refreshUpsellAnalysis();
  }

  function _pickUpsellBenefit(type, ev) {
    if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
    if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
    _selectUpsellBenefit(type);
    return false;
  }

  function _refreshUpsellAnalysis() {
    var type = window._upsellType || 'complemento';
    var selected = Array.prototype.slice.call(document.querySelectorAll('.ups-prod-check:checked')).map(function (i) { return i.dataset.id; });
    var host = document.getElementById('ups-analysis');
    if (host) host.innerHTML = _upsellModalAnalysis(window._upsellBase || { type: type, benefitType: window._upsellBenefit || 'none' }, selected, parseFloat((window._upsellBase && window._upsellBase.minMarginPct) || _moneyConfig.minMarginPct || 40) || 40);
    _syncUpsellProductSearch();
    _syncUpsellBenefitDetails();
    _syncUpsellBenefitReference();
  }

  function _setUpsellProductSearch(value) {
    _upsellUi.productQuery = String(value || '');
    _syncUpsellProductSearch();
  }

  function _syncUpsellProductSearch() {
    var query = String(_upsellUi.productQuery || '').trim().toLowerCase();
    var rows = document.querySelectorAll('#ups-product-list label');
    Array.prototype.forEach.call(rows, function (row) {
      var text = String(row.dataset.upsProductText || row.textContent || '').toLowerCase();
      row.style.display = !query || text.indexOf(query) >= 0 ? 'flex' : 'none';
    });
    var count = document.getElementById('ups-product-count');
    if (count) count.textContent = Array.prototype.slice.call(document.querySelectorAll('.ups-prod-check:checked')).length + ' produtos selecionados';
  }

  function _upsellBenefitReferenceHtml(rule, selectedProducts, currentBenefit) {
    rule = _upsellRule(rule || {});
    var current = typeof currentBenefit === 'string' ? currentBenefit.trim() : String(window._upsellBenefit || rule.benefitType || '').trim();
    var selected = Array.isArray(selectedProducts) && selectedProducts.length ? selectedProducts : _upsellRuleProducts(rule);
    if (selected.length) {
      return '<div style="grid-column:1 / -1;background:#fff;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;font-size:12px;color:#1A1A1A;line-height:1.55;">' +
        '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:8px;">Produtos selecionados para upsell</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px;">' + selected.map(function (p) {
          var calc = _upsellBenefitCalcForProduct(p, Object.assign({}, rule, { benefitType: current || rule.benefitType }));
          if (!calc) {
            return '<div style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;"><div style="font-size:13px;font-weight:800;color:#1A1A1A;">' + _esc(p.name || 'Produto') + '</div><div style="font-size:12px;color:#8A7E7C;margin-top:4px;">Produto sem preço configurado. Não foi possível calcular a margem.</div></div>';
          }
          return '<div style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:12px;padding:12px 14px;">' +
            '<div style="font-size:13px;font-weight:800;color:#1A1A1A;">' + _esc(p.name || 'Produto') + '</div>' +
            '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">Preço original: ' + UI.fmt(calc.original) + '</div>' +
            '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">Preço com benefício: ' + UI.fmt(calc.final) + '</div>' +
            '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">Economia do cliente: ' + UI.fmt(calc.discount) + '</div>' +
            '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">Margem estimada: ' + (calc.marginAfter != null ? calc.marginAfter.toFixed(1).replace('.', ',') + '%' : '—') + '</div>' +
          '</div>';
        }).join('') + '</div>' +
      '</div>';
    }
    if (current && current !== 'none') {
      return '<div style="grid-column:1 / -1;background:#FFF8F6;border:1px dashed #E4D7D4;border-radius:12px;padding:12px 14px;font-size:12px;color:#8A7E7C;line-height:1.5;">Selecione produtos sugeridos para calcular o impacto por item.</div>';
    }
    return '';
  }

  function _syncUpsellBenefitReference() {
    var host = document.getElementById('ups-benefit-reference');
    if (!host) return;
    var selected = Array.prototype.slice.call(document.querySelectorAll('.ups-prod-check:checked')).map(function (i) {
      return (_products || []).find(function (p) { return String(p.id) === String(i.dataset.id); }) || null;
    }).filter(Boolean);
    host.innerHTML = _upsellBenefitReferenceHtml(window._upsellBase || {}, selected, window._upsellBenefit || '');
  }

  function _syncUpsellBenefitDetails() {
    var giftKind = String((document.getElementById('ups-gift-condition-type') || {}).value || '').trim();
    document.querySelectorAll('[data-ups-gift-extra]').forEach(function (el) {
      var key = el.getAttribute('data-ups-gift-extra');
      if (key === 'note') return;
      el.style.display = giftKind === key ? 'block' : 'none';
    });
    var cartKind = String((document.getElementById('ups-cart-benefit') || {}).value || '').trim();
    document.querySelectorAll('[data-ups-cart-extra]').forEach(function (el) {
      var key = el.getAttribute('data-ups-cart-extra');
      if (key === 'value') {
        el.style.display = (cartKind === 'pct' || cartKind === 'eur') ? 'block' : 'none';
      } else if (key === 'gift') {
        el.style.display = cartKind === 'gift' ? 'block' : 'none';
      }
    });
    _syncUpsellBenefitReference();
  }

  function _saveUpsell() {
    var name = (document.getElementById('ups-name') || {}).value || '';
    if (!name) { UI.toast('Nome é obrigatório', 'error'); return; }
    var upsellType = String(window._upsellType || 'complemento').trim();
    var selected = Array.prototype.slice.call(document.querySelectorAll('.ups-prod-check:checked')).map(function (i) { return i.dataset.id; }).filter(Boolean);
    var triggerProductId = (document.getElementById('ups-trigger-product') || {}).value || '';
    var benefitType = String(window._upsellBenefit || ((document.getElementById('ups-benefit-type') || {}).value || '')).trim();
    var benefitValue = _promoNumber((document.getElementById('ups-benefit-value') || {}).value) || 0;
    var specialPrice = _promoNumber((document.getElementById('ups-special-price') || {}).value);
    var finalUpsellPrice = _promoNumber((document.getElementById('ups-final-price') || {}).value);
    var giftProductId = (document.getElementById('ups-gift-product') || {}).value || '';
    var giftConditionType = (document.getElementById('ups-gift-condition-type') || {}).value || 'trigger';
    var giftQty = parseInt((document.getElementById('ups-gift-qty') || {}).value, 10) || 0;
    var giftMinCartValue = _promoNumber((document.getElementById('ups-gift-min-cart') || {}).value) || 0;
    var minCartValue = _promoNumber((document.getElementById('ups-cart-min') || {}).value) || 0;
    var cartGoalBenefit = (document.getElementById('ups-cart-benefit') || {}).value || '';
    var cartGoalBenefitValue = _promoNumber((document.getElementById('ups-cart-benefit-value') || {}).value) || 0;
    var cartGoalGiftProductId = (document.getElementById('ups-cart-gift-product') || {}).value || '';
    var cartGoalMessage = (document.getElementById('ups-cart-message') || {}).value || '';
    var displayMoment = (document.getElementById('ups-moment') || {}).value || 'trigger';
    var bundleQty = parseInt((document.getElementById('ups-bundle-qty') || {}).value, 10) || 0;
    var bundlePay = parseInt((document.getElementById('ups-bundle-pay') || {}).value, 10) || 0;
    var locations = Array.prototype.slice.call(document.querySelectorAll('.ups-location-check:checked')).map(function (i) { return i.dataset.location; }).filter(Boolean);
    if (!upsellType) { UI.toast('Tipo de upsell é obrigatório', 'error'); return; }
    if (!benefitType) { UI.toast('Tipo de benefício é obrigatório', 'error'); return; }
    if (benefitType === 'special_price' || !_upsellBenefitAllowedForType(upsellType, benefitType)) { UI.toast('Benefício incompatível com o tipo de upsell', 'error'); return; }
    if (benefitType === 'gift' && !giftProductId && selected[0]) giftProductId = selected[0];
    if (benefitType === 'pct' && !(benefitValue > 0)) { UI.toast('Informe o desconto em %', 'error'); return; }
    if (benefitType === 'eur' && !(benefitValue > 0)) { UI.toast('Informe o desconto em €', 'error'); return; }
    if (benefitType === 'combo_fixed' && !(finalUpsellPrice > 0)) { UI.toast('Informe o preço final do combo', 'error'); return; }
    if (benefitType === 'bundle_less_pay_more' && !(bundleQty > bundlePay && bundlePay > 0)) { UI.toast('Leve precisa ser maior que Pague', 'error'); return; }
    if (benefitType === 'gift' && !giftProductId && !selected.length) { UI.toast('Selecione o produto do brinde', 'error'); return; }
    if (benefitType === 'gift' && giftConditionType === 'qty' && !(giftQty > 0)) { UI.toast('Informe a quantidade mínima', 'error'); return; }
    if (benefitType === 'gift' && giftConditionType === 'mincart' && !(giftMinCartValue > 0)) { UI.toast('Informe o valor mínimo para o brinde', 'error'); return; }
    if ((benefitType === 'cart_goal' || benefitType === 'frete') && !(minCartValue > 0)) { UI.toast('Informe o valor mínimo do carrinho', 'error'); return; }
    if (benefitType === 'cart_goal' && cartGoalBenefit === 'gift' && !cartGoalGiftProductId && !selected.length) { UI.toast('Selecione o produto do brinde', 'error'); return; }
    if (benefitType === 'cart_goal' && (cartGoalBenefit === 'pct' || cartGoalBenefit === 'eur') && !(cartGoalBenefitValue > 0)) { UI.toast('Informe o valor do benefício', 'error'); return; }
    var legacyTriggerCategory = String((window._upsellBase && window._upsellBase.triggerCategory) || (window._upsellBase && window._upsellBase.trigger_category) || (window._upsellBase && window._upsellBase.categoryTrigger) || '').trim();
    if (upsellType !== 'valor_minimo' && upsellType !== 'carrinho' && !triggerProductId && !legacyTriggerCategory) { UI.toast('Selecione o produto gatilho', 'error'); return; }
    if (!selected.length) { UI.toast('Selecione ao menos um produto sugerido', 'error'); return; }
    if (!locations.length) { UI.toast('Selecione ao menos um local de exibição', 'error'); return; }
    var data = {
      name: name.trim(),
      title: name.trim(),
      type: upsellType || 'complemento',
      benefitType: benefitType,
      benefitValue: benefitValue,
      finalUpsellPrice: finalUpsellPrice,
      giftProductId: giftProductId,
      giftConditionType: giftConditionType,
      giftQty: giftQty,
      giftMinCartValue: giftMinCartValue,
      giftCondition: giftConditionType,
      bundleQty: bundleQty,
      bundlePay: bundlePay,
      minCartValue: minCartValue,
      cartGoalBenefit: cartGoalBenefit,
      cartGoalBenefitType: cartGoalBenefit,
      cartGoalBenefitValue: cartGoalBenefitValue,
      cartGoalGiftProductId: cartGoalGiftProductId,
      cartGoalMessage: cartGoalMessage || 'También te puede gustar',
      displayMoment: displayMoment,
      active: window._upsellActive !== false,
      productId: selected[0] || '',
      productIds: selected,
      suggestedProductIds: selected,
      triggerProductId: triggerProductId,
      triggerCategory: legacyTriggerCategory,
      triggerProductIds: [triggerProductId].filter(Boolean),
      displayLocations: locations.join(', '),
      locations: locations,
      message: (document.getElementById('ups-message') || {}).value || 'También te puede gustar',
      startDate: (document.getElementById('ups-start') || {}).value || '',
      endDate: (document.getElementById('ups-end') || {}).value || '',
      priority: parseInt((document.getElementById('ups-priority') || {}).value, 10) || 0,
      displayLimit: parseInt((document.getElementById('ups-limit') || {}).value, 10) || 0,
      minMarginPct: parseFloat((window._upsellBase && window._upsellBase.minMarginPct) || _moneyConfig.minMarginPct || 40) || 40,
      promotionId: (document.getElementById('ups-promo') || {}).value || '',
      channels: Array.isArray(window._upsellBase && window._upsellBase.channels) ? window._upsellBase.channels.slice() : [],
      autoTag: _upsellTypeInfo(window._upsellType || 'complemento').tag,
      benefitTag: _upsellBenefitInfo(benefitType).tag
    };
    if (data.type === 'complemento' || data.type === 'upgrade' || data.type === 'combo_sugerido' || data.type === 'carrinho' || data.type === 'valor_minimo') {
      // no extra constraint here; template handles visibility rules
    }
    var op = _editingId ? DB.update('upsellRules', _editingId, data) : DB.add('upsellRules', data);
    op.then(function () {
      UI.toast('Sugestão salva!', 'success');
      if (window._upsellModal) window._upsellModal.close();
      _renderUpsell();
      if (Modules.Catalogo && typeof Modules.Catalogo._refreshProductPromotions === 'function') Modules.Catalogo._refreshProductPromotions();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _toggleUpsellStatus(id) {
    var u = (_upsells || []).find(function (x) { return String(x.id) === String(id); });
    if (!u) return;
    DB.update('upsellRules', id, { active: u.active === false }).then(function () {
      _renderUpsell();
    });
  }

  function _duplicateUpsell(id) {
    var u = (_upsells || []).find(function (x) { return String(x.id) === String(id); });
    if (!u) return;
    var copy = {};
    Object.keys(u).forEach(function (k) {
      if (k === 'id' || k === 'createdAt' || k === 'updatedAt') return;
      copy[k] = u[k];
    });
    copy.name = (u.name || 'Sugestão') + ' (cópia)';
    copy.active = false;
    DB.add('upsellRules', copy).then(function () {
      UI.toast('Sugestão duplicada', 'success');
      _renderUpsell();
    });
  }

  function _deleteUpsell(id) {
    UI.confirm('Eliminar esta sugestão?').then(function (yes) {
      if (!yes) return;
      DB.remove('upsellRules', id).then(function () {
        UI.toast('Eliminado', 'info');
        _renderUpsell();
      });
    });
  }

  // ── AVALIAÇÕES ────────────────────────────────────────────────────────────
  function _renderAvaliacoes() {
    DB.getAll('reviews').then(function (data) {
      _reviews = (data || []).sort(function (a, b) {
        var ta = _reviewDateValue(a.createdAt || a.approvedAt || a.updatedAt);
        var tb = _reviewDateValue(b.createdAt || b.approvedAt || b.updatedAt);
        return tb - ta;
      });
      _paintAvaliacoes();
    });
  }

  function _paintAvaliacoes() {
    var content = document.getElementById('marketing-content');
    if (!content) return;
    var filtered = _reviewFilteredList();
    var summary = _reviewSummary(filtered);
    var pending = summary.pending;
    var avg = summary.avg ? summary.avg.toFixed(1) : '0.0';
    var reviewNote = summary.total ? (summary.approved + ' aprovadas no template · ' + summary.replied + ' com resposta') : 'As avaliações aprovadas aparecem na página pública.';
    var toolbar = _reviewToolbarHtml(summary);
    var statsHtml = '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px;">' +
      '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:14px;padding:12px 14px;box-shadow:0 2px 8px rgba(0,0,0,.04);"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Total</div><div style="font-size:22px;font-weight:900;color:#1A1A1A;margin-top:4px;">' + summary.total + '</div><div style="font-size:11px;color:#8A7E7C;margin-top:3px;">Avaliações no período</div></div>' +
      '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:14px;padding:12px 14px;box-shadow:0 2px 8px rgba(0,0,0,.04);"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Aprovadas</div><div style="font-size:22px;font-weight:900;color:#1A1A1A;margin-top:4px;">' + summary.approved + '</div><div style="font-size:11px;color:#8A7E7C;margin-top:3px;">Visíveis no template</div></div>' +
      '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:14px;padding:12px 14px;box-shadow:0 2px 8px rgba(0,0,0,.04);"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Pendentes</div><div style="font-size:22px;font-weight:900;color:#1A1A1A;margin-top:4px;">' + pending + '</div><div style="font-size:11px;color:#8A7E7C;margin-top:3px;">Aguardando análise</div></div>' +
      '<div style="background:' + (summary.total ? '#EDFAF3' : '#F2EDED') + ';border:1px solid #EEE6E4;border-radius:14px;padding:12px 14px;box-shadow:0 2px 8px rgba(0,0,0,.04);"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Média</div><div style="font-size:22px;font-weight:900;color:#1A1A1A;margin-top:4px;">' + avg + '</div><div style="font-size:11px;color:#8A7E7C;margin-top:3px;">' + summary.replied + ' respondidas</div></div>' +
    '</div>';
    var header = '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px;">' +
      '<div><h2 style="font-size:20px;font-weight:800;margin-bottom:4px;">Gerar confiança (' + _reviews.length + ')</h2><p style="font-size:12px;color:#8A7E7C;line-height:1.5;">Modere avaliações, responda comentários e mantenha no template apenas o que passa confiança.</p></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button onclick="Modules.Marketing._reviewAction()" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Abrir página pública</button>' +
      '</div>' +
    '</div>';
    var body = _reviews.length === 0
      ? '<div style="background:#fff;border:1px dashed #E4D7D4;border-radius:16px;padding:28px;text-align:center;">' +
          '<div style="font-size:18px;font-weight:900;color:#1A1A1A;margin-bottom:6px;">Nenhuma avaliação ainda</div>' +
          '<div style="font-size:13px;color:#8A7E7C;line-height:1.5;margin-bottom:16px;">As avaliações aprovadas aparecem no template e ajudam a gerar confiança.</div>' +
          '<button onclick="Modules.Marketing._reviewAction()" style="background:#C4362A;color:#fff;border:none;padding:11px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Abrir página pública</button>' +
        '</div>'
      : (filtered.length === 0
        ? '<div style="background:#fff;border:1px dashed #E4D7D4;border-radius:16px;padding:28px;text-align:center;"><div style="font-size:18px;font-weight:900;color:#1A1A1A;margin-bottom:6px;">Nenhum resultado para este filtro</div><div style="font-size:13px;color:#8A7E7C;line-height:1.5;">Ajuste busca, status ou período para ver avaliações.</div></div>'
        : '<div style="display:flex;flex-direction:column;gap:12px;">' + filtered.map(_reviewCardHtml).join('') + '</div>');
    content.innerHTML = header + statsHtml + toolbar + body;
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
    _openPromoModal: _openPromoModal, _selectPromoType: _selectPromoType, _togglePromoActive: _togglePromoActive, _togglePromoStatus: _togglePromoStatus, _duplicatePromo: _duplicatePromo, _savePromo: _savePromo, _togglePromo: _togglePromo, _deletePromo: _deletePromo,
    _refreshPromoPreview: _refreshPromoPreview, _filterPromoProducts: _filterPromoProducts, _setPromoSearch: _setPromoSearch, _setPromoStatus: _setPromoStatus, _setPromoTypeFilter: _setPromoTypeFilter, _setPromoPeriod: _setPromoPeriod, _setPromoPeriodStart: _setPromoPeriodStart, _setPromoPeriodEnd: _setPromoPeriodEnd,
    _openCuponModal: _openCuponModal, _saveCupon: _saveCupon, _deleteCupon: _deleteCupon,
    _openUpsellModal: _openUpsellModal, _saveUpsell: _saveUpsell, _deleteUpsell: _deleteUpsell, _toggleUpsellStatus: _toggleUpsellStatus, _duplicateUpsell: _duplicateUpsell, _refreshUpsellAnalysis: _refreshUpsellAnalysis, _selectUpsellType: _selectUpsellType,
    _setUpsellProductSearch: _setUpsellProductSearch, _syncUpsellProductSearch: _syncUpsellProductSearch,
    _selectUpsellBenefit: _selectUpsellBenefit, _pickUpsellBenefit: _pickUpsellBenefit, _approveReview: _approveReview, _rejectReview: _rejectReview, _replyReview: _replyReview, _saveReply: _saveReply, _reviewAction: _reviewAction,
    _pointsConfigData: _pointsConfigData, _pointsRefresh: _pointsRefresh, _pointsOrderBlockHtml: _pointsOrderBlockHtml, _pointsApplyDiscount: _pointsApplyDiscount, _pointsGrantForOrder: _pointsGrantForOrder, _openPointsConfigModal: _openPointsConfigModal, _savePointsConfig: _savePointsConfig
  };
})();
