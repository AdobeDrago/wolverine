/**
 * FORGE inline editing on EDS preview sites (*.aem.page).
 * Edit text, links, and images on the page; save to Document Authoring. No Universal Editor.
 */

import { deleteBlockOnDaPageClient, insertBlockOnDaPageClient } from './forge-inline-edit-da.js';
import {
  closeAdaToolbar,
  computeAdaComplianceScore,
  countMissingImageAlts,
  instrumentEditableFields,
  openAdaPanelForTarget,
  refreshAdaMediaFlags,
} from './forge-inline-edit-fields.js';
import {
  applyProductsToCommerceBlock,
  blockNeedsProductPicker,
  fetchProductCatalog,
  openProductPicker,
  readSelectedProductIds,
} from './forge-inline-edit-commerce.js';
import { productBrandName } from './forge-product-brand.js';
import {
  getPreviewSegmentId,
  initPersonalizationOnBlock,
  mountPreviewJourneyControl,
  mountPreviewSegmentControl,
  openPersonalizationPanel,
  preparePersonalizedBlocksForSegmentSave,
  setClassifyBlockMeta,
  syncVariantVisibility,
  updatePersonalizationBadge,
} from './forge-inline-edit-personalization.js';
import { savePageToDaClient } from './forge-inline-edit-save.js';

/** Bump when deploying; cache-busts HLX/CDN for Chrome. */
export const FORGE_INLINE_EDIT_BUILD = 32;

const FORGE_EDIT_PARAM = 'forge-edit';
const FORGE_ORG_PARAM = 'forge-org';
const FORGE_REPO_PARAM = 'forge-repo';
const FORGE_API_PARAM = 'forge-api';

/** Default Wolverine CDN (App Builder) — used when head.html has no FORGE_CONFIG. */
const DEFAULT_FORGE_API_URL =
  'https://4191536-wolverine.adobeio-static.net/api/v1/web/dx-excshell-1/forge-api';
const DEFAULT_FORGE_AUTH_URL =
  'https://4191536-wolverine.adobeio-static.net/api/v1/web/dx-excshell-1/forge-auth';
const DEFAULT_FORGE_CDN_ORIGIN = 'https://4191536-wolverine.adobeio-static.net';

const BLOCK_REGISTRY = {
  hero: { label: 'Banner / Hero', category: 'content' },
  banner: { label: 'Banner', category: 'content' },
  cards: { label: 'Cards', category: 'content' },
  carousel: { label: 'Carousel', category: 'content' },
  columns: { label: 'Columns', category: 'content' },
  fragment: { label: 'Fragment', category: 'content' },
  'product-list': { label: 'Product grid', category: 'commerce' },
  'product-carousel': { label: 'Product carousel', category: 'commerce' },
  'product-teaser': { label: 'Product teaser', category: 'commerce' },
  'product-detail': { label: 'Product detail', category: 'commerce' },
  'product-details': { label: 'Product details (Magento)', category: 'commerce' },
  'forge-device-cards': { label: 'Device cards', category: 'commerce' },
  'xwalk-phone-list': { label: 'Phone list', category: 'commerce' },
  'forge-persona-plan': { label: 'Persona plan offer', category: 'commerce' },
  'forge-plan-offer': { label: 'Plan line offer (AJO)', category: 'commerce' },
  minicart: { label: 'Mini cart', category: 'commerce' },
  checkout: { label: 'Checkout', category: 'commerce' },
  'commerce-cart': { label: 'Commerce cart', category: 'commerce' },
  'commerce-checkout': { label: 'Commerce checkout', category: 'commerce' },
};

const PICKER_GROUPS = [
  { category: 'content', items: ['hero', 'cards', 'carousel', 'columns'] },
  {
    category: 'commerce',
    items: ['product-list', 'product-teaser', 'product-carousel', 'product-detail', 'forge-device-cards'],
  },
];

const COMMERCE_CLASS_HINTS = [
  'product-list',
  'product-carousel',
  'product-teaser',
  'product-detail',
  'product-details',
  'forge-device-cards',
  'xwalk-phone-list',
  'minicart',
  'checkout',
  'commerce-cart',
  'commerce-checkout',
  'forge-persona-plan',
  'forge-plan-offer',
];

function isEditMode() {
  const params = new URLSearchParams(window.location.search);
  const fe = params.get(FORGE_EDIT_PARAM);
  if (fe === '1' || fe === 'true') return true;
  // Common typo / alternate: ?forge=edit-1
  const forge = params.get('forge');
  if (forge === 'edit-1' || forge === 'edit' || forge === '1') return true;
  const vse = params.get('vse') || params.get('cse');
  return vse === 'forge';
}

/** DA/GitHub org slugs are case-sensitive on admin.da.live — normalize known demos. */
function normalizeOrgRepo(org, repo) {
  let o = String(org || '').trim();
  let r = String(repo || '').trim();
  if (o && o.toLowerCase() === 'adobedrago') o = 'AdobeDrago';
  if (r && r.toLowerCase() === 'wolverine') r = 'wolverine';
  return { org: o, repo: r };
}

function resolveOrgRepo() {
  const params = new URLSearchParams(window.location.search);
  let org = params.get(FORGE_ORG_PARAM);
  let repo = params.get(FORGE_REPO_PARAM);
  if (!org || !repo) {
    const m = window.location.hostname.match(/^main--(.+)--([^.]+)\.aem\.page$/);
    if (m) {
      repo = repo || m[1];
      org = org || m[2];
    }
  }
  return normalizeOrgRepo(org, repo);
}

function resolveForgeApiBase() {
  const meta = document.querySelector('meta[name="forge:api"]');
  if (meta?.content) return meta.content.replace(/\/$/, '');
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get(FORGE_API_PARAM);
  if (fromQuery) return fromQuery.replace(/\/$/, '');
  try {
    const fromConfig = window.FORGE_CONFIG?.FORGE_API_URL;
    if (fromConfig) return String(fromConfig).replace(/\/$/, '');
  } catch {
    /* ignore */
  }
  return DEFAULT_FORGE_API_URL;
}

function resolveForgeAuthBase() {
  try {
    const fromConfig = window.FORGE_CONFIG?.FORGE_AUTH_URL;
    if (fromConfig) return String(fromConfig).replace(/\/$/, '');
  } catch {
    /* ignore */
  }
  return DEFAULT_FORGE_AUTH_URL;
}

function resolveForgeCdnOrigin() {
  try {
    const api = resolveForgeApiBase();
    if (api.includes('adobeio-static.net')) return new URL(api).origin;
  } catch {
    /* ignore */
  }
  return DEFAULT_FORGE_CDN_ORIGIN;
}

function resolveDaToken() {
  try {
    const raw =
      sessionStorage.getItem('forge_da_token') || localStorage.getItem('forge_da_token') || '';
    if (!raw) return '';
    if (!isDaJwt(raw)) {
      // Stale/non-JWT leftovers (or cleared cookies while storage kept junk) — force re-login.
      clearStoredDaToken();
      return '';
    }
    return raw;
  } catch {
    return '';
  }
}

function storeDaToken(token) {
  const t = String(token || '').trim();
  if (!t || !isDaJwt(t)) return;
  try {
    sessionStorage.setItem('forge_da_token', t);
  } catch {
    /* ignore */
  }
  try {
    // Shared with the COOP-safe bridge return page on the same aem.page origin.
    localStorage.setItem('forge_da_token', t);
    localStorage.setItem('forge_da_auth_ts', String(Date.now()));
  } catch {
    /* ignore */
  }
  updateDaAuthBanner();
}

/** Singleton — never stack two Document Authoring sign-in dialogs. */
let daTokenPromptPromise = null;

function adobeOAuthBridgeUrls() {
  // Standard Adobe IMS via forge-auth — NOT da.live DA_SDK.
  // Open /adobe/start directly so the popup hits IMS immediately (no intermediate
  // "Redirecting…" HTML that can hang after async token checks).
  let returnOrigin = '';
  try {
    returnOrigin = window.location.origin || '';
  } catch {
    /* ignore */
  }
  const api = resolveForgeApiBase();
  const auth = resolveForgeAuthBase();
  const cdn = resolveForgeCdnOrigin();
  const q = `forgeReturn=${encodeURIComponent(returnOrigin)}`;
  const apiBridge = `${api}/inline-edit/oauth-bridge?${q}`;
  const staticBridge = `${cdn}/forge/da-oauth-bridge.html?${q}`;
  const capturePage = `${returnOrigin}/tools/forge/da-token-bridge.html?forgeDaCaptured=1`;
  const directAuth = `${auth}/adobe/start?returnTo=${encodeURIComponent(capturePage)}`;
  return { primary: directAuth, fallback: apiBridge, staticBridge, directAuth };
}

function isDaJwt(value) {
  const t = String(value || '').trim();
  // IMS JWTs are usually >1k chars; keep a low floor so capture is not rejected.
  return t.startsWith('eyJ') && t.split('.').length === 3 && t.length > 80;
}

/**
 * Open Adobe IMS sign-in (forge-auth / CDN bridge). No da.live SDK.
 */
function promptDaToken() {
  if (daTokenPromptPromise) return daTokenPromptPromise;
  daTokenPromptPromise = new Promise((resolve) => {
    document.querySelectorAll('.forge-edit-token-backdrop').forEach((n) => n.remove());

    const backdrop = document.createElement('div');
    backdrop.className = 'forge-edit-dialog-backdrop forge-edit-token-backdrop';
    const dialog = document.createElement('div');
    dialog.className = 'forge-edit-dialog forge-edit-token-dialog forge-edit-token-dialog--wait';
    dialog.innerHTML = `
      <header>Sign in with Adobe</header>
      <div class="dialog-body">
        <p>Complete <strong>Adobe</strong> sign-in in the popup (same login as Experience Cloud). This closes automatically — nothing to copy. No da.live required.</p>
        <p class="forge-edit-token-status" id="forgeDaTokenStatus" data-kind="wait">Opening Adobe sign-in…</p>
      </div>
      <footer>
        <button type="button" data-action="cancel">Cancel</button>
        <button type="button" class="primary" data-action="reopen">Reopen sign-in</button>
      </footer>
    `;
    backdrop.append(dialog);
    document.body.append(backdrop);

    const statusEl = dialog.querySelector('#forgeDaTokenStatus');
    let popup = null;
    let pollTimer = 0;
    let settled = false;
    let bc = null;

    const setStatus = (text, kind = 'wait') => {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.dataset.kind = kind;
    };

    const cleanup = () => {
      if (pollTimer) window.clearInterval(pollTimer);
      pollTimer = 0;
      window.removeEventListener('message', onMessage);
      try {
        bc?.close();
      } catch {
        /* ignore */
      }
      bc = null;
    };

    const finish = (val) => {
      if (settled) return;
      settled = true;
      cleanup();
      daTokenPromptPromise = null;
      try {
        popup?.close();
      } catch {
        /* ignore */
      }
      backdrop.remove();
      resolve(val || '');
    };

    const acceptToken = (raw) => {
      const val = String(raw || '').trim();
      if (!isDaJwt(val)) return false;
      storeDaToken(val);
      updateDaAuthBanner();
      showToast('Signed in to Document Authoring');
      finish(val);
      return true;
    };

    const onMessage = (e) => {
      if (e.data?.type !== 'forge:set-da-token' || !e.data.token) return;
      acceptToken(e.data.token);
    };

    try {
      bc = new BroadcastChannel('forge-da-token');
      bc.onmessage = (ev) => {
        if (ev?.data?.type === 'forge:set-da-token' && ev.data.token) {
          acceptToken(ev.data.token);
        }
      };
    } catch {
      /* BroadcastChannel unavailable */
    }

    const openLogin = () => {
      setStatus('Waiting for Adobe sign-in…', 'wait');
      try {
        popup?.close();
      } catch {
        /* ignore */
      }
      const fresh = adobeOAuthBridgeUrls();
      popup = window.open(fresh.primary, 'forge-da-oauth', 'width=560,height=720');
      if (!popup) {
        setStatus('Popup blocked — allow popups for this site, then click Reopen sign-in.', 'err');
        return;
      }
      try {
        popup.focus();
      } catch {
        /* ignore */
      }

      // If adobe/start 404/503s, fall back to forge-api HTML bridge.
      window.setTimeout(() => {
        if (settled || !popup) return;
        try {
          if (popup.closed) return;
          const title = popup.document?.title || '';
          const bodyText = popup.document?.body?.innerText || '';
          if (
            /404|not found|not configured|503/i.test(title) ||
            /404 Not Found|not configured|503/i.test(bodyText)
          ) {
            popup.location.href = fresh.fallback || fresh.staticBridge;
          }
        } catch {
          /* cross-origin while on IMS / CDN — expected */
        }
      }, 2500);

      if (pollTimer) window.clearInterval(pollTimer);
      pollTimer = window.setInterval(() => {
        if (settled) return;
        const existing = resolveDaToken();
        if (isDaJwt(existing)) {
          acceptToken(existing);
          return;
        }
        let closed = false;
        try {
          closed = Boolean(popup?.closed);
        } catch {
          /* ignore */
        }
        if (closed) {
          window.setTimeout(() => {
            if (settled) return;
            const late = resolveDaToken();
            if (isDaJwt(late)) {
              acceptToken(late);
              return;
            }
            if (!settled) {
              setStatus('Sign-in window closed before a session arrived. Click Reopen sign-in.', 'err');
            }
          }, 1200);
          window.clearInterval(pollTimer);
          pollTimer = 0;
        }
      }, 400);
    };

    window.addEventListener('message', onMessage);
    dialog.querySelector('[data-action="cancel"]')?.addEventListener('click', () => finish(''));
    dialog.querySelector('[data-action="reopen"]')?.addEventListener('click', openLogin);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) finish('');
    });

    openLogin();
  });
  return daTokenPromptPromise;
}

function clearStoredDaToken() {
  try {
    sessionStorage.removeItem('forge_da_token');
    localStorage.removeItem('forge_da_token');
    localStorage.removeItem('forge_da_auth_ts');
  } catch {
    /* ignore */
  }
  updateDaAuthBanner();
}

function updateDaAuthBanner() {
  const btn = document.querySelector('.forge-edit-banner__da-auth');
  if (!btn) return;
  const signedIn = Boolean(resolveDaToken());
  btn.textContent = signedIn ? 'Adobe signed in' : 'Sign in with Adobe';
  btn.dataset.signedIn = signedIn ? '1' : '0';
  btn.title = signedIn
    ? 'Document Authoring token stored for this tab (sessionStorage). Click to sign in again.'
    : 'Required for Save / Add component. Not a browser cookie — clearing cookies will not sign you out of DA.';
}

function sectionLabel(el) {
  const heading = el.querySelector('h1, h2, h3, h4');
  const text = heading?.textContent?.trim();
  if (text) return text.length > 48 ? `${text.slice(0, 45)}…` : text;
  const para = el.querySelector('p');
  const pText = para?.textContent?.trim();
  if (pText) return pText.length > 48 ? `${pText.slice(0, 45)}…` : pText;
  return 'Content section';
}

function classifyBlock(el) {
  const classes = [...el.classList];
  // Prefer commerce-specific markers over generic "cards"
  for (const name of COMMERCE_CLASS_HINTS) {
    if (classes.includes(name) && BLOCK_REGISTRY[name]) {
      return { id: name, ...BLOCK_REGISTRY[name] };
    }
  }
  if (classes.includes('cards') && (classes.includes('forge-device-cards') || classes.includes('xwalk-phone-list'))) {
    const id = classes.includes('xwalk-phone-list') ? 'xwalk-phone-list' : 'forge-device-cards';
    return { id, ...BLOCK_REGISTRY[id] };
  }
  for (const name of Object.keys(BLOCK_REGISTRY)) {
    if (classes.includes(name)) return { id: name, ...BLOCK_REGISTRY[name] };
  }
  if (el.hasAttribute('data-forge-commerce') || el.querySelector?.('[data-forge-product-id]')) {
    return { id: 'product-list', label: 'Commerce products', category: 'commerce' };
  }
  if (el.closest('header')) return { id: 'header', label: 'Header', category: 'content' };
  if (el.closest('footer')) return { id: 'footer', label: 'Footer', category: 'content' };
  const sectionClass = classes.find((c) => c && c !== 'section');
  if (sectionClass) {
    return {
      id: sectionClass,
      label: sectionLabel(el),
      category: BLOCK_REGISTRY[sectionClass]?.category || 'content',
    };
  }
  return { id: 'section', label: sectionLabel(el), category: 'content' };
}

function currentPagePath() {
  let p = window.location.pathname.replace(/\.html$/, '');
  if (p.endsWith('/')) p = p.slice(0, -1);
  if (!p || p === '/') return 'index';
  return p.replace(/^\//, '');
}

let pageDirty = false;
let saveInFlight = false;

function setPageDirty() {
  pageDirty = true;
  const btn = document.querySelector('.forge-edit-banner__save');
  if (btn) {
    btn.disabled = false;
    btn.classList.add('forge-edit-banner__save--dirty');
  }
}

function showToast(message, isError = false) {
  document.querySelector('.forge-edit-toast')?.remove();
  const el = document.createElement('div');
  el.className = 'forge-edit-toast';
  el.setAttribute('role', 'status');
  if (isError) el.style.background = '#c9252d';
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 5000);
}

function updateAdaScoreBanner() {
  const chip = document.querySelector('.forge-edit-banner__ada-score');
  if (!chip) return;
  const { score, missingAlts, vagueLinks, totalImages, totalLinks } = computeAdaComplianceScore(document);
  chip.textContent = `ADA ${score}%`;
  chip.dataset.score = String(score);
  chip.classList.toggle('forge-edit-banner__ada-score--ok', score >= 90);
  chip.classList.toggle('forge-edit-banner__ada-score--warn', score >= 60 && score < 90);
  chip.classList.toggle('forge-edit-banner__ada-score--bad', score < 60);
  const parts = [];
  if (totalImages) parts.push(`${missingAlts} image${missingAlts === 1 ? '' : 's'} missing alt`);
  if (totalLinks) parts.push(`${vagueLinks} vague link${vagueLinks === 1 ? '' : 's'}`);
  chip.title =
    parts.length > 0
      ? `ADA compliance ${score}% — ${parts.join(' · ')}. Click images for alt; double-click links for accessible name.`
      : `ADA compliance ${score}% — no image/link issues detected on this page.`;
}

function showBanner() {
  if (document.querySelector('.forge-edit-banner')) return;
  const bar = document.createElement('div');
  bar.className = 'forge-edit-banner';
  bar.setAttribute('role', 'status');
  const { org, repo } = resolveOrgRepo();
  const target = org && repo ? `${org}/${repo}` : 'preview site';
  const pageLabel = currentPagePath() === 'index' ? 'Home' : currentPagePath();
  bar.innerHTML = `<strong>${productBrandName()} inline edit</strong>
    <span>${target} · ${pageLabel}</span>
    <button type="button" class="forge-edit-banner__da-auth" data-signed-in="0">Sign in with Adobe</button>
    <button type="button" class="forge-edit-banner__ada-score" title="ADA compliance">ADA —</button>
    <button type="button" class="forge-edit-banner__save" disabled>Save page</button>`;
  document.body.prepend(bar);
  document.documentElement.classList.add('forge-edit-active');
  bar.querySelector('.forge-edit-banner__da-auth')?.addEventListener('click', async () => {
    clearStoredDaToken();
    const token = await promptDaToken();
    if (token) showToast('Document Authoring signed in — Save / Add component ready');
    else showToast('DA sign-in cancelled — Add component will not persist until you sign in', true);
    updateDaAuthBanner();
  });
  bar.querySelector('.forge-edit-banner__save')?.addEventListener('click', () => savePage());
  updateDaAuthBanner();
  bar.querySelector('.forge-edit-banner__ada-score')?.addEventListener('click', () => {
    const first = document.querySelector('main img.forge-edit-media--needs-alt, main img:not([alt])');
    if (first) {
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      openAdaPanelForTarget(first, { onDirty: setPageDirty });
      return;
    }
    showToast('No missing image alts — double-click vague links (e.g. “Learn more”) for accessible names.');
  });
  window.addEventListener('forge-ada-score-refresh', updateAdaScoreBanner);
  refreshAdaMediaFlags(document);
  updateAdaScoreBanner();
  setClassifyBlockMeta(classifyBlock);
  mountPreviewSegmentControl(bar, [], {
    confirmIfDirty: () => pageDirty,
  });
  mountPreviewJourneyControl(bar);
}

function decorateBlock(el, meta) {
  if (el.dataset.forgeEditDecorated) return;
  el.dataset.forgeEditDecorated = '1';
  el.classList.add('forge-edit-block', `forge-edit-block--${meta.category}`);
  el.dataset.forgeComponentType = meta.category;
  el.dataset.forgeBlockId = meta.id;
  const badge = document.createElement('span');
  badge.className = 'forge-edit-badge';
  badge.textContent = `${meta.label} (${meta.category})`;
  el.append(badge);
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'forge-edit-delete';
  delBtn.textContent = 'Delete';
  delBtn.title = 'Delete this component from Document Authoring';
  delBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    deleteComponent(el, meta);
  });
  el.append(delBtn);
  instrumentEditableFields(el, { onDirty: setPageDirty });
  if (el.hasAttribute('data-forge-personalization')) {
    initPersonalizationOnBlock(el, meta, { onDirty: setPageDirty, classify: classifyBlock });
  }
}

function sectionIndexForBlock(blockEl) {
  const main = document.querySelector('main');
  if (!main || !blockEl) return -1;
  const section = blockEl.closest('main > div') || blockEl;
  return mainSections(main).indexOf(section);
}

function reloadAfterMutation(result) {
  const seg = getPreviewSegmentId();
  if (result?.previewUrl) {
    try {
      const u = new URL(result.previewUrl, window.location.origin);
      if (seg) u.searchParams.set('forge-preview-segment', seg);
      window.location.href = u.toString();
      return;
    } catch {
      /* fall through */
    }
  }
  const u = new URL(window.location.href);
  u.searchParams.set('_t', String(Date.now()));
  if (seg) u.searchParams.set('forge-preview-segment', seg);
  window.location.href = u.toString();
}

function findBlocks(root) {
  const selectors = [
    ...Object.keys(BLOCK_REGISTRY).map((c) => `main .${c}, main div.${c}`),
    'main .cards.forge-device-cards',
    'main .cards.xwalk-phone-list',
    'main [data-forge-commerce]',
  ].join(', ');
  const found = new Set();
  root.querySelectorAll(selectors).forEach((el) => {
    if (!found.has(el)) found.add(el);
  });
  // Every top-level section in main is editable (Franklin default + named blocks).
  root.querySelectorAll('main > div:not(.forge-edit-drop-zone)').forEach((section) => {
    if (!found.has(section)) found.add(section);
  });
  return [...found];
}

function mainSections(main) {
  return [...main.children].filter(
    (n) => n.tagName === 'DIV' && !n.classList.contains('forge-edit-drop-zone'),
  );
}

function insertDropZones(main) {
  const sections = mainSections(main);
  const existing = [...main.querySelectorAll(':scope > .forge-edit-drop-zone')];
  if (existing.length === sections.length) return;

  main.querySelectorAll('.forge-edit-drop-zone').forEach((z) => z.remove());
  sections.forEach((section, i) => {
    const zone = document.createElement('div');
    zone.className = 'forge-edit-drop-zone';
    zone.dataset.forgeDropIndex = String(i);
    zone.textContent = '+ Add component (saves to Document Authoring)';
    zone.addEventListener('click', () => openAddDialog({ afterIndex: i }));
    section.after(zone);
  });
}

async function insertBlockViaForgeApi(blockId, afterIndex, apiBase, products = null) {
  const { org, repo } = resolveOrgRepo();
  const headers = { 'Content-Type': 'application/json' };
  const daToken = resolveDaToken();
  if (daToken) headers['X-Forge-Da-Token'] = daToken;

  const res = await fetch(`${apiBase}/api/inline-edit/insert-block`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      org,
      repo,
      pagePath: currentPagePath(),
      blockId,
      afterIndex,
      brandName: productBrandName(),
      products: Array.isArray(products) ? products : undefined,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.hint || `Insert failed (${res.status})`);
    err.needsToken = Boolean(data.needsToken) || res.status === 401 || res.status === 403;
    err.hint = data.hint || '';
    throw err;
  }
  return data;
}

async function insertBlockOnDaClientWithPrompt(blockId, afterIndex, products = null, { forcePrompt = false } = {}) {
  const { org, repo } = resolveOrgRepo();
  let token = forcePrompt ? '' : resolveDaToken();
  if (forcePrompt) clearStoredDaToken();
  if (!token) token = await promptDaToken();
  if (!token) {
    throw new Error('DA token required — Sign in with Adobe when prompted');
  }

  const payload = {
    org,
    repo,
    pagePath: currentPagePath(),
    blockId,
    afterIndex,
    brandName: productBrandName(),
    products: Array.isArray(products) ? products : undefined,
    token,
  };

  let result = await insertBlockOnDaPageClient(payload);
  if (!result.ok && result.needsToken) {
    clearStoredDaToken();
    const retry = await promptDaToken();
    if (retry) {
      result = await insertBlockOnDaPageClient({ ...payload, token: retry });
    }
  }
  if (!result.ok) {
    throw new Error(result.error || result.hint || 'Insert failed');
  }
  return result;
}

async function insertBlock(blockId, afterIndex, products = null) {
  const { org, repo } = resolveOrgRepo();
  if (!org || !repo) {
    throw new Error('Missing org/repo — add forge-org and forge-repo query params');
  }

  const apiBase = resolveForgeApiBase();
  if (apiBase) {
    try {
      return await insertBlockViaForgeApi(blockId, afterIndex, apiBase, products);
    } catch (e) {
      // Stale forge-api DA_ADMIN_TOKEN → one token dialog, then browser write.
      const authFail =
        e?.needsToken ||
        /DA write failed:\s*40[13]|DA token required|401|403/i.test(String(e?.message || ''));
      if (!authFail) throw e;
      return insertBlockOnDaClientWithPrompt(blockId, afterIndex, products, { forcePrompt: true });
    }
  }

  return insertBlockOnDaClientWithPrompt(blockId, afterIndex, products);
}

async function deleteBlockViaForgeApi(sectionIndex, apiBase) {
  const { org, repo } = resolveOrgRepo();
  const headers = { 'Content-Type': 'application/json' };
  const daToken = resolveDaToken();
  if (daToken) headers['X-Forge-Da-Token'] = daToken;

  const res = await fetch(`${apiBase}/api/inline-edit/delete-block`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      org,
      repo,
      pagePath: currentPagePath(),
      sectionIndex,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.hint || `Delete failed (${res.status})`);
    err.needsToken = Boolean(data.needsToken) || res.status === 401 || res.status === 403;
    err.hint = data.hint || '';
    throw err;
  }
  return data;
}

async function deleteBlockOnDaClientWithPrompt(sectionIndex, { forcePrompt = false } = {}) {
  const { org, repo } = resolveOrgRepo();
  let token = forcePrompt ? '' : resolveDaToken();
  if (forcePrompt) clearStoredDaToken();
  if (!token) token = await promptDaToken();
  if (!token) {
    throw new Error('DA token required — Sign in with Adobe when prompted');
  }

  const payload = {
    org,
    repo,
    pagePath: currentPagePath(),
    sectionIndex,
    token,
  };

  let result = await deleteBlockOnDaPageClient(payload);
  if (!result.ok && result.needsToken) {
    clearStoredDaToken();
    const retry = await promptDaToken();
    if (retry) {
      result = await deleteBlockOnDaPageClient({ ...payload, token: retry });
    }
  }
  if (!result.ok) {
    throw new Error(result.error || result.hint || 'Delete failed');
  }
  return result;
}

async function deleteBlock(sectionIndex) {
  const { org, repo } = resolveOrgRepo();
  if (!org || !repo) {
    throw new Error('Missing org/repo — add forge-org and forge-repo query params');
  }

  const apiBase = resolveForgeApiBase();
  if (apiBase) {
    try {
      return await deleteBlockViaForgeApi(sectionIndex, apiBase);
    } catch (e) {
      const authFail =
        e?.needsToken ||
        /DA write failed:\s*40[13]|DA token required|401|403/i.test(String(e?.message || ''));
      if (!authFail) throw e;
      return deleteBlockOnDaClientWithPrompt(sectionIndex, { forcePrompt: true });
    }
  }

  return deleteBlockOnDaClientWithPrompt(sectionIndex);
}

async function deleteComponent(blockEl, meta) {
  const idx = sectionIndexForBlock(blockEl);
  if (idx < 0) {
    showToast('Could not find this component’s section to delete', true);
    return;
  }
  const label = meta?.label || blockEl?.dataset?.forgeBlockId || 'component';
  const ok = window.confirm(
    `Delete “${label}” from Document Authoring?\n\nThis removes the whole section and reloads preview.`,
  );
  if (!ok) return;

  try {
    showToast(`Deleting ${label}…`);
    const result = await deleteBlock(idx);
    if (!result?.ok && !result?.previewUrl) {
      throw new Error(result?.error || result?.hint || 'Delete failed — section was not removed');
    }
    showToast(`Deleted ${label} — reloading preview…`);
    reloadAfterMutation(result);
  } catch (e) {
    showToast(e.message || 'Delete failed', true);
  }
}

async function pickProductsForBlock(blockId, selectedIds = null) {
  if (!blockNeedsProductPicker(blockId)) return null;
  const catalog = await fetchProductCatalog(resolveForgeApiBase());
  const multi = blockId !== 'product-detail';
  return openProductPicker({
    products: catalog.products,
    facets: catalog.facets,
    catalogs: catalog.catalogs,
    selectedIds,
    multi,
    min: 1,
    title:
      blockId === 'product-detail'
        ? 'Choose product for detail (SKU / type / catalog)'
        : `Choose products · ${BLOCK_REGISTRY[blockId]?.label || blockId}`,
  });
}

function openAddDialog({ afterIndex = -1, anchorEl = null } = {}) {
  document.querySelector('.forge-edit-dialog-backdrop')?.remove();

  const backdrop = document.createElement('div');
  backdrop.className = 'forge-edit-dialog-backdrop';
  const dialog = document.createElement('div');
  dialog.className = 'forge-edit-dialog';
  dialog.innerHTML = `
    <header>Add component</header>
    <div class="dialog-body"></div>
    <footer>
      <button type="button" data-action="cancel">Cancel</button>
    </footer>
  `;
  const body = dialog.querySelector('.dialog-body');

  for (const group of PICKER_GROUPS) {
    const wrap = document.createElement('div');
    wrap.className = 'block-group';
    wrap.innerHTML = `<h4>${group.category}</h4>`;
    for (const id of group.items) {
      const meta = BLOCK_REGISTRY[id];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `block-pick block-pick--${group.category}`;
      btn.textContent = meta?.label || id;
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const original = meta?.label || id;
        btn.textContent = blockNeedsProductPicker(id) ? 'Choose products…' : 'Saving…';
        try {
          let products = null;
          if (blockNeedsProductPicker(id)) {
            products = await pickProductsForBlock(id);
            if (!products) {
              btn.disabled = false;
              btn.textContent = original;
              return;
            }
            btn.textContent = 'Saving…';
          }
          const result = await insertBlock(id, afterIndex, products);
          if (!result?.ok && !result?.previewUrl) {
            throw new Error(result?.error || result?.hint || 'Insert failed — block was not saved');
          }
          backdrop.remove();
          showToast(
            products?.length
              ? `Added ${meta?.label || id} with ${products.length} product${products.length === 1 ? '' : 's'} — reloading…`
              : `Added ${meta?.label || id} — reloading preview…`,
          );
          reloadAfterMutation(result);
        } catch (e) {
          btn.disabled = false;
          btn.textContent = original;
          showToast(e.message || 'Insert failed', true);
        }
      });
      wrap.append(btn);
    }
    body.append(wrap);
  }

  dialog.querySelector('[data-action="cancel"]')?.addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.remove();
  });
  backdrop.append(dialog);
  document.body.append(backdrop);
  if (anchorEl) dialog.querySelector('header').textContent += ' (after selection)';
}

let contextMenuEl = null;

function hideContextMenu() {
  contextMenuEl?.remove();
  contextMenuEl = null;
}

async function savePageViaForgeApi(apiBase, mainHtml) {
  const { org, repo } = resolveOrgRepo();
  const headers = { 'Content-Type': 'application/json' };
  const daToken = resolveDaToken();
  if (daToken) headers['X-Forge-Da-Token'] = daToken;

  const res = await fetch(`${apiBase}/api/inline-edit/save-page`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      org,
      repo,
      pagePath: currentPagePath(),
      mainHtml,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.hint || `Save failed (${res.status})`);
    err.needsToken = Boolean(data.needsToken) || res.status === 401 || res.status === 403;
    err.hint = data.hint || '';
    throw err;
  }
  return data;
}

async function savePage() {
  if (saveInFlight) return;
  const { org, repo } = resolveOrgRepo();
  if (!org || !repo) {
    showToast('Missing org/repo', true);
    return;
  }

  closeAdaToolbar();

  const missingAlt = countMissingImageAlts(document);
  if (missingAlt > 0) {
    const proceed = window.confirm(
      `${missingAlt} image${missingAlt === 1 ? '' : 's'} missing ADA alt text. Save anyway?\n\nClick Cancel, then click each outlined image to add alt text.`,
    );
    if (!proceed) return;
  }

  const btn = document.querySelector('.forge-edit-banner__save');
  saveInFlight = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Saving…';
  }

  try {
    const previewSegment = getPreviewSegmentId();
    if (
      previewSegment &&
      document.body.classList.contains('xwalk-persona-segment-landing') &&
      !document.querySelector('[data-forge-personalization]')
    ) {
      const proceed = window.confirm(
        'Segment preview rebuilt this page as the campaign layout. Saving will store that campaign layout as the page source (replacing the default BYOD grid).\n\nContinue? Cancel to clear Segment (Preview: default), reload, then edit the grid — or add personalization variants on blocks for per-segment versions.',
      );
      if (!proceed) return;
    }

    const prepared = preparePersonalizedBlocksForSegmentSave(previewSegment);
    const mainEl = document.querySelector('main');
    if (!mainEl) throw new Error('No <main> on page');
    const mainClone = mainEl.cloneNode(true);
    // Strip editor chrome before shipping HTML to forge-api / DA.
    mainClone.querySelectorAll(
      '.forge-edit-banner,.forge-edit-drop-zone,.forge-edit-badge,.forge-edit-delete,.forge-edit-toast,.forge-edit-menu,.forge-edit-dialog-backdrop,.forge-edit-media-toolbar',
    ).forEach((n) => n.remove());
    mainClone.querySelectorAll('[contenteditable]').forEach((el) => {
      el.removeAttribute('contenteditable');
      el.classList.remove('forge-edit-field', 'forge-edit-field--dirty', 'forge-edit-media');
    });
    const mainHtml = mainClone.innerHTML;

    const apiBase = resolveForgeApiBase();
    let result = null;
    if (apiBase) {
      try {
        result = await savePageViaForgeApi(apiBase, mainHtml);
      } catch (e) {
        const authFail =
          e?.needsToken || /401|403|DA token required|DA write failed/i.test(String(e?.message || ''));
        if (!authFail) throw e;
        let token = resolveDaToken();
        if (!token) token = await promptDaToken();
        if (!token) throw e;
        result = await savePageToDaClient({
          org,
          repo,
          pagePath: currentPagePath(),
          token,
          mainEl,
        });
      }
    } else {
      let token = resolveDaToken();
      if (!token) token = await promptDaToken();
      if (!token) return;
      result = await savePageToDaClient({
        org,
        repo,
        pagePath: currentPagePath(),
        token,
        mainEl,
      });
    }

    if (!result?.ok) {
      if (result?.needsToken) {
        const retry = await promptDaToken();
        if (retry) {
          saveInFlight = false;
          storeDaToken(retry);
          return savePage();
        }
      }
      throw new Error(result?.error || 'Save failed');
    }
    pageDirty = false;
    btn?.classList.remove('forge-edit-banner__save--dirty');
    const segNote =
      prepared.segmentId && prepared.variantCount
        ? ` · segment variant (${prepared.variantCount} block${prepared.variantCount === 1 ? '' : 's'})`
        : prepared.segmentId
          ? ' · segment preview'
          : '';
    showToast(`Saved to Document Authoring${segNote} — refreshing preview…`);
    const u = new URL(window.location.href);
    u.searchParams.set('_t', String(Date.now()));
    window.location.href = u.toString();
  } catch (e) {
    showToast(e.message || 'Save failed', true);
  } finally {
    saveInFlight = false;
    if (btn) {
      btn.disabled = !pageDirty;
      btn.textContent = 'Save page';
    }
  }
}

function showContextMenu(x, y, blockEl, meta, targetEl) {
  hideContextMenu();
  const menu = document.createElement('ul');
  menu.className = 'forge-edit-menu';
  const adaTarget =
    targetEl?.closest?.('img') ||
    targetEl?.closest?.('picture') ||
    targetEl?.closest?.('a[href]') ||
    targetEl?.closest?.('button:not(.forge-edit-delete)');
  const commerceTarget =
    meta.category === 'commerce' ||
    blockNeedsProductPicker(meta.id) ||
    blockEl?.hasAttribute?.('data-forge-commerce') ||
    blockEl?.querySelector?.('[data-forge-product-id]');
  menu.innerHTML = `
    <li data-action="info">${meta.label} · ${meta.category}</li>
    <li class="menu-sep"></li>
    <li data-action="products"${commerceTarget ? '' : ' class="disabled"'}>Choose products…</li>
    <li data-action="ada"${adaTarget ? '' : ' class="disabled"'}>ADA / accessibility…</li>
    <li data-action="personalize">Personalization (RT CDP / AJO)…</li>
    <li data-action="add-after">Add component after…</li>
    <li data-action="delete" class="forge-edit-menu__danger">Delete component…</li>
    <li data-action="save">Save page to Document Authoring</li>
  `;
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  document.body.append(menu);
  contextMenuEl = menu;

  menu.addEventListener('click', async (e) => {
    e.stopPropagation();
    const li = e.target.closest('li[data-action]');
    if (!li || li.classList.contains('disabled')) return;
    const action = li.dataset.action;
    hideContextMenu();
    if (action === 'products') {
      try {
        const selected = await pickProductsForBlock(meta.id, readSelectedProductIds(blockEl));
        if (!selected) return;
        const host =
          blockEl.classList.contains('cards') ||
          blockEl.classList.contains('product-detail') ||
          blockEl.classList.contains('product-list')
            ? blockEl
            : blockEl.querySelector(
                '.cards.forge-device-cards, .cards.xwalk-phone-list, .product-detail, .product-list, .forge-device-cards, .xwalk-phone-list',
              ) || blockEl;
        applyProductsToCommerceBlock(host, selected, {
          brandName: productBrandName(),
          blockId: meta.id,
        });
        // Re-instrument fields after DOM replace
        delete host.dataset.forgeFieldsReady;
        instrumentEditableFields(host, { onDirty: setPageDirty });
        refreshAdaMediaFlags(host);
        setPageDirty();
        showToast(`Updated ${selected.length} product${selected.length === 1 ? '' : 's'} — Save page to publish`);
      } catch (err) {
        showToast(err.message || 'Product picker failed', true);
      }
    } else if (action === 'ada') {
      openAdaPanelForTarget(targetEl || blockEl, { onDirty: setPageDirty });
    } else if (action === 'personalize') {
      openPersonalizationPanel(blockEl, { onDirty: setPageDirty });
    } else if (action === 'add-after') {
      const main = document.querySelector('main');
      const sections = main ? mainSections(main) : [];
      const idx = sections.indexOf(blockEl.closest('main > div') || blockEl);
      openAddDialog({ afterIndex: idx >= 0 ? idx : -1, anchorEl: blockEl });
    } else if (action === 'delete') {
      deleteComponent(blockEl, meta);
    } else if (action === 'save') {
      savePage();
    }
  });
}

function onContextMenu(e) {
  const offer = e.target.closest('.forge-plan-offer[data-forge-personalization]');
  if (offer && !offer.classList.contains('forge-edit-block')) {
    decorateBlock(offer, { id: 'forge-plan-offer', label: 'Plan line offer (AJO)', category: 'commerce' });
  }
  const block = e.target.closest('.forge-edit-block');
  if (!block) return;
  e.preventDefault();
  showContextMenu(e.clientX, e.clientY, block, classifyBlock(block), e.target);
}

let scanDebounceTimer = 0;
let scanInProgress = false;
let mainDecorateObserver = null;

function scanAndDecorate() {
  const main = document.querySelector('main');
  if (!main || scanInProgress) return;
  scanInProgress = true;
  mainDecorateObserver?.disconnect();
  try {
    findBlocks(main).forEach((el) => decorateBlock(el, classifyBlock(el)));
    main.querySelectorAll('.forge-plan-offer[data-forge-personalization]').forEach((el) => {
      if (!el.dataset.forgeEditDecorated) {
        let label = 'Plan line offer (AJO)';
        try {
          const cfg = JSON.parse(el.getAttribute('data-forge-personalization') || '{}');
          if ((cfg.offerPlacement || '').startsWith('persona-plan-switch-')) {
            label = 'Plan tier switch (black pill)';
          }
        } catch {
          /* ignore */
        }
        decorateBlock(el, { id: 'forge-plan-offer', label, category: 'commerce' });
      }
    });
    insertDropZones(main);
  } finally {
    scanInProgress = false;
    if (mainDecorateObserver) {
      mainDecorateObserver.observe(main, MAIN_OBSERVER_OPTIONS);
    }
  }
}

function scheduleScanAndDecorate() {
  if (scanDebounceTimer) window.clearTimeout(scanDebounceTimer);
  scanDebounceTimer = window.setTimeout(() => {
    scanDebounceTimer = 0;
    scanAndDecorate();
  }, 200);
}

const MAIN_OBSERVER_OPTIONS = {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['data-block-status'],
};

function stopMainDecorateObserver() {
  mainDecorateObserver?.disconnect();
  mainDecorateObserver = null;
}

window.addEventListener('message', (e) => {
  if (e.data?.type === 'forge:set-da-token' && e.data.token) {
    try {
      sessionStorage.setItem('forge_da_token', String(e.data.token));
    } catch {
      /* ignore */
    }
  }
});

function init() {
  if (!isEditMode()) return;
  if (globalThis.__forgeInlineEditInit) return;
  globalThis.__forgeInlineEditInit = true;

  showBanner();
  // Ask for DA sign-in as soon as edit mode opens (not only on Save / Add / Delete).
  if (!resolveDaToken()) {
    window.setTimeout(() => {
      if (resolveDaToken() || daTokenPromptPromise) return;
      promptDaToken().then((token) => {
        updateDaAuthBanner();
        if (token) showToast('Document Authoring signed in — Save / Add / Delete ready');
      });
    }, 400);
  }
  scanAndDecorate();
  document.addEventListener('contextmenu', onContextMenu);
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.forge-edit-menu')) hideContextMenu();
    if (!e.target.closest('.forge-edit-media-toolbar')) closeAdaToolbar();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAdaToolbar();
      hideContextMenu();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      if (pageDirty) savePage();
    }
  });

  const main = document.querySelector('main');
  if (main) {
    mainDecorateObserver = new MutationObserver(() => {
      if (scanInProgress) return;
      scheduleScanAndDecorate();
    });
    mainDecorateObserver.observe(main, MAIN_OBSERVER_OPTIONS);
  }

  window.addEventListener('load', () => {
    window.setTimeout(() => {
      scanAndDecorate();
      stopMainDecorateObserver();
    }, 1200);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
