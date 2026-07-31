/**
 * Make block content editable on the preview page (text, links, images).
 * Includes ADA controls: image alt text and link accessible names.
 */

const TEXT_TAGS = 'h1,h2,h3,h4,h5,h6,p,li,em,strong';
/** EDS CTAs are usually <a class="button">; some pages use native <button>. */
const CTA_TAGS = 'a[href],button';

export function isForgeEditChrome(el) {
  return Boolean(
    el?.closest?.(
      '.forge-edit-badge, .forge-edit-delete, .forge-edit-drop-zone, .forge-edit-media-toolbar, .forge-edit-banner, .forge-edit-dialog-backdrop, .forge-edit-menu, .forge-personalization-backdrop',
    ),
  );
}

export function isLeafTextField(el) {
  if (!el?.matches) return false;
  if (!el.matches(`${TEXT_TAGS},${CTA_TAGS}`)) return false;
  if (isForgeEditChrome(el)) return false;
  const nested = el.querySelector(`${TEXT_TAGS},${CTA_TAGS}`);
  return !nested || nested === el;
}

function makeTextEditable(el, { onDirty } = {}) {
  el.classList.add('forge-edit-field');
  el.contentEditable = 'true';
  el.spellcheck = true;
  if (el.matches('a[href],button,.button')) {
    el.title = el.matches('a[href],.button')
      ? 'Edit button label · double-click for URL / accessible name'
      : 'Edit button label · double-click for accessible name';
  }
  el.addEventListener('input', () => {
    el.classList.add('forge-edit-field--dirty');
    onDirty?.();
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !el.matches('p,li')) e.preventDefault();
  });
}

function isEditModeActive() {
  return document.documentElement.classList.contains('forge-edit-active');
}

function escapeAttr(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Images missing a meaningful alt (absent attribute or empty without decorative intent). */
export function listImagesNeedingAlt(root = document) {
  const imgs = [...(root.querySelectorAll?.('main img, main picture img') || [])];
  return imgs.filter((img) => {
    if (img.closest('.forge-edit-badge, .forge-edit-media-toolbar, .forge-edit-banner')) return false;
    if (img.getAttribute('aria-hidden') === 'true' && img.getAttribute('alt') === '') return false;
    if (img.dataset.forgeDecorative === '1') return false;
    const hasAlt = img.hasAttribute('alt');
    const alt = img.getAttribute('alt');
    return !hasAlt || alt == null || String(alt).trim() === '';
  });
}

export function countMissingImageAlts(root = document) {
  return listImagesNeedingAlt(root).length;
}

/** Links whose visible text is non-descriptive without an accessible name. */
const VAGUE_LINK_RE = /^(learn more|click here|here|more|read more|details|link)$/i;

export function listVagueLinks(root = document) {
  const links = [...(root.querySelectorAll?.('main a[href]') || [])];
  return links.filter((a) => {
    if (a.closest('.forge-edit-badge, .forge-edit-media-toolbar, .forge-edit-banner')) return false;
    if (a.getAttribute('aria-hidden') === 'true') return false;
    const named = String(a.getAttribute('aria-label') || a.getAttribute('title') || '').trim();
    if (named) return false;
    const text = String(a.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return true;
    return VAGUE_LINK_RE.test(text);
  });
}

/**
 * Simple ADA compliance score for the current page (images + link names).
 * @returns {{ score: number, totalImages: number, missingAlts: number, totalLinks: number, vagueLinks: number, issues: number, checks: number }}
 */
export function computeAdaComplianceScore(root = document) {
  const scope = root?.querySelectorAll ? root : document;
  const imgs = [...(scope.querySelectorAll?.('main img, main picture img') || [])].filter(
    (img) => !img.closest('.forge-edit-badge, .forge-edit-media-toolbar, .forge-edit-banner'),
  );
  const links = [...(scope.querySelectorAll?.('main a[href]') || [])].filter(
    (a) => !a.closest('.forge-edit-badge, .forge-edit-media-toolbar, .forge-edit-banner'),
  );
  const missingAlts = listImagesNeedingAlt(scope).length;
  const vagueLinks = listVagueLinks(scope).length;
  const checks = imgs.length + links.length;
  const issues = missingAlts + vagueLinks;
  const score = checks === 0 ? 100 : Math.max(0, Math.round(((checks - issues) / checks) * 100));
  return {
    score,
    totalImages: imgs.length,
    missingAlts,
    totalLinks: links.length,
    vagueLinks,
    issues,
    checks,
  };
}

export function refreshAdaMediaFlags(root = document) {
  const scope = root.querySelectorAll ? root : document;
  scope.querySelectorAll?.('img')?.forEach((img) => {
    if (img.closest('.forge-edit-media-toolbar, .forge-edit-banner, .forge-edit-badge')) return;
    const missing =
      !img.hasAttribute('alt') ||
      (String(img.getAttribute('alt') || '').trim() === '' &&
        img.dataset.forgeDecorative !== '1' &&
        img.getAttribute('aria-hidden') !== 'true');
    img.classList.toggle('forge-edit-media--needs-alt', missing);
  });
  try {
    window.dispatchEvent(new CustomEvent('forge-ada-score-refresh'));
  } catch {
    /* ignore */
  }
}

export function closeAdaToolbar() {
  document.querySelectorAll('.forge-edit-media-toolbar').forEach((n) => n.remove());
}

function placeToolbar(toolbar, anchorEl) {
  const rect = anchorEl.getBoundingClientRect();
  const top = Math.min(window.innerHeight - 12, Math.max(12, rect.bottom + 8));
  const left = Math.min(window.innerWidth - 320, Math.max(12, rect.left));
  toolbar.style.top = `${top + window.scrollY}px`;
  toolbar.style.left = `${left + window.scrollX}px`;
}

/**
 * ADA panel for an image: URL + alt text + decorative toggle.
 */
export function openImageAdaPanel(img, { onDirty } = {}) {
  if (!img) return;
  closeAdaToolbar();

  const currentSrc = img.getAttribute('src') || '';
  const currentAlt = img.hasAttribute('alt') ? img.getAttribute('alt') : '';
  const decorative =
    img.dataset.forgeDecorative === '1' ||
    (img.getAttribute('aria-hidden') === 'true' && currentAlt === '');

  const toolbar = document.createElement('div');
  toolbar.className = 'forge-edit-media-toolbar';
  toolbar.setAttribute('role', 'dialog');
  toolbar.setAttribute('aria-label', 'ADA image settings');
  toolbar.innerHTML = `
    <header>
      <strong>ADA · Image</strong>
      <button type="button" class="forge-edit-media-toolbar__close" aria-label="Close">×</button>
    </header>
    <label class="forge-edit-media-toolbar__field">
      <span>Image URL</span>
      <input type="url" name="src" value="${escapeAttr(currentSrc)}" autocomplete="off" />
    </label>
    <label class="forge-edit-media-toolbar__field">
      <span>Alt text</span>
      <input type="text" name="alt" value="${escapeAttr(currentAlt)}" autocomplete="off"
        placeholder="Describe the image for screen readers" ${decorative ? 'disabled' : ''} />
    </label>
    <label class="forge-edit-media-toolbar__check">
      <input type="checkbox" name="decorative" ${decorative ? 'checked' : ''} />
      <span>Decorative (empty alt, hide from assistive tech)</span>
    </label>
    <p class="forge-edit-media-toolbar__hint">ADA / WCAG: informative images need meaningful alt text.</p>
    <footer>
      <button type="button" data-action="cancel">Cancel</button>
      <button type="button" class="primary" data-action="apply">Apply</button>
    </footer>
  `;

  document.body.append(toolbar);
  placeToolbar(toolbar, img);

  const srcInput = toolbar.querySelector('input[name="src"]');
  const altInput = toolbar.querySelector('input[name="alt"]');
  const decorativeInput = toolbar.querySelector('input[name="decorative"]');

  decorativeInput?.addEventListener('change', () => {
    const on = Boolean(decorativeInput.checked);
    if (altInput) {
      altInput.disabled = on;
      if (on) altInput.value = '';
    }
  });

  const dismiss = () => closeAdaToolbar();

  toolbar.querySelector('.forge-edit-media-toolbar__close')?.addEventListener('click', dismiss);
  toolbar.querySelector('[data-action="cancel"]')?.addEventListener('click', dismiss);
  toolbar.querySelector('[data-action="apply"]')?.addEventListener('click', () => {
    const url = (srcInput?.value || '').trim();
    if (url) {
      img.src = url;
      const pic = img.closest('picture');
      if (pic) {
        pic.querySelectorAll('source').forEach((s) => s.setAttribute('srcset', url));
      }
    }

    if (decorativeInput?.checked) {
      img.setAttribute('alt', '');
      img.setAttribute('aria-hidden', 'true');
      img.dataset.forgeDecorative = '1';
    } else {
      img.setAttribute('alt', (altInput?.value || '').trim());
      img.removeAttribute('aria-hidden');
      delete img.dataset.forgeDecorative;
    }

    img.classList.add('forge-edit-field--dirty');
    img.title = 'Click to edit image URL and ADA alt text';
    refreshAdaMediaFlags(document);
    onDirty?.();
    dismiss();
  });

  srcInput?.focus();
}

/**
 * ADA panel for a link/button CTA: optional URL + accessible name (aria-label).
 * Native <button> omits the URL field.
 */
export function openLinkAdaPanel(anchor, { onDirty } = {}) {
  if (!anchor) return;
  closeAdaToolbar();

  const isNativeButton = anchor.tagName === 'BUTTON';
  const currentHref = isNativeButton ? '' : anchor.getAttribute('href') || '';
  const currentLabel = anchor.getAttribute('aria-label') || anchor.getAttribute('title') || '';
  const visible = (anchor.textContent || '').trim();

  const toolbar = document.createElement('div');
  toolbar.className = 'forge-edit-media-toolbar';
  toolbar.setAttribute('role', 'dialog');
  toolbar.setAttribute('aria-label', isNativeButton ? 'Button settings' : 'Button / link settings');
  toolbar.innerHTML = `
    <header>
      <strong>${isNativeButton ? 'Button' : 'Button / CTA'}</strong>
      <button type="button" class="forge-edit-media-toolbar__close" aria-label="Close">×</button>
    </header>
    <label class="forge-edit-media-toolbar__field">
      <span>Button label</span>
      <input type="text" name="labelText" value="${escapeAttr(visible)}" autocomplete="off" />
    </label>
    ${
      isNativeButton
        ? ''
        : `<label class="forge-edit-media-toolbar__field">
      <span>Link URL</span>
      <input type="url" name="href" value="${escapeAttr(currentHref)}" autocomplete="off" />
    </label>`
    }
    <label class="forge-edit-media-toolbar__field">
      <span>Accessible name</span>
      <input type="text" name="ariaLabel" value="${escapeAttr(currentLabel)}" autocomplete="off"
        placeholder="Optional aria-label when visible text is unclear" />
    </label>
    <p class="forge-edit-media-toolbar__hint">Edit the label here or click the button text on the page. Use accessible name when the label alone is vague (e.g. “Learn more”).</p>
    <footer>
      <button type="button" data-action="cancel">Cancel</button>
      <button type="button" class="primary" data-action="apply">Apply</button>
    </footer>
  `;

  document.body.append(toolbar);
  placeToolbar(toolbar, anchor);

  const textInput = toolbar.querySelector('input[name="labelText"]');
  const hrefInput = toolbar.querySelector('input[name="href"]');
  const labelInput = toolbar.querySelector('input[name="ariaLabel"]');

  const dismiss = () => closeAdaToolbar();
  toolbar.querySelector('.forge-edit-media-toolbar__close')?.addEventListener('click', dismiss);
  toolbar.querySelector('[data-action="cancel"]')?.addEventListener('click', dismiss);
  toolbar.querySelector('[data-action="apply"]')?.addEventListener('click', () => {
    const nextText = (textInput?.value || '').trim();
    if (nextText && nextText !== (anchor.textContent || '').trim()) {
      // Keep simple text CTAs as a single text node (EDS button pattern).
      if (!anchor.querySelector('img, picture, svg')) {
        anchor.textContent = nextText;
      }
    }
    if (!isNativeButton) {
      const href = (hrefInput?.value || '').trim();
      if (href) anchor.setAttribute('href', href);
    }
    const label = (labelInput?.value || '').trim();
    if (label) {
      anchor.setAttribute('aria-label', label);
    } else {
      anchor.removeAttribute('aria-label');
    }
    anchor.classList.add('forge-edit-field--dirty');
    onDirty?.();
    dismiss();
  });

  (textInput || hrefInput)?.focus();
}

/**
 * Open ADA panel for the nearest image or link under a click/context target.
 * @returns {boolean} true if a panel was opened
 */
export function openAdaPanelForTarget(target, { onDirty } = {}) {
  if (!target?.closest) return false;
  const img = target.closest('img') || target.closest('picture')?.querySelector('img');
  if (img && !img.closest('.forge-edit-media-toolbar')) {
    openImageAdaPanel(img, { onDirty });
    return true;
  }
  const cta = target.closest('a[href], button');
  if (cta && !isForgeEditChrome(cta) && !cta.closest('.forge-edit-media-toolbar')) {
    openLinkAdaPanel(cta, { onDirty });
    return true;
  }
  return false;
}

export function instrumentEditableFields(blockEl, { onDirty } = {}) {
  if (!blockEl || blockEl.dataset.forgeFieldsReady) return;
  blockEl.dataset.forgeFieldsReady = '1';

  blockEl.querySelectorAll(TEXT_TAGS).forEach((el) => {
    if (!isLeafTextField(el)) return;
    makeTextEditable(el, { onDirty });
  });

  // EDS button CTAs (<a class="button">) + native <button> labels.
  blockEl.querySelectorAll(CTA_TAGS).forEach((el) => {
    if (!isLeafTextField(el)) return;
    makeTextEditable(el, { onDirty });
    el.addEventListener('click', (e) => {
      if (isEditModeActive()) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
    el.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openLinkAdaPanel(el, { onDirty });
    });
  });

  blockEl.querySelectorAll('picture, img').forEach((el) => {
    if (el.closest('.forge-edit-badge, .forge-edit-delete, .forge-edit-media-toolbar')) return;
    const img = el.tagName === 'IMG' ? el : el.querySelector('img');
    if (!img) return;
    img.classList.add('forge-edit-media');
    img.title = 'Click to edit image URL and ADA alt text';
    img.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openImageAdaPanel(img, { onDirty });
    });
  });

  refreshAdaMediaFlags(blockEl);
}
