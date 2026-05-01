// js/modules/plano_voo.js
window.Modules = window.Modules || {};
Modules.PlanoDeVoo = (function () {
  'use strict';

  var _activeSub = 'simulacao';
  var _loading = false;
  var MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  var _data = {
    orders: [],
    products: [],
    movements: [],
    saidas: [],
    apagar: [],
    categorias: [],
    contas: [],
    geral: {},
    dinheiro: {},
    financeiro: {},
    custos: {},
    canais: [],
    snapshots: [],
    monthScenario: null
  };

  var _state = _defaultState();

  var TABS = [
    { key: 'simulacao', label: 'Simulação' },
    { key: 'comparacao', label: 'Previsto vs Real' },
    { key: 'snapshots', label: 'Previsões salvas' }
  ];

  var SCENARIOS = {
    survival: { label: 'Sobrevivência', factor: 0.90, tone: '#D97706', bg: '#FFF7ED' },
    equilibrium: { label: 'Equilíbrio', factor: 1.00, tone: '#2563EB', bg: '#EEF4FF' },
    growth: { label: 'Crescimento', factor: 1.15, bg: '#EDFAF3', tone: '#1A9E5A' },
    expansion: { label: 'Expansão', factor: 1.30, bg: '#FFF0EE', tone: '#C4362A' }
  };

  function _defaultState() {
    return {
      periodType: 'monthly',
      mode: 'automatico',
      scenario: 'equilibrium',
      growthSource: 'historical',
      declineSource: 'historical',
      historyMonths: 3,
      annualMode: 'linear_growth',
      growthPct: 10,
      declinePct: 5,
      seasonality: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
      channelValues: {},
      channelMode: {},
      channelInclude: {},
      costMode: {},
      costPct: {},
      costInclude: {},
      fixedInclude: {},
      snapshotMonthKey: _currentMonthKey(),
      snapshotMonthLabel: _currentMonthLabel(),
      snapshotName: '',
      compareSnapshotId: '',
      currentTargetProfit: 500
    };
  }

  function render(sub) {
    _activeSub = sub || 'simulacao';
    var app = document.getElementById('app');
    app.innerHTML = '' +
      '<div class="module-page">' +
        '<div class="module-head">' +
          '<div>' +
            '<h1>Plano de Voo</h1>' +
            '<p>Simule cenários, projete resultados e acompanhe previsto vs real sem misturar previsões com compromissos.</p>' +
          '</div>' +
          '<button onclick="Modules.PlanoDeVoo._openSaveSnapshotModal()" class="primary-action" style="width:auto;min-width:160px;">Salvar previsão</button>' +
        '</div>' +
        '<div id="pv-tabs" class="module-tabs"></div>' +
        '<div id="pv-content" class="module-content"><div class="loading-inline">Carregando...</div></div>' +
      '</div>';

    _renderTabs();
    _ensureStateDefaults();
    _paintActive();
    _load().then(function () {
      _ensureStateDefaults();
      _paintActive();
    }).catch(function (err) {
      console.error('Plano de Voo load error', err);
      _paintError(err);
    });
  }

  function _renderTabs() {
    var el = document.getElementById('pv-tabs');
    if (!el) return;
    el.innerHTML = TABS.map(function (t) {
      return '<button class="' + (t.key === _activeSub ? 'active' : '') + '" onclick="Modules.PlanoDeVoo._switchSub(\'' + t.key + '\')">' + t.label + '</button>';
    }).join('');
  }

  function _switchSub(key) {
    _activeSub = key;
    _renderTabs();
    _paintActive();
    Router.navigate('plano-de-voo/' + key);
  }

  function _paint() {
    var content = document.getElementById('pv-content');
    if (!content) return;
    if (_loading) {
      content.innerHTML = '<div class="loading-inline">Carregando...</div>';
      return;
    }

    if (_activeSub === 'simulacao') {
      _paintSimulacao();
      return;
    }
    if (_activeSub === 'comparacao') {
      _paintComparacao();
      return;
    }
    if (_activeSub === 'snapshots') {
      _paintSnapshots();
      return;
    }
  }

  function _paintError(err) {
    var content = document.getElementById('pv-content');
    if (!content) return;
    content.innerHTML = _safeHtml('<div style="padding:24px;background:#fff;border-radius:14px;color:#C4362A;box-shadow:0 2px 12px rgba(0,0,0,.08);">Erro ao carregar o módulo: ' + _esc((err && err.message) || err || 'desconhecido') + '</div>');
  }

  function _load() {
    _loading = true;
    return Promise.all([
      _safeAll('orders'),
      _safeAll('products'),
      _safeAll('movimentacoes'),
      _safeAll('financeiro_saidas'),
      _safeAll('financeiro_apagar'),
      _safeAll('financeiro_categorias'),
      _safeAll('contas_bancarias'),
      _safeDoc('config', 'geral'),
      _safeDoc('config', 'dinheiro'),
      _safeDoc('config', 'financeiro'),
      _safeDoc('config', 'custos'),
      _safeDoc('config', 'canais_venda'),
      _safeAll('flight_plans'),
      _safeDoc('flight_plan_month_scenarios', _currentMonthKey())
    ]).then(function (r) {
      _data.orders = r[0] || [];
      _data.products = r[1] || [];
      _data.movements = r[2] || [];
      _data.saidas = r[3] || [];
      _data.apagar = r[4] || [];
      _data.categorias = r[5] || [];
      _data.contas = r[6] || [];
      _data.geral = _normalizeGeneral(r[7] || {});
      _data.dinheiro = _normalizeMoney(r[8] || {});
      _data.financeiro = r[9] || {};
      _data.custos = r[10] || {};
      _data.canais = _normalizeChannels(r[11] || {});
      _data.snapshots = (r[12] || []).slice().sort(function (a, b) {
        return _ts(b.createdAt) - _ts(a.createdAt);
      });
      _data.monthScenario = r[13] || null;
      _loading = false;
    }).catch(function (err) {
      _loading = false;
      console.error('Plano de Voo data load error', err);
    });
  }

  function _ensureStateDefaults() {
    var channels = _channelCatalog();
    channels.forEach(function (ch) {
      if (_state.channelInclude[ch.key] == null) _state.channelInclude[ch.key] = true;
      if (_state.channelMode[ch.key] == null) _state.channelMode[ch.key] = ch.historyHasData ? 'automatico' : 'manual';
      if (_state.channelValues[ch.key] == null) _state.channelValues[ch.key] = _channelHistoryAverage(ch.key, _historyMonthsBack()).avg;
    });

    _buildVariableSeed().forEach(function (row) {
      if (_state.costInclude[row.key] == null) _state.costInclude[row.key] = true;
      if (_state.costMode[row.key] == null) _state.costMode[row.key] = row.mode;
      if (_state.costPct[row.key] == null) _state.costPct[row.key] = row.pct;
    });

    _buildFixedSeed().forEach(function (row) {
      if (_state.fixedInclude[row.id] == null) _state.fixedInclude[row.id] = true;
    });

    if (!_state.snapshotName) _state.snapshotName = _defaultSnapshotName();
    if (_state.compareSnapshotId == null) _state.compareSnapshotId = '';
  }

  function _normalizeGeneral(c) {
    c = c || {};
    return {
      indirectCostMode: c.indirectCostMode || c.custosIndiretosModo || 'manual',
      indirectCostPercent: _num(c.indirectCostPercent != null ? c.indirectCostPercent : c.percentualCustosIndiretos != null ? c.percentualCustosIndiretos : 0),
      indirectCostMonths: parseInt(c.indirectCostMonths != null ? c.indirectCostMonths : c.custosIndiretosMeses != null ? c.custosIndiretosMeses : 6, 10) || 6,
      businessName: c.businessName || c.nomeNegocio || '',
      description: c.description || '',
      primaryColor: c.primaryColor || '#C4362A'
    };
  }

  function _normalizeMoney(c) {
    c = c || {};
    return {
      desiredMarginPct: _num(c.desiredMarginPct != null ? c.desiredMarginPct : 60),
      minMarginPct: _num(c.minMarginPct != null ? c.minMarginPct : 40),
      defaultMarkup: _num(c.defaultMarkup != null ? c.defaultMarkup : 3),
      rounding: c.rounding || '90',
      ivaPct: _num(c.ivaPct != null ? c.ivaPct : 0),
      cardFeePct: _num(c.cardFeePct != null ? c.cardFeePct : 0),
      marketplaceCommissionPct: _num(c.marketplaceCommissionPct != null ? c.marketplaceCommissionPct : 0),
      fixedOrderFee: _num(c.fixedOrderFee != null ? c.fixedOrderFee : 0),
      estimatedTaxReservePct: _num(c.estimatedTaxReservePct != null ? c.estimatedTaxReservePct : 0),
      otherFeesPct: _num(c.otherFeesPct != null ? c.otherFeesPct : 0)
    };
  }

  function _normalizeChannels(c) {
    c = c || {};
    var list = Array.isArray(c.list) ? c.list : [];
    if (!list.length) {
      list = [
        { name: 'Cardápio', commissionPct: 0, fixedFee: 0, taxPct: 0, locked: true },
        { name: 'WhatsApp', commissionPct: 0, fixedFee: 0, taxPct: 0 },
        { name: 'Marketplace', commissionPct: 25, fixedFee: 0, taxPct: 21 }
      ];
    }
    var hasCardapio = list.some(function (ch) { return _channelKey(ch.name || '') === 'cardapio'; });
    if (!hasCardapio) list.unshift({ name: 'Cardápio', commissionPct: 0, fixedFee: 0, taxPct: 0, locked: true });
    return list.map(function (ch) {
      var key = _channelKey(ch.name || '');
      return {
        key: key,
        name: key === 'cardapio' ? 'Cardápio' : (ch.name || ''),
        commissionPct: _num(ch.commissionPct),
        fixedFee: _num(ch.fixedFee),
        taxPct: _num(ch.taxPct),
        locked: key === 'cardapio' || !!ch.locked
      };
    });
  }

  function _defaultSnapshotName() {
    var d = new Date();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var label = _state.periodType === 'annual' ? 'anual' : 'mensal';
    return 'Plano de Voo ' + label + ' - ' + month + '/' + d.getFullYear();
  }

  function _forecastRevenueBase() {
    return _channelRowsForBase().reduce(function (sum, ch) {
      return sum + (ch.include ? ch.baseMonthly : 0);
    }, 0);
  }

  function _buildVariableSeed() {
    var revenueBase = _forecastRevenueBase();
    var channels = _channelRowsForBase(revenueBase);
    return _variableRowsForRevenue(revenueBase, channels).map(function (row) {
      return {
        key: row.key,
        name: row.name,
        pct: row.pct,
        mode: row.mode
      };
    });
  }

  function _buildFixedSeed() {
    return _fixedRowsForForecast().map(function (row) {
      return {
        id: row.id,
        name: row.name
      };
    });
  }

  function _safeAll(col) {
    return Promise.resolve().then(function () {
      return DB.getAll(col);
    }).catch(function () {
      return [];
    });
  }

  function _safeDoc(col, id) {
    return Promise.resolve().then(function () {
      return DB.getDocRoot(col, id);
    }).catch(function () {
      return null;
    });
  }

  function _paintActive() {
    if (_activeSub === 'simulacao') return _paintSimulacao();
    if (_activeSub === 'comparacao') return _paintComparacao();
    if (_activeSub === 'snapshots') return _paintSnapshots();
  }

  function _paintSimulacao() {
    var vm = _forecastModel();
    var annual = _state.periodType === 'annual';
    var html = '' +
      _cardHeader('Controle da previsão', 'Mantenha a simulação separada de compromissos e do real. A previsão usa base mensal e pode ser anualizada sem misturar dados.') +
      _controlsCard(vm) +
      _summaryGrid(vm) +
      _scenarioInsight(vm) +
      _channelsCard(vm) +
      _variableCostsCard(vm) +
      _fixedExpensesCard(vm) +
      _resultsCard(vm) +
      (annual ? _annualBreakdownCard(vm) : '') +
      _saveCard(vm);
    _paint(html);
  }

  function _paintComparacao() {
    var snapshot = _selectedSnapshot();
    var vm = _comparisonModel(snapshot);
    var html = '' +
      _cardHeader('Previsto vs real', 'Compare a previsão salva ou a previsão atual contra o que realmente aconteceu no período selecionado.') +
      _comparisonToolbar(vm) +
      _comparisonGrid(vm) +
      _comparisonInsights(vm) +
      _comparisonTable(vm);
    _paint(html);
  }

  function _paintSnapshots() {
    var list = _data.snapshots || [];
    var monthScenario = _data.monthScenario || null;
    var html = '' +
      _cardHeader('Previsões salvas', 'Snapshots úteis para acompanhamento, comparação e repetição de cenários.') +
      (monthScenario ? _monthScenarioBanner(monthScenario) : '') +
      (list.length ? '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;">' + list.map(_snapshotCard).join('') + '</div>' : _emptyState('Nenhuma previsão salva ainda', 'Crie um snapshot para acompanhar previsto vs real.')) +
      (list.length ? '' : '') ;
    _paint(html);
  }

  function _paint(html) {
    var content = document.getElementById('pv-content');
    if (!content) return;
    try {
      content.innerHTML = _safeHtml(html);
    } catch (err) {
      content.innerHTML = '<div style="padding:24px;background:#fff;border-radius:14px;color:#C4362A;box-shadow:0 2px 12px rgba(0,0,0,.08);">Erro ao montar a tela: ' + _esc((err && err.message) || err || 'desconhecido') + '</div>';
      console.error('Plano de Voo paint error', err);
    }
  }

  function _safeHtml(html) {
    return String(html == null ? '' : html).replace(/\bundefined\b/g, '');
  }

  function _cardHeader(title, subtitle) {
    return '' +
      '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:20px;margin-bottom:16px;">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;">' +
          '<div style="min-width:0;">' +
            '<h2 style="font-family:\'League Spartan\',sans-serif;font-size:20px;font-weight:900;margin-bottom:4px;">' + _esc(title) + '</h2>' +
            '<p style="font-size:13px;color:#8A7E7C;line-height:1.5;max-width:880px;">' + _esc(subtitle) + '</p>' +
          '</div>' +
          '<button onclick="Modules.PlanoDeVoo._openSaveSnapshotModal()" style="border:none;background:#C4362A;color:#fff;border-radius:11px;padding:11px 16px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">Salvar previsão</button>' +
        '</div>' +
      '</div>';
  }

  function _controlsCard(vm) {
    var annual = _state.periodType === 'annual';
    var showGrowth = _state.scenario === 'growth' || _state.scenario === 'expansion';
    var showDecline = _state.scenario === 'survival';
    var scenarioHelp = _scenarioHelpText();
    return '' +
      '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:20px;margin-bottom:16px;">' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;">' +
          _selectField('pl-period-type', 'Período', [
            ['monthly', 'Mensal'],
            ['annual', 'Anual']
          ], _state.periodType, 'Modules.PlanoDeVoo._setPeriodType(this.value)') +
          _selectField('pl-history-months', 'Período do histórico', [
            ['3', '3 meses'],
            ['6', '6 meses'],
            ['12', '12 meses']
          ], String(_state.historyMonths || 3), 'Modules.PlanoDeVoo._setHistoryMonths(this.value)') +
          _selectField('pl-scenario', 'Cenário', [
            ['survival', 'Sobrevivência'],
            ['equilibrium', 'Equilíbrio'],
            ['growth', 'Crescimento'],
            ['expansion', 'Expansão']
          ], _state.scenario, 'Modules.PlanoDeVoo._setScenario(this.value)') +
          (showGrowth ? (
            '<div style="display:flex;flex-direction:column;gap:8px;">' +
              '<label style="font-size:12px;font-weight:800;color:#8A7E7C;">Modo do ajuste de crescimento</label>' +
              '<select onchange="Modules.PlanoDeVoo._setGrowthSource(this.value)" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:13px;font-family:inherit;outline:none;background:#fff;">' +
                '<option value="historical"' + (_state.growthSource === 'historical' ? ' selected' : '') + '>Histórico</option>' +
                '<option value="manual"' + (_state.growthSource === 'manual' ? ' selected' : '') + '>Manual</option>' +
              '</select>' +
              (_state.growthSource === 'manual'
                ? _inputField('pl-growth', 'Ajuste de crescimento (%)', _state.growthPct, 'number', 'Modules.PlanoDeVoo._setGrowthPct(this.value)')
                : '<div style="padding:10px 12px;border:1px solid #F2EDED;border-radius:10px;background:#FBF5F3;font-size:12px;line-height:1.45;color:#8A7E7C;">' + _esc(_growthHistoricalNote()) + '</div>') +
            '</div>'
          ) : '') +
          (showDecline ? (
            '<div style="display:flex;flex-direction:column;gap:8px;">' +
              '<label style="font-size:12px;font-weight:800;color:#8A7E7C;">Modo do ajuste de queda</label>' +
              '<select onchange="Modules.PlanoDeVoo._setDeclineSource(this.value)" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:13px;font-family:inherit;outline:none;background:#fff;">' +
                '<option value="historical"' + (_state.declineSource === 'historical' ? ' selected' : '') + '>Histórico</option>' +
                '<option value="manual"' + (_state.declineSource === 'manual' ? ' selected' : '') + '>Manual</option>' +
              '</select>' +
              (_state.declineSource === 'manual'
                ? _inputField('pl-decline', 'Ajuste de queda (%)', _state.declinePct, 'number', 'Modules.PlanoDeVoo._setDeclinePct(this.value)')
                : '<div style="padding:10px 12px;border:1px solid #F2EDED;border-radius:10px;background:#FBF5F3;font-size:12px;line-height:1.45;color:#8A7E7C;">' + _esc(_declineHistoricalNote()) + '</div>') +
            '</div>'
          ) : '') +
          (annual ? _selectField('pl-annual-mode', 'Modo anual', [
            ['linear_growth', 'Crescimento linear (% ao mês)'],
            ['linear_decline', 'Queda linear (% ao mês)'],
            ['seasonality_manual', 'Sazonalidade manual (valor % por mês)']
          ], _state.annualMode, 'Modules.PlanoDeVoo._setAnnualMode(this.value)') : '') +
          _inputField('pl-target-profit', 'Lucro desejado (€)', _state.currentTargetProfit, 'number', 'Modules.PlanoDeVoo._setTargetProfit(this.value)') +
          _inputField('pl-name', 'Nome da previsão', _state.snapshotName, 'text', 'Modules.PlanoDeVoo._setSnapshotName(this.value)') +
        '</div>' +
        '<div style="margin-top:12px;padding:12px 14px;border-radius:12px;background:#FFF7ED;border:1px solid #F7E0C7;color:#8A5A12;font-size:12px;line-height:1.55;">' +
          _esc(scenarioHelp) +
        '</div>' +
        (annual && _state.annualMode === 'seasonality_manual' ? _seasonalityEditor() : '') +
      '</div>';
  }

  function _seasonalityEditor() {
    return '' +
      '<div style="margin-top:14px;padding-top:14px;border-top:1px solid #F2EDED;">' +
        '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Sazonalidade manual</div>' +
        '<div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;">' +
          MONTHS.map(function (m, i) {
            return '<label style="display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:800;color:#8A7E7C;">' +
              '<span>' + m + '</span>' +
              '<input type="number" step="1" value="' + _esc(_state.seasonality[i] != null ? _state.seasonality[i] : 100) + '" onchange="Modules.PlanoDeVoo._setSeasonality(' + i + ', this.value)" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:11px;background:#fff;font-size:13px;font-family:inherit;outline:none;">' +
            '</label>';
          }).join('') +
        '</div>' +
      '</div>';
  }

  function _summaryGrid(vm) {
    return '' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-bottom:16px;">' +
        _kpi('Receita projetada', _fmtMoney(vm.revenueTotal), vm.periodLabel) +
        _kpi('Custos variáveis', _fmtMoney(vm.variableTotal), _fmtPct(vm.variableRate) + ' da receita') +
        _kpi('Despesas fixas', _fmtMoney(vm.fixedTotal), 'compromissos projetados') +
        _kpi('Lucro projetado', _fmtMoney(vm.profit), vm.profit >= 0 ? 'resultado positivo' : 'resultado negativo') +
        _kpi('Caixa atual', _fmtMoney(vm.cashStart), 'saldo real nas contas') +
        _kpi('Caixa final', _fmtMoney(vm.cashFinal), 'caixa após o cenário') +
      '</div>';
  }

  function _scenarioInsight(vm) {
    var breakEven = vm.breakEvenRevenue != null ? _fmtMoney(vm.breakEvenRevenue) : '—';
    var needed = vm.needForProfit != null ? _fmtMoney(vm.needForProfit) : '—';
    var msg = vm.profit >= 0
      ? 'Com este cenário, sobra ' + _fmtMoney(vm.profit) + ' ao final do período.'
      : 'Com este cenário, você perde ' + _fmtMoney(Math.abs(vm.profit)) + '.';
    return '' +
      '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:20px;margin-bottom:16px;">' +
        '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Insights automáticos</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">' +
          _insightBox('Ponto de equilíbrio', breakEven, 'Você precisa vender este valor para não ficar no negativo.') +
          _insightBox('Meta de lucro', needed, 'Para lucrar ' + _fmtMoney(vm.targetProfit) + ' você precisa vender este valor.') +
          _insightBox('Resumo', msg, 'Leitura rápida do cenário escolhido.') +
        '</div>' +
      '</div>';
  }

  function _channelsCard(vm) {
    var annual = _state.periodType === 'annual';
    return '' +
      '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:20px;margin-bottom:16px;">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px;flex-wrap:wrap;">' +
          '<div>' +
            '<h3 style="font-family:\'League Spartan\',sans-serif;font-size:18px;font-weight:900;margin-bottom:4px;">Vendas por canal</h3>' +
            '<p style="font-size:13px;color:#8A7E7C;">Quando o canal está automático, a base aparece calculada. Quando estiver manual, você pode editar o valor.</p>' +
          '</div>' +
          '<div style="font-size:12px;color:#8A7E7C;padding:8px 12px;border-radius:999px;background:#FBF5F3;border:1px solid #F2EDED;">' +
            (annual ? 'Base mensal anualizada no resultado final' : 'Valor mensal projetado para o período') +
          '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:10px;">' +
          vm.channels.map(function (ch) {
            return _channelRow(ch, annual);
          }).join('') +
        '</div>' +
      '</div>';
  }

  function _channelRow(ch, annual) {
    var included = _state.channelInclude[ch.key] !== false;
    var base = _num(_state.channelValues[ch.key] != null ? _state.channelValues[ch.key] : ch.historyAvg);
    var periodValue = annual ? base * ch.periodFactor : base * ch.periodFactor;
    var helper = ch.historyHasData
      ? 'Histórico médio dos últimos ' + ch.lookbackMonths + ' meses: ' + _fmtMoney(ch.historyAvg) + ' por mês'
      : 'Sem histórico suficiente. Use o valor manual.';
    var mode = ch.mode || (ch.historyHasData ? 'automatico' : 'manual');
    return '' +
      '<div style="display:grid;grid-template-columns:28px 1.4fr .85fr .95fr 150px;gap:10px;align-items:center;padding:14px 14px;border:1px solid #F2EDED;border-radius:12px;background:' + (included ? '#fff' : '#FBF5F3') + ';">' +
        '<label style="display:flex;align-items:center;justify-content:center;"><input type="checkbox" ' + (included ? 'checked' : '') + ' onchange="Modules.PlanoDeVoo._toggleChannelInclude(\'' + ch.key + '\', this.checked)" style="accent-color:#C4362A;width:16px;height:16px;"></label>' +
        '<div style="min-width:0;">' +
          '<div style="font-size:14px;font-weight:900;color:#1A1A1A;">' + _esc(ch.label) + '</div>' +
          '<div style="font-size:12px;color:#8A7E7C;line-height:1.4;margin-top:3px;">' + _esc(helper) + '</div>' +
        '</div>' +
        '<div>' +
          '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">' + (mode === 'manual' ? 'Base mensal' : 'Base calculada') + '</div>' +
          (mode === 'manual'
            ? '<input type="number" step="0.01" value="' + _esc(base) + '" onchange="Modules.PlanoDeVoo._setChannelForecast(\'' + ch.key + '\', this.value)" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:13px;font-family:inherit;outline:none;background:#fff;">'
            : '<div style="padding:10px 12px;border:1.5px solid #E8E1DE;border-radius:10px;background:#FBF5F3;font-size:13px;font-weight:800;color:#1A1A1A;">' + _fmtMoney(base) + '</div>') +
        '</div>' +
        '<div>' +
          '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Projeção do período</div>' +
          '<div style="font-family:\'League Spartan\',sans-serif;font-size:18px;font-weight:900;color:' + (included ? '#C4362A' : '#8A7E7C') + ';">' + _fmtMoney(periodValue) + '</div>' +
        '</div>' +
        '<div style="font-size:12px;color:#8A7E7C;text-align:right;">' +
          '<div style="margin-bottom:4px;padding:5px 8px;border-radius:999px;background:' + (mode === 'manual' ? '#EEF4FF' : '#EDFAF3') + ';color:' + (mode === 'manual' ? '#2563EB' : '#1A9E5A') + ';font-size:11px;font-weight:900;">' + (mode === 'manual' ? 'Manual' : 'Automático') + '</div>' +
          (annual ? ('Multiplicador anual: ' + _fmtNum(ch.periodFactor, 2) + 'x') : ('Ajuste do cenário: ' + _fmtNum(ch.periodFactor, 2) + 'x')) +
        '</div>' +
      '</div>';
  }

  function _variableCostsCard(vm) {
    return '' +
      '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:20px;margin-bottom:16px;">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px;flex-wrap:wrap;">' +
          '<div>' +
            '<h3 style="font-family:\'League Spartan\',sans-serif;font-size:18px;font-weight:900;margin-bottom:4px;">Custos variáveis</h3>' +
            '<p style="font-size:13px;color:#8A7E7C;">O valor aparece calculado quando a regra está automática e editável quando estiver manual.</p>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:10px;">' +
          vm.variableRows.map(function (row) { return _variableRow(row, vm.revenueTotal); }).join('') +
        '</div>' +
      '</div>';
  }

  function _variableRow(row, revenueTotal) {
    var include = _state.costInclude[row.key] !== false;
    var mode = _state.costMode[row.key] || row.mode || 'automatico';
    var pct = mode === 'manual' ? _num(_state.costPct[row.key] != null ? _state.costPct[row.key] : row.pct) : _num(row.pct);
    var projected = include ? revenueTotal * (pct / 100) : 0;
    var note = row.note || (mode === 'manual' ? 'Manual' : 'Automático');
    var pctField = mode === 'manual'
      ? '<input type="number" step="0.01" value="' + _esc(pct) + '" onchange="Modules.PlanoDeVoo._setCostPct(\'' + row.key + '\', this.value)" style="width:100%;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:13px;font-family:inherit;outline:none;background:#fff;">'
      : '<div style="padding:10px 12px;border:1.5px solid #E8E1DE;border-radius:10px;background:#FBF5F3;font-size:13px;font-weight:800;color:#1A1A1A;">' + _fmtPct(pct) + '</div>';
    return '' +
      '<div style="display:grid;grid-template-columns:28px 1.3fr 1fr .9fr 120px;gap:10px;align-items:center;padding:14px 14px;border:1px solid #F2EDED;border-radius:12px;background:' + (include ? '#fff' : '#FBF5F3') + ';">' +
        '<label style="display:flex;align-items:center;justify-content:center;"><input type="checkbox" ' + (include ? 'checked' : '') + ' onchange="Modules.PlanoDeVoo._toggleCostInclude(\'' + row.key + '\', this.checked)" style="accent-color:#C4362A;width:16px;height:16px;"></label>' +
        '<div style="min-width:0;">' +
          '<div style="font-size:14px;font-weight:900;">' + _esc(row.name) + '</div>' +
          '<div style="font-size:12px;color:#8A7E7C;margin-top:3px;">' + _esc(note) + '</div>' +
        '</div>' +
        '<div>' +
          '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">' + (mode === 'manual' ? 'Percentual manual' : 'Percentual calculado') + '</div>' +
          pctField +
        '</div>' +
        '<div>' +
          '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Valor projetado</div>' +
          '<div style="font-family:\'League Spartan\',sans-serif;font-size:18px;font-weight:900;color:' + (include ? '#1A9E5A' : '#8A7E7C') + ';">' + _fmtMoney(projected) + '</div>' +
        '</div>' +
        '<div style="text-align:right;font-size:12px;color:#8A7E7C;">' +
          '<div style="margin-bottom:4px;padding:5px 8px;border-radius:999px;background:' + (mode === 'manual' ? '#EEF4FF' : '#EDFAF3') + ';color:' + (mode === 'manual' ? '#2563EB' : '#1A9E5A') + ';font-size:11px;font-weight:900;">' + (mode === 'manual' ? 'Manual' : 'Automático') + '</div>' +
          (row.sourceLabel || 'Base') +
        '</div>' +
      '</div>';
  }

  function _fixedExpensesCard(vm) {
    var historyRows = vm && Array.isArray(vm.historyRows) ? vm.historyRows : [];
    return '' +
      '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:20px;margin-bottom:16px;">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px;flex-wrap:wrap;">' +
          '<div>' +
            '<h3 style="font-family:\'League Spartan\',sans-serif;font-size:18px;font-weight:900;margin-bottom:4px;">Despesas fixas por categoria</h3>' +
            '<p style="font-size:13px;color:#8A7E7C;">Use a média das categorias financeiras para projetar a previsão.</p>' +
          '</div>' +
        '</div>' +
        '<div style="min-width:0;">' +
          '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Categorias financeiras</div>' +
          (historyRows.length ? historyRows.map(function (row) { return _fixedRow(row, vm); }).join('') : _emptyHint('Sem base histórica de categorias', 'Adicione saídas categorizadas para gerar uma média automática.')) +
        '</div>' +
      '</div>';
  }

  function _fixedRow(row, vm) {
    var include = _state.fixedInclude[row.id] !== false;
    var projected = include ? row.projected : 0;
    var canTransform = row.source === 'historical';
    return '' +
      '<div style="display:grid;grid-template-columns:28px 1.2fr .8fr .8fr 128px;gap:10px;align-items:center;padding:14px 14px;border:1px solid #F2EDED;border-radius:12px;background:' + (include ? '#fff' : '#FBF5F3') + ';margin-bottom:10px;">' +
        '<label style="display:flex;align-items:center;justify-content:center;"><input type="checkbox" ' + (include ? 'checked' : '') + ' onchange="Modules.PlanoDeVoo._toggleFixedInclude(\'' + row.id + '\', this.checked)" style="accent-color:#C4362A;width:16px;height:16px;"></label>' +
        '<div style="min-width:0;">' +
          '<div style="font-size:14px;font-weight:900;">' + _esc(row.name) + '</div>' +
          '<div style="font-size:12px;color:#8A7E7C;margin-top:3px;">' + _esc(row.sourceLabel) + '</div>' +
        '</div>' +
        '<div>' +
          '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Valor</div>' +
          '<div style="font-family:\'League Spartan\',sans-serif;font-size:18px;font-weight:900;color:#C4362A;">' + _fmtMoney(row.value) + '</div>' +
        '</div>' +
        '<div>' +
          '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Recorrência</div>' +
          '<div style="font-size:13px;font-weight:800;color:#1A1A1A;">' + _esc(row.recurrenceLabel) + '</div>' +
        '</div>' +
        '<div style="text-align:right;display:flex;flex-direction:column;gap:6px;align-items:flex-end;">' +
          '<div style="font-family:\'League Spartan\',sans-serif;font-size:18px;font-weight:900;color:' + (include ? '#D97706' : '#8A7E7C') + ';">' + _fmtMoney(projected) + '</div>' +
          (canTransform ? '<button onclick="Modules.PlanoDeVoo._transformFixedExpense(\'' + row.id + '\')" style="border:none;background:#EEF4FF;color:#2563EB;border-radius:10px;padding:7px 10px;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;">Transformar em conta a pagar</button>' : '<span style="font-size:11px;color:#8A7E7C;">Já é conta a pagar</span>') +
        '</div>' +
      '</div>';
  }

  function _resultsCard(vm) {
    return '' +
      '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:20px;margin-bottom:16px;">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px;flex-wrap:wrap;">' +
          '<div>' +
            '<h3 style="font-family:\'League Spartan\',sans-serif;font-size:18px;font-weight:900;margin-bottom:4px;">Resultado</h3>' +
            '<p style="font-size:13px;color:#8A7E7C;">O que sobra no fim do período depois de receitas, custos e despesas.</p>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
            '<label style="font-size:12px;font-weight:800;color:#8A7E7C;">Lucro desejado (€)</label>' +
            '<input type="number" step="0.01" value="' + _esc(_state.currentTargetProfit) + '" onchange="Modules.PlanoDeVoo._setTargetProfit(this.value)" style="width:140px;padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:13px;font-family:inherit;outline:none;background:#fff;">' +
          '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-bottom:14px;">' +
          _kpi('Receita total', _fmtMoney(vm.revenueTotal), 'base + cenário') +
          _kpi('Custos totais', _fmtMoney(vm.variableTotal), 'custos variáveis') +
          _kpi('Despesas totais', _fmtMoney(vm.fixedTotal), 'compromissos incluídos') +
          _kpi('Lucro projetado', _fmtMoney(vm.profit), vm.profit >= 0 ? 'sobras' : 'prejuízo') +
          _kpi('Caixa final', _fmtMoney(vm.cashFinal), 'caixa atual + projeção') +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">' +
          _insightBox('Break-even', vm.breakEvenRevenue != null ? _fmtMoney(vm.breakEvenRevenue) : '—', 'Você precisa vender este valor para não ficar no negativo.') +
          _insightBox('Meta de lucro', vm.needForProfit != null ? _fmtMoney(vm.needForProfit) : '—', 'Para lucrar ' + _fmtMoney(vm.targetProfit) + ' precisa vender este valor.') +
          _insightBox('Leitura rápida', vm.profit >= 0 ? 'Você termina com caixa positivo.' : 'Com este cenário, você perde ' + _fmtMoney(Math.abs(vm.profit)) + '.', 'Resumo direto para decisão.') +
        '</div>' +
      '</div>';
  }

  function _annualBreakdownCard(vm) {
    return '' +
      '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:20px;margin-bottom:16px;">' +
        '<h3 style="font-family:\'League Spartan\',sans-serif;font-size:18px;font-weight:900;margin-bottom:10px;">Resumo anual por mês</h3>' +
        '<div style="overflow-x:auto;">' +
          '<table style="width:100%;border-collapse:collapse;min-width:760px;">' +
            '<thead><tr style="background:#F8F6F5;">' +
              ['Mês', 'Receita', 'Custos variáveis', 'Despesas fixas', 'Lucro'].map(function (h) {
                return '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">' + h + '</th>';
              }).join('') +
            '</tr></thead>' +
            '<tbody>' +
              vm.monthSeries.map(function (m) {
                var profit = m.revenue - vm.monthVariable - vm.monthFixed;
                return '<tr style="border-top:1px solid #F2EDED;">' +
                  '<td style="padding:11px 14px;font-size:13px;font-weight:800;">' + _esc(m.label) + '</td>' +
                  '<td style="padding:11px 14px;font-size:13px;">' + _fmtMoney(m.revenue) + '</td>' +
                  '<td style="padding:11px 14px;font-size:13px;">' + _fmtMoney(vm.monthVariable) + '</td>' +
                  '<td style="padding:11px 14px;font-size:13px;">' + _fmtMoney(vm.monthFixed) + '</td>' +
                  '<td style="padding:11px 14px;font-size:13px;font-weight:900;color:' + (profit >= 0 ? '#1A9E5A' : '#C4362A') + ';">' + _fmtMoney(profit) + '</td>' +
                '</tr>';
              }).join('') +
            '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';
  }

  function _saveCard(vm) {
    return '' +
      '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:20px;margin-bottom:16px;">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;">' +
          '<div>' +
            '<h3 style="font-family:\'League Spartan\',sans-serif;font-size:18px;font-weight:900;margin-bottom:4px;">Salvar previsão</h3>' +
            '<p style="font-size:13px;color:#8A7E7C;">Grave um snapshot para acompanhar depois o previsto vs real. Escolha o mês ao salvar.</p>' +
          '</div>' +
          '<button onclick="Modules.PlanoDeVoo._openSaveSnapshotModal()" style="border:none;background:#C4362A;color:#fff;border-radius:11px;padding:11px 16px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">Salvar previsão</button>' +
        '</div>' +
      '</div>';
  }

  function _comparisonToolbar(vm) {
    vm = vm || _forecastModel();
    var options = '<option value="">Previsão atual</option>' + (_data.snapshots || []).map(function (s) {
      return '<option value="' + _esc(s.id) + '"' + (_state.compareSnapshotId === s.id ? ' selected' : '') + '>' + _esc(s.name || 'Previsão') + '</option>';
    }).join('');
    return '' +
      '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:20px;margin-bottom:16px;">' +
        '<div style="display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;">' +
          '<label style="display:flex;flex-direction:column;gap:4px;min-width:280px;flex:1;">' +
            '<span style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;">Previsão analisada</span>' +
            '<select onchange="Modules.PlanoDeVoo._setCompareSnapshot(this.value)" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:12px;background:#fff;font-size:13px;font-family:inherit;outline:none;">' + options + '</select>' +
          '</label>' +
          '<div style="padding:10px 12px;border-radius:999px;background:#FBF5F3;border:1px solid #F2EDED;font-size:12px;color:#8A7E7C;">' + _esc(vm.periodLabel) + '</div>' +
        '</div>' +
      '</div>';
  }

  function _comparisonGrid(vm) {
    return '' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-bottom:16px;">' +
        _compareTile('Receita prevista', vm.forecast.revenue, vm.actual.revenue, vm.forecast.revenue) +
        _compareTile('Custos previstos', vm.forecast.costs, vm.actual.costs, vm.forecast.costs) +
        _compareTile('Lucro previsto', vm.forecast.profit, vm.actual.profit, vm.forecast.profit) +
        _compareTile('Caixa previsto', vm.forecast.cashFinal, vm.actual.cashFinal, vm.forecast.cashFinal) +
        _kpi('Atingimento', vm.achievementPct.toFixed(1) + '%', vm.achievementLabel) +
        _kpi('Saldo', vm.deltaLabel, vm.deltaHint) +
      '</div>';
  }

  function _comparisonInsights(vm) {
    return '' +
      '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:20px;margin-bottom:16px;">' +
        '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Insights da comparação</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;">' +
          _insightBox('Receita', vm.revenueInsight.value, vm.revenueInsight.text) +
          _insightBox('Custos', vm.costInsight.value, vm.costInsight.text) +
          _insightBox('Lucro', vm.profitInsight.value, vm.profitInsight.text) +
        '</div>' +
      '</div>';
  }

  function _comparisonTable(vm) {
    var rows = [
      { label: 'Receita', forecast: vm.forecast.revenue, actual: vm.actual.revenue },
      { label: 'Custos variáveis', forecast: vm.forecast.costs, actual: vm.actual.costs },
      { label: 'Despesas fixas', forecast: vm.forecast.fixed, actual: vm.actual.fixed },
      { label: 'Lucro', forecast: vm.forecast.profit, actual: vm.actual.profit },
      { label: 'Caixa final', forecast: vm.forecast.cashFinal, actual: vm.actual.cashFinal }
    ];
    return '' +
      '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:20px;margin-bottom:16px;">' +
        '<h3 style="font-family:\'League Spartan\',sans-serif;font-size:18px;font-weight:900;margin-bottom:10px;">Resumo comparativo</h3>' +
        '<div style="overflow-x:auto;">' +
          '<table style="width:100%;border-collapse:collapse;min-width:760px;">' +
            '<thead><tr style="background:#F8F6F5;">' +
              ['Indicador', 'Previsto', 'Real', 'Diferença', '% atingido'].map(function (h) {
                return '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">' + h + '</th>';
              }).join('') +
            '</tr></thead>' +
            '<tbody>' +
              rows.map(function (row) {
                var diff = row.actual - row.forecast;
                var pct = row.forecast ? (row.actual / row.forecast) * 100 : 0;
                return '<tr style="border-top:1px solid #F2EDED;">' +
                  '<td style="padding:11px 14px;font-size:13px;font-weight:800;">' + _esc(row.label) + '</td>' +
                  '<td style="padding:11px 14px;font-size:13px;">' + _fmtMoney(row.forecast) + '</td>' +
                  '<td style="padding:11px 14px;font-size:13px;">' + _fmtMoney(row.actual) + '</td>' +
                  '<td style="padding:11px 14px;font-size:13px;font-weight:800;color:' + (diff >= 0 ? '#1A9E5A' : '#C4362A') + ';">' + (diff >= 0 ? '+' : '') + _fmtMoney(diff) + '</td>' +
                  '<td style="padding:11px 14px;font-size:13px;font-weight:800;">' + (row.forecast ? pct.toFixed(1) + '%' : '—') + '</td>' +
                '</tr>';
              }).join('') +
            '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';
  }

  function _snapshotCard(s) {
    var summary = s.summary || {};
    var active = _isMonthScenarioSnapshot(s);
    return '' +
      '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:18px;display:flex;flex-direction:column;gap:12px;">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">' +
          '<div style="min-width:0;">' +
            '<div style="font-family:\'League Spartan\',sans-serif;font-size:18px;font-weight:900;margin-bottom:4px;">' + _esc(s.name || 'Previsão salva') + '</div>' +
            '<div style="font-size:12px;color:#8A7E7C;">' + _esc(_snapshotPeriodLabel(s)) + '</div>' +
            '<div style="font-size:12px;color:#8A7E7C;margin-top:3px;">Mês: ' + _esc(s.targetMonthLabel || _monthLabelFromKey(s.targetMonthKey || _currentMonthKey())) + '</div>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">' +
            '<div style="padding:6px 9px;border-radius:999px;background:' + (SCENARIOS[s.scenario] ? SCENARIOS[s.scenario].bg : '#F2EDED') + ';color:' + (SCENARIOS[s.scenario] ? SCENARIOS[s.scenario].tone : '#8A7E7C') + ';font-size:11px;font-weight:900;">' + _esc(_scenarioLabel(s.scenario)) + '</div>' +
            (active ? '<div style="padding:6px 9px;border-radius:999px;background:#EDFAF3;color:#1A9E5A;font-size:11px;font-weight:900;">Cenário do mês</div>' : '') +
          '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">' +
          _miniTile('Receita', _fmtMoney(summary.revenue || 0)) +
          _miniTile('Lucro', _fmtMoney(summary.profit || 0)) +
          _miniTile('Caixa final', _fmtMoney(summary.cashFinal || 0)) +
          _miniTile('Cost. fixos', _fmtMoney(summary.fixedTotal || 0)) +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          '<button onclick="Modules.PlanoDeVoo._setMonthScenario(\'' + _esc(s.id) + '\')" style="border:none;background:' + (active ? '#1A9E5A' : '#C4362A') + ';color:#fff;border-radius:10px;padding:9px 12px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">' + (active ? 'Selecionado no mês' : 'Definir cenário do mês') + '</button>' +
          '<button onclick="Modules.PlanoDeVoo._compareSnapshot(\'' + _esc(s.id) + '\')" style="border:none;background:#EEF4FF;color:#2563EB;border-radius:10px;padding:9px 12px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">Comparar</button>' +
        '</div>' +
      '</div>';
  }

  function _selectedSnapshot() {
    if (!_state.compareSnapshotId) return _forecastModel();
    var snap = (_data.snapshots || []).find(function (s) { return String(s.id) === String(_state.compareSnapshotId); });
    return snap ? _snapshotToForecast(snap) : _forecastModel();
  }

  function _snapshotToForecast(snap) {
    var s = snap || {};
    return {
      fromSnapshot: true,
      periodLabel: _snapshotPeriodLabel(s),
      revenueTotal: _num((s.summary || {}).revenue),
      variableTotal: _num((s.summary || {}).variableTotal || (s.summary || {}).costs),
      fixedTotal: _num((s.summary || {}).fixedTotal || (s.summary || {}).despesas),
      profit: _num((s.summary || {}).profit),
      cashStart: _num((s.summary || {}).cashStart),
      cashFinal: _num((s.summary || {}).cashFinal),
      breakEvenRevenue: _num((s.summary || {}).breakEvenRevenue),
      targetProfit: _num((s.summary || {}).targetProfit || 500),
      needForProfit: _num((s.summary || {}).needForProfit),
      channels: s.channels || [],
      variableRows: s.variableCosts || [],
      fixedRows: s.fixedExpenses || [],
      monthSeries: s.monthSeries || [],
      forecast: {
        revenue: _num((s.summary || {}).revenue),
        costs: _num((s.summary || {}).variableTotal || (s.summary || {}).costs),
        fixed: _num((s.summary || {}).fixedTotal || 0),
        profit: _num((s.summary || {}).profit),
        cashFinal: _num((s.summary || {}).cashFinal)
      },
      actual: _actualForSnapshot(s),
      achievementPct: _achievementPct(_num((s.summary || {}).revenue), _actualForSnapshot(s).revenue),
      achievementLabel: _achievementLabel(_num((s.summary || {}).revenue), _actualForSnapshot(s).revenue),
      deltaLabel: _deltaLabel(_num((s.summary || {}).revenue), _actualForSnapshot(s).revenue),
      deltaHint: _deltaHint(_num((s.summary || {}).revenue), _actualForSnapshot(s).revenue),
      revenueInsight: _simpleCompareInsight('Receita', _num((s.summary || {}).revenue), _actualForSnapshot(s).revenue),
      costInsight: _simpleCompareInsight('Custos', _num((s.summary || {}).variableTotal || (s.summary || {}).costs) + _num((s.summary || {}).fixedTotal || 0), _actualForSnapshot(s).costs),
      profitInsight: _simpleCompareInsight('Lucro', _num((s.summary || {}).profit), _actualForSnapshot(s).profit)
    };
  }

  function _comparisonModel(snapshot) {
    var forecast = snapshot && snapshot.fromSnapshot ? snapshot : _forecastModel();
    var actual = _actualForRange(forecast.periodStart || _periodInfo().start, forecast.periodEnd || _periodInfo().end);
    var forecastRevenue = _num(forecast.revenueTotal || (forecast.forecast && forecast.forecast.revenue));
    var forecastCosts = _num(forecast.variableTotal || (forecast.forecast && forecast.forecast.costs));
    var forecastFixed = _num(forecast.fixedTotal || (forecast.forecast && forecast.forecast.fixed));
    var forecastProfit = _num(forecast.profit || (forecast.forecast && forecast.forecast.profit));
    var forecastCash = _num(forecast.cashFinal || (forecast.forecast && forecast.forecast.cashFinal));
    var actualRevenue = actual.revenue;
    var actualCosts = actual.costs;
    var actualFixed = actual.fixed;
    var actualProfit = actual.profit;
    var actualCash = actual.cashFinal;
    return {
      periodLabel: forecast.periodLabel || _periodInfo().label,
      forecast: { revenue: forecastRevenue, costs: forecastCosts, fixed: forecastFixed, profit: forecastProfit, cashFinal: forecastCash },
      actual: { revenue: actualRevenue, costs: actualCosts, fixed: actualFixed, profit: actualProfit, cashFinal: actualCash },
      achievementPct: _achievementPct(forecastRevenue, actualRevenue),
      achievementLabel: _achievementLabel(forecastRevenue, actualRevenue),
      deltaLabel: _deltaLabel(forecastRevenue, actualRevenue),
      deltaHint: _deltaHint(forecastRevenue, actualRevenue),
      targetProfit: _num(forecast.targetProfit || 500),
      revenueInsight: _simpleCompareInsight('Receita', forecastRevenue, actualRevenue),
      costInsight: _simpleCompareInsight('Custos', forecastCosts + forecastFixed, actualCosts + actualFixed),
      profitInsight: _simpleCompareInsight('Lucro', forecastProfit, actualProfit)
    };
  }

  function _forecastModel() {
    var channels = _channelRowsForBase();
    var baseMonthlyRevenue = channels.reduce(function (s, ch) {
      return s + (ch.include ? ch.baseMonthly : 0);
    }, 0);
    var period = _periodInfo();
    var monthlyFactor = _scenarioMultiplier();
    var revenueTotal = 0;
    var monthSeries = [];
    var annual = _state.periodType === 'annual';

    if (!annual) {
      revenueTotal = baseMonthlyRevenue * monthlyFactor;
      monthSeries.push({
        label: MONTHS[new Date().getMonth()],
        revenue: revenueTotal,
        factor: monthlyFactor
      });
    } else {
      var monthFactors = _annualMonthFactors();
      for (var i = 0; i < 12; i += 1) {
        var factor = monthFactors[i];
        var monthRevenue = baseMonthlyRevenue * factor;
        revenueTotal += monthRevenue;
        monthSeries.push({ label: MONTHS[i], revenue: monthRevenue, factor: factor });
      }
    }

    var variableRows = _variableRowsForRevenue(revenueTotal, channels);
    var fixedRows = _fixedRowsForForecast();
    var monthVariable = variableRows.reduce(function (s, row) {
      return s + row.projectedMonthly;
    }, 0);
    var monthFixed = fixedRows.reduce(function (s, row) {
      return s + row.projectedMonthly;
    }, 0);
    var variableTotal = annual ? monthVariable * 12 : monthVariable;
    var fixedTotal = annual ? monthFixed * 12 : monthFixed;
    var profit = revenueTotal - variableTotal - fixedTotal;
    var cashStart = _currentCash();
    var cashFinal = cashStart + profit;
    var variableRate = revenueTotal > 0 ? variableTotal / revenueTotal : 0;
    var breakEvenRevenue = variableRate < 1 ? fixedTotal / (1 - variableRate) : null;
    var targetProfit = _num(_state.currentTargetProfit || 500);
    var needForProfit = variableRate < 1 ? (fixedTotal + targetProfit) / (1 - variableRate) : null;

    return {
      periodLabel: period.label,
      periodStart: period.start,
      periodEnd: period.end,
      channels: channels,
      revenueBase: baseMonthlyRevenue,
      revenueTotal: revenueTotal,
      variableRows: variableRows,
      fixedRows: fixedRows,
      payableRows: _openPayablesRows(),
      historyRows: _mergeHistoricalCategories(),
      monthSeries: monthSeries,
      monthVariable: monthVariable,
      monthFixed: monthFixed,
      variableTotal: variableTotal,
      fixedTotal: fixedTotal,
      profit: profit,
      cashStart: cashStart,
      cashFinal: cashFinal,
      variableRate: variableRate,
      breakEvenRevenue: breakEvenRevenue,
      targetProfit: targetProfit,
      needForProfit: needForProfit,
      forecast: {
        revenue: revenueTotal,
        costs: variableTotal,
        fixed: fixedTotal,
        profit: profit,
        cashFinal: cashFinal
      }
    };
  }

  function _channelRowsForBase() {
    var catalog = _channelCatalog();
    var annual = _state.periodType === 'annual';
    var factors = annual ? _annualMonthFactors() : [_scenarioMultiplier()];
    return catalog.map(function (ch) {
      var hist = _channelHistoryAverage(ch.key, _historyMonthsBack());
      var baseMonthly = _num(_state.channelValues[ch.key] != null ? _state.channelValues[ch.key] : hist.avg);
      var mode = _state.channelMode[ch.key] || (hist.hasData ? 'automatico' : 'manual');
      var periodFactor = annual ? factors.reduce(function (s, f) { return s + f; }, 0) : factors[0];
      var periodValue = baseMonthly * periodFactor;
      return {
        key: ch.key,
        label: ch.name || ch.label,
        commissionPct: ch.commissionPct || 0,
        fixedFee: ch.fixedFee || 0,
        taxPct: ch.taxPct || 0,
        locked: !!ch.locked,
        historyAvg: hist.avg,
        historyHasData: hist.hasData,
        lookbackMonths: hist.lookbackMonths,
        baseMonthly: baseMonthly,
        mode: mode,
        periodValue: periodValue,
        periodFactor: periodFactor,
        include: _state.channelInclude[ch.key] !== false,
        sharePct: 0
      };
    }).map(function (ch, idx, arr) {
      var total = arr.reduce(function (s, x) { return s + (x.include ? x.periodValue : 0); }, 0);
      ch.sharePct = total > 0 ? (ch.periodValue / total) * 100 : 0;
      return ch;
    });
  }

  function _variableRowsForRevenue(revenueTotal, channels) {
    var lookbackMonths = _historyMonthsBack();
    var productCostPct = _historicalProductCostPct(lookbackMonths);
    var paymentPct = _num(_data.dinheiro.cardFeePct || 0);
    var channelCommissionPct = _channelCommissionPct(channels);
    var indirectPct = _num(_data.geral.indirectCostPercent || _data.custos.defaultIndirectCostPercent || 0);
    var taxReservePct = _num(_data.dinheiro.estimatedTaxReservePct || 0);
    var otherPct = _num(_data.dinheiro.otherFeesPct || 0);
    var rows = [
      { key: 'products', name: 'Custo dos produtos vendidos', pct: productCostPct, mode: 'automatico', sourceLabel: 'Histórico dos pedidos', note: productCostPct > 0 ? 'Baseado no custo estimado dos itens vendidos.' : 'Sem custo cadastrado nos produtos.', warning: productCostPct <= 0 ? 'Custo não informado' : '' },
      { key: 'payment', name: 'Taxas de pagamento', pct: paymentPct, mode: 'automatico', sourceLabel: 'Configuração do sistema', note: 'Taxas estimadas por método de pagamento.' },
      { key: 'channel', name: 'Comissões de canal', pct: channelCommissionPct, mode: 'automatico', sourceLabel: 'Mistura dos canais de venda', note: 'Média ponderada pelas vendas por canal.' },
      { key: 'indirect', name: 'Custos indiretos', pct: indirectPct, mode: _data.geral.indirectCostMode === 'automatico' ? 'automatico' : 'manual', sourceLabel: 'Configuração geral', note: 'Usa a configuração de custos indiretos do negócio.' },
      { key: 'tax', name: 'Reserva fiscal', pct: taxReservePct, mode: 'automatico', sourceLabel: 'Configuração financeira', note: 'Reserva estimada para impostos.' },
      { key: 'other', name: 'Outros custos', pct: otherPct, mode: 'automatico', sourceLabel: 'Outras taxas e ajustes', note: 'Ajuste fino para custos diversos.' }
    ];

    return rows.map(function (row) {
      var mode = _state.costMode[row.key] || row.mode || 'automatico';
      var pct = mode === 'manual'
        ? _num(_state.costPct[row.key] != null ? _state.costPct[row.key] : row.pct)
        : _num(row.pct);
      var projectedMonthly = revenueTotal * (pct / 100);
      return {
        key: row.key,
        name: row.name,
        pct: pct,
        mode: mode,
        include: _state.costInclude[row.key] !== false,
        projectedMonthly: _state.costInclude[row.key] === false ? 0 : projectedMonthly,
        projected: _state.costInclude[row.key] === false ? 0 : projectedMonthly,
        sourceLabel: row.sourceLabel,
        note: row.note,
        warning: row.warning || ''
      };
    });
  }

  function _fixedRowsForForecast() {
    var rows = [];
    var payables = _openPayables();
    var historyRows = _historicalExpenseRows();
    payables.forEach(function (item) {
      rows.push({
        id: 'pay:' + item.id,
        source: 'payable',
        name: item.name,
        value: item.value,
        recurrence: item.recurrence,
        recurrenceLabel: item.recurrenceLabel,
        include: _state.fixedInclude['pay:' + item.id] !== false,
        projectedMonthly: _state.fixedInclude['pay:' + item.id] === false ? 0 : item.projectedMonthly,
        projected: _state.fixedInclude['pay:' + item.id] === false ? 0 : item.projected,
        sourceLabel: 'Conta a pagar',
        transformable: false,
        categoryId: item.categoryId || ''
      });
    });
    historyRows.forEach(function (item) {
      rows.push({
        id: 'hist:' + item.key,
        source: 'historical',
        name: item.name,
        value: item.value,
        recurrence: item.recurrence,
        recurrenceLabel: item.recurrenceLabel,
        include: _state.fixedInclude['hist:' + item.key] !== false,
        projectedMonthly: _state.fixedInclude['hist:' + item.key] === false ? 0 : item.projectedMonthly,
        projected: _state.fixedInclude['hist:' + item.key] === false ? 0 : item.projected,
        sourceLabel: 'Categoria financeira',
        transformable: true,
        categoryId: item.categoryId || ''
      });
    });
    return rows;
  }

  function _openPayables() {
    var merged = [];
    var seen = {};
    var raw = [].concat(_data.apagar || []);
    raw.forEach(function (cp) {
      var id = String(cp.id || cp.name || cp.description || Math.random());
      if (seen[id]) return;
      seen[id] = true;
      var name = cp.name || cp.title || cp.descricao || cp.description || cp.nome || 'Conta a pagar';
      var value = _num(cp.valorTotalOriginal || cp.valor || cp.amount || cp.total || cp.valorParcela || cp.valor_parcela || 0);
      var recurrence = _normalizeRecurrence(cp.recorrente ? (cp.frequencia || cp.recorrencia || 'mensal') : (cp.frequencia || cp.recorrencia || 'única'));
      var recurrenceLabel = _recurrenceLabel(recurrence);
      var periodFactor = _periodRecurrenceFactor(recurrence);
      var projectedMonthly = value * periodFactor.monthly;
      var projected = value * periodFactor.period;
      merged.push({
        id: id,
        name: name,
        value: value,
        recurrence: recurrence,
        recurrenceLabel: recurrenceLabel,
        projectedMonthly: projectedMonthly,
        projected: projected,
        categoryId: cp.categoria_id || cp.categoriaId || cp.categoryId || '',
        dueDate: cp.vencimento || cp.dueDate || '',
        raw: cp
      });
    });
    return merged;
  }

  function _historicalExpenseRows() {
    var lookbackMonths = _historyMonthsBack();
    var period = _completeMonthsRange(lookbackMonths);
    var categories = {};
    var categoryLookup = {};
    (_data.categorias || []).forEach(function (c) {
      var key = _normalizeCategoryKey(c.id || c.slug || c.name || c.nome);
      if (!key) return;
      categoryLookup[key] = c.name || c.nome || c.label || 'Categoria';
    });

    (_data.saidas || []).forEach(function (s) {
      var d = _recordDate(s);
      if (!d || d < period.start || d > period.end) return;
      var rawCat = s.categoria_id || s.categoriaId || s.categoryId || s.categoria || s.category || s.financialCategory || 'despesas';
      var key = _normalizeCategoryKey(rawCat);
      var name = categoryLookup[key] || s.categoria_nome || s.categoryName || s.categoria || s.category || 'Despesa';
      if (!categories[key]) categories[key] = { key: key, name: name, total: 0, count: 0, categoryId: rawCat };
      categories[key].total += _outflowValue(s);
      categories[key].count += 1;
    });

    return Object.keys(categories).map(function (key) {
      var item = categories[key];
      var avgMonthly = item.total / lookbackMonths;
      var periodFactor = _state.periodType === 'annual' ? 12 : 1;
      var projectedMonthly = avgMonthly;
      var projected = avgMonthly * periodFactor;
      return {
        key: key,
        name: item.name,
        value: avgMonthly,
        recurrence: 'mensal',
        recurrenceLabel: 'Mensal',
        projectedMonthly: projectedMonthly,
        projected: projected,
        categoryId: item.categoryId,
        source: 'historical'
      };
    });
  }

  function _outflowValue(s) {
    var value = _num(s.valorTotalOriginal || s.valor || s.amount || s.total || 0);
    var paid = _num(s.valorPago || s.valor_pago_total || 0);
    var status = String(s.status || '').toLowerCase();
    if (status === 'parcial') return paid || value;
    return value;
  }

  function _buildVariableCostsForSnapshot() {
    return _forecastModel().variableRows.map(function (r) {
      return {
        key: r.key,
        name: r.name,
        pct: r.pct,
        mode: r.mode,
        projectedMonthly: r.projectedMonthly,
        projected: r.projected
      };
    });
  }

  function _buildFixedCostsForSnapshot() {
    return _forecastModel().fixedRows.map(function (r) {
      return {
        id: r.id,
        source: r.source,
        name: r.name,
        value: r.value,
        recurrence: r.recurrence,
        recurrenceLabel: r.recurrenceLabel,
        projectedMonthly: r.projectedMonthly,
        projected: r.projected,
        categoryId: r.categoryId || '',
        sourceLabel: r.sourceLabel || ''
      };
    });
  }

  function _openSaveSnapshotModal() {
    var months = _monthOptions();
    var body = '' +
      '<div style="display:flex;flex-direction:column;gap:14px;">' +
        '<div class="field" style="margin-bottom:0;">' +
          '<span>Nome da previsão</span>' +
          '<input id="pv-save-name" type="text" value="' + _esc(_state.snapshotName || _defaultSnapshotName()) + '" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:13px;font-family:inherit;outline:none;background:#fff;">' +
        '</div>' +
        '<div class="field" style="margin-bottom:0;">' +
          '<span>Mês da previsão</span>' +
          '<select id="pv-save-month" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:13px;font-family:inherit;outline:none;background:#fff;">' +
            months.map(function (m) {
              var selected = String(_state.snapshotMonthKey || _currentMonthKey()) === String(m.key);
              return '<option value="' + _esc(m.key) + '"' + (selected ? ' selected' : '') + '>' + _esc(m.label) + '</option>';
            }).join('') +
          '</select>' +
          '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;line-height:1.45;">Esse mês será usado depois na Performance e no cenário mensal.</div>' +
        '</div>' +
      '</div>';

    UI.modal({
      title: 'Salvar previsão',
      body: body,
      maxWidth: '540px',
      footer: '<div style="display:flex;gap:10px;justify-content:flex-end;">' +
        '<button onclick="this.closest(\'[style*=\\\'position:fixed;inset:0\\\']\').querySelector(\'.ui-modal-close\').click()" style="border:1.5px solid #D4C8C6;background:#fff;color:#1A1A1A;border-radius:10px;padding:10px 14px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">Cancelar</button>' +
        '<button onclick="Modules.PlanoDeVoo._saveSnapshotFromModal()" style="border:none;background:#C4362A;color:#fff;border-radius:10px;padding:10px 14px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">Salvar previsão</button>' +
      '</div>'
    });
  }

  function _saveSnapshotFromModal() {
    var nameEl = document.getElementById('pv-save-name');
    var monthEl = document.getElementById('pv-save-month');
    var name = String(nameEl && nameEl.value || '').trim();
    var monthKey = String(monthEl && monthEl.value || '').trim() || _currentMonthKey();
    var monthLabel = _monthLabelFromKey(monthKey);
    if (!name) {
      UI.toast('Informe o nome da previsão.', 'error');
      return;
    }
    _state.snapshotName = name;
    _state.snapshotMonthKey = monthKey;
    _state.snapshotMonthLabel = monthLabel;
    _saveSnapshot(monthKey, monthLabel);
  }

  function _saveSnapshot(monthKey, monthLabel) {
    var vm = _forecastModel();
    var name = String(_state.snapshotName || '').trim() || _defaultSnapshotName();
    if (!name || !String(_state.periodType || '').trim() || !_state.scenario || !vm || vm.revenueTotal == null) {
      UI.toast('Preencha nome, período, cenário e resultado antes de salvar.', 'error');
      return;
    }
    monthKey = String(monthKey || _state.snapshotMonthKey || _currentMonthKey());
    monthLabel = String(monthLabel || _state.snapshotMonthLabel || _monthLabelFromKey(monthKey));
    var snapshot = {
      name: name,
      targetMonthKey: monthKey,
      targetMonthLabel: monthLabel,
      periodType: _state.periodType,
      mode: _state.mode,
      annualMode: _state.annualMode,
      scenario: _state.scenario,
      growthSource: _state.growthSource,
      declineSource: _state.declineSource,
      historyMonths: _state.historyMonths,
      growthPct: _num(_state.growthPct),
      declinePct: _num(_state.declinePct),
      seasonality: (_state.seasonality || []).slice(),
      channels: vm.channels.map(function (ch) {
        return {
          key: ch.key,
          label: ch.label,
          mode: ch.mode,
          baseMonthly: ch.baseMonthly,
          periodValue: ch.periodValue,
          include: ch.include,
          historyAvg: ch.historyAvg,
          commissionPct: ch.commissionPct,
          fixedFee: ch.fixedFee,
          taxPct: ch.taxPct,
          locked: ch.locked
        };
      }),
      variableCosts: vm.variableRows.map(function (r) {
        return {
          key: r.key,
          name: r.name,
          pct: r.pct,
          mode: r.mode,
          include: r.include,
          projectedMonthly: r.projectedMonthly,
          projected: r.projected,
          sourceLabel: r.sourceLabel
        };
      }),
      fixedExpenses: vm.fixedRows.map(function (r) {
        return {
          id: r.id,
          source: r.source,
          name: r.name,
          value: r.value,
          recurrence: r.recurrence,
          recurrenceLabel: r.recurrenceLabel,
          include: r.include,
          projectedMonthly: r.projectedMonthly,
          projected: r.projected,
          sourceLabel: r.sourceLabel,
          categoryId: r.categoryId || ''
        };
      }),
      summary: {
        revenue: vm.revenueTotal,
        variableTotal: vm.variableTotal,
        fixedTotal: vm.fixedTotal,
        costs: vm.variableTotal,
        profit: vm.profit,
        cashStart: vm.cashStart,
        cashFinal: vm.cashFinal,
        breakEvenRevenue: vm.breakEvenRevenue,
        targetProfit: vm.targetProfit,
        needForProfit: vm.needForProfit
      },
      periodStart: vm.periodStart,
      periodEnd: vm.periodEnd,
      monthSeries: vm.monthSeries,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    snapshot = _cleanFirestoreData(snapshot);

    DB.add('flight_plans', snapshot).then(function (ref) {
      snapshot.id = ref.id;
      _data.snapshots.unshift(snapshot);
      _state.compareSnapshotId = snapshot.id;
      var monthScenarioPayload = _cleanFirestoreData({
        monthKey: monthKey,
        monthLabel: monthLabel,
        snapshotId: snapshot.id,
        snapshotName: snapshot.name || 'Previsão salva',
        scenario: snapshot.scenario || 'equilibrium',
        summary: snapshot.summary || {},
        periodType: snapshot.periodType || 'monthly',
        updatedAt: new Date().toISOString(),
        selectedAt: new Date().toISOString()
      });
      DB.set('flight_plan_month_scenarios', monthKey, monthScenarioPayload).then(function () {
        _data.monthScenario = monthScenarioPayload;
        UI.toast('Previsão salva para ' + monthLabel + '.', 'success');
        _paintActive();
      }).catch(function (err) {
        UI.toast('Previsão salva, mas não foi possível definir o cenário do mês: ' + err.message, 'warning');
        _paintActive();
      });
    }).catch(function (err) {
      UI.toast('Erro ao salvar previsão: ' + err.message, 'error');
    });
  }

  function _loadSnapshot(id) {
    var s = (_data.snapshots || []).find(function (x) { return String(x.id) === String(id); });
    if (!s) return;
    _state.periodType = s.periodType || 'monthly';
    _state.mode = s.mode || 'automatico';
    _state.annualMode = s.annualMode || 'linear_growth';
    _state.scenario = s.scenario || 'equilibrium';
    _state.growthSource = s.growthSource || 'historical';
    _state.declineSource = s.declineSource || 'historical';
    _state.historyMonths = [3, 6, 12].indexOf(_num(s.historyMonths)) >= 0 ? _num(s.historyMonths) : 3;
    _state.growthPct = _num(s.growthPct != null ? s.growthPct : 10);
    _state.declinePct = _num(s.declinePct != null ? s.declinePct : 5);
    _state.seasonality = (s.seasonality || _state.seasonality).slice(0, 12);
    _state.channelValues = {};
    _state.channelMode = {};
    _state.channelInclude = {};
    _state.costMode = {};
    _state.costPct = {};
    _state.costInclude = {};
    _state.fixedInclude = {};
    (s.channels || []).forEach(function (ch) {
      _state.channelValues[ch.key] = _num(ch.baseMonthly != null ? ch.baseMonthly : ch.periodValue);
      _state.channelMode[ch.key] = ch.mode || (ch.historyAvg > 0 ? 'automatico' : 'manual');
      _state.channelInclude[ch.key] = ch.include !== false;
    });
    (s.variableCosts || []).forEach(function (r) {
      _state.costMode[r.key] = r.mode || 'automatico';
      _state.costPct[r.key] = _num(r.pct);
      _state.costInclude[r.key] = r.include !== false;
    });
    (s.fixedExpenses || []).forEach(function (r) {
      _state.fixedInclude[r.id] = r.include !== false;
    });
    _state.snapshotName = s.name || _defaultSnapshotName();
    _state.snapshotMonthKey = s.targetMonthKey || _state.snapshotMonthKey || _currentMonthKey();
    _state.snapshotMonthLabel = s.targetMonthLabel || _monthLabelFromKey(_state.snapshotMonthKey);
    _state.compareSnapshotId = s.id || '';
    _activeSub = 'simulacao';
    _renderTabs();
      _paintActive();
    Router.navigate('plano-de-voo/simulacao');
    UI.toast('Previsão carregada na simulação.', 'success');
  }

  function _compareSnapshot(id) {
    _state.compareSnapshotId = id || '';
    _activeSub = 'comparacao';
    _renderTabs();
    _paintActive();
    Router.navigate('plano-de-voo/comparacao');
  }

  function _setMonthScenario(id) {
    var s = (_data.snapshots || []).find(function (x) { return String(x.id) === String(id); });
    if (!s) return;
    var monthKey = String(s.targetMonthKey || _currentMonthKey());
    var monthLabel = String(s.targetMonthLabel || _monthLabelFromKey(monthKey));
    var payload = _cleanFirestoreData({
      monthKey: monthKey,
      monthLabel: monthLabel,
      snapshotId: s.id,
      snapshotName: s.name || 'Previsão salva',
      scenario: s.scenario || 'equilibrium',
      summary: s.summary || {},
      periodType: s.periodType || 'monthly',
      updatedAt: new Date().toISOString(),
      selectedAt: new Date().toISOString()
    });
    DB.set('flight_plan_month_scenarios', monthKey, payload).then(function () {
      _data.monthScenario = payload;
      UI.toast('Cenário do mês definido.', 'success');
      _paintActive();
    }).catch(function (err) {
      UI.toast('Erro ao definir cenário do mês: ' + err.message, 'error');
    });
  }

  function _currentMonthKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function _currentMonthLabel() {
    var d = new Date();
    var label = MONTHS && MONTHS[d.getMonth()] ? MONTHS[d.getMonth()] : String(d.getMonth() + 1).padStart(2, '0');
    return label + '/' + d.getFullYear();
  }

  function _monthLabelFromKey(key) {
    var str = String(key || '');
    var parts = str.split('-');
    if (parts.length !== 2) return _currentMonthLabel();
    var year = parts[0];
    var monthIndex = Math.max(0, Math.min(11, parseInt(parts[1], 10) - 1));
    var monthLabel = MONTHS && MONTHS[monthIndex] ? MONTHS[monthIndex] : String(monthIndex + 1).padStart(2, '0');
    return monthLabel + '/' + year;
  }

  function _monthOptions() {
    var today = new Date();
    var out = [];
    for (var i = 0; i < 12; i += 1) {
      var d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      out.push({ key: key, label: MONTHS[d.getMonth()] + '/' + d.getFullYear() });
    }
    return out;
  }

  function _isMonthScenarioSnapshot(s) {
    var m = _data.monthScenario || {};
    return !!m && String(m.snapshotId || '') === String(s && s.id || '');
  }

  function _monthScenarioBanner(monthScenario) {
    var snap = (_data.snapshots || []).find(function (x) { return String(x.id) === String(monthScenario.snapshotId || ''); }) || {};
    return '' +
      '<div style="background:#EDFAF3;border:1px solid #CDEFD8;border-radius:14px;padding:14px 16px;margin-bottom:14px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">' +
        '<div style="min-width:0;">' +
          '<div style="font-size:11px;font-weight:900;color:#1A9E5A;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Cenário do mês atual</div>' +
          '<div style="font-family:\'League Spartan\',sans-serif;font-size:18px;font-weight:900;color:#1A1A1A;">' + _esc(monthScenario.snapshotName || snap.name || 'Previsão salva') + '</div>' +
          '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">' + _esc(monthScenario.monthLabel || _currentMonthLabel()) + ' · ' + _esc(_scenarioLabel(monthScenario.scenario || snap.scenario || 'equilibrium')) + '</div>' +
        '</div>' +
        '<div style="font-size:12px;font-weight:800;color:#1A9E5A;background:#fff;border-radius:999px;padding:7px 10px;">' +
          'Usado na próxima análise' +
        '</div>' +
      '</div>';
  }

  function _setCompareSnapshot(id) {
    _state.compareSnapshotId = id || '';
    _paintActive();
  }

  function _setPeriodType(v) {
    _state.periodType = v === 'annual' ? 'annual' : 'monthly';
    _state.snapshotName = _defaultSnapshotName();
    _ensureStateDefaults();
    _paintActive();
  }

  function _setMode(v) {
    _state.mode = v === 'manual' ? 'manual' : 'automatico';
    _paintActive();
  }

  function _setScenario(v) {
    _state.scenario = SCENARIOS[v] ? v : 'equilibrium';
    _paintActive();
  }

  function _setGrowthSource(v) {
    _state.growthSource = v === 'manual' ? 'manual' : 'historical';
    _paintActive();
  }

  function _setDeclineSource(v) {
    _state.declineSource = v === 'manual' ? 'manual' : 'historical';
    _paintActive();
  }

  function _setHistoryMonths(v) {
    var n = parseInt(v, 10);
    _state.historyMonths = [3, 6, 12].indexOf(n) >= 0 ? n : 3;
    _paintActive();
  }

  function _setAnnualMode(v) {
    var allowed = ['linear_growth', 'linear_decline', 'seasonality_manual'];
    _state.annualMode = allowed.indexOf(v) >= 0 ? v : 'linear_growth';
    _paintActive();
  }

  function _setGrowthPct(v) {
    _state.growthPct = _num(v);
    _paintActive();
  }

  function _setDeclinePct(v) {
    _state.declinePct = _num(v);
    _paintActive();
  }

  function _setSeasonality(idx, v) {
    _state.seasonality[idx] = _num(v);
    _paintActive();
  }

  function _setSnapshotName(v) {
    _state.snapshotName = String(v || '');
  }

  function _setTargetProfit(v) {
    _state.currentTargetProfit = _num(v);
    _paintActive();
  }

  function _setChannelForecast(key, v) {
    _state.channelValues[key] = _num(v);
    _paintActive();
  }

  function _toggleChannelInclude(key, checked) {
    _state.channelInclude[key] = !!checked;
    _paintActive();
  }

  function _setCostMode(key, v) {
    _state.costMode[key] = v === 'manual' ? 'manual' : 'automatico';
    _paintActive();
  }

  function _setCostPct(key, v) {
    _state.costPct[key] = _num(v);
    _paintActive();
  }

  function _toggleCostInclude(key, checked) {
    _state.costInclude[key] = !!checked;
    _paintActive();
  }

  function _toggleFixedInclude(id, checked) {
    _state.fixedInclude[id] = !!checked;
    _paintActive();
  }

  function _transformFixedExpense(id) {
    var row = _fixedRowsForForecast().find(function (x) { return x.id === id; });
    if (!row) return;
    if (row.source !== 'historical') {
      UI.toast('Esta linha já existe como conta a pagar.', 'info');
      return;
    }
    var due = _addMonths(new Date(), 1);
    due.setDate(1);
    var payload = {
      nome: row.name,
      valor: row.value,
      valorTotalOriginal: row.value,
      valorParcela: row.value,
      status: 'pendente',
      vencimento: due.toISOString().slice(0, 10),
      recorrente: true,
      frequencia: 'mensal',
      categoriaId: row.categoryId || '',
      categoria_id: row.categoryId || '',
      source: 'plano_voo',
      note: 'Gerado a partir do Plano de Voo'
    };
    DB.add('contas_pagar', payload).then(function () {
      UI.toast('Conta a pagar criada a partir da previsão.', 'success');
      _load().then(function () {
        _ensureStateDefaults();
        _paintActive();
      });
    }).catch(function (err) {
      UI.toast('Erro ao criar conta a pagar: ' + err.message, 'error');
    });
  }

  function _comparisonSnapshotCurrent() {
    var snap = _selectedSnapshot();
    return snap || _forecastModel();
  }

  function _actualForSnapshot(snap) {
    var periodStart = _dateFromAny(snap.periodStart) || _periodInfo().start;
    var periodEnd = _dateFromAny(snap.periodEnd) || _periodInfo().end;
    return _actualForRange(periodStart, periodEnd);
  }

  function _actualForRange(start, end) {
    var orders = _realOrders().filter(function (o) {
      var d = _orderDate(o);
      return d && d >= start && d <= end;
    });
    var revenue = orders.reduce(function (s, o) { return s + _orderRevenue(o); }, 0);
    var variable = orders.reduce(function (s, o) { return s + _orderVariableCost(o); }, 0);
    var fixed = _actualFixedCost(start, end);
    var profit = revenue - variable - fixed;
    var cashFinal = _currentCash() + profit;
    return { revenue: revenue, costs: variable, fixed: fixed, profit: profit, cashFinal: cashFinal };
  }

  function _actualFixedCost(start, end) {
    var rows = [].concat(_data.movements || [], _data.saidas || []).filter(function (m) {
      if (!m) return false;
      var t = String(m.tipo || m.type || '').toLowerCase();
      if (t && t !== 'saida' && t !== 'saída' && t !== 'expense') return false;
      var d = _recordDate(m);
      return d && d >= start && d <= end;
    });
    return rows.reduce(function (s, m) {
      return s + _outflowValue(m);
    }, 0);
  }

  function _compareTile(label, forecast, actual, base) {
    var diff = actual - forecast;
    var pct = forecast ? (actual / forecast) * 100 : 0;
    return _kpi(label, _fmtMoney(actual), 'Previsto ' + _fmtMoney(forecast) + ' · ' + (forecast ? pct.toFixed(1) + '% atingido' : 'Sem base'));
  }

  function _simpleCompareInsight(label, forecast, actual) {
    var diff = actual - forecast;
    return {
      value: _fmtMoney(actual),
      text: diff >= 0 ? 'Você está ' + _fmtMoney(diff) + ' acima do previsto em ' + label.toLowerCase() + '.' : 'Faltam ' + _fmtMoney(Math.abs(diff)) + ' para atingir o previsto em ' + label.toLowerCase() + '.'
    };
  }

  function _achievementPct(forecast, actual) {
    return forecast > 0 ? (actual / forecast) * 100 : 0;
  }

  function _achievementLabel(forecast, actual) {
    if (!forecast) return 'Sem previsão suficiente';
    return Math.round(_achievementPct(forecast, actual)) + '% da meta alcançada';
  }

  function _deltaLabel(forecast, actual) {
    var diff = actual - forecast;
    return (diff >= 0 ? '+' : '') + _fmtMoney(diff);
  }

  function _deltaHint(forecast, actual) {
    var diff = actual - forecast;
    return diff >= 0 ? 'Você está acima do previsto.' : 'Você está abaixo do previsto.';
  }

  function _insightBox(title, value, text) {
    return '' +
      '<div style="background:#FBF5F3;border:1px solid #F2EDED;border-radius:12px;padding:14px 16px;">' +
        '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">' + _esc(title) + '</div>' +
        '<div style="font-family:\'League Spartan\',sans-serif;font-size:24px;font-weight:900;color:#1A1A1A;margin-bottom:4px;">' + _esc(value) + '</div>' +
        '<div style="font-size:12px;color:#8A7E7C;line-height:1.5;">' + _esc(text) + '</div>' +
      '</div>';
  }

  function _kpi(label, value, sub) {
    return '' +
      '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:18px;">' +
        '<span style="display:block;font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">' + _esc(label) + '</span>' +
        '<strong style="display:block;font-family:\'League Spartan\',sans-serif;font-size:28px;color:#C4362A;margin-bottom:4px;">' + _esc(value) + '</strong>' +
        '<small style="font-size:12px;color:#8A7E7C;">' + _esc(sub) + '</small>' +
      '</div>';
  }

  function _miniTile(label, value) {
    return '' +
      '<div style="background:#FBF5F3;border:1px solid #F2EDED;border-radius:12px;padding:10px 12px;">' +
        '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">' + _esc(label) + '</div>' +
        '<div style="font-family:\'League Spartan\',sans-serif;font-size:18px;font-weight:900;color:#1A1A1A;">' + _esc(value) + '</div>' +
      '</div>';
  }

  function _emptyState(title, subtitle) {
    return '' +
      '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:28px;text-align:center;color:#8A7E7C;">' +
        '<div style="font-family:\'League Spartan\',sans-serif;font-size:20px;font-weight:900;color:#1A1A1A;margin-bottom:8px;">' + _esc(title) + '</div>' +
        '<div style="font-size:13px;line-height:1.6;max-width:640px;margin:0 auto;">' + _esc(subtitle) + '</div>' +
      '</div>';
  }

  function _emptyHint(title, subtitle) {
    return '' +
      '<div style="background:#FBF5F3;border:1px dashed #E8D9D6;border-radius:12px;padding:16px 18px;color:#8A7E7C;margin-bottom:10px;">' +
        '<div style="font-size:13px;font-weight:900;color:#1A1A1A;margin-bottom:4px;">' + _esc(title) + '</div>' +
        '<div style="font-size:12px;line-height:1.5;">' + _esc(subtitle) + '</div>' +
      '</div>';
  }

  function _selectField(id, label, options, value, onchange) {
    return '' +
      '<label class="field" style="margin-bottom:0;">' +
        '<span>' + _esc(label) + '</span>' +
        '<select id="' + id + '" onchange="' + onchange + '" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:11px;background:#fff;font-size:13px;font-family:inherit;outline:none;">' +
          options.map(function (o) {
            return '<option value="' + _esc(o[0]) + '"' + (String(value) === String(o[0]) ? ' selected' : '') + '>' + _esc(o[1]) + '</option>';
          }).join('') +
        '</select>' +
      '</label>';
  }

  function _inputField(id, label, value, type, onchange) {
    return '' +
      '<label class="field" style="margin-bottom:0;">' +
        '<span>' + _esc(label) + '</span>' +
        '<input id="' + id + '" type="' + (type || 'text') + '" value="' + _esc(value != null ? value : '') + '" onchange="' + onchange + '" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:11px;background:#fff;font-size:13px;font-family:inherit;outline:none;">' +
      '</label>';
  }

  function _snapshotPeriodLabel(s) {
    var start = _fmtDate(_dateFromAny(s.periodStart));
    var end = _fmtDate(_dateFromAny(s.periodEnd));
    return (s.periodType === 'annual' ? 'Anual' : 'Mensal') + ' · ' + start + ' → ' + end;
  }

  function _periodInfo() {
    var now = new Date();
    if (_state.periodType === 'annual') {
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
        label: 'Ano atual'
      };
    }
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      label: 'Mês atual'
    };
  }

  function _completeMonthsRange(monthsBack) {
    var now = new Date();
    var end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    var start = new Date(end.getFullYear(), end.getMonth() - monthsBack + 1, 1);
    return { start: start, end: end };
  }

  function _annualMonthFactors() {
    var scenario = _scenarioMultiplier();
    var arr = [];
    for (var i = 0; i < 12; i += 1) {
      var f = 1;
      if (_state.annualMode === 'linear_growth') {
        f = Math.pow(1 + (_growthAdjustmentPct() / 100), i);
      } else if (_state.annualMode === 'linear_decline') {
        f = Math.pow(Math.max(0, 1 - (_declineAdjustmentPct() / 100)), i);
      } else {
        f = _num(_state.seasonality[i] != null ? _state.seasonality[i] : 100) / 100;
      }
      arr.push(f * scenario);
    }
    return arr;
  }

  function _growthAdjustmentPct() {
    if (_state.growthSource === 'historical') {
      var hist = _historicalGrowthAdjustmentPct();
      return hist == null ? 0 : hist;
    }
    return _num(_state.growthPct);
  }

  function _declineAdjustmentPct() {
    if (_state.declineSource === 'historical') {
      var hist = _historicalDeclineAdjustmentPct();
      return hist == null ? 0 : hist;
    }
    return _num(_state.declinePct);
  }

  function _historicalGrowthAdjustmentPct() {
    var trend = _historicalTrendPct(_historyMonthsBack());
    if (trend == null) return null;
    return Math.max(0, trend);
  }

  function _historicalDeclineAdjustmentPct() {
    var trend = _historicalTrendPct(_historyMonthsBack());
    if (trend == null) return null;
    return Math.max(0, -trend);
  }

  function _growthHistoricalNote() {
    var back = _historyMonthsBack();
    var trend = _historicalTrendPct(back);
    if (trend == null) return 'Sem base histórica suficiente. Use Manual para definir o ajuste.';
    return 'Base histórica dos últimos ' + back + ' meses completos vs. os ' + back + ' meses anteriores: ' + _fmtPct(Math.max(0, trend));
  }

  function _declineHistoricalNote() {
    var back = _historyMonthsBack();
    var trend = _historicalTrendPct(back);
    if (trend == null) return 'Sem base histórica suficiente. Use Manual para definir o ajuste.';
    return 'Base histórica dos últimos ' + back + ' meses completos vs. os ' + back + ' meses anteriores: ' + _fmtPct(Math.max(0, -trend));
  }

  function _scenarioHelpText() {
    var scenario = _state.scenario || 'equilibrium';
    if (scenario === 'equilibrium') {
      return 'Cenário de equilíbrio: mantém a base sem ajuste percentual extra.';
    }
    if (scenario === 'survival') {
      return 'Cenário de sobrevivência: aplica uma queda de ' + _fmtPct(_declineAdjustmentPct()) + ' sobre a receita base. Fonte do ajuste: ' + (_state.declineSource === 'historical' ? 'Histórico' : 'Manual') + '.';
    }
    var label = scenario === 'growth' ? 'Crescimento' : 'Expansão';
    return 'Cenário de ' + label.toLowerCase() + ': aplica um crescimento de ' + _fmtPct(_growthAdjustmentPct()) + ' sobre a receita base. Fonte do ajuste: ' + (_state.growthSource === 'historical' ? 'Histórico' : 'Manual') + '.';
  }

  function _historicalTrendPct(monthsBack) {
    var back = monthsBack || 3;
    var current = _compareRevenueBlock(back, 0);
    var previous = _compareRevenueBlock(back, back);
    if (!previous.hasData || previous.total <= 0) return null;
    return ((current.total - previous.total) / previous.total) * 100;
  }

  function _compareRevenueBlock(monthsBack, offsetMonths) {
    var now = new Date();
    var endRef = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    var end = new Date(endRef.getFullYear(), endRef.getMonth() - (offsetMonths || 0), 0, 23, 59, 59, 999);
    if ((offsetMonths || 0) === 0) end = endRef;
    var start = new Date(end.getFullYear(), end.getMonth() - (monthsBack - 1), 1);
    var total = 0;
    var hasData = false;
    _realOrders().forEach(function (o) {
      var d = _orderDate(o);
      if (!d || d < start || d > end) return;
      total += _orderRevenue(o);
      hasData = true;
    });
    return { total: total, hasData: hasData, start: start, end: end };
  }

  function _scenarioMultiplier() {
    var s = SCENARIOS[_state.scenario] || SCENARIOS.equilibrium;
    var adjust = 1;
    if (_state.scenario === 'survival') adjust = Math.max(0, 1 - (_declineAdjustmentPct() / 100));
    else if (_state.scenario === 'growth' || _state.scenario === 'expansion') adjust = 1 + (_growthAdjustmentPct() / 100);
    return s.factor * adjust;
  }

  function _realOrders() {
    var finals = {
      confirmado: true,
      'em preparacao': true,
      'em camino': true,
      'em caminho': true,
      'listo para recoger': true,
      entregado: true,
      finalizado: true,
      pago: true
    };
    return (_data.orders || []).filter(function (o) {
      var status = _normalizeText(o.status || '');
      var payment = _normalizeText(o.paymentStatus || '');
      if (status === 'cancelado') return false;
      return payment === 'pago' || payment === 'parcial' || finals[status];
    });
  }

  function _orderDate(o) {
    return _dateFromAny(o.createdAt || o.date || o.created_at || o.orderDate || o.updatedAt);
  }

  function _orderRevenue(o) {
    return _num(o.finalSubtotal != null ? o.finalSubtotal : (o.total != null ? o.total : (o.subtotal != null ? o.subtotal : 0)));
  }

  function _orderChannelLabel(o) {
    return String(o.channel || o.source || o.salesChannel || 'Cardápio');
  }

  function _channelKey(v) {
    return _normalizeText(v || '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cardapio';
  }

  function _channelCatalog() {
    var map = {};
    var list = [];
    (_data.canais || []).forEach(function (ch) {
      var key = _channelKey(ch.name || ch.key || '');
      if (!key || map[key]) return;
      map[key] = true;
      list.push({
        key: key,
        name: ch.name || ch.key || 'Canal',
        commissionPct: _num(ch.commissionPct),
        fixedFee: _num(ch.fixedFee),
        taxPct: _num(ch.taxPct),
        locked: !!ch.locked
      });
    });
    (_data.orders || []).forEach(function (o) {
      var label = _orderChannelLabel(o);
      var key = _channelKey(label);
      if (!key || map[key]) return;
      map[key] = true;
      list.push({ key: key, name: label, commissionPct: 0, fixedFee: 0, taxPct: 0, locked: false });
    });
    if (!list.length) {
      list = [
        { key: 'cardapio', name: 'Cardápio', commissionPct: 0, fixedFee: 0, taxPct: 0, locked: true },
        { key: 'whatsapp', name: 'WhatsApp', commissionPct: 0, fixedFee: 0, taxPct: 0, locked: false },
        { key: 'marketplace', name: 'Marketplace', commissionPct: 25, fixedFee: 0, taxPct: 21, locked: false }
      ];
    }
    return list;
  }

  function _channelHistoryAverage(key, monthsBack) {
    var range = _completeMonthsRange(monthsBack || _historyMonthsBack());
    var sum = 0;
    var monthTotals = {};
    _realOrders().forEach(function (o) {
      var d = _orderDate(o);
      if (!d || d < range.start || d > range.end) return;
      if (_channelKey(_orderChannelLabel(o)) !== key) return;
      var mk = _monthKey(d);
      monthTotals[mk] = (monthTotals[mk] || 0) + _orderRevenue(o);
    });
    Object.keys(monthTotals).forEach(function (k) { sum += monthTotals[k]; });
    return {
      sum: sum,
      avg: monthsBack ? (sum / monthsBack) : 0,
      hasData: sum > 0,
      lookbackMonths: monthsBack || _historyMonthsBack()
    };
  }

  function _monthKey(d) {
    if (!d) return '';
    var dt = _dateFromAny(d);
    if (!dt) return '';
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
  }

  function _historicalProductCostPct(monthsBack) {
    var range = _completeMonthsRange(monthsBack || _historyMonthsBack());
    var revenue = 0;
    var cost = 0;
    _realOrders().forEach(function (o) {
      var d = _orderDate(o);
      if (!d || d < range.start || d > range.end) return;
      revenue += _orderRevenue(o);
      (o.items || []).forEach(function (item) {
        cost += _orderItemCost(item);
      });
    });
    return revenue > 0 ? (cost / revenue) * 100 : 0;
  }

  function _channelCommissionPct(channels) {
    var total = 0;
    var weighted = 0;
    (channels || []).forEach(function (ch) {
      if (!ch.include) return;
      total += ch.periodValue;
      weighted += ch.periodValue * _num(ch.commissionPct);
    });
    return total > 0 ? weighted / total : _num(_data.dinheiro.marketplaceCommissionPct || 0);
  }

  function _productById(id) {
    return (_data.products || []).find(function (p) {
      return String(p.id) === String(id) || String(p.productId) === String(id);
    }) || null;
  }

  function _productUnitCost(p) {
    if (!p) return 0;
    return _num(
      p.cost != null ? p.cost :
      p.custo != null ? p.custo :
      p.purchasePrice != null ? p.purchasePrice :
      p.preco_compra != null ? p.preco_compra :
      p.custo_atual != null ? p.custo_atual :
      p.custoAtual != null ? p.custoAtual :
      p.precoCompra != null ? p.precoCompra :
      p.custoCompra != null ? p.custoCompra :
      p.purchase_price != null ? p.purchase_price :
      p.directCost != null ? p.directCost : 0
    );
  }

  function _orderItemCost(item) {
    if (!item) return 0;
    var qty = _num(item.qty != null ? item.qty : (item.quantity != null ? item.quantity : 1)) || 1;
    var productId = item.productId || item.idProduto || item.product_id || item.ref || item.id;
    var product = _productById(productId);
    var cost = _productUnitCost(product);
    if (!cost) {
      cost = _num(
        item.cost != null ? item.cost :
        item.custo != null ? item.custo :
        item.purchasePrice != null ? item.purchasePrice :
        item.preco_compra != null ? item.preco_compra :
        item.valorCusto != null ? item.valorCusto : 0
      );
    }
    return cost * qty;
  }

  function _orderVariableCost(o) {
    var total = 0;
    (o.items || []).forEach(function (item) {
      total += _orderItemCost(item);
    });
    return total;
  }

  function _normalizeRecurrence(v) {
    var text = _normalizeText(v || '');
    if (text.indexOf('seman') >= 0) return 'semanal';
    if (text.indexOf('anual') >= 0) return 'anual';
    if (text.indexOf('única') >= 0 || text.indexOf('unica') >= 0 || text.indexOf('one') >= 0 || text.indexOf('single') >= 0) return 'única';
    return 'mensal';
  }

  function _recurrenceLabel(v) {
    return ({ semanal: 'Semanal', mensal: 'Mensal', anual: 'Anual', 'única': 'Única' })[v] || 'Mensal';
  }

  function _periodRecurrenceFactor(v) {
    var recurrence = _normalizeRecurrence(v);
    if (_state.periodType === 'annual') {
      if (recurrence === 'semanal') return { monthly: 4.33, period: 52 };
      if (recurrence === 'anual') return { monthly: 1 / 12, period: 1 };
      if (recurrence === 'única') return { monthly: 1, period: 1 };
      return { monthly: 1, period: 12 };
    }
    if (recurrence === 'semanal') return { monthly: 4.33, period: 4.33 };
    if (recurrence === 'anual') return { monthly: 1 / 12, period: 1 / 12 };
    if (recurrence === 'única') return { monthly: 1, period: 1 };
    return { monthly: 1, period: 1 };
  }

  function _normalizeCategoryKey(v) {
    return _normalizeText(v || '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'despesas';
  }

  function _parseCategoryLabel(v) {
    if (!v) return 'Despesa';
    return String(v).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function _openPayablesRows() {
    return _openPayables().map(function (row) {
      var periodFactor = _periodRecurrenceFactor(row.recurrence);
      var projectedMonthly = row.value * periodFactor.monthly;
      var projected = _state.periodType === 'annual' ? row.value * periodFactor.period : row.value * periodFactor.period;
      return {
        id: row.id,
        source: 'payable',
        name: row.name,
        value: row.value,
        recurrence: row.recurrence,
        recurrenceLabel: row.recurrenceLabel,
        projectedMonthly: projectedMonthly,
        projected: projected,
        categoryId: row.categoryId,
        sourceLabel: 'Conta a pagar'
      };
    });
  }

  function _mergeHistoricalCategories() {
    var rows = _historicalExpenseRows();
    var payables = _openPayablesRows();
    var payableNames = payables.map(function (p) { return _normalizeText(p.name); });
    return rows.filter(function (r) {
      var normalized = _normalizeText(r.name);
      return !payableNames.some(function (name) {
        return name.indexOf(normalized) >= 0 || normalized.indexOf(name) >= 0;
      });
    });
  }

  function _historicalExpenseRows() {
    var monthsBack = _historyMonthsBack();
    var range = _completeMonthsRange(monthsBack);
    var grouped = {};
    var lookup = {};
    (_data.categorias || []).forEach(function (cat) {
      var key = _normalizeCategoryKey(cat.id || cat.slug || cat.name || cat.nome);
      if (!key) return;
      lookup[key] = cat.name || cat.nome || cat.label || 'Despesa';
    });
    (_data.saidas || []).forEach(function (s) {
      var d = _recordDate(s);
      if (!d || d < range.start || d > range.end) return;
      var rawCat = s.categoria_id || s.categoriaId || s.categoryId || s.categoria || s.category || s.financialCategory || 'despesas';
      var key = _normalizeCategoryKey(rawCat);
      if (!grouped[key]) grouped[key] = { key: key, name: lookup[key] || _parseCategoryLabel(rawCat), total: 0, categoryId: rawCat, count: 0 };
      grouped[key].total += _outflowValue(s);
      grouped[key].count += 1;
    });
    return Object.keys(grouped).map(function (key) {
      var g = grouped[key];
      var averageMonthly = g.total / monthsBack;
      var factor = _state.periodType === 'annual' ? 12 : 1;
      return {
        key: g.key,
        name: g.name,
        value: averageMonthly,
        recurrence: 'mensal',
        recurrenceLabel: 'Mensal',
        projectedMonthly: averageMonthly,
        projected: averageMonthly * factor,
        categoryId: g.categoryId,
        source: 'historical',
        sourceLabel: 'Categoria financeira'
      };
    });
  }

  function _fixedRowsForForecast() {
    return _openPayablesRows().concat(_mergeHistoricalCategories());
  }

  function _forecastMonthFactorLabel() {
    if (_state.periodType === 'annual') {
      if (_state.annualMode === 'linear_growth') return 'Crescimento linear';
      if (_state.annualMode === 'linear_decline') return 'Queda linear';
      return 'Sazonalidade manual';
    }
    return 'Base mensal';
  }

  function _emptyStateIfNeeded() {
    return false;
  }

  function _currentCash() {
    var total = 0;
    (_data.contas || []).filter(function (c) { return c.ativo !== false; }).forEach(function (c) {
      var start = _num(c.saldo_inicial != null ? c.saldo_inicial : c.saldoInicial);
      var ent = (_data.movements || []).filter(function (m) {
        return String(m.conta_id || m.contaId || m.conta_bancaria_id || m.contaBancariaId || '') === String(c.id) && _movementType(m) === 'entrada' && _movementActive(m);
      }).reduce(function (s, m) {
        return s + _movementValueIn(m);
      }, 0);
      var sai = (_data.movements || []).filter(function (m) {
        return String(m.conta_id || m.contaId || m.conta_bancaria_id || m.contaBancariaId || '') === String(c.id) && _movementType(m) === 'saida' && _movementActive(m);
      }).reduce(function (s, m) {
        return s + _movementValueOut(m);
      }, 0);
      total += start + ent - sai;
    });
    return total;
  }

  function _movementType(m) {
    return _normalizeText(m.tipo || m.type || '');
  }

  function _movementActive(m) {
    var st = _normalizeText(m.status || '');
    return st === 'efetivado' || st === 'pago' || st === 'parcial' || st === 'recebido' || st === 'received';
  }

  function _movementValueIn(m) {
    var st = _normalizeText(m.status || '');
    var value = _num(m.valorRecebido || m.valor_recebido_total || m.valorTotalOriginal || m.valorParcela || m.valor || 0);
    if (!value && st === 'efetivado') value = _num(m.valor || 0);
    return value;
  }

  function _movementValueOut(m) {
    var st = _normalizeText(m.status || '');
    var value = _num(m.valorPago || m.valor_pago_total || m.valorTotalOriginal || m.valorParcela || m.valor || 0);
    if (!value && st === 'pago') value = _num(m.valor || 0);
    return value;
  }

  function _actualForRange(start, end) {
    var orders = _realOrders().filter(function (o) {
      var d = _orderDate(o);
      return d && d >= start && d <= end;
    });
    var revenue = orders.reduce(function (s, o) { return s + _orderRevenue(o); }, 0);
    var costs = orders.reduce(function (s, o) { return s + _orderVariableCost(o); }, 0);
    var fixed = (_data.movements || []).filter(function (m) {
      var d = _recordDate(m);
      return d && d >= start && d <= end && _movementType(m) === 'saida' && _movementActive(m);
    }).reduce(function (s, m) {
      return s + _movementValueOut(m);
    }, 0);
    var profit = revenue - costs - fixed;
    return {
      revenue: revenue,
      costs: costs,
      fixed: fixed,
      profit: profit,
      cashFinal: _currentCash() + profit
    };
  }

  function _recordDate(obj) {
    return _dateFromAny(obj && (obj.createdAt || obj.updatedAt || obj.date || obj.data || obj.vencimento || obj.dueDate || obj.data_pagamento || obj.dataPagamento));
  }

  function _ts(v) {
    var d = _dateFromAny(v);
    return d ? d.getTime() : 0;
  }

  function _dateFromAny(v) {
    if (!v) return null;
    try {
      if (typeof v.toDate === 'function') return v.toDate();
      if (v instanceof Date) return v;
      var d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    } catch (e) {
      return null;
    }
  }

  function _fmtDate(d) {
    var dt = _dateFromAny(d);
    if (!dt) return '—';
    return UI.fmtDate ? UI.fmtDate(dt) : dt.toISOString().slice(0, 10);
  }

  function _fmtMoney(v) {
    var n = _num(v);
    return '€ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function _fmtPct(v) {
    return _num(v).toFixed(1).replace('.', ',') + '%';
  }

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m];
    });
  }

  function _fmtNum(v, decimals) {
    return _num(v).toFixed(decimals || 0).replace('.', ',');
  }

  function _num(v) {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v).trim();
    if (!s) return 0;
    var cleaned = s.replace(/[^\d,.-]/g, '');
    var lastComma = cleaned.lastIndexOf(',');
    var lastDot = cleaned.lastIndexOf('.');
    if (lastComma > -1 && lastDot > -1) {
      if (lastComma > lastDot) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (lastComma > -1) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
    var n = parseFloat(cleaned);
    return isFinite(n) ? n : 0;
  }

  function _normalizeText(v) {
    return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function _scenarioLabel(key) {
    return (SCENARIOS[key] && SCENARIOS[key].label) || 'Equilíbrio';
  }

  function _emptyHintCard(title, text) {
    return '' +
      '<div style="background:#FBF5F3;border:1px dashed #E8D9D6;border-radius:12px;padding:16px 18px;margin-bottom:10px;">' +
        '<div style="font-size:13px;font-weight:900;color:#1A1A1A;margin-bottom:4px;">' + _esc(title) + '</div>' +
        '<div style="font-size:12px;color:#8A7E7C;line-height:1.5;">' + _esc(text) + '</div>' +
      '</div>';
  }

  function _compareToCurrent() {
    _state.compareSnapshotId = '';
    _activeSub = 'comparacao';
    _renderTabs();
    _paintActive();
    Router.navigate('plano-de-voo/comparacao');
  }

  function _selectCurrentForComparison() {
    _state.compareSnapshotId = '';
    _paintActive();
  }

  function _snapshotPeriodLabelCurrent() {
    var p = _periodInfo();
    return (_state.periodType === 'annual' ? 'Anual' : 'Mensal') + ' · ' + _fmtDate(p.start) + ' → ' + _fmtDate(p.end);
  }

  function _outflowsLabel() {
    return _state.periodType === 'annual' ? 'Ano atual' : 'Mês atual';
  }

  function _emptyHint(title, subtitle) {
    return _emptyHintCard(title, subtitle);
  }

  function _selectedSnapshotLabel() {
    if (!_state.compareSnapshotId) return 'Previsão atual';
    var s = (_data.snapshots || []).find(function (x) { return String(x.id) === String(_state.compareSnapshotId); });
    return s ? (s.name || 'Previsão salva') : 'Previsão atual';
  }

  function _actualForSnapshotSummary(snap) {
    var base = _actualForRange(_dateFromAny(snap.periodStart) || _periodInfo().start, _dateFromAny(snap.periodEnd) || _periodInfo().end);
    return base;
  }

  function _achievementLabelCompact(forecast, actual) {
    return forecast > 0 ? _achievementPct(forecast, actual).toFixed(1) + '% da meta alcançada' : 'Sem dados suficientes';
  }

  function _compareInsights(vm) {
    return {
      revenueInsight: vm.revenueInsight || { value: '—', text: 'Sem dados.' },
      costInsight: vm.costInsight || { value: '—', text: 'Sem dados.' },
      profitInsight: vm.profitInsight || { value: '—', text: 'Sem dados.' }
    };
  }

  function _comparisonSummaryLabel(forecast, actual) {
    if (!forecast) return 'Sem base suficiente';
    var diff = actual - forecast;
    return diff >= 0 ? 'Você está acima do previsto.' : 'Você está abaixo do previsto.';
  }

  function _comparisonSnapshotModel() {
    return _comparisonModel(_selectedSnapshot());
  }

  function _compareSnapshotActive() {
    return _state.compareSnapshotId || '';
  }

  function _copySnapshotId() {}

  function _comparisonTargetSnapshot() {
    return _selectedSnapshot();
  }

  function _snapshotPeriodRange(s) {
    return {
      start: _dateFromAny(s.periodStart) || _periodInfo().start,
      end: _dateFromAny(s.periodEnd) || _periodInfo().end
    };
  }

  function _scenarioFactorForRow() {
    return _scenarioMultiplier();
  }

  function _forecastMonthLabel() {
    var d = new Date();
    return MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  function _historyMonthsBack() {
    return [3, 6, 12].indexOf(_num(_state.historyMonths)) >= 0 ? _num(_state.historyMonths) : 3;
  }

  function _monthSeriesTitle() {
    return _state.periodType === 'annual' ? 'Resumo mensal do ano' : 'Resumo mensal';
  }

  function _selectedForecastLabel() {
    return _state.periodType === 'annual' ? 'Anual' : 'Mensal';
  }

  function _lookbackLabel() {
    return _historyMonthsBack() + ' meses';
  }

  function _compareTitle() {
    return _state.compareSnapshotId ? 'Previsão salva' : 'Previsão atual';
  }

  function _periodStartEnd() {
    return _periodInfo();
  }

  function _buildComparisonData() {
    return _comparisonModel(_selectedSnapshot());
  }

  function _orderLabelKey(v) {
    return _normalizeText(v || '');
  }

  function _currentSnapshotSummary() {
    var vm = _forecastModel();
    return vm;
  }

  function _snapshotCreatedLabel(s) {
    return _fmtDate(_dateFromAny(s.createdAt || s.updatedAt));
  }

  function _buildChannelSummary() {
    return _channelCatalog();
  }

  function _forceRefresh() {
    _ensureStateDefaults();
    _paintActive();
  }

  function _setupDefaultsFromData() {
    _ensureStateDefaults();
  }

  function _cleanFirestoreData(value) {
    if (value == null) return value;
    if (Array.isArray(value)) {
      return value.map(_cleanFirestoreData).filter(function (item) { return item !== undefined; });
    }
    if (typeof value === 'object') {
      var out = {};
      Object.keys(value).forEach(function (key) {
        var cleaned = _cleanFirestoreData(value[key]);
        if (cleaned !== undefined) out[key] = cleaned;
      });
      return out;
    }
    if (typeof value === 'number') {
      return isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    return undefined;
  }

  function destroy() {}

  return {
    render: render,
    destroy: destroy,
    _switchSub: _switchSub,
    _setPeriodType: _setPeriodType,
    _setMode: _setMode,
    _setScenario: _setScenario,
    _setAnnualMode: _setAnnualMode,
    _setGrowthPct: _setGrowthPct,
    _setDeclinePct: _setDeclinePct,
    _setSeasonality: _setSeasonality,
    _setSnapshotName: _setSnapshotName,
    _setTargetProfit: _setTargetProfit,
    _setChannelForecast: _setChannelForecast,
    _toggleChannelInclude: _toggleChannelInclude,
    _setCostMode: _setCostMode,
    _setCostPct: _setCostPct,
    _toggleCostInclude: _toggleCostInclude,
    _toggleFixedInclude: _toggleFixedInclude,
    _transformFixedExpense: _transformFixedExpense,
    _openSaveSnapshotModal: _openSaveSnapshotModal,
    _saveSnapshotFromModal: _saveSnapshotFromModal,
    _saveSnapshot: _saveSnapshot,
    _loadSnapshot: _loadSnapshot,
    _compareSnapshot: _compareSnapshot,
    _setMonthScenario: _setMonthScenario,
    _setCompareSnapshot: _setCompareSnapshot,
    _compareToCurrent: _compareToCurrent
  };
})();
