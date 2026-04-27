// js/modules/financeiro.js
window.Modules = window.Modules || {};
Modules.Financeiro = (function () {
  'use strict';

  var _activeSub = 'entradas';
  var _entradas = [];
  var _saidas = [];
  var _apagar = [];
  var _contas = [];
  var _fornecedores = [];
  var _categorias = [];
  var _editingId = null;

  var TABS = [
    { key: 'entradas', label: '💰 Entradas' },
    { key: 'saidas', label: '📤 Saídas' },
    { key: 'apagar', label: '📅 Contas a Pagar' },
    { key: 'contas-bancarias', label: '🏦 Contas Bancárias' },
    { key: 'fornecedores', label: '🏪 Fornecedores' },
    { key: 'categorias-fin', label: '🏷️ Categorias' }
  ];

  var CANAIS = ['WhatsApp','iFood','UberEats','Glovo','Presencial','Telefone','Outros'];
  var MARKETPLACES = ['iFood','UberEats','Glovo'];

  function render(sub) {
    _activeSub = sub || 'entradas';
    var app = document.getElementById('app');
    app.innerHTML = '<div id="fin-root" style="display:flex;flex-direction:column;height:100%;">' +
      '<div style="background:#fff;border-bottom:1px solid #F2EDED;padding:0 24px;overflow-x:auto;">' +
      '<h1 style="font-family:\'League Spartan\',sans-serif;font-size:24px;font-weight:800;padding:20px 0 0;">💰 Financeiro</h1>' +
      '<div id="fin-tabs" style="display:flex;gap:0;white-space:nowrap;"></div>' +
      '</div>' +
      '<div id="fin-content" style="flex:1;overflow-y:auto;padding:24px;"></div>' +
      '</div>';

    _renderTabs();
    _loadSub(_activeSub);
  }

  function _renderTabs() {
    var el = document.getElementById('fin-tabs');
    el.innerHTML = TABS.map(function (t) {
      var active = t.key === _activeSub;
      return '<button onclick="Modules.Financeiro._switchSub(\'' + t.key + '\')" style="padding:12px 16px;border:none;background:transparent;font-size:12px;font-weight:700;cursor:pointer;border-bottom:3px solid ' + (active ? '#C4362A' : 'transparent') + ';color:' + (active ? '#C4362A' : '#8A7E7C') + ';font-family:inherit;transition:all .15s;white-space:nowrap;">' + t.label + '</button>';
    }).join('');
  }

  function _switchSub(key) {
    _activeSub = key;
    _renderTabs();
    _loadSub(key);
    Router.navigate('financeiro/' + key);
  }

  function _loadSub(key) {
    var content = document.getElementById('fin-content');
    content.innerHTML = '<div style="text-align:center;padding:40px;color:#8A7E7C;">Carregando...</div>';
    if (key === 'entradas') _renderEntradas();
    else if (key === 'saidas') _renderSaidas();
    else if (key === 'apagar') _renderApagar();
    else if (key === 'contas-bancarias') _renderContas();
    else if (key === 'fornecedores') _renderFornecedores();
    else if (key === 'categorias-fin') _renderCategorias();
  }

  // ── ENTRADAS ──────────────────────────────────────────────────────────────
  function _renderEntradas() {
    Promise.all([DB.getAll('financeiro_entradas'), DB.getAll('financeiro_categorias'), DB.getAll('financeiro_contas')]).then(function (r) {
      _entradas = (r[0] || []).sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
      _categorias = r[1] || [];
      _contas = r[2] || [];
      _paintEntradas(_entradas);
    });
  }

  function _paintEntradas(data) {
    var content = document.getElementById('fin-content');
    if (!content) return;
    var total = data.reduce(function (s, e) { return s + (parseFloat(e.valor) || 0); }, 0);
    var totalPedidos = data.reduce(function (s, e) { return s + (parseInt(e.numPedidos) || 0); }, 0);
    var avgTicket = totalPedidos > 0 ? total / totalPedidos : 0;

    content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">' +
      '<h2 style="font-size:20px;font-weight:800;">Entradas</h2>' +
      '<button onclick="Modules.Financeiro._openEntradaModal(null)" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Nova Entrada</button>' +
      '</div>' +
      '<div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">' +
      '<input id="ent-search" type="text" placeholder="🔍 Pesquisar..." oninput="Modules.Financeiro._filterEntradas()" style="flex:1;min-width:160px;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;">' +
      '<input id="ent-from" type="date" onchange="Modules.Financeiro._filterEntradas()" style="padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;">' +
      '<input id="ent-to" type="date" onchange="Modules.Financeiro._filterEntradas()" style="padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;">' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;" class="fin-kpis">' +
      _kpiCard('Total Registos', data.length, '', '#2563EB') +
      _kpiCard('Total Receitas', UI.fmt(total), '', '#1A9E5A') +
      _kpiCard('Total Pedidos', totalPedidos, '', '#7C3AED') +
      _kpiCard('Ticket Médio', UI.fmt(avgTicket), '', '#D97706') +
      '</div>' +
      '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
      '<thead><tr style="background:#F2EDED;">' +
      ['Data','Categoria','Descrição','Cliente','Canal','Conta','Pedidos','Valor',''].map(function (h) {
        return '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;white-space:nowrap;">' + h + '</th>';
      }).join('') + '</tr></thead>' +
      '<tbody id="ent-tbody">' + _entradasRows(data) + '</tbody>' +
      '</table></div>';

    window._entradasAll = _entradas;
  }

  function _entradasRows(data) {
    if (data.length === 0) return '<tr><td colspan="9" style="padding:40px;text-align:center;color:#8A7E7C;">Nenhum registo</td></tr>';
    return data.map(function (e) {
      var cat = _categorias.find(function (c) { return c.id === e.categoriaId; });
      var conta = _contas.find(function (c) { return c.id === e.contaBancariaId; });
      return '<tr style="border-top:1px solid #F2EDED;" onmouseover="this.style.background=\'#FAFAFA\'" onmouseout="this.style.background=\'\'">' +
        '<td style="padding:11px 14px;font-size:12px;white-space:nowrap;">' + (e.date ? UI.fmtDate(new Date(e.date)) : '—') + '</td>' +
        '<td style="padding:11px 14px;font-size:12px;">' + (cat ? UI.badge(cat.name, 'blue') : '—') + '</td>' +
        '<td style="padding:11px 14px;font-size:13px;font-weight:600;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (e.descricao || '—') + '</td>' +
        '<td style="padding:11px 14px;font-size:12px;">' + (e.cliente || '—') + '</td>' +
        '<td style="padding:11px 14px;font-size:12px;">' + (e.canal || '—') + '</td>' +
        '<td style="padding:11px 14px;font-size:12px;">' + (conta ? conta.name : '—') + '</td>' +
        '<td style="padding:11px 14px;font-size:13px;text-align:center;">' + (e.numPedidos || '—') + '</td>' +
        '<td style="padding:11px 14px;font-size:13px;font-weight:800;color:#1A9E5A;white-space:nowrap;">' + UI.fmt(e.valor || 0) + '</td>' +
        '<td style="padding:11px 8px;white-space:nowrap;">' +
        '<button onclick="Modules.Financeiro._openEntradaModal(\'' + e.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;margin-right:4px;">✏️</button>' +
        '<button onclick="Modules.Financeiro._deleteEntrada(\'' + e.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;">🗑️</button>' +
        '</td></tr>';
    }).join('');
  }

  function _filterEntradas() {
    var search = ((document.getElementById('ent-search') || {}).value || '').toLowerCase();
    var from = (document.getElementById('ent-from') || {}).value || '';
    var to = (document.getElementById('ent-to') || {}).value || '';
    var data = (window._entradasAll || _entradas).filter(function (e) {
      if (search && !(e.descricao || '').toLowerCase().includes(search) && !(e.cliente || '').toLowerCase().includes(search)) return false;
      if (from && e.date && e.date < from) return false;
      if (to && e.date && e.date > to) return false;
      return true;
    });
    var tbody = document.getElementById('ent-tbody');
    if (tbody) tbody.innerHTML = _entradasRows(data);
  }

  function _openEntradaModal(id) {
    _editingId = id;
    var e = id ? (_entradas.find(function (x) { return x.id === id; }) || {}) : { date: new Date().toISOString().slice(0, 10) };
    var catOpts = _categorias.filter(function (c) { return c.type !== 'saida'; }).map(function (c) {
      return '<option value="' + c.id + '"' + (e.categoriaId === c.id ? ' selected' : '') + '>' + c.name + '</option>';
    }).join('');
    var contaOpts = _contas.map(function (c) {
      return '<option value="' + c.id + '"' + (e.contaBancariaId === c.id ? ' selected' : '') + '>' + c.name + '</option>';
    }).join('');
    var canalOpts = CANAIS.map(function (c) {
      return '<option value="' + c + '"' + (e.canal === c ? ' selected' : '') + '>' + c + '</option>';
    }).join('');

    var body = '<div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Data *</label><input id="ei-date" type="date" value="' + (e.date || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Canal</label><select id="ei-canal" onchange="Modules.Financeiro._onCanalChange()" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"><option value="">—</option>' + canalOpts + '</select></div>' +
      '</div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Descrição *</label><input id="ei-desc" type="text" value="' + (e.descricao || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Categoria</label><select id="ei-cat" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"><option value="">Sem categoria</option>' + catOpts + '</select></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Conta Bancária</label><select id="ei-conta" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"><option value="">—</option>' + contaOpts + '</select></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Cliente</label><input id="ei-cliente" type="text" value="' + (e.cliente || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Nº Pedidos</label><input id="ei-pedidos" type="number" value="' + (e.numPedidos || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '</div>' +
      '<div id="ei-marketplace-section" style="display:none;background:#FFF7ED;border-radius:10px;padding:12px;margin-bottom:12px;">' +
      '<div style="font-size:11px;font-weight:700;color:#D97706;margin-bottom:8px;">MARKETPLACE — Cálculo automático</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Valor Bruto (€)</label><input id="ei-bruto" type="number" step="0.01" value="' + (e.valorBruto || '') + '" oninput="Modules.Financeiro._calcNet()" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;background:#fff;"></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Taxa Marketplace (%)</label><input id="ei-taxa" type="number" step="0.1" value="' + (e.taxa || '') + '" oninput="Modules.Financeiro._calcNet()" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;background:#fff;"></div>' +
      '</div>' +
      '<div style="margin-top:8px;font-size:12px;font-weight:700;color:#1A9E5A;">Valor Líquido: <span id="ei-net-display">—</span></div>' +
      '</div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Valor (€) *</label><input id="ei-valor" type="number" step="0.01" value="' + (e.valor || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '</div>';

    var footer = '<button onclick="Modules.Financeiro._saveEntrada()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#1A9E5A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">' + (id ? '💾 Atualizar' : '+ Adicionar Entrada') + '</button>';
    window._entradaModal = UI.modal({ title: id ? 'Editar Entrada' : 'Nova Entrada', body: body, footer: footer });

    // Check if marketplace
    setTimeout(function () { _onCanalChange(); }, 100);
  }

  function _onCanalChange() {
    var canal = (document.getElementById('ei-canal') || {}).value || '';
    var section = document.getElementById('ei-marketplace-section');
    if (section) section.style.display = MARKETPLACES.includes(canal) ? 'block' : 'none';
  }

  function _calcNet() {
    var bruto = parseFloat((document.getElementById('ei-bruto') || {}).value) || 0;
    var taxa = parseFloat((document.getElementById('ei-taxa') || {}).value) || 0;
    var net = bruto * (1 - taxa / 100);
    var netDisplay = document.getElementById('ei-net-display');
    if (netDisplay) netDisplay.textContent = UI.fmt(net);
    var valorInput = document.getElementById('ei-valor');
    if (valorInput && bruto) valorInput.value = net.toFixed(2);
  }

  function _saveEntrada() {
    var date = (document.getElementById('ei-date') || {}).value || '';
    var desc = (document.getElementById('ei-desc') || {}).value || '';
    if (!date || !desc) { UI.toast('Data e descrição são obrigatórios', 'error'); return; }
    var canal = (document.getElementById('ei-canal') || {}).value || '';
    var data = {
      date: date,
      descricao: desc,
      categoriaId: (document.getElementById('ei-cat') || {}).value || '',
      canal: canal,
      contaBancariaId: (document.getElementById('ei-conta') || {}).value || '',
      cliente: (document.getElementById('ei-cliente') || {}).value || '',
      numPedidos: parseInt((document.getElementById('ei-pedidos') || {}).value) || 0,
      valor: parseFloat((document.getElementById('ei-valor') || {}).value) || 0
    };
    if (MARKETPLACES.includes(canal)) {
      data.valorBruto = parseFloat((document.getElementById('ei-bruto') || {}).value) || 0;
      data.taxa = parseFloat((document.getElementById('ei-taxa') || {}).value) || 0;
    }
    var op = _editingId ? DB.update('financeiro_entradas', _editingId, data) : DB.add('financeiro_entradas', data);
    op.then(function () {
      UI.toast('Entrada salva!', 'success');
      if (window._entradaModal) window._entradaModal.close();
      _renderEntradas();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _deleteEntrada(id) {
    UI.confirm('Eliminar esta entrada?').then(function (yes) {
      if (!yes) return;
      DB.remove('financeiro_entradas', id).then(function () { UI.toast('Eliminado', 'info'); _renderEntradas(); });
    });
  }

  // ── SAÍDAS ────────────────────────────────────────────────────────────────
  function _renderSaidas() {
    Promise.all([DB.getAll('financeiro_saidas'), DB.getAll('financeiro_categorias'), DB.getAll('financeiro_contas'), DB.getAll('financeiro_fornecedores')]).then(function (r) {
      _saidas = (r[0] || []).sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
      _categorias = r[1] || [];
      _contas = r[2] || [];
      _fornecedores = r[3] || [];
      _paintSaidas(_saidas);
    });
  }

  function _paintSaidas(data) {
    var content = document.getElementById('fin-content');
    if (!content) return;
    var total = data.reduce(function (s, e) { return s + (parseFloat(e.valor) || 0); }, 0);
    var avg = data.length > 0 ? total / data.length : 0;

    // Largest category
    var catTotals = {};
    data.forEach(function (s) {
      var cat = _categorias.find(function (c) { return c.id === s.categoriaId; });
      var name = cat ? cat.name : 'Sem categoria';
      catTotals[name] = (catTotals[name] || 0) + (parseFloat(s.valor) || 0);
    });
    var largestCat = Object.entries(catTotals).sort(function (a, b) { return b[1] - a[1]; })[0];

    content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">' +
      '<h2 style="font-size:20px;font-weight:800;">Saídas</h2>' +
      '<button onclick="Modules.Financeiro._openSaidaModal(null)" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Nova Saída</button>' +
      '</div>' +
      '<div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">' +
      '<input id="sai-search" type="text" placeholder="🔍 Pesquisar..." oninput="Modules.Financeiro._filterSaidas()" style="flex:1;min-width:160px;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;">' +
      '<input id="sai-from" type="date" onchange="Modules.Financeiro._filterSaidas()" style="padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;">' +
      '<input id="sai-to" type="date" onchange="Modules.Financeiro._filterSaidas()" style="padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;">' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;" class="fin-kpis">' +
      _kpiCard('Total Registos', data.length, '', '#2563EB') +
      _kpiCard('Total Despesas', UI.fmt(total), '', '#C4362A') +
      _kpiCard('Maior Categoria', largestCat ? largestCat[0] : '—', largestCat ? UI.fmt(largestCat[1]) : '', '#D97706') +
      _kpiCard('Média por Registo', UI.fmt(avg), '', '#7C3AED') +
      '</div>' +
      '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
      '<thead><tr style="background:#F2EDED;">' +
      ['Data','Categoria','Descrição','Fornecedor','Conta','Tipo','Valor',''].map(function (h) {
        return '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;white-space:nowrap;">' + h + '</th>';
      }).join('') + '</tr></thead>' +
      '<tbody id="sai-tbody">' + _saidasRows(data) + '</tbody>' +
      '</table></div>';

    window._saidasAll = _saidas;
  }

  function _saidasRows(data) {
    if (data.length === 0) return '<tr><td colspan="8" style="padding:40px;text-align:center;color:#8A7E7C;">Nenhum registo</td></tr>';
    return data.map(function (s) {
      var cat = _categorias.find(function (c) { return c.id === s.categoriaId; });
      var conta = _contas.find(function (c) { return c.id === s.contaBancariaId; });
      var forn = _fornecedores.find(function (f) { return f.id === s.fornecedorId; });
      return '<tr style="border-top:1px solid #F2EDED;" onmouseover="this.style.background=\'#FAFAFA\'" onmouseout="this.style.background=\'\'">' +
        '<td style="padding:11px 14px;font-size:12px;white-space:nowrap;">' + (s.date ? UI.fmtDate(new Date(s.date)) : '—') + '</td>' +
        '<td style="padding:11px 14px;font-size:12px;">' + (cat ? UI.badge(cat.name, 'red') : '—') + '</td>' +
        '<td style="padding:11px 14px;font-size:13px;font-weight:600;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (s.descricao || '—') + '</td>' +
        '<td style="padding:11px 14px;font-size:12px;">' + (forn ? forn.name : '—') + '</td>' +
        '<td style="padding:11px 14px;font-size:12px;">' + (conta ? conta.name : '—') + '</td>' +
        '<td style="padding:11px 14px;">' + UI.badge(s.tipoSaida || 'Despesa', s.tipoSaida === 'Custo Produção' ? 'orange' : 'gray') + '</td>' +
        '<td style="padding:11px 14px;font-size:13px;font-weight:800;color:#C4362A;white-space:nowrap;">' + UI.fmt(s.valor || 0) + '</td>' +
        '<td style="padding:11px 8px;white-space:nowrap;">' +
        '<button onclick="Modules.Financeiro._openSaidaModal(\'' + s.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;margin-right:4px;">✏️</button>' +
        '<button onclick="Modules.Financeiro._deleteSaida(\'' + s.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;">🗑️</button>' +
        '</td></tr>';
    }).join('');
  }

  function _filterSaidas() {
    var search = ((document.getElementById('sai-search') || {}).value || '').toLowerCase();
    var from = (document.getElementById('sai-from') || {}).value || '';
    var to = (document.getElementById('sai-to') || {}).value || '';
    var data = (window._saidasAll || _saidas).filter(function (s) {
      if (search && !(s.descricao || '').toLowerCase().includes(search)) return false;
      if (from && s.date && s.date < from) return false;
      if (to && s.date && s.date > to) return false;
      return true;
    });
    var tbody = document.getElementById('sai-tbody');
    if (tbody) tbody.innerHTML = _saidasRows(data);
  }

  function _openSaidaModal(id) {
    _editingId = id;
    var s = id ? (_saidas.find(function (x) { return x.id === id; }) || {}) : { date: new Date().toISOString().slice(0, 10), tipoSaida: 'Despesa', recorrente: false };
    var catOpts = _categorias.map(function (c) {
      return '<option value="' + c.id + '"' + (s.categoriaId === c.id ? ' selected' : '') + '>' + c.name + '</option>';
    }).join('');
    var contaOpts = _contas.map(function (c) {
      return '<option value="' + c.id + '"' + (s.contaBancariaId === c.id ? ' selected' : '') + '>' + c.name + '</option>';
    }).join('');
    var fornOpts = _fornecedores.map(function (f) {
      return '<option value="' + f.id + '"' + (s.fornecedorId === f.id ? ' selected' : '') + '>' + f.name + '</option>';
    }).join('');

    var body = '<div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Data *</label><input id="si-date" type="date" value="' + (s.date || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Tipo de Saída</label><select id="si-tipo" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"><option value="Despesa"' + (s.tipoSaida !== 'Custo Produção' ? ' selected' : '') + '>Despesa</option><option value="Custo Produção"' + (s.tipoSaida === 'Custo Produção' ? ' selected' : '') + '>Custo Produção</option></select></div>' +
      '</div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Descrição *</label><input id="si-desc" type="text" value="' + (s.descricao || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Categoria</label><select id="si-cat" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"><option value="">Sem categoria</option>' + catOpts + '</select></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Fornecedor</label><select id="si-forn" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"><option value="">—</option>' + fornOpts + '</select></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Conta Bancária</label><select id="si-conta" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"><option value="">—</option>' + contaOpts + '</select></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Valor (€) *</label><input id="si-valor" type="number" step="0.01" value="' + (s.valor || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;padding:10px;background:#F2EDED;border-radius:9px;">' +
      '<input type="checkbox" id="si-recorrente"' + (s.recorrente ? ' checked' : '') + ' style="width:16px;height:16px;accent-color:#C4362A;">' +
      '<label for="si-recorrente" style="font-size:13px;font-weight:600;cursor:pointer;">Despesa Recorrente</label>' +
      '</div></div>';

    var footer = '<button onclick="Modules.Financeiro._saveSaida()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">' + (id ? '💾 Atualizar' : '+ Adicionar Saída') + '</button>';
    window._saidaModal = UI.modal({ title: id ? 'Editar Saída' : 'Nova Saída', body: body, footer: footer });
  }

  function _saveSaida() {
    var date = (document.getElementById('si-date') || {}).value || '';
    var desc = (document.getElementById('si-desc') || {}).value || '';
    if (!date || !desc) { UI.toast('Data e descrição são obrigatórios', 'error'); return; }
    var data = {
      date: date,
      descricao: desc,
      categoriaId: (document.getElementById('si-cat') || {}).value || '',
      fornecedorId: (document.getElementById('si-forn') || {}).value || '',
      contaBancariaId: (document.getElementById('si-conta') || {}).value || '',
      valor: parseFloat((document.getElementById('si-valor') || {}).value) || 0,
      tipoSaida: (document.getElementById('si-tipo') || {}).value || 'Despesa',
      recorrente: !!(document.getElementById('si-recorrente') || {}).checked
    };
    var op = _editingId ? DB.update('financeiro_saidas', _editingId, data) : DB.add('financeiro_saidas', data);
    op.then(function () {
      UI.toast('Saída salva!', 'success');
      if (window._saidaModal) window._saidaModal.close();
      _renderSaidas();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _deleteSaida(id) {
    UI.confirm('Eliminar esta saída?').then(function (yes) {
      if (!yes) return;
      DB.remove('financeiro_saidas', id).then(function () { UI.toast('Eliminado', 'info'); _renderSaidas(); });
    });
  }

  // ── CONTAS A PAGAR ────────────────────────────────────────────────────────
  function _renderApagar() {
    Promise.all([DB.getAll('financeiro_apagar'), DB.getAll('financeiro_categorias'), DB.getAll('financeiro_fornecedores'), DB.getAll('financeiro_contas')]).then(function (r) {
      _apagar = r[0] || [];
      _categorias = r[1] || [];
      _fornecedores = r[2] || [];
      _contas = r[3] || [];
      _paintApagar(_apagar);
    });
  }

  function _paintApagar(data) {
    var content = document.getElementById('fin-content');
    if (!content) return;
    var today = new Date(); today.setHours(0, 0, 0, 0);

    function getStatus(item) {
      if (item.status === 'Pago') return 'Pago';
      if (item.dueDate && new Date(item.dueDate) < today) return 'Vencido';
      return 'Pendente';
    }

    var totalPendente = data.filter(function (a) { return getStatus(a) === 'Pendente'; }).reduce(function (s, a) { return s + (parseFloat(a.valor) || 0); }, 0);
    var totalVencido = data.filter(function (a) { return getStatus(a) === 'Vencido'; }).reduce(function (s, a) { return s + (parseFloat(a.valor) || 0); }, 0);
    var paidMonth = data.filter(function (a) {
      if (getStatus(a) !== 'Pago') return false;
      var paid = a.paidDate ? new Date(a.paidDate) : null;
      return paid && paid.getMonth() === today.getMonth() && paid.getFullYear() === today.getFullYear();
    }).reduce(function (s, a) { return s + (parseFloat(a.valor) || 0); }, 0);

    content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">' +
      '<h2 style="font-size:20px;font-weight:800;">Contas a Pagar</h2>' +
      '<button onclick="Modules.Financeiro._openApagarModal(null)" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Nova Conta</button>' +
      '</div>' +
      '<div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">' +
      '<input id="ap-search" type="text" placeholder="🔍 Pesquisar..." oninput="Modules.Financeiro._filterApagar()" style="flex:1;min-width:160px;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;">' +
      '<select id="ap-status-filter" onchange="Modules.Financeiro._filterApagar()" style="padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;"><option value="">Todos</option><option value="Pendente">Pendente</option><option value="Vencido">Vencido</option><option value="Pago">Pago</option></select>' +
      '<input id="ap-from" type="date" onchange="Modules.Financeiro._filterApagar()" style="padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;">' +
      '<input id="ap-to" type="date" onchange="Modules.Financeiro._filterApagar()" style="padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;">' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">' +
      _kpiCard('Pendente', UI.fmt(totalPendente), '', '#D97706') +
      _kpiCard('Vencido', UI.fmt(totalVencido), '', '#C4362A') +
      _kpiCard('Pago este mês', UI.fmt(paidMonth), '', '#1A9E5A') +
      '</div>' +
      '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
      '<thead><tr style="background:#F2EDED;">' +
      ['Descrição','Fornecedor','Categoria','Valor','Vencimento','Status',''].map(function (h) {
        return '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;white-space:nowrap;">' + h + '</th>';
      }).join('') + '</tr></thead>' +
      '<tbody id="ap-tbody">' + _apagarRows(data, getStatus) + '</tbody>' +
      '</table></div>';

    window._apagarAll = _apagar;
    window._apagarGetStatus = getStatus;
  }

  function _apagarRows(data, getStatus) {
    if (!getStatus) getStatus = window._apagarGetStatus || function (a) { return a.status || 'Pendente'; };
    if (data.length === 0) return '<tr><td colspan="7" style="padding:40px;text-align:center;color:#8A7E7C;">Nenhum registo</td></tr>';
    return data.map(function (a) {
      var status = getStatus(a);
      var cat = _categorias.find(function (c) { return c.id === a.categoriaId; });
      var forn = _fornecedores.find(function (f) { return f.id === a.fornecedorId; });
      var statusColor = { 'Pendente': 'orange', 'Vencido': 'red', 'Pago': 'green' }[status] || 'gray';
      return '<tr style="border-top:1px solid #F2EDED;" onmouseover="this.style.background=\'#FAFAFA\'" onmouseout="this.style.background=\'\'">' +
        '<td style="padding:11px 14px;font-size:13px;font-weight:600;">' + (a.descricao || '—') + '</td>' +
        '<td style="padding:11px 14px;font-size:12px;">' + (forn ? forn.name : '—') + '</td>' +
        '<td style="padding:11px 14px;font-size:12px;">' + (cat ? UI.badge(cat.name, 'gray') : '—') + '</td>' +
        '<td style="padding:11px 14px;font-size:13px;font-weight:800;color:#C4362A;">' + UI.fmt(a.valor || 0) + '</td>' +
        '<td style="padding:11px 14px;font-size:12px;white-space:nowrap;">' + (a.dueDate ? UI.fmtDate(new Date(a.dueDate)) : '—') + '</td>' +
        '<td style="padding:11px 14px;">' + UI.badge(status, statusColor) + '</td>' +
        '<td style="padding:11px 8px;white-space:nowrap;">' +
        (status !== 'Pago' ? '<button onclick="Modules.Financeiro._baixarConta(\'' + a.id + '\')" style="padding:6px 10px;border-radius:7px;border:none;background:#EDFAF3;color:#1A9E5A;font-size:11px;font-weight:700;cursor:pointer;margin-right:4px;font-family:inherit;">✅ Baixar</button>' : '') +
        '<button onclick="Modules.Financeiro._openApagarModal(\'' + a.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;margin-right:4px;">✏️</button>' +
        '<button onclick="Modules.Financeiro._deleteApagar(\'' + a.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;">🗑️</button>' +
        '</td></tr>';
    }).join('');
  }

  function _filterApagar() {
    var search = ((document.getElementById('ap-search') || {}).value || '').toLowerCase();
    var statusF = (document.getElementById('ap-status-filter') || {}).value || '';
    var from = (document.getElementById('ap-from') || {}).value || '';
    var to = (document.getElementById('ap-to') || {}).value || '';
    var getStatus = window._apagarGetStatus || function (a) { return a.status || 'Pendente'; };
    var data = (window._apagarAll || _apagar).filter(function (a) {
      if (search && !(a.descricao || '').toLowerCase().includes(search)) return false;
      if (statusF && getStatus(a) !== statusF) return false;
      if (from && a.dueDate && a.dueDate < from) return false;
      if (to && a.dueDate && a.dueDate > to) return false;
      return true;
    });
    var tbody = document.getElementById('ap-tbody');
    if (tbody) tbody.innerHTML = _apagarRows(data);
  }

  function _openApagarModal(id) {
    _editingId = id;
    var a = id ? (_apagar.find(function (x) { return x.id === id; }) || {}) : { status: 'Pendente' };
    var catOpts = _categorias.map(function (c) {
      return '<option value="' + c.id + '"' + (a.categoriaId === c.id ? ' selected' : '') + '>' + c.name + '</option>';
    }).join('');
    var fornOpts = _fornecedores.map(function (f) {
      return '<option value="' + f.id + '"' + (a.fornecedorId === f.id ? ' selected' : '') + '>' + f.name + '</option>';
    }).join('');

    var body = '<div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Descrição *</label><input id="ap-desc" type="text" value="' + (a.descricao || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Fornecedor</label><select id="ap-forn" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"><option value="">—</option>' + fornOpts + '</select></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Categoria</label><select id="ap-cat" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"><option value="">—</option>' + catOpts + '</select></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Valor (€) *</label><input id="ap-valor" type="number" step="0.01" value="' + (a.valor || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Data de Vencimento</label><input id="ap-due" type="date" value="' + (a.dueDate || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '</div>' +
      (!id ? '<div style="background:#EEF4FF;border-radius:10px;padding:12px;"><div style="font-size:12px;font-weight:700;color:#2563EB;margin-bottom:6px;">Parcelamento</div><div style="display:flex;align-items:center;gap:8px;"><input type="number" id="ap-parcelas" min="1" value="1" style="width:70px;padding:8px;border:1.5px solid #D4C8C6;border-radius:8px;font-size:14px;font-family:inherit;outline:none;"><span style="font-size:13px;color:#8A7E7C;">parcela(s) mensais (gera múltiplos registos)</span></div></div>' : '') +
      '</div>';

    var footer = '<button onclick="Modules.Financeiro._saveApagar()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">' + (id ? '💾 Atualizar' : '+ Adicionar') + '</button>';
    window._apagarModal = UI.modal({ title: id ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar', body: body, footer: footer });
  }

  function _saveApagar() {
    var desc = (document.getElementById('ap-desc') || {}).value || '';
    if (!desc) { UI.toast('Descrição é obrigatória', 'error'); return; }
    var base = {
      descricao: desc,
      fornecedorId: (document.getElementById('ap-forn') || {}).value || '',
      categoriaId: (document.getElementById('ap-cat') || {}).value || '',
      valor: parseFloat((document.getElementById('ap-valor') || {}).value) || 0,
      dueDate: (document.getElementById('ap-due') || {}).value || '',
      status: 'Pendente'
    };
    var parcelas = parseInt((document.getElementById('ap-parcelas') || {}).value) || 1;
    if (_editingId || parcelas <= 1) {
      var op = _editingId ? DB.update('financeiro_apagar', _editingId, base) : DB.add('financeiro_apagar', base);
      op.then(function () {
        UI.toast('Salvo!', 'success');
        if (window._apagarModal) window._apagarModal.close();
        _renderApagar();
      }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
    } else {
      // Generate installments
      var promises = [];
      var dueBase = base.dueDate ? new Date(base.dueDate) : new Date();
      for (var i = 0; i < parcelas; i++) {
        var d = new Date(dueBase);
        d.setMonth(d.getMonth() + i);
        var installment = Object.assign({}, base, {
          descricao: base.descricao + ' (' + (i + 1) + '/' + parcelas + ')',
          dueDate: d.toISOString().slice(0, 10)
        });
        promises.push(DB.add('financeiro_apagar', installment));
      }
      Promise.all(promises).then(function () {
        UI.toast(parcelas + ' parcelas criadas!', 'success');
        if (window._apagarModal) window._apagarModal.close();
        _renderApagar();
      });
    }
  }

  function _deleteApagar(id) {
    UI.confirm('Eliminar esta conta?').then(function (yes) {
      if (!yes) return;
      DB.remove('financeiro_apagar', id).then(function () { UI.toast('Eliminado', 'info'); _renderApagar(); });
    });
  }

  function _baixarConta(id) {
    var contaOpts = _contas.map(function (c) {
      return '<option value="' + c.id + '">' + c.name + '</option>';
    }).join('');
    var body = '<div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Data do Pagamento</label><input id="bx-date" type="date" value="' + new Date().toISOString().slice(0, 10) + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Valor Pago (€)</label><input id="bx-valor" type="number" step="0.01" value="' + ((_apagar.find(function (a) { return a.id === id; }) || {}).valor || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Conta Bancária</label><select id="bx-conta" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"><option value="">—</option>' + contaOpts + '</select></div>' +
      '</div>';
    var footer = '<button onclick="Modules.Financeiro._confirmBaixar(\'' + id + '\')" style="width:100%;padding:13px;border-radius:11px;border:none;background:#1A9E5A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">✅ Confirmar Pagamento</button>';
    window._baixarModal = UI.modal({ title: 'Baixar Conta', body: body, footer: footer });
  }

  function _confirmBaixar(id) {
    var data = {
      status: 'Pago',
      paidDate: (document.getElementById('bx-date') || {}).value || new Date().toISOString().slice(0, 10),
      paidAmount: parseFloat((document.getElementById('bx-valor') || {}).value) || 0,
      paidContaId: (document.getElementById('bx-conta') || {}).value || ''
    };
    DB.update('financeiro_apagar', id, data).then(function () {
      UI.toast('Pagamento registrado!', 'success');
      if (window._baixarModal) window._baixarModal.close();
      _renderApagar();
    });
  }

  // ── CONTAS BANCÁRIAS ──────────────────────────────────────────────────────
  function _renderContas() {
    DB.getAll('financeiro_contas').then(function (data) {
      _contas = data || [];
      _paintContas();
    });
  }

  function _paintContas() {
    var content = document.getElementById('fin-content');
    if (!content) return;
    content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">' +
      '<h2 style="font-size:20px;font-weight:800;">Contas Bancárias</h2>' +
      '<button onclick="Modules.Financeiro._openContaModal(null)" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Adicionar Conta</button>' +
      '</div>' +
      (_contas.length === 0 ? UI.emptyState('Nenhuma conta bancária', '🏦') :
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;">' +
        _contas.map(function (c) {
          return '<div style="background:#fff;border-radius:14px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
            '<div style="font-size:16px;font-weight:800;">' + c.name + '</div>' +
            '<div style="display:flex;gap:6px;">' +
            '<button onclick="Modules.Financeiro._openContaModal(\'' + c.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;">✏️</button>' +
            '<button onclick="Modules.Financeiro._deleteConta(\'' + c.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;">🗑️</button>' +
            '</div></div>' +
            '<div style="font-size:12px;color:#8A7E7C;margin-bottom:10px;">' + (c.bank || '') + ' · ' + (c.type || '') + '</div>' +
            '<div style="font-family:\'League Spartan\',sans-serif;font-size:22px;font-weight:800;color:#1A9E5A;">' + UI.fmt(c.initialBalance || 0) + '</div>' +
            '<div style="font-size:11px;color:#8A7E7C;">Saldo inicial</div>' +
            '</div>';
        }).join('') + '</div>');
  }

  function _openContaModal(id) {
    _editingId = id;
    var c = id ? (_contas.find(function (x) { return x.id === id; }) || {}) : {};
    var body = '<div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Nome *</label><input id="cn-name" type="text" value="' + (c.name || '') + '" placeholder="Ex: Caixa, Millennium, MB Way..." style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Banco</label><input id="cn-bank" type="text" value="' + (c.bank || '') + '" placeholder="Ex: Millennium BCP..." style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Tipo</label><select id="cn-type" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"><option value="corrente"' + (c.type === 'corrente' ? ' selected' : '') + '>Conta Corrente</option><option value="poupanca"' + (c.type === 'poupanca' ? ' selected' : '') + '>Conta Poupança</option><option value="outros"' + (c.type === 'outros' ? ' selected' : '') + '>Outros</option></select></div>' +
      '</div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Saldo Inicial (€)</label><input id="cn-balance" type="number" step="0.01" value="' + (c.initialBalance || '0') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '</div>';
    var footer = '<button onclick="Modules.Financeiro._saveConta()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">' + (id ? 'Atualizar' : 'Adicionar') + '</button>';
    window._contaModal = UI.modal({ title: id ? 'Editar Conta' : 'Nova Conta Bancária', body: body, footer: footer });
  }

  function _saveConta() {
    var name = (document.getElementById('cn-name') || {}).value || '';
    if (!name) { UI.toast('Nome é obrigatório', 'error'); return; }
    var data = { name: name, bank: (document.getElementById('cn-bank') || {}).value || '', type: (document.getElementById('cn-type') || {}).value || 'corrente', initialBalance: parseFloat((document.getElementById('cn-balance') || {}).value) || 0 };
    var op = _editingId ? DB.update('financeiro_contas', _editingId, data) : DB.add('financeiro_contas', data);
    op.then(function () {
      UI.toast('Conta salva!', 'success');
      if (window._contaModal) window._contaModal.close();
      _renderContas();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _deleteConta(id) {
    UI.confirm('Eliminar esta conta?').then(function (yes) {
      if (!yes) return;
      DB.remove('financeiro_contas', id).then(function () { UI.toast('Eliminado', 'info'); _renderContas(); });
    });
  }

  // ── FORNECEDORES ──────────────────────────────────────────────────────────
  function _renderFornecedores() {
    Promise.all([DB.getAll('financeiro_fornecedores'), DB.getAll('financeiro_saidas')]).then(function (r) {
      _fornecedores = r[0] || [];
      var saidas = r[1] || [];
      var spendMap = {};
      saidas.forEach(function (s) { spendMap[s.fornecedorId] = (spendMap[s.fornecedorId] || 0) + (parseFloat(s.valor) || 0); });
      _paintFornecedores(spendMap);
    });
  }

  function _paintFornecedores(spendMap) {
    var content = document.getElementById('fin-content');
    if (!content) return;
    content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">' +
      '<h2 style="font-size:20px;font-weight:800;">Fornecedores (' + _fornecedores.length + ')</h2>' +
      '<button onclick="Modules.Financeiro._openFornModal(null)" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Adicionar</button>' +
      '</div>' +
      (_fornecedores.length === 0 ? UI.emptyState('Nenhum fornecedor ainda', '🏪') :
        '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
        '<thead><tr style="background:#F2EDED;">' +
        ['Nome','Telefone','Cidade','Categoria Padrão','Total Gasto',''].map(function (h) {
          return '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">' + h + '</th>';
        }).join('') + '</tr></thead><tbody>' +
        _fornecedores.map(function (f) {
          var spent = spendMap ? (spendMap[f.id] || 0) : 0;
          return '<tr style="border-top:1px solid #F2EDED;">' +
            '<td style="padding:11px 14px;font-size:13px;font-weight:700;">' + f.name + '</td>' +
            '<td style="padding:11px 14px;font-size:12px;">' + (f.phone || '—') + '</td>' +
            '<td style="padding:11px 14px;font-size:12px;">' + (f.city || '—') + '</td>' +
            '<td style="padding:11px 14px;font-size:12px;">' + (f.defaultCategory || '—') + '</td>' +
            '<td style="padding:11px 14px;font-size:13px;font-weight:800;color:#C4362A;">' + UI.fmt(spent) + '</td>' +
            '<td style="padding:11px 8px;white-space:nowrap;">' +
            '<button onclick="Modules.Financeiro._openFornModal(\'' + f.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;margin-right:4px;">✏️</button>' +
            '<button onclick="Modules.Financeiro._deleteForn(\'' + f.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;">🗑️</button>' +
            '</td></tr>';
        }).join('') + '</tbody></table></div>');
  }

  function _openFornModal(id) {
    _editingId = id;
    var f = id ? (_fornecedores.find(function (x) { return x.id === id; }) || {}) : {};
    var body = '<div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Nome *</label><input id="fn-name" type="text" value="' + (f.name || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Telefone</label><input id="fn-phone" type="text" value="' + (f.phone || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Cidade</label><input id="fn-city" type="text" value="' + (f.city || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '</div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Categoria Padrão</label><input id="fn-cat" type="text" value="' + (f.defaultCategory || '') + '" placeholder="Ex: Matérias-primas..." style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '</div>';
    var footer = '<button onclick="Modules.Financeiro._saveForn()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">' + (id ? 'Atualizar' : 'Adicionar') + '</button>';
    window._fornModal = UI.modal({ title: id ? 'Editar Fornecedor' : 'Novo Fornecedor', body: body, footer: footer });
  }

  function _saveForn() {
    var name = (document.getElementById('fn-name') || {}).value || '';
    if (!name) { UI.toast('Nome é obrigatório', 'error'); return; }
    var data = { name: name, phone: (document.getElementById('fn-phone') || {}).value || '', city: (document.getElementById('fn-city') || {}).value || '', defaultCategory: (document.getElementById('fn-cat') || {}).value || '' };
    var op = _editingId ? DB.update('financeiro_fornecedores', _editingId, data) : DB.add('financeiro_fornecedores', data);
    op.then(function () {
      UI.toast('Fornecedor salvo!', 'success');
      if (window._fornModal) window._fornModal.close();
      _renderFornecedores();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _deleteForn(id) {
    UI.confirm('Eliminar este fornecedor?').then(function (yes) {
      if (!yes) return;
      DB.remove('financeiro_fornecedores', id).then(function () { UI.toast('Eliminado', 'info'); _renderFornecedores(); });
    });
  }

  // ── CATEGORIAS FINANCEIRAS ─────────────────────────────────────────────────
  function _renderCategorias() {
    DB.getAll('financeiro_categorias').then(function (data) {
      _categorias = data || [];
      _paintCategorias();
    });
  }

  function _paintCategorias() {
    var content = document.getElementById('fin-content');
    if (!content) return;
    var COLORS = ['#C4362A','#1A9E5A','#2563EB','#7C3AED','#D97706','#0891B2','#DB2777','#64748B','#EA580C','#059669'];
    content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">' +
      '<h2 style="font-size:20px;font-weight:800;">Categorias Financeiras</h2>' +
      '<button onclick="Modules.Financeiro._openCatModal(null)" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Adicionar</button>' +
      '</div>' +
      (_categorias.length === 0 ? UI.emptyState('Nenhuma categoria ainda', '🏷️') :
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;">' +
        _categorias.map(function (c) {
          var color = c.color || '#C4362A';
          return '<div style="background:#fff;border-radius:12px;padding:14px;box-shadow:0 2px 8px rgba(0,0,0,.06);display:flex;align-items:center;gap:10px;">' +
            '<div style="width:36px;height:36px;border-radius:9px;background:' + color + '20;display:flex;align-items:center;justify-content:center;">' +
            '<div style="width:14px;height:14px;border-radius:50%;background:' + color + ';"></div></div>' +
            '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:13px;font-weight:700;">' + c.name + '</div>' +
            '<div style="font-size:11px;color:#8A7E7C;">' + (c.type === 'saida' ? '📤 Saída' : '💰 Entrada') + '</div>' +
            '</div>' +
            '<button onclick="Modules.Financeiro._openCatModal(\'' + c.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;">✏️</button>' +
            '<button onclick="Modules.Financeiro._deleteCat(\'' + c.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;">🗑️</button>' +
            '</div>';
        }).join('') + '</div>');
  }

  function _openCatModal(id) {
    _editingId = id;
    var c = id ? (_categorias.find(function (x) { return x.id === id; }) || {}) : { type: 'entrada' };
    var COLORS = ['#C4362A','#1A9E5A','#2563EB','#7C3AED','#D97706','#0891B2','#DB2777','#64748B','#EA580C','#059669'];
    var body = '<div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Nome *</label><input id="fc-name" type="text" value="' + (c.name || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Tipo</label>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
      '<button type="button" id="fc-type-entrada" onclick="Modules.Financeiro._selectCatType(\'entrada\')" style="padding:10px;border:1.5px solid ' + (c.type !== 'saida' ? '#C4362A' : '#D4C8C6') + ';border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;background:' + (c.type !== 'saida' ? '#FFF0EE' : '#fff') + ';color:' + (c.type !== 'saida' ? '#C4362A' : '#8A7E7C') + ';font-family:inherit;">💰 Entrada</button>' +
      '<button type="button" id="fc-type-saida" onclick="Modules.Financeiro._selectCatType(\'saida\')" style="padding:10px;border:1.5px solid ' + (c.type === 'saida' ? '#C4362A' : '#D4C8C6') + ';border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;background:' + (c.type === 'saida' ? '#FFF0EE' : '#fff') + ';color:' + (c.type === 'saida' ? '#C4362A' : '#8A7E7C') + ';font-family:inherit;">📤 Saída</button>' +
      '</div></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:8px;">Cor</label>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;" id="fc-colors">' +
      COLORS.map(function (col) {
        return '<button type="button" data-color="' + col + '" onclick="Modules.Financeiro._selectFinCatColor(\'' + col + '\')" style="width:32px;height:32px;border-radius:50%;background:' + col + ';border:3px solid ' + (c.color === col ? '#fff' : 'transparent') + ';outline:' + (c.color === col ? '3px solid ' + col : 'none') + ';cursor:pointer;" onmouseover="this.style.transform=\'scale(1.15)\'" onmouseout="this.style.transform=\'scale(1)\'"></button>';
      }).join('') + '</div></div></div>';

    window._catType = c.type || 'entrada';
    window._catColor = c.color || COLORS[0];
    var footer = '<button onclick="Modules.Financeiro._saveCat()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">' + (id ? 'Atualizar' : 'Adicionar') + '</button>';
    window._catModal = UI.modal({ title: id ? 'Editar Categoria' : 'Nova Categoria', body: body, footer: footer });
  }

  function _selectCatType(type) {
    window._catType = type;
    ['entrada', 'saida'].forEach(function (t) {
      var btn = document.getElementById('fc-type-' + t);
      if (btn) {
        btn.style.borderColor = t === type ? '#C4362A' : '#D4C8C6';
        btn.style.background = t === type ? '#FFF0EE' : '#fff';
        btn.style.color = t === type ? '#C4362A' : '#8A7E7C';
      }
    });
  }

  function _selectFinCatColor(color) {
    window._catColor = color;
    document.querySelectorAll('#fc-colors button').forEach(function (btn) {
      var selected = btn.dataset.color === color;
      btn.style.border = '3px solid ' + (selected ? '#fff' : 'transparent');
      btn.style.outline = selected ? '3px solid ' + color : 'none';
    });
  }

  function _saveCat() {
    var name = (document.getElementById('fc-name') || {}).value || '';
    if (!name) { UI.toast('Nome é obrigatório', 'error'); return; }
    var data = { name: name, type: window._catType || 'entrada', color: window._catColor || '#C4362A' };
    var op = _editingId ? DB.update('financeiro_categorias', _editingId, data) : DB.add('financeiro_categorias', data);
    op.then(function () {
      UI.toast('Categoria salva!', 'success');
      if (window._catModal) window._catModal.close();
      _renderCategorias();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _deleteCat(id) {
    UI.confirm('Eliminar esta categoria?').then(function (yes) {
      if (!yes) return;
      DB.remove('financeiro_categorias', id).then(function () { UI.toast('Eliminado', 'info'); _renderCategorias(); });
    });
  }

  // ── Shared ─────────────────────────────────────────────────────────────────
  function _kpiCard(label, value, sub, color) {
    return '<div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
      '<div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">' + label + '</div>' +
      '<div style="font-family:\'League Spartan\',sans-serif;font-size:22px;font-weight:800;color:' + (color || '#1a1a1a') + ';">' + value + '</div>' +
      (sub ? '<div style="font-size:11px;color:#8A7E7C;margin-top:3px;">' + sub + '</div>' : '') +
      '</div>';
  }

  function destroy() {}

  return {
    render: render, destroy: destroy,
    _switchSub: _switchSub,
    _openEntradaModal: _openEntradaModal, _saveEntrada: _saveEntrada, _deleteEntrada: _deleteEntrada, _filterEntradas: _filterEntradas, _onCanalChange: _onCanalChange, _calcNet: _calcNet,
    _openSaidaModal: _openSaidaModal, _saveSaida: _saveSaida, _deleteSaida: _deleteSaida, _filterSaidas: _filterSaidas,
    _openApagarModal: _openApagarModal, _saveApagar: _saveApagar, _deleteApagar: _deleteApagar, _baixarConta: _baixarConta, _confirmBaixar: _confirmBaixar, _filterApagar: _filterApagar,
    _openContaModal: _openContaModal, _saveConta: _saveConta, _deleteConta: _deleteConta,
    _openFornModal: _openFornModal, _saveForn: _saveForn, _deleteForn: _deleteForn,
    _openCatModal: _openCatModal, _selectCatType: _selectCatType, _selectFinCatColor: _selectFinCatColor, _saveCat: _saveCat, _deleteCat: _deleteCat
  };
})();
