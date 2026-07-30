/**
 * EDS block HTML snippets for inline-edit insert (Franklin section tables).
 * Commerce inserts bind real catalog products (Wolverine phone catalog by default).
 */

export const INLINE_EDIT_BLOCK_IDS = {
  content: ['hero', 'banner', 'cards', 'carousel', 'columns', 'fragment'],
  commerce: [
    'product-list',
    'product-carousel',
    'product-teaser',
    'product-detail',
    'forge-device-cards',
    'minicart',
    'checkout',
  ],
};

/** Blocks that should open the product picker before insert / replace. */
export const COMMERCE_PRODUCT_BLOCK_IDS = [
  'product-list',
  'product-carousel',
  'product-teaser',
  'product-detail',
  'forge-device-cards',
];

/** Fallback catalog when forge-api is unreachable (subset mirroring commerce-product-catalog). */
export const DEFAULT_PRODUCT_CATALOG = [
  {
    id: 'iphone-16e',
    sku: 'SKU-IPHONE-16E',
    name: 'Apple iPhone 16e',
    productType: 'configurable',
    catalogId: 'wolverine-phones',
    catalogName: 'Phones',
    parentSku: null,
    variantSkus: ['SKU-IPHONE-16E-128-BLK', 'SKU-IPHONE-16E-256-BLU'],
    attributes: { brand: 'Apple', category: 'phones', formFactor: 'bar', tier: 'standard' },
    price: 'From $0 with trade-in†',
    href: '/products/default',
    image:
      'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Apple iPhone 16e',
  },
  {
    id: 'sku-iphone-16e-128-blk',
    sku: 'SKU-IPHONE-16E-128-BLK',
    name: 'Apple iPhone 16e 128GB Black',
    productType: 'simple',
    catalogId: 'wolverine-phones',
    catalogName: 'Phones',
    parentSku: 'SKU-IPHONE-16E',
    variantSkus: [],
    attributes: { brand: 'Apple', category: 'phones', storage: '128GB', color: 'Black', tier: 'standard' },
    price: 'From $0 with trade-in†',
    href: '/products/default',
    image:
      'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Apple iPhone 16e 128GB Black',
  },
  {
    id: 'galaxy-s24',
    sku: 'SKU-GALAXY-S24',
    name: 'Samsung Galaxy S24',
    productType: 'configurable',
    catalogId: 'wolverine-phones',
    catalogName: 'Phones',
    parentSku: null,
    variantSkus: ['SKU-GALAXY-S24-128-BLK', 'SKU-GALAXY-S24-256-BLU'],
    attributes: { brand: 'Samsung', category: 'phones', formFactor: 'bar', tier: 'standard' },
    price: 'From $699',
    href: '/products/default',
    image:
      'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Samsung Galaxy S24',
  },
  {
    id: 'motorola-razr',
    sku: 'SKU-MOTOROLA-RAZR',
    name: 'Motorola Razr',
    productType: 'configurable',
    catalogId: 'wolverine-phones',
    catalogName: 'Phones',
    parentSku: null,
    variantSkus: ['SKU-MOTOROLA-RAZR-128-BLK', 'SKU-MOTOROLA-RAZR-256-BLU'],
    attributes: { brand: 'Motorola', category: 'phones', formFactor: 'foldable', tier: 'standard' },
    price: 'From $499.99',
    href: '/products/default',
    image:
      'https://images.unsplash.com/photo-1611470506606-972bf17395bb?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Motorola Razr foldable',
  },
  {
    id: 'moto-g-play',
    sku: 'SKU-MOTO-G-PLAY',
    name: 'Moto G Play',
    productType: 'configurable',
    catalogId: 'wolverine-phones',
    catalogName: 'Phones',
    parentSku: null,
    variantSkus: ['SKU-MOTO-G-PLAY-128-BLK', 'SKU-MOTO-G-PLAY-256-BLU'],
    attributes: { brand: 'Motorola', category: 'phones', formFactor: 'bar', tier: 'standard' },
    price: 'From $9.99',
    href: '/products/default',
    image:
      'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Moto G Play',
  },
  {
    id: 'plan-unlimited-plus',
    sku: 'PLAN-UNL-PLUS',
    name: 'Unlimited Plus',
    productType: 'plan',
    catalogId: 'wolverine-plans',
    catalogName: 'Plans',
    parentSku: null,
    variantSkus: ['PLAN-UNL-PLUS-1L', 'PLAN-UNL-PLUS-4L'],
    attributes: { brand: 'Wolverine', category: 'plans', data: 'unlimited', lines: 'multi' },
    price: 'From $60/mo',
    href: '/plans',
    image: 'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=900&q=80',
    imageAlt: 'Unlimited Plus plan',
  },
  {
    id: 'acc-usb-c-charger',
    sku: 'ACC-USBC-30W',
    name: '30W USB-C Charger',
    productType: 'accessory',
    catalogId: 'wolverine-accessories',
    catalogName: 'Accessories',
    parentSku: null,
    variantSkus: [],
    attributes: { brand: 'Wolverine', category: 'accessories', accessoryType: 'charger' },
    price: '$29.99',
    href: '/products/default',
    image: 'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?auto=format&fit=crop&w=900&q=80',
    imageAlt: '30W USB-C charger',
  },
];

export function listInsertableBlockIds() {
  return [...INLINE_EDIT_BLOCK_IDS.content, ...INLINE_EDIT_BLOCK_IDS.commerce];
}

export function getBlockCategory(blockId) {
  const id = normalizeBlockId(blockId);
  if (INLINE_EDIT_BLOCK_IDS.commerce.includes(id) || COMMERCE_PRODUCT_BLOCK_IDS.includes(id)) {
    return 'commerce';
  }
  if (INLINE_EDIT_BLOCK_IDS.content.includes(id)) return 'content';
  return 'default';
}

export function isCommerceProductBlock(blockId) {
  return COMMERCE_PRODUCT_BLOCK_IDS.includes(normalizeBlockId(blockId));
}

export function normalizeBlockId(blockId) {
  const raw = String(blockId || 'hero').trim().toLowerCase();
  if (raw === 'banner') return 'hero';
  if (raw === 'product-details') return 'product-detail';
  if (raw === 'commerce-cart') return 'minicart';
  if (raw === 'commerce-checkout') return 'checkout';
  if (raw === 'xwalk-phone-list' || raw === 'cards') return raw;
  return raw;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function normalizeProduct(p = {}) {
  const id = p.id || p.sku || p.slot || '';
  const sku = p.sku || id;
  const name = p.name || p.title || 'Product';
  const image = p.img || p.image || p.imageUrl || '';
  const attributes =
    p.attributes && typeof p.attributes === 'object' && !Array.isArray(p.attributes)
      ? { ...p.attributes }
      : {};
  return {
    id,
    sku,
    name,
    productType: p.productType || p.type || 'simple',
    catalogId: p.catalogId || p.catalog || 'wolverine-phones',
    catalogName: p.catalogName || '',
    parentSku: p.parentSku ?? null,
    variantSkus: Array.isArray(p.variantSkus) ? p.variantSkus : [],
    attributes,
    price: p.price || p.priceLabel || '',
    priceWas: p.priceWas || '',
    href: p.href || p.url || '/products/default',
    image,
    img: image,
    imageAlt: p.imageAlt || p.alt || name,
    slot: p.slot || id,
  };
}

export function resolveProductsForBlock(options = {}) {
  const incoming = Array.isArray(options.products) ? options.products.map(normalizeProduct) : [];
  if (incoming.length) return incoming;
  const fallback = Array.isArray(options.catalog) ? options.catalog.map(normalizeProduct) : DEFAULT_PRODUCT_CATALOG;
  return fallback.map(normalizeProduct);
}

function pictureHtml(product) {
  const src = product.img || product.image || '';
  const alt = product.imageAlt || product.name || '';
  if (!src) return '';
  return `<picture>
            <img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" data-forge-product-id="${escapeHtml(product.id || '')}" data-forge-sku="${escapeHtml(product.sku || '')}">
          </picture>`;
}

function productCardInner(product, ctaLabel = 'Shop now') {
  const p = normalizeProduct(product);
  const attrs = Object.entries(p.attributes || {})
    .filter(([k]) => /^[a-zA-Z0-9_-]+$/.test(k))
    .map(([k, v]) => `data-forge-attr-${k}="${escapeHtml(v)}"`)
    .join(' ');
  return `<div class="xwalk-phone-card"
          data-forge-product-id="${escapeHtml(p.id)}"
          data-forge-sku="${escapeHtml(p.sku)}"
          data-forge-product-type="${escapeHtml(p.productType)}"
          data-forge-catalog="${escapeHtml(p.catalogId)}"
          data-forge-parent-sku="${escapeHtml(p.parentSku || '')}"
          ${attrs}>
${pictureHtml(p)}
          <h3>${escapeHtml(p.name)}</h3>
          <p class="forge-product-sku"><code>${escapeHtml(p.sku)}</code> · ${escapeHtml(p.productType)}${p.parentSku ? ` · child of ${escapeHtml(p.parentSku)}` : ''}</p>
          <p><strong>${escapeHtml(p.price)}</strong></p>
          <p><strong><a href="${escapeHtml(p.href)}">${escapeHtml(ctaLabel)}</a></strong></p>
        </div>`;
}

/** Franklin cards row wrappers (matches Crosswalk forge-device-cards). */
function featuredCardsHtml(products) {
  return products
    .map(
      (p) => `      <div>
        ${productCardInner(p, 'Shop now')}
      </div>`,
    )
    .join('\n');
}

function phoneListHtml(brand, products) {
  const cards = products
    .map(
      (p) => `        ${productCardInner(p, 'View details')}`,
    )
    .join('\n');
  return `      <div class="xwalk-phone-list-header">
        <h2>All phones</h2>
        <p>Shop ${escapeHtml(brand)} devices — free shipping on every order.</p>
      </div>
      <div class="xwalk-phone-list-grid">
${cards}
      </div>`;
}

function productDetailHtml(product) {
  const p = normalizeProduct(product);
  return `      <div class="xwalk-phone-card forge-product-detail"
        data-forge-product-id="${escapeHtml(p.id)}"
        data-forge-sku="${escapeHtml(p.sku)}"
        data-forge-product-type="${escapeHtml(p.productType)}"
        data-forge-catalog="${escapeHtml(p.catalogId)}"
        data-forge-parent-sku="${escapeHtml(p.parentSku || '')}"
        data-key="${escapeHtml(p.sku || p.id)}">
${pictureHtml(p)}
        <h2>${escapeHtml(p.name)}</h2>
        <p class="forge-product-sku"><code>${escapeHtml(p.sku)}</code> · ${escapeHtml(p.productType)}${p.parentSku ? ` · child of ${escapeHtml(p.parentSku)}` : ''}</p>
        <p><strong>${escapeHtml(p.price)}</strong></p>
        <p>Product detail — edit copy, image, and ADA alt in place.</p>
        <p><strong><a href="${escapeHtml(p.href)}">Add to cart</a></strong></p>
      </div>`;
}

/**
 * Build section HTML for DA insert.
 * @param {string} blockId
 * @param {{ brandName?: string, products?: object[], catalog?: object[] }} options
 */
export function buildBlockSectionHtml(blockId, options = {}) {
  const brand = options.brandName || 'Your brand';
  const id = normalizeBlockId(blockId);
  const products = resolveProductsForBlock(options);

  switch (id) {
    case 'hero':
      return `<div>
  <div>
    <h2>${escapeHtml(brand)}</h2>
    <p>Hero banner — edit in Document Authoring.</p>
    <p><strong><a href="/products/">Shop now</a></strong></p>
  </div>
</div>
`;
    case 'cards':
      return `<div>
  <div class="cards">
    <div>
      <div>
        <h3>Card one</h3>
        <p>Feature or promo copy.</p>
      </div>
    </div>
    <div>
      <div>
        <h3>Card two</h3>
        <p>Feature or promo copy.</p>
      </div>
    </div>
  </div>
</div>
`;
    case 'carousel':
      return `<div>
  <div class="cards">
    <div>
      <div>
        <h3>Carousel slide</h3>
        <p>Carousel row — style as carousel in blocks CSS.</p>
      </div>
    </div>
  </div>
</div>
`;
    case 'columns':
      return `<div>
  <div class="columns">
    <div>
      <div>
        <h3>Column A</h3>
        <p>Two-column content.</p>
      </div>
      <div>
        <h3>Column B</h3>
        <p>Two-column content.</p>
      </div>
    </div>
  </div>
</div>
`;
    case 'fragment':
      return `<div>
  <div class="fragment">
    <div><a href="/footer">Load fragment</a></div>
  </div>
</div>
`;
    case 'product-teaser':
    case 'forge-device-cards': {
      const picks = products.slice(0, Math.max(1, Math.min(4, products.length || 4)));
      return `<div>
  <div class="cards forge-device-cards" data-forge-commerce="1" data-forge-product-ids="${escapeHtml(picks.map((p) => p.id).join(','))}">
${featuredCardsHtml(picks)}
  </div>
</div>
`;
    }
    case 'product-carousel':
    case 'product-list':
    case 'xwalk-phone-list': {
      const picks = products.length ? products : DEFAULT_PRODUCT_CATALOG;
      return `<div>
  <div class="cards xwalk-phone-list" data-forge-commerce="1" data-forge-product-ids="${escapeHtml(picks.map((p) => p.id).join(','))}">
    <div>
${phoneListHtml(brand, picks)}
    </div>
  </div>
</div>
`;
    }
    case 'product-detail': {
      const pick = products[0] || DEFAULT_PRODUCT_CATALOG[0];
      return `<div>
  <div class="product-detail" data-forge-commerce="1" data-forge-product-ids="${escapeHtml(pick.id)}" data-key="${escapeHtml(pick.sku || pick.id)}">
    <div>
${productDetailHtml(pick)}
    </div>
  </div>
</div>
`;
    }
    case 'minicart':
      return `<div>
  <div class="minicart" data-forge-commerce="1"></div>
</div>
`;
    case 'checkout':
      return `<div>
  <div class="checkout" data-forge-commerce="1"></div>
</div>
`;
    default:
      return buildBlockSectionHtml('hero', options);
  }
}

/**
 * Inner HTML used when replacing products on an existing live commerce block.
 */
export function buildCommerceBlockInnerHtml(blockId, products, options = {}) {
  const brand = options.brandName || 'Your brand';
  const id = normalizeBlockId(blockId);
  const picks = (products || []).map(normalizeProduct);
  if (id === 'product-detail') {
    return `<div>${productDetailHtml(picks[0] || DEFAULT_PRODUCT_CATALOG[0])}</div>`;
  }
  if (id === 'product-teaser' || id === 'forge-device-cards') {
    return featuredCardsHtml(picks);
  }
  return `<div>${phoneListHtml(brand, picks)}</div>`;
}
