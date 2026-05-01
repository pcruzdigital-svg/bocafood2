// js/core/db.js
window.DB = (function () {
  'use strict';

  function _db() { return firebase.firestore(); }

  var SCHEMAS = {
    plano_voo: {
      version: 1,
      label: 'Plano de Voo',
      collections: {
        flight_plans: {
          label: 'Previsões salvas',
          purpose: 'Snapshots de simulação com períodos, cenários, canais, custos, despesas e resultados projetados.',
          fields: {
            id: 'string',
            name: 'string',
            periodType: 'monthly|annual',
            mode: 'historical|manual',
            annualMode: 'linear_growth|linear_decline|seasonality_manual',
            scenario: 'survival|equilibrium|growth|expansion',
            growthPct: 'number',
            declinePct: 'number',
            seasonality: 'array<number>',
            channels: 'array<object>',
            variableCosts: 'array<object>',
            fixedExpenses: 'array<object>',
            summary: 'object',
            periodStart: 'string',
            periodEnd: 'string',
            createdAt: 'timestamp',
            updatedAt: 'timestamp'
          }
        }
      }
    },
    pedidos: {
      version: 1,
      label: 'Pedidos',
      collections: {
        orders: {
          label: 'Pedidos',
          purpose: 'Cabeçalho do pedido com dados do cliente, itens, totais e status.',
          fields: {
            id: 'string',
            orderNumber: 'string',
            customerId: 'string|null',
            customerName: 'string',
            customerPhone: 'string',
            customerEmail: 'string',
            type: 'delivery|pickup|dine_in|takeaway',
            status: 'Pendente|Confirmado|Em preparação|Em camino|Listo para recoger|Entregado|Cancelado',
            paymentStatus: 'pendente|pago|parcial|reembolsado',
            subtotal: 'number',
            originalSubtotal: 'number',
            promoSubtotal: 'number',
            promoDiscountTotal: 'number',
            couponDiscountTotal: 'number',
            discountTotal: 'number',
            finalSubtotal: 'number',
            deliveryFee: 'number',
            total: 'number',
            itemCount: 'number',
            items: 'array<object>',
            address: 'string',
            postalCode: 'string',
            zone: 'string',
            slotKey: 'string',
            slotLabel: 'string',
            note: 'string',
            coupon: 'object|null',
            payment: 'string',
            pointsEarned: 'number',
            source: 'store|admin|whatsapp',
            channel: 'string',
            promoIds: 'array<string>',
            promoNames: 'array<string>',
            promoTypes: 'array<string>',
            promoSummary: 'object|null',
            upsellIds: 'array<string>',
            createdAt: 'timestamp',
            updatedAt: 'timestamp'
          }
        },
        order_items: {
          label: 'Itens do pedido',
          purpose: 'Linha detalhada de itens por pedido, útil para análise e relatórios futuros.',
          fields: {
            id: 'string',
            orderId: 'string',
            productId: 'string',
            productName: 'string',
            qty: 'number',
            originalUnitPrice: 'number',
            promoUnitPrice: 'number',
            price: 'number',
            discount: 'number',
            total: 'number',
            promoId: 'string|null',
            promoType: 'string|null',
            promoName: 'string|null',
            upsellId: 'string|null',
            createdAt: 'timestamp',
            updatedAt: 'timestamp'
          }
        },
        order_payments: {
          label: 'Pagamentos do pedido',
          purpose: 'Registro de pagamentos, confirmações e diferenças parciais.',
          fields: {
            id: 'string',
            orderId: 'string',
            method: 'string',
            amount: 'number',
            status: 'pendente|pago|parcial|falhou',
            reference: 'string',
            note: 'string',
            paidAt: 'timestamp|null',
            createdAt: 'timestamp',
            updatedAt: 'timestamp'
          }
        },
        order_events: {
          label: 'Eventos do pedido',
          purpose: 'Histórico simples de mudanças de status e ações no pedido.',
          fields: {
            id: 'string',
            orderId: 'string',
            type: 'created|status_changed|payment_added|note_added|cancelled',
            fromStatus: 'string|null',
            toStatus: 'string|null',
            actor: 'string|null',
            note: 'string',
            createdAt: 'timestamp'
          }
        },
        orderSlots: {
          label: 'Slots de entrega',
          purpose: 'Controle de capacidade por data e horário.',
          fields: {
            id: 'string',
            count: 'number',
            max: 'number',
            date: 'string',
            time: 'string',
            active: 'boolean',
            createdAt: 'timestamp',
            updatedAt: 'timestamp'
          }
        }
      }
    }
  };

  function _tenantPath(path) {
    const tid = Auth.getTenantId();
    if (!tid) throw new Error('No tenant ID — user not authenticated');
    return 'tenants/' + tid + '/' + path;
  }

  function col(path) {
    return _db().collection(_tenantPath(path));
  }

  function doc(colPath, id) {
    return _db().collection(_tenantPath(colPath)).doc(id);
  }

  function getAll(colPath) {
    return col(colPath).get().then(function (snap) {
      return snap.docs.map(function (d) { return Object.assign({}, d.data(), { id: d.id }); });
    });
  }

  function getDoc(colPath, id) {
    return doc(colPath, id).get().then(function (d) {
      if (!d.exists) return null;
      return Object.assign({}, d.data(), { id: d.id });
    });
  }

  function add(colPath, data) {
    var ts = firebase.firestore.FieldValue.serverTimestamp();
    return col(colPath).add(Object.assign({}, data, { createdAt: ts, updatedAt: ts }));
  }

  function set(colPath, id, data) {
    return doc(colPath, id).set(data);
  }

  function update(colPath, id, data) {
    var ts = firebase.firestore.FieldValue.serverTimestamp();
    return doc(colPath, id).update(Object.assign({}, data, { updatedAt: ts }));
  }

  function remove(colPath, id) {
    return doc(colPath, id).delete();
  }

  function listen(colPath, callback) {
    return col(colPath).onSnapshot(function (snap) {
      var docs = snap.docs.map(function (d) { return Object.assign({}, d.data(), { id: d.id }); });
      callback(docs);
    }, function (err) { console.error('DB.listen error', err); });
  }

  function listenQuery(colPath, field, op, value, callback) {
    return col(colPath).where(field, op, value).onSnapshot(function (snap) {
      var docs = snap.docs.map(function (d) { return Object.assign({}, d.data(), { id: d.id }); });
      callback(docs);
    }, function (err) { console.error('DB.listenQuery error', err); });
  }

  // Root-level doc reference (for config sub-docs)
  function docRoot(colPath, id) {
    const tid = Auth.getTenantId();
    if (!tid) throw new Error('No tenant ID');
    return _db().collection('tenants/' + tid + '/' + colPath).doc(id);
  }

  function getDocRoot(colPath, id) {
    return docRoot(colPath, id).get().then(function (d) {
      if (!d.exists) return null;
      return Object.assign({}, d.data(), { id: d.id });
    });
  }

  function setDocRoot(colPath, id, data) {
    return docRoot(colPath, id).set(data, { merge: true });
  }

  function getSchema(name) {
    return SCHEMAS[name] ? JSON.parse(JSON.stringify(SCHEMAS[name])) : null;
  }

  function ensureSchemaDoc(name) {
    var schema = getSchema(name);
    if (!schema) return Promise.resolve(null);
    return getDocRoot('config', name + '_schema').then(function (existing) {
      if (existing) return existing;
      return setDocRoot('config', name + '_schema', schema).then(function () { return schema; });
    }).catch(function (err) {
      console.error('DB.ensureSchemaDoc error', err);
      return schema;
    });
  }

  return { col, doc, getAll, getDoc, add, set, update, remove, listen, listenQuery, docRoot, getDocRoot, setDocRoot, getSchema, ensureSchemaDoc };
})();
