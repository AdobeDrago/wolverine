/**
 * Runtime segment visibility for saved personalization metadata (no edit chrome).
 * Preview: ?forge-preview-segment=seg-family-texas
 */
(function () {
  const VARIANT_ATTR = 'data-forge-variant';
  const PERSONALIZATION_ATTR = 'data-forge-personalization';

  function forgeQueryParams(search) {
    const raw = String(search || window.location.search || '').replace(/^\?/, '');
    return new URLSearchParams(raw.split('?').join('&'));
  }

  function segmentFromContext() {
    const params = forgeQueryParams();
    return (
      params.get('forge-preview-segment') ||
      params.get('forge-segment') ||
      window.__forgeResolvedSegmentId ||
      ''
    );
  }

  function journeyFromContext() {
    const params = forgeQueryParams();
    return params.get('forge-preview-journey') || params.get('forge-journey') || '';
  }

  function variantShells(blockEl) {
    const direct = [...blockEl.querySelectorAll(`:scope > [${VARIANT_ATTR}]`)];
    if (direct.length) return direct;
    const wrap = blockEl.querySelector(':scope > div');
    if (wrap) return [...wrap.querySelectorAll(`:scope > [${VARIANT_ATTR}]`)];
    return [...blockEl.querySelectorAll(`[${VARIANT_ATTR}]`)].filter(
      (el) => !el.parentElement?.closest?.(`[${VARIANT_ATTR}]`) || el.parentElement?.getAttribute(VARIANT_ATTR),
    );
  }

  function syncBlock(blockEl, segmentId, journeyId) {
    const raw = blockEl.getAttribute(PERSONALIZATION_ATTR);
    if (!raw) return;
    let config;
    try {
      config = JSON.parse(raw);
    } catch {
      return;
    }
    if (!config.enabled) return;

    const shells = variantShells(blockEl);
    if (!shells.length) return;

    const offerMode = config.variantMode === 'offer' || /^family-line-\d/.test(config.offerPlacement || '');
    const journeyMode =
      config.variantMode === 'journey' ||
      ((config.offerPlacement || '').includes('persona-plan') && !offerMode) ||
      (config.offerPlacement || '').startsWith('persona-plan-switch-');

    if (offerMode) {
      if (!segmentId || segmentId === 'seg-all-visitors') {
        shells.forEach((shell) => {
          if (shell.getAttribute(VARIANT_ATTR) === 'default') shell.removeAttribute('hidden');
          else shell.setAttribute('hidden', '');
        });
        return;
      }
      let matched = false;
      shells.forEach((shell) => {
        const aud = shell.dataset.forgeVariantAudience || '';
        const show = aud === segmentId || shell.getAttribute(VARIANT_ATTR) === `var-${segmentId}`;
        if (show) {
          shell.removeAttribute('hidden');
          matched = true;
        } else {
          shell.setAttribute('hidden', '');
        }
      });
      if (!matched) shells.find((s) => s.getAttribute(VARIANT_ATTR) === 'default')?.removeAttribute('hidden');
      return;
    }

    if (journeyMode) {
      if (!journeyId) {
        shells.forEach((shell, i) => {
          if (i === 0) shell.removeAttribute('hidden');
          else shell.setAttribute('hidden', '');
        });
        return;
      }
      let matched = false;
      shells.forEach((shell) => {
        const jrn = shell.dataset.forgeVariantJourney || '';
        const show = jrn === journeyId || shell.getAttribute(VARIANT_ATTR) === `jrn-${journeyId}`;
        if (show) {
          shell.removeAttribute('hidden');
          matched = true;
        } else {
          shell.setAttribute('hidden', '');
        }
      });
      if (!matched) shells[0]?.removeAttribute('hidden');
      return;
    }

    let matched = false;
    shells.forEach((shell) => {
      const aud = shell.dataset.forgeVariantAudience || '';
      const isDefault = shell.getAttribute(VARIANT_ATTR) === 'default' || !aud;
      const show =
        !segmentId || segmentId === 'seg-all-visitors'
          ? isDefault
          : aud === segmentId ||
            shell.getAttribute(VARIANT_ATTR) === segmentId ||
            shell.getAttribute(VARIANT_ATTR) === `var-${segmentId}`;
      if (show) {
        shell.removeAttribute('hidden');
        matched = true;
      } else {
        shell.setAttribute('hidden', '');
      }
    });
    if (!matched && segmentId) {
      shells.find((s) => s.getAttribute(VARIANT_ATTR) === 'default')?.removeAttribute('hidden');
    }
  }

  function run() {
    const segmentId = segmentFromContext();
    const journeyId = journeyFromContext();
    document.querySelectorAll(`[${PERSONALIZATION_ATTR}]`).forEach((el) => {
      if (el.closest('footer')) return;
      syncBlock(el, segmentId, journeyId);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  window.addEventListener('forge:preview-segment', run);
  window.addEventListener('popstate', run);
})();
