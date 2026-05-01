// js/core/image-tools.js
window.ImageTools = (function () {
  'use strict';

  var VALID_MIME = {
    'image/jpeg': true,
    'image/jpg': true,
    'image/png': true,
    'image/webp': true
  };

  var PRESETS = {
    product: {
      folder: 'products',
      variants: [
        { key: 'main', file: 'produto-original.webp', width: 800, height: 800, fit: 'cover', quality: 0.86, maxKb: 300 },
        { key: 'card', file: 'produto-card.webp', width: 500, height: 500, fit: 'cover', quality: 0.84, maxKb: 220 },
        { key: 'thumb', file: 'produto-thumb.webp', width: 150, height: 150, fit: 'cover', quality: 0.78, maxKb: 90 }
      ]
    },
    banner: {
      folder: 'banners',
      variants: [
        { key: 'main', file: 'banner.webp', width: 1200, height: 600, fit: 'cover', quality: 0.86, maxKb: 500 }
      ]
    },
    logo: {
      folder: 'logos',
      variants: [
        { key: 'main', file: 'logo.webp', width: 500, height: 500, fit: 'contain', quality: 0.9, maxKb: 150, background: 'transparent' }
      ]
    }
  };

  function _tenantId() {
    return window.Auth && typeof Auth.getTenantId === 'function' ? Auth.getTenantId() : '';
  }

  function _assertStorageReady() {
    if (!window.firebase || !firebase.storage) {
      throw new Error('Firebase Storage indisponível.');
    }
    return firebase.storage();
  }

  function _safeFileName(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'image';
  }

  function _fileExtension(file) {
    var name = String((file && file.name) || '').toLowerCase();
    if (name.endsWith('.jpeg')) return 'jpeg';
    if (name.endsWith('.jpg')) return 'jpg';
    if (name.endsWith('.png')) return 'png';
    if (name.endsWith('.webp')) return 'webp';
    return '';
  }

  function _validateFile(file) {
    if (!file) throw new Error('Arquivo inválido.');
    if (!VALID_MIME[file.type] && !/^image\/(jpeg|jpg|png|webp)$/i.test(file.type || '')) {
      throw new Error('Formato não permitido. Envie JPG, JPEG, PNG ou WebP.');
    }
    var ext = _fileExtension(file);
    if (ext && ['jpg', 'jpeg', 'png', 'webp'].indexOf(ext) < 0) {
      throw new Error('Formato não permitido. Envie JPG, JPEG, PNG ou WebP.');
    }
    return true;
  }

  function _friendlyError(err) {
    var code = err && (err.code || err.name || '');
    var msg = String((err && err.message) || err || '').toLowerCase();
    var friendly;
    if (/storage\/unauthorized|storage\/unauthenticated|permission-denied|missing-or-insufficient-permissions|unauthorized/.test(code) || /permission|auth/.test(msg)) {
      friendly = new Error('Sem permissão para enviar esta imagem.');
    }
    else if (/storage\/canceled|canceled|cancelled/.test(code) || /cancelad/.test(msg)) {
      friendly = new Error('Envio cancelado.');
    }
    else if (/quota-exceeded|storage\/quota/.test(code) || /quota|limit/.test(msg)) {
      friendly = new Error('Armazenamento sem espaço suficiente.');
    }
    else if (/retry-limit-exceeded|network-request-failed|storage\/unknown/.test(code) || /network|conex[aã]o|internet/.test(msg)) {
      friendly = new Error('Falha de rede ao enviar a imagem.');
    }
    else {
      friendly = new Error('Erro ao enviar a imagem.');
    }
    friendly.code = code || 'image-upload-error';
    friendly.originalMessage = err && err.message ? String(err.message) : String(err || '');
    return friendly;
  }

  function _withTimeout(promise, ms) {
    var timeoutMs = Math.max(1000, parseInt(ms, 10) || 60000);
    var timer = null;
    var timeoutPromise = new Promise(function (_, reject) {
      timer = setTimeout(function () {
        reject(new Error('Tempo de upload excedido.'));
      }, timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).then(function (value) {
      if (timer) clearTimeout(timer);
      return value;
    }, function (err) {
      if (timer) clearTimeout(timer);
      throw err;
    });
  }

  function _loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve({
          image: img,
          width: img.naturalWidth || img.width || 0,
          height: img.naturalHeight || img.height || 0
        });
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Erro ao carregar a imagem.'));
      };
      img.src = url;
    });
  }

  function _newCanvas(width, height) {
    var canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width || 1));
    canvas.height = Math.max(1, Math.round(height || 1));
    return canvas;
  }

  function _drawCover(canvas, image, background) {
    var ctx = canvas.getContext('2d');
    var cw = canvas.width;
    var ch = canvas.height;
    var iw = image.width || image.naturalWidth || image.videoWidth || 1;
    var ih = image.height || image.naturalHeight || image.videoHeight || 1;
    var scale = Math.max(cw / iw, ch / ih);
    var dw = iw * scale;
    var dh = ih * scale;
    var dx = (cw - dw) / 2;
    var dy = (ch - dh) / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (background && background !== 'transparent') {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, cw, ch);
    }
    ctx.drawImage(image, dx, dy, dw, dh);
  }

  function _drawContain(canvas, image, background) {
    var ctx = canvas.getContext('2d');
    var cw = canvas.width;
    var ch = canvas.height;
    var iw = image.width || image.naturalWidth || image.videoWidth || 1;
    var ih = image.height || image.naturalHeight || image.videoHeight || 1;
    var scale = Math.min(cw / iw, ch / ih);
    var dw = iw * scale;
    var dh = ih * scale;
    var dx = (cw - dw) / 2;
    var dy = (ch - dh) / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (background && background !== 'transparent') {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, cw, ch);
    } else {
      ctx.clearRect(0, 0, cw, ch);
    }
    ctx.drawImage(image, dx, dy, dw, dh);
  }

  function _canvasToBlob(canvas, quality) {
    return new Promise(function (resolve) {
      if (!canvas.toBlob) {
        try {
          var dataUrl = canvas.toDataURL('image/webp', quality);
          fetch(dataUrl).then(function (r) { return r.blob(); }).then(resolve).catch(function () { resolve(null); });
        } catch (err) {
          resolve(null);
        }
        return;
      }
      canvas.toBlob(function (blob) {
        resolve(blob || null);
      }, 'image/webp', quality);
    });
  }

  function _variantBlobFromImage(image, spec) {
    var canvas = _newCanvas(spec.width, spec.height);
    if (spec.fit === 'contain') _drawContain(canvas, image, spec.background || 'transparent');
    else _drawCover(canvas, image, spec.background || '#ffffff');

    var minQuality = typeof spec.minQuality === 'number' ? spec.minQuality : 0.55;
    var qualityStep = typeof spec.qualityStep === 'number' ? spec.qualityStep : 0.06;
    var startQuality = typeof spec.quality === 'number' ? spec.quality : 0.86;
    var maxKb = typeof spec.maxKb === 'number' ? spec.maxKb : 300;

    function attempt(q) {
      return _canvasToBlob(canvas, q).then(function (blob) {
        if (!blob) return null;
        if ((blob.size / 1024) <= maxKb || q <= minQuality) {
          return { blob: blob, width: canvas.width, height: canvas.height, quality: q };
        }
        var nextQ = Math.max(minQuality, q - qualityStep);
        if (nextQ === q) return { blob: blob, width: canvas.width, height: canvas.height, quality: q };
        return attempt(nextQ);
      });
    }

    return attempt(startQuality);
  }

  function _storagePath(folder, entityId, fileName) {
    var tid = _tenantId();
    if (!tid) throw new Error('Tenant não encontrado.');
    return ['tenants', tid, folder, entityId, fileName].join('/');
  }

  function _uploadBlob(storage, path, blob) {
    var ref = storage.ref().child(path);
    console.info('[ImageTools] storage upload start', {
      authUid: window.Auth && typeof Auth.getUser === 'function' && Auth.getUser() ? Auth.getUser().uid : '',
      tenantId: _tenantId(),
      storageBucket: storage && storage.app && storage.app.options ? storage.app.options.storageBucket : '',
      storagePath: path,
      bytes: blob && blob.size ? blob.size : 0
    });
    return ref.put(blob, { contentType: 'image/webp' }).then(function (snap) {
      return snap.ref.getDownloadURL().then(function (downloadURL) {
        console.info('[ImageTools] storage upload complete', {
          storagePath: path,
          downloadURL: downloadURL,
          bytes: blob && blob.size ? blob.size : 0
        });
        return {
          storagePath: path,
          url: downloadURL,
          bytes: blob.size
        };
      });
    }).catch(function (err) {
      console.error('[ImageTools] storage upload failed', {
        code: err && err.code,
        message: err && err.message,
        storagePath: path
      });
      throw _friendlyError(err);
    });
  }

  function _processPreset(file, options) {
    _validateFile(file);
    var preset = PRESETS[options.kind] || PRESETS.product;
    var entityId = String(options.entityId || '').trim();
    if (!entityId) throw new Error('ID da entidade obrigatório para salvar imagem.');
    var storage = _assertStorageReady();
    var folder = options.folder || preset.folder;
    console.info('[ImageTools] product preset start', {
      authUid: window.Auth && typeof Auth.getUser === 'function' && Auth.getUser() ? Auth.getUser().uid : '',
      tenantId: _tenantId(),
      entityId: entityId,
      folder: folder,
      bucket: storage && storage.app && storage.app.options ? storage.app.options.storageBucket : ''
    });
    return _loadImage(file).then(function (source) {
      var uploads = preset.variants.map(function (spec) {
        return _variantBlobFromImage(source.image, spec).then(function (result) {
          if (!result || !result.blob) throw new Error('Erro ao otimizar imagem.');
          if ((result.blob.size / 1024) > spec.maxKb) {
            throw new Error('Imagem muito pesada. Tente uma imagem menor.');
          }
          var storagePath = _storagePath(folder, entityId, spec.file);
          console.info('[ImageTools] product variant upload', {
            authUid: window.Auth && typeof Auth.getUser === 'function' && Auth.getUser() ? Auth.getUser().uid : '',
            tenantId: _tenantId(),
            entityId: entityId,
            folder: folder,
            variant: spec.key,
            storagePath: storagePath
          });
          return _uploadBlob(storage, storagePath, result.blob).then(function (uploaded) {
            return {
              key: spec.key,
              storagePath: uploaded.storagePath,
              url: uploaded.url,
              width: result.width,
              height: result.height,
              sizeKb: Math.round(result.blob.size / 1024),
              format: 'webp'
            };
          });
        });
      });
      return Promise.all(uploads).then(function (results) {
        var mapped = {};
        results.forEach(function (item) { mapped[item.key] = item; });
        var main = mapped.main || results[0] || {};
        return {
          preset: options.kind || 'product',
          entityId: entityId,
          storageFolder: folder,
          originalWidth: source.width,
          originalHeight: source.height,
          variants: mapped,
          mainUrl: main.url || '',
          cardUrl: (mapped.card && mapped.card.url) || main.url || '',
          thumbUrl: (mapped.thumb && mapped.thumb.url) || (mapped.card && mapped.card.url) || main.url || '',
          imageUrl: main.url || '',
          imageCardUrl: (mapped.card && mapped.card.url) || main.url || '',
          imageThumbUrl: (mapped.thumb && mapped.thumb.url) || (mapped.card && mapped.card.url) || main.url || '',
          imageStoragePath: main.storagePath || '',
          imageWidth: main.width || source.width || 0,
          imageHeight: main.height || source.height || 0,
          imageSizeKb: main.sizeKb || 0,
          imageFormat: 'webp'
        };
      });
    });
  }

  function _uploadSingle(file, options) {
    _validateFile(file);
    var tid = _tenantId();
    if (!tid) throw new Error('Tenant não encontrado.');
    var preset = PRESETS[options.kind] || PRESETS.banner;
    var folder = options.folder || preset.folder;
    var spec = (preset.variants || [])[0];
    var entityId = String(options.entityId || '').trim();
    if (!entityId) throw new Error('ID da entidade obrigatório para salvar imagem.');
    var storage = _assertStorageReady();
    console.info('[ImageTools] single upload start', {
      kind: options.kind || 'banner',
      authUid: window.Auth && typeof Auth.getUser === 'function' && Auth.getUser() ? Auth.getUser().uid : '',
      tenantId: _tenantId(),
      entityId: entityId,
      folder: folder,
      bucket: storage && storage.app && storage.app.options ? storage.app.options.storageBucket : ''
    });
    return _loadImage(file).then(function (source) {
      var result = _variantBlobFromImage(source.image, spec);
      return Promise.resolve(result).then(function (data) {
        if (!data || !data.blob) throw new Error('Erro ao otimizar imagem.');
        if ((data.blob.size / 1024) > spec.maxKb) {
          throw new Error('Imagem muito pesada. Tente uma imagem menor.');
        }
        var storagePath = _storagePath(folder, entityId, spec.file);
        console.info('[ImageTools] single variant upload', {
          kind: options.kind || 'banner',
          authUid: window.Auth && typeof Auth.getUser === 'function' && Auth.getUser() ? Auth.getUser().uid : '',
          tenantId: _tenantId(),
          entityId: entityId,
          folder: folder,
          storagePath: storagePath
        });
        return _uploadBlob(storage, storagePath, data.blob).then(function (uploaded) {
          return {
            preset: options.kind || 'banner',
            entityId: entityId,
            storageFolder: folder,
            mainUrl: uploaded.url,
            imageUrl: uploaded.url,
            imageStoragePath: uploaded.storagePath,
            imageWidth: data.width || source.width || 0,
            imageHeight: data.height || source.height || 0,
            imageSizeKb: Math.round(data.blob.size / 1024),
            imageFormat: 'webp'
          };
        });
      });
    });
  }

  function process(file, options) {
    options = options || {};
    var kind = options.kind || 'product';
    if (kind === 'logo' || kind === 'banner') {
      return _uploadSingle(file, options);
    }
    var upload = _processPreset(file, options);
    if (!options.folder || options.folder === PRESETS.product.folder) {
      return _withTimeout(upload, 60000);
    }
    return upload;
  }

  return {
    validateFile: _validateFile,
    process: process,
    tenantId: _tenantId
  };
})();
