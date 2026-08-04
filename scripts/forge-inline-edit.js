/**
 * FORGE inline editing on EDS preview sites (*.aem.page).
 * Edit text, links, and images on the page; save to Document Authoring. No Universal Editor.
 */

import {
  deleteBlockOnDaPageClient,
  insertBlockOnDaPageClient,
  pagePathToHlxPath,
  triggerHlxPreviewPath,
} from './forge-inline-edit-da.js';
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
import { buildBlockSectionHtml } from './forge-inline-edit-blocks.js';
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
export const FORGE_INLINE_EDIT_BUILD = 49;

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
  if (!t || t.length < 40) return false;
  if (t.startsWith('eyJ') && t.split('.').length >= 3) return true;
  if (t.length > 200 && /^[A-Za-z0-9\-._~+/=]+$/.test(t)) return true;
  return false;
}

/**
 * Adobe IMS sign-in for Document Authoring. No da.live SDK.
 * Uses a visible in-dialog link (new tab) — small IMS popups often render blank.
 */
function promptDaToken() {
  if (daTokenPromptPromise) return daTokenPromptPromise;
  daTokenPromptPromise = new Promise((resolve) => {
    document.querySelectorAll('.forge-edit-token-backdrop').forEach((n) => n.remove());

    const fresh = adobeOAuthBridgeUrls();
    const signInUrl = fresh.directAuth || fresh.primary;

    const backdrop = document.createElement('div');
    backdrop.className = 'forge-edit-dialog-backdrop forge-edit-token-backdrop';
    backdrop.setAttribute(
      'style',
      'position:fixed;inset:0;z-index:2147483645;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:24px;',
    );
    const dialog = document.createElement('div');
    dialog.className = 'forge-edit-dialog forge-edit-token-dialog';
    dialog.setAttribute(
      'style',
      'width:min(420px,100%);background:#ffffff !important;color:#1d1d1d !important;-webkit-text-fill-color:#1d1d1d !important;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.2);font:14px/1.45 adobe-clean,"Source Sans Pro",system-ui,sans-serif;',
    );
    dialog.innerHTML = `
      <header style="padding:14px 16px;border-bottom:1px solid #e8e8e8;font-weight:700;color:#1d1d1d !important;-webkit-text-fill-color:#1d1d1d !important;background:#fff !important;">Sign in with Adobe</header>
      <div class="dialog-body" style="padding:12px 16px 16px;color:#1d1d1d !important;-webkit-text-fill-color:#1d1d1d !important;background:#fff !important;">
        <p style="margin:0 0 12px;color:#1d1d1d !important;-webkit-text-fill-color:#1d1d1d !important;">Click the blue button (new tab). Sign in with Adobe. When the other tab says <strong style="color:#1d1d1d !important;">Signed in</strong>, this dialog closes — nothing to copy.</p>
        <p style="margin:0 0 14px;">
          <a data-action="signin" href="${signInUrl.replace(/"/g, '&quot;')}" target="_blank" rel="noopener"
             style="display:inline-block;padding:10px 16px;border-radius:6px;background:#1473e6 !important;color:#ffffff !important;-webkit-text-fill-color:#ffffff !important;text-decoration:none;font-weight:700;">Sign in with Adobe</a>
        </p>
        <p class="forge-edit-token-status" id="forgeDaTokenStatus" data-kind="wait"
           style="margin:0;padding:10px 12px;border-radius:6px;background:#e8f1fc !important;color:#0b5cab !important;-webkit-text-fill-color:#0b5cab !important;">Waiting for Adobe sign-in in the other tab…</p>
      </div>
      <footer style="display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid #e8e8e8;background:#fff !important;">
        <button type="button" data-action="cancel" style="padding:6px 14px;border-radius:6px;border:1px solid #cacaca;background:#fff !important;color:#1d1d1d !important;-webkit-text-fill-color:#1d1d1d !important;cursor:pointer;">Cancel</button>
      </footer>
    `;
    backdrop.append(dialog);
    document.body.append(backdrop);

    const statusEl = dialog.querySelector('#forgeDaTokenStatus');
    let pollTimer = 0;
    let settled = false;
    let bc = null;

    const setStatus = (text, kind = 'wait') => {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.dataset.kind = kind;
      if (kind === 'err') {
        statusEl.style.background = '#fcebea';
        statusEl.style.color = '#b10e1c';
      } else if (kind === 'ok') {
        statusEl.style.background = '#e6f5ea';
        statusEl.style.color = '#0d6728';
      } else {
        statusEl.style.background = '#e8f1fc';
        statusEl.style.color = '#0b5cab';
      }
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

    pollTimer = window.setInterval(() => {
      if (settled) return;
      const existing = resolveDaToken();
      if (isDaJwt(existing)) acceptToken(existing);
    }, 400);

    window.addEventListener('message', onMessage);
    dialog.querySelector('[data-action="signin"]')?.addEventListener('click', () => {
      setStatus('Complete Adobe sign-in in the new tab. This closes when you are done…', 'wait');
    });
    dialog.querySelector('[data-action="cancel"]')?.addEventListener('click', () => finish(''));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) finish('');
    });
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
    btn.removeAttribute('disabled');
    btn.classList.add('forge-edit-banner__save--dirty');
  }
}

/** Capture-phase dirty tracking — covers newly injected blocks and paste/IME edits. */
function ensureDirtyTracking() {
  if (document.documentElement.dataset.forgeDirtyBound === '1') return;
  document.documentElement.dataset.forgeDirtyBound = '1';
  const mark = (e) => {
    const t = e.target;
    if (!t?.closest) return;
    if (t.closest('.forge-edit-banner, .forge-edit-dialog-backdrop, .forge-edit-media-toolbar')) return;
    if (t.closest('main [contenteditable="true"], main .forge-edit-field, main .forge-edit-media')) {
      setPageDirty();
    }
  };
  document.addEventListener('input', mark, true);
  document.addEventListener('keyup', mark, true);
  document.addEventListener('paste', mark, true);
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

/** DA write succeeded — never flash a red 401 for admin.hlx.page CDN lag. */
function showDaSuccessToast(baseMessage, result) {
  if (result?.hlxPreview?.ok && !result?.previewWarning) {
    showToast(baseMessage);
    return;
  }
  const cleaned = String(baseMessage || '')
    .replace(/\s*[—–-]\s*(refreshing|reloading).*$/i, '')
    .trim();
  const st = result?.hlxPreview?.status || result?.hlxPreview?.error;
  const note = st
    ? `CDN preview sync pending (${st}) — hard-refresh if the page looks stale.`
    : 'CDN preview sync pending — hard-refresh if the page looks stale.';
  showToast(`${cleaned}. ${note}`);
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

async function ensurePreviewRefreshed(result) {
  if (result?.hlxPreview?.ok) return result;
  const { org, repo } = resolveOrgRepo();
  const token = resolveDaToken();
  if (!org || !repo || !token) return result;
  try {
    const hlxPath = pagePathToHlxPath(currentPagePath());
    const hlx = await triggerHlxPreviewPath(org, repo, hlxPath, token);
    return {
      ...result,
      hlxPreview: hlx,
      previewWarning: hlx?.ok
        ? undefined
        : result?.previewWarning ||
          `CDN preview sync pending (${hlx?.status || hlx?.error || 'no auth'}) — Document Authoring already has your changes.`,
    };
  } catch {
    return result;
  }
}

/** Show the new block immediately when HLX CDN is stale (expired HLX token / 401). */
function injectBlockIntoDom(blockId, afterIndex, products = null) {
  const main = document.querySelector('main');
  if (!main) return false;
  const snippet = buildBlockSectionHtml(blockId, {
    brandName: productBrandName(),
    products: Array.isArray(products) ? products : undefined,
  });
  const wrap = document.createElement('div');
  wrap.innerHTML = String(snippet || '').trim();
  const section = wrap.firstElementChild;
  if (!section) return false;
  const sections = mainSections(main);
  if (afterIndex >= 0 && afterIndex < sections.length) {
    sections[afterIndex].after(section);
  } else if (sections.length) {
    sections[sections.length - 1].after(section);
  } else {
    main.append(section);
  }
  main.querySelectorAll('.forge-edit-drop-zone').forEach((z) => z.remove());
  scanAndDecorate();
  return true;
}

/** Remove a top-level main section so Delete is visible even when CDN preview lags. */
function removeSectionFromDom(sectionIndex) {
  const main = document.querySelector('main');
  if (!main) return false;
  const sections = mainSections(main);
  const section = sections[sectionIndex];
  if (!section) return false;
  const next = section.nextElementSibling;
  if (next?.classList?.contains('forge-edit-drop-zone')) next.remove();
  section.remove();
  main.querySelectorAll('.forge-edit-drop-zone').forEach((z) => z.remove());
  scanAndDecorate();
  return true;
}

function reloadAfterMutation(result) {
  const seg = getPreviewSegmentId();
  const go = () => {
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
  };
  // Give admin.hlx.page a moment to publish the DA snapshot to *.aem.page
  window.setTimeout(go, result?.hlxPreview?.ok ? 800 : 1600);
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

/**
 * forge-api POST init. Put IMS JWT in JSON `daToken` — never `X-Forge-Da-Token`.
 * Large Adobe tokens exceed App Builder/CloudFront header limits → HTTP 431.
 */
function forgeApiJsonInit(payload) {
  const daToken = resolveDaToken();
  const body = { ...payload };
  if (daToken) body.daToken = daToken;
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function forgeApiHttpError(data, res, label) {
  const status = res?.status || 0;
  const err = new Error(data?.error || data?.hint || `${label} (${status})`);
  err.needsToken = Boolean(data?.needsToken) || status === 401 || status === 403;
  err.headerTooLarge = status === 431;
  err.status = status;
  err.hint =
    data?.hint || (status === 431 ? 'Request headers too large — retrying via browser DA write' : '');
  return err;
}

async function insertBlockViaForgeApi(blockId, afterIndex, apiBase, products = null) {
  const { org, repo } = resolveOrgRepo();
  const res = await fetch(
    `${apiBase}/api/inline-edit/insert-block`,
    forgeApiJsonInit({
      org,
      repo,
      pagePath: currentPagePath(),
      blockId,
      afterIndex,
      brandName: productBrandName(),
      products: Array.isArray(products) ? products : undefined,
    }),
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw forgeApiHttpError(data, res, 'Insert failed');
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
      const apiResult = await insertBlockViaForgeApi(blockId, afterIndex, apiBase, products);
      if (apiResult?.ok) return apiResult;
      // Stale forge-api required class===blockId and false-failed hero/carousel/commerce
      // inserts with HTTP 200 + ok:false — fall back to browser DA write (snippet verify).
      const structureFail = /unexpected Document Authoring structure/i.test(
        String(apiResult?.error || ''),
      );
      if (structureFail || apiResult?.needsToken) {
        return insertBlockOnDaClientWithPrompt(blockId, afterIndex, products, {
          forcePrompt: Boolean(apiResult?.needsToken),
        });
      }
      throw new Error(apiResult?.error || apiResult?.hint || 'Insert failed');
    } catch (e) {
      // Stale forge-api DA_ADMIN_TOKEN / header 431 → browser write.
      const headerLimit =
        e?.headerTooLarge || e?.status === 431 || /\b431\b/.test(String(e?.message || ''));
      const authFail =
        e?.needsToken ||
        /DA write failed:\s*40[13]|DA token required|401|403/i.test(String(e?.message || ''));
      if (!authFail && !headerLimit) throw e;
      return insertBlockOnDaClientWithPrompt(blockId, afterIndex, products, {
        forcePrompt: Boolean(authFail),
      });
    }
  }

  return insertBlockOnDaClientWithPrompt(blockId, afterIndex, products);
}

async function deleteBlockViaForgeApi(sectionIndex, apiBase) {
  const { org, repo } = resolveOrgRepo();
  const res = await fetch(
    `${apiBase}/api/inline-edit/delete-block`,
    forgeApiJsonInit({
      org,
      repo,
      pagePath: currentPagePath(),
      sectionIndex,
    }),
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw forgeApiHttpError(data, res, 'Delete failed');
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
      const headerLimit =
        e?.headerTooLarge || e?.status === 431 || /\b431\b/.test(String(e?.message || ''));
      const authFail =
        e?.needsToken ||
        /DA write failed:\s*40[13]|DA token required|401|403/i.test(String(e?.message || ''));
      if (!authFail && !headerLimit) throw e;
      return deleteBlockOnDaClientWithPrompt(sectionIndex, { forcePrompt: Boolean(authFail) });
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
    `Delete “${label}”?\n\nRemoves the section on this page. Click Save page to persist to Document Authoring.`,
  );
  if (!ok) return;

  // Paint removal immediately — never reload here (CDN preview 401s bring the block back
  // and would clear dirty / leave Save disabled).
  const removedLocally = removeSectionFromDom(idx);
  if (!removedLocally) {
    showToast('Could not remove this component from the page', true);
    return;
  }

  // Always enable Save after Delete so save-page can persist the removal (and any other edits).
  setPageDirty();
  showToast(`Removed ${label} — click Save page to persist`);

  // Best-effort delete-block API (does not disable Save; does not reload).
  try {
    const result = await deleteBlock(idx);
    if (result?.ok || result?.previewUrl) {
      ensurePreviewRefreshed(result).catch(() => {});
    }
  } catch {
    /* Save page is the persistence path */
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
          let result = await insertBlock(id, afterIndex, products);
          if (!result?.ok && !result?.previewUrl) {
            throw new Error(result?.error || result?.hint || 'Insert failed — block was not saved');
          }
          result = await ensurePreviewRefreshed(result);
          backdrop.remove();
          const previewOk = Boolean(result?.hlxPreview?.ok);
          // Always paint the block into the live DOM so Add is visible even when
          // admin.hlx.page preview 401s (common with expired HLX_AUTH_TOKEN).
          const injected = injectBlockIntoDom(id, afterIndex, products);
          if (previewOk) {
            showToast(
              products?.length
                ? `Added ${meta?.label || id} with ${products.length} product${products.length === 1 ? '' : 's'} — reloading…`
                : `Added ${meta?.label || id} — reloading preview…`,
            );
            reloadAfterMutation(result);
          } else if (injected) {
            // Not a failed Add — DA write + on-page paint succeeded. CDN sync is separate.
            const st = result?.hlxPreview?.status || result?.hlxPreview?.error || '401';
            showToast(
              `Added ${meta?.label || id} (saved to Document Authoring). CDN sync pending (${st}) — hard-refresh may lag until HLX+DA tokens work on forge-api.`,
            );
          } else {
            showToast(
              result?.previewWarning ||
                `Saved ${meta?.label || id} to Document Authoring but could not update this page view.`,
              true,
            );
            reloadAfterMutation(result);
          }
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
  const res = await fetch(
    `${apiBase}/api/inline-edit/save-page`,
    forgeApiJsonInit({
      org,
      repo,
      pagePath: currentPagePath(),
      mainHtml,
    }),
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw forgeApiHttpError(data, res, 'Save failed');
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
        const headerLimit =
          e?.headerTooLarge || e?.status === 431 || /\b431\b/.test(String(e?.message || ''));
        const authFail =
          e?.needsToken || /401|403|DA token required|DA write failed/i.test(String(e?.message || ''));
        if (!authFail && !headerLimit) throw e;
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
    result = await ensurePreviewRefreshed(result);
    showDaSuccessToast(`Saved to Document Authoring${segNote} — refreshing preview…`, result);
    reloadAfterMutation(result);
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

  ensureDirtyTracking();
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
