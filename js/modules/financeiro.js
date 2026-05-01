// js/modules/financeiro.js
window.Modules = window.Modules || {};
Modules.Financeiro = (function () {
  'use strict';

  var _activeSub = 'visao-geral';
  var _movimentacoes = [];
  var _contasBancarias = [];
  var _contasPagar = [];
  var _categorias = [];
  var _configFin = {};
  var _configGeral = {};
  var _editingId = null;
  var _compras = [];
  var _fornecedores = [];
  var _clientes = [];
  var _itensCusto = [];

  var TABS = [
    { key: 'visao-geral',       label: 'Visão Geral' },
    { key: 'fluxo-caixa',      label: 'Fluxo de Caixa' },
    { key: 'movimentacoes',    label: 'Entradas' },
    { key: 'contas-pagar',     label: 'Saídas' },
    { key: 'configuracoes',    label: 'Configurações' }
  ];

  var FORMAS_PAG_DEFAULT = ['Dinheiro', 'Transferência', 'MB Way', 'Multibanco', 'Cartão', 'Cheque', 'Outro'];
  var TIPOS_CONTA = ['Conta corrente', 'Conta poupança', 'Caixa / cofre', 'Carteira'];

  // ── SHELL ─────────────────────────────────────────────────────────────────
  function render(sub) {
    _activeSub = sub || 'visao-geral';
    var app = document.getElementById('app');
    app.innerHTML =
      '<div id="fin-root" class="module-page">' +
        '<div class="module-head">' +
          '<div><h1>Financeiro</h1><p>Controle de saldo, fluxo de caixa, entradas e saídas.</p></div>' +
        '</div>' +
        '<div id="fin-tabs" class="module-tabs"></div>' +
        '<div id="fin-content" class="module-content"></div>' +
      '</div>';
    _renderTabs();
    _loadSub(_activeSub);
  }

  function _renderTabs() {
    var el = document.getElementById('fin-tabs');
    if (!el) return;
    el.innerHTML = TABS.map(function (t) {
      var active = t.key === _activeSub;
      return '<button onclick="Modules.Financeiro._switchSub(\'' + t.key + '\')" class="' + (active ? 'active' : '') + '">' + t.label + '</button>';
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
    if (!content) return;
    content.innerHTML = '<div class="loading-inline">Carregando...</div>';
    if (key === 'visao-geral')       return _loadVisaoGeral();
    if (key === 'fluxo-caixa')      return _loadFluxoCaixa();
    if (key === 'movimentacoes')    return _loadMovimentacoes();
    if (key === 'contas-pagar')     return _loadContasPagar();
    if (key === 'contas-bancarias') { _activeSub='configuracoes'; _cfgSub='contas-bancarias'; _renderTabs(); Router.navigate('financeiro/configuracoes'); return _loadConfiguracoes(); }
    if (key === 'configuracoes')    return _loadConfiguracoes();
    if (key === 'entradas' || key === 'saidas') { _activeSub = 'movimentacoes'; _renderTabs(); Router.navigate('financeiro/movimentacoes'); return _loadMovimentacoes(); }
    if (key === 'apagar') { _activeSub = 'contas-pagar'; _renderTabs(); Router.navigate('financeiro/contas-pagar'); return _loadContasPagar(); }
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────
  function _esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }
  function _fmtDateDisplay(raw) {
    if (!raw) return '—';
    var d = null;
    if (raw && typeof raw.toDate === 'function') d = raw.toDate();
    else if (raw instanceof Date) d = raw;
    else if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) d = new Date(raw + 'T00:00:00');
    else d = new Date(raw);
    return (d && !isNaN(d.getTime())) ? UI.fmtDate(d) : '—';
  }
  function _fmtVal(n) {
    n = parseFloat(n) || 0;
    return '€\u00a0' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  function _parseNum(v) { return parseFloat(String(v || '').replace(',', '.')) || 0; }
  function _today() { return new Date().toISOString().slice(0, 10); }
  function _inp() { return 'width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;'; }
  function _lbl() { return 'font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;text-transform:uppercase;'; }
  function _g2()  { return 'display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;'; }
  function _g3()  { return 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;'; }

  function _statusCP(cp) {
    if (cp.status === 'parcial') return 'parcial';
    if (cp.status === 'pago') return 'pago';
    if (cp.data_pagamento) return 'pago';
    if (cp.vencimento && cp.vencimento < _today()) return 'vencido';
    return 'pendente';
  }

  function _badgeTipo(tipo) {
    return tipo === 'entrada'
      ? '<span style="background:#DCFCE7;color:#16A34A;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;">Entrada</span>'
      : '<span style="background:#FEE2E2;color:#DC2626;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;">Saída</span>';
  }
  function _badgeSt(s) {
    var m = { pago:['#DCFCE7','#16A34A','Pago'], parcial:['#EFF6FF','#2563EB','Parcial'], pendente:['#FEF9C3','#CA8A04','Pendente'], vencido:['#FEE2E2','#DC2626','Vencido'], efetivado:['#DCFCE7','#16A34A','Efetivado'], previsto:['#EFF6FF','#3B82F6','Previsto'] }[s] || ['#F3F4F6','#6B7280',s];
    return '<span style="background:' + m[0] + ';color:' + m[1] + ';padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;">' + m[2] + '</span>';
  }
  function _badgeEntradaStatus(s) {
    var m = { previsto:['#EFF6FF','#2563EB','A receber',''], efetivado:['#DCFCE7','#16A34A','Recebido',''], parcial:['#FEF9C3','#B45309','Parcial','Recebido parcialmente'] }[s] || ['#F3F4F6','#6B7280',s||'—',''];
    return '<span '+(m[3]?'title="'+_esc(m[3])+'" ':'')+'style="background:' + m[0] + ';color:' + m[1] + ';padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;">' + m[2] + '</span>';
  }
  function _badgeSaidaStatus(s) {
    var m = { pago:['#DCFCE7','#16A34A','Já pago',''], parcial:['#FEF9C3','#B45309','Parcial','Pago parcialmente'], pendente:['#EFF6FF','#2563EB','A pagar',''], vencido:['#FEE2E2','#DC2626','Vencida',''] }[s] || ['#F3F4F6','#6B7280',s||'—',''];
    return '<span '+(m[3]?'title="'+_esc(m[3])+'" ':'')+'style="background:' + m[0] + ';color:' + m[1] + ';padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;">' + m[2] + '</span>';
  }
  function _movEntradaPendente(m) {
    var info=_movValorInfo(m);
    return info.status==='parcial' ? info.saldoRestante : info.valorRow;
  }

  function _movValorInfo(m) {
    var st=(m&&m.status)||'efetivado';
    var valorTotalOriginal=_parseNum(m && (m.valorTotalOriginal || (m.parcelamento&&m.parcelamento.valorTotalOriginal) || m.valor));
    var valorParcela=_parseNum(m && (m.valorParcela || (m.parcelamento&&m.parcelamento.valorParcela) || m.valor));
    if(!valorParcela && (m&&m.parcelaNumero)) valorParcela=_parseNum(m.valor);
    if(!valorParcela) valorParcela=valorTotalOriginal;
    var valorRecebido=_parseNum(m && (m.valorRecebido || m.valor_recebido_total));
    if(!valorRecebido && st==='efetivado') valorRecebido=valorParcela;
    var saldoRestante=_parseNum(m && (m.saldoRestante || m.saldo_restante));
    if(!saldoRestante && st==='parcial') saldoRestante=Math.max(0,valorTotalOriginal-valorRecebido);
    return {
      status: st,
      valorTotalOriginal: valorTotalOriginal,
      valorParcela: valorParcela,
      valorRecebido: valorRecebido,
      saldoRestante: saldoRestante,
      displayValor: st==='parcial' ? valorTotalOriginal : (st==='efetivado' ? valorRecebido : valorParcela),
      valorRow: valorParcela || valorTotalOriginal
    };
  }

  function _cpValorInfo(cp) {
    var st=_statusCP(cp);
    var valorTotalOriginal=_parseNum(cp && (cp.valorTotalOriginal || cp.valor_total_original || cp.valor));
    var valorParcela=_parseNum(cp && (cp.valorParcela || cp.valor_parcela || cp.valor));
    if(!valorParcela && (cp&&cp.parcelaNumero)) valorParcela=_parseNum(cp.valor);
    if(!valorParcela) valorParcela=valorTotalOriginal;
    var valorPago=_parseNum(cp && (cp.valorPago || cp.valor_pago_total));
    if(!valorPago && st==='pago') valorPago=valorParcela;
    var saldoRestante=_parseNum(cp && (cp.saldoRestante || cp.saldo_restante));
    if(!saldoRestante && st==='parcial') saldoRestante=Math.max(0,valorTotalOriginal-valorPago);
    var valorVencido=(st==='vencido')?Math.max(0,valorTotalOriginal-valorPago):0;
    return {
      status: st,
      valorTotalOriginal: valorTotalOriginal,
      valorParcela: valorParcela,
      valorPago: valorPago,
      saldoRestante: saldoRestante,
      valorVencido: valorVencido,
      displayValor: st==='parcial' ? valorTotalOriginal : (st==='pago' ? valorPago : valorParcela),
      valorRow: valorParcela || valorTotalOriginal
    };
  }

  function _saldoConta(c) {
    var ent = _movimentacoes.filter(function(m){ return m.conta_id===c.id && m.tipo==='entrada' && (m.status==='efetivado' || m.status==='parcial'); }).reduce(function(s,m){
      var info=_movValorInfo(m);
      return s + (m.status==='parcial' ? info.valorRecebido : info.valorRow);
    },0);
    var sai = _movimentacoes.filter(function(m){ return m.conta_id===c.id && m.tipo==='saida'   && (m.status==='efetivado' || m.status==='parcial'); }).reduce(function(s,m){
      var info=_movValorInfo(m);
      return s + (m.status==='parcial' ? info.valorPago : info.valorRow);
    },0);
    return _parseNum(c.saldo_inicial) + ent - sai;
  }
  function _saldoTotal() {
    return _contasBancarias.filter(function(c){ return c.ativo!==false; }).reduce(function(s,c){ return s+_saldoConta(c); },0);
  }
  function _mesAtual() { return new Date().toISOString().slice(0,7); }
  function _movMes() {
    var mes=_mesAtual(); var ent=0,sai=0;
    _movimentacoes.forEach(function(m){
      if(!m.data||m.data.slice(0,7)!==mes) return;
      if(m.tipo==='entrada'&&(m.status==='efetivado'||m.status==='parcial')){
        var einfo=_movValorInfo(m);
        ent += (m.status==='parcial' ? einfo.valorRecebido : einfo.valorRow);
      }
      if(m.tipo==='saida'&&(m.status==='efetivado'||m.status==='parcial')){
        var sinfo=_movValorInfo(m);
        sai += (m.status==='parcial' ? sinfo.valorPago : sinfo.valorRow);
      }
    });
    return {entradas:ent,saidas:sai};
  }
  function _totalAPagar() {
    return _contasPagar.filter(function(cp){ return _statusCP(cp)!=='pago'; }).reduce(function(s,cp){
      var info=_cpValorInfo(cp);
      return s + (_statusCP(cp)==='parcial' ? info.saldoRestante : info.valorRow);
    },0);
  }
  function _formasPag() {
    return (_configFin.formas_pagamento && _configFin.formas_pagamento.length) ? _configFin.formas_pagamento : FORMAS_PAG_DEFAULT;
  }
  function _catsByTipo(tipo) {
    return (_categorias||[]).filter(function(c){ return c.tipo===tipo; }).map(function(c){ return c.nome||''; }).filter(Boolean);
  }
  function _uniqById(items) {
    var seen = {};
    return (items || []).filter(function (item, idx) {
      var id = item && item.id ? item.id : 'idx-' + idx;
      if (seen[id]) return false;
      seen[id] = true;
      return true;
    });
  }
  function _normalizeLegacyMov(tipo) {
    return function (m) {
      var valor=_parseNum(m.valor);
      var recebido=_parseNum(m.valorRecebido || m.valor_recebido_total);
      var saldo=_parseNum(m.saldoRestante || m.saldo_restante);
      var normStatus=String(m.status||'').toLowerCase();
      if(normStatus!=='previsto'&&normStatus!=='parcial') normStatus='efetivado';
      return Object.assign({}, m, {
        tipo: tipo,
        descricao: m.descricao || m.description || m.nome || '—',
        data: m.data || m.date || '',
        valor: valor,
        valorTotalOriginal: _parseNum(m.valorTotalOriginal || m.valor_total_original || valor),
        valorParcela: _parseNum(m.valorParcela || m.valor_parcela || valor),
        valorRecebido: recebido || (normStatus==='efetivado' ? valor : 0),
        saldoRestante: saldo || (normStatus==='parcial' ? Math.max(0,valor-recebido) : (normStatus==='previsto' ? valor : 0)),
        status: normStatus,
        conta_id: m.conta_id || m.contaId || '',
        categoria: m.categoria || m.category || '',
        forma_pagamento: m.forma_pagamento || m.paymentMethod || ''
      });
    };
  }
  function _normalizeLegacyCP(cp) {
    var pago = cp.status === 'Pago' || cp.status === 'pago' || !!cp.data_pagamento;
    var valor=_parseNum(cp.valor);
    var valorPago=_parseNum(cp.valorPago || cp.valor_pago_total || (pago ? valor : 0));
    var normStatus=String(cp.status||'').toLowerCase();
    if(!normStatus){
      normStatus=valorPago>0&&valorPago<valor?'parcial':(pago?'pago':(cp.vencimento&&cp.vencimento<_today()?'vencido':'pendente'));
    }
    return Object.assign({}, cp, {
      descricao: cp.descricao || cp.description || cp.nome || '—',
      vencimento: cp.vencimento || cp.dueDate || cp.data || '',
      data_pagamento: cp.data_pagamento || (pago ? (cp.paidAt || _today()) : null),
      valor: valor,
      valorTotalOriginal: _parseNum(cp.valorTotalOriginal || cp.valor_total_original || valor),
      valorParcela: _parseNum(cp.valorParcela || cp.valor_parcela || valor),
      valorPago: valorPago,
      saldoRestante: _parseNum(cp.saldoRestante || cp.saldo_restante || (pago ? 0 : valor)),
      status: normStatus,
      categoria: cp.categoria || cp.category || '',
      fornecedor: cp.fornecedor || cp.supplier || ''
    });
  }
  function _loadMovimentacoesData() {
    return Promise.all([DB.getAll('movimentacoes'), DB.getAll('financeiro_entradas'), DB.getAll('financeiro_saidas')]).then(function (r) {
      return _uniqById((r[0] || []).concat((r[1] || []).map(_normalizeLegacyMov('entrada')), (r[2] || []).map(_normalizeLegacyMov('saida'))));
    });
  }
  function _loadContasPagarData() {
    return Promise.all([DB.getAll('contas_pagar'), DB.getAll('financeiro_apagar')]).then(function (r) {
      return _uniqById((r[0] || []).concat((r[1] || []).map(_normalizeLegacyCP)));
    });
  }

  // ── VISÃO GERAL ──────────────────────────────────────────────────────────
  function _loadVisaoGeral() {
    Promise.all([_loadMovimentacoesData(),DB.getAll('contas_bancarias'),_loadContasPagarData()]).then(function(r){
      _movimentacoes=r[0]||[]; _contasBancarias=r[1]||[]; _contasPagar=r[2]||[];
      _paintVisaoGeral();
    });
  }

  function _paintVisaoGeral() {
    var content=document.getElementById('fin-content'); if(!content) return;
    var mes=_movMes(); var saldo=_saldoTotal(); var aPagar=_totalAPagar();
    var vencidasList=_contasPagar.filter(function(cp){ return _statusCP(cp)==='vencido'; });
    var vencidas=vencidasList.length;
    var valorVencido=vencidasList.reduce(function(s,cp){ return s+_parseNum(cp.valor); },0);
    var recentes=_movimentacoes.slice().sort(function(a,b){ return (b.data||'').localeCompare(a.data||''); }).slice(0,8);
    var prevKey=(function(){ var d=new Date(); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,7); })();
    var prev={entradas:0,saidas:0};
    _movimentacoes.forEach(function(m){
      if(!m.data||m.data.slice(0,7)!==prevKey||m.status!=='efetivado') return;
      m.tipo==='entrada'?prev.entradas+=_parseNum(m.valor):prev.saidas+=_parseNum(m.valor);
    });
    var netAtual=mes.entradas-mes.saidas;
    var netPrev=prev.entradas-prev.saidas;
    var saldoProjetado=saldo-aPagar;
    var trend=function(atual,anterior,positivoBom){
      if(!anterior&&!atual) return {text:'Sem movimento no mês anterior',color:'#8A7E7C',bg:'#F8F6F5'};
      if(!anterior) return {text:'Novo movimento neste mês',color:'#2563EB',bg:'#EEF4FF'};
      var pct=((atual-anterior)/Math.abs(anterior))*100;
      var good=positivoBom ? pct>=0 : pct<=0;
      return {text:(pct>=0?'+':'')+pct.toFixed(0).replace('.',',')+'% vs mês anterior',color:good?'#16A34A':'#DC2626',bg:good?'#EDFAF3':'#FFF0EE'};
    };
    var resultTrend=function(atual,anterior){
      if(!anterior) return {text:'Sem dados do mês anterior',color:'#8A7E7C',bg:'#F8F6F5'};
      var pct=((atual-anterior)/Math.abs(anterior))*100;
      return {text:(pct>=0?'+':'')+pct.toFixed(0).replace('.',',')+'%',color:pct>=0?'#16A34A':'#DC2626',bg:pct>=0?'#EDFAF3':'#FFF0EE'};
    };
    var insight=function(text,color,bg){
      return '<div style="margin-top:8px;font-size:12px;font-weight:400;color:'+color+';background:'+bg+';border-radius:9px;padding:7px 9px;line-height:1.3;">'+text+'</div>';
    };
    var pluralConta=function(n){ return n===1?'1 conta vencida':n+' contas vencidas'; };
    var kS='background:#fff;border:1.5px solid transparent;border-radius:14px;padding:18px 20px;box-shadow:0 2px 8px rgba(0,0,0,.06);min-height:174px;display:flex;flex-direction:column;';
    var kL='font-size:11px;font-weight:500;color:#8A7E7C;text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px;';
    var card=function(label,value,color,desc,tr,extra,urgent,variant){
      var style=kS;
      var valueSize='28px';
      var valueWeight='600';
      if(urgent) style+='border:1.5px solid #FECACA;background:#FFFBFA;';
      if(variant==='primary') style+='border-color:#B7E4C7;background:#F7FFF9;';
      if(variant==='neutral') { style+='background:#fff;'; valueWeight='500'; }
      if(variant==='risk') style+='border:1.5px solid '+(saldoProjetado<0?'#FECACA':'#D7EBDD')+';background:'+(saldoProjetado<0?'#FFFBFA':'#F7FFF9')+';';
      return '<div style="'+style+'">'+
        '<div style="'+kL+'">'+label+'</div>'+
        '<div style="font-family:\'League Spartan\',sans-serif;font-size:'+valueSize+';font-weight:'+valueWeight+';color:'+(color||'#1F2937')+';margin-bottom:6px;">'+value+'</div>'+
        '<div style="font-size:12px;font-weight:400;color:#8A7E7C;line-height:1.35;margin-bottom:10px;">'+desc+'</div>'+
        '<div style="margin-top:auto;">'+
        (tr?'<div style="display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;background:'+tr.bg+';color:'+tr.color+';font-size:11px;font-weight:500;">'+tr.text+'</div>':'')+
        (extra||'')+
        '</div>'+
      '</div>';
    };
    content.innerHTML=
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">'+
        card('Resultado do mês',_fmtVal(netAtual),netAtual>=0?'#16A34A':'#DC2626','Entradas menos saídas efetivadas no mês.',resultTrend(netAtual,netPrev),insight(netAtual>=0?'Você está positivo este mês':'Você está operando no prejuízo',netAtual>=0?'#166534':'#991B1B',netAtual>=0?'#EDFAF3':'#FFF0EE'),false,'primary')+
        card('Saldo projetado',_fmtVal(saldoProjetado),saldoProjetado>=0?'#1F2937':'#DC2626','Considerando contas a pagar',null,insight(saldoProjetado>=0?'Saldo positivo após contas':'Atenção: seu saldo ficará negativo',saldoProjetado>=0?'#166534':'#991B1B',saldoProjetado>=0?'#EDFAF3':'#FFF0EE'),false,'risk')+
        card('A pagar',_fmtVal(aPagar),vencidas>0?'#DC2626':'#D97706',(aPagar===0?'Nenhuma saída pendente no momento.':'Total pendente em saídas.'),null,(vencidas>0?'<div style="margin-top:10px;padding:8px 10px;border-radius:10px;background:#FFF0EE;color:#C4362A;font-size:12px;font-weight:500;">'+pluralConta(vencidas)+' · '+_fmtVal(valorVencido)+' em atraso</div><button onclick="Modules.Financeiro._openContasVencidas()" style="width:100%;margin-top:10px;border:none;background:#C4362A;color:#fff;border-radius:10px;padding:9px 12px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Ver saídas vencidas</button>':'<button onclick="Modules.Financeiro._switchSub(\'contas-pagar\')" style="width:100%;margin-top:10px;border:1.5px solid #D4C8C6;background:#fff;color:#1A1A1A;border-radius:10px;padding:9px 12px;font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;">Gerir saídas</button>'),vencidas>0)+
        card('Saldo total',_fmtVal(saldo),'#374151',(saldo===0?'Cadastre uma conta bancária ou movimentação para iniciar o saldo.':'Saldo das contas ativas com movimentações efetivadas.'),trend(netAtual,netPrev,true),null,false,'neutral')+
        card('Entradas do mês',_fmtVal(mes.entradas),'#16A34A',(mes.entradas===0?'Ainda não há entradas efetivadas neste mês.':'Receitas efetivadas no mês atual.'),trend(mes.entradas,prev.entradas,true))+
        card('Saídas do mês',_fmtVal(mes.saidas),'#DC2626',(mes.saidas===0?'Ainda não há saídas efetivadas neste mês.':'Despesas efetivadas no mês atual.'),trend(mes.saidas,prev.saidas,false))+
      '</div>'+
      '<div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;">'+
        '<div style="'+kS+'">'+
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">'+
            '<h3 style="font-size:14px;font-weight:600;">Movimentações Recentes</h3>'+
            '<button onclick="Modules.Financeiro._switchSub(\'movimentacoes\')" style="font-size:12px;color:#C4362A;background:none;border:none;cursor:pointer;font-weight:500;">Ver todas →</button>'+
          '</div>'+
          (recentes.length===0?'<p style="text-align:center;color:#8A7E7C;padding:20px 0;font-size:13px;">Nenhuma movimentação ainda</p>':
            '<div style="display:flex;flex-direction:column;gap:0;">'+
            recentes.map(function(m){
              var conta=_contasBancarias.find(function(c){ return c.id===m.conta_id; });
              var tipo=m.tipo==='entrada'?'Entrada':'Saída';
              var detalhe=[tipo,m.categoria||'',conta?conta.nome:'',m.data||''].filter(Boolean).join(' · ');
              return '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #F2EDED;">'+
                '<div style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:'+(m.tipo==='entrada'?'#DCFCE7':'#FEE2E2')+';color:'+(m.tipo==='entrada'?'#16A34A':'#DC2626')+';font-size:15px;font-weight:600;flex-shrink:0;">'+(m.tipo==='entrada'?'↑':'↓')+'</div>'+
                '<div style="flex:1;min-width:0;">'+
                  '<div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+_esc(m.descricao||'—')+'</div>'+
                  '<div style="font-size:11px;font-weight:400;color:#8A7E7C;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+_esc(detalhe)+'</div>'+
                '</div>'+
                '<div style="font-size:14px;font-weight:600;color:'+(m.tipo==='entrada'?'#16A34A':'#DC2626')+';flex-shrink:0;">'+(m.tipo==='saida'?'−':'+')+_fmtVal(m.valor)+'</div>'+
              '</div>';
            }).join('')+'</div>')+
        '</div>'+
        '<div style="'+kS+'">'+
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">'+
            '<h3 style="font-size:14px;font-weight:600;">Contas Bancárias</h3>'+
            '<button onclick="Modules.Financeiro._switchSub(\'contas-bancarias\')" style="font-size:12px;color:#C4362A;background:none;border:none;cursor:pointer;font-weight:500;">Gerir →</button>'+
          '</div>'+
          (_contasBancarias.length===0?'<div style="text-align:center;color:#8A7E7C;padding:26px 6px;font-size:13px;font-weight:400;"><div style="font-weight:500;color:#1A1A1A;margin-bottom:6px;">Nenhuma conta bancária cadastrada</div><div style="line-height:1.45;margin-bottom:14px;">Adicione uma conta para que o saldo total e os saldos por conta fiquem úteis.</div><button onclick="Modules.Financeiro._openContaModal(null)" style="border:none;background:#C4362A;color:#fff;border-radius:10px;padding:10px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Adicionar conta</button></div>':
            '<div style="display:flex;flex-direction:column;gap:8px;">'+
            _contasBancarias.filter(function(c){ return c.ativo!==false; }).map(function(c){
              var s=_saldoConta(c);
              return '<div style="padding:10px 12px;border-radius:10px;background:#F8F6F5;">'+
                '<div style="font-size:13px;font-weight:500;">'+_esc(c.nome)+'</div>'+
                '<div style="font-size:11px;font-weight:400;color:#8A7E7C;margin-bottom:4px;">'+_esc(c.banco||c.tipo||'')+'</div>'+
                '<div style="font-size:16px;font-weight:600;color:'+(s>=0?'#16A34A':'#DC2626')+';">'+_fmtVal(s)+'</div>'+
              '</div>';
            }).join('')+'</div>')+
        '</div>'+
      '</div>';
  }

  // ── FLUXO DE CAIXA ────────────────────────────────────────────────────────
  var _fluxoFiltro={status:{efetivado:true,previsto:true,vencido:true},periodo:'60',inicio:'',fim:'',busca:'',ordem:'asc'};

  function _loadFluxoCaixa() {
    Promise.all([_loadMovimentacoesData(),DB.getAll('contas_bancarias'),_loadContasPagarData()]).then(function(r){
      _movimentacoes=r[0]||[]; _contasBancarias=r[1]||[]; _contasPagar=r[2]||[];
      _paintFluxoCaixa();
    });
  }

  function _paintFluxoCaixa() {
    var content=document.getElementById('fin-content'); if(!content) return;
    var hoje=_today(); var saldoAtual=_saldoTotal();
    var start=hoje;
    var limite=new Date();
    var dias=_fluxoFiltro.periodo==='0'?0:(parseInt(_fluxoFiltro.periodo,10)||60);
    if(_fluxoFiltro.periodo==='custom'){
      start=_fluxoFiltro.inicio||hoje;
      limite=new Date(_fluxoFiltro.fim||start);
    } else {
      limite.setDate(limite.getDate()+dias);
    }
    var limiteStr=limite.toISOString().slice(0,10);
    var eventos=[];
    var normStatus=function(st){ return (st==='pendente'||st==='parcial')?'previsto':st; };
    var incluiStatus=function(st){
      st=normStatus(st||'previsto');
      return !!(_fluxoFiltro.status&&_fluxoFiltro.status[st]);
    };
    var busca=(_fluxoFiltro.busca||'').toLowerCase();
    _movimentacoes.filter(function(m){ return m.data&&m.data>=start&&m.data<=limiteStr&&incluiStatus(m.status||'efetivado'); }).forEach(function(m){
      eventos.push({
        data:m.data,
        tipo:m.tipo==='entrada'?'entrada':'saida',
        status:normStatus(m.status||'efetivado'),
        descricao:m.descricao||'Movimentação',
        categoria:m.categoria||'',
        entrada:m.tipo==='entrada'?_parseNum(m.valor):0,
        saida:m.tipo==='saida'?_parseNum(m.valor):0,
        order:m.tipo==='entrada'?1:2
      });
    });
    _contasPagar.filter(function(cp){ return _statusCP(cp)!=='pago'&&cp.vencimento>=start&&incluiStatus(_statusCP(cp)); }).forEach(function(cp){
      if(cp.vencimento>limiteStr) return;
      eventos.push({
        data:cp.vencimento,
        tipo:'saida',
        status:normStatus(_statusCP(cp)),
        descricao:cp.descricao||'Saída',
        categoria:cp.categoria||cp.fornecedor||'Saída',
        entrada:0,
        saida:_parseNum(cp.valor),
        order:3
      });
    });
    if(busca){
      eventos=eventos.filter(function(ev){
        return String(ev.descricao||'').toLowerCase().indexOf(busca)>=0;
      });
    }
    var running=saldoAtual;
    var rows=eventos.sort(function(a,b){
      var byDate=a.data.localeCompare(b.data);
      if(byDate) return byDate;
      return a.order-b.order;
    });
    if(_fluxoFiltro.ordem==='desc') rows.reverse();
    rows=rows.map(function(ev){
      running+=ev.entrada-ev.saida;
      ev.saldo=running;
      return ev;
    });
    var fSt='padding:8px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:12px;font-family:inherit;outline:none;background:#fff;';
    var showCustom=_fluxoFiltro.periodo==='custom';
    content.innerHTML=
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">'+
        '<div><h2 style="font-size:18px;font-weight:800;margin-bottom:4px;">Fluxo de Caixa</h2>'+
          '<p style="font-size:12px;color:#8A7E7C;">Saldo atual: <strong style="color:'+(saldoAtual>=0?'#16A34A':'#DC2626')+';">'+_fmtVal(saldoAtual)+'</strong> · Projeção de saldo baseada em entradas previstas e contas a pagar.</p></div>'+
      '</div>'+
      '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,.06);padding:14px;margin-bottom:16px;">'+
        '<div style="display:grid;grid-template-columns:260px 190px 1fr;gap:10px;align-items:end;">'+
          '<div><label style="'+_lbl()+'">Status</label><div style="min-height:35px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'+
            '<label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#1A1A1A;"><input type="checkbox" '+(_fluxoFiltro.status.efetivado?'checked':'')+' onchange="Modules.Financeiro._setFluxoFiltro(\'status.efetivado\',this.checked)" style="accent-color:#C4362A;"> Efetivado</label>'+
            '<label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#1A1A1A;"><input type="checkbox" '+(_fluxoFiltro.status.previsto?'checked':'')+' onchange="Modules.Financeiro._setFluxoFiltro(\'status.previsto\',this.checked)" style="accent-color:#C4362A;"> Previsto</label>'+
            '<label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#1A1A1A;"><input type="checkbox" '+(_fluxoFiltro.status.vencido?'checked':'')+' onchange="Modules.Financeiro._setFluxoFiltro(\'status.vencido\',this.checked)" style="accent-color:#C4362A;"> Vencido</label>'+
          '</div></div>'+
          '<div><label style="'+_lbl()+'">Período</label><select onchange="Modules.Financeiro._setFluxoFiltro(\'periodo\',this.value)" style="'+fSt+'width:100%;">'+
            '<option value="0"'+(_fluxoFiltro.periodo==='0'?' selected':'')+'>Hoje</option>'+
            '<option value="7"'+(_fluxoFiltro.periodo==='7'?' selected':'')+'>Próximos 7 dias</option>'+
            '<option value="30"'+(_fluxoFiltro.periodo==='30'?' selected':'')+'>Próximos 30 dias</option>'+
            '<option value="60"'+(_fluxoFiltro.periodo==='60'?' selected':'')+'>Próximos 60 dias</option>'+
            '<option value="custom"'+(_fluxoFiltro.periodo==='custom'?' selected':'')+'>Personalizado</option>'+
          '</select></div>'+
          '<div><label style="'+_lbl()+'">Busca</label><input type="search" value="'+_esc(_fluxoFiltro.busca||'')+'" oninput="Modules.Financeiro._setFluxoFiltro(\'busca\',this.value)" placeholder="Buscar por descrição..." style="'+fSt+'width:100%;"></div>'+
        '</div>'+
        '<div style="display:'+(showCustom?'grid':'none')+';grid-template-columns:180px 180px;gap:10px;margin-top:10px;">'+
          '<div><label style="'+_lbl()+'">Data inicial</label><input type="date" value="'+_esc(_fluxoFiltro.inicio||hoje)+'" onchange="Modules.Financeiro._setFluxoFiltro(\'inicio\',this.value)" style="'+fSt+'width:100%;"></div>'+
          '<div><label style="'+_lbl()+'">Data final</label><input type="date" value="'+_esc(_fluxoFiltro.fim||limiteStr)+'" onchange="Modules.Financeiro._setFluxoFiltro(\'fim\',this.value)" style="'+fSt+'width:100%;"></div>'+
        '</div>'+
      '</div>'+
      (rows.length===0
        ?'<div style="text-align:center;padding:60px 20px;color:#8A7E7C;"><div style="font-size:14px;font-weight:600;">Nenhum evento encontrado</div><div style="font-size:12px;margin-top:6px;">Ajuste os filtros ou adicione previsões e contas a pagar.</div></div>'
        :'<div style="background:#fff;border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,.06);overflow:hidden;">'+
            '<table style="width:100%;border-collapse:collapse;">'+
              '<thead><tr style="background:#F8F6F5;">'+
                '<th onclick="Modules.Financeiro._toggleFluxoOrdem()" style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;cursor:pointer;user-select:none;">Data '+(_fluxoFiltro.ordem==='asc'?'↑':'↓')+'</th>'+
                '<th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Evento</th>'+
                '<th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Status</th>'+
                '<th style="padding:11px 16px;text-align:right;font-size:11px;font-weight:700;color:#16A34A;text-transform:uppercase;">Entradas</th>'+
                '<th style="padding:11px 16px;text-align:right;font-size:11px;font-weight:700;color:#DC2626;text-transform:uppercase;">Saídas</th>'+
                '<th style="padding:11px 16px;text-align:right;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Saldo acumulado</th>'+
              '</tr></thead><tbody>'+
              rows.map(function(r){
                var statusLabel=r.status==='efetivado'?'Efetivado':(r.status==='vencido'?'Vencido':'Previsto');
                var statusColor=r.status==='efetivado'?'#166534':(r.status==='vencido'?'#DC2626':'#64748B');
                var statusBg=r.status==='efetivado'?'#DCFCE7':(r.status==='vencido'?'#FEE2E2':'#F8FAFC');
                var rowBg=r.status==='vencido'?'background:#FFF5F5;':(r.saldo<0?'background:#FFFBFA;':(r.status==='previsto'?'background:#FCFCFC;':''));
                return '<tr style="border-top:1px solid #F2EDED;'+rowBg+'">'+
                  '<td style="padding:11px 16px;font-size:13px;font-weight:600;white-space:nowrap;">'+_esc(r.data)+'</td>'+
                  '<td style="padding:11px 16px;font-size:13px;"><div style="font-weight:600;color:#1F2937;">'+_esc(r.descricao)+'</div><div style="font-size:11px;color:#8A7E7C;margin-top:2px;">'+(r.tipo==='entrada'?'Entrada':'Saída')+(r.categoria?' · '+_esc(r.categoria):'')+'</div></td>'+
                  '<td style="padding:11px 16px;"><span style="background:'+statusBg+';color:'+statusColor+';padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;">'+statusLabel+'</span></td>'+
                  '<td style="padding:11px 16px;text-align:right;font-size:13px;color:#16A34A;font-weight:700;">'+(r.entrada>0?'+'+_fmtVal(r.entrada):'—')+'</td>'+
                  '<td style="padding:11px 16px;text-align:right;font-size:13px;color:#DC2626;font-weight:700;">'+(r.saida>0?'−'+_fmtVal(r.saida):'—')+'</td>'+
                  '<td style="padding:11px 16px;text-align:right;font-size:14px;font-weight:800;color:'+(r.saldo>=0?'#16A34A':'#DC2626')+';">'+_fmtVal(r.saldo)+'</td>'+
                '</tr>';
              }).join('')+
              '</tbody></table></div>');
  }

  function _setFluxoFiltro(key,val){
    if(key.indexOf('status.')===0){
      var st=key.split('.')[1];
      _fluxoFiltro.status[st]=!!val;
    } else {
      _fluxoFiltro[key]=val;
    }
    if(key==='periodo'&&val==='custom'){
      _fluxoFiltro.inicio=_fluxoFiltro.inicio||_today();
      _fluxoFiltro.fim=_fluxoFiltro.fim||_today();
    }
    _paintFluxoCaixa();
  }

  function _toggleFluxoOrdem(){
    _fluxoFiltro.ordem=_fluxoFiltro.ordem==='asc'?'desc':'asc';
    _paintFluxoCaixa();
  }

  // ── MOVIMENTAÇÕES ─────────────────────────────────────────────────────────
  var _movFiltro={tipo:'todos',periodo:'mes',inicio:'',fim:'',contas:[],status:'',busca:'',ordem:'desc'};
  var _movSelecionadas=[];
  var _movVisiveis=[];

  function _loadMovimentacoes() {
    Promise.all([_loadMovimentacoesData(),DB.getAll('contas_bancarias'),DB.getAll('financeiro_categorias'),DB.getAll('store_customers'),DB.getAll('fornecedores')]).then(function(r){
      _movimentacoes=r[0]||[]; _contasBancarias=r[1]||[]; _categorias=r[2]||[]; _clientes=r[3]||[]; _fornecedores=r[4]||[];
      _paintMovimentacoes();
    });
  }

  function _paintMovimentacoes() {
    var content=document.getElementById('fin-content'); if(!content) return;
    var hoje=_today(); var mesStr=_mesAtual();
    var filtered=_movimentacoes.filter(function(m){
      var conta=_contasBancarias.find(function(c){ return c.id===m.conta_id; });
      var busca=(_movFiltro.busca||'').toLowerCase();
      if(m.tipo!=='entrada') return false;
      if(_movFiltro.contas&&_movFiltro.contas.length&&_movFiltro.contas.indexOf(m.conta_id)<0) return false;
      if(_movFiltro.status&&m.status!==_movFiltro.status) return false;
      if(_movFiltro.periodo==='hoje'&&m.data!==hoje) return false;
      if(_movFiltro.periodo==='semana'){ var dd=new Date(m.data),nn=new Date(); nn.setDate(nn.getDate()-7); if(dd<nn) return false; }
      if(_movFiltro.periodo==='mes'&&(!m.data||m.data.slice(0,7)!==mesStr)) return false;
      if(_movFiltro.periodo==='ano'&&(!m.data||m.data.slice(0,4)!==hoje.slice(0,4))) return false;
      if(_movFiltro.periodo==='custom'){
        if(_movFiltro.inicio&&(!m.data||m.data<_movFiltro.inicio)) return false;
        if(_movFiltro.fim&&(!m.data||m.data>_movFiltro.fim)) return false;
      }
      if(busca){
        var hay=[m.descricao,m.categoria,conta?conta.nome:'',m.pessoaNome,String(m.valor||'')].join(' ').toLowerCase();
        if(hay.indexOf(busca)<0) return false;
      }
      return true;
    }).sort(function(a,b){
      var cmp=(a.data||'').localeCompare(b.data||'');
      return _movFiltro.ordem==='asc'?cmp:-cmp;
    });
    _movVisiveis=filtered.map(function(m){ return m.id; });
    _movSelecionadas=_movSelecionadas.filter(function(id){ return filtered.some(function(m){ return m.id===id; }); });
    var totalPrevisto=filtered.filter(function(m){ return (m.status||'efetivado')==='previsto'; }).reduce(function(s,m){
      return s+_movValorInfo(m).valorRow;
    },0);
    var totalEfetivado=filtered.filter(function(m){ return (m.status||'efetivado')==='efetivado' || m.status==='parcial'; }).reduce(function(s,m){
      var info=_movValorInfo(m);
      return s+(m.status==='parcial'?info.valorRecebido:info.valorRow);
    },0);
    var totalParcial=filtered.filter(function(m){ return m.status==='parcial'; }).reduce(function(s,m){
      return s+_movValorInfo(m).saldoRestante;
    },0);
    var fSt='padding:8px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:12px;font-family:inherit;outline:none;background:#fff;cursor:pointer;';
    var contasHtml='<label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#1A1A1A;"><input type="checkbox" '+((!_movFiltro.contas||!_movFiltro.contas.length)?'checked':'')+' onchange="Modules.Financeiro._setMovFiltro(\'contas\',[])" style="accent-color:#C4362A;"> Todas as contas</label>'+
      _contasBancarias.map(function(c){ return '<label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#1A1A1A;"><input type="checkbox" '+((_movFiltro.contas||[]).indexOf(c.id)>=0?'checked':'')+' onchange="Modules.Financeiro._toggleMovConta(\''+c.id+'\',this.checked)" style="accent-color:#C4362A;"> '+_esc(c.nome)+'</label>'; }).join('');
    var showCustom=_movFiltro.periodo==='custom';
    content.innerHTML=
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">'+
        '<div><h2 style="font-size:18px;font-weight:700;margin-bottom:4px;">Entradas</h2><p style="font-size:12px;color:#8A7E7C;">Controle o que você tem para receber e o que já entrou no caixa.</p></div>'+
        '<button onclick="Modules.Financeiro._openMovModal(null,null)" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Nova Entrada</button>'+
      '</div>'+
      '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,.06);padding:14px;margin-bottom:16px;">'+
        '<div style="display:grid;grid-template-columns:170px 1fr 160px 1fr;gap:10px;align-items:end;">'+
        '<div><label style="'+_lbl()+'">Período</label>'+
        '<select onchange="Modules.Financeiro._setMovFiltro(\'periodo\',this.value)" style="'+fSt+'">'+
          '<option value="hoje"'+(_movFiltro.periodo==='hoje'?' selected':'')+'>Hoje</option>'+
          '<option value="semana"'+(_movFiltro.periodo==='semana'?' selected':'')+'>7 dias</option>'+
          '<option value="mes"'+(_movFiltro.periodo==='mes'?' selected':'')+'>Este mês</option>'+
          '<option value="ano"'+(_movFiltro.periodo==='ano'?' selected':'')+'>Este ano</option>'+
          '<option value="custom"'+(_movFiltro.periodo==='custom'?' selected':'')+'>Personalizado</option>'+
          '<option value="todos"'+(_movFiltro.periodo==='todos'?' selected':'')+'>Todos</option>'+
        '</select></div>'+
        '<div><label style="'+_lbl()+'">Conta</label><div style="min-height:35px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'+contasHtml+'</div></div>'+
        '<div><label style="'+_lbl()+'">Status</label>'+
        '<select onchange="Modules.Financeiro._setMovFiltro(\'status\',this.value)" style="'+fSt+'">'+
          '<option value=""'+(!_movFiltro.status?' selected':'')+'>Qualquer status</option>'+
          '<option value="efetivado"'+(_movFiltro.status==='efetivado'?' selected':'')+'>Recebido</option>'+
          '<option value="previsto"'+(_movFiltro.status==='previsto'?' selected':'')+'>A receber</option>'+
          '<option value="parcial"'+(_movFiltro.status==='parcial'?' selected':'')+'>Parcial</option>'+
        '</select></div>'+
        '<div><label style="'+_lbl()+'">Busca</label><input type="search" value="'+_esc(_movFiltro.busca||'')+'" oninput="Modules.Financeiro._setMovFiltro(\'busca\',this.value)" placeholder="Descrição, cliente, categoria, conta ou valor..." style="'+fSt+'width:100%;"></div>'+
        '</div>'+
        '<div style="display:'+(showCustom?'grid':'none')+';grid-template-columns:170px 170px;gap:10px;margin-top:10px;">'+
          '<div><label style="'+_lbl()+'">Data inicial</label><input type="date" value="'+_esc(_movFiltro.inicio||'')+'" onchange="Modules.Financeiro._setMovFiltro(\'inicio\',this.value)" style="'+fSt+'width:100%;"></div>'+
          '<div><label style="'+_lbl()+'">Data final</label><input type="date" value="'+_esc(_movFiltro.fim||'')+'" onchange="Modules.Financeiro._setMovFiltro(\'fim\',this.value)" style="'+fSt+'width:100%;"></div>'+
        '</div>'+
        '<div style="margin-top:12px;font-size:12px;color:#6B7280;line-height:1.5;">'+filtered.length+' registros · A receber: <strong style="color:#3B82F6;font-weight:600;">'+_fmtVal(totalPrevisto)+'</strong> · Recebido: <strong style="color:#16A34A;font-weight:600;">'+_fmtVal(totalEfetivado)+'</strong> · Parcial/pendente: <strong style="color:#D97706;font-weight:600;">'+_fmtVal(totalParcial)+'</strong></div>'+
        (_movSelecionadas.length?'<div style="margin-top:12px;padding-top:12px;border-top:1px solid #F2EDED;display:flex;align-items:center;justify-content:space-between;gap:10px;"><span style="font-size:12px;color:#8A7E7C;">'+_movSelecionadas.length+' entrada(s) selecionada(s)</span><button onclick="Modules.Financeiro._openEfetivarEntradasModal()" style="border:none;background:#16A34A;color:#fff;border-radius:10px;padding:9px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">Confirmar recebimento</button></div>':'')+
      '</div>'+
      (filtered.length===0
        ?'<div style="text-align:center;padding:60px 20px;color:#8A7E7C;"><div style="font-size:14px;font-weight:600;">Nenhuma entrada encontrada</div></div>'
        :'<div style="background:#fff;border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,.06);overflow:hidden;">'+
            '<table style="width:100%;border-collapse:collapse;">'+
              '<thead><tr style="background:#F8F6F5;">'+
                '<th style="padding:10px 8px;text-align:center;width:34px;"><input type="checkbox" onchange="Modules.Financeiro._toggleMovTodas(this.checked)" '+(filtered.length&&filtered.every(function(m){ return _movSelecionadas.indexOf(m.id)>=0; })?'checked':'')+' style="accent-color:#C4362A;"></th>'+
                '<th onclick="Modules.Financeiro._toggleMovOrdem()" style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;cursor:pointer;user-select:none;">Data '+(_movFiltro.ordem==='asc'?'↑':'↓')+'</th>'+
                '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Descrição</th>'+
                '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Cliente</th>'+
                '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Categoria</th>'+
                '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Conta</th>'+
                '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Status</th>'+
                '<th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Valor</th>'+
                '<th style="padding:10px 6px;"></th>'+
              '</tr></thead><tbody>'+
              filtered.map(function(m){
                var conta=_contasBancarias.find(function(c){ return c.id===m.conta_id; });
                var pessoa=m.pessoaNome||'';
                if(!pessoa&&m.pessoaId){
                  var list=m.pessoaTipo==='cliente'?_clientes:_fornecedores;
                  var p=list.find(function(x){ return x.id===m.pessoaId; });
                  pessoa=p?(p.name||p.nome||''):'';
                }
                var st=m.status||'efetivado';
                var info=_movValorInfo(m);
                var valorHtml=st==='parcial'
                  ?'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;line-height:1.15;"><div style="font-size:12px;font-weight:700;color:#16A34A;">Recebido: '+_fmtVal(info.valorRecebido)+'</div><div style="font-size:12px;font-weight:700;color:#B45309;">Pendente: '+_fmtVal(info.saldoRestante)+'</div></div>'
                  :('<div style="text-align:right;"><div style="font-size:14px;font-weight:800;color:#16A34A;">+ '+_fmtVal(info.displayValor)+'</div><div style="font-size:11px;color:#8A7E7C;margin-top:2px;">'+(st==='efetivado'?'Recebido':(m.parcelamento?'Parcela '+(m.parcelaNumero||'?')+'/'+(m.numeroParcelas||'?'):'A receber'))+'</div></div>');
                return '<tr style="border-top:1px solid #F2EDED;cursor:pointer;" onclick="Modules.Financeiro._openMovDetalheModal(\''+m.id+'\')" onmouseover="this.style.background=\'#FAFAF9\'" onmouseout="this.style.background=\'\'">'+
                  '<td style="padding:10px 8px;text-align:center;"><input type="checkbox" '+(_movSelecionadas.indexOf(m.id)>=0?'checked':'')+' onclick="event.stopPropagation();" onchange="Modules.Financeiro._toggleMovSelecionada(\''+m.id+'\',this.checked)" style="accent-color:#C4362A;"></td>'+
                  '<td style="padding:10px 14px;font-size:13px;color:#6B7280;">'+_esc(_fmtDateDisplay(m.data))+'</td>'+
                  '<td style="padding:10px 14px;font-size:13px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><div style="font-weight:600;">'+_esc(m.descricao||'—')+'</div></td>'+
                  '<td style="padding:10px 14px;font-size:12px;color:#8A7E7C;">'+(pessoa?_esc(pessoa):'—')+'</td>'+
                  '<td style="padding:10px 14px;font-size:12px;color:#8A7E7C;">'+_esc(m.categoria||'—')+'</td>'+
                  '<td style="padding:10px 14px;font-size:12px;color:#8A7E7C;">'+_esc(conta?conta.nome:'—')+'</td>'+
                  '<td style="padding:10px 14px;">'+_badgeEntradaStatus(st)+'</td>'+
                  '<td style="padding:10px 14px;text-align:right;">'+valorHtml+'</td>'+
                  '<td style="padding:10px 6px;text-align:right;white-space:nowrap;">'+
                    (st==='previsto'?'<button onclick="event.stopPropagation();Modules.Financeiro._openEfetivarEntradasModal(\''+m.id+'\')" style="padding:6px 10px;border-radius:8px;border:none;background:#16A34A;color:#fff;cursor:pointer;font-size:11px;font-weight:700;font-family:inherit;margin-right:4px;">Confirmar recebimento</button>':'')+
                    (st==='efetivado'?'':'<button onclick="event.stopPropagation();Modules.Financeiro._openMovModal(\''+m.id+'\')" style="padding:6px 10px;border-radius:8px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;font-size:11px;font-weight:700;font-family:inherit;margin-right:4px;">Editar</button>')+
                    '<button onclick="event.stopPropagation();Modules.Financeiro._deleteMov(\''+m.id+'\')" style="padding:6px 10px;border-radius:8px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;font-size:11px;font-weight:700;font-family:inherit;">Excluir</button>'+
                  '</td></tr>';
              }).join('')+
              '</tbody></table></div>');
  }

  function _setMovFiltro(key,val){
    _movFiltro[key]=val;
    if(key==='periodo'&&val==='custom'){
      _movFiltro.inicio=_movFiltro.inicio||_today();
      _movFiltro.fim=_movFiltro.fim||_today();
    }
    _paintMovimentacoes();
  }

  function _toggleMovConta(id,checked){
    var contas=(_movFiltro.contas||[]).slice();
    if(checked&&contas.indexOf(id)<0) contas.push(id);
    if(!checked) contas=contas.filter(function(x){ return x!==id; });
    _movFiltro.contas=contas;
    _paintMovimentacoes();
  }

  function _toggleMovSelecionada(id,checked){
    if(checked&&_movSelecionadas.indexOf(id)<0) _movSelecionadas.push(id);
    if(!checked) _movSelecionadas=_movSelecionadas.filter(function(x){ return x!==id; });
    _paintMovimentacoes();
  }

  function _toggleMovTodas(checked){
    _movSelecionadas=checked?_movVisiveis.slice():[];
    _paintMovimentacoes();
  }

  function _toggleMovOrdem(){
    _movFiltro.ordem=_movFiltro.ordem==='asc'?'desc':'asc';
    _paintMovimentacoes();
  }

  function _openMovDetalheModal(id) {
    var m=_movimentacoes.find(function(x){ return x.id===id; });
    if(!m) return;
    var conta=_contasBancarias.find(function(c){ return c.id===m.conta_id; });
    var pessoa=m.pessoaNome||'';
    if(!pessoa&&m.pessoaId){
      var list=m.pessoaTipo==='cliente'?_clientes:_fornecedores;
      var p=list.find(function(x){ return x.id===m.pessoaId; });
      pessoa=p?(p.name||p.nome||''):'';
    }
    var st=m.status||'efetivado';
    var statusInfo=st==='previsto'
      ? {label:'Ainda não recebido',bg:'#EFF6FF',fg:'#2563EB'}
      : st==='parcial'
        ? {label:'Recebido parcialmente',bg:'#FEF9C3',fg:'#B45309'}
        : {label:'Já recebido',bg:'#DCFCE7',fg:'#16A34A'};
    var tipoLabel=m.parcelamento?'Parcelada':(m.recorrencia?'Recorrente':'Entrada única');
    var info=_movValorInfo(m);
    var totalValor=_fmtVal(info.valorTotalOriginal);
    var hasRecorrencia=!!m.recorrencia;
    var hasParcelamento=!!m.parcelamento;
    var pendente=st==='parcial'?info.saldoRestante:0;
    var recebido=st==='parcial'?info.valorRecebido:(st==='efetivado'?info.valorRecebido:0);
    var parcelaAtual=(m.parcelamento&&m.parcelamento.parcelaAtual)||m.parcelaNumero||'';
    var totalParcelas=(m.parcelamento&&m.parcelamento.parcelas)||m.numeroParcelas||'';
    var infoCards=[];
    if(info.valorTotalOriginal){
      infoCards.push('<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Valor total original</div><div style="font-size:14px;font-weight:600;color:#1F2937;">'+_fmtVal(info.valorTotalOriginal)+'</div></div>');
    }
    if(info.valorParcela && (hasParcelamento || hasRecorrencia)){
      infoCards.push('<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Valor da parcela</div><div style="font-size:14px;font-weight:600;color:#1F2937;">'+_fmtVal(info.valorParcela)+'</div></div>');
    }
    if(hasRecorrencia){
      infoCards.push('<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Recorrência</div><div style="font-size:14px;font-weight:600;color:#1F2937;">'+_esc((m.recorrencia.frequencia||'')+(m.recorrencia.data_fim?' até '+_fmtDateDisplay(m.recorrencia.data_fim):''))+'</div></div>');
    }
    if(hasParcelamento && (parcelaAtual || totalParcelas)){
      infoCards.push('<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Parcelamento</div><div style="font-size:14px;font-weight:600;color:#1F2937;">'+_esc('Parcela '+(parcelaAtual||'?')+' de '+(totalParcelas||'?'))+'</div></div>');
    }
    if(m.parcelamento && m.parcelamento.proxima_data){
      infoCards.push('<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Próxima</div><div style="font-size:14px;font-weight:600;color:#1F2937;">'+_esc(_fmtDateDisplay(m.parcelamento.proxima_data))+'</div></div>');
    }
    if(st==='parcial'){
      infoCards.push('<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Valor recebido</div><div style="font-size:18px;font-weight:700;color:#16A34A;">'+_fmtVal(recebido)+'</div></div>');
      infoCards.push('<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Saldo pendente</div><div style="font-size:18px;font-weight:700;color:#B45309;">'+_fmtVal(pendente)+'</div></div>');
    }
    if(st==='efetivado' && recebido){
      infoCards.push('<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Valor recebido</div><div style="font-size:18px;font-weight:700;color:#16A34A;">'+_fmtVal(recebido)+'</div></div>');
    }
    var detailsCards=[
      '<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Quem pagou</div><div style="font-size:14px;font-weight:600;color:#1F2937;">'+_esc(pessoa||'—')+'</div></div>',
      '<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Categoria</div><div style="font-size:14px;font-weight:600;color:#1F2937;">'+_esc(m.categoria||'—')+'</div></div>',
      '<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Conta de destino</div><div style="font-size:14px;font-weight:600;color:#1F2937;">'+_esc(conta?conta.nome:'—')+'</div></div>',
      '<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Forma de pagamento</div><div style="font-size:14px;font-weight:600;color:#1F2937;">'+_esc(m.forma_pagamento||'—')+'</div></div>'
    ];
    var body=
      '<div style="display:flex;flex-direction:column;gap:14px;">'+
        '<div style="background:#F8F6F5;border:1px solid #EDE7E4;border-radius:16px;padding:18px;">'+
          '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">'+
            '<div style="min-width:0;">'+
              '<div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;">Valor</div>'+
              '<div style="font-size:32px;line-height:1;font-weight:700;color:#1F2937;">'+totalValor+'</div>'+
              '<div style="margin-top:8px;font-size:13px;color:#6B7280;">'+
                (st==='parcial'
                  ? _esc(_fmtVal(recebido)+' recebidos • '+_fmtVal(pendente)+' pendentes')
                  : _esc(tipoLabel))+
              '</div>'+
            '</div>'+
            '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">'+
              '<span style="background:'+statusInfo.bg+';color:'+statusInfo.fg+';padding:6px 12px;border-radius:999px;font-size:11px;font-weight:700;">'+statusInfo.label+'</span>'+
              '<span style="background:#fff;border:1px solid #E7E2E0;color:#6B7280;padding:6px 12px;border-radius:999px;font-size:11px;font-weight:700;">'+_esc(tipoLabel)+'</span>'+
            '</div>'+
          '</div>'+
        '</div>'+

        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">'+
          '<div style="background:#fff;border:1px solid #EDE7E4;border-radius:16px;padding:14px;">'+
            '<div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:10px;">Principal</div>'+
            '<div style="display:flex;flex-direction:column;gap:10px;">'+
              '<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Data</div><div style="font-size:14px;font-weight:600;color:#1F2937;">'+_esc(_fmtDateDisplay(m.data))+'</div></div>'+
              '<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Status</div><div>'+_badgeEntradaStatus(st)+'</div></div>'+
              '<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Tipo</div><div style="font-size:14px;font-weight:600;color:#1F2937;">'+_esc(tipoLabel)+'</div></div>'+
            '</div>'+
          '</div>'+
          '<div style="background:#fff;border:1px solid #EDE7E4;border-radius:16px;padding:14px;">'+
            '<div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:10px;">Detalhes</div>'+
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">'+detailsCards.join('')+'</div>'+
          '</div>'+
        '</div>'+
        (infoCards.length
          ? '<div style="background:#fff;border:1px solid #EDE7E4;border-radius:16px;padding:14px;"><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:10px;">Informações adicionais</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">'+infoCards.join('')+'</div></div>'
          : '')+
        (m.observacoes && String(m.observacoes).trim()
          ? '<div style="background:#fff;border:1px solid #EDE7E4;border-radius:16px;padding:14px;"><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:10px;">Observações</div><div style="font-size:14px;line-height:1.5;color:#1F2937;white-space:pre-wrap;word-break:break-word;">'+_esc(m.observacoes)+'</div></div>'
          : '')+
      '</div>';
    var footer='<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;">'+
      (st==='parcial'
        ? '<button onclick="Modules.Financeiro._closeMovDetalhe();Modules.Financeiro._openEfetivarEntradasModal(\''+m.id+'\')" style="padding:12px 16px;border-radius:10px;border:none;background:#16A34A;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Receber restante</button>'
        : (st==='previsto'
          ? '<button onclick="Modules.Financeiro._closeMovDetalhe();Modules.Financeiro._openEfetivarEntradasModal(\''+m.id+'\')" style="padding:12px 16px;border-radius:10px;border:none;background:#16A34A;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Marcar como recebido</button>'
          : ''))+
      (st!=='efetivado'
        ? '<button onclick="Modules.Financeiro._closeMovDetalhe();Modules.Financeiro._openMovModal(\''+m.id+'\')" style="padding:12px 16px;border-radius:10px;border:none;background:#EEF4FF;color:#3B82F6;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Editar</button>'
        : '')+
      '<button onclick="Modules.Financeiro._deleteMov(\''+m.id+'\')" style="padding:12px 16px;border-radius:10px;border:none;background:#FFF0EE;color:#C4362A;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Excluir</button>'+
      '<button onclick="Modules.Financeiro._closeMovDetalhe();" style="padding:12px 16px;border-radius:10px;border:1.5px solid #D4C8C6;background:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Fechar</button>'+
    '</div>';
    window._movDetalheModal=UI.modal({title:'Resumo da entrada',body:body,footer:footer,maxWidth:'760px'});
  }

  function _closeMovDetalhe() {
    if(window._movDetalheModal) window._movDetalheModal.close();
  }

  function _pessoaLabel(item) {
    return item ? (item.name || item.nome || 'Sem nome') : '';
  }

  function _pessoaList(tipo) {
    return tipo==='entrada' ? (_clientes||[]) : (_fornecedores||[]);
  }

  function _renderMovPessoaField(tipo, selectedId) {
    var box=document.getElementById('mov-pessoa-box');
    if(!box) return;
    var isEntrada=tipo==='entrada';
    var list=_pessoaList(tipo).slice().sort(function(a,b){ return _pessoaLabel(a).localeCompare(_pessoaLabel(b)); });
    var opts='<option value="">'+(isEntrada?'Sem cliente':'Sem fornecedor')+'</option>'+
      list.map(function(p){ return '<option value="'+p.id+'"'+(selectedId===p.id?' selected':'')+'>'+_esc(_pessoaLabel(p))+'</option>'; }).join('')+
      '<option value="__novo__">'+(isEntrada?'+ Novo cliente':'+ Novo fornecedor')+'</option>';
    box.innerHTML=
      '<label style="'+_lbl()+'">'+(isEntrada?'Cliente':'Fornecedor')+'</label>'+
      '<select id="mov-pessoa-id" onchange="Modules.Financeiro._toggleMovNovaPessoa()" style="'+_inp()+'background:#fff;">'+opts+'</select>'+
      '<input id="mov-pessoa-novo" type="text" placeholder="'+(isEntrada?'Nome do novo cliente...':'Nome do novo fornecedor...')+'" style="'+_inp()+'display:none;margin-top:8px;">'+
      '<div style="font-size:11px;color:#8A7E7C;margin-top:4px;">'+(isEntrada?'Quem pagou essa entrada':'Para quem você está pagando')+'</div>';
  }

  function _openMovModal(id,tipoPreset) {
    _editingId=id;
    var m=id?(_movimentacoes.find(function(x){ return x.id===id; })||{}): {};
    var tipo='entrada';
    var cats=_catsByTipo(tipo);
    var catOpts='<option value="">Sem categoria</option>'+cats.map(function(c){ return '<option value="'+_esc(c)+'"'+(m.categoria===c?' selected':'')+'>'+_esc(c)+'</option>'; }).join('')+'<option value="__nova__">+ Nova categoria</option>';
    var fOpts='<option value="">Selecionar...</option>'+_formasPag().map(function(f){ return '<option value="'+_esc(f)+'"'+(m.forma_pagamento===f?' selected':'')+'>'+_esc(f)+'</option>'; }).join('');
    var statusSel=(m.status==='efetivado' || m.status==='previsto') ? m.status : '';
    var rec=!!m.recorrencia;
    var parc=!!m.parcelamento;
    var recFreq=(m.recorrencia&&m.recorrencia.frequencia)||'mensal';
    var recReps=(m.recorrencia&&m.recorrencia.repeticoes)||'';
    var recDataIni=(m.recorrencia&&m.recorrencia.data_inicial)||m.data||_today();
    var parcelas=(m.parcelamento&&m.parcelamento.parcelas)||'';
    var primeiraParcela=(m.parcelamento&&m.parcelamento.primeira_data)||m.data||_today();
    var valorParcela=parcelas?_fmtVal((_parseNum(m.valor)||0)/_parseNum(parcelas)):'';
    var body=
      '<div style="display:flex;flex-direction:column;gap:16px;">'+
        '<div style="background:#fff;border:1px solid #EDE7E4;border-radius:16px;padding:14px 16px;">'+
          '<div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:10px;">Dados principais</div>'+
          '<div style="display:flex;flex-direction:column;gap:12px;">'+
            '<div><label style="'+_lbl()+'">Descrição *</label><input id="mov-desc" type="text" value="'+_esc(m.descricao||'')+'" placeholder="Ex: Venda, recebimento..." style="'+_inp()+'"></div>'+
            '<div style="'+_g2()+'">'+
              '<div><label style="'+_lbl()+'">Valor total *</label><input id="mov-valor" type="text" value="'+_esc(m.valor||'')+'" oninput="Modules.Financeiro._renderMovPreviews()" placeholder="0,00" style="'+_inp()+'"></div>'+
              '<div id="mov-pessoa-box"></div>'+
            '</div>'+
          '</div>'+
        '</div>'+
        '<div style="background:#fff;border:1px solid #EDE7E4;border-radius:16px;padding:14px 16px;">'+
          '<div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:10px;">Status da entrada</div>'+
          '<input type="hidden" id="mov-status" value="'+_esc(statusSel)+'">'+
          '<div style="display:flex;gap:12px;flex-wrap:wrap;">'+
            '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;cursor:pointer;"><input type="radio" name="mov-status-radio" value="previsto" '+(statusSel==='previsto'?'checked':'')+' onchange="Modules.Financeiro._selectMovStatus(\'previsto\')" style="accent-color:#3B82F6;"> A receber</label>'+
            '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;cursor:pointer;"><input type="radio" name="mov-status-radio" value="efetivado" '+(statusSel==='efetivado'?'checked':'')+' onchange="Modules.Financeiro._selectMovStatus(\'efetivado\')" style="accent-color:#16A34A;"> Já recebido</label>'+
          '</div>'+
          '<div id="mov-status-help" style="margin-top:8px;font-size:11px;color:#8A7E7C;">Escolha o status da entrada antes de salvar.</div>'+
        '</div>'+
        '<div id="mov-tipo-box" style="background:#fff;border:1px solid #EDE7E4;border-radius:16px;padding:14px 16px;">'+
          '<div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:10px;">Tipo de recebimento</div>'+
          '<div style="display:flex;flex-direction:column;gap:10px;">'+
            '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;cursor:pointer;"><input type="checkbox" id="mov-recorrente"'+(rec?' checked':'')+' onchange="Modules.Financeiro._toggleMovRecorrente()" style="accent-color:#C4362A;"> Pagamento recorrente</label>'+
            '<div id="mov-rec-box" style="display:'+(rec?'block':'none')+';">'+
              '<div style="'+_g2()+'">'+
                '<div><label style="'+_lbl()+'">Frequência</label><select id="mov-rec-freq" onchange="Modules.Financeiro._renderMovPreviews()" style="'+_inp()+'background:#fff;">'+
                  '<option value="semanal"'+(recFreq==='semanal'?' selected':'')+'>Semanal</option>'+
                  '<option value="mensal"'+(recFreq==='mensal'?' selected':'')+'>Mensal</option>'+
                  '<option value="anual"'+(recFreq==='anual'?' selected':'')+'>Anual</option>'+
                '</select></div>'+
                '<div><label style="'+_lbl()+'">Número de repetições *</label><input id="mov-rec-reps" type="number" min="1" value="'+_esc(recReps)+'" placeholder="Ex: 6" oninput="Modules.Financeiro._renderMovPreviews()" style="'+_inp()+'"></div>'+
              '</div>'+
              '<div id="mov-rec-preview" style="margin-top:10px;"></div>'+
            '</div>'+
            '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;cursor:pointer;"><input type="checkbox" id="mov-parcelado"'+(parc?' checked':'')+' onchange="Modules.Financeiro._toggleMovParcelado()" style="accent-color:#C4362A;"> Dividir em parcelas</label>'+
            '<div id="mov-parc-box" style="display:'+(parc?'block':'none')+';">'+
              '<div style="'+_g2()+'">'+
                '<div><label style="'+_lbl()+'">Número de parcelas *</label><input id="mov-parc-qtd" type="number" min="2" value="'+_esc(parcelas)+'" placeholder="Ex: 3" oninput="Modules.Financeiro._renderMovPreviews()" style="'+_inp()+'"></div>'+
                '<div><label style="'+_lbl()+'">Valor por parcela</label><input id="mov-parc-valor" type="text" value="'+_esc(valorParcela)+'" readonly style="'+_inp()+'background:#F8F6F5;"></div>'+
              '</div>'+
              '<div id="mov-parc-preview" style="margin-top:10px;"></div>'+
            '</div>'+
          '</div>'+
        '</div>'+
        '<div style="background:#fff;border:1px solid #EDE7E4;border-radius:16px;padding:14px 16px;">'+
          '<div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:10px;">Datas</div>'+
          '<div style="display:flex;flex-direction:column;gap:12px;">'+
            '<div id="mov-data-box"><label id="mov-data-label" style="'+_lbl()+'">'+(statusSel==='efetivado'?'Data de recebimento':'Data prevista')+' *</label><input id="mov-data" type="date" value="'+_esc(m.data||_today())+'" style="'+_inp()+'"><div id="mov-data-help" style="font-size:11px;color:#8A7E7C;margin-top:4px;">'+(statusSel==='efetivado'?'Quando o valor entrou no caixa.':'Quando você espera receber.')+'</div></div>'+
            '<div><label style="'+_lbl()+'">Conta bancária *</label><select id="mov-conta" required style="'+_inp()+'background:#fff;"><option value="">Para onde entrou o dinheiro</option>'+_contasBancarias.map(function(c){ return '<option value="'+c.id+'"'+(m.conta_id===c.id?' selected':'')+'>'+_esc(c.nome)+'</option>'; }).join('')+'</select></div>'+
            '<div><label style="'+_lbl()+'">Forma de pagamento</label><select id="mov-forma" style="'+_inp()+'background:#fff;">'+fOpts+'</select></div>'+
            '<div><label style="'+_lbl()+'">Comprovante / fatura</label><input id="mov-anexo" type="file" style="'+_inp()+'padding:8px;background:#fff;"><div style="font-size:11px;color:#8A7E7C;margin-top:4px;">Upload real ainda não configurado; o nome do arquivo fica preparado no cadastro.</div></div>'+
          '</div>'+
        '</div>'+
        '<div style="background:#fff;border:1px solid #EDE7E4;border-radius:16px;padding:14px 16px;">'+
          '<div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:10px;">Observações</div>'+
          '<textarea id="mov-obs" placeholder="Opcional..." style="'+_inp()+'min-height:72px;resize:vertical;">'+_esc(m.observacoes||'')+'</textarea>'+
        '</div>'+
      '</div>';
    var footer='<button id="mov-save-btn" onclick="Modules.Financeiro._saveMov()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#16A34A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">'+(id?'Atualizar':'Salvar')+'</button>';
    window._movModal=UI.modal({title:id?'Editar Entrada':'Nova Entrada',body:body,footer:footer,maxWidth:'600px'});
    setTimeout(function(){
      _renderMovPessoaField(tipo,m.pessoaId||'');
      _selectMovStatus(statusSel||'');
      _toggleMovRecorrente();
      _toggleMovParcelado();
      _renderMovPreviews();
    },0);
  }

  function _setMovTipo(tipo) {
    var t=document.getElementById('mov-tipo'); if(t) t.value=tipo;
    var desc=document.getElementById('mov-desc');
    if(desc) desc.placeholder=tipo==='entrada'?'Ex: Venda, recebimento...':'Ex: Aluguel, fornecedor, compra...';
    var save=document.getElementById('mov-save-btn');
    if(save) save.style.background=tipo==='entrada'?'#16A34A':'#DC2626';
    _renderMovPessoaField(tipo,'');
    ['entrada','saida'].forEach(function(k){
      var btn=document.getElementById('mov-btn-'+k); if(!btn) return;
      var a=tipo===k; var col=k==='entrada'?'#16A34A':'#DC2626'; var bg=k==='entrada'?'#DCFCE7':'#FEE2E2';
      btn.style.border='2px solid '+(a?col:'#D4C8C6'); btn.style.background=a?bg:'#fff'; btn.style.color=a?col:'#8A7E7C';
    });
  }

  function _selectMovStatus(status) {
    var input=document.getElementById('mov-status'); if(input) input.value=status;
    var help=document.getElementById('mov-status-help');
    var label=document.getElementById('mov-data-label');
    var dataHelp=document.getElementById('mov-data-help');
    var tipoBox=document.getElementById('mov-tipo-box');
    var rec=document.getElementById('mov-recorrente');
    var parc=document.getElementById('mov-parcelado');
    var recBox=document.getElementById('mov-rec-box');
    var parcBox=document.getElementById('mov-parc-box');
    if(help) help.textContent=status==='efetivado'
      ? 'Já recebeu este valor. A data de recebimento é obrigatória.'
      : 'Você ainda vai receber este valor. A data prevista é obrigatória.';
    if(label) label.textContent=(status==='efetivado'?'Data de recebimento':'Data prevista')+' *';
    if(dataHelp) dataHelp.textContent=status==='efetivado'
      ? 'Quando o valor entrou no caixa.'
      : 'Quando você espera receber.';
    if(tipoBox) tipoBox.style.display=status==='efetivado'?'none':'block';
    if(status==='efetivado'){
      if(rec) rec.checked=false;
      if(parc) parc.checked=false;
      if(recBox) recBox.style.display='none';
      if(parcBox) parcBox.style.display='none';
    } else {
      if(recBox) recBox.style.display=rec&&rec.checked?'block':'none';
      if(parcBox) parcBox.style.display=parc&&parc.checked?'block':'none';
    }
  }

  function _toggleMovNovaCat() {
    var sel=document.getElementById('mov-cat');
    var inp=document.getElementById('mov-cat-nova');
    if(inp) inp.style.display=(sel&&sel.value==='__nova__')?'block':'none';
  }

  function _toggleMovNovaPessoa() {
    var sel=document.getElementById('mov-pessoa-id');
    var inp=document.getElementById('mov-pessoa-novo');
    if(inp) inp.style.display=(sel&&sel.value==='__novo__')?'block':'none';
  }

  function _toggleMovRecorrente() {
    var checked=!!(document.getElementById('mov-recorrente')||{}).checked;
    var box=document.getElementById('mov-rec-box');
    var parc=document.getElementById('mov-parcelado');
    var parcBox=document.getElementById('mov-parc-box');
    if(checked && parc) parc.checked=false;
    if(checked && parcBox) parcBox.style.display='none';
    if(box) box.style.display=checked?'block':'none';
    _renderMovPreviews();
  }

  function _toggleMovParcelado() {
    var box=document.getElementById('mov-parc-box');
    var checked=!!(document.getElementById('mov-parcelado')||{}).checked;
    if(box) box.style.display=checked?'block':'none';
    var rec=document.getElementById('mov-recorrente');
    var recBox=document.getElementById('mov-rec-box');
    if(checked && rec) rec.checked=false;
    if(checked && recBox) recBox.style.display='none';
    _renderMovPreviews();
  }

  function _calcMovParcela() {
    var qtd=_parseNum((document.getElementById('mov-parc-qtd')||{}).value);
    var valor=_parseNum((document.getElementById('mov-valor')||{}).value);
    var out=document.getElementById('mov-parc-valor');
    if(out) out.value=(qtd>0&&valor>0)?_fmtVal(valor/qtd):'';
    _renderMovPreviews();
  }

  function _movPreviewCard(title, items) {
    return '<div style="background:#FAFAF9;border:1px solid #EDE7E4;border-radius:12px;padding:10px 12px;">'+
      '<div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:8px;">'+_esc(title)+'</div>'+
      (items.length
        ? '<div style="display:flex;flex-direction:column;gap:6px;">'+items.join('')+'</div>'
        : '<div style="font-size:12px;color:#8A7E7C;">Preencha os campos para ver o preview.</div>')+
    '</div>';
  }

  function _renderMovPreviews() {
    var recBox=document.getElementById('mov-rec-preview');
    var parcBox=document.getElementById('mov-parc-preview');
    var rec=!!(document.getElementById('mov-recorrente')||{}).checked;
    var parc=!!(document.getElementById('mov-parcelado')||{}).checked;
    if(recBox){
      if(!rec){ recBox.innerHTML=''; recBox.style.display='none'; }
      else {
        recBox.style.display='block';
        var inicio=(document.getElementById('mov-data')||{}).value||'';
        var reps=_parseNum((document.getElementById('mov-rec-reps')||{}).value);
        var freq=(document.getElementById('mov-rec-freq')||{}).value||'mensal';
        var itens=[];
        if(inicio&&reps>0){
          for(var i=0;i<Math.min(reps,8);i++){
            itens.push('<div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;color:#374151;"><span>'+_esc('Recorrência '+(i+1))+'</span><strong style="font-weight:700;">'+_esc(_fmtDateDisplay(_addPeriodo(inicio,freq,i)))+'</strong></div>');
          }
          if(reps>8) itens.push('<div style="font-size:11px;color:#8A7E7C;">... e mais '+(reps-8)+' ocorrências</div>');
        }
        recBox.innerHTML=_movPreviewCard('Recorrências a criar', itens);
      }
    }
    if(parcBox){
      if(!parc){ parcBox.innerHTML=''; parcBox.style.display='none'; }
      else {
        parcBox.style.display='block';
        var total=_parseNum((document.getElementById('mov-valor')||{}).value);
        var n=_parseNum((document.getElementById('mov-parc-qtd')||{}).value);
        var primeira=(document.getElementById('mov-data')||{}).value||'';
        var outParcela=document.getElementById('mov-parc-valor');
        var itensP=[];
        if(total>0&&n>1&&primeira){
          var valorParcela=total/n;
          if(outParcela) outParcela.value=_fmtVal(valorParcela);
          for(var j=0;j<Math.min(n,8);j++){
            var val=j===n-1?+(total-(valorParcela*(n-1))).toFixed(2):+valorParcela.toFixed(2);
            itensP.push('<div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;color:#374151;"><span>'+_esc('Parcela '+(j+1)+' de '+n)+'</span><strong style="font-weight:700;">'+_esc(_fmtVal(val))+' · '+_esc(_fmtDateDisplay(_addPeriodo(primeira,'mensal',j)))+'</strong></div>');
          }
          if(n>8) itensP.push('<div style="font-size:11px;color:#8A7E7C;">... e mais '+(n-8)+' parcelas</div>');
        }
        if(outParcela && !(total>0&&n>1)) outParcela.value='';
        parcBox.innerHTML=_movPreviewCard('Parcelas a criar', itensP);
      }
    }
  }

  function _saveMov() {
    var desc=((document.getElementById('mov-desc')||{}).value||'').trim();
    var valor=_parseNum((document.getElementById('mov-valor')||{}).value);
    var contaId=(document.getElementById('mov-conta')||{}).value||'';
    var status=(document.getElementById('mov-status')||{}).value||'';
    var cat=(document.getElementById('mov-cat')||{}).value||'';
    var novaCat=((document.getElementById('mov-cat-nova')||{}).value||'').trim();
    if(!desc){ UI.toast('Descrição obrigatória','error'); return; }
    if(!valor){ UI.toast('Valor deve ser maior que zero','error'); return; }
    if(!contaId){ UI.toast('Conta bancária obrigatória','error'); return; }
    if(!status){ UI.toast('Escolha se a entrada já foi recebida ou ainda será recebida','error'); return; }
    if(cat==='__nova__'&&!novaCat){ UI.toast('Informe o nome da nova categoria','error'); return; }
    var dataBase=(document.getElementById('mov-data')||{}).value||'';
    if(!dataBase){ UI.toast('Informe a data da entrada','error'); return; }
    var rec=!!(document.getElementById('mov-recorrente')||{}).checked;
    var recFreq=(document.getElementById('mov-rec-freq')||{}).value||'mensal';
    var recReps=_parseNum((document.getElementById('mov-rec-reps')||{}).value);
    var parcelado=!!(document.getElementById('mov-parcelado')||{}).checked;
    var parcelas=_parseNum((document.getElementById('mov-parc-qtd')||{}).value);
    var primeiraParcela=(document.getElementById('mov-data')||{}).value||'';
    if(rec&&parcelado){ UI.toast('Escolha recorrente ou parcelado, não os dois','error'); return; }
    if(rec&&recReps<1){ UI.toast('Informe o número de repetições','error'); return; }
    if(parcelado&&!_editingId&&(parcelas<2||!primeiraParcela)){ UI.toast('Preencha os dados do parcelamento','error'); return; }
    var anexoEl=document.getElementById('mov-anexo');
    var anexoNome=(anexoEl&&anexoEl.files&&anexoEl.files[0])?anexoEl.files[0].name:'';
    var tipoMov='entrada';
    var pessoaSel=(document.getElementById('mov-pessoa-id')||{}).value||'';
    var pessoaNova=((document.getElementById('mov-pessoa-novo')||{}).value||'').trim();
    var pessoaTipo=pessoaSel||pessoaNova ? (tipoMov==='entrada'?'cliente':'fornecedor') : 'nenhum';
    if(pessoaSel==='__novo__'&&!pessoaNova){ UI.toast('Informe o nome do novo '+(tipoMov==='entrada'?'cliente':'fornecedor'),'error'); return; }
    var obj={
      tipo:tipoMov,
      descricao:desc, valor:valor,
      valorTotalOriginal:valor,
      valorParcela:valor,
      valorRecebido:status==='efetivado'?valor:0,
      saldoRestante:status==='efetivado'?0:valor,
      data:dataBase,
      categoria:cat==='__nova__'?novaCat:cat,
      conta_id:contaId,
      forma_pagamento:(document.getElementById('mov-forma')||{}).value||'',
      status:status,
      origem:'manual',
      pessoaTipo:pessoaTipo,
      pessoaId:pessoaSel&&pessoaSel!=='__novo__'?pessoaSel:'',
      pessoaNome:'',
      recorrencia:rec?{
        ativo:true,
        frequencia:recFreq,
        data_inicial:dataBase,
        repeticoes:recReps
      }:null,
      parcelamento:parcelado?{
        ativo:true,
        parcelas:parcelas,
        primeira_data:primeiraParcela,
        frequencia:'mensal'
      }:null,
      anexo_nome:anexoNome,
      observacoes:(document.getElementById('mov-obs')||{}).value||'',
      updatedAt:new Date().toISOString()
    };
    if(!_editingId) obj.createdAt=new Date().toISOString();
    var saveCat=(cat==='__nova__')?DB.add('financeiro_categorias',{nome:novaCat,tipo:obj.tipo}):Promise.resolve();
    saveCat.then(function(){
      if(pessoaSel==='__novo__'){
        var list=_pessoaList(tipoMov);
        var existente=list.find(function(p){ return _pessoaLabel(p).toLowerCase()===pessoaNova.toLowerCase(); });
        if(existente){
          obj.pessoaId=existente.id;
          obj.pessoaNome=_pessoaLabel(existente);
          return null;
        }
        var col=tipoMov==='entrada'?'store_customers':'fornecedores';
        var data=tipoMov==='entrada'?{name:pessoaNova,status:'ativo',origin:'manual'}:{name:pessoaNova,nome:pessoaNova,ativo:true};
        return DB.add(col,data).then(function(ref){
          obj.pessoaId=(ref&&ref.id)||'';
          obj.pessoaNome=pessoaNova;
        });
      }
      if(pessoaSel){
        var pessoa=_pessoaList(tipoMov).find(function(p){ return p.id===pessoaSel; });
        obj.pessoaNome=_pessoaLabel(pessoa);
      }
      return null;
    }).then(function(){
      if(rec&&!_editingId){
        var recId='entrada-recorrencia-'+Date.now();
        var opsRec=[];
        for(var r=1;r<=recReps;r++){
          opsRec.push(DB.add('movimentacoes',Object.assign({},obj,{
            descricao:desc+' ('+r+'/'+recReps+')',
            data:_addPeriodo(dataBase,recFreq,r-1),
            status:status||'previsto',
            recorrenciaId:recId,
            recorrencia:Object.assign({},obj.recorrencia||{},{
              ocorrencia:r,
              total:recReps
            }),
            createdAt:new Date().toISOString(),
            updatedAt:new Date().toISOString()
          })));
        }
        return Promise.all(opsRec);
      }
      if(parcelado&&!_editingId){
        var parcelamentoId='entrada-parcelamento-'+Date.now();
        var valorParcela=+(valor/parcelas).toFixed(2);
        var ops=[];
        for(var i=1;i<=parcelas;i++){
          var valorAtual=i===parcelas?+(valor-(valorParcela*(parcelas-1))).toFixed(2):valorParcela;
          ops.push(DB.add('movimentacoes',Object.assign({},obj,{
            descricao:desc+' ('+i+'/'+parcelas+')',
            valor:valorAtual,
            valorTotalOriginal:valor,
            valorParcela:valorAtual,
            valorRecebido:0,
            saldoRestante:valorAtual,
            data:_addPeriodo(primeiraParcela,'mensal',i-1),
            status:'previsto',
            parcelamentoId:parcelamentoId,
            parcelaNumero:i,
            numeroParcelas:parcelas,
            valorTotal:valor,
            createdAt:new Date().toISOString(),
            updatedAt:new Date().toISOString()
          })));
        }
        return Promise.all(ops);
      }
      return _editingId?DB.update('movimentacoes',_editingId,obj):DB.add('movimentacoes',obj);
    }).then(function(){
      UI.toast('Entrada salva!','success');
      if(window._movModal) window._movModal.close();
      _loadMovimentacoes();
    }).catch(function(e){ UI.toast('Erro: '+e.message,'error'); });
  }

  function _deleteMov(id) {
    UI.confirm('Eliminar esta entrada?').then(function(yes){
      if(!yes) return;
      DB.remove('movimentacoes',id).then(function(){ UI.toast('Eliminado','info'); _loadMovimentacoes(); });
    });
  }

  function _openEfetivarEntradasModal(id) {
    var ids=id?[id]:_movSelecionadas.slice();
    var entradas=ids.map(function(x){ return _movimentacoes.find(function(m){ return m.id===x; }); }).filter(function(m){
      var st=(m&&m.status)||'efetivado';
      return m&&m.tipo==='entrada'&&(st==='previsto'||(id&&st==='parcial'));
    });
    if(!entradas.length){ UI.toast('Selecione entradas previstas ou parciais','error'); return; }
    window._movEfetivarIds=entradas.map(function(m){ return m.id; });
    var total=entradas.reduce(function(s,m){ return s+_movEntradaPendente(m); },0);
    var contasAtivas=_contasBancarias.filter(function(c){ return c.ativo!==false; });
    var selectedConta=entradas.length===1?(entradas[0].conta_id||''):'';
    if(!selectedConta&&contasAtivas.length===1) selectedConta=contasAtivas[0].id;
    var contaOpts='<option value="">Selecionar conta...</option>'+contasAtivas.map(function(c){ return '<option value="'+c.id+'"'+(selectedConta===c.id?' selected':'')+'>'+_esc(c.nome)+'</option>'; }).join('');
    var body='<div>'+
      '<div style="background:#EDFAF3;border:1px solid #DCFCE7;border-radius:12px;padding:12px 14px;margin-bottom:12px;"><div style="font-size:11px;font-weight:700;color:#16A34A;text-transform:uppercase;margin-bottom:3px;">Total previsto</div><div style="font-size:22px;font-weight:700;color:#16A34A;">'+_fmtVal(total)+'</div></div>'+
      '<div style="'+_g3()+'">'+
        '<div><label style="'+_lbl()+'">Valor recebido *</label><input id="mov-ef-valor" type="text" value="'+_esc(total)+'" style="'+_inp()+'"></div>'+
        '<div><label style="'+_lbl()+'">Data de recebimento *</label><input id="mov-ef-data" type="date" value="'+_today()+'" style="'+_inp()+'"></div>'+
        '<div><label style="'+_lbl()+'">Conta de destino *</label><select id="mov-ef-conta" style="'+_inp()+'background:#fff;">'+contaOpts+'</select></div>'+
      '</div>'+
    '</div>';
    var footer='<button onclick="Modules.Financeiro._saveEfetivarEntradas()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#16A34A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Confirmar recebimento</button>';
    window._movEfModal=UI.modal({title:'Confirmar recebimento',body:body,footer:footer,maxWidth:'560px'});
  }

  function _saveEfetivarEntradas() {
    var ids=window._movEfetivarIds||[];
    var entradas=ids.map(function(x){ return _movimentacoes.find(function(m){ return m.id===x; }); }).filter(Boolean);
    var valor=_parseNum((document.getElementById('mov-ef-valor')||{}).value);
    var data=(document.getElementById('mov-ef-data')||{}).value||'';
    var conta=(document.getElementById('mov-ef-conta')||{}).value||'';
    var total=entradas.reduce(function(s,m){ return s+_parseNum(m.valor); },0);
    if(!valor||valor<=0){ UI.toast('Informe o valor recebido','error'); return; }
    if(!data){ UI.toast('Informe a data de recebimento','error'); return; }
    if(!conta){ UI.toast('Informe a conta destino','error'); return; }
    if(entradas.length>1&&!confirm('Confirmar recebimento de '+entradas.length+' entradas selecionadas?')) return;
    var parcial=entradas.length===1&&valor<total;
    var ops=[];
    if(parcial){
      var m=entradas[0];
      var saldo=+(total-valor).toFixed(2);
      window._movRecebimentoParcial={orig:m,saldo:saldo,update:{status:'parcial',valorRecebido:valor,valor_recebido_total:valor,saldoRestante:saldo,saldo_restante:saldo,valorTotalOriginal:_parseNum(m.valorTotalOriginal||m.valor),data_recebimento:data,conta_id:conta,updatedAt:new Date().toISOString()}};
      if(window._movEfModal) window._movEfModal.close();
      _openRecebimentoParcialModal();
      return;
    }
    entradas.forEach(function(m){
      var valorEf=_parseNum(m.valorParcela||m.valor);
      ops.push(DB.update('movimentacoes',m.id,{status:'efetivado',valorRecebido:valorEf,valor_recebido_total:valorEf,saldoRestante:0,saldo_restante:0,valorTotalOriginal:_parseNum(m.valorTotalOriginal||m.valor),data_recebimento:data,data:data,conta_id:conta,updatedAt:new Date().toISOString()}));
    });
    Promise.all(ops).then(function(){
      if(window._movEfModal) window._movEfModal.close();
      UI.toast('Recebimento confirmado','success');
      _movSelecionadas=[];
      _loadMovimentacoes();
    }).catch(function(e){ UI.toast('Erro: '+e.message,'error'); });
  }

  function _openRecebimentoParcialModal() {
    var ctx=window._movRecebimentoParcial||{};
    var body='<div>'+
      '<p style="font-size:14px;color:#374151;line-height:1.45;margin-bottom:12px;">Você recebeu apenas parte do valor. O que deseja fazer com o restante?</p>'+
      '<div style="font-size:13px;color:#8A7E7C;">Saldo restante: <strong style="color:#D97706;">'+_fmtVal(ctx.saldo||0)+'</strong></div>'+
    '</div>';
    var footer='<div style="display:flex;gap:10px;">'+
      '<button onclick="Modules.Financeiro._gerarNovaPrevisaoParcial()" style="flex:1;padding:12px;border-radius:10px;border:none;background:#16A34A;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Gerar nova previsão</button>'+
      '<button onclick="Modules.Financeiro._marcarEntradaParcial()" style="flex:1;padding:12px;border-radius:10px;border:1.5px solid #D4C8C6;background:#fff;color:#374151;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Marcar como parcial</button>'+
    '</div>';
    window._movParcialModal=UI.modal({title:'Recebimento parcial',body:body,footer:footer,maxWidth:'460px'});
  }

  function _marcarEntradaParcial() {
    var ctx=window._movRecebimentoParcial||{};
    if(!ctx.orig||!ctx.orig.id) return;
    DB.update('movimentacoes',ctx.orig.id,ctx.update).then(function(){
      if(window._movParcialModal) window._movParcialModal.close();
      UI.toast('Entrada marcada como parcial','success');
      _movSelecionadas=[];
      _loadMovimentacoes();
    }).catch(function(e){ UI.toast('Erro: '+e.message,'error'); });
  }

  function _gerarNovaPrevisaoParcial() {
    var ctx=window._movRecebimentoParcial||{};
    if(!ctx.orig||!ctx.orig.id) return;
    DB.update('movimentacoes',ctx.orig.id,ctx.update).then(function(){
      if(window._movParcialModal) window._movParcialModal.close();
      _openEntradaRestanteModal(ctx.orig,ctx.saldo);
    }).catch(function(e){ UI.toast('Erro: '+e.message,'error'); });
  }

  function _openEntradaRestanteModal(orig,saldo) {
    window._movEntradaRestante={orig:orig,saldo:saldo};
    var body='<div><div style="font-size:13px;color:#8A7E7C;margin-bottom:12px;">Valor restante: <strong style="color:#D97706;">'+_fmtVal(saldo)+'</strong></div>'+
      '<div style="margin-bottom:12px;"><label style="'+_lbl()+'">Valor restante</label><input type="text" value="'+_esc(_fmtVal(saldo))+'" readonly style="'+_inp()+'background:#F8F6F5;"></div>'+
      '<label style="'+_lbl()+'">Nova data prevista *</label><input id="mov-rest-data" type="date" value="'+_today()+'" style="'+_inp()+'"></div>';
    var footer='<button onclick="Modules.Financeiro._criarEntradaRestante()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#16A34A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Criar nova entrada</button>';
    window._movRestModal=UI.modal({title:'Nova previsão de recebimento',body:body,footer:footer,maxWidth:'420px'});
  }

  function _criarEntradaRestante() {
    var data=window._movEntradaRestante||{};
    var orig=data.orig||{};
    var venc=(document.getElementById('mov-rest-data')||{}).value||'';
    if(!venc){ UI.toast('Informe a nova data prevista','error'); return; }
    var novaEntrada=Object.assign({},orig,{
      descricao:(orig.descricao||'Entrada')+' - saldo restante',
      valor:data.saldo,
      valorTotalOriginal:data.saldo,
      valorParcela:data.saldo,
      valorRecebido:0,
      saldoRestante:data.saldo,
      data:venc,
      status:'previsto',
      valor_recebido_total:0,
      saldo_restante:data.saldo,
      entradaOriginalId:orig.entradaOriginalId||orig.id,
      origem:'manual',
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString()
    });
    delete novaEntrada.id;
    DB.add('movimentacoes',novaEntrada).then(function(){
      if(window._movRestModal) window._movRestModal.close();
      UI.toast('Previsão restante criada','success');
      _movSelecionadas=[];
      _loadMovimentacoes();
    }).catch(function(e){ UI.toast('Erro: '+e.message,'error'); });
  }

  // ── CONTAS A PAGAR ────────────────────────────────────────────────────────
  var _cpFiltro={periodo:'mes',inicio:'',fim:'',contas:[],status:{pago:true,pendente:true,parcial:true,vencido:true},busca:'',ordem:'asc'};

  function _loadContasPagar() {
    Promise.all([_loadContasPagarData(),DB.getAll('financeiro_categorias'),DB.getAll('fornecedores'),DB.getAll('contas_bancarias'),_loadMovimentacoesData()]).then(function(r){
      _contasPagar=r[0]||[]; _categorias=r[1]||[]; _fornecedores=r[2]||[]; _contasBancarias=r[3]||[]; _movimentacoes=r[4]||[];
      _paintContasPagar();
    });
  }

  function _paintContasPagar() {
    var content=document.getElementById('fin-content'); if(!content) return;
    var hoje=_today();
    var mesStr=hoje.slice(0,7);
    var start30=(function(){ var d=new Date(); d.setDate(d.getDate()-30); return d.toISOString().slice(0,10); })();
    var contasAtivas=(_contasBancarias||[]).filter(function(c){ return c.ativo!==false; });
    var caixa=contasAtivas.find(function(c){
      var txt=((c.nome||'')+' '+(c.tipo||'')).toLowerCase();
      return txt.indexOf('caixa')>=0 || txt.indexOf('cofre')>=0;
    });
    var contasOrdenadas=contasAtivas.slice().sort(function(a,b){
      if(caixa){
        if(a.id===caixa.id) return -1;
        if(b.id===caixa.id) return 1;
      }
      return (a.nome||'').localeCompare(b.nome||'');
    });
    var filtered=_contasPagar.filter(function(cp){
      var st=_statusCP(cp);
      var busca=(_cpFiltro.busca||'').toLowerCase().trim();
      var fornecedorNome=cp.fornecedorNome||cp.fornecedor||'';
      if(!fornecedorNome&&cp.fornecedorId){
        var forn=_fornecedores.find(function(f){ return f.id===cp.fornecedorId; });
        fornecedorNome=forn?(forn.name||forn.nome||''):'';
      }
      if(_cpFiltro.status && !_cpFiltro.status[st]) return false;
      if(_cpFiltro.contas&&_cpFiltro.contas.length&&_cpFiltro.contas.indexOf(cp.conta_id)<0) return false;
      if(_cpFiltro.periodo==='mes'&&(!cp.vencimento||cp.vencimento.slice(0,7)!==mesStr)) return false;
      if(_cpFiltro.periodo==='30'){ var dd30=new Date(cp.vencimento); if(!cp.vencimento||dd30<new Date(start30+'T00:00:00')) return false; }
      if(_cpFiltro.periodo==='custom'){
        if(_cpFiltro.inicio&&(!cp.vencimento||cp.vencimento<_cpFiltro.inicio)) return false;
        if(_cpFiltro.fim&&(!cp.vencimento||cp.vencimento>_cpFiltro.fim)) return false;
      }
      if(busca){
        var valorTxt=_fmtVal(cp.valor).toLowerCase();
        var valorRaw=String(_parseNum(cp.valor)).toLowerCase();
        var hay=[cp.descricao,fornecedorNome,cp.categoria,valorRaw,valorTxt].join(' ').toLowerCase();
        if(hay.indexOf(busca)<0) return false;
      }
      return true;
    }).sort(function(a,b){
      var cmp=(a.vencimento||'').localeCompare(b.vencimento||'');
      return _cpFiltro.ordem==='asc'?cmp:-cmp;
    });
    var totalAPagar=filtered.filter(function(cp){ return _statusCP(cp)==='pendente'; }).reduce(function(s,cp){
      return s+_cpValorInfo(cp).valorRow;
    },0);
    var totalPago=filtered.filter(function(cp){ return _statusCP(cp)==='pago' || _statusCP(cp)==='parcial'; }).reduce(function(s,cp){
      var info=_cpValorInfo(cp);
      return s+(_statusCP(cp)==='parcial'?info.valorPago:info.valorRow);
    },0);
    var totalParcial=filtered.filter(function(cp){ return _statusCP(cp)==='parcial'; }).reduce(function(s,cp){
      return s+_cpValorInfo(cp).saldoRestante;
    },0);
    var totalVencido=filtered.filter(function(cp){ return _statusCP(cp)==='vencido'; }).reduce(function(s,cp){
      return s+_cpValorInfo(cp).valorVencido;
    },0);
    var showCustom=_cpFiltro.periodo==='custom';
    var contasHtml='<label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#1A1A1A;"><input type="checkbox" '+((!_cpFiltro.contas||!_cpFiltro.contas.length)?'checked':'')+' onchange="Modules.Financeiro._setCPFiltro(\'contas\',[])" style="accent-color:#C4362A;"> Todas as contas</label>'+
      contasOrdenadas.map(function(c){ return '<label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#1A1A1A;"><input type="checkbox" '+((_cpFiltro.contas||[]).indexOf(c.id)>=0?'checked':'')+' onchange="Modules.Financeiro._toggleCPConta(\''+c.id+'\',this.checked)" style="accent-color:#C4362A;"> '+_esc(c.nome)+'</label>'; }).join('');
    content.innerHTML=
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">'+
        '<div><h2 style="font-size:18px;font-weight:800;margin-bottom:4px;">Saídas</h2>'+
          '<p style="font-size:12px;color:#8A7E7C;">Controle o que você tem para pagar e o que já saiu do caixa.</p></div>'+
        '<button onclick="Modules.Financeiro._openCPModal(null)" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Nova Saída</button>'+
      '</div>'+
      '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,.06);padding:14px;margin-bottom:16px;">'+
        '<div style="display:grid;grid-template-columns:170px 1fr 160px 1fr;gap:10px;align-items:end;">'+
          '<div><label style="'+_lbl()+'">Período</label>'+
            '<select onchange="Modules.Financeiro._setCPFiltro(\'periodo\',this.value)" style="padding:8px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:12px;font-family:inherit;outline:none;background:#fff;cursor:pointer;width:100%;">'+
              '<option value="mes"'+(_cpFiltro.periodo==='mes'?' selected':'')+'>Este mês</option>'+
              '<option value="30"'+(_cpFiltro.periodo==='30'?' selected':'')+'>Últimos 30 dias</option>'+
              '<option value="custom"'+(_cpFiltro.periodo==='custom'?' selected':'')+'>Personalizado</option>'+
            '</select>'+
          '</div>'+
          '<div><label style="'+_lbl()+'">Conta</label><div style="min-height:35px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'+contasHtml+'</div></div>'+
          '<div><label style="'+_lbl()+'">Status</label><div style="display:flex;flex-wrap:wrap;gap:8px;">'+
            '<label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#1A1A1A;"><input type="checkbox" '+((_cpFiltro.status||{}).pago?'checked':'')+' onchange="Modules.Financeiro._toggleCPStatus(\'pago\',this.checked)" style="accent-color:#C4362A;"> Já pago</label>'+
            '<label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#1A1A1A;"><input type="checkbox" '+((_cpFiltro.status||{}).pendente?'checked':'')+' onchange="Modules.Financeiro._toggleCPStatus(\'pendente\',this.checked)" style="accent-color:#C4362A;"> A pagar</label>'+
            '<label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#1A1A1A;"><input type="checkbox" '+((_cpFiltro.status||{}).parcial?'checked':'')+' onchange="Modules.Financeiro._toggleCPStatus(\'parcial\',this.checked)" style="accent-color:#C4362A;"> Parcial</label>'+
            '<label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#1A1A1A;"><input type="checkbox" '+((_cpFiltro.status||{}).vencido?'checked':'')+' onchange="Modules.Financeiro._toggleCPStatus(\'vencido\',this.checked)" style="accent-color:#C4362A;"> Vencido</label>'+
          '</div></div>'+
          '<div><label style="'+_lbl()+'">Busca</label><input type="search" value="'+_esc(_cpFiltro.busca||'')+'" oninput="Modules.Financeiro._setCPFiltro(\'busca\',this.value)" placeholder="Buscar por descrição, fornecedor, categoria ou valor..." style="padding:8px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:12px;font-family:inherit;outline:none;background:#fff;cursor:text;width:100%;"></div>'+
        '</div>'+
        '<div style="display:'+(showCustom?'grid':'none')+';grid-template-columns:170px 170px;gap:10px;margin-top:10px;">'+
          '<div><label style="'+_lbl()+'">Data inicial</label><input type="date" value="'+_esc(_cpFiltro.inicio||'')+'" onchange="Modules.Financeiro._setCPFiltro(\'inicio\',this.value)" style="padding:8px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:12px;font-family:inherit;outline:none;background:#fff;cursor:pointer;width:100%;"></div>'+
          '<div><label style="'+_lbl()+'">Data final</label><input type="date" value="'+_esc(_cpFiltro.fim||'')+'" onchange="Modules.Financeiro._setCPFiltro(\'fim\',this.value)" style="padding:8px 12px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:12px;font-family:inherit;outline:none;background:#fff;cursor:pointer;width:100%;"></div>'+
        '</div>'+
        '<div style="margin-top:12px;font-size:12px;color:#6B7280;line-height:1.5;">'+filtered.length+' registros · Total a pagar: <strong style="color:#D97706;font-weight:600;">'+_fmtVal(totalAPagar)+'</strong> · Total pago: <strong style="color:#16A34A;font-weight:600;">'+_fmtVal(totalPago)+'</strong> · Parcial/pendente: <strong style="color:#2563EB;font-weight:600;">'+_fmtVal(totalParcial)+'</strong> · Vencido: <strong style="color:#DC2626;font-weight:600;">'+_fmtVal(totalVencido)+'</strong></div>'+
      '</div>'+
      (filtered.length===0
        ?'<div style="text-align:center;padding:60px 20px;color:#8A7E7C;"><div style="font-size:14px;font-weight:600;">Nenhuma saída encontrada</div></div>'
        :'<div style="background:#fff;border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,.06);overflow:hidden;">'+
            '<table style="width:100%;border-collapse:collapse;">'+
              '<thead><tr style="background:#F8F6F5;">'+
                '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;cursor:pointer;user-select:none;" onclick="Modules.Financeiro._toggleCPOrdem()">Vencimento '+(_cpFiltro.ordem==='asc'?'↑':'↓')+'</th>'+
                '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Descrição</th>'+
                '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Categoria</th>'+
                '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Fornecedor</th>'+
                '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Status</th>'+
                '<th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Valor</th>'+
                '<th style="padding:10px 6px;"></th>'+
              '</tr></thead><tbody>'+
              filtered.map(function(cp){
                var st=_statusCP(cp);
                var fornecedorNome=cp.fornecedorNome||cp.fornecedor||'';
                if(!fornecedorNome&&cp.fornecedorId){
                  var forn=_fornecedores.find(function(f){ return f.id===cp.fornecedorId; });
                  fornecedorNome=forn?(forn.name||forn.nome||''):'';
                }
                var info=_cpValorInfo(cp);
                var valorHtml=st==='parcial'
                  ?'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;line-height:1.15;"><div style="font-size:12px;font-weight:700;color:#16A34A;">Pago: '+_fmtVal(info.valorPago)+'</div><div style="font-size:12px;font-weight:700;color:#B45309;">Pendente: '+_fmtVal(info.saldoRestante)+'</div></div>'
                  :('<div style="text-align:right;"><div style="font-size:14px;font-weight:800;color:#DC2626;">− '+_fmtVal(info.displayValor)+'</div><div style="font-size:11px;color:#8A7E7C;margin-top:2px;">'+(st==='pago'?'Já pago':(st==='vencido'?'Vencido':(cp.parcelada?'Parcela '+(cp.parcelaNumero||'?')+'/'+(cp.numeroParcelas||'?'):'A pagar')) )+'</div></div>');
                return '<tr style="border-top:1px solid #F2EDED;cursor:pointer;'+(st==='vencido'?'background:#FFF5F5;':st==='pago'?'background:#F0FFF4;':'')+'" onclick="Modules.Financeiro._openCPDetalheModal(\''+cp.id+'\')" onmouseover="this.style.background=\'#FAFAF9\'" onmouseout="this.style.background=\'\'">'+
                  '<td style="padding:10px 14px;font-size:13px;font-weight:600;color:'+(st==='vencido'?'#DC2626':'#374151')+';">'+_esc(_fmtDateDisplay(cp.vencimento))+'</td>'+
                  '<td style="padding:10px 14px;font-size:13px;">'+_esc(cp.descricao||'—')+(cp.recorrente?'<span style="font-size:10px;background:#EFF6FF;color:#3B82F6;padding:1px 6px;border-radius:9px;margin-left:4px;">↻</span>':'')+'</td>'+
                  '<td style="padding:10px 14px;font-size:12px;color:#8A7E7C;">'+_esc(cp.categoria||'—')+'</td>'+
                  '<td style="padding:10px 14px;font-size:12px;color:#8A7E7C;">'+_esc(fornecedorNome||'—')+'</td>'+
                  '<td style="padding:10px 14px;">'+_badgeSaidaStatus(st)+'</td>'+
                  '<td style="padding:10px 14px;text-align:right;">'+valorHtml+'</td>'+
                  '<td style="padding:10px 6px;text-align:right;white-space:nowrap;">'+
                    (st!=='pago'?'<button onclick="event.stopPropagation();Modules.Financeiro._pagarCP(\''+cp.id+'\')" style="padding:6px 10px;border-radius:8px;border:none;background:#16A34A;color:#fff;cursor:pointer;font-size:11px;font-weight:700;font-family:inherit;margin-right:4px;">Confirmar saída</button>':'')+
                    (st==='pago'?'':'<button onclick="event.stopPropagation();Modules.Financeiro._openCPModal(\''+cp.id+'\')" style="padding:6px 10px;border-radius:8px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;font-size:11px;font-weight:700;font-family:inherit;margin-right:4px;">Editar</button>')+
                    '<button onclick="event.stopPropagation();Modules.Financeiro._deleteCP(\''+cp.id+'\')" style="padding:6px 10px;border-radius:8px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;font-size:11px;font-weight:700;font-family:inherit;">Excluir</button>'+
                  '</td></tr>';
              }).join('')+
              '</tbody></table></div>');
  }

  function _setCPFiltro(key,val){
    _cpFiltro[key]=val;
    if(key==='periodo'&&val==='custom'){
      _cpFiltro.inicio=_cpFiltro.inicio||_today();
      _cpFiltro.fim=_cpFiltro.fim||_today();
    }
    _paintContasPagar();
  }

  function _toggleCPConta(id,checked){
    var contas=(_cpFiltro.contas||[]).slice();
    if(checked&&contas.indexOf(id)<0) contas.push(id);
    if(!checked) contas=contas.filter(function(x){ return x!==id; });
    _cpFiltro.contas=contas;
    _paintContasPagar();
  }

  function _toggleCPStatus(status,checked){
    var st=Object.assign({},_cpFiltro.status||{});
    st[status]=checked;
    _cpFiltro.status=st;
    _paintContasPagar();
  }

  function _toggleCPOrdem() {
    _cpFiltro.ordem=_cpFiltro.ordem==='asc'?'desc':'asc';
    _paintContasPagar();
  }

  function _openContasVencidas() {
    _cpFiltro.status={pago:false,pendente:false,parcial:false,vencido:true};
    _switchSub('contas-pagar');
  }

  function _cpMovPagamento(cp) {
    if(!cp || !cp.id) return null;
    var movs=(_movimentacoes||[]).filter(function(m){ return m.tipo==='saida' && m.contaPagarId===cp.id; }).sort(function(a,b){
      return (b.data||'').localeCompare(a.data||'');
    });
    return movs[0] || null;
  }

  function _openCPDetalheModal(id) {
    var cp=id?(_contasPagar.find(function(x){ return x.id===id; })||{}):{};
    if(!cp.id) return;
    var st=_statusCP(cp);
    var info=_cpValorInfo(cp);
    var pago=info.valorPago;
    var pendente=info.saldoRestante;
    var mov=_cpMovPagamento(cp);
    var fornNome=cp.fornecedorNome||cp.fornecedor||'—';
    if(!cp.fornecedorNome&&cp.fornecedorId){
      var forn=_fornecedores.find(function(f){ return f.id===cp.fornecedorId; });
      fornNome=forn?(forn.name||forn.nome||''):'—';
    }
    var tipoLabel=cp.parcelada?'Parcelada':(cp.recorrente?'Recorrente':'Conta única');
    var statusInfo=st==='pago'
      ? {label:'Já pago',bg:'#DCFCE7',fg:'#16A34A'}
      : st==='parcial'
        ? {label:'Parcial',bg:'#FEF9C3',fg:'#B45309'}
        : st==='vencido'
          ? {label:'Vencida',bg:'#FEE2E2',fg:'#DC2626'}
          : {label:'A pagar',bg:'#EFF6FF',fg:'#2563EB'};
    var infoCards=[];
    if(info.valorTotalOriginal){
      infoCards.push('<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Valor total original</div><div style="font-size:14px;font-weight:600;color:#1F2937;">'+_fmtVal(info.valorTotalOriginal)+'</div></div>');
    }
    if(info.valorParcela && (cp.parcelada || cp.parcelaNumero || cp.numeroParcelas)){
      infoCards.push('<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Valor da parcela</div><div style="font-size:14px;font-weight:600;color:#1F2937;">'+_fmtVal(info.valorParcela)+'</div></div>');
    }
    if(cp.recorrente){
      infoCards.push('<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Recorrência</div><div style="font-size:14px;font-weight:600;color:#1F2937;">'+_esc(cp.periodicidade||'Mensal')+(cp.data_final?' até '+_esc(_fmtDateDisplay(cp.data_final)):'')+'</div></div>');
    }
    if(cp.parcelada && (cp.parcelaNumero || cp.numeroParcelas)){
      infoCards.push('<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Parcelamento</div><div style="font-size:14px;font-weight:600;color:#1F2937;">'+_esc('Parcela '+(cp.parcelaNumero||'?')+' de '+(cp.numeroParcelas||'?'))+'</div></div>');
    }
    if(cp.parcelada && mov && mov.data){
      var nextLabel=cp.status==='pago' ? 'Último pagamento' : 'Próxima';
      infoCards.push('<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">'+_esc(nextLabel)+'</div><div style="font-size:14px;font-weight:600;color:#1F2937;">'+_esc(_fmtDateDisplay(mov.data))+'</div></div>');
    }
    if(st==='parcial'){
      infoCards.push('<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Valor pago</div><div style="font-size:18px;font-weight:700;color:#16A34A;">'+_fmtVal(pago)+'</div></div>');
      infoCards.push('<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Saldo pendente</div><div style="font-size:18px;font-weight:700;color:#B45309;">'+_fmtVal(pendente)+'</div></div>');
    }
    if(st==='pago' && pago){
      infoCards.push('<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Valor pago</div><div style="font-size:18px;font-weight:700;color:#16A34A;">'+_fmtVal(pago)+'</div></div>');
    }
    var body=
      '<div style="display:flex;flex-direction:column;gap:14px;">'+
        '<div style="background:#F8F6F5;border:1px solid #EDE7E4;border-radius:16px;padding:18px;">'+
          '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">'+
            '<div style="min-width:0;">'+
              '<div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;">Valor</div>'+
              '<div style="font-size:32px;line-height:1;font-weight:700;color:#1F2937;">'+_fmtVal(info.valorTotalOriginal)+'</div>'+
              '<div style="margin-top:8px;font-size:13px;color:#6B7280;">'+
                (st==='parcial'
                  ? _fmtVal(pago)+' pagos • '+_fmtVal(pendente)+' pendentes'
                  : tipoLabel)+
              '</div>'+
            '</div>'+
            '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">'+
              '<span style="background:'+statusInfo.bg+';color:'+statusInfo.fg+';padding:6px 12px;border-radius:999px;font-size:11px;font-weight:700;">'+statusInfo.label+'</span>'+
              '<span style="background:#fff;border:1px solid #E7E2E0;color:#6B7280;padding:6px 12px;border-radius:999px;font-size:11px;font-weight:700;">'+_esc(tipoLabel)+'</span>'+
            '</div>'+
          '</div>'+
        '</div>'+

        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">'+
          '<div style="background:#fff;border:1px solid #EDE7E4;border-radius:16px;padding:14px;">'+
            '<div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:10px;">Principal</div>'+
            '<div style="display:flex;flex-direction:column;gap:10px;">'+
              '<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Vencimento</div><div style="font-size:14px;font-weight:600;color:#1F2937;">'+_esc(_fmtDateDisplay(cp.vencimento))+'</div></div>'+
              '<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Status</div><div>'+_badgeSaidaStatus(st)+'</div></div>'+
              '<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Tipo</div><div style="font-size:14px;font-weight:600;color:#1F2937;">'+_esc(tipoLabel)+'</div></div>'+
            '</div>'+
          '</div>'+
          '<div style="background:#fff;border:1px solid #EDE7E4;border-radius:16px;padding:14px;">'+
            '<div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:10px;">Detalhes</div>'+
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">'+
              '<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Quem vai receber</div><div style="font-size:14px;font-weight:600;color:#1F2937;">'+_esc(fornNome||'—')+'</div></div>'+
              '<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Categoria</div><div style="font-size:14px;font-weight:600;color:#1F2937;">'+_esc(cp.categoria||'—')+'</div></div>'+
              '<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Conta de saída</div><div style="font-size:14px;font-weight:600;color:#1F2937;">'+_esc(mov&&mov.conta_id?(_contasBancarias.find(function(c){ return c.id===mov.conta_id; })||{}).nome:'—')+'</div></div>'+
              '<div><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Forma de pagamento</div><div style="font-size:14px;font-weight:600;color:#1F2937;">'+_esc(mov&&mov.forma_pagamento||'—')+'</div></div>'+
            '</div>'+
          '</div>'+
        '</div>'+

        (infoCards.length
          ? '<div style="background:#fff;border:1px solid #EDE7E4;border-radius:16px;padding:14px;"><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:10px;">Informações adicionais</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">'+infoCards.join('')+'</div></div>'
          : '')+
        (cp.observacoes && String(cp.observacoes).trim()
          ? '<div style="background:#fff;border:1px solid #EDE7E4;border-radius:16px;padding:14px;"><div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:10px;">Observações</div><div style="font-size:14px;line-height:1.5;color:#1F2937;white-space:pre-wrap;word-break:break-word;">'+_esc(cp.observacoes)+'</div></div>'
          : '')+
      '</div>';
    var footer='<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;">'+
      (st==='parcial'
        ? '<button onclick="Modules.Financeiro._closeCPDetalhe();Modules.Financeiro._pagarCP(\''+cp.id+'\')" style="padding:12px 16px;border-radius:10px;border:none;background:#16A34A;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Pagar restante</button>'
        : (st==='pendente' || st==='vencido'
          ? '<button onclick="Modules.Financeiro._closeCPDetalhe();Modules.Financeiro._pagarCP(\''+cp.id+'\')" style="padding:12px 16px;border-radius:10px;border:none;background:#16A34A;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Marcar como pago</button>'
          : ''))+
      (st!=='pago'
        ? '<button onclick="Modules.Financeiro._closeCPDetalhe();Modules.Financeiro._openCPModal(\''+cp.id+'\')" style="padding:12px 16px;border-radius:10px;border:none;background:#EEF4FF;color:#3B82F6;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Editar</button>'
        : '')+
      '<button onclick="Modules.Financeiro._deleteCP(\''+cp.id+'\')" style="padding:12px 16px;border-radius:10px;border:none;background:#FFF0EE;color:#C4362A;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Excluir</button>'+
      '<button onclick="Modules.Financeiro._closeCPDetalhe();" style="padding:12px 16px;border-radius:10px;border:1.5px solid #D4C8C6;background:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Fechar</button>'+
    '</div>';
    window._cpDetalheModal=UI.modal({title:'Resumo da saída',body:body,footer:footer,maxWidth:'760px'});
  }

  function _closeCPDetalhe() {
    if(window._cpDetalheModal) window._cpDetalheModal.close();
  }

  function _openCPModal(id) {
    _editingId=id;
    var cp=id?(_contasPagar.find(function(x){ return x.id===id; })||{}):{};
    var cats=_catsByTipo('saida');
    var catOpts='<option value="">Sem categoria</option>'+cats.map(function(c){ return '<option value="'+_esc(c)+'"'+(cp.categoria===c?' selected':'')+'>'+_esc(c)+'</option>'; }).join('')+'<option value="__nova__">+ Nova categoria</option>';
    var fornecedorId=cp.fornecedorId||'';
    var fornecedorSel=fornecedorId||(!fornecedorId&&cp.fornecedor?'__novo__':'');
    var fornecedorOpts='<option value="">Sem fornecedor</option>'+(_fornecedores||[]).slice().sort(function(a,b){ return (a.name||a.nome||'').localeCompare(b.name||b.nome||''); }).map(function(f){ return '<option value="'+f.id+'"'+(fornecedorSel===f.id?' selected':'')+'>'+_esc(f.name||f.nome||'')+'</option>'; }).join('')+'<option value="__novo__"'+(fornecedorSel==='__novo__'?' selected':'')+'>+ Novo fornecedor</option>';
    var recFreq=cp.periodicidade||'mensal';
    var statusSel=(cp.status==='pago'||cp.data_pagamento)?'pago':'pendente';
    var ehRec=!!cp.recorrente;
    var recChecked=!!cp.recorrente;
    var parcChecked=!!cp.parcelada;
    var body=
      '<div style="display:flex;flex-direction:column;gap:16px;">'+
        '<div style="background:#fff;border:1px solid #EDE7E4;border-radius:16px;padding:14px 16px;">'+
          '<div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:10px;">Dados principais</div>'+
          '<div style="display:flex;flex-direction:column;gap:12px;">'+
            '<div><label style="'+_lbl()+'">Descrição da saída *</label><input id="cp-desc" type="text" value="'+_esc(cp.descricao||'')+'" placeholder="Ex: Luz, aluguer, fornecedor..." style="'+_inp()+'"></div>'+
            '<div style="'+_g2()+'">'+
              '<div><label style="'+_lbl()+'">Valor total *</label><input id="cp-valor" type="text" value="'+_esc(cp.valor||'')+'" placeholder="0,00" oninput="Modules.Financeiro._renderCPPreviews()" style="'+_inp()+'"></div>'+
              '<div><label style="'+_lbl()+'">Fornecedor</label><select id="cp-forn-id" onchange="Modules.Financeiro._toggleCPNovoForn();Modules.Financeiro._renderCPPreviews();" style="'+_inp()+'background:#fff;">'+fornecedorOpts+'</select><input id="cp-forn-novo" type="text" value="'+(!fornecedorId&&cp.fornecedor?_esc(cp.fornecedor):'')+'" placeholder="Nome do novo fornecedor..." style="'+_inp()+'display:none;margin-top:8px;"></div>'+
            '</div>'+
          '</div>'+
        '</div>'+

        '<div style="background:#fff;border:1px solid #EDE7E4;border-radius:16px;padding:14px 16px;">'+
          '<div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:10px;">Status da saída</div>'+
          '<input type="hidden" id="cp-status" value="'+_esc(statusSel)+'">'+
          '<div style="display:flex;gap:12px;flex-wrap:wrap;">'+
            '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;cursor:pointer;"><input type="radio" name="cp-status-radio" value="pendente" '+(statusSel==='pendente'?'checked':'')+' onchange="Modules.Financeiro._setCPStatus(\'pendente\')" style="accent-color:#C4362A;"> A pagar</label>'+
            '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;cursor:pointer;"><input type="radio" name="cp-status-radio" value="pago" '+(statusSel==='pago'?'checked':'')+' onchange="Modules.Financeiro._setCPStatus(\'pago\')" style="accent-color:#C4362A;"> Já paga</label>'+
          '</div>'+
          '<div id="cp-status-help" style="margin-top:8px;font-size:11px;color:#8A7E7C;">'+(statusSel==='pago'?'A data de pagamento é obrigatória.':'Escolha o status da saída antes de salvar.')+'</div>'+
        '</div>'+

        '<div id="cp-tipo-box" style="background:#fff;border:1px solid #EDE7E4;border-radius:16px;padding:14px 16px;">'+
          '<div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:10px;">Tipo de pagamento</div>'+
          '<div style="display:flex;flex-direction:column;gap:10px;">'+
            '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;cursor:pointer;"><input type="checkbox" id="cp-recorrente"'+(recChecked?' checked':'')+' onchange="Modules.Financeiro._toggleCPRecorrente()" style="accent-color:#C4362A;"> Pagamento recorrente</label>'+
            '<div id="cp-rec-box" style="display:'+(recChecked?'block':'none')+';">'+
              '<div style="'+_g2()+'">'+
                '<div><label style="'+_lbl()+'">Frequência</label><select id="cp-periodo" onchange="Modules.Financeiro._renderCPPreviews()" style="'+_inp()+'background:#fff;">'+
                  '<option value="semanal"'+(recFreq==='semanal'?' selected':'')+'>Semanal</option>'+
                  '<option value="mensal"'+(recFreq==='mensal'?' selected':'')+'>Mensal</option>'+
                  '<option value="anual"'+(recFreq==='anual'?' selected':'')+'>Anual</option>'+
                '</select></div>'+
                '<div><label style="'+_lbl()+'">Número de repetições *</label><input id="cp-repeticoes" type="number" min="1" value="'+_esc(cp.repeticoes||'')+'" placeholder="Ex: 6" oninput="Modules.Financeiro._renderCPPreviews()" style="'+_inp()+'"></div>'+
              '</div>'+
              '<div id="cp-rec-preview" style="margin-top:10px;"></div>'+
            '</div>'+
            '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;cursor:pointer;"><input type="checkbox" id="cp-parcelada"'+(parcChecked?' checked':'')+' onchange="Modules.Financeiro._toggleCPParcelada()" style="accent-color:#C4362A;"> Dividir em parcelas</label>'+
            '<div id="cp-parcelas-section" style="display:'+(parcChecked?'block':'none')+';">'+
              '<div style="'+_g2()+'">'+
                '<div><label style="'+_lbl()+'">Número de parcelas *</label><input id="cp-num-parcelas" type="number" min="2" value="'+_esc(cp.numeroParcelas||'')+'" placeholder="Ex: 3" oninput="Modules.Financeiro._renderCPPreviews()" style="'+_inp()+'"></div>'+
                '<div><label style="'+_lbl()+'">Valor por parcela</label><input id="cp-valor-parcela" type="text" readonly value="" style="'+_inp()+'background:#F8F6F5;"></div>'+
              '</div>'+
              '<div id="cp-parc-preview" style="margin-top:10px;"></div>'+
            '</div>'+
          '</div>'+
        '</div>'+

        '<div style="background:#fff;border:1px solid #EDE7E4;border-radius:16px;padding:14px 16px;">'+
          '<div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:10px;">Datas</div>'+
          '<div style="display:flex;flex-direction:column;gap:12px;">'+
            '<div><label style="'+_lbl()+'">Vencimento *</label><input id="cp-venc" type="date" value="'+_esc(cp.vencimento||_today())+'" style="'+_inp()+'"></div>'+
            '<div id="cp-pago-box" style="display:'+(statusSel==='pago'?'block':'none')+';"><label style="'+_lbl()+'">Data de pagamento *</label><input id="cp-pago" type="date" value="'+_esc(cp.data_pagamento||'')+'" style="'+_inp()+'"></div>'+
          '</div>'+
        '</div>'+

        '<div style="background:#fff;border:1px solid #EDE7E4;border-radius:16px;padding:14px 16px;">'+
          '<div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:10px;">Observações</div>'+
          '<textarea id="cp-obs" placeholder="Opcional..." style="'+_inp()+'min-height:72px;resize:vertical;">'+_esc(cp.observacoes||'')+'</textarea>'+
        '</div>'+
      '</div>';
    var footer='<button onclick="Modules.Financeiro._saveCP()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Salvar</button>';
    window._cpModal=UI.modal({title:id?'Editar Saída':'Nova Saída',body:body,footer:footer,maxWidth:'540px'});
    setTimeout(function(){
      _setCPStatus(statusSel||'pendente');
      _toggleCPRecorrente();
      _toggleCPParcelada();
      _toggleCPNovoForn();
      _toggleCPNovaCat();
      _renderCPPreviews();
    },0);
  }

  function _cpStatusSelecionado() {
    return (document.getElementById('cp-status')||{}).value||'pendente';
  }

  function _setCPStatus(status) {
    var input=document.getElementById('cp-status');
    if(input) input.value=status||'';
    var help=document.getElementById('cp-status-help');
    var pagoBox=document.getElementById('cp-pago-box');
    var pagoLabel=document.querySelector('#cp-pago-box label');
    var tipoBox=document.getElementById('cp-tipo-box');
    var rec=document.getElementById('cp-recorrente');
    var parcel=document.getElementById('cp-parcelada');
    var recBox=document.getElementById('cp-rec-box');
    var parcSec=document.getElementById('cp-parcelas-section');
    var isPago=status==='pago';
    if(help) help.textContent=isPago?'A data de pagamento é obrigatória.':'Escolha o status da saída antes de salvar.';
    if(pagoBox) pagoBox.style.display=isPago?'block':'none';
    if(pagoLabel) pagoLabel.textContent='Data de pagamento'+(isPago?' *':'');
    if(tipoBox) tipoBox.style.display=isPago?'none':'block';
    if(isPago){
      if(rec) rec.checked=false;
      if(parcel) parcel.checked=false;
      if(recBox) recBox.style.display='none';
      if(parcSec) parcSec.style.display='none';
    } else {
      if(recBox) recBox.style.display=rec&&rec.checked?'block':'none';
      if(parcSec) parcSec.style.display=parcel&&parcel.checked?'block':'none';
    }
  }

  function _toggleCPRecorrente() {
    var checked=!!(document.getElementById('cp-recorrente')||{}).checked;
    var recBox=document.getElementById('cp-rec-box');
    var parcel=document.getElementById('cp-parcelada');
    var parcSec=document.getElementById('cp-parcelas-section');
    if(checked && parcel) parcel.checked=false;
    if(checked && parcSec) parcSec.style.display='none';
    if(recBox) recBox.style.display=checked?'block':'none';
    _renderCPPreviews();
  }

  function _toggleCPParcelada() {
    var sec=document.getElementById('cp-parcelas-section');
    var checked=!!(document.getElementById('cp-parcelada')||{}).checked;
    var rec=document.getElementById('cp-recorrente');
    var recSec=document.getElementById('cp-rec-box');
    if(checked && rec) rec.checked=false;
    if(checked && recSec) recSec.style.display='none';
    if(sec) sec.style.display=checked?'grid':'none';
    _renderCPPreviews();
  }

  function _toggleCPNovoForn() {
    var sel=document.getElementById('cp-forn-id');
    var inp=document.getElementById('cp-forn-novo');
    if(inp) inp.style.display=(sel&&sel.value==='__novo__')?'block':'none';
  }

  function _toggleCPNovaCat() {
    var sel=document.getElementById('cp-cat');
    var inp=document.getElementById('cp-cat-nova');
    if(inp) inp.style.display=(sel&&sel.value==='__nova__')?'block':'none';
  }

  function _addPeriodo(data, freq, idx) {
    var d=new Date(data+'T00:00:00');
    if(freq==='semanal') d.setDate(d.getDate()+(idx*7));
    else if(freq==='anual') d.setFullYear(d.getFullYear()+idx);
    else d.setMonth(d.getMonth()+idx);
    return d.toISOString().slice(0,10);
  }

  function _cpPreviewCard(title, items) {
    return '<div style="background:#FAFAF9;border:1px solid #EDE7E4;border-radius:12px;padding:10px 12px;">'+
      '<div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:8px;">'+_esc(title)+'</div>'+
      (items.length
        ? '<div style="display:flex;flex-direction:column;gap:6px;">'+items.join('')+'</div>'
        : '<div style="font-size:12px;color:#8A7E7C;">Preencha os campos para ver o preview.</div>')+
    '</div>';
  }

  function _renderCPPreviews() {
    var recBox=document.getElementById('cp-rec-preview');
    var parcBox=document.getElementById('cp-parc-preview');
    var rec=!!(document.getElementById('cp-recorrente')||{}).checked;
    var parc=!!(document.getElementById('cp-parcelada')||{}).checked;
    if(recBox){
      if(!rec){ recBox.innerHTML=''; recBox.style.display='none'; }
      else {
        recBox.style.display='block';
        var inicio=(document.getElementById('cp-venc')||{}).value||'';
        var reps=_parseNum((document.getElementById('cp-repeticoes')||{}).value);
        var freq=(document.getElementById('cp-periodo')||{}).value||'mensal';
        var itens=[];
        if(inicio&&reps>0){
          for(var i=0;i<Math.min(reps,8);i++){
            itens.push('<div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;color:#374151;"><span>'+_esc('Recorrência '+(i+1))+'</span><strong style="font-weight:700;">'+_esc(_addPeriodo(inicio,freq,i))+'</strong></div>');
          }
          if(reps>8) itens.push('<div style="font-size:11px;color:#8A7E7C;">... e mais '+(reps-8)+' ocorrências</div>');
        }
        recBox.innerHTML=_cpPreviewCard('Recorrências a criar', itens);
      }
    }
    if(parcBox){
      if(!parc){ parcBox.innerHTML=''; parcBox.style.display='none'; }
      else {
        parcBox.style.display='block';
        var total=_parseNum((document.getElementById('cp-valor')||{}).value);
        var n=_parseNum((document.getElementById('cp-num-parcelas')||{}).value);
        var primeira=(document.getElementById('cp-venc')||{}).value||'';
        var freqP=(document.getElementById('cp-freq-parcelas')||{}).value||'mensal';
        var outParcela=document.getElementById('cp-valor-parcela');
        var itensP=[];
        if(total>0&&n>1&&primeira){
          var valorParcela=total/n;
          if(outParcela) outParcela.value=_fmtVal(valorParcela);
          for(var j=0;j<Math.min(n,8);j++){
            var val=j===n-1?+(total-(valorParcela*(n-1))).toFixed(2):+valorParcela.toFixed(2);
            itensP.push('<div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;color:#374151;"><span>'+_esc('Parcela '+(j+1)+' de '+n)+'</span><strong style="font-weight:700;">'+_esc(_fmtVal(val))+' · '+_esc(_addPeriodo(primeira,freqP,j))+'</strong></div>');
          }
          if(n>8) itensP.push('<div style="font-size:11px;color:#8A7E7C;">... e mais '+(n-8)+' parcelas</div>');
        }
        if(outParcela && !(total>0&&n>1)) outParcela.value='';
        parcBox.innerHTML=_cpPreviewCard('Parcelas a criar', itensP);
      }
    }
  }

  function _saveCP() {
    var desc=((document.getElementById('cp-desc')||{}).value||'').trim();
    var valor=_parseNum((document.getElementById('cp-valor')||{}).value);
    if(!desc){ UI.toast('Descrição obrigatória','error'); return; }
    if(!valor){ UI.toast('Valor deve ser maior que zero','error'); return; }
    var status=_cpStatusSelecionado();
    if(status!=='pendente'&&status!=='pago'){ UI.toast('Selecione o status da saída','error'); return; }
    var rec=!!(document.getElementById('cp-recorrente')||{}).checked;
    var cat=(document.getElementById('cp-cat')||{}).value||'';
    var novaCat=((document.getElementById('cp-cat-nova')||{}).value||'').trim();
    if(cat==='__nova__'&&!novaCat){ UI.toast('Informe o nome da nova categoria','error'); return; }
    var fornId=(document.getElementById('cp-forn-id')||{}).value||'';
    var novoForn=((document.getElementById('cp-forn-novo')||{}).value||'').trim();
    if(fornId==='__novo__'&&!novoForn){ UI.toast('Informe o nome do novo fornecedor','error'); return; }
    var parcelada=!!(document.getElementById('cp-parcelada')||{}).checked;
    if(rec&&parcelada){ UI.toast('Escolha recorrente ou parcelada, não os dois','error'); return; }
    var vencimento=(document.getElementById('cp-venc')||{}).value||_today();
    var dataPagamento=(document.getElementById('cp-pago')||{}).value||null;
    if(status==='pendente') dataPagamento=null;
    if(status==='pago' && !dataPagamento){ UI.toast('Informe a data de pagamento','error'); return; }
    var repeticoes=_parseNum((document.getElementById('cp-repeticoes')||{}).value);
    if(rec && repeticoes<1){ UI.toast('Informe o número de repetições','error'); return; }
    var fornecedorNome='';
    if(fornId&&fornId!=='__novo__'){
      var forn=_fornecedores.find(function(f){ return f.id===fornId; });
      fornecedorNome=forn?(forn.name||forn.nome||''):'';
    }
    var obj={
      descricao:desc, valor:valor,
      valorTotalOriginal:valor,
      valorParcela:valor,
      valorPago:status==='pago'?valor:0,
      saldoRestante:status==='pago'?0:valor,
      vencimento:vencimento,
      data_inicial:rec?vencimento:'',
      data_pagamento:status==='pago'?dataPagamento:null,
      categoria:cat==='__nova__'?novaCat:cat,
      fornecedorId:fornId&&fornId!=='__novo__'?fornId:'',
      fornecedorNome:fornecedorNome,
      fornecedor:fornecedorNome||novoForn||'',
      status:status,
      recorrente:rec,
      periodicidade:rec?((document.getElementById('cp-periodo')||{}).value||'mensal'):null,
      repeticoes:rec?repeticoes:0,
      data_final:'',
      parcelada:parcelada,
      observacoes:(document.getElementById('cp-obs')||{}).value||'',
      updatedAt:new Date().toISOString()
    };
    if(!_editingId) obj.createdAt=new Date().toISOString();
    var saveCat=(cat==='__nova__')?DB.add('financeiro_categorias',{nome:novaCat,tipo:'saida'}):Promise.resolve();
    saveCat.then(function(){
      if(fornId==='__novo__'){
        var existente=(_fornecedores||[]).find(function(f){ return String(f.name||f.nome||'').toLowerCase()===novoForn.toLowerCase(); });
        if(existente){
          obj.fornecedorId=existente.id;
          obj.fornecedorNome=existente.name||existente.nome||'';
          obj.fornecedor=obj.fornecedorNome;
          return null;
        }
        return DB.add('fornecedores',{name:novoForn,nome:novoForn,ativo:true}).then(function(ref){
          obj.fornecedorId=(ref&&ref.id)||'';
          obj.fornecedorNome=novoForn;
          obj.fornecedor=novoForn;
        });
      }
      return null;
    }).then(function(){
      if(rec&&!_editingId){
        var freqRec=(document.getElementById('cp-periodo')||{}).value||'mensal';
        var serieId='recorrencia-'+Date.now();
        var opsRec=[];
        for(var r=1;r<=repeticoes;r++){
          var valorRec=valor;
          opsRec.push(DB.add('contas_pagar',Object.assign({},obj,{
            valor:valorRec,
            valorParcela:valorRec,
            valorTotalOriginal:valor,
            valorPago:0,
            saldoRestante:valorRec,
            vencimento:_addPeriodo(vencimento,freqRec,r-1),
            data_inicial:vencimento,
            data_pagamento:null,
            status:'pendente',
            recorrente:true,
            recorrenciaId:serieId,
            contaOriginalId:serieId,
            createdAt:new Date().toISOString(),
            updatedAt:new Date().toISOString()
          })));
        }
        return Promise.all(opsRec);
      }
      if(parcelada&&!_editingId){
        var n=_parseNum((document.getElementById('cp-num-parcelas')||{}).value);
        var total=valor;
        var primeira=(document.getElementById('cp-venc')||{}).value||obj.vencimento;
        var freq=(document.getElementById('cp-freq-parcelas')||{}).value||'mensal';
        if(n<2||!total||!primeira){ UI.toast('Preencha os dados do parcelamento','error'); throw new Error('parcelamento inválido'); }
        var parcelamentoId='parcelamento-'+Date.now();
        var valorParcela=+(total/n).toFixed(2);
        var ops=[];
        for(var i=1;i<=n;i++){
          var valorAtual=i===n?+(total-(valorParcela*(n-1))).toFixed(2):valorParcela;
          ops.push(DB.add('contas_pagar',Object.assign({},obj,{
            descricao:desc+' ('+i+'/'+n+')',
            valor:valorAtual,
            valorTotalOriginal:total,
            valorParcela:valorAtual,
            valorPago:0,
            saldoRestante:valorAtual,
            vencimento:_addPeriodo(primeira,freq,i-1),
            data_pagamento:null,
            status:'pendente',
            parcelada:true,
            parcelaNumero:i,
            numeroParcelas:n,
            valorTotal:total,
            parcelamentoId:parcelamentoId,
            contaOriginalId:parcelamentoId
          })));
        }
        return Promise.all(ops);
      }
      if(status==='pago') obj.data_pagamento=dataPagamento;
      return _editingId?DB.update('contas_pagar',_editingId,obj):DB.add('contas_pagar',Object.assign({},obj,{
        status:status,
        data_pagamento:status==='pago'?dataPagamento:null
      }));
    }).then(function(){
      UI.toast('Saída salva!','success');
      if(window._cpModal) window._cpModal.close();
      _loadContasPagar();
    }).catch(function(e){ UI.toast('Erro: '+e.message,'error'); });
  }

  function _pagarCP(id) {
    var cp=_contasPagar.find(function(x){ return x.id===id; });
    if(!cp) return;
    var info=_cpValorInfo(cp);
    var pago=info.valorPago;
    var pendente=info.saldoRestante;
    var movExistente=_cpMovPagamento(cp);
    var contaPreSel=cp.conta_id||cp.contaId||cp.conta_bancaria_id||cp.contaBancariaId||(movExistente&&movExistente.conta_id)||'';
    var contasAtivas=(_contasBancarias||[]).filter(function(c){ return c.ativo!==false; });
    if(!contaPreSel&&contasAtivas.length===1) contaPreSel=contasAtivas[0].id;
    var contaOpts='<option value="">Selecionar conta...</option>'+contasAtivas.map(function(c){ return '<option value="'+c.id+'"'+(contaPreSel===c.id?' selected':'')+'>'+_esc(c.nome)+'</option>'; }).join('');
    var body='<div>'+
      '<div style="margin-bottom:12px;font-size:13px;color:#8A7E7C;">Saldo pendente: <strong style="color:#DC2626;">'+_fmtVal(pendente)+'</strong></div>'+
      '<div style="'+_g3()+'">'+
        '<div><label style="'+_lbl()+'">Valor pago *</label><input id="cp-pay-valor" type="text" value="'+_esc(pendente)+'" style="'+_inp()+'"></div>'+
        '<div><label style="'+_lbl()+'">Data do pagamento *</label><input id="cp-pay-data" type="date" value="'+_today()+'" style="'+_inp()+'"></div>'+
        '<div><label style="'+_lbl()+'">Conta de saída *</label><select id="cp-pay-conta" style="'+_inp()+'background:#fff;">'+contaOpts+'</select></div>'+
      '</div>'+
    '</div>';
    var footer='<button onclick="Modules.Financeiro._savePagamentoCP(\''+id+'\')" style="width:100%;padding:13px;border-radius:11px;border:none;background:#16A34A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Confirmar saída</button>';
    window._cpPayModal=UI.modal({title:'Confirmar saída',body:body,footer:footer,maxWidth:'560px'});
  }

  function _savePagamentoCP(id) {
    var cp=_contasPagar.find(function(x){ return x.id===id; });
    if(!cp) return;
    var valorPago=_parseNum((document.getElementById('cp-pay-valor')||{}).value);
    var data=(document.getElementById('cp-pay-data')||{}).value||'';
    var contaId=(document.getElementById('cp-pay-conta')||{}).value||'';
    var info=_cpValorInfo(cp);
    var jaPago=info.valorPago;
    var pendente=info.saldoRestante;
    if(!valorPago||valorPago<=0){ UI.toast('Informe o valor pago','error'); return; }
    if(!data){ UI.toast('Informe a data do pagamento','error'); return; }
    if(!contaId){ UI.toast('Informe a conta bancária usada','error'); return; }
    if(valorPago>pendente) valorPago=pendente;
    var totalPago=jaPago+valorPago;
    var parcial=totalPago<info.valorTotalOriginal;
    var mov={
      tipo:'saida',
      descricao:'Pagamento: '+(cp.descricao||'Saída'),
      valor:valorPago,
      valorTotalOriginal:valorPago,
      valorParcela:valorPago,
      valorPago:valorPago,
      saldoRestante:0,
      data:data,
      categoria:cp.categoria||'',
      conta_id:contaId,
      status:'efetivado',
      origem:'conta_a_pagar',
      contaPagarId:id,
      pessoaTipo:cp.fornecedorId||cp.fornecedorNome||cp.fornecedor?'fornecedor':'nenhum',
      pessoaId:cp.fornecedorId||'',
      pessoaNome:cp.fornecedorNome||cp.fornecedor||'',
      updatedAt:new Date().toISOString()
    };
    DB.add('movimentacoes',mov).then(function(){
      var upd={valorPago:totalPago,valor_pago_total:totalPago,saldoRestante:Math.max(0,info.valorTotalOriginal-totalPago),saldo_restante:Math.max(0,info.valorTotalOriginal-totalPago),ultimo_pagamento:data,status:parcial?'parcial':'pago',updatedAt:new Date().toISOString()};
      if(!parcial) upd.data_pagamento=data;
      return DB.update('contas_pagar',id,upd);
    }).then(function(){
      if(window._cpPayModal) window._cpPayModal.close();
      if(parcial){
        UI.confirm('Esta saída não foi paga integralmente. Deseja gerar uma nova parcela com o saldo restante?').then(function(yes){
          if(yes) _openSaldoRestanteModal(id,Math.max(0,_parseNum(cp.valor)-totalPago));
          else { UI.toast('Saída parcial registrada','success'); _loadContasPagar(); }
        });
      } else {
        UI.toast('Saída confirmada e movimentação gerada','success');
        _loadContasPagar();
      }
    }).catch(function(e){ UI.toast('Erro: '+e.message,'error'); });
  }

  function _openSaldoRestanteModal(id,saldo) {
    window._cpSaldoRestante={id:id,saldo:saldo};
    var body='<div><div style="font-size:13px;color:#8A7E7C;margin-bottom:12px;">Saldo restante da saída: <strong style="color:#DC2626;">'+_fmtVal(saldo)+'</strong></div>'+
      '<div style="margin-bottom:12px;"><label style="'+_lbl()+'">Como programar o saldo?</label><select id="cp-rest-modo" onchange="Modules.Financeiro._toggleSaldoRestanteModo()" style="'+_inp()+'background:#fff;">'+
        '<option value="unico">Pagar de uma vez</option><option value="parcelar">Parcelar saldo</option>'+
      '</select></div>'+
      '<div id="cp-rest-unico"><label style="'+_lbl()+'">Novo vencimento *</label><input id="cp-rest-venc" type="date" value="'+_today()+'" style="'+_inp()+'"></div>'+
      '<div id="cp-rest-parcelar" style="display:none;grid-template-columns:1fr 1fr 1fr;gap:10px;">'+
        '<div><label style="'+_lbl()+'">Parcelas *</label><input id="cp-rest-parcelas" type="number" min="2" value="2" style="'+_inp()+'"></div>'+
        '<div><label style="'+_lbl()+'">Primeiro vencimento *</label><input id="cp-rest-primeiro" type="date" value="'+_today()+'" style="'+_inp()+'"></div>'+
        '<div><label style="'+_lbl()+'">Frequência</label><select id="cp-rest-freq" style="'+_inp()+'background:#fff;"><option value="mensal">Mensal</option><option value="semanal">Semanal</option></select></div>'+
      '</div></div>';
    var footer='<button onclick="Modules.Financeiro._criarSaldoRestanteCP()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Programar saldo restante</button>';
    window._cpRestModal=UI.modal({title:'Saldo restante da saída',body:body,footer:footer,maxWidth:'560px'});
  }

  function _toggleSaldoRestanteModo() {
    var modo=(document.getElementById('cp-rest-modo')||{}).value||'unico';
    var unico=document.getElementById('cp-rest-unico');
    var parcelar=document.getElementById('cp-rest-parcelar');
    if(unico) unico.style.display=modo==='unico'?'block':'none';
    if(parcelar) parcelar.style.display=modo==='parcelar'?'grid':'none';
  }

  function _criarSaldoRestanteCP() {
    var data=window._cpSaldoRestante||{};
    var cp=_contasPagar.find(function(x){ return x.id===data.id; });
    var modo=(document.getElementById('cp-rest-modo')||{}).value||'unico';
    if(!cp){ UI.toast('Conta original não encontrada','error'); return; }
    var base={
      data_pagamento:null,
      status:'pendente',
      valor_pago_total:0,
      valorPago:0,
      saldoRestante:data.saldo,
      valorTotalOriginal:data.saldo,
      valorParcela:data.saldo,
      contaOriginalId:cp.contaOriginalId||cp.parcelamentoId||cp.id,
      parcelaOrigemId:cp.id,
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString()
    };
    var op;
    if(modo==='parcelar'){
      var n=_parseNum((document.getElementById('cp-rest-parcelas')||{}).value);
      var primeira=(document.getElementById('cp-rest-primeiro')||{}).value||'';
      var freq=(document.getElementById('cp-rest-freq')||{}).value||'mensal';
      if(n<2||!primeira){ UI.toast('Informe parcelas e primeiro vencimento','error'); return; }
      var parcelamentoId='saldo-restante-'+Date.now();
      var valorParcela=+(data.saldo/n).toFixed(2);
      var ops=[];
      for(var i=1;i<=n;i++){
        ops.push(DB.add('contas_pagar',Object.assign({},cp,base,{
          descricao:(cp.descricao||'Saída')+' - saldo restante ('+i+'/'+n+')',
          valor:i===n?+(data.saldo-(valorParcela*(n-1))).toFixed(2):valorParcela,
          valorTotalOriginal:data.saldo,
          valorParcela:i===n?+(data.saldo-(valorParcela*(n-1))).toFixed(2):valorParcela,
          valorPago:0,
          saldoRestante:i===n?+(data.saldo-(valorParcela*(n-1))).toFixed(2):valorParcela,
          vencimento:_addPeriodo(primeira,freq,i-1),
          parcelada:true,
          parcelaNumero:i,
          numeroParcelas:n,
          valorTotal:data.saldo,
          parcelamentoId:parcelamentoId
        })));
      }
      op=Promise.all(ops);
    } else {
      var venc=(document.getElementById('cp-rest-venc')||{}).value||'';
      if(!venc){ UI.toast('Informe o novo vencimento','error'); return; }
      op=DB.add('contas_pagar',Object.assign({},cp,base,{
        descricao:(cp.descricao||'Saída')+' - saldo restante',
        valor:data.saldo,
        valorTotalOriginal:data.saldo,
        valorParcela:data.saldo,
        valorPago:0,
        saldoRestante:data.saldo,
        vencimento:venc
      }));
    }
    op.then(function(){
      if(window._cpRestModal) window._cpRestModal.close();
      UI.toast('Saldo restante programado','success');
      _loadContasPagar();
    }).catch(function(e){ UI.toast('Erro: '+e.message,'error'); });
  }

  function _deleteCP(id) {
        UI.confirm('Eliminar esta saída?').then(function(yes){
      if(!yes) return;
      DB.remove('contas_pagar',id).then(function(){ UI.toast('Eliminado','info'); _loadContasPagar(); });
    });
  }

  // ── CONTAS BANCÁRIAS ──────────────────────────────────────────────────────
  function _loadContasBancarias() {
    Promise.all([DB.getAll('contas_bancarias'),_loadMovimentacoesData()]).then(function(r){
      _contasBancarias=r[0]||[]; _movimentacoes=r[1]||[];
      _paintContasBancarias();
    });
  }

  function _paintContasBancarias() {
    var content=document.getElementById('fin-content'); if(!content) return;
    var st=_saldoTotal();
    content.innerHTML=
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">'+
        '<div><h2 style="font-size:18px;font-weight:800;margin-bottom:4px;">Contas Bancárias</h2>'+
          '<p style="font-size:12px;color:#8A7E7C;">Saldo total: <strong style="color:'+(st>=0?'#16A34A':'#DC2626')+';">'+_fmtVal(st)+'</strong></p></div>'+
        '<button onclick="Modules.Financeiro._openContaModal(null)" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Nova Conta</button>'+
      '</div>'+
      (_contasBancarias.length===0
        ?'<div style="text-align:center;padding:60px 20px;color:#8A7E7C;"><div style="font-size:14px;font-weight:600;">Nenhuma conta bancária</div><div style="font-size:12px;margin-top:6px;">Adicione as suas contas para acompanhar o saldo.</div></div>'
        :'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;">'+
          _contasBancarias.map(function(c){
            var saldo=_saldoConta(c);
            var ent=_movimentacoes.filter(function(m){ return m.conta_id===c.id&&m.tipo==='entrada'&&m.status==='efetivado'; }).reduce(function(s,m){ return s+_parseNum(m.valor); },0);
            var sai=_movimentacoes.filter(function(m){ return m.conta_id===c.id&&m.tipo==='saida'  &&m.status==='efetivado'; }).reduce(function(s,m){ return s+_parseNum(m.valor); },0);
            return '<div style="background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.06);'+(c.ativo===false?'opacity:.55;':'')+'">'+
              '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;">'+
                '<div><div style="font-size:16px;font-weight:800;">'+_esc(c.nome)+'</div>'+
                  '<div style="font-size:12px;color:#8A7E7C;">'+_esc(c.banco||'')+(c.tipo?' · '+_esc(c.tipo):'')+'</div></div>'+
                '<div style="display:flex;gap:6px;">'+
                  '<button onclick="Modules.Financeiro._openContaModal(\''+c.id+'\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;"><span class="mi" style="font-size:13px;">edit</span></button>'+
                  '<button onclick="Modules.Financeiro._deleteConta(\''+c.id+'\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;"><span class="mi" style="font-size:13px;">delete</span></button>'+
                '</div>'+
              '</div>'+
              '<div style="font-size:28px;font-weight:800;color:'+(saldo>=0?'#16A34A':'#DC2626')+';margin-bottom:12px;">'+_fmtVal(saldo)+'</div>'+
              '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">'+
                '<div style="background:#F8F6F5;border-radius:8px;padding:8px 10px;"><div style="font-size:10px;color:#8A7E7C;font-weight:700;">Inicial</div><div style="font-size:13px;font-weight:700;">'+_fmtVal(c.saldo_inicial)+'</div></div>'+
                '<div style="background:#F0FFF4;border-radius:8px;padding:8px 10px;"><div style="font-size:10px;color:#16A34A;font-weight:700;">Entradas</div><div style="font-size:13px;font-weight:700;color:#16A34A;">+'+_fmtVal(ent)+'</div></div>'+
                '<div style="background:#FFF5F5;border-radius:8px;padding:8px 10px;"><div style="font-size:10px;color:#DC2626;font-weight:700;">Saídas</div><div style="font-size:13px;font-weight:700;color:#DC2626;">−'+_fmtVal(sai)+'</div></div>'+
              '</div>'+
            '</div>';
          }).join('')+'</div>');
  }

  function _openContaModal(id) {
    _editingId=id;
    var c=id?(_contasBancarias.find(function(x){ return x.id===id; })||{}):{};
    var tOpts=TIPOS_CONTA.map(function(t){ return '<option value="'+t+'"'+((c.tipo||TIPOS_CONTA[0])===t?' selected':'')+'>'+t+'</option>'; }).join('');
    var body=
      '<div>'+
        '<div style="margin-bottom:12px;"><label style="'+_lbl()+'">Nome da conta *</label><input id="cb-nome" type="text" value="'+_esc(c.nome||'')+'" placeholder="Ex: Conta Principal, Caixa..." style="'+_inp()+'"></div>'+
        '<div style="'+_g2()+'">'+
          '<div><label style="'+_lbl()+'">Banco / Instituição</label><input id="cb-banco" type="text" value="'+_esc(c.banco||'')+'" placeholder="Ex: CGD, Millennium..." style="'+_inp()+'"></div>'+
          '<div><label style="'+_lbl()+'">Tipo</label><select id="cb-tipo" style="'+_inp()+'background:#fff;">'+tOpts+'</select></div>'+
        '</div>'+
        '<div style="'+_g2()+'">'+
          '<div><label style="'+_lbl()+'">Saldo inicial (€)</label><input id="cb-saldo" type="text" value="'+_esc(c.saldo_inicial!=null?c.saldo_inicial:'')+'" placeholder="0,00" style="'+_inp()+'"></div>'+
          '<div style="display:flex;align-items:flex-end;padding-bottom:3px;"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:600;"><input type="checkbox" id="cb-ativo"'+(c.ativo!==false?' checked':'')+' style="width:15px;height:15px;cursor:pointer;"> Conta ativa</label></div>'+
        '</div>'+
      '</div>';
    var footer='<button onclick="Modules.Financeiro._saveConta()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">'+(id?'Atualizar':'Salvar')+'</button>';
    window._contaModal=UI.modal({title:id?'Editar Conta':'Nova Conta Bancária',body:body,footer:footer,maxWidth:'460px'});
  }

  function _saveConta() {
    var nome=((document.getElementById('cb-nome')||{}).value||'').trim();
    if(!nome){ UI.toast('Nome obrigatório','error'); return; }
    var obj={
      nome:nome,
      banco:(document.getElementById('cb-banco')||{}).value||'',
      tipo:(document.getElementById('cb-tipo')||{}).value||TIPOS_CONTA[0],
      saldo_inicial:_parseNum((document.getElementById('cb-saldo')||{}).value),
      ativo:!!(document.getElementById('cb-ativo')||{}).checked,
      updatedAt:new Date().toISOString()
    };
    if(!_editingId) obj.createdAt=new Date().toISOString();
    (_editingId?DB.update('contas_bancarias',_editingId,obj):DB.add('contas_bancarias',obj)).then(function(){
      UI.toast('Saída salva!','success');
      if(window._contaModal) window._contaModal.close();
      _loadContasBancarias();
    }).catch(function(e){ UI.toast('Erro: '+e.message,'error'); });
  }

  function _deleteConta(id) {
    var relacionadosMov=(_movimentacoes||[]).filter(function(m){ return m.conta_id===id; }).length;
    var relacionadosCP=(_contasPagar||[]).filter(function(cp){ return cp.conta_id===id || cp.contaId===id || cp.conta_bancaria_id===id || cp.contaBancariaId===id; }).length;
    var totalRelacionados=relacionadosMov+relacionadosCP;
    if(totalRelacionados>0){
      UI.toast('Não é possível excluir: esta conta possui '+totalRelacionados+' lançamento(s) associado(s).','error');
      return;
    }
    UI.confirm('Eliminar esta conta? Movimentações associadas não serão apagadas.').then(function(yes){
      if(!yes) return;
      DB.remove('contas_bancarias',id).then(function(){ UI.toast('Eliminado','info'); _loadContasBancarias(); });
    });
  }

  // ── COMPRAS ───────────────────────────────────────────────────────────────
  var UNID_MAP = { g: ['g','Kg'], ml: ['ml','L'] };

  function _toBase(qty, purchaseUnit, baseUnit) {
    if (purchaseUnit==='Kg' && baseUnit==='g')  return qty * 1000;
    if (purchaseUnit==='L'  && baseUnit==='ml') return qty * 1000;
    return qty;
  }
  function _custoPorBase(unitPrice, purchaseUnit, baseUnit) {
    // ex: €4/Kg → €0.004/g
    if (purchaseUnit==='Kg' && baseUnit==='g')  return unitPrice / 1000;
    if (purchaseUnit==='L'  && baseUnit==='ml') return unitPrice / 1000;
    return unitPrice;
  }

  function _loadCompras() {
    Promise.all([DB.getAll('compras'), DB.getAll('fornecedores'), DB.getAll('itens_custo')]).then(function(r){
      _compras=r[0]||[]; _fornecedores=r[1]||[]; _itensCusto=r[2]||[];
      _paintCompras();
    });
  }

  function _paintCompras() {
    var content=document.getElementById('fin-content'); if(!content) return;
    var sorted=_compras.slice().sort(function(a,b){ return (b.data||'').localeCompare(a.data||''); });
    var totalGasto=_compras.reduce(function(s,c){ return s+_parseNum(c.total); },0);
    content.innerHTML=
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">'+
        '<div><h2 style="font-size:18px;font-weight:800;margin-bottom:4px;">Compras</h2>'+
          '<p style="font-size:12px;color:#8A7E7C;">Total gasto: <strong style="color:#DC2626;">'+_fmtVal(totalGasto)+'</strong> em '+_compras.length+' compra(s)</p></div>'+
        '<button onclick="Modules.Financeiro._openCompraModal(null)" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Registar Compra</button>'+
      '</div>'+
      (sorted.length===0
        ?'<div style="text-align:center;padding:60px 20px;color:#8A7E7C;"><div style="font-size:14px;font-weight:600;">Nenhuma compra registada</div><div style="font-size:12px;margin-top:6px;">Ao registar uma compra, o custo atual dos insumos é atualizado automaticamente.</div></div>'
        :'<div style="background:#fff;border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,.06);overflow:hidden;">'+
            '<table style="width:100%;border-collapse:collapse;">'+
              '<thead><tr style="background:#F8F6F5;">'+
                '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Data</th>'+
                '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Fornecedor</th>'+
                '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Itens</th>'+
                '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Nº Doc.</th>'+
                '<th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Total</th>'+
                '<th style="padding:10px 6px;"></th>'+
              '</tr></thead><tbody>'+
              sorted.map(function(c){
                var forn=_fornecedores.find(function(f){ return f.id===c.fornecedorId; });
                var nItens=(c.items||[]).length;
                return '<tr style="border-top:1px solid #F2EDED;" onmouseover="this.style.background=\'#FAFAF9\'" onmouseout="this.style.background=\'\'">'+
                  '<td style="padding:10px 14px;font-size:13px;color:#6B7280;">'+_esc(c.data||'—')+'</td>'+
                  '<td style="padding:10px 14px;font-size:13px;font-weight:600;">'+_esc(forn?(forn.nome||forn.name||''):'—')+'</td>'+
                  '<td style="padding:10px 14px;font-size:12px;color:#8A7E7C;">'+nItens+' insumo'+(nItens!==1?'s':'')+'</td>'+
                  '<td style="padding:10px 14px;font-size:12px;color:#8A7E7C;">'+_esc(c.numDoc||'—')+'</td>'+
                  '<td style="padding:10px 14px;text-align:right;font-size:14px;font-weight:800;color:#DC2626;">'+_fmtVal(c.total)+'</td>'+
                  '<td style="padding:10px 6px;text-align:right;white-space:nowrap;">'+
                    '<button onclick="Modules.Financeiro._openCompraModal(\''+c.id+'\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;margin-right:4px;"><span class="mi" style="font-size:13px;">edit</span></button>'+
                    '<button onclick="Modules.Financeiro._deleteCompra(\''+c.id+'\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;"><span class="mi" style="font-size:13px;">delete</span></button>'+
                  '</td></tr>';
              }).join('')+'</tbody></table></div>');
  }

  function _openCompraModal(id) {
    _editingId=id;
    var c=id?(_compras.find(function(x){ return x.id===id; })||{}):{};
    window._compraItemCount=0;
    var fornOpts='<option value="">Sem fornecedor</option>'+_fornecedores.map(function(f){ return '<option value="'+f.id+'"'+(c.fornecedorId===f.id?' selected':'')+'>'+_esc(f.nome||f.name||'')+'</option>'; }).join('');
    // build insumo options string once
    window._compraInsOpts='<option value="">Selecionar insumo...</option>'+_itensCusto.filter(function(i){ return i.ativo!==false&&i.classe!=='produto'; }).map(function(i){ return '<option value="'+i.id+'" data-base="'+_esc(i.unidade_base||'un')+'">'+_esc(i.nome)+'</option>'; }).join('');
    var itemsHtml=(c.items||[]).map(function(item){
      var idx=window._compraItemCount++;
      return _renderCompraLinha(idx,item);
    }).join('');

    var body=
      '<div>'+
        '<div style="'+_g3()+'">'+
          '<div><label style="'+_lbl()+'">Data *</label><input id="cp2-data" type="date" value="'+_esc(c.data||_today())+'" style="'+_inp()+'"></div>'+
          '<div><label style="'+_lbl()+'">Fornecedor</label><select id="cp2-forn" style="'+_inp()+'background:#fff;">'+fornOpts+'</select></div>'+
          '<div><label style="'+_lbl()+'">Nº Documento</label><input id="cp2-numdoc" type="text" value="'+_esc(c.numDoc||'')+'" placeholder="Fatura, recibo..." style="'+_inp()+'"></div>'+
        '</div>'+
        '<div style="overflow-x:auto;margin-bottom:8px;">'+
          '<table style="width:100%;border-collapse:collapse;min-width:560px;">'+
            '<thead><tr style="background:#F8F6F5;">'+
              '<th style="padding:7px 10px;font-size:10px;font-weight:800;color:#8A7E7C;text-transform:uppercase;text-align:left;min-width:180px;">Insumo</th>'+
              '<th style="padding:7px 10px;font-size:10px;font-weight:800;color:#8A7E7C;text-transform:uppercase;text-align:left;width:80px;">Qtd</th>'+
              '<th style="padding:7px 10px;font-size:10px;font-weight:800;color:#8A7E7C;text-transform:uppercase;text-align:left;width:70px;">Unidade</th>'+
              '<th style="padding:7px 10px;font-size:10px;font-weight:800;color:#8A7E7C;text-transform:uppercase;text-align:left;width:100px;">Preço/unidade</th>'+
              '<th style="padding:7px 10px;font-size:10px;font-weight:800;color:#8A7E7C;text-transform:uppercase;text-align:left;width:80px;">Total</th>'+
              '<th style="padding:7px 6px;width:30px;"></th>'+
            '</tr></thead>'+
            '<tbody id="cp2-items">'+itemsHtml+'</tbody>'+
          '</table>'+
        '</div>'+
        '<button type="button" onclick="Modules.Financeiro._addCompraLinha()" style="width:100%;padding:9px;border-radius:9px;border:1.5px dashed #D4C8C6;background:transparent;font-size:13px;font-weight:600;cursor:pointer;color:#8A7E7C;font-family:inherit;margin-bottom:12px;">+ Adicionar item</button>'+
        '<div style="'+_g2()+'">'+
          '<div><label style="'+_lbl()+'">Observações</label><textarea id="cp2-obs" placeholder="Opcional..." style="'+_inp()+'min-height:50px;resize:vertical;">'+_esc(c.observacoes||'')+'</textarea></div>'+
          '<div style="background:#F8F6F5;border-radius:10px;padding:12px;display:flex;flex-direction:column;justify-content:center;">'+
            '<div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Total da compra</div>'+
            '<div id="cp2-total-display" style="font-size:22px;font-weight:800;color:#DC2626;">€ 0,00</div>'+
          '</div>'+
        '</div>'+
        '<div style="background:#EFF6FF;border-radius:10px;padding:10px;font-size:12px;color:#1D4ED8;">'+
          'Ao salvar, o <strong>custo atual</strong> de cada insumo será atualizado automaticamente com o preço por unidade base.'+
        '</div>'+
      '</div>';
    var footer='<button onclick="Modules.Financeiro._saveCompra()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">'+(id?'Atualizar Compra':'Registar Compra')+'</button>';
    window._compraModal=UI.modal({title:id?'Editar Compra':'Nova Compra',body:body,footer:footer,maxWidth:'700px'});
    setTimeout(function(){ _calcCompraTotal(); },60);
  }

  function _renderCompraLinha(idx, item) {
    item=item||{};
    var ins=item.insumoId?_itensCusto.find(function(i){ return i.id===item.insumoId; }):null;
    var baseUnit=ins?(ins.unidade_base||'un'):'un';
    var unidOpts=_getUnidOpts(baseUnit,item.unit||baseUnit);
    var opts=(window._compraInsOpts||'').replace('value="'+item.insumoId+'"','value="'+item.insumoId+'" selected');
    return '<tr id="cp2-row-'+idx+'" style="border-top:1px solid #F2EDED;">'+
      '<td style="padding:5px 8px;"><select data-cp2-ins="'+idx+'" onchange="Modules.Financeiro._onCompraInsChange('+idx+')" style="width:100%;padding:6px 8px;border:1.5px solid #D4C8C6;border-radius:8px;font-size:12px;font-family:inherit;outline:none;">'+opts+'</select></td>'+
      '<td style="padding:5px 8px;"><input type="text" data-cp2-qty="'+idx+'" value="'+_esc(item.qty||'')+'" placeholder="0" oninput="Modules.Financeiro._calcCompraLinha('+idx+')" style="width:70px;padding:6px 8px;border:1.5px solid #D4C8C6;border-radius:8px;font-size:12px;font-family:inherit;outline:none;"></td>'+
      '<td style="padding:5px 8px;"><select data-cp2-unit="'+idx+'" onchange="Modules.Financeiro._calcCompraLinha('+idx+')" style="width:70px;padding:6px 8px;border:1.5px solid #D4C8C6;border-radius:8px;font-size:12px;font-family:inherit;outline:none;background:#fff;">'+unidOpts+'</select></td>'+
      '<td style="padding:5px 8px;"><input type="text" data-cp2-price="'+idx+'" value="'+_esc(item.unitPrice||'')+'" placeholder="0,00" oninput="Modules.Financeiro._calcCompraLinha('+idx+')" style="width:90px;padding:6px 8px;border:1.5px solid #D4C8C6;border-radius:8px;font-size:12px;font-family:inherit;outline:none;"></td>'+
      '<td id="cp2-linetotal-'+idx+'" style="padding:5px 8px;font-size:12px;font-weight:700;color:#DC2626;white-space:nowrap;">—</td>'+
      '<td style="padding:5px 6px;"><button type="button" onclick="Modules.Financeiro._removeCompraLinha('+idx+')" style="width:24px;height:24px;border-radius:6px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;font-size:11px;">✕</button></td>'+
    '</tr>';
  }

  function _getUnidOpts(baseUnit, selectedUnit) {
    var opts=UNID_MAP[baseUnit]||[baseUnit==='unidade'?'un':baseUnit];
    return opts.map(function(u){ return '<option value="'+u+'"'+(selectedUnit===u?' selected':'')+'>'+u+'</option>'; }).join('');
  }

  function _onCompraInsChange(idx) {
    var sel=document.querySelector('[data-cp2-ins="'+idx+'"]'); if(!sel) return;
    var opt=sel.options[sel.selectedIndex];
    var baseUnit=(opt&&opt.dataset.base)||'un';
    var unitSel=document.querySelector('[data-cp2-unit="'+idx+'"]');
    if(unitSel) unitSel.innerHTML=_getUnidOpts(baseUnit,baseUnit);
    _calcCompraLinha(idx);
  }

  function _calcCompraLinha(idx) {
    var qty=_parseNum((document.querySelector('[data-cp2-qty="'+idx+'"]')||{}).value);
    var price=_parseNum((document.querySelector('[data-cp2-price="'+idx+'"]')||{}).value);
    var total=qty*price;
    var el=document.getElementById('cp2-linetotal-'+idx);
    if(el) el.textContent=total>0?_fmtVal(total):'—';
    _calcCompraTotal();
  }

  function _calcCompraTotal() {
    var total=0;
    document.querySelectorAll('[data-cp2-qty]').forEach(function(el){
      var idx=el.dataset.cp2Qty;
      var qty=_parseNum(el.value);
      var price=_parseNum((document.querySelector('[data-cp2-price="'+idx+'"]')||{}).value);
      total+=qty*price;
    });
    var disp=document.getElementById('cp2-total-display');
    if(disp) disp.textContent=_fmtVal(total);
  }

  function _addCompraLinha() {
    var tbody=document.getElementById('cp2-items'); if(!tbody) return;
    var idx=window._compraItemCount||0;
    window._compraItemCount=idx+1;
    tbody.insertAdjacentHTML('beforeend',_renderCompraLinha(idx,{}));
  }

  function _removeCompraLinha(idx) {
    var el=document.getElementById('cp2-row-'+idx); if(el) el.remove();
    _calcCompraTotal();
  }

  function _saveCompra() {
    var data=(document.getElementById('cp2-data')||{}).value||_today();
    var fornecedorId=(document.getElementById('cp2-forn')||{}).value||'';
    var numDoc=((document.getElementById('cp2-numdoc')||{}).value||'').trim();
    var obs=((document.getElementById('cp2-obs')||{}).value||'').trim();
    var items=[]; var total=0;
    document.querySelectorAll('[data-cp2-ins]').forEach(function(sel){
      var idx=sel.dataset.cp2Ins;
      var insumoId=sel.value; if(!insumoId) return;
      var qty=_parseNum((document.querySelector('[data-cp2-qty="'+idx+'"]')||{}).value);
      if(qty<=0) return;
      var unit=(document.querySelector('[data-cp2-unit="'+idx+'"]')||{}).value||'';
      var unitPrice=_parseNum((document.querySelector('[data-cp2-price="'+idx+'"]')||{}).value);
      var ins=_itensCusto.find(function(i){ return i.id===insumoId; });
      var baseUnit=ins?(ins.unidade_base||'un'):'un';
      var custoBase=_custoPorBase(unitPrice,unit,baseUnit);
      var linTotal=qty*unitPrice;
      total+=linTotal;
      items.push({insumoId:insumoId,supplyName:ins?ins.nome:'',qty:qty,unit:unit,baseUnit:baseUnit,unitPrice:unitPrice,custoBase:custoBase,total:linTotal});
    });
    if(items.length===0){ UI.toast('Adicione pelo menos 1 item','error'); return; }
    var obj={data:data,fornecedorId:fornecedorId,numDoc:numDoc,observacoes:obs,items:items,total:total,updatedAt:new Date().toISOString()};
    if(!_editingId) obj.createdAt=new Date().toISOString();
    var compraId=_editingId;
    (_editingId?DB.update('compras',_editingId,obj):DB.add('compras',obj)).then(function(ref){
      var cid=compraId||(ref&&ref.id)||'';
      // Atualizar custo_atual em cada insumo
      var updates=items.map(function(item){
        var upd={custo_atual:item.custoBase,ultima_compra_data:data,ultima_compra_id:cid,updatedAt:new Date().toISOString()};
        if(fornecedorId) upd.fornecedor_padrao_id=fornecedorId;
        return DB.update('itens_custo',item.insumoId,upd);
      });
      return Promise.all(updates);
    }).then(function(){
      UI.toast('Compra registada e custos atualizados!','success');
      if(window._compraModal) window._compraModal.close();
      _loadCompras();
    }).catch(function(e){ UI.toast('Erro: '+e.message,'error'); });
  }

  function _deleteCompra(id) {
    UI.confirm('Eliminar esta compra? Os custos dos insumos NÃO serão revertidos.').then(function(yes){
      if(!yes) return;
      DB.remove('compras',id).then(function(){ UI.toast('Eliminado','info'); _loadCompras(); });
    });
  }

  // ── CONFIGURAÇÕES ─────────────────────────────────────────────────────────
  var _cfgSub='categorias';

  function _loadConfiguracoes() {
    Promise.all([DB.getAll('financeiro_categorias'),DB.getDocRoot('config','financeiro'),DB.getDocRoot('config','geral'),DB.getDocRoot('config','custos'),DB.getAll('contas_bancarias'),_loadMovimentacoesData(),DB.getAll('compras')]).then(function(r){
      _categorias=r[0]||[]; _configFin=r[1]||{}; _configGeral=r[2]||{}; window._configCustos=r[3]||{}; _contasBancarias=r[4]||[]; _movimentacoes=r[5]||[]; _compras=r[6]||[];
      if(_cfgSub==='fornecedores') _cfgSub='categorias';
      _paintConfiguracoes();
    });
  }

  function _paintConfiguracoes() {
    var content=document.getElementById('fin-content'); if(!content) return;
    var subs=[
      {key:'categorias',    label:'Categorias'},
      {key:'contas-bancarias', label:'Contas Bancárias'},
      {key:'formas-pag',   label:'Formas de Pagamento'},
      {key:'custos-ind',   label:'Custos Indiretos'}
    ];
    var sbSt=function(k){ var a=_cfgSub===k; return 'padding:8px 16px;border-radius:20px;border:1.5px solid '+(a?'#C4362A':'#D4C8C6')+';background:'+(a?'#C4362A':'#fff')+';color:'+(a?'#fff':'#8A7E7C')+';font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;'; };
    var tabs='<div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">'+subs.map(function(s){ return '<button onclick="Modules.Financeiro._setCfgSub(\''+s.key+'\')" style="'+sbSt(s.key)+'">'+s.label+'</button>'; }).join('')+'</div>';
    var inner='';
    if(_cfgSub==='categorias')   inner=_paintCfgCats();
    if(_cfgSub==='contas-bancarias') inner=_paintCfgContasBancarias();
    if(_cfgSub==='formas-pag')  inner=_paintCfgFormas();
    if(_cfgSub==='custos-ind')  inner=_paintCfgCustos();
    content.innerHTML='<h2 style="font-size:18px;font-weight:800;margin-bottom:16px;">Configurações Financeiras</h2>'+tabs+inner;
  }

  function _setCfgSub(k){ _cfgSub=k; _paintConfiguracoes(); }

  function _paintCfgCats() {
    var rg=function(lista,tipo){
      return '<div style="background:#fff;border-radius:14px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,.06);min-width:0;">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">'+
          '<h3 style="font-size:14px;font-weight:800;">'+(tipo==='entrada'?'↑ Receitas (Entradas)':'↓ Despesas (Saídas)')+'</h3>'+
          '<button onclick="Modules.Financeiro._openCatModal(null,\''+tipo+'\')" style="background:'+(tipo==='entrada'?'#16A34A':'#DC2626')+';color:#fff;border:none;padding:7px 14px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">+ Adicionar</button>'+
        '</div>'+
        (lista.length===0?'<p style="color:#8A7E7C;font-size:13px;text-align:center;padding:16px 0;">Nenhuma categoria</p>':
          '<div style="display:flex;flex-direction:column;gap:8px;">'+
          lista.map(function(c){ return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid #F2EDED;border-radius:10px;background:#FAFAF9;">'+
            '<div style="min-width:0;"><div style="font-size:13px;font-weight:700;color:#1F2937;">'+_esc(c.nome)+'</div><div style="font-size:11px;color:#8A7E7C;">'+(tipo==='entrada'?'Receita':'Despesa')+'</div></div>'+
            '<div style="display:flex;gap:6px;flex-shrink:0;">'+
              '<button onclick="Modules.Financeiro._openCatModal(\''+c.id+'\',\''+tipo+'\')" style="padding:7px 10px;border-radius:8px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;">Editar</button>'+
              '<button onclick="Modules.Financeiro._deleteCat(\''+c.id+'\')" style="padding:7px 10px;border-radius:8px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;">Excluir</button>'+
            '</div></div>'; }).join('')+
          '</div>')+
      '</div>';
    };
    return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;align-items:start;">'+
      rg((_categorias||[]).filter(function(c){ return c.tipo==='entrada'; }),'entrada')+
      rg((_categorias||[]).filter(function(c){ return c.tipo==='saida';   }),'saida')+
    '</div>';
  }

  function _paintCfgContasBancarias() {
    var contas=(_contasBancarias||[]).slice().sort(function(a,b){ return (a.nome||'').localeCompare(b.nome||''); });
    return '<div style="background:#fff;border-radius:14px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,.06);">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">'+
        '<div><h3 style="font-size:14px;font-weight:800;">Contas Bancárias</h3><p style="font-size:12px;color:#8A7E7C;">Lista editável das contas usadas no financeiro.</p></div>'+
        '<button onclick="Modules.Financeiro._openContaModal(null)" style="background:#C4362A;color:#fff;border:none;padding:7px 14px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">+ Adicionar</button>'+
      '</div>'+
      (contas.length===0
        ? '<p style="color:#8A7E7C;font-size:13px;text-align:center;padding:16px 0;">Nenhuma conta bancária cadastrada</p>'
        : '<div style="display:flex;flex-direction:column;gap:8px;">'+contas.map(function(c){
            var saldo=_saldoConta(c);
            return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid #F2EDED;border-radius:10px;background:#FAFAF9;">'+
              '<div style="min-width:0;">'+
                '<div style="font-size:13px;font-weight:700;color:#1F2937;">'+_esc(c.nome)+'</div>'+
                '<div style="font-size:11px;color:#8A7E7C;">'+_esc(c.banco||'')+(c.tipo?' · '+_esc(c.tipo):'')+' · Saldo '+_fmtVal(saldo)+'</div>'+
              '</div>'+
              '<div style="display:flex;gap:6px;flex-shrink:0;">'+
                '<button onclick="Modules.Financeiro._openContaModal(\''+c.id+'\')" style="padding:7px 10px;border-radius:8px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;">Editar</button>'+
                '<button onclick="Modules.Financeiro._deleteConta(\''+c.id+'\')" style="padding:7px 10px;border-radius:8px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;">Excluir</button>'+
              '</div>'+
            '</div>';
          }).join('')+'</div>')+
    '</div>';
  }

  function _openCatModal(id,tipoPreset) {
    _editingId=id;
    var c=id?((_categorias||[]).find(function(x){ return x.id===id; })||{}):{};
    var tipo=c.tipo||tipoPreset||'entrada';
    var body='<div>'+
      '<div style="margin-bottom:12px;"><label style="'+_lbl()+'">Nome *</label><input id="cat-nome" type="text" value="'+_esc(c.nome||'')+'" placeholder="Ex: Vendas, Aluguer, Matéria-prima..." style="'+_inp()+'"></div>'+
      '<div><label style="'+_lbl()+'">Tipo</label><select id="cat-tipo" style="'+_inp()+'background:#fff;">'+
        '<option value="entrada"'+(tipo==='entrada'?' selected':'')+'>Receita (entrada)</option>'+
        '<option value="saida"'+(tipo==='saida'?' selected':'')+'>Despesa (saída)</option>'+
      '</select></div></div>';
    var footer='<button onclick="Modules.Financeiro._saveCat()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Salvar</button>';
    window._catModal=UI.modal({title:'Nova Categoria',body:body,footer:footer,maxWidth:'360px'});
  }

  function _saveCat() {
    var nome=((document.getElementById('cat-nome')||{}).value||'').trim();
    if(!nome){ UI.toast('Nome obrigatório','error'); return; }
    var obj={nome:nome,tipo:(document.getElementById('cat-tipo')||{}).value||'entrada'};
    (_editingId?DB.update('financeiro_categorias',_editingId,obj):DB.add('financeiro_categorias',obj)).then(function(){
      UI.toast('Categoria salva!','success');
      if(window._catModal) window._catModal.close();
      _loadConfiguracoes();
    }).catch(function(e){ UI.toast('Erro: '+e.message,'error'); });
  }

  function _deleteCat(id) {
    UI.confirm('Eliminar esta categoria?').then(function(yes){
      if(!yes) return;
      DB.remove('financeiro_categorias',id).then(function(){ UI.toast('Eliminado','info'); _loadConfiguracoes(); });
    });
  }

  // Fornecedores
  var TIPOS_FORN = ['Supermercado','Distribuidor','Atacado','Online','Outro'];

  function _paintCfgFornecedores() {
    var tipoColors={'Supermercado':'#16A34A','Distribuidor':'#3B82F6','Atacado':'#D97706','Online':'#7C3AED','Outro':'#6B7280'};
    return '<div style="background:#fff;border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,.06);overflow:hidden;">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #F2EDED;">'+
        '<h3 style="font-size:14px;font-weight:800;">Fornecedores</h3>'+
        '<button onclick="Modules.Financeiro._openFornModal(null)" style="background:#C4362A;color:#fff;border:none;padding:7px 14px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">+ Adicionar</button>'+
      '</div>'+
      (_fornecedores.length===0
        ?'<p style="text-align:center;color:#8A7E7C;padding:30px;font-size:13px;">Nenhum fornecedor cadastrado</p>'
        :'<table style="width:100%;border-collapse:collapse;">'+
            '<thead><tr style="background:#F8F6F5;">'+
              '<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Nome</th>'+
              '<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Tipo</th>'+
              '<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Email</th>'+
              '<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Endereço</th>'+
              '<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Estado</th>'+
              '<th style="padding:9px 6px;"></th>'+
            '</tr></thead><tbody>'+
            _fornecedores.map(function(f){
              var col=tipoColors[f.tipo]||'#6B7280';
              var tipoBadge=f.tipo?'<span style="background:'+col+'22;color:'+col+';padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;">'+_esc(f.tipo)+'</span>':'—';
              var estadoBadge=f.ativo!==false?'<span style="background:#DCFCE7;color:#16A34A;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;">Ativo</span>':'<span style="background:#F3F4F6;color:#6B7280;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;">Inativo</span>';
              return '<tr style="border-top:1px solid #F2EDED;" onmouseover="this.style.background=\'#FAFAF9\'" onmouseout="this.style.background=\'\'">'+
                '<td style="padding:10px 14px;font-size:13px;font-weight:700;">'+_esc(f.nome||f.name||'—')+'</td>'+
                '<td style="padding:10px 14px;">'+tipoBadge+'</td>'+
                '<td style="padding:10px 14px;font-size:12px;color:#8A7E7C;">'+_esc(f.email||'—')+'</td>'+
                '<td style="padding:10px 14px;font-size:12px;color:#8A7E7C;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+_esc(f.endereco||'—')+'</td>'+
                '<td style="padding:10px 14px;">'+estadoBadge+'</td>'+
                '<td style="padding:10px 6px;text-align:right;white-space:nowrap;">'+
                  '<button onclick="Modules.Financeiro._openFornModal(\''+f.id+'\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;margin-right:4px;"><span class="mi" style="font-size:13px;">edit</span></button>'+
                  '<button onclick="Modules.Financeiro._deleteForn(\''+f.id+'\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;"><span class="mi" style="font-size:13px;">delete</span></button>'+
                '</td></tr>';
            }).join('')+'</tbody></table>')+
    '</div>';
  }

  function _openFornModal(id) {
    _editingId=id;
    var f=id?(_fornecedores.find(function(x){ return x.id===id; })||{}):{};
    var tipoOpts=TIPOS_FORN.map(function(t){ return '<option value="'+t+'"'+((f.tipo||'')===t?' selected':'')+'>'+t+'</option>'; }).join('');
    var body=
      '<div>'+
        '<div style="margin-bottom:12px;"><label style="'+_lbl()+'">Nome *</label><input id="forn-nome" type="text" value="'+_esc(f.nome||f.name||'')+'" placeholder="Nome do fornecedor..." style="'+_inp()+'"></div>'+
        '<div style="'+_g2()+'">'+
          '<div><label style="'+_lbl()+'">Tipo</label><select id="forn-tipo" style="'+_inp()+'background:#fff;"><option value="">Selecionar...</option>'+tipoOpts+'</select></div>'+
          '<div><label style="'+_lbl()+'">Email</label><input id="forn-email" type="email" value="'+_esc(f.email||'')+'" placeholder="email@fornecedor.com" style="'+_inp()+'"></div>'+
        '</div>'+
        '<div style="margin-bottom:12px;"><label style="'+_lbl()+'">Endereço</label><input id="forn-end" type="text" value="'+_esc(f.endereco||'')+'" placeholder="Morada completa..." style="'+_inp()+'"></div>'+
        '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:600;"><input type="checkbox" id="forn-ativo"'+(f.ativo!==false?' checked':'')+' style="width:15px;height:15px;cursor:pointer;"> Fornecedor ativo</label>'+
      '</div>';
    var footer='<button onclick="Modules.Financeiro._saveForn()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">'+(id?'Atualizar':'Salvar')+'</button>';
    window._fornModal=UI.modal({title:id?'Editar Fornecedor':'Novo Fornecedor',body:body,footer:footer,maxWidth:'480px'});
  }

  function _saveForn() {
    var nome=((document.getElementById('forn-nome')||{}).value||'').trim();
    if(!nome){ UI.toast('Nome obrigatório','error'); return; }
    var obj={
      nome:nome, name:nome, // compatibilidade com compras.js que usa .name
      tipo:(document.getElementById('forn-tipo')||{}).value||'',
      email:(document.getElementById('forn-email')||{}).value||'',
      endereco:(document.getElementById('forn-end')||{}).value||'',
      ativo:!!(document.getElementById('forn-ativo')||{}).checked,
      updatedAt:new Date().toISOString()
    };
    if(!_editingId) obj.createdAt=new Date().toISOString();
    (_editingId?DB.update('fornecedores',_editingId,obj):DB.add('fornecedores',obj)).then(function(){
      UI.toast('Fornecedor salvo!','success');
      if(window._fornModal) window._fornModal.close();
      _loadConfiguracoes();
    }).catch(function(e){ UI.toast('Erro: '+e.message,'error'); });
  }

  function _deleteForn(id) {
    UI.confirm('Eliminar este fornecedor?').then(function(yes){
      if(!yes) return;
      DB.remove('fornecedores',id).then(function(){ UI.toast('Eliminado','info'); _loadConfiguracoes(); });
    });
  }

  function _paintCfgFormas() {
    var formas=_formasPag();
    return '<div style="background:#fff;border-radius:14px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,.06);">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">'+
        '<div><h3 style="font-size:14px;font-weight:800;">Formas de Pagamento</h3><p style="font-size:12px;color:#8A7E7C;">Lista editável das formas usadas no financeiro.</p></div>'+
        '<button onclick="Modules.Financeiro._openFormaPagModal(null)" style="background:#C4362A;color:#fff;border:none;padding:7px 14px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">+ Adicionar</button>'+
      '</div>'+
      (formas.length===0
        ? '<p style="color:#8A7E7C;font-size:13px;text-align:center;padding:16px 0;">Nenhuma forma de pagamento cadastrada</p>'
        : '<div style="display:flex;flex-direction:column;gap:8px;">'+formas.map(function(f,i){
            var def=FORMAS_PAG_DEFAULT.indexOf(f)>=0;
            return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid #F2EDED;border-radius:10px;background:#FAFAF9;">'+
              '<div style="min-width:0;">'+
                '<div style="font-size:13px;font-weight:700;color:#1F2937;">'+_esc(f)+'</div>'+
                '<div style="font-size:11px;color:#8A7E7C;">'+(def?'Padrão':'Personalizada')+'</div>'+
              '</div>'+
              '<div style="display:flex;gap:6px;flex-shrink:0;">'+
                '<button onclick="Modules.Financeiro._openFormaPagModal('+i+')" style="padding:7px 10px;border-radius:8px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;">Editar</button>'+
                (!def?'<button onclick="Modules.Financeiro._removeFormaPag('+i+')" style="padding:7px 10px;border-radius:8px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;">Excluir</button>':'')+
              '</div>'+
            '</div>';
          }).join('')+'</div>')+
    '</div>';
  }

  function _openFormaPagModal(idx) {
    var formas=_formasPag();
    var valor=idx!=null ? (formas[idx] || '') : '';
    window._formaPagEditIdx = (idx!=null ? idx : null);
    var body='<div><div style="margin-bottom:12px;"><label style="'+_lbl()+'">Nome *</label><input id="forma-pag-nome" type="text" value="'+_esc(valor)+'" placeholder="Ex: MB Way" style="'+_inp()+'"></div></div>';
    var footer='<button onclick="Modules.Financeiro._saveFormaPag()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">'+(idx!=null?'Atualizar':'Salvar')+'</button>';
    window._formaPagModal=UI.modal({title:idx!=null?'Editar Forma de Pagamento':'Nova Forma de Pagamento',body:body,footer:footer,maxWidth:'380px'});
  }

  function _saveFormaPag() {
    var nome=((document.getElementById('forma-pag-nome')||{}).value||'').trim();
    if(!nome){ UI.toast('Nome obrigatório','error'); return; }
    var atual=_formasPag().slice();
    var idx=window._formaPagEditIdx;
    var lower=nome.toLowerCase();
    if(idx==null){
      if(atual.some(function(v){ return String(v).toLowerCase()===lower; })){ UI.toast('Já existe','error'); return; }
      atual.push(nome);
    } else {
      if(atual.some(function(v,i){ return i!==idx && String(v).toLowerCase()===lower; })){ UI.toast('Já existe','error'); return; }
      atual[idx]=nome;
    }
    DB.update('config','financeiro',{formas_pagamento:atual}).then(function(){
      _configFin.formas_pagamento=atual;
      UI.toast('Forma de pagamento salva!','success');
      if(window._formaPagModal) window._formaPagModal.close();
      _paintConfiguracoes();
    }).catch(function(e){ UI.toast('Erro: '+e.message,'error'); });
  }

  function _addFormaPag() {
    var v=((document.getElementById('cfg-nova-forma')||{}).value||'').trim();
    if(!v){ UI.toast('Digite o nome','error'); return; }
    var atual=_formasPag().slice();
    if(atual.indexOf(v)>=0){ UI.toast('Já existe','error'); return; }
    atual.push(v);
    DB.update('config','financeiro',{formas_pagamento:atual}).then(function(){ _configFin.formas_pagamento=atual; UI.toast('Adicionado!','success'); _paintConfiguracoes(); });
  }

  function _removeFormaPag(idx) {
    var atual=_formasPag().slice(); atual.splice(idx,1);
    DB.update('config','financeiro',{formas_pagamento:atual}).then(function(){ _configFin.formas_pagamento=atual; UI.toast('Removido','info'); _paintConfiguracoes(); });
  }

  function _paintCfgCustos() {
    var g=_configGeral||{};
    var cc=window._configCustos||{};
    var mode=g.indirectCostMode||g.custosIndiretosModo||'manual';
    var pct=g.indirectCostPercent!=null?g.indirectCostPercent:(g.percentualCustosIndiretos!=null?g.percentualCustosIndiretos:(cc.defaultIndirectCostPercent!=null?cc.defaultIndirectCostPercent:''));
    var months=String(g.indirectCostMonths||g.custosIndiretosMeses||6);
    var manualVisible = mode !== 'automatico';
    var autoVisible = mode === 'automatico';
    return '<div style="background:#fff;border-radius:14px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,.06);">'+
      '<div style="margin-bottom:14px;">'+
        '<h3 style="font-size:14px;font-weight:800;margin-bottom:6px;">Custos indiretos do negócio</h3>'+
        '<p style="font-size:12px;color:#8A7E7C;line-height:1.5;margin:0;">Defina como o sistema calcula seus custos indiretos para estimar lucro e preço dos produtos.</p>'+
        '<div style="margin-top:8px;font-size:12px;font-weight:600;color:#374151;">Impacta diretamente no cálculo de lucro dos produtos.</div>'+
      '</div>'+
      '<div style="display:flex;flex-direction:column;gap:14px;">'+
        '<div style="background:#FAFAF9;border:1px solid #F2EDED;border-radius:12px;padding:14px 14px 16px;">'+
          '<div style="font-size:11px;font-weight:800;color:#8A7E7C;text-transform:uppercase;margin-bottom:10px;">Decisão principal</div>'+
          '<div style="font-size:14px;font-weight:700;color:#1F2937;margin-bottom:8px;">Como deseja calcular os custos indiretos?</div>'+
          '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:8px;"><input type="radio" name="cfg-ind-mode-radio" value="automatico" '+(mode==='automatico'?'checked':'')+' onchange="Modules.Financeiro._setCfgIndirectMode(this.value)" style="accent-color:#C4362A;"> Automático (com base no histórico)</label>'+
          '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;cursor:pointer;"><input type="radio" name="cfg-ind-mode-radio" value="manual" '+(mode!=='automatico'?'checked':'')+' onchange="Modules.Financeiro._setCfgIndirectMode(this.value)" style="accent-color:#C4362A;"> Manual (definir percentual)</label>'+
        '</div>'+
        '<div style="background:#fff;border:1px solid #EDE7E4;border-radius:12px;padding:14px 14px 16px;">'+
          '<div style="font-size:11px;font-weight:800;color:#8A7E7C;text-transform:uppercase;margin-bottom:10px;">Configuração dinâmica</div>'+
          '<div id="cfg-ind-manual-box" style="display:'+(manualVisible?'block':'none')+';margin-bottom:12px;">'+
            '<label style="'+_lbl()+'">Percentual de custos indiretos</label>'+
            '<div style="display:flex;align-items:center;gap:8px;max-width:280px;">'+
              '<input id="cfg-ind-pct" type="text" value="'+_esc(pct)+'" placeholder="Ex: 15" style="'+_inp()+'max-width:120px;border-color:#F59E0B;background:#FFFDF7;">'+
              '<span style="font-size:18px;font-weight:700;color:#374151;">%</span>'+
            '</div>'+
            '<div style="font-size:11px;color:#8A7E7C;margin-top:4px;">Ex: aluguel, luz, internet, etc.</div>'+
          '</div>'+
          '<div id="cfg-ind-auto-box" style="display:'+(autoVisible?'block':'none')+';">'+
            '<label style="'+_lbl()+'">Período para cálculo automático</label><select id="cfg-ind-months" style="'+_inp()+'background:#fff;max-width:220px;">'+
              '<option value="3"'+(months==='3'?' selected':'')+'>3 meses</option>'+
              '<option value="6"'+(months==='6'?' selected':'')+'>6 meses</option>'+
              '<option value="12"'+(months==='12'?' selected':'')+'>12 meses</option>'+
            '</select>'+
            '<div style="font-size:11px;color:#8A7E7C;margin-top:4px;">O sistema vai usar o histórico para estimar o percentual.</div>'+
          '</div>'+
        '</div>'+
        '<div style="background:#F8F6F5;border:1px solid #EDE7E4;border-radius:12px;padding:14px 14px 16px;">'+
          '<div style="font-size:11px;font-weight:800;color:#8A7E7C;text-transform:uppercase;margin-bottom:10px;">Exemplo de impacto</div>'+
          '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;font-size:12px;color:#374151;">'+
            '<div>Produto: <strong>'+_fmtVal(10)+'</strong></div>'+
            '<div>Custo direto: <strong>'+_fmtVal(4)+'</strong></div>'+
            '<div>Custo indireto: <strong>'+_fmtVal(1)+'</strong></div>'+
            '<div>Lucro: <strong>'+_fmtVal(5)+'</strong></div>'+
          '</div>'+
        '</div>'+
        '<div style="display:flex;justify-content:flex-end;">'+
          '<button onclick="Modules.Financeiro._saveCustosInd()" style="padding:11px 22px;border-radius:10px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 8px 18px rgba(196,54,42,.15);">Salvar</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  }

  function _setCfgIndirectMode(mode) {
    var manual=document.getElementById('cfg-ind-manual-box');
    var auto=document.getElementById('cfg-ind-auto-box');
    if(manual) manual.style.display=mode==='automatico'?'none':'block';
    if(auto) auto.style.display=mode==='automatico'?'block':'none';
  }

  function _saveCustosInd() {
    var pct=parseFloat(((document.getElementById('cfg-ind-pct')||{}).value||'').replace(',','.'))||0;
    var mode=(document.getElementById('cfg-ind-mode')||{}).value||'manual';
    var months=parseInt((document.getElementById('cfg-ind-months')||{}).value,10)||6;
    var geral=Object.assign({}, _configGeral || {}, {
      indirectCostMode: mode,
      indirectCostPercent: pct,
      indirectCostMonths: months,
      custosIndiretosModo: mode,
      percentualCustosIndiretos: pct,
      custosIndiretosMeses: months
    });
    Promise.all([
      DB.update('config','geral',geral),
      DB.update('config','custos',{defaultIndirectCostPercent:pct})
    ]).then(function(){
      _configGeral=geral;
      if(window._configCustos) window._configCustos.defaultIndirectCostPercent=pct;
      UI.toast('Custos indiretos salvos!','success');
    }).catch(function(e){ UI.toast('Erro: '+e.message,'error'); });
  }

  function destroy() {}

  return {
    render:render, destroy:destroy, _switchSub:_switchSub,
    _setFluxoFiltro:_setFluxoFiltro, _toggleFluxoOrdem:_toggleFluxoOrdem,
    _openMovModal:_openMovModal, _setMovTipo:_setMovTipo, _selectMovStatus:_selectMovStatus, _toggleMovNovaCat:_toggleMovNovaCat, _toggleMovRecorrente:_toggleMovRecorrente, _toggleMovParcelado:_toggleMovParcelado, _calcMovParcela:_calcMovParcela, _renderMovPreviews:_renderMovPreviews,
    _toggleMovNovaPessoa:_toggleMovNovaPessoa, _saveMov:_saveMov, _deleteMov:_deleteMov, _setMovFiltro:_setMovFiltro, _toggleMovConta:_toggleMovConta, _toggleMovOrdem:_toggleMovOrdem,
    _toggleMovSelecionada:_toggleMovSelecionada, _toggleMovTodas:_toggleMovTodas, _openMovDetalheModal:_openMovDetalheModal, _closeMovDetalhe:_closeMovDetalhe, _openEfetivarEntradasModal:_openEfetivarEntradasModal, _saveEfetivarEntradas:_saveEfetivarEntradas, _marcarEntradaParcial:_marcarEntradaParcial, _gerarNovaPrevisaoParcial:_gerarNovaPrevisaoParcial, _criarEntradaRestante:_criarEntradaRestante,
    _openCompraModal:_openCompraModal, _addCompraLinha:_addCompraLinha, _removeCompraLinha:_removeCompraLinha,
    _onCompraInsChange:_onCompraInsChange, _calcCompraLinha:_calcCompraLinha, _saveCompra:_saveCompra, _deleteCompra:_deleteCompra,
    _openCPModal:_openCPModal, _saveCP:_saveCP, _deleteCP:_deleteCP, _pagarCP:_pagarCP, _savePagamentoCP:_savePagamentoCP, _criarSaldoRestanteCP:_criarSaldoRestanteCP, _toggleSaldoRestanteModo:_toggleSaldoRestanteModo,
    _setCPFiltro:_setCPFiltro, _toggleCPConta:_toggleCPConta, _toggleCPStatus:_toggleCPStatus, _toggleCPOrdem:_toggleCPOrdem, _openContasVencidas:_openContasVencidas, _openCPDetalheModal:_openCPDetalheModal, _closeCPDetalhe:_closeCPDetalhe, _setCPStatus:_setCPStatus, _renderCPPreviews:_renderCPPreviews, _toggleCPRecorrente:_toggleCPRecorrente, _toggleCPParcelada:_toggleCPParcelada, _toggleCPNovoForn:_toggleCPNovoForn, _toggleCPNovaCat:_toggleCPNovaCat,
    _openContaModal:_openContaModal, _saveConta:_saveConta, _deleteConta:_deleteConta,
    _setCfgSub:_setCfgSub, _openCatModal:_openCatModal, _saveCat:_saveCat, _deleteCat:_deleteCat,
    _openFornModal:_openFornModal, _saveForn:_saveForn, _deleteForn:_deleteForn,
    _addFormaPag:_addFormaPag, _removeFormaPag:_removeFormaPag, _openFormaPagModal:_openFormaPagModal, _saveFormaPag:_saveFormaPag, _setCfgIndirectMode:_setCfgIndirectMode, _saveCustosInd:_saveCustosInd
  };
})();
