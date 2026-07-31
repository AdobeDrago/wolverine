/**
 * DA App micro-frontend: capture IMS token via DA_SDK and postMessage to the
 * preview opener (*.aem.page?forge-edit=1).
 *
 * da.live iframes this page from the HLX code bus (aem.page origin), so
 * localStorage on this document is NOT da.live's. Use DA_SDK.token instead.
 *
 * App URL: https://da.live/app/{org}/{repo}/tools/forge/da-token-bridge
 */

const MSG_TYPE = 'forge:set-da-token';
const POLL_MS = 500;
const MAX_WAIT_MS = 5 * 60 * 1000;

function isJwt(value) {
  const t = String(value || '').trim();
  return t.startsWith('eyJ') && t.split('.').length === 3 && t.length > 500;
}

/** Fallback when not inside the DA shell (direct aem.page open). */
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
      if (!key.startsWith('adobeid_ims_access_token/') && !/ims.*token|nx-ims/i.test(key)) continue;
      const val = tryParse(storage.getItem(key));
      if (val) return val;
    }
  } catch {
    /* ignore */
  }
  return '';
}

async function readTokenFromDaSdk() {
  try {
    let sdkPromise = globalThis.DA_SDK;
    if (!sdkPromise) {
      await import('https://da.live/nx/utils/sdk.js');
      sdkPromise = globalThis.DA_SDK;
    }
    if (!sdkPromise) return '';
    const api = await sdkPromise;
    const token = api?.token || api?.accessToken || '';
    if (isJwt(token)) return String(token).trim();
  } catch {
    /* not in DA shell yet, or SDK unavailable */
  }
  return '';
}

async function readDaToken() {
  const fromSdk = await readTokenFromDaSdk();
  if (fromSdk) return fromSdk;
  return readDaImsTokenFromStorage(localStorage) || readDaImsTokenFromStorage(sessionStorage);
}

function getPreviewOpener() {
  const candidates = [];
  try {
    if (window.opener) candidates.push(window.opener);
  } catch {
    /* ignore */
  }
  try {
    if (window.parent && window.parent !== window) candidates.push(window.parent);
  } catch {
    /* ignore */
  }
  try {
    if (window.top && window.top !== window) {
      candidates.push(window.top);
      if (window.top.opener) candidates.push(window.top.opener);
    }
  } catch {
    /* ignore */
  }
  try {
    if (window.parent?.opener) candidates.push(window.parent.opener);
  } catch {
    /* ignore */
  }
  for (const w of candidates) {
    try {
      if (w && !w.closed) return w;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function sendTokenToOpener(token) {
  const t = String(token || '').trim();
  if (!isJwt(t)) return false;
  const payload = { type: MSG_TYPE, token: t, source: 'da-token-bridge' };
  const targets = new Set();
  const opener = getPreviewOpener();
  if (opener) targets.add(opener);
  try {
    if (window.top && window.top !== window) targets.add(window.top);
  } catch {
    /* ignore */
  }
  try {
    if (window.parent && window.parent !== window) targets.add(window.parent);
  } catch {
    /* ignore */
  }
  targets.add(window);
  let sent = false;
  for (const target of targets) {
    try {
      target.postMessage(payload, '*');
      sent = true;
    } catch {
      /* ignore */
    }
  }
  return sent;
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
      <p>Sign in with Adobe if prompted. This window captures your session and returns to the preview automatically — nothing to copy.</p>
      <div class="status" data-kind="wait" id="forgeDaBridgeStatus">Connecting to Document Authoring…</div>
      <div class="actions">
        <button type="button" class="primary" id="forgeDaBridgeRetry">Try again</button>
        <button type="button" id="forgeDaBridgeClose" hidden>Close window</button>
      </div>
    </div>
  `;

  const statusEl = root.querySelector('#forgeDaBridgeStatus');
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
    setStatus(statusEl, 'Signed in — returning to preview…', 'ok');
    if (retryBtn) retryBtn.disabled = true;
    if (closeBtn) {
      closeBtn.hidden = false;
      closeBtn.focus();
    }
    window.setTimeout(() => {
      try {
        window.top?.close?.();
      } catch {
        /* ignore */
      }
      try {
        window.close();
      } catch {
        /* ignore */
      }
    }, 900);
    return true;
  };

  const tryCapture = async () => {
    const token = await readDaToken();
    if (token) return finish(token);
    if (Date.now() - started > MAX_WAIT_MS) {
      if (pollTimer) window.clearInterval(pollTimer);
      setStatus(
        statusEl,
        'Still waiting for Adobe sign-in. Sign in if prompted, then click Try again.',
        'err',
      );
      return false;
    }
    setStatus(statusEl, 'Waiting for Adobe sign-in…', 'wait');
    return false;
  };

  retryBtn?.addEventListener('click', () => {
    tryCapture().then((ok) => {
      if (!ok) setStatus(statusEl, 'No session yet — finish Adobe sign-in, then try again.', 'err');
    });
  });

  closeBtn?.addEventListener('click', () => {
    try {
      window.top?.close?.();
    } catch {
      /* ignore */
    }
    try {
      window.close();
    } catch {
      /* ignore */
    }
  });

  tryCapture().then((ok) => {
    if (!ok) {
      pollTimer = window.setInterval(() => {
        tryCapture();
      }, POLL_MS);
    }
  });
}

if (typeof document !== 'undefined') {
  const boot = () => runDaTokenBridge();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}
