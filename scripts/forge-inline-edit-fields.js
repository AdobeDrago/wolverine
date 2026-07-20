/**
 * Make block content editable on the preview page (text, links, images).
 */

const TEXT_TAGS = 'h1,h2,h3,h4,h5,h6,p,li,em,strong';

export function isLeafTextField(el) {
  if (!el?.matches) return false;
  if (!el.matches(`${TEXT_TAGS},a`)) return false;
  if (el.closest('.forge-edit-badge, .forge-edit-drop-zone')) return false;
  const nested = el.querySelector(`${TEXT_TAGS},a`);
  return !nested || nested === el;
}

export function instrumentEditableFields(blockEl, { onDirty } = {}) {
  if (!blockEl || blockEl.dataset.forgeFieldsReady) return;
  blockEl.dataset.forgeFieldsReady = '1';

  blockEl.querySelectorAll(TEXT_TAGS).forEach((el) => {
    if (!isLeafTextField(el)) return;
    el.classList.add('forge-edit-field');
    el.contentEditable = 'true';
    el.spellcheck = true;
    el.addEventListener('input', () => {
      el.classList.add('forge-edit-field--dirty');
      onDirty?.();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !el.matches('p,li')) e.preventDefault();
    });
  });

  blockEl.querySelectorAll('a[href]').forEach((el) => {
    if (!isLeafTextField(el)) return;
    el.addEventListener('click', (e) => {
      if (isEditModeActive()) e.preventDefault();
    });
    el.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = window.prompt('Link URL', el.getAttribute('href') || '');
      if (next === null) return;
      el.setAttribute('href', next.trim());
      el.classList.add('forge-edit-field--dirty');
      onDirty?.();
    });
  });

  blockEl.querySelectorAll('picture, img').forEach((el) => {
    if (el.closest('.forge-edit-badge')) return;
    const img = el.tagName === 'IMG' ? el : el.querySelector('img');
    if (!img) return;
    img.classList.add('forge-edit-media');
    img.title = 'Click to change image';
    img.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const current = img.getAttribute('src') || '';
      const next = window.prompt('Image URL (path or absolute)', current);
      if (next === null || !next.trim()) return;
      const url = next.trim();
      img.src = url;
      const pic = img.closest('picture');
      if (pic) {
        pic.querySelectorAll('source').forEach((s) => s.setAttribute('srcset', url));
      }
      img.classList.add('forge-edit-field--dirty');
      onDirty?.();
    });
  });
}

function isEditModeActive() {
  return document.documentElement.classList.contains('forge-edit-active');
}
