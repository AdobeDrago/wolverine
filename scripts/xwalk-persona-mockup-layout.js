/**
 * Persona offer pages: hide promo chrome, rebuild family grid when HLX flattens HTML.
 */
(function (global) {
  const FAMILY_LINE_RE = /^(\d+(?:st|nd|rd|th) line|Phone|Plan|Talk|Data boost|Hotspot|Global roaming)\b/i;

  function isFamilyCtaParagraph(p) {
    const a = p?.querySelector?.('a');
    return a && /shop\s*now/i.test(a.textContent || '');
  }

  function isFamilyLineParagraph(p) {
    return p?.tagName === 'P' && FAMILY_LINE_RE.test((p.textContent || '').trim());
  }

  function lineLabelFromParagraph(p) {
    const t = (p.textContent || '').trim();
    const m = t.match(FAMILY_LINE_RE);
    return m ? m[1] : t.split(/\s+\$/)[0].trim();
  }

  function priceHtmlFromParagraph(p) {
    const del = p.querySelector('del');
    const strong = p.querySelector('strong');
    const em = p.querySelector('em');
    if (!del && !strong) {
      const m = (p.textContent || '').match(/\$\d+/);
      return m ? `<span class="xwalk-family-now">${m[0]}</span>` : '';
    }
    const was = del ? del.textContent.trim() : '';
    const now = strong ? strong.textContent.trim() : '';
    const off = em ? em.textContent.trim() : '';
    return `<span class="xwalk-family-price"><s class="xwalk-family-was">${was}</s> <strong class="xwalk-family-now">${now}</strong>${off ? ` <em class="xwalk-family-off">${off}</em>` : ''}</span>`;
  }

  function pillToneForRow(rowIndex) {
    return rowIndex < 2 ? 'dark' : 'accent';
  }

  function buildFamilyRowHtml(rowIndex, label, priceHtml, pillText) {
    const band = rowIndex % 2 === 0 ? 'a' : 'b';
    const tone = pillToneForRow(rowIndex);
    return `<div class="xwalk-family-row xwalk-family-row--${band}">
  <span class="xwalk-family-line-label">${label}</span>
  <span class="xwalk-family-line-price">${priceHtml}</span>
  <p class="xwalk-family-pill xwalk-family-pill--${tone}">${pillText}</p>
</div>`;
  }

  function parseFamilyOffers(section) {
    const nodes = [...section.children];
    const offers = [];
    let headline = 'Keep your family connected';
    let i = 0;

    while (i < nodes.length) {
      const node = nodes[i];
      if (node.tagName === 'H1') {
        headline = node.textContent.trim() || headline;
        i += 1;
        continue;
      }
      if (node.tagName === 'P' && node.querySelector('picture') && !node.querySelector('a[href="/"]')) {
        i += 1;
        continue;
      }
      if (node.tagName !== 'H2') {
        i += 1;
        continue;
      }
      const title = node.textContent.trim();
      const rows = [];
      let ctaHref = '/plans';
      i += 1;
      while (i < nodes.length && nodes[i].tagName !== 'H2') {
        const el = nodes[i];
        if (el.tagName === 'P' && isFamilyCtaParagraph(el)) {
          ctaHref = el.querySelector('a')?.getAttribute('href') || ctaHref;
          i += 1;
          break;
        }
        if (el.tagName === 'P' && isFamilyLineParagraph(el)) {
          const label = lineLabelFromParagraph(el);
          const priceHtml = priceHtmlFromParagraph(el);
          i += 1;
          let pillText = '';
          if (
            i < nodes.length &&
            nodes[i].tagName === 'P' &&
            !isFamilyLineParagraph(nodes[i]) &&
            !isFamilyCtaParagraph(nodes[i])
          ) {
            pillText = nodes[i].textContent.trim();
            i += 1;
          }
          rows.push({ label, priceHtml, pillText });
          continue;
        }
        i += 1;
      }
      if (rows.length) offers.push({ title, rows, ctaHref });
    }

    return { headline, offers };
  }

  function buildFamilyPlansDom(doc, parsed) {
    const { headline, offers } = parsed;
    const root = doc.createElement('div');
    root.className = 'xwalk-persona-mockup xwalk-family-plans-page';
    root.dataset.personaId = doc.location?.pathname?.replace(/^\//, '').replace(/\/$/, '') || 'family-texas';

    const main = doc.createElement('section');
    main.className = 'xwalk-family-main';
    const h1 = doc.createElement('h1');
    h1.className = 'xwalk-family-headline';
    const personaId = root.dataset.personaId || 'family-texas';
    const headlineIds = {
      'family-texas': 'keep-your-family-connected',
      'single-woman-nyc': 'you-run-this-city',
      'college-student': 'wireless-that-fits-your-semester',
    };
    if (headlineIds[personaId]) h1.id = headlineIds[personaId];
    h1.textContent = headline;
    main.append(h1);
    const wrap = doc.createElement('div');
    wrap.className = 'xwalk-family-offers';

    offers.forEach((offer, offerIndex) => {
      const shell = doc.createElement('div');
      shell.className = 'xwalk-family-offer';
      if (offerIndex > 0) {
        shell.hidden = true;
        shell.style.display = 'none';
      }

      const h2 = doc.createElement('h2');
      h2.className = 'xwalk-family-title';
      h2.id = offerIndex === 0 ? 'family-plans--bring-your-own-device' : 'family-unlimited--premium-data-on-every-line';
      h2.textContent = offer.title;
      shell.append(h2);

      const grid = doc.createElement('div');
      grid.className = 'xwalk-family-grid';
      offer.rows.forEach((row, idx) => {
        grid.insertAdjacentHTML('beforeend', buildFamilyRowHtml(idx, row.label, row.priceHtml, row.pillText));
      });
      shell.append(grid);

      const ctaWrap = doc.createElement('p');
      ctaWrap.className = 'xwalk-family-cta-wrap';
      ctaWrap.innerHTML = `<a class="xwalk-family-cta" href="${offer.ctaHref}">Shop Now →</a>`;
      shell.append(ctaWrap);

      wrap.append(shell);
    });

    main.append(wrap);
    root.append(main);
    return root;
  }

  function findFamilySection(doc) {
    if (doc.querySelector('.xwalk-family-plans-page')) return null;
    const main = doc.querySelector('body > main');
    if (!main) return null;
    const candidates = [
      ...main.querySelectorAll(':scope > div'),
      ...main.querySelectorAll(':scope > .section > div'),
      ...main.querySelectorAll('.section > div'),
    ];
    for (const el of candidates) {
      if (el.querySelector('#family-plans--bring-your-own-device, h2')) return el;
      if (/family plans/i.test(el.textContent || '') && el.querySelector('picture')) return el;
    }
    return main.querySelector('div');
  }

  function gridPersonaPath(path) {
    const m = (path || '').replace(/\/$/, '').match(/\/(family-texas|college-student|single-woman-nyc)$/);
    return m ? m[1] : null;
  }

  function decorateFamilyTexasPage(doc) {
    const path = (doc.location?.pathname || '').replace(/\/$/, '');
    const personaId = gridPersonaPath(path);
    if (!personaId) return false;

    doc.body?.classList.add('xwalk-persona-offer-page', `xwalk-persona-offer-page--${personaId}`);

    if (doc.querySelector('.xwalk-family-plans-page')) return true;

    const section = findFamilySection(doc);
    if (!section) return false;

    const parsed = parseFamilyOffers(section);
    if (!parsed.offers.length) return false;

    const built = buildFamilyPlansDom(doc, parsed);
    section.replaceChildren(built);
    section.classList.add('xwalk-family-section');

    const main = doc.querySelector('main');
    if (main) {
      main.classList.remove('xwalk-boost-main');
      main.dataset.xwalkPersonaMockup = '1';
      main.style.display = 'block';
      main.style.maxWidth = 'none';
      main.style.padding = '0';
      main.style.background = '#eef8f1';
    }
    doc.body?.classList.remove('xwalk-boost-page');

    doc.querySelectorAll('header .xwalk-promo-strip, .fragment.xwalk-promo-strip').forEach((el) => {
      el.style.display = 'none';
    });

    return true;
  }

  function decoratePersonaMockupPage(doc) {
    if (decorateFamilyTexasPage(doc)) return;

    const mockup = doc.querySelector('.xwalk-persona-mockup');
    if (!mockup) return;

    doc.body?.classList.add('xwalk-persona-offer-page');

    const path = (doc.location?.pathname || '').replace(/\/$/, '');
    if (/^\/(family-texas|single-woman-nyc|college-student)$/.test(path)) {
      doc.body.classList.add(`xwalk-persona-offer-page--${path.slice(1)}`);
    }

    doc.querySelectorAll('header .xwalk-promo-strip, .fragment.xwalk-promo-strip').forEach((el) => {
      el.style.display = 'none';
    });

    const main = doc.querySelector('main');
    if (main && !main.dataset.xwalkPersonaMockup) {
      main.dataset.xwalkPersonaMockup = '1';
      main.style.display = 'block';
      main.style.maxWidth = 'none';
      main.style.padding = '0';
      main.style.background = '#eef8f1';
    }

    mockup.querySelectorAll('[data-forge-variant][hidden]').forEach((el) => {
      el.hidden = true;
      el.style.display = 'none';
    });
    const first = mockup.querySelector('[data-forge-variant]');
    if (first) {
      first.hidden = false;
      first.style.display = '';
    }
  }

  function run() {
    decoratePersonaMockupPage(document);
  }

  global.decorateFamilyTexasPage = decorateFamilyTexasPage;
  global.decoratePersonaMockupPage = decoratePersonaMockupPage;

  if (typeof document !== 'undefined') {
    run();
    document.addEventListener('DOMContentLoaded', run);
    document.addEventListener('aem:loaded', run);
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        decorateFamilyTexasPage(document);
      });
    };
    const pageMain = document.querySelector('body > main');
    if (pageMain) {
      new MutationObserver(schedule).observe(pageMain, { childList: true, subtree: true });
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
