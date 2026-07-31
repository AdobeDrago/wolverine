/**
 * DA App micro-frontend: capture IMS token via DA_SDK and deliver it to the
 * preview tab (*.aem.page?forge-edit=1).
 *
 * da.live iframes this page from the HLX code bus (aem.page origin). DA_SDK
 * supplies the token. Because Cross-Origin-Opener-Policy often clears
 * window.opener, we also write forge_da_token to localStorage (shared with the
 * preview tab on the same aem.page origin) and optionally redirect the popup
 * back to the preview origin with the token in the hash.
 *
 * App URL: https://da.live/app/{org}/{repo}/tools/forge/da-token-bridge
 */

const MSG_TYPE = 'forge:set-da-token';
const POLL_MS = 500;
const MAX_WAIT_MS = 5 * 60 * 1000;
const TOKEN_KEY = 'forge_da_token';
const TOKEN_TS_KEY = 'forge_da_auth_ts';

function isJwt(value) {
  const t = String(value || '').trim();
  return t.startsWith('eyJ') && t.split('.').length === 3 && t.length > 80;
}

function params() {
  try {
    return new URLSearchParams(window.location.search || '');
  } catch {
    return new URLSearchParams();
  }
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
    // Official SDK is `export default` — it does NOT set globalThis.DA_SDK.
    // forge.js uses mod.default; the old globalThis check always returned ''.
    const mod = await import('https://da.live/nx/utils/sdk.js');
    const sdkPromise = mod?.default || globalThis.DA_SDK;
    if (!sdkPromise) return '';
    const api = await Promise.race([
      Promise.resolve(sdkPromise),
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error('DA_SDK timeout')), 12_000);
      }),
    ]);
    const token = api?.token || api?.accessToken || '';
    if (isJwt(token)) return String(token).trim();
  } catch {
    /* not in DA shell yet, or SDK unavailable / timed out */
  }
  return '';
}

/** Parent da.live posts { ready, token, ports } — catch token even if SDK await races. */
function watchDaParentToken(onToken) {
  const handler = (e) => {
    try {
      const t = e?.data?.token;
      if (isJwt(t)) onToken(String(t).trim());
    } catch {
      /* ignore */
    }
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}

async function readDaToken() {
  const fromSdk = await readTokenFromDaSdk();
  if (fromSdk) return fromSdk;
  return readDaImsTokenFromStorage(localStorage) || readDaImsTokenFromStorage(sessionStorage);
}

function persistTokenForPreview(token) {
  const t = String(token || '').trim();
  if (!isJwt(t)) return false;
  try {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(TOKEN_TS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.setItem(TOKEN_KEY, t);
  } catch {
    /* ignore */
  }
  return true;
}

function getPreviewOpener() {
  const candidates = [];
  try {
    if (window.opener) candidates.push(window.opener);
  } catch {
    /* ignore */
  }
  try {
    if (window.top?.opener) candidates.push(window.top.opener);
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

function sendTokenMessages(token) {
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
  try {
    const bc = new BroadcastChannel('forge-da-token');
    bc.postMessage(payload);
    bc.close();
    sent = true;
  } catch {
    /* ignore */
  }
  return sent;
}

function redirectPopupToPreview(token) {
  const t = String(token || '').trim();
  if (!isJwt(t)) return false;
  const q = params();
  let returnOrigin = (q.get('forgeReturn') || '').trim().replace(/\/$/, '');
  if (!returnOrigin) {
    // Iframe is already on aem.page — use this origin (query may not be forwarded by da.live).
    try {
      if (/\.aem\.(page|live)$/i.test(window.location.hostname)) {
        returnOrigin = window.location.origin;
      }
    } catch {
      /* ignore */
    }
  }
  if (!returnOrigin || !/^https:\/\//i.test(returnOrigin)) return false;
  const dest = `${returnOrigin}/tools/forge/da-token-bridge.html?forgeDaCaptured=1#${encodeURIComponent(t)}`;
  // Prefer navigating the popup top (da.live) onto aem.page so localStorage is not
  // partitioned under da.live. Cross-origin iframes may set top.location but not read it.
  const navigateTop = () => {
    try {
      if (window.top && window.top !== window) {
        window.top.location.replace(dest);
        return true;
      }
    } catch {
      /* ignore */
    }
    try {
      if (window.top && window.top !== window) {
        window.top.location.href = dest;
        return true;
      }
    } catch {
      /* ignore */
    }
    try {
      window.open(dest, '_top');
      return true;
    } catch {
      /* ignore */
    }
    return false;
  };
  if (navigateTop()) return true;
  try {
    window.location.replace(dest);
    return true;
  } catch {
    /* ignore */
  }
  try {
    window.location.href = dest;
    return true;
  } catch {
    return false;
  }
}

function setStatus(el, text, kind = '') {
  if (!el) return;
  el.textContent = text;
  el.dataset.kind = kind;
}

function handleCapturedReturn() {
  const q = params();
  if (q.get('forgeDaCaptured') !== '1') return false;

  const finishWithToken = (token) => {
    if (!isJwt(token)) return false;
    persistTokenForPreview(token);
    sendTokenMessages(token);
    document.body.innerHTML = `
    <div style="font-family:adobe-clean,system-ui,sans-serif;max-width:28rem;margin:3rem auto;padding:1.5rem;text-align:center;color:#1d1d1d;background:#fff">
      <h1 style="font-size:1.25rem;color:#1d1d1d">Signed in</h1>
      <p style="color:#1d1d1d">Session captured. You can close this tab and return to the preview.</p>
    </div>`;
    window.setTimeout(() => {
      try {
        window.close();
      } catch {
        /* ignore */
      }
    }, 600);
    return true;
  };

  let token = '';
  try {
    token = decodeURIComponent((window.location.hash || '').replace(/^#/, '')).trim();
  } catch {
    token = (window.location.hash || '').replace(/^#/, '').trim();
  }
  if (isJwt(token)) return finishWithToken(token);

  const forgeCode = (q.get('forgeCode') || '').trim();
  if (!forgeCode) return false;

  document.body.innerHTML = `
    <div style="font-family:adobe-clean,system-ui,sans-serif;max-width:28rem;margin:3rem auto;padding:1.5rem;text-align:center;color:#1d1d1d;background:#fff">
      <h1 style="font-size:1.25rem;color:#1d1d1d">Finishing sign-in…</h1>
      <p style="color:#1d1d1d">Capturing your Adobe session for Document Authoring.</p>
    </div>`;

  const authBase =
    (typeof window !== 'undefined' && window.FORGE_CONFIG?.FORGE_AUTH_URL) ||
    'https://4191536-wolverine.adobeio-static.net/api/v1/web/dx-excshell-1/forge-auth';

  (async () => {
    try {
      const res = await fetch(
        `${String(authBase).replace(/\/$/, '')}/adobe/capture-exchange?code=${encodeURIComponent(forgeCode)}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !isJwt(data.access_token)) {
        document.body.innerHTML = `
          <div style="font-family:system-ui;max-width:28rem;margin:3rem auto;padding:1.5rem;color:#1d1d1d">
            <h1>Sign-in capture failed</h1>
            <p style="color:#b10e1c">${data.error || res.status}</p>
            <p>Close this tab and click Sign in with Adobe again.</p>
          </div>`;
        return;
      }
      finishWithToken(String(data.access_token).trim());
    } catch (e) {
      document.body.innerHTML = `
        <div style="font-family:system-ui;max-width:28rem;margin:3rem auto;padding:1.5rem;color:#1d1d1d">
          <h1>Sign-in capture failed</h1>
          <p style="color:#b10e1c">${e?.message || e}</p>
          <p>Close this tab and click Sign in with Adobe again.</p>
        </div>`;
    }
  })();
  return true;
}

export function runDaTokenBridge(root = document.getElementById('forge-da-token-bridge')) {
  if (handleCapturedReturn()) return;
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
  let unwatchParent = () => {};

  const finish = (token) => {
    if (done) return true;
    if (!persistTokenForPreview(token)) return false;
    sendTokenMessages(token);
    done = true;
    if (pollTimer) window.clearInterval(pollTimer);
    try {
      unwatchParent();
    } catch {
      /* ignore */
    }
    setStatus(statusEl, 'Signed in — returning to preview…', 'ok');
    if (retryBtn) retryBtn.disabled = true;
    if (closeBtn) {
      closeBtn.hidden = false;
      closeBtn.focus();
    }
    // COOP-safe: bounce the popup back onto the preview origin with the token.
    window.setTimeout(() => {
      if (!redirectPopupToPreview(token)) {
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
      }
    }, 400);
    return true;
  };

  // Capture token from da.live parent postMessage immediately (same channel as DA_SDK).
  unwatchParent = watchDaParentToken((token) => {
    finish(token);
  });

  const tryCapture = async () => {
    if (done) return true;
    const token = await readDaToken();
    if (token) return finish(token);
    if (Date.now() - started > MAX_WAIT_MS) {
      if (pollTimer) window.clearInterval(pollTimer);
      setStatus(
        statusEl,
        'Still waiting for Adobe sign-in. Use the profile menu in this window to sign in, then click Try again.',
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
