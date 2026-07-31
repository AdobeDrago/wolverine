/**
 * da.live same-origin helper: read IMS token after login and postMessage to opener.
 * Opened from *.aem.page inline-edit as a popup (origin https://da.live).
 */

const MSG_TYPE = 'forge:set-da-token';
const POLL_MS = 600;
const MAX_WAIT_MS = 5 * 60 * 1000;

function isJwt(value) {
  const t = String(value || '').trim();
  return t.startsWith('eyJ') && t.split('.').length === 3 && t.length > 500;
}

export function readDaImsTokenFromStorage(storage = localStorage) {
  if (!storage) return '';
  const tryParse = (raw) => {
    if (!raw) return '';
    const trimmed = String(raw).trim();
    if (isJwt(trimmed)) return trimmed;
    try {
      const parsed = JSON.parse(trimmed);
      const t = parsed.tokenValue || parsed.access_token || parsed.token || parsed?.data?.tokenValue || '';
      if (isJwt(t)) return String(t).trim();
    } catch {
      /* ignore */
    }
    return '';
  };

  try {
    const fromNx = tryParse(storage.getItem('nx-ims'));
    if (fromNx) return fromNx;
  } catch {
    /* ignore */
  }
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key) continue;
      if (
        !key.startsWith('adobeid_ims_access_token/') &&
        !/ims.*token|tokenValue|nx-ims/i.test(key)
      ) {
        continue;
      }
      const val = tryParse(storage.getItem(key));
      if (val) return val;
    }
  } catch {
    /* ignore */
  }
  return '';
}

function readDaImsToken() {
  return readDaImsTokenFromStorage(localStorage) || readDaImsTokenFromStorage(sessionStorage);
}

function sendTokenToOpener(token) {
  const t = String(token || '').trim();
  if (!isJwt(t)) return false;
  const payload = { type: MSG_TYPE, token: t, source: 'da-token-bridge' };
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, '*');
    }
  } catch {
    /* ignore */
  }
  try {
    window.postMessage(payload, '*');
  } catch {
    /* ignore */
  }
  return true;
}

function setStatus(el, text, kind = '') {
  if (!el) return;
  el.textContent = text;
  el.dataset.kind = kind;
}

export function runDaTokenBridge(root = document.getElementById('forge-da-token-bridge')) {
  if (!root) return;

  root.innerHTML = `
    <style>
      .forge-da-bridge {
        font-family: adobe-clean, "Source Sans Pro", system-ui, sans-serif;
        max-width: 28rem;
        margin: 2.5rem auto;
        padding: 1.5rem;
        color: #2c2c2c;
        line-height: 1.45;
      }
      .forge-da-bridge h1 {
        font-size: 1.25rem;
        margin: 0 0 0.75rem;
        font-weight: 700;
      }
      .forge-da-bridge p { margin: 0 0 0.75rem; font-size: 0.9375rem; }
      .forge-da-bridge .status {
        margin: 1rem 0;
        padding: 0.75rem 0.875rem;
        border-radius: 6px;
        background: #f4f4f4;
        font-size: 0.875rem;
      }
      .forge-da-bridge .status[data-kind="ok"] { background: #e6f5ea; color: #0d6728; }
      .forge-da-bridge .status[data-kind="wait"] { background: #e8f1fc; color: #0b5cab; }
      .forge-da-bridge .status[data-kind="err"] { background: #fcebea; color: #b10e1c; }
      .forge-da-bridge .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem; }
      .forge-da-bridge button {
        appearance: none;
        border: 1px solid #d5d5d5;
        background: #fff;
        color: #2c2c2c;
        border-radius: 6px;
        padding: 0.55rem 0.9rem;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      .forge-da-bridge button.primary {
        background: #1473e6;
        border-color: #1473e6;
        color: #fff;
      }
      .forge-da-bridge button:disabled { opacity: 0.55; cursor: default; }
    </style>
    <div class="forge-da-bridge">
      <h1>Document Authoring sign-in</h1>
      <p><strong>Do not pick a project.</strong> Sign in with Adobe, then click <strong>Use signed-in session</strong> below. This window sends the token back to the preview.</p>
      <div class="status" data-kind="wait" id="forgeDaBridgeStatus">Checking da.live session…</div>
      <div class="actions">
        <button type="button" class="primary" id="forgeDaBridgeSignIn">Sign in on da.live</button>
        <button type="button" id="forgeDaBridgeRetry">Use signed-in session</button>
        <button type="button" id="forgeDaBridgeClose" hidden>Close window</button>
      </div>
    </div>
  `;

  const statusEl = root.querySelector('#forgeDaBridgeStatus');
  const signInBtn = root.querySelector('#forgeDaBridgeSignIn');
  const retryBtn = root.querySelector('#forgeDaBridgeRetry');
  const closeBtn = root.querySelector('#forgeDaBridgeClose');
  const started = Date.now();
  let done = false;
  let pollTimer = 0;

  const finish = (token) => {
    if (done) return true;
    if (!sendTokenToOpener(token)) return false;
    done = true;
    if (pollTimer) window.clearInterval(pollTimer);
    setStatus(statusEl, 'Signed in — token sent to FORGE. You can close this window.', 'ok');
    if (signInBtn) signInBtn.disabled = true;
    if (retryBtn) retryBtn.disabled = true;
    if (closeBtn) {
      closeBtn.hidden = false;
      closeBtn.focus();
    }
    window.setTimeout(() => {
      try {
        window.close();
      } catch {
        /* ignore */
      }
    }, 1200);
    return true;
  };

  const tryCapture = () => {
    const token = readDaImsToken();
    if (token) return finish(token);
    if (Date.now() - started > MAX_WAIT_MS) {
      if (pollTimer) window.clearInterval(pollTimer);
      setStatus(
        statusEl,
        'Timed out waiting for sign-in. Click “Sign in on da.live”, finish Adobe login, then “Use signed-in session”.',
        'err',
      );
      return false;
    }
    setStatus(
      statusEl,
      'Waiting for da.live sign-in… Finish Adobe login in the da.live tab, then return here.',
      'wait',
    );
    return false;
  };

  signInBtn?.addEventListener('click', () => {
    window.open('https://da.live/', 'forge-da-live-login');
    setStatus(statusEl, 'Complete Adobe sign-in on da.live. This page will pick up your session automatically.', 'wait');
    tryCapture();
  });

  retryBtn?.addEventListener('click', () => {
    if (!tryCapture()) {
      setStatus(statusEl, 'No da.live session found yet. Sign in on da.live, then try again.', 'err');
    }
  });

  closeBtn?.addEventListener('click', () => {
    try {
      window.close();
    } catch {
      /* ignore */
    }
  });

  window.addEventListener('storage', () => {
    tryCapture();
  });

  if (!tryCapture()) {
    pollTimer = window.setInterval(tryCapture, POLL_MS);
  }
}

// Dedicated HTML page auto-boots; forge.js imports call runDaTokenBridge(root) explicitly.
if (typeof document !== 'undefined' && /da-token-bridge/i.test(window.location.pathname || '')) {
  const boot = () => runDaTokenBridge();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}
