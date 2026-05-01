// js/modules/catalogo.js
window.Modules = window.Modules || {};
Modules.Catalogo = (function () {
  'use strict';

  var _activeSub = 'produtos';
  var _products = [];
  var _categories = [];
  var _variants = [];
  var _fichas = [];
  var _produtosProntos = [];
  var _tags = [];
  var _promotions = [];
  var _recipeCategories = [];
  var _recipeComponents = [];
  var _editingId = null;
  var _recipeConfig = { indirectCostPercent: 0 };
  var _financeSaidas = [];
  var _financeApagar = [];
  var USE_FIREBASE_STORAGE_UPLOAD = false;

  function _newEntityId(prefix) {
    var safePrefix = prefix || 'entity';
    return safePrefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function _imageUrlFor(p, kind) {
    p = p || {};
    if (kind === 'thumb') return p.imageThumbUrl || p.thumbnailUrl || p.imageCardUrl || p.cardImageUrl || p.imageUrl || p.imageBase64 || p.img || p.photoUrl || p.image || '';
    if (kind === 'card') return p.imageCardUrl || p.cardImageUrl || p.imageUrl || p.imageBase64 || p.img || p.photoUrl || p.image || '';
    return p.imageUrl || p.imageMainUrl || p.imageCardUrl || p.cardImageUrl || p.imageThumbUrl || p.imageBase64 || p.img || p.photoUrl || p.image || '';
  }

  function _imageUploadTip(kind) {
    if (kind === 'logo') {
      return 'Aceita JPG, JPEG, PNG ou WebP. O sistema ajusta para 500x500 px e otimiza em WebP. Se não subir, o motivo aparece na mensagem do sistema.';
    }
    if (kind === 'banner') {
      return 'Aceita JPG, JPEG, PNG ou WebP. O sistema ajusta para 1200x600 px e otimiza em WebP. Se não subir, o motivo aparece na mensagem do sistema.';
    }
    return 'Aceita JPG, JPEG, PNG ou WebP. O sistema otimiza automaticamente em WebP e gera 800x800, 500x500 e 150x150 px. Se não subir, o motivo aparece na mensagem do sistema.';
  }

  function _productImageErrorMessage(err) {
    var raw = String((err && err.message) || err || '').toLowerCase();
    if (raw.indexOf('timeout') >= 0 || raw.indexOf('tempo') >= 0 || raw.indexOf('expir') >= 0) {
      return 'Não conseguimos enviar a foto. Tente novamente.';
    }
    if (raw.indexOf('formato') >= 0 || raw.indexOf('arquivo') >= 0 || raw.indexOf('pesada') >= 0 || raw.indexOf('tamanho') >= 0) {
      return 'Não conseguimos usar essa imagem. Envie uma foto em JPG ou PNG.';
    }
    return 'Erro ao enviar imagem. Tente novamente.';
  }

  function _legacyImageUploadBaseUrl() {
    var host = (window.location && window.location.hostname) || 'localhost';
    if (host === 'localhost' || host === '127.0.0.1') return 'http://' + host + ':3000';
    return 'http://127.0.0.1:3000';
  }

  function _legacyImageUploadPaths() {
    return [
      '/api/master/product-image/upload',
      '/api/master/upload-product-image',
      '/api/product-image/upload'
    ];
  }

  function _uploadProductImageLegacy(file, meta) {
    var tenantId = meta && meta.tenantId ? String(meta.tenantId) : '';
    var productId = meta && meta.productId ? String(meta.productId) : '';
    if (!tenantId) throw new Error('Tenant não encontrado.');
    if (!productId) throw new Error('Produto não encontrado.');

    var name = String(file && file.name || '').trim().toLowerCase();
    var mime = String(file && file.type || '').toLowerCase();
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(mime) && !/\.(jpe?g|png|webp)$/.test(name)) {
      throw new Error('Não conseguimos usar essa imagem. Envie uma foto em JPG ou PNG.');
    }

    var baseUrl = _legacyImageUploadBaseUrl();
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeoutId = null;
    var route = _legacyImageUploadPaths()[0];
    var form = new FormData();
    form.append('tenantId', tenantId);
    form.append('productId', productId);
    form.append('file', file, file.name || ('produto-' + Date.now() + '.png'));

    console.info('[Catalogo] legacy product image upload start', {
      tenantId: tenantId,
      productId: productId,
      fileName: file.name || '',
      fileType: file.type || '',
      route: baseUrl + route
    });

    var req = fetch(baseUrl + route, {
      method: 'POST',
      mode: 'cors',
      body: form,
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      return res.text().then(function (txt) {
        var data = {};
        try { data = txt ? JSON.parse(txt) : {}; } catch (e) {}
        console.info('[Catalogo] legacy product image upload response', {
          status: res.status,
          ok: res.ok,
          body: data
        });
        if (!res.ok || !data.ok) {
          throw new Error((data && data.error) || 'Não conseguimos publicar a imagem. Tente novamente.');
        }
        return data;
      });
    });

    var timed = new Promise(function (_, reject) {
      timeoutId = setTimeout(function () {
        if (controller) {
          try { controller.abort(); } catch (e) {}
        }
        reject(new Error('Não conseguimos publicar a imagem. Tente novamente.'));
      }, 60000);
    });

    return Promise.race([req, timed]).then(function (result) {
      if (timeoutId) clearTimeout(timeoutId);
      console.info('[Catalogo] legacy product image url received', {
        productId: productId,
        imageUrl: result && result.imageUrl ? result.imageUrl : ''
      });
      return {
        imageUrl: result.imageUrl || '',
        imageCardUrl: result.imageCardUrl || result.imageUrl || '',
        imageThumbUrl: result.imageThumbUrl || result.imageCardUrl || result.imageUrl || '',
        imageStoragePath: result.imageStoragePath || '',
        imageWidth: null,
        imageHeight: null,
        imageSizeKb: null,
        imageFormat: 'raw',
        storageMode: 'github'
      };
    }, function (err) {
      if (timeoutId) clearTimeout(timeoutId);
      throw err;
    });
  }

  var TABS = [
    { key: 'produtos', label: 'Produtos' },
    { key: 'categorias', label: 'Categorias' },
    { key: 'variantes', label: 'Variantes' },
    { key: 'tags', label: 'Tags' }
  ];

  function render(sub) {
    _activeSub = sub || 'produtos';
    var app = document.getElementById('app');
    app.innerHTML = '<div id="catalogo-root" style="display:flex;flex-direction:column;height:100%;">' +
      '<div style="background:#fff;border-bottom:1px solid #F2EDED;padding:0 24px;">' +
      '<h1 style="font-family:\'League Spartan\',sans-serif;font-size:24px;font-weight:800;padding:20px 0 0;">Cardápio</h1>' +
      '<div id="catalogo-tabs" style="display:flex;gap:0;border-bottom:none;"></div>' +
      '</div>' +
      '<div id="catalogo-content" style="flex:1;overflow-y:auto;padding:24px;"></div>' +
      '</div>';

    _renderTabs();
    _loadSub(_activeSub);
  }

  function _renderTabs() {
    var el = document.getElementById('catalogo-tabs');
    el.innerHTML = TABS.map(function (t) {
      if (t.section) {
        return '<span style="align-self:center;margin:0 8px 0 18px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#B9AAA6;">' + t.section + '</span>';
      }
      var active = t.key === _activeSub;
      return '<button data-key="' + t.key + '" onclick="Modules.Catalogo._switchSub(\'' + t.key + '\')" style="padding:12px 18px;border:none;background:transparent;font-size:13px;font-weight:700;cursor:pointer;border-bottom:3px solid ' + (active ? '#C4362A' : 'transparent') + ';color:' + (active ? '#C4362A' : '#8A7E7C') + ';font-family:inherit;transition:all .15s;white-space:nowrap;">' + t.label + '</button>';
    }).join('');
  }

  function _switchSub(key) {
    _activeSub = key;
    _renderTabs();
    _loadSub(key);
    Router.navigate('catalogo/' + key);
  }

  function _loadSub(key) {
    var content = document.getElementById('catalogo-content');
    content.innerHTML = '<div style="text-align:center;padding:40px;color:#8A7E7C;">Carregando...</div>';
    if (key === 'produtos') _renderProdutos();
    else if (key === 'categorias') _renderCategorias();
    else if (key === 'fichas') Router.navigate('receitas/receitas');
    else if (key === 'produtos_prontos') Router.navigate('compras/itens');
    else if (key === 'variantes') _renderVariantes();
    else if (key === 'extras') Router.navigate('catalogo/variantes');
    else if (key === 'itens_custo') Router.navigate('compras/itens');
    else if (key === 'fichas') _renderFichas();
    else if (key === 'tags') _renderTagsTab();
  }

  // ── DRAG-TO-REORDER (Change K) ────────────────────────────────────────────
  function makeSortable(listEl, onReorder) {
    var dragging = null;
    listEl.querySelectorAll('[draggable]').forEach(function (el) {
      el.addEventListener('dragstart', function () { dragging = el; el.style.opacity = '.4'; });
      el.addEventListener('dragend', function () {
        el.style.opacity = '1';
        dragging = null;
        onReorder([].slice.call(listEl.querySelectorAll('[data-id]')).map(function (x, i) {
          return { id: x.dataset.id, order: i };
        }));
      });
      el.addEventListener('dragover', function (e) {
        e.preventDefault();
        if (!dragging || dragging === el) return;
        var r = el.getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) listEl.insertBefore(dragging, el);
        else listEl.insertBefore(dragging, el.nextSibling);
      });
      el.addEventListener('drop', function (e) {
        e.preventDefault();
        onReorder([].slice.call(listEl.querySelectorAll('[data-id]')).map(function (x, i) {
          return { id: x.dataset.id, order: i };
        }));
      });
    });
  }

  // ── SLUG HELPER (Change E) ────────────────────────────────────────────────
  function _toSlug(str) {
    return String(str).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim().replace(/\s+/g, '-');
  }

  function _uniqueProductSlug(seed, editingId) {
    var base = _toSlug(seed || 'produto') || 'produto';
    var used = {};
    (_products || []).forEach(function (p) {
      if (editingId != null && String(p.id) === String(editingId)) return;
      var slug = String(p && p.slug ? p.slug : '').trim().toLowerCase();
      if (slug) used[slug] = true;
    });
    var slug = base;
    var n = 2;
    while (used[String(slug).toLowerCase()]) {
      slug = base + '-' + n;
      n += 1;
    }
    return slug;
  }

  // ── PRODUTOS ──────────────────────────────────────────────────────────────
  function _renderProdutos() {
    Promise.all([DB.getAll('products'), DB.getAll('categories'), DB.getAll('promotions')]).then(function (r) {
      _products = (r[0] || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      _categories = r[1] || [];
      _promotions = r[2] || [];
      _paintProdutos();
    });
  }

  function _refreshProductPromotions() {
    if (_activeSub === 'produtos') {
      _renderProdutos();
      if (window._productModal) _refreshProductPreview();
      return;
    }
    DB.getAll('promotions').then(function (data) {
      _promotions = data || [];
      if (window._productModal) _refreshProductPreview();
    });
  }

  function _paintProdutos() {
    var content = document.getElementById('catalogo-content');
    if (!content) return;
    var searchInput = document.getElementById('catalogo-product-search');
    var query = (searchInput ? searchInput.value : '').trim();
    var visibleProducts = _filterProductList(query);
    // Change J: no emojis; Change K: draggable list
    content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">' +
      '<h2 style="font-size:20px;font-weight:800;">Produtos (' + _products.length + ')</h2>' +
      '<button onclick="Modules.Catalogo._openProductModal(null)" style="display:flex;align-items:center;gap:6px;background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Adicionar</button>' +
      '</div>' +
      '<div style="margin-bottom:16px;">' +
      '<input id="catalogo-product-search" type="search" value="' + _esc(query) + '" placeholder="Pesquisar produto por nome, descrição, categoria ou tag..." oninput="Modules.Catalogo._filterProdutos()" style="width:100%;padding:12px 14px;border:1.5px solid #D4C8C6;border-radius:999px;background:#fff;font-size:14px;font-family:inherit;outline:none;">' +
      '</div>' +
      (_products.length === 0 ? UI.emptyState('Nenhum produto ainda', '') :
      (visibleProducts.length === 0 ? UI.emptyState('Nenhum produto encontrado', 'Tente buscar por outro nome, categoria ou tag.') :
        '<div id="products-list" style="display:flex;flex-direction:column;gap:10px;">' +
        visibleProducts.map(function (p) { return _productRowHTML(p); }).join('') +
        '</div>'));

    if (_products.length > 0 && !query) {
      var listEl = document.getElementById('products-list');
      if (listEl) {
        makeSortable(listEl, function (orders) {
          orders.forEach(function (o) { DB.update('products', o.id, { order: o.order }); });
        });
      }
    }
  }

  function _filterProductList(query) {
    var q = String(query || '').toLowerCase();
    if (!q) return _products;
    return _products.filter(function (p) {
      p = _normalizeProduct(p);
      var cat = _categories.find(function (c) { return c.id === p.categoryId || c.slug === p.categoryId || c.name === p.categoryId; });
      var tagText = (p.tags || []).map(function (tag) { return tag.text || tag.name || ''; }).join(' ');
      var haystack = [
        p.name,
        p.shortDesc,
        p.description,
        p.fullDesc,
        p.microcopy,
        p.price,
        cat ? cat.name : '',
        tagText
      ].join(' ').toLowerCase();
      return haystack.indexOf(q) >= 0;
    });
  }

  function _filterProdutos() {
    var input = document.getElementById('catalogo-product-search');
    var query = input ? input.value : '';
    var list = document.getElementById('products-list');
    var filtered = _filterProductList(query);
    if (list) {
      list.innerHTML = filtered.map(function (p) { return _productRowHTML(p); }).join('');
    }
    if (!list && filtered.length > 0) _paintProdutos();
  }

  function _productRowHTML(p) {
    p = _normalizeProduct(p);
    var cat = _categories.find(function (c) { return c.id === p.categoryId || c.slug === p.categoryId || c.name === p.categoryId; });
    var price = parseFloat(String(p.price || 0).replace(',', '.')) || 0;
    var isMenu = p.type === 'menu';
    var visible = p.menuVisible !== false;
    var groupsCount = Array.isArray(p.menuChoiceGroups) ? p.menuChoiceGroups.length : 0;
    var variantCount = Array.isArray(p.variantGroupIds) ? p.variantGroupIds.length : 0;
    var upsellCount = Array.isArray(p.addAlsoIds) ? p.addAlsoIds.length : 0;
    var promoState = _promoStateForProduct(p);
    var sourceLabel = isMenu ? (groupsCount ? groupsCount + ' grupos de escolha' : 'Menu sem grupos') :
      (p.fichaId ? 'Receita vinculada' : (p.produtoProntoId || p.sourceItemId ? 'Produto pronto' : 'Produto manual'));
    var desc = p.shortDesc || p.description || '';
    var microcopy = p.microcopy || '';
    var statusHtml = visible
      ? '<span style="background:#EAF7EF;color:#2F8B57;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:800;">Visível</span>'
      : '<span style="background:#F2EDED;color:#8A7E7C;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:800;">Oculto</span>';
    var imgSrc = p.imageThumbUrl || p.imageCardUrl || p.imageUrl || p.imageBase64 || p.img || '';
    var imgHtml = imgSrc
      ? '<img src="' + imgSrc + '" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=\'none\';">'
      : '<span class="mi" style="font-size:26px;color:#D4C8C6;">restaurant</span>';

    // Change C: render tags
    var tagsHtml = '';
    if (p.tags && p.tags.length) {
      tagsHtml = p.tags.map(function (tag) {
        return '<span style="background:' + (tag.bgColor || '#C4362A') + ';color:' + (tag.textColor || '#fff') + ';padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;">' + _esc(tag.text) + '</span>';
      }).join('');
    }

    return '<div draggable="true" data-id="' + p.id + '" onclick="Modules.Catalogo._openProductModal(\'' + p.id + '\')" style="background:#fff;border-radius:14px;box-shadow:0 2px 10px rgba(0,0,0,.055);display:grid;grid-template-columns:22px 76px minmax(260px,1fr) minmax(280px,360px) 42px;align-items:center;gap:14px;padding:14px 16px;cursor:pointer;border:1px solid rgba(212,200,198,.35);">' +
      '<span class="mi" style="color:#D4C8C6;font-size:18px;flex-shrink:0;">drag_indicator</span>' +
      '<div style="width:76px;height:76px;border-radius:12px;background:#F2EDED;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;">' + imgHtml + '</div>' +
      '<div style="min-width:0;">' +
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px;">' +
      '<input value="' + _esc(p.name) + '" onclick="event.stopPropagation()" onkeydown="if(event.key===\'Enter\'){this.blur();}" onchange="Modules.Catalogo._quickUpdateProduct(event,\'' + p.id + '\',\'name\',this.value)" style="min-width:180px;max-width:460px;flex:1;border:none;background:transparent;padding:0;font-size:16px;font-weight:900;color:#1A1A1A;outline:none;font-family:inherit;">' +
      statusHtml +
      '</div>' +
      (microcopy ? '<div style="font-size:12px;color:#A85A2D;font-weight:800;font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(microcopy) + '</div>' : '') +
      '<div style="font-size:12px;color:#8A7E7C;margin-top:3px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(desc || 'Sem descrição curta') + '</div>' +
      '<div style="display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap;">' +
      '<span style="background:#F7F1F0;color:#5E5553;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:800;">' + (isMenu ? 'Menu' : 'Produto único') + '</span>' +
      (cat ? UI.badge(cat.name, 'blue') : '<span style="background:#FFF0EE;color:#C4362A;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:800;">Sem categoria</span>') +
      tagsHtml +
      '</div></div>' +
      '<div style="display:grid;grid-template-columns:repeat(2,minmax(120px,1fr));gap:8px;align-items:stretch;">' +
      (promoState
        ? '<div style="background:#FAF8F8;border-radius:10px;padding:9px 10px;">' + _promoProductVisual(p) + '</div>'
        : '<div style="background:#FAF8F8;border-radius:10px;padding:9px 10px;"><div style="font-size:10px;color:#8A7E7C;font-weight:900;text-transform:uppercase;">Preço</div><div style="display:flex;align-items:center;gap:3px;margin-top:2px;"><span style="font-size:15px;font-weight:900;color:#C4362A;">€</span><input type="number" step="0.01" value="' + (price || '') + '" onclick="event.stopPropagation()" onkeydown="if(event.key===\'Enter\'){this.blur();}" onchange="Modules.Catalogo._quickUpdateProduct(event,\'' + p.id + '\',\'price\',this.value)" style="width:82px;border:none;background:transparent;padding:0;font-size:15px;font-weight:900;color:#C4362A;outline:none;font-family:inherit;"></div></div>') +
      '<div style="background:#FAF8F8;border-radius:10px;padding:9px 10px;"><div style="font-size:10px;color:#8A7E7C;font-weight:900;text-transform:uppercase;">Origem</div><div style="font-size:12px;color:#1A1A1A;font-weight:800;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(sourceLabel) + '</div></div>' +
      '<div style="background:#FAF8F8;border-radius:10px;padding:9px 10px;"><div style="font-size:10px;color:#8A7E7C;font-weight:900;text-transform:uppercase;">Variações</div><div style="font-size:12px;color:#1A1A1A;font-weight:800;margin-top:4px;">' + (variantCount ? variantCount + ' grupo(s)' : 'Nenhuma') + '</div></div>' +
      '<div style="background:#FAF8F8;border-radius:10px;padding:9px 10px;"><div style="font-size:10px;color:#8A7E7C;font-weight:900;text-transform:uppercase;">Upsell</div><div style="font-size:12px;color:#1A1A1A;font-weight:800;margin-top:4px;">' + (upsellCount ? upsellCount + ' produto(s)' : 'Nenhum') + '</div></div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:7px;flex-shrink:0;align-items:flex-end;">' +
      '<button onclick="event.stopPropagation();Modules.Catalogo._openProductModal(\'' + p.id + '\')" style="width:34px;height:34px;border-radius:9px;border:none;cursor:pointer;background:#EEF4FF;color:#3B82F6;font-size:15px;display:flex;align-items:center;justify-content:center;"><span class="mi" style="font-size:16px;">edit</span></button>' +
      '<button onclick="event.stopPropagation();Modules.Catalogo._deleteProduct(\'' + p.id + '\')" style="width:34px;height:34px;border-radius:9px;border:none;cursor:pointer;background:#FFF0EE;color:#C4362A;font-size:15px;display:flex;align-items:center;justify-content:center;"><span class="mi" style="font-size:16px;">delete</span></button>' +
      '</div></div>';
  }

  function _quickUpdateProduct(event, id, field, value) {
    if (event) event.stopPropagation();
    var product = _products.find(function (p) { return String(p.id) === String(id); });
    if (!product) return;
    var data = {};
    if (field === 'name') {
      var name = String(value || '').trim();
      if (!name) {
        UI.toast('Nome obrigatório.', 'error');
        _paintProdutos();
        return;
      }
      data.name = name;
      product.name = name;
    }
    if (field === 'price') {
      var price = parseFloat(String(value || '').replace(',', '.'));
      if (!isFinite(price) || price <= 0) {
        UI.toast('Informe um preço de venda válido.', 'error');
        _paintProdutos();
        return;
      }
      data.price = price;
      product.price = price;
    }
    DB.update('products', id, data)
      .then(function () { UI.toast('Produto atualizado.', 'success'); })
      .catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); _renderProdutos(); });
  }

  function _openProductModal(id) {
    _editingId = id;
    var p = id ? (_products.find(function (x) { return x.id === id; }) || {}) : {};
    window._pmDraftId = id || _newEntityId('prod');
    window._pmImageState = null;

    // Gather data needed for modal
    Promise.all([
      DB.getAll('categories'),
      DB.getAll('fichasTecnicas'),
      DB.getAll('itens_custo'),
      DB.getAll('variantGroups'),
      DB.getAll('tags'),
      DB.getAll('promotions')
    ]).then(function (r) {
      _categories = r[0] || [];
      _fichas = r[1] || [];
      _produtosProntos = _normalizeProdutosCompras(r[2] || []);
      _variants = r[3] || [];
      _tags = r[4] || [];
      _promotions = r[5] || [];
      _buildProductModal(p, id);
    });
  }

  function _buildProductModal(p, id) {
    p = _normalizeProduct(p);
    var tipoUnico = !p.type || p.type === 'unico';
    var tipoMenu = p.type === 'menu';
    var unicoSubReceita = !p.unicoSource || p.unicoSource === 'receita';
    var unicoSubPronto = p.unicoSource === 'produto_pronto' || p.unicoSource === 'compras_produto';
    var fichaOptions = _fichas.map(function (f) {
      return '<option value="' + f.id + '"' + (p.fichaId === f.id ? ' selected' : '') + '>' + _esc(f.name) + '</option>';
    }).join('');
    var prontoOptions = _produtosProntos.map(function (pp) {
      var selectedId = p.produtoProntoId || p.sourceItemId || '';
      return '<option value="' + pp.id + '"' + (String(selectedId) === String(pp.id) ? ' selected' : '') + '>' + _esc(pp.name) + '</option>';
    }).join('');
    var menuGroups = _normalizeMenuGroups(p);
    var menuGroupsHtml = menuGroups.map(function (group, i) { return _menuGroupRowHtml(i, group); }).join('');
    var addAlsoIds = (p.addAlsoIds || []).map(String).filter(function (id) { return _isSimpleUpsellProduct(_productForId(id)); });
    var addAlsoTitle = p.addAlsoTitle || p.upsellTitle || 'Aumentar valor do pedido';
    var addAlsoDiscount = parseFloat(String(p.addAlsoDiscount || p.upsellDiscount || 0).replace(',', '.')) || 0;
    var pricingPreview = _productPricingPreview(p);
    var promoBlockHtml = _promoBlockHtml(p);
    var pricingChipsHtml = pricingPreview
      ? '<span style="background:#fff;border:1px solid #EEE6E4;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:800;color:#1A1A1A;">Custo: ' + UI.fmt(pricingPreview.cost) + '</span>' +
        '<span style="background:#fff;border:1px solid #EEE6E4;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:800;color:' + (pricingPreview.margin < 0 ? '#C4362A' : '#1A9E5A') + ';">Margem: ' + pricingPreview.margin.toFixed(1).replace('.', ',') + '%</span>' +
        '<span style="background:#fff;border:1px solid #EEE6E4;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:800;color:' + (pricingPreview.profit < 0 ? '#C4362A' : '#1A9E5A') + ';">Lucro: ' + UI.fmt(pricingPreview.profit) + '</span>'
      : '<span style="font-size:11px;color:#8A7E7C;">Preencha preço e base para ver custo e margem.</span>';
    var tagsHtml = (_tags.length === 0 ? '<p style="font-size:12px;color:#8A7E7C;margin:0;">Nenhuma tag cadastrada.</p>' : _tags.map(function (tag) {
      var isSelected = (p.tags || []).some(function (t) { return (t.id || t.text) === tag.id || (t.id || t.text) === tag.text; });
      return '<label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;margin:2px 3px;">' +
        '<input type="checkbox" class="pm-tag-check" data-tag-id="' + tag.id + '" data-tag-text="' + _esc(tag.text) + '" data-tag-bg="' + _esc(tag.bgColor || '#C4362A') + '" data-tag-color="' + _esc(tag.textColor || '#ffffff') + '"' + (isSelected ? ' checked' : '') + ' onchange="Modules.Catalogo._refreshProductPreview()" style="accent-color:#C4362A;">' +
        '<span style="background:' + (tag.bgColor || '#F7F1F0') + ';color:' + (tag.textColor || '#5E5553') + ';padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;">' + _esc(tag.text) + '</span>' +
        '</label>';
    }).join(''));
    var variantsHtml = (_variants.length === 0 ? '<p style="font-size:12px;color:#8A7E7C;margin:0;">Nenhum grupo de variantes criado ainda.</p>' : '<div id="pm-variant-checks">' + _variants.map(function (vg) {
      var checked = p.variantGroupIds && p.variantGroupIds.indexOf(vg.id) >= 0;
      return '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:6px 0;">' +
        '<input type="checkbox" class="pm-variant-check" data-vgid="' + vg.id + '"' + (checked ? ' checked' : '') + ' style="width:15px;height:15px;accent-color:#C4362A;">' +
        _esc(vg.title) + '</label>';
    }).join('') + '</div>');

    window._pmMenuGroupCount = menuGroups.length;
    window._pmVisible = p.menuVisible !== false;
    window._pmImageBase64 = null;
    window._pmImagePreviewUrl = '';
    window._pmImageUploadPending = false;
    window._pmImageUploadToken = '';
    window._pmSeoEdited = {};

    var body = `
      <div style="display:grid;grid-template-columns:minmax(0,1.15fr) minmax(320px,.85fr);gap:18px;align-items:start;">
        <div style="display:flex;flex-direction:column;gap:14px;">
          <section style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">
            <div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Venda</div>
            <p style="font-size:12px;color:#8A7E7C;line-height:1.45;margin:0 0 14px;">Organize o que o cliente vai ver e o que ajuda a vender.</p>
            <div style="display:grid;grid-template-columns:160px 1fr;gap:14px;align-items:start;">
              <div>
                <label style="font-size:10px;font-weight:900;color:#8A7E7C;display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;">Imagem</label>
                <input type="file" id="pm-img-file" accept="image/jpeg,image/jpg,image/png,image/webp" onchange="Modules.Catalogo._onImgFileChange(event)" style="width:100%;padding:9px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:13px;font-family:inherit;outline:none;background:#fff;">
                <div style="margin-top:6px;font-size:11px;line-height:1.45;color:#8A7E7C;">A foto será publicada automaticamente e a URL será preenchida.</div>
                <div style="margin-top:8px;"><label style="font-size:10px;font-weight:900;color:#8A7E7C;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em;">URL da imagem</label><input id="pm-img-url" type="text" maxlength="500" value="${_esc(_imageUrlFor(p, 'main'))}" placeholder="https://..." oninput="Modules.Catalogo._refreshProductPreview()" style="width:100%;padding:9px;border:1.5px solid #D4C8C6;border-radius:10px;font-size:13px;font-family:inherit;outline:none;background:#fff;"></div>
              </div>
              <div style="display:flex;flex-direction:column;gap:12px;">
                <div><label style="${_fichaLbl()}">Nome do produto *</label><input id="pm-name" type="text" maxlength="55" value="${_esc(p.name || '')}" oninput="Modules.Catalogo._onProductNameChange();Modules.Catalogo._refreshProductPreview()" style="${_fichaInp()}"></div>
                <div><label style="${_fichaLbl()}">Frase que faz vender (microcopy)</label><input id="pm-microcopy" type="text" maxlength="72" value="${_esc(p.microcopy || '')}" placeholder="Ex: Crocante por fora, recheio que surpreende" oninput="Modules.Catalogo._refreshProductPreview()" style="${_fichaInp()}"><p style="font-size:11px;color:#8A7E7C;margin-top:4px;">Essa frase ajuda o cliente a decidir comprar.</p></div>
                <div><label style="${_fichaLbl()}">Descrição curta</label><textarea id="pm-short-desc" maxlength="120" oninput="Modules.Catalogo._onProductDescChange();Modules.Catalogo._refreshProductPreview()" style="${_fichaInp()}min-height:72px;resize:vertical;">${_esc(p.shortDesc || p.description || '')}</textarea></div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:end;">
                <div><label style="${_fichaLbl()}">Preço *</label><input id="pm-price" type="number" step="0.01" value="${p.price || ''}" oninput="Modules.Catalogo._refreshProductPreview()" style="${_fichaInp()}font-size:18px;font-weight:900;color:#C4362A;text-align:right;"></div>
                  <div><label style="${_fichaLbl()}">Categoria</label><select id="pm-cat" onchange="Modules.Catalogo._refreshProductPreview()" style="${_fichaInp()}background:#fff;"><option value="">Sem categoria</option>${_categories.map(function (c) { return '<option value="' + c.id + '"' + (p.categoryId === c.id ? ' selected' : '') + '>' + _esc(c.name) + '</option>'; }).join('')}</select></div>
                </div>
                <input id="pm-cost" type="hidden" value="${pricingPreview ? pricingPreview.cost : ''}">
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">${pricingChipsHtml}</div>
                ${promoBlockHtml}
              </div>
            </div>
          </section>
          <section style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">
            <div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Tipo</div>
            <p style="font-size:12px;color:#8A7E7C;line-height:1.45;margin:0 0 12px;">Defina se o produto é simples ou um menu com escolhas.</p>
            <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:14px;">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;font-weight:700;"><input type="radio" name="pm-tipo" value="unico"${tipoUnico ? ' checked' : ''} onchange="Modules.Catalogo._onTipoChange();Modules.Catalogo._refreshProductPreview()" style="accent-color:#C4362A;"> Produto único</label>
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;font-weight:700;"><input type="radio" name="pm-tipo" value="menu"${tipoMenu ? ' checked' : ''} onchange="Modules.Catalogo._onTipoChange();Modules.Catalogo._refreshProductPreview()" style="accent-color:#C4362A;"> Menu / combo</label>
            </div>
            <div id="pm-panel-unico" style="display:${tipoUnico ? 'block' : 'none'};">
              <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:12px;">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;font-weight:700;"><input type="radio" name="pm-unico-src" value="receita"${unicoSubReceita ? ' checked' : ''} onchange="Modules.Catalogo._onUnicoSrcChange();Modules.Catalogo._refreshProductPreview()" style="accent-color:#C4362A;"> Receita</label>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;font-weight:700;"><input type="radio" name="pm-unico-src" value="produto_pronto"${unicoSubPronto ? ' checked' : ''} onchange="Modules.Catalogo._onUnicoSrcChange();Modules.Catalogo._refreshProductPreview()" style="accent-color:#C4362A;"> Produto pronto</label>
              </div>
              <div id="pm-unico-receita-panel" style="display:${unicoSubReceita ? 'block' : 'none'};margin-bottom:10px;"><label style="${_fichaLbl()}">Receita</label><select id="pm-ficha-id" style="${_fichaInp()}background:#fff;"><option value="">Selecionar receita...</option>${fichaOptions}</select></div>
              <div id="pm-unico-pronto-panel" style="display:${unicoSubPronto ? 'block' : 'none'};margin-bottom:10px;"><label style="${_fichaLbl()}">Produto pronto</label><select id="pm-pronto-id" style="${_fichaInp()}background:#fff;"><option value="">Selecionar produto pronto...</option>${prontoOptions}</select></div>
            </div>
          </section>
          <section id="pm-menu-block" style="display:${tipoMenu ? 'block' : 'none'};background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">
            <div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Menu</div>
            <p style="font-size:12px;color:#8A7E7C;line-height:1.45;margin:0 0 12px;">Crie grupos como “Sabor”, “Bebida” ou “Acompanhamento”.</p>
            <div id="pm-menu-groups">${menuGroupsHtml}</div>
            <button type="button" onclick="Modules.Catalogo._addMenuGroup()" style="width:100%;padding:9px;border-radius:10px;border:1.5px dashed #D4C8C6;background:transparent;font-size:13px;font-weight:700;cursor:pointer;color:#8A7E7C;font-family:inherit;margin-top:6px;">+ Adicionar grupo ao menu</button>
          </section>
          <section style="background:#FFF8F7;border:1px solid #F2E1DE;border-radius:16px;padding:16px;">
            <div style="font-size:12px;font-weight:900;color:#C4362A;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Sugestões para aumentar o pedido</div>
            <p style="font-size:12px;color:#8A7E7C;line-height:1.45;margin:0 0 12px;">Mostramos isso antes do cliente finalizar.</p>
            ${_upsellBlockHtml('addAlso', addAlsoTitle, 'Produtos únicos extras que o cliente pode adicionar.', addAlsoIds, addAlsoDiscount)}
          </section>
          <section style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">
            <div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Visibilidade</div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;">
              <div><div style="font-size:13px;font-weight:700;">Mostrar no cardápio</div><div style="font-size:11px;color:#8A7E7C;">Controle se o cliente vê este produto</div></div>
              <button type="button" id="pm-visible-toggle" onclick="Modules.Catalogo._toggleVis()" style="width:42px;height:24px;border-radius:12px;border:none;cursor:pointer;position:relative;transition:background .2s;background:${p.menuVisible !== false ? '#C4362A' : '#D4C8C6'};"><span style="position:absolute;top:3px;left:3px;width:18px;height:18px;background:#fff;border-radius:50%;transition:transform .2s;display:block;transform:translateX(${p.menuVisible !== false ? '18px' : '0'});box-shadow:0 1px 4px rgba(0,0,0,.2);"></span></button>
            </div>
          </section>
          <section style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">
            <div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Tags</div>
            <div id="pm-tags-list" style="display:flex;flex-wrap:wrap;gap:4px;">${tagsHtml}</div>
          </section>
          <section style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">
            <div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Variantes</div>
            ${variantsHtml}
          </section>
          <section style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">
            <div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Nota interna</div>
            <input id="pm-note" type="text" value="${_esc(p.internalNote || '')}" placeholder="Visível apenas para a equipa" style="${_fichaInp()}background:#fff;">
          </section>
          <details style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">
            <summary style="cursor:pointer;list-style:none;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
              <div>
                <div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;">SEO (opcional)</div>
                <div style="font-size:12px;color:#8A7E7C;margin-top:4px;">Use apenas se quiser aparecer no Google</div>
              </div>
              <span style="font-size:16px;line-height:1;color:#8A7E7C;">▸</span>
            </summary>
            <div style="margin-top:12px;display:flex;flex-direction:column;gap:10px;">
              <div><label style="${_fichaLbl()}">Título SEO</label><input id="pm-seo-title" type="text" maxlength="70" value="${_esc(p.seoTitle || p.name || '')}" oninput="Modules.Catalogo._seoEdited('title')" style="${_fichaInp()}"></div>
              <div><label style="${_fichaLbl()}">Descrição SEO</label><textarea id="pm-seo-desc" maxlength="160" oninput="Modules.Catalogo._seoEdited('desc')" style="${_fichaInp()}min-height:60px;resize:vertical;">${_esc(p.seoDescription || p.description || '')}</textarea></div>
              <div><label style="${_fichaLbl()}">URL</label><input id="pm-seo-slug" type="text" maxlength="80" value="${_esc(p.slug || _toSlug(p.name || ''))}" oninput="Modules.Catalogo._seoEdited('slug')" style="${_fichaInp()}"></div>
              <div><label style="${_fichaLbl()}">Palavra-chave principal</label><input id="pm-seo-kw" type="text" maxlength="60" value="${_esc(p.seoKeyword || '')}" style="${_fichaInp()}"></div>
              <div><label style="${_fichaLbl()}">Alt da imagem</label><input id="pm-seo-alt" type="text" maxlength="120" value="${_esc(p.imageAlt || p.name || '')}" oninput="Modules.Catalogo._seoEdited('alt')" style="${_fichaInp()}"></div>
            </div>
          </details>
        </div>
        <div id="pm-preview-column">${_productPreviewHtml(p)}</div>
      </div>`;

    var footer = `
      <div style="display:flex;flex-direction:column;gap:6px;align-items:stretch;">
        <button onclick="Modules.Catalogo._saveProduct()" style="width:100%;padding:13px;border-radius:12px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;">Salvar e atualizar cardápio</button>
        <div style="font-size:11px;color:#8A7E7C;text-align:center;">Alterações visíveis para o cliente</div>
      </div>`;

    window._productModal = UI.modal({ title: id ? 'Editar Produto' : 'Novo Produto', body: body, footer: footer, maxWidth: '1120px' });
    window._pmProductBase = p;
    setTimeout(function () {
      _refreshProductPreview();
      var menuListEl = document.getElementById('pm-menu-groups');
      if (menuListEl) makeSortable(menuListEl, function () {});
    }, 100);
  }

  function _normalizeProduct(p) {
    p = Object.assign({}, p || {});
    p.shortDesc = p.shortDesc || p.description || p.desc || '';
    p.fullDesc = p.fullDesc || p.fullDescription || p.seoDescription || p.seoDesc || p.shortDesc || '';
    p.description = p.shortDesc;
    p.imageUrl = p.imageUrl || p.imageMainUrl || p.img || '';
    p.imageCardUrl = p.imageCardUrl || p.cardImageUrl || '';
    p.imageThumbUrl = p.imageThumbUrl || p.thumbnailUrl || '';
    p.imageStoragePath = p.imageStoragePath || p.storagePath || '';
    p.categoryId = p.categoryId || p.category || '';
    p.seoDescription = p.seoDescription || p.seoDesc || p.fullDesc || p.shortDesc || '';
    p.type = p.type || (p.category === 'menu' ? 'menu' : 'unico');
    return p;
  }

  function _productPricingPreview(p) {
    p = _normalizeProduct(p || {});
    var price = _moneyLike(p.price || 0);
    var cost = _productCostFromState(p);

    if (!(price > 0) || !(cost > 0)) return null;

    var profit = price - cost;
    var margin = price > 0 ? (profit / price) * 100 : 0;
    return { price: price, cost: cost, profit: profit, margin: margin, source: '' };
  }

  function _moneyLike(value) {
    var str = String(value == null ? '' : value).trim();
    if (!str) return 0;
    var cleaned = str.replace(/[^\d,.-]/g, '');
    if (!cleaned) return 0;
    var lastComma = cleaned.lastIndexOf(',');
    var lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
    var n = parseFloat(cleaned);
    return isFinite(n) ? n : 0;
  }

  function _menuRefCost(ref) {
    if (!ref) return 0;
    var parts = String(ref).split(':');
    var type = parts[0];
    var id = parts.slice(1).join(':');
    if (type === 'ficha') {
      var ficha = _fichas.find(function (f) { return String(f.id) === String(id); });
      if (ficha && typeof _calcFichaCosts === 'function') {
        var calc = _calcFichaCosts(ficha);
        return _moneyLike(calc && calc.costPerYield != null ? calc.costPerYield : 0);
      }
      return 0;
    }
    if (type === 'pronto') {
      var pronto = _produtosProntos.find(function (pp) { return String(pp.id) === String(id); });
      return _moneyLike(pronto && (pronto.purchasePrice != null ? pronto.purchasePrice : pronto.preco_compra != null ? pronto.preco_compra : pronto.custo_atual != null ? pronto.custo_atual : pronto.cost || 0));
    }
    var prod = _productForId(id);
    return _moneyLike(prod && (prod.cost != null ? prod.cost : prod.custo != null ? prod.custo : prod.purchasePrice != null ? prod.purchasePrice : prod.custoAtual != null ? prod.custoAtual : prod.preco_compra != null ? prod.preco_compra : 0));
  }

  function _currentMenuGroupsFromModal(base) {
    var menuContainer = document.getElementById('pm-menu-groups');
    if (!menuContainer) return _normalizeMenuGroups(base || {});
    var groups = [];
    menuContainer.querySelectorAll('.pm-menu-group').forEach(function (groupEl) {
      var idx = groupEl.dataset.menuGroup;
      var titleEl = groupEl.querySelector('[data-menu-title="' + idx + '"]');
      var minEl = groupEl.querySelector('[data-menu-min="' + idx + '"]');
      var maxEl = groupEl.querySelector('[data-menu-max="' + idx + '"]');
      var max = parseInt(maxEl ? maxEl.value : 1, 10) || 1;
      var min = parseInt(minEl ? minEl.value : max, 10);
      if (min < 0) min = 0;
      if (max < 1) max = 1;
      if (min > max) min = max;
      var options = [];
      groupEl.querySelectorAll('[data-menu-selected="' + idx + '"]').forEach(function (opt) {
        var priceEl = opt.querySelector('[data-menu-price="' + idx + '"]');
        options.push({
          ref: opt.dataset.ref,
          label: opt.dataset.label || opt.dataset.ref,
          priceExtra: parseFloat(priceEl ? priceEl.value : 0) || 0,
          img: opt.dataset.img || ''
        });
      });
      if (options.length) {
        groups.push({ title: (titleEl ? titleEl.value : '') || 'Escolha', min: min, max: max, options: options });
      }
    });
    return groups.length ? groups : _normalizeMenuGroups(base || {});
  }

  function _productCostFromState(base) {
    base = _normalizeProduct(base || {});
    var tipoEl = document.querySelector('input[name="pm-tipo"]:checked');
    var tipo = (tipoEl && tipoEl.value) || base.type || 'unico';
    var cost = _moneyLike(base.cost != null ? base.cost :
      (base.custo != null ? base.custo :
      (base.purchasePrice != null ? base.purchasePrice :
      (base.custoAtual != null ? base.custoAtual :
      (base.custo_atual != null ? base.custo_atual : 0)))));

    if (tipo === 'unico') {
      var srcEl = document.querySelector('input[name="pm-unico-src"]:checked');
      var src = (srcEl && srcEl.value) || base.unicoSource || 'receita';
      if (src === 'receita') {
        var fichaId = ((document.getElementById('pm-ficha-id') || {}).value || base.fichaId || '').trim();
        var ficha = _fichas.find(function (f) { return String(f.id) === String(fichaId); });
        if (ficha && typeof _calcFichaCosts === 'function') {
          var calc = _calcFichaCosts(ficha);
          if (calc && calc.costPerYield > 0) return _moneyLike(calc.costPerYield);
          if (calc && calc.totalCost > 0) return _moneyLike(calc.totalCost);
        }
      } else {
        var prontoId = ((document.getElementById('pm-pronto-id') || {}).value || base.produtoProntoId || base.sourceItemId || '').trim();
        var pronto = _produtosProntos.find(function (pp) { return String(pp.id) === String(prontoId); });
        if (pronto) {
          var prontoCost = pronto.purchasePrice != null ? pronto.purchasePrice :
            (pronto.preco_compra != null ? pronto.preco_compra :
            (pronto.custo_atual != null ? pronto.custo_atual : pronto.cost || 0));
          if (_moneyLike(prontoCost) > 0) return _moneyLike(prontoCost);
        }
      }
      return cost > 0 ? cost : 0;
    }

    var groups = _currentMenuGroupsFromModal(base);
    var total = 0;
    groups.forEach(function (group) {
      var groupCosts = [];
      (group.options || []).forEach(function (opt) {
        var c = _menuRefCost(opt.ref);
        if (c > 0) groupCosts.push(c);
      });
      if (groupCosts.length) total += Math.min.apply(Math, groupCosts);
    });
    return total > 0 ? total : cost;
  }

  function _productPreviewState(base) {
    var p = _normalizeProduct(base || {});
    var nameEl = document.getElementById('pm-name');
    var microEl = document.getElementById('pm-microcopy');
    var descEl = document.getElementById('pm-short-desc');
    var priceEl = document.getElementById('pm-price');
    var catEl = document.getElementById('pm-cat');
    var tipoEl = document.querySelector('input[name="pm-tipo"]:checked');
    var promoState = _promoStateForProduct(p);
    var tags = [].slice.call(document.querySelectorAll('.pm-tag-check:checked')).map(function (cb) {
      return { text: cb.dataset.tagText || '', bgColor: cb.dataset.tagBg || '#C4362A', textColor: cb.dataset.tagColor || '#fff' };
    });
    if (!tags.length && Array.isArray(p.tags)) {
      tags = p.tags.slice(0, 2).map(function (tag) {
        return { text: tag.text || tag.name || '', bgColor: tag.bgColor || '#F7F1F0', textColor: tag.textColor || '#5E5553' };
      }).filter(function (t) { return t.text; });
    }
    if (!tags.length) {
      tags = [
        { text: 'Mais pedido', bgColor: '#FFF0EE', textColor: '#C4362A' },
        { text: 'Favorito', bgColor: '#EEF4FF', textColor: '#3B82F6' }
      ];
    }
    var imageState = window._pmImageState || {};
    var tempPreview = window._pmImagePreviewUrl || '';
    var imageSrc = tempPreview || imageState.imageCardUrl || imageState.cardUrl || imageState.mainUrl || imageState.imageUrl || p.imageCardUrl || p.imageUrl || p.imageBase64 || (document.getElementById('pm-img-url') ? (document.getElementById('pm-img-url').value || '').trim() : '') || '';
    return {
      name: ((nameEl && nameEl.value) || p.name || 'Nome do produto').trim() || 'Nome do produto',
      microcopy: ((microEl && microEl.value) || p.microcopy || 'Frase de venda curta para apoiar a decisão.').trim() || 'Frase de venda curta para apoiar a decisão.',
      shortDesc: ((descEl && descEl.value) || p.shortDesc || p.description || 'Descrição curta do produto.').trim() || 'Descrição curta do produto.',
      price: parseFloat(String((priceEl && priceEl.value) || p.price || 0).replace(',', '.')) || 0,
      catLabel: catEl && catEl.options && catEl.selectedIndex >= 0 ? (catEl.options[catEl.selectedIndex].text || 'Sem categoria') : (p.categoryId || 'Sem categoria'),
      tipoLabel: tipoEl && tipoEl.value === 'menu' ? 'Menu / combo' : 'Produto único',
      imageSrc: imageSrc,
      promoState: promoState,
      tags: tags
    };
  }

  function _productPreviewHtml(base) {
    var s = _productPreviewState(base || {});
    var priceText = UI.fmt(s.price || 0);
    var promoBadge = s.promoState ? '<span style="background:#FFF0EE;color:#C4362A;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:800;">' + _esc(s.promoState.badge) + '</span>' : '';
    var promoLabel = s.promoState ? '<span style="background:#EDFAF3;color:#1A9E5A;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:800;">Promoção ativa</span>' : '';
    var promoPriceHtml = s.promoState
      ? '<div style="display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;margin-top:10px;"><div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Preço original</div><div style="font-size:18px;font-weight:800;color:#8A7E7C;text-decoration:line-through;">' + UI.fmt(s.promoState.calc.original) + '</div></div><div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Preço promocional</div><div style="font-size:30px;font-weight:900;line-height:1;color:#C4362A;">' + UI.fmt(s.promoState.calc.final) + '</div></div></div>'
      : '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Preço</div><div id="pm-preview-price" style="font-size:30px;font-weight:900;line-height:1;color:#C4362A;">€ ' + priceText.replace('€', '') + '</div></div>';
    var badgeHtml = [
      '<span style="background:#F7F1F0;color:#5E5553;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:800;">' + _esc(s.tipoLabel) + '</span>',
      '<span style="background:#FFF7ED;color:#B45309;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:800;">' + _esc(s.catLabel) + '</span>'
    ].concat((s.promoState ? [{ text: s.promoState.badge, bgColor: '#FFF0EE', textColor: '#C4362A' }] : []).concat(s.tags).map(function (tag) {
      return '<span style="background:' + (tag.bgColor || '#F7F1F0') + ';color:' + (tag.textColor || '#5E5553') + ';padding:4px 10px;border-radius:999px;font-size:11px;font-weight:800;">' + _esc(tag.text) + '</span>';
    })).join('');

    return '<div id="pm-preview-pane" style="position:sticky;top:12px;align-self:start;background:#fff;border:1px solid #EEE6E4;border-radius:18px;padding:16px;box-shadow:0 6px 20px rgba(0,0,0,.05);">' +
      '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Preview do cliente</div>' +
      '<div style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:18px;overflow:hidden;">' +
      '<div style="position:relative;aspect-ratio:1/1;background:#F2EDED;overflow:hidden;">' +
      (s.imageSrc
        ? '<img id="pm-preview-image" src="' + _esc(s.imageSrc) + '" style="width:100%;height:100%;object-fit:cover;display:block;">'
        : '<div id="pm-preview-image" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#B9AAA6;"><span class="mi" style="font-size:54px;">restaurant</span></div>') +
      '<div style="position:absolute;left:12px;top:12px;display:flex;flex-wrap:wrap;gap:6px;max-width:calc(100% - 24px);">' + badgeHtml + '</div>' +
      '</div>' +
      '<div style="padding:16px;">' +
      '<div id="pm-preview-name" style="font-size:24px;font-weight:900;line-height:1.06;color:#1A1A1A;margin-bottom:6px;">' + _esc(s.name) + '</div>' +
      '<div id="pm-preview-microcopy" style="font-size:13px;color:#A85A2D;font-style:italic;font-weight:700;line-height:1.45;margin-bottom:8px;">' + _esc(s.microcopy) + '</div>' +
      '<div id="pm-preview-desc" style="font-size:12px;color:#6E6563;line-height:1.5;margin-bottom:14px;">' + _esc(s.shortDesc) + '</div>' +
      '<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;">' +
      promoPriceHtml +
      '<button type="button" style="padding:10px 14px;border:none;border-radius:12px;background:#C4362A;color:#fff;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">Adicionar</button>' +
      '</div>' +
      (s.promoState ? '<div style="margin-top:12px;background:#FFF8F7;border:1px solid #F2E1DE;border-radius:12px;padding:12px 14px;">' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px;">' + promoLabel + promoBadge + '</div>' +
        '<div style="font-size:12px;color:#8A7E7C;margin-bottom:4px;">' + _esc(s.promoState.name) + '</div>' +
        '<div style="font-size:12px;color:#1A1A1A;font-weight:800;">Impacto por item: ' + (s.promoState.calc.impact < 0 ? '-' : '+') + UI.fmt(Math.abs(s.promoState.calc.impact)) + '</div>' +
      '</div>' : '') +
      '</div>' +
      '</div>' +
      '</div>';
  }

  function _refreshProductPreview() {
    var el = document.getElementById('pm-preview-column');
    if (!el) return;
    var base = window._pmProductBase || {};
    var costEl = document.getElementById('pm-cost');
    if (costEl) {
      var cost = _productCostFromState(base);
      costEl.value = cost > 0 ? String(cost) : '';
    }
    el.innerHTML = _productPreviewHtml(base);
  }

  function _normalizeProdutosCompras(items) {
    return (items || []).filter(function (item) {
      var classe = String((item && (item.classe || item.class || item.tipoCadastro)) || '').toLowerCase();
      return item && item.ativo !== false && classe === 'produto';
    }).map(function (item) {
      return {
        id: item.id,
        name: item.nome || item.name || 'Produto',
        unit: item.unidade_base || item.unidadeBase || '',
        purchasePrice: item.preco_compra || item.purchasePrice || item.custo_atual || 0,
        supplier: item.fornecedor_padrao_id || item.supplier || '',
        imageBase64: item.imageBase64 || '',
        imageUrl: item.imageUrl || '',
        imageCardUrl: item.imageCardUrl || '',
        imageThumbUrl: item.imageThumbUrl || '',
        sourceType: 'compras_produto'
      };
    }).sort(function (a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }

  function _prontoSourceForId(id) {
    var item = _produtosProntos.find(function (pp) { return String(pp.id) === String(id); });
    return (item && item.sourceType) || 'produto_pronto';
  }

  function _labelForMenuRef(ref) {
    if (!ref) return '';
    var parts = String(ref).split(':');
    var type = parts[0];
    var id = parts.slice(1).join(':');
    if (type === 'ficha') {
      var ficha = _fichas.find(function (f) { return f.id === id; });
      return ficha ? ficha.name : id;
    }
    if (type === 'pronto') {
      var pronto = _produtosProntos.find(function (pp) { return pp.id === id; });
      return pronto ? pronto.name : id;
    }
    return id || ref;
  }

  function _entityForMenuRef(ref) {
    if (!ref) return null;
    var parts = String(ref).split(':');
    var type = parts[0];
    var id = parts.slice(1).join(':');
    if (type === 'ficha') return _fichas.find(function (f) { return f.id === id; }) || null;
    if (type === 'pronto') return _produtosProntos.find(function (pp) { return pp.id === id; }) || null;
    return null;
  }

  function _imgForEntity(x) {
    return (x && (x.imageThumbUrl || x.imageCardUrl || x.imageBase64 || x.imageUrl || x.img || x.photoUrl || x.image)) || '';
  }

  function _productForId(id) {
    return _products.find(function (p) { return String(p.id) === String(id); }) || null;
  }

  function _promoDateValue(v) {
    if (!v) return null;
    var d = new Date(String(v) + 'T00:00:00');
    return isFinite(d.getTime()) ? d : null;
  }

  function _promoIsActive(promo) {
    if (!promo || promo.active === false) return false;
    var now = new Date();
    var start = _promoDateValue(promo.startDate || promo.startsAt);
    var end = _promoDateValue(promo.endDate || promo.endsAt);
    if (start && now < start) return false;
    if (end) {
      end.setHours(23, 59, 59, 999);
      if (now > end) return false;
    }
    return true;
  }

  function _promoNormalizeType(type) {
    if (type === 'pct' || type === 'eur' || type === '2x1' || type === 'add1') return type;
    if (type === 'extra_combo' || type === 'upgrade') return 'add1';
    if (type === 'pack') return '2x1';
    return 'pct';
  }

  function _promoAppliesToProduct(promo, product) {
    if (!_promoIsActive(promo) || !product) return false;
    var productId = String(product.id || '');
    if (promo.applyTo === 'all' || promo.scope === 'todos_produtos') return true;
    var ids = Array.isArray(promo.productIds) ? promo.productIds.map(String) : [];
    if (ids.indexOf(productId) >= 0) return true;
    if (promo.productId && String(promo.productId) === productId) return true;
    return false;
  }

  function _promoBasePrice(product) {
    return _promoNumber(product && (product.price != null ? product.price : 0));
  }

  function _promoCostForProduct(product) {
    if (!product) return 0;
    return _promoNumber(product.cost != null ? product.cost :
      (product.custo != null ? product.custo :
      (product.purchasePrice != null ? product.purchasePrice :
      (product.custoAtual != null ? product.custoAtual :
      (product.custo_atual != null ? product.custo_atual :
      (product.preco_compra != null ? product.preco_compra :
      (product.precoCompra != null ? product.precoCompra :
      (product.custoCompra != null ? product.custoCompra : 0))))))));
  }

  function _promoNumber(value) {
    var str = String(value == null ? '' : value).trim();
    if (!str) return 0;
    var cleaned = str.replace(/[^\d,.-]/g, '');
    if (!cleaned) return 0;
    var lastComma = cleaned.lastIndexOf(',');
    var lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
    var n = parseFloat(cleaned);
    return isFinite(n) ? n : 0;
  }

  function _promoCalcForProduct(product, promo) {
    var original = _promoBasePrice(product);
    var type = _promoNormalizeType(promo && promo.type);
    var value = parseFloat(String((promo && (promo.valuePercentual != null ? promo.valuePercentual : promo.valueDesconto != null ? promo.valueDesconto : promo.value)) || 0).replace(',', '.')) || 0;
    var leve = parseInt(promo && promo.leveQtd || 0, 10) || 0;
    var pague = parseInt(promo && promo.pagueQtd || 0, 10) || 0;
    var final = original;
    if (!(original > 0)) return null;
    if (type === 'pct') {
      final = Math.max(original - (original * value / 100), 0);
    } else if (type === 'eur') {
      final = Math.max(original - value, 0);
    } else if (type === '2x1') {
      final = Math.max(original / 2, 0);
    } else if (type === 'add1' && leve > 0 && leve > pague) {
      final = Math.max((original * pague) / leve, 0);
    }
    var cost = _promoCostForProduct(product);
    var margin = cost > 0 && final > 0 ? ((final - cost) / final) * 100 : null;
    return {
      type: type,
      value: value,
      leve: leve,
      pague: pague,
      original: original,
      final: final,
      discount: Math.max(original - final, 0),
      impact: final - original,
      cost: cost,
      margin: margin,
      promo: promo
    };
  }

  function _promoLabelForState(calc) {
    if (!calc) return '';
    if (calc.type === 'pct') return '-' + calc.value + '%';
    if (calc.type === 'eur') return '-' + UI.fmt(calc.value);
    if (calc.type === '2x1') return '2x1';
    if (calc.type === 'add1') return 'Leve ' + calc.leve + ' pague ' + calc.pague;
    return 'Oferta';
  }

  function _promoStateForProduct(product) {
    var matches = (_promotions || []).filter(function (promo) { return _promoAppliesToProduct(promo, product); });
    if (!matches.length) return null;
    var promo = matches[0];
    var calc = _promoCalcForProduct(product, promo);
    if (!calc) return null;
    return {
      promo: promo,
      calc: calc,
      badge: _promoLabelForState(calc),
      status: 'Promoção ativa',
      name: promo.name || 'Promoção'
    };
  }

  function _promoBlockHtml(product) {
    var state = _promoStateForProduct(product);
    if (!state) return '';
    var c = state.calc;
    var impact = c.impact < 0 ? '-' + UI.fmt(Math.abs(c.impact)) : '+' + UI.fmt(Math.abs(c.impact));
    var promoPrice = UI.fmt(c.final || 0);
    var original = UI.fmt(c.original || 0);
    var title = state.promo.type === '2x1' ? 'Promoção ativa: 2 por 1' :
      state.promo.type === 'add1' ? ('Promoção ativa: Leve ' + (c.leve || 0) + ' pague ' + (c.pague || 0)) :
      'Promoção ativa';
    var extra = '';
    if (c.type === '2x1') extra = 'Cliente leva 2 e paga 1';
    else if (c.type === 'add1') extra = 'Preço efetivo por unidade: ' + promoPrice;
    else if (c.type === 'pct' || c.type === 'eur') extra = 'Impacto por item: ' + impact;
    return '<div style="margin-top:12px;background:#FFF8F7;border:1px solid #F2E1DE;border-radius:12px;padding:12px 14px;">' +
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">' +
        '<span style="font-size:11px;font-weight:800;padding:4px 9px;border-radius:999px;background:#C4362A;color:#fff;">' + _esc(state.badge) + '</span>' +
        '<span style="font-size:12px;font-weight:800;color:#C4362A;">' + _esc(title) + '</span>' +
      '</div>' +
      '<div style="font-size:12px;color:#8A7E7C;margin-bottom:4px;">' + _esc(state.name) + '</div>' +
      '<div style="font-size:13px;color:#1A1A1A;font-weight:800;">' + original + ' → ' + promoPrice + '</div>' +
      '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">' + _esc(extra) + '</div>' +
      (c.margin != null ? '<div style="font-size:12px;color:#8A7E7C;margin-top:4px;">Margem estimada: ' + c.margin.toFixed(1).replace('.', ',') + '%</div>' : '') +
    '</div>';
  }

  function _promoProductVisual(product) {
    var state = _promoStateForProduct(product);
    if (!state) return '';
    var c = state.calc;
    var badge = '<span style="font-size:10px;font-weight:800;padding:4px 8px;border-radius:999px;background:#FFF0EE;color:#C4362A;">' + _esc(state.badge) + '</span>';
    var original = UI.fmt(c.original || 0);
    var promo = UI.fmt(c.final || 0);
    return '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px;">' +
      badge +
      '<span style="font-size:11px;font-weight:800;color:#1A9E5A;">Promoção ativa</span>' +
      '<span style="font-size:11px;color:#8A7E7C;text-decoration:line-through;">' + original + '</span>' +
      '<span style="font-size:11px;color:#C4362A;font-weight:900;">' + promo + '</span>' +
    '</div>';
  }

  function _normalizeMenuGroups(p) {
    if (Array.isArray(p.menuChoiceGroups) && p.menuChoiceGroups.length) {
      return p.menuChoiceGroups.map(function (g) {
        return {
          title: g.title || g.name || 'Escolha',
          min: parseInt(g.min || g.qty || 1, 10) || 1,
          max: parseInt(g.max || g.qty || g.min || 1, 10) || 1,
          options: (g.options || []).map(function (o) {
            var ref = o.ref || o.value || '';
            var ent = _entityForMenuRef(ref);
            return { ref: ref, label: o.label || _labelForMenuRef(ref), priceExtra: parseFloat(o.priceExtra || o.price || 0) || 0, img: o.img || _imgForEntity(ent) };
          }).filter(function (o) { return !!o.ref; })
        };
      });
    }
    return (p.menuItems || []).map(function (item, i) {
      var ref = item.ref || '';
      var qty = parseInt(item.qty || 1, 10) || 1;
      return {
        title: 'Grupo ' + (i + 1),
        min: qty,
        max: qty,
        options: ref ? [{ ref: ref, label: _labelForMenuRef(ref), priceExtra: 0, img: _imgForEntity(_entityForMenuRef(ref)) }] : []
      };
    });
  }

  // Change E: SEO auto-update tracking
  function _seoEdited(field) {
    window._pmSeoEdited = window._pmSeoEdited || {};
    window._pmSeoEdited[field] = true;
  }

  function _onProductNameChange() {
    var name = (document.getElementById('pm-name') || {}).value || '';
    window._pmSeoEdited = window._pmSeoEdited || {};
    if (!window._pmSeoEdited['title']) {
      var el = document.getElementById('pm-seo-title');
      if (el) el.value = name;
    }
    if (!window._pmSeoEdited['slug'] && (!window._pmProductBase || !window._pmProductBase.slug)) {
      var slugEl = document.getElementById('pm-seo-slug');
      if (slugEl) slugEl.value = _toSlug(name);
    }
    if (!window._pmSeoEdited['alt']) {
      var altEl = document.getElementById('pm-seo-alt');
      if (altEl) altEl.value = name;
    }
    _refreshProductPreview();
  }

  function _onProductDescChange() {
    var desc = (document.getElementById('pm-short-desc') || {}).value || '';
    window._pmSeoEdited = window._pmSeoEdited || {};
    if (!window._pmSeoEdited['desc']) {
      var el = document.getElementById('pm-seo-desc');
      if (el) el.value = desc;
    }
    _refreshProductPreview();
  }

  // Change B: Tipo toggles
  function _onTipoChange() {
    var val = document.querySelector('input[name="pm-tipo"]:checked');
    var isMenu = val && val.value === 'menu';
    var up = document.getElementById('pm-panel-unico');
    var mp = document.getElementById('pm-panel-menu');
    if (up) up.style.display = isMenu ? 'none' : 'block';
    if (mp) mp.style.display = isMenu ? 'block' : 'none';
    _refreshProductPreview();
  }

  function _onUnicoSrcChange() {
    var val = document.querySelector('input[name="pm-unico-src"]:checked');
    var isReceita = !val || val.value === 'receita';
    var rp = document.getElementById('pm-unico-receita-panel');
    var pp = document.getElementById('pm-unico-pronto-panel');
    if (rp) rp.style.display = isReceita ? 'block' : 'none';
    if (pp) pp.style.display = isReceita ? 'none' : 'block';
    _refreshProductPreview();
  }

  function _menuOptionPool() {
    var rows = [];
    _fichas.forEach(function (f) { rows.push({ ref: 'ficha:' + f.id, label: f.name, img: _imgForEntity(f) }); });
    _produtosProntos.forEach(function (pp) { rows.push({ ref: 'pronto:' + pp.id, label: pp.name, img: _imgForEntity(pp) }); });
    return rows;
  }

  function _menuSelectedOptionsHtml(idx, group) {
    var options = group.options || [];
    if (!options.length) return '<div data-menu-empty="' + idx + '" style="font-size:12px;color:#8A7E7C;padding:10px;border:1px dashed #D4C8C6;border-radius:9px;text-align:center;">Nenhuma opção adicionada neste grupo.</div>';
    return options.map(function (o) {
      var ent = _entityForMenuRef(o.ref);
      var img = o.img || _imgForEntity(ent);
      var imgHtml = img ? '<img src="' + _esc(img) + '" style="width:34px;height:34px;border-radius:8px;object-fit:cover;background:#F2EDED;flex-shrink:0;" onerror="this.style.display=\'none\';">' : '<div style="width:34px;height:34px;border-radius:8px;background:#F2EDED;display:flex;align-items:center;justify-content:center;color:#B9AAA6;flex-shrink:0;"><span class="mi" style="font-size:17px;">restaurant</span></div>';
      return '<div data-menu-selected="' + idx + '" data-ref="' + _esc(o.ref) + '" data-label="' + _esc(o.label || _labelForMenuRef(o.ref)) + '" data-img="' + _esc(img) + '" style="display:grid;grid-template-columns:34px 1fr 95px 26px;align-items:center;gap:9px;padding:8px 10px;border:1px solid #F2EDED;border-radius:9px;background:#fff;margin-bottom:6px;">' +
        imgHtml +
        '<span style="font-size:13px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + _esc(o.label || _labelForMenuRef(o.ref)) + '</span>' +
        '<label style="display:block;"><span style="display:block;font-size:9px;font-weight:800;text-transform:uppercase;color:#8A7E7C;margin-bottom:2px;">Extra €</span><input data-menu-price="' + idx + '" type="number" step="0.01" value="' + (parseFloat(o.priceExtra || o.price || 0) || '') + '" placeholder="0,00" style="width:100%;padding:6px;border:1.5px solid #D4C8C6;border-radius:7px;font-size:12px;font-family:inherit;outline:none;"></label>' +
        '<button type="button" onclick="Modules.Catalogo._removeMenuOption(' + idx + ', \'' + _esc(o.ref) + '\')" style="width:26px;height:26px;border-radius:7px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;font-size:13px;flex-shrink:0;">x</button>' +
        '</div>';
    }).join('');
  }

  function _menuSearchOptionsHtml(idx, group) {
    var selected = {};
    (group.options || []).forEach(function (o) { selected[o.ref] = true; });
    var rows = _menuOptionPool().filter(function (o) { return !selected[o.ref]; });
    if (!rows.length) return '<div style="font-size:12px;color:#8A7E7C;padding:10px;">Nenhuma opção disponível para adicionar.</div>';
    return rows.map(function (o) {
      var imgHtml = o.img ? '<img src="' + _esc(o.img) + '" style="width:30px;height:30px;border-radius:7px;object-fit:cover;background:#F2EDED;flex-shrink:0;" onerror="this.style.display=\'none\';">' : '<span class="mi" style="font-size:17px;color:#B9AAA6;">restaurant</span>';
      return '<button type="button" data-menu-candidate="' + idx + '" data-ref="' + _esc(o.ref) + '" data-label="' + _esc(o.label) + '" data-img="' + _esc(o.img || '') + '" onclick="Modules.Catalogo._addMenuOption(' + idx + ', \'' + _esc(o.ref) + '\', \'' + _esc(o.label) + '\', \'' + _esc(o.img || '') + '\')" style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border:none;border-bottom:1px solid #F2EDED;background:#fff;text-align:left;cursor:pointer;font-family:inherit;">' +
        '<span style="display:flex;align-items:center;gap:8px;min-width:0;">' + imgHtml + '<span style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(o.label) + '</span></span><span style="font-size:11px;color:#C4362A;font-weight:800;">Adicionar</span></button>';
    }).join('');
  }

  function _menuGroupRowHtml(idx, group) {
    group = group || {};
    var max = parseInt(group.max || group.qty || 1, 10) || 1;
    var min = parseInt(group.min || max, 10) || max;
    return '<div class="pm-menu-group" draggable="true" data-id="menu-group-' + idx + '" data-menu-group="' + idx + '" id="pm-menu-group-' + idx + '" style="background:#fff;border:1px solid #F2EDED;border-radius:12px;padding:12px;margin-bottom:10px;">' +
      '<div style="display:grid;grid-template-columns:24px 1fr 86px 86px 32px;gap:8px;align-items:end;margin-bottom:10px;">' +
      '<span class="mi" style="color:#D4C8C6;font-size:16px;cursor:grab;margin-bottom:10px;">drag_indicator</span>' +
      '<label style="display:block;"><span style="font-size:10px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Nome do grupo</span><input data-menu-title="' + idx + '" value="' + _esc(group.title || 'Escolha') + '" placeholder="Ex: Sabor, bebida..." style="width:100%;padding:9px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;"></label>' +
      '<label style="display:block;"><span style="font-size:10px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Min</span><input data-menu-min="' + idx + '" type="number" min="0" step="1" value="' + min + '" style="width:100%;padding:9px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;"></label>' +
      '<label style="display:block;"><span style="font-size:10px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Max</span><input data-menu-max="' + idx + '" type="number" min="1" step="1" value="' + max + '" style="width:100%;padding:9px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;"></label>' +
      '<button type="button" onclick="Modules.Catalogo._removeMenuGroup(' + idx + ')" style="width:32px;height:38px;border-radius:8px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;font-size:14px;">x</button>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
      '<div>' +
      '<div style="font-size:10px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:5px;">Opções adicionadas</div>' +
      '<div id="pm-menu-selected-' + idx + '" style="max-height:170px;overflow:auto;padding:8px;border:1px solid #F2EDED;border-radius:9px;background:#FCFAFA;">' + _menuSelectedOptionsHtml(idx, group) + '</div>' +
      '</div>' +
      '<div>' +
      '<div style="font-size:10px;font-weight:700;color:#8A7E7C;text-transform:uppercase;margin-bottom:5px;">Pesquisar e adicionar</div>' +
      '<input data-menu-search="' + idx + '" oninput="Modules.Catalogo._filterMenuOptions(' + idx + ')" placeholder="Buscar receita ou produto..." style="width:100%;padding:9px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:12px;font-family:inherit;outline:none;margin-bottom:6px;">' +
      '<div id="pm-menu-candidates-' + idx + '" style="max-height:170px;overflow:auto;border:1px solid #F2EDED;border-radius:9px;background:#fff;">' + _menuSearchOptionsHtml(idx, group) + '</div>' +
      '</div>' +
      '</div>' +
      '</div>';
  }

  function _isSimpleUpsellProduct(p) {
    p = _normalizeProduct(p || {});
    var hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
    return p.id !== undefined && p.id !== null && p.type !== 'menu' && p.productType !== 'combo' && !hasVariants;
  }

  function _upsellProductPool() {
    return _products.filter(function (p) {
      p = _normalizeProduct(p);
      var isCurrent = _editingId && String(p.id) === String(_editingId);
      return !isCurrent && _isSimpleUpsellProduct(p);
    }).map(function (p) {
      p = _normalizeProduct(p);
      return { id: String(p.id), name: p.name || 'Produto', price: p.price || 0, img: _imageUrlFor(p, 'thumb') || _imageUrlFor(p, 'card') || _imageUrlFor(p, 'main') };
    });
  }

  function _upsellSelectedHtml(kind, ids) {
    ids = (ids || []).filter(Boolean).map(String);
    if (!ids.length) return '<div data-upsell-empty="' + kind + '" style="font-size:12px;color:#8A7E7C;padding:10px;border:1px dashed #D4C8C6;border-radius:9px;text-align:center;">Nenhum produto selecionado.</div>';
    return ids.map(function (id) {
      var p = _productForId(id) || {};
      var img = _imgForEntity(p);
      var imgHtml = img ? '<img src="' + _esc(img) + '" style="width:34px;height:34px;border-radius:8px;object-fit:cover;background:#F2EDED;flex-shrink:0;" onerror="this.style.display=\'none\';">' : '<div style="width:34px;height:34px;border-radius:8px;background:#F2EDED;display:flex;align-items:center;justify-content:center;color:#B9AAA6;flex-shrink:0;"><span class="mi" style="font-size:17px;">restaurant</span></div>';
      return '<div data-upsell-selected="' + kind + '" data-id="' + _esc(id) + '" style="display:grid;grid-template-columns:34px 1fr 26px;align-items:center;gap:9px;padding:8px 10px;border:1px solid #F2EDED;border-radius:9px;background:#fff;margin-bottom:6px;">' +
        imgHtml +
        '<div style="min-width:0;"><div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(p.name || id) + '</div><div style="font-size:12px;font-weight:800;color:#C4362A;">' + UI.fmt(p.price || 0) + '</div></div>' +
        '<button type="button" onclick="Modules.Catalogo._removeUpsellProduct(\'' + kind + '\', \'' + _esc(id) + '\')" style="width:26px;height:26px;border-radius:7px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;font-size:13px;flex-shrink:0;">x</button>' +
        '</div>';
    }).join('');
  }

  function _upsellCandidatesHtml(kind, ids) {
    var selected = {};
    (ids || []).forEach(function (id) { selected[String(id)] = true; });
    var rows = _upsellProductPool().filter(function (p) { return !selected[p.id]; });
    if (!rows.length) return '<div style="font-size:12px;color:#8A7E7C;padding:10px;">Nenhum produto disponível.</div>';
    return rows.map(function (p) {
      var imgHtml = p.img ? '<img src="' + _esc(p.img) + '" style="width:30px;height:30px;border-radius:7px;object-fit:cover;background:#F2EDED;flex-shrink:0;" onerror="this.style.display=\'none\';">' : '<span class="mi" style="font-size:17px;color:#B9AAA6;">restaurant</span>';
      return '<button type="button" data-upsell-candidate="' + kind + '" data-id="' + _esc(p.id) + '" data-name="' + _esc(p.name) + '" onclick="Modules.Catalogo._addUpsellProduct(\'' + kind + '\', \'' + _esc(p.id) + '\')" style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border:none;border-bottom:1px solid #F2EDED;background:#fff;text-align:left;cursor:pointer;font-family:inherit;">' +
        '<span style="display:flex;align-items:center;gap:8px;min-width:0;">' + imgHtml + '<span style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(p.name) + '</span></span><span style="font-size:11px;color:#C4362A;font-weight:800;">Adicionar</span></button>';
    }).join('');
  }

  function _upsellBlockHtml(kind, title, help, ids, discount) {
    var safeDiscount = parseFloat(String(discount || 0).replace(',', '.')) || 0;
    return '<div style="background:#fff;border:1px solid #F2EDED;border-radius:12px;padding:10px;min-width:0;">' +
      '<div style="font-size:13px;font-weight:800;margin-bottom:2px;">' + _esc(title) + '</div>' +
      '<div style="font-size:11px;color:#8A7E7C;line-height:1.35;margin-bottom:8px;">' + _esc(help) + '</div>' +
      '<div style="display:grid;grid-template-columns:minmax(0,1fr) 130px;gap:10px;margin-bottom:10px;">' +
      '<label style="display:block;min-width:0;"><span style="display:block;font-size:10px;font-weight:800;text-transform:uppercase;color:#8A7E7C;margin-bottom:3px;">Texto do bloco</span><input id="pm-upsell-title-' + kind + '" type="text" maxlength="42" value="' + _esc(title) + '" placeholder="Aumentar valor do pedido" style="width:100%;padding:8px;border:1.5px solid #D4C8C6;border-radius:8px;font-size:12px;font-family:inherit;outline:none;"></label>' +
      '<label style="display:block;min-width:0;"><span style="display:block;font-size:10px;font-weight:800;text-transform:uppercase;color:#8A7E7C;margin-bottom:3px;">Desconto (€)</span><input id="pm-upsell-discount-' + kind + '" type="number" min="0" step="0.01" value="' + (safeDiscount || '') + '" placeholder="0,00" style="width:100%;padding:8px;border:1.5px solid #D4C8C6;border-radius:8px;font-size:12px;font-family:inherit;outline:none;"></label>' +
      '</div>' +
      '<div id="pm-upsell-selected-' + kind + '" style="max-height:170px;overflow:auto;padding:8px;border:1px solid #F2EDED;border-radius:9px;background:#FCFAFA;margin-bottom:8px;">' + _upsellSelectedHtml(kind, ids) + '</div>' +
      '<input data-upsell-search="' + kind + '" oninput="Modules.Catalogo._filterUpsellProducts(\'' + kind + '\')" placeholder="Buscar produto..." style="width:100%;padding:9px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:12px;font-family:inherit;outline:none;margin-bottom:6px;">' +
      '<div id="pm-upsell-candidates-' + kind + '" style="max-height:150px;overflow:auto;border:1px solid #F2EDED;border-radius:9px;background:#fff;">' + _upsellCandidatesHtml(kind, ids) + '</div>' +
      '</div>';
  }

  function _refreshUpsellCandidates(kind) {
    var selectedBox = document.getElementById('pm-upsell-selected-' + kind);
    var candidatesBox = document.getElementById('pm-upsell-candidates-' + kind);
    if (!selectedBox || !candidatesBox) return;
    var ids = [].slice.call(selectedBox.querySelectorAll('[data-upsell-selected="' + kind + '"]')).map(function (x) { return x.dataset.id; });
    candidatesBox.innerHTML = _upsellCandidatesHtml(kind, ids);
    _filterUpsellProducts(kind);
  }

  function _addUpsellProduct(kind, id) {
    var selectedBox = document.getElementById('pm-upsell-selected-' + kind);
    if (!selectedBox) return;
    if (kind === 'pairing') selectedBox.innerHTML = '';
    if (selectedBox.querySelector('[data-id="' + String(id).replace(/"/g, '\\"') + '"]')) return;
    var empty = selectedBox.querySelector('[data-upsell-empty]');
    if (empty) empty.remove();
    selectedBox.insertAdjacentHTML('beforeend', _upsellSelectedHtml(kind, [id]));
    _refreshUpsellCandidates(kind);
  }

  function _removeUpsellProduct(kind, id) {
    var selectedBox = document.getElementById('pm-upsell-selected-' + kind);
    if (!selectedBox) return;
    var row = selectedBox.querySelector('[data-id="' + String(id).replace(/"/g, '\\"') + '"]');
    if (row) row.remove();
    if (!selectedBox.querySelector('[data-upsell-selected="' + kind + '"]')) {
      selectedBox.innerHTML = '<div data-upsell-empty="' + kind + '" style="font-size:12px;color:#8A7E7C;padding:10px;border:1px dashed #D4C8C6;border-radius:9px;text-align:center;">Nenhum produto selecionado.</div>';
    }
    _refreshUpsellCandidates(kind);
  }

  function _filterUpsellProducts(kind) {
    var input = document.querySelector('[data-upsell-search="' + kind + '"]');
    var q = ((input && input.value) || '').toLowerCase();
    var box = document.getElementById('pm-upsell-candidates-' + kind);
    if (!box) return;
    box.querySelectorAll('[data-upsell-candidate="' + kind + '"]').forEach(function (row) {
      var label = (row.dataset.name || '').toLowerCase();
      row.style.display = label.indexOf(q) >= 0 ? 'flex' : 'none';
    });
  }

  function _addMenuOption(idx, ref, label, img) {
    var selectedBox = document.getElementById('pm-menu-selected-' + idx);
    var candidatesBox = document.getElementById('pm-menu-candidates-' + idx);
    if (!selectedBox || !candidatesBox) return;
    if (selectedBox.querySelector('[data-ref="' + ref.replace(/"/g, '\\"') + '"]')) return;
    var empty = selectedBox.querySelector('[data-menu-empty]');
    if (empty) empty.remove();
    img = img || '';
    var imgHtml = img ? '<img src="' + _esc(img) + '" style="width:34px;height:34px;border-radius:8px;object-fit:cover;background:#F2EDED;flex-shrink:0;" onerror="this.style.display=\'none\';">' : '<div style="width:34px;height:34px;border-radius:8px;background:#F2EDED;display:flex;align-items:center;justify-content:center;color:#B9AAA6;flex-shrink:0;"><span class="mi" style="font-size:17px;">restaurant</span></div>';
    selectedBox.insertAdjacentHTML('beforeend',
      '<div data-menu-selected="' + idx + '" data-ref="' + _esc(ref) + '" data-label="' + _esc(label) + '" data-img="' + _esc(img) + '" style="display:grid;grid-template-columns:34px 1fr 95px 26px;align-items:center;gap:9px;padding:8px 10px;border:1px solid #F2EDED;border-radius:9px;background:#fff;margin-bottom:6px;">' +
      imgHtml +
      '<span style="font-size:13px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + _esc(label) + '</span>' +
      '<label style="display:block;"><span style="display:block;font-size:9px;font-weight:800;text-transform:uppercase;color:#8A7E7C;margin-bottom:2px;">Extra €</span><input data-menu-price="' + idx + '" type="number" step="0.01" value="" placeholder="0,00" style="width:100%;padding:6px;border:1.5px solid #D4C8C6;border-radius:7px;font-size:12px;font-family:inherit;outline:none;"></label>' +
      '<button type="button" onclick="Modules.Catalogo._removeMenuOption(' + idx + ', \'' + _esc(ref) + '\')" style="width:26px;height:26px;border-radius:7px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;font-size:13px;flex-shrink:0;">x</button>' +
      '</div>');
    var candidate = candidatesBox.querySelector('[data-ref="' + ref.replace(/"/g, '\\"') + '"]');
    if (candidate) candidate.remove();
  }

  function _removeMenuOption(idx, ref) {
    var selectedBox = document.getElementById('pm-menu-selected-' + idx);
    if (!selectedBox) return;
    var row = selectedBox.querySelector('[data-ref="' + ref.replace(/"/g, '\\"') + '"]');
    if (row) row.remove();
    if (!selectedBox.querySelector('[data-menu-selected]')) {
      selectedBox.innerHTML = '<div data-menu-empty="' + idx + '" style="font-size:12px;color:#8A7E7C;padding:10px;border:1px dashed #D4C8C6;border-radius:9px;text-align:center;">Nenhuma opção adicionada neste grupo.</div>';
    }
    _refreshMenuCandidates(idx);
  }

  function _filterMenuOptions(idx) {
    var input = document.querySelector('[data-menu-search="' + idx + '"]');
    var q = ((input && input.value) || '').toLowerCase();
    var box = document.getElementById('pm-menu-candidates-' + idx);
    if (!box) return;
    box.querySelectorAll('[data-menu-candidate]').forEach(function (row) {
      var label = (row.dataset.label || '').toLowerCase();
      row.style.display = label.indexOf(q) >= 0 ? 'flex' : 'none';
    });
  }

  function _refreshMenuCandidates(idx) {
    var box = document.getElementById('pm-menu-candidates-' + idx);
    var selectedBox = document.getElementById('pm-menu-selected-' + idx);
    if (!box || !selectedBox) return;
    var selected = {};
    selectedBox.querySelectorAll('[data-menu-selected]').forEach(function (row) { selected[row.dataset.ref] = true; });
    var rows = _menuOptionPool().filter(function (o) { return !selected[o.ref]; });
    box.innerHTML = rows.map(function (o) {
      var imgHtml = o.img ? '<img src="' + _esc(o.img) + '" style="width:30px;height:30px;border-radius:7px;object-fit:cover;background:#F2EDED;flex-shrink:0;" onerror="this.style.display=\'none\';">' : '<span class="mi" style="font-size:17px;color:#B9AAA6;">restaurant</span>';
      return '<button type="button" data-menu-candidate="' + idx + '" data-ref="' + _esc(o.ref) + '" data-label="' + _esc(o.label) + '" data-img="' + _esc(o.img || '') + '" onclick="Modules.Catalogo._addMenuOption(' + idx + ', \'' + _esc(o.ref) + '\', \'' + _esc(o.label) + '\', \'' + _esc(o.img || '') + '\')" style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border:none;border-bottom:1px solid #F2EDED;background:#fff;text-align:left;cursor:pointer;font-family:inherit;">' +
        '<span style="display:flex;align-items:center;gap:8px;min-width:0;">' + imgHtml + '<span style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(o.label) + '</span></span><span style="font-size:11px;color:#C4362A;font-weight:800;">Adicionar</span></button>';
    }).join('') || '<div style="font-size:12px;color:#8A7E7C;padding:10px;">Nenhuma opção disponível para adicionar.</div>';
    _filterMenuOptions(idx);
  }

  function _addMenuGroup() {
    var container = document.getElementById('pm-menu-groups');
    if (!container) return;
    var idx = window._pmMenuGroupCount || 0;
    window._pmMenuGroupCount = idx + 1;
    container.insertAdjacentHTML('beforeend', _menuGroupRowHtml(idx, { title: 'Escolha', min: 1, max: 1, options: [] }));
    makeSortable(container, function () {});
  }

  function _removeMenuGroup(idx) {
    var el = document.getElementById('pm-menu-group-' + idx);
    if (el) el.remove();
  }


  // Change F: Image file change
  function _onImgFileChange(event) {
    var file = event.target.files[0];
    if (!file) return;
    var draftId = window._pmDraftId || _editingId || _newEntityId('prod');
    window._pmDraftId = draftId;
    var authUser = window.Auth && typeof Auth.getUser === 'function' ? Auth.getUser() : null;
    var tenantId = window.Auth && typeof Auth.getTenantId === 'function' ? Auth.getTenantId() : '';
    console.info('[Catalogo] product image selected', {
      authUid: authUser && authUser.uid ? authUser.uid : '',
      tenantId: tenantId,
      productId: draftId,
      fileName: file.name || '',
      fileType: file.type || '',
      fileSizeKb: Math.round((file.size || 0) / 1024)
    });
    if (authUser && tenantId && authUser.uid !== tenantId) {
      console.warn('[Catalogo] tenant mismatch during image upload', {
        authUid: authUser.uid,
        tenantId: tenantId,
        productId: draftId
      });
    }
    var token = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 7);
    window._pmImageUploadToken = token;
    window._pmImageUploadPending = true;
    if (window._pmImagePreviewUrl) {
      try { URL.revokeObjectURL(window._pmImagePreviewUrl); } catch (e) {}
      window._pmImagePreviewUrl = '';
    }
    try {
      window._pmImagePreviewUrl = URL.createObjectURL(file);
      _refreshProductPreview();
    } catch (e) {}

    if (!USE_FIREBASE_STORAGE_UPLOAD) {
      _uploadProductImageLegacy(file, { tenantId: tenantId, productId: draftId }).then(function (result) {
        if (window._pmImageUploadToken !== token) return;
        console.info('[Catalogo] legacy product image published', {
          tenantId: tenantId,
          productId: draftId,
          imageUrl: result && result.imageUrl ? result.imageUrl : '',
          imageStoragePath: result && result.imageStoragePath ? result.imageStoragePath : ''
        });
        window._pmImageState = result;
        window._pmImageBase64 = null;
        window._pmImageUploadPending = false;
        if (window._pmImagePreviewUrl) {
          try { URL.revokeObjectURL(window._pmImagePreviewUrl); } catch (e) {}
          window._pmImagePreviewUrl = '';
        }
        var urlEl = document.getElementById('pm-img-url');
        if (urlEl) {
          urlEl.value = result.imageUrl || '';
          console.info('[Catalogo] legacy product image url field updated', {
            productId: draftId,
            imageUrl: urlEl.value
          });
        }
        _refreshProductPreview();
        UI.toast('Imagem publicada com sucesso.', 'success');
      }).catch(function (err) {
        if (window._pmImageUploadToken !== token) return;
        console.error('[Catalogo] legacy product image publish failed', {
          code: err && err.code,
          message: err && err.message,
          productId: draftId,
          tenantId: tenantId,
          authUid: authUser && authUser.uid ? authUser.uid : ''
        }, err);
        window._pmImageUploadPending = false;
        if (window._pmImagePreviewUrl) {
          try { URL.revokeObjectURL(window._pmImagePreviewUrl); } catch (e) {}
          window._pmImagePreviewUrl = '';
        }
        _refreshProductPreview();
        UI.toast('Não conseguimos publicar a imagem. Tente novamente. Imagem anterior mantida.', 'error');
        event.target.value = '';
      });
      return;
    }

    try {
      ImageTools.process(file, { kind: 'product', entityId: draftId }).then(function (result) {
        if (window._pmImageUploadToken !== token) return;
        console.info('[Catalogo] product image upload complete', {
          authUid: authUser && authUser.uid ? authUser.uid : '',
          tenantId: tenantId,
          productId: draftId,
          imageUrl: result && result.imageUrl ? result.imageUrl : '',
          imageCardUrl: result && result.imageCardUrl ? result.imageCardUrl : '',
          imageThumbUrl: result && result.imageThumbUrl ? result.imageThumbUrl : '',
          imageStoragePath: result && result.imageStoragePath ? result.imageStoragePath : ''
        });
        window._pmImageState = result;
        window._pmImageBase64 = null;
        window._pmImageUploadPending = false;
        if (window._pmImagePreviewUrl) {
          try { URL.revokeObjectURL(window._pmImagePreviewUrl); } catch (e) {}
          window._pmImagePreviewUrl = '';
        }
        var urlEl = document.getElementById('pm-img-url');
        if (urlEl) urlEl.value = result.imageUrl || '';
        _refreshProductPreview();
        UI.toast('Foto enviada com sucesso.', 'success');
      }).catch(function (err) {
        if (window._pmImageUploadToken !== token) return;
        console.error('[Catalogo] product image upload failed', {
          code: err && err.code,
          message: err && err.message,
          originalCode: err && err.originalCode,
          productId: draftId,
          tenantId: tenantId,
          authUid: authUser && authUser.uid ? authUser.uid : ''
        }, err);
        window._pmImageUploadPending = false;
        if (window._pmImagePreviewUrl) {
          try { URL.revokeObjectURL(window._pmImagePreviewUrl); } catch (e) {}
          window._pmImagePreviewUrl = '';
        }
        _refreshProductPreview();
        UI.toast(_productImageErrorMessage(err) + ' A imagem anterior foi mantida.', 'error');
        event.target.value = '';
      });
    } catch (err) {
      window._pmImageUploadPending = false;
      window._pmImageUploadToken = token + '-error';
      if (window._pmImagePreviewUrl) {
        try { URL.revokeObjectURL(window._pmImagePreviewUrl); } catch (e) {}
        window._pmImagePreviewUrl = '';
      }
      _refreshProductPreview();
      UI.toast(_productImageErrorMessage(err) + ' A imagem anterior foi mantida.', 'error');
      event.target.value = '';
    }
  }

  function _toggleVis() {
    window._pmVisible = !window._pmVisible;
    var btn = document.getElementById('pm-visible-toggle');
    if (btn) {
      btn.style.background = window._pmVisible ? '#C4362A' : '#D4C8C6';
      var span = btn.querySelector('span');
      if (span) span.style.transform = 'translateX(' + (window._pmVisible ? '18px' : '0') + ')';
    }
  }

  function _saveProduct() {
    var base = window._pmProductBase || (_editingId ? (_products.find(function (x) { return String(x.id) === String(_editingId); }) || {}) : {});
    var name = (document.getElementById('pm-name') || {}).value || '';
    if (!name) { UI.toast('Nome e obrigatorio', 'error'); return; }
    if (USE_FIREBASE_STORAGE_UPLOAD && window._pmImageUploadPending) {
      UI.toast('A imagem ainda está sendo enviada. Aguarde um instante.', 'info');
      return;
    }
    var priceInput = document.getElementById('pm-price');
    var rawPrice = priceInput ? String(priceInput.value || '').trim() : '';
    var salePrice = parseFloat(rawPrice.replace(',', '.'));
    if (!rawPrice || !isFinite(salePrice) || salePrice <= 0) {
      UI.toast('Informe o valor de venda do produto.', 'error');
      if (priceInput) priceInput.focus();
      return;
    }

    // Change B: tipo
    var tipoEl = document.querySelector('input[name="pm-tipo"]:checked');
    var tipo = tipoEl ? tipoEl.value : 'unico';

    var unicoSrcEl = document.querySelector('input[name="pm-unico-src"]:checked');
    var unicoSrc = unicoSrcEl ? unicoSrcEl.value : 'receita';
    var selectedProntoId = (document.getElementById('pm-pronto-id') || {}).value || '';
    if (tipo === 'unico' && unicoSrc === 'produto_pronto' && selectedProntoId) {
      unicoSrc = _prontoSourceForId(selectedProntoId);
    }

    // Change C: tags — from registered tag checkboxes
    var tags = [];
    document.querySelectorAll('.pm-tag-check:checked').forEach(function (cb) {
      tags.push({ id: cb.dataset.tagId, text: cb.dataset.tagText, bgColor: cb.dataset.tagBg, textColor: cb.dataset.tagColor });
    });

    // Change D: variantGroupIds
    var variantGroupIds = [];
    document.querySelectorAll('.pm-variant-check:checked').forEach(function (cb) {
      variantGroupIds.push(cb.dataset.vgid);
    });

    // Change B: menu choice groups
    var menuChoiceGroups = [];
    var menuItems = [];
    var menuContainer = document.getElementById('pm-menu-groups');
    if (menuContainer && tipo === 'menu') {
      menuContainer.querySelectorAll('.pm-menu-group').forEach(function (groupEl) {
        var idx = groupEl.dataset.menuGroup;
        var titleEl = groupEl.querySelector('[data-menu-title="' + idx + '"]');
        var minEl = groupEl.querySelector('[data-menu-min="' + idx + '"]');
        var maxEl = groupEl.querySelector('[data-menu-max="' + idx + '"]');
        var max = parseInt(maxEl ? maxEl.value : 1, 10) || 1;
        var min = parseInt(minEl ? minEl.value : max, 10);
        if (min < 0) min = 0;
        if (max < 1) max = 1;
        if (min > max) min = max;
        var options = [];
        groupEl.querySelectorAll('[data-menu-selected="' + idx + '"]').forEach(function (opt) {
          var priceEl = opt.querySelector('[data-menu-price="' + idx + '"]');
          options.push({
            ref: opt.dataset.ref,
            label: opt.dataset.label || opt.dataset.ref,
            priceExtra: parseFloat(priceEl ? priceEl.value : 0) || 0,
            img: opt.dataset.img || ''
          });
        });
        if (options.length) {
          menuChoiceGroups.push({ title: (titleEl ? titleEl.value : '') || 'Escolha', min: min, max: max, options: options });
          if (options.length === 1) menuItems.push({ ref: options[0].ref, qty: max });
        }
      });
    }

    // Change E: SEO
    var seoTitle = (document.getElementById('pm-seo-title') || {}).value || name;
    var seoDesc = (document.getElementById('pm-seo-desc') || {}).value || '';
    var seoSlug = (document.getElementById('pm-seo-slug') || {}).value || (base.slug || _toSlug(name));
    seoSlug = _uniqueProductSlug(seoSlug, _editingId);
    var seoKw = (document.getElementById('pm-seo-kw') || {}).value || '';
    var seoAlt = (document.getElementById('pm-seo-alt') || {}).value || name;

    var data = {
      name: name,
      price: salePrice,
      cost: _productCostFromState(base),
      custo: _productCostFromState(base),
      microcopy: (document.getElementById('pm-microcopy') || {}).value || '',
      shortDesc: (document.getElementById('pm-short-desc') || {}).value || '',
      fullDesc: (document.getElementById('pm-full-desc') || {}).value || '',
      description: (document.getElementById('pm-short-desc') || {}).value || '',
      categoryId: (document.getElementById('pm-cat') || {}).value || '',
      internalNote: (document.getElementById('pm-note') || {}).value || '',
      menuVisible: window._pmVisible !== false,
      // Change B
      type: tipo,
      unicoSource: tipo === 'unico' ? unicoSrc : null,
      fichaId: (tipo === 'unico' && unicoSrc === 'receita') ? ((document.getElementById('pm-ficha-id') || {}).value || '') : '',
      produtoProntoId: (tipo === 'unico' && (unicoSrc === 'produto_pronto' || unicoSrc === 'compras_produto')) ? selectedProntoId : '',
      sourceItemId: (tipo === 'unico' && unicoSrc === 'compras_produto') ? selectedProntoId : '',
      menuItems: tipo === 'menu' ? menuItems : [],
      menuChoiceGroups: tipo === 'menu' ? menuChoiceGroups : [],
      addAlsoIds: [].slice.call(document.querySelectorAll('[data-upsell-selected="addAlso"]')).map(function (x) { return x.dataset.id; }),
      addAlsoTitle: ((document.getElementById('pm-upsell-title-addAlso') || {}).value || 'Aumentar valor do pedido').trim(),
      addAlsoDiscount: parseFloat(String(((document.getElementById('pm-upsell-discount-addAlso') || {}).value || '0')).replace(',', '.')) || 0,
      pairing: null,
      // Change C
      tags: tags,
      // Change D
      variantGroupIds: variantGroupIds,
      // Change E
      seoTitle: seoTitle,
      seoDescription: seoDesc,
      slug: seoSlug,
      seoKeyword: seoKw,
      imageAlt: seoAlt
    };

    var imgState = window._pmImageState || null;
    if (imgState) {
      data.imageUrl = imgState.imageUrl || '';
      data.imageCardUrl = imgState.imageCardUrl || imgState.cardUrl || imgState.imageUrl || '';
      data.imageThumbUrl = imgState.imageThumbUrl || imgState.thumbUrl || imgState.imageCardUrl || imgState.imageUrl || '';
      data.imageStoragePath = imgState.imageStoragePath || '';
      data.imageWidth = imgState.imageWidth || null;
      data.imageHeight = imgState.imageHeight || null;
      data.imageSizeKb = imgState.imageSizeKb || null;
      data.imageFormat = imgState.imageFormat || 'webp';
    } else {
      var urlEl = document.getElementById('pm-img-url');
      if (urlEl) data.imageUrl = urlEl.value.trim();
    }

    var productId = _editingId || window._pmDraftId || _newEntityId('prod');
    data.id = productId;
    data.updatedAt = new Date().toISOString();
    if (!_editingId) {
      data.createdAt = new Date().toISOString();
      window._pmDraftId = productId;
    }

    var op = _editingId ? DB.update('products', _editingId, data) : DB.set('products', productId, data);
    op.then(function () {
      window._pmImageUploadPending = false;
      if (window._pmImagePreviewUrl) {
        try { URL.revokeObjectURL(window._pmImagePreviewUrl); } catch (e) {}
        window._pmImagePreviewUrl = '';
      }
      UI.toast(_editingId ? 'Produto atualizado!' : 'Produto adicionado!', 'success');
      if (window._productModal) window._productModal.close();
      _renderProdutos();
    }).catch(function (err) {
      console.error('[Catalogo] product save failed', {
        code: err && err.code,
        message: err && err.message,
        productId: productId,
        tenantId: tenantId,
        imageUrl: data.imageUrl || '',
        imageStoragePath: data.imageStoragePath || ''
      }, err);
      window._pmImageUploadPending = false;
      UI.toast('Erro: ' + err.message, 'error');
    });
  }

  function _deleteProduct(id) {
    UI.confirm('Eliminar este produto?').then(function (yes) {
      if (!yes) return;
      DB.remove('products', id).then(function () {
        UI.toast('Produto eliminado', 'info');
        _renderProdutos();
      });
    });
  }

  // ── CATEGORIAS ─────────────────────────────────────────────────────────────
  function _renderCategorias() {
    DB.getAll('categories').then(function (cats) {
      _categories = (cats || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      _paintCategorias();
    });
  }

  function _paintCategorias() {
    var content = document.getElementById('catalogo-content');
    if (!content) return;
    content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">' +
      '<h2 style="font-size:20px;font-weight:800;">Categorias (' + _categories.length + ')</h2>' +
      '<button onclick="Modules.Catalogo._openCatModal(null)" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Adicionar</button>' +
      '</div>' +
      (_categories.length === 0 ? UI.emptyState('Nenhuma categoria ainda', '') :
        '<div id="cat-list" style="display:flex;flex-direction:column;gap:10px;">' +
        _categories.map(function (c) {
          return '<div draggable="true" data-id="' + c.id + '" style="background:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 2px 8px rgba(0,0,0,.06);display:flex;align-items:center;gap:12px;cursor:grab;">' +
            '<span class="mi" style="color:#D4C8C6;font-size:16px;">drag_indicator</span>' +
            '<span style="flex:1;font-size:14px;font-weight:700;">' + _esc(c.name) + '</span>' +
            '<button onclick="Modules.Catalogo._openCatModal(\'' + c.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;"><span class="mi" style="font-size:14px;">edit</span></button>' +
            '<button onclick="Modules.Catalogo._deleteCat(\'' + c.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;"><span class="mi" style="font-size:14px;">delete</span></button>' +
            '</div>';
        }).join('') + '</div>');

    if (_categories.length > 0) {
      var listEl = document.getElementById('cat-list');
      if (listEl) {
        makeSortable(listEl, function (orders) {
          _categories = _categories.map(function (cat) {
            var found = orders.find(function (o) { return String(o.id) === String(cat.id); });
            return found ? Object.assign({}, cat, { order: found.order }) : cat;
          }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
          Promise.all(orders.map(function (o) { return DB.update('categories', o.id, { order: o.order }); }))
            .catch(function (err) { UI.toast('Erro ao salvar ordem: ' + err.message, 'error'); });
        });
      }
    }
  }

  function _openCatModal(id) {
    _editingId = id;
    var c = id ? (_categories.find(function (x) { return x.id === id; }) || {}) : {};
    var body = '<div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Nome *</label><input id="cat-name" type="text" value="' + _esc(c.name || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '</div>';

    var footer = '<button onclick="Modules.Catalogo._saveCat()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">' + (id ? 'Atualizar' : 'Adicionar') + '</button>';
    window._catModal = UI.modal({ title: id ? 'Editar Categoria' : 'Nova Categoria', body: body, footer: footer });
  }

  function _selectCatColor() {}

  function _saveCat() {
    var name = (document.getElementById('cat-name') || {}).value || '';
    if (!name) { UI.toast('Nome e obrigatorio', 'error'); return; }
    var data = { name: name };
    var op = _editingId ? DB.update('categories', _editingId, data) : DB.add('categories', data);
    op.then(function () {
      UI.toast('Categoria salva!', 'success');
      if (window._catModal) window._catModal.close();
      _renderCategorias();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _deleteCat(id) {
    UI.confirm('Eliminar esta categoria?').then(function (yes) {
      if (!yes) return;
      DB.remove('categories', id).then(function () { UI.toast('Eliminado', 'info'); _renderCategorias(); });
    });
  }

  // ── PRODUTOS PRONTOS (Change A) ────────────────────────────────────────────
  function _renderProdutosProntos() {
    DB.getAll('produtos_prontos').then(function (items) {
      _produtosProntos = items || [];
      _paintProdutosProntos();
    });
  }

  function _paintProdutosProntos() {
    var content = document.getElementById('catalogo-content');
    if (!content) return;
    content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">' +
      '<div><h2 style="font-size:20px;font-weight:800;margin-bottom:4px;">Produtos Prontos (' + _produtosProntos.length + ')</h2>' +
      '<p style="font-size:12px;color:#8A7E7C;">Produtos acabados que nao precisam de receita (ex: refrigerante, sopa).</p></div>' +
      '<button onclick="Modules.Catalogo._openProntosModal(null)" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Adicionar</button>' +
      '</div>' +
      (_produtosProntos.length === 0 ? UI.emptyState('Nenhum produto pronto ainda', '') :
        '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
        '<thead><tr style="background:#F2EDED;">' +
        '<th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Nome</th>' +
        '<th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Unidade</th>' +
        '<th style="padding:12px 16px;text-align:right;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Preco compra</th>' +
        '<th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Fornecedor</th>' +
        '<th style="padding:12px 4px;text-align:right;"></th>' +
        '</tr></thead><tbody>' +
        _produtosProntos.map(function (pp) {
          return '<tr style="border-top:1px solid #F2EDED;">' +
            '<td style="padding:12px 16px;font-size:13px;font-weight:700;">' + _esc(pp.name) + '</td>' +
            '<td style="padding:12px 16px;font-size:13px;color:#8A7E7C;">' + _esc(pp.unit || '—') + '</td>' +
            '<td style="padding:12px 16px;font-size:13px;text-align:right;">' + UI.fmt(pp.purchasePrice || 0) + '</td>' +
            '<td style="padding:12px 16px;font-size:13px;color:#8A7E7C;">' + _esc(pp.supplier || '—') + '</td>' +
            '<td style="padding:12px 8px;text-align:right;">' +
            '<button onclick="Modules.Catalogo._openProntosModal(\'' + pp.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;margin-right:4px;"><span class="mi" style="font-size:14px;">edit</span></button>' +
            '<button onclick="Modules.Catalogo._deletePronto(\'' + pp.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;"><span class="mi" style="font-size:14px;">delete</span></button>' +
            '</td></tr>';
        }).join('') + '</tbody></table></div>');
  }

  function _openProntosModal(id) {
    _editingId = id;
    var pp = id ? (_produtosProntos.find(function (x) { return x.id === id; }) || {}) : {};
    window._ppDraftId = id || _newEntityId('pronto');
    window._ppImageState = null;
    Promise.all([DB.getAll('fornecedores'), DB.getAll('unidades_medida')]).then(function (r) {
      var fornecedores = r[0] || [];
      var unidades = r[1] || [];
      var supplierOpts = '<option value="">Sem fornecedor</option>' +
        fornecedores.map(function (f) {
          return '<option value="' + _esc(f.name) + '"' + (pp.supplier === f.name ? ' selected' : '') + '>' + _esc(f.name) + '</option>';
        }).join('');
      var unitOpts = '<option value="">Selecionar unidade</option>' +
        unidades.map(function (u) {
          var val = u.symbol || u.name;
          return '<option value="' + _esc(val) + '"' + (pp.unit === val ? ' selected' : '') + '>' + _esc(u.name) + ' (' + _esc(u.symbol) + ')</option>';
        }).join('');
      var imgPreview = _imageUrlFor(pp, 'card')
        ? '<img id="pp-img-preview" src="' + _imageUrlFor(pp, 'card') + '" style="max-width:100%;max-height:100px;border-radius:9px;margin-top:8px;display:block;">'
        : '<img id="pp-img-preview" style="max-width:100%;max-height:100px;border-radius:9px;margin-top:8px;display:none;">';
      var body = '<div>' +
        '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Nome *</label>' +
        '<input id="pp-name" type="text" value="' + _esc(pp.name || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
        '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Unidade</label>' +
        '<select id="pp-unit" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;background:#fff;">' + unitOpts + '</select></div>' +
        '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Preco de Compra (EUR)</label>' +
        '<input id="pp-price" type="number" step="0.01" value="' + (pp.purchasePrice || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
        '</div>' +
        '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Fornecedor</label>' +
        '<select id="pp-supplier" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;background:#fff;">' + supplierOpts + '</select></div>' +
        '<div style="margin-bottom:4px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Imagem</label>' +
        '<input type="file" id="pp-img-file" accept="image/jpeg,image/jpg,image/png,image/webp" onchange="Modules.Catalogo._onProntoImgChange(event)" style="width:100%;padding:8px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;">' +
        '<div style="margin-top:6px;font-size:11px;line-height:1.45;color:#8A7E7C;">' + _imageUploadTip('product') + '</div>' +
        imgPreview + '</div>' +
        '</div>';
      var footer = '<button onclick="Modules.Catalogo._savePronto()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">' + (id ? 'Atualizar' : 'Adicionar') + '</button>';
      window._prontosModal = UI.modal({ title: id ? 'Editar Produto Pronto' : 'Novo Produto Pronto', body: body, footer: footer });
    });
  }

  function _onProntoImgChange(event) {
    var file = event.target.files[0];
    if (!file) return;
    var draftId = window._ppDraftId || _editingId || _newEntityId('pronto');
    window._ppDraftId = draftId;
    ImageTools.process(file, { kind: 'product', folder: 'products-ready', entityId: draftId }).then(function (result) {
      window._ppImageState = result;
      window._ppImageBase64 = null;
      var preview = document.getElementById('pp-img-preview');
      if (preview) { preview.src = result.imageUrl || ''; preview.style.display = 'block'; }
      UI.toast('Imagem otimizada com sucesso.', 'success');
    }).catch(function (err) {
      console.error('Imagem do produto pronto', err);
      UI.toast(err && err.message ? err.message : 'Erro ao otimizar imagem.', 'error');
      event.target.value = '';
    });
  }

  function _savePronto() {
    var name = (document.getElementById('pp-name') || {}).value || '';
    if (!name) { UI.toast('Nome e obrigatorio', 'error'); return; }
    var data = {
      name: name,
      unit: (document.getElementById('pp-unit') || {}).value || '',
      purchasePrice: parseFloat((document.getElementById('pp-price') || {}).value) || 0,
      supplier: (document.getElementById('pp-supplier') || {}).value || ''
    };
    var imgState = window._ppImageState || null;
    if (imgState) {
      data.imageUrl = imgState.imageUrl || '';
      data.imageCardUrl = imgState.imageCardUrl || imgState.cardUrl || imgState.imageUrl || '';
      data.imageThumbUrl = imgState.imageThumbUrl || imgState.thumbUrl || imgState.imageCardUrl || imgState.imageUrl || '';
      data.imageStoragePath = imgState.imageStoragePath || '';
      data.imageWidth = imgState.imageWidth || null;
      data.imageHeight = imgState.imageHeight || null;
      data.imageSizeKb = imgState.imageSizeKb || null;
      data.imageFormat = imgState.imageFormat || 'webp';
    }
    var prontoId = _editingId || window._ppDraftId || _newEntityId('pronto');
    data.id = prontoId;
    data.updatedAt = new Date().toISOString();
    if (!_editingId) {
      data.createdAt = new Date().toISOString();
      window._ppDraftId = prontoId;
    }
    var op = _editingId ? DB.update('produtos_prontos', _editingId, data) : DB.set('produtos_prontos', prontoId, data);
    op.then(function () {
      UI.toast('Produto pronto salvo!', 'success');
      if (window._prontosModal) window._prontosModal.close();
      _renderProdutosProntos();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _deletePronto(id) {
    UI.confirm('Eliminar este produto pronto?').then(function (yes) {
      if (!yes) return;
      DB.remove('produtos_prontos', id).then(function () { UI.toast('Eliminado', 'info'); _renderProdutosProntos(); });
    });
  }

  // ── VARIANTES ─────────────────────────────────────────────────────────────
  function _renderVariantes(mode) {
    DB.getAll('variantGroups').then(function (vgs) {
      _variants = (vgs || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      _paintVariantes(mode);
    });
  }

  function _paintVariantes(mode) {
    var content = document.getElementById('catalogo-content');
    if (!content) return;
    var isExtras = mode === 'extras';
    var title = isExtras ? 'Extras' : 'Grupos de Variantes';
    var addLabel = isExtras ? '+ Novo Extra' : '+ Novo Grupo';
    content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">' +
      '<h2 style="font-size:20px;font-weight:800;">' + title + '</h2>' +
      '<button onclick="Modules.Catalogo._openVariantModal(null)" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">' + addLabel + '</button>' +
      '</div>' +
      '<p style="font-size:12px;color:#8A7E7C;margin-bottom:16px;line-height:1.5;">Crie grupos reutilizaveis de variantes (tamanhos, extras, etc.) e associe-os aos produtos.</p>' +
      (_variants.length === 0 ? UI.emptyState('Nenhum grupo de variantes', '') :
        '<div id="variants-list" style="display:flex;flex-direction:column;gap:12px;">' +
        _variants.map(function (vg) {
          return '<div draggable="true" data-id="' + vg.id + '" style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.06);cursor:grab;">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
            '<span class="mi" style="color:#D4C8C6;font-size:18px;">drag_indicator</span>' +
            '<div>' +
            '<div style="font-size:14px;font-weight:800;">' + _esc(vg.title) + '</div>' +
            '<div style="font-size:11px;color:#8A7E7C;">' + (vg.required ? 'Obrigatorio' : 'Opcional') + ' · ' + (vg.multiSelect ? 'Multi-selecao' : 'Selecao unica') + '</div>' +
            '</div></div>' +
            '<div style="display:flex;gap:6px;">' +
            '<button onclick="Modules.Catalogo._openVariantModal(\'' + vg.id + '\')" style="width:30px;height:30px;border-radius:8px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;"><span class="mi" style="font-size:14px;">edit</span></button>' +
            '<button onclick="Modules.Catalogo._deleteVariant(\'' + vg.id + '\')" style="width:30px;height:30px;border-radius:8px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;"><span class="mi" style="font-size:14px;">delete</span></button>' +
            '</div></div>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
            (vg.options || []).map(function (opt) {
              return '<span style="font-size:12px;font-weight:600;padding:4px 10px;border-radius:20px;background:#F2EDED;">' + _esc(opt.label) + (opt.price ? ' (+' + UI.fmt(opt.price) + ')' : '') + '</span>';
            }).join('') +
            '</div></div>';
        }).join('') + '</div>');

    if (_variants.length > 0) {
      var listEl = document.getElementById('variants-list');
      if (listEl) {
        makeSortable(listEl, function (orders) {
          orders.forEach(function (o) { DB.update('variantGroups', o.id, { order: o.order }); });
        });
      }
    }
  }

  function _openVariantModal(id) {
    _editingId = id;
    var vg = id ? (_variants.find(function (x) { return x.id === id; }) || {}) : {};
    var opts = (vg.options || []).map(function (o) { return o.label + (o.price ? ':' + o.price : ''); }).join('\n');

    var body = '<div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Titulo do Grupo *</label>' +
      '<input id="vg-title" type="text" value="' + _esc(vg.title || '') + '" placeholder="Ex: Tamanho, Molhos..." style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
      '<div style="display:flex;align-items:center;gap:8px;padding:10px;background:#F2EDED;border-radius:9px;">' +
      '<input type="checkbox" id="vg-required"' + (vg.required ? ' checked' : '') + ' style="width:16px;height:16px;accent-color:#C4362A;">' +
      '<label for="vg-required" style="font-size:13px;font-weight:600;cursor:pointer;">Obrigatorio</label></div>' +
      '<div style="display:flex;align-items:center;gap:8px;padding:10px;background:#F2EDED;border-radius:9px;">' +
      '<input type="checkbox" id="vg-multi"' + (vg.multiSelect ? ' checked' : '') + ' style="width:16px;height:16px;accent-color:#C4362A;">' +
      '<label for="vg-multi" style="font-size:13px;font-weight:600;cursor:pointer;">Multi-selecao</label></div>' +
      '</div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Opcoes (uma por linha, formato: Label ou Label:Preco)</label>' +
      '<textarea id="vg-options" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;min-height:100px;resize:vertical;" placeholder="Pequeno\nMedio:2\nGrande:4">' + opts + '</textarea></div>' +
      '</div>';

    var footer = '<button onclick="Modules.Catalogo._saveVariant()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">' + (id ? 'Atualizar' : 'Criar Grupo') + '</button>';
    window._variantModal = UI.modal({ title: id ? 'Editar Grupo' : 'Novo Grupo de Variantes', body: body, footer: footer });
  }

  function _saveVariant() {
    var title = (document.getElementById('vg-title') || {}).value || '';
    if (!title) { UI.toast('Titulo e obrigatorio', 'error'); return; }
    var lines = ((document.getElementById('vg-options') || {}).value || '').split('\n').filter(function (l) { return l.trim(); });
    var options = lines.map(function (l) {
      var parts = l.split(':');
      return { label: parts[0].trim(), price: parts[1] ? parseFloat(parts[1]) : 0 };
    });
    var data = {
      title: title,
      required: !!(document.getElementById('vg-required') || {}).checked,
      multiSelect: !!(document.getElementById('vg-multi') || {}).checked,
      options: options
    };
    var op = _editingId ? DB.update('variantGroups', _editingId, data) : DB.add('variantGroups', data);
    op.then(function () {
      UI.toast('Grupo salvo!', 'success');
      if (window._variantModal) window._variantModal.close();
      _renderVariantes();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _deleteVariant(id) {
    UI.confirm('Eliminar este grupo?').then(function (yes) {
      if (!yes) return;
      DB.remove('variantGroups', id).then(function () { UI.toast('Eliminado', 'info'); _renderVariantes(); });
    });
  }

  // ── ITENS DE CUSTO (replaces Insumos) ─────────────────────────────────────
  var _itensCusto = [];
  var _itensCustoFilter = 'todos';

  var TIPO_CATEGORIAS = {
    'Ingrediente': ['Laticínios','Secos','Proteínas','Hortifruti','Temperos','Bebidas','Outros'],
    'Embalagem': ['Caixa','Saco','Etiqueta','Pote','Guardanapo','Sacola','Outros'],
    'Material operacional': ['Limpeza','Segurança','Produção','Descartável','Outros'],
    'Escritório / administrativo': ['Papelaria','Impressão','Sistema','Outros']
  };

  var UNIDADES_COMPRA_MAP = { 'L': {fator: 1000, base: 'ml'}, 'ml': {fator: 1, base: 'ml'}, 'Kg': {fator: 1000, base: 'g'}, 'g': {fator: 1, base: 'g'}, 'unidade': {fator: 1, base: 'unidade'} };

  function _renderItensCusto() {
    DB.getAll('itens_custo').then(function(items) {
      _itensCusto = (items || []).sort(function(a,b){ return (a.nome||'').localeCompare(b.nome||''); });
      _paintItensCusto();
    });
  }

  function _paintItensCusto() {
    var content = document.getElementById('catalogo-content');
    if (!content) return;
    var filtered = _itensCustoFilter === 'todos' ? _itensCusto : _itensCusto.filter(function(x){ return x.tipo === _itensCustoFilter; });
    var filterBtns = ['todos','Ingrediente','Embalagem','Material operacional','Escritório / administrativo'].map(function(f) {
      var label = f === 'todos' ? 'Todos' : f;
      var active = _itensCustoFilter === f;
      return '<button onclick="Modules.Catalogo._setItensCustoFilter(\''+f+'\')" style="padding:6px 14px;border-radius:20px;border:1.5px solid '+(active?'#C4362A':'#D4C8C6')+';background:'+(active?'#C4362A':'transparent')+';color:'+(active?'#fff':'#8A7E7C')+';font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">'+_esc(label)+'</button>';
    }).join('');
    content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">' +
      '<h2 style="font-size:20px;font-weight:800;">Itens de Custo ('+_itensCusto.length+')</h2>' +
      '<button onclick="Modules.Catalogo._openItemCustoModal(null)" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Adicionar Item</button>' +
      '</div>' +
      '<div style="margin-bottom:12px;"><input id="itens-custo-search" type="text" placeholder="Pesquisar item..." oninput="Modules.Catalogo._filterItensCusto()" style="width:100%;padding:10px 14px;border:1.5px solid #D4C8C6;border-radius:20px;font-size:13px;font-family:inherit;outline:none;"></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">'+filterBtns+'</div>' +
      (filtered.length === 0 ? UI.emptyState('Nenhum item de custo', '') :
        '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
        '<thead><tr style="background:#F2EDED;">' +
        '<th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Nome</th>' +
        '<th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Tipo</th>' +
        '<th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Categoria</th>' +
        '<th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Unidade</th>' +
        '<th style="padding:12px 16px;text-align:right;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Custo atual</th>' +
        '<th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Fornecedor</th>' +
        '<th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Última compra</th>' +
        '<th style="padding:12px 4px;text-align:right;"></th>' +
        '</tr></thead><tbody id="itens-custo-tbody">' +
        filtered.map(function(item){ return _itemCustoRowHtml(item); }).join('') +
        '</tbody></table></div>');
  }

  function _itemCustoRowHtml(item) {
    var custo = item.custo_atual > 0 ? _fmtCusto(item.custo_atual, item.unidade_base) : '<span style="color:#D4C8C6;font-size:12px;">sem compra</span>';
    var ultima = item.ultima_compra_data ? UI.fmtDate(new Date(item.ultima_compra_data)) : '—';
    var ativoStyle = item.ativo === false ? 'opacity:0.5;' : '';
    return '<tr data-item-nome="'+_esc((item.nome||'').toLowerCase())+'" data-item-tipo="'+_esc(item.tipo||'')+'" style="border-top:1px solid #F2EDED;'+ativoStyle+'">' +
      '<td style="padding:12px 16px;font-size:13px;font-weight:700;">'+_esc(item.nome||'')+(item.ativo===false ? ' <span style="font-size:10px;color:#8A7E7C;">(inativo)</span>' : '')+'</td>' +
      '<td style="padding:12px 16px;font-size:12px;">'+UI.badge(item.tipo||'—','blue')+'</td>' +
      '<td style="padding:12px 16px;font-size:13px;color:#8A7E7C;">'+_esc(item.categoria||'—')+'</td>' +
      '<td style="padding:12px 16px;font-size:13px;color:#8A7E7C;">'+_esc(item.unidade_base||'—')+'</td>' +
      '<td style="padding:12px 16px;font-size:13px;text-align:right;font-weight:700;">'+custo+'</td>' +
      '<td style="padding:12px 16px;font-size:13px;color:#8A7E7C;">'+_esc(item._fornecedor_nome||'—')+'</td>' +
      '<td style="padding:12px 16px;font-size:13px;color:#8A7E7C;">'+ultima+'</td>' +
      '<td style="padding:12px 8px;text-align:right;">' +
      '<button onclick="Modules.Catalogo._openItemCustoModal(\''+item.id+'\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;margin-right:4px;"><span class="mi" style="font-size:14px;">edit</span></button>' +
      '<button onclick="Modules.Catalogo._deleteItemCusto(\''+item.id+'\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;"><span class="mi" style="font-size:14px;">delete</span></button>' +
      '</td></tr>';
  }

  function _fmtCusto(valor, unidade) {
    if (!valor) return '—';
    var decimais = valor < 0.01 ? 6 : valor < 0.1 ? 4 : 2;
    return '€'+valor.toFixed(decimais)+'/'+(_esc(unidade||'un'));
  }

  function _setItensCustoFilter(f) {
    _itensCustoFilter = f;
    _paintItensCusto();
  }

  function _filterItensCusto() {
    var search = ((document.getElementById('itens-custo-search')||{}).value||'').toLowerCase();
    var tbody = document.getElementById('itens-custo-tbody');
    if (!tbody) return;
    tbody.querySelectorAll('tr[data-item-nome]').forEach(function(row){
      var nome = row.dataset.itemNome||'';
      var tipo = row.dataset.itemTipo||'';
      var matchSearch = nome.indexOf(search) >= 0;
      var matchFilter = _itensCustoFilter === 'todos' || tipo === _itensCustoFilter;
      row.style.display = (matchSearch && matchFilter) ? '' : 'none';
    });
  }

  function _openItemCustoModal(id) {
    _editingId = id;
    var item = id ? (_itensCusto.find(function(x){ return x.id === id; })||{}) : {};
    Promise.all([DB.getAll('fornecedores')]).then(function(r) {
      var fornecedores = r[0]||[];
      var tipoOptions = ['Ingrediente','Embalagem','Material operacional','Escritório / administrativo'].map(function(t){
        return '<option value="'+t+'"'+(item.tipo===t?' selected':'')+'>'+t+'</option>';
      }).join('');
      var catOptions = _buildCatOptions(item.tipo||'Ingrediente', item.categoria||'');
      var fornOptions = '<option value="">Sem fornecedor padrão</option>'+fornecedores.map(function(f){
        return '<option value="'+f.id+'"'+(item.fornecedor_padrao_id===f.id?' selected':'')+'>'+_esc(f.nome||f.name||'')+'</option>';
      }).join('');
      var histHtml = '';
      if (id && item.custo_atual) {
        histHtml = '<div style="margin-top:12px;padding:12px;background:#F2EDED;border-radius:10px;font-size:12px;">' +
          '<strong>Custo atual:</strong> '+_fmtCusto(item.custo_atual, item.unidade_base)+
          (item.ultima_compra_data ? ' &nbsp;|&nbsp; <strong>Última compra:</strong> '+UI.fmtDate(new Date(item.ultima_compra_data)) : '')+
          '<br><span style="color:#8A7E7C;font-size:11px;">O custo é atualizado automaticamente ao registrar uma compra.</span></div>';
      }
      var body = '<div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
        '<div class="full" style="grid-column:1/-1;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Nome *</label>' +
        '<input id="ic-nome" type="text" value="'+_esc(item.nome||'')+'" placeholder="ex: Leite integral" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
        '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Tipo *</label>' +
        '<select id="ic-tipo" onchange="Modules.Catalogo._onItemTipoChange()" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;background:#fff;"><option value="">Selecionar...</option>'+tipoOptions+'</select></div>' +
        '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Categoria *</label>' +
        '<select id="ic-cat" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;background:#fff;">'+catOptions+'</select></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">' +
        '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Unidade base *</label>' +
        '<select id="ic-unidade" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;background:#fff;">' +
        ['g','ml','unidade'].map(function(u){ return '<option value="'+u+'"'+(item.unidade_base===u?' selected':'')+'>'+u+'</option>'; }).join('')+
        '</select></div>' +
        '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Aproveitamento (%)</label>' +
        '<input id="ic-aprov" type="number" min="1" max="100" value="'+(item.aproveitamento_padrao||100)+'" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
        '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Fornecedor padrão</label>' +
        '<select id="ic-fornecedor" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;background:#fff;">'+fornOptions+'</select></div>' +
        '</div>' +
        '<div style="margin-bottom:12px;display:flex;align-items:center;gap:10px;">' +
        '<input type="checkbox" id="ic-ativo"'+(item.ativo===false?'':' checked')+' style="width:16px;height:16px;accent-color:#C4362A;">' +
        '<label for="ic-ativo" style="font-size:13px;font-weight:600;cursor:pointer;">Ativo</label></div>' +
        histHtml +
        '</div>';
      var footer = '<button onclick="Modules.Catalogo._saveItemCusto()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">'+(id?'Atualizar':'Adicionar')+'</button>';
      window._icModal = UI.modal({ title: id ? 'Editar Item de Custo' : 'Novo Item de Custo', body: body, footer: footer });
    });
  }

  function _buildCatOptions(tipo, selected) {
    var cats = TIPO_CATEGORIAS[tipo] || [];
    return '<option value="">Selecionar...</option>'+cats.map(function(c){
      return '<option value="'+c+'"'+(selected===c?' selected':'')+'>'+c+'</option>';
    }).join('');
  }

  function _onItemTipoChange() {
    var tipo = (document.getElementById('ic-tipo')||{}).value||'';
    var catSel = document.getElementById('ic-cat');
    if (catSel) catSel.innerHTML = _buildCatOptions(tipo, '');
  }

  function _saveItemCusto() {
    var nome = ((document.getElementById('ic-nome')||{}).value||'').trim();
    var tipo = (document.getElementById('ic-tipo')||{}).value||'';
    var cat  = (document.getElementById('ic-cat')||{}).value||'';
    var unidade = (document.getElementById('ic-unidade')||{}).value||'';
    if (!nome) { UI.toast('Nome obrigatório', 'error'); return; }
    if (!tipo) { UI.toast('Tipo obrigatório', 'error'); return; }
    if (!cat)  { UI.toast('Categoria obrigatória', 'error'); return; }
    if (!unidade) { UI.toast('Unidade base obrigatória', 'error'); return; }
    var aprov = parseFloat((document.getElementById('ic-aprov')||{}).value)||100;
    if (aprov < 1 || aprov > 100) { UI.toast('Aproveitamento deve ser entre 1 e 100', 'error'); return; }
    var data = {
      nome: nome, tipo: tipo, categoria: cat, unidade_base: unidade,
      aproveitamento_padrao: aprov,
      fornecedor_padrao_id: (document.getElementById('ic-fornecedor')||{}).value||'',
      ativo: (document.getElementById('ic-ativo')||{}).checked !== false,
      atualizado_em: new Date().toISOString()
    };
    if (!_editingId) data.criado_em = new Date().toISOString();
    var op = _editingId ? DB.update('itens_custo', _editingId, data) : DB.add('itens_custo', data);
    op.then(function(){
      UI.toast('Item salvo!', 'success');
      if (window._icModal) window._icModal.close();
      _renderItensCusto();
    }).catch(function(err){ UI.toast('Erro: '+err.message, 'error'); });
  }

  function _deleteItemCusto(id) {
    UI.confirm('Inativar este item? (ele continuará salvo)').then(function(yes){
      if (!yes) return;
      DB.update('itens_custo', id, { ativo: false, atualizado_em: new Date().toISOString() }).then(function(){
        UI.toast('Item inativado', 'info'); _renderItensCusto();
      });
    });
  }

  // ── FICHAS TÉCNICAS ───────────────────────────────────────────────────────
  function _renderFichas() {
    Promise.all([DB.getAll('fichasTecnicas'), DB.getAll('itens_custo'), DB.getDocRoot('config', 'geral'), DB.getAll('recipe_categories'), DB.getAll('recipe_components'), DB.getAll('financeiro_saidas'), DB.getAll('financeiro_apagar')]).then(function (r) {
      _fichas = r[0] || [];
      _itensCusto = (r[1] || []).filter(function (item) {
        return item.ativo !== false && item.classe !== 'produto' && item.usar_em_fichas !== false;
      });
      _recipeConfig = r[2] || {};
      _recipeCategories = r[3] || [];
      _recipeComponents = r[4] || [];
      _financeSaidas = r[5] || [];
      _financeApagar = r[6] || [];
      _paintFichas();
    });
  }

  function _paintFichas() {
    var content = document.getElementById('catalogo-content');
    if (!content) return;
    content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">' +
      '<h2 style="font-size:20px;font-weight:800;">Receitas (' + _fichas.length + ')</h2>' +
      '<button onclick="Modules.Catalogo._openFichaModal(null)" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Nova Receita</button>' +
      '</div>' +
      '<div style="margin-bottom:14px;">' +
      '<input id="fichas-search" type="text" placeholder="Pesquisar receita..." oninput="Modules.Catalogo._filterFichas()" style="width:100%;padding:10px 14px;border:1.5px solid #D4C8C6;border-radius:20px;font-size:13px;font-family:inherit;outline:none;">' +
      '</div>' +
      (_fichas.length === 0 ? UI.emptyState('Nenhuma receita ainda', '') :
        '<div id="fichas-list" style="display:flex;flex-direction:column;gap:12px;">' +
        _fichas.map(function (f) {
          var ci = _calcFichaCosts(f);
          var yieldLabel = (f.yieldQuantity || f.yield || 1) + ' ' + (f.yieldUnit || 'porções');
          var costUnit = ci.costPerYield > 0 ? UI.fmt(ci.costPerYield) + '/' + (f.yieldUnit ? f.yieldUnit.replace(/s$/, '') : 'porção') : '—';
          var catBadge = f.category ? (' ' + UI.badge(f.category, 'gray')) : '';
          var img = f.imageThumbUrl || f.imageCardUrl || f.imageBase64 || f.imageUrl || '';
          var imgHtml = img
            ? '<img src="' + _esc(img) + '" style="width:74px;height:74px;border-radius:12px;object-fit:cover;background:#F2EDED;flex-shrink:0;" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';"><div style="width:74px;height:74px;border-radius:12px;background:#F2EDED;display:none;align-items:center;justify-content:center;color:#B9AAA6;flex-shrink:0;"><span class="mi">receipt_long</span></div>'
            : '<div style="width:74px;height:74px;border-radius:12px;background:#F2EDED;display:flex;align-items:center;justify-content:center;color:#B9AAA6;flex-shrink:0;"><span class="mi">receipt_long</span></div>';
          return '<div data-ficha-name="' + _esc(((f.name || '') + ' ' + (f.category || '')).toLowerCase()) + '" onclick="Modules.Catalogo._openFichaViewModal(\'' + f.id + '\')" style="background:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 2px 8px rgba(0,0,0,.06);cursor:pointer;display:flex;align-items:center;gap:14px;">' +
            imgHtml +
            '<div style="min-width:0;flex:1;">' +
            '<div style="font-size:15px;font-weight:800;margin-bottom:4px;">' + _esc(f.name) + '</div>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">' + catBadge + '</div>' +
            '<div style="font-size:12px;color:#8A7E7C;">Rendimento: <strong>' + _esc(yieldLabel) + '</strong> &nbsp;·&nbsp; Custo total: <strong style="color:#C4362A;">' + UI.fmt(ci.totalCost) + '</strong> &nbsp;·&nbsp; Por unidade: <strong>' + costUnit + '</strong></div>' +
            '</div>' +
            '<div style="display:flex;gap:6px;flex-shrink:0;margin-left:12px;">' +
            '<button onclick="event.stopPropagation();Modules.Catalogo._openFichaModal(\'' + f.id + '\')" style="width:30px;height:30px;border-radius:8px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;"><span class="mi" style="font-size:14px;">edit</span></button>' +
            '<button onclick="event.stopPropagation();Modules.Catalogo._deleteFicha(\'' + f.id + '\')" style="width:30px;height:30px;border-radius:8px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;"><span class="mi" style="font-size:14px;">delete</span></button>' +
            '</div></div>';
        }).join('') + '</div>');
  }

  function _calcFichaCosts(f) {
    var yieldQty = parseFloat(f.yieldQuantity || f.yield) || 1;
    var costs = _calcFichaComponentCosts(_normalizeFichaComponents(f));
    var indirectInfo = _getIndirectCostInfo();
    var indirect = costs.direct * (indirectInfo.percent / 100);
    var totalCost = costs.direct + indirect;
    return {
      ingredientCost: costs.ingredients,
      packagingCost: costs.packaging,
      directCost: costs.direct,
      indirectCostModeUsed: indirectInfo.modeUsed,
      indirectCostPercent: indirectInfo.percent,
      indirectCost: indirect,
      totalCost: totalCost,
      costPerYield: yieldQty > 0 ? totalCost / yieldQty : 0
    };
  }

  function _filterFichas() {
    var search = ((document.getElementById('fichas-search') || {}).value || '').toLowerCase();
    var list = document.getElementById('fichas-list');
    if (!list) return;
    list.querySelectorAll('[data-ficha-name]').forEach(function (el) {
      el.style.display = (el.dataset.fichaName || '').indexOf(search) >= 0 ? '' : 'none';
    });
  }

  function _parseFichaNum(val) {
    if (val == null || val === '') return 0;
    return parseFloat(String(val).replace(',', '.')) || 0;
  }

  function _getIndirectCostPercent() {
    return _getIndirectCostInfo().percent;
  }

  function _getManualIndirectCostPercent() {
    return _parseFichaNum(_recipeConfig.indirectCostPercent || _recipeConfig.percentualCustosIndiretos || 0);
  }

  function _financeRecordDate(item) {
    return item ? (item.date || item.dueDate || item.paidAt || item.createdAt || '') : '';
  }

  function _financeCostClass(item) {
    if (item && item.costClass) return item.costClass;
    if (item && item.tipoSaida === 'Custo Produção') return 'direto';
    return 'despesa';
  }

  function _getIndirectCostInfo() {
    var manual = _getManualIndirectCostPercent();
    var mode = _recipeConfig.indirectCostMode || _recipeConfig.custosIndiretosModo || 'manual';
    if (mode !== 'automatico') return { modeUsed: 'Manual', configuredMode: 'manual', percent: manual, fallback: false };

    var months = parseInt(_recipeConfig.indirectCostMonths || _recipeConfig.custosIndiretosMeses, 10) || 6;
    if ([3, 6, 12].indexOf(months) < 0) months = 6;
    var start = new Date();
    start.setMonth(start.getMonth() - months);
    start.setHours(0, 0, 0, 0);

    var direct = 0;
    var indirect = 0;
    (_financeSaidas || []).concat(_financeApagar || []).forEach(function (item) {
      var rawDate = _financeRecordDate(item);
      if (!rawDate) return;
      var d = new Date(rawDate);
      if (isNaN(d.getTime()) || d < start) return;
      var value = _parseFichaNum(item.valor || item.amount || item.total);
      if (_financeCostClass(item) === 'direto') direct += value;
      if (_financeCostClass(item) === 'indireto') indirect += value;
    });

    if (direct <= 0 || indirect <= 0) {
      return { modeUsed: 'Manual', configuredMode: 'automatico', percent: manual, fallback: true, months: months };
    }
    return { modeUsed: 'Automático', configuredMode: 'automatico', percent: (indirect / direct) * 100, fallback: false, months: months };
  }

  function _insLossPercent(ins) {
    if (!ins) return 0;
    if (ins.perda_percentual != null) return Math.max(0, _parseFichaNum(ins.perda_percentual));
    if (ins.perdaPercentual != null) return Math.max(0, _parseFichaNum(ins.perdaPercentual));
    var aprov = _parseFichaNum(ins.aproveitamento_padrao || ins.aproveitamentoPadrao || 100) || 100;
    return Math.max(0, 100 - aprov);
  }

  function _calcFichaIng(ins, qty) {
    qty = _parseFichaNum(qty);
    var loss = _insLossPercent(ins);
    var factor = 1 - (loss / 100);
    if (factor <= 0) factor = 1;
    var grossQty = qty / factor;
    var unitCost = ins ? _parseFichaNum(ins.custo_atual || ins.custoAtual || 0) : 0;
    return {
      lossPercent: loss,
      grossQuantity: grossQty,
      unitCost: unitCost,
      totalCost: grossQty * unitCost
    };
  }

  function _isPackagingComponent(name) {
    return String(name || '').toLowerCase().indexOf('embal') >= 0;
  }

  function _normalizeFichaComponents(f) {
    var comps = Array.isArray(f.components) ? f.components : [];
    if (!comps.length && Array.isArray(f.recipeComponents)) comps = f.recipeComponents;
    if (!comps.length && Array.isArray(f.ingredients) && f.ingredients.length) {
      comps = [{ name: 'Outro', note: '', ingredients: f.ingredients }];
    }
    if (!comps.length) comps = [{ name: 'Massa', note: '', ingredients: [] }];
    return comps.map(function (comp) {
      return {
        name: comp.name || comp.componentName || 'Outro',
        note: comp.note || comp.observation || comp.observacao || '',
        ingredients: (comp.ingredients || []).map(function (ing) {
          return {
            insumoId: ing.insumoId || ing.itemId || '',
            supplyName: ing.supplyName || ing.name || '',
            qty: _parseFichaNum(ing.qty != null ? ing.qty : ing.quantity),
            unit: ing.unit || ''
          };
        })
      };
    });
  }

  function _calcFichaComponentCosts(components) {
    var ingredientCost = 0;
    var packagingCost = 0;
    (components || []).forEach(function (comp) {
      var target = _isPackagingComponent(comp.name) ? 'packaging' : 'ingredients';
      (comp.ingredients || []).forEach(function (ing) {
        var ins = _itensCusto.find(function (i) { return i.id === ing.insumoId; });
        var calc = _calcFichaIng(ins, ing.qty);
        if (target === 'packaging') packagingCost += calc.totalCost;
        else ingredientCost += calc.totalCost;
      });
    });
    return { ingredients: ingredientCost, packaging: packagingCost, direct: ingredientCost + packagingCost };
  }

  function _fichaLbl() { return 'font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;text-transform:uppercase;'; }
  function _fichaInp() { return 'width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;'; }

  function _fichaSummaryData(f) {
    f = f || {};
    var yieldQty = parseFloat(f.yieldQuantity || f.yield) || 0;
    var yieldUnit = f.yieldUnit || 'unidades';
    var unitWeight = parseFloat(f.unitWeightGrams || 0) || 0;
    var totalProduced = parseFloat(f.totalProducedGrams || 0) || 0;
    if (!totalProduced && unitWeight > 0 && (yieldUnit === 'unidades' || yieldUnit === 'porções')) {
      totalProduced = yieldQty * unitWeight;
    }
    var costs = _calcFichaCosts(f);
    var totalG = totalProduced || ((yieldUnit === 'kg' ? yieldQty * 1000 : yieldUnit === 'gramas' ? yieldQty : yieldUnit === 'litros' ? yieldQty * 1000 : yieldUnit === 'ml' ? yieldQty : 0));
    return {
      yieldQty: yieldQty,
      yieldUnit: yieldUnit,
      unitWeight: unitWeight,
      totalProduced: totalProduced,
      totalG: totalG,
      costs: costs,
      costPerKg: totalG > 0 ? (costs.totalCost / totalG) * 1000 : 0
    };
  }

  function _fichaIngredientsViewHtml(f) {
    var comps = _normalizeFichaComponents(f);
    if (!comps.length) {
      return '<div style="padding:12px;border:1px dashed #D4C8C6;border-radius:12px;color:#8A7E7C;font-size:12px;">Nenhum ingrediente cadastrado.</div>';
    }
    return comps.map(function (comp) {
      var list = (comp.ingredients || []).map(function (ing) {
        var ins = _itensCusto.find(function (i) { return i.id === ing.insumoId; });
        return '<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px solid #F2EDED;">' +
          '<div style="min-width:0;">' +
          '<div style="font-size:13px;font-weight:700;color:#1A1A1A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc((ins && ins.nome) || ing.supplyName || 'Insumo') + '</div>' +
          '<div style="font-size:11px;color:#8A7E7C;">' + _esc(ing.qty || 0) + ' ' + _esc(ing.unit || (ins && ins.unidade_base) || '') + '</div>' +
          '</div>' +
          '<div style="font-size:12px;font-weight:800;color:#C4362A;white-space:nowrap;">' + (ing.totalCost != null ? UI.fmt(ing.totalCost) : '€0,00') + '</div>' +
          '</div>';
      }).join('');
      if (!list) list = '<div style="font-size:12px;color:#8A7E7C;">Sem insumos.</div>';
      return '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:14px;padding:14px;">' +
        '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:8px;">' +
        '<div style="min-width:0;">' +
        '<div style="font-size:14px;font-weight:800;color:#1A1A1A;">' + _esc(comp.name || 'Componente') + '</div>' +
        (comp.note ? '<div style="font-size:11px;color:#8A7E7C;margin-top:2px;">' + _esc(comp.note) + '</div>' : '') +
        '</div>' +
        '<div style="font-size:12px;font-weight:800;color:#C4362A;white-space:nowrap;">' + UI.fmt(_calcFichaComponentCosts([comp]).direct) + '</div>' +
        '</div>' +
        list +
        '</div>';
    }).join('<div style="height:10px;"></div>');
  }

  function _openFichaViewModal(id) {
    var f = id ? (_fichas.find(function (x) { return x.id === id; }) || {}) : {};
    var summary = _fichaSummaryData(f);
    var img = f.imageThumbUrl || f.imageCardUrl || f.imageBase64 || f.imageUrl || '';
    var cat = f.category || 'Sem categoria';
    var yieldLabel = summary.yieldQty ? (summary.yieldQty + ' ' + (summary.yieldUnit || 'unidades')) : '—';
    var prodTotal = summary.totalProduced > 0
      ? (summary.totalProduced >= 1000 ? (summary.totalProduced / 1000).toFixed(2) + ' kg' : summary.totalProduced.toFixed(0) + ' g')
      : '—';
    var weightPerUnit = summary.unitWeight > 0 ? summary.unitWeight + ' g' : '—';
    var costPerKg = summary.costPerKg > 0 ? UI.fmt(summary.costPerKg) : '—';
    var totalCost = UI.fmt(summary.costs.totalCost || 0);
    var costPerYield = UI.fmt(summary.costs.costPerYield || 0);
    var productionBlocks = [];
    if (f.preparationMode) productionBlocks.push('<div style="background:#fff;border:1px solid #EEE6E4;border-radius:14px;padding:14px;"><div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Modo de preparo</div><div style="font-size:13px;line-height:1.55;color:#1A1A1A;white-space:pre-wrap;">' + _esc(f.preparationMode) + '</div></div>');
    if (f.conservationType || f.shelfLifeValue || f.shelfLifeUnit) {
      productionBlocks.push('<div style="background:#fff;border:1px solid #EEE6E4;border-radius:14px;padding:14px;"><div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Conservação e validade</div><div style="font-size:13px;color:#1A1A1A;line-height:1.55;">' + _esc(f.conservationType || '—') + (f.shelfLifeValue ? ' · ' + _esc(f.shelfLifeValue) + ' ' + _esc(f.shelfLifeUnit || 'dias') : '') + '</div></div>');
    }
    if (f.productionNotes) productionBlocks.push('<div style="background:#fff;border:1px solid #EEE6E4;border-radius:14px;padding:14px;"><div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Observações</div><div style="font-size:13px;line-height:1.55;color:#1A1A1A;white-space:pre-wrap;">' + _esc(f.productionNotes) + '</div></div>');
    var body = '<div style="display:flex;flex-direction:column;gap:14px;">' +
      '<div style="display:grid;grid-template-columns:120px 1fr auto;gap:14px;align-items:center;background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">' +
      '<div style="width:120px;height:120px;border-radius:16px;overflow:hidden;background:#F2EDED;display:flex;align-items:center;justify-content:center;">' +
      (img ? '<img src="' + _esc(img) + '" style="width:100%;height:100%;object-fit:cover;">' : '<span class="mi" style="font-size:36px;color:#B9AAA6;">receipt_long</span>') +
      '</div>' +
      '<div style="min-width:0;">' +
      '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Resumo da receita</div>' +
      '<div style="font-size:28px;font-weight:900;line-height:1.08;color:#1A1A1A;margin-bottom:8px;word-break:break-word;">' + _esc(f.name || 'Receita') + '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
      '<span style="background:#F7F1F0;color:#5E5553;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:800;">' + _esc(cat) + '</span>' +
      '</div>' +
      '</div>' +
      '<button type="button" onclick="Modules.Catalogo._editFichaFromView(\'' + _esc(id) + '\')" style="align-self:flex-start;padding:10px 14px;border:none;border-radius:10px;background:#C4362A;color:#fff;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">Editar receita</button>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;">' +
      '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:14px;padding:14px;"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Rendimento</div><div style="font-size:18px;font-weight:900;color:#1A1A1A;">' + _esc(yieldLabel) + '</div></div>' +
      '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:14px;padding:14px;"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Peso por unidade</div><div style="font-size:18px;font-weight:900;color:#1A1A1A;">' + _esc(weightPerUnit) + '</div></div>' +
      '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:14px;padding:14px;"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Produção total</div><div style="font-size:18px;font-weight:900;color:#1A1A1A;">' + _esc(prodTotal) + '</div></div>' +
      '</div>' +
      '<div style="background:#FFF8F7;border:1px solid #F2E1DE;border-radius:16px;padding:16px;">' +
      '<div style="font-size:11px;font-weight:900;color:#C4362A;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;">Custos</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;">' +
      '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:14px;padding:14px;"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Custo total</div><div style="font-size:18px;font-weight:900;color:#C4362A;">' + totalCost + '</div></div>' +
      '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:14px;padding:14px;"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Custo por unidade</div><div style="font-size:24px;font-weight:900;color:#1A9E5A;line-height:1;">' + costPerYield + '</div></div>' +
      '<div style="background:#fff;border:1px solid #EEE6E4;border-radius:14px;padding:14px;"><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Custo por kg</div><div style="font-size:18px;font-weight:900;color:#7C3AED;">' + costPerKg + '</div></div>' +
      '</div>' +
      '</div>' +
      '<div style="background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">' +
      '<div style="font-size:11px;font-weight:900;color:#8A7E7C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;">Ingredientes</div>' +
      _fichaIngredientsViewHtml(f) +
      '</div>' +
      ((productionBlocks.length ? '<div style="display:flex;flex-direction:column;gap:10px;">' + productionBlocks.join('') + '</div>' : '')) +
      '</div>';
    var footer = '<div style="display:flex;gap:10px;">' +
      '<button onclick="Modules.Catalogo._editFichaFromView(\'' + _esc(id) + '\')" style="flex:1;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;">Editar</button>' +
      '<button onclick="if(window._fichaViewModal){window._fichaViewModal.close();}" style="flex:1;padding:13px;border-radius:11px;border:1.5px solid #D4C8C6;background:#fff;color:#1A1A1A;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Fechar</button>' +
      '</div>';
    window._fichaViewModal = UI.modal({ title: 'Resumo da receita', body: body, footer: footer, maxWidth: '860px' });
  }

  function _editFichaFromView(id) {
    if (window._fichaViewModal) window._fichaViewModal.close();
    _openFichaModal(id);
  }

  function _openFichaModal(id) {
    _editingId = id;
    var f = id ? (_fichas.find(function (x) { return x.id === id; }) || {}) : {};
    window._fcDraftId = id || _newEntityId('receita');
    window._fcImageState = null;
    window._fichaIngCount = 0;
    window._fichaCompCount = 0;

    var CATS = (_recipeCategories || []).map(function (c) { return c.name || c.label || ''; }).filter(Boolean);
    if (!CATS.length) CATS = ['Salgado', 'Doce', 'Massa', 'Recheio', 'Molho', 'Bebida', 'Acompanhamento', 'Outro'];
    if (f.category && CATS.indexOf(f.category) < 0) CATS.unshift(f.category);
    var YIELD_UNITS = ['unidades', 'porções', 'gramas', 'kg', 'ml', 'litros'];
    var CONSERV = ['Ambiente', 'Refrigerado', 'Congelado'];
    var SHELF_UNITS = ['horas', 'dias', 'meses'];

    var catOpts = CATS.map(function (c) {
      return '<option value="' + c + '"' + (f.category === c ? ' selected' : '') + '>' + c + '</option>';
    }).join('');
    var yieldUnitOpts = YIELD_UNITS.map(function (u) {
      return '<option value="' + u + '"' + ((f.yieldUnit || 'unidades') === u ? ' selected' : '') + '>' + u + '</option>';
    }).join('');
    var conservOpts = CONSERV.map(function (c) {
      return '<option value="' + c + '"' + (f.conservationType === c ? ' selected' : '') + '>' + c + '</option>';
    }).join('');
    var shelfUnitOpts = SHELF_UNITS.map(function (u) {
      return '<option value="' + u + '"' + ((f.shelfLifeUnit || 'dias') === u ? ' selected' : '') + '>' + u + '</option>';
    }).join('');

    var insOptions = _itensCusto.map(function (ins) {
      return '<option value="' + ins.id + '" data-aprov="' + (ins.aproveitamento_padrao || 100) + '" data-custo="' + (ins.custo_atual || 0) + '" data-unidade="' + _esc(ins.unidade_base || 'un') + '">' + _esc(ins.nome) + ' (' + _esc(ins.unidade_base || '') + ')</option>';
    }).join('');
    window._fichaInsOptions = insOptions;

    var imgPreviewStyle = _imageUrlFor(f, 'card') ? '' : 'display:none;';
    var imgSrc = _imageUrlFor(f, 'card') || '';

    var showPeso = !f.yieldUnit || f.yieldUnit === 'unidades' || f.yieldUnit === 'porções';
    var summary = _fichaSummaryData(f);
    var costBadge = summary.costs.costPerYield > 0 ? UI.fmt(summary.costs.costPerYield) : '—';

    var sHead = function (n, lbl) {
      return '<div style="font-size:11px;font-weight:800;color:#8A7E7C;text-transform:uppercase;letter-spacing:.6px;padding:6px 0 10px;border-bottom:1px solid #F2EDED;margin-bottom:14px;">' + n + ' · ' + lbl + '</div>';
    };

    var componentRows = _normalizeFichaComponents(f).map(function (comp, i) {
      window._fichaCompCount = i + 1;
      return _fichaComponentHtml(i, comp);
    }).join('');

    var body = '<div>' +

      '<div style="margin-bottom:20px;background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">' + sHead('1', 'Identidade') +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px;">' +
      '<div style="font-size:13px;color:#8A7E7C;">Resumo da receita e do custo por unidade.</div>' +
      '<div style="background:#fff;border:1px solid #F2E1DE;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:800;color:#C4362A;">Custo por unidade: ' + costBadge + '</div>' +
      '</div>' +
      '<div style="margin-bottom:12px;"><label style="' + _fichaLbl() + '">Nome da receita *</label>' +
      '<input id="fc-name" type="text" value="' + _esc(f.name || '') + '" style="' + _fichaInp() + '"></div>' +
      '<div style="margin-bottom:12px;">' +
      '<div><label style="' + _fichaLbl() + '">Categoria</label>' +
      '<select id="fc-category" style="' + _fichaInp() + 'background:#fff;"><option value="">Selecionar...</option>' + catOpts + '</select></div>' +
      '</div>' +
      '<div style="margin-bottom:12px;"><label style="' + _fichaLbl() + '">Imagem</label>' +
      '<input type="file" id="fc-img-file" accept="image/jpeg,image/jpg,image/png,image/webp" onchange="Modules.Catalogo._onFichaImgChange(event)" style="' + _fichaInp() + 'padding:8px;background:#fff;">' +
      '<div style="margin-top:6px;font-size:11px;line-height:1.45;color:#8A7E7C;">' + _imageUploadTip('product') + '</div>' +
      '<img id="fc-img-preview" src="' + imgSrc + '" style="max-width:100%;max-height:110px;border-radius:9px;margin-top:8px;' + imgPreviewStyle + '"></div>' +
      '<div><label style="' + _fichaLbl() + '">Observação interna</label>' +
      '<textarea id="fc-notes" style="' + _fichaInp() + 'min-height:58px;resize:vertical;">' + _esc(f.internalNotes || '') + '</textarea></div>' +
      '</div>' +

      '<div style="margin-bottom:20px;background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">' + sHead('2', 'Rendimento') +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
      '<div><label style="' + _fichaLbl() + '">Rendimento *</label>' +
      '<input id="fc-yield-qty" type="text" value="' + _esc(f.yieldQuantity || f.yield || '') + '" oninput="Modules.Catalogo._updateFichaPesoTotal()" style="' + _fichaInp() + '"></div>' +
      '<div><label style="' + _fichaLbl() + '">Tipo de rendimento *</label>' +
      '<select id="fc-yield-unit" onchange="Modules.Catalogo._onYieldUnitChange()" style="' + _fichaInp() + 'background:#fff;">' + yieldUnitOpts + '</select></div>' +
      '</div>' +
      '<div id="fc-peso-section" style="display:' + (showPeso ? 'grid' : 'none') + ';grid-template-columns:1fr 1fr;gap:12px;margin-bottom:4px;">' +
      '<div><label style="' + _fichaLbl() + '">Peso por unidade (g)</label>' +
      '<input id="fc-unit-weight" type="text" value="' + _esc(f.unitWeightGrams || '') + '" placeholder="Ex: 120" oninput="Modules.Catalogo._updateFichaPesoTotal()" style="' + _fichaInp() + '"></div>' +
      '<div><label style="' + _fichaLbl() + '">Peso total produzido</label>' +
      '<input id="fc-peso-total" type="text" readonly style="' + _fichaInp() + 'background:#F8F6F5;color:#8A7E7C;" placeholder="Calculado automaticamente"></div>' +
      '</div>' +
      '</div>' +

      '<div style="margin-bottom:20px;background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">' + sHead('3', 'Ingredientes') +
      '<div id="fc-components" style="display:flex;flex-direction:column;gap:12px;">' + componentRows + '</div>' +
      '<button type="button" onclick="Modules.Catalogo._addFichaComponent()" style="width:100%;padding:10px;border-radius:10px;border:1.5px dashed #D4C8C6;background:transparent;font-size:13px;font-weight:700;cursor:pointer;color:#8A7E7C;font-family:inherit;margin-top:10px;">+ Adicionar componente</button>' +
      '</div>' +

      '<div style="margin-bottom:20px;background:#FFF8F7;border:1px solid #F2E1DE;border-radius:16px;padding:16px;">' + sHead('4', 'Custos') +
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;">' +
      '<div style="background:#fff;border-radius:14px;padding:12px;border:1px solid #EEE6E4;"><div style="font-size:10px;font-weight:800;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Ingredientes</div><div id="fc-cost-ingredients" style="font-size:18px;font-weight:800;color:#C4362A;">€0,00</div></div>' +
      '<div style="background:#fff;border-radius:14px;padding:12px;border:1px solid #EEE6E4;"><div style="font-size:10px;font-weight:800;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Embalagem</div><div id="fc-cost-packaging" style="font-size:18px;font-weight:800;color:#C4362A;">€0,00</div></div>' +
      '<div style="background:#fff;border-radius:14px;padding:12px;border:1px solid #EEE6E4;"><div style="font-size:10px;font-weight:800;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Custo direto</div><div id="fc-cost-direct" style="font-size:18px;font-weight:800;color:#C4362A;">€0,00</div></div>' +
      '<div style="background:#fff;border-radius:14px;padding:12px;border:1px solid #EEE6E4;"><div style="font-size:10px;font-weight:800;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Custos indiretos estimados <span id="fc-indirect-pct"></span></div><div id="fc-cost-indirect" style="font-size:18px;font-weight:800;color:#D97706;">€0,00</div><div id="fc-indirect-mode" style="font-size:10px;color:#8A7E7C;margin-top:3px;">Modo: Manual</div></div>' +
      '<div style="background:#fff;border-radius:14px;padding:12px;border:1px solid #EEE6E4;"><div style="font-size:10px;font-weight:800;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Custo total</div><div id="fc-cost-total" style="font-size:18px;font-weight:800;color:#C4362A;">€0,00</div></div>' +
      '<div style="background:#fff;border-radius:14px;padding:12px;border:1px solid #EEE6E4;"><div style="font-size:10px;font-weight:800;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Por <span id="fc-cost-unit-label">unidade</span></div><div id="fc-cost-unit" style="font-size:18px;font-weight:800;color:#1A9E5A;">€0,00</div></div>' +
      '<div style="background:#fff;border-radius:14px;padding:12px;border:1px solid #EEE6E4;"><div style="font-size:10px;font-weight:800;color:#8A7E7C;text-transform:uppercase;margin-bottom:4px;">Por kg / L</div><div id="fc-cost-kg" style="font-size:18px;font-weight:800;color:#7C3AED;">—</div></div>' +
      '</div>' +
      '<div style="margin-top:10px;font-size:11px;color:#8A7E7C;font-style:italic;">A perda vem do cadastro do insumo. Custos indiretos estimados usam o modo definido em Configurações.</div>' +
      '</div>' +

      '<div style="margin-bottom:8px;background:#FAF8F8;border:1px solid #EEE6E4;border-radius:16px;padding:16px;">' + sHead('5', 'Produção') +
      '<div style="margin-bottom:12px;"><label style="' + _fichaLbl() + '">Modo de preparo</label>' +
      '<textarea id="fc-prep" placeholder="Descreva o passo a passo da produção desta receita." style="' + _fichaInp() + 'min-height:100px;resize:vertical;">' + _esc(f.preparationMode || '') + '</textarea></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">' +
      '<div><label style="' + _fichaLbl() + '">Conservação</label>' +
      '<select id="fc-conserv" style="' + _fichaInp() + 'background:#fff;"><option value="">Selecionar...</option>' + conservOpts + '</select></div>' +
      '<div><label style="' + _fichaLbl() + '">Validade (número)</label>' +
      '<input id="fc-shelf-val" type="text" value="' + _esc(f.shelfLifeValue || '') + '" placeholder="Ex: 30" style="' + _fichaInp() + '"></div>' +
      '<div><label style="' + _fichaLbl() + '">Validade (unidade)</label>' +
      '<select id="fc-shelf-unit" style="' + _fichaInp() + 'background:#fff;">' + shelfUnitOpts + '</select></div>' +
      '</div>' +
      '<div><label style="' + _fichaLbl() + '">Observações de produção</label>' +
      '<textarea id="fc-prod-notes" style="' + _fichaInp() + 'min-height:60px;resize:vertical;">' + _esc(f.productionNotes || '') + '</textarea></div>' +
      '</div>' +

      '</div>';

    var footer = '<div style="display:flex;flex-direction:column;gap:6px;align-items:stretch;">' +
      '<button onclick="Modules.Catalogo._saveFicha()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;">Salvar receita</button>' +
      '<div style="font-size:11px;color:#8A7E7C;text-align:center;">Atualiza custos automaticamente</div>' +
      '</div>';
    window._fichaModal = UI.modal({ title: id ? 'Editar Receita' : 'Nova Receita', body: body, footer: footer, maxWidth: '760px' });
    setTimeout(function () { _updateFichaCost(); _updateFichaPesoTotal(); }, 80);
  }

  function _recipeComponentNames(selected) {
    var names = (_recipeComponents || []).map(function (c) {
      return (c.name || c.label || '').trim();
    }).filter(Boolean);
    if (selected && names.indexOf(selected) < 0) names.push(selected);
    return names;
  }

  function _recipeComponentOptionsHtml(selected) {
    var names = _recipeComponentNames(selected);
    if (!names.length) {
      return '<option value="">Cadastre componentes primeiro</option>';
    }
    return '<option value="">Selecionar componente...</option>' + names.map(function (name) {
      return '<option value="' + _esc(name) + '"' + (name === selected ? ' selected' : '') + '>' + _esc(name) + '</option>';
    }).join('');
  }

  function _defaultRecipeComponentName() {
    var first = (_recipeComponents || []).find(function (c) { return (c.name || c.label || '').trim(); });
    return first ? (first.name || first.label || '').trim() : '';
  }

  function _fichaComponentHtml(compIdx, comp) {
    comp = comp || { name: _defaultRecipeComponentName(), note: '', ingredients: [] };
    var rows = (comp.ingredients || []).map(function (ing) {
      var idx = window._fichaIngCount || 0;
      window._fichaIngCount = idx + 1;
      return _fichaIngRow(idx, compIdx, ing.insumoId, ing.qty || 0);
    }).join('');
    if (!rows) {
      var blankIdx = window._fichaIngCount || 0;
      window._fichaIngCount = blankIdx + 1;
      rows = _fichaIngRow(blankIdx, compIdx, '', 0);
    }
    return '<div id="fc-comp-' + compIdx + '" class="fc-component" data-comp-idx="' + compIdx + '" style="background:#fff;border:1px solid #EEE6E4;border-radius:16px;padding:14px;box-shadow:0 2px 8px rgba(0,0,0,.04);">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 34px;gap:10px;align-items:end;margin-bottom:12px;">' +
      '<div><label style="' + _fichaLbl() + '">Nome do componente</label><select data-comp-name="' + compIdx + '" onchange="Modules.Catalogo._updateFichaCost()" style="' + _fichaInp() + 'background:#fff;">' + _recipeComponentOptionsHtml((comp.name || '').trim()) + '</select></div>' +
      '<div><label style="' + _fichaLbl() + '">Observação opcional</label><input data-comp-note="' + compIdx + '" value="' + _esc(comp.note || '') + '" placeholder="Ex: usar fria" style="' + _fichaInp() + '"></div>' +
      '<button type="button" onclick="Modules.Catalogo._removeFichaComponent(' + compIdx + ')" title="Remover componente" style="width:34px;height:34px;border-radius:9px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;font-size:14px;">✕</button>' +
      '</div>' +
      '<div id="fc-comp-ings-' + compIdx + '" style="display:flex;flex-direction:column;gap:8px;">' + rows + '</div>' +
      '<button type="button" onclick="Modules.Catalogo._addFichaIng(' + compIdx + ')" style="width:100%;padding:9px;border-radius:10px;border:1.5px dashed #D4C8C6;background:transparent;font-size:12px;font-weight:700;cursor:pointer;color:#8A7E7C;font-family:inherit;margin-top:10px;">+ Adicionar insumo neste componente</button>' +
      '</div>';
  }

  function _fichaIngRow(idx, compIdx, selectedId, qty) {
    var insOptions = window._fichaInsOptions || '';
    var opts = '<option value="">Selecionar insumo</option>' + insOptions.replace('value="' + selectedId + '"', 'value="' + selectedId + '" selected');
    var ins = selectedId ? _itensCusto.find(function (i) { return i.id === selectedId; }) : null;
    var unidade = ins ? (ins.unidade_base || 'un') : '—';
    var calc = _calcFichaIng(ins, qty);
    var perda = calc.lossPercent;
    var costVal = calc.totalCost;
    var perdaHtml = perda > 0
      ? '<span style="background:#FFF7ED;color:#D97706;padding:2px 7px;border-radius:12px;font-size:11px;font-weight:700;">' + perda + '%</span>'
      : '<span style="color:#D4C8C6;font-size:11px;">—</span>';
    var costHtml = costVal > 0 ? '€' + costVal.toFixed(costVal < 0.01 ? 6 : 2) : '—';

    return '<div id="fc-ing-' + idx + '" data-comp-row="' + compIdx + '" style="display:grid;grid-template-columns:minmax(200px,1.4fr) 90px 72px 88px 84px 30px;gap:8px;align-items:center;padding:10px 10px;border:1px solid #F2EDED;border-radius:12px;background:#fff;">' +
      '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Insumo</div>' +
      '<select data-ing-idx="' + idx + '" onchange="Modules.Catalogo._onFichaIngChange(\'' + idx + '\')" style="width:100%;padding:8px;border:1.5px solid #D4C8C6;border-radius:8px;font-size:13px;font-family:inherit;outline:none;">' + opts + '</select></div>' +
      '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Qtd</div>' +
      '<input type="text" data-ing-qty="' + idx + '" value="' + (qty || '') + '" placeholder="0" oninput="Modules.Catalogo._updateFichaCost()" style="width:100%;padding:8px;border:1.5px solid #D4C8C6;border-radius:8px;font-size:13px;font-family:inherit;outline:none;"></div>' +
      '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Unid.</div><div id="fc-ing-unit-' + idx + '" style="font-size:12px;color:#1A1A1A;font-weight:700;">' + _esc(unidade) + '</div></div>' +
      '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Perda</div><div id="fc-ing-loss-' + idx + '" style="white-space:nowrap;">' + perdaHtml + '</div></div>' +
      '<div><div style="font-size:10px;font-weight:900;color:#8A7E7C;text-transform:uppercase;margin-bottom:3px;">Custo</div><div id="fc-ing-cost-' + idx + '" style="font-size:12px;color:#1A9E5A;font-weight:700;white-space:nowrap;">' + costHtml + '</div></div>' +
      '<div style="text-align:right;"><button type="button" onclick="Modules.Catalogo._removeFichaIng(' + idx + ')" style="width:26px;height:26px;border-radius:7px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;font-size:12px;">✕</button></div>' +
      '</div>';
  }

  function _onFichaIngChange(idx) {
    var sel = document.querySelector('[data-ing-idx="' + idx + '"]');
    if (!sel) return;
    var insId = sel.value;
    var ins = insId ? _itensCusto.find(function (i) { return i.id === insId; }) : null;
    var unidade = ins ? (ins.unidade_base || 'un') : '—';
    var perda = _insLossPercent(ins);
    var unitEl = document.getElementById('fc-ing-unit-' + idx);
    var lossEl = document.getElementById('fc-ing-loss-' + idx);
    if (unitEl) unitEl.textContent = unidade;
    if (lossEl) lossEl.innerHTML = perda > 0
      ? '<span style="background:#FFF7ED;color:#D97706;padding:2px 7px;border-radius:12px;font-size:11px;font-weight:700;">' + perda + '%</span>'
      : '<span style="color:#D4C8C6;font-size:11px;">—</span>';
    if (ins && !ins.custo_atual) {
      UI.toast('⚠️ ' + _esc(ins.nome || 'Insumo') + ' não tem preço cadastrado. Custo pode ficar incorreto.', 'warning');
    }
    _updateFichaCost();
  }

  function _addFichaComponent() {
    var container = document.getElementById('fc-components');
    if (!container) return;
    var compIdx = window._fichaCompCount || 0;
    window._fichaCompCount = compIdx + 1;
    container.insertAdjacentHTML('beforeend', _fichaComponentHtml(compIdx, { name: _defaultRecipeComponentName(), note: '', ingredients: [] }));
    _updateFichaCost();
  }

  function _removeFichaComponent(compIdx) {
    var el = document.getElementById('fc-comp-' + compIdx);
    if (el) el.remove();
    _updateFichaCost();
  }

  function _addFichaIng(compIdx) {
    var container = document.getElementById('fc-comp-ings-' + compIdx);
    if (!container) return;
    var idx = window._fichaIngCount || 0;
    window._fichaIngCount = idx + 1;
    container.insertAdjacentHTML('beforeend', _fichaIngRow(idx, compIdx, '', 0));
    _updateFichaCost();
  }

  function _removeFichaIng(idx) {
    var el = document.getElementById('fc-ing-' + idx);
    if (el) el.remove();
    _updateFichaCost();
  }

  function _updateFichaCost() {
    var container = document.getElementById('fc-components');
    if (!container) return;
    var ingredientCost = 0;
    var packagingCost = 0;
    container.querySelectorAll('[data-ing-idx]').forEach(function (sel) {
      var idx = sel.dataset.ingIdx;
      var insId = sel.value;
      var qtyEl = container.querySelector('[data-ing-qty="' + idx + '"]');
      var qty = _parseFichaNum(qtyEl ? qtyEl.value : 0);
      var ins = insId ? _itensCusto.find(function (i) { return i.id === insId; }) : null;
      var costEl = document.getElementById('fc-ing-cost-' + idx);
      if (!ins || !qty) { if (costEl) costEl.textContent = '—'; return; }
      var calc = _calcFichaIng(ins, qty);
      var row = document.getElementById('fc-ing-' + idx);
      var compIdx = row ? row.dataset.compRow : '';
      var nameEl = container.querySelector('[data-comp-name="' + compIdx + '"]');
      var cost = calc.totalCost;
      if (_isPackagingComponent(nameEl ? nameEl.value : '')) packagingCost += cost;
      else ingredientCost += cost;
      if (costEl) costEl.textContent = cost > 0 ? ('€' + cost.toFixed(cost < 0.01 ? 6 : 2)) : '—';
    });

    var directCost = ingredientCost + packagingCost;
    var indirectInfo = _getIndirectCostInfo();
    var indirect = directCost * (indirectInfo.percent / 100);
    var total = directCost + indirect;
    var yieldQty = _parseFichaNum((document.getElementById('fc-yield-qty') || {}).value) || 1;
    var yieldUnit = ((document.getElementById('fc-yield-unit') || {}).value) || 'unidades';
    var costPerUnit = yieldQty > 0 ? total / yieldQty : 0;

    var totalEl = document.getElementById('fc-cost-total');
    var ingredientsEl = document.getElementById('fc-cost-ingredients');
    var packagingEl = document.getElementById('fc-cost-packaging');
    var directEl = document.getElementById('fc-cost-direct');
    var indirectEl = document.getElementById('fc-cost-indirect');
    var indirectPctEl = document.getElementById('fc-indirect-pct');
    var indirectModeEl = document.getElementById('fc-indirect-mode');
    var unitEl = document.getElementById('fc-cost-unit');
    var labelEl = document.getElementById('fc-cost-unit-label');
    var kgEl = document.getElementById('fc-cost-kg');

    if (ingredientsEl) ingredientsEl.textContent = UI.fmt(ingredientCost);
    if (packagingEl) packagingEl.textContent = UI.fmt(packagingCost);
    if (directEl) directEl.textContent = UI.fmt(directCost);
    if (indirectEl) indirectEl.textContent = UI.fmt(indirect);
    if (indirectPctEl) indirectPctEl.textContent = '(' + (indirectInfo.percent || 0).toFixed(2).replace('.', ',') + '%)';
    if (indirectModeEl) indirectModeEl.textContent = 'Modo: ' + indirectInfo.modeUsed + (indirectInfo.fallback ? ' (fallback)' : '');
    if (totalEl) totalEl.textContent = UI.fmt(total);
    if (unitEl) unitEl.textContent = UI.fmt(costPerUnit);
    if (labelEl) labelEl.textContent = yieldUnit.replace(/ões$/, 'ão').replace(/es$/, '').replace(/s$/, '') || 'unidade';

    var unitWeightG = _parseFichaNum((document.getElementById('fc-unit-weight') || {}).value);
    var totalG = 0;
    if (yieldUnit === 'kg') totalG = yieldQty * 1000;
    else if (yieldUnit === 'gramas') totalG = yieldQty;
    else if (yieldUnit === 'litros') totalG = yieldQty * 1000;
    else if (yieldUnit === 'ml') totalG = yieldQty;
    else if (unitWeightG > 0) totalG = yieldQty * unitWeightG;

    if (kgEl) {
      if (totalG > 0 && total > 0) {
        kgEl.textContent = UI.fmt((total / totalG) * 1000);
      } else {
        kgEl.textContent = '—';
      }
    }
  }

  function _updateFichaPesoTotal() {
    var qty = _parseFichaNum((document.getElementById('fc-yield-qty') || {}).value);
    var unitWeight = _parseFichaNum((document.getElementById('fc-unit-weight') || {}).value);
    var pesoEl = document.getElementById('fc-peso-total');
    if (pesoEl) {
      if (qty > 0 && unitWeight > 0) {
        var t = qty * unitWeight;
        pesoEl.value = t >= 1000 ? (t / 1000).toFixed(2) + ' kg' : t.toFixed(0) + ' g';
      } else {
        pesoEl.value = '';
      }
    }
    _updateFichaCost();
  }

  function _onYieldUnitChange() {
    var unit = ((document.getElementById('fc-yield-unit') || {}).value) || 'unidades';
    var pesoSection = document.getElementById('fc-peso-section');
    if (pesoSection) pesoSection.style.display = (unit === 'unidades' || unit === 'porções') ? 'grid' : 'none';
    _updateFichaCost();
  }

  function _onFichaImgChange(event) {
    var file = event && event.target && event.target.files ? event.target.files[0] : null;
    if (!file) return;
    var draftId = window._fcDraftId || _editingId || _newEntityId('receita');
    window._fcDraftId = draftId;
    ImageTools.process(file, { kind: 'product', folder: 'recipes', entityId: draftId }).then(function (result) {
      window._fcImageState = result;
      window._fcImageBase64 = null;
      var preview = document.getElementById('fc-img-preview');
      if (preview) { preview.src = result.imageUrl || ''; preview.style.display = 'block'; }
      UI.toast('Imagem otimizada com sucesso.', 'success');
    }).catch(function (err) {
      console.error('Imagem da receita', err);
      UI.toast(err && err.message ? err.message : 'Erro ao otimizar imagem.', 'error');
      event.target.value = '';
    });
  }

  function _saveFicha() {
    var name = ((document.getElementById('fc-name') || {}).value || '').trim();
    if (!name) { UI.toast('Nome é obrigatório', 'error'); return; }
    var yieldQty = _parseFichaNum((document.getElementById('fc-yield-qty') || {}).value);
    if (!yieldQty || yieldQty <= 0) { UI.toast('Rendimento deve ser maior que zero', 'error'); return; }
    var yieldUnit = ((document.getElementById('fc-yield-unit') || {}).value) || 'unidades';
    var container = document.getElementById('fc-components');
    var ingredients = [];
    var components = [];
    var missingComponentName = false;
    if (container) {
      container.querySelectorAll('.fc-component').forEach(function (compEl) {
        var compIdx = compEl.dataset.compIdx;
        var compName = ((container.querySelector('[data-comp-name="' + compIdx + '"]') || {}).value || '').trim();
        var compNote = ((container.querySelector('[data-comp-note="' + compIdx + '"]') || {}).value || '').trim();
        var compIngredients = [];
        compEl.querySelectorAll('[data-ing-idx]').forEach(function (sel) {
          var idx = sel.dataset.ingIdx;
          var insumoId = sel.value;
          if (!insumoId) return;
          var qtyEl = container.querySelector('[data-ing-qty="' + idx + '"]');
          var qty = _parseFichaNum(qtyEl ? qtyEl.value : 0);
          if (qty <= 0) return;
          var ins = _itensCusto.find(function (i) { return i.id === insumoId; });
          var calc = _calcFichaIng(ins, qty);
          var ingData = {
            insumoId: insumoId,
            supplyName: ins ? ins.nome : '',
            qty: qty,
            unit: ins ? (ins.unidade_base || '') : '',
            lossPercent: calc.lossPercent,
            grossQuantityCalculated: calc.grossQuantity,
            unitCost: calc.unitCost,
            totalCost: calc.totalCost
          };
          compIngredients.push(ingData);
          ingredients.push(Object.assign({ componentName: compName }, ingData));
        });
        if (compIngredients.length) {
          if (!compName) missingComponentName = true;
          components.push({ name: compName, note: compNote, ingredients: compIngredients });
        }
      });
    }
    if (missingComponentName) { UI.toast('Selecione o componente da receita', 'error'); return; }
    if (ingredients.length === 0) { UI.toast('Adicione pelo menos 1 insumo', 'error'); return; }
    var componentCosts = _calcFichaComponentCosts(components);
    var indirectCostInfo = _getIndirectCostInfo();
    var indirectCostPercent = indirectCostInfo.percent;
    var indirectCost = componentCosts.direct * (indirectCostPercent / 100);
    var totalCost = componentCosts.direct + indirectCost;
    var unitWeightG = _parseFichaNum((document.getElementById('fc-unit-weight') || {}).value);
    var data = {
      name: name,
      category: ((document.getElementById('fc-category') || {}).value) || '',
      recipeType: 'receita_base',
      yieldQuantity: yieldQty, yieldUnit: yieldUnit,
      unitWeightGrams: unitWeightG || null,
      totalProducedGrams: (unitWeightG && (yieldUnit === 'unidades' || yieldUnit === 'porções')) ? yieldQty * unitWeightG : null,
      components: components,
      ingredients: ingredients,
      ingredientCost: componentCosts.ingredients,
      packagingCost: componentCosts.packaging,
      directCost: componentCosts.direct,
      indirectCostModeUsed: indirectCostInfo.modeUsed,
      indirectCostModeConfigured: indirectCostInfo.configuredMode,
      indirectCostFallback: !!indirectCostInfo.fallback,
      indirectCostPercent: indirectCostPercent,
      indirectCost: indirectCost,
      totalCost: totalCost,
      costPerYield: yieldQty > 0 ? totalCost / yieldQty : 0,
      internalNotes: ((document.getElementById('fc-notes') || {}).value) || '',
      preparationMode: ((document.getElementById('fc-prep') || {}).value) || '',
      conservationType: ((document.getElementById('fc-conserv') || {}).value) || '',
      shelfLifeValue: _parseFichaNum((document.getElementById('fc-shelf-val') || {}).value) || null,
      shelfLifeUnit: ((document.getElementById('fc-shelf-unit') || {}).value) || 'dias',
      productionNotes: ((document.getElementById('fc-prod-notes') || {}).value) || '',
      updatedAt: new Date().toISOString(),
      yield: yieldQty
    };
    var imgState = window._fcImageState || null;
    if (imgState) {
      data.imageUrl = imgState.imageUrl || '';
      data.imageCardUrl = imgState.imageCardUrl || imgState.cardUrl || imgState.imageUrl || '';
      data.imageThumbUrl = imgState.imageThumbUrl || imgState.thumbUrl || imgState.imageCardUrl || imgState.imageUrl || '';
      data.imageStoragePath = imgState.imageStoragePath || '';
      data.imageWidth = imgState.imageWidth || null;
      data.imageHeight = imgState.imageHeight || null;
      data.imageSizeKb = imgState.imageSizeKb || null;
      data.imageFormat = imgState.imageFormat || 'webp';
    }
    var fichaId = _editingId || window._fcDraftId || _newEntityId('receita');
    data.id = fichaId;
    data.updatedAt = new Date().toISOString();
    if (!_editingId) {
      data.createdAt = new Date().toISOString();
      window._fcDraftId = fichaId;
    }
    var op = _editingId ? DB.update('fichasTecnicas', _editingId, data) : DB.set('fichasTecnicas', fichaId, data);
    op.then(function () {
      UI.toast('Receita salva!', 'success');
      if (window._fichaModal) window._fichaModal.close();
      _renderFichas();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _deleteFicha(id) {
    UI.confirm('Eliminar esta receita?').then(function (yes) {
      if (!yes) return;
      DB.remove('fichasTecnicas', id).then(function () { UI.toast('Eliminado', 'info'); _renderFichas(); });
    });
  }

  // ── TAGS TAB ─────────────────────────────────────────────────────────────
  function _renderTagsTab() {
    DB.getAll('tags').then(function (items) {
      _tags = items || [];
      _paintTagsTab();
    });
  }

  function _paintTagsTab() {
    var content = document.getElementById('catalogo-content');
    if (!content) return;
    content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">' +
      '<h2 style="font-size:20px;font-weight:800;">Tags (' + _tags.length + ')</h2>' +
      '<button onclick="Modules.Catalogo._openTagModal(null)" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Nova Tag</button>' +
      '</div>' +
      (_tags.length === 0 ? UI.emptyState('Nenhuma tag ainda', '') :
        '<div style="display:flex;flex-wrap:wrap;gap:12px;">' +
        _tags.map(function (tag) {
          return '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
            '<span style="background:' + (tag.bgColor || '#C4362A') + ';color:' + (tag.textColor || '#fff') + ';padding:4px 14px;border-radius:20px;font-size:13px;font-weight:700;">' + _esc(tag.text) + '</span>' +
            '<button onclick="Modules.Catalogo._openTagModal(\'' + tag.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;"><span class="mi" style="font-size:14px;">edit</span></button>' +
            '<button onclick="Modules.Catalogo._deleteTag(\'' + tag.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;"><span class="mi" style="font-size:14px;">delete</span></button>' +
            '</div>';
        }).join('') + '</div>');
  }

  function _openTagModal(id) {
    _editingId = id;
    var tag = id ? (_tags.find(function (x) { return x.id === id; }) || {}) : {};
    var body = '<div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Texto da Tag *</label>' +
      '<input id="tag-text" type="text" value="' + _esc(tag.text || '') + '" placeholder="ex: Novo, Promoção..." style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Cor de Fundo</label>' +
      '<div style="display:flex;align-items:center;gap:8px;">' +
      '<input type="color" id="tag-bg" value="' + (tag.bgColor || '#C4362A') + '" onchange="Modules.Catalogo._updateTagModalPreview()" style="width:40px;height:36px;border:1.5px solid #D4C8C6;border-radius:6px;cursor:pointer;padding:2px;">' +
      '<input type="text" id="tag-bg-hex" value="' + (tag.bgColor || '#C4362A') + '" oninput="document.getElementById(\'tag-bg\').value=this.value;Modules.Catalogo._updateTagModalPreview()" style="flex:1;padding:8px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;">' +
      '</div></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Cor do Texto</label>' +
      '<div style="display:flex;align-items:center;gap:8px;">' +
      '<input type="color" id="tag-color" value="' + (tag.textColor || '#ffffff') + '" onchange="Modules.Catalogo._updateTagModalPreview()" style="width:40px;height:36px;border:1.5px solid #D4C8C6;border-radius:6px;cursor:pointer;padding:2px;">' +
      '<input type="text" id="tag-color-hex" value="' + (tag.textColor || '#ffffff') + '" oninput="document.getElementById(\'tag-color\').value=this.value;Modules.Catalogo._updateTagModalPreview()" style="flex:1;padding:8px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;">' +
      '</div></div>' +
      '</div>' +
      '<div style="text-align:center;margin-top:8px;">' +
      '<span id="tag-modal-preview" style="background:' + (tag.bgColor || '#C4362A') + ';color:' + (tag.textColor || '#fff') + ';padding:6px 18px;border-radius:20px;font-size:14px;font-weight:700;">' + _esc(tag.text || 'Prévia') + '</span>' +
      '</div></div>';
    var footer = '<button onclick="Modules.Catalogo._saveTag()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">' + (id ? 'Atualizar' : 'Criar Tag') + '</button>';
    window._tagModal = UI.modal({ title: id ? 'Editar Tag' : 'Nova Tag', body: body, footer: footer });
  }

  function _updateTagModalPreview() {
    var text = (document.getElementById('tag-text') || {}).value || 'Prévia';
    var bg = (document.getElementById('tag-bg') || {}).value || '#C4362A';
    var color = (document.getElementById('tag-color') || {}).value || '#fff';
    var bgHex = document.getElementById('tag-bg-hex');
    var colorHex = document.getElementById('tag-color-hex');
    if (bgHex) bgHex.value = bg;
    if (colorHex) colorHex.value = color;
    var preview = document.getElementById('tag-modal-preview');
    if (preview) { preview.textContent = text; preview.style.background = bg; preview.style.color = color; }
  }

  function _saveTag() {
    var text = ((document.getElementById('tag-text') || {}).value || '').trim();
    if (!text) { UI.toast('Texto obrigatorio', 'error'); return; }
    var data = {
      text: text,
      bgColor: (document.getElementById('tag-bg') || {}).value || '#C4362A',
      textColor: (document.getElementById('tag-color') || {}).value || '#ffffff'
    };
    var op = _editingId ? DB.update('tags', _editingId, data) : DB.add('tags', data);
    op.then(function () {
      UI.toast('Tag salva!', 'success');
      if (window._tagModal) window._tagModal.close();
      _renderTagsTab();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _deleteTag(id) {
    UI.confirm('Eliminar esta tag?').then(function (yes) {
      if (!yes) return;
      DB.remove('tags', id).then(function () { UI.toast('Eliminado', 'info'); _renderTagsTab(); });
    });
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────
  function _esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function destroy() {}

  return {
    render: render, destroy: destroy,
    _switchSub: _switchSub,
    _refreshProductPromotions: _refreshProductPromotions,
    _openProductModal: _openProductModal, _toggleVis: _toggleVis, _saveProduct: _saveProduct, _deleteProduct: _deleteProduct, _filterProdutos: _filterProdutos, _quickUpdateProduct: _quickUpdateProduct,
    _onProductNameChange: _onProductNameChange, _onProductDescChange: _onProductDescChange,
    _seoEdited: _seoEdited, _onTipoChange: _onTipoChange, _onUnicoSrcChange: _onUnicoSrcChange,
    _addMenuGroup: _addMenuGroup, _removeMenuGroup: _removeMenuGroup,
    _addMenuOption: _addMenuOption, _removeMenuOption: _removeMenuOption, _filterMenuOptions: _filterMenuOptions,
    _addUpsellProduct: _addUpsellProduct, _removeUpsellProduct: _removeUpsellProduct, _filterUpsellProducts: _filterUpsellProducts,
    _onImgFileChange: _onImgFileChange,
    _onProntoImgChange: _onProntoImgChange, _onFichaImgChange: _onFichaImgChange,
    _openCatModal: _openCatModal, _selectCatColor: _selectCatColor, _saveCat: _saveCat, _deleteCat: _deleteCat,
    _openProntosModal: _openProntosModal, _savePronto: _savePronto, _deletePronto: _deletePronto,
    _openVariantModal: _openVariantModal, _saveVariant: _saveVariant, _deleteVariant: _deleteVariant,
    _openItemCustoModal: _openItemCustoModal, _saveItemCusto: _saveItemCusto, _deleteItemCusto: _deleteItemCusto,
    _filterItensCusto: _filterItensCusto, _setItensCustoFilter: _setItensCustoFilter, _onItemTipoChange: _onItemTipoChange,
    _openFichaViewModal: _openFichaViewModal, _editFichaFromView: _editFichaFromView,
    _openFichaModal: _openFichaModal, _addFichaComponent: _addFichaComponent, _removeFichaComponent: _removeFichaComponent, _addFichaIng: _addFichaIng, _removeFichaIng: _removeFichaIng,
    _updateFichaCost: _updateFichaCost, _updateFichaPesoTotal: _updateFichaPesoTotal, _onYieldUnitChange: _onYieldUnitChange,
    _onFichaIngChange: _onFichaIngChange, _onFichaImgChange: _onFichaImgChange,
    _saveFicha: _saveFicha, _deleteFicha: _deleteFicha,
    _filterFichas: _filterFichas, _renderFichas: _renderFichas,
    _openTagModal: _openTagModal, _saveTag: _saveTag, _deleteTag: _deleteTag, _updateTagModalPreview: _updateTagModalPreview
  };
})();
