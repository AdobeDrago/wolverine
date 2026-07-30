/**
 * FORGE inline editing on EDS preview sites (*.aem.page).
 * Edit text, links, and images on the page; save to Document Authoring. No Universal Editor.
 */

import { insertBlockOnDaPageClient } from './forge-inline-edit-da.js';
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
  initPersonalizationOnBlock,
  mountPreviewJourneyControl,
  mountPreviewSegmentControl,
  openPersonalizationPanel,
  setClassifyBlockMeta,
  syncVariantVisibility,
  updatePersonalizationBadge,
} from './forge-inline-edit-personalization.js';
import { savePageToDaClient } from './forge-inline-edit-save.js';

/** Bump when deploying; cache-busts HLX/CDN for Chrome. */
export const FORGE_INLINE_EDIT_BUILD = 17;

const FORGE_EDIT_PARAM = 'forge-edit';
const FORGE_ORG_PARAM = 'forge-org';
const FORGE_REPO_PARAM = 'forge-repo';
const FORGE_API_PARAM = 'forge-api';

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
  return { org, repo };
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
  return '';
}

function resolveDaToken() {
  try {
    return sessionStorage.getItem('forge_da_token') || localStorage.getItem('forge_da_token') || '';
  } catch {
    return '';
  }
}

function storeDaToken(token) {
  const t = String(token || '').trim();
  if (!t) return;
  try {
    sessionStorage.setItem('forge_da_token', t);
  } catch {
    /* ignore */
  }
}

/** Singleton — never stack two Document Authoring sign-in dialogs. */
let daTokenPromptPromise = null;

function promptDaToken() {
  if (daTokenPromptPromise) return daTokenPromptPromise;
  daTokenPromptPromise = new Promise((resolve) => {
    document.querySelectorAll('.forge-edit-token-backdrop').forEach((n) => n.remove());
    const backdrop = document.createElement('div');
    backdrop.className = 'forge-edit-dialog-backdrop forge-edit-token-backdrop';
    const dialog = document.createElement('div');
    dialog.className = 'forge-edit-dialog forge-edit-token-dialog';
    dialog.innerHTML = `
      <header>Document Authoring sign-in</header>
      <div class="dialog-body">
        <p>
          Paste your <strong>da.live</strong> IMS token (<code>tokenValue</code> from localStorage, starts with <code>eyJ</code>),
          or open <a href="https://da.live" target="_blank" rel="noopener">da.live</a> in this browser and sign in, then retry.
        </p>
        <input type="password" id="forgeDaTokenField" placeholder="eyJ…" autocomplete="off" />
      </div>
      <footer>
        <button type="button" data-action="cancel">Cancel</button>
        <button type="button" class="primary" data-action="save">Save token</button>
      </footer>
    `;
    backdrop.append(dialog);
    document.body.append(backdrop);
    const field = dialog.querySelector('#forgeDaTokenField');
    field?.focus();
    const finish = (val) => {
      daTokenPromptPromise = null;
      backdrop.remove();
      resolve(val);
    };
    dialog.querySelector('[data-action="cancel"]')?.addEventListener('click', () => finish(''));
    dialog.querySelector('[data-action="save"]')?.addEventListener('click', () => {
      const val = field?.value?.trim() || '';
      if (val) storeDaToken(val);
      finish(val);
    });
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
  } catch {
    /* ignore */
  }
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
    <button type="button" class="forge-edit-banner__ada-score" title="ADA compliance">ADA —</button>
    <button type="button" class="forge-edit-banner__save" disabled>Save page</button>
    <span class="forge-edit-banner__hint">Click image → ADA alt · Double-click link → accessible name</span>`;
  document.body.prepend(bar);
  document.documentElement.classList.add('forge-edit-active');
  bar.querySelector('.forge-edit-banner__save')?.addEventListener('click', () => savePage());
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
  mountPreviewSegmentControl(bar);
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
  instrumentEditableFields(el, { onDirty: setPageDirty });
  if (el.hasAttribute('data-forge-personalization')) {
    initPersonalizationOnBlock(el, meta, { onDirty: setPageDirty, classify: classifyBlock });
  }
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
    throw new Error('DA token required — sign in on da.live or paste tokenValue');
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
    showToast('Missing org/repo — add forge-org and forge-repo query params', true);
    return null;
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
          backdrop.remove();
          showToast(
            products?.length
              ? `Added ${meta?.label || id} with ${products.length} product${products.length === 1 ? '' : 's'} — reloading…`
              : `Added ${meta?.label || id} — reloading preview…`,
          );
          if (result?.previewUrl) {
            window.location.href = result.previewUrl;
          } else {
            window.location.reload();
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

  let token = resolveDaToken();
  if (!token) token = await promptDaToken();
  if (!token) return;

  const btn = document.querySelector('.forge-edit-banner__save');
  saveInFlight = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Saving…';
  }

  try {
    const result = await savePageToDaClient({
      org,
      repo,
      pagePath: currentPagePath(),
      token,
      mainEl: document.querySelector('main'),
    });
    if (!result.ok) {
      if (result.needsToken) {
        const retry = await promptDaToken();
        if (retry) {
          saveInFlight = false;
          storeDaToken(retry);
          return savePage();
        }
      }
      throw new Error(result.error || 'Save failed');
    }
    pageDirty = false;
    btn?.classList.remove('forge-edit-banner__save--dirty');
    showToast('Saved to Document Authoring — refreshing preview…');
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
    targetEl?.closest?.('a[href]');
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
