import { loadCSS } from '../../scripts/aem.js';

const PRIMARY = '#1DB954';
const SECONDARY = '#0E7A3A';
const MINT_PAGE = '#eef8f1';
const MINT_ROW = '#f3fbf6';
const MINT_PILL = '#d8f3e0';
const DARK_PILL = '#1a1a1a';

const LINE_RE = /^(\d+(?:st|nd|rd|th) line|Phone|Plan|Talk|Data boost|Hotspot|Global roaming)\b/i;

function injectFamilyStyles(doc) {
  if (doc.getElementById('forge-family-plans')) return;
  const style = doc.createElement('style');
  style.id = 'forge-family-plans';
  style.textContent = `
.xwalk-family-plans-page{background:${MINT_PAGE}!important;color:#111!important;width:100%!important}
.xwalk-family-row{display:grid!important;grid-template-columns:92px 168px minmax(0,1fr)!important;gap:12px 32px!important;align-items:center!important;padding:22px 28px!important;background:${MINT_ROW}!important;width:100%!important;box-sizing:border-box!important}
.xwalk-family-line-label{font-weight:800!important;color:#111!important;font-size:1.0625rem!important}
.xwalk-family-line-price{font-weight:900!important;font-size:1.4rem!important;color:${PRIMARY}!important}
.xwalk-family-was{text-decoration:line-through!important;color:${PRIMARY}!important}
.xwalk-family-now{color:${PRIMARY}!important;font-weight:900!important}
.xwalk-family-off{font-style:italic!important;color:${SECONDARY}!important;margin-left:6px!important}
.xwalk-family-pill--dark{background:${DARK_PILL}!important;color:#fff!important;border-radius:999px!important;padding:14px 24px!important;text-align:center!important;margin:0!important;width:100%!important;box-sizing:border-box!important}
.xwalk-family-pill--accent{background:${MINT_PILL}!important;color:${SECONDARY}!important;border:1px solid ${PRIMARY}!important;border-radius:999px!important;padding:14px 24px!important;text-align:center!important;margin:0!important;font-weight:700!important;width:100%!important;box-sizing:border-box!important}
.xwalk-family-title{color:${PRIMARY}!important;font-family:"Arial Black",Arial,sans-serif!important;font-size:1.65rem!important;font-weight:900!important;margin:0 0 28px!important}
.xwalk-family-main{background:${MINT_PAGE}!important;padding:36px 40px 56px!important;max-width:1040px!important;margin:0 auto!important}
.xwalk-family-cta{display:inline-block!important;background:${PRIMARY}!important;color:#fff!important;font-size:1.625rem!important;font-weight:900!important;padding:20px 56px!important;border-radius:14px!important;text-decoration:none!important;font-family:"Arial Black",Arial,sans-serif!important}
.xwalk-family-cta-wrap{text-align:center!important;margin:40px 0 0!important}
`.trim();
  doc.head.appendChild(style);
}

function paintRow(row, idx) {
  row.style.cssText = `display:grid;grid-template-columns:92px 168px minmax(0,1fr);gap:12px 32px;align-items:center;padding:22px 28px;background:${MINT_ROW};width:100%;box-sizing:border-box;`;
  const label = row.querySelector('.xwalk-family-line-label');
  const price = row.querySelector('.xwalk-family-line-price');
  const pill = row.querySelector('.xwalk-family-pill');
  if (label) label.style.cssText = 'font-weight:800;color:#111;font-size:1.0625rem;';
  if (price) price.style.cssText = `font-weight:900;font-size:1.4rem;color:${PRIMARY};`;
  price?.querySelectorAll('.xwalk-family-was, .xwalk-family-now').forEach((el) => {
    el.style.color = PRIMARY;
    if (el.classList.contains('xwalk-family-was')) el.style.textDecoration = 'line-through';
  });
  price?.querySelectorAll('.xwalk-family-off').forEach((el) => {
    el.style.cssText = `font-style:italic;color:${SECONDARY};margin-left:6px;`;
  });
  if (pill) {
    const accent = idx >= 2;
    pill.style.cssText = accent
      ? `margin:0;padding:14px 24px;border-radius:999px;text-align:center;width:100%;box-sizing:border-box;background:${MINT_PILL};color:${SECONDARY};font-weight:700;border:1px solid ${PRIMARY};font-size:0.8125rem;line-height:1.4;`
      : `margin:0;padding:14px 24px;border-radius:999px;text-align:center;width:100%;box-sizing:border-box;background:${DARK_PILL};color:#fff;font-size:0.8125rem;line-height:1.4;`;
  }
}

function paintFamilyPage(root) {
  injectFamilyStyles(root.ownerDocument || document);
  root.querySelectorAll('.xwalk-family-row').forEach((row, idx) => paintRow(row, idx));
  root.querySelectorAll('.xwalk-family-title').forEach((el) => {
    el.style.cssText = `color:${PRIMARY};font-family:"Arial Black",Arial,sans-serif;font-size:1.65rem;font-weight:900;margin:0 0 28px;`;
  });
  root.querySelector('.xwalk-family-main')?.style.setProperty('background', MINT_PAGE, 'important');
  root.querySelectorAll('.xwalk-family-cta').forEach((a) => {
    a.style.cssText = `display:inline-block;background:${PRIMARY};color:#fff;font-size:1.625rem;font-weight:900;padding:20px 56px;border-radius:14px;text-decoration:none;font-family:"Arial Black",Arial,sans-serif;`;
  });
}

function isCta(p) {
  return p?.tagName === 'P' && p.querySelector('a') && /shop\s*now/i.test(p.textContent || '');
}

function isLine(p) {
  return p?.tagName === 'P' && LINE_RE.test((p.textContent || '').trim());
}

function buildFromFlat(section) {
  const doc = section.ownerDocument;
  const nodes = [...section.children];
  const offers = [];
  let headline = 'Keep your family connected';
  let i = 0;
  while (i < nodes.length) {
    if (nodes[i].tagName === 'H1') {
      headline = nodes[i].textContent.trim() || headline;
      i += 1;
      continue;
    }
    if (nodes[i].tagName === 'P' && nodes[i].querySelector('picture') && !nodes[i].querySelector('a[href="/"]')) {
      i += 1;
      continue;
    }
    if (nodes[i].tagName !== 'H2') {
      i += 1;
      continue;
    }
    const title = nodes[i].textContent.trim();
    const rows = [];
    let cta = '/plans';
    i += 1;
    while (i < nodes.length && nodes[i].tagName !== 'H2') {
      const el = nodes[i];
      if (isCta(el)) {
        cta = el.querySelector('a')?.href || cta;
        i += 1;
        break;
      }
      if (isLine(el)) {
        const t = (el.textContent || '').trim();
        const label = t.match(LINE_RE)?.[1] || t.split(/\s+\$/)[0].trim();
        const del = el.querySelector('del');
        const strong = el.querySelector('strong');
        const em = el.querySelector('em');
        i += 1;
        let pill = '';
        if (i < nodes.length && nodes[i].tagName === 'P' && !isLine(nodes[i]) && !isCta(nodes[i])) {
          pill = nodes[i].textContent.trim();
          i += 1;
        }
        const nowMatch = (el.textContent || '').match(/\$\d+/g);
        rows.push({
          label,
          del,
          strong,
          em,
          pill,
          nowPrice: strong?.textContent || nowMatch?.[nowMatch.length - 1] || '$50',
        });
        continue;
      }
      i += 1;
    }
    if (rows.length) offers.push({ title, rows, cta });
  }

  const root = doc.createElement('div');
  root.className = 'xwalk-family-plans-page';
  const main = doc.createElement('section');
  main.className = 'xwalk-family-main';
  const h1 = doc.createElement('h1');
  h1.className = 'xwalk-family-headline';
  h1.textContent = headline;
  main.append(h1);
  offers.forEach((offer, oi) => {
    const shell = doc.createElement('div');
    shell.className = 'xwalk-family-offer';
    if (oi > 0) shell.hidden = true;
    const h2 = doc.createElement('h2');
    h2.className = 'xwalk-family-title';
    h2.textContent = offer.title;
    if (oi === 0) h2.id = 'family-plans--bring-your-own-device';
    shell.append(h2);
    const grid = doc.createElement('div');
    grid.className = 'xwalk-family-grid';
    offer.rows.forEach((row, ri) => {
      const rowEl = doc.createElement('div');
      rowEl.className = 'xwalk-family-row';
      const lab = doc.createElement('span');
      lab.className = 'xwalk-family-line-label';
      lab.textContent = row.label;
      const price = doc.createElement('span');
      price.className = 'xwalk-family-line-price';
      if (row.del && row.strong) {
        price.innerHTML = `<s class="xwalk-family-was">${row.del.textContent}</s> <strong class="xwalk-family-now">${row.strong.textContent}</strong>${row.em ? ` <em class="xwalk-family-off">${row.em.textContent}</em>` : ''}`;
      } else {
        price.innerHTML = `<span class="xwalk-family-now">${row.nowPrice || '$50'}</span>`;
      }
      const pill = doc.createElement('p');
      pill.className = `xwalk-family-pill xwalk-family-pill--${ri < 2 ? 'dark' : 'accent'}`;
      pill.textContent = row.pill;
      rowEl.append(lab, price, pill);
      grid.append(rowEl);
      paintRow(rowEl, ri);
    });
    shell.append(grid);
    const ctaWrap = doc.createElement('p');
    ctaWrap.className = 'xwalk-family-cta-wrap';
    ctaWrap.innerHTML = `<a class="xwalk-family-cta" href="${offer.cta}">Shop Now →</a>`;
    shell.append(ctaWrap);
    main.append(shell);
  });
  root.append(main);
  return root;
}

export default async function decorate(block) {
  await loadCSS(`${window.hlx?.codeBasePath || ''}/blocks/xwalk-family-plans/xwalk-family-plans.css`);
  injectFamilyStyles(document);
  document.body?.classList.add('xwalk-persona-offer-page', 'xwalk-persona-offer-page--family-texas');
  const main = document.querySelector('main');
  if (main) {
    main.classList.remove('xwalk-boost-main');
    main.style.background = MINT_PAGE;
    main.style.display = 'block';
    main.style.maxWidth = 'none';
    main.style.padding = '0';
  }

  let root = block.querySelector('.xwalk-family-plans-page');
  if (!root) {
    const section = block.querySelector(':scope > div') || block;
    if (section.querySelector('h2') && /family plan/i.test(section.textContent || '')) {
      root = buildFromFlat(section);
      section.replaceChildren(root);
    }
  }
  if (root) paintFamilyPage(root);
  block.classList.add('xwalk-family-plans-ready');
}
