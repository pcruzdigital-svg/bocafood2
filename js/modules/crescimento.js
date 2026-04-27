// js/modules/crescimento.js
window.Modules = window.Modules || {};
Modules.Crescimento = (function () {
  'use strict';

  var _activeSub = 'metas';
  var _data = {};

  var TABS = [
    { key: 'metas', label: 'Metas' },
    { key: 'operacao', label: 'Operação' },
    { key: 'marketing', label: 'Marketing' }
  ];

  function render(sub) {
    _activeSub = sub || 'metas';
    var app = document.getElementById('app');
    app.innerHTML = '<section class="module-page">' +
      '<div class="module-head"><div><h1>Crescimento</h1><p>Metas e indicadores para evoluir operação e marketing.</p></div></div>' +
      '<div id="growth-tabs" class="module-tabs"></div>' +
      '<div id="growth-content" class="module-content"><div class="loading-inline">Carregando...</div></div>' +
      '</section>';
    _renderTabs();
    _load().then(_renderSub);
  }

  function _renderTabs() {
    var el = document.getElementById('growth-tabs');
    if (!el) return;
    el.innerHTML = TABS.map(function (t) {
      return '<button class="' + (t.key === _activeSub ? 'active' : '') + '" onclick="Modules.Crescimento._switchSub(\'' + t.key + '\')">' + t.label + '</button>';
    }).join('');
  }

  function _switchSub(key) {
    _activeSub = key;
    _renderTabs();
    _renderSub();
    Router.navigate('crescimento/' + key);
  }

  function _load() {
    return Promise.all([
      DB.getAll('orders'),
      DB.getAll('financeiro_entradas'),
      DB.getAll('financeiro_saidas'),
      DB.getAll('store_customers'),
      DB.getAll('promotions'),
      DB.getAll('coupons'),
      DB.getDocRoot('config', 'metas')
    ]).then(function (r) {
      _data = {
        orders: r[0] || [],
        entradas: r[1] || [],
        saidas: r[2] || [],
        customers: r[3] || [],
        promos: r[4] || [],
        coupons: r[5] || [],
        metas: r[6] || {}
      };
    });
  }

  function _renderSub() {
    if (_activeSub === 'metas') return _renderMetas();
    if (_activeSub === 'operacao') return _renderOperacao();
    if (_activeSub === 'marketing') return _renderMarketing();
  }

  function _monthItems(items) {
    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth(), 1);
    return (items || []).filter(function (item) {
      var d = item.date ? new Date(item.date) : (item.createdAt && item.createdAt.toDate ? item.createdAt.toDate() : null);
      return d && d >= start;
    });
  }

  function _renderMetas() {
    var entradas = _monthItems(_data.entradas);
    var saidas = _monthItems(_data.saidas);
    var orders = _monthItems(_data.orders);
    var revenue = entradas.reduce(function (s, e) { return s + (parseFloat(e.valor) || 0); }, 0);
    var costs = saidas.reduce(function (s, e) { return s + (parseFloat(e.valor) || 0); }, 0);
    var goal = parseFloat(_data.metas.revenueGoal) || 0;
    var pct = goal > 0 ? Math.min(100, revenue / goal * 100) : 0;

    _content('<div class="growth-grid">' +
      _kpi('Receita do mês', UI.fmt(revenue), goal ? Math.round(pct) + '% da meta' : 'Meta não definida') +
      _kpi('Pedidos do mês', orders.length, 'Ticket médio ' + UI.fmt(orders.length ? revenue / orders.length : 0)) +
      _kpi('Lucro estimado', UI.fmt(revenue - costs), 'Receitas menos saídas') +
      '</div>' +
      '<div class="settings-card"><div class="settings-card-head"><h2>Meta mensal</h2><p>Defina a meta principal de faturamento.</p></div>' +
      '<label class="field"><span>Meta de receita (€)</span><input id="growth-revenue-goal" type="number" step="0.01" value="' + (_data.metas.revenueGoal || '') + '"></label>' +
      '<div class="progress-line"><span style="width:' + pct + '%"></span></div>' +
      '<button class="primary-action" onclick="Modules.Crescimento._saveMetas()">Salvar meta</button></div>');
  }

  function _renderOperacao() {
    var orders = _monthItems(_data.orders);
    var pending = orders.filter(function (o) { return (o.status || 'Pendente') === 'Pendente'; }).length;
    var canceled = orders.filter(function (o) { return o.status === 'Cancelado'; }).length;
    var delivery = orders.filter(function (o) { return o.type === 'delivery'; }).length;
    _content('<div class="growth-grid">' +
      _kpi('Pendentes', pending, 'Aguardando confirmação') +
      _kpi('Cancelados', canceled, 'No mês atual') +
      _kpi('Entregas', delivery, 'Pedidos delivery') +
      '</div>' +
      '<div class="settings-card"><div class="settings-card-head"><h2>Foco operacional</h2><p>Use estes indicadores para ajustar horários, preparo e zonas.</p></div>' +
      '<button class="secondary-action" onclick="Router.navigate(\'operacao/status\')">Abrir operação</button></div>');
  }

  function _renderMarketing() {
    var activePromos = (_data.promos || []).filter(function (p) { return p.active !== false; }).length;
    var activeCoupons = (_data.coupons || []).filter(function (c) {
      return !c.expiry || new Date(c.expiry) >= new Date();
    }).length;
    _content('<div class="growth-grid">' +
      _kpi('Clientes', (_data.customers || []).length, 'Base cadastrada') +
      _kpi('Promoções ativas', activePromos, 'Campanhas em uso') +
      _kpi('Cupons válidos', activeCoupons, 'Disponíveis para venda') +
      '</div>' +
      '<div class="settings-card"><div class="settings-card-head"><h2>Foco de marketing</h2><p>Acompanhe campanhas e ações de aumento de ticket.</p></div>' +
      '<button class="secondary-action" onclick="Router.navigate(\'marketing/promocoes\')">Abrir marketing</button></div>');
  }

  function _saveMetas() {
    var revenueGoal = parseFloat((document.getElementById('growth-revenue-goal') || {}).value) || 0;
    DB.setDocRoot('config', 'metas', { revenueGoal: revenueGoal }).then(function () {
      _data.metas.revenueGoal = revenueGoal;
      UI.toast('Meta salva', 'success');
      _renderMetas();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _content(html) {
    var el = document.getElementById('growth-content');
    if (el) el.innerHTML = html;
  }

  function _kpi(label, value, sub) {
    return '<div class="kpi-tile"><span>' + label + '</span><strong>' + value + '</strong><small>' + sub + '</small></div>';
  }

  function destroy() {}

  return { render: render, destroy: destroy, _switchSub: _switchSub, _saveMetas: _saveMetas };
})();
