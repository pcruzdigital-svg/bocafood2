// js/modules/pedidos.js
window.Modules = window.Modules || {};
Modules.Pedidos = (function () {
  'use strict';

  var _unsubscribe = null;
  var _orders = [];
  var _customers = [];
  var _reviews = [];
  var _products = [];
  var _promotions = [];
  var _generalConfig = {};
  var _financeConfig = {};
  var _zones = [];
  var _canais = [];
  var _activeTab = 'cozinha';
  var _alarmOn = false;
  var _audioCtx = null;
  var _knownIds = null;
  var _kitchenModeOverlay = null;
  var _kitchenDetailId = null;
  var _reviewUi = {
    query: '',
    status: 'all',
    period: 'all',
    stars: 'all',
    periodStart: '',
    periodEnd: ''
  };
  var _ui = {
    q: '',
    status: 'all',
    channel: 'all'
  };
  var _manualOrderState = {
    customerQuery: '',
    productQuery: '',
    productFilter: 'all',
    productCategory: '',
    items: [],
    selectedCustomerId: '',
    customerId: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerAddress: '',
    customerZone: '',
    customerPreferences: '',
    customerNotes: '',
    type: 'delivery',
    channel: 'manual',
    source: 'manual',
    paymentMethod: '',
    paymentStatus: 'previsto',
    paidAmount: 0,
    deliveryDate: '',
    deliveryTime: '',
    adjustment: 0,
    shippingFee: 0,
    priceOrigin: 'manual'
  };

  var COLUMNS = [
    { key: 'Pendente', label: 'Pendente', color: '#D97706', bg: '#FFF7ED' },
    { key: 'Confirmado', label: 'Confirmado', color: '#2563EB', bg: '#EFF6FF' },
    { key: 'Em preparação', label: 'Em preparação', color: '#7C3AED', bg: '#F5F3FF' },
    { key: 'Em camino', label: 'Em caminho', color: '#0891B2', bg: '#ECFEFF' },
    { key: 'Listo para recoger', label: 'Pronto para retirada', color: '#059669', bg: '#ECFDF5' },
    { key: 'Entregado', label: 'Entregue', color: '#1A9E5A', bg: '#EDFAF3' },
    { key: 'Cancelado', label: 'Cancelado', color: '#C4362A', bg: '#FFF0EE' }
  ];

  var WA_MSGS = {
    'Pendente': function (o) { return _orderWhatsappMessage(o, 'Pendente', 'Hola, recibimos tu pedido y lo estamos revisando. Te avisaremos en cuanto esté confirmado.'); },
    'Confirmado': function (o) { return _orderWhatsappMessage(o, 'Confirmado', 'Hola, tu pedido fue confirmado y pronto entrará en preparación.'); },
    'Em preparação': function (o) { return _orderWhatsappMessage(o, 'Em preparação', 'Hola, tu pedido ya está en preparación.'); },
    'Em camino': function (o) { return _orderWhatsappMessage(o, 'Em caminho', 'Hola, tu pedido ya salió para entrega.'); },
    'Listo para recoger': function (o) { return _orderWhatsappMessage(o, 'Pronto para retirada', 'Hola, tu pedido ya está listo para retirar.'); },
    'Entregado': function (o) { return _orderWhatsappMessage(o, 'Entregue', 'Hola, tu pedido fue entregado. ¡Gracias por comprar con nosotros!'); },
    'Cancelado': function (o) { return _orderWhatsappMessage(o, 'Cancelado', 'Hola, tu pedido fue cancelado. Si necesitas ayuda, responde a este mensaje.'); }
  };

  function render(sub) {
    _activeTab = _normalizeTab(sub || 'cozinha');
    var app = document.getElementById('app');
    try {
      app.innerHTML = '<div id="pedidos-root" style="display:flex;flex-direction:column;height:100%;">' +
        '<div style="padding:20px 24px 16px;display:flex;align-items:flex-start;justify-content:space-between;border-bottom:1px solid #F2EDED;background:#fff;gap:16px;flex-wrap:wrap;">' +
          '<div style="min-width:0;">' +
            '<h1 style="font-family:\'League Spartan\',sans-serif;font-size:25px;font-weight:800;line-height:1.1;">Pedidos</h1>' +
            '<p style="margin-top:7px;font-size:13px;color:#8A7E7C;line-height:1.5;max-width:760px;">Gerencie pedidos, cozinha, clientes e avaliações em um só fluxo.</p>' +
          '</div>' +
        '</div>' +
        '<div id="pedidos-content" style="display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;background:#FBF5F3;"></div>' +
        '</div>';

      _bootstrapSchema();
      _subscribe();
      _loadMeta();
      _paintActive();
    } catch (err) {
      console.error('Pedidos render error', err);
      app.innerHTML = '<div style="padding:24px;background:#fff;color:#C4362A;font-family:inherit;">Erro ao carregar Pedidos: ' + _esc(err && err.message ? err.message : 'falha ao montar a tela') + '</div>';
    }
  }

  function _switchTab(key) {
    var route = _tabRoute(key);
    if (window.Router && typeof Router.navigate === 'function') {
      Router.navigate(route);
      return;
    }
    _activeTab = _normalizeTab(key);
    _paintActive();
  }

  function _normalizeTab(key) {
    key = String(key || 'demanda');
    if (key === 'demanda') return 'cozinha';
    if (key === 'todos' || key === 'lista' || key === 'pedidos') return 'lista';
    if (key === 'clientes') return 'clientes';
    if (key === 'avaliacoes' || key === 'review' || key === 'reviews') return 'avaliacoes';
    if (key === 'cozinha') return 'cozinha';
    return 'cozinha';
  }

  function _tabRoute(key) {
    var tab = _normalizeTab(key);
    if (tab === 'lista') return 'pedidos/lista';
    if (tab === 'clientes') return 'pedidos/clientes';
    if (tab === 'avaliacoes') return 'pedidos/avaliacoes';
    return 'pedidos/cozinha';
  }

  function _loadMeta() {
    Promise.all([
      DB.getAll('store_customers').catch(function () { return []; }),
      DB.getAll('reviews').catch(function () { return []; }),
      DB.getAll('products').catch(function () { return []; }),
      DB.getAll('promotions').catch(function () { return []; }),
      DB.getDocRoot ? DB.getDocRoot('config', 'geral').catch(function () { return null; }) : Promise.resolve(null),
      DB.getDocRoot ? DB.getDocRoot('config', 'financeiro').catch(function () { return null; }) : Promise.resolve(null),
      DB.getDocRoot ? DB.getDocRoot('config', 'zonas').catch(function () { return null; }) : Promise.resolve(null),
      DB.getDocRoot ? DB.getDocRoot('config', 'canais_venda').catch(function () { return null; }) : Promise.resolve(null)
    ]).then(function (res) {
      _customers = res[0] || [];
      _reviews = res[1] || [];
      _products = (res[2] || []).slice();
      _promotions = (res[3] || []).slice();
      _generalConfig = res[4] || {};
      _financeConfig = res[5] || {};
      _zones = _normalizeZones(res[6]);
      _canais = _normalizeCanais(res[7]);
      _syncOrderCustomerLinks(_orders);
      _paintActive();
    }).catch(function () {
      _customers = [];
      _reviews = [];
      _products = [];
      _promotions = [];
      _generalConfig = {};
      _financeConfig = {};
      _zones = [];
      _canais = _normalizeCanais(null);
      _syncOrderCustomerLinks(_orders);
      _paintActive();
    });
  }

  function _bootstrapSchema() {
    if (!DB || !DB.ensureSchemaDoc) return;
    DB.ensureSchemaDoc('pedidos').catch(function () {});
  }

  function _subscribe() {
    if (_unsubscribe) _unsubscribe();
    _unsubscribe = DB.listen('orders', function (orders) {
      // Check for new orders
      if (_knownIds !== null) {
        orders.forEach(function (o) {
          if (!_knownIds.has(o.id) && o.status === 'Pendente') {
            _playAlarm();
          }
        });
      }
      _knownIds = new Set(orders.map(function (o) { return o.id; }));
      _orders = orders;
      _syncOrderCustomerLinks(_orders);
      _paintActive();
    });
  }

  function _paintActive() {
    var content = document.getElementById('pedidos-content');
    if (!content) return;
    try {
      if (_activeTab === 'lista') {
        content.innerHTML = _renderPedidosPage();
        _renderOrdersList();
        return;
      }
      if (_activeTab === 'clientes') {
        content.innerHTML = _renderClientesPage();
        _renderClientesTab();
        return;
      }
      if (_activeTab === 'avaliacoes') {
        content.innerHTML = _renderAvaliacoesPage();
        _renderAvaliacoesTab();
        return;
      }
      content.innerHTML = _renderCozinhaPage();
      _paintKitchenList();
    } catch (err) {
      console.error('Pedidos paint error', err);
      content.innerHTML = '<div style="padding:20px;background:#fff;color:#C4362A;border-radius:14px;margin:18px;">Erro ao montar a tela de pedidos: ' + _esc(err && err.message ? err.message : 'falha interna') + '</div>';
    }
  }

  function _renderCozinhaPage() {
    var orders = _activeKitchenOrders();
    var total = orders.reduce(function (sum, o) { return sum + _num(o.total || o.amount || o.grandTotal); }, 0);
    var pending = orders.filter(function (o) { return String(o.status || 'Pendente') === 'Pendente'; }).length;
    var ready = orders.filter(function (o) { return String(o.status || '') === 'Listo para recoger' || String(o.status || '') === 'Entregado'; }).length;
    var active = orders.length;
    return '<div style="padding:18px 24px 24px;display:flex;flex-direction:column;gap:14px;min-height:0;flex:1;">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">' +
        '<div style="min-width:0;">' +
          '<div style="font-size:12px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Cozinha</div>' +
          '<h2 style="font-family:\'League Spartan\',sans-serif;font-size:22px;font-weight:800;line-height:1.15;margin:0;">Fluxo operacional da cozinha</h2>' +
          '<div style="margin-top:7px;font-size:13px;color:#8A7E7C;line-height:1.45;max-width:760px;">Pedidos do canal cardápio organizados para leitura rápida, sem distrações. Abra o modo cozinha para operar em tela cheia.</div>' +
        '</div>' +
        '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">' +
          '<button id="alarm-btn" onclick="Modules.Pedidos._toggleAlarm()" style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:9px 14px;border-radius:20px;border:1.5px solid #D4C8C6;background:#fff;cursor:pointer;font-family:inherit;">🔔 Alarme: ' + (_alarmOn ? 'ON' : 'OFF') + '</button>' +
          '<button onclick="Modules.Pedidos._testAlarm()" style="font-size:12px;font-weight:800;color:#C4362A;background:#fff;border:1.5px solid #C4362A;border-radius:20px;padding:8px 14px;cursor:pointer;font-family:inherit;">Testar</button>' +
          '<button onclick="Modules.Pedidos._openKitchenMode()" style="display:flex;align-items:center;gap:6px;background:#C4362A;color:#fff;border:none;padding:10px 16px;border-radius:20px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">Abrir modo cozinha</button>' +
          '<button onclick="Modules.Pedidos._openNewOrder()" style="display:flex;align-items:center;gap:6px;background:#fff;color:#C4362A;border:1.5px solid #C4362A;padding:10px 16px;border-radius:20px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">+ Novo Pedido</button>' +
        '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">' +
        _kpiCard('Pedidos da cozinha', active, 'somente pedidos do cardápio') +
        _kpiCard('Pendentes', pending, 'aguardando ação') +
        _kpiCard('Prontos / entregues', ready, 'fluxo em andamento') +
        _kpiCard('Faturamento', active ? UI.fmt(total) : '—', 'somente pedidos ativos') +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:10px;min-height:0;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">' +
          '<div style="font-size:12px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;">Pedidos ativos</div>' +
          '<div style="font-size:12px;color:#8A7E7C;">' + active + ' pedido(s)</div>' +
        '</div>' +
        '<div id="kitchen-list" style="display:flex;flex-direction:column;gap:10px;"></div>' +
      '</div>' +
    '</div>';
  }

  function _renderPedidosPage() {
    var orders = _filteredOrders();
    var stats = _allOrdersStats(orders);
    return '<div style="padding:18px 24px 24px;display:flex;flex-direction:column;gap:14px;min-height:0;flex:1;">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">' +
        '<div style="min-width:0;">' +
          '<div style="font-size:12px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Pedidos</div>' +
          '<h2 style="font-family:\'League Spartan\',sans-serif;font-size:22px;font-weight:800;line-height:1.15;margin:0;">Lista completa de pedidos</h2>' +
          '<div style="margin-top:7px;font-size:13px;color:#8A7E7C;line-height:1.45;max-width:760px;">Acompanhe todo o histórico operacional com busca, filtros e acesso rápido aos detalhes do pedido.</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:14px;min-height:0;">' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;">' +
      _kpiCard('Todos os pedidos', stats.totalOrders, 'base completa') +
      _kpiCard('Clientes ligados', stats.customerHits, 'pedidos com cliente reconhecido') +
      _kpiCard('Pedidos com avaliação', stats.reviewedOrders, 'vinculados a reviews') +
      _kpiCard('Ticket médio', stats.totalOrders ? UI.fmt(stats.avgTicket) : '—', 'todos os pedidos filtrados') +
      '</div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;background:#fff;border:1px solid #F2EDED;border-radius:16px;padding:12px 14px;">' +
      '<input id="pedidos-search" value="' + _esc(_ui.q) + '" oninput="Modules.Pedidos._setUi(\'q\', this.value)" placeholder="Buscar por pedido, cliente, telefone ou item..." style="min-width:260px;flex:1;padding:11px 14px;border:1.5px solid #D4C8C6;border-radius:22px;font-size:14px;font-family:inherit;outline:none;background:#fff;">' +
      '<select onchange="Modules.Pedidos._setUi(\'status\', this.value)" style="' + _smallSelect() + '">' +
        _orderFilterOptions(['all'].concat(COLUMNS.map(function (c) { return c.key; })), _ui.status, 'Todos os status') +
      '</select>' +
      '<select onchange="Modules.Pedidos._setUi(\'channel\', this.value)" style="' + _smallSelect() + '">' +
        _orderFilterOptions(['all', 'cardapio', 'template', 'store', 'whatsapp', 'delivery', 'pickup'], _ui.channel, 'Todos os canais') +
      '</select>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:minmax(0,1.7fr) minmax(260px,.9fr);gap:14px;align-items:start;min-height:0;flex:1;">' +
      '<div style="min-height:0;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;"><div style="font-size:12px;font-weight:800;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;">Lista geral</div><div style="font-size:12px;color:#8A7E7C;">' + orders.length + ' pedido(s)</div></div>' +
        '<div id="orders-list" style="display:flex;flex-direction:column;gap:10px;min-height:0;"></div>' +
      '</div>' +
      '</div>' +
      '</div>';
  }

  function _paintTodosPanels() {
    var list = document.getElementById('orders-list');
    if (list) list.innerHTML = _renderOrdersListHTML();
  }

  function _paintKitchenList() {
    var wrap = document.getElementById('kitchen-list');
    if (!wrap) return;
    var orders = _activeKitchenOrders();
    if (!orders.length) {
      wrap.innerHTML = UI.emptyState('Nenhum pedido ativo na cozinha', '👨‍🍳');
      return;
    }
    wrap.innerHTML = orders.map(function (o) {
      var phoneHref = _orderPhoneHref(o);
      return '<div onclick="Modules.Pedidos._openDetail(\'' + _esc(o.id) + '\')" style="background:#fff;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,.06);padding:14px 16px;cursor:pointer;display:grid;grid-template-columns:minmax(0,1.7fr) auto;gap:12px;align-items:center;">' +
        '<div style="min-width:0;">' +
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
            '<strong style="font-size:16px;">' + _esc(o.customerName || o.clientName || o.name || 'Pedido') + '</strong>' +
            UI.badge(_orderChannelLabel(o), 'gray') +
            UI.badge(_orderStatusLabel(o.status), 'blue') +
            (o.type ? UI.badge(o.type === 'pickup' ? 'Retirada' : 'Entrega', o.type === 'pickup' ? 'green' : 'orange') : '') +
            _orderPaymentBadge(o) +
          '</div>' +
          '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;line-height:1.45;display:flex;flex-wrap:wrap;gap:6px;align-items:center;">' +
            '<span>' + _esc(_orderScheduleInfo(o).text) + '</span>' +
            (o.address ? '<span>· ' + _esc(o.address) + '</span>' : '') +
            (phoneHref ? '<a href="' + _esc(phoneHref) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="color:#1A9E5A;font-weight:800;text-decoration:none;">· WhatsApp</a>' : '') +
          '</div>' +
        '</div>' +
        '<div style="text-align:right;min-width:130px;display:flex;flex-direction:column;align-items:flex-end;gap:8px;">' +
          '<div style="font-family:\'League Spartan\',sans-serif;font-size:20px;font-weight:900;color:#C4362A;line-height:1.1;">' + UI.fmt(_num(o.total || o.amount || o.grandTotal)) + '</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">' +
            '<button onclick="event.stopPropagation();Modules.Pedidos._openDetail(\'' + _esc(o.id) + '\')" style="border:none;background:#F2EDED;color:#1A1A1A;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:800;cursor:pointer;">Detalhes</button>' +
            '<button onclick="event.stopPropagation();Modules.Pedidos._quickStatus(\'' + _esc(o.id) + '\', \'Pendente\')" style="border:none;background:#FFF7ED;color:#D97706;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:800;cursor:pointer;">Pendente</button>' +
            '<button onclick="event.stopPropagation();Modules.Pedidos._quickStatus(\'' + _esc(o.id) + '\', \'Em preparação\')" style="border:none;background:#F5F3FF;color:#7C3AED;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:800;cursor:pointer;">Preparar</button>' +
            '<button onclick="event.stopPropagation();Modules.Pedidos._quickStatus(\'' + _esc(o.id) + '\', \'Listo para recoger\')" style="border:none;background:#ECFDF5;color:#059669;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:800;cursor:pointer;">Pronto</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function _activeKitchenOrders() {
    return _cardapioOrders().filter(function (o) {
      var st = String(o.status || 'Pendente');
      return st !== 'Entregado' && st !== 'Cancelado';
    });
  }

  function _renderOrdersList() {
    _paintTodosPanels();
  }

  function _renderClientesPage() {
    var stats = _allCustomersStats();
    return '<div style="padding:18px 24px 24px;display:flex;flex-direction:column;gap:14px;min-height:0;flex:1;">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">' +
        '<div style="min-width:0;">' +
          '<div style="font-size:12px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Clientes</div>' +
          '<h2 style="font-family:\'League Spartan\',sans-serif;font-size:22px;font-weight:800;line-height:1.15;margin:0;">Base vinculada aos pedidos</h2>' +
          '<div style="margin-top:7px;font-size:13px;color:#8A7E7C;line-height:1.45;max-width:760px;">Clientes identificados a partir dos pedidos, com histórico, ticket e avaliações vinculadas.</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:14px;min-height:0;">' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;">' +
      _kpiCard('Clientes', stats.total, 'base vinculada aos pedidos') +
      _kpiCard('Com pedidos', stats.withOrders, 'clientes reconhecidos') +
      _kpiCard('Com avaliações', stats.withReviews, 'clientes com review') +
      _kpiCard('Ticket médio', stats.avgTicket ? UI.fmt(stats.avgTicket) : '—', 'base total de pedidos') +
      _kpiCard('Aceitam marketing', (_customers || []).filter(function (c) { return c.acceptsMarketing === true; }).length, 'opt-in ativo') +
      '</div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;background:#fff;border:1px solid #F2EDED;border-radius:16px;padding:12px 14px;">' +
      '<input id="pedidos-clientes-search" value="' + _esc(_ui.q) + '" oninput="Modules.Pedidos._setUi(\'q\', this.value)" placeholder="Buscar cliente, telefone, email ou pedido..." style="min-width:260px;flex:1;padding:11px 14px;border:1.5px solid #D4C8C6;border-radius:22px;font-size:14px;font-family:inherit;outline:none;background:#fff;">' +
      '<select onchange="Modules.Pedidos._setUi(\'status\', this.value)" style="' + _smallSelect() + '">' +
        _orderFilterOptions(['all', 'ativo', 'recorrente', 'inativo', 'bloqueado'], _ui.status, 'Todos os status') +
      '</select>' +
      '<select onchange="Modules.Pedidos._setUi(\'segment\', this.value)" style="' + _smallSelect() + '">' +
        _filterOptions(['', 'novo', 'recorrente', 'vip', 'inativo', 'sem_pedido'], _ui.segment, 'Segmento') +
      '</select>' +
      '<select onchange="Modules.Pedidos._setUi(\'origin\', this.value)" style="' + _smallSelect() + '">' +
        _originOptions(_ui.origin) +
      '</select>' +
      '</div>' +
      '<div id="clientes-tab-list" style="display:flex;flex-direction:column;gap:10px;"></div>' +
      '</div>' +
      '</div>';
  }

  function _renderClientesTab() {
    var wrap = document.getElementById('clientes-tab-list');
    if (!wrap) return;
    var q = String(_ui.q || '').trim().toLowerCase();
    var status = String(_ui.status || 'all').toLowerCase();
    var segment = String(_ui.segment || '').toLowerCase();
    var origin = String(_ui.origin || '').toLowerCase();
    var list = (_customers || []).slice().sort(function (a, b) {
      var sa = _customerStats(a);
      var sb = _customerStats(b);
      return (sb.totalSpent || 0) - (sa.totalSpent || 0) || String(a.name || '').localeCompare(String(b.name || ''));
    }).filter(function (c) {
      var s = _customerStats(c);
      if (status !== 'all' && String(c.status || s.segment || '').toLowerCase() !== status) return false;
      if (segment && String(s.segment || '').toLowerCase() !== segment) return false;
      if (origin && String(c.mainChannel || c.channelName || c.channel || c.origin || '').toLowerCase() !== origin) return false;
      if (!q) return true;
      var orders = _ordersForClient(c);
      var hay = [
        c.name, c.phone, c.email, c.origin, c.mainChannel, c.channelName, c.address, c.neighborhood, c.zone, c.postalCode, c.preferences, c.allergies,
        orders.map(function (o) { return [o.customerName, o.clientName, o.name, _orderChannelLabel(o), o.status].join(' '); }).join(' ')
      ].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    wrap.innerHTML = list.length ? list.map(function (c) {
      var s = _customerStats(c);
      var reviews = _customerReviewStats(c);
      return '<div onclick="Modules.Clientes._openProfile(\'' + _esc(c.id) + '\')" style="background:#fff;border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,.06);padding:14px 16px;cursor:pointer;display:grid;grid-template-columns:minmax(0,1.7fr) auto;gap:12px;align-items:start;">' +
        '<div style="min-width:0;">' +
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
            '<strong style="font-size:16px;">' + _esc(c.name || 'Cliente') + '</strong>' +
            UI.badge(_segmentLabel(s.segment), s.segment === 'vip' ? 'orange' : s.segment === 'recorrente' ? 'green' : s.segment === 'inativo' ? 'gray' : 'blue') +
            (reviews.count ? UI.badge(reviews.avg.toFixed(1) + '★', 'orange') : UI.badge('Sem review', 'gray')) +
            (c.acceptsMarketing ? UI.badge('Marketing ativo', 'green') : UI.badge('Sem marketing', 'gray')) +
          '</div>' +
          '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;line-height:1.45;">' + _esc(c.phone || 'Sem telefone') + (c.email ? ' · ' + _esc(c.email) : '') + '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center;">' +
            UI.badge(s.ordersCount + ' pedido(s)', 'blue') +
            UI.badge(UI.fmt(s.totalSpent), 'gray') +
            (c.mainChannel || c.channelName || c.origin ? UI.badge(_title(c.mainChannel || c.channelName || c.origin), 'gray') : '') +
            (_tags(c.tags).length ? UI.badge(_tags(c.tags).slice(0, 2).join(' · '), 'gray') : '') +
          '</div>' +
        '</div>' +
        '<div style="text-align:right;min-width:130px;">' +
          '<div style="font-family:\'League Spartan\',sans-serif;font-size:20px;font-weight:900;color:#C4362A;line-height:1.1;">' + UI.fmt(s.totalSpent) + '</div>' +
          '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">Último pedido: ' + _esc(s.lastOrderLabel || '-') + '</div>' +
          '<div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;margin-top:10px;" onclick="event.stopPropagation();">' +
            '<button onclick="Modules.Clientes._openProfile(\'' + _esc(c.id) + '\')" style="border:none;background:#F2EDED;color:#1A1A1A;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:800;cursor:pointer;">Perfil completo</button>' +
            '<button onclick="Modules.Clientes._openHistory(\'' + _esc(c.id) + '\')" style="border:none;background:#EEF4FF;color:#2563EB;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:800;cursor:pointer;">Histórico</button>' +
            '<button onclick="Modules.Clientes._openSegmentFlow(\'' + _esc(c.id) + '\')" style="border:none;background:#FFF8F1;color:#B45309;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:800;cursor:pointer;">Segmento</button>' +
            '<button onclick="Modules.Clientes._openModal(\'' + _esc(c.id) + '\')" style="border:none;background:#FFF0EE;color:#C4362A;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:800;cursor:pointer;">Editar</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('') : UI.emptyState('Nenhum cliente encontrado', '👥');
  }

  function _renderAvaliacoesPage() {
    var filtered = _reviewFilteredList();
    var stats = _reviewSummary(filtered);
    var periodLabel = _reviewPeriodLabel(_reviewUi.period);
    return '<div style="padding:18px 24px 24px;display:flex;flex-direction:column;gap:14px;min-height:0;flex:1;">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">' +
        '<div style="min-width:0;">' +
          '<div style="font-size:12px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Avaliações</div>' +
          '<h2 style="font-family:\'League Spartan\',sans-serif;font-size:22px;font-weight:800;line-height:1.15;margin:0;">Moderação e opinião dos clientes</h2>' +
          '<div style="margin-top:7px;font-size:13px;color:#8A7E7C;line-height:1.45;max-width:760px;">Avaliações ligadas aos pedidos, com leitura rápida, moderação e foco no que passa confiança.</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;">' +
      _kpiCard('Avaliações', stats.total, periodLabel) +
      _kpiCard('Aprovadas', stats.approved, 'visíveis no template') +
      _kpiCard('Pendentes', stats.pending, 'aguardando moderação') +
      _kpiCard('Nota média', stats.avg ? stats.avg.toFixed(1) + '/5' : '—', 'todas as avaliações') +
      '</div>' +
      _reviewToolbarHtml(stats) +
      '<div id="reviews-tab-list" style="display:flex;flex-direction:column;gap:12px;"></div>' +
      '</div>';
  }

  function _renderAvaliacoesTab() {
    var wrap = document.getElementById('reviews-tab-list');
    if (!wrap) return;
    var list = _reviewFilteredList();
    wrap.innerHTML = list.length ? list.map(function (r) {
      var statusInfo = _reviewStatusLabel(r);
      var stars = Number(r.stars || r.rating || 0) || 0;
      var dateTs = _reviewDateTs(r);
      var summaryText = String(r.comment || r.text || '').trim();
    return '<div onclick="Modules.Pedidos._openReview(\'' + _esc(String(r.id || '')) + '\')" style="background:#fff;border:1px solid #EEE6E4;border-radius:16px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.05);cursor:pointer;display:flex;flex-direction:column;gap:12px;">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">' +
          '<div style="min-width:0;flex:1;">' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">' +
              '<span style="font-size:10px;font-weight:900;padding:4px 8px;border-radius:999px;background:' + statusInfo.bg + ';color:' + statusInfo.tone + ';">' + _esc(statusInfo.label) + '</span>' +
              '<span style="font-size:10px;font-weight:900;padding:4px 8px;border-radius:999px;background:#F2EDED;color:#8A7E7C;">' + _esc(_reviewSourceLabel(r)) + '</span>' +
            '</div>' +
            '<div style="font-size:15px;font-weight:900;color:#1A1A1A;line-height:1.25;">' + _esc(r.name || r.customerName || 'Cliente') + '</div>' +
            '<div style="margin-top:6px;color:#D97706;font-size:16px;letter-spacing:1px;">' + _esc('★'.repeat(stars) + '☆'.repeat(5 - stars)) + ' <span style="font-size:12px;color:#8A7E7C;font-weight:600;">(' + stars + '/5)</span></div>' +
            (summaryText ? '<div style="margin-top:8px;font-size:13px;color:#1A1A1A;line-height:1.55;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">' + _esc(summaryText) + '</div>' : '') +
          '</div>' +
          '<div style="text-align:right;flex-shrink:0;min-width:120px;">' +
            '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">' + _esc(dateTs ? UI.fmtDate(new Date(dateTs)) : '—') + '</div>' +
            '<div style="font-size:11px;color:#8A7E7C;margin-top:4px;">' + _esc(r.productName || 'Sem produto') + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;" onclick="event.stopPropagation()">' +
          '<button onclick="Modules.Pedidos._approveReview(\'' + _esc(String(r.id || '')) + '\')" style="padding:7px 12px;border:none;border-radius:12px;background:#EDFAF3;color:#1A9E5A;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">Aprovar</button>' +
          '<button onclick="Modules.Pedidos._rejectReview(\'' + _esc(String(r.id || '')) + '\')" style="padding:7px 12px;border:none;border-radius:12px;background:#FFF0EE;color:#C4362A;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">Rejeitar</button>' +
        '</div>' +
      '</div>';
    }).join('') : UI.emptyState('Nenhuma avaliação encontrada', '⭐');
  }

  function _allCustomersStats() {
    var total = (_customers || []).length;
    var withOrders = 0;
    var withReviews = 0;
    var totalSpent = 0;
    (_customers || []).forEach(function (c) {
      var s = _customerStats(c);
      if (s.ordersCount) withOrders += 1;
      totalSpent += s.totalSpent || 0;
      if (_customerReviewStats(c).count) withReviews += 1;
    });
    return {
      total: total,
      withOrders: withOrders,
      withReviews: withReviews,
      avgTicket: total && (_orders || []).length ? totalSpent / (_orders || []).length : 0
    };
  }

  function _allReviewStats() {
    var list = _reviews || [];
    var approved = list.filter(function (r) { return _reviewStatusLabel(r).key === 'approved'; }).length;
    var pending = list.filter(function (r) { return _reviewStatusLabel(r).key === 'pending'; }).length;
    var avg = list.length ? list.reduce(function (s, r) { return s + (Number(r.stars || r.rating || 0) || 0); }, 0) / list.length : 0;
    return { total: list.length, approved: approved, pending: pending, avg: avg };
  }

  function _openClientProfile(id) {
    var c = _customers.find(function (x) { return String(x.id || '') === String(id || ''); });
    if (!c) return;
    var s = _customerStats(c);
    var reviews = _customerReviewStats(c);
    var orders = _ordersForClient(c);
    var contact = _firstText(c.phone, c.whatsapp, c.email, '');
    var body = '<div style="display:flex;flex-direction:column;gap:14px;">' +
      '<section style="background:linear-gradient(180deg,#FFF 0%,#FCF8F7 100%);border:1px solid #F1E6E3;border-radius:18px;padding:16px;box-shadow:0 6px 20px rgba(0,0,0,.04);">' +
        '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">' +
          '<div style="display:flex;gap:14px;align-items:center;min-width:0;flex:1;">' +
            '<div style="width:64px;height:64px;border-radius:18px;background:' + _avatarColor(c.name) + ';color:#fff;font-size:22px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + _esc(_initials(c.name)) + '</div>' +
            '<div style="min-width:0;">' +
              '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.6px;margin-bottom:7px;">Cadastro do cliente</div>' +
              '<div style="font-family:\'League Spartan\',sans-serif;font-size:26px;font-weight:900;line-height:1.05;color:#1A1A1A;">' + _esc(c.name || 'Cliente') + '</div>' +
              '<div style="margin-top:6px;font-size:13px;color:#8A7E7C;line-height:1.45;">' + _esc(contact || 'Sin teléfono registrado') + '</div>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:flex-end;">' +
            (contact ? '<a href="' + _whatsUrl(contact, 'Hola ' + (c.name || '') + ', tenemos una novedad para ti.') + '" target="_blank" rel="noopener" style="border:none;background:#E8FFF1;color:#1A9E5A;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:800;cursor:pointer;text-decoration:none;">WhatsApp</a>' : '<span style="border:none;background:#F2EDED;color:#8A7E7C;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:800;">Sin teléfono registrado</span>') +
            '<button onclick="Modules.Clientes._openModal(\'' + _esc(c.id) + '\')" style="border:none;background:#EEF4FF;color:#2563EB;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:800;cursor:pointer;">Editar</button>' +
          '</div>' +
        '</div>' +
      '</section>' +
      '<section style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;">' +
        _kpiCard('Pedidos', s.ordersCount, 'histórico') +
        _kpiCard('Total', UI.fmt(s.totalSpent), 'comprado') +
        _kpiCard('Avaliações', reviews.count, 'vínculos') +
        _kpiCard('Nota média', reviews.count ? reviews.avg.toFixed(1) + '/5' : '—', 'reviews') +
      '</section>' +
      '<section style="background:#fff;border:1px solid #F2EDED;border-radius:16px;padding:14px;">' +
        '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:8px;">Contato e perfil</div>' +
        '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">' +
          '<div><div style="font-size:11px;font-weight:800;color:#8A7E7C;margin-bottom:3px;">Telefone / WhatsApp</div><div style="font-size:14px;font-weight:700;">' + _esc(c.phone || c.whatsapp || 'Sin teléfono registrado') + '</div></div>' +
          '<div><div style="font-size:11px;font-weight:800;color:#8A7E7C;margin-bottom:3px;">E-mail</div><div style="font-size:14px;font-weight:700;">' + _esc(c.email || '-') + '</div></div>' +
          '<div><div style="font-size:11px;font-weight:800;color:#8A7E7C;margin-bottom:3px;">Endereço</div><div style="font-size:14px;font-weight:700;">' + _esc(_clientAddress(c) || '-') + '</div></div>' +
          '<div><div style="font-size:11px;font-weight:800;color:#8A7E7C;margin-bottom:3px;">Cidade / Região</div><div style="font-size:14px;font-weight:700;">' + _esc(_firstText(c.city, c.region, c.zone, '-')) + '</div></div>' +
        '</div>' +
      '</section>' +
      '<section style="background:#fff;border:1px solid #F2EDED;border-radius:16px;padding:14px;">' +
        '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:8px;">Pedidos vinculados</div>' +
        (orders.length ? orders.slice(0, 8).map(function (o) {
          return '<div style="display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid #F2EDED;"><span>' + _esc(_orderScheduleInfo(o).text) + ' · ' + _esc(_orderChannelLabel(o)) + '</span><strong>' + UI.fmt(_num(o.total || o.amount || o.grandTotal)) + '</strong></div>';
        }).join('') : '<div style="font-size:13px;color:#8A7E7C;">Sem pedidos vinculados.</div>') +
      '</section>' +
      '</div>';
    UI.modal({
      title: 'Cliente — ' + (c.name || 'Cliente'),
      body: body,
      maxWidth: '760px'
    });
  }

  function _openReview(id) {
    var r = (_reviews || []).find(function (x) { return String(x.id || '') === String(id || ''); });
    if (!r) return;
    var stars = Number(r.stars || r.rating || 0) || 0;
    var status = _reviewStatusLabel(r);
    var ts = _reviewDateTs(r);
    UI.modal({
      title: 'Resumo da Avaliação',
      body: '<div style="display:flex;flex-direction:column;gap:14px;">' +
        '<section style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">' +
          '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">' +
            '<div>' +
              '<div style="font-size:24px;font-weight:900;line-height:1.1;color:#1A1A1A;">' + _esc(r.name || r.customerName || 'Cliente') + '</div>' +
              '<div style="margin-top:8px;color:#D97706;font-size:18px;letter-spacing:1px;">' + _esc('★'.repeat(stars) + '☆'.repeat(5 - stars)) + ' <span style="font-size:12px;color:#8A7E7C;font-weight:600;">(' + stars + '/5)</span></div>' +
            '</div>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">' +
              '<span style="font-size:10px;font-weight:900;padding:4px 8px;border-radius:999px;background:' + status.bg + ';color:' + status.tone + ';">' + _esc(status.label) + '</span>' +
              '<span style="font-size:10px;font-weight:900;padding:4px 8px;border-radius:999px;background:#F2EDED;color:#8A7E7C;">' + _esc(_reviewSourceLabel(r)) + '</span>' +
            '</div>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-top:12px;">' +
            '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Produto</div><div style="font-size:12px;font-weight:700;color:#1A1A1A;">' + _esc(r.productName || '—') + '</div></div>' +
            '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Data</div><div style="font-size:12px;font-weight:700;color:#1A1A1A;">' + _esc(ts ? UI.fmtDate(new Date(ts)) : '—') + '</div></div>' +
            '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">Origem</div><div style="font-size:12px;font-weight:700;color:#1A1A1A;">' + _esc(_reviewSourceLabel(r)) + '</div></div>' +
          '</div>' +
        '</section>' +
        '<section style="background:#fff;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">' +
          '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Comentário</div>' +
          '<div style="font-size:13px;color:#1A1A1A;line-height:1.65;">' + _esc(r.comment || r.text || '—') + '</div>' +
        '</section>' +
      '</div>',
      footer: '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
        '<button onclick="Modules.Pedidos._approveReview(\'' + _esc(String(r.id || '')) + '\')" style="flex:1;min-width:130px;padding:13px;border:none;border-radius:11px;background:#EDFAF3;color:#1A9E5A;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Aprovar</button>' +
        '<button onclick="Modules.Pedidos._rejectReview(\'' + _esc(String(r.id || '')) + '\')" style="flex:1;min-width:130px;padding:13px;border:none;border-radius:11px;background:#FFF0EE;color:#C4362A;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Rejeitar</button>' +
      '</div>',
      maxWidth: '720px'
    });
  }

  function _setUi(key, value) {
    _ui[key] = value || '';
    _paintActive();
  }

  function _setReviewUi(key, value) {
    _reviewUi[key] = value || '';
    _paintActive();
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
      start = _reviewUi.periodStart ? new Date(_reviewUi.periodStart + 'T00:00:00').getTime() : 0;
      end = _reviewUi.periodEnd ? new Date(_reviewUi.periodEnd + 'T23:59:59.999').getTime() : 0;
    }
    return { key: key, start: start, end: end };
  }

  function _reviewPeriodLabel(key) {
    var map = {
      all: 'Todas as avaliações',
      today: 'Hoje',
      yesterday: 'Ontem',
      last7: 'Últimos 7 dias',
      last30: 'Últimos 30 dias',
      thismonth: 'Este mês',
      lastmonth: 'Mês passado',
      custom: 'Período personalizado'
    };
    return map[String(key || 'all').toLowerCase()] || 'Todas as avaliações';
  }

  function _reviewMatchesFilters(review) {
    var q = String(_reviewUi.query || '').trim().toLowerCase();
    var status = String(_reviewUi.status || 'all');
    var stars = String(_reviewUi.stars || 'all');
    var ts = _reviewDateTs(review);
    var range = _reviewPeriodRange(_reviewUi.period);
    var reviewStatus = _reviewStatusLabel(review).key;
    var starValue = Number(review.stars || review.rating || 0) || 0;
    if (q) {
      var text = [
        review.name || '',
        review.customerName || '',
        review.productName || '',
        review.comment || '',
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
      return _reviewDateTs(b) - _reviewDateTs(a);
    });
  }

  function _reviewSummary(list) {
    var reviews = Array.isArray(list) ? list : [];
    var approved = reviews.filter(function (r) { return _reviewStatusLabel(r).key === 'approved'; }).length;
    var pending = reviews.filter(function (r) { return _reviewStatusLabel(r).key === 'pending'; }).length;
    var avg = reviews.length ? reviews.reduce(function (sum, r) { return sum + (Number(r.stars || r.rating || 0) || 0); }, 0) / reviews.length : 0;
    return {
      total: reviews.length,
      approved: approved,
      pending: pending,
      avg: avg,
    };
  }

  function _reviewToolbarHtml(summary) {
    var customHtml = _reviewUi.period === 'custom'
      ? '<div style="grid-column:1 / -1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:-2px;">' +
          '<label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;"><span style="display:block;margin-bottom:4px;">Data inicial</span><input type="date" value="' + _esc(_reviewUi.periodStart || '') + '" onchange="Modules.Pedidos._setReviewUi(\'periodStart\', this.value)" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:12px;background:#fff;font-size:13px;font-family:inherit;outline:none;"></label>' +
          '<label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;"><span style="display:block;margin-bottom:4px;">Data final</span><input type="date" value="' + _esc(_reviewUi.periodEnd || '') + '" onchange="Modules.Pedidos._setReviewUi(\'periodEnd\', this.value)" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:12px;background:#fff;font-size:13px;font-family:inherit;outline:none;"></label>' +
        '</div>'
      : '';
    return '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:16px;padding:14px 16px;margin-bottom:14px;">' +
      '<div style="display:grid;grid-template-columns:1.4fr .9fr .9fr 1fr;gap:10px;align-items:end;">' +
        '<div><label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;margin-bottom:4px;">Buscar por cliente, produto, comentário ou status</label><input id="rev-search" type="search" value="' + _esc(_reviewUi.query || '') + '" oninput="Modules.Pedidos._setReviewUi(\'query\', this.value)" placeholder="Buscar por cliente, produto, comentário ou status" style="width:100%;padding:11px 14px;border:1.5px solid #D4C8C6;border-radius:999px;background:#fff;font-size:13px;font-family:inherit;outline:none;"></div>' +
        '<label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;"><span style="display:block;margin-bottom:4px;">Status</span><select onchange="Modules.Pedidos._setReviewUi(\'status\', this.value)" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:12px;background:#fff;font-size:13px;font-family:inherit;outline:none;"><option value="all"' + (_reviewUi.status === 'all' ? ' selected' : '') + '>Todas</option><option value="pending"' + (_reviewUi.status === 'pending' ? ' selected' : '') + '>Pendentes</option><option value="approved"' + (_reviewUi.status === 'approved' ? ' selected' : '') + '>Aprovadas</option><option value="rejected"' + (_reviewUi.status === 'rejected' ? ' selected' : '') + '>Rejeitadas</option></select></label>' +
        '<label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;"><span style="display:block;margin-bottom:4px;">Período</span><select onchange="Modules.Pedidos._setReviewUi(\'period\', this.value)" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:12px;background:#fff;font-size:13px;font-family:inherit;outline:none;"><option value="all"' + (_reviewUi.period === 'all' ? ' selected' : '') + '>Todos</option><option value="today"' + (_reviewUi.period === 'today' ? ' selected' : '') + '>Hoje</option><option value="yesterday"' + (_reviewUi.period === 'yesterday' ? ' selected' : '') + '>Ontem</option><option value="last7"' + (_reviewUi.period === 'last7' ? ' selected' : '') + '>Últimos 7 dias</option><option value="last30"' + (_reviewUi.period === 'last30' ? ' selected' : '') + '>Últimos 30 dias</option><option value="thismonth"' + (_reviewUi.period === 'thismonth' ? ' selected' : '') + '>Este mês</option><option value="lastmonth"' + (_reviewUi.period === 'lastmonth' ? ' selected' : '') + '>Mês passado</option><option value="custom"' + (_reviewUi.period === 'custom' ? ' selected' : '') + '>Personalizado</option></select></label>' +
        '<label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;"><span style="display:block;margin-bottom:4px;">Nota</span><select onchange="Modules.Pedidos._setReviewUi(\'stars\', this.value)" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:12px;background:#fff;font-size:13px;font-family:inherit;outline:none;"><option value="all"' + (_reviewUi.stars === 'all' ? ' selected' : '') + '>Todas</option><option value="5"' + (_reviewUi.stars === '5' ? ' selected' : '') + '>5 estrelas</option><option value="4"' + (_reviewUi.stars === '4' ? ' selected' : '') + '>4 estrelas</option><option value="3"' + (_reviewUi.stars === '3' ? ' selected' : '') + '>3 estrelas</option><option value="2"' + (_reviewUi.stars === '2' ? ' selected' : '') + '>2 estrelas</option><option value="1"' + (_reviewUi.stars === '1' ? ' selected' : '') + '>1 estrela</option></select></label>' +
        customHtml +
      '</div>' +
    '</div>';
  }

  function _approveReview(id) {
    DB.update('reviews', id, { approved: true, rejected: false, status: 'approved' }).then(function () {
      UI.toast('Avaliação aprovada', 'success');
      _loadMeta();
    }).catch(function (err) {
      UI.toast('Erro ao aprovar: ' + err.message, 'error');
    });
  }

  function _rejectReview(id) {
    DB.update('reviews', id, { rejected: true, approved: false, status: 'rejected' }).then(function () {
      UI.toast('Avaliação rejeitada', 'info');
      _loadMeta();
    }).catch(function (err) {
      UI.toast('Erro ao rejeitar: ' + err.message, 'error');
    });
  }

  function _reviewFilterOptions(values, selected, emptyLabel) {
    return values.map(function (v) {
      var label = v === 'all' ? emptyLabel : _reviewFilterLabel(v);
      return '<option value="' + _esc(v) + '"' + (String(selected || 'all') === String(v) ? ' selected' : '') + '>' + _esc(label) + '</option>';
    }).join('');
  }

  function _filterOptions(values, selected, emptyLabel) {
    return values.map(function (v, idx) {
      var label = idx === 0 ? emptyLabel : _segmentLabel(v);
      return '<option value="' + _esc(v) + '"' + (String(selected || '') === String(v) ? ' selected' : '') + '>' + _esc(label) + '</option>';
    }).join('');
  }

  function _originOptions(selected) {
    return '<option value="">Canal principal</option>' + _channelNames().map(function (name) {
      return '<option value="' + _esc(name) + '"' + (String(selected || '') === String(name) ? ' selected' : '') + '>' + _esc(_title(name)) + '</option>';
    }).join('');
  }

  function _channelNames() {
    var names = ['Cardápio', 'Loja própria', 'WhatsApp'];
    (_canais || []).forEach(function (c) {
      var name = c && (c.name || c.nome || c.label);
      if (name && names.indexOf(name) < 0) names.push(name);
    });
    return names;
  }

  function _reviewFilterLabel(v) {
    var key = String(v || '').toLowerCase();
    if (key === 'approved') return 'Aprovadas';
    if (key === 'pending') return 'Pendentes';
    if (key === 'rejected') return 'Rejeitadas';
    return _title(v);
  }

  function _orderFilterOptions(values, selected, emptyLabel) {
    return values.map(function (v) {
      var label = v === 'all' ? emptyLabel : _orderStatusOrChannelLabel(v);
      return '<option value="' + _esc(v) + '"' + (String(selected || 'all') === String(v) ? ' selected' : '') + '>' + _esc(label) + '</option>';
    }).join('');
  }

  function _orderStatusOrChannelLabel(v) {
    var key = String(v || '').toLowerCase();
    if (key === 'all') return 'Todos';
    if (key === 'cardapio') return 'Cardápio';
    if (key === 'template') return 'Template';
    if (key === 'store') return 'Loja';
    if (key === 'whatsapp') return 'WhatsApp';
    if (key === 'delivery') return 'Entrega';
    if (key === 'pickup') return 'Retirada';
    var found = COLUMNS.find(function (c) { return String(c.key).toLowerCase() === key; });
    return found ? found.label : _title(v);
  }

  function _orderChannelKey(order) {
    return String(order && (order.channel || order.source || '')).trim().toLowerCase();
  }

  function _orderChannelLabel(order) {
    var key = _orderChannelKey(order);
    if (key === 'cardapio') return 'Cardápio';
    if (key === 'template') return 'Template';
    if (key === 'store') return 'Loja';
    if (key === 'whatsapp') return 'WhatsApp';
    if (key === 'pickup') return 'Retirada';
    if (key === 'delivery') return 'Entrega';
    if (!key) return '—';
    return _title(key);
  }

  function _orderStatusLabel(status) {
    var key = String(status || 'Pendente');
    var found = COLUMNS.find(function (c) { return c.key === key; });
    return found ? found.label : key;
  }

  function _isCardapioOrder(order) {
    return _orderChannelKey(order) === 'cardapio';
  }

  function _cardapioOrders() {
    return (_orders || []).filter(_isCardapioOrder).sort(function (a, b) { return _dateTs(b) - _dateTs(a); });
  }

  function _matchedCustomer(order) {
    if (!order) return null;
    var id = String(order.customerId || order.clientId || '').trim();
    var phone = _phone(order.phone || order.customerPhone || order.whatsapp);
    var email = _clean(order.email || order.customerEmail);
    var name = _clean(order.customerName || order.clientName || order.name);
    return (_customers || []).find(function (c) {
      if (id && String(c.id || '') === id) return true;
      if (phone && _phone(c.phone || c.whatsapp) === phone) return true;
      if (email && _clean(c.email || '') === email) return true;
      if (name && _clean(c.name || '') === name) return true;
      return false;
    }) || null;
  }

  function _matchedCustomerByPhone(order) {
    if (!order) return null;
    var phone = _phone(order.phone || order.customerPhone || order.whatsapp);
    if (!phone) return null;
    return (_customers || []).find(function (c) {
      return _phone(c.phone || c.whatsapp || '') === phone;
    }) || null;
  }

  function _syncOrderCustomerLinks(list) {
    var rows = Array.isArray(list) ? list : (_orders || []);
    if (!_customers || !_customers.length || !rows.length) return;
    rows.forEach(function (order) {
      if (!order) return;
      if (String(order.customerId || order.clientId || '').trim()) return;
      var customer = _matchedCustomerByPhone(order);
      if (!customer || !customer.id) return;
      var update = {
        customerId: customer.id,
        clientId: customer.id,
        customerName: customer.name || order.customerName || order.clientName || order.name || '',
        clientName: customer.name || order.customerName || order.clientName || order.name || '',
        name: customer.name || order.customerName || order.clientName || order.name || '',
        phone: customer.phone || order.phone || '',
        customerPhone: customer.phone || order.customerPhone || '',
        whatsapp: customer.whatsapp || customer.phone || order.whatsapp || '',
        email: customer.email || order.email || '',
        customerEmail: customer.email || order.customerEmail || ''
      };
      DB.update('orders', order.id, update).then(function () {
        _orders = _orders.map(function (o) {
          if (String(o.id || '') !== String(order.id || '')) return o;
          return Object.assign({}, o, update);
        });
        if (String(_detailModalOrderId || '') === String(order.id || '') && typeof _refreshDetailView === 'function') _refreshDetailView(order.id);
        if (order.status === 'Entregado' && Modules.Marketing && typeof Modules.Marketing._pointsGrantForOrder === 'function') {
          Modules.Marketing._pointsGrantForOrder(order.id, Object.assign({}, order, update), customer).catch(function () {});
        }
      }).catch(function (err) {
        console.warn('[Pedidos] auto link order customer failed', err);
      });
    });
  }

  function _reviewsForCustomer(customer, order) {
    var cid = customer ? String(customer.id || '') : '';
    var name = customer ? _clean(customer.name || '') : _clean((order || {}).customerName || (order || {}).clientName || (order || {}).name || '');
    return (_reviews || []).filter(function (r) {
      if (cid && String(r.customerId || '') === cid) return true;
      if (name && _clean(r.customerName || r.name || '') === name) return true;
      return false;
    }).sort(function (a, b) { return _reviewDateTs(b) - _reviewDateTs(a); });
  }

  function _reviewDateTs(review) {
    if (!review) return 0;
    var raw = review.createdAt || review.approvedAt || review.updatedAt || review.date || '';
    if (raw && typeof raw.toDate === 'function') return raw.toDate().getTime();
    var d = new Date(raw);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function _orderReviewSummary(order) {
    var customer = _matchedCustomer(order);
    var reviews = _reviewsForCustomer(customer, order);
    var avg = reviews.length ? reviews.reduce(function (sum, r) { return sum + (Number(r.stars || r.rating || 0) || 0); }, 0) / reviews.length : 0;
    return { customer: customer, reviews: reviews, avg: avg };
  }

  function _orderSearchHaystack(order) {
    var customer = _matchedCustomer(order);
    var reviewSummary = _orderReviewSummary(order);
    var reviewTexts = (reviewSummary.reviews || []).slice(0, 2).map(function (r) {
      return [r.comment, r.text].filter(Boolean).join(' ');
    }).join(' ');
    return [
      order.id,
      order.customerName,
      order.clientName,
      order.name,
      order.phone,
      order.customerPhone,
      order.whatsapp,
      order.address,
      _orderScheduleInfo(order).text,
      order.note,
      order.status,
      _orderChannelLabel(order),
      customer ? customer.name : '',
      customer ? customer.phone : '',
      customer ? customer.email : '',
      reviewTexts
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function _orderMatchesFilters(order) {
    var q = String(_ui.q || '').trim().toLowerCase();
    var status = String(_ui.status || 'all').toLowerCase();
    var channel = String(_ui.channel || 'all').toLowerCase();
    var orderStatus = String(order.status || 'Pendente').toLowerCase();
    var orderChannel = _orderChannelKey(order);
    if (q && _orderSearchHaystack(order).indexOf(q) < 0) return false;
    if (status !== 'all' && orderStatus !== status.toLowerCase()) return false;
    if (channel !== 'all' && orderChannel !== channel) return false;
    return true;
  }

  function _filteredOrders() {
    return (_orders || []).slice().filter(_orderMatchesFilters).sort(function (a, b) { return _dateTs(b) - _dateTs(a); });
  }

  function _allOrdersStats(orders) {
    var list = Array.isArray(orders) ? orders : [];
    var matched = 0;
    var reviewed = 0;
    var total = 0;
    list.forEach(function (o) {
      total += _num(o.total || o.amount || o.grandTotal);
      var customer = _matchedCustomer(o);
      if (customer) matched += 1;
      if (_reviewsForCustomer(customer, o).length) reviewed += 1;
    });
    return {
      totalOrders: list.length,
      customerHits: matched,
      reviewedOrders: reviewed,
      avgTicket: list.length ? total / list.length : 0
    };
  }

  function _kpiCard(label, value, sub) {
    return '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,.06);padding:14px 16px;min-height:94px;display:flex;flex-direction:column;justify-content:space-between;">' +
      '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;">' + _esc(label) + '</div>' +
      '<div style="font-family:\'League Spartan\',sans-serif;font-size:24px;font-weight:900;line-height:1;color:#1A1A1A;">' + _esc(value == null ? '0' : value) + '</div>' +
      '<div style="font-size:12px;color:#8A7E7C;line-height:1.35;">' + _esc(sub || '') + '</div>' +
    '</div>';
  }

  function _renderOrdersListHTML() {
    var orders = _filteredOrders();
    if (!orders.length) {
      return '<div style="background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.06);">' + UI.emptyState('Nenhum pedido encontrado', '📦') + '</div>';
    }
    return orders.map(function (o) {
      var review = _orderReviewSummary(o);
      var customer = review.customer;
      var customerStats = customer ? _customerStats(customer) : { ordersCount: 0, totalSpent: 0 };
      var stars = review.avg ? Math.round(review.avg) : 0;
      var starsText = stars ? '★'.repeat(stars) + '☆'.repeat(5 - stars) : '';
      var items = (o.items || []).map(function (i) { return (i.qty || i.quantity || 1) + 'x ' + (i.name || i.nome || 'Produto'); }).join(', ');
      var customerLabel = customer ? customer.name : (o.customerName || o.clientName || o.name || 'Cliente');
      var reviewLabel = review.reviews.length ? (review.avg ? review.avg.toFixed(1) + '/5' : review.reviews.length + ' avaliação(ões)') : 'Sem avaliações';
      var phoneHref = _orderPhoneHref(o);
      return '<div onclick="Modules.Pedidos._openDetail(\'' + _esc(o.id) + '\')" style="background:#fff;border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,.06);padding:14px 16px;cursor:pointer;display:grid;grid-template-columns:minmax(0,1.7fr) auto;gap:12px;align-items:start;">' +
        '<div style="min-width:0;">' +
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
            '<strong style="font-size:16px;">' + _esc(customerLabel) + '</strong>' +
            UI.badge(_orderChannelLabel(o), 'gray') +
            UI.badge(_orderStatusLabel(o.status), 'blue') +
            (o.type ? UI.badge(o.type === 'pickup' ? 'Retirada' : 'Entrega', o.type === 'pickup' ? 'green' : 'orange') : '') +
            _orderPaymentBadge(o) +
          '</div>' +
          '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;line-height:1.45;display:flex;flex-wrap:wrap;gap:6px;align-items:center;">' +
            '<span>' + _esc(_orderScheduleInfo(o).text) + '</span>' +
            (o.address ? '<span>· ' + _esc(o.address) + '</span>' : '') +
            (phoneHref ? '<a href="' + _esc(phoneHref) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="color:#1A9E5A;font-weight:800;text-decoration:none;">· WhatsApp</a>' : '') +
          '</div>' +
          (items ? '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;line-height:1.45;">' + _esc(items) + '</div>' : '') +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center;">' +
            (customer ? UI.badge('Cliente cadastrado', 'green') : UI.badge('Cliente novo', 'gray')) +
            (customerStats.ordersCount ? UI.badge(customerStats.ordersCount + ' pedido(s)', 'blue') : '') +
            (review.reviews.length ? UI.badge(reviewLabel, 'orange') : UI.badge('Sem review', 'gray')) +
            (starsText ? '<span style="font-size:13px;color:#FFD166;font-weight:800;">' + _esc(starsText) + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div style="text-align:right;min-width:130px;">' +
          '<div style="font-family:\'League Spartan\',sans-serif;font-size:20px;font-weight:900;color:#C4362A;line-height:1.1;">' + UI.fmt(_num(o.total || o.amount || o.grandTotal)) + '</div>' +
          '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">' + _esc(_orderChannelLabel(o)) + '</div>' +
          '<div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;margin-top:10px;" onclick="event.stopPropagation();">' +
            (phoneHref ? '<a href="' + _esc(phoneHref) + '" target="_blank" rel="noopener" style="border:none;background:#E8FFF1;color:#1A9E5A;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:800;cursor:pointer;text-decoration:none;">WhatsApp</a>' : '') +
            '<button onclick="Modules.Pedidos._openDetail(\'' + _esc(o.id) + '\')" style="border:none;background:#F2EDED;color:#1A1A1A;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:800;cursor:pointer;">Detalhes</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function _renderCustomersPanel() {
    var list = (_customers || []).slice().sort(function (a, b) {
      var sa = _customerStats(a);
      var sb = _customerStats(b);
      return (sb.totalSpent || 0) - (sa.totalSpent || 0) || (sb.ordersCount || 0) - (sa.ordersCount || 0) || String(a.name || '').localeCompare(String(b.name || ''));
    }).slice(0, 5);
    if (!list.length) return '<div style="font-size:13px;color:#8A7E7C;line-height:1.5;">Nenhum cliente cadastrado.</div>';
    return '<div style="display:flex;flex-direction:column;gap:10px;">' + list.map(function (c) {
      var s = _customerStats(c);
      var reviewSummary = _customerReviewStats(c);
      return '<div style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:12px;padding:12px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
          '<strong style="font-size:14px;">' + _esc(c.name || 'Cliente') + '</strong>' +
          (reviewSummary.count ? UI.badge(reviewSummary.avg.toFixed(1) + '★', 'orange') : UI.badge('Sem review', 'gray')) +
        '</div>' +
        '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">' + s.ordersCount + ' pedido(s) · ' + UI.fmt(s.totalSpent) + '</div>' +
        '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">' + (c.phone ? _esc(c.phone) : 'Sem telefone') + '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function _renderReviewsPanel() {
    var list = (_reviews || []).slice().sort(function (a, b) { return _reviewDateTs(b) - _reviewDateTs(a); }).slice(0, 5);
    if (!list.length) return '<div style="font-size:13px;color:#8A7E7C;line-height:1.5;">Nenhuma avaliação encontrada.</div>';
    return '<div style="display:flex;flex-direction:column;gap:10px;">' + list.map(function (r) {
      var stars = Number(r.stars || r.rating || 0) || 0;
      var approved = String(r.approved || r.status || '').toLowerCase() === 'approved';
      var customerName = r.customerName || r.name || 'Cliente';
      var ts = _reviewDateTs(r);
      return '<div style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:12px;padding:12px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
          '<strong style="font-size:14px;">' + _esc(customerName) + '</strong>' +
          UI.badge(approved ? 'Aprovada' : 'Pendente', approved ? 'green' : 'orange') +
        '</div>' +
        '<div style="font-size:13px;color:#FFD166;margin-top:5px;letter-spacing:1px;">' + _esc('★'.repeat(stars) + '☆'.repeat(5 - stars)) + '</div>' +
        '<div style="font-size:12px;color:#8A7E7C;margin-top:5px;line-height:1.45;">' + _esc(r.comment || r.text || '') + '</div>' +
        '<div style="font-size:11px;color:#8A7E7C;margin-top:6px;">' + _esc(_reviewSourceLabel(r)) + (ts ? ' · ' + _esc(UI.fmtDate(new Date(ts))) : '') + '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function _customerStats(c) {
    var orders = _ordersForClient(c);
    var valid = orders.filter(function (o) {
      var st = String(o.status || '').toLowerCase();
      return st !== 'cancelado' && st !== 'canceled' && st !== 'cancelled';
    });
    var total = valid.reduce(function (s, o) { return s + _num(o.total || o.amount || o.grandTotal); }, 0);
    return { ordersCount: valid.length, totalSpent: total };
  }

  function _customerReviewStats(c) {
    var rows = (_reviews || []).filter(function (r) {
      return String(r.customerId || '') === String(c.id || '') || _clean(r.customerName || r.name || '') === _clean(c.name || '');
    });
    var avg = rows.length ? rows.reduce(function (sum, r) { return sum + (Number(r.stars || r.rating || 0) || 0); }, 0) / rows.length : 0;
    return { count: rows.length, avg: avg };
  }

  function _renderKanban(orders) {
    var wrap = document.getElementById('kanban-wrap');
    if (!wrap) return;
    _renderKanbanInto(wrap, orders);
  }

  function _renderKanbanInto(wrap, orders) {
    if (!wrap) return;

    wrap.innerHTML = COLUMNS.map(function (col) {
      var colOrders = orders.filter(function (o) { return (o.status || 'Pendente') === col.key; });
      return '<div class="kb-col" data-col="' + col.key + '" style="flex:0 0 230px;background:#F7F4F4;border-radius:14px;display:flex;flex-direction:column;max-height:calc(100vh - 140px);">' +
        '<div style="padding:10px 12px 8px;border-radius:14px 14px 0 0;background:' + col.bg + ';border-bottom:3px solid ' + col.color + ';">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;">' +
        '<span style="font-size:12px;font-weight:800;color:' + col.color + ';">' + col.label + '</span>' +
        '<span style="background:' + col.color + '30;font-size:10px;font-weight:800;padding:2px 7px;border-radius:10px;color:' + col.color + ';">' + colOrders.length + '</span>' +
        '</div></div>' +
        '<div class="kb-cards" data-col="' + col.key + '" style="padding:8px;flex:1;overflow-y:auto;min-height:60px;display:flex;flex-direction:column;gap:8px;" ' +
        'ondragover="event.preventDefault();this.style.background=\'rgba(196,54,42,.08)\'" ' +
        'ondragleave="this.style.background=\'\'" ' +
        'ondrop="Modules.Pedidos._onDrop(event,\'' + col.key + '\')">' +
        colOrders.map(function (o) { return _cardHTML(o); }).join('') +
        '</div></div>';
    }).join('');
  }

  function _quickStatus(id, status) {
    _updateOrderStatus(id, status, { toast: 'Status atualizado!', prompt: true });
  }

  function _openKitchenMode() {
    if (_kitchenModeOverlay) return;
    var overlay = document.createElement('div');
    overlay.id = 'pedidos-kitchen-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:20000;background:#FBF5F3;display:flex;flex-direction:column;';
    overlay.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid #F2EDED;background:#fff;">' +
        '<div>' +
          '<div style="font-size:12px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Modo cozinha</div>' +
          '<div style="font-family:\'League Spartan\',sans-serif;font-size:22px;font-weight:800;line-height:1.1;">Kanban operacional</div>' +
        '</div>' +
        '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
          '<button onclick="Modules.Pedidos._closeKitchenMode()" style="border:1.5px solid #D4C8C6;background:#fff;color:#1A1A1A;border-radius:999px;padding:10px 14px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">Voltar</button>' +
          '<button onclick="Modules.Pedidos._testAlarm()" style="border:1.5px solid #C4362A;background:#fff;color:#C4362A;border-radius:999px;padding:10px 14px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">Testar alarme</button>' +
        '</div>' +
      '</div>' +
      '<div style="flex:1;min-height:0;padding:16px 20px 20px;overflow:hidden;">' +
        '<div id="kitchen-full-board" style="display:flex;gap:12px;overflow-x:auto;flex:1;min-height:0;padding-bottom:6px;height:100%;"></div>' +
      '</div>';
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    _kitchenModeOverlay = overlay;
    _renderKanbanInto(document.getElementById('kitchen-full-board'), _activeKitchenOrders());
  }

  function _isKitchenModeOpen() {
    return !!_kitchenModeOverlay;
  }

  function _closeKitchenMode() {
    if (!_kitchenModeOverlay) return;
    document.body.style.overflow = '';
    _kitchenModeOverlay.remove();
    _kitchenModeOverlay = null;
    _kitchenDetailId = null;
  }

  function _closeDetailModal() {
    var existing = document.getElementById('pedidos-detail-overlay');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    document.body.style.overflow = '';
    _detailModalOrderId = null;
    _detailWhatsappPromptVisible = false;
  }

  function _refreshDetailView(id) {
    var current = _orders.find(function (x) { return String(x.id || '') === String(id || ''); });
    if (!current) return;
    var kitchenOpen = _isKitchenModeOpen();
    if (kitchenOpen) {
      _renderKitchenDetailPanel(current);
      return;
    }
    _closeDetailModal();
    _openDetail(id);
  }

  var _detailModalOrderId = null;
  var _detailWhatsappPromptVisible = false;

  function _detailOrderCustomer(order) {
    var customer = _matchedCustomer(order);
    var linked = !!(customer || String(order && (order.customerId || order.clientId || '')).trim());
    return { customer: customer, linked: linked };
  }

  function _detailPaymentInfo(order) {
    var total = _num(order && (order.total != null ? order.total : order.finalSubtotal != null ? order.finalSubtotal : order.subtotal != null ? order.subtotal : 0));
    var paid = _num(order && (order.paidAmount != null ? order.paidAmount : order.amountPaid != null ? order.amountPaid : order.valuePaid != null ? order.valuePaid : order.paid != null ? order.paid : 0));
    if (!paid && String(order && order.paymentStatus || '').toLowerCase().indexOf('pago') >= 0) paid = total;
    var pending = Math.max(0, total - paid);
    var method = _firstText(order && order.paymentMethod, order && order.payMethod, order && order.payment, order && order.formaPagamento, order && order.paymentType, '');
    var status = _firstText(order && order.paymentStatus, order && order.payStatus, order && order.statusPayment, order && order.paymentState, '');
    return { total: total, paid: paid, pending: pending, method: method, status: status };
  }

  function _detailItemPricing(item) {
    item = item || {};
    var qty = Math.max(1, _num(item.qty != null ? item.qty : item.quantity != null ? item.quantity : item.count != null ? item.count : 1) || 1);
    var originalUnit = _num(item.originalUnitPrice != null ? item.originalUnitPrice : item.originalPrice != null ? item.originalPrice : item.priceOriginal != null ? item.priceOriginal : item.price != null ? item.price : 0);
    var finalUnit = _num(item.promoUnitPrice != null ? item.promoUnitPrice : item.finalPrice != null ? item.finalPrice : item.finalUpsellPrice != null ? item.finalUpsellPrice : item.unitPrice != null ? item.unitPrice : 0);
    var originalSubtotal = _num(item.originalTotal != null ? item.originalTotal : item.originalSubtotal != null ? item.originalSubtotal : 0);
    var subtotal = _num(item.promoTotal != null ? item.promoTotal : item.total != null ? item.total : item.subtotal != null ? item.subtotal : 0);
    if (!originalSubtotal && originalUnit) originalSubtotal = +(originalUnit * qty).toFixed(2);
    if (!subtotal && finalUnit) subtotal = +(finalUnit * qty).toFixed(2);
    if (!subtotal && originalSubtotal) subtotal = originalSubtotal;
    if (!finalUnit && subtotal && qty) finalUnit = +(subtotal / qty).toFixed(2);
    if (!originalUnit && originalSubtotal && qty) originalUnit = +(originalSubtotal / qty).toFixed(2);
    var discount = Math.max(0, originalSubtotal - subtotal);
    return {
      qty: qty,
      originalUnit: originalUnit,
      finalUnit: finalUnit,
      originalSubtotal: originalSubtotal,
      subtotal: subtotal,
      discount: discount,
      variants: item.variants || item.selections || item.options || '',
      note: item.note || item.observation || item.observations || item.comment || ''
    };
  }

  function _detailItemHTML(item, idx, order) {
    var p = _detailItemPricing(item);
    var unitHTML = p.discount > 0
      ? '<div style="font-size:12px;color:#8A7E7C;text-decoration:line-through;">' + UI.fmt(p.originalUnit) + '</div><div style="font-size:13px;font-weight:900;color:#1A1A1A;">' + UI.fmt(p.finalUnit) + '</div>'
      : '<div style="font-size:13px;font-weight:900;color:#1A1A1A;">' + UI.fmt(p.finalUnit) + '</div>';
    var extra = [];
    if (p.variants) extra.push('<div style="font-size:11px;color:#8A7E7C;line-height:1.45;">' + _esc(p.variants) + '</div>');
    if (p.note) extra.push('<div style="font-size:11px;color:#8A7E7C;line-height:1.45;">' + _esc(p.note) + '</div>');
    return '<div class="pm-check-item' + (item.checked ? ' checked' : '') + '" onclick="Modules.Pedidos._toggleItem(\'' + _esc(order.id) + '\',' + idx + ',this)" style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;background:' + (item.checked ? '#EDFAF3' : '#fff') + ';border:1px solid ' + (item.checked ? '#CFE9D8' : '#F2EDED') + ';border-radius:14px;cursor:pointer;transition:background .15s;">' +
      '<input type="checkbox"' + (item.checked ? ' checked' : '') + ' style="margin-top:2px;width:18px;height:18px;accent-color:#1A9E5A;flex-shrink:0;cursor:pointer;">' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">' +
          '<div style="min-width:0;">' +
            '<div style="font-size:13px;font-weight:900;line-height:1.25;">' + p.qty + 'x ' + _esc(item.name || item.productName || 'Item') + '</div>' +
            extra.join('') +
          '</div>' +
          '<div style="text-align:right;flex-shrink:0;">' + unitHTML + '<div style="margin-top:6px;font-size:12px;color:#8A7E7C;">Subtotal</div><div style="font-size:14px;font-weight:900;color:#C4362A;">' + UI.fmt(p.subtotal) + '</div></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function _detailObservationBlocks(order) {
    var blocks = [];
    if (order.note) blocks.push({ label: 'Observación del cliente', text: order.note, color: '#FFF7ED' });
    if (order.kitchenNote) blocks.push({ label: 'Observación da cozinha', text: order.kitchenNote, color: '#F5F3FF' });
    if (order.internalNote) blocks.push({ label: 'Observación interna', text: order.internalNote, color: '#FAF8F8' });
    if (!blocks.length) return '<div style="font-size:13px;color:#8A7E7C;">Sin observaciones</div>';
    return blocks.map(function (b) {
      return '<div style="background:' + b.color + ';border-radius:12px;padding:12px;border:1px solid #F2EDED;">' +
        '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:5px;">' + _esc(b.label) + '</div>' +
        '<div style="font-size:13px;color:#1A1A1A;line-height:1.5;">' + _esc(b.text) + '</div>' +
      '</div>';
    }).join('');
  }

  function _detailWhatsappMsg(order, statusLabel) {
    var statusText = statusLabel || _orderStatusLabel(order.status);
    var baseText = 'Hola, actualizamos tu pedido.';
    return _orderWhatsappMessage(order, statusText, baseText);
  }

  function _showDetailWhatsappPrompt(order, status) {
    _detailWhatsappPromptVisible = true;
    var el = document.getElementById('detail-whatsapp-prompt');
    if (!el) return;
    var phone = _orderPhoneDigits(order);
    var msg = _detailWhatsappMsg(order, _orderStatusLabel(status || order.status));
    el.style.display = 'block';
    el.innerHTML = '<div style="margin-top:12px;border:1px solid #F1E6E3;border-radius:14px;padding:14px;background:#fff;display:flex;flex-direction:column;gap:10px;">' +
      '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;">Atualização do pedido</div>' +
      '<div style="font-size:14px;font-weight:800;color:#1A1A1A;">Status actualizado. ¿Deseas avisar al cliente por WhatsApp?</div>' +
      '<div style="font-size:13px;color:#5D514F;line-height:1.45;">' + (phone ? 'Se abrirá WhatsApp en una nueva pestaña con el mensaje preparado.' : 'Sin teléfono registrado.') + '</div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;">' +
        (phone ? '<button onclick="Modules.Pedidos._sendDetailWhatsapp(\'' + _esc(order.id) + '\', \'' + _esc(status || order.status || '') + '\')" style="border:none;background:#1A9E5A;color:#fff;border-radius:12px;padding:10px 14px;font-size:13px;font-weight:800;cursor:pointer;">Enviar WhatsApp</button>' : '<button disabled style="border:none;background:#E5E7EB;color:#9CA3AF;border-radius:12px;padding:10px 14px;font-size:13px;font-weight:800;cursor:not-allowed;">Enviar WhatsApp</button>') +
        '<button onclick="Modules.Pedidos._hideDetailWhatsappPrompt()" style="border:1.5px solid #D4C8C6;background:#fff;color:#1A1A1A;border-radius:12px;padding:10px 14px;font-size:13px;font-weight:800;cursor:pointer;">Ahora no</button>' +
      '</div>' +
      '<div style="display:none" data-detail-whatsapp-msg>' + _esc(msg) + '</div>' +
    '</div>';
  }

  function _hideDetailWhatsappPrompt() {
    _detailWhatsappPromptVisible = false;
    var el = document.getElementById('detail-whatsapp-prompt');
    if (el) { el.style.display = 'none'; el.innerHTML = ''; }
  }

  function _sendDetailWhatsapp(orderId, status) {
    var order = _orders.find(function (x) { return String(x.id || '') === String(orderId || ''); });
    if (!order) return;
    var phone = _orderPhoneDigits(order);
    if (!phone) {
      UI.toast('Sin teléfono registrado para avisar por WhatsApp.', 'info');
      return;
    }
    var msg = _detailWhatsappMsg(order, _orderStatusLabel(status || order.status));
    window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(msg), '_blank');
  }

  function _orderClientActions(order, customer) {
    var phone = _orderPhoneDigits(order);
    if (customer && customer.id) {
      return '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">' +
        '<button onclick="event.stopPropagation();Modules.Pedidos._openClientProfile(\'' + _esc(customer.id) + '\');" style="border:none;background:#EEF4FF;color:#2563EB;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:800;cursor:pointer;">Ver cadastro do cliente</button>' +
        (phone ? '<button onclick="Modules.Pedidos._waFromDetail(\'' + _esc(order.id) + '\');event.stopPropagation();" style="border:none;background:#E8FFF1;color:#1A9E5A;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:800;cursor:pointer;">WhatsApp</button>' : '<span style="font-size:12px;color:#8A7E7C;">Sin teléfono registrado</span>') +
      '</div>';
    }
    return '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">' +
      '<button onclick="event.stopPropagation();Modules.Pedidos._openOrderCustomerModal(\'' + _esc(order.id) + '\');" style="border:none;background:#C4362A;color:#fff;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:800;cursor:pointer;">Cadastrar cliente</button>' +
      (phone ? '<button onclick="Modules.Pedidos._waFromDetail(\'' + _esc(order.id) + '\');event.stopPropagation();" style="border:none;background:#E8FFF1;color:#1A9E5A;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:800;cursor:pointer;">WhatsApp</button>' : '<span style="font-size:12px;color:#8A7E7C;">Sin teléfono registrado</span>') +
    '</div>';
  }

  function _orderPickupText(order) {
    return _firstText(order.pickupAddress, order.deliveryLocation, _generalConfig.pickupAddress, _generalConfig.pickupArea, 'Retirada no local');
  }

  function _orderAddressText(order) {
    var parts = [order.address, order.complement, order.neighborhood || order.zone, order.postalCode].filter(Boolean);
    return parts.join(' · ');
  }

  function _openOrderCustomerModal(order) {
    order = order || {};
    var matched = _matchedCustomer(order);
    var name = matched ? matched.name : (order.customerName || order.clientName || order.name || '');
    var phone = matched ? (matched.phone || matched.whatsapp || '') : _firstText(order.phone, order.customerPhone, order.whatsapp, '');
    var email = matched ? (matched.email || '') : _firstText(order.email, order.customerEmail, '');
    var address = matched ? (matched.address || '') : _firstText(order.address, order.deliveryAddress, '');
    var notes = matched ? (matched.notes || matched.internalNotes || '') : _firstText(order.note, order.kitchenNote, order.internalNote, '');
    var body = '<div style="display:grid;gap:12px;">' +
      '<div style="background:#F8F6F5;border-radius:14px;padding:14px;">' +
        '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Dados do cliente</div>' +
        '<div style="display:grid;grid-template-columns:1.2fr .8fr;gap:12px;">' +
          '<div><label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;margin-bottom:4px;">Nome</label><input id="oc-name" value="' + _esc(name) + '" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;"></div>' +
          '<div><label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;margin-bottom:4px;">Telefone / WhatsApp</label><input id="oc-phone" value="' + _esc(phone) + '" placeholder="Telefone / WhatsApp" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;"></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">' +
          '<div><label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;margin-bottom:4px;">E-mail</label><input id="oc-email" value="' + _esc(email) + '" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;"></div>' +
          '<div><label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;margin-bottom:4px;">Endereço</label><input id="oc-address" value="' + _esc(address) + '" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;"></div>' +
        '</div>' +
        '<div style="margin-top:12px;"><label style="font-size:11px;font-weight:800;color:#8A7E7C;display:block;margin-bottom:4px;">Observações</label><textarea id="oc-notes" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;min-height:84px;resize:vertical;">' + _esc(notes) + '</textarea></div>' +
      '</div>' +
      '<div style="font-size:13px;color:#8A7E7C;line-height:1.45;">O cliente será vinculado ao pedido atual após salvar.</div>' +
    '</div>';
    var overlay = document.createElement('div');
    overlay.id = 'pedidos-customer-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = '<div style="background:#fff;width:100%;max-width:760px;max-height:90vh;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden;">' +
      '<div style="padding:18px 20px;border-bottom:1px solid #F2EDED;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">' +
        '<div>' +
          '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Cliente</div>' +
          '<h2 style="font-family:\'League Spartan\',sans-serif;font-size:22px;font-weight:800;line-height:1.1;margin:0;">Cadastrar cliente</h2>' +
        '</div>' +
        '<button onclick="Modules.Pedidos._closeCustomerModal()" style="width:34px;height:34px;border-radius:50%;border:none;background:#F2EDED;cursor:pointer;font-size:16px;flex-shrink:0;">✕</button>' +
      '</div>' +
      '<div style="padding:16px 20px 18px;overflow:auto;flex:1;min-height:0;background:#FBF5F3;">' + body + '</div>' +
      '<div style="padding:16px 20px;border-top:1px solid #F2EDED;background:#fff;flex:0 0 auto;">' + footer + '</div>' +
    '</div>';
    document.body.appendChild(overlay);
    window._orderCustomerModal = { el: overlay, close: _closeCustomerModal };
  }

  function _closeCustomerModal() {
    var el = document.getElementById('pedidos-customer-overlay');
    if (el && el.parentNode) el.parentNode.removeChild(el);
    window._orderCustomerModal = null;
  }

  function _saveOrderCustomer(orderId) {
    var order = _orders.find(function (x) { return String(x.id || '') === String(orderId || ''); });
    if (!order) return;
    var name = String((document.getElementById('oc-name') || {}).value || '').trim();
    var phone = String((document.getElementById('oc-phone') || {}).value || '').trim();
    var email = String((document.getElementById('oc-email') || {}).value || '').trim();
    var address = String((document.getElementById('oc-address') || {}).value || '').trim();
    var notes = String((document.getElementById('oc-notes') || {}).value || '').trim();
    if (!name) { UI.toast('Informe o nome do cliente.', 'error'); return; }
    var match = _customers.find(function (c) {
      if (order.customerId && String(c.id || '') === String(order.customerId)) return true;
      var opPhone = _phone(phone);
      if (opPhone && _phone(c.phone || c.whatsapp || '') === opPhone) return true;
      return _clean(c.name || '') === _clean(name);
    });
    var data = {
      name: name,
      phone: phone,
      whatsapp: phone,
      email: email,
      address: address,
      notes: notes,
      internalNotes: notes,
      origin: 'pedido',
      mainChannel: _orderChannelLabel(order),
      channelName: _orderChannelLabel(order),
      status: 'ativo',
      acceptsMarketing: false,
      totalOrders: match && match.totalOrders ? match.totalOrders : 0,
      totalSpent: match && match.totalSpent ? match.totalSpent : 0
    };
    var op = match && match.id ? DB.update('store_customers', match.id, data) : DB.add('store_customers', data);
    op.then(function (ref) {
      var customerId = match && match.id ? match.id : (ref && ref.id ? ref.id : ref);
      return DB.update('orders', orderId, {
        customerId: customerId,
        clientId: customerId,
        customerName: name,
        clientName: name,
        name: name,
        phone: phone,
        customerPhone: phone,
        whatsapp: phone,
        email: email,
        customerEmail: email,
        address: address || order.address || '',
        note: notes || order.note || '',
        internalNote: notes || order.internalNote || ''
      }).then(function () {
        _orders = _orders.map(function (o) {
          if (String(o.id || '') !== String(orderId || '')) return o;
          return Object.assign({}, o, {
            customerId: customerId,
            clientId: customerId,
            customerName: name,
            clientName: name,
            name: name,
            phone: phone,
            customerPhone: phone,
            whatsapp: phone,
            email: email,
            customerEmail: email,
            address: address || o.address || '',
            note: notes || o.note || '',
            internalNote: notes || o.internalNote || ''
          });
        });
        _closeCustomerModal();
        _closeDetailModal();
        _openDetail(orderId);
        if (String(order.status || '') === 'Entregado' && Modules.Marketing && typeof Modules.Marketing._pointsGrantForOrder === 'function') {
          Modules.Marketing._pointsGrantForOrder(orderId, Object.assign({}, order, {
            customerId: customerId,
            clientId: customerId,
            customerName: name,
            clientName: name,
            name: name,
            phone: phone,
            customerPhone: phone,
            whatsapp: phone,
            email: email,
            customerEmail: email,
            address: address || order.address || '',
            note: notes || order.note || '',
            internalNote: notes || order.internalNote || ''
          }), { id: customerId, name: name, phone: phone, whatsapp: phone }).then(function () {
            if (typeof Modules.Marketing._refreshPoints === 'function') Modules.Marketing._refreshPoints();
          }).catch(function () {});
        }
        UI.toast('Cliente vinculado ao pedido.', 'success');
      });
    }).catch(function (err) {
      UI.toast('Erro ao vincular cliente: ' + err.message, 'error');
    });
  }

  function _clearKitchenPrompt() {
    var existing = document.getElementById('kitchen-whatsapp-prompt');
    if (existing) existing.remove();
  }

  function _showKitchenWhatsappPrompt(order, status, msg) {
    if (!_kitchenModeOverlay) return false;
    _clearKitchenPrompt();
    var phone = _orderPhoneDigits(order);
    var prompt = document.createElement('div');
    prompt.id = 'kitchen-whatsapp-prompt';
    prompt.style.cssText = 'position:absolute;right:20px;bottom:20px;z-index:20010;width:min(420px,calc(100vw - 40px));background:#fff;border:1px solid #F1E6E3;border-radius:16px;box-shadow:0 16px 40px rgba(0,0,0,.18);padding:16px;display:flex;flex-direction:column;gap:12px;';

    var title = 'Status atualizado. Deseja avisar o cliente no WhatsApp?';
    var subtitle = phone ? (msg || '') : 'Este pedido no tiene teléfono registrado para avisar por WhatsApp.';
    prompt.innerHTML =
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">' +
        '<div style="min-width:0;">' +
          '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">Atualização do pedido</div>' +
          '<div style="font-size:15px;font-weight:900;line-height:1.35;color:#1A1A1A;">' + _esc(title) + '</div>' +
          '<div style="margin-top:6px;font-size:13px;line-height:1.45;color:#5D514F;">' + _esc(subtitle) + '</div>' +
        '</div>' +
        '<button onclick="Modules.Pedidos._closeKitchenWhatsappPrompt()" aria-label="Fechar" style="border:none;background:#F2EDED;color:#8A7E7C;width:28px;height:28px;border-radius:999px;font-size:18px;font-weight:800;cursor:pointer;flex:0 0 auto;">×</button>' +
      '</div>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">' +
        (phone ? '<button onclick="Modules.Pedidos._sendKitchenWhatsapp(\'' + _esc(order.id) + '\', \'' + _esc(status) + '\')" style="border:none;background:#1A9E5A;color:#fff;border-radius:12px;padding:10px 14px;font-size:13px;font-weight:800;cursor:pointer;">Enviar WhatsApp</button>' : '<button disabled style="border:none;background:#E5E7EB;color:#9CA3AF;border-radius:12px;padding:10px 14px;font-size:13px;font-weight:800;cursor:not-allowed;">Enviar WhatsApp</button>') +
        '<button onclick="Modules.Pedidos._closeKitchenWhatsappPrompt()" style="border:1.5px solid #D4C8C6;background:#fff;color:#1A1A1A;border-radius:12px;padding:10px 14px;font-size:13px;font-weight:800;cursor:pointer;">Agora não</button>' +
      '</div>';

    _kitchenModeOverlay.style.position = 'fixed';
    _kitchenModeOverlay.appendChild(prompt);
    if (!phone) {
      UI.toast('Este pedido no tiene teléfono registrado para avisar por WhatsApp.', 'info');
    }
    return true;
  }

  function _closeKitchenWhatsappPrompt() {
    _clearKitchenPrompt();
  }

  function _sendKitchenWhatsapp(orderId, status) {
    var order = _orders.find(function (x) { return String(x.id || '') === String(orderId || ''); });
    if (!order) return;
    var phone = _orderPhoneDigits(order);
    if (!phone) {
      UI.toast('Este pedido no tiene teléfono registrado para avisar por WhatsApp.', 'info');
      return;
    }
    var statusKey = String(status || order.status || 'Pendente');
    var fn = WA_MSGS[statusKey] || WA_MSGS[_orderStatusLabel(statusKey)];
    var msg = fn ? fn(order) : _orderWhatsappMessage(order, _orderStatusLabel(statusKey), 'Hola, actualizamos tu pedido.');
    _clearKitchenPrompt();
    window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(msg), '_blank');
  }

  function _closeKitchenDetailPanel() {
    _kitchenDetailId = null;
    var existing = document.getElementById('kitchen-detail-panel');
    if (existing) existing.remove();
  }

  function _renderKitchenDetailPanel(order) {
    if (!_kitchenModeOverlay || !order) return;
    _kitchenDetailId = order.id;
    _closeKitchenDetailPanel();

    var panel = document.createElement('aside');
    panel.id = 'kitchen-detail-panel';
    panel.style.cssText = 'position:absolute;top:0;right:0;height:100%;width:min(460px,100vw);background:#fff;border-left:1px solid #F2EDED;box-shadow:-10px 0 28px rgba(0,0,0,.12);z-index:20012;display:flex;flex-direction:column;';

    var phoneHref = _orderPhoneHref(order);
    var statusOptions = COLUMNS.map(function (c) {
      return '<option value="' + c.key + '"' + (String(order.status || '') === c.key ? ' selected' : '') + '>' + c.label + '</option>';
    }).join('');
    var itemsHTML = (order.items || []).map(function (item, i) {
      return '<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid #F2EDED;border-radius:12px;background:' + (item.checked ? '#EDFAF3' : '#fff') + ';cursor:pointer;">' +
        '<input type="checkbox" ' + (item.checked ? 'checked' : '') + ' onclick="event.stopPropagation();Modules.Pedidos._toggleItem(\'' + _esc(order.id) + '\',' + i + ',this.parentNode)" style="margin-top:2px;width:18px;height:18px;accent-color:#1A9E5A;cursor:pointer;">' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:13px;font-weight:800;line-height:1.25;">' + (item.qty || 1) + 'x ' + _esc(item.name || '') + '</div>' +
          (item.variants ? '<div style="margin-top:3px;font-size:11px;color:#8A7E7C;">' + _esc(item.variants) + '</div>' : '') +
          (item.note ? '<div style="margin-top:3px;font-size:11px;color:#8A7E7C;">' + _esc(item.note) + '</div>' : '') +
        '</div>' +
      '</label>';
    }).join('');

    panel.innerHTML =
      '<div style="padding:16px 18px;border-bottom:1px solid #F2EDED;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">' +
        '<div style="min-width:0;">' +
          '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">Detalhes do pedido</div>' +
          '<div style="font-family:\'League Spartan\',sans-serif;font-size:24px;font-weight:900;line-height:1.1;">' + _esc(order.customerName || 'Cliente') + '</div>' +
          '<div style="margin-top:6px;font-size:12px;color:#8A7E7C;">' + _esc(_orderScheduleInfo(order).text) + '</div>' +
        '</div>' +
        '<button onclick="Modules.Pedidos._closeKitchenDetailPanel()" style="border:none;background:#F2EDED;color:#1A1A1A;width:32px;height:32px;border-radius:999px;font-size:18px;font-weight:800;cursor:pointer;">×</button>' +
      '</div>' +
      '<div style="flex:1;min-height:0;overflow:auto;padding:16px 18px 18px;display:flex;flex-direction:column;gap:14px;">' +
        '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">' +
          '<div style="background:#FAF8F8;border:1px solid #F2EDED;border-radius:14px;padding:12px;">' +
            '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Telefone</div>' +
            (phoneHref ? '<a href="' + _esc(phoneHref) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="font-size:13px;font-weight:800;color:#1A9E5A;text-decoration:none;">WhatsApp</a>' : '<div style="font-size:13px;font-weight:800;color:#8A7E7C;">Sem telefone</div>') +
          '</div>' +
          '<div style="background:#FAF8F8;border:1px solid #F2EDED;border-radius:14px;padding:12px;">' +
            '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Canal</div>' +
            '<div style="font-size:13px;font-weight:800;">' + _esc(_orderChannelLabel(order)) + '</div>' +
          '</div>' +
          '<div style="background:#FAF8F8;border:1px solid #F2EDED;border-radius:14px;padding:12px;">' +
            '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Tipo</div>' +
            '<div style="font-size:13px;font-weight:800;">' + _esc(order.type === 'pickup' ? 'Retirada' : 'Entrega') + '</div>' +
          '</div>' +
          '<div style="background:#FAF8F8;border:1px solid #F2EDED;border-radius:14px;padding:12px;">' +
            '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Total</div>' +
            '<div style="font-size:16px;font-weight:900;color:#C4362A;">' + UI.fmt(order.total || 0) + '</div>' +
          '</div>' +
        '</div>' +
        (order.address ? '<div style="background:#fff7ed;border:1px solid #F3D9C7;border-radius:14px;padding:12px;"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Endereço</div><div style="font-size:13px;line-height:1.45;">' + _esc(order.address) + '</div></div>' : '') +
        (order.note || order.kitchenNote ? '<div style="background:#F5F3FF;border:1px solid #E7E0FF;border-radius:14px;padding:12px;"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Observações</div><div style="font-size:13px;line-height:1.45;">' + _esc(order.note || order.kitchenNote) + '</div></div>' : '') +
        '<div>' +
          '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Checklist</div>' +
          '<div style="display:flex;flex-direction:column;gap:8px;">' + itemsHTML + '</div>' +
        '</div>' +
        '<div style="margin-top:auto;border-top:1px solid #F2EDED;padding-top:14px;display:flex;flex-direction:column;gap:10px;">' +
          '<label style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;">Status</label>' +
          '<select id="kitchen-detail-status" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;background:#fff;outline:none;">' + statusOptions + '</select>' +
          '<div style="display:flex;gap:10px;">' +
            '<button onclick="Modules.Pedidos._saveKitchenDetail(\'' + _esc(order.id) + '\')" style="flex:1;padding:12px 14px;border:none;border-radius:12px;background:#C4362A;color:#fff;font-size:14px;font-weight:800;cursor:pointer;">Salvar status</button>' +
            (phoneHref ? '<button onclick="Modules.Pedidos._waFromKitchenDetail(\'' + _esc(order.id) + '\')" style="padding:12px 14px;border:none;border-radius:12px;background:#1A9E5A;color:#fff;font-size:14px;font-weight:800;cursor:pointer;">WhatsApp</button>' : '') +
          '</div>' +
        '</div>' +
      '</div>';

    _kitchenModeOverlay.appendChild(panel);
  }

  function _cardHTML(o) {
    var items = (o.items || []).slice(0, 2).map(function (i) { return (i.qty || 1) + 'x ' + i.name; }).join(', ');
    if ((o.items || []).length > 2) items += '…';
    var phoneHref = _orderPhoneHref(o);
    return '<div class="kcard" draggable="true" data-id="' + o.id + '" ' +
      'ondragstart="Modules.Pedidos._onDragStart(event,\'' + o.id + '\')" ' +
      'ondragend="Modules.Pedidos._onDragEnd(event)" ' +
      'onclick="Modules.Pedidos._openDetail(\'' + o.id + '\')" ' +
      'style="background:#fff;border-radius:10px;padding:11px;box-shadow:0 1px 5px rgba(0,0,0,.08);cursor:pointer;border:1.5px solid transparent;transition:box-shadow .2s;user-select:none;">' +
      '<div style="display:inline-flex;align-items:center;gap:3px;font-size:9px;font-weight:800;padding:2px 7px;border-radius:6px;margin-bottom:5px;text-transform:uppercase;background:' + (o.type === 'pickup' ? '#D1FAE5' : '#DBEAFE') + ';color:' + (o.type === 'pickup' ? '#065F46' : '#1E40AF') + ';">' +
      (o.type === 'pickup' ? '🏪 Retirada' : '🛵 Entrega') + '</div>' +
      '<div style="font-family:\'League Spartan\',sans-serif;font-size:14px;font-weight:800;line-height:1.2;margin-bottom:2px;">' + (o.customerName || 'Cliente') + '</div>' +
      '<div style="font-size:10px;color:#8A7E7C;margin-bottom:6px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;">' +
        '<span>' + _esc(_orderScheduleInfo(o).text) + '</span>' +
        (phoneHref ? '<a href="' + _esc(phoneHref) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="color:#1A9E5A;text-decoration:none;font-weight:800;">WhatsApp</a>' : '') +
      '</div>' +
      '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px;">' +
        UI.badge(_orderChannelLabel(o), 'gray') +
        UI.badge(_orderStatusLabel(o.status), 'blue') +
        _orderPaymentBadge(o) +
      '</div>' +
      (items ? '<div style="font-size:10px;color:#1a1a1a;border-top:1px solid #F2EDED;padding-top:5px;margin-bottom:7px;">' + items + '</div>' : '') +
      '<div style="display:flex;align-items:center;justify-content:space-between;">' +
      '<span style="font-family:\'League Spartan\',sans-serif;font-size:13px;font-weight:800;color:#C4362A;">' + UI.fmt(o.total || 0) + '</span>' +
      '<div style="display:flex;gap:4px;" onclick="event.stopPropagation()">' +
      (phoneHref ? '<button onclick="Modules.Pedidos._whatsapp(\'' + o.id + '\')" style="width:26px;height:26px;border:none;border-radius:7px;cursor:pointer;background:#E8FFF1;color:#1A9E5A;font-size:13px;display:flex;align-items:center;justify-content:center;">💬</button>' : '') +
      '<button onclick="Modules.Pedidos._openDetail(\'' + o.id + '\')" style="width:26px;height:26px;border:none;border-radius:7px;cursor:pointer;background:#F2EDED;color:#1A1A1A;font-size:12px;display:flex;align-items:center;justify-content:center;">≡</button>' +
      '<button onclick="Modules.Pedidos._cancelOrder(\'' + o.id + '\')" style="width:26px;height:26px;border:none;border-radius:7px;cursor:pointer;background:#FEF2F2;color:#DC2626;font-size:13px;display:flex;align-items:center;justify-content:center;">✕</button>' +
      '</div></div></div>';
  }

  var _draggingId = null;

  function _onDragStart(e, id) {
    _draggingId = id;
    e.dataTransfer.effectAllowed = 'move';
    var el = document.querySelector('.kcard[data-id="' + id + '"]');
    if (el) el.style.opacity = '.35';
  }

  function _onDragEnd(e) {
    var el = document.querySelector('.kcard[data-id="' + _draggingId + '"]');
    if (el) el.style.opacity = '1';
    document.querySelectorAll('.kb-cards').forEach(function (c) { c.style.background = ''; });
  }

  function _onDrop(e, newStatus) {
    e.preventDefault();
    document.querySelectorAll('.kb-cards').forEach(function (c) { c.style.background = ''; });
    if (!_draggingId) return;
    _updateOrderStatus(_draggingId, newStatus, { toast: 'Status atualizado: ' + newStatus, prompt: true });
    _draggingId = null;
  }

  function _openDetail(id) {
    var o = _orders.find(function (x) { return x.id === id; });
    if (!o) return;
    if (_isKitchenModeOpen()) {
      _renderKitchenDetailPanel(o);
      return;
    }
    try {
      var detailCustomer = _detailOrderCustomer(o);
      var customer = detailCustomer.customer;
      var payment = _detailPaymentInfo(o);
      var phoneHref = _orderPhoneHref(o);
      var topName = _firstText(o.customerName, o.clientName, o.name, customer && customer.name, 'Cliente');
      var topDate = _orderScheduleInfo(o).text;
      var statusOptions = COLUMNS.map(function (c) {
        return '<option value="' + c.key + '"' + (String(o.status || 'Pendente') === c.key ? ' selected' : '') + '>' + c.label + '</option>';
      }).join('');
      var itemsHTML = (o.items || []).map(function (item, i) { return _detailItemHTML(item, i, o); }).join('');
      var addressText = o.type === 'pickup' ? _orderPickupText(o) : _orderAddressText(o);
      var deliveryLabel = o.type === 'pickup' ? 'Retirada' : 'Entrega';
      var customerStateLabel = detailCustomer.linked ? 'Cliente vinculado' : 'Sem vínculo';
      var customerStatusTone = detailCustomer.linked ? '#1A9E5A' : '#8A7E7C';
      var customerStatusBg = detailCustomer.linked ? '#EDFAF3' : '#F2EDED';
      var pointsHtml = Modules.Marketing && typeof Modules.Marketing._pointsOrderBlockHtml === 'function'
        ? Modules.Marketing._pointsOrderBlockHtml(o, customer)
        : '';

      var body = '<div style="display:flex;flex-direction:column;gap:14px;">' +
        '<section style="background:linear-gradient(180deg,#FFF 0%,#FCF8F7 100%);border:1px solid #F1E6E3;border-radius:18px;padding:16px 16px 14px;box-shadow:0 6px 20px rgba(0,0,0,.04);">' +
          '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">' +
            '<div style="min-width:0;flex:1;">' +
              '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.6px;margin-bottom:7px;">Detalhes do pedido</div>' +
              '<div style="font-family:\'League Spartan\',sans-serif;font-size:28px;font-weight:900;line-height:1;color:#C4362A;">' + UI.fmt(payment.total) + '</div>' +
              '<div style="margin-top:8px;font-size:13px;color:#1A1A1A;font-weight:700;line-height:1.45;">' + _esc(topName) + '</div>' +
              '<div style="margin-top:4px;font-size:12px;color:#8A7E7C;">' + _esc(topDate) + '</div>' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;min-width:160px;">' +
              UI.badge(_orderStatusLabel(o.status), 'blue') +
              UI.badge(deliveryLabel, o.type === 'pickup' ? 'green' : 'orange') +
              _orderPaymentBadge(o) +
            '</div>' +
          '</div>' +
        '</section>' +

        '<section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">' +
          '<div style="background:#fff;border:1px solid #F2EDED;border-radius:16px;padding:14px;">' +
            '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:5px;">Cliente</div>' +
            '<div style="font-size:15px;font-weight:900;line-height:1.25;">' + _esc(topName) + '</div>' +
            '<div style="margin-top:6px;display:inline-flex;align-items:center;padding:5px 10px;border-radius:999px;background:' + customerStatusBg + ';color:' + customerStatusTone + ';font-size:11px;font-weight:800;">' + _esc(customerStateLabel) + '</div>' +
            (_orderClientActions(o, customer) || '') +
          '</div>' +
          '<div style="background:#fff;border:1px solid #F2EDED;border-radius:16px;padding:14px;">' +
            '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:5px;">' + _esc(deliveryLabel) + '</div>' +
            '<div style="font-size:14px;font-weight:800;line-height:1.45;">' + _esc(addressText || (o.type === 'pickup' ? 'Retirada no local' : 'Sem endereço')) + '</div>' +
            (o.type === 'delivery' && o.zone ? '<div style="margin-top:6px;font-size:12px;color:#8A7E7C;">Zona: ' + _esc(o.zone) + '</div>' : '') +
            (o.type === 'delivery' && o.postalCode ? '<div style="margin-top:4px;font-size:12px;color:#8A7E7C;">CP: ' + _esc(o.postalCode) + '</div>' : '') +
            '<div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
              '<div><label style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;display:block;margin-bottom:4px;">Dia</label><input id="detail-delivery-date" type="date" value="' + _esc(_firstText(o.deliveryDate, o.scheduleDate, '')) + '" style="width:100%;padding:9px 10px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:13px;font-family:inherit;background:#fff;outline:none;"></div>' +
              '<div><label style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;display:block;margin-bottom:4px;">Horário</label><input id="detail-delivery-time" type="time" value="' + _esc(_firstText(o.deliveryTime, o.scheduleTime, '')) + '" style="width:100%;padding:9px 10px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:13px;font-family:inherit;background:#fff;outline:none;"></div>' +
            '</div>' +
          '</div>' +
          '<div style="background:#fff;border:1px solid #F2EDED;border-radius:16px;padding:14px;">' +
            '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:5px;">Pagamento</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">' +
              (payment.method ? UI.badge(_paymentMethodLabel(payment.method), 'gray') : UI.badge('Sem forma definida', 'gray')) +
              (payment.status ? UI.badge(_paymentStatusLabel(payment.status), 'blue') : UI.badge('Sem status', 'gray')) +
            '</div>' +
            '<div style="margin-bottom:10px;">' +
              '<label style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;display:block;margin-bottom:4px;">Forma de pagamento</label>' +
              '<select id="detail-payment-method" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:12px;font-size:14px;font-family:inherit;background:#fff;outline:none;">' + _paymentMethodOptions(payment.method) + '</select>' +
            '</div>' +
            '<div style="margin-bottom:10px;">' +
              '<label style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;display:block;margin-bottom:4px;">Status do pagamento</label>' +
              '<select id="detail-payment-status" onchange="Modules.Pedidos._detailPaymentSync()" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:12px;font-size:14px;font-family:inherit;background:#fff;outline:none;">' + _paymentStatusOptions(payment.status || (payment.paid >= payment.total && payment.total > 0 ? 'pago' : payment.paid > 0 ? 'parcial' : 'previsto')) + '</select>' +
            '</div>' +
            '<div id="detail-paid-amount-box" style="margin-bottom:10px;display:' + (((payment.status || '').toLowerCase() === 'parcial') ? 'block' : 'none') + ';">' +
              '<label style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;display:block;margin-bottom:4px;">Valor pago</label>' +
              '<input id="detail-paid-amount" type="number" step="0.01" value="' + _esc(String(payment.paid || 0)) + '" placeholder="0,00" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:12px;font-size:14px;font-family:inherit;background:#fff;outline:none;">' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
              '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Valor total</div><div style="font-size:14px;font-weight:900;color:#1A1A1A;">' + UI.fmt(payment.total) + '</div></div>' +
              '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Valor pago</div><div style="font-size:14px;font-weight:900;color:#1A1A1A;">' + UI.fmt(payment.paid) + '</div></div>' +
              '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Pendente</div><div style="font-size:14px;font-weight:900;color:#C4362A;">' + UI.fmt(payment.pending) + '</div></div>' +
            '</div>' +
          '</div>' +
          '<div style="background:#fff;border:1px solid #F2EDED;border-radius:16px;padding:14px;">' +
            '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:5px;">Status</div>' +
            '<select id="detail-status" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:12px;font-size:14px;font-family:inherit;background:#fff;outline:none;">' + statusOptions + '</select>' +
            '<div id="detail-whatsapp-prompt" style="display:none;"></div>' +
          '</div>' +
        '</section>' +

        (pointsHtml ? '<section style="display:grid;grid-template-columns:1fr;gap:12px;">' + pointsHtml + '</section>' : '') +

        '<section style="display:grid;grid-template-columns:1fr;gap:12px;">' +
          '<div style="background:#fff;border:1px solid #F2EDED;border-radius:16px;padding:14px;">' +
            '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Observações</div>' +
            _detailObservationBlocks(o) +
          '</div>' +
          '<div style="background:#fff;border:1px solid #F2EDED;border-radius:16px;padding:14px;">' +
            '<div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Itens do pedido</div>' +
            (itemsHTML || '<div style="font-size:13px;color:#8A7E7C;">Sem itens neste pedido.</div>') +
          '</div>' +
        '</section>' +
      '</div>';

      var footer = '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;">' +
        '<button onclick="Modules.Pedidos._saveDetail(\'' + _esc(id) + '\')" style="padding:12px 16px;border:none;border-radius:12px;background:#C4362A;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;">Salvar</button>' +
        '<button onclick="Modules.Pedidos._sendDetailWhatsapp(\'' + _esc(id) + '\')" style="padding:12px 16px;border:none;border-radius:12px;background:#1A9E5A;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;">Enviar WhatsApp</button>' +
        '<button onclick="Modules.Pedidos._closeDetailModal()" style="padding:12px 16px;border:1.5px solid #D4C8C6;border-radius:12px;background:#fff;color:#1A1A1A;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;">Fechar</button>' +
      '</div>';

      var overlay = document.createElement('div');
      overlay.id = 'pedidos-detail-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px;';
      overlay.innerHTML = '<div style="background:#fff;width:100%;max-width:1120px;max-height:90vh;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden;">' +
        '<div style="padding:20px 24px;border-bottom:1px solid #F2EDED;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex:0 0 auto;background:#fff;">' +
          '<div style="min-width:0;">' +
            '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Pedido</div>' +
            '<h2 style="font-family:\'League Spartan\',sans-serif;font-size:22px;font-weight:800;line-height:1.1;margin:0;">Detalhes do pedido</h2>' +
          '</div>' +
          '<button onclick="Modules.Pedidos._closeDetailModal()" style="width:34px;height:34px;border-radius:50%;border:none;background:#F2EDED;cursor:pointer;font-size:16px;flex-shrink:0;">✕</button>' +
        '</div>' +
        '<div id="pedidos-detail-body" style="padding:16px 20px 20px;overflow:auto;flex:1;min-height:0;background:#FBF5F3;">' + body + '</div>' +
        '<div style="padding:16px 24px;border-top:1px solid #F2EDED;background:#fff;flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;">' +
          '<div style="font-size:12px;color:#8A7E7C;line-height:1.4;">Salve o status sem sair do modal. O WhatsApp é opcional e abre em nova aba.</div>' +
          footer +
        '</div>' +
      '</div>';
      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';
      window._currentDetailModal = { close: _closeDetailModal, el: overlay };
      window._currentDetailOrderId = id;
    } catch (err) {
      console.error('Pedidos detail modal error', err);
      var fallbackCustomer = o.customerName || o.clientName || o.name || 'Cliente';
      UI.modal({
        title: 'Pedido — ' + fallbackCustomer,
        body: '<div style="display:flex;flex-direction:column;gap:12px;">' +
          '<div style="background:#fff;border:1px solid #F2EDED;border-radius:14px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
            '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:6px;">Resumo do pedido</div>' +
            '<div style="font-family:\'League Spartan\',sans-serif;font-size:28px;font-weight:900;line-height:1;color:#C4362A;">' + UI.fmt(_num(o.total || o.amount || o.grandTotal)) + '</div>' +
            '<div style="margin-top:8px;font-size:13px;font-weight:700;">' + _esc(fallbackCustomer) + '</div>' +
            '<div style="margin-top:4px;font-size:12px;color:#8A7E7C;">' + _esc(_orderScheduleInfo(o).text) + '</div>' +
            '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">' +
              UI.badge(_orderStatusLabel(o.status), 'blue') +
              UI.badge(_orderChannelLabel(o), 'gray') +
              UI.badge(o.type === 'pickup' ? 'Retirada' : 'Entrega', o.type === 'pickup' ? 'green' : 'orange') +
            '</div>' +
          '</div>' +
          '<div style="font-size:13px;color:#8A7E7C;line-height:1.5;">Não foi possível carregar o detalhe completo deste pedido agora. Os dados principais seguem disponíveis.</div>' +
        '</div>',
        footer: '<div style="display:flex;gap:10px;"><button onclick="Modules.Pedidos._saveDetail(\'' + id + '\')" style="flex:1;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">💾 Salvar</button></div>',
        maxWidth: '760px'
      });
    }
  }

  function _toggleItem(orderId, idx, el) {
    var o = _orders.find(function (x) { return x.id === orderId; });
    if (!o || !o.items) return;
    var items = o.items.slice();
    items[idx] = Object.assign({}, items[idx], { checked: !items[idx].checked });
    o.items = items;
    DB.update('orders', orderId, { items: items });
    el.style.background = items[idx].checked ? '#EDFAF3' : '#F2EDED';
    var cb = el.querySelector('input[type=checkbox]');
    if (cb) cb.checked = items[idx].checked;
  }

  function _saveDetail(id) {
    var sel = document.getElementById('detail-status');
    var paymentSel = document.getElementById('detail-payment-method');
    var paymentStatusSel = document.getElementById('detail-payment-status');
    var paidAmountInput = document.getElementById('detail-paid-amount');
    var scheduleDateSel = document.getElementById('detail-delivery-date');
    var scheduleTimeSel = document.getElementById('detail-delivery-time');
    if (!sel) return;
    _hideDetailWhatsappPrompt();
    var order = _orders.find(function (x) { return String(x.id || '') === String(id || ''); });
    var nextStatus = String(sel.value || 'Pendente');
    var nextPaymentMethod = String((paymentSel && paymentSel.value) || (order && order.paymentMethod) || '').trim();
    var nextPaymentStatus = String((paymentStatusSel && paymentStatusSel.value) || (order && order.paymentStatus) || 'previsto').trim() || 'previsto';
    var nextPaidAmount = _num((paidAmountInput && paidAmountInput.value) || (order && order.paidAmount) || 0);
    var nextDeliveryDate = String((scheduleDateSel && scheduleDateSel.value) || (order && order.deliveryDate) || '').trim();
    var nextDeliveryTime = String((scheduleTimeSel && scheduleTimeSel.value) || (order && order.deliveryTime) || '').trim();
    if (nextPaymentStatus === 'pago') nextPaidAmount = _detailPaymentInfo(order || {}).total;
    if (nextPaymentStatus !== 'parcial') nextPaidAmount = nextPaymentStatus === 'pago' ? nextPaidAmount : 0;
    var currentStatus = String(order && order.status || 'Pendente');
    var currentPaymentMethod = String(order && order.paymentMethod || '').trim();
    var currentPaymentStatus = String(order && order.paymentStatus || '').trim();
    var currentPaidAmount = _num(order && order.paidAmount);
    var currentDeliveryDate = String(order && order.deliveryDate || '').trim();
    var currentDeliveryTime = String(order && order.deliveryTime || '').trim();
    var statusChanged = nextStatus !== currentStatus;
    var paymentChanged = nextPaymentMethod !== currentPaymentMethod;
    var paymentMetaChanged = nextPaymentStatus !== currentPaymentStatus || Math.abs(nextPaidAmount - currentPaidAmount) > 0.001;
    var scheduleChanged = nextDeliveryDate !== currentDeliveryDate || nextDeliveryTime !== currentDeliveryTime;
    var tasks = [];

    if (statusChanged) {
      tasks.push(_updateOrderStatus(id, nextStatus, { toast: 'Pedido atualizado!', prompt: false }));
    }
    if (paymentChanged) {
      tasks.push(DB.update('orders', id, { paymentMethod: nextPaymentMethod }).then(function () {
        if (order) order.paymentMethod = nextPaymentMethod;
      }));
    }
    if (paymentMetaChanged) {
      tasks.push(DB.update('orders', id, {
        paymentStatus: nextPaymentStatus,
        paymentState: nextPaymentStatus,
        paidAmount: nextPaidAmount,
        amountPaid: nextPaidAmount,
        valuePaid: nextPaidAmount,
        paid: nextPaymentStatus === 'pago' ? true : (nextPaymentStatus === 'parcial' ? nextPaidAmount : false),
        payment: nextPaymentStatus
      }).then(function () {
        if (order) {
          order.paymentStatus = nextPaymentStatus;
          order.paymentState = nextPaymentStatus;
          order.paidAmount = nextPaidAmount;
          order.amountPaid = nextPaidAmount;
          order.valuePaid = nextPaidAmount;
          order.paid = nextPaymentStatus === 'pago' ? true : (nextPaymentStatus === 'parcial' ? nextPaidAmount : false);
          order.payment = nextPaymentStatus;
        }
      }));
    }
    if (scheduleChanged) {
      tasks.push(DB.update('orders', id, {
        deliveryDate: nextDeliveryDate,
        deliveryTime: nextDeliveryTime,
        slot: [nextDeliveryDate, nextDeliveryTime].filter(Boolean).join(' ').trim()
      }).then(function () {
        if (order) {
          order.deliveryDate = nextDeliveryDate;
          order.deliveryTime = nextDeliveryTime;
          order.slot = [nextDeliveryDate, nextDeliveryTime].filter(Boolean).join(' ').trim();
        }
      }));
    }
    if (!tasks.length) {
      if (order) _showDetailWhatsappPrompt(order, nextStatus);
      return;
    }

    Promise.all(tasks).then(function () {
      var fresh = _orders.find(function (x) { return String(x.id || '') === String(id || ''); }) || order;
      if (fresh) {
        fresh.paymentMethod = nextPaymentMethod;
        fresh.paymentStatus = nextPaymentStatus;
        fresh.paymentState = nextPaymentStatus;
        fresh.paidAmount = nextPaidAmount;
        fresh.amountPaid = nextPaidAmount;
        fresh.valuePaid = nextPaidAmount;
        fresh.paid = nextPaymentStatus === 'pago' ? true : (nextPaymentStatus === 'parcial' ? nextPaidAmount : false);
        fresh.payment = nextPaymentStatus;
        fresh.deliveryDate = nextDeliveryDate;
        fresh.deliveryTime = nextDeliveryTime;
        fresh.slot = [nextDeliveryDate, nextDeliveryTime].filter(Boolean).join(' ').trim();
      }
      _syncOrderFinanceMovement(id, fresh || order || {});
      _refreshDetailView(id);
      if (statusChanged && fresh) _showDetailWhatsappPrompt(fresh, nextStatus);
    }).catch(function (err) {
      UI.toast('Não foi possível atualizar o pedido: ' + (err && err.message ? err.message : 'erro'), 'error');
    });
  }

  function _detailPaymentSync() {
    var statusSel = document.getElementById('detail-payment-status');
    var paidBox = document.getElementById('detail-paid-amount-box');
    var paidInput = document.getElementById('detail-paid-amount');
    if (!statusSel) return;
    var status = String(statusSel.value || 'previsto');
    if (paidBox) paidBox.style.display = status === 'parcial' ? 'block' : 'none';
    if (paidInput) {
      if (status === 'pago') {
        var order = _orders.find(function (x) { return String(x.id || '') === String(_currentDetailOrderId || ''); });
        var payment = _detailPaymentInfo(order || {});
        paidInput.value = String(payment.total || 0);
      }
      if (status !== 'parcial' && status !== 'pago') paidInput.value = '0';
    }
  }

  function _applyPointsDiscount(id) {
    var order = _orders.find(function (x) { return String(x.id || '') === String(id || ''); });
    if (!order) return;
    var customer = _matchedCustomer(order);
    if (!Modules.Marketing || typeof Modules.Marketing._pointsApplyDiscount !== 'function') {
      UI.toast('Programa de pontos indisponível no momento.', 'error');
      return;
    }
    Modules.Marketing._pointsApplyDiscount(id, order, customer).then(function () {
      UI.toast('Desconto com pontos aplicado.', 'success');
      _refreshDetailView(id);
    }).catch(function (err) {
      UI.toast(err && err.message ? err.message : 'Não foi possível aplicar os pontos.', 'error');
    });
  }

  function _saveKitchenDetail(id) {
    var sel = document.getElementById('kitchen-detail-status');
    if (!sel) return;
    _updateOrderStatus(id, sel.value, { toast: 'Status atualizado!', prompt: true });
  }

  function _waFromKitchenDetail(id) {
    var o = _orders.find(function (x) { return x.id === id; });
    if (!o) return;
    var status = (document.getElementById('kitchen-detail-status') || {}).value || o.status;
    var fn = WA_MSGS[status] || WA_MSGS[_orderStatusLabel(status)];
    var msg = fn ? fn(o) : _orderWhatsappMessage(o, _orderStatusLabel(status), 'Hola, actualizamos tu pedido.');
    var phone = _orderPhoneDigits(o);
    if (!phone) {
      UI.toast('Este pedido no tiene teléfono registrado para avisar por WhatsApp.', 'info');
      return;
    }
    window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(msg), '_blank');
  }

  function _orderBusinessName() {
    return _firstText(_generalConfig.businessName, _generalConfig.storeName, _generalConfig.name, _generalConfig.title, '');
  }

  function _orderDisplayId(order) {
    if (!order) return '';
    var raw = _firstText(order.orderNumber, order.number, order.code, order.reference, '');
    if (raw) return raw;
    var id = String(order.id || '').trim();
    return id ? ('#' + id.slice(-6).toUpperCase()) : '';
  }

  function _orderPhoneDigits(order) {
    return _phone(_firstText(order && order.phone, order && order.customerPhone, order && order.whatsapp, ''));
  }

  function _orderPhoneHref(order) {
    var phone = _orderPhoneDigits(order);
    return phone ? 'https://wa.me/' + phone : '';
  }

  function _orderScheduleInfo(order) {
    order = order || {};
    var dateRaw = _firstText(order.deliveryDate, order.deliveryDateISO, order.scheduleDate, '');
    var timeRaw = _firstText(order.deliveryTime, order.scheduleTime, '');
    var slotRaw = _firstText(order.slot, order.schedule, '');
    var dateLabel = '';
    var timeLabel = '';
    if (dateRaw) {
      var d = new Date(dateRaw);
      dateLabel = isNaN(d.getTime()) ? String(dateRaw) : UI.fmtDate(d);
    }
    if (timeRaw) {
      timeLabel = String(timeRaw).trim();
    } else if (slotRaw && /^\d{1,2}:\d{2}$/.test(String(slotRaw).trim())) {
      timeLabel = String(slotRaw).trim();
    }
    var text = '';
    if (dateLabel && timeLabel) text = dateLabel + ' · ' + timeLabel;
    else if (dateLabel) text = dateLabel;
    else if (timeLabel) text = timeLabel;
    else if (slotRaw) text = String(slotRaw).trim();
    else text = _fmtDate(order);
    return { date: dateLabel, time: timeLabel, text: text };
  }

  function _orderPaymentBadge(order) {
    if (!order) return '';
    var raw = _firstText(order.paymentStatus, order.payStatus, order.statusPayment, order.payment, '');
    var paid = String(order.paid || order.isPaid || '').toLowerCase();
    var key = _fold(raw);
    if (!key && paid !== 'false' && paid !== '0' && paid) key = 'pago';
    if (!key) return '';
    if (key.indexOf('pago') >= 0 || key.indexOf('paid') >= 0 || key.indexOf('quit') >= 0) return UI.badge('Pago', 'green');
    if (key.indexOf('parc') >= 0 || key.indexOf('part') >= 0) return UI.badge('Parcial', 'orange');
    return UI.badge(_title(raw), 'gray');
  }

  function _orderWhatsappMessage(order, statusLabel, baseText) {
    var pieces = [];
    if (baseText) pieces.push(String(baseText).trim());
    var customer = _firstText(order && order.customerName, order && order.clientName, order && order.name, 'cliente');
    var orderLabel = _orderDisplayId(order);
    var business = _orderBusinessName();
    if (customer) pieces.push('Cliente: ' + customer + '.');
    if (orderLabel) pieces.push('Pedido: ' + orderLabel + '.');
    if (business) pieces.push('Negocio: ' + business + '.');
    if (statusLabel) pieces.push('Estado: ' + statusLabel + '.');
    return pieces.join(' ');
  }

  function _promptOrderWhatsapp(orderOrId, status) {
    var order = typeof orderOrId === 'object' ? orderOrId : _orders.find(function (x) { return String(x.id || '') === String(orderOrId || ''); });
    if (!order) return Promise.resolve(false);
    var phone = _orderPhoneDigits(order);
    if (!phone) {
      UI.toast('Cliente sem telefone cadastrado.', 'info');
      return Promise.resolve(false);
    }
    var statusKey = String(status || order.status || 'Pendente');
    var fn = WA_MSGS[statusKey] || WA_MSGS[_orderStatusLabel(statusKey)];
    var msg = fn ? fn(order) : _orderWhatsappMessage(order, _orderStatusLabel(statusKey), 'Hola, actualizamos tu pedido.');
    if (_isKitchenModeOpen() && _showKitchenWhatsappPrompt(order, statusKey, msg)) return Promise.resolve(true);
    var ask = function (text) {
      if (UI && typeof UI.confirm === 'function') return UI.confirm(text);
      return Promise.resolve(window.confirm(text));
    };
    return ask('Status atualizado. Deseja avisar o cliente no WhatsApp?').then(function (yes) {
      if (!yes) return false;
      window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(msg), '_blank');
      return true;
    });
  }

  function _updateOrderStatus(orderId, status, opts) {
    opts = opts || {};
    var nextStatus = String(status || 'Pendente');
    return DB.update('orders', orderId, { status: nextStatus }).then(function () {
      var order = _orders.find(function (x) { return String(x.id || '') === String(orderId || ''); });
      if (order) order.status = nextStatus;
      if (typeof _paintActive === 'function') _paintActive();
      if (_kitchenModeOverlay) {
        var board = document.getElementById('kitchen-full-board');
        if (board) _renderKanbanInto(board, _activeKitchenOrders());
      }
      if (nextStatus === 'Entregado' && Modules.Marketing && typeof Modules.Marketing._pointsGrantForOrder === 'function') {
        Modules.Marketing._pointsGrantForOrder(orderId, order || null, _matchedCustomer(order)).then(function () {
          if (typeof Modules.Marketing._refreshPoints === 'function') Modules.Marketing._refreshPoints();
        }).catch(function () {});
      }
      if (order) {
        _syncOrderFinanceMovement(orderId, order).catch(function () {});
      }
      if (opts.toast !== false) UI.toast(opts.toast || 'Status atualizado!', 'success');
      if (opts.prompt) return _promptOrderWhatsapp(orderId, nextStatus);
      return true;
    }).catch(function (err) {
      UI.toast('Erro ao atualizar: ' + err.message, 'error');
      return false;
    });
  }
  function _waFromDetail(id) {
    var o = _orders.find(function (x) { return x.id === id; });
    if (!o) return;
    var status = (document.getElementById('detail-status') || {}).value || o.status;
    var phone = _orderPhoneDigits(o);
    if (!phone) { UI.toast('Cliente sem telefone cadastrado.', 'info'); return; }
    var msg = _detailWhatsappMsg(o, _orderStatusLabel(status));
    window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(msg), '_blank');
  }

  function _whatsapp(id) {
    var o = _orders.find(function (x) { return x.id === id; });
    if (!o) return;
    var fn = WA_MSGS[o.status];
    var msg = fn ? fn(o) : _orderWhatsappMessage(o, _orderStatusLabel(o.status), 'Hola, gracias por tu pedido.');
    var phone = _orderPhoneDigits(o);
    if (!phone) { UI.toast('Cliente sem telefone cadastrado.', 'info'); return; }
    window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(msg), '_blank');
  }

  function _cancelOrder(id) {
    UI.confirm('Cancelar este pedido?').then(function (yes) {
      if (!yes) return;
      _updateOrderStatus(id, 'Cancelado', { toast: 'Pedido cancelado', prompt: false });
    });
  }

  function _openNewOrderLegacy() {
    var context = _orderContext();
    _manualOrderReset(context);

    var overlay = document.createElement('div');
    overlay.id = 'manual-order-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:7000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;';

    var modal = document.createElement('div');
    modal.style.cssText = 'width:100%;max-width:1240px;max-height:90vh;background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden;';

    var header = document.createElement('div');
    header.style.cssText = 'padding:20px 24px;border-bottom:1px solid #F2EDED;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex:0 0 auto;background:#fff;';
    header.innerHTML = '<div style="min-width:0;">' +
      '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Pedido manual</div>' +
      '<h2 style="font-family:\'League Spartan\',sans-serif;font-size:22px;font-weight:800;line-height:1.1;margin:0;">Criar pedido manual</h2>' +
      '<div id="mo-header-channel" style="margin-top:8px;display:inline-flex;align-items:center;padding:5px 10px;border-radius:999px;background:#FAF8F8;border:1px solid #EEE6E4;font-size:11px;font-weight:800;color:#8A7E7C;">Canal herdado: ' + _esc(_manualOrderDisplayChannel(_manualOrderState.channel)) + '</div>' +
    '</div>' +
    '<button type="button" onclick="Modules.Pedidos._closeManualOrderModal()" style="width:34px;height:34px;border-radius:50%;border:none;background:#F2EDED;cursor:pointer;font-size:16px;flex-shrink:0;">✕</button>';

    var content = document.createElement('div');
    content.style.cssText = 'padding:16px 20px 20px;overflow:auto;flex:1;min-height:0;background:#FBF5F3;';
    content.innerHTML =
      '<div id="manual-order-shell" style="display:grid;grid-template-columns:minmax(0,1.45fr) minmax(340px,.95fr);gap:16px;align-items:start;">' +
        '<div style="display:flex;flex-direction:column;gap:14px;">' +
          '<section style="background:#fff;border:1px solid #F2EDED;border-radius:14px;padding:14px 14px 12px;display:flex;flex-direction:column;gap:12px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">' +
              '<div>' +
                '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Cliente</div>' +
                '<div style="font-size:16px;font-weight:800;color:#1A1A1A;">Selecionar ou criar cliente</div>' +
              '</div>' +
              '<div id="mo-customer-pill" style="font-size:11px;font-weight:800;padding:5px 10px;border-radius:999px;background:#F2EDED;color:#8A7E7C;">Nenhum cliente selecionado</div>' +
            '</div>' +
            '<div>' +
              '<label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Buscar cliente existente</label>' +
              '<input id="mo-customer-search" type="search" list="mo-customer-datalist" value="' + _esc(_manualOrderState.customerQuery) + '" oninput="Modules.Pedidos._manualOrderSearchCustomers(this.value)" placeholder="Buscar por nome, telefone, e-mail ou zona" style="width:100%;padding:11px 14px;border:1.5px solid #D4C8C6;border-radius:999px;font-size:13px;font-family:inherit;outline:none;background:#fff;">' +
              '<datalist id="mo-customer-datalist"></datalist>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">' +
              '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Nome do cliente</label><input id="mo-name" type="text" value="' + _esc(_manualOrderState.customerName) + '" placeholder="Nome" oninput="Modules.Pedidos._manualOrderField(\'customerName\', this.value)" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;"></div>' +
              '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Telefone / WhatsApp</label><input id="mo-phone" type="text" value="' + _esc(_manualOrderState.customerPhone) + '" placeholder="' + _esc(_manualOrderPhonePlaceholder()) + '" oninput="Modules.Pedidos._manualOrderField(\'customerPhone\', this.value)" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;"></div>' +
              '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">E-mail</label><input id="mo-email" type="email" value="' + _esc(_manualOrderState.customerEmail) + '" placeholder="E-mail" oninput="Modules.Pedidos._manualOrderField(\'customerEmail\', this.value)" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;"></div>' +
              '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Tipo</label><select id="mo-type" onchange="Modules.Pedidos._manualOrderSetType(this.value)" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;"><option value="delivery">🛵 Entrega</option><option value="pickup">🏪 Retirada</option></select></div>' +
            '</div>' +
          '</section>' +
          '<section style="background:#fff;border:1px solid #F2EDED;border-radius:14px;padding:14px 14px 12px;display:flex;flex-direction:column;gap:10px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">' +
              '<div>' +
                '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Entrega / Retirada</div>' +
                '<div style="font-size:16px;font-weight:800;color:#1A1A1A;">Definir forma de entrega</div>' +
              '</div>' +
            '</div>' +
            '<div id="mo-delivery-block" style="display:grid;grid-template-columns:2fr 1fr;gap:10px;">' +
              '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Endereço</label><input id="mo-address" type="text" value="' + _esc(_manualOrderState.customerAddress) + '" placeholder="Endereço de entrega" oninput="Modules.Pedidos._manualOrderField(\'customerAddress\', this.value)" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;"></div>' +
              '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Zona / CEP</label><input id="mo-zone" type="text" value="' + _esc(_manualOrderState.customerZone) + '" placeholder="Zona ou CEP" oninput="Modules.Pedidos._manualOrderField(\'customerZone\', this.value);Modules.Pedidos._manualOrderMaybeSyncShipping();" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;"></div>' +
              '<div style="grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
              '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Dia</label><input id="mo-delivery-date" type="date" value="' + _esc(_manualOrderState.deliveryDate || '') + '" oninput="Modules.Pedidos._manualOrderSetDeliveryDate(this.value)" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;"></div>' +
              '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Horário</label><input id="mo-delivery-time" type="time" value="' + _esc(_manualOrderState.deliveryTime || '') + '" oninput="Modules.Pedidos._manualOrderSetDeliveryTime(this.value)" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;"></div>' +
              '</div>' +
              '<div id="mo-delivery-fee-block"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Taxa de entrega</label><input id="mo-shipping" type="number" step="0.01" value="' + _esc(String(_manualOrderState.shippingFee || 0)) + '" oninput="Modules.Pedidos._manualOrderSetShippingFee(this.value)" placeholder="0,00" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;"></div>' +
            '</div>' +
            '<div id="mo-pickup-block" style="display:none;"></div>' +
          '</section>' +
          '<section style="background:#fff;border:1px solid #F2EDED;border-radius:14px;padding:14px 14px 12px;display:flex;flex-direction:column;gap:10px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">' +
              '<div>' +
                '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Produtos</div>' +
                '<div style="font-size:16px;font-weight:800;color:#1A1A1A;">Adicionar itens ao pedido</div>' +
              '</div>' +
            '</div>' +
            '<div>' +
              '<label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Buscar produto</label>' +
              '<input id="mo-product-search" type="search" value="' + _esc(_manualOrderState.productQuery) + '" oninput="Modules.Pedidos._manualOrderSearchItems(this.value)" placeholder="Buscar por produto, categoria ou tag" style="width:100%;padding:11px 14px;border:1.5px solid #D4C8C6;border-radius:999px;font-size:13px;font-family:inherit;outline:none;background:#fff;">' +
            '</div>' +
            '<div id="mo-product-results"></div>' +
          '</section>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:14px;position:sticky;top:0;align-self:start;">' +
          '<section style="background:#fff;border:1px solid #F2EDED;border-radius:14px;padding:14px 14px 12px;display:flex;flex-direction:column;gap:10px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">' +
              '<div>' +
                '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Resumo</div>' +
                '<div style="font-size:16px;font-weight:800;color:#1A1A1A;">Itens selecionados</div>' +
              '</div>' +
              '<div id="mo-price-origin" style="font-size:11px;font-weight:800;padding:5px 10px;border-radius:999px;background:#FFF0EE;color:#C4362A;">Origem: manual</div>' +
            '</div>' +
            '<div id="mo-selected-items"></div>' +
            '<div id="mo-summary" style="display:grid;grid-template-columns:1fr;gap:10px;"></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:end;">' +
              '<div>' +
                '<label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Ajuste manual</label>' +
                '<input id="mo-adjustment" type="number" step="0.01" value="' + _esc(String(_manualOrderState.adjustment || 0)) + '" oninput="Modules.Pedidos._manualOrderSetAdjustment(this.value)" placeholder="0,00" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;">' +
                '<div id="mo-adjustment-note" style="font-size:11px;color:#8A7E7C;margin-top:6px;line-height:1.4;"></div>' +
              '</div>' +
              '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Total final</label><div id="mo-total-final" style="width:100%;padding:12px 12px;border:1.5px solid #E6DDDB;border-radius:10px;background:#F8F6F5;font-size:18px;font-weight:900;color:#1A1A1A;">€0,00</div></div>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr;gap:8px;">' +
              '<div>' +
                '<label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Forma de pagamento</label>' +
                '<select id="mo-payment-method" onchange="Modules.Pedidos._manualOrderSetPaymentMethod(this.value)" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;">' + _paymentMethodOptions(_manualOrderState.paymentMethod) + '</select>' +
              '</div>' +
              '<div>' +
                '<label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Status do pagamento</label>' +
                '<select id="mo-payment-status" onchange="Modules.Pedidos._manualOrderSetPaymentStatus(this.value)" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;">' + _paymentStatusOptions(_manualOrderState.paymentStatus) + '</select>' +
              '</div>' +
              '<div id="mo-paid-amount-box" style="display:' + (_manualOrderState.paymentStatus === 'parcial' ? 'block' : 'none') + ';">' +
                '<label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Valor pago</label>' +
                '<input id="mo-paid-amount" type="number" step="0.01" value="' + _esc(String(_manualOrderState.paidAmount || 0)) + '" oninput="Modules.Pedidos._manualOrderSetPaidAmount(this.value)" placeholder="0,00" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;">' +
              '</div>' +
            '</div>' +
          '</section>' +
        '</div>' +
      '</div>';

    var footer = '<div style="display:flex;gap:10px;justify-content:flex-end;width:100%;">' +
      '<button type="button" onclick="Modules.Pedidos._closeManualOrderModal()" style="padding:11px 16px;border-radius:12px;border:1.5px solid #D4C8C6;background:#fff;color:#1A1A1A;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">Cancelar</button>' +
      '<button id="mo-submit-btn" type="button" onclick="Modules.Pedidos._saveNewOrder()" style="padding:11px 18px;border-radius:12px;border:none;background:#C4362A;color:#fff;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">Criar pedido</button>' +
    '</div>';

    var overlay = document.createElement('div');
    overlay.id = 'manual-order-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:7000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;';

    var modal = document.createElement('div');
    modal.style.cssText = 'width:100%;max-width:1240px;max-height:90vh;background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden;';

    var header = document.createElement('div');
    header.style.cssText = 'padding:20px 24px;border-bottom:1px solid #F2EDED;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex:0 0 auto;background:#fff;';
    header.innerHTML = '<div style="min-width:0;">' +
      '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Pedido manual</div>' +
      '<h2 style="font-family:\'League Spartan\',sans-serif;font-size:22px;font-weight:800;line-height:1.1;margin:0;">Criar pedido manual</h2>' +
      '<div id="mo-header-channel" style="margin-top:8px;display:inline-flex;align-items:center;padding:5px 10px;border-radius:999px;background:#FAF8F8;border:1px solid #EEE6E4;font-size:11px;font-weight:800;color:#8A7E7C;">Canal herdado: ' + _esc(_manualOrderDisplayChannel(_manualOrderState.channel)) + '</div>' +
    '</div>' +
    '<button type="button" onclick="Modules.Pedidos._closeManualOrderModal()" style="width:34px;height:34px;border-radius:50%;border:none;background:#F2EDED;cursor:pointer;font-size:16px;flex-shrink:0;">✕</button>';

    var content = document.createElement('div');
    content.style.cssText = 'padding:16px 20px 20px;overflow:auto;flex:1;min-height:0;background:#FBF5F3;';
    content.innerHTML = body;

    var footerWrap = document.createElement('div');
    footerWrap.style.cssText = 'padding:16px 24px;border-top:1px solid #F2EDED;background:#fff;flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;gap:16px;';
    footerWrap.innerHTML = '<div style="font-size:12px;color:#8A7E7C;line-height:1.4;">O canal é herdado automaticamente. O pedido calcula promoções e totais ao vivo.</div>' + footer;

    modal.appendChild(header);
    modal.appendChild(content);
    modal.appendChild(footerWrap);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.onclick = function (e) { if (e.target === overlay) _closeManualOrderModal(); };

    window._newOrderModal = {
      close: _closeManualOrderModal,
      el: overlay
    };

    _manualOrderRefresh();
  }

  function _saveNewOrder() {
    var name = String(_manualOrderState.customerName || (document.getElementById('mo-name') || {}).value || '').trim();
    var phone = String(_manualOrderState.customerPhone || (document.getElementById('mo-phone') || {}).value || '').trim();
    var email = String(_manualOrderState.customerEmail || (document.getElementById('mo-email') || {}).value || '').trim();
    var address = String(_manualOrderState.customerAddress || (document.getElementById('mo-address') || {}).value || '').trim();
    var zone = String(_manualOrderState.customerZone || (document.getElementById('mo-zone') || {}).value || '').trim();
    var type = String((document.getElementById('mo-type') || {}).value || _manualOrderState.type || 'delivery');
    var deliveryDate = String((document.getElementById('mo-delivery-date') || {}).value || _manualOrderState.deliveryDate || '').trim();
    var deliveryTime = String((document.getElementById('mo-delivery-time') || {}).value || _manualOrderState.deliveryTime || '').trim();
    var slot = [deliveryDate, deliveryTime].filter(Boolean).join(' ').trim();
    var note = String((document.getElementById('mo-note') || {}).value || '').trim();
    var paymentStatus = String((document.getElementById('mo-payment-status') || {}).value || _manualOrderState.paymentStatus || 'previsto').trim() || 'previsto';
    var paidAmount = _num((document.getElementById('mo-paid-amount') || {}).value || _manualOrderState.paidAmount || 0);
    var adjustment = _num((document.getElementById('mo-adjustment') || {}).value || _manualOrderState.adjustment || 0);
    var shippingFee = type === 'delivery' ? _num((document.getElementById('mo-shipping') || {}).value || _manualOrderState.shippingFee || 0) : 0;
    var context = _orderContext();
    var channel = context.channel || 'manual';
    var source = context.source || 'manual';
    var items = (_manualOrderState.items || []).map(function (item) {
      var product = (_products || []).find(function (p) { return String(p.id || '') === String(item.productId || ''); }) || {};
      var calc = _manualOrderState.channel === 'cardapio' ? _manualOrderBestPromoForProduct(product) : null;
      var originalPrice = _manualOrderProductBasePrice(product) || _num(item.originalPrice || 0);
      var finalPrice = calc ? calc.calc.final : _num(item.finalPrice || originalPrice);
      return {
        productId: item.productId,
        name: item.name || _firstText(product.name, product.title, 'Produto'),
        category: item.category || _firstText(product.category, product.categoria, ''),
        quantity: item.quantity || 1,
        originalPrice: originalPrice,
        finalPrice: finalPrice,
        promoId: calc && calc.promo ? String(calc.promo.id || calc.promo._id || calc.promo.slug || '') : (item.promoId || ''),
        promoName: calc && calc.promo ? _firstText(calc.promo.name, calc.promo.title, 'Promoção') : (item.promoName || ''),
        promoType: calc && calc.promo ? String(calc.promo.type || '') : (item.promoType || ''),
        priceOrigin: calc && calc.calc.discount > 0 ? 'promo' : (_manualOrderState.channel === 'cardapio' ? 'automático' : 'manual'),
        manualAdjustment: item.manualAdjustment || 0
      };
    });
    var subtotalOriginal = items.reduce(function (sum, item) { return sum + (_num(item.originalPrice) * (item.quantity || 1)); }, 0);
    var subtotalFinal = items.reduce(function (sum, item) { return sum + (_num(item.finalPrice) * (item.quantity || 1)); }, 0);
    var promoDiscountTotal = Math.max(subtotalOriginal - subtotalFinal, 0);
    var total = Math.max(subtotalFinal + shippingFee + adjustment, 0);
    var hasPromo = promoDiscountTotal > 0;
    if (paymentStatus === 'pago') paidAmount = total;
    if (paymentStatus !== 'parcial') paidAmount = paymentStatus === 'pago' ? total : 0;

    if (!(name || phone)) { UI.toast('Informe o nome ou telefone do cliente', 'error'); return; }
    if (!type) { UI.toast('Tipo do pedido obrigatório', 'error'); return; }
    if (!items.length) { UI.toast('Selecione ao menos um produto', 'error'); return; }
    if (!(total > 0)) { UI.toast('O total final precisa ser maior que zero', 'error'); return; }

    var saveOrder = function () {
      var payload = {
        customerId: String(_manualOrderState.selectedCustomerId || ''),
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        address: address,
        zone: zone,
        type: type,
        slot: slot,
        note: note,
        status: 'Pendente',
        items: items,
        subtotalOriginal: subtotalOriginal,
        subtotal: subtotalOriginal,
        subtotalFinal: subtotalFinal,
        promoDiscountTotal: promoDiscountTotal,
        discountTotal: promoDiscountTotal,
        shippingFee: shippingFee,
        manualAdjustmentValue: adjustment,
        total: total,
        paymentMethod: String(_manualOrderState.paymentMethod || ''),
        paymentStatus: paymentStatus,
        paymentState: paymentStatus,
        paidAmount: paidAmount,
        amountPaid: paidAmount,
        valuePaid: paidAmount,
        paid: paymentStatus === 'pago' ? true : (paymentStatus === 'parcial' ? paidAmount : false),
        deliveryDate: deliveryDate,
        deliveryTime: deliveryTime,
        slot: [deliveryDate, deliveryTime].filter(Boolean).join(' ').trim(),
        channel: channel,
        source: source,
        originChannel: channel,
        originSource: source,
        priceOrigin: hasPromo ? 'promo' : (_manualOrderState.channel === 'cardapio' ? 'automático' : 'manual'),
        manualAdjustment: channel !== 'cardapio' || adjustment !== 0,
        createdAt: new Date().toISOString()
      };

      DB.add('orders', payload).then(function (ref) {
        var createdId = (ref && ref.id) ? String(ref.id) : '';
        if (createdId) payload.id = createdId;
        return _syncOrderFinanceMovement(createdId || '', payload);
      }).then(function () {
        UI.toast('Pedido criado!', 'success');
        if (window._newOrderModal) window._newOrderModal.close();
      }).catch(function (err) {
        UI.toast('Erro: ' + (err && err.message ? err.message : 'falha ao salvar'), 'error');
      });
    };

    if (_manualOrderState.channel === 'cardapio' && hasPromo && Math.abs(adjustment) > 0) {
      UI.confirm('Há promoções automáticas e ajuste manual no pedido. Deseja continuar?').then(function (yes) {
        if (!yes) return;
        saveOrder();
      });
      return;
    }
    saveOrder();
  }

  function _orderContext() {
    var route = String((window.Router && typeof Router.current === 'function' && Router.current()) || location.hash.replace(/^#/, '') || '').toLowerCase();
    if (route.indexOf('pedidos/cozinha') === 0 || route.indexOf('pedidos/lista') === 0) {
      return { channel: 'cardapio', source: 'cardapio' };
    }
    if (route.indexOf('marketing') === 0) {
      return { channel: 'cardapio', source: 'cardapio' };
    }
    if (route.indexOf('whatsapp') >= 0) return { channel: 'whatsapp', source: 'whatsapp' };
    if (route.indexOf('marketplace') >= 0) return { channel: 'marketplace', source: 'marketplace' };
    if (route.indexOf('balcao') >= 0 || route.indexOf('telefone') >= 0) return { channel: 'balcao', source: 'balcao' };
    return { channel: 'manual', source: 'manual' };
  }

  function _manualOrderReset(context) {
    context = context || _orderContext();
    _manualOrderState.customerQuery = '';
    _manualOrderState.productQuery = '';
    _manualOrderState.items = [];
    _manualOrderState.selectedCustomerId = '';
    _manualOrderState.customerId = '';
    _manualOrderState.customerName = '';
    _manualOrderState.customerPhone = '';
    _manualOrderState.customerEmail = '';
    _manualOrderState.customerAddress = '';
    _manualOrderState.customerZone = '';
    _manualOrderState.customerPreferences = '';
    _manualOrderState.customerNotes = '';
    _manualOrderState.type = 'delivery';
    _manualOrderState.channel = context.channel || 'manual';
    _manualOrderState.source = context.source || 'manual';
    _manualOrderState.paymentMethod = '';
    _manualOrderState.paymentStatus = 'previsto';
    _manualOrderState.paidAmount = 0;
    _manualOrderState.deliveryDate = '';
    _manualOrderState.deliveryTime = '';
    _manualOrderState.productFilter = 'all';
    _manualOrderState.productCategory = '';
    _manualOrderState.adjustment = 0;
    _manualOrderState.shippingFee = 0;
    _manualOrderState.priceOrigin = _manualOrderState.channel === 'cardapio' ? 'automático' : 'manual';
  }

  function _manualOrderField(field, value) {
    if (!field) return;
    _manualOrderState[field] = value;
    if (field === 'customerName' || field === 'customerPhone' || field === 'customerEmail' || field === 'customerAddress' || field === 'customerZone') {
      _manualOrderState.selectedCustomerId = '';
      _manualOrderState.customerId = '';
      var map = { customerName: 'mo-name', customerPhone: 'mo-phone', customerEmail: 'mo-email', customerAddress: 'mo-address', customerZone: 'mo-zone' };
      var el = document.getElementById(map[field]);
      if (el && el.value !== String(value == null ? '' : value)) el.value = value == null ? '' : value;
    }
    if (field === 'customerZone') _manualOrderMaybeSyncShipping();
    _manualOrderRefresh();
  }

  function _manualOrderSearchCustomers(value) {
    _manualOrderState.customerQuery = String(value == null ? '' : value);
    _manualOrderRefreshCustomers();
    var matches = _manualOrderCustomerMatches();
    if (!matches.length) return;
    var q = _fold(_manualOrderState.customerQuery || '');
    var exact = matches.find(function (c) {
      return _fold(c.name || c.customerName || c.fullName || '') === q || _fold(c.phone || c.whatsapp || '') === q || _fold(c.email || '') === q;
    });
    if (exact) {
      _manualOrderSelectCustomer(exact.id);
      return;
    }
    if (matches.length === 1) {
      _manualOrderSelectCustomer(matches[0].id);
    }
  }

  function _manualOrderSearchItems(value) {
    _manualOrderState.productQuery = String(value == null ? '' : value);
    _manualOrderRefreshProducts();
  }

  function _manualOrderSetType(value) {
    _manualOrderState.type = String(value || 'delivery');
    if (_manualOrderState.type !== 'delivery') _manualOrderState.shippingFee = 0;
    _manualOrderSyncTypeUI();
    _manualOrderMaybeSyncShipping();
    _manualOrderRefresh();
  }

  function _manualOrderSetAdjustment(value) {
    _manualOrderState.adjustment = _num(value);
    _manualOrderRefreshSummary();
  }

  function _manualOrderSetShippingFee(value) {
    _manualOrderState.shippingFee = _num(value);
    _manualOrderRefreshSummary();
  }

  function _manualOrderSetPaymentMethod(value) {
    _manualOrderState.paymentMethod = String(value || '');
    _manualOrderRefreshSummary();
  }

  function _manualOrderSetPaymentStatus(value) {
    _manualOrderState.paymentStatus = String(value || 'previsto');
    if (_manualOrderState.paymentStatus === 'pago') {
      _manualOrderState.paidAmount = _manualOrderTotals().total || 0;
    } else if (_manualOrderState.paymentStatus !== 'parcial') {
      _manualOrderState.paidAmount = 0;
    }
    _manualOrderRefreshSummary();
  }

  function _manualOrderSetPaidAmount(value) {
    _manualOrderState.paidAmount = _num(value);
    _manualOrderRefreshSummary();
  }

  function _manualOrderSetDeliveryDate(value) {
    _manualOrderState.deliveryDate = String(value || '');
    _manualOrderRefreshSummary();
  }

  function _manualOrderSetDeliveryTime(value) {
    _manualOrderState.deliveryTime = String(value || '');
    _manualOrderRefreshSummary();
  }

  function _manualOrderSetProductFilter(value) {
    _manualOrderState.productFilter = String(value || 'all');
    if (_manualOrderState.productFilter !== 'category') _manualOrderState.productCategory = '';
    _manualOrderRefreshProducts();
  }

  function _manualOrderSetCategoryFilter(value) {
    _manualOrderState.productCategory = String(value || '');
    _manualOrderRefreshProducts();
  }

  function _manualOrderMaybeSyncShipping() {
    if ((_manualOrderState.type || 'delivery') !== 'delivery') return;
    var zone = _manualOrderZoneForText(_manualOrderState.customerZone || '');
    if (!zone) return;
    _manualOrderState.shippingFee = _num(zone.fee);
    var feeEl = document.getElementById('mo-shipping');
    if (feeEl) feeEl.value = String(_manualOrderState.shippingFee || 0);
  }

  function _manualOrderSelectCustomer(id) {
    var customer = (_customers || []).find(function (c) { return String(c.id || '') === String(id || ''); });
    if (!customer) return;
    _manualOrderState.selectedCustomerId = String(customer.id || '');
    _manualOrderState.customerId = String(customer.id || '');
    _manualOrderState.customerName = _firstText(customer.name, customer.customerName, customer.fullName, customer.nome) || '';
    _manualOrderState.customerPhone = _firstText(customer.phone, customer.whatsapp, customer.mobile) || '';
    _manualOrderState.customerEmail = _firstText(customer.email, customer.mail) || '';
    _manualOrderState.customerAddress = _firstText(customer.address, customer.fullAddress, customer.street, customer.endereco) || '';
    _manualOrderState.customerZone = _firstText(customer.zone, customer.neighborhood, customer.bairro, customer.area) || '';
    _manualOrderState.customerPreferences = _firstText(customer.preferences, customer.preference, customer.notes, customer.notesDelivery) || '';
    _manualOrderState.customerNotes = _firstText(customer.notes, customer.obs, customer.observations) || '';
    var fields = {
      'mo-name': _manualOrderState.customerName,
      'mo-phone': _manualOrderState.customerPhone,
      'mo-email': _manualOrderState.customerEmail,
      'mo-address': _manualOrderState.customerAddress,
      'mo-zone': _manualOrderState.customerZone
    };
    Object.keys(fields).forEach(function (key) {
      var el = document.getElementById(key);
      if (el) el.value = fields[key] || '';
    });
    var noteEl = document.getElementById('mo-note');
    if (noteEl && !String(noteEl.value || '').trim() && _manualOrderState.customerNotes) {
      noteEl.value = _manualOrderState.customerNotes;
    }
    _manualOrderMaybeSyncShipping();
    _manualOrderRefresh();
  }

  function _manualOrderAddProduct(id) {
    var product = (_products || []).find(function (p) { return String(p.id || '') === String(id || ''); });
    if (!product) return;
    var idx = _manualOrderState.items.findIndex(function (it) { return String(it.productId || '') === String(id || ''); });
    if (idx >= 0) {
      _manualOrderState.items[idx].quantity += 1;
    } else {
      var calc = _manualOrderBestPromoForProduct(product);
      _manualOrderState.items.push({
        productId: String(product.id || ''),
        name: _firstText(product.name, product.title, product.nome, 'Produto'),
        category: _firstText(product.category, product.categoria, ''),
        quantity: 1,
        originalPrice: _manualOrderProductBasePrice(product),
        finalPrice: calc ? calc.final : _manualOrderProductBasePrice(product),
        promoId: calc && calc.promo ? String(calc.promo.id || calc.promo._id || calc.promo.slug || '') : '',
        promoName: calc && calc.promo ? _firstText(calc.promo.name, calc.promo.title, 'Promoção') : '',
        promoType: calc && calc.promo ? String(calc.promo.type || '') : '',
        priceOrigin: calc ? (calc.promo ? 'promo' : 'automático') : (_manualOrderState.channel === 'cardapio' ? 'automático' : 'manual'),
        manualAdjustment: 0
      });
    }
    _manualOrderRefresh();
  }

  function _manualOrderChangeQty(id, delta) {
    var idx = _manualOrderState.items.findIndex(function (it) { return String(it.productId || '') === String(id || ''); });
    if (idx < 0) return;
    _manualOrderState.items[idx].quantity = Math.max(1, (_manualOrderState.items[idx].quantity || 1) + (parseInt(delta, 10) || 0));
    _manualOrderRefresh();
  }

  function _manualOrderRemoveProduct(id) {
    _manualOrderState.items = _manualOrderState.items.filter(function (it) { return String(it.productId || '') !== String(id || ''); });
    _manualOrderRefresh();
  }

  function _manualOrderRefresh() {
    _manualOrderSyncTypeUI();
    _manualOrderRefreshCustomers();
    _manualOrderRefreshProducts();
    _manualOrderRefreshSelected();
    _manualOrderRefreshSummary();
    _manualOrderSyncInheritedPills();
    _manualOrderSyncPaymentUI();
  }

  function _manualOrderRefreshCustomers() {
    var el = document.getElementById('mo-customer-datalist');
    if (el) {
      el.innerHTML = _manualOrderRenderCustomers();
    }
    var pill = document.getElementById('mo-customer-pill');
    if (pill) {
      pill.textContent = _manualOrderState.selectedCustomerId ? ('Cliente: ' + (_manualOrderState.customerName || 'Selecionado')) : 'Nenhum cliente selecionado';
      pill.style.background = _manualOrderState.selectedCustomerId ? '#EDFAF3' : '#F2EDED';
      pill.style.color = _manualOrderState.selectedCustomerId ? '#1A9E5A' : '#8A7E7C';
    }
  }

  function _manualOrderRefreshProducts() {
    var el = document.getElementById('mo-product-results');
    if (!el) return;
    el.innerHTML = _manualOrderRenderProducts();
    var count = document.getElementById('mo-product-count');
    if (count) {
      var qty = (_manualOrderState.items || []).reduce(function (sum, item) { return sum + (item.quantity || 1); }, 0);
      count.textContent = qty > 0 ? (qty + ' itens no pedido') : '';
      count.style.display = qty > 0 ? 'inline-flex' : 'none';
    }
  }

  function _manualOrderRefreshSelected() {
    var el = document.getElementById('mo-selected-items');
    if (!el) return;
    el.innerHTML = _manualOrderRenderSelected();
  }

  function _manualOrderRefreshSummary() {
    var el = document.getElementById('mo-summary');
    if (el) el.innerHTML = _manualOrderRenderSummary();
    var totalEl = document.getElementById('mo-total-final');
    if (totalEl) totalEl.textContent = _manualOrderTotalLabel();
    var priceOrigin = document.getElementById('mo-price-origin');
    if (priceOrigin) {
      priceOrigin.textContent = 'Origem: ' + (_manualOrderState.priceOrigin || (_manualOrderState.channel === 'cardapio' ? 'automático' : 'manual'));
    }
    var adjNote = document.getElementById('mo-adjustment-note');
    if (adjNote) {
      adjNote.textContent = _num(_manualOrderState.adjustment || 0) !== 0 ? 'Este ajuste será registrado como alteração manual no pedido.' : '';
    }
    _manualOrderUpdateSubmitState();
    _manualOrderSyncPaymentUI();
  }

  function _manualOrderSyncPaymentUI() {
    var method = document.getElementById('mo-payment-method');
    if (method && String(method.value || '') !== String(_manualOrderState.paymentMethod || '')) {
      method.value = String(_manualOrderState.paymentMethod || '');
    }
    var status = document.getElementById('mo-payment-status');
    if (status && String(status.value || '') !== String(_manualOrderState.paymentStatus || 'previsto')) {
      status.value = String(_manualOrderState.paymentStatus || 'previsto');
    }
    var box = document.getElementById('mo-paid-amount-box');
    if (box) box.style.display = String(_manualOrderState.paymentStatus || 'previsto') === 'parcial' ? 'block' : 'none';
    var paid = document.getElementById('mo-paid-amount');
    if (paid && String(paid.value || '') !== String(_manualOrderState.paidAmount || 0)) {
      paid.value = String(_manualOrderState.paidAmount || 0);
    }
  }

  function _manualOrderSyncInheritedPills() {
    var channel = document.getElementById('mo-header-channel');
    if (channel) channel.textContent = 'Canal herdado: ' + _manualOrderDisplayChannel(_manualOrderState.channel || 'manual');
  }

  function _manualOrderSyncTypeUI() {
    var type = document.getElementById('mo-type');
    if (type && type.value !== (_manualOrderState.type || 'delivery')) type.value = _manualOrderState.type || 'delivery';
    var delivery = document.getElementById('mo-delivery-block');
    var pickup = document.getElementById('mo-pickup-block');
    var feeBlock = document.getElementById('mo-delivery-fee-block');
    if (delivery && pickup) {
      var isDelivery = (_manualOrderState.type || 'delivery') === 'delivery';
      delivery.style.display = 'grid';
      pickup.style.display = 'none';
      if (feeBlock) feeBlock.style.display = isDelivery ? 'block' : 'none';
    }
    var shipping = document.getElementById('mo-shipping');
    if (shipping && (_manualOrderState.type || 'delivery') !== 'delivery') shipping.value = '0';
  }

  function _manualOrderZoneForText(text) {
    var t = _fold(text || '');
    if (!t) return null;
    return (_zones || []).find(function (z) {
      var name = _fold(z.name || '');
      var zip = _fold(z.postalCode || z.zip || z.code || '');
      return name === t || zip === t || name.indexOf(t) >= 0 || zip.indexOf(t) >= 0 || t.indexOf(name) >= 0;
    }) || null;
  }

  function _manualOrderPromoNormalizeType(type) {
    var t = _fold(type || '');
    if (t === 'pct' || t === 'percent' || t === 'percentual' || t === 'desconto_percentual') return 'pct';
    if (t === 'eur' || t === 'money' || t === 'valor' || t === 'desconto_valor') return 'eur';
    if (t === '2x1' || t === '2por1' || t === 'two_for_one') return '2x1';
    if (t === 'add1' || t === 'leve_mais' || t === 'combo_sugerido' || t === 'combo' || t === 'bundle_less_pay_more') return 'add1';
    if (t === 'frete' || t === 'frete_gratis') return 'frete';
    return 'pct';
  }

  function _manualOrderPromoNumber(value) {
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

  function _manualOrderPromoIsActive(promo) {
    if (!promo) return false;
    if (promo.active === false) return false;
    var status = _fold(promo.status || '');
    if (status === 'pausada' || status === 'pausado' || status === 'expirada' || status === 'expirado' || status === 'finalizada' || status === 'inativa') return false;
    var now = new Date();
    var startRaw = promo.startDate || promo.startsAt || promo.startsAtDate || promo.from || '';
    var endRaw = promo.endDate || promo.endsAt || promo.endsAtDate || promo.to || '';
    if (startRaw) {
      var start = new Date(startRaw);
      if (!isNaN(start.getTime()) && now < start) return false;
    }
    if (endRaw) {
      var end = new Date(endRaw);
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        if (now > end) return false;
      }
    }
    return true;
  }

  function _manualOrderPromoChannels(promo) {
    var channels = Array.isArray(promo && promo.channels) ? promo.channels.slice() : String(promo && (promo.channelsText || promo.channel || '')).split(',').map(function (s) { return String(s || '').trim(); }).filter(Boolean);
    return channels.map(function (s) { return _fold(s); }).filter(Boolean);
  }

  function _manualOrderPromoApplies(promo, product) {
    if (!_manualOrderPromoIsActive(promo) || !product) return false;
    var channel = _fold(_manualOrderState.channel || 'manual');
    var channels = _manualOrderPromoChannels(promo);
    if (channels.length && channels.indexOf(channel) < 0 && channels.indexOf('todos') < 0 && channels.indexOf('all') < 0 && channels.indexOf('template') < 0) {
      return false;
    }
    var productId = String(product.id || '');
    var ids = [];
    if (Array.isArray(promo.productIds)) ids = ids.concat(promo.productIds);
    if (Array.isArray(promo.productsSelected)) ids = ids.concat(promo.productsSelected);
    if (Array.isArray(promo.suggestedProductIds)) ids = ids.concat(promo.suggestedProductIds);
    ids = ids.map(String).filter(Boolean);
    if (promo.applyTo === 'all' || promo.scope === 'todos_produtos') return true;
    if (ids.indexOf(productId) >= 0) return true;
    if (promo.productId && String(promo.productId) === productId) return true;
    if (promo.suggestedProductId && String(promo.suggestedProductId) === productId) return true;
    return false;
  }

  function _manualOrderProductBasePrice(product) {
    return _num(_firstText(product && product.price, product && product.salePrice, product && product.valor, product && product.preco, product && product.precoVenda, 0));
  }

  function _manualOrderProductCost(product) {
    return _num(_firstText(product && product.cost, product && product.custo, product && product.purchasePrice, product && product.custoAtual, product && product.custo_atual, product && product.preco_compra, product && product.precoCompra, product && product.custoCompra, 0));
  }

  function _manualOrderPromoCalc(product, promo) {
    if (!product || !promo) return null;
    var original = _manualOrderProductBasePrice(product);
    if (!(original > 0)) return null;
    var type = _manualOrderPromoNormalizeType(promo.type || promo.tipo || promo.discountType || promo.benefitType || '');
    var value = _manualOrderPromoNumber(promo.valuePercentual != null ? promo.valuePercentual : (promo.discountPct != null ? promo.discountPct : (promo.valueDesconto != null ? promo.valueDesconto : (promo.value != null ? promo.value : 0))));
    var final = original;
    var leve = parseInt(promo.leveQtd != null ? promo.leveQtd : (promo.bundleQty != null ? promo.bundleQty : 0), 10) || 0;
    var pague = parseInt(promo.pagueQtd != null ? promo.pagueQtd : (promo.bundlePay != null ? promo.bundlePay : 0), 10) || 0;
    if (type === 'pct') final = Math.max(original - (original * value / 100), 0);
    else if (type === 'eur') final = Math.max(original - value, 0);
    else if (type === '2x1') final = Math.max(original / 2, 0);
    else if (type === 'add1' && leve > 0 && leve > pague) final = Math.max((original * pague) / leve, 0);
    else if (type === 'frete') final = original;
    var cost = _manualOrderProductCost(product);
    return {
      type: type,
      value: value,
      leve: leve,
      pague: pague,
      original: original,
      final: final,
      discount: Math.max(original - final, 0),
      impact: final - original,
      cost: cost,
      margin: cost > 0 && final > 0 ? ((final - cost) / final) * 100 : null,
      promo: promo
    };
  }

  function _manualOrderBestPromoForProduct(product) {
    if (!product) return null;
    if (_manualOrderState.channel !== 'cardapio') return null;
    var candidates = [];
    if (product.promo && typeof product.promo === 'object') candidates.push(product.promo);
    (_promotions || []).forEach(function (promo) {
      if (_manualOrderPromoApplies(promo, product)) candidates.push(promo);
    });
    var best = null;
    candidates.forEach(function (promo) {
      var calc = _manualOrderPromoCalc(product, promo);
      if (!calc) return;
      var priority = _num(promo.priority || promo.order || 0);
      if (!best) {
        best = { promo: promo, calc: calc, priority: priority };
        return;
      }
      var bestPriority = best.priority || 0;
      var bestDiscount = best.calc.discount || 0;
      if (priority > bestPriority || (priority === bestPriority && calc.discount > bestDiscount)) {
        best = { promo: promo, calc: calc, priority: priority };
      }
    });
    return best ? { promo: best.promo, calc: best.calc } : null;
  }

  function _manualOrderCustomerMatches() {
    var q = _fold(_manualOrderState.customerQuery || '');
    var list = (_customers || []).slice().filter(function (c) {
      if (!q) return true;
      var text = [
        c.name, c.customerName, c.fullName, c.phone, c.whatsapp, c.email, c.zone, c.neighborhood, c.address, c.city, c.note
      ].map(_fold).join(' ');
      return text.indexOf(q) >= 0;
    });
    return list.sort(function (a, b) {
      var ao = _ordersForClient(a).length;
      var bo = _ordersForClient(b).length;
      if (bo !== ao) return bo - ao;
      return _title(a.name || '').localeCompare(_title(b.name || ''));
    }).slice(0, 8);
  }

  function _manualOrderProductMatches() {
    var q = _fold(_manualOrderState.productQuery || '');
    var list = (_products || []).slice().filter(function (p) {
      var filter = String(_manualOrderState.productFilter || 'all');
      if (filter === 'promo') {
        if (!(_manualOrderBestPromoForProduct(p) || p.promo)) return false;
      } else if (filter === 'popular') {
        if (!p.popular && !_fold(p.badgeText || '').includes('top')) return false;
      } else if (filter === 'category' && _manualOrderState.productCategory) {
        var pc = _fold(_firstText(p.category, p.categoria, ''));
        if (pc !== _fold(_manualOrderState.productCategory)) return false;
      }
      if (!q) return true;
      var text = [
        p.name, p.title, p.desc, p.shortDesc, p.fullDesc, p.category, p.categoria, p.microcopy, p.badgeText, p.tags
      ].map(function (v) { return Array.isArray(v) ? v.join(' ') : String(v == null ? '' : v); }).join(' ');
      return _fold(text).indexOf(q) >= 0;
    });
    return list.slice(0, 24);
  }

  function _manualOrderRenderCustomers() {
    var list = _manualOrderCustomerMatches();
    if (!list.length) return '<option value=""></option>';
    return list.map(function (c) {
      var name = c.name || c.customerName || c.fullName || 'Cliente';
      return '<option value="' + _esc(name) + '"></option>';
    }).join('');
  }

  function _manualOrderRenderProducts() {
    var list = _manualOrderProductMatches();
    var categories = _manualOrderAvailableCategories();
    var chips = [
      { key: 'all', label: 'Todos' },
      { key: 'promo', label: 'Promoções' },
      { key: 'popular', label: 'Mais vendidos' },
      { key: 'category', label: 'Categorias' }
    ];
    var filterHtml = '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px;">' + chips.map(function (c) {
      var active = _manualOrderState.productFilter === c.key;
      return '<button type="button" onclick="Modules.Pedidos._manualOrderSetProductFilter(\'' + _esc(c.key) + '\')" style="padding:8px 12px;border-radius:999px;border:1.5px solid ' + (active ? '#C4362A' : '#E6DDDB') + ';background:' + (active ? '#FFF8F7' : '#fff') + ';color:' + (active ? '#C4362A' : '#8A7E7C') + ';font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">' + _esc(c.label) + '</button>';
    }).join('') + (categories.length ? '<select onchange="Modules.Pedidos._manualOrderSetCategoryFilter(this.value)" style="margin-left:auto;min-width:170px;padding:8px 12px;border:1.5px solid #D4C8C6;border-radius:999px;background:#fff;font-size:12px;font-weight:700;font-family:inherit;outline:none;">' + ['<option value="">Todas as categorias</option>'].concat(categories.map(function (cat) {
      var sel = _fold(_manualOrderState.productCategory) === _fold(cat) ? ' selected' : '';
      return '<option value="' + _esc(cat) + '"' + sel + '>' + _esc(cat) + '</option>';
    })).join('') + '</select>' : '') + '</div>';
    if (!list.length) return filterHtml + '<div style="padding:14px;border:1px dashed #E6DDDB;border-radius:12px;color:#8A7E7C;font-size:13px;background:#FCFBFB;">Nenhum produto encontrado.</div>';
    var selectedMap = {};
    (_manualOrderState.items || []).forEach(function (item) { selectedMap[String(item.productId || '')] = item.quantity || 1; });
    return filterHtml + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">' + list.map(function (p) {
      var calc = _manualOrderBestPromoForProduct(p);
      var original = _manualOrderProductBasePrice(p);
      var final = calc ? calc.calc.final : original;
      var selectedQty = selectedMap[String(p.id || '')] || 0;
      var promoBadge = calc ? '<span style="font-size:10px;font-weight:800;padding:4px 8px;border-radius:999px;background:#FFF0EE;color:#C4362A;">Promoção ativa</span>' : '';
      var priceHtml = calc && calc.calc.discount > 0
        ? '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-top:4px;"><span style="font-size:12px;color:#8A7E7C;text-decoration:line-through;">' + UI.fmt(original) + '</span><span style="font-size:15px;font-weight:900;color:#1A1A1A;">' + UI.fmt(final) + '</span></div>'
        : '<div style="font-size:15px;font-weight:900;color:#1A1A1A;margin-top:4px;">' + UI.fmt(original) + '</div>';
      var promoText = calc ? (calc.calc.type === 'pct' ? ('-' + Math.round(calc.calc.value) + '%') : calc.calc.type === 'eur' ? ('- ' + UI.fmt(calc.calc.value)) : calc.calc.type === '2x1' ? '2x1' : calc.calc.type === 'add1' ? ('Leve ' + calc.calc.leve + ' pague ' + calc.calc.pague) : 'Oferta') : '';
      return '<div style="border:1.5px solid #E6DDDB;border-radius:14px;padding:12px;background:#fff;display:flex;flex-direction:column;gap:8px;">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">' +
          '<div style="min-width:0;">' +
            '<div style="font-size:13px;font-weight:800;color:#1A1A1A;line-height:1.25;">' + _esc(p.name || p.title || 'Produto') + '</div>' +
            '<div style="font-size:11px;color:#8A7E7C;margin-top:3px;">' + _esc(_firstText(p.category, p.categoria, 'Sem categoria')) + '</div>' +
          '</div>' +
          promoBadge +
        '</div>' +
        priceHtml +
        (promoText ? '<div style="font-size:11px;font-weight:700;color:#C4362A;">' + _esc(promoText) + '</div>' : '') +
        '<div style="font-size:11px;color:#8A7E7C;line-height:1.4;">' + _esc(_firstText(p.microcopy, p.shortDesc, p.desc, '')) + '</div>' +
        '<div style="display:flex;justify-content:flex-end;gap:6px;align-items:center;margin-top:auto;">' +
          (selectedQty > 0
            ? '<button type="button" onclick="Modules.Pedidos._manualOrderChangeQty(\'' + _esc(String(p.id || '')) + '\',-1)" style="width:28px;height:28px;border-radius:8px;border:1px solid #D4C8C6;background:#fff;cursor:pointer;">−</button>' +
              '<div style="min-width:34px;text-align:center;font-size:13px;font-weight:800;color:#1A1A1A;">' + selectedQty + '</div>' +
              '<button type="button" onclick="Modules.Pedidos._manualOrderAddProduct(\'' + _esc(String(p.id || '')) + '\')" style="width:28px;height:28px;border-radius:8px;border:none;background:#C4362A;color:#fff;cursor:pointer;font-weight:900;">+</button>'
            : '<button type="button" onclick="Modules.Pedidos._manualOrderAddProduct(\'' + _esc(String(p.id || '')) + '\')" style="padding:8px 12px;border-radius:999px;border:none;background:#C4362A;color:#fff;font-size:12px;font-weight:800;cursor:pointer;">Adicionar</button>') +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function _manualOrderAvailableCategories() {
    var seen = {};
    (_products || []).forEach(function (p) {
      var cat = _firstText(p.category, p.categoria, '');
      if (cat) seen[cat] = true;
    });
    return Object.keys(seen).sort(function (a, b) { return a.localeCompare(b); });
  }

  function _manualOrderRenderSelected() {
    var items = _manualOrderState.items || [];
    if (!items.length) {
      return '<div style="padding:14px;border:1px dashed #E6DDDB;border-radius:12px;color:#8A7E7C;font-size:13px;background:#FCFBFB;">Nenhum item selecionado ainda.</div>';
    }
    return '<div style="display:flex;flex-direction:column;gap:8px;">' + items.map(function (item) {
      var product = (_products || []).find(function (p) { return String(p.id || '') === String(item.productId || ''); }) || {};
      var calc = _manualOrderState.channel === 'cardapio' ? _manualOrderBestPromoForProduct(product) : null;
      var original = _manualOrderProductBasePrice(product) || _num(item.originalPrice || 0);
      var final = calc ? calc.calc.final : _num(item.finalPrice || original);
      var qty = item.quantity || 1;
      var discount = Math.max(original - final, 0);
      return '<div style="border:1.5px solid #E6DDDB;border-radius:12px;padding:10px 12px;display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:center;background:#fff;">' +
        '<div style="min-width:0;">' +
          '<div style="font-size:13px;font-weight:800;color:#1A1A1A;">' + _esc(item.name || 'Produto') + '</div>' +
          '<div style="font-size:11px;color:#8A7E7C;margin-top:3px;">' + _esc(_firstText(product.category, item.category, '')) + '</div>' +
          (calc ? '<div style="font-size:11px;font-weight:700;color:#C4362A;margin-top:4px;">' + _esc(calc.calc.type === 'pct' ? ('-' + Math.round(calc.calc.value) + '%') : calc.calc.type === 'eur' ? ('- ' + UI.fmt(calc.calc.value)) : calc.calc.type === '2x1' ? '2x1' : calc.calc.type === 'add1' ? ('Leve ' + calc.calc.leve + ' pague ' + calc.calc.pague) : 'Oferta') + '</div>' : '') +
        '</div>' +
        '<div style="text-align:right;min-width:110px;">' +
          '<div style="font-size:11px;color:#8A7E7C;">' + qty + 'x</div>' +
          '<div style="font-size:12px;color:#8A7E7C;text-decoration:line-through;">' + UI.fmt(original) + '</div>' +
          '<div style="font-size:14px;font-weight:900;color:#1A1A1A;">' + UI.fmt(final) + '</div>' +
          '<div style="font-size:11px;color:#8A7E7C;">Economia: ' + UI.fmt(discount * qty) + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;align-items:center;">' +
          '<button type="button" onclick="Modules.Pedidos._manualOrderChangeQty(\'' + _esc(String(item.productId || '')) + '\',-1)" style="width:28px;height:28px;border-radius:8px;border:1px solid #D4C8C6;background:#fff;cursor:pointer;">−</button>' +
          '<button type="button" onclick="Modules.Pedidos._manualOrderChangeQty(\'' + _esc(String(item.productId || '')) + '\',1)" style="width:28px;height:28px;border-radius:8px;border:none;background:#C4362A;color:#fff;cursor:pointer;font-weight:900;">+</button>' +
          '<button type="button" onclick="Modules.Pedidos._manualOrderRemoveProduct(\'' + _esc(String(item.productId || '')) + '\')" style="width:28px;height:28px;border-radius:8px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;">🗑️</button>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function _manualOrderTotals() {
    var items = _manualOrderState.items || [];
    var subtotalOriginal = 0;
    var subtotalFinal = 0;
    var promoDiscount = 0;
    var hasPromo = false;
    items.forEach(function (item) {
      var product = (_products || []).find(function (p) { return String(p.id || '') === String(item.productId || ''); }) || {};
      var calc = _manualOrderState.channel === 'cardapio' ? _manualOrderBestPromoForProduct(product) : null;
      var original = _manualOrderProductBasePrice(product) || _num(item.originalPrice || 0);
      var final = calc ? calc.calc.final : _num(item.finalPrice || original);
      var qty = item.quantity || 1;
      subtotalOriginal += original * qty;
      subtotalFinal += final * qty;
      promoDiscount += Math.max(original - final, 0) * qty;
      if (calc && calc.calc.discount > 0) hasPromo = true;
    });
    var shippingFee = (_manualOrderState.type || 'delivery') === 'delivery' ? _num(_manualOrderState.shippingFee || 0) : 0;
    var adjustment = _num(_manualOrderState.adjustment || 0);
    var total = Math.max(subtotalFinal + shippingFee + adjustment, 0);
    return {
      subtotalOriginal: subtotalOriginal,
      subtotalFinal: subtotalFinal,
      promoDiscount: promoDiscount,
      shippingFee: shippingFee,
      adjustment: adjustment,
      total: total,
      hasPromo: hasPromo
    };
  }

  function _manualOrderTotalLabel() {
    return UI.fmt(_manualOrderTotals().total || 0);
  }

  function _manualOrderRenderSummary() {
    var t = _manualOrderTotals();
    _manualOrderState.priceOrigin = t.hasPromo ? 'promo' : (_manualOrderState.channel === 'cardapio' ? 'automático' : 'manual');
    var conflict = _manualOrderState.channel === 'cardapio' && t.hasPromo && Math.abs(t.adjustment) > 0;
    return [
      '<div style="border:1px solid #F2EDED;border-radius:12px;padding:10px 12px;background:#FAF8F8;">',
        '<div style="font-size:11px;color:#8A7E7C;margin-bottom:3px;">Subtotal original</div>',
        '<div style="font-size:15px;font-weight:900;color:#1A1A1A;">' + UI.fmt(t.subtotalOriginal) + '</div>',
      '</div>',
      '<div style="border:1px solid #F2EDED;border-radius:12px;padding:10px 12px;background:#FAF8F8;">',
        '<div style="font-size:11px;color:#8A7E7C;margin-bottom:3px;">Desconto promoções</div>',
        '<div style="font-size:15px;font-weight:900;color:#1A9E5A;">-' + UI.fmt(t.promoDiscount) + '</div>',
      '</div>',
      '<div style="border:1px solid #F2EDED;border-radius:12px;padding:10px 12px;background:#FAF8F8;">',
        '<div style="font-size:11px;color:#8A7E7C;margin-bottom:3px;">Entrega</div>',
        '<div style="font-size:15px;font-weight:900;color:#1A1A1A;">' + UI.fmt(t.shippingFee) + '</div>',
      '</div>',
      '<div style="border:1px solid ' + (Math.abs(t.adjustment) > 0 ? '#E8CFCC' : '#F2EDED') + ';border-radius:12px;padding:10px 12px;background:' + (Math.abs(t.adjustment) > 0 ? '#FFF8F7' : '#FAF8F8') + ';">',
        '<div style="font-size:11px;color:#8A7E7C;margin-bottom:3px;">Ajuste manual</div>',
        '<div style="font-size:15px;font-weight:900;color:' + (t.adjustment >= 0 ? '#C4362A' : '#1A9E5A') + ';">' + (t.adjustment >= 0 ? '+' : '-') + UI.fmt(Math.abs(t.adjustment)) + '</div>',
      '</div>',
      '<div style="grid-column:1/-1;border:1px solid #F2EDED;border-radius:12px;padding:10px 12px;background:#FAF8F8;">',
        '<div style="font-size:11px;color:#8A7E7C;margin-bottom:3px;">Forma de pagamento</div>',
        '<select id="mo-payment-method" onchange="Modules.Pedidos._manualOrderSetPaymentMethod(this.value)" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:13px;font-weight:700;font-family:inherit;outline:none;background:#fff;">' + _paymentMethodOptions(_manualOrderState.paymentMethod) + '</select>',
      '</div>',
      '<div style="grid-column:1/-1;border:1px solid #F2EDED;border-radius:12px;padding:10px 12px;background:#FAF8F8;">',
        '<div style="font-size:11px;color:#8A7E7C;margin-bottom:3px;">Status do pagamento</div>',
        '<select id="mo-payment-status" onchange="Modules.Pedidos._manualOrderSetPaymentStatus(this.value)" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:13px;font-weight:700;font-family:inherit;outline:none;background:#fff;">' + _paymentStatusOptions(_manualOrderState.paymentStatus) + '</select>',
      '</div>',
      '<div id="mo-paid-amount-box" style="grid-column:1/-1;border:1px solid #F2EDED;border-radius:12px;padding:10px 12px;background:#FAF8F8;display:' + (_manualOrderState.paymentStatus === 'parcial' ? 'block' : 'none') + ';">',
        '<div style="font-size:11px;color:#8A7E7C;margin-bottom:3px;">Valor pago</div>',
        '<input id="mo-paid-amount" type="number" step="0.01" value="' + _esc(String(_manualOrderState.paidAmount || 0)) + '" oninput="Modules.Pedidos._manualOrderSetPaidAmount(this.value)" placeholder="0,00" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:13px;font-family:inherit;outline:none;background:#fff;">',
      '</div>',
      (conflict ? '<div style="grid-column:1/-1;padding:10px 12px;border-radius:12px;background:#FFF7ED;border:1px solid #F59E0B;color:#92400E;font-size:12px;font-weight:700;">Promoções automáticas e ajuste manual estão atuando ao mesmo tempo. Revise antes de salvar.</div>' : '')
    ].join('');
  }

  function _normalizeZones(raw) {
    var list = raw && Array.isArray(raw.list) ? raw.list : [];
    return list.map(function (z) {
      return {
        postalCode: z.postalCode || z.zip || z.code || '',
        name: z.name || z.zone || z.label || '',
        fee: _num(z.fee != null ? z.fee : z.shippingFee != null ? z.shippingFee : 0),
        minOrder: _num(z.minOrder != null ? z.minOrder : z.orderMin != null ? z.orderMin : 0)
      };
    });
  }

  function _firstText() {
    for (var i = 0; i < arguments.length; i++) {
      var v = arguments[i];
      if (v == null) continue;
      var s = String(v).trim();
      if (s) return s;
    }
    return '';
  }

  function _fold(v) {
    return String(v == null ? '' : v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function _manualOrderDisplayChannel(v) {
    var key = _fold(v || '');
    if (key === 'cardapio') return 'Catálogo';
    if (key === 'whatsapp') return 'WhatsApp';
    if (key === 'marketplace') return 'Marketplace';
    if (key === 'balcao') return 'Balcão';
    if (key === 'telefone') return 'Telefone';
    if (key === 'manual') return 'Manual';
    return _title(v || 'Manual');
  }

  function _openNewOrder() {
    var context = _orderContext();
    _manualOrderReset(context);

    var overlay = document.createElement('div');
    overlay.id = 'manual-order-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:7000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;';

    var modal = document.createElement('div');
    modal.style.cssText = 'width:100%;max-width:1240px;max-height:90vh;background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden;';

    var header = document.createElement('div');
    header.style.cssText = 'padding:20px 24px;border-bottom:1px solid #F2EDED;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex:0 0 auto;background:#fff;';
    header.innerHTML = '<div style="min-width:0;">' +
      '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Pedido manual</div>' +
      '<h2 style="font-family:\'League Spartan\',sans-serif;font-size:22px;font-weight:800;line-height:1.1;margin:0;">Criar pedido manual</h2>' +
      '<div id="mo-header-channel" style="margin-top:8px;display:inline-flex;align-items:center;padding:5px 10px;border-radius:999px;background:#FAF8F8;border:1px solid #EEE6E4;font-size:11px;font-weight:800;color:#8A7E7C;">Canal herdado: ' + _esc(_manualOrderDisplayChannel(_manualOrderState.channel)) + '</div>' +
    '</div>' +
    '<button type="button" onclick="Modules.Pedidos._closeManualOrderModal()" style="width:34px;height:34px;border-radius:50%;border:none;background:#F2EDED;cursor:pointer;font-size:16px;flex-shrink:0;">✕</button>';

    var body = document.createElement('div');
    body.style.cssText = 'padding:16px 20px 20px;overflow:auto;flex:1;min-height:0;background:#FBF5F3;';
    body.innerHTML =
      '<div style="display:grid;grid-template-columns:minmax(0,1.45fr) minmax(340px,.95fr);gap:16px;align-items:start;">' +
        '<div style="display:flex;flex-direction:column;gap:14px;">' +
          '<section style="background:#fff;border:1px solid #F2EDED;border-radius:14px;padding:14px 14px 12px;display:flex;flex-direction:column;gap:12px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">' +
              '<div>' +
                '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Cliente</div>' +
                '<div style="font-size:16px;font-weight:800;color:#1A1A1A;">Selecionar ou criar cliente</div>' +
              '</div>' +
              '<div id="mo-customer-pill" style="font-size:11px;font-weight:800;padding:5px 10px;border-radius:999px;background:#F2EDED;color:#8A7E7C;">Nenhum cliente selecionado</div>' +
            '</div>' +
            '<div>' +
              '<label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Buscar cliente existente</label>' +
              '<input id="mo-customer-search" type="search" list="mo-customer-datalist" value="' + _esc(_manualOrderState.customerQuery) + '" oninput="Modules.Pedidos._manualOrderSearchCustomers(this.value)" placeholder="Buscar por nome, telefone, e-mail ou zona" style="width:100%;padding:11px 14px;border:1.5px solid #D4C8C6;border-radius:999px;font-size:13px;font-family:inherit;outline:none;background:#fff;">' +
              '<datalist id="mo-customer-datalist"></datalist>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">' +
              '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Nome do cliente</label><input id="mo-name" type="text" value="' + _esc(_manualOrderState.customerName) + '" placeholder="Nome" oninput="Modules.Pedidos._manualOrderField(\'customerName\', this.value)" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;"></div>' +
              '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Telefone / WhatsApp</label><input id="mo-phone" type="text" value="' + _esc(_manualOrderState.customerPhone) + '" placeholder="' + _esc(_manualOrderPhonePlaceholder()) + '" oninput="Modules.Pedidos._manualOrderField(\'customerPhone\', this.value)" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;"></div>' +
              '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">E-mail</label><input id="mo-email" type="email" value="' + _esc(_manualOrderState.customerEmail) + '" placeholder="E-mail" oninput="Modules.Pedidos._manualOrderField(\'customerEmail\', this.value)" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;"></div>' +
              '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Tipo</label><select id="mo-type" onchange="Modules.Pedidos._manualOrderSetType(this.value)" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;"><option value="delivery">🛵 Entrega</option><option value="pickup">🏪 Retirada</option></select></div>' +
            '</div>' +
          '</section>' +
          '<section style="background:#fff;border:1px solid #F2EDED;border-radius:14px;padding:14px 14px 12px;display:flex;flex-direction:column;gap:10px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">' +
              '<div>' +
                '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Entrega / Retirada</div>' +
                '<div style="font-size:16px;font-weight:800;color:#1A1A1A;">Definir forma de entrega</div>' +
              '</div>' +
            '</div>' +
            '<div id="mo-delivery-block" style="display:grid;grid-template-columns:2fr 1fr;gap:10px;">' +
              '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Endereço</label><input id="mo-address" type="text" value="' + _esc(_manualOrderState.customerAddress) + '" placeholder="Endereço de entrega" oninput="Modules.Pedidos._manualOrderField(\'customerAddress\', this.value)" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;"></div>' +
              '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Zona / CEP</label><input id="mo-zone" type="text" value="' + _esc(_manualOrderState.customerZone) + '" placeholder="Zona ou CEP" oninput="Modules.Pedidos._manualOrderField(\'customerZone\', this.value);Modules.Pedidos._manualOrderMaybeSyncShipping();" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;"></div>' +
              '<div style="grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
                '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Dia</label><input id="mo-delivery-date" type="date" value="' + _esc(_manualOrderState.deliveryDate || '') + '" oninput="Modules.Pedidos._manualOrderSetDeliveryDate(this.value)" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;"></div>' +
                '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Horário</label><input id="mo-delivery-time" type="time" value="' + _esc(_manualOrderState.deliveryTime || '') + '" oninput="Modules.Pedidos._manualOrderSetDeliveryTime(this.value)" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;"></div>' +
              '</div>' +
              '<div id="mo-delivery-fee-block"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Taxa de entrega</label><input id="mo-shipping" type="number" step="0.01" value="' + _esc(String(_manualOrderState.shippingFee || 0)) + '" oninput="Modules.Pedidos._manualOrderSetShippingFee(this.value)" placeholder="0,00" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;"></div>' +
            '</div>' +
            '<div id="mo-pickup-block" style="display:none;"></div>' +
          '</section>' +
          '<section style="background:#fff;border:1px solid #F2EDED;border-radius:14px;padding:14px 14px 12px;display:flex;flex-direction:column;gap:10px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">' +
              '<div>' +
                '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Produtos</div>' +
                '<div style="font-size:16px;font-weight:800;color:#1A1A1A;">Adicionar itens ao pedido</div>' +
              '</div>' +
            '</div>' +
            '<div>' +
              '<label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Buscar produto</label>' +
              '<input id="mo-product-search" type="search" value="' + _esc(_manualOrderState.productQuery) + '" oninput="Modules.Pedidos._manualOrderSearchItems(this.value)" placeholder="Buscar por produto, categoria ou tag" style="width:100%;padding:11px 14px;border:1.5px solid #D4C8C6;border-radius:999px;font-size:13px;font-family:inherit;outline:none;background:#fff;">' +
              '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;align-items:center;">' +
                '<button type="button" onclick="Modules.Pedidos._manualOrderSetProductFilter(\'all\')" style="padding:7px 12px;border-radius:999px;border:1.5px solid ' + (_manualOrderState.productFilter === 'all' ? '#C4362A' : '#E6DDDB') + ';background:' + (_manualOrderState.productFilter === 'all' ? '#FFF8F7' : '#fff') + ';color:' + (_manualOrderState.productFilter === 'all' ? '#C4362A' : '#8A7E7C') + ';font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">Todos</button>' +
                '<button type="button" onclick="Modules.Pedidos._manualOrderSetProductFilter(\'promo\')" style="padding:7px 12px;border-radius:999px;border:1.5px solid ' + (_manualOrderState.productFilter === 'promo' ? '#C4362A' : '#E6DDDB') + ';background:' + (_manualOrderState.productFilter === 'promo' ? '#FFF8F7' : '#fff') + ';color:' + (_manualOrderState.productFilter === 'promo' ? '#C4362A' : '#8A7E7C') + ';font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">Promoções</button>' +
                '<button type="button" onclick="Modules.Pedidos._manualOrderSetProductFilter(\'popular\')" style="padding:7px 12px;border-radius:999px;border:1.5px solid ' + (_manualOrderState.productFilter === 'popular' ? '#C4362A' : '#E6DDDB') + ';background:' + (_manualOrderState.productFilter === 'popular' ? '#FFF8F7' : '#fff') + ';color:' + (_manualOrderState.productFilter === 'popular' ? '#C4362A' : '#8A7E7C') + ';font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">Mais vendidos</button>' +
                '<button type="button" onclick="Modules.Pedidos._manualOrderSetProductFilter(\'category\')" style="padding:7px 12px;border-radius:999px;border:1.5px solid ' + (_manualOrderState.productFilter === 'category' ? '#C4362A' : '#E6DDDB') + ';background:' + (_manualOrderState.productFilter === 'category' ? '#FFF8F7' : '#fff') + ';color:' + (_manualOrderState.productFilter === 'category' ? '#C4362A' : '#8A7E7C') + ';font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">Categorias</button>' +
                (_manualOrderState.productFilter === 'category' ? '<select onchange="Modules.Pedidos._manualOrderSetCategoryFilter(this.value)" style="margin-left:auto;min-width:170px;padding:8px 12px;border:1.5px solid #D4C8C6;border-radius:999px;background:#fff;font-size:12px;font-weight:700;font-family:inherit;outline:none;">' + ['<option value="">Todas as categorias</option>'].concat(_manualOrderAvailableCategories().map(function (cat) { return '<option value="' + _esc(cat) + '"' + (_fold(_manualOrderState.productCategory) === _fold(cat) ? ' selected' : '') + '>' + _esc(cat) + '</option>'; })).join('') + '</select>' : '') +
              '</div>' +
            '</div>' +
            '<div id="mo-product-results"></div>' +
          '</section>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:14px;position:sticky;top:0;align-self:start;">' +
          '<section style="background:#fff;border:1px solid #F2EDED;border-radius:14px;padding:14px 14px 12px;display:flex;flex-direction:column;gap:10px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">' +
              '<div>' +
                '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Resumo</div>' +
                '<div style="font-size:16px;font-weight:800;color:#1A1A1A;">Itens selecionados</div>' +
              '</div>' +
              '<div id="mo-price-origin" style="font-size:11px;font-weight:800;padding:5px 10px;border-radius:999px;background:#FFF0EE;color:#C4362A;">Origem: manual</div>' +
            '</div>' +
            '<div id="mo-selected-items"></div>' +
            '<div id="mo-summary" style="display:grid;grid-template-columns:1fr;gap:10px;"></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:end;">' +
              '<div>' +
                '<label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Ajuste manual</label>' +
                '<input id="mo-adjustment" type="number" step="0.01" value="' + _esc(String(_manualOrderState.adjustment || 0)) + '" oninput="Modules.Pedidos._manualOrderSetAdjustment(this.value)" placeholder="0,00" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;">' +
                '<div id="mo-adjustment-note" style="font-size:11px;color:#8A7E7C;margin-top:6px;line-height:1.4;"></div>' +
              '</div>' +
              '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Total final</label><div id="mo-total-final" style="width:100%;padding:12px 12px;border:1.5px solid #E6DDDB;border-radius:10px;background:#F8F6F5;font-size:18px;font-weight:900;color:#1A1A1A;">€0,00</div></div>' +
            '</div>' +
          '</section>' +
        '</div>' +
      '</div>';

    var footer = '<div style="display:flex;gap:10px;justify-content:flex-end;width:100%;">' +
      '<button type="button" onclick="Modules.Pedidos._closeManualOrderModal()" style="padding:11px 16px;border-radius:12px;border:1.5px solid #D4C8C6;background:#fff;color:#1A1A1A;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">Cancelar</button>' +
      '<button id="mo-submit-btn" type="button" onclick="Modules.Pedidos._saveNewOrder()" style="padding:11px 18px;border-radius:12px;border:none;background:#C4362A;color:#fff;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">Criar pedido</button>' +
    '</div>';

    var footerWrap = document.createElement('div');
    footerWrap.style.cssText = 'padding:16px 24px;border-top:1px solid #F2EDED;background:#fff;flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;gap:16px;';
    footerWrap.innerHTML = '<div style="font-size:12px;color:#8A7E7C;line-height:1.4;">O canal é herdado automaticamente. O pedido calcula promoções e totais ao vivo.</div>' + footer;

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footerWrap);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.onclick = function (e) { if (e.target === overlay) _closeManualOrderModal(); };

    window._newOrderModal = { close: _closeManualOrderModal, el: overlay };
    _manualOrderRefresh();
  }

  function _manualOrderPhonePlaceholder() {
    var country = _fold(_firstText(_generalConfig.country, _generalConfig.pais, _generalConfig.countryName, ''));
    if (country.indexOf('espa') >= 0) return '+34...';
    if (country.indexOf('port') >= 0) return '+351...';
    if (country.indexOf('brasil') >= 0) return '+55...';
    return 'Telefone / WhatsApp';
  }

  function _manualOrderCanSubmit() {
    var name = String(_manualOrderState.customerName || '').trim();
    var phone = String(_manualOrderState.customerPhone || '').trim();
    var type = String(_manualOrderState.type || 'delivery').trim();
    var total = _manualOrderTotals().total || 0;
    return (!!name || !!phone) && !!type && (_manualOrderState.items || []).length > 0 && total > 0;
  }

  function _manualOrderUpdateSubmitState() {
    var btn = document.getElementById('mo-submit-btn');
    if (!btn) return;
    var can = _manualOrderCanSubmit();
    btn.disabled = !can;
    btn.style.opacity = can ? '1' : '.5';
    btn.style.cursor = can ? 'pointer' : 'not-allowed';
  }

  function _closeManualOrderModal() {
    var el = document.getElementById('manual-order-overlay');
    if (el && el.parentNode) el.parentNode.removeChild(el);
    window._newOrderModal = null;
  }

  function _toggleAlarm() {
    _alarmOn = !_alarmOn;
    var btn = document.getElementById('alarm-btn');
    if (btn) btn.textContent = '🔔 Alarme: ' + (_alarmOn ? 'ON' : 'OFF');
    UI.toast('Alarme ' + (_alarmOn ? 'ativado' : 'desativado'), 'info');
  }

  function _testAlarm() {
    _playAlarm();
  }

  function _playAlarm() {
    if (!_alarmOn) return;
    try {
      if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = _audioCtx.createOscillator();
      var gain = _audioCtx.createGain();
      osc.connect(gain);
      gain.connect(_audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, _audioCtx.currentTime);
      osc.frequency.setValueAtTime(660, _audioCtx.currentTime + 0.1);
      osc.frequency.setValueAtTime(880, _audioCtx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.4, _audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + 0.4);
      osc.start(_audioCtx.currentTime);
      osc.stop(_audioCtx.currentTime + 0.4);
    } catch (e) { console.warn('Audio not available'); }
  }

  function _num(v) {
    var n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }

  function _clean(v) {
    return String(v == null ? '' : v).trim().toLowerCase();
  }

  function _phone(v) {
    return String(v == null ? '' : v).replace(/\D/g, '');
  }

  function _dateTs(o) {
    if (!o) return 0;
    var raw = o.createdAt || o.date || o.data || o.updatedAt || o.paidAt || o.timestamp || '';
    if (raw && typeof raw.toDate === 'function') return raw.toDate().getTime();
    var d = new Date(raw);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function _fmtDate(o) {
    var ts = _dateTs(o);
    return ts ? UI.fmtDate(new Date(ts)) : '-';
  }

  function _ordersForClient(c) {
    var id = String(c && c.id || '').trim();
    var name = _clean(c && c.name || '');
    var phone = _phone(c && c.phone || c && c.whatsapp || '');
    var email = _clean(c && c.email || '');
    return (_orders || []).filter(function (o) {
      if (id && String(o.customerId || o.clientId || '') === id) return true;
      if (phone && _phone(o.phone || o.customerPhone || o.whatsapp) === phone) return true;
      if (email && _clean(o.email || o.customerEmail) === email) return true;
      if (name && _clean(o.customerName || o.clientName || o.name) === name) return true;
      return false;
    }).sort(function (a, b) { return _dateTs(b) - _dateTs(a); });
  }

  function _reviewStatusLabel(review) {
    if (review && (review.approved || String(review.status || '').toLowerCase() === 'approved')) {
      return { key: 'approved', label: 'Aprovada', tone: '#1A9E5A', bg: '#EDFAF3' };
    }
    if (review && (review.rejected || String(review.status || '').toLowerCase() === 'rejected')) {
      return { key: 'rejected', label: 'Rejeitada', tone: '#C4362A', bg: '#FFF0EE' };
    }
    return { key: 'pending', label: 'Pendente', tone: '#D97706', bg: '#FFF8E8' };
  }

  function _reviewSourceLabel(review) {
  }

  function _tags(raw) {
    if (Array.isArray(raw)) {
      return raw.map(function (x) { return String(x).trim(); }).filter(Boolean);
    }
    return String(raw || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
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

  function _paymentMethodLabel(value) {
    var key = _fold(value || '');
    var labels = {
      cash: 'Dinheiro',
      dinheiro: 'Dinheiro',
      card: 'Cartão',
      cartao: 'Cartão',
      cartao_de_credito: 'Cartão',
      cartão: 'Cartão',
      pix: 'PIX',
      mbway: 'MB Way',
      mb_way: 'MB Way',
      transfer: 'Transferência',
      transferencia: 'Transferência',
      transferência: 'Transferência',
      other: 'Outro',
      outro: 'Outro'
    };
    return labels[key] || _title(value || '');
  }

  function _paymentMethodOptions(selected) {
    var source = [];
    if (_financeConfig && Array.isArray(_financeConfig.formas_pagamento)) source = _financeConfig.formas_pagamento.slice();
    if (!source.length) source = ['Dinheiro', 'Cartão', 'PIX', 'MB Way', 'Transferência', 'Outro'];
    var options = [{ value: '', label: 'Sem forma definida' }].concat(source.map(function (item) {
      return { value: _paymentMethodValue(item), label: _paymentMethodLabel(item) };
    }));
    var current = _fold(selected || '');
    return options.map(function (opt) {
      var value = String(opt.value || '');
      var sel = current === _fold(value) || (!current && !value) ? ' selected' : '';
      return '<option value="' + _esc(value) + '"' + sel + '>' + _esc(opt.label) + '</option>';
    }).join('');
  }

  function _paymentMethodValue(value) {
    var key = _fold(value || '');
    var map = {
      dinheiro: 'cash',
      cash: 'cash',
      cartao: 'card',
      cartão: 'card',
      card: 'card',
      pix: 'pix',
      mbway: 'mbway',
      'mb-way': 'mbway',
      transfer: 'transfer',
      transferencia: 'transfer',
      transferência: 'transfer',
      outro: 'other',
      other: 'other'
    };
    return map[key] || key;
  }

  function _paymentStatusOptions(selected) {
    var options = [
      { value: 'previsto', label: 'A pagar na entrega' },
      { value: 'parcial', label: 'Parcial' },
      { value: 'pago', label: 'Já pago integral' }
    ];
    var current = _fold(selected || '');
    return options.map(function (opt) {
      var value = String(opt.value || '');
      var sel = current === _fold(value) ? ' selected' : '';
      return '<option value="' + _esc(value) + '"' + sel + '>' + _esc(opt.label) + '</option>';
    }).join('');
  }

  function _paymentStatusLabel(value) {
    var key = _fold(value || '');
    var labels = {
      pago: 'Já pago integral',
      parcial: 'Parcial',
      previsto: 'A pagar na entrega'
    };
    return labels[key] || _title(value || '');
  }

  function _paymentStatusFinanceStatus(value) {
    var key = _fold(value || '');
    if (key === 'pago') return 'efetivado';
    if (key === 'parcial') return 'parcial';
    return 'previsto';
  }

  function _syncOrderFinanceMovement(orderId, order) {
    orderId = String(orderId || '');
    if (!orderId) return Promise.resolve(false);
    order = order || {};
    var total = _num(order.total != null ? order.total : order.finalSubtotal != null ? order.finalSubtotal : order.subtotal != null ? order.subtotal : 0);
    var paymentStatus = String(order.paymentStatus || order.paymentState || order.payment || '').trim() || 'previsto';
    var paidAmount = _num(order.paidAmount != null ? order.paidAmount : order.amountPaid != null ? order.amountPaid : order.valuePaid != null ? order.valuePaid : 0);
    if (paymentStatus === 'pago') paidAmount = total;
    if (paymentStatus !== 'parcial') paidAmount = paymentStatus === 'pago' ? total : 0;
    var finStatus = _paymentStatusFinanceStatus(paymentStatus);
    var data = (finStatus === 'previsto'
      ? (_firstText(order.deliveryDate, order.deliveryDateISO, order.scheduleDate, order.createdAt, _today()))
      : (_firstText(order.paidAt, order.updatedAt, order.createdAt, _today())));
    var payload = {
      origem: 'pedido',
      pedidoId: orderId,
      pedidoNumero: _orderDisplayId(order) || orderId,
      tipo: 'entrada',
      descricao: 'Pedido ' + (_orderDisplayId(order) || orderId),
      data: data && String(data).slice(0, 10) ? String(data).slice(0, 10) : _today(),
      status: finStatus,
      valor: total,
      valorTotalOriginal: total,
      valorParcela: total,
      valorRecebido: paidAmount,
      saldoRestante: Math.max(0, total - paidAmount),
      forma_pagamento: _paymentMethodLabel(order.paymentMethod || ''),
      paymentMethod: String(order.paymentMethod || ''),
      paymentStatus: paymentStatus,
      customerId: String(order.customerId || order.clientId || ''),
      pessoaId: String(order.customerId || order.clientId || ''),
      pessoaNome: String(order.customerName || order.clientName || order.name || ''),
      customerName: String(order.customerName || order.clientName || order.name || ''),
      phone: String(order.customerPhone || order.phone || order.whatsapp || ''),
      updatedAt: new Date().toISOString()
    };
    if (order.financeMovementId) {
      return DB.update('movimentacoes', order.financeMovementId, payload).then(function () { return true; }).catch(function () { return false; });
    }
    return DB.getAll('movimentacoes').then(function (list) {
      var found = (list || []).find(function (m) { return String(m.pedidoId || m.orderId || m.origemPedidoId || '') === orderId; });
      if (found && found.id) {
        order.financeMovementId = found.id;
        return DB.update('movimentacoes', found.id, payload).then(function () { return true; });
      }
      return DB.add('movimentacoes', payload).then(function (ref) {
        var refId = String((ref && ref.id) || '');
        if (refId) order.financeMovementId = refId;
        return true;
      });
    }).catch(function () { return false; });
  }

  function _segmentLabel(v) {
    return ({
      novo: 'Novo',
      recorrente: 'Recorrente',
      vip: 'VIP',
      inativo: 'Inativo',
      sem_pedido: 'Sem pedido',
      ativo: 'Ativo',
      bloqueado: 'Bloqueado'
    })[v] || _title(v || '');
  }

  function _title(v) {
    return String(v || '').replace(/_/g, ' ').replace(/\b\w/g, function (m) { return m.toUpperCase(); });
  }

  function _smallSelect() {
    return 'padding:11px 14px;border:1.5px solid #D4C8C6;border-radius:20px;background:#fff;font-size:13px;font-weight:800;font-family:inherit;outline:none;';
  }

  function _esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m];
    });
  }

  function destroy() {
    _closeKitchenMode();
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
    _orders = [];
    _customers = [];
    _reviews = [];
    _knownIds = null;
  }

  return {
    render: render, destroy: destroy,
    _switchTab: _switchTab, _setUi: _setUi,
    _setReviewUi: _setReviewUi,
    _onDragStart: _onDragStart, _onDragEnd: _onDragEnd, _onDrop: _onDrop,
    _openDetail: _openDetail, _toggleItem: _toggleItem, _saveDetail: _saveDetail,
    _saveOrderCustomer: _saveOrderCustomer, _openOrderCustomerModal: _openOrderCustomerModal,
    _closeCustomerModal: _closeCustomerModal, _closeDetailModal: _closeDetailModal,
    _showDetailWhatsappPrompt: _showDetailWhatsappPrompt, _hideDetailWhatsappPrompt: _hideDetailWhatsappPrompt,
    _sendDetailWhatsapp: _sendDetailWhatsapp,
    _saveKitchenDetail: _saveKitchenDetail, _waFromDetail: _waFromDetail, _waFromKitchenDetail: _waFromKitchenDetail, _whatsapp: _whatsapp, _cancelOrder: _cancelOrder,
    _openNewOrder: _openNewOrder, _saveNewOrder: _saveNewOrder,
    _manualOrderSearchCustomers: _manualOrderSearchCustomers,
    _manualOrderSearchItems: _manualOrderSearchItems,
    _manualOrderField: _manualOrderField,
    _manualOrderSetType: _manualOrderSetType,
    _manualOrderSetAdjustment: _manualOrderSetAdjustment,
    _manualOrderSetShippingFee: _manualOrderSetShippingFee,
    _manualOrderSetPaymentMethod: _manualOrderSetPaymentMethod,
    _manualOrderSetPaymentStatus: _manualOrderSetPaymentStatus,
    _manualOrderSetPaidAmount: _manualOrderSetPaidAmount,
    _manualOrderSetDeliveryDate: _manualOrderSetDeliveryDate,
    _manualOrderSetDeliveryTime: _manualOrderSetDeliveryTime,
    _manualOrderSetProductFilter: _manualOrderSetProductFilter,
    _manualOrderSetCategoryFilter: _manualOrderSetCategoryFilter,
    _manualOrderSelectCustomer: _manualOrderSelectCustomer,
    _manualOrderAddProduct: _manualOrderAddProduct,
    _manualOrderChangeQty: _manualOrderChangeQty,
    _manualOrderRemoveProduct: _manualOrderRemoveProduct,
    _manualOrderMaybeSyncShipping: _manualOrderMaybeSyncShipping,
    _closeManualOrderModal: _closeManualOrderModal,
    _openClientProfile: _openClientProfile, _openReview: _openReview,
    _approveReview: _approveReview, _rejectReview: _rejectReview,
    _toggleAlarm: _toggleAlarm, _testAlarm: _testAlarm,
    _openKitchenMode: _openKitchenMode, _closeKitchenMode: _closeKitchenMode,
    _closeKitchenDetailPanel: _closeKitchenDetailPanel,
    _showKitchenWhatsappPrompt: _showKitchenWhatsappPrompt,
    _closeKitchenWhatsappPrompt: _closeKitchenWhatsappPrompt,
    _sendKitchenWhatsapp: _sendKitchenWhatsapp,
    _detailPaymentSync: _detailPaymentSync,
    _refreshDetailView: _refreshDetailView,
    _applyPointsDiscount: _applyPointsDiscount,
    _quickStatus: _quickStatus
  };
})();
