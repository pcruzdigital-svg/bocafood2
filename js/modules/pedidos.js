// js/modules/pedidos.js
window.Modules = window.Modules || {};
Modules.Pedidos = (function () {
  'use strict';

  var _unsubscribe = null;
  var _orders = [];
  var _alarmOn = false;
  var _audioCtx = null;
  var _knownIds = null;

  var COLUMNS = [
    { key: 'Pendente', label: 'Pendente', color: '#D97706', bg: '#FFF7ED' },
    { key: 'Confirmado', label: 'Confirmado', color: '#2563EB', bg: '#EFF6FF' },
    { key: 'Em preparação', label: 'Em preparação', color: '#7C3AED', bg: '#F5F3FF' },
    { key: 'Em camino', label: 'Em camino', color: '#0891B2', bg: '#ECFEFF' },
    { key: 'Listo para recoger', label: 'Pronto p/ Retirada', color: '#059669', bg: '#ECFDF5' },
    { key: 'Entregado', label: 'Entregue', color: '#1A9E5A', bg: '#EDFAF3' },
    { key: 'Cancelado', label: 'Cancelado', color: '#C4362A', bg: '#FFF0EE' }
  ];

  var WA_MSGS = {
    'Confirmado': function (o) { return 'Olá ' + (o.customerName || '') + '! ✅ Seu pedido foi *confirmado* e está sendo preparado com carinho. Obrigado pela preferência! 🍽️'; },
    'Em preparação': function (o) { return 'Olá ' + (o.customerName || '') + '! 👨‍🍳 Seu pedido está *em preparação*. Logo fica pronto!'; },
    'Em camino': function (o) { return 'Olá ' + (o.customerName || '') + '! 🛵 Seu pedido está *a caminho*. Em breve chegará até você!'; },
    'Listo para recoger': function (o) { return 'Olá ' + (o.customerName || '') + '! ✅ Seu pedido está *pronto para retirada*. Pode vir buscar!'; },
    'Entregado': function (o) { return 'Olá ' + (o.customerName || '') + '! 🎉 Seu pedido foi *entregue*. Esperamos que goste! Avalie nossa comida 😊'; },
    'Cancelado': function (o) { return 'Olá ' + (o.customerName || '') + '! Infelizmente seu pedido foi *cancelado*. Entre em contato para mais informações.'; }
  };

  function render() {
    var app = document.getElementById('app');
    app.innerHTML = '<div id="pedidos-root" style="display:flex;flex-direction:column;height:100%;">' +
      '<div style="padding:20px 24px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #F2EDED;background:#fff;">' +
      '<h1 style="font-family:\'League Spartan\',sans-serif;font-size:24px;font-weight:800;">📦 Pedidos</h1>' +
      '<div style="display:flex;gap:10px;align-items:center;">' +
      '<button id="alarm-btn" onclick="Modules.Pedidos._toggleAlarm()" style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:7px 14px;border-radius:20px;border:1.5px solid #D4C8C6;background:#fff;cursor:pointer;font-family:inherit;">🔔 Alarme: OFF</button>' +
      '<button onclick="Modules.Pedidos._testAlarm()" style="font-size:11px;font-weight:700;color:#C4362A;background:none;border:1.5px solid #C4362A;border-radius:20px;padding:5px 12px;cursor:pointer;font-family:inherit;">Testar</button>' +
      '<button onclick="Modules.Pedidos._openNewOrder()" style="display:flex;align-items:center;gap:6px;background:#C4362A;color:#fff;border:none;padding:9px 16px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Novo Pedido</button>' +
      '</div></div>' +
      '<div id="kanban-wrap" style="display:flex;gap:12px;overflow-x:auto;padding:16px;align-items:flex-start;flex:1;-webkit-overflow-scrolling:touch;"></div>' +
      '</div>';

    _subscribe();
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
      _renderKanban(orders);
    });
  }

  function _renderKanban(orders) {
    var wrap = document.getElementById('kanban-wrap');
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

  function _cardHTML(o) {
    var items = (o.items || []).slice(0, 2).map(function (i) { return (i.qty || 1) + 'x ' + i.name; }).join(', ');
    if ((o.items || []).length > 2) items += '…';
    return '<div class="kcard" draggable="true" data-id="' + o.id + '" ' +
      'ondragstart="Modules.Pedidos._onDragStart(event,\'' + o.id + '\')" ' +
      'ondragend="Modules.Pedidos._onDragEnd(event)" ' +
      'onclick="Modules.Pedidos._openDetail(\'' + o.id + '\')" ' +
      'style="background:#fff;border-radius:10px;padding:11px;box-shadow:0 1px 5px rgba(0,0,0,.08);cursor:pointer;border:1.5px solid transparent;transition:box-shadow .2s;user-select:none;">' +
      '<div style="display:inline-flex;align-items:center;gap:3px;font-size:9px;font-weight:800;padding:2px 7px;border-radius:6px;margin-bottom:5px;text-transform:uppercase;background:' + (o.type === 'pickup' ? '#D1FAE5' : '#DBEAFE') + ';color:' + (o.type === 'pickup' ? '#065F46' : '#1E40AF') + ';">' +
      (o.type === 'pickup' ? '🏪 Retirada' : '🛵 Entrega') + '</div>' +
      '<div style="font-family:\'League Spartan\',sans-serif;font-size:14px;font-weight:800;line-height:1.2;margin-bottom:2px;">' + (o.customerName || 'Cliente') + '</div>' +
      '<div style="font-size:10px;color:#8A7E7C;margin-bottom:6px;">' + (o.slot || '') + (o.phone ? ' · ' + o.phone : '') + '</div>' +
      (items ? '<div style="font-size:10px;color:#1a1a1a;border-top:1px solid #F2EDED;padding-top:5px;margin-bottom:7px;">' + items + '</div>' : '') +
      '<div style="display:flex;align-items:center;justify-content:space-between;">' +
      '<span style="font-family:\'League Spartan\',sans-serif;font-size:13px;font-weight:800;color:#C4362A;">' + UI.fmt(o.total || 0) + '</span>' +
      '<div style="display:flex;gap:4px;" onclick="event.stopPropagation()">' +
      (o.phone ? '<button onclick="Modules.Pedidos._whatsapp(\'' + o.id + '\')" style="width:26px;height:26px;border:none;border-radius:7px;cursor:pointer;background:#E8FFF1;color:#1A9E5A;font-size:13px;display:flex;align-items:center;justify-content:center;">💬</button>' : '') +
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
    DB.update('orders', _draggingId, { status: newStatus }).then(function () {
      var o = _orders.find(function (x) { return x.id === _draggingId; });
      if (o && WA_MSGS[newStatus]) {
        // Optionally show toast
        UI.toast('Status atualizado: ' + newStatus, 'success');
      }
    }).catch(function (err) { UI.toast('Erro ao atualizar: ' + err.message, 'error'); });
    _draggingId = null;
  }

  function _openDetail(id) {
    var o = _orders.find(function (x) { return x.id === id; });
    if (!o) return;

    var statusOptions = COLUMNS.map(function (c) {
      return '<option value="' + c.key + '"' + (o.status === c.key ? ' selected' : '') + '>' + c.label + '</option>';
    }).join('');

    var itemsHTML = (o.items || []).map(function (item, i) {
      return '<div class="pm-check-item' + (item.checked ? ' checked' : '') + '" onclick="Modules.Pedidos._toggleItem(\'' + id + '\',' + i + ',this)" style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:' + (item.checked ? '#EDFAF3' : '#F2EDED') + ';border-radius:10px;margin-bottom:6px;cursor:pointer;transition:background .15s;">' +
        '<input type="checkbox"' + (item.checked ? ' checked' : '') + ' style="width:18px;height:18px;accent-color:#1A9E5A;flex-shrink:0;cursor:pointer;">' +
        '<span style="font-size:13px;font-weight:700;flex:1;">' + (item.qty || 1) + 'x ' + item.name + (item.variants ? ' <span style="font-size:11px;color:#8A7E7C;font-weight:400;">(' + item.variants + ')</span>' : '') + '</span>' +
        '<span style="font-size:13px;font-weight:800;color:#C4362A;">' + UI.fmt((item.price || 0) * (item.qty || 1)) + '</span>' +
        '</div>';
    }).join('');

    var body = '<div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">' +
      '<span style="background:#F2EDED;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:600;">' + (o.type === 'pickup' ? '🏪 Retirada' : '🛵 Entrega') + '</span>' +
      (o.slot ? '<span style="background:#F2EDED;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:600;">⏰ ' + o.slot + '</span>' : '') +
      (o.phone ? '<span style="background:#F2EDED;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:600;">📱 ' + o.phone + '</span>' : '') +
      (o.address ? '<span style="background:#F2EDED;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:600;">📍 ' + o.address + '</span>' : '') +
      '</div>' +
      '<div style="font-size:10px;font-weight:700;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Itens do Pedido</div>' +
      itemsHTML +
      (o.note ? '<div style="background:#FFF7ED;border-radius:10px;padding:10px;margin-top:8px;font-size:13px;"><strong>📝 Nota:</strong> ' + o.note + '</div>' : '') +
      '<div style="background:#F2EDED;border-radius:10px;padding:12px;margin-top:12px;display:flex;justify-content:space-between;align-items:center;">' +
      '<span style="font-size:13px;font-weight:600;">Total</span>' +
      '<span style="font-family:\'League Spartan\',sans-serif;font-size:20px;font-weight:800;color:#C4362A;">' + UI.fmt(o.total || 0) + '</span>' +
      '</div>' +
      '<div style="margin-top:14px;">' +
      '<label style="display:block;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">Status</label>' +
      '<select id="detail-status" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:14px;font-family:inherit;background:#fff;outline:none;">' + statusOptions + '</select>' +
      '</div></div>';

    var footer = '<div style="display:flex;gap:10px;margin-top:4px;">' +
      '<button onclick="Modules.Pedidos._saveDetail(\'' + id + '\')" style="flex:2;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">💾 Salvar</button>' +
      (o.phone ? '<button onclick="Modules.Pedidos._waFromDetail(\'' + id + '\')" style="flex:1;padding:13px;border-radius:11px;border:none;background:#1A9E5A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">💬 WA</button>' : '') +
      '</div>';

    var m = UI.modal({ title: 'Pedido — ' + (o.customerName || 'Cliente'), body: body, footer: footer, maxWidth: '620px' });
    window._currentDetailModal = m;
    window._currentDetailOrderId = id;
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
    if (!sel) return;
    DB.update('orders', id, { status: sel.value }).then(function () {
      UI.toast('Pedido atualizado!', 'success');
      if (window._currentDetailModal) window._currentDetailModal.close();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _waFromDetail(id) {
    var o = _orders.find(function (x) { return x.id === id; });
    if (!o) return;
    var status = (document.getElementById('detail-status') || {}).value || o.status;
    var fn = WA_MSGS[status];
    if (!fn) { UI.toast('Sem mensagem para este status', 'info'); return; }
    var msg = fn(o);
    var phone = (o.phone || '').replace(/\D/g, '');
    window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(msg), '_blank');
  }

  function _whatsapp(id) {
    var o = _orders.find(function (x) { return x.id === id; });
    if (!o || !o.phone) return;
    var fn = WA_MSGS[o.status];
    var msg = fn ? fn(o) : 'Olá ' + (o.customerName || '') + '! Obrigado pelo seu pedido.';
    var phone = (o.phone || '').replace(/\D/g, '');
    window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(msg), '_blank');
  }

  function _cancelOrder(id) {
    UI.confirm('Cancelar este pedido?').then(function (yes) {
      if (!yes) return;
      DB.update('orders', id, { status: 'Cancelado' }).then(function () {
        UI.toast('Pedido cancelado', 'info');
      });
    });
  }

  function _openNewOrder() {
    var body = '<div>' +
      '<div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Nome do Cliente</label><input id="no-name" type="text" placeholder="Nome" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Telefone / WhatsApp</label><input id="no-phone" type="text" placeholder="+55..." style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '</div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Tipo</label>' +
      '<select id="no-type" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"><option value="delivery">🛵 Entrega</option><option value="pickup">🏪 Retirada</option></select></div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Endereço</label><input id="no-address" type="text" placeholder="Endereço de entrega" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Horário / Slot</label><input id="no-slot" type="text" placeholder="Ex: 12:00-13:00" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Total (€)</label><input id="no-total" type="number" step="0.01" placeholder="0.00" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Nota</label><textarea id="no-note" placeholder="Observações..." style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;min-height:60px;resize:vertical;"></textarea></div>' +
      '</div>';

    var footer = '<button onclick="Modules.Pedidos._saveNewOrder()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Criar Pedido</button>';
    window._newOrderModal = UI.modal({ title: 'Novo Pedido', body: body, footer: footer });
  }

  function _saveNewOrder() {
    var name = (document.getElementById('no-name') || {}).value || '';
    var phone = (document.getElementById('no-phone') || {}).value || '';
    var type = (document.getElementById('no-type') || {}).value || 'delivery';
    var address = (document.getElementById('no-address') || {}).value || '';
    var slot = (document.getElementById('no-slot') || {}).value || '';
    var total = parseFloat((document.getElementById('no-total') || {}).value) || 0;
    var note = (document.getElementById('no-note') || {}).value || '';

    if (!name) { UI.toast('Nome do cliente obrigatório', 'error'); return; }
    DB.add('orders', { customerName: name, phone: phone, type: type, address: address, slot: slot, total: total, note: note, status: 'Pendente', items: [] }).then(function () {
      UI.toast('Pedido criado!', 'success');
      if (window._newOrderModal) window._newOrderModal.close();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
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

  function destroy() {
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
    _orders = [];
    _knownIds = null;
  }

  return {
    render: render, destroy: destroy,
    _onDragStart: _onDragStart, _onDragEnd: _onDragEnd, _onDrop: _onDrop,
    _openDetail: _openDetail, _toggleItem: _toggleItem, _saveDetail: _saveDetail,
    _waFromDetail: _waFromDetail, _whatsapp: _whatsapp, _cancelOrder: _cancelOrder,
    _openNewOrder: _openNewOrder, _saveNewOrder: _saveNewOrder,
    _toggleAlarm: _toggleAlarm, _testAlarm: _testAlarm
  };
})();
