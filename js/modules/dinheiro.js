// js/modules/dinheiro.js
window.Modules = window.Modules || {};
Modules.Dinheiro = (function () {
  'use strict';

  var _activeSub = 'resumo';
  var _data = {};

  var TABS = [
    { key: 'resumo', label: 'Radar' },
    { key: 'precos', label: 'Composição do Preço' },
    { key: 'lista', label: 'Lista de Preço' },
    { key: 'simulador', label: 'Simulador' },
    { key: 'regras', label: 'Regras de preço' }
  ];

  function render(sub) {
    _activeSub = sub || 'resumo';
    var app = document.getElementById('app');
    app.innerHTML = '<section class="module-page">' +
      '<div class="module-head"><div><h1>Preços e Margem</h1><p>Custos, preços, margem, impostos, taxas e impacto nos produtos.</p></div></div>' +
      '<div id="dinheiro-tabs" class="module-tabs"></div>' +
      '<div id="dinheiro-content" class="module-content"><div class="loading-inline">Carregando...</div></div>' +
      '</section>';
    _renderTabs();
    _load().then(_renderSub).catch(function (err) {
      console.error('Dinheiro load error', err);
      _content('<div style="padding:24px;background:#fff;border-radius:12px;color:#C4362A;">Erro ao carregar dados: ' + _esc(err.message || err) + '</div>');
    });
  }

  function _renderTabs() {
    var el = document.getElementById('dinheiro-tabs');
    if (!el) return;
    el.innerHTML = TABS.map(function (t) {
      return '<button class="' + (t.key === _activeSub ? 'active' : '') + '" onclick="Modules.Dinheiro._switchSub(\'' + t.key + '\')">' + t.label + '</button>';
    }).join('');
  }

  function _switchSub(key) {
    _activeSub = key;
    _renderTabs();
    _renderSub();
    Router.navigate('dinheiro/' + key);
  }

  function _load() {
    return Promise.all([
      DB.getAll('products'),
      DB.getAll('fichasTecnicas'),
      DB.getAll('itens_custo'),
      DB.getAll('financeiro_saidas'),
      DB.getAll('financeiro_apagar'),
      DB.getDocRoot('config', 'geral'),
      DB.getDocRoot('config', 'dinheiro'),
      DB.getDocRoot('config', 'canais_venda'),
      DB.getDocRoot('config', 'fiscal')
    ]).then(function (r) {
      _data = {
        products: r[0] || [],
        receitas: r[1] || [],
        itens: r[2] || [],
        saidas: r[3] || [],
        apagar: r[4] || [],
        geral: r[5] || {},
        dinheiro: _normalizeMoneyConfig(r[6] || {}),
        canais: _normalizeChannels(r[7] || {}),
        fiscal: _normalizeFiscalConfig(r[8] || {})
      };
    });
  }

  function _renderSub() {
    if (_activeSub === 'resumo') return _renderResumo();
    if (_activeSub === 'precos') return _renderPrecos();
    if (_activeSub === 'lista') return _renderListaPrecos();
    if (_activeSub === 'simulador') return _renderSimulador();
    if (_activeSub === 'custos') {
      Router.navigate('financeiro/custos');
      return;
    }
    if (_activeSub === 'regras') return _renderRegras();
  }

  function _normalizeMoneyConfig(c) {
    return Object.assign({
      desiredMarginPct: 60,
      minMarginPct: 40,
      defaultMarkup: 3,
      rounding: '90',
      ivaPct: 0,
      cardFeePct: 0,
      marketplaceCommissionPct: 0,
      fixedOrderFee: 0,
      estimatedTaxReservePct: 0,
      otherFeesPct: 0
    }, c || {});
  }

  function _normalizeFiscalConfig(c) {
    return Object.assign({
      ivaPadrao: 21,
      irpfPadrao: 15,
      usarCalculoFiscal: true
    }, c || {});
  }

  function _normalizeChannels(c) {
    var list = Array.isArray(c.list) ? c.list : [];
    if (!list.length) {
      list = [
        { name: 'Cardápio', commissionPct: 0, fixedFee: 0, taxPct: 0, locked: true },
        { name: 'WhatsApp', commissionPct: 0, fixedFee: 0, taxPct: 0 },
        { name: 'Marketplace', commissionPct: 25, fixedFee: 0, taxPct: 21 }
      ];
    }
    var hasCardapio = list.some(function (ch) { return _isCardapioChannel(ch); });
    if (!hasCardapio) list.unshift({ name: 'Cardápio', commissionPct: 0, fixedFee: 0, taxPct: 0, locked: true });
    return list.map(function (ch) {
      var cardapio = _isCardapioChannel(ch);
      return {
        name: cardapio ? 'Cardápio' : (ch.name || ''),
        commissionPct: cardapio ? 0 : _num(ch.commissionPct),
        fixedFee: cardapio ? 0 : _num(ch.fixedFee),
        taxPct: cardapio ? 0 : _num(ch.taxPct),
        locked: cardapio || !!ch.locked
      };
    });
  }

  function _productsAnalysis() {
    return (_data.products || []).map(function (p) { return _analyzeProduct(p, _cardapioChannel()); });
  }

  function _defaultChannel() {
    return (_data.canais || [])[0] || { name: 'Cardápio', commissionPct: 0, fixedFee: 0, taxPct: 0, locked: true };
  }

  function _cardapioChannel() {
    return (_data.canais || []).find(function (ch) { return _isCardapioChannel(ch); }) || _defaultChannel();
  }

  function _analyzeProduct(p, channel) {
    var cost = _productCost(p);
    var price = _num(p.price || p.preco || p.salePrice);
    var fee = _feesForPrice(price, channel);
    var totalWithFees = cost.total + fee.total;
    var profit = price - totalWithFees;
    var margin = price > 0 ? (profit / price) * 100 : 0;
    var markup = cost.total > 0 ? price / cost.total : 0;
    var desired = _num(_data.dinheiro.desiredMarginPct || 60);
    var minMargin = _num(_data.dinheiro.minMarginPct || 40);
    var minimum = _priceForMargin(cost.total, minMargin, channel, { round: false });
    var suggested = _suggestedPrice(cost.total, desired, channel);
    var status = _status(price, cost.total, margin, minMargin, profit);
    return {
      product: p,
      channel: channel,
      ingredientCost: cost.ingredients,
      packagingCost: cost.packaging,
      indirectCost: cost.indirect,
      directCost: cost.direct,
      totalCost: cost.total,
      price: price,
      fees: fee.total,
      profit: profit,
      margin: margin,
      markup: markup,
      suggestedPrice: suggested,
      minimumPrice: minimum,
      status: status,
      costSource: cost.source
    };
  }

  function _productCost(p) {
    var indirectInfo = _indirectCostInfo();
    var direct = 0;
    var ingredients = 0;
    var packaging = 0;
    var source = 'sem dados';

    if (p.type === 'menu') {
      var menu = _menuCost(p);
      ingredients = menu.ingredients;
      packaging = menu.packaging;
      direct = menu.direct;
      source = menu.source;
    } else if (p.fichaId) {
      var recipe = _byId(_data.receitas, p.fichaId);
      var rc = _recipeDirectCost(recipe);
      ingredients = rc.ingredients;
      packaging = rc.packaging;
      direct = rc.direct;
      source = recipe ? 'receita' : 'receita não encontrada';
    } else if (p.sourceItemId || p.produtoProntoId) {
      var item = _byId(_data.itens, p.sourceItemId || p.produtoProntoId);
      direct = _itemCost(item);
      ingredients = direct;
      source = item ? 'produto único' : 'produto único não encontrado';
    } else {
      direct = _num(p.directCost || p.cost || p.custo || 0);
      ingredients = direct;
      source = direct > 0 ? 'manual/legado' : 'sem dados';
    }

    var indirect = direct * (indirectInfo.percent / 100);
    return {
      ingredients: ingredients,
      packaging: packaging,
      direct: direct,
      indirect: indirect,
      total: direct + indirect,
      indirectPercent: indirectInfo.percent,
      indirectMode: indirectInfo.modeUsed,
      source: source
    };
  }

  function _menuCost(p) {
    var direct = 0;
    var ingredients = 0;
    var packaging = 0;
    var source = 'menu';
    var groups = Array.isArray(p.menuChoiceGroups) ? p.menuChoiceGroups : [];
    if (groups.length) {
      groups.forEach(function (g) {
        var qty = parseInt(g.max || g.min || 1, 10) || 1;
        var optionCosts = (g.options || []).map(function (o) { return _refCost(o.ref); }).filter(function (c) { return c.direct > 0; });
        if (!optionCosts.length) return;
        optionCosts.sort(function (a, b) { return a.direct - b.direct; });
        var selected = optionCosts.slice(0, qty);
        selected.forEach(function (c) {
          direct += c.direct;
          ingredients += c.ingredients;
          packaging += c.packaging;
        });
      });
    } else if (Array.isArray(p.menuItems)) {
      p.menuItems.forEach(function (item) {
        var qty = parseInt(item.qty || 1, 10) || 1;
        var c = _refCost(item.ref);
        direct += c.direct * qty;
        ingredients += c.ingredients * qty;
        packaging += c.packaging * qty;
      });
    }
    return { direct: direct, ingredients: ingredients, packaging: packaging, source: source };
  }

  function _refCost(ref) {
    var parts = String(ref || '').split(':');
    var type = parts[0];
    var id = parts.slice(1).join(':');
    if (type === 'ficha') return _recipeDirectCost(_byId(_data.receitas, id));
    if (type === 'pronto') {
      var item = _byId(_data.itens, id);
      var direct = _itemCost(item);
      return { direct: direct, ingredients: direct, packaging: 0 };
    }
    return { direct: 0, ingredients: 0, packaging: 0 };
  }

  function _recipeDirectCost(recipe) {
    if (!recipe) return { direct: 0, ingredients: 0, packaging: 0 };
    var ingredients = _num(recipe.ingredientCost);
    var packaging = _num(recipe.packagingCost);
    var direct = _num(recipe.directCost);
    if (!direct && (ingredients || packaging)) direct = ingredients + packaging;
    if (!direct && Array.isArray(recipe.components)) {
      recipe.components.forEach(function (comp) {
        var target = String(comp.name || '').toLowerCase().indexOf('embal') >= 0 ? 'packaging' : 'ingredients';
        (comp.ingredients || []).forEach(function (ing) {
          var val = _num(ing.totalCost);
          if (!val) {
            var item = _byId(_data.itens, ing.insumoId);
            val = _itemCost(item) * _num(ing.grossQuantityCalculated || ing.qty || ing.quantity);
          }
          if (target === 'packaging') packaging += val;
          else ingredients += val;
        });
      });
      direct = ingredients + packaging;
    }
    var yieldQty = _recipeYieldQty(recipe);
    var baseIngredients = ingredients || direct;
    return {
      direct: direct / yieldQty,
      ingredients: baseIngredients / yieldQty,
      packaging: packaging / yieldQty
    };
  }

  function _recipeYieldQty(recipe) {
    var qty = _num(recipe.yieldQuantity || recipe.rendimento || recipe.yield || recipe.portions || recipe.porcoes);
    return qty > 0 ? qty : 1;
  }

  function _itemCost(item) {
    if (!item) return 0;
    return _num(item.custo_atual || item.custoAtual || item.preco_compra || item.purchasePrice || item.cost || 0);
  }

  function _indirectCostInfo() {
    var manual = _num(_data.geral.indirectCostPercent || _data.geral.percentualCustosIndiretos || 0);
    var mode = _data.geral.indirectCostMode || _data.geral.custosIndiretosModo || 'manual';
    if (mode !== 'automatico') return { modeUsed: 'Manual', percent: manual, fallback: false };
    var months = parseInt(_data.geral.indirectCostMonths || _data.geral.custosIndiretosMeses, 10) || 6;
    if ([3, 6, 12].indexOf(months) < 0) months = 6;
    var start = new Date();
    start.setMonth(start.getMonth() - months);
    start.setHours(0, 0, 0, 0);
    var direct = 0;
    var indirect = 0;
    (_data.saidas || []).concat(_data.apagar || []).forEach(function (item) {
      var rawDate = item.date || item.dueDate || item.paidAt || item.createdAt || '';
      if (!rawDate) return;
      var d = new Date(rawDate);
      if (isNaN(d.getTime()) || d < start) return;
      var value = _num(item.valor || item.amount || item.total);
      var cls = item.costClass || (item.tipoSaida === 'Custo Produção' ? 'direto' : 'despesa');
      if (cls === 'direto') direct += value;
      if (cls === 'indireto') indirect += value;
    });
    if (direct <= 0 || indirect <= 0) return { modeUsed: 'Manual', percent: manual, fallback: true, months: months };
    return { modeUsed: 'Automático', percent: (indirect / direct) * 100, fallback: false, months: months };
  }

  function _feesForPrice(price, channel) {
    var items = _feeBreakdown(price, channel);
    var total = items.reduce(function (sum, item) { return sum + item.value; }, 0);
    var fixed = _num((channel || {}).fixedFee || _data.dinheiro.fixedOrderFee || 0);
    return { pct: price > 0 ? (total - fixed) / price * 100 : 0, fixed: fixed, total: total, items: items };
  }

  function _fiscalEnabled() {
    return _data.fiscal && _data.fiscal.usarCalculoFiscal !== false;
  }

  function _fiscalIvaPct() {
    return _fiscalEnabled() ? _num(_data.fiscal.ivaPadrao) : 0;
  }

  function _fiscalIrpfPct() {
    return _fiscalEnabled() ? _num(_data.fiscal.irpfPadrao) : 0;
  }

  function _feeParts(channel) {
    channel = channel || {};
    var commissionPct = _num(channel.commissionPct);
    var channelTaxPct = _num(channel.taxPct);
    var pct = commissionPct;
    if (commissionPct > 0) pct += commissionPct * channelTaxPct / 100;
    else pct += channelTaxPct;
    if (_fiscalEnabled()) pct += _fiscalIvaPct();
    if (_isOwnChannel(channel)) {
      pct += _num(_data.dinheiro.cardFeePct) + _num(_data.dinheiro.estimatedTaxReservePct) + _num(_data.dinheiro.otherFeesPct);
    }
    return { pct: pct, fixed: _num(channel.fixedFee || _data.dinheiro.fixedOrderFee || 0) };
  }

  function _feeBreakdown(price, channel) {
    channel = channel || {};
    var list = [];
    var commissionPct = _num(channel.commissionPct);
    var channelTaxPct = _num(channel.taxPct);
    var commission = price * commissionPct / 100;
    if (commission > 0) {
      list.push({ label: 'Comissão ' + (channel.name || 'marketplace'), value: commission, color: '#7C3AED', percentBase: price });
      if (channelTaxPct > 0) list.push({ label: 'Imposto sobre comissão', value: commission * channelTaxPct / 100, color: '#A855F7', percentBase: price });
    } else if (channelTaxPct > 0) {
      list.push({ label: 'Imposto do canal', value: price * channelTaxPct / 100, color: '#A855F7', percentBase: price });
    }
    if (_fiscalEnabled()) _pushFee(list, 'IVA aplicado', price * _fiscalIvaPct() / 100, '#0EA5E9', price);
    if (_isOwnChannel(channel)) {
      _pushFee(list, 'Taxa de cartão', price * _num(_data.dinheiro.cardFeePct) / 100, '#2563EB', price);
      _pushFee(list, 'Reserva impostos', price * _num(_data.dinheiro.estimatedTaxReservePct) / 100, '#0891B2', price);
      _pushFee(list, 'Outras taxas', price * _num(_data.dinheiro.otherFeesPct) / 100, '#64748B', price);
    }
    _pushFee(list, 'Taxa fixa', _num(channel.fixedFee || _data.dinheiro.fixedOrderFee || 0), '#F97316', price);
    return list;
  }

  function _isCardapioChannel(channel) {
    var name = String((channel || {}).name || '').toLowerCase().replace(/[áàãâ]/g, 'a');
    return name === 'cardapio' || name === 'catalogo';
  }

  function _isOwnChannel(channel) {
    var name = String((channel || {}).name || '').toLowerCase();
    return !name || name === 'loja própria' || name === 'loja propria' || _isCardapioChannel(channel);
  }

  function _pushFee(list, label, value, color, percentBase) {
    if (value > 0) list.push({ label: label, value: value, color: color, percentBase: percentBase });
  }

  function _priceForMargin(cost, marginPct, channel, opts) {
    if (cost <= 0) return 0;
    opts = opts || {};
    var parts = _feeParts(channel);
    var pctFees = parts.pct / 100;
    var fixed = parts.fixed;
    var target = _num(marginPct) / 100;
    var divisor = 1 - target - pctFees;
    var raw = divisor > 0 ? (cost + fixed) / divisor : cost * (_num(_data.dinheiro.defaultMarkup || 3));
    if (opts.round === false) return Math.ceil(raw * 100) / 100;
    return _roundPrice(raw);
  }

  function _suggestedPrice(cost, marginPct, channel) {
    if (cost <= 0) return 0;
    var markup = Math.max(_num(_data.dinheiro.defaultMarkup || 3), 0);
    var byMarkup = _roundPrice(cost * (markup || 1));
    var byMargin = _priceForMargin(cost, marginPct, channel);
    return Math.max(byMarkup, byMargin);
  }

  function _roundPrice(value) {
    var mode = _data.dinheiro.rounding || '90';
    var n = Math.max(0, _num(value));
    if (n <= 0) return 0;
    if (mode === 'cheio') return Math.ceil(n);
    var cents = mode === '95' ? 0.95 : 0.90;
    var base = Math.floor(n);
    var rounded = base + cents;
    if (rounded < n) rounded = base + 1 + cents;
    return Math.round(rounded * 100) / 100;
  }

  function _status(price, cost, margin, minMargin, profit) {
    if (!cost) return 'sem custo';
    if (!price) return 'sem preço';
    if (profit < 0) return 'prejuízo';
    if (margin < minMargin) return 'margem baixa';
    if (margin < minMargin + 10) return 'atenção';
    return 'saudável';
  }

  function _renderResumo() {
    var rows = _productsAnalysis();
    var low = rows.filter(function (r) { return r.status === 'margem baixa'; });
    var attention = rows.filter(function (r) { return r.status === 'atenção'; });
    var noCost = rows.filter(function (r) { return !r.totalCost; });
    var noPrice = rows.filter(function (r) { return !r.price; });
    var healthy = rows.filter(function (r) { return r.status === 'saudável'; });
    var validRows = rows.filter(function (r) { return r.totalCost > 0 && r.price > 0; });
    var avgProfit = validRows.length ? validRows.reduce(function (s, r) { return s + (r.profit || 0); }, 0) / validRows.length : null;
    var channels = _channelDiagnostics(rows);
    var worstChannel = channels.slice().sort(function (a, b) { return b.impactPct - a.impactPct || b.fixedFee - a.fixedFee; })[0];
    var priorities = _financialPriorities(rows, channels);
    var kpis = [
      low.length ? _kpi('Produtos com margem baixa', low.length, attention.length ? attention.length + ' em atenção' : 'abaixo do mínimo') : '',
      noCost.length ? _kpi('Produtos precisam de custo', noCost.length, 'Não entram no cálculo de lucro') : '',
      noPrice.length ? _kpi('Produtos precisam de preço', noPrice.length, 'Não entram no cálculo de lucro') : '',
      healthy.length ? _kpi('Produtos saudáveis', healthy.length, 'produtos com margem ok') : '',
      _kpi('Lucro médio estimado', avgProfit == null ? 'sem dados suficientes' : UI.fmt(avgProfit), validRows.length + ' produtos válidos'),
      worstChannel ? _kpi('Canal com maior comissão', _esc(worstChannel.name), worstChannel.impactPct.toFixed(1).replace('.', ',') + '% de impacto') : ''
    ].filter(Boolean).join('');
    var priorityHtml = [
      _prioritySummary(noCost.length, 'produtos precisam de custo', 'Vincular custo', 'sem-custo', 'Não entram no cálculo de lucro'),
      _prioritySummary(low.length, 'produtos com margem baixa', 'Revisar preços', 'margem-baixa'),
      _prioritySummary(noPrice.length, 'produtos sem preço', 'Ver produtos', 'sem-preco')
    ].join('');
    var channelImpact = channels.map(function (c) {
      return '<div style="background:#fff;border-radius:12px;padding:14px;box-shadow:0 2px 8px rgba(0,0,0,.05);display:grid;grid-template-columns:1fr auto;gap:8px;align-items:start;">' +
        '<div><strong>' + _esc(c.name) + '</strong><div style="font-size:11px;color:#8A7E7C;margin-top:5px;">Comissão: ' + c.commissionPct.toFixed(1).replace('.', ',') + '%</div><div style="font-size:11px;color:#8A7E7C;">Imposto sobre comissão: ' + c.commissionTaxPct.toFixed(1).replace('.', ',') + '%</div><div style="font-size:11px;color:#8A7E7C;">Taxa fixa por pedido: ' + UI.fmt(c.fixedFee) + '</div><div style="font-size:11px;color:#8A7E7C;">Margem estimada após comissão: ' + (c.avgMargin == null ? 'sem dados' : c.avgMargin.toFixed(1).replace('.', ',') + '%') + '</div></div>' +
        '<div style="text-align:right;"><div style="font-size:11px;color:#8A7E7C;font-weight:900;text-transform:uppercase;">Impacto percentual</div><div style="color:#C4362A;font-weight:900;">' + c.impactPct.toFixed(1).replace('.', ',') + '%</div><div style="margin-top:6px;">' + _channelStatusBadge(c.status) + '</div></div>' +
      '</div>';
    }).join('');
    _content('<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-bottom:18px;">' + kpis + '</div>' +
      '<div style="display:grid;grid-template-columns:minmax(280px,.85fr) minmax(360px,1.15fr);gap:16px;margin-bottom:16px;">' +
      '<div style="background:#fff;border-radius:14px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,.06);"><h2 style="font-size:18px;font-weight:900;margin-bottom:12px;">Prioridades financeiras</h2>' + (priorityHtml || '<div style="color:#1A9E5A;font-weight:800;">Nenhuma prioridade crítica com os dados atuais.</div>') + '</div>' +
      '<div><h2 style="font-size:18px;font-weight:900;margin-bottom:12px;">Comissões por canal</h2>' + (channelImpact ? '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;">' + channelImpact + '</div>' : '<div style="background:#fff;border-radius:12px;padding:16px;color:#8A7E7C;box-shadow:0 2px 8px rgba(0,0,0,.05);">Nenhum canal com comissão ou taxa fixa configurada.</div>') + '</div>' +
      '</div>' +
      '<div style="background:#fff;border-radius:14px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,.06);"><h2 style="font-size:18px;font-weight:900;margin-bottom:12px;">Produtos que merecem atenção</h2>' + _priorityProducts(priorities) + '</div>');
  }

  function _prioritySummary(count, label, action, filter, note) {
    if (!count) return '';
    var tone = count ? '#FFF0EE' : '#EDFAF3';
    var color = count ? '#C4362A' : '#1A9E5A';
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border-radius:12px;background:' + tone + ';margin-bottom:10px;">' +
      '<div><strong style="font-size:18px;color:' + color + ';">' + count + '</strong><span style="font-weight:800;"> ' + _esc(label) + '</span>' + (note ? '<div style="font-size:12px;color:#8A7E7C;margin-top:3px;">' + _esc(note) + '</div>' : '') + '</div>' +
      '<button onclick="Modules.Dinheiro._goPriceFilter(\'' + filter + '\')" style="background:#fff;color:' + color + ';border:1.5px solid currentColor;border-radius:9px;padding:8px 10px;font-size:12px;font-weight:900;cursor:pointer;font-family:inherit;">' + _esc(action) + '</button>' +
      '</div>';
  }

  function _channelDiagnostics(rows) {
    var channels = _summaryChannels();
    var validRows = rows.filter(function (r) { return r.totalCost > 0 && r.price > 0; });
    var data = channels.map(function (ch) {
      var commissionPct = _num(ch.commissionPct);
      var commissionTaxPct = commissionPct > 0 ? commissionPct * _num(ch.taxPct) / 100 : _num(ch.taxPct);
      var fixedFee = _num(ch.fixedFee);
      var impactPct = commissionPct + commissionTaxPct;
      var metrics = validRows.map(function (r) { return _analyzeProduct(r.product, ch); });
      var avgMargin = metrics.length ? metrics.reduce(function (s, r) { return s + r.margin; }, 0) / metrics.length : null;
      return { name: ch.name, channel: ch, impactPct: impactPct, commissionPct: commissionPct, commissionTaxPct: commissionTaxPct, fixedFee: fixedFee, avgMargin: avgMargin, status: 'saudável' };
    }).filter(function (c) { return c.impactPct > 0 || c.fixedFee > 0; });
    var best = data.filter(function (c) { return c.avgMargin != null; }).sort(function (a, b) { return b.avgMargin - a.avgMargin; })[0];
    data.forEach(function (c) {
      if (best && c.name === best.name) c.status = 'melhor canal';
      else if (c.avgMargin == null) c.status = 'sem dados';
      else if (c.avgMargin < _num(_data.dinheiro.minMarginPct || 40)) c.status = 'margem baixa';
      else if (c.avgMargin < _num(_data.dinheiro.minMarginPct || 40) + 10) c.status = 'atenção';
      else c.status = 'saudável';
    });
    return data;
  }

  function _summaryChannels() {
    return (_data.canais || []).filter(function (ch) { return ch && ch.name; });
  }

  function _channelStatusBadge(status) {
    var colors = {
      'melhor canal': ['#EDFAF3', '#1A9E5A'],
      'saudável': ['#EDFAF3', '#1A9E5A'],
      'atenção': ['#FFF7ED', '#D97706'],
      'margem baixa': ['#FFF0EE', '#C4362A'],
      'sem dados': ['#F2EDED', '#8A7E7C']
    }[status] || ['#F2EDED', '#8A7E7C'];
    return '<span style="display:inline-block;padding:4px 8px;border-radius:999px;background:' + colors[0] + ';color:' + colors[1] + ';font-size:11px;font-weight:900;">' + _esc(status) + '</span>';
  }

  function _financialPriorities(rows, channels) {
    var valid = rows.filter(function (r) { return r.totalCost > 0 && r.price > 0; });
    var lowestMargin = valid.slice().sort(function (a, b) { return a.margin - b.margin; })[0];
    var noCost = rows.filter(function (r) { return !r.totalCost && r.price > 0; }).sort(function (a, b) { return b.price - a.price; })[0] || rows.filter(function (r) { return !r.totalCost; })[0];
    var belowSuggested = valid.filter(function (r) { return r.suggestedPrice > 0 && r.price < r.suggestedPrice; }).sort(function (a, b) { return (b.suggestedPrice - b.price) - (a.suggestedPrice - a.price); })[0];
    var worstCh = channels.slice().sort(function (a, b) { return b.impactPct - a.impactPct || b.fixedFee - a.fixedFee; })[0];
    var highFeeProduct = worstCh ? valid.map(function (r) {
      var a = _analyzeProduct(r.product, worstCh.channel);
      return Object.assign({}, a, { feeChannel: worstCh.name });
    }).sort(function (a, b) { return b.fees - a.fees; })[0] : null;
    return [
      lowestMargin ? { label: 'Menor margem', row: lowestMargin, action: 'Ver composição', filter: 'margem-baixa' } : null,
      noCost ? { label: 'Sem custo mais relevante', row: noCost, action: 'Vincular receita', filter: 'sem-custo' } : null,
      belowSuggested ? { label: 'Preço abaixo do recomendado', row: belowSuggested, action: 'Ajustar preço', filter: 'abaixo-recomendado' } : null,
      highFeeProduct ? { label: 'Maior impacto de comissão' + (highFeeProduct.feeChannel ? ' (' + highFeeProduct.feeChannel + ')' : ''), row: highFeeProduct, action: 'Revisar custo', filter: 'todos' } : null
    ].filter(Boolean);
  }

  function _priorityProducts(items) {
    if (!items.length) return '<div style="color:#1A9E5A;font-weight:800;">Nenhuma prioridade crítica com os dados atuais.</div>';
    return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;">' + items.map(function (item) {
      var r = item.row;
      var img = _productImage(r.product);
      return '<div style="border:1px solid #F0E6E3;border-radius:12px;padding:12px;display:grid;grid-template-columns:48px 1fr;gap:10px;align-items:center;">' +
        '<div style="width:48px;height:48px;border-radius:10px;background:#F2EDED;overflow:hidden;">' + (img ? '<img src="' + _esc(img) + '" style="width:100%;height:100%;object-fit:cover;">' : '') + '</div>' +
        '<div><div style="font-size:11px;color:#8A7E7C;font-weight:900;text-transform:uppercase;">' + _esc(item.label) + '</div><strong>' + _esc(r.product.name || 'Produto') + '</strong><div style="font-size:12px;color:#8A7E7C;margin-top:2px;">' + (r.totalCost ? 'Margem ' + r.margin.toFixed(1).replace('.', ',') + '%' : 'sem custo definido') + '</div>' +
        '<button onclick="Modules.Dinheiro._goPriceFilter(\'' + item.filter + '\')" style="margin-top:8px;background:#C4362A;color:#fff;border:none;border-radius:8px;padding:7px 9px;font-size:12px;font-weight:900;cursor:pointer;font-family:inherit;">' + _esc(item.action) + '</button></div>' +
        '</div>';
    }).join('') + '</div>';
  }

  function _goPriceFilter(filter) {
    var next = filter || 'todos';
    try {
      if (next === 'todos') sessionStorage.removeItem('dinheiro_price_filter');
      else sessionStorage.setItem('dinheiro_price_filter', next);
    } catch (e) {}
    if (_activeSub === 'precos') {
      _renderPrecos();
      return;
    }
    Router.navigate('dinheiro/precos');
  }

  function _renderPrecos() {
    var rows = _productsAnalysis();
    var filter = _pendingPriceFilter();
    var filteredRows = _applyPriceFilter(rows, filter);
    _content('<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap;"><h2 style="font-size:20px;font-weight:800;">Composição do Preço</h2><input id="din-prod-search" oninput="Modules.Dinheiro._filterProducts()" placeholder="Pesquisar produto..." style="min-width:260px;flex:1;max-width:520px;padding:11px 14px;border:1.5px solid #D4C8C6;border-radius:20px;font-size:13px;outline:none;"></div>' +
      (filter && filter !== 'todos' ? '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:#FFF8F1;border:1px solid #F1D6C8;border-radius:12px;padding:10px 12px;margin-bottom:12px;color:#8A4A18;font-weight:800;">Filtro aplicado: ' + _esc(_filterLabel(filter)) + '<button onclick="Modules.Dinheiro._goPriceFilter(\'todos\')" style="border:none;background:#C4362A;color:#fff;border-radius:8px;padding:7px 10px;font-weight:900;cursor:pointer;font-family:inherit;">Limpar</button></div>' : '') +
      '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);min-width:1040px;">' +
      '<thead><tr style="background:#F2EDED;">' + ['Produto','Custo base','Embalagem','Indireto','Custo total','Preço atual','Lucro/unid.','Margem','Markup','Preço mín.','Preço sugerido','Status'].map(_th).join('') + '</tr></thead>' +
      '<tbody id="din-products-tbody">' + _productRows(filteredRows) + '</tbody></table></div>');
    window._dinProducts = rows;
  }

  function _pendingPriceFilter() {
    try {
      var filter = sessionStorage.getItem('dinheiro_price_filter') || 'todos';
      if (filter === 'todos') sessionStorage.removeItem('dinheiro_price_filter');
      return filter;
    } catch (e) {
      return 'todos';
    }
  }

  function _applyPriceFilter(rows, filter) {
    if (!filter || filter === 'todos') return rows;
    if (filter === 'sem-custo') return rows.filter(function (r) { return !r.totalCost; });
    if (filter === 'sem-preco') return rows.filter(function (r) { return !r.price; });
    if (filter === 'margem-baixa') return rows.filter(function (r) { return r.status === 'margem baixa' || r.status === 'prejuízo'; });
    if (filter === 'abaixo-recomendado') return rows.filter(function (r) { return r.totalCost > 0 && r.price > 0 && r.suggestedPrice > 0 && r.price < r.suggestedPrice; });
    return rows;
  }

  function _filterLabel(filter) {
    return {
      'sem-custo': 'produtos sem custo definido',
      'sem-preco': 'produtos sem preço',
      'margem-baixa': 'margem baixa ou prejuízo',
      'abaixo-recomendado': 'preço abaixo do recomendado'
    }[filter] || 'todos';
  }

  function _productRows(rows) {
    if (!rows.length) return '<tr><td colspan="12" style="padding:38px;text-align:center;color:#8A7E7C;">Nenhum produto cadastrado.</td></tr>';
    return rows.map(function (r) {
      var img = _productImage(r.product);
      var hasCostAndPrice = r.totalCost > 0 && r.price > 0;
      return '<tr data-din-product="' + _esc((r.product.name || '').toLowerCase()) + '" data-product-id="' + _esc(r.product.id || '') + '" onclick="Modules.Dinheiro._openProductModal(this.dataset.productId)" style="border-top:1px solid #F2EDED;cursor:pointer;">' +
        _td('<div style="display:flex;align-items:center;gap:10px;"><div style="width:42px;height:42px;border-radius:10px;background:#F2EDED;overflow:hidden;flex:0 0 auto;">' + (img ? '<img src="' + _esc(img) + '" style="width:100%;height:100%;object-fit:cover;">' : '') + '</div><div><strong>' + _esc(r.product.name || 'Produto') + '</strong><div style="font-size:11px;color:#8A7E7C;">' + _esc(r.costSource) + '</div></div></div>') +
        _td(UI.fmt(r.ingredientCost)) +
        _td(UI.fmt(r.packagingCost)) +
        _td(UI.fmt(r.indirectCost)) +
        _td('<strong>' + UI.fmt(r.totalCost) + '</strong>') +
        _td(UI.fmt(r.price)) +
        _td(hasCostAndPrice ? '<strong style="color:' + (r.profit < 0 ? '#C4362A' : '#1A9E5A') + ';">' + UI.fmt(r.profit) + '</strong>' : '—') +
        _td(hasCostAndPrice ? (r.margin || 0).toFixed(1).replace('.', ',') + '%' : '—') +
        _td(hasCostAndPrice && r.markup ? r.markup.toFixed(2).replace('.', ',') + 'x' : '—') +
        _td(UI.fmt(r.minimumPrice)) +
        _td('<strong style="color:#2563EB;">' + UI.fmt(r.suggestedPrice) + '</strong>') +
        _td(_statusBadge(r.status)) +
        '</tr>';
    }).join('');
  }

  function _filterProducts() {
    var q = ((document.getElementById('din-prod-search') || {}).value || '').toLowerCase();
    document.querySelectorAll('[data-din-product]').forEach(function (row) {
      row.style.display = !q || (row.dataset.dinProduct || '').indexOf(q) >= 0 ? '' : 'none';
    });
  }

  function _renderListaPrecos() {
    var channels = _data.canais || [_defaultChannel()];
    var selected = _val('din-list-channel') || '0';
    var opts = channels.map(function (ch, idx) {
      return '<option value="' + idx + '"' + (String(idx) === String(selected) ? ' selected' : '') + '>' + _esc(ch.name || ('Canal ' + (idx + 1))) + '</option>';
    }).join('');
    var ch = channels[parseInt(selected, 10) || 0] || _defaultChannel();
    var rows = _productsAnalysis().map(function (r) {
      var price = _priceForChannel(r.product, ch);
      return Object.assign({}, r, { channelPrice: price, channel: ch });
    });
    _content('<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap;">' +
      '<h2 style="font-size:20px;font-weight:800;">Lista de Preço</h2>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
      '<select id="din-list-channel" onchange="Modules.Dinheiro._renderListaPrecos()" style="' + _input() + 'min-width:220px;">' + opts + '</select>' +
      '<button onclick="Modules.Dinheiro._printPriceList()" style="background:#C4362A;color:#fff;border:none;padding:11px 16px;border-radius:10px;font-weight:800;cursor:pointer;font-family:inherit;">Imprimir</button>' +
      '</div></div>' +
      '<div id="din-price-list-print" style="background:#fff;border-radius:14px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;"><div><h3 style="font-size:18px;font-weight:900;">' + _esc(ch.name || 'Canal') + '</h3><p style="color:#8A7E7C;font-size:13px;">Produtos e valores para este canal de venda.</p></div><strong>' + UI.fmtDate(new Date()) + '</strong></div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">' + rows.map(_priceListCard).join('') + '</div>' +
      '</div>');
  }

  function _priceListCard(r) {
    var img = _productImage(r.product);
    return '<div style="display:grid;grid-template-columns:72px 1fr;gap:12px;align-items:center;border:1px solid #F0E6E3;border-radius:12px;padding:10px;break-inside:avoid;">' +
      '<div style="width:72px;height:72px;border-radius:12px;background:#F2EDED;overflow:hidden;">' + (img ? '<img src="' + _esc(img) + '" style="width:100%;height:100%;object-fit:cover;">' : '') + '</div>' +
      '<div><strong style="font-size:14px;">' + _esc(r.product.name || 'Produto') + '</strong><div style="color:#8A7E7C;font-size:12px;margin-top:2px;">' + _esc(r.product.shortDesc || r.product.description || '') + '</div><div style="color:#C4362A;font-size:20px;font-weight:900;margin-top:8px;">' + UI.fmt(r.channelPrice) + '</div></div>' +
      '</div>';
  }

  function _printPriceList() {
    var el = document.getElementById('din-price-list-print');
    if (!el) return;
    var win = window.open('', '_blank');
    if (!win) {
      UI.toast('Não foi possível abrir a janela de impressão.', 'error');
      return;
    }
    win.document.write('<!doctype html><html><head><title>Lista de Preço</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#1A1A1A}img{max-width:100%}@media print{button{display:none}}</style></head><body>' + el.innerHTML + '</body></html>');
    win.document.close();
    win.focus();
    setTimeout(function () { win.print(); }, 250);
  }

  function _openProductModal(id) {
    if (!id) return;
    var row = (window._dinProducts || _productsAnalysis()).find(function (item) {
      return String(item.product.id) === String(id);
    });
    if (!row) {
      UI.toast('Produto não encontrado nesta lista.', 'error');
      return;
    }
    var p = row.product || {};
    var channels = _data.canais || [_defaultChannel()];
    var initialChannel = channels.findIndex(function (ch) { return _isCardapioChannel(ch); });
    if (initialChannel < 0) initialChannel = 0;
    var channelOpts = channels.map(function (ch, idx) {
      return '<option value="' + idx + '">' + _esc(ch.name || ('Canal ' + (idx + 1))) + '</option>';
    }).join('');
    var html = '<div id="din-price-modal" onclick="Modules.Dinheiro._closeProductModal(event)" style="position:fixed;inset:0;z-index:10000;background:rgba(26,26,26,.58);display:flex;align-items:center;justify-content:center;padding:24px;">' +
      '<div style="width:min(900px,100%);max-height:88vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,.28);padding:24px;position:relative;" onclick="event.stopPropagation()">' +
      '<button onclick="Modules.Dinheiro._closeProductModal()" style="position:absolute;right:18px;top:18px;width:38px;height:38px;border:none;border-radius:50%;background:#F2EDED;color:#1A1A1A;font-size:24px;font-weight:800;cursor:pointer;">×</button>' +
      '<h2 style="font-size:24px;font-weight:900;margin-bottom:4px;">' + _esc(p.name || 'Produto') + '</h2>' +
      '<p style="color:#8A7E7C;margin-bottom:18px;">Preço, custo, margem e recomendação por canal de venda.</p>' +
      '<input id="din-modal-product-id" type="hidden" value="' + _esc(id) + '">' +
      '<div id="din-price-modal-body"></div>' +
      '<div style="display:flex;gap:10px;margin-top:16px;justify-content:flex-end;">' +
      '<button onclick="Modules.Dinheiro._closeProductModal()" style="background:#fff;color:#1A1A1A;border:1.5px solid #D4C8C6;padding:12px 18px;border-radius:10px;font-weight:800;cursor:pointer;font-family:inherit;">Cancelar</button>' +
      '<button onclick="Modules.Dinheiro._saveProductPrice(\'' + _esc(id) + '\')" style="background:#C4362A;color:#fff;border:none;padding:12px 20px;border-radius:10px;font-weight:900;cursor:pointer;font-family:inherit;">Salvar preço</button>' +
      '</div>' +
      '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    _renderProductPriceModal(row, initialChannel, channelOpts, { useChannelPrice: true });
    var input = document.getElementById('din-modal-price');
    if (input) input.focus();
  }

  function _renderProductPriceModal(row, channelIndex, channelOpts, opts) {
    var body = document.getElementById('din-price-modal-body');
    if (!body) return;
    opts = opts || {};
    var channels = _data.canais || [_defaultChannel()];
    var ch = channels[channelIndex] || _defaultChannel();
    var typedPrice = _num((document.getElementById('din-modal-price') || {}).value);
    var currentPrice = opts.useChannelPrice ? _priceForChannel(row.product, ch) : (typedPrice || _priceForChannel(row.product, ch));
    var analysis = _analyzeProduct(Object.assign({}, row.product, { price: currentPrice }), ch);
    var desiredMarginRule = _num(_data.dinheiro.desiredMarginPct || 60);
    var minMarginRule = _num(_data.dinheiro.minMarginPct || 40);
    var minimumRulePrice = analysis.minimumPrice || _priceForMargin(analysis.totalCost, minMarginRule, ch, { round: false });
    var minMarkup = analysis.totalCost > 0 ? minimumRulePrice / analysis.totalCost : 0;
    var recommendedMarkup = analysis.totalCost > 0 ? analysis.suggestedPrice / analysis.totalCost : 0;
    var minFee = _feesForPrice(minimumRulePrice, ch);
    var suggestedFee = _feesForPrice(analysis.suggestedPrice, ch);
    var minMarkupMargin = minimumRulePrice > 0 ? ((minimumRulePrice - analysis.totalCost - minFee.total) / minimumRulePrice) * 100 : 0;
    var recommendedMarkupMargin = analysis.suggestedPrice > 0 ? ((analysis.suggestedPrice - analysis.totalCost - suggestedFee.total) / analysis.suggestedPrice) * 100 : 0;
    var fiscalCards = _fiscalEnabled()
      ? _priceMetric('Lucro antes de impostos', UI.fmt(analysis.profit), 'por unidade') +
        _priceMetric('Lucro depois fiscal', UI.fmt(_afterFiscalProfit(analysis)), 'estimativa')
      : _priceMetric('Lucro estimado', UI.fmt(analysis.profit), 'por unidade');
    body.innerHTML =
      '<section style="border:1px solid #F0E6E3;border-radius:14px;padding:14px;margin-bottom:14px;">' +
      '<h3 style="font-size:16px;font-weight:900;margin-bottom:12px;">1. Preço atual</h3>' +
      '<div style="display:grid;grid-template-columns:1.1fr 1fr 1fr;gap:12px;align-items:end;margin-bottom:12px;">' +
      '<label style="' + _labelWrap() + '"><span style="' + _label() + '">Canal de venda</span><select id="din-modal-channel" onchange="Modules.Dinheiro._updateProductPriceModal(true)" style="' + _input() + '">' + channelOpts.replace('value="' + channelIndex + '"', 'value="' + channelIndex + '" selected') + '</select></label>' +
      '<label style="' + _labelWrap() + '"><span style="' + _label() + '">Preço de venda (€)</span><input id="din-modal-price" type="number" min="0" step="0.01" onchange="Modules.Dinheiro._updateProductPriceModal(false)" value="' + _esc(currentPrice || '') + '" style="' + _input() + 'font-size:18px;font-weight:800;"></label>' +
      _priceMetric('Status', _statusBadge(analysis.status), ch.name || 'canal') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;">' +
      _priceMetric('Custo', UI.fmt(analysis.totalCost), analysis.costSource) +
      fiscalCards +
      _priceMetric('Margem', (analysis.margin || 0).toFixed(1).replace('.', ',') + '%', 'real') +
      _priceMetric('Markup', analysis.markup ? analysis.markup.toFixed(2).replace('.', ',') + 'x' : '—', 'real') +
      '</div></section>' +
      '<section style="border:1px solid #F0E6E3;border-radius:14px;padding:14px;margin-bottom:14px;">' +
      '<h3 style="font-size:16px;font-weight:900;margin-bottom:12px;">2. Distribuição do preço</h3>' +
      _priceDistribution(analysis) +
      '</section>' +
      '<section style="border:1px solid #F0E6E3;border-radius:14px;padding:14px;">' +
      '<h3 style="font-size:16px;font-weight:900;margin-bottom:12px;">3. Preço mínimo e preço recomendado</h3>' +
      '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;">' +
      _priceMetric('Markup mínimo', minMarkup ? minMarkup.toFixed(2).replace('.', ',') + 'x' : '—', minMarkup ? 'margem mínima ' + minMarginRule.toFixed(1).replace('.', ',') + '%' : 'regra de preço') +
      _priceMetric('Preço mínimo', UI.fmt(minimumRulePrice), 'margem aprox. ' + minMarkupMargin.toFixed(1).replace('.', ',') + '%') +
      _priceMetric('Markup recomendado', recommendedMarkup ? recommendedMarkup.toFixed(2).replace('.', ',') + 'x' : '—', recommendedMarkup ? 'margem desejada ' + desiredMarginRule.toFixed(1).replace('.', ',') + '%' : 'regra de preço') +
      _priceMetric('Preço sugerido', UI.fmt(analysis.suggestedPrice), 'margem aprox. ' + recommendedMarkupMargin.toFixed(1).replace('.', ',') + '%') +
      '</div></section>';
  }

  function _updateProductPriceModal(useChannelPrice) {
    var id = _val('din-modal-product-id');
    var rows = window._dinProducts || _productsAnalysis();
    var row = rows.find(function (item) { return String(item.product.id) === String(id); });
    if (!row) return;
    var channel = parseInt(_val('din-modal-channel'), 10) || 0;
    var opts = (_data.canais || [_defaultChannel()]).map(function (ch, idx) {
      return '<option value="' + idx + '">' + _esc(ch.name || ('Canal ' + (idx + 1))) + '</option>';
    }).join('');
    _renderProductPriceModal(row, channel, opts, { useChannelPrice: !!useChannelPrice });
  }

  function _breakEvenPrice(cost, channel) {
    if (cost <= 0) return 0;
    var parts = _feeParts(channel);
    var divisor = 1 - (parts.pct / 100);
    if (divisor <= 0) return cost + parts.fixed;
    return Math.round(((cost + parts.fixed) / divisor) * 100) / 100;
  }

  function _priceDistribution(analysis) {
    var price = Math.max(analysis.price || 0, 0);
    var parts = [
      { label: 'Custo base', value: analysis.ingredientCost, color: '#C4362A', percentBase: price, group: 'cost' },
      { label: 'Embalagem', value: analysis.packagingCost, color: '#E6A93B', percentBase: price, group: 'cost' },
      { label: 'Custos indiretos', value: analysis.indirectCost, color: '#6B7280', percentBase: price, group: 'cost' }
    ].filter(function (p) { return p.value > 0; });
    (_feeBreakdown(price, analysis.channel) || []).forEach(function (fee) {
      parts.push(Object.assign({}, fee, { group: fee.label === 'IVA aplicado' || fee.label === 'Imposto sobre comissão' ? 'tax' : 'fee' }));
    });
    var irpf = _irpfEstimatedOnProfit(analysis);
    if (_fiscalEnabled() && irpf > 0) parts.push({ label: 'IRPF estimado', value: irpf, color: '#BE123C', percentBase: price, group: 'tax' });
    if (analysis.profit > 0) parts.push({ label: _fiscalEnabled() ? 'Lucro depois da estimativa fiscal' : 'Lucro', value: Math.max(0, analysis.profit - irpf), color: '#1A9E5A', percentBase: price, group: 'result' });
    if (analysis.profit < 0) parts.push({ label: 'Prejuízo', value: Math.abs(analysis.profit), color: '#991B1B', percentBase: price, group: 'result' });
    var total = 1;
    var markupBase = Math.max(_num(analysis.totalCost), 0);
    var costsTotal = parts.filter(function (p) { return p.group === 'cost'; }).reduce(function (s, p) { return s + Math.max(0, p.value); }, 0);
    var feesTotal = parts.filter(function (p) { return p.group === 'fee' || p.group === 'tax'; }).reduce(function (s, p) { return s + Math.max(0, p.value); }, 0);
    var resultTotal = parts.filter(function (p) { return p.group === 'result'; }).reduce(function (s, p) { return s + Math.max(0, p.value); }, 0);
    var distributedTotal = parts.reduce(function (s, p) { return s + Math.max(0, p.value); }, 0);
    total = Math.max(distributedTotal, 1);
    function pctText(value, base) {
      var pct = (base || price) > 0 ? (value / (base || price)) * 100 : 0;
      return pct.toFixed(1).replace('.', ',') + '%';
    }
    function markupText(value) {
      if (markupBase <= 0) return '—';
      return (value / markupBase).toFixed(2).replace('.', ',') + 'x';
    }
    function metricsHTML(value, base, mutedPct) {
      var pct = (base || price) > 0 ? (value / (base || price)) * 100 : 0;
      return '<span style="font-weight:900;">' + UI.fmt(value) + '</span>' +
        '<span style="color:#1A1A1A;font-weight:' + (mutedPct ? '700' : '900') + ';"> · ' + pct.toFixed(1).replace('.', ',') + '%</span>' +
        '<span style="color:#8A7E7C;font-weight:500;"> · ' + markupText(value) + '</span>';
    }
    function summaryCard(label, value, color) {
      return '<div style="background:#F8F6F5;border:1px solid #F0E6E3;border-radius:12px;padding:10px 12px;">' +
        '<div style="font-size:10px;font-weight:900;text-transform:uppercase;color:#8A7E7C;margin-bottom:5px;">' + _esc(label) + '</div>' +
        '<div style="display:flex;align-items:center;gap:7px;"><i style="width:9px;height:9px;border-radius:50%;background:' + color + ';display:inline-block;"></i><strong style="font-size:17px;">' + UI.fmt(value) + '</strong></div>' +
        '<div style="font-size:11px;color:#8A7E7C;margin-top:4px;">' + pctText(value) + ' do preço · <span style="font-weight:500;">' + markupText(value) + '</span> do markup</div>' +
        '</div>';
    }
    var bar = parts.map(function (p) {
      var width = Math.max(0, (p.value / total) * 100);
      if (!width) return '';
      return '<div title="' + _esc(p.label + ': ' + UI.fmt(p.value)) + '" style="width:' + width + '%;background:' + p.color + ';height:18px;"></div>';
    }).join('');
    function rowHTML(p, opts) {
      opts = opts || {};
      var base = p.percentBase || price;
      var separate = p.label.indexOf('Comissão ') === 0 || p.label === 'Imposto sobre comissão';
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:' + (separate ? '10px 0' : '7px 0') + ';border-bottom:1px solid #F2EDED;' + (separate ? 'background:#FBF8FF;margin:0 -8px;padding-left:8px;padding-right:8px;border-radius:8px;' : '') + '"><span style="display:flex;align-items:center;gap:8px;"><i style="width:10px;height:10px;border-radius:50%;background:' + p.color + ';display:inline-block;"></i>' + _esc(p.label) + '</span><span style="white-space:nowrap;">' + metricsHTML(p.value, base, opts.mutedPct) + '</span></div>';
    }
    var costLikeParts = parts.filter(function (p) { return p.group !== 'result'; });
    var resultParts = parts.filter(function (p) { return p.group === 'result'; });
    var costLikeTotal = costsTotal + feesTotal;
    var rows = costLikeParts.map(function (p) {
      return rowHTML(p, { mutedPct: true });
    }).join('');
    if (costLikeParts.length) {
      rows += '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin:4px 0 6px;padding:10px 0 8px;border-top:2px solid #E8DEDC;border-bottom:1px solid #F2EDED;"><span style="font-weight:900;">Soma dos custos</span><span style="white-space:nowrap;">' + metricsHTML(costLikeTotal, price, true) + '</span></div>';
    }
    rows += resultParts.map(function (p) {
      return rowHTML(p, { mutedPct: false });
    }).join('');
    var empty = !parts.length ? '<div style="padding:10px;color:#8A7E7C;background:#F8F6F5;border-radius:10px;">Sem custos ou taxas cadastradas para distribuir.</div>' : '';
    var summaries = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:12px;">' +
      summaryCard('Custos', costsTotal, '#C4362A') +
      summaryCard('Taxas e impostos', feesTotal, '#6B7280') +
      summaryCard(analysis.profit < 0 ? 'Prejuízo' : 'Resultado', resultTotal, analysis.profit < 0 ? '#991B1B' : '#1A9E5A') +
      summaryCard('Total distribuído', distributedTotal, '#1A1A1A') +
      '</div>';
    var totalRow = parts.length ? '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px;padding:10px 0 0;border-top:2px solid #E8DEDC;"><span style="font-weight:900;">Soma total</span><span style="white-space:nowrap;">' + metricsHTML(distributedTotal, price, false) + '</span></div>' : '';
    return summaries + '<div style="display:flex;overflow:hidden;border-radius:999px;background:transparent;margin-bottom:10px;">' + bar + '</div>' + rows + totalRow + empty;
  }

  function _irpfEstimatedOnProfit(analysis) {
    return Math.max(0, _num(analysis.profit)) * _fiscalIrpfPct() / 100;
  }

  function _afterFiscalProfit(analysis) {
    return _num(analysis.profit) - _irpfEstimatedOnProfit(analysis);
  }

  function _priceForChannel(product, channel) {
    if (_isCardapioChannel(channel)) return _num(product.price || product.preco || product.preco_venda || 0);
    var prices = product.channelPrices || {};
    return _num(prices[channel.name || ''] || product.price || product.preco || product.preco_venda || 0);
  }

  function _productImage(product) {
    product = product || {};
    return product.imageBase64 || product.imageUrl || product.image || product.foto || '';
  }

  function _saveProductPrice(id) {
    var price = _num(_val('din-modal-price'));
    if (!price || price <= 0) {
      UI.toast('Informe um preço de venda válido.', 'error');
      return;
    }
    var channels = _data.canais || [_defaultChannel()];
    var channel = channels[parseInt(_val('din-modal-channel'), 10) || 0] || _defaultChannel();
    var product = (_data.products || []).find(function (item) { return String(item.id) === String(id); }) || {};
    var update = {};
    if (_isCardapioChannel(channel)) {
      update.price = price;
    } else {
      var channelPrices = Object.assign({}, product.channelPrices || {});
      channelPrices[channel.name || 'Canal'] = price;
      update.channelPrices = channelPrices;
    }
    DB.update('products', id, update).then(function () {
      var p = (_data.products || []).find(function (item) { return String(item.id) === String(id); });
      if (p) Object.assign(p, update);
      window._dinProducts = _productsAnalysis();
      _renderSub();
      _updateProductPriceModal();
      UI.toast('Preço de venda atualizado.', 'success');
    }).catch(function (err) {
      UI.toast('Erro ao salvar preço: ' + err.message, 'error');
    });
  }

  function _closeProductModal(ev) {
    if (ev && ev.target && ev.target.id !== 'din-price-modal') return;
    var el = document.getElementById('din-price-modal');
    if (el) el.remove();
  }

  function _priceMetric(label, value, note) {
    return '<div style="background:#F8F6F5;border-radius:12px;padding:12px;min-height:76px;">' +
      '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;">' + _esc(label) + '</div>' +
      '<div style="font-size:20px;font-weight:900;color:#1A1A1A;margin-top:6px;">' + value + '</div>' +
      '<div style="font-size:11px;color:#8A7E7C;margin-top:2px;">' + _esc(note || '') + '</div>' +
      '</div>';
  }

  function _renderSimulador() {
    var channelOpts = (_data.canais || []).map(function (ch, idx) { return '<option value="' + idx + '">' + _esc(ch.name) + '</option>'; }).join('');
    _content('<div style="background:#fff;border-radius:14px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,.06);max-width:880px;">' +
      '<h2 style="font-size:20px;font-weight:800;margin-bottom:14px;">Simulador</h2>' +
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;">' +
      _field('sim-price', 'Preço de venda', '10', 'number') +
      _field('sim-cost', 'Custo do produto', '3', 'number') +
      _field('sim-discount', 'Desconto %', '0', 'number') +
      '<label style="' + _labelWrap() + '"><span style="' + _label() + '">Canal de venda</span><select id="sim-channel" onchange="Modules.Dinheiro._applySimulatorChannel()" style="' + _input() + '">' + channelOpts + '</select></label>' +
      _field('sim-commission', 'Comissão %', '0', 'number') +
      _field('sim-commission-tax', 'Imposto sobre comissão %', '0', 'number') +
      _field('sim-fixed', 'Taxa fixa', '0', 'number') +
      '<label style="' + _labelWrap() + '"><span style="' + _label() + '">IVA configurado %</span><input value="' + _esc(_fiscalIvaPct()) + '" readonly style="' + _input() + 'background:#F8F6F5;color:#8A7E7C;"></label>' +
      '<label style="' + _labelWrap() + '"><span style="' + _label() + '">Imposto de renda %</span><input value="' + _esc(_fiscalIrpfPct()) + '" readonly style="' + _input() + 'background:#F8F6F5;color:#8A7E7C;"></label>' +
      '</div><div id="sim-result" style="margin-top:16px;"></div></div>');
    ['sim-price','sim-cost','sim-discount','sim-commission','sim-commission-tax','sim-fixed'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.oninput = _updateSimulador;
    });
    _applySimulatorChannel();
  }

  function _applySimulatorChannel() {
    var ch = (_data.canais || [])[parseInt((document.getElementById('sim-channel') || {}).value, 10) || 0] || {};
    var commission = document.getElementById('sim-commission');
    var commissionTax = document.getElementById('sim-commission-tax');
    var fixed = document.getElementById('sim-fixed');
    if (commission) commission.value = _num(ch.commissionPct);
    if (commissionTax) commissionTax.value = _num(ch.taxPct || (ch.commissionPct ? 21 : 0));
    if (fixed) fixed.value = _num(ch.fixedFee);
    _updateSimulador();
  }

  function _updateSimulador() {
    var price = _num(_val('sim-price'));
    var discount = _num(_val('sim-discount'));
    var netPrice = price * (1 - discount / 100);
    var cost = _num(_val('sim-cost'));
    var commission = netPrice * _num(_val('sim-commission')) / 100;
    var commissionTax = commission * _num(_val('sim-commission-tax')) / 100;
    var fixed = _num(_val('sim-fixed'));
    var fees = commission + commissionTax + fixed;
    var profitBeforeFiscal = netPrice - cost - fees;
    var iva = netPrice * _fiscalIvaPct() / 100;
    var irpfBase = Math.max(0, profitBeforeFiscal - iva);
    var incomeTax = irpfBase * _fiscalIrpfPct() / 100;
    var profit = profitBeforeFiscal - iva - incomeTax;
    var margin = netPrice > 0 ? profit / netPrice * 100 : 0;
    var markup = cost > 0 ? netPrice / cost : 0;
    var el = document.getElementById('sim-result');
    if (el) el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;">' +
      _kpi('Preço líquido', UI.fmt(netPrice), 'após desconto') +
      _kpi('Comissão', UI.fmt(commission), _num(_val('sim-commission')).toFixed(1).replace('.', ',') + '% sobre venda') +
      _kpi('Imposto comissão', UI.fmt(commissionTax), _num(_val('sim-commission-tax')).toFixed(1).replace('.', ',') + '% sobre comissão') +
      _kpi('Taxa fixa', UI.fmt(fixed), 'por pedido') +
      _kpi('IVA', UI.fmt(iva), _fiscalIvaPct().toFixed(1).replace('.', ',') + '% configurado') +
      _kpi('Imposto de renda', UI.fmt(incomeTax), _fiscalIrpfPct().toFixed(1).replace('.', ',') + '% estimado') +
      _kpi('Lucro estimado', UI.fmt(profit), 'após impostos e taxas') +
      _kpi('Margem real', margin.toFixed(1).replace('.', ',') + '%', 'após impostos e taxas') +
      _kpi('Markup', markup ? markup.toFixed(2).replace('.', ',') + 'x' : '—', 'preço líquido / custo') +
      '</div>';
  }

  function _renderCustos() {
    var g = _data.geral || {};
    var mode = g.indirectCostMode || 'manual';
    var months = String(g.indirectCostMonths || 6);
    _settings('Custos e despesas', 'Modo dos custos indiretos estimados usado nas receitas e preços.', [
      '<label style="' + _labelWrap() + '"><span style="' + _label() + '">Modo dos custos indiretos estimados</span><select id="dn-ind-mode" style="' + _input() + '"><option value="manual"' + (mode === 'manual' ? ' selected' : '') + '>Manual por percentual</option><option value="automatico"' + (mode === 'automatico' ? ' selected' : '') + '>Automático por média dos últimos meses</option></select></label>',
      _field('dn-ind-pct', 'Percentual manual de custos indiretos', g.indirectCostPercent || 0, 'number'),
      '<label style="' + _labelWrap() + '"><span style="' + _label() + '">Período para cálculo automático</span><select id="dn-ind-months" style="' + _input() + '"><option value="3"' + (months === '3' ? ' selected' : '') + '>3 meses</option><option value="6"' + (months === '6' ? ' selected' : '') + '>6 meses</option><option value="12"' + (months === '12' ? ' selected' : '') + '>12 meses</option></select></label>'
    ].join(''), function () {
      return Object.assign({}, _data.geral, {
        indirectCostMode: _val('dn-ind-mode') || 'manual',
        indirectCostPercent: _num(_val('dn-ind-pct')),
        indirectCostMonths: parseInt(_val('dn-ind-months'), 10) || 6
      });
    }, 'geral');
  }

  function _renderRegras() {
    var c = _data.dinheiro;
    _content('<div style="background:#fff;border-radius:14px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,.06);max-width:1100px;">' +
      '<h2 style="font-size:20px;font-weight:800;margin-bottom:4px;">Regras de preço</h2><p style="color:#8A7E7C;margin-bottom:16px;">Regras gerais de margem, arredondamento e canais usados nos cálculos de preço.</p>' +
      '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:18px;">' +
      _field('dn-margin', 'Margem desejada padrão %', c.desiredMarginPct, 'number') +
      _field('dn-min-margin', 'Margem mínima aceitável %', c.minMarginPct, 'number') +
      _field('dn-markup', 'Markup padrão', c.defaultMarkup, 'number') +
      '<label style="' + _labelWrap() + '"><span style="' + _label() + '">Arredondamento de preço</span><select id="dn-round" style="' + _input() + '"><option value="90"' + (c.rounding === '90' ? ' selected' : '') + '>Terminar em ,90</option><option value="95"' + (c.rounding === '95' ? ' selected' : '') + '>Terminar em ,95</option><option value="cheio"' + (c.rounding === 'cheio' ? ' selected' : '') + '>Número cheio</option></select></label>' +
      '</div>' +
      '<div style="border-top:1px solid #F2EDED;padding-top:16px;">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px;"><div><h3 style="font-size:17px;font-weight:900;">Canais de venda</h3><p style="color:#8A7E7C;font-size:13px;">Configure taxas por canal. A margem mínima é sempre a regra geral acima.</p></div><button type="button" onclick="Modules.Dinheiro._addCanalVenda()" style="background:#fff;border:1.5px solid #D4C8C6;border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer;font-family:inherit;">+ Adicionar canal</button></div>' +
      '<div id="dn-channel-list" style="display:grid;gap:10px;">' + _channelRows(_data.canais || []) + '</div>' +
      '</div>' +
      '<button id="din-save-rules" onclick="Modules.Dinheiro._saveRegras()" style="margin-top:18px;background:#C4362A;color:#fff;border:none;padding:12px 18px;border-radius:10px;font-weight:800;cursor:pointer;font-family:inherit;">Salvar regras</button></div>');
  }

  function _channelRows(list) {
    if (!list.length) list = _normalizeChannels({});
    return list.map(function (ch, idx) {
      var locked = ch.locked || _isCardapioChannel(ch);
      return '<div data-dn-channel-row="' + idx + '" style="display:grid;grid-template-columns:1.5fr .75fr .75fr .75fr 34px;gap:10px;align-items:end;background:#F8F6F5;border-radius:12px;padding:12px;">' +
        '<label style="' + _labelWrap() + '"><span style="' + _label() + '">Canal</span><input id="dn-ch-name-' + idx + '" value="' + _esc(ch.name || '') + '" placeholder="WhatsApp" ' + (locked ? 'readonly' : '') + ' style="' + _input() + (locked ? 'background:#F2EDED;font-weight:900;' : '') + '"></label>' +
        '<label style="' + _labelWrap() + '"><span style="' + _label() + '">Comissão %</span><input id="dn-ch-commission-' + idx + '" type="number" value="' + _esc(ch.commissionPct || 0) + '" ' + (locked ? 'readonly' : '') + ' style="' + _input() + '"></label>' +
        '<label style="' + _labelWrap() + '"><span style="' + _label() + '">Taxa fixa</span><input id="dn-ch-fixed-' + idx + '" type="number" value="' + _esc(ch.fixedFee || 0) + '" ' + (locked ? 'readonly' : '') + ' style="' + _input() + '"></label>' +
        '<label style="' + _labelWrap() + '"><span style="' + _label() + '">Imposto comissão %</span><input id="dn-ch-tax-' + idx + '" type="number" value="' + _esc(ch.taxPct || 0) + '" ' + (locked ? 'readonly' : '') + ' style="' + _input() + '"></label>' +
        (locked ? '<span title="Canal fixo do Cardápio" style="height:38px;border-radius:9px;background:#EDFAF3;color:#1A9E5A;display:inline-flex;align-items:center;justify-content:center;font-weight:900;">✓</span>' : '<button type="button" onclick="Modules.Dinheiro._removeCanalVenda(' + idx + ')" title="Remover canal" style="height:38px;border:none;border-radius:9px;background:#FFF0EE;color:#C4362A;cursor:pointer;font-weight:900;">×</button>') +
      '</div>';
    }).join('');
  }

  function _collectCanaisVenda() {
    return [].slice.call(document.querySelectorAll('[data-dn-channel-row]')).map(function (row) {
      var idx = row.dataset.dnChannelRow;
      return {
        name: _val('dn-ch-name-' + idx),
        commissionPct: _num(_val('dn-ch-commission-' + idx)),
        fixedFee: _num(_val('dn-ch-fixed-' + idx)),
        taxPct: _num(_val('dn-ch-tax-' + idx)),
        locked: _isCardapioChannel({ name: _val('dn-ch-name-' + idx) })
      };
    }).filter(function (ch) { return !!ch.name; });
  }

  function _saveRegras() {
    var dinheiro = Object.assign({}, _data.dinheiro, {
      desiredMarginPct: _num(_val('dn-margin')),
      minMarginPct: _num(_val('dn-min-margin')),
      defaultMarkup: _num(_val('dn-markup')),
      rounding: _val('dn-round') || '90'
    });
    var canais = { list: _collectCanaisVenda() };
    Promise.all([
      DB.setDocRoot('config', 'dinheiro', dinheiro),
      DB.setDocRoot('config', 'canais_venda', canais)
    ]).then(function () {
      _data.dinheiro = _normalizeMoneyConfig(dinheiro);
      _data.canais = _normalizeChannels(canais);
      UI.toast('Regras de preço salvas', 'success');
      _renderRegras();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _addCanalVenda() {
    _data.canais = _collectCanaisVenda().concat([{ name: '', commissionPct: 0, fixedFee: 0, taxPct: 21 }]);
    var list = document.getElementById('dn-channel-list');
    if (list) list.innerHTML = _channelRows(_data.canais);
  }

  function _removeCanalVenda(idx) {
    _data.canais = _collectCanaisVenda();
    if (_data.canais[idx] && _isCardapioChannel(_data.canais[idx])) {
      UI.toast('O canal Cardápio é fixo e não pode ser excluído.', 'info');
      return;
    }
    _data.canais.splice(idx, 1);
    var list = document.getElementById('dn-channel-list');
    if (list) list.innerHTML = _channelRows(_data.canais);
  }

  function _settings(title, desc, body, collect, configKey) {
    _content('<div style="background:#fff;border-radius:14px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,.06);max-width:900px;">' +
      '<h2 style="font-size:20px;font-weight:800;margin-bottom:4px;">' + title + '</h2><p style="color:#8A7E7C;margin-bottom:16px;">' + desc + '</p>' +
      '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">' + body + '</div>' +
      '<button id="din-save-settings" style="margin-top:16px;background:#C4362A;color:#fff;border:none;padding:12px 18px;border-radius:10px;font-weight:800;cursor:pointer;font-family:inherit;">Salvar</button></div>');
    document.getElementById('din-save-settings').onclick = function () {
      var data = collect();
      DB.setDocRoot('config', configKey, data).then(function () {
        if (configKey === 'geral') _data.geral = data;
        else _data.dinheiro = _normalizeMoneyConfig(data);
        UI.toast('Configurações salvas', 'success');
      }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
    };
  }

  function _content(html) {
    var el = document.getElementById('dinheiro-content');
    if (el) el.innerHTML = html;
  }

  function _kpi(label, value, note) {
    return '<div style="background:#fff;border-radius:14px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.06);"><div style="font-size:11px;color:#8A7E7C;text-transform:uppercase;font-weight:800;">' + _esc(label) + '</div><div style="font-size:22px;font-weight:900;color:#1A1A1A;margin-top:6px;">' + value + '</div><div style="font-size:12px;color:#8A7E7C;margin-top:4px;">' + _esc(note || '') + '</div></div>';
  }

  function _statusBadge(status) {
    var colors = {
      'saudável': ['#EDFAF3', '#1A9E5A'],
      'atenção': ['#FFF7ED', '#D97706'],
      'margem baixa': ['#FFF0EE', '#C4362A'],
      'prejuízo': ['#FEE2E2', '#991B1B'],
      'sem custo': ['#F2EDED', '#8A7E7C'],
      'sem preço': ['#F2EDED', '#8A7E7C'],
      'sem dados': ['#F2EDED', '#8A7E7C']
    }[status] || ['#F2EDED', '#8A7E7C'];
    return '<span style="display:inline-block;padding:4px 8px;border-radius:999px;background:' + colors[0] + ';color:' + colors[1] + ';font-size:11px;font-weight:800;">' + _esc(status) + '</span>';
  }

  function _field(id, label, value, type) {
    return '<label style="' + _labelWrap() + '"><span style="' + _label() + '">' + _esc(label) + '</span><input id="' + id + '" type="' + (type || 'text') + '" value="' + _esc(value == null ? '' : value) + '" style="' + _input() + '"></label>';
  }

  function _labelWrap() { return 'display:block;'; }
  function _label() { return 'display:block;font-size:11px;font-weight:800;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;'; }
  function _input() { return 'width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;background:#fff;box-sizing:border-box;'; }
  function _th(h) { return '<th style="padding:11px 12px;text-align:left;font-size:11px;font-weight:800;color:#8A7E7C;text-transform:uppercase;white-space:nowrap;">' + _esc(h) + '</th>'; }
  function _td(v) { return '<td style="padding:12px;font-size:13px;vertical-align:top;white-space:nowrap;">' + v + '</td>'; }
  function _byId(list, id) { return (list || []).find(function (x) { return String(x.id) === String(id); }) || null; }
  function _num(v) { return parseFloat(String(v == null ? '' : v).replace(',', '.')) || 0; }
  function _val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function destroy() {}

  return {
    render: render,
    destroy: destroy,
    _switchSub: _switchSub,
    _filterProducts: _filterProducts,
    _openProductModal: _openProductModal,
    _updateProductPriceModal: _updateProductPriceModal,
    _saveProductPrice: _saveProductPrice,
    _closeProductModal: _closeProductModal,
    _saveRegras: _saveRegras,
    _goPriceFilter: _goPriceFilter,
    _addCanalVenda: _addCanalVenda,
    _removeCanalVenda: _removeCanalVenda,
    _renderListaPrecos: _renderListaPrecos,
    _printPriceList: _printPriceList,
    _applySimulatorChannel: _applySimulatorChannel,
    _updateSimulador: _updateSimulador
  };
})();
