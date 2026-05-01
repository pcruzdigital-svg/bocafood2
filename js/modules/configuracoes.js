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
  var _usuarios = [];
  var _editingUsuarioId = null;

  var TABS = [
    { key: 'geral', label: 'Geral' },
    { key: 'dominio', label: 'Domínio / URL' },
    { key: 'integracoes', label: 'Integrações' },
    { key: 'usuarios', label: 'Usuários / permissões' },
    { key: 'aparencia', label: 'Aparência' }
  ];

  var CONFIG_TABS = ['geral', 'dominio', 'integracoes', 'usuarios', 'aparencia', 'pagamentos', 'endereco', 'seo', 'template'];

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
    if (_activeSub === 'produtos') { _activeSub = 'geral'; _renderTabs(); return _renderGeral(); }
    if (_activeSub === 'dominio') return _renderDominio();
    if (_activeSub === 'integracoes') return _renderIntegracoes();
    if (_activeSub === 'usuarios') return _renderUsuarios();
    if (_activeSub === 'aparencia') return _renderAparencia();
    if (_activeSub === 'pagamentos') return _renderPagamentos();
    if (_activeSub === 'endereco') return _renderEndereco();
    if (_activeSub === 'seo') return _renderSeo();
    if (_activeSub === 'template') return _renderTemplate();
  }

  function _field(id, label, value, placeholder, type) {
    return '<label class="field"><span>' + label + '</span><input id="' + id + '" type="' + (type || 'text') + '" value="' + _esc(value || '') + '" placeholder="' + (placeholder || '') + '"></label>';
  }

  function _textarea(id, label, value, placeholder) {
    return '<label class="field"><span>' + label + '</span><textarea id="' + id + '" placeholder="' + (placeholder || '') + '">' + _esc(value || '') + '</textarea></label>';
  }

  function _appearanceState() {
    window._appearanceImageState = window._appearanceImageState || {};
    return window._appearanceImageState;
  }

  function _appearanceDraftId(kind) {
    return 'appearance-' + (kind || 'image');
  }

  function _appearanceTip(kind) {
    if (kind === 'banner') {
      return 'Aceita JPG, JPEG, PNG ou WebP. O sistema ajusta para 1200x600 px e otimiza em WebP. Se não subir, o motivo aparece na mensagem do sistema.';
    }
    return 'Aceita JPG, JPEG, PNG ou WebP. O sistema ajusta para 500x500 px e otimiza em WebP. Se não subir, o motivo aparece na mensagem do sistema.';
  }

  function _uploadAppearanceImage(event, kind) {
    var file = event && event.target && event.target.files ? event.target.files[0] : null;
    if (!file) return;
    var targetKind = kind === 'banner' ? 'banner' : 'logo';
    var draftId = _appearanceDraftId(targetKind);
    ImageTools.process(file, { kind: targetKind, entityId: draftId }).then(function (result) {
      var state = _appearanceState();
      state[targetKind] = result;
      var field = document.getElementById(targetKind === 'logo' ? 'app-logo-url' : 'app-banner-url');
      if (field) field.value = result.imageUrl || '';
      var preview = document.getElementById(targetKind === 'logo' ? 'appearance-logo-preview' : 'appearance-banner-preview');
      if (preview) {
        preview.src = result.imageUrl || '';
        preview.style.display = 'block';
      }
      UI.toast('Imagem otimizada com sucesso.', 'success');
    }).catch(function (err) {
      console.error('Upload de imagem da aparência', err);
      UI.toast(err && err.message ? err.message : 'Erro ao otimizar imagem.', 'error');
      if (event && event.target) event.target.value = '';
    });
  }

  function _renderGeral() {
    var c = _config.geral || {};
    _paint('Geral', 'Dados básicos do negócio usados pelo painel e pelo site.', [
      _field('cfg-business-name', 'Nome do negócio', c.businessName, 'Boca do Brasil'),
      _textarea('cfg-description', 'Descrição curta', c.description, 'Comida brasileira artesanal em Lisboa'),
      _field('cfg-whatsapp', 'Telefone / WhatsApp', c.whatsapp || c.phone, '+351...'),
      _field('cfg-email', 'E-mail', c.email, 'contato@...'),
      _field('cfg-country', 'País', c.country, 'Portugal'),
      _field('cfg-city', 'Cidade', c.city, 'Lisboa'),
      _field('cfg-language', 'Idioma padrão', c.language || c.defaultLanguage, 'pt-PT'),
      _field('cfg-currency', 'Moeda', c.currency || c.defaultCurrency, 'EUR')
    ].join(''), function () {
      return {
        businessName: _val('cfg-business-name'),
        description: _val('cfg-description'),
        whatsapp: _val('cfg-whatsapp'),
        phone: _val('cfg-whatsapp'),
        email: _val('cfg-email'),
        country: _val('cfg-country'),
        city: _val('cfg-city'),
        language: _val('cfg-language'),
        defaultLanguage: _val('cfg-language'),
        currency: _val('cfg-currency'),
        defaultCurrency: _val('cfg-currency'),
        indirectCostMode: c.indirectCostMode,
        custosIndiretosModo: c.custosIndiretosModo,
        indirectCostPercent: c.indirectCostPercent,
        percentualCustosIndiretos: c.percentualCustosIndiretos,
        indirectCostMonths: c.indirectCostMonths,
        custosIndiretosMeses: c.custosIndiretosMeses,
        logoUrl: c.logoUrl,
        faviconUrl: c.faviconUrl,
        primaryColor: c.primaryColor,
        secondaryColor: c.secondaryColor,
        bannerUrl: c.bannerUrl,
        visualName: c.visualName
      };
    });
  }

  function _renderAparencia() {
    var c = _config.aparencia || _config.geral || {};
    _paint('Aparência', 'Identidade visual do painel e da loja publicada.', [
      '<div style="background:#FBF5F3;border:1px solid #F2EDED;border-radius:14px;padding:16px;margin-bottom:14px;">' +
        '<div style="font-size:12px;font-weight:800;color:#8A7E7C;text-transform:uppercase;margin-bottom:6px;">Pré-visualização</div>' +
        '<div style="display:flex;flex-direction:column;gap:10px;">' +
          '<div style="display:flex;align-items:center;gap:12px;">' +
            '<div style="width:56px;height:56px;border-radius:14px;background:#fff;border:1px solid #EEE6E4;display:flex;align-items:center;justify-content:center;overflow:hidden;"><img id="appearance-logo-preview" src="' + _esc(c.logoUrl || _config.geral.logoUrl || '') + '" alt="" style="max-width:100%;max-height:100%;object-fit:contain;"></div>' +
            '<div style="min-width:0;">' +
              '<div style="font-size:16px;font-weight:900;">' + _esc(c.visualName || _config.geral.businessName || 'Nome visual da loja') + '</div>' +
              '<div style="font-size:12px;color:#8A7E7C;margin-top:3px;">' + _esc(c.primaryColor || _config.geral.primaryColor || '#C4362A') + ' · ' + _esc(c.secondaryColor || '#1A1A1A') + '</div>' +
            '</div>' +
          '</div>' +
          '<div style="width:100%;height:92px;border-radius:14px;background:#fff;border:1px solid #EEE6E4;overflow:hidden;"><img id="appearance-banner-preview" src="' + _esc(c.bannerUrl || _config.geral.bannerUrl || '') + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block;"></div>' +
        '</div>' +
      '</div>',
      _field('app-visual-name', 'Nome visual da loja', c.visualName || _config.geral.visualName || _config.geral.businessName, 'Boca do Brasil'),
      '<div class="field"><span>Logo</span><input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onchange="Modules.Configuracoes._uploadAppearanceImage(event,\'logo\')" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:#fff;font-size:14px;"><div style="margin-top:6px;font-size:11px;line-height:1.45;color:#8A7E7C;">' + _appearanceTip('logo') + '</div></div>',
      _field('app-logo-url', 'Logo', c.logoUrl || _config.geral.logoUrl, 'https://...'),
      '<div class="field"><span>Banner</span><input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onchange="Modules.Configuracoes._uploadAppearanceImage(event,\'banner\')" style="width:100%;padding:11px 12px;border:1.5px solid #D4C8C6;border-radius:10px;background:#fff;font-size:14px;"><div style="margin-top:6px;font-size:11px;line-height:1.45;color:#8A7E7C;">' + _appearanceTip('banner') + '</div></div>',
      _field('app-favicon-url', 'Favicon', c.faviconUrl || _config.geral.faviconUrl, 'https://...'),
      _field('app-primary-color', 'Cor principal', c.primaryColor || _config.geral.primaryColor || '#C4362A', '#C4362A'),
      _field('app-secondary-color', 'Cor secundária', c.secondaryColor || _config.geral.secondaryColor || '#1A1A1A', '#1A1A1A'),
      _field('app-banner-url', 'Imagem de capa / banner', c.bannerUrl || _config.geral.bannerUrl, 'https://...'),
      _textarea('app-notes', 'Observação interna', c.notes || '', 'Apenas para referência do time')
    ].join(''), function () {
      var data = {
        visualName: _val('app-visual-name'),
        logoUrl: _val('app-logo-url'),
        faviconUrl: _val('app-favicon-url'),
        primaryColor: _val('app-primary-color') || '#C4362A',
        secondaryColor: _val('app-secondary-color') || '#1A1A1A',
        bannerUrl: _val('app-banner-url'),
        notes: _val('app-notes')
      };
      return data;
    });
  }

  function _renderUsuarios() {
    var c = _config.usuarios || {};
    _usuarios = Array.isArray(c.list) ? c.list : (Array.isArray(c.users) ? c.users : []);
    var empty = _usuarios.length === 0;
    var rows = empty ? '<div style="padding:24px;border:1px dashed #E4D9D6;border-radius:14px;background:#FBF5F3;color:#8A7E7C;text-align:center;">Em breve você poderá convidar usuários e controlar permissões.</div>' : '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.05);"><thead><tr style="background:#F2EDED;">' +
      ['Nome', 'Perfil', 'E-mail', 'Permissões', ''].map(function (h) {
        return '<th style="padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#8A7E7C;text-transform:uppercase;">' + h + '</th>';
      }).join('') + '</tr></thead><tbody>' +
      _usuarios.map(function (u) {
        return '<tr style="border-top:1px solid #F2EDED;">' +
          '<td style="padding:11px 14px;font-size:13px;font-weight:700;">' + _esc(u.name || u.nome || '-') + '</td>' +
          '<td style="padding:11px 14px;font-size:13px;">' + _esc(u.role || u.perfil || '—') + '</td>' +
          '<td style="padding:11px 14px;font-size:13px;">' + _esc(u.email || '-') + '</td>' +
          '<td style="padding:11px 14px;font-size:12px;color:#8A7E7C;">' + _esc((u.permissions || []).join(', ') || '—') + '</td>' +
          '<td style="padding:11px 8px;text-align:right;"><button onclick="Modules.Configuracoes._openUsuarioModal(\'' + (u.id || '') + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#EEF4FF;color:#3B82F6;cursor:pointer;margin-right:4px;"><span class="mi" style="font-size:14px;">edit</span></button><button onclick="Modules.Configuracoes._deleteUsuario(\'' + (u.id || '') + '\')" style="width:28px;height:28px;border-radius:7px;border:none;background:#FFF0EE;color:#C4362A;cursor:pointer;"><span class="mi" style="font-size:14px;">delete</span></button></td>' +
        '</tr>';
      }).join('') + '</tbody></table></div>';

    _paint('Usuários / permissões', 'Gestão de acessos preparada para futura integração com autenticação.', [
      '<div style="background:#FBF5F3;border:1px solid #F2EDED;border-radius:14px;padding:16px;margin-bottom:14px;">' +
        '<div style="font-size:12px;font-weight:800;color:#8A7E7C;text-transform:uppercase;margin-bottom:6px;">Gestão de usuários e permissões</div>' +
        '<div style="font-size:13px;color:#6B635F;line-height:1.5;">Defina perfis de acesso por área do painel. A regra de login pode continuar igual por enquanto.</div>' +
      '</div>',
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:12px;flex-wrap:wrap;"><div><h3 style="font-size:15px;font-weight:700;margin-bottom:4px;">Usuários</h3><p style="font-size:12px;color:#8A7E7C;">Perfis previstos para o painel.</p></div><button onclick="Modules.Configuracoes._openUsuarioModal(null)" style="background:#C4362A;color:#fff;border:none;padding:9px 16px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Adicionar usuário</button></div>' +
      rows
    ].join(''), function () { return { list: _usuarios.slice() }; });
  }

  function _openUsuarioModal(id) {
    _editingUsuarioId = id;
    var list = _usuarios || [];
    var u = id ? (list.find(function (x) { return String(x.id || '') === String(id); }) || {}) : {};
    var perms = {
      'Ver pedidos': false,
      'Editar pedidos': false,
      'Ver financeiro': false,
      'Editar financeiro': false,
      'Editar cardápio': false,
      'Editar configurações': false
    };
    (u.permissions || []).forEach(function (p) { if (perms.hasOwnProperty(p)) perms[p] = true; });
    var body = '<div>' +
      _field('usr-name', 'Nome', u.name || u.nome || '', 'Nome do usuário') +
      _field('usr-email', 'E-mail', u.email || '', 'usuario@...') +
      '<label class="field"><span>Perfil</span><select id="usr-role">' +
        ['Dono', 'Administrador', 'Operação', 'Financeiro', 'Atendimento'].map(function (r) {
          return '<option value="' + r + '"' + ((u.role || u.perfil || '') === r ? ' selected' : '') + '>' + r + '</option>';
        }).join('') +
      '</select></label>' +
      '<div style="font-size:11px;font-weight:800;color:#8A7E7C;text-transform:uppercase;margin:4px 0 8px;">Permissões</div>' +
      '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">' +
        Object.keys(perms).map(function (label) {
          var idSafe = 'perm-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          return '<label style="display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid #EEE6E4;border-radius:12px;background:' + (perms[label] ? '#EDFAF3' : '#fff') + ';">' +
            '<input id="' + idSafe + '" type="checkbox" ' + (perms[label] ? 'checked' : '') + ' style="accent-color:#C4362A;width:16px;height:16px;">' +
            '<span style="font-size:12px;font-weight:700;">' + label + '</span>' +
          '</label>';
        }).join('') +
      '</div>' +
      '</div>';
    var footer = '<button onclick="Modules.Configuracoes._saveUsuario()" style="width:100%;padding:13px;border-radius:11px;border:none;background:#C4362A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Salvar usuário</button>';
    window._usuarioCfgModal = UI.modal({ title: id ? 'Editar usuário' : 'Adicionar usuário', body: body, footer: footer });
  }

  function _saveUsuario() {
    var name = _val('usr-name');
    var email = _val('usr-email');
    if (!name) { UI.toast('Nome obrigatório', 'error'); return; }
    var permissionLabels = ['Ver pedidos', 'Editar pedidos', 'Ver financeiro', 'Editar financeiro', 'Editar cardápio', 'Editar configurações'];
    var permissions = permissionLabels.filter(function (label) {
      var idSafe = 'perm-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      return _checked(idSafe);
    });
    var data = {
      name: name,
      email: email,
      role: (document.getElementById('usr-role') || {}).value || 'Administrador',
      permissions: permissions,
      updatedAt: new Date().toISOString()
    };
    if (!_editingUsuarioId) data.createdAt = new Date().toISOString();
    var next = _usuarios.slice();
    if (_editingUsuarioId) {
      var idx = next.findIndex(function (x) { return String(x.id || '') === String(_editingUsuarioId); });
      if (idx >= 0) next[idx] = Object.assign({}, next[idx], data);
    } else {
      data.id = 'usr-' + Date.now().toString(36);
      next.push(data);
    }
    DB.setDocRoot('config', 'usuarios', { list: next }).then(function () {
      _config.usuarios = { list: next };
      _usuarios = next;
      if (window._usuarioCfgModal) window._usuarioCfgModal.close();
      UI.toast('Usuário salvo', 'success');
      _renderUsuarios();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _deleteUsuario(id) {
    UI.confirm('Eliminar este usuário?').then(function (yes) {
      if (!yes) return;
      var next = _usuarios.filter(function (u) { return String(u.id || '') !== String(id); });
      DB.setDocRoot('config', 'usuarios', { list: next }).then(function () {
        _usuarios = next;
        _config.usuarios = { list: next };
        UI.toast('Usuário removido', 'info');
        _renderUsuarios();
      });
    });
  }

  function _renderAparencia() {
    var c = _config.aparencia || _config.geral || {};
    _paint('Aparência', 'Identidade visual do painel e da loja publicada.', [
      '<div style="background:#FBF5F3;border:1px solid #F2EDED;border-radius:14px;padding:16px;margin-bottom:14px;">' +
        '<div style="font-size:12px;font-weight:800;color:#8A7E7C;text-transform:uppercase;margin-bottom:6px;">Pré-visualização</div>' +
        '<div style="display:flex;align-items:center;gap:12px;">' +
          '<div style="width:56px;height:56px;border-radius:14px;background:#fff;border:1px solid #EEE6E4;display:flex;align-items:center;justify-content:center;overflow:hidden;"><img src="' + _esc(c.logoUrl || _config.geral.logoUrl || '') + '" alt="" style="max-width:100%;max-height:100%;object-fit:contain;"></div>' +
          '<div style="min-width:0;">' +
            '<div style="font-size:16px;font-weight:900;">' + _esc(c.visualName || _config.geral.businessName || 'Nome visual da loja') + '</div>' +
            '<div style="font-size:12px;color:#8A7E7C;margin-top:3px;">' + _esc(c.primaryColor || _config.geral.primaryColor || '#C4362A') + ' · ' + _esc(c.secondaryColor || '#1A1A1A') + '</div>' +
          '</div>' +
        '</div>' +
      '</div>',
      _field('app-visual-name', 'Nome visual da loja', c.visualName || _config.geral.visualName || _config.geral.businessName, 'Boca do Brasil'),
      _field('app-logo-url', 'Logo', c.logoUrl || _config.geral.logoUrl, 'https://...'),
      _field('app-favicon-url', 'Favicon', c.faviconUrl || _config.geral.faviconUrl, 'https://...'),
      _field('app-primary-color', 'Cor principal', c.primaryColor || _config.geral.primaryColor || '#C4362A', '#C4362A'),
      _field('app-secondary-color', 'Cor secundária', c.secondaryColor || _config.geral.secondaryColor || '#1A1A1A', '#1A1A1A'),
      _field('app-banner-url', 'Imagem de capa / banner', c.bannerUrl || _config.geral.bannerUrl, 'https://...'),
      _textarea('app-notes', 'Observação interna', c.notes || '', 'Apenas para referência do time')
    ].join(''), function () {
      return {
        visualName: _val('app-visual-name'),
        logoUrl: _val('app-logo-url'),
        faviconUrl: _val('app-favicon-url'),
        primaryColor: _val('app-primary-color') || '#C4362A',
        secondaryColor: _val('app-secondary-color') || '#1A1A1A',
        bannerUrl: _val('app-banner-url'),
        logoStoragePath: _appearanceState().logo && _appearanceState().logo.imageStoragePath ? _appearanceState().logo.imageStoragePath : c.logoStoragePath,
        logoWidth: _appearanceState().logo && _appearanceState().logo.imageWidth ? _appearanceState().logo.imageWidth : c.logoWidth,
        logoHeight: _appearanceState().logo && _appearanceState().logo.imageHeight ? _appearanceState().logo.imageHeight : c.logoHeight,
        logoSizeKb: _appearanceState().logo && _appearanceState().logo.imageSizeKb ? _appearanceState().logo.imageSizeKb : c.logoSizeKb,
        logoFormat: _appearanceState().logo && _appearanceState().logo.imageFormat ? _appearanceState().logo.imageFormat : c.logoFormat,
        bannerStoragePath: _appearanceState().banner && _appearanceState().banner.imageStoragePath ? _appearanceState().banner.imageStoragePath : c.bannerStoragePath,
        bannerWidth: _appearanceState().banner && _appearanceState().banner.imageWidth ? _appearanceState().banner.imageWidth : c.bannerWidth,
        bannerHeight: _appearanceState().banner && _appearanceState().banner.imageHeight ? _appearanceState().banner.imageHeight : c.bannerHeight,
        bannerSizeKb: _appearanceState().banner && _appearanceState().banner.imageSizeKb ? _appearanceState().banner.imageSizeKb : c.bannerSizeKb,
        bannerFormat: _appearanceState().banner && _appearanceState().banner.imageFormat ? _appearanceState().banner.imageFormat : c.bannerFormat,
        notes: _val('app-notes')
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
      '<div class="settings-card-head"><h2>Produtos</h2><p>Configurações relacionadas ao cardápio de produtos.</p></div>' +
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

  function _renderCanaisVenda() {
    var c = _config.canais_venda || {};
    var list = Array.isArray(c.list) ? c.list : [
      { name: 'Loja própria', commissionPct: 0, fixedFee: 0, taxPct: 0, minMarginPct: 40, differentPrice: false },
      { name: 'WhatsApp', commissionPct: 0, fixedFee: 0, taxPct: 0, minMarginPct: 40, differentPrice: false },
      { name: 'Marketplace', commissionPct: 25, fixedFee: 0, taxPct: 0, minMarginPct: 45, differentPrice: true }
    ];
    var rows = list.map(function (ch, idx) {
      return '<div class="channel-row" data-channel-row="' + idx + '" style="grid-column:1/-1;display:grid;grid-template-columns:1.4fr .8fr .8fr .8fr .9fr .8fr 34px;gap:10px;align-items:end;background:#F8F6F5;border-radius:12px;padding:12px;">' +
        _field('ch-name-' + idx, 'Canal', ch.name || '', 'WhatsApp') +
        _field('ch-commission-' + idx, 'Comissão %', ch.commissionPct || 0, '0', 'number') +
        _field('ch-fixed-' + idx, 'Taxa fixa', ch.fixedFee || 0, '0', 'number') +
        _field('ch-tax-' + idx, 'Imposto %', ch.taxPct || 0, '0', 'number') +
        _field('ch-margin-' + idx, 'Margem mínima %', ch.minMarginPct || 0, '40', 'number') +
        '<label class="check-row" style="grid-column:auto;margin:0;padding:10px;background:#fff;border-radius:10px;"><input id="ch-price-' + idx + '" type="checkbox"' + (ch.differentPrice ? ' checked' : '') + '><span>Preço diferente</span></label>' +
        '<button type="button" onclick="Modules.Configuracoes._removeCanalVenda(' + idx + ')" title="Remover canal" style="height:38px;border:none;border-radius:9px;background:#FFF0EE;color:#C4362A;cursor:pointer;font-weight:800;">×</button>' +
      '</div>';
    }).join('');
    var content = document.getElementById('config-content');
    content.innerHTML = '<div class="settings-card">' +
      '<div class="settings-card-head"><h2>Canais de venda</h2><p>Taxas e margens usadas pelo menu Dinheiro para calcular impacto por canal.</p></div>' +
      '<div id="channels-list" class="settings-grid">' + rows + '</div>' +
      '<div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;"><button class="secondary-action" type="button" onclick="Modules.Configuracoes._addCanalVenda()">+ Adicionar canal</button><button class="primary-action" type="button" onclick="Modules.Configuracoes._saveCanaisVenda()">Salvar canais</button></div>' +
      '</div>';
  }

  function _collectCanaisVenda() {
    return [].slice.call(document.querySelectorAll('[data-channel-row]')).map(function (row) {
      var idx = row.dataset.channelRow;
      return {
        name: _val('ch-name-' + idx),
        commissionPct: parseFloat(String(_val('ch-commission-' + idx) || '0').replace(',', '.')) || 0,
        fixedFee: parseFloat(String(_val('ch-fixed-' + idx) || '0').replace(',', '.')) || 0,
        taxPct: parseFloat(String(_val('ch-tax-' + idx) || '0').replace(',', '.')) || 0,
        minMarginPct: parseFloat(String(_val('ch-margin-' + idx) || '0').replace(',', '.')) || 0,
        differentPrice: _checked('ch-price-' + idx)
      };
    }).filter(function (ch) { return !!ch.name; });
  }

  function _saveCanaisVenda() {
    var data = { list: _collectCanaisVenda() };
    DB.setDocRoot('config', 'canais_venda', data).then(function () {
      _config.canais_venda = data;
      UI.toast('Canais salvos', 'success');
      _renderCanaisVenda();
    }).catch(function (err) { UI.toast('Erro: ' + err.message, 'error'); });
  }

  function _addCanalVenda() {
    _config.canais_venda = { list: _collectCanaisVenda().concat([{ name: '', commissionPct: 0, fixedFee: 0, taxPct: 0, minMarginPct: 40, differentPrice: false }]) };
    _renderCanaisVenda();
  }

  function _removeCanalVenda(idx) {
    var list = _collectCanaisVenda();
    list.splice(idx, 1);
    _config.canais_venda = { list: list };
    _renderCanaisVenda();
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
      if (key === 'aparencia') {
        _config.geral = Object.assign({}, _config.geral || {}, data);
        DB.setDocRoot('config', 'geral', _config.geral).catch(function (err) {
          console.error('Config sync geral/aparencia error', err);
        });
      }
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
    _openUsuarioModal: _openUsuarioModal, _saveUsuario: _saveUsuario, _deleteUsuario: _deleteUsuario,
    _openUnidadeModal: _openUnidadeModal, _saveUnidade: _saveUnidade, _deleteUnidade: _deleteUnidade,
    _openFornecedorModal: _openFornecedorModal, _saveFornecedor: _saveFornecedor, _deleteFornecedor: _deleteFornecedor,
    _addCanalVenda: _addCanalVenda, _removeCanalVenda: _removeCanalVenda, _saveCanaisVenda: _saveCanaisVenda,
    _uploadAppearanceImage: _uploadAppearanceImage
  };
})();
