// js/modules/configuracoes.js
window.Modules = window.Modules || {};
Modules.Configuracoes = (function () {
  'use strict';

  var _activeSub = 'geral';
  var _config = {};
  var _unidades = [];
  var _editingUnidadeId = null;
  var _fornecedores = [];
  var _editingFornecedorId = null;

  var TABS = [
    { key: 'geral', label: 'Geral' },
    { key: 'produtos', label: 'Produtos' },
    { key: 'dominio', label: 'Domínio / URL' },
    { key: 'pagamentos', label: 'Pagamentos' },
    { key: 'endereco', label: 'Endereço' },
    { key: 'integracoes', label: 'Integrações' },
    { key: 'seo', label: 'SEO' },
    { key: 'template', label: 'Template da loja' }
  ];

  var CONFIG_TABS = ['geral', 'dominio', 'pagamentos', 'endereco', 'integracoes', 'seo', 'template'];

  var DEFAULT_UNIDADES = [
    { name: 'Quilograma', symbol: 'kg', type: 'massa' },
    { name: 'Grama', symbol: 'g', type: 'massa' },
    { name: 'Litro', symbol: 'L', type: 'volume' },
    { name: 'Mililitro', symbol: 'ml', type: 'volume' },
    { name: 'Unidade', symbol: 'un', type: 'unidade' },
    { name: 'Dúzia', symbol: 'dz', type: 'unidade' },
    { name: 'Pacote', symbol: 'pct', type: 'unidade' }
  ];

  function render(sub) {
    _activeSub = sub || 'geral';
    var app = document.getElementById('app');
    app.innerHTML = '<section class="module-page">' +
      '<div class="module-head"><div><h1>Configurações</h1><p>Dados públicos e preferências do negócio.</p></div></div>' +
      '<div id="config-tabs" class="module-tabs"></div>' +
      '<div id="config-content" class="module-content narrow"><div class="loading-inline">Carregando...</div></div>' +
      '</section>';
    _renderTabs();
    _load().then(function () { _renderSub(); });
  }

  function _renderTabs() {
    var el = document.getElementById('config-tabs');
    if (!el) return;
    el.innerHTML = TABS.map(function (t) {
      return '<button class="' + (t.key === _activeSub ? 'active' : '') + '" onclick="Modules.Configuracoes._switchSub(\'' + t.key + '\')">' + t.label + '</button>';
    }).join('');
  }

  function _switchSub(key) {
    _activeSub = key;
    _renderTabs();
    _renderSub();
    Router.navigate('configuracoes/' + key);
  }

  function _load() {
    return Promise.all(CONFIG_TABS.map(function (k) { return DB.getDocRoot('config', k); }))
      .then(function (docs) {
        _config = {};
        CONFIG_TABS.forEach(function (k, i) { _config[k] = docs[i] || {}; });
      })
      .catch(function (err) {
        console.error('Config load error', err);
        _config = {};
      });
  }

  function _renderSub() {
    if (_activeSub === 'geral') return _renderGeral();
    if (_activeSub === 'produtos') return _renderProdutos();
    if (_activeSub === 'dominio') return _renderDominio();
    if (_activeSub === 'pagamentos') return _renderPagamentos();
    if (_activeSub === 'endereco') return _renderEndereco();
    if (_activeSub === 'integracoes') return _renderIntegracoes();
    if (_activeSub === 'seo') return _renderSeo();
    if (_activeSub === 'template') return _renderTemplate();
  }

  function _field(id, label, value, placeholder, type) {
    return '<label class="field"><span>' + label + '</span><input id="' + id + '" type="' + (type || 'text') + '" value="' + _esc(value || '') + '" placeholder="' + (placeholder || '') + '"></label>';
  }

  function _textarea(id, label, value, placeholder) {
    return '<label class="field"><span>' + label + '</span><textarea id="' + id + '" placeholder="' + (placeholder || '') + '">' + _esc(value || '') + '</textarea></label>';
  }

  function _renderGeral() {
    var c = _config.geral || {};
    _paint('Geral', 'Identidade visual usada pelo site publicado e pelos pedidos.', [
      _field('cfg-business-name', 'Nome do negócio', c.businessName, 'Boca do Brasil'),
      _field('cfg-logo-url', 'Logo', c.logoUrl, 'https://...'),
      _field('cfg-favicon-url', 'Favicon', c.faviconUrl, 'https://...'),
      _field('cfg-primary-color', 'Cor principal', c.primaryColor || '#C4362A', '#C4362A'),
      _textarea('cfg-description', 'Descrição curta', c.description, 'Comida brasileira artesanal em Lisboa')
    ].join(''), function () {
      return {
        businessName: _val('cfg-business-name'),
        logoUrl: _val('cfg-logo-url'),
        faviconUrl: _val('cfg-favicon-url'),
        primaryColor: _val('cfg-primary-color') || '#C4362A',
        description: _val('cfg-description')
      };
    });
  }

  // Change L: Produtos tab with Unidades de Medida + Fornecedores
  function _renderProdutos() {
    var content = document.getElementById('config-content');
    if (!content) return;

    Promise.all([DB.getAll('unidades_medida'), DB.getAll('fornecedores')]).then(function (r) {
      _unidades = r[0] || [];
      _fornecedores = r[1] || [];

      // Pre-populate defaults if empty
      if (_unidades.length === 0) {
        var promises = DEFAULT_UNIDADES.map(function (u) { return DB.add('unidades_medida', u); });
        Promise.all(promises).then(function () {
          DB.getAll('unidades_medida').then(function (fresh) {
            _unidades = fresh || [];
            _paintProdutosCfg();
          });
        });
      } else {
        _paintProdutosCfg();
      }
    }).catch(function (err) {
      console.error('Produtos config load error', err);
      _unidades = [];
      _fornecedores = [];
      _paintProdutosCfg();
    });
  }

  function _paintProdutosCfg() {
    var content = document.getElementById('config-content');
    if (!content) return;

    var typeLabel = { massa: 'Massa', volume: 'Volume', unidade: 'Unidade' };

    content.innerHTML = '<div class="settings-card">' +
      '<div class="settings-card-head"><h2>Produtos</h2><p>Configurações relacionadas ao catálogo de produtos.</p></div>' +
      '<div style="margin-top:16px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">' +
      '<div>' +
      '<h3 style="font-size:15px;font-weight:700;margin-bottom:4px;">Unidades de Medida</h3>' +
      '<p style="font-size:12px;color:#8A7E7C;">Unidades usadas em insumos e fichas técnicas</p>' +
      '</div>' +
      '<button onclick="Modules.Configuracoes._openUnidadeModal(null)" style="background:#C4362A;color:#fff;border:none;padding:9px 16px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Adicionar</button>' +
      '</div>' +
      (_unidades.length === 0
        ? '<p style="text-align:center;padding:24px;color:#8A7E7C;font-size:13px;">Nenhuma unidade cadastrada.</p>'
        : '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
          '<thead><tr style="background:#F2EDED;">' +
          '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Nome</th>' +
          '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Símbolo</th>' +
          '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Tipo</th>' +
          '<th style="padding:11px 4px;text-align:right;"></th>' +
          '</tr></thead><tbody>' +
          _unidades.map(function (u) {
            return '<tr style="border-top:1px solid #F2EDED;">' +
              '<td style="padding:11px 14px;font-size:13px;font-weight:700;">' + _esc(u.name) + '</td>' +
              '<td style="padding:11px 14px;font-size:13px;">' + _esc(u.symbol) + '</td>' +
              '<td style="padding:11px 14px;font-size:13px;color:#8A7E7C;">' + (typeLabel[u.type] || u.type || '—') + '</td>' +
              '<td style="padding:11px 8px;text-align:right;">' +
              '<button onclick="Modules.Configuracoes._openUnidadeModal(\'' + u.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;margin-right:4px;font-size:13px;">✏</button>' +
              '<button onclick="Modules.Configuracoes._deleteUnidade(\'' + u.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;font-size:13px;">✕</button>' +
              '</td></tr>';
          }).join('') +
          '</tbody></table></div>') +
      '</div>' +

      // Fornecedores section
      '<div style="margin-top:28px;border-top:1px solid #F2EDED;padding-top:20px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">' +
      '<div>' +
      '<h3 style="font-size:15px;font-weight:700;margin-bottom:4px;">Fornecedores</h3>' +
      '<p style="font-size:12px;color:#8A7E7C;">Lista de fornecedores para produtos prontos e insumos</p>' +
      '</div>' +
      '<button onclick="Modules.Configuracoes._openFornecedorModal(null)" style="background:#C4362A;color:#fff;border:none;padding:9px 16px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Adicionar</button>' +
      '</div>' +
      (_fornecedores.length === 0
        ? '<p style="text-align:center;padding:24px;color:#8A7E7C;font-size:13px;">Nenhum fornecedor cadastrado.</p>'
        : '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
          '<thead><tr style="background:#F2EDED;">' +
          '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Nome</th>' +
          '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Contato</th>' +
          '<th style="padding:11px 4px;text-align:right;"></th>' +
          '</tr></thead><tbody>' +
          _fornecedores.map(function (f) {
            return '<tr style="border-top:1px solid #F2EDED;">' +
              '<td style="padding:11px 14px;font-size:13px;font-weight:700;">' + _esc(f.name) + '</td>' +
              '<td style="padding:11px 14px;font-size:13px;color:#8A7E7C;">' + _esc(f.contact || '—') + '</td>' +
              '<td style="padding:11px 8px;text-align:right;">' +
              '<button onclick="Modules.Configuracoes._openFornecedorModal(\'' + f.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;margin-right:4px;"><span class="mi" style="font-size:14px;">edit</span></button>' +
              '<button onclick="Modules.Configuracoes._deleteFornecedor(\'' + f.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;"><span class="mi" style="font-size:14px;">delete</span></button>' +
              '</td></tr>';
          }).join('') +
          '</tbody></table></div>') +
      '</div>' +

      '</div>';
  }

  function _openFornecedorModal(id) {
    _editingFornecedorId = id;
    var f = id ? (_fornecedores.find(function (x) { return x.id === id; }) || {}) : {};
    var body = '<div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Nome *</label>' +
      '<input id="forn-name" type="text" value="' + _esc(f.name || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Contato (telefone / email)</label>' +
      '<input id="forn-contact" type="text" value="' + _esc(f.contact || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Observações</label>' +
      '<textarea id="forn-notes" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;min-height:60px;resize:vertical;">' + _esc(f.notes || '') + '</textarea></div>' +
      '</div>';
    var footer = '<button onclick="Modules.Configuracoes._saveFornecedor()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">' + (id ? 'Atualizar' : 'Adicionar') + '</button>';
    window._fornecedorModal = UI.modal({ title: id ? 'Editar Fornecedor' : 'Novo Fornecedor', body: body, footer: footer });
  }

  function _saveFornecedor() {
    var name = ((document.getElementById('forn-name') || {}).value || '').trim();
    if (!name) { UI.toast('Nome obrigatorio', 'error'); return; }
    var data = {
      name: name,
      contact: (document.getElementById('forn-contact') || {}).value || '',
      notes: (document.getElementById('forn-notes') || {}).value || ''
    };
    var op = _editingFornecedorId
      ? DB.update('fornecedores', _editingFornecedorId, data)
      : DB.add('fornecedores', data);
    op.then(function () {
      UI.toast('Fornecedor salvo!', 'success');
      if (window._fornecedorModal) window._fornecedorModal.close();
      _renderProdutos();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _deleteFornecedor(id) {
    UI.confirm('Eliminar este fornecedor?').then(function (yes) {
      if (!yes) return;
      DB.remove('fornecedores', id).then(function () {
        UI.toast('Eliminado', 'info');
        _renderProdutos();
      });
    });
  }

  function _openUnidadeModal(id) {
    _editingUnidadeId = id;
    var u = id ? (_unidades.find(function (x) { return x.id === id; }) || {}) : {};
    var body = '<div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Nome *</label>' +
      '<input id="un-name" type="text" value="' + _esc(u.name || '') + '" placeholder="ex: Quilograma" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Símbolo *</label>' +
      '<input id="un-symbol" type="text" value="' + _esc(u.symbol || '') + '" placeholder="kg" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Tipo *</label>' +
      '<select id="un-type" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;">' +
      '<option value="massa"' + (u.type === 'massa' ? ' selected' : '') + '>Massa</option>' +
      '<option value="volume"' + (u.type === 'volume' ? ' selected' : '') + '>Volume</option>' +
      '<option value="unidade"' + (!u.type || u.type === 'unidade' ? ' selected' : '') + '>Unidade</option>' +
      '</select></div>' +
      '</div></div>';

    var footer = '<button onclick="Modules.Configuracoes._saveUnidade()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">' + (id ? 'Atualizar' : 'Adicionar') + '</button>';
    window._unidadeModal = UI.modal({ title: id ? 'Editar Unidade' : 'Nova Unidade de Medida', body: body, footer: footer });
  }

  function _saveUnidade() {
    var name = (document.getElementById('un-name') || {}).value || '';
    var symbol = (document.getElementById('un-symbol') || {}).value || '';
    if (!name || !symbol) { UI.toast('Nome e símbolo são obrigatórios', 'error'); return; }
    var data = {
      name: name,
      symbol: symbol,
      type: (document.getElementById('un-type') || {}).value || 'unidade'
    };
    var op = _editingUnidadeId
      ? DB.update('unidades_medida', _editingUnidadeId, data)
      : DB.add('unidades_medida', data);
    op.then(function () {
      UI.toast('Unidade salva!', 'success');
      if (window._unidadeModal) window._unidadeModal.close();
      _renderProdutos();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _deleteUnidade(id) {
    UI.confirm('Eliminar esta unidade de medida?').then(function (yes) {
      if (!yes) return;
      DB.remove('unidades_medida', id).then(function () {
        UI.toast('Eliminado', 'info');
        _renderProdutos();
      });
    });
  }

  function _renderDominio() {
    var c = _config.dominio || {};
    _paint('Domínio / URL', 'URLs usadas em links públicos, rastreio e publicação.', [
      _field('cfg-public-url', 'URL pública do site', c.publicUrl || c.siteUrl, 'https://seudominio.com'),
      _field('cfg-order-url', 'URL de pedidos', c.orderUrl, 'https://seudominio.com/#pedido'),
      _field('cfg-track-url', 'URL de rastreio', c.trackUrl, 'https://seudominio.com/track.html')
    ].join(''), function () {
      return { publicUrl: _val('cfg-public-url'), siteUrl: _val('cfg-public-url'), orderUrl: _val('cfg-order-url'), trackUrl: _val('cfg-track-url') };
    });
  }

  function _renderPagamentos() {
    var c = _config.pagamentos || {};
    var methods = c.paymentMethods || [];
    _paint('Formas de pagamento', 'Opções que podem aparecer para o cliente no site.', [
      _check('cfg-pay-cash', 'Dinheiro', c.cash !== false || methods.indexOf('cash') >= 0),
      _check('cfg-pay-card', 'Cartão', c.card !== false || methods.indexOf('card') >= 0),
      _check('cfg-pay-mbway', 'MB WAY', !!c.mbway || methods.indexOf('mbway') >= 0),
      _field('cfg-mbway-phone', 'Telefone MB WAY', c.mbwayPhone, '+351...'),
      _field('cfg-bank-info', 'Dados bancários / referência', c.bankInfo, 'IBAN ou instruções')
    ].join(''), function () {
      var paymentMethods = [];
      if (_checked('cfg-pay-cash')) paymentMethods.push('cash');
      if (_checked('cfg-pay-card')) paymentMethods.push('card');
      if (_checked('cfg-pay-mbway')) paymentMethods.push('mbway');
      return {
        cash: _checked('cfg-pay-cash'),
        card: _checked('cfg-pay-card'),
        mbway: _checked('cfg-pay-mbway'),
        paymentMethods: paymentMethods,
        mbwayPhone: _val('cfg-mbway-phone'),
        bankInfo: _val('cfg-bank-info')
      };
    });
  }

  function _renderEndereco() {
    var c = _config.endereco || {};
    _paint('Endereço', 'Local físico do negócio e dados de contato.', [
      _field('cfg-address-line', 'Endereço', c.addressLine || c.pickupAddress, 'Rua...'),
      _field('cfg-city', 'Cidade', c.city, 'Lisboa'),
      _field('cfg-postal', 'Código postal', c.postalCode, '1000-000'),
      _field('cfg-pickup-area', 'Área / bairro para retirada', c.pickupArea, 'Centro'),
      _field('cfg-phone', 'Telefone', c.phone, '+351...'),
      _field('cfg-email', 'E-mail', c.email, 'contato@...')
    ].join(''), function () {
      return {
        addressLine: _val('cfg-address-line'),
        pickupAddress: _val('cfg-address-line'),
        pickupArea: _val('cfg-pickup-area'),
        city: _val('cfg-city'),
        postalCode: _val('cfg-postal'),
        phone: _val('cfg-phone'),
        email: _val('cfg-email')
      };
    });
  }

  function _renderIntegracoes() {
    var c = _config.integracoes || {};
    _paint('Integrações', 'IDs públicos de analytics e canais externos. Deploy fica somente no Master.', [
      _field('cfg-ga4', 'Google Analytics 4 ID', c.gaId || c.ga4Id, 'G-...'),
      _field('cfg-gtm', 'Google Tag Manager ID', c.gtmId, 'GTM-...'),
      _field('cfg-meta', 'Meta Pixel ID', c.pixelId || c.metaPixelId, '123456789'),
      _field('cfg-whatsapp', 'WhatsApp público', c.whatsapp, '+351...')
    ].join(''), function () {
      return { gaId: _val('cfg-ga4'), ga4Id: _val('cfg-ga4'), gtmId: _val('cfg-gtm'), pixelId: _val('cfg-meta'), metaPixelId: _val('cfg-meta'), whatsapp: _val('cfg-whatsapp') };
    });
  }

  function _renderSeo() {
    var c = _config.seo || {};
    _paint('SEO', 'Metadados usados pelo template público.', [
      _field('cfg-seo-title', 'Título padrão', c.title, 'Boca do Brasil'),
      _textarea('cfg-seo-desc', 'Descrição padrão', c.description, 'Comida brasileira artesanal'),
      _field('cfg-seo-image', 'Imagem social', c.imageUrl, 'https://...'),
      _field('cfg-seo-keywords', 'Palavras-chave', c.keywords, 'brasileiro, comida, lisboa')
    ].join(''), function () {
      return { title: _val('cfg-seo-title'), description: _val('cfg-seo-desc'), imageUrl: _val('cfg-seo-image'), keywords: _val('cfg-seo-keywords') };
    });
  }

  function _renderTemplate() {
    var c = _config.template || {};
    _paint('Template da loja', 'Campos diretos esperados pelo template público index.html.', [
      _check('cfg-tpl-closed', 'Loja fechada manualmente', !!c.manualClosed),
      _field('cfg-tpl-prep', 'Tempo de preparo (min)', c.prepTime || 45, '45', 'number'),
      _field('cfg-tpl-site', 'siteUrl', c.siteUrl, 'https://seudominio.com'),
      _field('cfg-tpl-pickup-address', 'pickupAddress', c.pickupAddress, 'Rua...'),
      _field('cfg-tpl-pickup-area', 'pickupArea', c.pickupArea, 'Centro'),
      _field('cfg-tpl-highlight', 'Produto destaque ID', c.destaqueProductId, 'ID do produto'),
      _textarea('cfg-tpl-hours', 'hours (JSON)', _json(c.hours || []), '[{"enabled":true,"open":"11:00","close":"22:00"}]'),
      _textarea('cfg-tpl-zones', 'deliveryZones (JSON)', _json(c.deliveryZones || []), '[{"postal":"1000-000","name":"Centro","fee":2}]'),
      _textarea('cfg-tpl-categories', 'categories (JSON)', _json(c.categories || []), '[{"id":"salgados","name":"Salgados"}]'),
      _textarea('cfg-tpl-coupons', 'coupons (JSON)', _json(c.coupons || []), '[{"code":"BRASIL10","type":"pct","value":10}]')
    ].join(''), function () {
      return {
        manualClosed: _checked('cfg-tpl-closed'),
        prepTime: parseInt(_val('cfg-tpl-prep')) || 45,
        siteUrl: _val('cfg-tpl-site'),
        pickupAddress: _val('cfg-tpl-pickup-address'),
        pickupArea: _val('cfg-tpl-pickup-area'),
        destaqueProductId: _val('cfg-tpl-highlight'),
        hours: _parseJson('cfg-tpl-hours', []),
        deliveryZones: _parseJson('cfg-tpl-zones', []),
        categories: _parseJson('cfg-tpl-categories', []),
        coupons: _parseJson('cfg-tpl-coupons', [])
      };
    });
  }

  function _paint(title, desc, body, collect) {
    var content = document.getElementById('config-content');
    content.innerHTML = '<div class="settings-card">' +
      '<div class="settings-card-head"><h2>' + title + '</h2><p>' + desc + '</p></div>' +
      '<div class="settings-grid">' + body + '</div>' +
      '<button class="primary-action" id="config-save">Salvar configurações</button>' +
      '</div>';
    document.getElementById('config-save').onclick = function () {
      _save(_activeSub, collect());
    };
  }

  function _save(key, data) {
    DB.setDocRoot('config', key, data).then(function () {
      _config[key] = data;
      UI.toast('Configurações salvas', 'success');
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _check(id, label, checked) {
    return '<label class="check-row"><input id="' + id + '" type="checkbox"' + (checked ? ' checked' : '') + '><span>' + label + '</span></label>';
  }

  function _val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function _checked(id) {
    var el = document.getElementById(id);
    return !!(el && el.checked);
  }

  function _json(value) {
    try { return JSON.stringify(value || [], null, 2); } catch (e) { return '[]'; }
  }

  function _parseJson(id, fallback) {
    try {
      var raw = _val(id);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      UI.toast('JSON inválido em ' + id, 'error');
      return fallback;
    }
  }

  function _esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function destroy() {}

  return {
    render: render, destroy: destroy, _switchSub: _switchSub,
    _openUnidadeModal: _openUnidadeModal, _saveUnidade: _saveUnidade, _deleteUnidade: _deleteUnidade,
    _openFornecedorModal: _openFornecedorModal, _saveFornecedor: _saveFornecedor, _deleteFornecedor: _deleteFornecedor
  };
})();
