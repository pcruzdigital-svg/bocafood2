// js/core/db.js
window.DB = (function () {
  'use strict';

  function _db() { return firebase.firestore(); }

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

  return { col, doc, getAll, getDoc, add, set, update, remove, listen, listenQuery, docRoot, getDocRoot, setDocRoot };
})();
