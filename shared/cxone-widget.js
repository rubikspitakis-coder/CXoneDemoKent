(function () {
  'use strict';

  var config = window.DEMO_CONFIG;
  if (!config) {
    console.warn('[CXoneDemo] window.DEMO_CONFIG is not set — skipping initialization.');
    return;
  }

  var cx = config.cxone;
  var br = config.branding;

  // ─── 1. Initialize CXone Loader ──────────────────────────────────────────────
  var n = 'cxone';
  window.CXoneDfo = n;
  window[n] = window[n] || function () {
    (window[n].q = window[n].q || []).push(arguments);
  };
  window[n].u = cx.loaderUrl;

  var e = document.createElement('script');
  e.type = 'module';
  e.src = cx.loaderUrl + '?' + Math.round(Date.now() / 1e3 / 3600);
  document.head.appendChild(e);

  // All cxone() calls below are queued and processed when the loader finishes
  cxone('init', cx.brandId);
  cxone('guide', 'init', cx.guideId);

  // ─── 2. Widget sizing ────────────────────────────────────────────────────────
  cxone('guide', 'setDesiredGuideWidth', '400px');
  cxone('guide', 'setDesiredGuideHeight', '40em');
  cxone('chat', 'setWindowWidth', '400px');
  cxone('chat', 'setWindowHeight', '700px');

  // ─── 3. Page context ─────────────────────────────────────────────────────────
  if (config.pageName) {
    cxone('chat', 'setCustomerCustomField', 'page_viewed', config.pageName);
  }

  // ─── 4. Guide CSS branding ───────────────────────────────────────────────────
  var logoRule = br.logoUrl
    ? 'background: #FFFFFF url(\'' + br.logoUrl + '\') no-repeat center 12px !important; background-size: ' + br.logoSize + ' auto !important; padding-top: 70px !important; padding-bottom: 8px !important; overflow: visible !important;'
    : 'background: #FFFFFF !important;';

  cxone('guide', 'setCustomCss', [
    '[data-selector="GUIDE_CHANNEL_BUTTON"] { background: ' + br.primaryColor + ' !important; }',
    '[data-selector="PORTAL_HEADER_ICON"] { display: none !important; }',
    '[data-selector="PORTAL_HEADER"] { ' + logoRule + ' color: ' + br.primaryColor + ' !important; border-bottom: 1px solid #e5e7eb !important; }',
    '[data-selector="PORTAL_TITLE"] { display: none !important; }',
    '[data-selector="PORTAL_SUBTITLE"] { display: none !important; }',
    '[data-selector="PORTAL_BODY"] { background: ' + br.lightBg + ' !important; }',
    '[data-selector="CHANNELS_WIDGET"] { background: ' + br.lightBg + ' !important; }',
    '[data-selector="KB_WIDGET"] { background: ' + br.lightBg + ' !important; }',
    '[data-selector="KB_WIDGET_TITLE"] { color: ' + br.primaryColor + ' !important; }',
    '[data-selector="KB_WIDGET_SEARCHBAR"] { border-color: ' + br.primaryColor + ' !important; }',
    '[data-selector="KB_SEE_MORE_BUTTON"] { color: ' + br.accentColor + ' !important; }',
    '[data-selector="GUIDE_CHANNEL_BUTTON_1"], [data-selector="GUIDE_CHANNEL_BUTTON_2"], [data-selector="GUIDE_CHANNEL_BUTTON_3"], [data-selector="GUIDE_CHANNEL_BUTTON_4"] { color: ' + br.primaryColor + ' !important; }',
    '[data-selector="BEGIN_CHAT"] { background: ' + br.accentColor + ' !important; color: #FFFFFF !important; }',
    '[data-selector="SEND_EMAIL"] { background: ' + br.accentColor + ' !important; color: #FFFFFF !important; }',
    '[data-selector="OFFER_BUTTON_1"] { background: ' + br.accentColor + ' !important; color: #FFFFFF !important; }',
    '[data-selector="GUIDE_FRAME_CONTENT"] { border-radius: 12px !important; overflow: hidden !important; }'
  ].join('\n'));

  // ─── 5. Chat CSS branding ────────────────────────────────────────────────────
  cxone('chat', 'setCustomCss', [
    '[data-selector="HEADER"] { background: ' + br.primaryColor + ' !important; color: #FFFFFF !important; }',
    '[data-selector="HEADER_MINIMIZE_WINDOW"] { color: #FFFFFF !important; }',
    '[data-selector="HEADER_ACTION_MENU_BUTTON"] { color: #FFFFFF !important; }',
    '[data-selector="CUSTOMER_MESSAGE_BUBBLE"] { background: ' + br.primaryColor + ' !important; color: #FFFFFF !important; }',
    '[data-selector="AGENT_MESSAGE_BUBBLE"] { background: ' + br.lightBg + ' !important; color: ' + br.primaryColor + ' !important; }',
    '[data-selector="SEND_BUTTON"] { background: ' + br.accentColor + ' !important; color: #FFFFFF !important; }',
    '[data-selector="PRIMARY_BUTTON"] { background: ' + br.accentColor + ' !important; color: #FFFFFF !important; border-radius: ' + br.borderRadius + ' !important; }',
    '[data-selector="SECONDARY_BUTTON"] { border-color: ' + br.primaryColor + ' !important; color: ' + br.primaryColor + ' !important; border-radius: ' + br.borderRadius + ' !important; }',
    '[data-selector="CONTENT"] { background: ' + br.contentBg + ' !important; }',
    '[data-selector="TEXTAREA"] { border-color: ' + br.primaryColor + ' !important; }',
    '[data-selector="START_NEW_CHAT"] { background: ' + br.accentColor + ' !important; color: #FFFFFF !important; border-radius: ' + br.borderRadius + ' !important; }'
  ].join('\n'));

  // ─── 6. Callback Modal ──────────────────────────────────────────────────────
  function injectCallbackModal() {
    var overlay = document.createElement('div');
    overlay.id = 'cxone-callback-overlay';
    overlay.style.cssText =
      'display:none;position:fixed;top:0;left:0;width:100%;height:100%;' +
      'background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:10000;' +
      'align-items:center;justify-content:center;';

    overlay.innerHTML =
      '<div style="background:#fff;border-radius:16px;width:420px;max-width:90vw;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.25);font-family:Inter,sans-serif;">' +
        '<div style="background:' + br.primaryColor + ';color:#fff;padding:40px 24px;text-align:center;position:relative;">' +
          '<button id="cxone-cb-close" style="position:absolute;top:20px;right:20px;background:none;border:none;color:rgba(255,255,255,0.7);font-size:28px;cursor:pointer;line-height:1;">&times;</button>' +
          '<h2 style="font-size:24px;font-weight:700;margin:0 0 8px;">Talk to an Expert</h2>' +
          '<p style="margin:0;color:rgba(255,255,255,0.7);font-size:16px;">Leave your number and we\'ll call you back.</p>' +
        '</div>' +
        '<div id="cxone-cb-body" style="padding:32px 24px;"></div>' +
      '</div>';

    document.body.appendChild(overlay);

    document.getElementById('cxone-cb-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
  }

  function renderForm() {
    var bodyEl = document.getElementById('cxone-cb-body');
    if (!bodyEl) return;
    bodyEl.innerHTML =
      '<label style="display:block;margin-bottom:6px;font-weight:600;color:#333;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Phone Number</label>' +
      '<input id="cxone-cb-phone" type="tel" placeholder="e.g. 0412 345 678" style="width:100%;padding:14px 16px;border:2px solid #e5e7eb;border-radius:12px;font-size:18px;box-sizing:border-box;outline:none;" />' +
      '<p id="cxone-cb-error" style="color:#d32f2f;font-size:13px;margin:8px 0 0;display:none;"></p>' +
      '<button id="cxone-cb-submit" style="margin-top:16px;width:100%;padding:16px;border:none;border-radius:12px;background:' + br.accentColor + ';color:#fff;font-size:18px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">Request Callback</button>';

    document.getElementById('cxone-cb-submit').addEventListener('click', handleSubmit);
  }

  function handleSubmit() {
    var phone = document.getElementById('cxone-cb-phone').value.replace(/[\s\-()]/g, '');
    var errP = document.getElementById('cxone-cb-error');
    var btn = document.getElementById('cxone-cb-submit');

    if (!/^\+?\d{8,15}$/.test(phone)) {
      errP.textContent = 'Please enter a valid phone number.';
      errP.style.display = 'block';
      return;
    }
    errP.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Submitting…';

    fetch('/api/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: phone })
    })
      .then(function (res) {
        if (res.ok) {
          btn.textContent = 'Success!';
          setTimeout(function () {
            closeModal();
            alert(config.callbackSuccessMessage || 'Your callback request has been submitted.');
          }, 800);
        } else {
          throw new Error('API error');
        }
      })
      .catch(function (err) {
        errP.textContent = 'Something went wrong. Please try again.';
        errP.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Request Callback';
        console.error('[CXoneDemo] Callback error:', err);
      });
  }

  function openModal() {
    var overlay = document.getElementById('cxone-callback-overlay');
    if (!overlay) return;
    renderForm();
    overlay.style.display = 'flex';
    setTimeout(function () {
      var input = document.getElementById('cxone-cb-phone');
      if (input) input.focus();
    }, 100);
  }

  function closeModal() {
    var overlay = document.getElementById('cxone-callback-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectCallbackModal);
  } else {
    injectCallbackModal();
  }

  // ─── 7. Public Helpers ──────────────────────────────────────────────────────
  window.CXoneDemo = {
    openCallbackModal: openModal,

    setCustomField: function (name, value) {
      cxone('chat', 'setCustomerCustomField', name, value);
    },

    setCustomerName: function (name) {
      cxone('chat', 'setCustomerName', name);
    },

    openChat: function (message) {
      cxone('guide', 'openMenu');
      if (message) {
        setTimeout(function () {
          cxone('chat', 'sendMessage', message);
        }, 500);
      }
    },

    setContactEmail: function (email) {
      cxone('guide', 'setCustomFields', {
        contactCustomFields: [{ ident: 'Email', value: email, hidden: false }]
      });
    }
  };

})();
