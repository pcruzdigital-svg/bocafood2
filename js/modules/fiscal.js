// js/modules/fiscal.js
window.Modules = window.Modules || {};
Modules.Fiscal = (function () {
  'use strict';

  var _activeSub = 'configuracoes';
  var _data = {};

  var TABS = [
    { key: 'configuracoes', label: 'Configurações fiscais' },
    { key: 'iva', label: 'IVA' },
    { key: 'irpf', label: 'IRPF' },
    { key: 'compras', label: 'Compras dedutíveis' },
    { key: 'resumo', label: 'Resumo trimestral' }
  ];

  var FISCAL_CATEGORIES = [
    ['insumo', 'Insumo'],
    ['embalagem', 'Embalagem'],
    ['produto_pronto', 'Produto pronto'],
    ['despesa_operacional', 'Despesa operacional'],
    ['equipamento_investimento', 'Equipamento/investimento'],
    ['servico', 'Serviço'],
    ['outro', 'Outro']
  ];

  function render(sub) {
    _activeSub = sub || 'configuracoes';
    var app = document.getElementById('app');
    app.innerHTML = '<section class="module-page">' +
      '<div class="module-head"><div><h1>Fiscal</h1><p>IVA, IRPF, compras dedutíveis e resumo trimestral para autónomos na Espanha.</p></div></div>' +
      '<div id="fiscal-tabs" class="module-tabs"></div>' +
      '<div id="fiscal-content" class="module-content"><div class="loading-inline">Carregando...</div></div>' +
      '</section>';
    _renderTabs();
    _load().then(_renderSub).catch(function (err) {
      console.error('Fiscal load error', err);
      _content('<div style="padding:24px;background:#fff;border-radius:12px;color:#C4362A;">Erro ao carregar dados fiscais: ' + _esc(err.message || err) + '</div>');
    });
  }

  function _renderTabs() {
    var el = document.getElementById('fiscal-tabs');
    if (!el) return;
    el.innerHTML = TABS.map(function (t) {
      return '<button class="' + (t.key === _activeSub ? 'active' : '') + '" onclick="Modules.Fiscal._switchSub(\'' + t.key + '\')">' + t.label + '</button>';
    }).join('');
  }

  function _switchSub(key) {
    _activeSub = key;
    _renderTabs();
    _renderSub();
    Router.navigate('fiscal/' + key);
  }

  function _load() {
    return Promise.all([
      DB.getDocRoot('config', 'fiscal'),
      DB.getAll('orders'),
      DB.getAll('financeiro_entradas'),
      DB.getAll('compras'),
      DB.getAll('financeiro_saidas'),
      DB.getAll('financeiro_apagar'),
      DB.getAll('fornecedores')
    ]).then(function (r) {
      _data = {
        config: _normalizeConfig(r[0] || {}),
        orders: r[1] || [],
        entradas: r[2] || [],
        compras: r[3] || [],
        saidas: r[4] || [],
        apagar: r[5] || [],
        fornecedores: r[6] || []
      };
    });
  }

  function _normalizeConfig(c) {
    return Object.assign({
      ivaPadrao: 21,
      irpfPadrao: 15,
      trimestreAtual: _currentQuarterKey(),
      usarCalculoFiscal: true
    }, c || {});
  }

  function _renderSub() {
    if (_activeSub === 'configuracoes') return _renderConfig();
    if (_activeSub === 'iva') return _renderIva();
    if (_activeSub === 'irpf') return _renderIrpf();
    if (_activeSub === 'compras') return _renderCompras();
    if (_activeSub === 'resumo') return _renderResumo();
  }

  function _renderConfig() {
    var c = _data.config;
    _content('<div style="max-width:880px;background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
      '<h2 style="font-size:20px;font-weight:900;margin-bottom:14px;">Configurações fiscais</h2>' +
      '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:14px;">' +
      _field('fis-iva', 'IVA padrão (%)', c.ivaPadrao, 'number') +
      _field('fis-irpf', 'IRPF estimado padrão (%)', c.irpfPadrao, 'number') +
      _select('fis-quarter', 'Trimestre atual', _quarterOptions(c.trimestreAtual)) +
      _select('fis-enabled', 'Usar cálculo fiscal no sistema', '<option value="sim"' + (c.usarCalculoFiscal !== false ? ' selected' : '') + '>Sim</option><option value="nao"' + (c.usarCalculoFiscal === false ? ' selected' : '') + '>Não</option>') +
      '</div>' +
      '<div style="padding:12px;border-radius:10px;background:#FFF8F1;border:1px solid #F1D6C8;color:#8A4A18;font-size:13px;font-weight:700;margin-bottom:16px;">Cálculo estimado. Não substitui contador/gestor fiscal.</div>' +
      '<button onclick="Modules.Fiscal._saveConfig()" style="' + _primaryStyle() + '">Salvar configurações fiscais</button>' +
      '</div>');
  }

  function _saveConfig() {
    var data = {
      ivaPadrao: _num(_val('fis-iva')),
      irpfPadrao: _num(_val('fis-irpf')),
      trimestreAtual: _val('fis-quarter') || _currentQuarterKey(),
      usarCalculoFiscal: _val('fis-enabled') !== 'nao'
    };
    DB.setDocRoot('config', 'fiscal', data).then(function () {
      UI.toast('Configurações fiscais salvas.', 'success');
      _data.config = _normalizeConfig(data);
      _renderSub();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _renderIva() {
    var calc = _calcFiscal();
    var resultLabel = calc.ivaResultado >= 0 ? 'IVA a pagar' : 'IVA a compensar';
    _content('<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-bottom:18px;">' +
      _kpi('IVA das vendas', UI.fmt(calc.ivaVendas), 'estimado no trimestre') +
      _kpi('IVA compras dedutível', UI.fmt(calc.ivaComprasDedutivel), 'compras marcadas') +
      _kpi(resultLabel, UI.fmt(Math.abs(calc.ivaResultado)), calc.ivaResultado >= 0 ? 'resultado positivo' : 'crédito estimado') +
      _kpi('IVA aplicado', (_data.config.ivaPadrao || 0) + '%', 'configuração fiscal') +
      '</div>' + _notice() + _salesAndPurchasesHint());
  }

  function _renderIrpf() {
    var calc = _calcFiscal();
    _content('<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-bottom:18px;">' +
      _kpi('Receita sem IVA', UI.fmt(calc.receitaSemIVA), 'vendas do trimestre') +
      _kpi('Gastos dedutíveis', UI.fmt(calc.gastosDedutiveis), 'IRPF sem IVA') +
      _kpi('Lucro fiscal', UI.fmt(calc.lucroFiscal), 'base estimada') +
      _kpi('IRPF estimado', UI.fmt(calc.irpfEstimado), (_data.config.irpfPadrao || 0) + '% sobre lucro positivo') +
      '</div>' + _notice());
  }

  function _renderResumo() {
    var calc = _calcFiscal();
    var ivaLabel = calc.ivaResultado >= 0 ? 'IVA a pagar' : 'IVA a compensar';
    _content('<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-bottom:18px;">' +
      _kpi('Trimestre', _esc(_data.config.trimestreAtual), 'período ativo') +
      _kpi(ivaLabel, UI.fmt(Math.abs(calc.ivaResultado)), 'IVA estimado') +
      _kpi('IRPF estimado', UI.fmt(calc.irpfEstimado), 'lucro fiscal') +
      _kpi('Compras dedutíveis', calc.comprasDedutiveis.length, 'marcadas para IVA/IRPF') +
      '</div>' +
      '<div style="background:#fff;border-radius:14px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
      '<h2 style="font-size:18px;font-weight:900;margin-bottom:12px;">Resumo trimestral</h2>' +
      _summaryLine('Vendas brutas estimadas', calc.vendasBrutas) +
      _summaryLine('IVA das vendas', calc.ivaVendas) +
      _summaryLine('IVA compras dedutível', calc.ivaComprasDedutivel) +
      _summaryLine('Receita sem IVA', calc.receitaSemIVA) +
      _summaryLine('Gastos dedutíveis IRPF', calc.gastosDedutiveis) +
      _summaryLine('Lucro fiscal estimado', calc.lucroFiscal) +
      '</div>');
  }

  function _renderCompras() {
    var rows = _quarterItems(_data.compras, _itemDate).sort(function (a, b) { return String(_itemDate(b)).localeCompare(String(_itemDate(a))); });
    _content('<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap;">' +
      '<h2 style="font-size:20px;font-weight:900;">Compras dedutíveis</h2>' +
      '<input id="fis-compra-search" oninput="Modules.Fiscal._filterCompras()" placeholder="Pesquisar compra, fornecedor ou documento..." style="min-width:260px;flex:1;max-width:520px;padding:11px 14px;border:1.5px solid #D4C8C6;border-radius:20px;font-size:13px;outline:none;">' +
      '</div><div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);min-width:980px;">' +
      _thead(['Compra', 'Fornecedor', 'Total', 'IVA', 'IRPF', 'Categoria fiscal', '']) +
      '<tbody id="fis-compras-body">' + _compraRows(rows) + '</tbody></table></div>');
  }

  function _compraRows(rows) {
    if (!rows.length) return '<tr><td colspan="7" style="padding:36px;text-align:center;color:#8A7E7C;">Nenhuma compra neste trimestre.</td></tr>';
    return rows.map(function (c) {
      var search = [_itemDate(c), c.numDocumento, _supplierName(c.fornecedorId), c.total, c.categoriaFiscal].join(' ').toLowerCase();
      return '<tr data-fis-compra="' + _esc(search) + '" style="border-top:1px solid #F2EDED;">' +
        _td('<strong>' + _esc(c.numDocumento || c.id || 'Compra') + '</strong><div style="font-size:11px;color:#8A7E7C;">' + _esc(_fmtDate(_itemDate(c))) + '</div>') +
        _td(_esc(_supplierName(c.fornecedorId) || '-')) +
        _td('<strong>' + UI.fmt(_itemValue(c)) + '</strong>') +
        _td('<input id="fis-iva-' + _esc(c.id) + '" type="checkbox" ' + (_isVatDeductible(c) ? 'checked' : '') + ' style="accent-color:#C4362A;width:16px;height:16px;">') +
        _td('<input id="fis-irpf-' + _esc(c.id) + '" type="checkbox" ' + (_isIrpfDeductible(c) ? 'checked' : '') + ' style="accent-color:#C4362A;width:16px;height:16px;">') +
        _td('<select id="fis-cat-' + _esc(c.id) + '" style="' + _inputStyle() + 'background:#fff;">' + _fiscalCategoryOptions(c.categoriaFiscal || c.fiscalCategory || 'outro') + '</select>') +
        '<td style="padding:10px;text-align:right;"><button onclick="Modules.Fiscal._saveCompraFiscal(\'' + _esc(c.id) + '\')" style="background:#C4362A;color:#fff;border:none;border-radius:9px;padding:9px 12px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">Salvar</button></td>' +
        '</tr>';
    }).join('');
  }

  function _saveCompraFiscal(id) {
    var data = {
      dedutivelIva: _checked('fis-iva-' + id),
      dedutivelIrpf: _checked('fis-irpf-' + id),
      categoriaFiscal: _val('fis-cat-' + id) || 'outro'
    };
    DB.update('compras', id, data).then(function () {
      UI.toast('Compra fiscal atualizada.', 'success');
      var c = (_data.compras || []).find(function (x) { return String(x.id) === String(id); });
      if (c) Object.assign(c, data);
      _renderSub();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _filterCompras() {
    var q = (_val('fis-compra-search') || '').toLowerCase();
    document.querySelectorAll('[data-fis-compra]').forEach(function (row) {
      row.style.display = !q || (row.dataset.fisCompra || '').indexOf(q) >= 0 ? '' : 'none';
    });
  }

  function _calcFiscal() {
    var ivaPct = _num(_data.config.ivaPadrao);
    var irpfPct = _num(_data.config.irpfPadrao);
    var sales = _salesInQuarter();
    var compras = _quarterItems(_data.compras, _itemDate);
    var expenses = _quarterItems((_data.saidas || []).concat(_data.apagar || []), _itemDate);
    var vendasBrutas = sales.reduce(function (s, x) { return s + _itemValue(x); }, 0);
    var ivaVendas = sales.reduce(function (s, x) { return s + _ivaFromGross(_itemValue(x), _num(x.ivaPct || x.iva || ivaPct)); }, 0);
    var comprasDedutiveis = compras.filter(_isAnyDeductible);
    var ivaComprasDedutivel = compras.filter(_isVatDeductible).reduce(function (s, x) {
      return s + _ivaFromGross(_itemValue(x), _num(x.ivaPct || x.iva || ivaPct));
    }, 0);
    var receitaSemIVA = sales.reduce(function (s, x) { return s + _netFromGross(_itemValue(x), _num(x.ivaPct || x.iva || ivaPct)); }, 0);
    var gastosCompras = compras.filter(_isIrpfDeductible).reduce(function (s, x) {
      return s + _netFromGross(_itemValue(x), _num(x.ivaPct || x.iva || ivaPct));
    }, 0);
    var gastosDespesas = expenses.filter(_isIrpfDeductible).reduce(function (s, x) {
      return s + _netFromGross(_itemValue(x), _num(x.ivaPct || x.iva || ivaPct));
    }, 0);
    var gastosDedutiveis = gastosCompras + gastosDespesas;
    var lucroFiscal = receitaSemIVA - gastosDedutiveis;
    return {
      vendasBrutas: vendasBrutas,
      ivaVendas: ivaVendas,
      ivaComprasDedutivel: ivaComprasDedutivel,
      ivaResultado: ivaVendas - ivaComprasDedutivel,
      receitaSemIVA: receitaSemIVA,
      gastosDedutiveis: gastosDedutiveis,
      lucroFiscal: lucroFiscal,
      irpfEstimado: Math.max(0, lucroFiscal) * irpfPct / 100,
      comprasDedutiveis: comprasDedutiveis
    };
  }

  function _salesInQuarter() {
    var orders = (_data.orders || []).filter(function (o) {
      var st = String(o.status || '').toLowerCase();
      return st !== 'cancelado' && st !== 'canceled' && st !== 'cancelled';
    });
    var entries = _data.entradas || [];
    return _quarterItems(orders.concat(entries), _itemDate);
  }

  function _quarterItems(list, dateFn) {
    var range = _quarterRange(_data.config.trimestreAtual);
    return (list || []).filter(function (x) {
      var raw = dateFn(x);
      if (!raw) return false;
      var d = _toDate(raw);
      return d && d >= range.start && d <= range.end;
    });
  }

  function _quarterRange(key) {
    var parts = String(key || _currentQuarterKey()).split('-T');
    var year = parseInt(parts[0], 10) || new Date().getFullYear();
    var q = Math.min(Math.max(parseInt(parts[1], 10) || 1, 1), 4);
    var start = new Date(year, (q - 1) * 3, 1);
    var end = new Date(year, q * 3, 0, 23, 59, 59, 999);
    return { start: start, end: end };
  }

  function _currentQuarterKey() {
    var d = new Date();
    return d.getFullYear() + '-T' + (Math.floor(d.getMonth() / 3) + 1);
  }

  function _quarterOptions(selected) {
    var now = new Date();
    var year = now.getFullYear();
    var opts = [];
    [year - 1, year, year + 1].forEach(function (y) {
      for (var q = 1; q <= 4; q++) opts.push(y + '-T' + q);
    });
    return opts.map(function (key) {
      return '<option value="' + key + '"' + (selected === key ? ' selected' : '') + '>' + key.replace('-T', ' / T') + '</option>';
    }).join('');
  }

  function _fiscalCategoryOptions(selected) {
    return FISCAL_CATEGORIES.map(function (p) {
      return '<option value="' + p[0] + '"' + (selected === p[0] ? ' selected' : '') + '>' + p[1] + '</option>';
    }).join('');
  }

  function _isVatDeductible(x) { return x.dedutivelIva === true || x.deductibleVat === true; }
  function _isIrpfDeductible(x) { return x.dedutivelIrpf === true || x.deductibleIrpf === true; }
  function _isAnyDeductible(x) { return _isVatDeductible(x) || _isIrpfDeductible(x); }
  function _ivaFromGross(gross, pct) { pct = _num(pct); return pct > 0 ? _num(gross) - (_num(gross) / (1 + pct / 100)) : 0; }
  function _netFromGross(gross, pct) { pct = _num(pct); return pct > 0 ? _num(gross) / (1 + pct / 100) : _num(gross); }
  function _itemValue(x) { return _num(x.total || x.valor || x.amount || x.totalAmount || x.grandTotal || x.price || 0); }
  function _itemDate(x) { return x.data || x.date || x.createdAt || x.paidAt || x.dueDate || x.updatedAt || ''; }
  function _supplierName(id) { var f = (_data.fornecedores || []).find(function (x) { return String(x.id) === String(id); }); return f ? (f.name || f.nome || '') : ''; }
  function _toDate(raw) {
    if (!raw) return null;
    if (raw && typeof raw.toDate === 'function') return raw.toDate();
    var d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  function _fmtDate(raw) { var d = _toDate(raw); return d ? UI.fmtDate(d) : '-'; }
  function _notice() { return '<div style="padding:12px;border-radius:10px;background:#FFF8F1;border:1px solid #F1D6C8;color:#8A4A18;font-size:13px;font-weight:700;">Cálculo estimado. Não substitui contador/gestor fiscal.</div>'; }
  function _salesAndPurchasesHint() { return '<div style="margin-top:14px;color:#8A7E7C;font-size:13px;">As compras entram no IVA dedutível apenas quando marcadas como dedutíveis para IVA.</div>'; }
  function _summaryLine(label, value) { return '<div style="display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #F2EDED;"><span>' + _esc(label) + '</span><strong>' + UI.fmt(value) + '</strong></div>'; }
  function _kpi(label, value, sub) { return '<div class="kpi-tile"><span>' + label + '</span><strong>' + value + '</strong><small>' + _esc(sub || '') + '</small></div>'; }
  function _thead(cols) { return '<thead><tr style="background:#F2EDED;">' + cols.map(function (h) { return '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:800;color:#8A7E7C;text-transform:uppercase;white-space:nowrap;">' + h + '</th>'; }).join('') + '</tr></thead>'; }
  function _td(html) { return '<td style="padding:11px 14px;font-size:13px;">' + html + '</td>'; }
  function _field(id, label, value, type) { return '<div><label style="' + _labelStyle() + '">' + label + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + _esc(value == null ? '' : value) + '" style="' + _inputStyle() + '"></div>'; }
  function _select(id, label, options) { return '<div><label style="' + _labelStyle() + '">' + label + '</label><select id="' + id + '" style="' + _inputStyle() + 'background:#fff;">' + options + '</select></div>'; }
  function _content(html) { var el = document.getElementById('fiscal-content'); if (el) el.innerHTML = html; }
  function _inputStyle() { return 'width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;'; }
  function _labelStyle() { return 'font-size:11px;font-weight:800;color:#8A7E7C;display:block;margin-bottom:4px;text-transform:uppercase;'; }
  function _primaryStyle() { return 'padding:13px 18px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;'; }
  function _num(v) { return parseFloat(String(v == null ? '' : v).replace(',', '.')) || 0; }
  function _val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function _checked(id) { var el = document.getElementById(id); return !!(el && el.checked); }
  function _esc(str) { return String(str == null ? '' : str).replace(/[&<>"']/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]; }); }

  return {
    render: render,
    _switchSub: _switchSub,
    _saveConfig: _saveConfig,
    _saveCompraFiscal: _saveCompraFiscal,
    _filterCompras: _filterCompras
  };
})();
