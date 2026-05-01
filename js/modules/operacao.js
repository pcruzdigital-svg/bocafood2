// js/modules/operacao.js
window.Modules = window.Modules || {};
Modules.Operacao = (function () {
  'use strict';

  var _activeSub = 'status';
  var _config = {};

  var TABS = [
    { key: 'status', label: 'Status da loja' },
    { key: 'horarios', label: 'Horários' },
    { key: 'zonas', label: 'Zonas de entrega' },
    { key: 'pagamentos', label: 'Pagamentos' },
    { key: 'endereco', label: 'Endereço' }
  ];

  var DAYS = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];

  function render(sub) {
    _activeSub = sub || 'status';
    var app = document.getElementById('app');
    app.innerHTML = '<div id="op-root" style="display:flex;flex-direction:column;height:100%;">' +
      '<div style="background:#fff;border-bottom:1px solid #F2EDED;padding:0 24px;">' +
      '<h1 style="font-family:\'League Spartan\',sans-serif;font-size:24px;font-weight:800;padding:20px 0 0;">Operação</h1>' +
      '<div id="op-tabs" style="display:flex;gap:0;"></div>' +
      '</div>' +
      '<div id="op-content" style="flex:1;overflow-y:auto;padding:24px;max-width:800px;"></div>' +
      '</div>';

    _renderTabs();
    _loadConfig().then(function () { _loadSub(_activeSub); });
  }

  function _renderTabs() {
    var el = document.getElementById('op-tabs');
    el.innerHTML = TABS.map(function (t) {
      var active = t.key === _activeSub;
      return '<button onclick="Modules.Operacao._switchSub(\'' + t.key + '\')" style="padding:12px 18px;border:none;background:transparent;font-size:13px;font-weight:700;cursor:pointer;border-bottom:3px solid ' + (active ? '#C4362A' : 'transparent') + ';color:' + (active ? '#C4362A' : '#8A7E7C') + ';font-family:inherit;transition:all .15s;">' + t.label + '</button>';
    }).join('');
  }

  function _switchSub(key) {
    _activeSub = key;
    _renderTabs();
    _loadSub(key);
    Router.navigate('operacao/' + key);
  }

  function _loadConfig() {
    return Promise.all([
      DB.getDocRoot('config', 'operacao'),
      DB.getDocRoot('config', 'horarios'),
      DB.getDocRoot('config', 'zonas'),
      DB.getDocRoot('config', 'pagamentos'),
      DB.getDocRoot('config', 'endereco')
    ]).then(function (r) {
      _config.operacao = r[0] || {};
      _config.horarios = r[1] || {};
      _config.zonas = r[2] || { list: [] };
      _config.pagamentos = r[3] || {};
      _config.endereco = r[4] || {};
    }).catch(function () {
      _config = { operacao: {}, horarios: {}, zonas: { list: [] }, pagamentos: {}, endereco: {} };
    });
  }

  function _loadSub(key) {
    if (key === 'status') _renderStatus();
    else if (key === 'horarios') _renderHorarios();
    else if (key === 'zonas') _renderZonas();
    else if (key === 'pagamentos') _renderPagamentos();
    else if (key === 'endereco') _renderEndereco();
  }

  // ── STATUS ────────────────────────────────────────────────────────────────
  function _renderStatus() {
    var op = _config.operacao || {};
    var isOpen = op.isOpen !== false;
    var content = document.getElementById('op-content');
    content.innerHTML = '<h2 style="font-size:20px;font-weight:800;margin-bottom:20px;">Status da Loja</h2>' +
      '<div style="background:#fff;border-radius:14px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,.06);margin-bottom:16px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">' +
      '<div>' +
      '<div style="font-family:\'League Spartan\',sans-serif;font-size:22px;font-weight:800;">' + (isOpen ? '🟢 Loja Aberta' : '🔴 Loja Fechada') + '</div>' +
      '<div style="font-size:13px;color:#8A7E7C;margin-top:4px;">Os clientes podem fazer pedidos</div>' +
      '</div>' +
      '<button onclick="Modules.Operacao._toggleStore()" id="store-toggle" style="padding:12px 24px;border-radius:20px;border:none;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;background:' + (isOpen ? '#FFF0EE' : '#EDFAF3') + ';color:' + (isOpen ? '#C4362A' : '#1A9E5A') + ';">' + (isOpen ? '🔴 Fechar Loja' : '🟢 Abrir Loja') + '</button>' +
      '</div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:6px;">Mensagem Personalizada (para clientes)</label>' +
      '<textarea id="store-msg" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;min-height:80px;resize:vertical;" placeholder="Ex: Voltamos em breve! Pedidos disponíveis a partir das 11h.">' + (op.closedMessage || '') + '</textarea></div>' +
      '<button onclick="Modules.Operacao._saveStatus()" style="width:100%;margin-top:14px;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">💾 Salvar</button>' +
      '</div>' +
      '<div style="background:#F2EDED;border-radius:12px;padding:16px;">' +
      '<div style="font-size:12px;font-weight:700;color:#8A7E7C;margin-bottom:8px;">HORÁRIO ATUAL DE HOJE</div>' +
      _getTodaySchedule() +
      '</div>';
  }

  function _getTodaySchedule() {
    var h = _config.horarios || {};
    var dayKey = 'day' + new Date().getDay();
    var day = h[dayKey] || {};
    if (day.closed) return '<div style="font-size:14px;font-weight:700;color:#C4362A;">🔴 Fechado hoje</div>';
    return '<div style="font-size:14px;font-weight:700;">' + (day.from || '—') + ' → ' + (day.to || '—') + '</div>';
  }

  function _toggleStore() {
    var op = _config.operacao || {};
    _config.operacao.isOpen = !op.isOpen;
    _renderStatus();
  }

  function _saveStatus() {
    var msg = (document.getElementById('store-msg') || {}).value || '';
    var data = Object.assign({}, _config.operacao, { closedMessage: msg });
    DB.setDocRoot('config', 'operacao', data).then(function () {
      _config.operacao = data;
      UI.toast('Status salvo!', 'success');
      _renderStatus();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _renderPagamentos() {
    var c = _config.pagamentos || {};
    var methods = c.paymentMethods || [];
    var content = document.getElementById('op-content');
    content.innerHTML = '<h2 style="font-size:20px;font-weight:800;margin-bottom:20px;">Pagamentos</h2>' +
      '<div style="background:#fff;border-radius:14px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
      '<div style="font-size:13px;color:#8A7E7C;margin-bottom:16px;">Formas de pagamento que aparecem para o cliente no site.</div>' +
      '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:12px;">' +
        _checkField('op-pay-cash', 'Dinheiro', c.cash !== false || methods.indexOf('cash') >= 0) +
        _checkField('op-pay-card', 'Cartão', c.card !== false || methods.indexOf('card') >= 0) +
        _checkField('op-pay-mbway', 'MB WAY', !!c.mbway || methods.indexOf('mbway') >= 0) +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
        _field('op-mbway-phone', 'Telefone MB WAY', c.mbwayPhone || '', '+351...') +
        _field('op-bank-info', 'Dados bancários / referência', c.bankInfo || '', 'IBAN ou instruções') +
      '</div>' +
      '<button onclick="Modules.Operacao._savePagamentos()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Salvar pagamentos</button>' +
      '</div>';
  }

  function _savePagamentos() {
    var paymentMethods = [];
    if (_checked('op-pay-cash')) paymentMethods.push('cash');
    if (_checked('op-pay-card')) paymentMethods.push('card');
    if (_checked('op-pay-mbway')) paymentMethods.push('mbway');
    var data = Object.assign({}, _config.pagamentos, {
      cash: _checked('op-pay-cash'),
      card: _checked('op-pay-card'),
      mbway: _checked('op-pay-mbway'),
      paymentMethods: paymentMethods,
      mbwayPhone: _val('op-mbway-phone'),
      bankInfo: _val('op-bank-info')
    });
    DB.setDocRoot('config', 'pagamentos', data).then(function () {
      _config.pagamentos = data;
      UI.toast('Pagamentos salvos!', 'success');
      _renderPagamentos();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _renderEndereco() {
    var c = _config.endereco || {};
    var content = document.getElementById('op-content');
    content.innerHTML = '<h2 style="font-size:20px;font-weight:800;margin-bottom:20px;">Endereço</h2>' +
      '<div style="background:#fff;border-radius:14px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
      '<div style="font-size:13px;color:#8A7E7C;margin-bottom:16px;">Dados físicos do negócio e contato principal.</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
        _field('op-address-line', 'Endereço', c.addressLine || c.pickupAddress || '', 'Rua...') +
        _field('op-city', 'Cidade', c.city || '', 'Lisboa') +
        _field('op-postal', 'Código postal', c.postalCode || '', '1000-000') +
        _field('op-pickup-area', 'Área / bairro para retirada', c.pickupArea || '', 'Centro') +
        _field('op-phone', 'Telefone', c.phone || '', '+351...') +
        _field('op-email', 'E-mail', c.email || '', 'contato@...') +
      '</div>' +
      '<button onclick="Modules.Operacao._saveEndereco()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Salvar endereço</button>' +
      '</div>';
  }

  function _saveEndereco() {
    var data = {
      addressLine: _val('op-address-line'),
      pickupAddress: _val('op-address-line'),
      pickupArea: _val('op-pickup-area'),
      city: _val('op-city'),
      postalCode: _val('op-postal'),
      phone: _val('op-phone'),
      email: _val('op-email')
    };
    DB.setDocRoot('config', 'endereco', data).then(function () {
      _config.endereco = data;
      UI.toast('Endereço salvo!', 'success');
      _renderEndereco();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _field(id, label, value, placeholder) {
    return '<label style="display:block;"><span style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">' + label + '</span><input id="' + id + '" type="text" value="' + _esc(value || '') + '" placeholder="' + (placeholder || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></label>';
  }

  function _checkField(id, label, checked) {
    return '<label style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid #EEE6E4;border-radius:12px;background:' + (checked ? '#EDFAF3' : '#fff') + ';">' +
      '<input id="' + id + '" type="checkbox" ' + (checked ? 'checked' : '') + ' style="accent-color:#C4362A;width:16px;height:16px;">' +
      '<span style="font-size:13px;font-weight:700;color:#1A1A1A;">' + label + '</span>' +
    '</label>';
  }

  function _val(id) {
    var el = document.getElementById(id);
    return el ? (el.value || '').trim() : '';
  }

  function _checked(id) {
    var el = document.getElementById(id);
    return !!(el && el.checked);
  }

  // ── HORÁRIOS ──────────────────────────────────────────────────────────────
  function _renderHorarios() {
    var h = _config.horarios || {};
    var content = document.getElementById('op-content');
    content.innerHTML = '<h2 style="font-size:20px;font-weight:800;margin-bottom:20px;">Horários de Funcionamento</h2>' +
      '<div style="background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
      '<table style="width:100%;border-collapse:collapse;" id="hours-table">' +
      '<thead><tr>' +
      '<th style="padding:8px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Dia</th>' +
      '<th style="padding:8px;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;text-align:center;">Aberto</th>' +
      '<th style="padding:8px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">De</th>' +
      '<th style="padding:8px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Até</th>' +
      '</tr></thead><tbody>' +
      DAYS.map(function (day, i) {
        var key = 'day' + i;
        var d = h[key] || { from: '11:00', to: '22:00', closed: false };
        return '<tr style="border-top:1px solid #F2EDED;">' +
          '<td style="padding:10px 8px;font-size:14px;font-weight:700;">' + day + '</td>' +
          '<td style="padding:10px 8px;text-align:center;">' +
          '<button type="button" id="h-toggle-' + i + '" onclick="Modules.Operacao._toggleDay(' + i + ')" style="width:42px;height:24px;border-radius:12px;border:none;cursor:pointer;position:relative;transition:background .2s;background:' + (!d.closed ? '#C4362A' : '#D4C8C6') + ';">' +
          '<span style="position:absolute;top:3px;left:3px;width:18px;height:18px;background:#fff;border-radius:50%;transition:transform .2s;display:block;transform:translateX(' + (!d.closed ? '18px' : '0') + ');box-shadow:0 1px 4px rgba(0,0,0,.2);"></span></button>' +
          '</td>' +
          '<td style="padding:10px 8px;"><input id="h-from-' + i + '" type="time" value="' + (d.from || '11:00') + '"' + (d.closed ? ' disabled' : '') + ' style="padding:7px 10px;border:1.5px solid #D4C8C6;border-radius:8px;font-size:13px;font-family:inherit;outline:none;background:' + (d.closed ? '#F2EDED' : '#fff') + ';"></td>' +
          '<td style="padding:10px 8px;"><input id="h-to-' + i + '" type="time" value="' + (d.to || '22:00') + '"' + (d.closed ? ' disabled' : '') + ' style="padding:7px 10px;border:1.5px solid #D4C8C6;border-radius:8px;font-size:13px;font-family:inherit;outline:none;background:' + (d.closed ? '#F2EDED' : '#fff') + ';"></td>' +
          '</tr>';
      }).join('') + '</tbody></table>' +
      '<button onclick="Modules.Operacao._saveHorarios()" style="width:100%;margin-top:16px;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">💾 Salvar Horários</button>' +
      '</div>';
  }

  function _toggleDay(i) {
    var h = _config.horarios || {};
    var key = 'day' + i;
    h[key] = h[key] || { from: '11:00', to: '22:00', closed: false };
    h[key].closed = !h[key].closed;
    _config.horarios = h;
    var btn = document.getElementById('h-toggle-' + i);
    if (btn) {
      btn.style.background = !h[key].closed ? '#C4362A' : '#D4C8C6';
      var span = btn.querySelector('span');
      if (span) span.style.transform = 'translateX(' + (!h[key].closed ? '18px' : '0') + ')';
    }
    ['h-from-' + i, 'h-to-' + i].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.disabled = h[key].closed;
        el.style.background = h[key].closed ? '#F2EDED' : '#fff';
      }
    });
  }

  function _saveHorarios() {
    var data = {};
    for (var i = 0; i < 7; i++) {
      var key = 'day' + i;
      var h = (_config.horarios || {})[key] || {};
      data[key] = {
        closed: h.closed || false,
        from: (document.getElementById('h-from-' + i) || {}).value || '11:00',
        to: (document.getElementById('h-to-' + i) || {}).value || '22:00'
      };
    }
    DB.setDocRoot('config', 'horarios', data).then(function () {
      _config.horarios = data;
      UI.toast('Horários salvos!', 'success');
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  // ── ZONAS DE ENTREGA ──────────────────────────────────────────────────────
  function _renderZonas() {
    var zones = (_config.zonas || {}).list || [];
    var content = document.getElementById('op-content');
    content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">' +
      '<h2 style="font-size:20px;font-weight:800;">Zonas de Entrega</h2>' +
      '</div>' +
      '<div style="background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.06);margin-bottom:16px;">' +
      '<div style="font-size:12px;font-weight:700;color:#8A7E7C;margin-bottom:12px;">ADICIONAR NOVA ZONA</div>' +
      '<div style="display:grid;grid-template-columns:120px 1fr 100px 100px auto;gap:8px;align-items:end;">' +
      '<div><label style="font-size:10px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Código Postal</label><input id="nz-zip" type="text" placeholder="1000-001" style="width:100%;padding:9px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;"></div>' +
      '<div><label style="font-size:10px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Nome da Zona</label><input id="nz-name" type="text" placeholder="Ex: Centro, Alfama..." style="width:100%;padding:9px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;"></div>' +
      '<div><label style="font-size:10px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Taxa Entrega (€)</label><input id="nz-fee" type="number" step="0.01" placeholder="0.00" style="width:100%;padding:9px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;"></div>' +
      '<div><label style="font-size:10px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Pedido Mín. (€)</label><input id="nz-min" type="number" step="0.01" placeholder="0.00" style="width:100%;padding:9px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;"></div>' +
      '<button onclick="Modules.Operacao._addZone()" style="padding:0;width:36px;height:38px;background:#C4362A;color:#fff;border:none;border-radius:9px;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">+</button>' +
      '</div></div>' +
      '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,.06);overflow:hidden;">' +
      (zones.length === 0 ? UI.emptyState('Nenhuma zona de entrega definida', '📍') :
        '<table style="width:100%;border-collapse:collapse;">' +
        '<thead><tr style="background:#F2EDED;">' +
        ['Código Postal','Zona','Taxa de Entrega','Pedido Mínimo',''].map(function (h) {
          return '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">' + h + '</th>';
        }).join('') + '</tr></thead><tbody id="zones-tbody">' +
        zones.map(function (z, i) { return _zoneRow(z, i); }).join('') +
        '</tbody></table>') +
      '</div>';
  }

  function _zoneRow(z, i) {
    return '<tr style="border-top:1px solid #F2EDED;">' +
      '<td style="padding:11px 14px;font-size:13px;font-weight:700;font-family:\'Courier New\',monospace;">' + (z.postalCode || '—') + '</td>' +
      '<td style="padding:11px 14px;font-size:13px;">' + (z.name || '—') + '</td>' +
      '<td style="padding:11px 14px;font-size:13px;font-weight:700;">' + UI.fmt(z.fee || 0) + '</td>' +
      '<td style="padding:11px 14px;font-size:13px;">' + (z.minOrder ? UI.fmt(z.minOrder) : '—') + '</td>' +
      '<td style="padding:11px 8px;">' +
      '<button onclick="Modules.Operacao._removeZone(' + i + ')" style="width:28px;height:28px;border-radius:7px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;font-size:13px;">🗑️</button>' +
      '</td></tr>';
  }

  function _addZone() {
    var zip = (document.getElementById('nz-zip') || {}).value || '';
    var name = (document.getElementById('nz-name') || {}).value || '';
    var fee = parseFloat((document.getElementById('nz-fee') || {}).value) || 0;
    var min = parseFloat((document.getElementById('nz-min') || {}).value) || 0;
    if (!zip || !name) { UI.toast('Código postal e nome são obrigatórios', 'error'); return; }
    var zones = ((_config.zonas || {}).list || []).slice();
    zones.push({ postalCode: zip, name: name, fee: fee, minOrder: min });
    var data = { list: zones };
    DB.setDocRoot('config', 'zonas', data).then(function () {
      _config.zonas = data;
      UI.toast('Zona adicionada!', 'success');
      _renderZonas();
    });
  }

  function _removeZone(idx) {
    UI.confirm('Remover esta zona?').then(function (yes) {
      if (!yes) return;
      var zones = ((_config.zonas || {}).list || []).slice();
      zones.splice(idx, 1);
      var data = { list: zones };
      DB.setDocRoot('config', 'zonas', data).then(function () {
        _config.zonas = data;
        UI.toast('Zona removida', 'info');
        _renderZonas();
      });
    });
  }

  function destroy() {}

  return {
    render: render, destroy: destroy,
    _switchSub: _switchSub,
    _toggleStore: _toggleStore, _saveStatus: _saveStatus,
    _toggleDay: _toggleDay, _saveHorarios: _saveHorarios,
    _savePagamentos: _savePagamentos, _saveEndereco: _saveEndereco,
    _addZone: _addZone, _removeZone: _removeZone
  };
})();
