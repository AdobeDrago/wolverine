/**
 * Boost footer layout when HLX/DA flattens footer.html (no xwalk-* classes).
 */
(function () {
  const PRIMARY = '#1DB954';
  const TEXT = '#ffffff';
  const SOCIAL_ICON = { Facebook: 'f', X: 'X', Instagram: 'ig', YouTube: '▶' };

  function footerWrap() {
    const all = document.querySelectorAll('footer .footer');
    for (const el of all) {
      if (el.querySelector(':scope > .section')) return el;
    }
    return all[all.length - 1] || null;
  }

  function footerHost() {
    const wrap = footerWrap();
    if (!wrap) return null;
    return (
      wrap.querySelector('main.xwalk-footer-boost, main.xwalk-footer, main') || wrap
    );
  }

  function sectionContent(section) {
    return section.querySelector('.default-content-wrapper') || section;
  }

  function sectionDivs(host) {
    const sections = [...host.children].filter(
      (el) => el.tagName === 'DIV' && el.classList.contains('section'),
    );
    if (sections.length) return sections;
    return [...host.children].filter((el) => el.tagName === 'DIV');
  }

  function showFooterContent() {
    document.querySelectorAll('footer .footer').forEach((el) => {
      el.style.visibility = 'visible';
      el.style.opacity = '1';
    });
    const block = document.querySelector('footer .footer.block[data-block-status="loaded"]');
    block?.querySelectorAll('.footer').forEach((el) => {
      el.style.visibility = 'visible';
      el.style.opacity = '1';
    });
  }

  function fixLogos(scope) {
    scope.querySelectorAll('.xwalk-footer-brand, .xwalk-footer-top-brand').forEach((brand) => {
      brand.style.overflow = 'visible';
      brand.style.maxWidth = 'none';
    });
    scope.querySelectorAll('.xwalk-footer-brand img, .xwalk-footer-top-brand img, picture img').forEach((img) => {
      const pic = img.closest('picture');
      if (pic) {
        pic.style.cssText = 'display:block;line-height:0;overflow:visible;max-width:100%;';
      }
      img.style.cssText =
        'display:block!important;height:auto!important;width:auto!important;max-width:220px!important;max-height:72px!important;object-fit:contain!important;object-position:left center!important;';
      img.removeAttribute('height');
    });
  }

  function paintSocialLink(a) {
    const href = a.getAttribute('href') || '';
    const label = (a.getAttribute('aria-label') || a.textContent || '').trim();
    let key = Object.keys(SOCIAL_ICON).find((k) => label.toLowerCase().includes(k.toLowerCase()));
    if (!key && /facebook/i.test(href)) key = 'Facebook';
    if (!key && /twitter|x\.com/i.test(href)) key = 'X';
    if (!key && /instagram/i.test(href)) key = 'Instagram';
    if (!key && /youtube/i.test(href)) key = 'YouTube';
    const glyph = key ? SOCIAL_ICON[key] : label.slice(0, 2) || '•';
    if (key) a.setAttribute('aria-label', key);
    a.innerHTML = `<span aria-hidden="true">${glyph}</span>`;
    a.classList.add('xwalk-footer-social-link');
    ['display', 'align-items', 'justify-content', 'width', 'height', 'border-radius', 'background', 'color', 'font-weight', 'font-size', 'text-decoration', 'line-height'].forEach((prop) => {
      const val =
        prop === 'display'
          ? 'inline-flex'
          : prop === 'align-items' || prop === 'justify-content'
            ? 'center'
            : prop === 'width' || prop === 'height'
              ? '40px'
              : prop === 'border-radius'
                ? '50%'
                : prop === 'background'
                  ? '#1a1a1a'
                  : prop === 'color'
                    ? '#fff'
                    : prop === 'font-weight'
                      ? '800'
                      : prop === 'font-size'
                        ? '0.8125rem'
                        : prop === 'text-decoration'
                          ? 'none'
                          : '1';
      a.style.setProperty(prop, val, 'important');
    });
  }

  function paintSocial(scope) {
    scope.querySelectorAll('.xwalk-footer-social a, ul a[href*="facebook"], ul a[href*="twitter"], ul a[href*="instagram"], ul a[href*="youtube"]').forEach(paintSocialLink);
  }

  function styleColumnsGrid(grid) {
    grid.className = 'xwalk-footer-columns';
    grid.style.cssText =
      'display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:28px 32px!important;padding:32px 0 28px!important;width:100%!important;box-sizing:border-box!important;visibility:visible!important;opacity:1!important;';
    grid.querySelectorAll('.xwalk-footer-col').forEach((col) => {
      col.style.cssText = 'visibility:visible!important;opacity:1!important;color:' + TEXT + '!important;';
      col.querySelectorAll('a').forEach((a) => {
        a.style.color = 'rgba(255,255,255,0.92)';
      });
    });
  }

  function splitFlatColumns(section) {
    const content = sectionContent(section);
    if (content.querySelector('.xwalk-footer-columns')) {
      styleColumnsGrid(content.querySelector('.xwalk-footer-columns'));
      return true;
    }

    const nodes = [...content.children];
    const groups = [];
    let group = null;
    for (const el of nodes) {
      if (el.tagName === 'P' && el.querySelector('strong')) {
        if (group) groups.push(group);
        group = { title: el, nodes: [] };
        continue;
      }
      if (group) group.nodes.push(el);
    }
    if (group) groups.push(group);
    if (!groups.length) return false;

    const byTitle = new Map(groups.map((g) => [g.title.textContent.trim().toLowerCase(), g]));
    const support = byTitle.get('support');
    const legal = byTitle.get('legal');
    if (support && legal) {
      support.nodes.push(...legal.nodes);
      byTitle.delete('legal');
    }

    const order = ['shop', 'plans', 'about', 'support'];
    const picked = order.map((k) => byTitle.get(k)).filter(Boolean);
    if (!picked.length) return false;

    const grid = document.createElement('div');
    grid.className = 'xwalk-footer-columns';
    picked.forEach(({ title, nodes }) => {
      const col = document.createElement('div');
      col.className = 'xwalk-footer-col';
      title.style.cssText =
        'margin:0 0 12px;font-family:Arial Black,Arial,sans-serif;font-size:0.8125rem;letter-spacing:0.06em;text-transform:uppercase;color:' +
        TEXT +
        ';';
      col.append(title, ...nodes);
      nodes.forEach((n) => {
        if (n.tagName === 'UL') {
          n.style.cssText = 'list-style:none;padding:0;margin:0;';
          n.querySelectorAll('li').forEach((li) => {
            li.style.margin = '0 0 8px';
          });
          n.querySelectorAll('a').forEach((a) => {
            a.style.cssText = 'color:color-mix(in srgb,#fff 92%,transparent);text-decoration:none;font-size:0.9375rem;';
          });
        }
      });
      grid.append(col);
    });
    content.replaceChildren(grid);
    styleColumnsGrid(grid);
    return true;
  }

  function buildTopFromFlat(section) {
    const content = sectionContent(section);
    const socialLabel = [...content.querySelectorAll('p')].find((p) =>
      /connect with us on social/i.test(p.textContent || ''),
    );
    const socialUl = content.querySelector('ul');
    if (!socialLabel || !socialUl) return false;

    const brandPs = [...content.children].filter(
      (el) => el.tagName === 'P' && el !== socialLabel,
    );

    const top = document.createElement('div');
    top.className = 'xwalk-footer-top';
    top.style.cssText =
      'display:grid;grid-template-columns:1fr auto;align-items:start;gap:24px 40px;padding:32px 0 28px;border-bottom:1px solid color-mix(in srgb,#86EFAC 20%,transparent);width:100%;box-sizing:border-box;';

    const brand = document.createElement('div');
    brand.className = 'xwalk-footer-top-brand';
    brand.style.cssText = 'max-width:420px;overflow:visible;';
    brandPs.forEach((p) => {
      p.style.color = TEXT;
      p.style.margin = '0 0 8px';
      brand.append(p);
    });

    const socialWrap = document.createElement('div');
    socialWrap.className = 'xwalk-footer-top-social';
    socialWrap.style.textAlign = 'right';
    socialLabel.style.cssText =
      'margin:0 0 12px;font-size:0.875rem;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:color-mix(in srgb,#fff 88%,transparent);';
    socialUl.classList.add('xwalk-footer-social');
    socialUl.style.cssText =
      'display:flex;flex-wrap:wrap;justify-content:flex-end;gap:10px;list-style:none;padding:0;margin:0;';
    socialUl.querySelectorAll('a').forEach(paintSocialLink);
    socialWrap.append(socialLabel, socialUl);

    top.append(brand, socialWrap);
    content.replaceChildren(top);
    fixLogos(top);
    return true;
  }

  function enhanceTop(section) {
    if (section.classList.contains('xwalk-footer-top') || section.querySelector('.xwalk-footer-top')) {
      const top = section.classList.contains('xwalk-footer-top') ? section : section.querySelector('.xwalk-footer-top');
      top.style.cssText =
        'display:grid;grid-template-columns:1fr auto;align-items:start;gap:24px 40px;padding:32px 0 28px;border-bottom:1px solid color-mix(in srgb,#86EFAC 20%,transparent);width:100%;box-sizing:border-box;';
      const brand = top.querySelector('.xwalk-footer-top-brand');
      if (brand) brand.style.cssText = 'max-width:420px;overflow:visible;';
      const socialWrap = top.querySelector('.xwalk-footer-top-social');
      if (socialWrap) {
        socialWrap.style.textAlign = 'right';
        const socialUl = socialWrap.querySelector('ul');
        if (socialUl) {
          socialUl.style.cssText =
            'display:flex;flex-wrap:wrap;justify-content:flex-end;gap:10px;list-style:none;padding:0;margin:0;';
        }
      }
      fixLogos(top);
      paintSocial(top);
      top.querySelectorAll('p').forEach((p) => {
        if (!p.classList.contains('xwalk-footer-social-label')) p.style.color = TEXT;
      });
      return;
    }
    buildTopFromFlat(section);
  }

  function isNewsletterOrLeakSection(section) {
    const content = sectionContent(section);
    if (content.querySelector('.xwalk-family-plans-page, .xwalk-family-headline, .xwalk-family-grid')) {
      return true;
    }
    if (content.querySelector('.xwalk-footer-newsletter, input[type="email"]')) return true;
    return /want the latest scoop|newsletter/i.test(content.textContent || '');
  }

  function removeNewsletterSections(host) {
    sectionDivs(host).forEach((section) => {
      if (isNewsletterOrLeakSection(section)) section.remove();
    });
  }

  function isReady(host) {
    const links = host.querySelectorAll('.xwalk-footer-col a, .xwalk-footer-columns a');
    return links.length >= 4;
  }

  function run() {
    showFooterContent();
    const wrap = footerWrap();
    const host = footerHost();
    if (!wrap || !host) return;
    if (host.dataset.xwalkFooterBoost === '1' && isReady(host)) return;

    removeNewsletterSections(host);

    const sections = sectionDivs(host);
    if (sections.length < 2) return;

    host.classList.add('xwalk-footer-boost');
    host.style.cssText =
      'display:block;max-width:1280px;margin:0 auto;padding:0 32px 32px;box-sizing:border-box;color:' +
      TEXT +
      ';visibility:visible;opacity:1;min-height:0;';
    wrap.style.minHeight = '0';

    enhanceTop(sections[0]);
    const columnsSection = sections.find(
      (s, i) => i > 0 && !isNewsletterOrLeakSection(s) && !/all rights reserved/i.test(s.textContent || ''),
    );
    if (!columnsSection || !splitFlatColumns(columnsSection)) return;

    const legalSection =
      sections.find((s) => /all rights reserved|©/i.test(s.textContent || '')) ||
      sections[sections.length - 1];
    if (legalSection && legalSection !== sections[0] && legalSection !== columnsSection) {
      legalSection.className = 'xwalk-footer-legal';
      legalSection.style.cssText =
        'padding:24px 0 8px;text-align:center;color:color-mix(in srgb,#fff 75%,transparent);';
    }

    fixLogos(host);
    paintSocial(host);

    if (!isReady(host)) return;

    host.dataset.xwalkFooterBoost = '1';
    document.documentElement.classList.add('xwalk-footer-boost-ready');
  }

  globalThis.xwalkFooterBoostDecorate = run;

  document.addEventListener('DOMContentLoaded', () => setTimeout(run, 0));
  document.addEventListener('aem:loaded', () => setTimeout(run, 0));
  for (const ms of [100, 400, 1000, 2500]) setTimeout(run, ms);

  const footerRoot = document.querySelector('footer');
  if (footerRoot) {
    const mo = new MutationObserver(() => setTimeout(run, 50));
    mo.observe(footerRoot, { childList: true, subtree: true, attributes: true });
    setTimeout(() => mo.disconnect(), 15000);
  }
})();
