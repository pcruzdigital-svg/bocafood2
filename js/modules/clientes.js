// js/modules/clientes.js
window.Modules = window.Modules || {};
Modules.Clientes = (function () {
  'use strict';

  var _clientes = [];
  var _filtered = [];
  var _editingId = null;

  function render() {
    var app = document.getElementById('app');
    app.innerHTML = '<div id="clientes-root" style="padding:24px;max-width:1100px;margin:0 auto;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">' +
      '<h1 style="font-family:\'League Spartan\',sans-serif;font-size:26px;font-weight:800;">👥 Clientes</h1>' +
      '<button onclick="Modules.Clientes._openModal(null)" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Novo Cliente</button>' +
      '</div>' +
      '<div style="margin-bottom:16px;">' +
      '<input id="cli-search" type="text" placeholder="🔍 Pesquisar por nome, email, telefone..." oninput="Modules.Clientes._search(this.value)" style="width:100%;padding:12px 16px;border:1.5px solid #D4C8C6;border-radius:12px;font-size:14px;font-family:inherit;outline:none;background:#fff;">' +
      '</div>' +
      '<div id="clientes-list"></div>' +
      '</div>';

    _loadClientes();
  }

  function _loadClientes() {
    DB.getAll('store_customers').then(function (data) {
      _clientes = (data || []).sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
      _filtered = _clientes.slice();
      _paint();
    }).catch(function (err) {
      document.getElementById('clientes-list').innerHTML = UI.emptyState('Erro ao carregar clientes', '❌');
    });
  }

  function _search(q) {
    var term = q.toLowerCase();
    _filtered = _clientes.filter(function (c) {
      return (c.name || '').toLowerCase().includes(term) ||
        (c.email || '').toLowerCase().includes(term) ||
        (c.phone || '').toLowerCase().includes(term);
    });
    _paint();
  }

  function _paint() {
    var el = document.getElementById('clientes-list');
    if (!el) return;
    if (_filtered.length === 0) {
      el.innerHTML = UI.emptyState('Nenhum cliente encontrado', '👥');
      return;
    }
    el.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;">' +
      _filtered.map(function (c) { return _rowHTML(c); }).join('') + '</div>';
  }

  function _rowHTML(c) {
    var initials = (c.name || 'C').split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
    var colors = ['#C4362A', '#1A9E5A', '#2563EB', '#7C3AED', '#D97706', '#0891B2'];
    var color = colors[(c.name || '').charCodeAt(0) % colors.length];
    return '<div style="background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.06);padding:14px 16px;display:flex;align-items:center;gap:12px;">' +
      '<div style="width:44px;height:44px;border-radius:50%;background:' + color + ';color:#fff;font-family:\'League Spartan\',sans-serif;font-size:17px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + initials + '</div>' +
      '<div style="flex:1;min-width:0;">' +
      '<div style="font-size:14px;font-weight:700;">' + (c.name || '—') + '</div>' +
      '<div style="font-size:11px;color:#8A7E7C;margin-top:2px;">' +
      [c.email, c.phone, c.neighborhood].filter(Boolean).join(' · ') +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:4px;">' +
      UI.badge(c.ordersCount + ' pedidos', 'blue') +
      UI.badge(UI.fmt(c.totalSpent || 0), 'green') +
      (c.points ? UI.badge('⭐ ' + c.points + ' pts', 'orange') : '') +
      (c.birthday ? UI.badge('🎂 ' + c.birthday, 'gray') : '') +
      '</div></div>' +
      '<div style="display:flex;gap:6px;flex-shrink:0;">' +
      '<button onclick="Modules.Clientes._openHistory(\'' + c.id + '\')" style="padding:7px 12px;border-radius:9px;border:none;background:#EEF4FF;color:#3B82F6;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">📋 Histórico</button>' +
      '<button onclick="Modules.Clientes._openModal(\'' + c.id + '\')" style="padding:7px 12px;border-radius:9px;border:none;background:#F2EDED;color:#1a1a1a;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">✏️ Editar</button>' +
      '</div></div>';
  }

  function _openModal(id) {
    _editingId = id;
    var c = id ? (_clientes.find(function (x) { return x.id === id; }) || {}) : {};
    var body = '<div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Nome Completo *</label><input id="cli-name" type="text" value="' + (c.name || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Telefone / WhatsApp</label><input id="cli-phone" type="text" value="' + (c.phone || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '</div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Email</label><input id="cli-email" type="email" value="' + (c.email || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Endereço</label><input id="cli-address" type="text" value="' + (c.address || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Bairro</label><input id="cli-hood" type="text" value="' + (c.neighborhood || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Código Postal</label><input id="cli-zip" type="text" value="' + (c.postalCode || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Aniversário</label><input id="cli-bday" type="date" value="' + (c.birthday || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Pontos de Fidelidade</label><input id="cli-points" type="number" value="' + (c.points || 0) + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Total Gasto (€)</label><input id="cli-spent" type="number" step="0.01" value="' + (c.totalSpent || 0) + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '</div></div>';

    var footer = '<div style="display:flex;gap:10px;">' +
      (id ? '<button onclick="Modules.Clientes._deleteCliente(\'' + id + '\')" style="padding:13px 18px;border-radius:11px;border:none;background:#FFF0EE;color:#C4362A;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">🗑️</button>' : '') +
      '<button onclick="Modules.Clientes._saveCliente()" style="flex:1;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">' + (id ? '💾 Atualizar' : '+ Adicionar') + '</button>' +
      '</div>';

    window._clienteModal = UI.modal({ title: id ? 'Editar Cliente' : 'Novo Cliente', body: body, footer: footer });
  }

  function _saveCliente() {
    var name = (document.getElementById('cli-name') || {}).value || '';
    if (!name) { UI.toast('Nome é obrigatório', 'error'); return; }
    var data = {
      name: name,
      phone: (document.getElementById('cli-phone') || {}).value || '',
      email: (document.getElementById('cli-email') || {}).value || '',
      address: (document.getElementById('cli-address') || {}).value || '',
      neighborhood: (document.getElementById('cli-hood') || {}).value || '',
      postalCode: (document.getElementById('cli-zip') || {}).value || '',
      birthday: (document.getElementById('cli-bday') || {}).value || '',
      points: parseInt((document.getElementById('cli-points') || {}).value) || 0,
      totalSpent: parseFloat((document.getElementById('cli-spent') || {}).value) || 0,
      ordersCount: _editingId ? ((_clientes.find(function (c) { return c.id === _editingId; }) || {}).ordersCount || 0) : 0
    };
    var op = _editingId ? DB.update('store_customers', _editingId, data) : DB.add('store_customers', data);
    op.then(function () {
      UI.toast(_editingId ? 'Cliente atualizado!' : 'Cliente adicionado!', 'success');
      if (window._clienteModal) window._clienteModal.close();
      _loadClientes();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _deleteCliente(id) {
    UI.confirm('Eliminar este cliente?').then(function (yes) {
      if (!yes) return;
      DB.remove('store_customers', id).then(function () {
        UI.toast('Cliente eliminado', 'info');
        if (window._clienteModal) window._clienteModal.close();
        _loadClientes();
      });
    });
  }

  function _openHistory(id) {
    var c = _clientes.find(function (x) { return x.id === id; });
    if (!c) return;
    DB.getAll('orders').then(function (orders) {
      var clientOrders = orders.filter(function (o) { return o.customerId === id || o.customerName === c.name; });
      clientOrders.sort(function (a, b) {
        var ta = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : 0;
        var tb = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : 0;
        return tb - ta;
      });

      // Product frequency
      var freq = {};
      clientOrders.forEach(function (o) {
        (o.items || []).forEach(function (item) {
          freq[item.name] = (freq[item.name] || 0) + (item.qty || 1);
        });
      });
      var topProducts = Object.entries(freq).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5);
      var totalSpent = clientOrders.reduce(function (s, o) { return s + (parseFloat(o.total) || 0); }, 0);

      var body = '<div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px;">' +
        '<div style="background:#F2EDED;border-radius:10px;padding:12px;text-align:center;"><div style="font-family:\'League Spartan\',sans-serif;font-size:22px;font-weight:800;">' + clientOrders.length + '</div><div style="font-size:11px;color:#8A7E7C;font-weight:600;">Pedidos</div></div>' +
        '<div style="background:#F2EDED;border-radius:10px;padding:12px;text-align:center;"><div style="font-family:\'League Spartan\',sans-serif;font-size:22px;font-weight:800;color:#C4362A;">' + UI.fmt(totalSpent) + '</div><div style="font-size:11px;color:#8A7E7C;font-weight:600;">Total Gasto</div></div>' +
        '<div style="background:#F2EDED;border-radius:10px;padding:12px;text-align:center;"><div style="font-family:\'League Spartan\',sans-serif;font-size:22px;font-weight:800;color:#1A9E5A;">' + (c.points || 0) + '</div><div style="font-size:11px;color:#8A7E7C;font-weight:600;">Pontos</div></div>' +
        '</div>' +
        (topProducts.length > 0 ? '<div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Produtos Favoritos</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">' +
          topProducts.map(function (p) { return '<span style="padding:4px 10px;background:#F2EDED;border-radius:20px;font-size:12px;font-weight:600;">' + p[0] + ' <strong>×' + p[1] + '</strong></span>'; }).join('') + '</div>' : '') +
        '<div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Histórico de Pedidos</div>' +
        (clientOrders.length === 0 ? UI.emptyState('Nenhum pedido encontrado', '📦') :
          '<div style="display:flex;flex-direction:column;gap:8px;">' +
          clientOrders.map(function (o) {
            return '<div style="background:#F2EDED;border-radius:10px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;">' +
              '<div><div style="font-size:13px;font-weight:700;">' + (o.status || 'Pendente') + '</div>' +
              '<div style="font-size:11px;color:#8A7E7C;">' + UI.fmtDate(o.createdAt) + (o.slot ? ' · ' + o.slot : '') + '</div></div>' +
              '<span style="font-family:\'League Spartan\',sans-serif;font-size:14px;font-weight:800;color:#C4362A;">' + UI.fmt(o.total || 0) + '</span>' +
              '</div>';
          }).join('') + '</div>');

      UI.modal({ title: '👤 ' + c.name, body: body, maxWidth: '560px' });
    });
  }

  function destroy() {}

  return { render: render, destroy: destroy, _openModal: _openModal, _saveCliente: _saveCliente, _deleteCliente: _deleteCliente, _openHistory: _openHistory, _search: _search };
})();
