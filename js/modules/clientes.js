// js/modules/clientes.js
window.Modules = window.Modules || {};
Modules.Clientes = (function () {
  'use strict';

  var _clientes = [];
  var _orders = [];
  var _reviews = [];
  var _canais = [];
  var _pointsMovements = [];
  var _pointsConfig = { earnPerEuro: 1, redeemRate: 10, minimumPointsToUse: 50, maxDiscountPct: 20 };
  var _view = [];
  var _editingId = null;
  var _filters = { q: '', status: '', segment: '', origin: '' };

  function render() {
    var app = document.getElementById('app');
    app.innerHTML = '<section class="module-page">' +
      '<div class="module-head"><div><h1>Clientes</h1><p>Base de clientes, histórico de compras, preferências e ações de relacionamento.</p></div>' +
      '<button onclick="Modules.Clientes._openModal(null)" style="' + _primaryBtn() + '">+ Novo Cliente</button></div>' +
      '<div id="clientes-content" class="module-content"><div class="loading-inline">Carregando...</div></div>' +
      '</section>';
    _load();
  }

  function _load() {
    Promise.all([
      DB.getAll('store_customers'),
      DB.getAll('orders'),
      DB.getAll('reviews'),
      DB.getDocRoot ? DB.getDocRoot('config', 'canais_venda').catch(function () { return null; }) : Promise.resolve(null),
      DB.getDocRoot ? DB.getDocRoot('config', 'pontos_program').catch(function () { return null; }) : Promise.resolve(null),
      DB.getAll('points_movements').catch(function () { return []; })
    ]).then(function (r) {
      _clientes = (r[0] || []).sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
      _orders = r[1] || [];
      _reviews = r[2] || [];
      _canais = _normalizeCanais(r[3]);
      _pointsConfig = _normalizePointsConfig(r[4] || {});
      _pointsMovements = Array.isArray(r[5]) ? r[5] : [];
      _buildView();
      _paint();
    }).catch(function (err) {
      var el = document.getElementById('clientes-content');
      if (el) el.innerHTML = UI.emptyState('Erro ao carregar clientes: ' + err.message, '❌');
    });
  }

  function _buildView() {
    _view = _clientes.map(function (c) {
      var orders = _ordersForClient(c);
      var stats = _stats(c, orders);
      return Object.assign({}, c, { _orders: orders, _stats: stats });
    });
    _view.sort(function (a, b) {
      return (b._stats.lastOrderTs || 0) - (a._stats.lastOrderTs || 0) || (a.name || '').localeCompare(b.name || '');
    });
  }

  function _paint() {
    var root = document.getElementById('clientes-content');
    if (!root) return;
    var data = _filtered();
    root.innerHTML = _kpis() +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:18px 0 14px;">' +
      '<input id="cli-search" value="' + _esc(_filters.q) + '" oninput="Modules.Clientes._setFilter(\'q\', this.value)" placeholder="Pesquisar por nome, telefone, email, canal, tag ou endereço..." style="min-width:260px;flex:1;padding:12px 16px;border:1.5px solid #D4C8C6;border-radius:22px;font-size:14px;font-family:inherit;outline:none;background:#fff;">' +
      '<select id="cli-status-filter" onchange="Modules.Clientes._setFilter(\'status\', this.value)" style="' + _smallSelect() + '">' + _filterOptions(['', 'ativo', 'recorrente', 'inativo', 'bloqueado'], _filters.status, 'Status') + '</select>' +
      '<select id="cli-segment-filter" onchange="Modules.Clientes._setFilter(\'segment\', this.value)" style="' + _smallSelect() + '">' + _filterOptions(['', 'novo', 'recorrente', 'vip', 'inativo', 'sem_pedido'], _filters.segment, 'Segmento') + '</select>' +
      '<select id="cli-origin-filter" onchange="Modules.Clientes._setFilter(\'origin\', this.value)" style="' + _smallSelect() + '">' + _originOptions(_filters.origin) + '</select>' +
      '</div>' +
      '<div id="clientes-list">' + _list(data) + '</div>';
  }

  function _kpis() {
    var total = _view.length;
    var recurrent = _view.filter(function (c) { return c._stats.ordersCount >= 2; }).length;
    var inactive = _view.filter(function (c) { return c._stats.segment === 'inativo'; }).length;
    var valid = _view.filter(function (c) { return c._stats.ordersCount > 0; });
    var avgTicket = valid.length ? valid.reduce(function (s, c) { return s + c._stats.avgTicket; }, 0) / valid.length : 0;
    var optIn = _view.filter(function (c) { return c.acceptsMarketing === true; }).length;
    return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;">' +
      _kpi('Clientes', total, 'base cadastrada') +
      _kpi('Recorrentes', recurrent, '2+ pedidos') +
      _kpi('Inativos', inactive, 'sem compra recente') +
      _kpi('Ticket médio', valid.length ? UI.fmt(avgTicket) : 'sem dados', valid.length + ' cliente(s) com pedido') +
      _kpi('Aceitam marketing', optIn, 'WhatsApp/campanhas') +
      '</div>';
  }

  function _list(data) {
    if (!data.length) return UI.emptyState('Nenhum cliente encontrado', '👥');
    return '<div style="display:flex;flex-direction:column;gap:12px;">' + data.map(_rowHTML).join('') + '</div>';
  }

  function _rowHTML(c) {
    var s = c._stats;
    var initials = _initials(c.name);
    var wa = _whatsUrl(c.phone, 'Hola ' + (c.name || '') + ', ¿todo bien?');
    var contact = _contactHTML(c, 'Hola ' + (c.name || '') + ', ¿todo bien?');
    var address = _clientAddress(c);
    return '<div class="cliente-card" onclick="Modules.Clientes._openProfile(\'' + c.id + '\')" style="background:#fff;border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,.06);padding:14px 16px;display:grid;grid-template-columns:auto 1.6fr 1fr auto;gap:14px;align-items:center;cursor:pointer;">' +
      '<div style="width:54px;height:54px;border-radius:15px;background:' + _avatarColor(c.name) + ';color:#fff;font-family:\'League Spartan\',sans-serif;font-size:18px;font-weight:900;display:flex;align-items:center;justify-content:center;">' + _esc(initials) + '</div>' +
      '<div style="min-width:0;">' +
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><strong style="font-size:16px;">' + _esc(c.name || 'Cliente') + '</strong>' + _segmentBadge(s.segment) + _statusBadge(c.status) + '</div>' +
      '<div style="font-size:12px;color:#8A7E7C;margin-top:3px;">' + (contact || 'Sem contato') + '</div>' +
      (address ? '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;display:flex;gap:4px;align-items:center;min-width:0;"><span class="mi" style="font-size:14px;color:#C4362A;">location_on</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + _esc(address) + '</span></div>' : '') +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:7px;">' + _tags(c.tags).map(function (t) { return UI.badge(t, 'gray'); }).join('') + '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(80px,1fr));gap:8px;min-width:280px;">' +
      _miniMetric('Pedidos', s.ordersCount || 0) +
      _miniMetric('Total', s.ordersCount ? UI.fmt(s.totalSpent) : '-') +
      _miniMetric('Ticket', s.ordersCount ? UI.fmt(s.avgTicket) : '-') +
      '</div>' +
      '<div style="display:flex;gap:7px;align-items:center;" onclick="event.stopPropagation();">' +
      (c.phone ? '<a href="' + wa + '" target="_blank" style="' + _iconBtn('#E9F8EF', '#1A9E5A') + '" title="WhatsApp"><span class="mi" style="font-size:16px;">chat</span></a>' : '') +
      '<button onclick="Modules.Clientes._openHistory(\'' + c.id + '\')" style="' + _iconBtn('#EEF4FF', '#2563EB') + '" title="Histórico"><span class="mi" style="font-size:16px;">history</span></button>' +
      '<button onclick="Modules.Clientes._openModal(\'' + c.id + '\')" style="' + _iconBtn('#F2EDED', '#1A1A1A') + '" title="Editar"><span class="mi" style="font-size:16px;">edit</span></button>' +
      '</div></div>';
  }

  function _openModal(id) {
    _editingId = id;
    var c = id ? (_clientes.find(function (x) { return x.id === id; }) || {}) : { status: 'ativo', origin: _defaultChannel(), acceptsMarketing: false, country: 'España' };
    var selectedChannel = c.mainChannel || c.channelName || c.channel || c.origin || _defaultChannel();
    var body = '<div>' +
      '<div style="background:#F8F6F5;border-radius:14px;padding:14px;margin-bottom:14px;">' +
      '<div style="' + _sectionTitle() + '">Dados do cliente</div>' +
      '<div style="display:grid;grid-template-columns:1.3fr .8fr .9fr;gap:12px;margin-bottom:12px;">' +
      _field('cli-name', 'Nome completo *', c.name || '') +
      _field('cli-phone', 'Telefone / WhatsApp', c.phone || '') +
      _field('cli-email', 'E-mail', c.email || '', 'email') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;">' +
      _select('cli-status', 'Status', _simpleOptions(['ativo', 'recorrente', 'inativo', 'bloqueado'], c.status || 'ativo')) +
      _select('cli-origin', 'Canal principal', _channelOptions(selectedChannel)) +
      _field('cli-fiscal', 'NIF / CIF', c.nifCif || c.fiscalId || '') +
      _field('cli-bday', 'Aniversário', c.birthday || '', 'date') +
      '</div></div>' +
      '<div style="background:#F8F6F5;border-radius:14px;padding:14px;margin-bottom:14px;">' +
      '<div style="' + _sectionTitle() + '">Endereço e entrega</div>' +
      _field('cli-address', 'Endereço principal', c.address || '') +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:12px;">' +
      _field('cli-hood', 'Bairro / zona', c.neighborhood || c.zone || '') +
      _field('cli-zip', 'Código postal', c.postalCode || '') +
      _select('cli-state', 'Estado / província', _stateOptions(c.state || c.province || '')) +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 2fr;gap:12px;margin-top:12px;">' +
      _select('cli-country', 'País', _countryOptions(c.country || 'España')) +
      _field('cli-reference', 'Referência / complemento', c.reference || c.complement || '') +
      '</div></div>' +
      '<div style="background:#F8F6F5;border-radius:14px;padding:14px;margin-bottom:14px;">' +
      '<div style="' + _sectionTitle() + '">Marketing e relacionamento</div>' +
      '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;margin-bottom:12px;"><input id="cli-marketing" type="checkbox" ' + (c.acceptsMarketing ? 'checked' : '') + ' style="accent-color:#C4362A;width:16px;height:16px;"> Aceita receber promoções</label>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
      _field('cli-tags', 'Tags', _tags(c.tags).join(', ')) +
      _field('cli-preferences', 'Preferências', c.preferences || '') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">' +
      _field('cli-allergies', 'Alergias / restrições', c.allergies || '') +
      _field('cli-points', 'Pontos de fidelidade', c.points || 0, 'number') +
      '</div></div>' +
      _textarea('cli-notes', 'Observações internas', c.notes || c.internalNotes || '') +
      '</div>';
    var footer = '<div style="display:flex;gap:10px;">' +
      (id ? '<button onclick="Modules.Clientes._deleteCliente(\'' + id + '\')" style="padding:13px 18px;border-radius:11px;border:none;background:#FFF0EE;color:#C4362A;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;"><span class="mi" style="font-size:17px;">delete</span></button>' : '') +
      '<button onclick="Modules.Clientes._saveCliente()" style="flex:1;' + _primaryBtn() + '">' + (id ? 'Atualizar cliente' : 'Adicionar cliente') + '</button>' +
      '</div>';
    window._clienteModal = UI.modal({ title: id ? 'Editar cliente' : 'Novo cliente', body: body, footer: footer, maxWidth: '920px' });
  }

  function _saveCliente() {
    var name = _val('cli-name').trim();
    if (!name) { UI.toast('Nome é obrigatório', 'error'); return; }
    if (!_validPhone(_val('cli-phone'))) { UI.toast('Telefone inválido. Use apenas números com DDD/código do país.', 'error'); return; }
    if (!_validEmail(_val('cli-email'))) { UI.toast('E-mail inválido', 'error'); return; }
    if (!_validFiscalId(_val('cli-fiscal'))) { UI.toast('NIF/CIF inválido. Verifique o formato espanhol.', 'error'); return; }
    if (!_validPostalCode(_val('cli-zip'), _val('cli-country'))) { UI.toast('Código postal inválido para Espanha. Use 5 números.', 'error'); return; }
    var current = _editingId ? (_clientes.find(function (c) { return c.id === _editingId; }) || {}) : {};
    var channel = _val('cli-origin') || _defaultChannel();
    var data = {
      name: name,
      phone: _val('cli-phone'),
      email: _val('cli-email'),
      status: _val('cli-status') || 'ativo',
      origin: channel,
      mainChannel: channel,
      channelName: channel,
      nifCif: _val('cli-fiscal'),
      fiscalId: _val('cli-fiscal'),
      birthday: _val('cli-bday'),
      address: _val('cli-address'),
      neighborhood: _val('cli-hood'),
      zone: _val('cli-hood'),
      postalCode: _val('cli-zip'),
      state: _val('cli-state'),
      province: _val('cli-state'),
      country: _val('cli-country'),
      reference: _val('cli-reference'),
      acceptsMarketing: _checked('cli-marketing'),
      tags: _tags(_val('cli-tags')),
      preferences: _val('cli-preferences'),
      allergies: _val('cli-allergies'),
      points: parseInt(_val('cli-points') || '0', 10) || 0,
      notes: _val('cli-notes'),
      ordersCount: current.ordersCount || 0,
      totalSpent: current.totalSpent || 0
    };
    var op = _editingId ? DB.update('store_customers', _editingId, data) : DB.add('store_customers', data);
    op.then(function () {
      UI.toast(_editingId ? 'Cliente atualizado!' : 'Cliente adicionado!', 'success');
      if (window._clienteModal) window._clienteModal.close();
      _load();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _openProfile(id) {
    var c = _view.find(function (x) { return x.id === id; });
    if (!c) return;
    var s = c._stats;
    var contact = _contactHTML(c, 'Hola ' + (c.name || '') + ', tenemos una novedad para ti.');
    var address = _clientAddress(c);
    var body = '<div>' +
      '<div style="display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;margin-bottom:16px;">' +
      '<div style="width:64px;height:64px;border-radius:18px;background:' + _avatarColor(c.name) + ';color:#fff;font-size:22px;font-weight:900;display:flex;align-items:center;justify-content:center;">' + _esc(_initials(c.name)) + '</div>' +
      '<div><h2 style="font-size:22px;font-weight:900;margin-bottom:4px;">' + _esc(c.name || 'Cliente') + '</h2><div style="color:#8A7E7C;font-size:13px;">' + (contact || 'Sem contato') + '</div>' + (address ? '<div style="color:#8A7E7C;font-size:13px;margin-top:4px;"><span class="mi" style="font-size:15px;color:#C4362A;vertical-align:-2px;">location_on</span> ' + _esc(address) + '</div>' : '') + '</div>' +
      '<button onclick="Modules.Clientes._openModal(\'' + c.id + '\')" style="' + _primaryBtn() + '">Editar</button>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px;">' +
      _kpi('Pedidos', s.ordersCount, 'histórico') +
      _kpi('Total comprado', s.ordersCount ? UI.fmt(s.totalSpent) : '-', 'todos os pedidos') +
      _kpi('Ticket médio', s.ordersCount ? UI.fmt(s.avgTicket) : '-', 'por pedido') +
      _kpi('Último pedido', s.lastOrderLabel || '-', s.segmentLabel) +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">' +
      '<div style="' + _panel() + '"><h3 style="' + _h3() + '">Perfil</h3>' +
      _info('Canal principal', c.mainChannel || c.channelName || c.channel || c.origin || '-') + _info('Status', c.status || s.segmentLabel) + _info('NIF / CIF', c.nifCif || c.fiscalId || '-') + _infoHTML('Telefone / WhatsApp', c.phone ? _phoneLink(c, 'Hola ' + (c.name || '') + ', tenemos una novedad para ti.') : '-') + _info('Endereço', address || '-') + _info('Preferências', c.preferences || '-') + _info('Alergias', c.allergies || '-') + '</div>' +
      '<div style="' + _panel() + '"><h3 style="' + _h3() + '">Ações rápidas</h3>' +
      (c.phone ? '<a href="' + _whatsUrl(c.phone, 'Hola ' + (c.name || '') + ', tenemos una novedad para ti.') + '" target="_blank" style="' + _actionLink('#E9F8EF', '#1A9E5A') + '"><span class="mi">chat</span> Abrir WhatsApp</a>' : '') +
      '<button onclick="Modules.Clientes._openHistory(\'' + c.id + '\')" style="' + _actionButton('#EEF4FF', '#2563EB') + '"><span class="mi">history</span> Ver histórico</button>' +
      '<button onclick="Modules.Clientes._openSegmentFlow(\'' + c.id + '\')" style="' + _actionButton('#FFF8F1', '#B45309') + '"><span class="mi">timeline</span> Ver fluxo do segmento</button>' +
      '</div></div>' +
      _pointsHistoryHTML(c) +
      _topProductsHTML(s.topProducts) +
      _reviewsHTML(c) +
      '</div>';
    UI.modal({ title: 'Cliente', body: body, maxWidth: '900px' });
  }

  function _openHistory(id) {
    var c = _view.find(function (x) { return x.id === id; });
    if (!c) return;
    var orders = c._orders || [];
    var body = '<div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:16px;">' +
      _kpi('Pedidos', orders.length, 'do cliente') +
      _kpi('Total', orders.length ? UI.fmt(c._stats.totalSpent) : '-', 'comprado') +
      _kpi('Ticket médio', orders.length ? UI.fmt(c._stats.avgTicket) : '-', 'por pedido') +
      '</div>' +
      (orders.length ? '<div style="display:flex;flex-direction:column;gap:8px;">' + orders.map(_orderRow).join('') + '</div>' : UI.emptyState('Nenhum pedido encontrado', '📦')) +
      '</div>';
    UI.modal({ title: 'Histórico - ' + (c.name || 'Cliente'), body: body, maxWidth: '720px' });
  }

  function _openSegmentFlow(id) {
    var c = _view.find(function (x) { return x.id === id; }) || _clientes.find(function (x) { return x.id === id; });
    if (!c) return;
    var orders = c._orders || _ordersForClient(c);
    var stats = c._stats || _stats(c, orders);
    var events = _segmentEvents(c, orders);
    var body = '<div>' +
      '<div style="display:grid;grid-template-columns:1.1fr 1fr;gap:14px;margin-bottom:14px;">' +
      '<div style="' + _panel() + '"><h3 style="' + _h3() + '">Segmento atual</h3>' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' + _segmentBadge(stats.segment) + '<strong style="font-size:18px;">' + _esc(stats.segmentLabel) + '</strong></div>' +
      '<div style="font-size:13px;color:#8A7E7C;line-height:1.45;">' + _esc(_segmentReason(c, stats)) + '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px;">' +
      _miniMetric('Pedidos', stats.ordersCount) +
      _miniMetric('Total', stats.ordersCount ? UI.fmt(stats.totalSpent) : '-') +
      _miniMetric('Último pedido', stats.lastOrderLabel || '-') +
      '</div></div>' +
      '<div style="' + _panel() + '"><h3 style="' + _h3() + '">Regras do segmento</h3>' +
      _ruleRow('Novo', '1 pedido válido') +
      _ruleRow('Recorrente', '2 ou mais pedidos válidos') +
      _ruleRow('VIP', '5+ pedidos ou €100+ em compras') +
      _ruleRow('Inativo', 'mais de 60 dias sem comprar') +
      _ruleRow('Sem pedido', 'cliente cadastrado sem pedido válido') +
      '</div></div>' +
      '<div style="' + _panel() + '"><h3 style="' + _h3() + '">Fluxo do segmento</h3>' +
      '<div style="font-size:12px;color:#8A7E7C;margin-bottom:8px;">Histórico calculado automaticamente com base em pedidos, total comprado, última compra e status do cliente.</div>' +
      (events.length ? events.map(_segmentEventRow).join('') : '<div style="padding:12px;border:1px dashed #D4C8C6;border-radius:12px;color:#8A7E7C;text-align:center;">Ainda não há eventos suficientes para montar o fluxo.</div>') +
      '<button onclick="Modules.Clientes._setFilter(\'segment\', \'' + stats.segment + '\')" style="' + _actionButton('#FFF8F1', '#B45309') + '"><span class="mi">filter_alt</span> Filtrar clientes deste segmento</button>' +
      '</div>' +
      '</div>';
    UI.modal({ title: 'Segmento - ' + (c.name || 'Cliente'), body: body, maxWidth: '860px' });
  }

  function _deleteCliente(id) {
    UI.confirm('Eliminar este cliente?').then(function (yes) {
      if (!yes) return;
      DB.remove('store_customers', id).then(function () {
        UI.toast('Cliente eliminado', 'info');
        if (window._clienteModal) window._clienteModal.close();
        _load();
      });
    });
  }

  function _setFilter(key, value) {
    _filters[key] = value || '';
    _paint();
  }

  function _filtered() {
    var q = (_filters.q || '').toLowerCase();
    return _view.filter(function (c) {
      var s = c._stats || {};
      var haystack = [c.name, c.phone, c.email, c.nifCif, c.fiscalId, c.neighborhood, c.zone, c.postalCode, c.state, c.province, c.country, c.origin, c.mainChannel, c.channelName, c.channel, c.status, _tags(c.tags).join(' '), c.preferences, c.allergies].join(' ').toLowerCase();
      if (q && haystack.indexOf(q) < 0) return false;
      if (_filters.status && String(c.status || s.segment) !== _filters.status) return false;
      if (_filters.segment && s.segment !== _filters.segment) return false;
      if (_filters.origin && String(c.mainChannel || c.channelName || c.channel || c.origin || '') !== _filters.origin) return false;
      return true;
    });
  }

  function _ordersForClient(c) {
    var id = String(c.id || '');
    var name = _clean(c.name);
    var phone = _phone(c.phone);
    var email = _clean(c.email);
    return (_orders || []).filter(function (o) {
      if (id && String(o.customerId || o.clientId || '') === id) return true;
      if (phone && _phone(o.phone || o.customerPhone || o.whatsapp) === phone) return true;
      if (email && _clean(o.email || o.customerEmail) === email) return true;
      if (name && _clean(o.customerName || o.clientName || o.name) === name) return true;
      return false;
    }).sort(function (a, b) { return _dateTs(b) - _dateTs(a); });
  }

  function _stats(c, orders) {
    var valid = (orders || []).filter(function (o) {
      var st = String(o.status || '').toLowerCase();
      return st !== 'cancelado' && st !== 'canceled' && st !== 'cancelled';
    });
    var total = valid.reduce(function (s, o) { return s + _num(o.total || o.amount || o.grandTotal); }, 0);
    var count = valid.length;
    var last = valid[0] || null;
    var days = last ? Math.floor((Date.now() - _dateTs(last)) / 86400000) : null;
    var freq = {};
    valid.forEach(function (o) {
      (o.items || []).forEach(function (item) {
        var name = item.name || item.nome || item.title || 'Produto';
        freq[name] = (freq[name] || 0) + (_num(item.qty || item.quantity) || 1);
      });
    });
    var topProducts = Object.keys(freq).map(function (k) { return [k, freq[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5);
    var segment = 'sem_pedido';
    if (String(c.status || '') === 'bloqueado') segment = 'bloqueado';
    else if (!count) segment = 'sem_pedido';
    else if (days !== null && days > 60) segment = 'inativo';
    else if (total >= 100 || count >= 5) segment = 'vip';
    else if (count >= 2) segment = 'recorrente';
    else segment = 'novo';
    return {
      ordersCount: count,
      totalSpent: total,
      avgTicket: count ? total / count : 0,
      lastOrderTs: last ? _dateTs(last) : 0,
      lastOrderLabel: last ? _fmtDate(last) : '',
      daysSinceLast: days,
      segment: segment,
      segmentLabel: _segmentLabel(segment),
      topProducts: topProducts
    };
  }

  function _segmentEvents(c, orders) {
    var valid = (orders || []).filter(function (o) {
      var st = String(o.status || '').toLowerCase();
      return st !== 'cancelado' && st !== 'canceled' && st !== 'cancelled';
    }).sort(function (a, b) { return _dateTs(a) - _dateTs(b); });
    var events = [];
    var created = _dateTs(c);
    if (created) {
      events.push({ ts: created, segment: 'sem_pedido', title: 'Cliente cadastrado', text: 'Entrada criada na base de clientes.' });
    }
    var total = 0;
    var vipByValue = false;
    valid.forEach(function (o, idx) {
      var count = idx + 1;
      var amount = _num(o.total || o.amount || o.grandTotal);
      total += amount;
      if (count === 1) {
        events.push({ ts: _dateTs(o), segment: 'novo', title: 'Primeiro pedido', text: 'Cliente passa a ter histórico de compra. Pedido de ' + UI.fmt(amount) + '.' });
      }
      if (count === 2) {
        events.push({ ts: _dateTs(o), segment: 'recorrente', title: 'Cliente recorrente', text: 'Atingiu 2 pedidos válidos.' });
      }
      if (count === 5) {
        events.push({ ts: _dateTs(o), segment: 'vip', title: 'Cliente VIP por frequência', text: 'Atingiu 5 pedidos válidos.' });
      }
      if (!vipByValue && total >= 100) {
        vipByValue = true;
        events.push({ ts: _dateTs(o), segment: 'vip', title: 'Cliente VIP por valor', text: 'Atingiu ' + UI.fmt(total) + ' em compras acumuladas.' });
      }
    });
    var lastOrder = valid.length ? valid[valid.length - 1] : null;
    var lastOrderTs = lastOrder ? _dateTs(lastOrder) : 0;
    var daysSinceLast = lastOrderTs ? Math.floor((Date.now() - lastOrderTs) / 86400000) : null;
    if (String(c.status || '') !== 'bloqueado' && lastOrderTs && daysSinceLast > 60) {
      events.push({ ts: lastOrderTs + 60 * 86400000, segment: 'inativo', title: 'Cliente inativo', text: 'Mais de 60 dias sem novo pedido. Último pedido em ' + _fmtDate(lastOrder) + '.' });
    }
    if (String(c.status || '') === 'bloqueado') {
      events.push({ ts: _dateTs(c) || Date.now(), segment: 'bloqueado', title: 'Status bloqueado', text: 'Status marcado manualmente no cadastro do cliente.' });
    }
    if (!valid.length && !created) {
      events.push({ ts: 0, segment: 'sem_pedido', title: 'Sem pedidos', text: 'Cliente ainda não possui pedidos válidos vinculados.' });
    }
    return events.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
  }

  function _segmentReason(c, s) {
    if (String(c.status || '') === 'bloqueado') return 'O cliente está com status bloqueado no cadastro.';
    if (!s.ordersCount) return 'Cliente cadastrado, mas ainda sem pedidos válidos vinculados.';
    if (s.segment === 'inativo') return 'Último pedido há ' + s.daysSinceLast + ' dias. Acima do limite de 60 dias sem compra.';
    if (s.segment === 'vip') return 'Cliente com ' + s.ordersCount + ' pedidos válidos e ' + UI.fmt(s.totalSpent) + ' em compras acumuladas.';
    if (s.segment === 'recorrente') return 'Cliente com ' + s.ordersCount + ' pedidos válidos. A partir de 2 pedidos entra como recorrente.';
    return 'Cliente com primeiro pedido válido registrado.';
  }

  function _ruleRow(label, text) {
    return '<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px solid #F2EDED;"><strong style="font-size:13px;">' + _esc(label) + '</strong><span style="font-size:12px;color:#8A7E7C;text-align:right;">' + _esc(text) + '</span></div>';
  }

  function _segmentEventRow(e) {
    return '<div style="display:grid;grid-template-columns:96px 1fr;gap:12px;padding:11px 0;border-top:1px solid #F2EDED;">' +
      '<div style="font-size:11px;color:#8A7E7C;font-weight:900;">' + _esc(e.ts ? UI.fmtDate(new Date(e.ts)) : '-') + '</div>' +
      '<div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' + _segmentBadge(e.segment) + '<strong style="font-size:14px;">' + _esc(e.title) + '</strong></div>' +
      '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;line-height:1.4;">' + _esc(e.text) + '</div></div>' +
      '</div>';
  }

  function _topProductsHTML(items) {
    if (!items || !items.length) return '';
    return '<div style="' + _panel() + 'margin-top:14px;"><h3 style="' + _h3() + '">Produtos mais comprados</h3><div style="display:flex;gap:8px;flex-wrap:wrap;">' +
      items.map(function (p) { return '<span style="padding:7px 11px;border-radius:18px;background:#F2EDED;font-size:12px;font-weight:800;">' + _esc(p[0]) + ' x' + p[1] + '</span>'; }).join('') +
      '</div></div>';
  }

  function _reviewsHTML(c) {
    var name = _clean(c.name);
    var rows = (_reviews || []).filter(function (r) {
      return String(r.customerId || '') === String(c.id || '') || (name && _clean(r.customerName || r.name) === name);
    }).slice(0, 3);
    if (!rows.length) return '';
    return '<div style="' + _panel() + 'margin-top:14px;"><h3 style="' + _h3() + '">Avaliações</h3>' + rows.map(function (r) {
      return '<div style="padding:10px 0;border-top:1px solid #F2EDED;"><strong>' + _esc(r.rating || r.stars || '-') + ' estrelas</strong><div style="font-size:12px;color:#8A7E7C;">' + _esc(r.comment || r.text || '') + '</div></div>';
    }).join('') + '</div>';
  }

  function _orderRow(o) {
    var items = (o.items || []).map(function (i) { return (i.qty || i.quantity || 1) + 'x ' + (i.name || i.nome || 'Produto'); }).join(', ');
    return '<div style="background:#fff;border:1px solid #F2EDED;border-radius:12px;padding:12px;display:flex;justify-content:space-between;gap:12px;align-items:center;">' +
      '<div><strong>' + _esc(o.status || 'Pendente') + '</strong><div style="font-size:12px;color:#8A7E7C;">' + _esc(_fmtDate(o)) + (items ? ' · ' + _esc(items) : '') + '</div></div>' +
      '<strong style="color:#C4362A;">' + UI.fmt(_num(o.total || o.amount || o.grandTotal)) + '</strong></div>';
  }

  function _originOptions(selected) {
    var origins = _channelNames();
    (_clientes || []).forEach(function (c) {
      var v = c.mainChannel || c.channelName || c.channel || c.origin;
      if (v && origins.indexOf(v) < 0) origins.push(v);
    });
    return '<option value="">Canal principal</option>' + origins.map(function (o) { return '<option value="' + _esc(o) + '"' + (selected === o ? ' selected' : '') + '>' + _esc(_title(o)) + '</option>'; }).join('');
  }

  function _normalizeCanais(raw) {
    var list = raw && Array.isArray(raw.list) ? raw.list : [];
    var names = ['Cardápio', 'Loja própria', 'WhatsApp'];
    list.forEach(function (c) {
      var name = c && (c.name || c.nome || c.label);
      if (name && names.indexOf(name) < 0) names.push(name);
    });
    return names.map(function (name) { return { name: name }; });
  }

  function _channelNames() {
    var names = (_canais || []).map(function (c) { return c.name || c.nome || c.label; }).filter(Boolean);
    return names.length ? names : ['Cardápio', 'Loja própria', 'WhatsApp'];
  }

  function _defaultChannel() {
    var names = _channelNames();
    return names.indexOf('Cardápio') >= 0 ? 'Cardápio' : names[0];
  }

  function _channelOptions(selected) {
    return _channelNames().map(function (name) {
      return '<option value="' + _esc(name) + '"' + (selected === name ? ' selected' : '') + '>' + _esc(_title(name)) + '</option>';
    }).join('');
  }

  function _stateOptions(selected) {
    var states = ['', 'Álava', 'Albacete', 'Alicante', 'Almería', 'Asturias', 'Ávila', 'Badajoz', 'Barcelona', 'Burgos', 'Cáceres', 'Cádiz', 'Cantabria', 'Castellón', 'Ciudad Real', 'Córdoba', 'A Coruña', 'Cuenca', 'Girona', 'Granada', 'Guadalajara', 'Gipuzkoa', 'Huelva', 'Huesca', 'Illes Balears', 'Jaén', 'León', 'Lleida', 'Lugo', 'Madrid', 'Málaga', 'Murcia', 'Navarra', 'Ourense', 'Palencia', 'Las Palmas', 'Pontevedra', 'La Rioja', 'Salamanca', 'Santa Cruz de Tenerife', 'Segovia', 'Sevilla', 'Soria', 'Tarragona', 'Teruel', 'Toledo', 'Valencia', 'Valladolid', 'Bizkaia', 'Zamora', 'Zaragoza', 'Ceuta', 'Melilla'];
    return states.map(function (s, idx) { return '<option value="' + _esc(s) + '"' + (selected === s ? ' selected' : '') + '>' + _esc(idx === 0 ? 'Selecionar...' : s) + '</option>'; }).join('');
  }

  function _countryOptions(selected) {
    var countries = ['España', 'Portugal', 'Francia', 'Italia', 'Alemania', 'Países Bajos', 'Bélgica', 'Reino Unido', 'Irlanda', 'Otro'];
    return countries.map(function (c) { return '<option value="' + _esc(c) + '"' + (selected === c ? ' selected' : '') + '>' + _esc(c) + '</option>'; }).join('');
  }

  function _filterOptions(values, selected, empty) {
    return values.map(function (v, idx) {
      return '<option value="' + _esc(v) + '"' + (selected === v ? ' selected' : '') + '>' + (idx === 0 ? empty : _esc(_segmentLabel(v))) + '</option>';
    }).join('');
  }

  function _simpleOptions(values, selected) {
    return values.map(function (v) { return '<option value="' + _esc(v) + '"' + (selected === v ? ' selected' : '') + '>' + _esc(_title(v)) + '</option>'; }).join('');
  }

  function _segmentLabel(v) {
    return ({ novo: 'Novo', recorrente: 'Recorrente', vip: 'VIP', inativo: 'Inativo', sem_pedido: 'Sem pedido', ativo: 'Ativo', bloqueado: 'Bloqueado' })[v] || _title(v || '');
  }

  function _segmentBadge(v) {
    var color = v === 'vip' ? 'orange' : v === 'recorrente' ? 'green' : v === 'inativo' ? 'gray' : v === 'bloqueado' ? 'red' : 'blue';
    return UI.badge(_segmentLabel(v), color);
  }

  function _statusBadge(status) {
    if (!status) return '';
    if (status === 'ativo') return '';
    return UI.badge(_segmentLabel(status), status === 'bloqueado' ? 'red' : 'gray');
  }

  function _tags(raw) {
    if (Array.isArray(raw)) return raw.map(function (x) { return String(x).trim(); }).filter(Boolean);
    return String(raw || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  }

  function _normalizePointsConfig(raw) {
    raw = raw || {};
    return {
      earnPerEuro: Math.max(1, Math.round(_pointsNumber(raw.earnPerEuro != null ? raw.earnPerEuro : raw.pointsPerEuro != null ? raw.pointsPerEuro : 1) || 1)),
      redeemRate: Math.max(1, Math.round(_pointsNumber(raw.redeemRate != null ? raw.redeemRate : raw.pointsPerDiscountEuro != null ? raw.pointsPerDiscountEuro : 10) || 10)),
      minimumPointsToUse: Math.max(0, Math.round(_pointsNumber(raw.minimumPointsToUse != null ? raw.minimumPointsToUse : 50) || 50)),
      maxDiscountPct: Math.max(0, Math.min(100, _pointsNumber(raw.maxDiscountPct != null ? raw.maxDiscountPct : 20) || 20))
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

  function _pointsBalance(c) {
    return Math.max(0, Math.floor(_pointsNumber(c && (c.points != null ? c.points : c.pointsBalance != null ? c.pointsBalance : 0))));
  }

  function _pointsAvailableDiscount(c) {
    var cfg = _pointsConfig || { redeemRate: 10, maxDiscountPct: 20 };
    return Math.floor(_pointsBalance(c) / Math.max(1, cfg.redeemRate || 10));
  }

  function _pointsMovementDate(v) {
    if (!v) return 0;
    if (v && typeof v.toDate === 'function') return v.toDate().getTime();
    var d = new Date(v);
    return isFinite(d.getTime()) ? d.getTime() : 0;
  }

  function _pointsMovementsForClient(c) {
    var id = String(c && c.id || '');
    var phone = String(c && c.phone || c && c.whatsapp || '').replace(/\D/g, '');
    var name = _clean(c && c.name || '');
    return (_pointsMovements || []).filter(function (m) {
      if (id && String(m.customerId || m.clientId || '') === id) return true;
      if (phone && String(m.phone || '').replace(/\D/g, '') === phone) return true;
      if (name && _clean(m.customerName || m.name || '') === name) return true;
      return false;
    }).sort(function (a, b) { return _pointsMovementDate(b.createdAt || b.date || b.updatedAt) - _pointsMovementDate(a.createdAt || a.date || a.updatedAt); });
  }

  function _pointsHistoryHTML(c) {
    var balance = _pointsBalance(c);
    var available = _pointsAvailableDiscount(c);
    var movements = _pointsMovementsForClient(c).slice(0, 6);
    return '<div style="' + _panel() + 'margin-top:14px;"><h3 style="' + _h3() + '">Histórico de Pontos</h3>' +
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px;">' +
        _miniMetric('Saldo', balance + ' pts') +
        _miniMetric('Desconto disponível', UI.fmt(available)) +
        _miniMetric('Movimentos', movements.length) +
      '</div>' +
      (movements.length ? '<div style="display:flex;flex-direction:column;gap:8px;">' + movements.map(function (m) {
        var ts = _pointsMovementDate(m.createdAt || m.date || m.updatedAt);
        var type = String(m.type || '') === 'used' ? 'Uso' : 'Ganho';
        var value = String(m.type || '') === 'used' ? '-' + _pointsNumber(m.pointsUsed != null ? m.pointsUsed : m.points || 0) + ' pts' : '+' + _pointsNumber(m.pointsEarned != null ? m.pointsEarned : m.points || 0) + ' pts';
        return '<div style="display:grid;grid-template-columns:96px 1fr auto;gap:10px;padding:10px 0;border-top:1px solid #F2EDED;align-items:center;">' +
          '<div style="font-size:11px;color:#8A7E7C;font-weight:900;">' + _esc(ts ? UI.fmtDate(new Date(ts)) : '-') + '</div>' +
          '<div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><strong style="font-size:13px;">' + _esc(type) + '</strong>' + UI.badge(m.orderDisplay || m.orderId || 'Pedido', String(m.type || '') === 'used' ? 'orange' : 'green') + '</div>' +
            '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;line-height:1.4;">Pontos ganhos: ' + _pointsNumber(m.pointsEarned || 0) + ' · Pontos usados: ' + _pointsNumber(m.pointsUsed || 0) + ' · Desconto: ' + UI.fmt(_pointsNumber(m.discountValue || 0)) + '</div></div>' +
          '<div style="text-align:right;"><div style="font-size:14px;font-weight:900;color:' + (String(m.type || '') === 'used' ? '#C4362A' : '#1A9E5A') + ';">' + _esc(value) + '</div><div style="font-size:11px;color:#8A7E7C;">Saldo final: ' + _pointsNumber(m.balanceAfter || 0) + '</div></div>' +
        '</div>';
      }).join('') : '<div style="font-size:13px;color:#8A7E7C;">Ainda sem movimentos.</div>') +
    '</div>';
  }

  function _miniMetric(label, value) { return '<div style="background:#F8F6F5;border-radius:10px;padding:9px;"><div style="font-size:10px;color:#8A7E7C;font-weight:900;text-transform:uppercase;">' + label + '</div><strong style="font-size:14px;">' + value + '</strong></div>'; }
  function _kpi(label, value, sub) { return '<div class="kpi-tile"><span>' + label + '</span><strong>' + value + '</strong><small>' + _esc(sub || '') + '</small></div>'; }
  function _info(label, value) { return '<div style="padding:8px 0;border-top:1px solid #F2EDED;"><div style="font-size:10px;color:#8A7E7C;font-weight:900;text-transform:uppercase;">' + label + '</div><div style="font-size:13px;font-weight:700;">' + _esc(value || '-') + '</div></div>'; }
  function _infoHTML(label, html) { return '<div style="padding:8px 0;border-top:1px solid #F2EDED;"><div style="font-size:10px;color:#8A7E7C;font-weight:900;text-transform:uppercase;">' + label + '</div><div style="font-size:13px;font-weight:700;">' + (html || '-') + '</div></div>'; }
  function _field(id, label, value, type) { return '<div><label style="' + _label() + '">' + label + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + _esc(value == null ? '' : value) + '" style="' + _input() + '"></div>'; }
  function _textarea(id, label, value) { return '<div><label style="' + _label() + '">' + label + '</label><textarea id="' + id + '" style="' + _input() + 'min-height:92px;resize:vertical;">' + _esc(value || '') + '</textarea></div>'; }
  function _select(id, label, options) { return '<div><label style="' + _label() + '">' + label + '</label><select id="' + id + '" style="' + _input() + 'background:#fff;">' + options + '</select></div>'; }
  function _input() { return 'width:100%;padding:11px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;'; }
  function _label() { return 'font-size:11px;font-weight:900;color:#8A7E7C;display:block;margin-bottom:5px;text-transform:uppercase;'; }
  function _sectionTitle() { return 'font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:10px;'; }
  function _primaryBtn() { return 'background:#C4362A;color:#fff;border:none;padding:11px 18px;border-radius:20px;font-size:13px;font-weight:900;cursor:pointer;font-family:inherit;'; }
  function _smallSelect() { return 'padding:11px 14px;border:1.5px solid #D4C8C6;border-radius:20px;background:#fff;font-size:13px;font-weight:800;font-family:inherit;outline:none;'; }
  function _iconBtn(bg, color) { return 'width:36px;height:36px;border-radius:10px;border:none;background:' + bg + ';color:' + color + ';cursor:pointer;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;'; }
  function _panel() { return 'background:#fff;border-radius:14px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.06);'; }
  function _h3() { return 'font-size:17px;font-weight:900;margin-bottom:10px;'; }
  function _actionButton(bg, color) { return 'width:100%;display:flex;align-items:center;gap:8px;margin-top:8px;padding:11px 12px;border-radius:10px;border:none;background:' + bg + ';color:' + color + ';font-size:13px;font-weight:900;cursor:pointer;font-family:inherit;'; }
  function _actionLink(bg, color) { return _actionButton(bg, color) + 'text-decoration:none;box-sizing:border-box;'; }
  function _avatarColor(name) { var colors = ['#C4362A', '#1A9E5A', '#2563EB', '#7C3AED', '#D97706', '#0891B2']; return colors[(name || 'C').charCodeAt(0) % colors.length]; }
  function _initials(name) { return (name || 'Cliente').split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase(); }
  function _clientAddress(c) { return [c.address, c.neighborhood || c.zone, c.postalCode, c.state || c.province, c.country].filter(Boolean).join(', '); }
  function _phoneLink(c, text) { return '<a href="' + _whatsUrl(c.phone, text || '') + '" target="_blank" onclick="event.stopPropagation();" style="color:#1A9E5A;font-weight:900;text-decoration:none;">' + _esc(c.phone || '') + '</a>'; }
  function _contactHTML(c, text) {
    var parts = [];
    if (c.phone) parts.push('<span class="mi" style="font-size:14px;color:#1A9E5A;vertical-align:-2px;">chat</span> ' + _phoneLink(c, text));
    if (c.email) parts.push('<span>' + _esc(c.email) + '</span>');
    return parts.join('<span style="color:#D4C8C6;"> · </span>');
  }
  function _whatsUrl(phone, text) { return 'https://wa.me/' + _phone(phone) + '?text=' + encodeURIComponent(text || ''); }
  function _phone(v) { return String(v || '').replace(/\D/g, ''); }
  function _validPhone(v) { var raw = String(v || '').trim(); if (!raw) return true; var digits = _phone(raw); return digits.length >= 7 && digits.length <= 15; }
  function _validEmail(v) { var raw = String(v || '').trim(); return !raw || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw); }
  function _validFiscalId(v) {
    var raw = String(v || '').toUpperCase().replace(/[\s.-]/g, '');
    if (!raw) return true;
    return /^\d{8}[A-Z]$/.test(raw) || /^[XYZ]\d{7}[A-Z]$/.test(raw) || /^[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]$/.test(raw);
  }
  function _validPostalCode(v, country) {
    var raw = String(v || '').trim();
    if (!raw) return true;
    if (String(country || '').toLowerCase() === 'españa') return /^\d{5}$/.test(raw);
    return raw.length >= 3 && raw.length <= 12;
  }
  function _clean(v) { return String(v || '').trim().toLowerCase(); }
  function _title(v) { return String(v || '').replace(/_/g, ' ').replace(/\b\w/g, function (m) { return m.toUpperCase(); }); }
  function _dateTs(o) { var raw = o.createdAt || o.date || o.data || o.updatedAt || o.paidAt || ''; if (raw && typeof raw.toDate === 'function') return raw.toDate().getTime(); var d = new Date(raw); return isNaN(d.getTime()) ? 0 : d.getTime(); }
  function _fmtDate(o) { var ts = _dateTs(o); return ts ? UI.fmtDate(new Date(ts)) : '-'; }
  function _num(v) { return parseFloat(String(v == null ? '' : v).replace(',', '.')) || 0; }
  function _val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function _checked(id) { var el = document.getElementById(id); return !!(el && el.checked); }
  function _esc(str) { return String(str == null ? '' : str).replace(/[&<>"']/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]; }); }

  function destroy() {}

  return {
    render: render,
    destroy: destroy,
    _openModal: _openModal,
    _saveCliente: _saveCliente,
    _deleteCliente: _deleteCliente,
    _openHistory: _openHistory,
    _openSegmentFlow: _openSegmentFlow,
    _openProfile: _openProfile,
    _setFilter: _setFilter
  };
})();
