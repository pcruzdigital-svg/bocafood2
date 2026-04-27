// js/modules/catalogo.js
window.Modules = window.Modules || {};
Modules.Catalogo = (function () {
  'use strict';

  var _activeSub = 'produtos';
  var _products = [];
  var _categories = [];
  var _variants = [];
  var _insumos = [];
  var _fichas = [];
  var _produtosProntos = [];
  var _tags = [];
  var _editingId = null;

  var TABS = [
    { key: 'produtos', label: 'Produtos' },
    { section: 'Criação' },
    { key: 'fichas', label: 'Receitas' },
    { key: 'produtos_prontos', label: 'Produto Pronto' },
    { key: 'insumos', label: 'Insumos' },
    { section: 'Configuração' },
    { key: 'categorias', label: 'Categorias' },
    { key: 'variantes', label: 'Variantes' },
    { key: 'extras', label: 'Extras' },
    { key: 'tags', label: 'Tags' }
  ];

  function render(sub) {
    _activeSub = sub || 'produtos';
    var app = document.getElementById('app');
    app.innerHTML = '<div id="catalogo-root" style="display:flex;flex-direction:column;height:100%;">' +
      '<div style="background:#fff;border-bottom:1px solid #F2EDED;padding:0 24px;">' +
      '<h1 style="font-family:\'League Spartan\',sans-serif;font-size:24px;font-weight:800;padding:20px 0 0;">Catálogo</h1>' +
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
    else if (key === 'produtos_prontos') _renderProdutosProntos();
    else if (key === 'variantes') _renderVariantes();
    else if (key === 'extras') _renderVariantes('extras');
    else if (key === 'insumos') _renderInsumos();
    else if (key === 'fichas') _renderFichas();
    else if (key === 'tags') _renderTagsTab();
  }

  // ── DRAG-TO-REORDER (Change K) ────────────────────────────────────────────
  function makeSortable(listEl, onReorder) {
    var dragging = null;
    listEl.querySelectorAll('[draggable]').forEach(function (el) {
      el.addEventListener('dragstart', function () { dragging = el; el.style.opacity = '.4'; });
      el.addEventListener('dragend', function () { el.style.opacity = '1'; dragging = null; });
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

  // ── PRODUTOS ──────────────────────────────────────────────────────────────
  function _renderProdutos() {
    Promise.all([DB.getAll('products'), DB.getAll('categories')]).then(function (r) {
      _products = (r[0] || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      _categories = r[1] || [];
      _paintProdutos();
    });
  }

  function _paintProdutos() {
    var content = document.getElementById('catalogo-content');
    if (!content) return;
    // Change J: no emojis; Change K: draggable list
    content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">' +
      '<h2 style="font-size:20px;font-weight:800;">Produtos (' + _products.length + ')</h2>' +
      '<button onclick="Modules.Catalogo._openProductModal(null)" style="display:flex;align-items:center;gap:6px;background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Adicionar</button>' +
      '</div>' +
      (_products.length === 0 ? UI.emptyState('Nenhum produto ainda', '') :
        '<div id="products-list" style="display:flex;flex-direction:column;gap:10px;">' +
        _products.map(function (p) { return _productRowHTML(p); }).join('') +
        '</div>');

    if (_products.length > 0) {
      var listEl = document.getElementById('products-list');
      if (listEl) {
        makeSortable(listEl, function (orders) {
          orders.forEach(function (o) { DB.update('products', o.id, { order: o.order }); });
        });
      }
    }
  }

  function _productRowHTML(p) {
    p = _normalizeProduct(p);
    var cat = _categories.find(function (c) { return c.id === p.categoryId || c.slug === p.categoryId || c.name === p.categoryId; });
    // Change G: no stock badge; Change F: show base64 or img url; Change J: no emojis in buttons
    var imgSrc = p.imageBase64 || p.imageUrl || '';
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

    return '<div draggable="true" data-id="' + p.id + '" style="background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.06);display:flex;align-items:center;gap:13px;padding:12px;cursor:grab;">' +
      '<span class="mi" style="color:#D4C8C6;font-size:18px;flex-shrink:0;">drag_indicator</span>' +
      '<div style="width:60px;height:60px;border-radius:10px;background:#F2EDED;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;">' + imgHtml + '</div>' +
      '<div style="flex:1;min-width:0;">' +
      '<div style="font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(p.name) + '</div>' +
      '<div style="font-size:11px;color:#8A7E7C;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(p.shortDesc || p.description) + '</div>' +
      '<div style="display:flex;align-items:center;gap:6px;margin-top:5px;flex-wrap:wrap;">' +
      '<span style="font-size:14px;font-weight:800;color:#C4362A;">' + UI.fmt(p.price || 0) + '</span>' +
      (cat ? UI.badge(cat.name, 'blue') : '') +
      (p.menuVisible === false ? UI.badge('Oculto', 'gray') : '') +
      tagsHtml +
      '</div></div>' +
      '<div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;align-items:flex-end;">' +
      '<button onclick="Modules.Catalogo._openProductModal(\'' + p.id + '\')" style="width:34px;height:34px;border-radius:9px;border:none;cursor:pointer;background:#EEF4FF;color:#3B82F6;font-size:15px;display:flex;align-items:center;justify-content:center;"><span class="mi" style="font-size:16px;">edit</span></button>' +
      '<button onclick="Modules.Catalogo._deleteProduct(\'' + p.id + '\')" style="width:34px;height:34px;border-radius:9px;border:none;cursor:pointer;background:#FFF0EE;color:#C4362A;font-size:15px;display:flex;align-items:center;justify-content:center;"><span class="mi" style="font-size:16px;">delete</span></button>' +
      '</div></div>';
  }

  function _openProductModal(id) {
    _editingId = id;
    var p = id ? (_products.find(function (x) { return x.id === id; }) || {}) : {};

    // Gather data needed for modal
    Promise.all([
      DB.getAll('categories'),
      DB.getAll('fichasTecnicas'),
      DB.getAll('produtos_prontos'),
      DB.getAll('variantGroups'),
      DB.getAll('tags')
    ]).then(function (r) {
      _categories = r[0] || [];
      _fichas = r[1] || [];
      _produtosProntos = r[2] || [];
      _variants = r[3] || [];
      _tags = r[4] || [];
      _buildProductModal(p, id);
    });
  }

  function _buildProductModal(p, id) {
    p = _normalizeProduct(p);
    var catOptions = _categories.map(function (c) {
      return '<option value="' + c.id + '"' + (p.categoryId === c.id ? ' selected' : '') + '>' + _esc(c.name) + '</option>';
    }).join('');

    // Change B: Tipo de produto (Único / Menu)
    var tipoUnico = !p.type || p.type === 'unico';
    var tipoMenu = p.type === 'menu';

    // Único sub-type: receita or produto_pronto
    var unicoSubReceita = !p.unicoSource || p.unicoSource === 'receita';
    var unicoSubPronto = p.unicoSource === 'produto_pronto';

    var fichaOptions = _fichas.map(function (f) {
      return '<option value="' + f.id + '"' + (p.fichaId === f.id ? ' selected' : '') + '>' + _esc(f.name) + '</option>';
    }).join('');

    var prontoOptions = _produtosProntos.map(function (pp) {
      return '<option value="' + pp.id + '"' + (p.produtoProntoId === pp.id ? ' selected' : '') + '>' + _esc(pp.name) + '</option>';
    }).join('');

    // Change D: Variants checkboxes
    var variantChecks = _variants.map(function (vg) {
      var checked = p.variantGroupIds && p.variantGroupIds.indexOf(vg.id) >= 0;
      return '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:6px 0;">' +
        '<input type="checkbox" class="pm-variant-check" data-vgid="' + vg.id + '"' + (checked ? ' checked' : '') + ' style="width:15px;height:15px;accent-color:#C4362A;">' +
        _esc(vg.title) + '</label>';
    }).join('');

    // Change C: Tags — select from registered tags
    var selectedTagIds = (p.tags || []).map(function (t) { return t.id || t.text; });
    var tagsInitHtml = _tags.length === 0
      ? '<p style="font-size:12px;color:#8A7E7C;margin:0;">Nenhuma tag cadastrada. Crie tags na aba <strong>Tags</strong>.</p>'
      : _tags.map(function (tag) {
          var isSelected = selectedTagIds.indexOf(tag.id) >= 0 || selectedTagIds.indexOf(tag.text) >= 0;
          return '<label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;margin:3px;">' +
            '<input type="checkbox" class="pm-tag-check" data-tag-id="' + tag.id + '" data-tag-text="' + _esc(tag.text) + '" data-tag-bg="' + _esc(tag.bgColor || '#C4362A') + '" data-tag-color="' + _esc(tag.textColor || '#ffffff') + '"' + (isSelected ? ' checked' : '') + ' style="accent-color:#C4362A;">' +
            '<span style="background:' + (tag.bgColor || '#C4362A') + ';color:' + (tag.textColor || '#fff') + ';padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;">' + _esc(tag.text) + '</span>' +
            '</label>';
        }).join('');

    // Change F: Image
    var imgPreview = '';
    if (p.imageBase64) {
      imgPreview = '<img id="pm-img-preview" src="' + p.imageBase64 + '" style="max-width:100%;max-height:120px;border-radius:9px;margin-top:8px;display:block;">';
    } else if (p.imageUrl) {
      imgPreview = '<img id="pm-img-preview" src="' + p.imageUrl + '" style="max-width:100%;max-height:120px;border-radius:9px;margin-top:8px;display:block;" onerror="this.style.display=\'none\';">';
    } else {
      imgPreview = '<img id="pm-img-preview" style="max-width:100%;max-height:120px;border-radius:9px;margin-top:8px;display:none;">';
    }

    // Menu choice groups
    var menuGroups = _normalizeMenuGroups(p);
    var menuGroupsHtml = menuGroups.map(function (group, i) {
      return _menuGroupRowHtml(i, group);
    }).join('');
    window._pmMenuGroupCount = menuGroups.length;

    var body = '<div>' +
      // Name and price
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Nome *</label>' +
      '<input id="pm-name" type="text" value="' + _esc(p.name || '') + '" oninput="Modules.Catalogo._onProductNameChange()" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Preco (€) *</label>' +
      '<input id="pm-price" type="number" step="0.01" value="' + (p.price || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '</div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Microcopy</label>' +
      '<input id="pm-microcopy" type="text" value="' + _esc(p.microcopy || '') + '" placeholder="Ex: Crocante por fora, recheio que surpreende" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Descricao curta</label>' +
      '<textarea id="pm-short-desc" oninput="Modules.Catalogo._onProductDescChange()" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;min-height:54px;resize:vertical;">' + _esc(p.shortDesc || p.description || '') + '</textarea></div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Descricao completa</label>' +
      '<textarea id="pm-full-desc" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;min-height:90px;resize:vertical;">' + _esc(p.fullDesc || p.seoDescription || p.description || '') + '</textarea></div>' +

      // Change C: Tags section — select from registered tags
      '<div style="margin-bottom:12px;padding:12px;background:#F9F7F7;border-radius:10px;">' +
      '<div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Tags</div>' +
      '<div id="pm-tags-list" style="display:flex;flex-wrap:wrap;gap:4px;">' + tagsInitHtml + '</div>' +
      '</div>' +

      // Category
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Categoria</label>' +
      '<select id="pm-cat" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;">' +
      '<option value="">Sem categoria</option>' + catOptions + '</select></div>' +

      // Change F: Image upload
      '<div style="margin-bottom:12px;">' +
      '<label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Imagem</label>' +
      '<input type="file" id="pm-img-file" accept="image/*" onchange="Modules.Catalogo._onImgFileChange(event)" style="width:100%;padding:8px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;">' +
      imgPreview +
      (p.imageBase64 ? '' : '<div style="margin-top:6px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:2px;">URL da imagem (alternativo)</label>' +
        '<input id="pm-img-url" type="text" value="' + _esc(p.imageUrl || '') + '" placeholder="https://..." style="width:100%;padding:9px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;"></div>') +
      '<p style="font-size:11px;color:#8A7E7C;margin-top:6px;">A imagem sera publicada no site ao sincronizar com o master</p>' +
      '</div>' +

      // Change B: Tipo de produto
      '<div style="margin-bottom:12px;padding:12px;background:#F9F7F7;border-radius:10px;">' +
      '<div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Tipo de produto</div>' +
      '<div style="display:flex;gap:12px;margin-bottom:12px;">' +
      '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;font-weight:600;">' +
      '<input type="radio" name="pm-tipo" id="pm-tipo-unico" value="unico"' + (tipoUnico ? ' checked' : '') + ' onchange="Modules.Catalogo._onTipoChange()" style="accent-color:#C4362A;"> Unico</label>' +
      '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;font-weight:600;">' +
      '<input type="radio" name="pm-tipo" id="pm-tipo-menu" value="menu"' + (tipoMenu ? ' checked' : '') + ' onchange="Modules.Catalogo._onTipoChange()" style="accent-color:#C4362A;"> Menu</label>' +
      '</div>' +

      // Único panel
      '<div id="pm-panel-unico" style="display:' + (tipoUnico ? 'block' : 'none') + ';">' +
      '<div style="display:flex;gap:16px;margin-bottom:10px;">' +
      '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;">' +
      '<input type="radio" name="pm-unico-src" id="pm-unico-receita" value="receita"' + (unicoSubReceita ? ' checked' : '') + ' onchange="Modules.Catalogo._onUnicoSrcChange()" style="accent-color:#C4362A;"> Selecionar receita</label>' +
      '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;">' +
      '<input type="radio" name="pm-unico-src" id="pm-unico-pronto" value="produto_pronto"' + (unicoSubPronto ? ' checked' : '') + ' onchange="Modules.Catalogo._onUnicoSrcChange()" style="accent-color:#C4362A;"> Selecionar produto pronto</label>' +
      '</div>' +
      '<div id="pm-unico-receita-panel" style="display:' + (unicoSubReceita ? 'block' : 'none') + ';">' +
      '<label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Receita</label>' +
      '<select id="pm-ficha-id" style="width:100%;padding:9px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;">' +
      '<option value="">Selecionar receita...</option>' + fichaOptions + '</select></div>' +
      '<div id="pm-unico-pronto-panel" style="display:' + (unicoSubPronto ? 'block' : 'none') + ';">' +
      '<label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Produto Pronto</label>' +
      '<select id="pm-pronto-id" style="width:100%;padding:9px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;">' +
      '<option value="">Selecionar produto pronto...</option>' + prontoOptions + '</select></div>' +
      '</div>' +

      // Menu panel
      '<div id="pm-panel-menu" style="display:' + (tipoMenu ? 'block' : 'none') + ';">' +
      '<div style="font-size:11px;font-weight:700;color:#8A7E7C;margin-bottom:4px;">Grupos de escolha do menu</div>' +
      '<p style="font-size:12px;color:#8A7E7C;line-height:1.35;margin:0 0 10px;">Crie grupos como “Sabor”, “Bebida” ou “Acompanhamento”. O cliente escolhe a quantidade definida em cada grupo.</p>' +
      '<div id="pm-menu-groups">' + menuGroupsHtml + '</div>' +
      '<button type="button" onclick="Modules.Catalogo._addMenuGroup()" style="width:100%;padding:9px;border-radius:9px;border:1.5px dashed #D4C8C6;background:transparent;font-size:13px;font-weight:600;cursor:pointer;color:#8A7E7C;font-family:inherit;margin-top:4px;">+ Adicionar grupo ao menu</button>' +
      '</div>' +
      '</div>' +

      // Change D: Variantes
      '<div style="margin-bottom:12px;padding:12px;background:#F9F7F7;border-radius:10px;">' +
      '<div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Variantes</div>' +
      (_variants.length === 0 ? '<p style="font-size:12px;color:#8A7E7C;">Nenhum grupo de variantes criado ainda.</p>' :
        '<div id="pm-variant-checks">' + variantChecks + '</div>') +
      '</div>' +

      // Internal note
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Nota Interna</label>' +
      '<input id="pm-note" type="text" value="' + _esc(p.internalNote || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +

      // Visibility toggle
      '<div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;padding:12px;background:#F2EDED;border-radius:10px;">' +
      '<div><div style="font-size:13px;font-weight:600;">Visivel no Menu</div><div style="font-size:11px;color:#8A7E7C;">Mostrar este produto no cardapio</div></div>' +
      '<button type="button" id="pm-visible-toggle" onclick="Modules.Catalogo._toggleVis()" style="width:42px;height:24px;border-radius:12px;border:none;cursor:pointer;position:relative;transition:background .2s;background:' + (p.menuVisible !== false ? '#C4362A' : '#D4C8C6') + ';">' +
      '<span style="position:absolute;top:3px;left:3px;width:18px;height:18px;background:#fff;border-radius:50%;transition:transform .2s;display:block;transform:translateX(' + (p.menuVisible !== false ? '18px' : '0') + ');box-shadow:0 1px 4px rgba(0,0,0,.2);"></span></button>' +
      '</div>' +

      // Change E: SEO collapsible (open by default)
      '<details open style="margin-bottom:12px;padding:12px;background:#F9F7F7;border-radius:10px;">' +
      '<summary style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;cursor:pointer;list-style:none;display:flex;align-items:center;gap:6px;">' +
      '<span class="mi" style="font-size:16px;">expand_more</span>SEO</summary>' +
      '<div style="margin-top:10px;display:flex;flex-direction:column;gap:10px;">' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Titulo SEO</label>' +
      '<input id="pm-seo-title" type="text" value="' + _esc(p.seoTitle || p.name || '') + '" oninput="Modules.Catalogo._seoEdited(\'title\')" style="width:100%;padding:9px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;"></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Descricao SEO</label>' +
      '<textarea id="pm-seo-desc" oninput="Modules.Catalogo._seoEdited(\'desc\')" style="width:100%;padding:9px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;min-height:50px;resize:vertical;">' + _esc(p.seoDescription || p.description || '') + '</textarea></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">URL Slug</label>' +
      '<input id="pm-seo-slug" type="text" value="' + _esc(p.slug || _toSlug(p.name || '')) + '" oninput="Modules.Catalogo._seoEdited(\'slug\')" style="width:100%;padding:9px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;"></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Palavra-chave principal</label>' +
      '<input id="pm-seo-kw" type="text" value="' + _esc(p.seoKeyword || '') + '" style="width:100%;padding:9px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;"></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Alt da imagem</label>' +
      '<input id="pm-seo-alt" type="text" value="' + _esc(p.imageAlt || p.name || '') + '" oninput="Modules.Catalogo._seoEdited(\'alt\')" style="width:100%;padding:9px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;"></div>' +
      '</div></details>' +
      '</div>';

    var footer = '<div style="display:flex;gap:10px;">' +
      '<button onclick="Modules.Catalogo._saveProduct()" style="flex:2;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">' + (id ? 'Atualizar' : '+ Adicionar') + '</button>' +
      '</div>';

    window._productModal = UI.modal({ title: id ? 'Editar Produto' : 'Novo Produto', body: body, footer: footer });
    window._pmVisible = p.menuVisible !== false;
    window._pmImageBase64 = p.imageBase64 || null;
    window._pmSeoEdited = {};

    // Init menu sortable
    setTimeout(function () {
      var menuListEl = document.getElementById('pm-menu-groups');
      if (menuListEl) {
        makeSortable(menuListEl, function () {}); // order tracked on save
      }
    }, 100);
  }

  function _normalizeProduct(p) {
    p = Object.assign({}, p || {});
    p.shortDesc = p.shortDesc || p.description || p.desc || '';
    p.fullDesc = p.fullDesc || p.fullDescription || p.seoDescription || p.seoDesc || p.shortDesc || '';
    p.description = p.shortDesc;
    p.imageUrl = p.imageUrl || p.img || '';
    p.categoryId = p.categoryId || p.category || '';
    p.seoDescription = p.seoDescription || p.seoDesc || p.fullDesc || p.shortDesc || '';
    p.type = p.type || (p.category === 'menu' ? 'menu' : 'unico');
    return p;
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

  function _normalizeMenuGroups(p) {
    if (Array.isArray(p.menuChoiceGroups) && p.menuChoiceGroups.length) {
      return p.menuChoiceGroups.map(function (g) {
        return {
          title: g.title || g.name || 'Escolha',
          min: parseInt(g.min || g.qty || 1, 10) || 1,
          max: parseInt(g.max || g.qty || g.min || 1, 10) || 1,
          options: (g.options || []).map(function (o) {
            var ref = o.ref || o.value || '';
            return { ref: ref, label: o.label || _labelForMenuRef(ref), priceExtra: parseFloat(o.priceExtra || 0) || 0 };
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
        options: ref ? [{ ref: ref, label: _labelForMenuRef(ref), priceExtra: 0 }] : []
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
    if (!window._pmSeoEdited['slug']) {
      var slugEl = document.getElementById('pm-seo-slug');
      if (slugEl) slugEl.value = _toSlug(name);
    }
    if (!window._pmSeoEdited['alt']) {
      var altEl = document.getElementById('pm-seo-alt');
      if (altEl) altEl.value = name;
    }
  }

  function _onProductDescChange() {
    var desc = (document.getElementById('pm-short-desc') || {}).value || '';
    window._pmSeoEdited = window._pmSeoEdited || {};
    if (!window._pmSeoEdited['desc']) {
      var el = document.getElementById('pm-seo-desc');
      if (el) el.value = desc;
    }
  }

  // Change B: Tipo toggles
  function _onTipoChange() {
    var val = document.querySelector('input[name="pm-tipo"]:checked');
    var isMenu = val && val.value === 'menu';
    var up = document.getElementById('pm-panel-unico');
    var mp = document.getElementById('pm-panel-menu');
    if (up) up.style.display = isMenu ? 'none' : 'block';
    if (mp) mp.style.display = isMenu ? 'block' : 'none';
  }

  function _onUnicoSrcChange() {
    var val = document.querySelector('input[name="pm-unico-src"]:checked');
    var isReceita = !val || val.value === 'receita';
    var rp = document.getElementById('pm-unico-receita-panel');
    var pp = document.getElementById('pm-unico-pronto-panel');
    if (rp) rp.style.display = isReceita ? 'block' : 'none';
    if (pp) pp.style.display = isReceita ? 'none' : 'block';
  }

  function _menuOptionPool() {
    var rows = [];
    _fichas.forEach(function (f) { rows.push({ ref: 'ficha:' + f.id, label: 'Receita: ' + f.name }); });
    _produtosProntos.forEach(function (pp) { rows.push({ ref: 'pronto:' + pp.id, label: 'Pronto: ' + pp.name }); });
    return rows;
  }

  function _menuSelectedOptionsHtml(idx, group) {
    var options = group.options || [];
    if (!options.length) return '<div data-menu-empty="' + idx + '" style="font-size:12px;color:#8A7E7C;padding:10px;border:1px dashed #D4C8C6;border-radius:9px;text-align:center;">Nenhuma opção adicionada neste grupo.</div>';
    return options.map(function (o) {
      return '<div data-menu-selected="' + idx + '" data-ref="' + _esc(o.ref) + '" data-label="' + _esc(o.label || _labelForMenuRef(o.ref)) + '" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border:1px solid #F2EDED;border-radius:9px;background:#fff;margin-bottom:6px;">' +
        '<span style="font-size:13px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + _esc(o.label || _labelForMenuRef(o.ref)) + '</span>' +
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
      return '<button type="button" data-menu-candidate="' + idx + '" data-ref="' + _esc(o.ref) + '" data-label="' + _esc(o.label) + '" onclick="Modules.Catalogo._addMenuOption(' + idx + ', \'' + _esc(o.ref) + '\', \'' + _esc(o.label) + '\')" style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border:none;border-bottom:1px solid #F2EDED;background:#fff;text-align:left;cursor:pointer;font-family:inherit;">' +
        '<span style="font-size:12px;font-weight:600;">' + _esc(o.label) + '</span><span style="font-size:11px;color:#C4362A;font-weight:800;">Adicionar</span></button>';
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

  function _addMenuOption(idx, ref, label) {
    var selectedBox = document.getElementById('pm-menu-selected-' + idx);
    var candidatesBox = document.getElementById('pm-menu-candidates-' + idx);
    if (!selectedBox || !candidatesBox) return;
    if (selectedBox.querySelector('[data-ref="' + ref.replace(/"/g, '\\"') + '"]')) return;
    var empty = selectedBox.querySelector('[data-menu-empty]');
    if (empty) empty.remove();
    selectedBox.insertAdjacentHTML('beforeend',
      '<div data-menu-selected="' + idx + '" data-ref="' + _esc(ref) + '" data-label="' + _esc(label) + '" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border:1px solid #F2EDED;border-radius:9px;background:#fff;margin-bottom:6px;">' +
      '<span style="font-size:13px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + _esc(label) + '</span>' +
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
      return '<button type="button" data-menu-candidate="' + idx + '" data-ref="' + _esc(o.ref) + '" data-label="' + _esc(o.label) + '" onclick="Modules.Catalogo._addMenuOption(' + idx + ', \'' + _esc(o.ref) + '\', \'' + _esc(o.label) + '\')" style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border:none;border-bottom:1px solid #F2EDED;background:#fff;text-align:left;cursor:pointer;font-family:inherit;">' +
        '<span style="font-size:12px;font-weight:600;">' + _esc(o.label) + '</span><span style="font-size:11px;color:#C4362A;font-weight:800;">Adicionar</span></button>';
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
    var reader = new FileReader();
    reader.onload = function (e) {
      window._pmImageBase64 = e.target.result;
      var preview = document.getElementById('pm-img-preview');
      if (preview) { preview.src = e.target.result; preview.style.display = 'block'; }
    };
    reader.readAsDataURL(file);
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
    var name = (document.getElementById('pm-name') || {}).value || '';
    if (!name) { UI.toast('Nome e obrigatorio', 'error'); return; }

    // Change B: tipo
    var tipoEl = document.querySelector('input[name="pm-tipo"]:checked');
    var tipo = tipoEl ? tipoEl.value : 'unico';

    var unicoSrcEl = document.querySelector('input[name="pm-unico-src"]:checked');
    var unicoSrc = unicoSrcEl ? unicoSrcEl.value : 'receita';

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
          options.push({ ref: opt.dataset.ref, label: opt.dataset.label || opt.dataset.ref, priceExtra: 0 });
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
    var seoSlug = (document.getElementById('pm-seo-slug') || {}).value || _toSlug(name);
    var seoKw = (document.getElementById('pm-seo-kw') || {}).value || '';
    var seoAlt = (document.getElementById('pm-seo-alt') || {}).value || name;

    var data = {
      name: name,
      price: parseFloat((document.getElementById('pm-price') || {}).value) || 0,
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
      produtoProntoId: (tipo === 'unico' && unicoSrc === 'produto_pronto') ? ((document.getElementById('pm-pronto-id') || {}).value || '') : '',
      menuItems: tipo === 'menu' ? menuItems : [],
      menuChoiceGroups: tipo === 'menu' ? menuChoiceGroups : [],
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

    // Change F: image
    if (window._pmImageBase64) {
      data.imageBase64 = window._pmImageBase64;
    } else {
      var urlEl = document.getElementById('pm-img-url');
      if (urlEl) data.imageUrl = urlEl.value.trim();
    }

    var op = _editingId ? DB.update('products', _editingId, data) : DB.add('products', data);
    op.then(function () {
      UI.toast(_editingId ? 'Produto atualizado!' : 'Produto adicionado!', 'success');
      if (window._productModal) window._productModal.close();
      _renderProdutos();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
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
        '<div id="cat-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;">' +
        _categories.map(function (c) {
          var color = c.color || '#C4362A';
          return '<div draggable="true" data-id="' + c.id + '" style="background:#fff;border-radius:12px;padding:14px;box-shadow:0 2px 8px rgba(0,0,0,.06);display:flex;align-items:center;gap:10px;cursor:grab;">' +
            '<span class="mi" style="color:#D4C8C6;font-size:16px;">drag_indicator</span>' +
            '<div style="width:36px;height:36px;border-radius:9px;background:' + color + '20;display:flex;align-items:center;justify-content:center;">' +
            '<div style="width:14px;height:14px;border-radius:50%;background:' + color + ';"></div></div>' +
            '<span style="flex:1;font-size:14px;font-weight:700;">' + _esc(c.name) + '</span>' +
            '<button onclick="Modules.Catalogo._openCatModal(\'' + c.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;"><span class="mi" style="font-size:14px;">edit</span></button>' +
            '<button onclick="Modules.Catalogo._deleteCat(\'' + c.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;"><span class="mi" style="font-size:14px;">delete</span></button>' +
            '</div>';
        }).join('') + '</div>');

    if (_categories.length > 0) {
      var listEl = document.getElementById('cat-list');
      if (listEl) {
        makeSortable(listEl, function (orders) {
          orders.forEach(function (o) { DB.update('categories', o.id, { order: o.order }); });
        });
      }
    }
  }

  function _openCatModal(id) {
    _editingId = id;
    var c = id ? (_categories.find(function (x) { return x.id === id; }) || {}) : {};
    var COLORS = ['#C4362A','#1A9E5A','#2563EB','#7C3AED','#D97706','#0891B2','#DB2777','#64748B','#EA580C','#059669'];
    var body = '<div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Nome *</label><input id="cat-name" type="text" value="' + _esc(c.name || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:8px;">Cor</label>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;" id="cat-colors">' +
      COLORS.map(function (col) {
        return '<button type="button" data-color="' + col + '" onclick="Modules.Catalogo._selectCatColor(\'' + col + '\')" style="width:32px;height:32px;border-radius:50%;background:' + col + ';border:3px solid ' + (c.color === col ? '#fff' : 'transparent') + ';outline:' + (c.color === col ? '3px solid ' + col : 'none') + ';cursor:pointer;transition:transform .15s;" onmouseover="this.style.transform=\'scale(1.15)\'" onmouseout="this.style.transform=\'scale(1)\'"></button>';
      }).join('') + '</div></div></div>';

    window._catColor = c.color || COLORS[0];
    var footer = '<button onclick="Modules.Catalogo._saveCat()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">' + (id ? 'Atualizar' : 'Adicionar') + '</button>';
    window._catModal = UI.modal({ title: id ? 'Editar Categoria' : 'Nova Categoria', body: body, footer: footer });
  }

  function _selectCatColor(color) {
    window._catColor = color;
    document.querySelectorAll('#cat-colors button').forEach(function (btn) {
      var isSelected = btn.dataset.color === color;
      btn.style.border = '3px solid ' + (isSelected ? '#fff' : 'transparent');
      btn.style.outline = isSelected ? '3px solid ' + color : 'none';
    });
  }

  function _saveCat() {
    var name = (document.getElementById('cat-name') || {}).value || '';
    if (!name) { UI.toast('Nome e obrigatorio', 'error'); return; }
    var data = { name: name, color: window._catColor || '#C4362A' };
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
    window._ppImageBase64 = pp.imageBase64 || null;
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
      var imgPreview = pp.imageBase64
        ? '<img id="pp-img-preview" src="' + pp.imageBase64 + '" style="max-width:100%;max-height:100px;border-radius:9px;margin-top:8px;display:block;">'
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
        '<input type="file" id="pp-img-file" accept="image/*" onchange="Modules.Catalogo._onProntoImgChange(event)" style="width:100%;padding:8px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;">' +
        imgPreview + '</div>' +
        '</div>';
      var footer = '<button onclick="Modules.Catalogo._savePronto()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">' + (id ? 'Atualizar' : 'Adicionar') + '</button>';
      window._prontosModal = UI.modal({ title: id ? 'Editar Produto Pronto' : 'Novo Produto Pronto', body: body, footer: footer });
    });
  }

  function _onProntoImgChange(event) {
    var file = event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      window._ppImageBase64 = e.target.result;
      var preview = document.getElementById('pp-img-preview');
      if (preview) { preview.src = e.target.result; preview.style.display = 'block'; }
    };
    reader.readAsDataURL(file);
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
    if (window._ppImageBase64) data.imageBase64 = window._ppImageBase64;
    var op = _editingId ? DB.update('produtos_prontos', _editingId, data) : DB.add('produtos_prontos', data);
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
  function _renderVariantes() {
    DB.getAll('variantGroups').then(function (vgs) {
      _variants = (vgs || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      _paintVariantes();
    });
  }

  function _paintVariantes() {
    var content = document.getElementById('catalogo-content');
    if (!content) return;
    content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">' +
      '<h2 style="font-size:20px;font-weight:800;">Grupos de Variantes</h2>' +
      '<button onclick="Modules.Catalogo._openVariantModal(null)" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Novo Grupo</button>' +
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

  // ── INSUMOS (Change H: search + unidade de compra column) ─────────────────
  function _renderInsumos() {
    DB.getAll('insumos').then(function (ins) {
      _insumos = ins || [];
      _paintInsumos();
    });
  }

  function _paintInsumos() {
    var content = document.getElementById('catalogo-content');
    if (!content) return;
    content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">' +
      '<h2 style="font-size:20px;font-weight:800;">Insumos (' + _insumos.length + ')</h2>' +
      '<button onclick="Modules.Catalogo._openInsumoModal(null)" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Adicionar</button>' +
      '</div>' +
      // Change H: search bar
      '<div style="margin-bottom:14px;">' +
      '<input id="insumos-search" type="text" placeholder="Pesquisar insumo..." oninput="Modules.Catalogo._filterInsumos()" style="width:100%;padding:10px 14px;border:1.5px solid #D4C8C6;border-radius:20px;font-size:13px;font-family:inherit;outline:none;">' +
      '</div>' +
      (_insumos.length === 0 ? UI.emptyState('Nenhum insumo ainda', '') :
        '<div style="overflow-x:auto;" id="insumos-table-wrap"><table style="width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
        '<thead><tr style="background:#F2EDED;">' +
        '<th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Nome</th>' +
        '<th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Unidade</th>' +
        '<th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Unidade de compra</th>' +
        '<th style="padding:12px 16px;text-align:right;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">Preco/Un.</th>' +
        '<th style="padding:12px 4px;text-align:right;"></th>' +
        '</tr></thead><tbody id="insumos-tbody">' +
        _insumos.map(function (ins) { return _insumoRowHtml(ins); }).join('') +
        '</tbody></table></div>');
  }

  function _insumoRowHtml(ins) {
    return '<tr data-insumo-name="' + _esc((ins.name || '').toLowerCase()) + '" style="border-top:1px solid #F2EDED;">' +
      '<td style="padding:12px 16px;font-size:13px;font-weight:700;">' + _esc(ins.name) + '</td>' +
      '<td style="padding:12px 16px;font-size:13px;color:#8A7E7C;">' + _esc(ins.unit || '—') + '</td>' +
      '<td style="padding:12px 16px;font-size:13px;color:#8A7E7C;">' + _esc(ins.purchaseUnit || ins.unit || '—') + '</td>' +
      '<td style="padding:12px 16px;font-size:13px;text-align:right;">' + UI.fmt(ins.pricePerUnit || 0) + '</td>' +
      '<td style="padding:12px 8px;text-align:right;">' +
      '<button onclick="Modules.Catalogo._openInsumoModal(\'' + ins.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;margin-right:4px;"><span class="mi" style="font-size:14px;">edit</span></button>' +
      '<button onclick="Modules.Catalogo._deleteInsumo(\'' + ins.id + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;"><span class="mi" style="font-size:14px;">delete</span></button>' +
      '</td></tr>';
  }

  function _filterInsumos() {
    var search = ((document.getElementById('insumos-search') || {}).value || '').toLowerCase();
    var tbody = document.getElementById('insumos-tbody');
    if (!tbody) return;
    tbody.querySelectorAll('tr[data-insumo-name]').forEach(function (row) {
      var name = row.dataset.insumoName || '';
      row.style.display = name.indexOf(search) >= 0 ? '' : 'none';
    });
  }

  function _openInsumoModal(id) {
    _editingId = id;
    var ins = id ? (_insumos.find(function (x) { return x.id === id; }) || {}) : {};
    DB.getAll('unidades_medida').then(function (units) {
      units = units || [];
      var unitOpts = '<option value="">Selecionar unidade</option>' +
        units.map(function (u) {
          var val = u.symbol || u.name;
          var sel = (ins.unit === val) ? ' selected' : '';
          return '<option value="' + _esc(val) + '"' + sel + '>' + _esc(u.name) + ' (' + _esc(u.symbol) + ')</option>';
        }).join('');

      var body = '<div>' +
        '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Nome *</label>' +
        '<input id="ins-name" type="text" value="' + _esc(ins.name || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
        '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Unidade</label>' +
        '<select id="ins-unit" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;background:#fff;">' + unitOpts + '</select></div>' +
        '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Unidade de compra</label>' +
        '<input id="ins-purchase-unit" type="text" value="' + _esc(ins.purchaseUnit || '') + '" placeholder="caixa, fardo..." style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
        '</div>' +
        '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Preco por Unidade (EUR)</label>' +
        '<input id="ins-price" type="number" step="0.001" value="' + (ins.pricePerUnit || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
        '</div>';

      var footer = '<button onclick="Modules.Catalogo._saveInsumo()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">' + (id ? 'Atualizar' : 'Adicionar') + '</button>';
      window._insumoModal = UI.modal({ title: id ? 'Editar Insumo' : 'Novo Insumo', body: body, footer: footer });
    });
  }

  function _saveInsumo() {
    var name = (document.getElementById('ins-name') || {}).value || '';
    if (!name) { UI.toast('Nome e obrigatorio', 'error'); return; }
    var data = {
      name: name,
      unit: (document.getElementById('ins-unit') || {}).value || '',
      purchaseUnit: (document.getElementById('ins-purchase-unit') || {}).value || '',
      pricePerUnit: parseFloat((document.getElementById('ins-price') || {}).value) || 0
    };
    var op = _editingId ? DB.update('insumos', _editingId, data) : DB.add('insumos', data);
    op.then(function () {
      UI.toast('Insumo salvo!', 'success');
      if (window._insumoModal) window._insumoModal.close();
      _renderInsumos();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _deleteInsumo(id) {
    UI.confirm('Eliminar este insumo?').then(function (yes) {
      if (!yes) return;
      DB.remove('insumos', id).then(function () { UI.toast('Eliminado', 'info'); _renderInsumos(); });
    });
  }

  // ── FICHAS TÉCNICAS (Change I: search) ────────────────────────────────────
  function _renderFichas() {
    Promise.all([DB.getAll('fichasTecnicas'), DB.getAll('insumos')]).then(function (r) {
      _fichas = r[0] || [];
      _insumos = r[1] || [];
      _paintFichas();
    });
  }

  function _paintFichas() {
    var content = document.getElementById('catalogo-content');
    if (!content) return;
    content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">' +
      '<h2 style="font-size:20px;font-weight:800;">Fichas Tecnicas (' + _fichas.length + ')</h2>' +
      '<button onclick="Modules.Catalogo._openFichaModal(null)" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Nova Ficha</button>' +
      '</div>' +
      // Change I: search bar
      '<div style="margin-bottom:14px;">' +
      '<input id="fichas-search" type="text" placeholder="Pesquisar ficha tecnica..." oninput="Modules.Catalogo._filterFichas()" style="width:100%;padding:10px 14px;border:1.5px solid #D4C8C6;border-radius:20px;font-size:13px;font-family:inherit;outline:none;">' +
      '</div>' +
      (_fichas.length === 0 ? UI.emptyState('Nenhuma ficha tecnica ainda', '') :
        '<div id="fichas-list" style="display:flex;flex-direction:column;gap:12px;">' +
        _fichas.map(function (f) {
          var totalCost = (f.ingredients || []).reduce(function (s, ing) {
            var ins = _insumos.find(function (i) { return i.id === ing.insumoId; });
            return s + ((ins ? ins.pricePerUnit : 0) * (ing.qty || 0));
          }, 0);
          return '<div data-ficha-name="' + _esc((f.name || '').toLowerCase()) + '" style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
            '<div><div style="font-size:15px;font-weight:800;">' + _esc(f.name) + '</div>' +
            '<div style="font-size:11px;color:#8A7E7C;">Rendimento: ' + (f.yield || 1) + ' porcoes · Custo: ' + UI.fmt(totalCost) + ' · Por porcao: ' + UI.fmt(totalCost / (f.yield || 1)) + '</div></div>' +
            '<div style="display:flex;gap:6px;">' +
            '<button onclick="Modules.Catalogo._openFichaModal(\'' + f.id + '\')" style="width:30px;height:30px;border-radius:8px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;"><span class="mi" style="font-size:14px;">edit</span></button>' +
            '<button onclick="Modules.Catalogo._deleteFicha(\'' + f.id + '\')" style="width:30px;height:30px;border-radius:8px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;"><span class="mi" style="font-size:14px;">delete</span></button>' +
            '</div></div>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
            (f.ingredients || []).map(function (ing) {
              var ins = _insumos.find(function (i) { return i.id === ing.insumoId; });
              return '<span style="font-size:11px;padding:3px 9px;border-radius:20px;background:#F2EDED;">' + (ins ? _esc(ins.name) : '?') + ' ' + ing.qty + (ins ? _esc(ins.unit) : '') + '</span>';
            }).join('') + '</div></div>';
        }).join('') + '</div>');
  }

  function _filterFichas() {
    var search = ((document.getElementById('fichas-search') || {}).value || '').toLowerCase();
    var list = document.getElementById('fichas-list');
    if (!list) return;
    list.querySelectorAll('[data-ficha-name]').forEach(function (el) {
      var name = el.dataset.fichaName || '';
      el.style.display = name.indexOf(search) >= 0 ? '' : 'none';
    });
  }

  function _openFichaModal(id) {
    _editingId = id;
    var f = id ? (_fichas.find(function (x) { return x.id === id; }) || {}) : {};
    window._fcImageBase64 = f.imageBase64 || null;
    var insOptions = _insumos.map(function (ins) {
      return '<option value="' + ins.id + '">' + _esc(ins.name) + ' (' + _esc(ins.unit) + ')</option>';
    }).join('');

    var ingRows = (f.ingredients || []).map(function (ing, i) {
      return _fichaIngRow(i, ing.insumoId, ing.qty, insOptions);
    }).join('');

    var imgPreview = f.imageBase64
      ? '<img id="fc-img-preview" src="' + f.imageBase64 + '" style="max-width:100%;max-height:100px;border-radius:9px;margin-top:8px;display:block;">'
      : '<img id="fc-img-preview" style="max-width:100%;max-height:100px;border-radius:9px;margin-top:8px;display:none;">';

    var body = '<div>' +
      '<div style="display:grid;grid-template-columns:2fr 1fr;gap:12px;margin-bottom:12px;">' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Nome da Receita *</label>' +
      '<input id="fc-name" type="text" value="' + _esc(f.name || '') + '" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '<div><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Rendimento (porcoes)</label>' +
      '<input id="fc-yield" type="number" value="' + (f.yield || 1) + '" min="1" style="width:100%;padding:10px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:14px;font-family:inherit;outline:none;"></div>' +
      '</div>' +
      '<div style="margin-bottom:12px;"><label style="font-size:11px;font-weight:700;color:#8A7E7C;display:block;margin-bottom:4px;">Imagem</label>' +
      '<input type="file" id="fc-img-file" accept="image/*" onchange="Modules.Catalogo._onFichaImgChange(event)" style="width:100%;padding:8px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;">' +
      imgPreview + '</div>' +
      '<div style="font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Ingredientes</div>' +
      '<div id="fc-ings">' + (ingRows || '') + '</div>' +
      '<button type="button" onclick="Modules.Catalogo._addFichaIng()" style="width:100%;padding:9px;border-radius:9px;border:1.5px dashed #D4C8C6;background:transparent;font-size:13px;font-weight:600;cursor:pointer;color:#8A7E7C;font-family:inherit;margin-top:4px;">+ Adicionar Ingrediente</button>' +
      '<div id="fc-cost" style="margin-top:12px;padding:10px 14px;background:#F2EDED;border-radius:10px;font-size:13px;font-weight:700;display:flex;justify-content:space-between;">' +
      '<span>Custo Total</span><span id="fc-cost-val">EUR0,00</span></div>' +
      '</div>';

    window._fichaIngCount = (f.ingredients || []).length;
    window._fichaInsOptions = insOptions;
    var footer = '<button onclick="Modules.Catalogo._saveFicha()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">' + (id ? 'Atualizar' : 'Criar Ficha') + '</button>';
    window._fichaModal = UI.modal({ title: id ? 'Editar Ficha' : 'Nova Ficha Tecnica', body: body, footer: footer });
    setTimeout(_updateFichaCost, 100);
  }

  function _onFichaImgChange(event) {
    var file = event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      window._fcImageBase64 = e.target.result;
      var preview = document.getElementById('fc-img-preview');
      if (preview) { preview.src = e.target.result; preview.style.display = 'block'; }
    };
    reader.readAsDataURL(file);
  }

  function _fichaIngRow(idx, selectedId, qty, insOptions) {
    if (insOptions === undefined) insOptions = window._fichaInsOptions || '';
    var opts = insOptions.replace('value="' + selectedId + '"', 'value="' + selectedId + '" selected');
    return '<div id="fc-ing-' + idx + '" style="display:grid;grid-template-columns:1fr 100px 32px;gap:8px;margin-bottom:8px;align-items:center;">' +
      '<select data-ing-idx="' + idx + '" onchange="Modules.Catalogo._updateFichaCost()" style="width:100%;padding:9px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;"><option value="">Selecionar insumo</option>' + opts + '</select>' +
      '<input type="number" step="0.001" value="' + (qty || '') + '" placeholder="Qty" data-ing-qty="' + idx + '" oninput="Modules.Catalogo._updateFichaCost()" style="width:100%;padding:9px;border:1.5px solid #D4C8C6;border-radius:9px;font-size:13px;font-family:inherit;outline:none;">' +
      '<button type="button" onclick="Modules.Catalogo._removeFichaIng(' + idx + ')" style="width:32px;height:38px;border-radius:8px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;font-size:14px;">x</button>' +
      '</div>';
  }

  function _addFichaIng() {
    var container = document.getElementById('fc-ings');
    if (!container) return;
    var idx = window._fichaIngCount || 0;
    window._fichaIngCount = idx + 1;
    container.insertAdjacentHTML('beforeend', _fichaIngRow(idx, '', '', window._fichaInsOptions));
  }

  function _removeFichaIng(idx) {
    var el = document.getElementById('fc-ing-' + idx);
    if (el) el.remove();
    _updateFichaCost();
  }

  function _updateFichaCost() {
    var container = document.getElementById('fc-ings');
    if (!container) return;
    var total = 0;
    container.querySelectorAll('select[data-ing-idx]').forEach(function (sel) {
      var idx = sel.dataset.ingIdx;
      var insId = sel.value;
      var qtyEl = container.querySelector('input[data-ing-qty="' + idx + '"]');
      var qty = parseFloat(qtyEl ? qtyEl.value : 0) || 0;
      var ins = _insumos.find(function (i) { return i.id === insId; });
      if (ins) total += ins.pricePerUnit * qty;
    });
    var costEl = document.getElementById('fc-cost-val');
    if (costEl) costEl.textContent = UI.fmt(total);
  }

  function _saveFicha() {
    var name = (document.getElementById('fc-name') || {}).value || '';
    if (!name) { UI.toast('Nome e obrigatorio', 'error'); return; }
    var yieldVal = parseInt((document.getElementById('fc-yield') || {}).value) || 1;
    var container = document.getElementById('fc-ings');
    var ingredients = [];
    if (container) {
      container.querySelectorAll('select[data-ing-idx]').forEach(function (sel) {
        var idx = sel.dataset.ingIdx;
        var insumoId = sel.value;
        if (!insumoId) return;
        var qtyEl = container.querySelector('input[data-ing-qty="' + idx + '"]');
        var qty = parseFloat(qtyEl ? qtyEl.value : 0) || 0;
        ingredients.push({ insumoId: insumoId, qty: qty });
      });
    }
    var data = { name: name, yield: yieldVal, ingredients: ingredients };
    if (window._fcImageBase64) data.imageBase64 = window._fcImageBase64;
    var op = _editingId ? DB.update('fichasTecnicas', _editingId, data) : DB.add('fichasTecnicas', data);
    op.then(function () {
      UI.toast('Ficha salva!', 'success');
      if (window._fichaModal) window._fichaModal.close();
      _renderFichas();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _deleteFicha(id) {
    UI.confirm('Eliminar esta ficha?').then(function (yes) {
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
    _openProductModal: _openProductModal, _toggleVis: _toggleVis, _saveProduct: _saveProduct, _deleteProduct: _deleteProduct,
    _onProductNameChange: _onProductNameChange, _onProductDescChange: _onProductDescChange,
    _seoEdited: _seoEdited, _onTipoChange: _onTipoChange, _onUnicoSrcChange: _onUnicoSrcChange,
    _addMenuGroup: _addMenuGroup, _removeMenuGroup: _removeMenuGroup,
    _addMenuOption: _addMenuOption, _removeMenuOption: _removeMenuOption, _filterMenuOptions: _filterMenuOptions,
    _onImgFileChange: _onImgFileChange,
    _onProntoImgChange: _onProntoImgChange, _onFichaImgChange: _onFichaImgChange,
    _openCatModal: _openCatModal, _selectCatColor: _selectCatColor, _saveCat: _saveCat, _deleteCat: _deleteCat,
    _openProntosModal: _openProntosModal, _savePronto: _savePronto, _deletePronto: _deletePronto,
    _openVariantModal: _openVariantModal, _saveVariant: _saveVariant, _deleteVariant: _deleteVariant,
    _openInsumoModal: _openInsumoModal, _saveInsumo: _saveInsumo, _deleteInsumo: _deleteInsumo,
    _filterInsumos: _filterInsumos,
    _openFichaModal: _openFichaModal, _addFichaIng: _addFichaIng, _removeFichaIng: _removeFichaIng,
    _updateFichaCost: _updateFichaCost, _saveFicha: _saveFicha, _deleteFicha: _deleteFicha,
    _filterFichas: _filterFichas,
    _openTagModal: _openTagModal, _saveTag: _saveTag, _deleteTag: _deleteTag, _updateTagModalPreview: _updateTagModalPreview
  };
})();
