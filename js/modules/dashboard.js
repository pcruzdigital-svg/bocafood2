// js/modules/dashboard.js
window.Modules = window.Modules || {};
Modules.Dashboard = (function () {
  'use strict';

  var _unsubOrders = null;

  function render() {
    var app = document.getElementById('app');
    app.innerHTML = '<div id="dash-root" style="padding:24px;max-width:1200px;margin:0 auto;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">' +
      '<h1 style="font-family:\'League Spartan\',sans-serif;font-size:28px;font-weight:800;">Dashboard</h1>' +
      '<span id="dash-date" style="font-size:13px;color:#8A7E7C;"></span>' +
      '</div>' +
      '<div id="dash-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:24px;"></div>' +
      '<div id="dash-alerts" style="margin-bottom:24px;"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;" class="dash-grid-2">' +
      '<div id="dash-recent" style="background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.06);"></div>' +
      '<div id="dash-quick" style="background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.06);"></div>' +
      '</div>' +
      '<div id="dash-goal" style="background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.06);margin-bottom:24px;"></div>' +
      '</div>';

    // Date display
    var now = new Date();
    var days = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
    var months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    document.getElementById('dash-date').textContent = days[now.getDay()] + ', ' + now.getDate() + ' de ' + months[now.getMonth()] + ' de ' + now.getFullYear();

    _renderQuickActions();
    _loadData();
  }

  function _loadData() {
    var now = new Date();
    var startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    Promise.all([
      DB.getAll('financeiro_entradas'),
      DB.getAll('financeiro_saidas'),
      DB.getAll('orders'),
      DB.getAll('products'),
      DB.getAll('financeiro_apagar'),
      DB.getDocRoot('config', 'metas')
    ]).then(function (results) {
      var entradas = results[0] || [];
      var saidas = results[1] || [];
      var orders = results[2] || [];
      var products = results[3] || [];
      var apagar = results[4] || [];
      var metas = results[5] || {};

      // Filter to current month
      function inMonth(item) {
        var d = item.date ? new Date(item.date) : (item.createdAt && item.createdAt.toDate ? item.createdAt.toDate() : null);
        if (!d) return false;
        return d >= startOfMonth;
      }

      var monthEntradas = entradas.filter(inMonth);
      var monthSaidas = saidas.filter(inMonth);
      var monthOrders = orders.filter(inMonth);

      var totalReceitas = monthEntradas.reduce(function (s, e) { return s + (parseFloat(e.valor) || 0); }, 0);
      var totalDespesas = monthSaidas.reduce(function (s, e) { return s + (parseFloat(e.valor) || 0); }, 0);
      var lucro = totalReceitas - totalDespesas;
      var margem = totalReceitas > 0 ? (lucro / totalReceitas * 100) : 0;
      var totalPedidos = monthOrders.length;
      var avgTicket = totalPedidos > 0 ? totalReceitas / totalPedidos : 0;

      _renderKPIs(totalReceitas, totalDespesas, lucro, margem, totalPedidos, avgTicket);

      // Recent orders (last 5)
      var sorted = orders.slice().sort(function (a, b) {
        var ta = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : 0;
        var tb = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : 0;
        return tb - ta;
      }).slice(0, 5);
      _renderRecentOrders(sorted);

      // Low stock alerts
      var lowStock = products.filter(function (p) {
        return p.minStock && p.stock !== undefined && p.stock < p.minStock;
      });

      // Overdue payments
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      var overdue = apagar.filter(function (a) {
        if (a.status === 'Pago') return false;
        var due = new Date(a.dueDate);
        return due < today;
      });

      _renderAlerts(lowStock, overdue);
      _renderGoal(totalReceitas, metas);

    }).catch(function (err) {
      console.error('Dashboard load error', err);
    });
  }

  function _renderKPIs(receitas, despesas, lucro, margem, pedidos, avgTicket) {
    var kpis = [
      {
        icon: '💰', label: 'Total Receitas', value: UI.fmt(receitas),
        sub: 'Este mês', color: '#1A9E5A', bg: '#EDFAF3'
      },
      {
        icon: '📤', label: 'Total Despesas', value: UI.fmt(despesas),
        sub: 'Este mês', color: '#C4362A', bg: '#FFF0EE'
      },
      {
        icon: '📈', label: 'Lucro Líquido', value: UI.fmt(lucro),
        sub: 'Margem: ' + margem.toFixed(1) + '%',
        color: lucro >= 0 ? '#1A9E5A' : '#C4362A',
        bg: lucro >= 0 ? '#EDFAF3' : '#FFF0EE'
      },
      {
        icon: '📦', label: 'Total Pedidos', value: pedidos,
        sub: 'Ticket médio: ' + UI.fmt(avgTicket), color: '#2563EB', bg: '#EEF4FF'
      }
    ];

    document.getElementById('dash-kpis').innerHTML = kpis.map(function (k) {
      return '<div style="background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">' +
        '<span style="width:40px;height:40px;border-radius:10px;background:' + k.bg + ';display:flex;align-items:center;justify-content:center;font-size:18px;">' + k.icon + '</span>' +
        '<span style="font-size:13px;font-weight:600;color:#8A7E7C;">' + k.label + '</span>' +
        '</div>' +
        '<div style="font-family:\'League Spartan\',sans-serif;font-size:28px;font-weight:800;color:' + k.color + ';margin-bottom:4px;">' + k.value + '</div>' +
        '<div style="font-size:12px;color:#8A7E7C;">' + k.sub + '</div>' +
        '</div>';
    }).join('');
  }

  function _renderAlerts(lowStock, overdue) {
    var html = '';
    if (overdue.length > 0) {
      html += '<div style="background:#FFF0EE;border:1.5px solid #FECACA;border-radius:12px;padding:14px 16px;margin-bottom:10px;display:flex;align-items:center;gap:12px;">' +
        '<span style="font-size:20px;">⚠️</span>' +
        '<div><strong style="font-size:13px;color:#C4362A;">' + overdue.length + ' conta(s) a pagar vencida(s)</strong>' +
        '<div style="font-size:12px;color:#8A7E7C;margin-top:2px;">Total em atraso: ' + UI.fmt(overdue.reduce(function (s, a) { return s + (parseFloat(a.valor) || 0); }, 0)) + '</div></div>' +
        '<button onclick="Router.navigate(\'financeiro/apagar\')" style="margin-left:auto;padding:8px 14px;background:#C4362A;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">Ver</button>' +
        '</div>';
    }
    if (lowStock.length > 0) {
      html += '<div style="background:#FFF7ED;border:1.5px solid #FED7AA;border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:12px;">' +
        '<span style="font-size:20px;">📉</span>' +
        '<div><strong style="font-size:13px;color:#D97706;">' + lowStock.length + ' produto(s) com stock baixo</strong>' +
        '<div style="font-size:12px;color:#8A7E7C;margin-top:2px;">' + lowStock.map(function (p) { return p.name; }).join(', ') + '</div></div>' +
        '<button onclick="Router.navigate(\'catalogo/insumos\')" style="margin-left:auto;padding:8px 14px;background:#D97706;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">Ver</button>' +
        '</div>';
    }
    document.getElementById('dash-alerts').innerHTML = html;
  }

  function _renderRecentOrders(orders) {
    var el = document.getElementById('dash-recent');
    var STATUS_COLORS = {
      'Pendente': '#D97706', 'Confirmado': '#2563EB', 'Em preparação': '#7C3AED',
      'Em camino': '#0891B2', 'Listo para recoger': '#059669', 'Entregado': '#1A9E5A', 'Cancelado': '#C4362A'
    };
    el.innerHTML = '<h3 style="font-family:\'League Spartan\',sans-serif;font-size:16px;font-weight:800;margin-bottom:14px;">Pedidos Recentes</h3>' +
      (orders.length === 0 ? UI.emptyState('Nenhum pedido ainda', '📦') :
        orders.map(function (o) {
          var color = STATUS_COLORS[o.status] || '#8A7E7C';
          return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #F2EDED;">' +
            '<div style="flex:1;">' +
            '<div style="font-size:13px;font-weight:700;">' + (o.customerName || 'Cliente') + '</div>' +
            '<div style="font-size:11px;color:#8A7E7C;">' + UI.fmtDateTime(o.createdAt) + '</div>' +
            '</div>' +
            '<span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;background:' + color + '20;color:' + color + ';">' + (o.status || 'Pendente') + '</span>' +
            '<span style="font-family:\'League Spartan\',sans-serif;font-size:14px;font-weight:800;color:#C4362A;">' + UI.fmt(o.total || 0) + '</span>' +
            '</div>';
        }).join(''));
  }

  function _renderQuickActions() {
    var el = document.getElementById('dash-quick');
    var actions = [
      { label: '+ Nova Entrada', icon: '💰', route: 'financeiro/entradas', color: '#1A9E5A' },
      { label: '+ Novo Pedido', icon: '📦', route: 'pedidos', color: '#2563EB' },
      { label: '+ Novo Produto', icon: '🍽️', route: 'catalogo/produtos', color: '#C4362A' },
      { label: '+ Nova Saída', icon: '📤', route: 'financeiro/saidas', color: '#D97706' },
      { label: 'Ver Clientes', icon: '👥', route: 'clientes', color: '#7C3AED' },
      { label: 'Configurações', icon: '⚙️', route: 'configuracoes/geral', color: '#64748B' }
    ];
    el.innerHTML = '<h3 style="font-family:\'League Spartan\',sans-serif;font-size:16px;font-weight:800;margin-bottom:14px;">Ações Rápidas</h3>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
      actions.map(function (a) {
        return '<button onclick="Router.navigate(\'' + a.route + '\')" style="display:flex;align-items:center;gap:8px;padding:12px;background:' + a.color + '15;border:1.5px solid ' + a.color + '30;border-radius:10px;cursor:pointer;font-size:12px;font-weight:700;color:' + a.color + ';font-family:inherit;transition:all .15s;" onmouseover="this.style.background=\'' + a.color + '25\'" onmouseout="this.style.background=\'' + a.color + '15\'">' +
          a.icon + ' ' + a.label + '</button>';
      }).join('') + '</div>';
  }

  function _renderGoal(totalReceitas, metas) {
    var el = document.getElementById('dash-goal');
    var goal = parseFloat(metas && metas.revenueGoal) || 0;
    var pct = goal > 0 ? Math.min(100, (totalReceitas / goal * 100)) : 0;
    el.innerHTML = '<h3 style="font-family:\'League Spartan\',sans-serif;font-size:16px;font-weight:800;margin-bottom:14px;">Meta Mensal de Receita</h3>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
      '<span style="font-size:13px;color:#8A7E7C;">Progresso</span>' +
      '<span style="font-size:13px;font-weight:700;">' + UI.fmt(totalReceitas) + ' / ' + UI.fmt(goal) + '</span>' +
      '</div>' +
      '<div style="background:#F2EDED;border-radius:20px;height:12px;overflow:hidden;">' +
      '<div style="background:#C4362A;width:' + pct + '%;height:100%;border-radius:20px;transition:width .5s ease;"></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;margin-top:6px;">' +
      '<span style="font-size:12px;color:#8A7E7C;">' + pct.toFixed(1) + '% alcançado</span>' +
      '<button onclick="Router.navigate(\'crescimento/metas\')" style="font-size:11px;font-weight:700;color:#C4362A;background:none;border:none;cursor:pointer;font-family:inherit;">Definir meta →</button>' +
      '</div>';
  }

  function destroy() {
    if (_unsubOrders) { _unsubOrders(); _unsubOrders = null; }
  }

  return { render: render, destroy: destroy };
})();
