// js/modules/performance.js
window.Modules = window.Modules || {};
Modules.Performance = (function () {
  'use strict';

  var _loading = false;
  var _state = {
    period: 'thismonth',
    start: '',
    end: '',
    channel: 'all',
    categoryType: 'saidas',
    scenarioMonthKey: _currentMonthKey()
  };

  var _data = {
    orders: [],
    entries: [],
    exits: [],
    categories: [],
    snapshots: [],
    monthScenarios: [],
    monthScenario: null,
    money: { desiredMarginPct: 60, minMarginPct: 40 }
  };

  function render() {
    var app = document.getElementById('app');
    app.innerHTML = '' +
      '<div class="module-page">' +
        '<div class="module-head">' +
          '<div>' +
            '<h1>Performance</h1>' +
            '<p>Acompanhe vendas, entradas, saídas e ritmo do mês com leitura diária e cenário selecionado.</p>' +
          '</div>' +
          '<button onclick="Router.navigate(\'plano-de-voo/snapshots\')" class="primary-action" style="width:auto;min-width:170px;">Ver cenário do mês</button>' +
        '</div>' +
        '<div id="perf-content" class="module-content"><div class="loading-inline">Carregando...</div></div>' +
      '</div>';

    _paint();
    _load().then(function () {
      _paint();
    }).catch(function (err) {
      console.error('Performance load error', err);
      _paintError(err);
    });
  }

  function destroy() {}

  function _load() {
    _loading = true;
    return Promise.all([
      _safeAll('orders'),
      _safeAll('movimentacoes'),
      _safeAll('financeiro_entradas'),
      _safeAll('financeiro_saidas'),
      _safeAll('financeiro_apagar'),
      _safeAll('financeiro_categorias'),
      _safeAll('flight_plans'),
      _safeAll('flight_plan_month_scenarios'),
      _safeDoc('flight_plan_month_scenarios', _currentMonthKey()),
      _safeDoc('config', 'dinheiro')
    ]).then(function (r) {
      _data.orders = Array.isArray(r[0]) ? r[0] : [];
      _data.entries = _normalizeEntries(r[1], r[2]);
      _data.exits = _normalizeExits(r[3], r[4]);
      _data.categories = Array.isArray(r[5]) ? r[5] : [];
      _data.snapshots = Array.isArray(r[6]) ? r[6].slice().sort(function (a, b) {
        return _ts(b.createdAt) - _ts(a.createdAt);
      }) : [];
      _data.monthScenarios = Array.isArray(r[7]) ? r[7].filter(Boolean) : [];
      _data.monthScenario = _resolveMonthScenario(_state.scenarioMonthKey, r[8] || null, _data.monthScenarios);
      _data.money = _normalizeMoney(r[9] || {});
      _loading = false;
    }).catch(function (err) {
      _loading = false;
      console.error('Performance data load error', err);
    });
  }

  function _paint() {
    var content = document.getElementById('perf-content');
    if (!content) return;

    if (_loading) {
      content.innerHTML = '<div class="loading-inline">Carregando...</div>';
      return;
    }

    var vm = _buildModel();
    var html = '' +
      _scenarioBanner(vm) +
      _filtersCard(vm) +
      _kpiGrid(vm) +
      _statusCard(vm) +
      _dailyCard(vm) +
      _channelsCard(vm) +
      _financeCard(vm) +
      _expensePlanCard(vm) +
      _categoriesCard(vm);

    content.innerHTML = _safeHtml(html);
  }

  function _paintError(err) {
    var content = document.getElementById('perf-content');
    if (!content) return;
    content.innerHTML = _safeHtml('<div style="padding:24px;background:#fff;border-radius:14px;color:#C4362A;box-shadow:0 2px 12px rgba(0,0,0,.08);">Erro ao carregar a tela: ' + _esc((err && err.message) || err || 'desconhecido') + '</div>');
  }

  function _setPeriod(value) {
    _state.period = String(value || 'thismonth');
    if (_state.period !== 'custom') {
      _state.start = '';
      _state.end = '';
    }
    _paint();
  }

  function _setPeriodStart(value) {
    _state.start = String(value || '');
    _paint();
  }

  function _setPeriodEnd(value) {
    _state.end = String(value || '');
    _paint();
  }

  function _setChannel(value) {
    _state.channel = String(value || 'all');
    _paint();
  }

  function _setCategoryType(value) {
    _state.categoryType = String(value || 'saidas');
    _paint();
  }

  function _setScenarioMonth(value) {
    _state.scenarioMonthKey = String(value || _currentMonthKey());
    _data.monthScenario = _resolveMonthScenario(_state.scenarioMonthKey, _data.monthScenario, _data.monthScenarios);
    _paint();
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

  function _normalizeMoney(cfg) {
    cfg = cfg || {};
    return {
      desiredMarginPct: _num(cfg.desiredMarginPct != null ? cfg.desiredMarginPct : cfg.margemDesejadaPct != null ? cfg.margemDesejadaPct : 60),
      minMarginPct: _num(cfg.minMarginPct != null ? cfg.minMarginPct : cfg.margemMinimaPct != null ? cfg.margemMinimaPct : 40)
    };
  }

  function _normalizeEntries(legacy, modern) {
    var arr = [];
    (Array.isArray(legacy) ? legacy : []).forEach(function (m) {
      arr.push(_normalizeCashFlow(m, 'entrada', 'movimentacoes'));
    });
    (Array.isArray(modern) ? modern : []).forEach(function (m) {
      arr.push(_normalizeCashFlow(m, 'entrada', 'financeiro_entradas'));
    });
    return _dedupe(arr).sort(function (a, b) { return b.ts - a.ts; });
  }

  function _normalizeExits(saidas, apagar) {
    var arr = [];
    (Array.isArray(saidas) ? saidas : []).forEach(function (m) {
      arr.push(_normalizeCashFlow(m, 'saida', 'financeiro_saidas'));
    });
    (Array.isArray(apagar) ? apagar : []).forEach(function (m) {
      arr.push(_normalizeCashFlow(m, 'saida', 'financeiro_apagar'));
    });
    return _dedupe(arr).sort(function (a, b) { return b.ts - a.ts; });
  }

  function _normalizeCashFlow(item, kind, source) {
    item = item || {};
    var status = _normalizeText(item.status || item.state || '');
    var rawValue = _num(item.valor != null ? item.valor : item.value);
    var totalOriginal = _num(item.valorTotalOriginal != null ? item.valorTotalOriginal : item.valor_total_original != null ? item.valor_total_original : rawValue);
    var valueRow = _num(item.valorParcela != null ? item.valorParcela : item.valor_parcela != null ? item.valor_parcela : rawValue || totalOriginal);
    var paid = _num(item.valorPago != null ? item.valorPago : item.valor_pago_total != null ? item.valor_pago_total : item.valorRecebido != null ? item.valorRecebido : item.valor_recebido_total != null ? item.valor_recebido_total : 0);
    var pending = _num(item.saldoRestante != null ? item.saldoRestante : item.saldo_restante != null ? item.saldo_restante : Math.max(0, totalOriginal - paid));
    var date = _cashDate(item);
    var category = _normalizeCategoryName(item.categoria || item.category || item.cat || item.categoryName || item.tipo || '');
    var channel = _normalizeChannelKey(item.channel || item.canal || item.source || '');
    var customer = _normalizeText(item.pessoaNome || item.customerName || item.nome || item.fornecedorNome || item.supplierName || '');
    var desc = _normalizeText(item.descricao || item.description || item.nome || item.title || '');
    var effective = kind === 'entrada'
      ? (status === 'parcial' ? (paid || valueRow - pending) : (status === 'efetivado' || status === 'pago' ? (paid || valueRow) : (status === 'previsto' ? 0 : (paid || valueRow))))
      : (status === 'parcial' ? (paid || valueRow - pending) : (status === 'pago' || status === 'efetivado' ? (paid || valueRow) : (status === 'vencido' ? 0 : (paid || valueRow))));

    return {
      id: String(item.id || item._id || item.docId || kind + '-' + Math.random().toString(36).slice(2)),
      kind: kind,
      source: source,
      ts: date ? date.getTime() : 0,
      date: date,
      dateKey: _dateKey(date),
      labelDate: UI.fmtDate(date || new Date()),
      description: desc || '—',
      category: category || 'Sem categoria',
      customer: customer || '—',
      channel: channel || '—',
      status: status || (kind === 'entrada' ? 'efetivado' : 'pago'),
      value: rawValue || totalOriginal || 0,
      valueRow: valueRow || rawValue || totalOriginal || 0,
      totalOriginal: totalOriginal || rawValue || 0,
      paidValue: paid || 0,
      pendingValue: pending || 0,
      effectiveValue: effective || 0,
      raw: item
    };
  }

  function _dedupe(list) {
    var seen = {};
    return list.filter(function (item) {
      var key = [
        item.kind,
        item.dateKey,
        _normalizeText(item.description),
        _normalizeText(item.category),
        _normalizeText(item.customer),
        _normalizeText(item.channel),
        _fmtFixed(item.totalOriginal || item.value || 0)
      ].join('|');
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function _buildModel() {
    var range = _periodRange();
    var orders = _ordersInRange(range.start, range.end);
    var entries = _entriesInRange(range.start, range.end);
    var exits = _exitsInRange(range.start, range.end);
    var days = _rangeDays(range.start, range.end);
    var daysTotal = days.length || 1;
    var today = _todayStart();
    var currentMonth = _monthRange(today);
    var monthOrders = _ordersInRange(currentMonth.start, currentMonth.end);
    var monthTarget = _monthScenarioTarget();
    var actualRevenue = _sum(orders, 'value');
    var actualEntries = _sum(entries, 'effectiveValue');
    var actualExits = _sum(exits, 'effectiveValue');
    var pendingReceivables = entries.filter(function (x) { return x.kind === 'entrada' && (x.status === 'previsto' || x.status === 'parcial'); }).reduce(function (s, x) {
      return s + (x.status === 'parcial' ? x.pendingValue : x.valueRow);
    }, 0);
    var pendingPayables = exits.filter(function (x) { return x.kind === 'saida' && (x.status === 'pendente' || x.status === 'vencido' || x.status === 'parcial'); }).reduce(function (s, x) {
      return s + (x.status === 'parcial' ? x.pendingValue : x.valueRow);
    }, 0);
    var netCash = actualEntries - actualExits;
    var marginPct = actualRevenue > 0 ? ((actualRevenue - actualExits) / actualRevenue) * 100 : 0;
    var periodPrev = _previousRange(range.start, range.end);
    var prevOrders = _ordersInRange(periodPrev.start, periodPrev.end);
    var prevEntries = _entriesInRange(periodPrev.start, periodPrev.end);
    var prevExits = _exitsInRange(periodPrev.start, periodPrev.end);
    var targetRevenue = monthTarget.revenue > 0 ? monthTarget.revenue : 0;
    var targetProfit = monthTarget.profit > 0 ? monthTarget.profit : 0;
    var daysLeftMonth = Math.max(0, _diffDays(today, currentMonth.end));
    var daysElapsedMonth = Math.min(_diffDays(currentMonth.start, today) + 1, currentMonth.days);
    var expectedNow = targetRevenue ? (targetRevenue / currentMonth.days) * daysElapsedMonth : 0;
    var remainingToTarget = targetRevenue ? Math.max(0, targetRevenue - actualRevenue) : 0;
    var needPerDay = targetRevenue && daysLeftMonth ? remainingToTarget / daysLeftMonth : 0;
    var paceProjection = targetRevenue && daysElapsedMonth ? (actualRevenue / daysElapsedMonth) * currentMonth.days : 0;
    var progressPct = targetRevenue ? (actualRevenue / targetRevenue) * 100 : 0;
    var bestDay = _bestDay(days, orders);
    var bestChannel = _bestChannel(orders);
    var bestCategory = _bestCategory(exits);
    var daysRemainingPeriod = Math.max(0, daysTotal - daysElapsedMonth);
    var dailyRows = _dailyRows(days, orders, entries, exits, targetRevenue, daysRemainingPeriod);
    var channelBreakdown = _channelBreakdown(orders);
    var entryCategories = _categoryBreakdown(entries, 'entrada');
    var exitCategories = _categoryBreakdown(exits, 'saida');
    var expensePlanRows = _expensePlanRows(exitCategories);
    var monthScenario = _data.monthScenario || null;
    var scenarioName = monthScenario ? (monthScenario.snapshotName || monthScenario.name || 'Cenário do mês') : '';
    var scenarioLabel = monthScenario ? _scenarioLabel(monthScenario.scenario) : 'Sem cenário';
    var scenarioRevenue = monthTarget.revenue;
    var scenarioProfit = monthTarget.profit;
    var scenarioCash = monthTarget.cashFinal;
    var rateLabel;
    if (!targetRevenue) rateLabel = 'Defina o cenário do mês no Plano de Voo.';
    else if (progressPct >= 100 && marginPct >= _data.money.desiredMarginPct) rateLabel = 'Bom desempenho: o ritmo e a margem estão saudáveis.';
    else if (progressPct >= 85) rateLabel = 'Atenção: o mês ainda pode fechar bem, mas o ritmo precisa ser mantido.';
    else rateLabel = 'Atenção: você está abaixo do ritmo esperado para a meta do mês.';
    if (targetRevenue && marginPct < _data.money.minMarginPct) {
      rateLabel = 'Margem baixa: o caixa está entrando, mas a margem ficou apertada.';
    }

    return {
      range: range,
      periodLabel: range.label,
      selectedChannel: _state.channel,
      selectedCategoryType: _state.categoryType,
      monthScenario: monthScenario,
      scenarioName: scenarioName,
      scenarioLabel: scenarioLabel,
      targetRevenue: targetRevenue,
      targetProfit: targetProfit,
      scenarioCash: scenarioCash,
      actualRevenue: actualRevenue,
      actualEntries: actualEntries,
      actualExits: actualExits,
      pendingReceivables: pendingReceivables,
      pendingPayables: pendingPayables,
      netCash: netCash,
      marginPct: marginPct,
      daysTotal: daysTotal,
      daysElapsedMonth: daysElapsedMonth,
      daysLeftMonth: daysLeftMonth,
      expectedNow: expectedNow,
      remainingToTarget: remainingToTarget,
      needPerDay: needPerDay,
      paceProjection: paceProjection,
      progressPct: progressPct,
      bestDay: bestDay,
      bestChannel: bestChannel,
      bestCategory: bestCategory,
      rateLabel: rateLabel,
      orders: orders,
      entries: entries,
      exits: exits,
      prevOrders: prevOrders,
      prevEntries: prevEntries,
      prevExits: prevExits,
      dailyRows: dailyRows,
      channelBreakdown: channelBreakdown,
      entryCategories: entryCategories,
      exitCategories: exitCategories,
      expensePlanRows: expensePlanRows,
      monthOrders: monthOrders,
      periodOrders: orders,
      periodEntries: entries,
      periodExits: exits,
      channels: _channelOptions(orders),
      currentMonth: currentMonth
    };
  }

  function _paintErrorFallback(msg) {
    var content = document.getElementById('perf-content');
    if (content) {
      content.innerHTML = _safeHtml('<div style="padding:24px;background:#fff;border-radius:14px;color:#C4362A;box-shadow:0 2px 12px rgba(0,0,0,.08);">Erro ao montar a tela: ' + _esc(msg || 'desconhecido') + '</div>');
    }
  }

  function _scenarioBanner(vm) {
    if (!vm.monthScenario) {
      return '' +
        '<div style="background:#FFF7ED;border:1px solid #F7D9B6;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.06);padding:18px 20px;margin-bottom:16px;display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;">' +
          '<div style="min-width:0;">' +
            '<div style="font-size:12px;font-weight:900;color:#D97706;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Cenário do mês</div>' +
            '<div style="font-family:\'League Spartan\',sans-serif;font-size:20px;font-weight:900;color:#1A1A1A;">Nenhum cenário selecionado</div>' +
            '<div style="font-size:13px;color:#8A7E7C;line-height:1.5;margin-top:4px;">Defina um cenário no Plano de Voo para comparar o mês com meta oficial, lucro projetado e ritmo esperado.</div>' +
          '</div>' +
          '<button onclick="Router.navigate(\'plano-de-voo/snapshots\')" style="border:none;background:#C4362A;color:#fff;border-radius:10px;padding:10px 14px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">Definir cenário</button>' +
        '</div>';
    }

    var summary = vm.monthScenario.summary || {};
    return '' +
      '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:18px 20px;margin-bottom:16px;display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;">' +
        '<div style="min-width:0;">' +
          '<div style="font-size:12px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Cenário do mês</div>' +
          '<div style="font-family:\'League Spartan\',sans-serif;font-size:20px;font-weight:900;color:#1A1A1A;">' + _esc(vm.scenarioName || 'Cenário do mês') + '</div>' +
          '<div style="font-size:13px;color:#8A7E7C;line-height:1.5;margin-top:4px;">' + _esc(_scenarioMonthLabel(vm)) + ' · ' + _esc(vm.scenarioLabel) + ' · Meta mensal de ' + _fmtMoney(summary.revenue || 0) + ' · Lucro projetado ' + _fmtMoney(summary.profit || 0) + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">' +
          '<select onchange="Modules.Performance._setScenarioMonth(this.value)" style="padding:10px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:#fff;font-size:13px;font-family:inherit;outline:none;">' + _monthScenarioOptions() + '</select>' +
          '<div style="padding:8px 12px;border-radius:999px;background:#EDFAF3;color:#1A9E5A;font-size:12px;font-weight:900;">' + _esc(vm.periodLabel) + '</div>' +
          '<button onclick="Router.navigate(\'plano-de-voo/snapshots\')" style="border:none;background:#EEF4FF;color:#2563EB;border-radius:10px;padding:10px 14px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">Ver cenário</button>' +
        '</div>' +
      '</div>';
  }

  function _filtersCard(vm) {
    var channels = vm.channels || [];
    var periodField = '' +
      '<div class="field" style="margin-bottom:0;">' +
        '<span>Período</span>' +
        '<select onchange="Modules.Performance._setPeriod(this.value)" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:#fff;font-size:13px;outline:none;">' +
          _selectOption('today', 'Hoje') +
          _selectOption('yesterday', 'Ontem') +
          _selectOption('last7', 'Últimos 7 dias') +
          _selectOption('last30', 'Últimos 30 dias') +
          _selectOption('thismonth', 'Este mês') +
          _selectOption('lastmonth', 'Mês passado') +
          _selectOption('custom', 'Personalizado') +
        '</select>' +
      '</div>';

    var customFields = _state.period === 'custom'
      ? '' +
        '<div class="field" style="margin-bottom:0;">' +
          '<span>Data inicial</span><input type="date" value="' + _esc(_state.start) + '" onchange="Modules.Performance._setPeriodStart(this.value)" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:#fff;font-size:13px;outline:none;">' +
        '</div>' +
        '<div class="field" style="margin-bottom:0;">' +
          '<span>Data final</span><input type="date" value="' + _esc(_state.end) + '" onchange="Modules.Performance._setPeriodEnd(this.value)" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:#fff;font-size:13px;outline:none;">' +
        '</div>'
      : '';

    return '' +
      '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:18px 20px;margin-bottom:16px;">' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">' +
          periodField +
          customFields +
          '<div class="field" style="margin-bottom:0;">' +
            '<span>Canal</span>' +
            '<select onchange="Modules.Performance._setChannel(this.value)" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:#fff;font-size:13px;outline:none;">' +
              channels.map(function (ch) {
                return '<option value="' + _esc(ch.key) + '"' + (_state.channel === ch.key ? ' selected' : '') + '>' + _esc(ch.label) + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function _kpiGrid(vm) {
    var prevOrders = vm.prevOrders || [];
    var prevEntries = vm.prevEntries || [];
    var prevExits = vm.prevExits || [];
    var prevRevenue = _sum(prevOrders, 'value');
    var prevEntriesTotal = _sum(prevEntries, 'effectiveValue');
    var prevExitsTotal = _sum(prevExits, 'effectiveValue');
    var cards = [
      {
        label: 'Vendas realizadas',
        value: _fmtMoney(vm.actualRevenue),
        sub: _trendLabel(vm.actualRevenue, prevRevenue, 'vs período anterior'),
        tone: vm.actualRevenue >= 0 ? '#1A9E5A' : '#8A7E7C',
        bg: '#EDFAF3'
      },
      {
        label: 'Meta projetada',
        value: vm.targetRevenue ? _fmtMoney(vm.targetRevenue) : '—',
        sub: vm.targetRevenue ? vm.scenarioLabel + ' · meta mensal do cenário' : 'Defina um cenário no Plano de Voo',
        tone: '#2563EB',
        bg: '#EEF4FF'
      },
      {
        label: 'Meta recalculada',
        value: vm.targetRevenue ? _fmtMoney(vm.remainingToTarget) : '—',
        sub: vm.targetRevenue ? (vm.remainingToTarget > 0 ? 'Faltam ' + _fmtMoney(vm.remainingToTarget) + ' para fechar a meta' : 'Meta já alcançada') : 'Sem cenário definido',
        tone: vm.remainingToTarget > 0 ? '#D97706' : '#1A9E5A',
        bg: vm.remainingToTarget > 0 ? '#FFF7ED' : '#EDFAF3'
      },
      {
        label: 'Necessário por dia',
        value: vm.targetRevenue ? _fmtMoney(vm.needPerDay) : '—',
        sub: vm.targetRevenue ? (vm.daysLeftMonth + ' dia(s) até o fim do mês') : '—',
        tone: '#C4362A',
        bg: '#FFF0EE'
      },
      {
        label: 'Entradas no caixa',
        value: _fmtMoney(vm.actualEntries),
        sub: _trendLabel(vm.actualEntries, prevEntriesTotal, 'vs período anterior'),
        tone: '#1A9E5A',
        bg: '#EDFAF3'
      },
      {
        label: 'Saídas no caixa',
        value: _fmtMoney(vm.actualExits),
        sub: _trendLabel(vm.actualExits, prevExitsTotal, 'vs período anterior'),
        tone: '#C4362A',
        bg: '#FFF0EE'
      },
      {
        label: 'Saldo líquido',
        value: _fmtMoney(vm.netCash),
        sub: vm.marginPct.toFixed(1) + '% de margem operacional',
        tone: vm.netCash >= 0 ? '#1A9E5A' : '#C4362A',
        bg: vm.netCash >= 0 ? '#EDFAF3' : '#FFF0EE'
      },
      {
        label: 'Atingimento',
        value: vm.targetRevenue ? vm.progressPct.toFixed(1) + '%' : '—',
        sub: vm.targetRevenue ? (vm.progressPct >= 100 ? 'Meta batida' : 'Meta do cenário') : 'Sem meta de cenário',
        tone: vm.progressPct >= 100 ? '#1A9E5A' : '#D97706',
        bg: vm.progressPct >= 100 ? '#EDFAF3' : '#FFF7ED'
      }
    ];

    return '' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-bottom:16px;">' +
        cards.map(function (c) {
          return '' +
            '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:18px 18px 16px;">' +
              '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
                '<span style="width:38px;height:38px;border-radius:10px;background:' + c.bg + ';display:flex;align-items:center;justify-content:center;font-size:18px;color:' + c.tone + ';">•</span>' +
                '<span style="font-size:12px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;">' + _esc(c.label) + '</span>' +
              '</div>' +
              '<div style="font-family:\'League Spartan\',sans-serif;font-size:28px;font-weight:900;color:' + c.tone + ';line-height:1.05;margin-bottom:4px;">' + _esc(c.value) + '</div>' +
              '<div style="font-size:12px;color:#8A7E7C;line-height:1.45;">' + _esc(c.sub) + '</div>' +
            '</div>';
        }).join('') +
      '</div>';
  }

  function _statusCard(vm) {
    var tone = '#2563EB';
    var bg = '#EEF4FF';
    if (!vm.targetRevenue) {
      tone = '#D97706';
      bg = '#FFF7ED';
    } else if (vm.progressPct >= 100 && vm.marginPct >= _data.money.desiredMarginPct) {
      tone = '#1A9E5A';
      bg = '#EDFAF3';
    } else if (vm.marginPct < _data.money.minMarginPct) {
      tone = '#C4362A';
      bg = '#FFF0EE';
    }

    return '' +
      '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:18px 20px;margin-bottom:16px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;">' +
        '<div style="display:flex;align-items:flex-start;gap:12px;min-width:0;flex:1;">' +
          '<div style="width:44px;height:44px;border-radius:12px;background:' + bg + ';color:' + tone + ';display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">' + (vm.targetRevenue ? '⏱' : 'i') + '</div>' +
          '<div style="min-width:0;">' +
            '<div style="font-size:12px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Leitura do mês</div>' +
            '<div style="font-family:\'League Spartan\',sans-serif;font-size:20px;font-weight:900;color:' + tone + ';margin-bottom:4px;">' + _esc(vm.rateLabel) + '</div>' +
            '<div style="font-size:13px;color:#8A7E7C;line-height:1.5;">' +
              'Meta até agora: ' + _fmtMoney(vm.expectedNow) + ' · ' +
              'Vendas acumuladas: ' + _fmtMoney(vm.actualRevenue) + ' · ' +
              'Projeção no ritmo atual: ' + _fmtMoney(vm.paceProjection) +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          '<div style="padding:8px 12px;border-radius:999px;background:' + bg + ';color:' + tone + ';font-size:12px;font-weight:900;">' + _esc(vm.bestChannel.label ? ('Melhor canal: ' + vm.bestChannel.label) : 'Sem canal suficiente') + '</div>' +
          '<div style="padding:8px 12px;border-radius:999px;background:#F8F6F5;color:#6B7280;font-size:12px;font-weight:900;">' + _esc(vm.bestDay.label ? ('Melhor dia: ' + vm.bestDay.label) : 'Sem dia suficiente') + '</div>' +
        '</div>' +
      '</div>';
  }

  function _dailyCard(vm) {
    var rows = vm.dailyRows || [];
    return '' +
      '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:20px;margin-bottom:16px;">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:12px;flex-wrap:wrap;">' +
          '<div>' +
            '<h3 style="font-family:\'League Spartan\',sans-serif;font-size:18px;font-weight:900;margin-bottom:4px;">Linha do tempo diária</h3>' +
            '<p style="font-size:13px;color:#8A7E7C;">Veja vendas, entradas, saídas e a meta recalculada dia a dia.</p>' +
          '</div>' +
          '<div style="padding:8px 12px;border-radius:999px;background:#FBF5F3;border:1px solid #F2EDED;font-size:12px;color:#8A7E7C;">' + _esc(vm.periodLabel) + '</div>' +
        '</div>' +
        (rows.length ? '' +
          '<div style="overflow-x:auto;">' +
            '<table style="width:100%;border-collapse:collapse;min-width:1020px;">' +
              '<thead><tr style="background:#F8F6F5;">' +
                ['Data', 'Vendas', 'Entradas', 'Saídas', 'Acumulado', 'Meta do dia', 'Meta recalculada', 'Saldo do dia'].map(function (h) {
                  return '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">' + h + '</th>';
                }).join('') +
              '</tr></thead>' +
              '<tbody>' +
                rows.map(function (row) {
                  var tone = row.delta >= 0 ? '#1A9E5A' : '#C4362A';
                  var barPct = row.targetDaily ? Math.min(100, (row.sales / row.targetDaily) * 100) : 0;
                  return '' +
                    '<tr style="border-top:1px solid #F2EDED;">' +
                      '<td style="padding:12px 14px;font-size:13px;font-weight:800;">' + _esc(row.labelDate) + '</td>' +
                      '<td style="padding:12px 14px;font-size:13px;">' +
                        '<div style="display:flex;flex-direction:column;gap:5px;min-width:120px;">' +
                          '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><span>' + _fmtMoney(row.sales) + '</span><span style="font-size:11px;color:#8A7E7C;">' + (row.salesPct ? row.salesPct.toFixed(1) + '%' : '0%') + '</span></div>' +
                          '<div style="height:6px;background:#F2EDED;border-radius:999px;overflow:hidden;"><span style="display:block;height:100%;width:' + barPct.toFixed(1) + '%;background:' + tone + ';border-radius:999px;"></span></div>' +
                        '</div>' +
                      '</td>' +
                      '<td style="padding:12px 14px;font-size:13px;">' + _fmtMoney(row.entries) + '</td>' +
                      '<td style="padding:12px 14px;font-size:13px;">' + _fmtMoney(row.exits) + '</td>' +
                      '<td style="padding:12px 14px;font-size:13px;font-weight:800;">' + _fmtMoney(row.accumSales) + '</td>' +
                      '<td style="padding:12px 14px;font-size:13px;">' + _fmtMoney(row.targetDaily) + '</td>' +
                      '<td style="padding:12px 14px;font-size:13px;">' + _fmtMoney(row.needPerDay) + '</td>' +
                      '<td style="padding:12px 14px;font-size:13px;font-weight:800;color:' + tone + ';">' + _fmtMoney(row.balanceDay) + '</td>' +
                    '</tr>';
                }).join('') +
              '</tbody>' +
            '</table>' +
          '</div>'
          : _emptyState('Sem dados para este período', 'Escolha outro intervalo para ver a linha do tempo.')) +
      '</div>';
  }

  function _channelsCard(vm) {
    var rows = vm.channelBreakdown || [];
    return '' +
      '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:20px;margin-bottom:16px;">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:12px;flex-wrap:wrap;">' +
          '<div>' +
            '<h3 style="font-family:\'League Spartan\',sans-serif;font-size:18px;font-weight:900;margin-bottom:4px;">Vendas por canal</h3>' +
            '<p style="font-size:13px;color:#8A7E7C;">Comparação dos canais de venda dentro do período selecionado.</p>' +
          '</div>' +
          '<div style="padding:8px 12px;border-radius:999px;background:#FBF5F3;border:1px solid #F2EDED;font-size:12px;color:#8A7E7C;">Canal filtrado: ' + _esc(_channelLabel(_state.channel, vm.channels)) + '</div>' +
        '</div>' +
        (rows.length ? _barList(rows, '#2563EB', function (row) {
          return _fmtMoney(row.value);
        }) : _emptyState('Sem vendas para os canais deste período', 'No intervalo selecionado não houve pedidos suficientes.')) +
      '</div>';
  }

  function _financeCard(vm) {
    var totalEntries = vm.actualEntries;
    var totalExits = vm.actualExits;
    var pendingReceivables = vm.pendingReceivables;
    var pendingPayables = vm.pendingPayables;
    return '' +
      '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:20px;margin-bottom:16px;">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:12px;flex-wrap:wrap;">' +
          '<div>' +
            '<h3 style="font-family:\'League Spartan\',sans-serif;font-size:18px;font-weight:900;margin-bottom:4px;">Entradas e saídas</h3>' +
            '<p style="font-size:13px;color:#8A7E7C;">Leitura do caixa real, com pendências separadas.</p>' +
          '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
            '<div style="padding:8px 12px;border-radius:999px;background:#EDFAF3;color:#1A9E5A;font-size:12px;font-weight:900;">Entradas ' + _fmtMoney(totalEntries) + '</div>' +
            '<div style="padding:8px 12px;border-radius:999px;background:#FFF0EE;color:#C4362A;font-size:12px;font-weight:900;">Saídas ' + _fmtMoney(totalExits) + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:14px;">' +
          _miniMetric('A receber', _fmtMoney(pendingReceivables), '#2563EB') +
          _miniMetric('A pagar', _fmtMoney(pendingPayables), '#D97706') +
          _miniMetric('Saldo líquido', _fmtMoney(vm.netCash), vm.netCash >= 0 ? '#1A9E5A' : '#C4362A') +
          _miniMetric('Margem operacional', vm.marginPct.toFixed(1) + '%', vm.marginPct >= _data.money.desiredMarginPct ? '#1A9E5A' : (vm.marginPct >= _data.money.minMarginPct ? '#D97706' : '#C4362A')) +
        '</div>' +
        '<div style="font-size:12px;color:#8A7E7C;line-height:1.5;">' +
          'O caixa do período ficou ' + (vm.netCash >= 0 ? 'positivo' : 'negativo') + '. ' +
          (vm.marginPct >= _data.money.desiredMarginPct ? 'Margem acima do desejado.' : (vm.marginPct >= _data.money.minMarginPct ? 'Margem perto do mínimo.' : 'Margem abaixo do mínimo.')) +
        '</div>' +
      '</div>';
  }

  function _categoriesCard(vm) {
    var rows = (vm.selectedCategoryType === 'entradas' ? vm.entryCategories : vm.exitCategories) || [];
    return '' +
      '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:20px;margin-bottom:16px;">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:12px;flex-wrap:wrap;">' +
          '<div>' +
            '<h3 style="font-family:\'League Spartan\',sans-serif;font-size:18px;font-weight:900;margin-bottom:4px;">Categorias</h3>' +
            '<p style="font-size:13px;color:#8A7E7C;">Troque entre entradas e saídas para ver a concentração por categoria.</p>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
            '<button onclick="Modules.Performance._setCategoryType(\'entradas\')" style="border:1.5px solid ' + (vm.selectedCategoryType === 'entradas' ? '#C4362A' : '#D4C8C6') + ';background:' + (vm.selectedCategoryType === 'entradas' ? '#FFF0EE' : '#fff') + ';color:' + (vm.selectedCategoryType === 'entradas' ? '#C4362A' : '#1A1A1A') + ';border-radius:999px;padding:8px 12px;font-size:12px;font-weight:800;cursor:pointer;">Entradas</button>' +
            '<button onclick="Modules.Performance._setCategoryType(\'saidas\')" style="border:1.5px solid ' + (vm.selectedCategoryType === 'saidas' ? '#C4362A' : '#D4C8C6') + ';background:' + (vm.selectedCategoryType === 'saidas' ? '#FFF0EE' : '#fff') + ';color:' + (vm.selectedCategoryType === 'saidas' ? '#C4362A' : '#1A1A1A') + ';border-radius:999px;padding:8px 12px;font-size:12px;font-weight:800;cursor:pointer;">Saídas</button>' +
          '</div>' +
        '</div>' +
        (rows.length ? _barList(rows, vm.selectedCategoryType === 'entradas' ? '#1A9E5A' : '#C4362A', function (row) {
          return _fmtMoney(row.value);
        }) : _emptyState('Sem categorias para mostrar', 'Cadastre lançamentos com categoria.')) +
      '</div>';
  }

  function _expensePlanCard(vm) {
    var rows = vm.expensePlanRows || [];
    var monthScenario = vm.monthScenario || null;
    var scenarioLabel = monthScenario ? (monthScenario.snapshotName || monthScenario.name || 'Cenário do mês') : 'Sem cenário selecionado';
    var scenarioMonth = _scenarioMonthLabel(vm);
    return '' +
      '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:20px;margin-bottom:16px;">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:12px;flex-wrap:wrap;">' +
          '<div>' +
            '<h3 style="font-family:\'League Spartan\',sans-serif;font-size:18px;font-weight:900;margin-bottom:4px;">Totalizadores por categoria</h3>' +
            '<p style="font-size:13px;color:#8A7E7C;">Compare o previsto do cenário com o total real gasto por categoria no período selecionado.</p>' +
          '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">' +
            '<div style="padding:8px 12px;border-radius:999px;background:#EEF4FF;color:#2563EB;font-size:12px;font-weight:900;">' + _esc(scenarioMonth) + '</div>' +
            '<div style="padding:8px 12px;border-radius:999px;background:#FBF5F3;color:#8A7E7C;font-size:12px;font-weight:900;">' + _esc(scenarioLabel) + '</div>' +
          '</div>' +
        '</div>' +
        (rows.length ? '' +
          '<div style="overflow-x:auto;">' +
            '<table style="width:100%;border-collapse:collapse;min-width:960px;">' +
              '<thead><tr style="background:#F8F6F5;">' +
                ['Categoria', 'Previsto', 'Real', 'Diferença', 'Mini gráfico'].map(function (h) {
                  return '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">' + h + '</th>';
                }).join('') +
              '</tr></thead>' +
              '<tbody>' +
                rows.map(function (row) {
                  var tone = row.diff > 0 ? '#C4362A' : row.diff < 0 ? '#D97706' : '#1A9E5A';
                  var tag = row.diff > 0 ? 'Passou' : row.diff < 0 ? 'Faltou' : 'No alvo';
                  var tagBg = row.diff > 0 ? '#FFF0EE' : row.diff < 0 ? '#FFF7ED' : '#EDFAF3';
                  var tagColor = tone;
                  return '' +
                    '<tr style="border-top:1px solid #F2EDED;">' +
                      '<td style="padding:13px 14px;vertical-align:top;">' +
                        '<div style="font-size:13px;font-weight:900;color:#1A1A1A;">' + _esc(row.label || 'Sem categoria') + '</div>' +
                        '<div style="font-size:12px;color:#8A7E7C;margin-top:3px;">' + _esc(row.note || 'Comparação financeira') + '</div>' +
                      '</td>' +
                      '<td style="padding:13px 14px;vertical-align:top;font-size:13px;font-weight:800;color:#1A1A1A;">' + _fmtMoney(row.planned) + '</td>' +
                      '<td style="padding:13px 14px;vertical-align:top;font-size:13px;font-weight:800;color:#1A1A1A;">' + _fmtMoney(row.actual) + '</td>' +
                      '<td style="padding:13px 14px;vertical-align:top;">' +
                        '<div style="display:flex;flex-direction:column;gap:6px;">' +
                          '<div style="font-size:13px;font-weight:900;color:' + tone + ';">' + (row.diff > 0 ? '+' : row.diff < 0 ? '-' : '') + _fmtMoney(Math.abs(row.diff)) + '</div>' +
                          '<div style="display:inline-flex;align-items:center;gap:6px;width:max-content;padding:5px 8px;border-radius:999px;background:' + tagBg + ';color:' + tagColor + ';font-size:11px;font-weight:900;">' + tag + '</div>' +
                        '</div>' +
                      '</td>' +
                      '<td style="padding:13px 14px;vertical-align:top;">' + _expenseMiniGraph(row) + '</td>' +
                    '</tr>';
                }).join('') +
              '</tbody>' +
            '</table>' +
          '</div>'
          : _emptyState('Sem totalizadores por categoria para comparar', 'Defina um cenário do mês e registre saídas por categoria para ver o previsto vs real.')) +
      '</div>';
  }

  function _barList(rows, color, valueFormatter) {
    var max = rows.reduce(function (m, row) { return Math.max(m, row.value || 0); }, 0) || 1;
    return '<div style="display:flex;flex-direction:column;gap:10px;">' + rows.map(function (row) {
      var pct = Math.max(4, ((row.value || 0) / max) * 100);
      return '' +
        '<div style="display:grid;grid-template-columns:minmax(0,1.1fr) 1.4fr auto;gap:12px;align-items:center;padding:12px 14px;border:1px solid #F2EDED;border-radius:12px;">' +
          '<div style="min-width:0;">' +
            '<div style="font-size:13px;font-weight:900;color:#1A1A1A;">' + _esc(row.label || '—') + '</div>' +
            '<div style="font-size:12px;color:#8A7E7C;line-height:1.4;">' + _esc(row.note || '') + '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:10px;min-width:0;">' +
            '<div style="flex:1;height:10px;background:#F2EDED;border-radius:999px;overflow:hidden;"><span style="display:block;height:100%;width:' + pct.toFixed(1) + '%;background:' + color + ';border-radius:999px;"></span></div>' +
            '<div style="font-size:12px;font-weight:900;color:#8A7E7C;white-space:nowrap;">' + pct.toFixed(0) + '%</div>' +
          '</div>' +
          '<div style="font-family:\'League Spartan\',sans-serif;font-size:18px;font-weight:900;color:' + color + ';white-space:nowrap;">' + _esc(valueFormatter(row)) + '</div>' +
        '</div>';
    }).join('') + '</div>';
  }

  function _miniMetric(label, value, tone) {
    return '' +
      '<div style="background:#FBF5F3;border:1px solid #F2EDED;border-radius:12px;padding:14px 14px 12px;">' +
        '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">' + _esc(label) + '</div>' +
        '<div style="font-family:\'League Spartan\',sans-serif;font-size:24px;font-weight:900;color:' + tone + ';line-height:1;">' + _esc(value) + '</div>' +
      '</div>';
  }

  function _emptyState(title, subtitle) {
    return '' +
      '<div style="text-align:center;padding:44px 18px;color:#8A7E7C;background:#FBF5F3;border:1px solid #F2EDED;border-radius:14px;">' +
        '<div style="font-size:42px;line-height:1;margin-bottom:10px;">📭</div>' +
        '<div style="font-size:15px;font-weight:900;color:#1A1A1A;margin-bottom:6px;">' + _esc(title || 'Sem dados') + '</div>' +
        '<div style="font-size:13px;line-height:1.5;">' + _esc(subtitle || '') + '</div>' +
      '</div>';
  }

  function _channelOptions(orders) {
    var channels = {};
    (orders || []).forEach(function (o) {
      var key = _normalizeChannelKey(o.channel || o.source || '');
      if (!channels[key]) channels[key] = { key: key, label: _channelDisplay(key), count: 0, revenue: 0 };
      channels[key].count += 1;
      channels[key].revenue += _num(o.finalSubtotal != null ? o.finalSubtotal : o.total != null ? o.total : o.subtotal);
    });
    var list = Object.keys(channels).map(function (k) { return channels[k]; });
    list.sort(function (a, b) { return b.revenue - a.revenue; });
    return [{ key: 'all', label: 'Todos', count: (orders || []).length, revenue: _sum(orders || [], 'value') }].concat(list);
  }

  function _channelBreakdown(orders) {
    var map = {};
    (orders || []).forEach(function (o) {
      var key = _normalizeChannelKey(o.channel || o.source || '');
      if (!map[key]) map[key] = { key: key, label: _channelDisplay(key), value: 0, count: 0 };
      map[key].value += _num(o.value || o.total || o.finalSubtotal || o.subtotal);
      map[key].count += 1;
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.value - a.value; }).map(function (row) {
      row.note = row.count + ' pedido(s)';
      return row;
    });
  }

  function _categoryBreakdown(rows, kind) {
    var map = {};
    (rows || []).forEach(function (r) {
      var key = _normalizeCategoryName(r.category || r.categoria || r.cat || r.type || '');
      if (!map[key]) map[key] = { key: key, label: key, value: 0, count: 0, note: '' };
      map[key].value += _num(r.effectiveValue || r.valueRow || r.value || 0);
      map[key].count += 1;
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.value - a.value; }).slice(0, 8).map(function (row) {
      row.note = row.count + ' lançamento(s)';
      return row;
    });
  }

  function _expensePlanRows(actualRows) {
    var snapshot = _monthScenarioSnapshot() || {};
    var plannedRows = (Array.isArray(snapshot.fixedExpenses) ? snapshot.fixedExpenses : []).filter(function (r) {
      return String(r && r.source || '') === 'historical';
    });
    var map = {};

    function ensure(key, label) {
      if (!key) return null;
      if (!map[key]) {
        map[key] = {
          key: key,
          label: label || key,
          planned: 0,
          actual: 0,
          note: 'Comparação do cenário do mês com o período selecionado'
        };
      }
      return map[key];
    }

    plannedRows.forEach(function (r) {
      var key = _normalizeCategoryName(r.categoryId || r.name || r.sourceLabel || r.label || '');
      if (!key) return;
      var planned = _num(r.projectedMonthly != null ? r.projectedMonthly : r.projected != null ? r.projected : r.value);
      var row = ensure(key, r.name || key);
      if (!row) return;
      row.planned += planned;
      row.note = r.sourceLabel || row.note;
    });

    (actualRows || []).forEach(function (r) {
      var key = _normalizeCategoryName(r.key || r.label || '');
      if (!key) return;
      var row = ensure(key, r.label || key);
      if (!row) return;
      row.actual += _num(r.value);
      row.note = r.note || row.note;
    });

    return Object.keys(map).map(function (key) {
      var row = map[key];
      row.diff = row.actual - row.planned;
      row.base = Math.max(row.planned, row.actual, 1);
      row.planPct = Math.min(100, (row.planned / row.base) * 100);
      row.actualPct = Math.min(100, (row.actual / row.base) * 100);
      return row;
    }).sort(function (a, b) {
      return Math.abs(b.diff) - Math.abs(a.diff) || b.planned - a.planned;
    });
  }

  function _expenseMiniGraph(row) {
    var planned = _num(row.planned);
    var actual = _num(row.actual);
    var diff = _num(row.diff);
    var tone = diff > 0 ? '#C4362A' : diff < 0 ? '#D97706' : '#1A9E5A';
    var base = Math.max(planned, actual, 1);
    var plannedPct = Math.min(100, (planned / base) * 100);
    var actualPct = Math.min(100, (actual / base) * 100);
    var label = diff > 0 ? 'Passou ' + _fmtMoney(diff) : diff < 0 ? 'Faltou ' + _fmtMoney(Math.abs(diff)) : 'No alvo';
    return '' +
      '<div style="display:flex;flex-direction:column;gap:6px;min-width:170px;">' +
        '<div style="position:relative;height:10px;background:#F2EDED;border-radius:999px;overflow:hidden;">' +
          '<span style="position:absolute;left:0;top:0;bottom:0;width:' + actualPct.toFixed(1) + '%;background:' + tone + ';border-radius:999px;"></span>' +
          '<span style="position:absolute;left:' + plannedPct.toFixed(1) + '%;top:-3px;bottom:-3px;width:2px;background:#1A1A1A;opacity:.35;"></span>' +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;color:#8A7E7C;">' +
          '<span>' + label + '</span>' +
          '<span>' + (planned > 0 ? (actual / planned * 100).toFixed(1) + '% do previsto' : (actual > 0 ? 'Sem previsto' : '0%')) + '</span>' +
        '</div>' +
      '</div>';
  }

  function _dailyRows(days, orders, entries, exits, targetRevenue, daysRemainingPeriod) {
    var rows = [];
    var totalDays = days.length || 1;
    var cumulative = 0;
    for (var i = 0; i < days.length; i += 1) {
      var day = days[i];
      var key = _dateKey(day);
      var daySales = _sumByDate(orders, key);
      var dayEntries = _sumByDate(entries, key);
      var dayExits = _sumByDate(exits, key);
      cumulative += daySales;
      var targetDaily = targetRevenue ? (targetRevenue / totalDays) : 0;
      var expectedUpTo = targetRevenue ? targetDaily * (i + 1) : 0;
      var remainingDays = Math.max(0, totalDays - (i + 1));
      var needPerDay = targetRevenue && remainingDays ? Math.max(0, targetRevenue - cumulative) / remainingDays : 0;
      var balanceDay = dayEntries - dayExits;
      rows.push({
        date: day,
        dateKey: key,
        labelDate: UI.fmtDate(day),
        sales: daySales,
        entries: dayEntries,
        exits: dayExits,
        accumSales: cumulative,
        targetDaily: targetDaily,
        expectedUpTo: expectedUpTo,
        needPerDay: needPerDay,
        balanceDay: balanceDay,
        delta: daySales - targetDaily,
        salesPct: targetDaily ? (daySales / targetDaily) * 100 : 0
      });
    }
    return rows;
  }

  function _bestDay(days, orders) {
    var best = { value: 0, label: '' };
    days.forEach(function (day) {
      var key = _dateKey(day);
      var total = _sumByDate(orders, key);
      if (total > best.value) best = { value: total, label: UI.fmtDate(day) };
    });
    return best;
  }

  function _bestChannel(orders) {
    var map = {};
    (orders || []).forEach(function (o) {
      var key = _normalizeChannelKey(o.channel || o.source || '');
      if (!map[key]) map[key] = { label: _channelDisplay(key), value: 0 };
      map[key].value += _num(o.value || o.total || o.finalSubtotal || o.subtotal);
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.value - a.value; })[0] || { label: '' };
  }

  function _bestCategory(rows) {
    var map = {};
    (rows || []).forEach(function (r) {
      var key = _normalizeCategoryName(r.category || r.categoria || r.cat || '');
      if (!map[key]) map[key] = { label: key, value: 0 };
      map[key].value += _num(r.effectiveValue || r.valueRow || r.value || 0);
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.value - a.value; })[0] || { label: '' };
  }

  function _monthScenarioTarget() {
    var snap = _monthScenarioSnapshot();
    var summary = snap && snap.summary ? snap.summary : {};
    return {
      revenue: _num(summary.revenue != null ? summary.revenue : summary.forecastRevenue != null ? summary.forecastRevenue : 0),
      profit: _num(summary.profit != null ? summary.profit : 0),
      cashFinal: _num(summary.cashFinal != null ? summary.cashFinal : 0)
    };
  }

  function _monthScenarioSnapshot() {
    var m = _data.monthScenario || null;
    if (!m) return null;
    var id = String(m.snapshotId || m.id || '');
    if (!id) return m;
    var found = (_data.snapshots || []).find(function (x) { return String(x.id) === id; });
    return found || m;
  }

  function _scenarioMonthLabel(vm) {
    var m = _data.monthScenario || {};
    return m.monthLabel || _monthLabelFromKey(m.monthKey || _state.scenarioMonthKey || _currentMonthKey());
  }

  function _monthScenarioOptions() {
    var docs = (_data.monthScenarios || []).slice();
    var byMonth = {};
    docs.forEach(function (doc) {
      if (!doc) return;
      var key = String(doc.monthKey || '').trim();
      if (!key) return;
      if (!byMonth[key] || _ts(doc.updatedAt || doc.selectedAt || doc.createdAt) > _ts(byMonth[key].updatedAt || byMonth[key].selectedAt || byMonth[key].createdAt)) {
        byMonth[key] = doc;
      }
    });
    var current = _currentMonthKey();
    if (!byMonth[current]) byMonth[current] = { monthKey: current, monthLabel: _monthLabelFromKey(current) };
    return Object.keys(byMonth).sort().map(function (key) {
      var doc = byMonth[key];
      var label = doc.monthLabel || _monthLabelFromKey(key);
      return '<option value="' + _esc(key) + '"' + (String(_state.scenarioMonthKey || current) === key ? ' selected' : '') + '>' + _esc(label) + '</option>';
    }).join('');
  }

  function _resolveMonthScenario(selectedMonthKey, currentDoc, allDocs) {
    var monthKey = String(selectedMonthKey || _currentMonthKey());
    var candidates = [];
    if (currentDoc) candidates.push(currentDoc);
    (Array.isArray(allDocs) ? allDocs : []).forEach(function (doc) {
      if (!doc) return;
      candidates.push(doc);
    });

    var direct = candidates.find(function (doc) {
      return String(doc.monthKey || doc.month || doc.key || '') === monthKey;
    });
    if (direct) return direct;

    var byLabel = candidates.find(function (doc) {
      return String(doc.monthLabel || '').indexOf(monthKey.slice(5)) >= 0;
    });
    if (byLabel) return byLabel;

    var byUpdate = candidates.slice().sort(function (a, b) {
      return _ts(b.updatedAt || b.selectedAt || b.createdAt) - _ts(a.updatedAt || a.selectedAt || a.createdAt);
    })[0];
    return byUpdate || null;
  }

  function _ordersInRange(start, end) {
    var channel = _state.channel;
    return (_data.orders || []).filter(function (o) {
      var ts = _ts(o.createdAt || o.updatedAt || o.date);
      if (!ts) return false;
      if (ts < start.getTime() || ts > end.getTime()) return false;
      if (_isCancelledOrder(o)) return false;
      if (channel !== 'all' && _normalizeChannelKey(o.channel || o.source || '') !== channel) return false;
      return true;
    }).map(function (o) {
      return {
        id: String(o.id || ''),
        date: _dateFromTs(_ts(o.createdAt || o.updatedAt || o.date)),
        dateKey: _dateKey(_dateFromTs(_ts(o.createdAt || o.updatedAt || o.date))),
        labelDate: UI.fmtDate(_dateFromTs(_ts(o.createdAt || o.updatedAt || o.date))),
        value: _num(o.finalSubtotal != null ? o.finalSubtotal : o.total != null ? o.total : o.subtotal),
        channel: _normalizeChannelKey(o.channel || o.source || ''),
        channelLabel: _channelDisplay(_normalizeChannelKey(o.channel || o.source || '')),
        status: _normalizeText(o.status || ''),
        customer: _normalizeText(o.customerName || o.customer || ''),
        raw: o
      };
    }).sort(function (a, b) { return b.dateKey.localeCompare(a.dateKey); });
  }

  function _entriesInRange(start, end) {
    return (_data.entries || []).filter(function (r) {
      return r.ts >= start.getTime() && r.ts <= end.getTime();
    });
  }

  function _exitsInRange(start, end) {
    return (_data.exits || []).filter(function (r) {
      return r.ts >= start.getTime() && r.ts <= end.getTime();
    });
  }

  function _previousRange(start, end) {
    var days = _diffDays(start, end) + 1;
    var prevEnd = new Date(start.getTime() - 86400000);
    var prevStart = new Date(prevEnd.getTime() - (days - 1) * 86400000);
    prevStart.setHours(0, 0, 0, 0);
    prevEnd.setHours(23, 59, 59, 999);
    return { start: prevStart, end: prevEnd };
  }

  function _periodRange() {
    var today = _todayStart();
    if (_state.period === 'custom') {
      var start = _state.start ? new Date(_state.start + 'T00:00:00') : new Date(today.getFullYear(), today.getMonth(), 1);
      var end = _state.end ? new Date(_state.end + 'T23:59:59') : today;
      if (!isFinite(start.getTime())) start = new Date(today.getFullYear(), today.getMonth(), 1);
      if (!isFinite(end.getTime())) end = today;
      return { start: start, end: end, label: 'Personalizado' };
    }

    if (_state.period === 'today') {
      return { start: new Date(today.getTime()), end: _endOfDay(today), label: 'Hoje' };
    }
    if (_state.period === 'yesterday') {
      var y = new Date(today.getTime() - 86400000);
      return { start: new Date(y.getFullYear(), y.getMonth(), y.getDate()), end: _endOfDay(y), label: 'Ontem' };
    }
    if (_state.period === 'last7') {
      var s7 = new Date(today.getTime() - 6 * 86400000);
      return { start: new Date(s7.getFullYear(), s7.getMonth(), s7.getDate()), end: _endOfDay(today), label: 'Últimos 7 dias' };
    }
    if (_state.period === 'last30') {
      var s30 = new Date(today.getTime() - 29 * 86400000);
      return { start: new Date(s30.getFullYear(), s30.getMonth(), s30.getDate()), end: _endOfDay(today), label: 'Últimos 30 dias' };
    }
    if (_state.period === 'lastmonth') {
      var lastStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      var lastEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: lastStart, end: _endOfDay(lastEnd), label: 'Mês passado' };
    }
    var thisStart = new Date(today.getFullYear(), today.getMonth(), 1);
    var thisEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { start: thisStart, end: _endOfDay(thisEnd), label: 'Este mês' };
  }

  function _monthRange(date) {
    var d = date || new Date();
    var start = new Date(d.getFullYear(), d.getMonth(), 1);
    var end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { start: start, end: _endOfDay(end), days: _diffDays(start, end) + 1, label: UI.fmtDate(start) + ' - ' + UI.fmtDate(end) };
  }

  function _rangeDays(start, end) {
    var days = [];
    var cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    var last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (cursor <= last) {
      days.push(new Date(cursor.getTime()));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }

  function _sum(list, field) {
    return (list || []).reduce(function (s, item) { return s + _num(item[field]); }, 0);
  }

  function _sumByDate(list, key) {
    return (list || []).filter(function (item) { return item.dateKey === key; }).reduce(function (s, item) {
      return s + _num(item.value);
    }, 0);
  }

  function _trendLabel(current, previous, suffix) {
    if (!previous && !current) return 'Sem dados anteriores';
    if (!previous) return 'Sem dados anteriores';
    var pct = ((current - previous) / Math.abs(previous || 1)) * 100;
    return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '% ' + (suffix || 'vs período anterior');
  }

  function _channelLabel(key, options) {
    var opts = options || _stateChannelOptionsFallback();
    var found = opts.find(function (c) { return c.key === key; });
    return found ? found.label : _channelDisplay(key);
  }

  function _stateChannelOptionsFallback() {
    return [{ key: 'all', label: 'Todos' }].concat((_data.orders || []).map(function (o) {
      var key = _normalizeChannelKey(o.channel || o.source || '');
      return { key: key, label: _channelDisplay(key) };
    }).filter(function (v, idx, arr) {
      return arr.findIndex(function (x) { return x.key === v.key; }) === idx;
    }));
  }

  function _channelDisplay(key) {
    if (!key || key === 'all') return 'Todos';
    if (key === 'cardapio') return 'Cardápio';
    if (key === 'template') return 'Template';
    if (key === 'whatsapp') return 'WhatsApp';
    if (key === 'admin') return 'Admin';
    return key.replace(/-/g, ' ');
  }

  function _normalizeChannelKey(v) {
    var key = _normalizeText(v || '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return key || 'template';
  }

  function _normalizeCategoryName(v) {
    var text = _normalizeText(v || '');
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Sem categoria';
  }

  function _normalizeText(v) {
    return String(v == null ? '' : v).trim().toLowerCase();
  }

  function _cashDate(item) {
    return _dateFromTs(_ts(item && (item.createdAt || item.updatedAt || item.date || item.dueDate || item.vencimento || item.data)));
  }

  function _isCancelledOrder(o) {
    var status = _normalizeText(o && o.status);
    return status === 'cancelado' || status === 'canceled' || status === 'rejected' || status === 'rejeitado';
  }

  function _ts(v) {
    if (!v) return 0;
    try {
      if (typeof v.toDate === 'function') return v.toDate().getTime();
      var d = new Date(v);
      return isFinite(d.getTime()) ? d.getTime() : 0;
    } catch (e) {
      return 0;
    }
  }

  function _dateFromTs(ts) {
    if (!ts) return null;
    var d = new Date(ts);
    return isFinite(d.getTime()) ? d : null;
  }

  function _dateKey(date) {
    var d = date instanceof Date ? date : _dateFromTs(_ts(date));
    if (!d) return '';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function _currentMonthKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function _currentMonthLabel() {
    var d = new Date();
    return ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][d.getMonth()] + '/' + d.getFullYear();
  }

  function _monthLabelFromKey(key) {
    var str = String(key || '');
    var parts = str.split('-');
    if (parts.length !== 2) return _currentMonthLabel();
    var idx = Math.max(0, Math.min(11, parseInt(parts[1], 10) - 1));
    return ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][idx] + '/' + parts[0];
  }

  function _todayStart() {
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function _endOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  }

  function _diffDays(start, end) {
    var s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    var e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    return Math.max(0, Math.round((e - s) / 86400000));
  }

  function _selectOption(value, label) {
    return '<option value="' + _esc(value) + '"' + (_state.period === value ? ' selected' : '') + '>' + _esc(label) + '</option>';
  }

  function _fmtFixed(v) {
    return (parseFloat(v) || 0).toFixed(2);
  }

  function _num(v) {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    if (typeof v === 'string') {
      var s = v.trim().replace(/\s/g, '');
      if (!s) return 0;
      var hasComma = s.indexOf(',') >= 0;
      var hasDot = s.indexOf('.') >= 0;
      if (hasComma && hasDot) {
        if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
          s = s.replace(/\./g, '').replace(',', '.');
        } else {
          s = s.replace(/,/g, '');
        }
      } else if (hasComma) {
        s = s.replace(/\./g, '').replace(',', '.');
      }
      var n = parseFloat(s.replace(/[^0-9.-]/g, ''));
      return isFinite(n) ? n : 0;
    }
    if (typeof v.toNumber === 'function') return _num(v.toNumber());
    return 0;
  }

  function _fmtMoney(v) {
    return UI.fmt(_num(v));
  }

  function _safeHtml(html) {
    return String(html == null ? '' : html).replace(/\bundefined\b/g, '');
  }

  function _esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function _scenarioLabel(value) {
    var key = _normalizeText(value || '');
    if (key === 'survival') return 'Sobrevivência';
    if (key === 'equilibrium') return 'Equilíbrio';
    if (key === 'growth') return 'Crescimento';
    if (key === 'expansion') return 'Expansão';
    return 'Sem cenário';
  }

  function _barSeriesTooltip() {}

  return {
    render: render,
    destroy: destroy,
    _setPeriod: _setPeriod,
    _setPeriodStart: _setPeriodStart,
    _setPeriodEnd: _setPeriodEnd,
    _setChannel: _setChannel,
    _setCategoryType: _setCategoryType
  };
})();
