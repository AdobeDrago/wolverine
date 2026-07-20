/**
 * Boost retail layout + hero fixes when HLX strips classes / personalization attrs.
 */

function tagDealCardInternals(card) {
  const root = card.querySelector('.default-content-wrapper') || card;
  const firstP = root.querySelector(':scope > p');
  if (firstP && !firstP.classList.contains('xwalk-deal-badge')) {
    firstP.classList.add('xwalk-deal-badge');
  }
  const picture = root.querySelector('picture');
  if (picture?.parentElement?.tagName === 'P') {
    const media = document.createElement('div');
    media.className = 'xwalk-deal-media';
    picture.parentElement.replaceWith(media);
    media.appendChild(picture);
  }
  root.querySelectorAll('a').forEach((a) => {
    if (/get the deal/i.test(a.textContent || '')) {
      a.classList.add('xwalk-deal-cta');
      a.closest('p')?.classList.add('xwalk-deal-cta-wrap');
    }
  });
}

function splitFlatDealSection(section) {
  const dealCtas = [...section.querySelectorAll('a')].filter((a) =>
    /get the deal/i.test(a.textContent || ''),
  );
  if (dealCtas.length < 2 || section.querySelector('.xwalk-deal-card')) return false;

  const groups = [];
  let batch = [];
  for (const el of [...section.children]) {
    batch.push(el);
    const hasCta = [...el.querySelectorAll('a')].some((a) =>
      /get the deal/i.test(a.textContent || ''),
    );
    if (hasCta) {
      groups.push(batch);
      batch = [];
    }
  }
  if (batch.length) groups.push(batch);
  if (groups.length < 2) return false;

  const row = document.createElement('div');
  groups.slice(0, 4).forEach((nodes) => {
    const col = document.createElement('div');
    const card = document.createElement('div');
    card.className = 'xwalk-deal-card';
    nodes.forEach((n) => card.appendChild(n));
    tagDealCardInternals(card);
    col.appendChild(card);
    row.appendChild(col);
  });

  section.replaceChildren(row);
  section.classList.add('columns', 'xwalk-boost-deals');
  return true;
}

/** HLX shows every personalization variant when data-forge-* is stripped — keep last h1 stack. */
function collapseDuplicateHero(section) {
  const h1s = [...section.querySelectorAll(':scope > h1')];
  if (h1s.length <= 1) return;
  const keep = h1s[h1s.length - 1];
  let anchor = keep;
  while (anchor.previousElementSibling) {
    anchor = anchor.previousElementSibling;
    if (anchor.querySelector('picture')) break;
  }
  while (section.firstChild && section.firstChild !== anchor) {
    section.firstChild.remove();
  }
}

function fixHeroBackground(section) {
  if (section.querySelector('.xwalk-hero-bg')) return;
  const picP = section.querySelector(':scope > p:has(picture)');
  if (!picP) return;
  const bg = document.createElement('div');
  bg.className = 'xwalk-hero-bg';
  const picture = picP.querySelector('picture');
  if (picture) {
    picP.replaceWith(bg);
    bg.appendChild(picture);
  }
}

function decorateHeroSections(main) {
  const sections = [...main.children].filter((el) => el.tagName === 'DIV');
  sections.forEach((section) => {
    if (section.querySelector('#save-when-you-shop-online')) {
      section.classList.add('xwalk-retail-hero');
      return;
    }
    if (section.querySelector('[id*="shop-phones"]')) {
      section.classList.add('xwalk-phones-head');
      return;
    }
    if (!section.querySelector(':scope > h1') || section.querySelector(':scope > h3')) return;
    if (section.querySelector('a') && /get the deal/i.test(section.textContent || '')) return;

    collapseDuplicateHero(section);
    fixHeroBackground(section);
    section.classList.add('xwalk-hero-section');
  });
}

/** HLX strips xwalk-footer-* classes from footer.html — rebuild Boost grid in the DOM. */
function paintFooterSocialLink(a) {
  const icons = { Facebook: 'f', X: 'X', Instagram: 'ig', YouTube: '▶' };
  const href = a.getAttribute('href') || '';
  const label = (a.getAttribute('aria-label') || a.textContent || '').trim();
  let key = Object.keys(icons).find((k) => label.toLowerCase().includes(k.toLowerCase()));
  if (!key && /facebook/i.test(href)) key = 'Facebook';
  if (!key && /twitter|x\.com/i.test(href)) key = 'X';
  if (!key && /instagram/i.test(href)) key = 'Instagram';
  if (!key && /youtube/i.test(href)) key = 'YouTube';
  const glyph = key ? icons[key] : label.slice(0, 2) || '•';
  if (key) a.setAttribute('aria-label', key);
  a.innerHTML = `<span aria-hidden="true">${glyph}</span>`;
}

function styleFooterTop(top) {
  top.style.cssText =
    'display:grid;grid-template-columns:1fr auto;align-items:start;gap:24px 40px;padding:32px 0 28px;width:100%;box-sizing:border-box;';
  const social = top.querySelector('.xwalk-footer-top-social');
  if (social) social.style.textAlign = 'right';
  const ul = top.querySelector('ul');
  if (ul) {
    ul.style.cssText =
      'display:flex;flex-wrap:wrap;justify-content:flex-end;gap:10px;list-style:none;padding:0;margin:0;';
    ul.querySelectorAll('a').forEach(paintFooterSocialLink);
  }
}

function decorateFooterLayout(doc = document) {
  const foot = doc.querySelector('footer .footer');
  if (!foot || foot.dataset.xwalkFooterDecorated) return;

  const sections = [...foot.querySelectorAll(':scope > div > .section')];
  if (sections.length < 2) return;

  const topWrap = sections[0]?.querySelector('.default-content-wrapper');
  if (topWrap && !topWrap.querySelector('.xwalk-footer-top')) {
    const top = doc.createElement('div');
    top.className = 'xwalk-footer-top';
    const brand = doc.createElement('div');
    brand.className = 'xwalk-footer-top-brand';
    const social = doc.createElement('div');
    social.className = 'xwalk-footer-top-social';
    const kids = [...topWrap.children];
    kids.slice(0, 3).forEach((n) => brand.appendChild(n));
    kids.slice(3).forEach((n) => social.appendChild(n));
    top.append(brand, social);
    topWrap.replaceChildren(top);
    styleFooterTop(top);
  } else {
    const top = topWrap.querySelector('.xwalk-footer-top');
    if (top) styleFooterTop(top);
  }

  const colsWrap = sections[1]?.querySelector('.default-content-wrapper');
  if (colsWrap && !colsWrap.querySelector('.xwalk-footer-columns')) {
    const row = doc.createElement('div');
    row.className = 'xwalk-footer-columns';
    const kids = [...colsWrap.children];
    for (let i = 0; i < kids.length; i += 2) {
      const col = doc.createElement('div');
      col.className = 'xwalk-footer-col';
      if (kids[i]) col.appendChild(kids[i]);
      if (kids[i + 1]) col.appendChild(kids[i + 1]);
      row.appendChild(col);
    }
    colsWrap.replaceChildren(row);
  }

  const legalWrap = sections[2]?.querySelector('.default-content-wrapper');
  if (legalWrap && !legalWrap.querySelector('.xwalk-footer-legal')) {
    const legal = doc.createElement('div');
    legal.className = 'xwalk-footer-legal';
    [...legalWrap.children].forEach((n) => legal.appendChild(n));
    legalWrap.replaceChildren(legal);
  }

  doc.documentElement.classList.add('xwalk-footer-boost-ready');
  foot.dataset.xwalkFooterDecorated = '1';
}

function observeAsyncFooter(doc = document) {
  if (doc.documentElement.classList.contains('xwalk-footer-boost-ready')) return;

  const tryFooter = () => decorateFooterLayout(doc);

  doc.addEventListener('aem:loaded', tryFooter);

  const watchBlock = (block) => {
    if (!block || block.dataset.xwalkFooterObserved) return;
    block.dataset.xwalkFooterObserved = '1';
    if (block.getAttribute('data-block-status') === 'loaded') {
      tryFooter();
      return;
    }
    new MutationObserver(() => {
      if (block.getAttribute('data-block-status') === 'loaded') tryFooter();
    }).observe(block, { attributes: true, attributeFilter: ['data-block-status'] });
  };

  const foot = doc.querySelector('footer');
  if (foot) {
    watchBlock(foot.querySelector('.footer.block'));
    tryFooter();
  }

  new MutationObserver((_, obs) => {
    const block = doc.querySelector('footer .footer.block');
    if (!block) return;
    watchBlock(block);
    tryFooter();
    if (doc.documentElement.classList.contains('xwalk-footer-boost-ready')) obs.disconnect();
  }).observe(doc.body || doc.documentElement, { childList: true, subtree: true });
}

export function decorateBoostLayout(doc = document) {
  const path = (doc.location?.pathname || '').replace(/\/$/, '');
  const isPersonaLanding =
    path === '/family-texas' || path === '/single-woman-nyc' || path === '/college-student';

  if (!isPersonaLanding) {
  const main = doc.querySelector('main');
  if (!main) {
    decorateFooterLayout(doc);
    return;
  }

  decorateHeroSections(main);

  const isBoostRetail =
    /save when you shop online/i.test(main.textContent || '') ||
    /shop phones\s*&\s*devices/i.test(main.textContent || '') ||
    /plans from \$25\/mo/i.test(main.textContent || '') ||
    /deals\s*&\s*offers/i.test(main.textContent || '') ||
    main.querySelector('.xwalk-retail-deals-head') ||
    main.querySelector('.xwalk-phone-deal-section') ||
    [...main.querySelectorAll('a')].some((a) => /get the deal/i.test(a.textContent || ''));

  if (isBoostRetail) {
    doc.body?.classList.add('xwalk-boost-page');
    main.classList.add('xwalk-boost-main');
  }

  const sections = [...main.children].filter((el) => el.tagName === 'DIV');
  sections.forEach((section) => {
    const text = section.textContent || '';

    if (text.includes('Trade in your iPhone') && section.querySelector('a[href="/phones"]')) {
      section.classList.add('xwalk-promo-strip');
    }
    if (/save when you shop online|shop phones & devices|plans from \$25\/mo|deals & offers/i.test(text)) {
      section.classList.add('xwalk-retail-hero', 'xwalk-shop-online-head');
    }
    if (/save up to \$2,400/i.test(text)) {
      section.classList.add('xwalk-savings-banner');
    }

    const dealCtas = [...section.querySelectorAll('a')].filter((a) =>
      /get the deal/i.test(a.textContent || ''),
    );
    if (dealCtas.length >= 2) splitFlatDealSection(section);

    const isPhonesPage = /shop phones\s*&\s*devices/i.test(main.textContent || '');
    if (section.querySelector('h3') && section.querySelector('picture')) {
      const isSimplePhoneCard =
        !isPhonesPage && /shop now/i.test(section.textContent || '') && dealCtas.length === 0;
      section.classList.add(isSimplePhoneCard ? 'xwalk-phone-section' : 'xwalk-deal-section');
      if (isPhonesPage) section.classList.add('xwalk-phone-deal-section');
      const card =
        section.querySelector('.xwalk-phone-card') ||
        section.querySelector('.xwalk-deal-card') ||
        section;
      card.classList.add(isSimplePhoneCard ? 'xwalk-phone-card' : 'xwalk-deal-card');
      if (isSimplePhoneCard) {
        const picP = section.querySelector(':scope > p:has(picture)');
        if (picP && !picP.classList.contains('xwalk-phone-media')) {
          picP.classList.add('xwalk-phone-media');
        }
      } else {
        tagDealCardInternals(card);
      }
    }
  });

  const nav = doc.querySelector('header nav') || doc.querySelector('main.xwalk-nav');
  if (nav) nav.classList.add('xwalk-nav-boost');

  main.dataset.xwalkBoostDecorated = '1';
  }

  decorateFooterLayout(doc);
}

if (typeof document !== 'undefined') {
  const run = () => {
    decorateBoostLayout();
    observeAsyncFooter();
  };
  run();
  document.addEventListener('DOMContentLoaded', run);
}
