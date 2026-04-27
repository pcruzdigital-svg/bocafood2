// js/core/auth.js
window.Auth = (function () {
  'use strict';

  let _currentUser = null;
  let _authReady = false;
  let _adminProfile = null;
  const MASTER_EMAIL = 'master@bocadobrasil.com';
  const BOOTSTRAP_ADMIN_EMAILS = ['master@bocadobrasil.com', 'pcruz.digital@gmail.com'];

  function init() {
    firebase.auth().onAuthStateChanged(function (user) {
      _authReady = false;
      _currentUser = null;
      _adminProfile = null;
      if (!user) {
        _authReady = true;
        if (window.Router) Router.resolve();
        return;
      }

      if (BOOTSTRAP_ADMIN_EMAILS.indexOf(user.email || '') >= 0) {
        _currentUser = user;
        _adminProfile = { tenantId: user.uid, role: user.email === MASTER_EMAIL ? 'master' : 'tenant_owner', bootstrap: true };
        _authReady = true;
        if (window.Router) Router.resolve();
        return;
      }

      firebase.firestore().collection('system_tenants').doc(user.uid).get().then(function (snap) {
        var data = snap.exists ? snap.data() : null;
        if (data && data.status !== 'disabled') {
          _currentUser = user;
          _adminProfile = Object.assign({ tenantId: user.uid, role: 'tenant_owner' }, data);
          return;
        }
        return firebase.auth().signOut().then(function () {
          if (window.AdminApp && AdminApp.showAccessDenied) AdminApp.showAccessDenied();
        });
      }).catch(function (err) {
        console.error('Centro de Control profile check error', err);
        return firebase.auth().signOut().then(function () {
          if (window.AdminApp && AdminApp.showAccessDenied) AdminApp.showAccessDenied();
        });
      }).finally(function () {
      _authReady = true;
      if (window.Router) Router.resolve();
      });
    });
  }

  function login(email, pass) {
    return firebase.auth().signInWithEmailAndPassword(email, pass);
  }

  function logout() {
    return firebase.auth().signOut();
  }

  function getUser() {
    return _currentUser;
  }

  function getTenantId() {
    return _adminProfile ? (_adminProfile.tenantId || _currentUser.uid) : null;
  }

  function getAdminProfile() {
    return _adminProfile;
  }

  function requireAuth() {
    if (_authReady && !_currentUser) {
      if (window.AdminApp) AdminApp.showLogin();
      return false;
    }
    return true;
  }

  function isMaster() {
    return _adminProfile && (_adminProfile.role === 'master' || _currentUser.email === MASTER_EMAIL);
  }

  function isReady() {
    return _authReady;
  }

  return { init, login, logout, getUser, getTenantId, getAdminProfile, requireAuth, isMaster, isReady };
})();
