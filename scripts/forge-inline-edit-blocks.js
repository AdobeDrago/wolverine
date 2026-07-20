/**
 * EDS block HTML snippets for inline-edit insert (Franklin section tables).
 * Matches FORGE generateDAPageHtml structure.
 */

export const INLINE_EDIT_BLOCK_IDS = {
  content: ['hero', 'banner', 'cards', 'carousel', 'columns', 'fragment'],
  commerce: ['product-list', 'product-carousel', 'product-teaser', 'product-detail', 'minicart', 'checkout'],
};

export function listInsertableBlockIds() {
  return [...INLINE_EDIT_BLOCK_IDS.content, ...INLINE_EDIT_BLOCK_IDS.commerce];
}

export function getBlockCategory(blockId) {
  if (INLINE_EDIT_BLOCK_IDS.commerce.includes(blockId)) return 'commerce';
  if (INLINE_EDIT_BLOCK_IDS.content.includes(blockId)) return 'content';
  return 'default';
}

export function buildBlockSectionHtml(blockId, options = {}) {
  const brand = options.brandName || 'Your brand';
  const raw = String(blockId || 'hero').trim().toLowerCase();
  const id = raw === 'banner' ? 'hero' : raw === 'product-carousel' || raw === 'product-teaser' ? 'product-list' : raw;

  switch (id) {
    case 'hero':
      return `<div>
  <div>
    <h2>${brand}</h2>
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
    case 'product-list':
      return `<div>
  <div class="product-list">
    <div>
      <h2>Products</h2>
      <p>Commerce product grid.</p>
    </div>
  </div>
</div>
`;
    case 'product-detail':
      return `<div>
  <div class="product-detail">
    <div>
      <h2>Product detail</h2>
      <p>Commerce PDP placeholder.</p>
    </div>
  </div>
</div>
`;
    case 'minicart':
      return `<div>
  <div class="minicart"></div>
</div>
`;
    case 'checkout':
      return `<div>
  <div class="checkout"></div>
</div>
`;
    default:
      return buildBlockSectionHtml('hero', options);
  }
}
