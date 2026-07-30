/**
 * Commerce product picker + apply helpers for FORGE inline edit.
 * Supports browse/filter by: sku, attribute, catalog, parent/child, type.
 */
import {
  COMMERCE_PRODUCT_BLOCK_IDS,
  DEFAULT_PRODUCT_CATALOG,
  buildCommerceBlockInnerHtml,
  isCommerceProductBlock,
  normalizeBlockId,
  normalizeProduct,
} from './forge-inline-edit-blocks.js';

export { COMMERCE_PRODUCT_BLOCK_IDS, isCommerceProductBlock };

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildFacetsFromProducts(products) {
  const productTypes = new Set();
  const catalogs = new Map();
  const attributeKeys = new Set();
  const attributeValues = {};
  const parents = new Map();
  for (const raw of products) {
    const p = normalizeProduct(raw);
    if (p.productType) productTypes.add(p.productType);
    if (p.catalogId) catalogs.set(p.catalogId, p.catalogName || p.catalogId);
    if (!p.parentSku) parents.set(p.sku, p.name);
    for (const [k, v] of Object.entries(p.attributes || {})) {
      attributeKeys.add(k);
      if (!attributeValues[k]) attributeValues[k] = new Set();
      attributeValues[k].add(String(v));
    }
  }
  return {
    productTypes: [...productTypes].sort(),
    catalogs: [...catalogs.entries()].map(([id, name]) => ({ id, name })),
    attributeKeys: [...attributeKeys].sort(),
    attributeValues: Object.fromEntries(
      Object.entries(attributeValues).map(([k, set]) => [k, [...set].sort()]),
    ),
    parents: [...parents.entries()].map(([sku, name]) => ({ sku, name })),
  };
}

/** Client-side filter mirroring server/commerce-product-catalog.js */
export function filterProductsLocal(products, query = {}) {
  const q = String(query.q || '').trim().toLowerCase();
  const sku = String(query.sku || '').trim().toLowerCase();
  const catalogId = String(query.catalogId || '').trim();
  const productType = String(query.productType || '').trim().toLowerCase();
  const parentSku = query.parentSku != null ? String(query.parentSku).trim() : '';
  const attrKey = String(query.attribute || '').trim();
  const attrVal = String(query.attributeValue || '').trim().toLowerCase();

  return products.filter((raw) => {
    const p = normalizeProduct(raw);
    if (sku && !(String(p.sku).toLowerCase().includes(sku) || String(p.id).toLowerCase().includes(sku))) {
      return false;
    }
    if (catalogId && p.catalogId !== catalogId) return false;
    if (productType && String(p.productType).toLowerCase() !== productType) return false;
    if (parentSku === '__parents__') {
      if (p.parentSku) return false;
    } else if (parentSku === '__children__') {
      if (!p.parentSku) return false;
    } else if (parentSku) {
      if (
        String(p.parentSku || '').toLowerCase() !== parentSku.toLowerCase() &&
        String(p.sku || '').toLowerCase() !== parentSku.toLowerCase()
      ) {
        return false;
      }
    }
    if (attrKey && attrVal) {
      if (String(p.attributes?.[attrKey] ?? '').toLowerCase() !== attrVal) return false;
    }
    if (q) {
      const hay = [
        p.sku,
        p.id,
        p.name,
        p.productType,
        p.catalogId,
        p.catalogName,
        p.parentSku,
        ...(p.variantSkus || []),
        ...Object.entries(p.attributes || {}).flatMap(([k, v]) => [k, v]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/**
 * Load product catalog from forge-api, falling back to bundled demo catalog.
 */
export async function fetchProductCatalog(apiBase = '', query = {}) {
  const base = String(apiBase || '').replace(/\/$/, '');
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query || {})) {
    if (v != null && String(v).trim() !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  const url = `${base ? `${base}/api/inline-edit/product-catalog` : '/api/inline-edit/product-catalog'}${qs ? `?${qs}` : ''}`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.products) && data.products.length) {
        return {
          products: data.products.map(normalizeProduct),
          source: data.source || 'api',
          catalogs: data.catalogs || [],
          facets: data.facets || buildFacetsFromProducts(data.products),
          count: data.count,
          total: data.total,
        };
      }
    }
  } catch {
    /* fallback */
  }
  const products = DEFAULT_PRODUCT_CATALOG.map(normalizeProduct);
  return {
    products: filterProductsLocal(products, query),
    source: 'bundled',
    catalogs: [
      { id: 'wolverine-phones', name: 'Phones' },
      { id: 'wolverine-plans', name: 'Plans' },
      { id: 'wolverine-accessories', name: 'Accessories' },
    ],
    facets: buildFacetsFromProducts(products),
    count: products.length,
    total: products.length,
  };
}

export function readSelectedProductIds(blockEl) {
  if (!blockEl) return [];
  const attr = blockEl.getAttribute('data-forge-product-ids') || '';
  if (attr.trim()) return attr.split(',').map((s) => s.trim()).filter(Boolean);
  return [...blockEl.querySelectorAll('[data-forge-product-id], [data-forge-sku]')]
    .map((n) => n.getAttribute('data-forge-product-id') || n.getAttribute('data-forge-sku'))
    .filter(Boolean);
}

function productMetaLine(p) {
  const bits = [`SKU ${p.sku}`, p.productType];
  if (p.catalogName || p.catalogId) bits.push(p.catalogName || p.catalogId);
  if (p.parentSku) bits.push(`child of ${p.parentSku}`);
  else if (p.variantSkus?.length) bits.push(`${p.variantSkus.length} variants`);
  const attrs = Object.entries(p.attributes || {})
    .slice(0, 3)
    .map(([k, v]) => `${k}:${v}`);
  if (attrs.length) bits.push(attrs.join(' · '));
  return bits.join(' · ');
}

/**
 * Multi-select product picker with sku / attribute / catalog / parent-child / type filters.
 * @returns {Promise<object[]|null>}
 */
export function openProductPicker({
  products = DEFAULT_PRODUCT_CATALOG,
  facets = null,
  catalogs = null,
  selectedIds = null,
  title = 'Choose commerce products',
  multi = true,
  min = 1,
} = {}) {
  return new Promise((resolve) => {
    document.querySelector('.forge-edit-product-picker-backdrop')?.remove();

    const all = products.map(normalizeProduct);
    const facetData = facets || buildFacetsFromProducts(all);
    const catalogOpts = catalogs?.length
      ? catalogs
      : facetData.catalogs || [...new Set(all.map((p) => p.catalogId))].map((id) => ({ id, name: id }));

    const initial = new Set(
      Array.isArray(selectedIds) && selectedIds.length
        ? selectedIds
        : all
            .filter((p) => !p.parentSku)
            .map((p) => p.id || p.sku)
            .slice(0, multi ? Math.min(4, all.length) : 1),
    );

    const state = {
      q: '',
      sku: '',
      catalogId: '',
      productType: '',
      parentSku: '',
      attribute: '',
      attributeValue: '',
    };

    const backdrop = document.createElement('div');
    backdrop.className = 'forge-edit-dialog-backdrop forge-edit-product-picker-backdrop';
    const dialog = document.createElement('div');
    dialog.className = 'forge-edit-dialog forge-edit-product-picker';
    dialog.innerHTML = `
      <header>${escapeHtml(title)}</header>
      <div class="dialog-body">
        <p class="forge-edit-product-picker__intro">
          Filter by <strong>SKU</strong>, <strong>attribute</strong>, <strong>catalog</strong>,
          <strong>parent/child</strong>, and <strong>type</strong>, then select products for this commerce component.
        </p>
        <div class="forge-edit-product-filters" aria-label="Product filters">
          <label>Search
            <input type="search" name="q" placeholder="Name, SKU, attribute…" autocomplete="off" />
          </label>
          <label>SKU
            <input type="text" name="sku" placeholder="SKU-…" autocomplete="off" />
          </label>
          <label>Catalog
            <select name="catalogId">
              <option value="">All catalogs</option>
              ${catalogOpts.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name || c.id)}</option>`).join('')}
            </select>
          </label>
          <label>Type
            <select name="productType">
              <option value="">All types</option>
              ${(facetData.productTypes || []).map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}
            </select>
          </label>
          <label>Parent / child
            <select name="parentSku">
              <option value="">All relationships</option>
              <option value="__parents__">Parents only (configurable / plan)</option>
              <option value="__children__">Children / variants only</option>
              ${(facetData.parents || [])
                .map((p) => `<option value="${escapeHtml(p.sku)}">Children of ${escapeHtml(p.name)} (${escapeHtml(p.sku)})</option>`)
                .join('')}
            </select>
          </label>
          <label>Attribute
            <select name="attribute">
              <option value="">Any attribute</option>
              ${(facetData.attributeKeys || []).map((k) => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join('')}
            </select>
          </label>
          <label>Attribute value
            <select name="attributeValue" disabled>
              <option value="">Select attribute first</option>
            </select>
          </label>
        </div>
        <div class="forge-edit-product-picker__count" aria-live="polite"></div>
        <div class="forge-edit-product-grid" role="group" aria-label="Product catalog"></div>
      </div>
      <footer>
        <button type="button" data-action="cancel">Cancel</button>
        <button type="button" class="primary" data-action="apply">Apply products</button>
      </footer>
    `;

    const grid = dialog.querySelector('.forge-edit-product-grid');
    const countEl = dialog.querySelector('.forge-edit-product-picker__count');
    const attrSelect = dialog.querySelector('select[name="attribute"]');
    const attrValSelect = dialog.querySelector('select[name="attributeValue"]');

    function syncAttrValues() {
      const key = attrSelect.value;
      attrValSelect.innerHTML = '';
      if (!key) {
        attrValSelect.disabled = true;
        attrValSelect.innerHTML = '<option value="">Select attribute first</option>';
        state.attribute = '';
        state.attributeValue = '';
        return;
      }
      attrValSelect.disabled = false;
      const vals = facetData.attributeValues?.[key] || [];
      attrValSelect.innerHTML =
        '<option value="">Any value</option>' +
        vals.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
      state.attribute = key;
      state.attributeValue = '';
    }

    function renderGrid() {
      const filtered = filterProductsLocal(all, state);
      countEl.textContent = `Showing ${filtered.length} of ${all.length} products`;
      grid.innerHTML = '';
      if (!filtered.length) {
        grid.innerHTML = '<p class="forge-edit-product-picker__empty">No products match these filters.</p>';
        return;
      }
      for (const p of filtered) {
        const id = p.id || p.sku;
        const checked =
          initial.has(id) || initial.has(p.sku) || [...initial].some((x) => x === id || x === p.sku);
        const card = document.createElement('label');
        card.className = 'forge-edit-product-card';
        card.innerHTML = `
          <input type="${multi ? 'checkbox' : 'radio'}" name="forgeProductPick" value="${escapeHtml(id)}" ${checked ? 'checked' : ''} />
          <span class="forge-edit-product-card__media">
            ${p.image || p.img ? `<img src="${escapeHtml(p.img || p.image)}" alt="" />` : ''}
          </span>
          <span class="forge-edit-product-card__meta">
            <strong>${escapeHtml(p.name || id)}</strong>
            <span>${escapeHtml(p.price || '')}</span>
            <span class="forge-edit-product-card__dims">${escapeHtml(productMetaLine(p))}</span>
          </span>
        `;
        grid.append(card);
      }
    }

    dialog.querySelectorAll('.forge-edit-product-filters input, .forge-edit-product-filters select').forEach((el) => {
      el.addEventListener('input', () => {
        const name = el.getAttribute('name');
        if (!name) return;
        if (name === 'attribute') {
          syncAttrValues();
        } else {
          state[name] = el.value;
        }
        renderGrid();
      });
      el.addEventListener('change', () => {
        const name = el.getAttribute('name');
        if (!name) return;
        if (name === 'attribute') syncAttrValues();
        else state[name] = el.value;
        renderGrid();
      });
    });

    const finish = (value) => {
      backdrop.remove();
      resolve(value);
    };

    dialog.querySelector('[data-action="cancel"]')?.addEventListener('click', () => finish(null));
    dialog.querySelector('[data-action="apply"]')?.addEventListener('click', () => {
      const checked = [...dialog.querySelectorAll('input[name="forgeProductPick"]:checked')].map((el) => el.value);
      if (checked.length < min) {
        window.alert(`Select at least ${min} product${min === 1 ? '' : 's'}.`);
        return;
      }
      const selected = all.filter((p) => checked.includes(p.id) || checked.includes(p.sku));
      finish(selected);
    });
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) finish(null);
    });

    backdrop.append(dialog);
    document.body.append(backdrop);
    renderGrid();
  });
}

/**
 * Replace product cards inside an existing commerce block and mark dirty.
 */
export function applyProductsToCommerceBlock(blockEl, products, { brandName = 'Your brand', blockId } = {}) {
  if (!blockEl || !products?.length) return false;
  const id = normalizeBlockId(blockId || blockEl.dataset.forgeBlockId || 'product-list');
  const normalized = products.map(normalizeProduct);
  const ids = normalized.map((p) => p.id || p.sku).filter(Boolean);
  const skus = normalized.map((p) => p.sku).filter(Boolean);
  blockEl.setAttribute('data-forge-commerce', '1');
  blockEl.setAttribute('data-forge-product-ids', ids.join(','));
  blockEl.setAttribute('data-forge-skus', skus.join(','));

  let host = blockEl;
  if (
    blockEl.classList.contains('cards') ||
    blockEl.classList.contains('product-detail') ||
    blockEl.classList.contains('product-list')
  ) {
    host = blockEl;
  } else {
    host =
      blockEl.querySelector(
        '.cards.forge-device-cards, .cards.xwalk-phone-list, .product-detail, .product-list, .forge-device-cards, .xwalk-phone-list',
      ) || blockEl;
  }

  if (id === 'product-teaser' || id === 'forge-device-cards') {
    host.classList.add('cards', 'forge-device-cards');
    host.classList.remove('xwalk-phone-list', 'product-list');
  } else if (id === 'product-detail') {
    host.classList.add('product-detail');
  } else {
    host.classList.add('cards', 'xwalk-phone-list');
    host.classList.remove('forge-device-cards', 'product-list');
  }

  host.innerHTML = buildCommerceBlockInnerHtml(id, normalized, { brandName });
  host.setAttribute('data-forge-product-ids', ids.join(','));
  host.setAttribute('data-forge-skus', skus.join(','));
  if (id === 'product-detail' && normalized[0]) {
    host.setAttribute('data-key', normalized[0].sku || normalized[0].id);
    host.setAttribute('data-forge-sku', normalized[0].sku || '');
    host.setAttribute('data-forge-product-type', normalized[0].productType || '');
    host.setAttribute('data-forge-catalog', normalized[0].catalogId || '');
    host.setAttribute('data-forge-parent-sku', normalized[0].parentSku || '');
  }
  return true;
}

export function blockNeedsProductPicker(blockId) {
  return isCommerceProductBlock(blockId);
}
