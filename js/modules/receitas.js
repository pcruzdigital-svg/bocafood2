// js/modules/receitas.js
window.Modules = window.Modules || {};
Modules.Receitas = (function () {
  'use strict';

  var _activeSub = 'receitas';
  var _recipeCategories = [];
  var _editingCategoryId = null;
  var _recipeComponents = [];
  var _editingComponentId = null;
  var _units = [];
  var _editingUnitId = null;
  var TABS = [
    { key: 'receitas', label: 'Receitas' },
    { key: 'insumos', label: 'Insumos' },
    { key: 'componentes', label: 'Componentes da receita' },
    { key: 'categorias-receita', label: 'Categorias' },
    { key: 'unidades', label: 'Unidades' }
  ];

  function render(sub) {
    _activeSub = sub || 'receitas';
    if (_activeSub === 'tipos' || _activeSub === 'categorias') _activeSub = 'categorias-receita';
    var app = document.getElementById('app');
    app.innerHTML = '<section class="module-page">' +
      '<div class="module-head"><div><h1>Produção</h1><p>Fichas técnicas, insumos, componentes e unidades usadas na produção.</p></div></div>' +
      '<div id="receitas-tabs" class="module-tabs"></div>' +
      '<div id="receitas-content" class="module-content"><div class="loading-inline">Carregando...</div></div>' +
      '</section>';
    _renderTabs();
    _loadSub(_activeSub);
  }

  function _renderTabs() {
    var el = document.getElementById('receitas-tabs');
    if (!el) return;
    el.innerHTML = TABS.map(function (t) {
      return '<button class="' + (t.key === _activeSub ? 'active' : '') + '" onclick="Modules.Receitas._switchSub(\'' + t.key + '\')">' + t.label + '</button>';
    }).join('');
  }

  function _switchSub(key) {
    if (key === 'tipos' || key === 'categorias') key = 'categorias-receita';
    _activeSub = key;
    _renderTabs();
    _loadSub(key);
    Router.navigate('receitas/' + key);
  }

  function _loadSub(key) {
    if (key === 'tipos' || key === 'categorias') key = 'categorias-receita';
    var content = document.getElementById('receitas-content');
    if (!content) return;

    if (key === 'receitas') {
      content.innerHTML = '<div id="catalogo-content"></div>';
      return Modules.Catalogo._renderFichas();
    }

    content.innerHTML = '<div id="compras-content"></div>';
    if (key === 'insumos') return Modules.Compras._renderInsumos();
    if (key === 'componentes') return _renderRecipeComponents();
    if (key === 'categorias-receita') return _renderRecipeCategories();
    if (key === 'unidades') return _renderUnits();
  }

  function _renderRecipeComponents() {
    DB.getAll('recipe_components').then(function (items) {
      _recipeComponents = (items || []).slice().sort(function (a, b) {
        return (a.order || 0) - (b.order || 0) || String(a.name || '').localeCompare(String(b.name || ''));
      });
      _paintRecipeComponents();
    }).catch(function (err) {
      UI.toast('Erro: ' + err.message, 'error');
    });
  }

  function _paintRecipeComponents() {
    var content = document.getElementById('receitas-content');
    if (!content) return;
    content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">' +
      '<div><h2 style="font-size:20px;font-weight:800;margin-bottom:4px;">Componentes da Receita (' + _recipeComponents.length + ')</h2>' +
      '<p style="font-size:13px;color:#8A7E7C;">Componentes usados para organizar os insumos dentro das fichas técnicas.</p></div>' +
      '<button onclick="Modules.Receitas._openRecipeComponentModal(null)" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Adicionar</button>' +
      '</div>' +
      (_recipeComponents.length === 0 ? UI.emptyState('Nenhum componente ainda', '') :
        '<div style="display:flex;flex-direction:column;gap:10px;">' +
        _recipeComponents.map(function (comp) {
          return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
            '<div style="min-width:0;"><div style="font-size:15px;font-weight:800;">' + _esc(comp.name) + '</div>' +
            (comp.description ? '<div style="font-size:12px;color:#8A7E7C;margin-top:3px;">' + _esc(comp.description) + '</div>' : '') + '</div>' +
            '<div style="display:flex;gap:6px;flex-shrink:0;">' +
            '<button onclick="Modules.Receitas._openRecipeComponentModal(\'' + comp.id + '\')" style="width:30px;height:30px;border-radius:8px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;"><span class="mi" style="font-size:14px;">edit</span></button>' +
            '<button onclick="Modules.Receitas._deleteRecipeComponent(\'' + comp.id + '\')" style="width:30px;height:30px;border-radius:8px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;"><span class="mi" style="font-size:14px;">delete</span></button>' +
            '</div></div>';
        }).join('') + '</div>');
  }

  function _openRecipeComponentModal(id) {
    _editingComponentId = id;
    var comp = id ? (_recipeComponents.find(function (x) { return x.id === id; }) || {}) : {};
    var body = '<div>' +
      '<label class="field"><span>Nome do componente *</span><input id="rcomp-name" type="text" value="' + _esc(comp.name || '') + '" placeholder="Ex: Massa"></label>' +
      '<label class="field"><span>Descrição</span><textarea id="rcomp-desc" placeholder="Uso interno opcional">' + _esc(comp.description || '') + '</textarea></label>' +
      '</div>';
    var footer = '<button onclick="Modules.Receitas._saveRecipeComponent()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Salvar componente</button>';
    window._recipeComponentModal = UI.modal({ title: id ? 'Editar Componente da Receita' : 'Novo Componente da Receita', body: body, footer: footer });
  }

  function _saveRecipeComponent() {
    var name = ((document.getElementById('rcomp-name') || {}).value || '').trim();
    if (!name) { UI.toast('Nome obrigatório', 'error'); return; }
    var data = {
      name: name,
      description: ((document.getElementById('rcomp-desc') || {}).value || '').trim(),
      updatedAt: new Date().toISOString()
    };
    if (!_editingComponentId) data.createdAt = new Date().toISOString();
    var op = _editingComponentId ? DB.update('recipe_components', _editingComponentId, data) : DB.add('recipe_components', data);
    op.then(function () {
      UI.toast('Componente salvo', 'success');
      if (window._recipeComponentModal) window._recipeComponentModal.close();
      _renderRecipeComponents();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _deleteRecipeComponent(id) {
    UI.confirm('Eliminar este componente da receita?').then(function (yes) {
      if (!yes) return;
      DB.remove('recipe_components', id).then(function () {
        UI.toast('Componente eliminado', 'info');
        _renderRecipeComponents();
      });
    });
  }

  function _renderRecipeCategories() {
    DB.getAll('recipe_categories').then(function (items) {
      _recipeCategories = (items || []).slice().sort(function (a, b) {
        return (a.order || 0) - (b.order || 0) || String(a.name || '').localeCompare(String(b.name || ''));
      });
      _paintRecipeCategories();
    }).catch(function (err) {
      UI.toast('Erro: ' + err.message, 'error');
    });
  }

  function _paintRecipeCategories() {
    var content = document.getElementById('receitas-content');
    if (!content) return;
    content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">' +
      '<div><h2 style="font-size:20px;font-weight:800;margin-bottom:4px;">Categorias da Receita (' + _recipeCategories.length + ')</h2>' +
      '<p style="font-size:13px;color:#8A7E7C;">Organize as fichas técnicas por tipo de produção.</p></div>' +
      '<button onclick="Modules.Receitas._openRecipeCategoryModal(null)" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Adicionar</button>' +
      '</div>' +
      (_recipeCategories.length === 0 ? UI.emptyState('Nenhuma categoria ainda', '') :
        '<div style="display:flex;flex-direction:column;gap:10px;">' +
        _recipeCategories.map(function (cat) {
          return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
            '<div style="min-width:0;"><div style="font-size:15px;font-weight:800;">' + _esc(cat.name) + '</div>' +
            (cat.description ? '<div style="font-size:12px;color:#8A7E7C;margin-top:3px;">' + _esc(cat.description) + '</div>' : '') + '</div>' +
            '<div style="display:flex;gap:6px;flex-shrink:0;">' +
            '<button onclick="Modules.Receitas._openRecipeCategoryModal(\'' + cat.id + '\')" style="width:30px;height:30px;border-radius:8px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;"><span class="mi" style="font-size:14px;">edit</span></button>' +
            '<button onclick="Modules.Receitas._deleteRecipeCategory(\'' + cat.id + '\')" style="width:30px;height:30px;border-radius:8px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;"><span class="mi" style="font-size:14px;">delete</span></button>' +
            '</div></div>';
        }).join('') + '</div>');
  }

  function _openRecipeCategoryModal(id) {
    _editingCategoryId = id;
    var cat = id ? (_recipeCategories.find(function (x) { return x.id === id; }) || {}) : {};
    var body = '<div>' +
      '<label class="field"><span>Nome da categoria *</span><input id="rc-name" type="text" value="' + _esc(cat.name || '') + '" placeholder="Ex: Salgados"></label>' +
      '<label class="field"><span>Descrição</span><textarea id="rc-desc" placeholder="Uso interno opcional">' + _esc(cat.description || '') + '</textarea></label>' +
      '</div>';
    var footer = '<button onclick="Modules.Receitas._saveRecipeCategory()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Salvar categoria</button>';
    window._recipeCategoryModal = UI.modal({ title: id ? 'Editar Categoria da Receita' : 'Nova Categoria da Receita', body: body, footer: footer });
  }

  function _saveRecipeCategory() {
    var name = ((document.getElementById('rc-name') || {}).value || '').trim();
    if (!name) { UI.toast('Nome obrigatório', 'error'); return; }
    var data = {
      name: name,
      description: ((document.getElementById('rc-desc') || {}).value || '').trim(),
      updatedAt: new Date().toISOString()
    };
    if (!_editingCategoryId) data.createdAt = new Date().toISOString();
    var op = _editingCategoryId ? DB.update('recipe_categories', _editingCategoryId, data) : DB.add('recipe_categories', data);
    op.then(function () {
      UI.toast('Categoria salva', 'success');
      if (window._recipeCategoryModal) window._recipeCategoryModal.close();
      _renderRecipeCategories();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _deleteRecipeCategory(id) {
    UI.confirm('Eliminar esta categoria da receita?').then(function (yes) {
      if (!yes) return;
      DB.remove('recipe_categories', id).then(function () {
        UI.toast('Categoria eliminada', 'info');
        _renderRecipeCategories();
      });
    });
  }

  function _renderUnits() {
    DB.getAll('unidades_medida').then(function (items) {
      _units = (items || []).slice().sort(function (a, b) {
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
      _paintUnits();
    }).catch(function (err) {
      UI.toast('Erro: ' + err.message, 'error');
    });
  }

  function _paintUnits() {
    var content = document.getElementById('receitas-content');
    if (!content) return;
    content.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">' +
      '<div><h2 style="font-size:20px;font-weight:800;margin-bottom:4px;">Unidades (' + _units.length + ')</h2>' +
      '<p style="font-size:13px;color:#8A7E7C;">Unidades usadas nas fichas técnicas e na produção.</p></div>' +
      '<button onclick="Modules.Receitas._openUnitModal(null)" style="background:#C4362A;color:#fff;border:none;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Adicionar</button>' +
      '</div>' +
      (_units.length === 0 ? UI.emptyState('Nenhuma unidade ainda', 'Cadastre unidades para usar nas fichas técnicas.') :
        '<div style="display:flex;flex-direction:column;gap:10px;">' +
          _units.map(function (u) {
            return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 2px 8px rgba(0,0,0,.06);">' +
              '<div style="min-width:0;"><div style="font-size:15px;font-weight:800;">' + _esc(u.name || '-') + '</div>' +
              '<div style="font-size:12px;color:#8A7E7C;margin-top:3px;">' + _esc(u.symbol || '-') + ' · ' + _esc(u.type || '-') + '</div></div>' +
              '<div style="display:flex;gap:6px;flex-shrink:0;">' +
                '<button onclick="Modules.Receitas._openUnitModal(\'' + u.id + '\')" style="width:30px;height:30px;border-radius:8px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;"><span class="mi" style="font-size:14px;">edit</span></button>' +
                '<button onclick="Modules.Receitas._deleteUnit(\'' + u.id + '\')" style="width:30px;height:30px;border-radius:8px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;"><span class="mi" style="font-size:14px;">delete</span></button>' +
              '</div></div>';
          }).join('') + '</div>');
  }

  function _openUnitModal(id) {
    _editingUnitId = id;
    var u = id ? (_units.find(function (x) { return x.id === id; }) || {}) : { type: 'unidade' };
    var body = '<div>' +
      '<label class="field"><span>Nome *</span><input id="ru-name" type="text" value="' + _esc(u.name || '') + '" placeholder="Ex: Quilograma"></label>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
        '<label class="field"><span>Símbolo *</span><input id="ru-symbol" type="text" value="' + _esc(u.symbol || '') + '" placeholder="kg"></label>' +
        '<label class="field"><span>Tipo</span><select id="ru-type"><option value="massa"' + (u.type === 'massa' ? ' selected' : '') + '>Massa</option><option value="volume"' + (u.type === 'volume' ? ' selected' : '') + '>Volume</option><option value="unidade"' + (!u.type || u.type === 'unidade' ? ' selected' : '') + '>Unidade</option></select></label>' +
      '</div>' +
      '</div>';
    var footer = '<button onclick="Modules.Receitas._saveUnit()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">' + (id ? 'Atualizar unidade' : 'Adicionar unidade') + '</button>';
    window._unitReceitasModal = UI.modal({ title: id ? 'Editar Unidade' : 'Nova Unidade', body: body, footer: footer });
  }

  function _saveUnit() {
    var name = ((document.getElementById('ru-name') || {}).value || '').trim();
    var symbol = ((document.getElementById('ru-symbol') || {}).value || '').trim();
    if (!name || !symbol) { UI.toast('Nome e símbolo são obrigatórios', 'error'); return; }
    var data = {
      name: name,
      symbol: symbol,
      type: (document.getElementById('ru-type') || {}).value || 'unidade'
    };
    var op = _editingUnitId ? DB.update('unidades_medida', _editingUnitId, data) : DB.add('unidades_medida', data);
    op.then(function () {
      UI.toast('Unidade salva', 'success');
      if (window._unitReceitasModal) window._unitReceitasModal.close();
      _renderUnits();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _deleteUnit(id) {
    UI.confirm('Eliminar esta unidade?').then(function (yes) {
      if (!yes) return;
      DB.remove('unidades_medida', id).then(function () {
        UI.toast('Unidade eliminada', 'info');
        _renderUnits();
      });
    });
  }

  function _esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  return {
    render: render,
    _switchSub: _switchSub,
    _openRecipeComponentModal: _openRecipeComponentModal,
    _saveRecipeComponent: _saveRecipeComponent,
    _deleteRecipeComponent: _deleteRecipeComponent,
    _openRecipeCategoryModal: _openRecipeCategoryModal,
    _saveRecipeCategory: _saveRecipeCategory,
    _deleteRecipeCategory: _deleteRecipeCategory,
    _openUnitModal: _openUnitModal,
    _saveUnit: _saveUnit,
    _deleteUnit: _deleteUnit
  };
})();
