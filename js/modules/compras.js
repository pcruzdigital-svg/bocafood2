// js/modules/compras.js
window.Modules = window.Modules || {};
Modules.Compras = (function () {
  'use strict';

  var _activeSub = 'registros';
  var _compras = [];
  var _itens = [];
  var _fornecedores = [];
  var _unidades = [];
  var _tipos = [];
  var _categorias = [];
  var _contas = [];
  var _finCategorias = [];
  var _editingId = null;
  var _editingKind = '';
  var _itensView = 'todos';
  var _registroFilters = { q: '', periodo: 'todos', inicio: '', fim: '' };

  var TABS = [
    { key: 'registros', label: 'Registro de compras' },
    { key: 'itens', label: 'Produtos / Insumos' },
    { key: 'fornecedores', label: 'Fornecedores' },
    { key: 'tipos', label: 'Tipos' },
    { key: 'categorias', label: 'Categorias' }
  ];

  var DEFAULT_TIPOS = ['Ingrediente', 'Embalagem', 'Material operacional', 'Escritório / administrativo'];
  var DEFAULT_CATEGORIAS = ['Laticínios', 'Secos', 'Proteínas', 'Hortifruti', 'Temperos', 'Bebidas', 'Outros'];
  var DEFAULT_UNIDADES = [
    { name: 'Quilograma', symbol: 'kg', type: 'massa' },
    { name: 'Grama', symbol: 'g', type: 'massa' },
    { name: 'Litro', symbol: 'L', type: 'volume' },
    { name: 'Mililitro', symbol: 'ml', type: 'volume' },
    { name: 'Unidade', symbol: 'un', type: 'unidade' },
    { name: 'Pacote', symbol: 'pct', type: 'unidade' }
  ];
  var UNIDADES_COMPRA_MAP = { g: ['g', 'kg'], kg: ['kg', 'g'], ml: ['ml', 'L'], L: ['L', 'ml'], un: ['un'], unidade: ['unidade'], pct: ['pct'] };

  function render(sub) {
    _activeSub = sub || 'registros';
    var app = document.getElementById('app');
    app.innerHTML = '<section class="module-page">' +
      '<div class="module-head"><div><h1>Compras</h1><p>Compras, fornecedores, unidades e cadastro de produtos/insumos.</p></div></div>' +
      '<div id="compras-tabs" class="module-tabs"></div>' +
      '<div id="compras-content" class="module-content"><div class="loading-inline">Carregando...</div></div>' +
      '</section>';
    _renderTabs();
    _seedDefaults().then(function () { _loadSub(_activeSub); });
  }

  function _renderTabs() {
    var el = document.getElementById('compras-tabs');
    if (!el) return;
    el.innerHTML = TABS.map(function (t) {
      return '<button class="' + (t.key === _activeSub ? 'active' : '') + '" onclick="Modules.Compras._switchSub(\'' + t.key + '\')">' + t.label + '</button>';
    }).join('');
  }

  function _switchSub(key) {
    _activeSub = key;
    _renderTabs();
    _loadSub(key);
    Router.navigate('compras/' + key);
  }

  function _loadSub(key) {
    var content = document.getElementById('compras-content');
    if (content) content.innerHTML = '<div class="loading-inline">Carregando...</div>';
    if (key === 'registros') return _renderRegistros();
    if (key === 'itens') { _itensView = 'todos'; return _renderItens(); }
    if (key === 'fornecedores') return _renderFornecedores();
    if (key === 'unidades') return _renderUnidades();
    if (key === 'tipos') return _renderSimpleList('tipos');
    if (key === 'categorias') return _renderSimpleList('categorias');
  }

  function _seedDefaults() {
    return Promise.all([DB.getAll('compras_tipos'), DB.getAll('compras_categorias'), DB.getAll('unidades_medida')]).then(function (r) {
      var ops = [];
      if (!(r[0] || []).length) ops = ops.concat(DEFAULT_TIPOS.map(function (name) { return DB.add('compras_tipos', { name: name, ativo: true }); }));
      if (!(r[1] || []).length) ops = ops.concat(DEFAULT_CATEGORIAS.map(function (name) { return DB.add('compras_categorias', { name: name, ativo: true }); }));
      if (!(r[2] || []).length) ops = ops.concat(DEFAULT_UNIDADES.map(function (u) { return DB.add('unidades_medida', u); }));
      return Promise.all(ops);
    }).catch(function () {});
  }

  // Registro de compras
  function _renderRegistros() {
    Promise.all([
      DB.getAll('compras'), DB.getAll('fornecedores'), DB.getAll('itens_custo'),
      DB.getAll('financeiro_contas'), DB.getAll('financeiro_categorias')
    ]).then(function (r) {
      _compras = (r[0] || []).sort(function (a, b) { return (b.data || '').localeCompare(a.data || ''); });
      _fornecedores = r[1] || [];
      _itens = (r[2] || []).filter(function (i) { return i.ativo !== false; });
      _contas = r[3] || [];
      _finCategorias = r[4] || [];
      _paintRegistros();
    });
  }

  function _paintRegistros() {
    var content = document.getElementById('compras-content');
    if (!content) return;
    var data = _filteredRegistros();
    var total = data.reduce(function (s, c) { return s + (parseFloat(c.total) || 0); }, 0);
    var pendentes = data.filter(_compraPendente).length;
    var ticketMedio = data.length ? total / data.length : 0;
    var fornecedorPrincipal = _fornecedorPrincipal(data);
    content.innerHTML = _head('Registro de compras', '+ Nova compra', 'Modules.Compras._openCompraModal(null)') +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:18px;">' +
      _kpi('Compras', data.length) +
      _kpi('Total comprado', UI.fmt(total)) +
      _kpi('Pendentes', pendentes) +
      _kpi('Ticket médio', data.length ? UI.fmt(ticketMedio) : '-') +
      _kpi('Fornecedor principal', fornecedorPrincipal || '-') +
      '</div>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px;">' +
      '<input id="compras-reg-search" value="' + _esc(_registroFilters.q) + '" oninput="Modules.Compras._filterRegistros()" placeholder="Pesquisar por fornecedor, documento, item ou observação..." style="min-width:280px;flex:1;padding:11px 14px;border:1.5px solid #D4C8C6;border-radius:20px;font-size:13px;font-family:inherit;outline:none;background:#fff;">' +
      '<select id="compras-reg-periodo" onchange="Modules.Compras._filterRegistros()" style="min-width:180px;padding:11px 14px;border:1.5px solid #D4C8C6;border-radius:20px;font-size:13px;font-family:inherit;outline:none;background:#fff;">' +
      _periodoOption('todos', 'Todo período') +
      _periodoOption('mes_atual', 'Mês atual') +
      _periodoOption('30', 'Últimos 30 dias') +
      _periodoOption('90', 'Últimos 90 dias') +
      _periodoOption('ano_atual', 'Ano atual') +
      '</select>' +
      '<input id="compras-reg-inicio" type="date" value="' + _esc(_registroFilters.inicio) + '" onchange="Modules.Compras._filterRegistros()" title="Data inicial" style="min-width:150px;padding:10px 14px;border:1.5px solid #D4C8C6;border-radius:20px;font-size:13px;font-family:inherit;outline:none;background:#fff;">' +
      '<input id="compras-reg-fim" type="date" value="' + _esc(_registroFilters.fim) + '" onchange="Modules.Compras._filterRegistros()" title="Data final" style="min-width:150px;padding:10px 14px;border:1.5px solid #D4C8C6;border-radius:20px;font-size:13px;font-family:inherit;outline:none;background:#fff;">' +
      '</div>' +
      '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
      _thead(['Data', 'Fornecedor', 'Documento', 'Itens', 'Total', 'Conta a pagar', '']) +
      '<tbody>' + (data.length ? data.map(function (c) {
        var f = _byId(_fornecedores, c.fornecedorId);
        return '<tr onclick="Modules.Compras._openCompraModal(\'' + c.id + '\')" style="border-top:1px solid #F2EDED;cursor:pointer;">' +
          _td(c.data ? UI.fmtDate(new Date(c.data)) : '-') +
          _td(_esc(f ? f.name : '-'), true) +
          _td(_esc(c.numDocumento || '-')) +
          _td(((c.itens || []).length) + ' item(s)') +
          _td('<strong style="color:#C4362A;">' + UI.fmt(c.total || 0) + '</strong>') +
          _td(c.contaPagarId ? UI.badge('Gerada', 'green') : UI.badge('Não gerada', 'gray')) +
          '<td style="padding:10px;text-align:right;white-space:nowrap;" onclick="event.stopPropagation();"><button onclick="Modules.Compras._openCompraModal(\'' + c.id + '\')" style="' + _iconBtn('#EEF4FF', '#2563EB') + '"><span class="mi" style="font-size:15px;">edit</span></button> ' +
          '<button onclick="Modules.Compras._deleteCompra(\'' + c.id + '\')" style="' + _iconBtn('#FFF0EE', '#C4362A') + '"><span class="mi" style="font-size:15px;">delete</span></button></td></tr>';
      }).join('') : '<tr><td colspan="7" style="padding:38px;text-align:center;color:#8A7E7C;">Nenhuma compra encontrada para este filtro.</td></tr>') + '</tbody></table></div>';
  }

  function _filterRegistros() {
    _registroFilters.q = (_el('compras-reg-search').value || '').trim();
    _registroFilters.periodo = _el('compras-reg-periodo').value || 'todos';
    _registroFilters.inicio = (_el('compras-reg-inicio').value || '').trim();
    _registroFilters.fim = (_el('compras-reg-fim').value || '').trim();
    _paintRegistros();
  }

  function _filteredRegistros() {
    var q = String(_registroFilters.q || '').toLowerCase();
    return (_compras || []).filter(function (c) {
      if (!_periodoMatch(c.data, _registroFilters.periodo)) return false;
      if (!_dateRangeMatch(c.data, _registroFilters.inicio, _registroFilters.fim)) return false;
      if (!q) return true;
      var f = _byId(_fornecedores, c.fornecedorId);
      var itemText = (c.itens || []).map(function (i) { return i.nome || i.name || ''; }).join(' ');
      var hay = [
        f && f.name,
        c.numDocumento,
        c.documento,
        c.observacoes,
        c.formaPagamento,
        c.categoriaFiscal,
        itemText
      ].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function _periodoMatch(dateStr, periodo) {
    if (!periodo || periodo === 'todos') return true;
    var d = dateStr ? new Date(dateStr + 'T00:00:00') : null;
    if (!d || isNaN(d.getTime())) return false;
    var now = new Date();
    if (periodo === 'mes_atual') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    if (periodo === 'ano_atual') return d.getFullYear() === now.getFullYear();
    var days = parseInt(periodo, 10);
    if (!days) return true;
    var start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - days + 1);
    return d >= start;
  }

  function _dateRangeMatch(dateStr, inicio, fim) {
    if (!inicio && !fim) return true;
    var d = dateStr ? new Date(dateStr + 'T00:00:00') : null;
    if (!d || isNaN(d.getTime())) return false;
    if (inicio) {
      var start = new Date(inicio + 'T00:00:00');
      if (!isNaN(start.getTime()) && d < start) return false;
    }
    if (fim) {
      var end = new Date(fim + 'T23:59:59');
      if (!isNaN(end.getTime()) && d > end) return false;
    }
    return true;
  }

  function _compraPendente(c) {
    var status = String(c.status || c.statusPagamento || c.paymentStatus || '').toLowerCase();
    if (status === 'pago' || status === 'paga' || status === 'quitado' || status === 'quitada') return false;
    if (status === 'pendente' || status === 'aberto' || status === 'em aberto') return true;
    if (c.pago === false || c.paid === false) return true;
    return !c.contaPagarId;
  }

  function _fornecedorPrincipal(data) {
    var totals = {};
    (data || []).forEach(function (c) {
      var f = _byId(_fornecedores, c.fornecedorId);
      var name = (f && f.name) || 'Sem fornecedor';
      totals[name] = (totals[name] || 0) + (parseFloat(c.total) || 0);
    });
    var best = Object.keys(totals).sort(function (a, b) { return totals[b] - totals[a]; })[0];
    return best ? _esc(best) : '';
  }

  function _periodoOption(value, label) {
    return '<option value="' + value + '"' + (_registroFilters.periodo === value ? ' selected' : '') + '>' + label + '</option>';
  }

  function _openCompraModal(id) {
    _editingId = id;
    var c = id ? (_byId(_compras, id) || {}) : { data: new Date().toISOString().slice(0, 10), gerarContaPagar: true };
    window._compraLinhas = (c.itens || []).map(function (i) { return Object.assign({}, i); });
    var fornecedorOpts = _options(_fornecedores, c.fornecedorId, 'name', 'Sem fornecedor');
    var contaOpts = _options(_contas, c.contaBancariaId, 'name', 'Sem conta');
    var catOpts = _options(_finCategorias, c.categoriaFinanceiraId, 'name', 'Sem categoria');
    var itemOpts = _itens.map(function (i) {
      var unidade = i.unidade_base || i.unidadeBase || 'un';
      return '<option value="' + i.id + '" data-unidade="' + _esc(unidade) + '" data-aproveitamento="' + (i.aproveitamento_padrao || 100) + '">' + _esc(i.nome || i.name) + '</option>';
    }).join('');
    var body = '<div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
      _field('cp-data', 'Data *', c.data || '', 'date') +
      _select('cp-forn', 'Fornecedor', fornecedorOpts) +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
      _field('cp-doc', 'Nº documento', c.numDocumento || '') +
      _field('cp-obs', 'Observações', c.observacoes || '') +
      '</div>' +
      '<div style="background:#F8F6F5;border-radius:12px;padding:14px;margin-bottom:14px;">' +
      '<div style="font-size:11px;font-weight:800;color:#8A7E7C;text-transform:uppercase;margin-bottom:10px;">Itens da compra</div>' +
      '<div style="display:grid;grid-template-columns:2fr .75fr .8fr .9fr .8fr .75fr auto;gap:8px;align-items:end;">' +
      _select('cp-item', 'Produto/Insumo', '<option value="">Selecionar...</option>' + itemOpts, 'Modules.Compras._onCompraItemChange()') +
      _field('cp-qty', 'Qtd.', '', 'number', 'Modules.Compras._calcCompraLinha()') +
      _select('cp-unidade', 'Unid.', '<option value="">-</option>', 'Modules.Compras._calcCompraLinha()') +
      _field('cp-preco', 'Preço pago (€)', '', 'number', 'Modules.Compras._calcCompraLinha()') +
      _field('cp-desc', 'Desc. (€)', '', 'number', 'Modules.Compras._calcCompraLinha()') +
      _field('cp-iva-line', 'IVA %', c.ivaPct || c.iva || '', 'number', 'Modules.Compras._calcCompraLinha()') +
      '<button onclick="Modules.Compras._addCompraLinha()" style="padding:9px 14px;background:#1A9E5A;color:#fff;border:none;border-radius:9px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">+ Add</button>' +
      '</div><div id="cp-preview" style="margin-top:8px;font-size:11px;color:#8A7E7C;min-height:16px;"></div></div>' +
      '<div id="cp-lines"></div><div id="cp-total" style="margin:10px 0 14px;text-align:right;font-weight:800;"></div>' +
      '<div style="background:#FFF8F1;border:1px solid #F1D6C8;border-radius:12px;padding:14px;margin-bottom:14px;">' +
      '<div style="font-size:11px;font-weight:800;color:#8A7E7C;text-transform:uppercase;margin-bottom:10px;">Fiscal</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">' +
      '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;"><input id="cp-ded-iva" type="checkbox" ' + (c.dedutivelIva || c.deductibleVat ? 'checked' : '') + ' style="accent-color:#C4362A;width:16px;height:16px;"> Dedutível para IVA</label>' +
      '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;"><input id="cp-ded-irpf" type="checkbox" ' + (c.dedutivelIrpf || c.deductibleIrpf ? 'checked' : '') + ' style="accent-color:#C4362A;width:16px;height:16px;"> Dedutível para IRPF</label>' +
      '</div>' +
      _select('cp-fiscal-cat', 'Categoria fiscal', _fiscalCategoryOptions(c.categoriaFiscal || c.fiscalCategory || 'outro')) +
      '<div style="font-size:11px;color:#8A7E7C;margin-top:6px;">O IVA pode ser informado em cada item da compra. Se estiver vazio, o Fiscal usa o IVA padrão.</div>' +
      '</div>' +
      '<div style="background:#F8F6F5;border-radius:12px;padding:14px;">' +
      '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;margin-bottom:12px;"><input id="cp-gerar-apagar" type="checkbox" ' + (c.gerarContaPagar !== false ? 'checked' : '') + ' style="accent-color:#C4362A;width:16px;height:16px;"> Gerar conta a pagar</label>' +
      '<div style="margin-bottom:12px;">' + _select('cp-cost-class', 'Classificação do custo', _costClassOptions(c.costClass || 'direto')) + '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
      _select('cp-conta', 'Conta bancária prevista', contaOpts) +
      _select('cp-forma', 'Forma de pagamento', _paymentOptions(c.formaPagamento)) +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">' +
      _field('cp-venc', 'Vencimento', c.dueDate || c.data || '', 'date') +
      _field('cp-parcelas', 'Parcelas', c.parcelas || 1, 'number') +
      _select('cp-fin-cat', 'Categoria financeira', catOpts) +
      '</div></div></div>';
    var footer = '<button onclick="Modules.Compras._saveCompra()" style="' + _primaryStyle() + '">' + (id ? 'Atualizar compra' : 'Registrar compra') + '</button>';
    window._compraModal = UI.modal({ title: id ? 'Editar compra' : 'Nova compra', body: body, footer: footer, maxWidth: '860px' });
    setTimeout(_renderCompraLinhas, 50);
  }

  function _paymentOptions(selected) {
    return ['A definir', 'Dinheiro', 'Cartão', 'Transferência', 'MB WAY', 'Débito direto', 'Outro'].map(function (p) {
      return '<option value="' + _esc(p) + '"' + (selected === p ? ' selected' : '') + '>' + _esc(p) + '</option>';
    }).join('');
  }

  function _fiscalCategoryOptions(selected) {
    return [
      ['insumo', 'Insumo'],
      ['embalagem', 'Embalagem'],
      ['produto_pronto', 'Produto pronto'],
      ['despesa_operacional', 'Despesa operacional'],
      ['equipamento_investimento', 'Equipamento/investimento'],
      ['servico', 'Serviço'],
      ['outro', 'Outro']
    ].map(function (p) {
      return '<option value="' + p[0] + '"' + (selected === p[0] ? ' selected' : '') + '>' + p[1] + '</option>';
    }).join('');
  }

  function _costClassOptions(selected) {
    return [
      ['direto', 'Custo direto'],
      ['indireto', 'Custo indireto'],
      ['despesa', 'Despesa']
    ].map(function (p) {
      return '<option value="' + p[0] + '"' + (selected === p[0] ? ' selected' : '') + '>' + p[1] + '</option>';
    }).join('');
  }

  function _onCompraItemChange() {
    var sel = document.getElementById('cp-item');
    var opt = sel ? sel.options[sel.selectedIndex] : null;
    var unidade = (opt && opt.dataset.unidade) || 'un';
    var opts = UNIDADES_COMPRA_MAP[unidade] || [unidade];
    var el = document.getElementById('cp-unidade');
    if (el) el.innerHTML = opts.map(function (u) { return '<option value="' + _esc(u) + '">' + _esc(u) + '</option>'; }).join('');
    _calcCompraLinha();
  }

  function _toBase(qty, unidadeCompra, unidadeBase) {
    if ((unidadeCompra === 'kg' || unidadeCompra === 'Kg') && (unidadeBase === 'g' || unidadeBase === 'gr')) return qty * 1000;
    if ((unidadeCompra === 'L' || unidadeCompra === 'l') && unidadeBase === 'ml') return qty * 1000;
    if (unidadeCompra === 'g' && unidadeBase === 'kg') return qty / 1000;
    if (unidadeCompra === 'ml' && unidadeBase === 'L') return qty / 1000;
    return qty;
  }

  function _calcCompraLinha() {
    var sel = document.getElementById('cp-item');
    var opt = sel ? sel.options[sel.selectedIndex] : null;
    var unidadeBase = (opt && opt.dataset.unidade) || 'un';
    var aproveitamento = parseFloat((opt && opt.dataset.aproveitamento) || '100') || 100;
    var qty = parseFloat((_el('cp-qty').value || '0')) || 0;
    var unidadeCompra = _el('cp-unidade').value || unidadeBase;
    var preco = _num(_el('cp-preco').value);
    var desconto = _num(_el('cp-desc').value);
    var ivaPct = _num(_el('cp-iva-line').value);
    var preview = document.getElementById('cp-preview');
    if (!preview || !qty || !preco || !sel || !sel.value) { if (preview) preview.innerHTML = ''; return; }
    var qtyBase = _toBase(qty, unidadeCompra, unidadeBase);
    var totalLinha = Math.max(0, preco - desconto);
    var valorSemIva = ivaPct > 0 ? totalLinha / (1 + ivaPct / 100) : totalLinha;
    var ivaValor = totalLinha - valorSemIva;
    var custo = valorSemIva / qtyBase / (aproveitamento / 100);
    preview.innerHTML = 'Base: <strong>' + qtyBase.toFixed(3) + ' ' + _esc(unidadeBase) + '</strong> · Sem IVA: <strong>' + UI.fmt(valorSemIva) + '</strong> · IVA: <strong>' + UI.fmt(ivaValor) + '</strong> · Custo ajustado: <strong style="color:#1A9E5A;">€' + custo.toFixed(custo < 0.01 ? 6 : 4) + '/' + _esc(unidadeBase) + '</strong>';
  }

  function _addCompraLinha() {
    var sel = document.getElementById('cp-item');
    var opt = sel ? sel.options[sel.selectedIndex] : null;
    if (!sel || !sel.value) { UI.toast('Selecione um produto/insumo', 'error'); return; }
    var qty = parseFloat(_el('cp-qty').value || '0') || 0;
    var preco = _num(_el('cp-preco').value);
    var desconto = _num(_el('cp-desc').value);
    var ivaPct = _num(_el('cp-iva-line').value);
    if (qty <= 0 || preco <= 0) { UI.toast('Quantidade e preço são obrigatórios', 'error'); return; }
    var unidadeBase = (opt && opt.dataset.unidade) || 'un';
    var unidadeCompra = _el('cp-unidade').value || unidadeBase;
    var aproveitamento = parseFloat((opt && opt.dataset.aproveitamento) || '100') || 100;
    var qtyBase = _toBase(qty, unidadeCompra, unidadeBase);
    var totalLinha = Math.max(0, preco - desconto);
    var valorSemIva = ivaPct > 0 ? totalLinha / (1 + ivaPct / 100) : totalLinha;
    var ivaValor = totalLinha - valorSemIva;
    var custoAjustado = valorSemIva / qtyBase / (aproveitamento / 100);
    window._compraLinhas.push({
      itemId: sel.value,
      itemNome: opt ? opt.text : '',
      qtdComprada: qty,
      unidadeCompra: unidadeCompra,
      unidadeBase: unidadeBase,
      precoPago: preco,
      desconto: desconto,
      totalLinha: totalLinha,
      ivaPct: ivaPct,
      ivaValor: ivaValor,
      valorSemIva: valorSemIva,
      qtyBase: qtyBase,
      aproveitamento: aproveitamento,
      custoAjustado: custoAjustado
    });
    sel.value = '';
    _el('cp-qty').value = '';
    _el('cp-preco').value = '';
    _el('cp-desc').value = '';
    _el('cp-unidade').innerHTML = '<option value="">-</option>';
    _renderCompraLinhas();
  }

  function _renderCompraLinhas() {
    var el = document.getElementById('cp-lines');
    var totalEl = document.getElementById('cp-total');
    if (!el) return;
    var linhas = window._compraLinhas || [];
    if (!linhas.length) {
      el.innerHTML = '<div style="padding:18px;text-align:center;color:#8A7E7C;font-size:13px;">Nenhum item adicionado.</div>';
      if (totalEl) totalEl.innerHTML = '';
      return;
    }
    var total = linhas.reduce(function (s, l) { return s + _lineTotal(l); }, 0);
    var semIva = linhas.reduce(function (s, l) { return s + (_num(l.valorSemIva) || _lineTotal(l)); }, 0);
    var iva = linhas.reduce(function (s, l) { return s + _num(l.ivaValor); }, 0);
    el.innerHTML = '<table style="width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06);">' +
      _thead(['Item', 'Qtd.', 'Sem IVA', 'IVA', 'Total', 'Custo/base', '']) +
      '<tbody>' + linhas.map(function (l, idx) {
        return '<tr style="border-top:1px solid #F2EDED;">' + _td(_esc(l.itemNome), true) + _td(l.qtdComprada + ' ' + _esc(l.unidadeCompra)) + _td(UI.fmt(l.valorSemIva || _lineTotal(l))) + _td(l.ivaPct ? UI.fmt(l.ivaValor || 0) + ' <small style="color:#8A7E7C;">(' + l.ivaPct + '%)</small>' : '-') + _td(UI.fmt(_lineTotal(l))) + _td('€' + (l.custoAjustado || 0).toFixed((l.custoAjustado || 0) < 0.01 ? 6 : 4) + '/' + _esc(l.unidadeBase)) +
          '<td style="padding:8px;text-align:right;"><button onclick="Modules.Compras._removeCompraLinha(' + idx + ')" style="' + _iconBtn('#FFF0EE', '#C4362A') + '"><span class="mi" style="font-size:14px;">close</span></button></td></tr>';
      }).join('') + '</tbody></table>';
    if (totalEl) totalEl.innerHTML = 'Sem IVA: <span style="font-weight:800;">' + UI.fmt(semIva) + '</span> · IVA: <span style="font-weight:800;">' + UI.fmt(iva) + '</span> · Total: <span style="color:#C4362A;font-size:16px;">' + UI.fmt(total) + '</span>';
  }

  function _removeCompraLinha(idx) {
    (window._compraLinhas || []).splice(idx, 1);
    _renderCompraLinhas();
  }

  function _saveCompra() {
    var data = _el('cp-data').value;
    var linhas = window._compraLinhas || [];
    if (!data) { UI.toast('Data obrigatória', 'error'); return; }
    if (!linhas.length) { UI.toast('Adicione pelo menos um item', 'error'); return; }
    var total = linhas.reduce(function (s, l) { return s + _lineTotal(l); }, 0);
    var valorSemIva = linhas.reduce(function (s, l) { return s + (_num(l.valorSemIva) || _lineTotal(l)); }, 0);
    var ivaValor = linhas.reduce(function (s, l) { return s + _num(l.ivaValor); }, 0);
    var ivaPctList = linhas.map(function (l) { return _num(l.ivaPct); }).filter(function (v) { return v > 0; });
    var ivaPct = ivaPctList.length ? ivaPctList[0] : 0;
    var compraData = {
      data: data,
      fornecedorId: _el('cp-forn').value,
      numDocumento: _el('cp-doc').value,
      observacoes: _el('cp-obs').value,
      total: total,
      valorSemIva: valorSemIva,
      ivaValor: ivaValor,
      ivaPct: ivaPct,
      itens: linhas,
      dedutivelIva: _el('cp-ded-iva').checked,
      dedutivelIrpf: _el('cp-ded-irpf').checked,
      categoriaFiscal: _el('cp-fiscal-cat').value || 'outro',
      costClass: _el('cp-cost-class').value || 'direto',
      gerarContaPagar: _el('cp-gerar-apagar').checked,
      contaBancariaId: _el('cp-conta').value,
      formaPagamento: _el('cp-forma').value,
      dueDate: _el('cp-venc').value,
      parcelas: parseInt(_el('cp-parcelas').value || '1', 10) || 1,
      categoriaFinanceiraId: _el('cp-fin-cat').value
    };
    var op = _editingId ? DB.update('compras', _editingId, compraData) : DB.add('compras', compraData);
    var compraId = _editingId || '';
    op.then(function (ref) {
      compraId = compraId || (ref && ref.id) || '';
      var updates = linhas.map(function (l) {
        var upd = {
          custo_atual: l.custoAjustado,
          preco_compra: l.custoAjustado,
          ultima_compra_data: data,
          ultima_compra_id: compraId,
          ultima_compra_total: _lineTotal(l),
          ultima_compra_qtd_base: l.qtyBase
        };
        if (compraData.fornecedorId) upd.fornecedor_padrao_id = compraData.fornecedorId;
        return DB.update('itens_custo', l.itemId, upd);
      });
      return Promise.all(updates);
    }).then(function () {
      if (!compraData.gerarContaPagar) return null;
      return _saveContaPagarFromCompra(compraId, compraData, total);
    }).then(function () {
      UI.toast('Compra salva!', 'success');
      if (window._compraModal) window._compraModal.close();
      _renderRegistros();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _deleteCompra(id) {
    UI.confirm('Eliminar esta compra?').then(function (yes) {
      if (!yes) return;
      DB.remove('compras', id).then(function () { UI.toast('Compra eliminada', 'info'); _renderRegistros(); });
    });
  }

  function _saveContaPagarFromCompra(compraId, compraData, total) {
    var original = _byId(_compras, compraId) || {};
    var parcelas = Math.max(parseInt(compraData.parcelas || 1, 10) || 1, 1);
    var baseDue = compraData.dueDate || compraData.data;
    var base = {
      fornecedorId: compraData.fornecedorId,
      categoriaId: compraData.categoriaFinanceiraId,
      status: 'Pendente',
      contaBancariaId: compraData.contaBancariaId,
      formaPagamento: compraData.formaPagamento,
      costClass: compraData.costClass || 'direto',
      sourceCompraId: compraId
    };
    if (original.contaPagarId) {
      var upd = Object.assign({}, base, {
        descricao: 'Compra ' + (compraData.numDocumento || compraId),
        valor: total,
        dueDate: baseDue
      });
      return DB.update('financeiro_apagar', original.contaPagarId, upd);
    }
    if (parcelas <= 1) {
      return DB.add('financeiro_apagar', Object.assign({}, base, {
        descricao: 'Compra ' + (compraData.numDocumento || compraId),
        valor: total,
        dueDate: baseDue
      })).then(function (ref) {
        return DB.update('compras', compraId, { contaPagarId: ref && ref.id ? ref.id : '', contaPagarGeradaEm: new Date().toISOString() });
      });
    }
    var valorParcela = total / parcelas;
    var due = baseDue ? new Date(baseDue) : new Date();
    var ops = [];
    for (var i = 0; i < parcelas; i++) {
      var d = new Date(due);
      d.setMonth(d.getMonth() + i);
      ops.push(DB.add('financeiro_apagar', Object.assign({}, base, {
        descricao: 'Compra ' + (compraData.numDocumento || compraId) + ' (' + (i + 1) + '/' + parcelas + ')',
        valor: valorParcela,
        dueDate: d.toISOString().slice(0, 10)
      })));
    }
    return Promise.all(ops).then(function (refs) {
      return DB.update('compras', compraId, {
        contaPagarId: refs[0] && refs[0].id ? refs[0].id : '',
        contaPagarIds: refs.map(function (r) { return r && r.id ? r.id : ''; }).filter(Boolean),
        contaPagarGeradaEm: new Date().toISOString()
      });
    });
  }

  // Produtos / Insumos
  function _renderItens() {
    Promise.all([DB.getAll('itens_custo'), DB.getAll('fornecedores'), DB.getAll('unidades_medida'), DB.getAll('compras_tipos'), DB.getAll('compras_categorias')]).then(function (r) {
      _itens = (r[0] || []).sort(function (a, b) { return (a.nome || '').localeCompare(b.nome || ''); });
      _fornecedores = r[1] || [];
      _unidades = r[2] || [];
      _tipos = r[3] || [];
      _categorias = r[4] || [];
      _paintItens();
    });
  }

  function _renderInsumos() {
    _itensView = 'insumos';
    _renderItens();
  }

  function _paintItens() {
    var content = document.getElementById('compras-content');
    if (!content) return;
    var insumosOnly = _itensView === 'insumos';
    var data = insumosOnly ? _itens.filter(function (i) { return i.classe !== 'produto'; }) : _itens;
    content.innerHTML = _head(insumosOnly ? 'Insumos' : 'Produtos / Insumos', '+ Adicionar', insumosOnly ? 'Modules.Compras._openInsumoModal(null)' : 'Modules.Compras._openItemModal(null)') +
      '<div style="margin-bottom:12px;"><input id="compras-item-search" type="text" placeholder="Pesquisar produto ou insumo..." oninput="Modules.Compras._filterItens()" style="width:100%;padding:11px 14px;border:1.5px solid #D4C8C6;border-radius:20px;font-size:13px;outline:none;"></div>' +
      '<div id="compras-itens-table">' + _itensTable(data) + '</div>';
  }

  function _itensTable(data) {
    return '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
      _thead(['Nome', 'Classe', 'Tipo', 'Categoria', 'Unidade', 'Custo atual', 'Venda', '']) +
      '<tbody>' + (data.length ? data.map(function (i) {
        var openFn = _itensView === 'insumos' ? '_openInsumoModal' : '_openItemModal';
        return '<tr onclick="Modules.Compras.' + openFn + '(\'' + i.id + '\')" style="border-top:1px solid #F2EDED;cursor:pointer;">' +
          _td(_esc(i.nome || i.name), true) +
          _td(UI.badge(i.classe === 'produto' ? 'Produto' : 'Insumo', i.classe === 'produto' ? 'blue' : 'orange')) +
          _td(_esc(i.tipo || '-')) +
          _td(_esc(i.categoria || '-')) +
          _td(_esc(i.unidade_base || i.unidadeBase || '-')) +
          _td(i.custo_atual ? '€' + Number(i.custo_atual).toFixed(Number(i.custo_atual) < 0.01 ? 6 : 4) : '-') +
          _td(i.classe === 'produto' && i.venda_habilitada ? UI.badge('Cardápio', 'green') : '-') +
          '<td style="padding:10px;text-align:right;white-space:nowrap;" onclick="event.stopPropagation();"><button onclick="Modules.Compras.' + openFn + '(\'' + i.id + '\')" style="' + _iconBtn('#EEF4FF', '#2563EB') + '"><span class="mi" style="font-size:15px;">edit</span></button> ' +
          '<button onclick="Modules.Compras._deleteItem(\'' + i.id + '\')" style="' + _iconBtn('#FFF0EE', '#C4362A') + '"><span class="mi" style="font-size:15px;">delete</span></button></td></tr>';
      }).join('') : '<tr><td colspan="8" style="padding:38px;text-align:center;color:#8A7E7C;">Nenhum produto/insumo cadastrado.</td></tr>') + '</tbody></table></div>';
  }

  function _filterItens() {
    var q = (_el('compras-item-search').value || '').toLowerCase();
    var source = _itensView === 'insumos' ? _itens.filter(function (i) { return i.classe !== 'produto'; }) : _itens;
    var data = source.filter(function (i) {
      return [i.nome, i.name, i.classe, i.tipo, i.categoria].join(' ').toLowerCase().indexOf(q) >= 0;
    });
    var el = document.getElementById('compras-itens-table');
    if (el) el.innerHTML = _itensTable(data);
  }

  function _openItemModal(id) {
    _editingId = id;
    var item = id ? (_byId(_itens, id) || {}) : { classe: 'insumo', tipo: 'Ingrediente', ativo: true, aproveitamento_padrao: 100 };
    window._itemCompraImageBase64 = item.imageBase64 || '';
    var tipoOpts = _namedOptions(_tipos, item.tipo, DEFAULT_TIPOS);
    var catOpts = _namedOptions(_categorias, item.categoria, DEFAULT_CATEGORIAS);
    var unidadeOpts = _unidades.map(function (u) {
      var val = u.symbol || u.name;
      return '<option value="' + _esc(val) + '"' + ((item.unidade_base || item.unidadeBase) === val ? ' selected' : '') + '>' + _esc(u.name) + ' (' + _esc(val) + ')</option>';
    }).join('');
    var fornOpts = _options(_fornecedores, item.fornecedor_padrao_id, 'name', 'Sem fornecedor padrão');
    var imgSrc = item.imageBase64 || item.imageUrl || '';
    var costText = item.custo_atual ? '€' + Number(item.custo_atual).toFixed(Number(item.custo_atual) < 0.01 ? 6 : 4) + '/' + _esc(item.unidade_base || '') : '-';
    var lastPurchaseText = item.ultima_compra_data ? UI.fmtDate(new Date(item.ultima_compra_data)) : '-';
    var sectionTitle = 'font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;';
    var sectionHint = 'font-size:12px;color:#8A7E7C;line-height:1.45;margin-bottom:14px;';
    var cardStyle = 'background:#fff;border:1px solid #EFE6E3;border-radius:18px;padding:18px;box-shadow:0 12px 32px rgba(58,35,30,.06);';
    var softCardStyle = 'background:linear-gradient(135deg,#fff 0%,#FBF7F6 100%);border:1px solid #EFE6E3;border-radius:18px;padding:18px;';
    var metricStyle = 'background:#F8F4F3;border:1px solid #EFE6E3;border-radius:14px;padding:12px;';
    var body = '<div style="display:grid;gap:16px;">' +
      '<div style="' + softCardStyle + '">' +
      '<div style="display:grid;grid-template-columns:minmax(180px,.65fr) 1.35fr;gap:16px;align-items:end;">' +
      '<div><label style="' + _labelStyle() + '">Classe do cadastro *</label>' +
      '<select id="it-classe" onchange="Modules.Compras._toggleItemClasse()" style="' + _inputStyle() + '">' +
      '<option value="insumo"' + (item.classe !== 'produto' ? ' selected' : '') + '>Insumo</option>' +
      '<option value="produto"' + (item.classe === 'produto' ? ' selected' : '') + '>Produto</option>' +
      '</select></div>' +
      '<div>' + _field('it-nome', 'Nome *', item.nome || item.name || '') + '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">' + _select('it-tipo', 'Tipo *', tipoOpts) + _select('it-categoria', 'Categoria *', catOpts) + '</div>' +
      '</div>' +
      '<div style="' + cardStyle + '">' +
      '<div style="' + sectionTitle + '">Compra e custo</div>' +
      '<div style="' + sectionHint + '">Dados usados em compras, fornecedores, custos, receitas e cálculo financeiro.</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' + _select('it-unidade', 'Unidade base *', '<option value="">Selecionar...</option>' + unidadeOpts) + _select('it-forn', 'Fornecedor padrão', fornOpts) + '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;align-items:stretch;">' +
      '<label style="' + metricStyle + 'display:flex;align-items:center;gap:10px;font-size:13px;font-weight:900;"><input id="it-ativo" type="checkbox" ' + (item.ativo !== false ? 'checked' : '') + ' style="accent-color:#C4362A;width:17px;height:17px;"> Cadastro ativo</label>' +
      '<div style="' + metricStyle + '"><div style="' + sectionTitle + 'margin-bottom:6px;">Custo atual</div><strong style="font-size:17px;color:#1A1A1A;">' + costText + '</strong></div>' +
      '<div style="' + metricStyle + '"><div style="' + sectionTitle + 'margin-bottom:6px;">Última compra</div><strong style="font-size:17px;color:#1A1A1A;">' + lastPurchaseText + '</strong></div>' +
      '</div>' +
      '</div>' +
      '<div id="it-insumo-fields" style="display:none;' + cardStyle + '">' +
      '<div style="' + sectionTitle + '">Uso em receitas</div>' +
      '<div style="' + sectionHint + '">Configura o rendimento do insumo para fichas técnicas, perdas e custos de produção.</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:end;">' + _field('it-aprov', 'Aproveitamento (%)', item.aproveitamento_padrao || 100, 'number') +
      '<label style="background:#F8F4F3;border:1px solid #EFE6E3;border-radius:14px;padding:16px;display:flex;align-items:center;gap:10px;font-size:13px;font-weight:900;"><input id="it-fichas" type="checkbox" ' + (item.usar_em_fichas !== false ? 'checked' : '') + ' style="accent-color:#C4362A;width:17px;height:17px;"> Usar em receitas</label></div>' +
      '</div>' +
      '<div id="it-produto-fields" style="display:none;' + cardStyle + '">' +
      '<div style="' + sectionTitle + '">Cardápio e venda</div>' +
      '<div style="' + sectionHint + '">Use quando este item comprado também é vendido como produto único no cardápio.</div>' +
      '<label style="background:#FFF7F5;border:1px solid #F0C7C1;border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:10px;font-size:14px;font-weight:900;margin-bottom:14px;"><input id="it-venda" type="checkbox" ' + (item.venda_habilitada ? 'checked' : '') + ' style="accent-color:#C4362A;width:18px;height:18px;"> Alimentar cardápio/venda como produto único</label>' +
      '<div style="display:grid;grid-template-columns:180px 1fr;gap:18px;align-items:start;background:#FBF8F7;border:1px solid #EFE6E3;border-radius:16px;padding:16px;margin-bottom:14px;">' +
      '<div><div style="' + sectionTitle + '">Imagem do produto</div><div style="width:160px;aspect-ratio:1;border-radius:16px;background:#F2EDED;border:1px dashed #D9CBC7;overflow:hidden;display:flex;align-items:center;justify-content:center;color:#8A7E7C;font-size:12px;font-weight:900;text-align:center;">' +
      '<img id="it-img-preview" src="' + _esc(imgSrc) + '" style="' + (imgSrc ? '' : 'display:none;') + 'width:100%;height:100%;object-fit:cover;"><span id="it-img-empty" style="' + (imgSrc ? 'display:none;' : '') + '">Foto do<br>produto</span></div></div>' +
      '<div><label style="' + _labelStyle() + '">Arquivo da imagem</label><input id="it-img-file" type="file" accept="image/png,image/jpeg,image/webp" onchange="Modules.Compras._onItemImgFileChange(event)" style="' + _inputStyle() + 'padding:8px;background:#fff;">' +
      '<div style="font-size:12px;color:#8A7E7C;margin:8px 0 12px;line-height:1.45;">Use PNG, JPG ou WebP. Recomendado: imagem quadrada, mínimo 800 x 800 px, fundo claro e produto centralizado.</div>' +
      _field('it-img', 'Imagem URL alternativa', item.imageUrl || '') + '</div></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' + _field('it-preco-compra', 'Preço de compra (€)', item.preco_compra || item.purchasePrice || '', 'number') + _field('it-preco-venda', 'Preço de venda (€)', item.preco_venda || item.price || '', 'number') + '</div>' +
      _textarea('it-desc-venda', 'Descrição para venda', item.descricao_venda || item.shortDesc || '') +
      '</div>' +
      '</div>';
    var footer = '<button onclick="Modules.Compras._saveItem()" style="' + _primaryStyle() + '">' + (id ? 'Atualizar' : 'Adicionar') + '</button>';
    window._itemCompraModal = UI.modal({ title: id ? 'Editar Produto/Insumo' : 'Novo Produto/Insumo', body: body, footer: footer, maxWidth: '920px' });
    setTimeout(_toggleItemClasse, 20);
  }

  function _openInsumoModal(id) {
    _openItemModal(id);
    setTimeout(function () {
      var classe = document.getElementById('it-classe');
      if (classe) {
        classe.value = 'insumo';
        var wrap = classe.parentNode;
        while (wrap && wrap.tagName && wrap.tagName.toLowerCase() !== 'div') wrap = wrap.parentNode;
        if (wrap) wrap.style.display = 'none';
      }
      var modalTitle = document.querySelector('.ui-modal-close');
      var headings = document.querySelectorAll('h2');
      if (headings.length) headings[headings.length - 1].textContent = id ? 'Editar Insumo' : 'Novo Insumo';
      _toggleItemClasse();
    }, 30);
  }

  function _toggleItemClasse() {
    var classe = _el('it-classe').value || 'insumo';
    var ins = document.getElementById('it-insumo-fields');
    var prod = document.getElementById('it-produto-fields');
    if (ins) ins.style.display = classe === 'insumo' ? 'block' : 'none';
    if (prod) prod.style.display = classe === 'produto' ? 'block' : 'none';
  }

  function _onItemImgFileChange(event) {
    var file = event && event.target && event.target.files ? event.target.files[0] : null;
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type || '')) {
      UI.toast('Use uma imagem PNG, JPG ou WebP.', 'error');
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      window._itemCompraImageBase64 = reader.result || '';
      var img = document.getElementById('it-img-preview');
      var empty = document.getElementById('it-img-empty');
      if (img) {
        img.src = window._itemCompraImageBase64;
        img.style.display = '';
      }
      if (empty) empty.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  function _saveItem() {
    var nome = (_el('it-nome').value || '').trim();
    if (!nome) { UI.toast('Nome obrigatório', 'error'); return; }
    var classe = _el('it-classe').value || 'insumo';
    var data = {
      nome: nome,
      classe: classe,
      tipo: _el('it-tipo').value,
      categoria: _el('it-categoria').value,
      unidade_base: _el('it-unidade').value,
      fornecedor_padrao_id: _el('it-forn').value,
      ativo: _el('it-ativo').checked
    };
    if (classe === 'insumo') {
      data.aproveitamento_padrao = parseFloat(_el('it-aprov').value || '100') || 100;
      data.usar_em_fichas = _el('it-fichas').checked;
      data.venda_habilitada = false;
    } else {
      data.venda_habilitada = _el('it-venda').checked;
      data.preco_venda = parseFloat(_el('it-preco-venda').value || '0') || 0;
      data.preco_compra = parseFloat(_el('it-preco-compra').value || '0') || 0;
      data.descricao_venda = _el('it-desc-venda').value || '';
      data.imageUrl = _el('it-img').value || '';
      data.imageBase64 = window._itemCompraImageBase64 || '';
      data.usar_em_fichas = false;
      if (data.venda_habilitada && data.preco_venda <= 0) {
        UI.toast('Informe o preço de venda para alimentar o cardápio.', 'error');
        var price = document.getElementById('it-preco-venda');
        if (price) price.focus();
        return;
      }
    }
    var op = _editingId ? DB.update('itens_custo', _editingId, data) : DB.add('itens_custo', data);
    op.then(function (ref) {
      var id = _editingId || (ref && ref.id) || '';
      if (classe === 'produto') return _syncProdutoCatalogo(id, data);
      return null;
    }).then(function () {
      UI.toast('Cadastro salvo!', 'success');
      if (window._itemCompraModal) window._itemCompraModal.close();
      _renderItens();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _syncProdutoCatalogo(itemId, item) {
    if (!item.venda_habilitada) return null;
    var productData = {
      name: item.nome,
      price: item.preco_venda || 0,
      shortDesc: item.descricao_venda || '',
      description: item.descricao_venda || '',
      fullDesc: item.descricao_venda || '',
      imageUrl: item.imageUrl || '',
      imageBase64: item.imageBase64 || '',
      type: 'unico',
      productType: 'simple',
      unicoSource: 'compras_produto',
      produtoProntoId: itemId,
      sourceType: 'compras_produto',
      sourceItemId: itemId,
      menuVisible: true
    };
    return DB.getAll('products').then(function (products) {
      var existingItem = _byId(_itens, itemId) || {};
      var linkedId = existingItem.catalogProductId || '';
      var linkedProduct = (products || []).find(function (p) {
        return p.id === linkedId || p.sourceItemId === itemId || p.produtoProntoId === itemId;
      });
      if (linkedProduct && linkedProduct.id) {
        return DB.update('products', linkedProduct.id, productData)
          .then(function () { return DB.update('itens_custo', itemId, { catalogProductId: linkedProduct.id }); });
      }
      return DB.add('products', productData).then(function (ref) {
        return DB.update('itens_custo', itemId, { catalogProductId: ref && ref.id ? ref.id : '' });
      });
    });
  }

  function _deleteItem(id) {
    UI.confirm('Eliminar este cadastro?').then(function (yes) {
      if (!yes) return;
      DB.update('itens_custo', id, { ativo: false }).then(function () { UI.toast('Cadastro desativado', 'info'); _renderItens(); });
    });
  }

  // Fornecedores, unidades, tipos e categorias
  function _renderFornecedores() {
    DB.getAll('fornecedores').then(function (data) {
      _fornecedores = (data || []).sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
      var content = document.getElementById('compras-content');
      if (!content) return;
      content.innerHTML = _head('Fornecedores', '+ Adicionar fornecedor', 'Modules.Compras._openFornecedorModal(null)') +
        _basicTable(_fornecedores, ['Fornecedor', 'Contato', 'Fiscal', 'Pagamento', 'Status'], function (f) {
          var contato = [f.contact, f.whatsapp || f.phone, f.email].filter(Boolean).map(_esc).join('<br>');
          var fiscal = [f.nif ? 'NIF/CIF: ' + _esc(f.nif) : '', f.address ? _esc(f.address) : ''].filter(Boolean).join('<br>');
          var prazo = f.paymentDays || f.prazoPagamento || '';
          var pagamento = [_esc(f.defaultPaymentMethod || f.formaPagamentoPadrao || '-'), prazo ? _esc(prazo) + ' dia(s)' : ''].filter(Boolean).join('<br>');
          return [
            '<strong>' + _esc(f.name || '-') + '</strong>' + (f.categories ? '<div style="font-size:11px;color:#8A7E7C;">' + _esc(f.categories) + '</div>' : ''),
            contato || '-',
            fiscal || '-',
            pagamento || '-',
            f.ativo === false ? UI.badge('Inativo', 'gray') : UI.badge('Ativo', 'green')
          ];
        }, 'Modules.Compras._openFornecedorModal', 'Modules.Compras._deleteFornecedor', 'Modules.Compras._openFornecedorModal');
    });
  }

  function _openFornecedorModal(id) {
    _editingId = id;
    var f = id ? (_byId(_fornecedores, id) || {}) : { ativo: true };
    var selectedState = f.estado || f.state || '';
    var selectedCountry = f.pais || f.country || 'España';
    var states = ['Álava', 'Albacete', 'Alicante', 'Almería', 'Asturias', 'Ávila', 'Badajoz', 'Barcelona', 'Burgos', 'Cáceres', 'Cádiz', 'Cantabria', 'Castellón', 'Ciudad Real', 'Córdoba', 'A Coruña', 'Cuenca', 'Girona', 'Granada', 'Guadalajara', 'Gipuzkoa', 'Huelva', 'Huesca', 'Illes Balears', 'Jaén', 'León', 'Lleida', 'Lugo', 'Madrid', 'Málaga', 'Murcia', 'Navarra', 'Ourense', 'Palencia', 'Las Palmas', 'Pontevedra', 'La Rioja', 'Salamanca', 'Santa Cruz de Tenerife', 'Segovia', 'Sevilla', 'Soria', 'Tarragona', 'Teruel', 'Toledo', 'Valencia', 'Valladolid', 'Bizkaia', 'Zamora', 'Zaragoza', 'Ceuta', 'Melilla'];
    var countries = ['España', 'Portugal', 'Francia', 'Italia', 'Alemania', 'Bélgica', 'Países Bajos', 'Reino Unido', 'Otro'];
    var stateOpts = '<option value="">Selecionar...</option>' + states.map(function (s) { return '<option value="' + _esc(s) + '"' + (selectedState === s ? ' selected' : '') + '>' + _esc(s) + '</option>'; }).join('');
    var countryOpts = countries.map(function (c) { return '<option value="' + _esc(c) + '"' + (selectedCountry === c ? ' selected' : '') + '>' + _esc(c) + '</option>'; }).join('');
    var cardStyle = 'background:#fff;border:1px solid #EFE6E3;border-radius:18px;padding:18px;box-shadow:0 12px 32px rgba(58,35,30,.06);';
    var softCardStyle = 'background:linear-gradient(135deg,#fff 0%,#FBF7F6 100%);border:1px solid #EFE6E3;border-radius:18px;padding:18px;';
    var titleStyle = 'font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;';
    var hintStyle = 'font-size:12px;color:#8A7E7C;line-height:1.45;margin-bottom:14px;';
    var body = '<div style="display:grid;gap:16px;">' +
      '<div style="' + softCardStyle + '">' +
      '<div style="' + titleStyle + '">Dados do fornecedor</div>' +
      '<div style="' + hintStyle + '">Informações principais para compras, fiscal e geração de contas a pagar.</div>' +
      _field('fo-name', 'Nome *', f.name || '') +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
      _field('fo-contact', 'Pessoa de contato', f.contact || '') +
      '<div><label style="' + _labelStyle() + '">NIF / CIF</label><input id="fo-nif" value="' + _esc(f.nif || f.taxId || '') + '" placeholder="Ex: B12345678 ou 12345678Z" maxlength="12" style="' + _inputStyle() + '"><div style="font-size:11px;color:#8A7E7C;margin-top:5px;">Valida NIF, NIE ou CIF espanhol.</div></div>' +
      '</div>' +
      '</div>' +
      '<div style="' + cardStyle + '">' +
      '<div style="' + titleStyle + '">Endereço</div>' +
      '<div style="' + hintStyle + '">Localização usada para compras, suporte e identificação fiscal do fornecedor.</div>' +
      _field('fo-address', 'Endereço', f.address || '') +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">' +
      _field('fo-neighborhood', 'Bairro', f.bairro || f.neighborhood || '') +
      _select('fo-state', 'Estado / província', stateOpts) +
      _select('fo-country', 'País', countryOpts) +
      '</div>' +
      '</div>' +
      '<div style="' + cardStyle + '">' +
      '<div style="' + titleStyle + '">Contato</div>' +
      '<div style="' + hintStyle + '">Use formatos com DDI quando possível. Exemplo: +34 600 000 000.</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">' +
      '<div><label style="' + _labelStyle() + '">WhatsApp</label><input id="fo-whatsapp" value="' + _esc(f.whatsapp || '') + '" placeholder="+34 600 000 000" inputmode="tel" style="' + _inputStyle() + '"></div>' +
      '<div><label style="' + _labelStyle() + '">Telefone</label><input id="fo-phone" value="' + _esc(f.phone || '') + '" placeholder="+34 600 000 000" inputmode="tel" style="' + _inputStyle() + '"></div>' +
      '<div><label style="' + _labelStyle() + '">E-mail</label><input id="fo-email" type="email" value="' + _esc(f.email || '') + '" placeholder="fornecedor@email.com" style="' + _inputStyle() + '"></div>' +
      '</div></div>' +
      '<div style="' + cardStyle + '">' +
      '<div style="' + titleStyle + '">Compras e pagamento</div>' +
      '<div style="' + hintStyle + '">Padrões usados ao lançar uma compra e gerar contas a pagar.</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
      _select('fo-payment-method', 'Forma de pagamento padrão', _paymentOptions(f.defaultPaymentMethod || f.formaPagamentoPadrao)) +
      _field('fo-payment-days', 'Prazo padrão de pagamento (dias)', f.paymentDays || f.prazoPagamento || '', 'number') +
      '</div>' +
      _field('fo-categories', 'Categorias / itens fornecidos', f.categories || f.categorias || '') +
      '</div>' +
      '<div style="' + cardStyle + '">' +
      _textarea('fo-notes', 'Observações internas', f.notes || '') +
      '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:900;margin-top:12px;"><input id="fo-ativo" type="checkbox" ' + (f.ativo !== false ? 'checked' : '') + ' style="accent-color:#C4362A;width:17px;height:17px;"> Fornecedor ativo</label>' +
      '</div></div>';
    var footer = '<button onclick="Modules.Compras._saveFornecedor()" style="' + _primaryStyle() + '">' + (id ? 'Atualizar' : 'Adicionar') + '</button>';
    window._fornecedorCompraModal = UI.modal({ title: id ? 'Editar fornecedor' : 'Novo fornecedor', body: body, footer: footer, maxWidth: '900px' });
  }

  function _saveFornecedor() {
    var name = (_el('fo-name').value || '').trim();
    if (!name) { UI.toast('Nome obrigatório', 'error'); return; }
    var nif = (_el('fo-nif').value || '').trim().toUpperCase().replace(/\s|-/g, '');
    var whatsapp = (_el('fo-whatsapp').value || '').trim();
    var phone = (_el('fo-phone').value || '').trim();
    var email = (_el('fo-email').value || '').trim();
    var nifOk = !nif || /^([0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z]|[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J])$/.test(nif);
    var phoneOk = function (value) {
      if (!value) return true;
      var digits = value.replace(/\D/g, '');
      return digits.length >= 7 && digits.length <= 15 && /^[+0-9() .-]+$/.test(value);
    };
    var emailOk = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!nifOk) { UI.toast('NIF/CIF inválido. Use um NIF, NIE ou CIF espanhol válido.', 'error'); _el('fo-nif').focus(); return; }
    if (!phoneOk(whatsapp)) { UI.toast('WhatsApp inválido. Use apenas números, espaços e +.', 'error'); _el('fo-whatsapp').focus(); return; }
    if (!phoneOk(phone)) { UI.toast('Telefone inválido. Use apenas números, espaços e +.', 'error'); _el('fo-phone').focus(); return; }
    if (!emailOk) { UI.toast('E-mail inválido.', 'error'); _el('fo-email').focus(); return; }
    var data = {
      name: name,
      contact: _el('fo-contact').value,
      whatsapp: whatsapp,
      phone: phone,
      email: email,
      nif: nif,
      address: _el('fo-address').value,
      bairro: _el('fo-neighborhood').value,
      neighborhood: _el('fo-neighborhood').value,
      estado: _el('fo-state').value,
      state: _el('fo-state').value,
      pais: _el('fo-country').value,
      country: _el('fo-country').value,
      defaultPaymentMethod: _el('fo-payment-method').value,
      paymentDays: parseInt(_el('fo-payment-days').value || '0', 10) || 0,
      categories: _el('fo-categories').value,
      notes: _el('fo-notes').value,
      ativo: _el('fo-ativo').checked
    };
    var op = _editingId ? DB.update('fornecedores', _editingId, data) : DB.add('fornecedores', data);
    op.then(function () { UI.toast('Fornecedor salvo!', 'success'); if (window._fornecedorCompraModal) window._fornecedorCompraModal.close(); _renderFornecedores(); });
  }

  function _deleteFornecedor(id) {
    UI.confirm('Eliminar este fornecedor?').then(function (yes) { if (yes) DB.remove('fornecedores', id).then(_renderFornecedores); });
  }

  function _renderUnidades() {
    DB.getAll('unidades_medida').then(function (data) {
      _unidades = (data || []).sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
      var content = document.getElementById('compras-content');
      if (!content) return;
      content.innerHTML = _head('Unidades de medida', '+ Adicionar unidade', 'Modules.Compras._openUnidadeModal(null)') +
        _basicTable(_unidades, ['Nome', 'Símbolo', 'Tipo'], function (u) { return [_esc(u.name || '-'), _esc(u.symbol || '-'), _esc(u.type || '-')]; }, 'Modules.Compras._openUnidadeModal', 'Modules.Compras._deleteUnidade');
    });
  }

  function _openUnidadeModal(id) {
    _editingId = id;
    var u = id ? (_byId(_unidades, id) || {}) : { type: 'unidade' };
    var body = '<div>' + _field('un-name', 'Nome *', u.name || '') +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' + _field('un-symbol', 'Símbolo *', u.symbol || '') +
      _select('un-type', 'Tipo', '<option value="massa"' + (u.type === 'massa' ? ' selected' : '') + '>Massa</option><option value="volume"' + (u.type === 'volume' ? ' selected' : '') + '>Volume</option><option value="unidade"' + (u.type === 'unidade' ? ' selected' : '') + '>Unidade</option>') + '</div></div>';
    var footer = '<button onclick="Modules.Compras._saveUnidade()" style="' + _primaryStyle() + '">' + (id ? 'Atualizar' : 'Adicionar') + '</button>';
    window._unidadeCompraModal = UI.modal({ title: id ? 'Editar unidade' : 'Nova unidade', body: body, footer: footer });
  }

  function _saveUnidade() {
    var name = (_el('un-name').value || '').trim();
    var symbol = (_el('un-symbol').value || '').trim();
    if (!name || !symbol) { UI.toast('Nome e símbolo são obrigatórios', 'error'); return; }
    var data = { name: name, symbol: symbol, type: _el('un-type').value || 'unidade' };
    var op = _editingId ? DB.update('unidades_medida', _editingId, data) : DB.add('unidades_medida', data);
    op.then(function () { UI.toast('Unidade salva!', 'success'); if (window._unidadeCompraModal) window._unidadeCompraModal.close(); _renderUnidades(); });
  }

  function _deleteUnidade(id) {
    UI.confirm('Eliminar esta unidade?').then(function (yes) { if (yes) DB.remove('unidades_medida', id).then(_renderUnidades); });
  }

  function _renderSimpleList(kind) {
    _editingKind = kind;
    var col = kind === 'tipos' ? 'compras_tipos' : 'compras_categorias';
    DB.getAll(col).then(function (data) {
      if (kind === 'tipos') _tipos = data || [];
      else _categorias = data || [];
      var list = kind === 'tipos' ? _tipos : _categorias;
      list = list.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
      var content = document.getElementById('compras-content');
      if (!content) return;
      content.innerHTML = _head(kind === 'tipos' ? 'Tipos' : 'Categorias', '+ Adicionar', 'Modules.Compras._openSimpleModal(null)') +
        _basicTable(list, ['Nome', 'Ativo'], function (x) { return [_esc(x.name || '-'), x.ativo === false ? 'Não' : 'Sim']; }, 'Modules.Compras._openSimpleModal', 'Modules.Compras._deleteSimple');
    });
  }

  function _openSimpleModal(id) {
    _editingId = id;
    var list = _editingKind === 'tipos' ? _tipos : _categorias;
    var item = id ? (_byId(list, id) || {}) : { ativo: true };
    var body = '<div>' + _field('sl-name', 'Nome *', item.name || '') +
      '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;"><input id="sl-ativo" type="checkbox" ' + (item.ativo !== false ? 'checked' : '') + ' style="accent-color:#C4362A;width:16px;height:16px;"> Ativo</label></div>';
    var footer = '<button onclick="Modules.Compras._saveSimple()" style="' + _primaryStyle() + '">Salvar</button>';
    window._simpleCompraModal = UI.modal({ title: _editingId ? 'Editar' : 'Adicionar', body: body, footer: footer });
  }

  function _saveSimple() {
    var name = (_el('sl-name').value || '').trim();
    if (!name) { UI.toast('Nome obrigatório', 'error'); return; }
    var col = _editingKind === 'tipos' ? 'compras_tipos' : 'compras_categorias';
    var op = _editingId ? DB.update(col, _editingId, { name: name, ativo: _el('sl-ativo').checked }) : DB.add(col, { name: name, ativo: _el('sl-ativo').checked });
    op.then(function () { UI.toast('Salvo!', 'success'); if (window._simpleCompraModal) window._simpleCompraModal.close(); _renderSimpleList(_editingKind); });
  }

  function _deleteSimple(id) {
    var col = _editingKind === 'tipos' ? 'compras_tipos' : 'compras_categorias';
    UI.confirm('Eliminar este registro?').then(function (yes) { if (yes) DB.remove(col, id).then(function () { _renderSimpleList(_editingKind); }); });
  }

  // Helpers
  function _head(title, label, action) {
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;"><h2 style="font-size:22px;font-weight:900;">' + title + '</h2><button onclick="' + action + '" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">' + label + '</button></div>';
  }
  function _kpi(label, value) { return '<div class="kpi-tile"><span>' + label + '</span><strong>' + value + '</strong></div>'; }
  function _thead(cols) { return '<thead><tr style="background:#F2EDED;">' + cols.map(function (h) { return '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:800;color:#8A7E7C;text-transform:uppercase;white-space:nowrap;">' + h + '</th>'; }).join('') + '</tr></thead>'; }
  function _td(html, strong) { return '<td style="padding:11px 14px;font-size:13px;' + (strong ? 'font-weight:800;' : '') + '">' + html + '</td>'; }
  function _basicTable(data, headers, rowFn, editFn, delFn, rowClickFn) {
    return '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);">' + _thead(headers.concat([''])) +
      '<tbody>' + (data.length ? data.map(function (x) {
        var rowAttrs = rowClickFn ? ' onclick="' + rowClickFn + '(\'' + x.id + '\')" style="border-top:1px solid #F2EDED;cursor:pointer;"' : ' style="border-top:1px solid #F2EDED;"';
        return '<tr' + rowAttrs + '>' + rowFn(x).map(function (v, i) { return _td(v, i === 0); }).join('') +
          '<td style="padding:10px;text-align:right;white-space:nowrap;"><button onclick="event.stopPropagation();' + editFn + '(\'' + x.id + '\')" style="' + _iconBtn('#EEF4FF', '#2563EB') + '"><span class="mi" style="font-size:15px;">edit</span></button> ' +
          '<button onclick="event.stopPropagation();' + delFn + '(\'' + x.id + '\')" style="' + _iconBtn('#FFF0EE', '#C4362A') + '"><span class="mi" style="font-size:15px;">delete</span></button></td></tr>';
      }).join('') : '<tr><td colspan="' + (headers.length + 1) + '" style="padding:38px;text-align:center;color:#8A7E7C;">Nenhum registro.</td></tr>') + '</tbody></table></div>';
  }
  function _field(id, label, value, type, oninput) {
    return '<div><label style="' + _labelStyle() + '">' + label + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + _esc(value == null ? '' : value) + '"' + (oninput ? ' oninput="' + oninput + '"' : '') + ' style="' + _inputStyle() + '"></div>';
  }
  function _textarea(id, label, value) {
    return '<div><label style="' + _labelStyle() + '">' + label + '</label><textarea id="' + id + '" style="' + _inputStyle() + 'min-height:74px;resize:vertical;">' + _esc(value || '') + '</textarea></div>';
  }
  function _select(id, label, options, onchange) {
    return '<div><label style="' + _labelStyle() + '">' + label + '</label><select id="' + id + '"' + (onchange ? ' onchange="' + onchange + '"' : '') + ' style="' + _inputStyle() + 'background:#fff;">' + options + '</select></div>';
  }
  function _inputStyle() { return 'width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;'; }
  function _labelStyle() { return 'font-size:11px;font-weight:800;color:#8A7E7C;display:block;margin-bottom:4px;text-transform:uppercase;'; }
  function _primaryStyle() { return 'width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;'; }
  function _iconBtn(bg, color) { return 'width:30px;height:30px;border-radius:8px;border:none;background:' + bg + ';color:' + color + ';cursor:pointer;display:inline-flex;align-items:center;justify-content:center;'; }
  function _options(list, selected, labelKey, empty) {
    return '<option value="">' + _esc(empty || '-') + '</option>' + (list || []).map(function (x) { return '<option value="' + x.id + '"' + (selected === x.id ? ' selected' : '') + '>' + _esc(x[labelKey] || x.name || x.nome || '-') + '</option>'; }).join('');
  }
  function _namedOptions(list, selected, fallback) {
    var arr = (list || []).length ? list.filter(function (x) { return x.ativo !== false; }).map(function (x) { return x.name; }) : fallback;
    return arr.map(function (name) { return '<option value="' + _esc(name) + '"' + (selected === name ? ' selected' : '') + '>' + _esc(name) + '</option>'; }).join('');
  }
  function _lineTotal(l) {
    if (!l) return 0;
    if (l.totalLinha !== undefined && l.totalLinha !== null && l.totalLinha !== '') return _num(l.totalLinha);
    if (l.total !== undefined && l.total !== null && l.total !== '') return _num(l.total);
    return _num(l.precoPago);
  }
  function _num(v) { return parseFloat(String(v == null ? '' : v).replace(',', '.')) || 0; }
  function _byId(arr, id) { return (arr || []).find(function (x) { return x.id === id; }); }
  function _el(id) { return document.getElementById(id) || { value: '', checked: false, innerHTML: '' }; }
  function _esc(str) { return String(str == null ? '' : str).replace(/[&<>"']/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]; }); }

  return {
    render: render, _switchSub: _switchSub,
    _openCompraModal: _openCompraModal, _saveCompra: _saveCompra, _deleteCompra: _deleteCompra,
    _onCompraItemChange: _onCompraItemChange, _calcCompraLinha: _calcCompraLinha, _addCompraLinha: _addCompraLinha, _removeCompraLinha: _removeCompraLinha,
    _filterRegistros: _filterRegistros,
    _openItemModal: _openItemModal, _openInsumoModal: _openInsumoModal, _saveItem: _saveItem, _deleteItem: _deleteItem, _toggleItemClasse: _toggleItemClasse, _onItemImgFileChange: _onItemImgFileChange, _filterItens: _filterItens, _renderInsumos: _renderInsumos,
    _openFornecedorModal: _openFornecedorModal, _saveFornecedor: _saveFornecedor, _deleteFornecedor: _deleteFornecedor,
    _openUnidadeModal: _openUnidadeModal, _saveUnidade: _saveUnidade, _deleteUnidade: _deleteUnidade,
    _openSimpleModal: _openSimpleModal, _saveSimple: _saveSimple, _deleteSimple: _deleteSimple, _renderUnidades: _renderUnidades, _renderSimpleList: _renderSimpleList
  };
})();
