/**
 * Inline-edit personalization: RT CDP segments + AJO campaigns/journeys on blocks.
 */

const PERSONALIZATION_ATTR = 'data-forge-personalization';
const VARIANT_ATTR = 'data-forge-variant';
const PREVIEW_SEGMENT_KEY = 'forge_preview_segment';
const PREVIEW_JOURNEY_KEY = 'forge_preview_journey';

let catalogCache = null;
let catalogPromise = null;

export function readBlockPersonalization(blockEl) {
  const raw = blockEl?.getAttribute?.(PERSONALIZATION_ATTR);
  if (!raw) {
    return {
      enabled: false,
      audienceId: '',
      audienceName: '',
      campaignId: '',
      campaignName: '',
      journeyId: '',
      journeyName: '',
      offerPlacement: '',
      variants: [{ id: 'default', label: 'Everyone', audienceId: '', isDefault: true }],
    };
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {
      enabled: false,
      audienceId: '',
      audienceName: '',
      campaignId: '',
      campaignName: '',
      journeyId: '',
      journeyName: '',
      offerPlacement: '',
      variants: [{ id: 'default', label: 'Everyone', audienceId: '', isDefault: true }],
    };
  }
}

export function writeBlockPersonalization(blockEl, config) {
  if (!blockEl) return;
  const payload = {
    ...config,
    enabled: Boolean(config.enabled),
    updatedAt: new Date().toISOString(),
  };
  if (!payload.enabled && !payload.audienceId && !payload.campaignId) {
    blockEl.removeAttribute(PERSONALIZATION_ATTR);
    blockEl.classList.remove('forge-edit-block--personalized');
    updatePersonalizationBadge(blockEl);
    syncVariantVisibility(blockEl, getPreviewSegmentId());
    return;
  }
  blockEl.setAttribute(PERSONALIZATION_ATTR, JSON.stringify(payload));
  blockEl.classList.add('forge-edit-block--personalized');
  ensureVariantShells(blockEl, payload);
  updatePersonalizationBadge(blockEl);
  syncVariantVisibility(blockEl, getPreviewSegmentId());
}

function isForgeEditChromeNode(el) {
  return Boolean(
    el?.classList?.contains('forge-edit-badge') || el?.classList?.contains('forge-edit-delete'),
  );
}

/** Variant shells may be direct children or nested in one wrapper div (Wolverine DA). */
function variantShellContext(blockEl) {
  if (!blockEl) return { shells: [], container: null, insertBefore: null };
  const direct = [...blockEl.querySelectorAll(`:scope > [${VARIANT_ATTR}]`)];
  const chromeAnchor =
    blockEl.querySelector(':scope > .forge-edit-badge') ||
    blockEl.querySelector(':scope > .forge-edit-delete');
  if (direct.length) {
    return {
      shells: direct,
      container: blockEl,
      insertBefore: chromeAnchor,
    };
  }
  const wrap = [...blockEl.children].find(
    (el) => el.tagName === 'DIV' && !isForgeEditChromeNode(el),
  );
  if (wrap) {
    const nested = [...wrap.querySelectorAll(`:scope > [${VARIANT_ATTR}]`)];
    if (nested.length) {
      return { shells: nested, container: wrap, insertBefore: null };
    }
  }
  return {
    shells: [],
    container: blockEl,
    insertBefore: chromeAnchor,
  };
}

function findShellForVariant(shells, variant) {
  if (!variant) return null;
  return (
    shells.find((s) => s.getAttribute(VARIANT_ATTR) === variant.id) ||
    (variant.audienceId
      ? shells.find((s) => s.dataset.forgeVariantAudience === variant.audienceId)
      : null) ||
    null
  );
}

function applyVariantShellMeta(shell, variant) {
  if (!shell || !variant) return;
  shell.setAttribute(VARIANT_ATTR, variant.id);
  shell.dataset.forgeVariantLabel = variant.label || variant.id;
  if (variant.audienceId) shell.dataset.forgeVariantAudience = variant.audienceId;
  else delete shell.dataset.forgeVariantAudience;
  if (variant.journeyId) shell.dataset.forgeVariantJourney = variant.journeyId;
}

function ensureVariantShells(blockEl, config) {
  const variants = config.variants || [{ id: 'default', label: 'Everyone', isDefault: true }];
  let { shells, container, insertBefore } = variantShellContext(blockEl);

  if (shells.length === 0 && variants.length <= 1) {
    const wrap = document.createElement('div');
    wrap.setAttribute(VARIANT_ATTR, 'default');
    wrap.dataset.forgeVariantLabel = 'Everyone';
    while (blockEl.firstChild && !isForgeEditChromeNode(blockEl.firstChild)) {
      wrap.append(blockEl.firstChild);
    }
    const chrome =
      blockEl.querySelector('.forge-edit-badge') || blockEl.querySelector('.forge-edit-delete');
    if (wrap.childNodes.length) blockEl.insertBefore(wrap, chrome);
    return;
  }

  if (shells.length === 0) {
    const contentNodes = [...blockEl.childNodes].filter(
      (n) =>
        n.nodeType === 1 &&
        !isForgeEditChromeNode(n) &&
        !n.hasAttribute?.(VARIANT_ATTR),
    );
    if (!contentNodes.length) return;
    const defaultWrap = document.createElement('div');
    defaultWrap.setAttribute(VARIANT_ATTR, 'default');
    defaultWrap.dataset.forgeVariantLabel = 'Everyone';
    contentNodes.forEach((n) => defaultWrap.append(n));
    blockEl.insertBefore(defaultWrap, insertBefore);
    shells = [defaultWrap];
    container = blockEl;
  }

  const defaultShell =
    findShellForVariant(shells, { id: 'default' }) ||
    shells.find((s) => !s.dataset.forgeVariantAudience) ||
    shells[0];
  if (!defaultShell || !container) return;

  for (const variant of variants) {
    let shell = findShellForVariant(shells, variant);
    if (shell) {
      applyVariantShellMeta(shell, variant);
      continue;
    }
    const clone = defaultShell.cloneNode(true);
    applyVariantShellMeta(clone, variant);
    if (variant.id !== 'default' && !variant.isDefault) clone.setAttribute('hidden', '');
    else clone.removeAttribute('hidden');
    if (insertBefore && container === blockEl) container.insertBefore(clone, insertBefore);
    else container.append(clone);
    shells.push(clone);
  }
}

export function updatePersonalizationBadge(blockEl) {
  const badge = blockEl?.querySelector?.('.forge-edit-badge');
  if (!badge) return;
  const meta = classifyBlockMeta?.(blockEl) || { label: 'Block', category: 'content' };
  const p = readBlockPersonalization(blockEl);
  let suffix = '';
  if (p.enabled && p.audienceName) suffix = ` · ${p.audienceName}`;
  else if (p.enabled && p.campaignName) suffix = ` · ${p.campaignName}`;
  else if (p.enabled) suffix = ' · personalized';
  badge.textContent = `${meta.label} (${meta.category})${suffix}`;
}

let classifyBlockMeta = null;
export function setClassifyBlockMeta(fn) {
  classifyBlockMeta = fn;
}

export function getPreviewSegmentId() {
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('forge-preview-segment') || params.get('forge-segment');
    if (q) return q;
    if (typeof window !== 'undefined' && window.ForgeExperience) {
      const preview = ForgeExperience.get('preview');
      if (preview?.segmentId) return preview.segmentId;
    }
    return sessionStorage.getItem(PREVIEW_SEGMENT_KEY) || '';
  } catch {
    return '';
  }
}

export function getPreviewJourneyId() {
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('forge-preview-journey') || params.get('forge-journey');
    if (q) return q;
    if (typeof window !== 'undefined' && window.ForgeExperience) {
      const preview = ForgeExperience.get('preview');
      if (preview?.journeyId) return preview.journeyId;
    }
    return sessionStorage.getItem(PREVIEW_JOURNEY_KEY) || '';
  } catch {
    return '';
  }
}

export function setPreviewJourneyId(journeyId) {
  try {
    if (typeof window !== 'undefined' && window.ForgeExperience) {
      const prev = ForgeExperience.get('preview') || {};
      ForgeExperience.patchNs('preview', { ...prev, journeyId: journeyId || '' });
    }
    if (journeyId) sessionStorage.setItem(PREVIEW_JOURNEY_KEY, journeyId);
    else sessionStorage.removeItem(PREVIEW_JOURNEY_KEY);
  } catch {
    /* ignore */
  }
  syncAllPersonalizedBlocks();
}

export function setPreviewSegmentId(segmentId, { syncOnly = false } = {}) {
  try {
    if (typeof window !== 'undefined' && window.ForgeExperience) {
      const prev = ForgeExperience.get('preview') || {};
      ForgeExperience.patchNs('preview', { ...prev, segmentId: segmentId || '' });
    }
    if (segmentId) sessionStorage.setItem(PREVIEW_SEGMENT_KEY, segmentId);
    else sessionStorage.removeItem(PREVIEW_SEGMENT_KEY);
  } catch {
    /* ignore */
  }
  if (!syncOnly) {
    ensureEditingShellsForPreviewSegment(segmentId);
    syncAllPersonalizedBlocks();
  }
}

/**
 * Persist preview segment and fully reload so persona landings reboot
 * (grid vs campaign) and variant shells remount for the selected audience.
 */
export function navigateToPreviewSegment(segmentId, { catalog, confirmIfDirty } = {}) {
  const nextId = segmentId || '';
  if (typeof confirmIfDirty === 'function' && confirmIfDirty()) {
    const ok = window.confirm(
      'You have unsaved edits. Switch segment and reload anyway? Unsaved changes will be lost.',
    );
    if (!ok) return false;
  }

  setPreviewSegmentId(nextId, { syncOnly: true });

  const u = new URL(window.location.href);
  if (nextId) u.searchParams.set('forge-preview-segment', nextId);
  else u.searchParams.delete('forge-preview-segment');
  u.searchParams.delete('forge-segment');
  u.searchParams.set('_t', String(Date.now()));

  const personas = catalog?.personas || [];
  const persona = personas.find((p) => (p.rtcdp?.segmentId || `seg-${p.id}`) === nextId);
  const landingPath = persona?.landing?.path || persona?.id;
  const onPersonaLanding = /\/(family-texas|college-student|single-woman-nyc)\/?$/.test(u.pathname);
  // Only hop between persona landings when already on one — keep home/other pages in place.
  if (landingPath && onPersonaLanding) {
    const want = `/${String(landingPath).replace(/^\//, '')}`;
    if (u.pathname.replace(/\/$/, '') !== want.replace(/\/$/, '')) {
      u.pathname = want;
    }
  }

  window.location.assign(u.toString());
  return true;
}

/** Ensure each personalized block has a content shell for the preview segment before editing/save. */
export function ensureEditingShellsForPreviewSegment(segmentId) {
  if (!segmentId || segmentId === 'seg-all-visitors') return;

  document.querySelectorAll(`[${PERSONALIZATION_ATTR}], .forge-edit-block--personalized`).forEach((blockEl) => {
    const config = readBlockPersonalization(blockEl);
    if (!config.enabled && !blockEl.hasAttribute(PERSONALIZATION_ATTR)) return;
    if (!config.enabled) return;

    const variants = Array.isArray(config.variants) ? [...config.variants] : [];
    if (!variants.some((v) => v.id === 'default' || v.isDefault)) {
      variants.unshift({ id: 'default', label: 'Everyone', audienceId: '', isDefault: true });
    }
    const hasAudience = variants.some(
      (v) => v.audienceId === segmentId || v.id === `var-${segmentId}` || v.id === segmentId,
    );
    if (!hasAudience) {
      const label =
        catalogCache?.segments?.find((s) => s.id === segmentId)?.name ||
        catalogCache?.personas?.find((p) => (p.rtcdp?.segmentId || `seg-${p.id}`) === segmentId)?.label ||
        segmentId;
      variants.push({
        id: `var-${segmentId}`,
        label,
        audienceId: segmentId,
        audienceName: label,
      });
    }
    config.variants = variants;
    config.enabled = true;
    writeBlockPersonalization(blockEl, config);
  });
}

/**
 * Before DA save: keep default shells intact and persist edits under the active segment variant.
 * Returns a short status for the toast/UI.
 */
export function preparePersonalizedBlocksForSegmentSave(segmentId) {
  if (!segmentId || segmentId === 'seg-all-visitors') {
    document.querySelectorAll(`[${VARIANT_ATTR}]`).forEach((el) => el.removeAttribute('hidden'));
    return { segmentId: '', variantCount: 0 };
  }

  ensureEditingShellsForPreviewSegment(segmentId);
  let variantCount = 0;

  document.querySelectorAll(`[${PERSONALIZATION_ATTR}], .forge-edit-block--personalized`).forEach((blockEl) => {
    const config = readBlockPersonalization(blockEl);
    if (!config.enabled) return;
    const { shells } = variantShellContext(blockEl);
    const variantMeta = (config.variants || []).find(
      (v) => v.audienceId === segmentId || v.id === `var-${segmentId}` || v.id === segmentId,
    );
    const target = findShellForVariant(shells, variantMeta || { id: `var-${segmentId}`, audienceId: segmentId });
    if (target) variantCount += 1;
  });

  document.querySelectorAll(`[${VARIANT_ATTR}]`).forEach((el) => el.removeAttribute('hidden'));
  return { segmentId, variantCount };
}

function syncAllPersonalizedBlocks() {
  const seg = getPreviewSegmentId();
  document.querySelectorAll('.forge-edit-block').forEach((el) => {
    syncVariantVisibility(el, seg);
  });
  document.querySelectorAll('.forge-plan-offer[data-forge-personalization]').forEach((el) => {
    if (!el.classList.contains('forge-edit-block')) syncVariantVisibility(el, seg);
  });
}

export function syncVariantVisibility(blockEl, previewSegmentId) {
  const config = readBlockPersonalization(blockEl);
  if (!config.enabled) {
    blockEl.querySelectorAll(`[${VARIANT_ATTR}]`).forEach((shell) => {
      shell.removeAttribute('hidden');
    });
    return;
  }

  const shells = [
    ...blockEl.querySelectorAll(`:scope > div > [${VARIANT_ATTR}], :scope > [${VARIANT_ATTR}]`),
  ];
  if (!shells.length) return;

  const previewJourneyId = getPreviewJourneyId();
  const offerMode = config.variantMode === 'offer' || /^family-line-\d/.test(config.offerPlacement || '');
  const journeyMode =
    config.variantMode === 'journey' ||
    (config.offerPlacement?.includes('persona-plan') && !offerMode) ||
    (config.offerPlacement || '').startsWith('persona-plan-switch-');

  if (offerMode) {
    if (!previewSegmentId || previewSegmentId === 'seg-all-visitors') {
      for (const shell of shells) {
        const isDefault = shell.getAttribute(VARIANT_ATTR) === 'default';
        if (isDefault) shell.removeAttribute('hidden');
        else shell.setAttribute('hidden', '');
      }
      return;
    }
  }

  if (offerMode && previewSegmentId) {
    let matched = false;
    for (const shell of shells) {
      const aud = shell.dataset.forgeVariantAudience || '';
      const isDefault = shell.getAttribute(VARIANT_ATTR) === 'default' || !aud;
      const show = aud === previewSegmentId || shell.getAttribute(VARIANT_ATTR) === `var-${previewSegmentId}`;
      if (show) {
        shell.removeAttribute('hidden');
        matched = true;
      } else if (!isDefault) {
        shell.setAttribute('hidden', '');
      } else {
        shell.setAttribute('hidden', '');
      }
    }
    if (!matched) {
      shells.find((s) => s.getAttribute(VARIANT_ATTR) === 'default')?.removeAttribute('hidden');
    }
    return;
  }

  if (journeyMode && previewJourneyId) {
    let matched = false;
    for (const shell of shells) {
      const jrn = shell.dataset.forgeVariantJourney || '';
      const show = jrn === previewJourneyId || shell.getAttribute(VARIANT_ATTR) === `jrn-${previewJourneyId}`;
      if (show) {
        shell.removeAttribute('hidden');
        matched = true;
      } else {
        shell.setAttribute('hidden', '');
      }
    }
    if (!matched) {
      const def = shells.find((s) => s.getAttribute(VARIANT_ATTR)?.startsWith('jrn-'));
      def?.removeAttribute('hidden');
    }
    return;
  }

  let matched = false;
  for (const shell of shells) {
    const aud = shell.dataset.forgeVariantAudience || '';
    const isDefault = shell.getAttribute(VARIANT_ATTR) === 'default' || !aud;
    const show =
      !previewSegmentId || previewSegmentId === 'seg-all-visitors'
        ? isDefault
        : aud === previewSegmentId || shell.getAttribute(VARIANT_ATTR) === previewSegmentId;
    if (show) {
      shell.removeAttribute('hidden');
      matched = true;
    } else {
      shell.setAttribute('hidden', '');
    }
  }
  if (!matched && previewSegmentId) {
    const def = shells.find((s) => s.getAttribute(VARIANT_ATTR) === 'default');
    def?.removeAttribute('hidden');
  }
}

async function loadCatalog(apiBase) {
  if (catalogCache) return catalogCache;
  if (catalogPromise) return catalogPromise;

  catalogPromise = (async () => {
    const url = apiBase ? `${apiBase}/api/personalization/catalog` : '/api/personalization/catalog';
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        catalogCache = await res.json();
        return catalogCache;
      }
    } catch {
      /* demo fallback below */
    }
    catalogCache = {
      source: 'embedded-demo',
      segments: [
        { id: 'seg-all-visitors', name: 'All visitors', isDefault: true },
        { id: 'seg-new-wireless', name: 'New wireless prospects' },
        { id: 'seg-device-upgrade', name: 'Device upgraders' },
        { id: 'seg-plan-upsell', name: 'Plan upsell — unlimited' },
        { id: 'seg-churn-risk', name: 'Churn risk' },
      ],
      campaigns: [
        { id: 'ajo-camp-spring-devices', name: 'Spring device launch', audienceIds: ['seg-device-upgrade'] },
        { id: 'ajo-camp-plan-upgrade', name: 'Unlimited plan upgrade Q2', audienceIds: ['seg-plan-upsell'] },
      ],
      journeys: [
        { id: 'ajo-jrn-onboarding', name: 'Welcome onboarding', entryAudienceId: 'seg-new-wireless' },
        { id: 'ajo-jrn-upgrade-path', name: 'Device upgrade path', campaignId: 'ajo-camp-spring-devices' },
      ],
    };
    return catalogCache;
  })();

  return catalogPromise;
}

function resolveForgeApiBase() {
  const meta = document.querySelector('meta[name="forge:api"]');
  if (meta?.content) return meta.content.replace(/\/$/, '');
  const params = new URLSearchParams(window.location.search);
  const q = params.get('forge-api');
  return q ? q.replace(/\/$/, '') : '';
}

export async function openPersonalizationPanel(blockEl, { onDirty } = {}) {
  document.querySelector('.forge-edit-dialog-backdrop.forge-personalization-backdrop')?.remove();

  const catalog = await loadCatalog(resolveForgeApiBase());
  const config = readBlockPersonalization(blockEl);
  const segments = catalog.segments || [];
  const campaigns = catalog.campaigns || [];
  const journeys = catalog.journeys || [];

  const backdrop = document.createElement('div');
  backdrop.className = 'forge-edit-dialog-backdrop forge-personalization-backdrop';
  const dialog = document.createElement('div');
  dialog.className = 'forge-edit-dialog forge-personalization-dialog';

  const segOptions = segments
    .map(
      (s) =>
        `<option value="${escapeAttr(s.id)}" ${config.audienceId === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`,
    )
    .join('');

  const campOptions =
    `<option value="">— None —</option>` +
    campaigns
      .map(
        (c) =>
          `<option value="${escapeAttr(c.id)}" ${config.campaignId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`,
      )
      .join('');

  const jrnOptions =
    `<option value="">— None —</option>` +
    journeys
      .map(
        (j) =>
          `<option value="${escapeAttr(j.id)}" ${config.journeyId === j.id ? 'selected' : ''}>${escapeHtml(j.name)}</option>`,
      )
      .join('');

  const journeyMode = config.variantMode === 'journey' || config.offerPlacement?.includes('persona-plan');
  const planJourneyOptions =
    (config.variants || [])
      .filter((v) => v.journeyId)
      .map(
        (v) =>
          `<option value="${escapeAttr(v.journeyId)}" ${config.journeyId === v.journeyId || getPreviewJourneyId() === v.journeyId ? 'selected' : ''}>${escapeHtml(v.label || v.journeyName || v.journeyId)}</option>`,
      )
      .join('') || jrnOptions;

  dialog.innerHTML = `
    <header>Personalization · RT CDP & AJO</header>
    <div class="dialog-body forge-personalization-body">
      <p class="forge-personalization-intro">
        ${
          config.variantMode === 'offer' || config.offerPlacement?.startsWith('family-line-')
            ? 'Map this <strong>plan line offer pill</strong> to RT CDP segments and AJO campaigns. Pick an audience below to preview alternate offer copy, or add variants for additional segments.'
            : (config.offerPlacement || '').startsWith('persona-plan-switch-')
              ? 'Use <strong>Plan type</strong> to preview the alternate secondary plan (black pill). Line prices and row count update on the plan block below.'
              : 'Target this block to a <strong>Real-Time CDP</strong> audience and link an <strong>AJO</strong> campaign or journey. Saved metadata is stored on the block in Document Authoring for Edge Decisioning at runtime.'
        }
      </p>
      ${
        journeyMode
          ? `<div class="forge-personalization-plan-journey">
        <label>Plan type · secondary offer
          <select id="forgePersPlanJourney">${planJourneyOptions}</select>
        </label>
        <p class="forge-personalization-note">Switches the black plan pill and the line prices below. Alternate family plan shows 3 lines (no 4th line).</p>
      </div>`
          : ''
      }
      <label class="forge-personalization-check">
        <input type="checkbox" id="forgePersEnabled" ${config.enabled ? 'checked' : ''} />
        Enable personalization for this block
      </label>
      <div class="forge-personalization-grid">
        <label>RT CDP audience (segment)
          <select id="forgePersAudience">${segOptions}</select>
        </label>
        <label>AJO campaign
          <select id="forgePersCampaign">${campOptions}</select>
        </label>
        <label>AJO journey
          <select id="forgePersJourney">${jrnOptions}</select>
        </label>
        <label>Offer placement / activity key
          <input type="text" id="forgePersPlacement" value="${escapeAttr(config.offerPlacement)}" placeholder="hero-banner-offer-1" />
        </label>
      </div>
      <details class="forge-personalization-variants">
        <summary>Variants (per-audience content shells)</summary>
        <p class="forge-personalization-note">Default variant is visible to all visitors. Add audience-specific variants for segmented copy; use <strong>Preview as segment</strong> in the toolbar to review.</p>
        <div id="forgePersVariantsList"></div>
        <button type="button" class="forge-personalization-add-variant" id="forgePersAddVariant">+ Add variant for selected audience</button>
      </details>
      <p class="forge-personalization-source">Catalog: ${escapeHtml(catalog.source || 'demo')} · <a href="https://experienceleague.adobe.com/en/docs/journey-optimizer/using/decisioning/offer-decisioning/api-reference/offer-delivery-api/edge-decisioning-api" target="_blank" rel="noopener">Edge Decisioning</a></p>
    </div>
    <footer>
      <button type="button" data-action="cancel">Cancel</button>
      <button type="button" class="primary" data-action="apply">Apply to block</button>
    </footer>
  `;

  const variantsList = dialog.querySelector('#forgePersVariantsList');
  const renderVariantsList = () => {
    const cfg = readBlockPersonalization(blockEl);
    variantsList.innerHTML = (cfg.variants || [])
      .map(
        (v) => `
      <div class="forge-variant-row">
        <span class="forge-variant-id">${escapeHtml(v.id)}</span>
        <span>${escapeHtml(v.label)}</span>
        ${v.audienceId ? `<span class="forge-variant-aud">${escapeHtml(v.audienceName || v.audienceId)}</span>` : '<span class="forge-variant-aud">default</span>'}
      </div>`,
      )
      .join('');
  };
  renderVariantsList();

  dialog.querySelector('#forgePersPlanJourney')?.addEventListener('change', () => {
    const jrnId = dialog.querySelector('#forgePersPlanJourney')?.value || '';
    if (!jrnId) return;
    const cfg = readBlockPersonalization(blockEl);
    cfg.journeyId = jrnId;
    const match = (cfg.variants || []).find((v) => v.journeyId === jrnId);
    if (match) {
      cfg.journeyName = match.journeyName || match.label || '';
    } else {
      const j = journeys.find((x) => x.id === jrnId);
      cfg.journeyName = j?.name || '';
    }
    writeBlockPersonalization(blockEl, cfg);
    setPreviewJourneyId(jrnId);
    const u = new URL(window.location.href);
    u.searchParams.set('forge-preview-journey', jrnId);
    window.history.replaceState({}, '', u.toString());
    onDirty?.();
  });

  dialog.querySelector('#forgePersAddVariant')?.addEventListener('click', () => {
    const audSel = dialog.querySelector('#forgePersAudience');
    const audId = audSel?.value || '';
    const audName = audSel?.selectedOptions?.[0]?.textContent || '';
    if (!audId || audId === 'seg-all-visitors') {
      alert('Select a specific RT CDP audience first (not “All visitors”).');
      return;
    }
    const cfg = readBlockPersonalization(blockEl);
    if (cfg.variants.some((v) => v.audienceId === audId)) {
      alert('A variant for this audience already exists.');
      return;
    }
    cfg.variants.push({
      id: `var-${audId}`,
      label: audName,
      audienceId: audId,
      audienceName: audName,
    });
    writeBlockPersonalization(blockEl, cfg);
    renderVariantsList();
    onDirty?.();
  });

  dialog.querySelector('[data-action="cancel"]')?.addEventListener('click', () => backdrop.remove());
  dialog.querySelector('[data-action="apply"]')?.addEventListener('click', () => {
    const enabled = dialog.querySelector('#forgePersEnabled')?.checked;
    const audienceId = dialog.querySelector('#forgePersAudience')?.value || '';
    const audienceName = dialog.querySelector('#forgePersAudience')?.selectedOptions?.[0]?.textContent || '';
    const campaignId = dialog.querySelector('#forgePersCampaign')?.value || '';
    const campaignName = dialog.querySelector('#forgePersCampaign')?.selectedOptions?.[0]?.textContent || '';
    const journeyId =
      dialog.querySelector('#forgePersPlanJourney')?.value ||
      dialog.querySelector('#forgePersJourney')?.value ||
      '';
    const journeyName =
      dialog.querySelector('#forgePersPlanJourney')?.selectedOptions?.[0]?.textContent ||
      dialog.querySelector('#forgePersJourney')?.selectedOptions?.[0]?.textContent ||
      '';
    const offerPlacement = dialog.querySelector('#forgePersPlacement')?.value?.trim() || '';

    const next = readBlockPersonalization(blockEl);
    next.enabled = enabled;
    next.audienceId = audienceId;
    next.audienceName = audienceName;
    next.campaignId = campaignId;
    next.campaignName = campaignName !== '— None —' ? campaignName : '';
    next.journeyId = journeyId;
    next.journeyName = journeyName && journeyName !== '— None —' ? journeyName : '';
    next.offerPlacement = offerPlacement;

    if (journeyId) setPreviewJourneyId(journeyId);

    writeBlockPersonalization(blockEl, next);
    onDirty?.();
    backdrop.remove();
  });

  backdrop.append(dialog);
  document.body.append(backdrop);
}

export function mountPreviewJourneyControl(bannerEl) {
  if (!bannerEl || bannerEl.querySelector('.forge-edit-journey-preview')) return;

  const wrap = document.createElement('label');
  wrap.className = 'forge-edit-journey-preview';
  wrap.title = 'Switch AJO journey / plan type on persona plan blocks (authoring only)';
  wrap.innerHTML = `<span>Journey</span><select class="forge-edit-journey-select"><option value="">Plan: default</option></select>`;
  const sel = wrap.querySelector('select');
  const current = getPreviewJourneyId();
  if (current) sel.value = current;

  sel.addEventListener('change', () => {
    setPreviewJourneyId(sel.value);
    const u = new URL(window.location.href);
    if (sel.value) u.searchParams.set('forge-preview-journey', sel.value);
    else u.searchParams.delete('forge-preview-journey');
    window.history.replaceState({}, '', u.toString());
  });

  const segWrap = bannerEl.querySelector('.forge-edit-segment-preview');
  if (segWrap?.nextSibling) bannerEl.insertBefore(wrap, segWrap.nextSibling);
  else if (segWrap) bannerEl.insertBefore(wrap, segWrap.nextSibling);
  else {
    const saveBtn = bannerEl.querySelector('.forge-edit-banner__save');
    if (saveBtn) bannerEl.insertBefore(wrap, saveBtn);
    else bannerEl.append(wrap);
  }

  loadCatalog(resolveForgeApiBase()).then((cat) => {
    const jrns = cat.journeys || [];
    sel.innerHTML =
      `<option value="">Plan: default</option>` +
      jrns
        .filter((j) => j.personaId || String(j.id).includes('family') || String(j.id).includes('nyc') || String(j.id).includes('college') || String(j.id).includes('student'))
        .map((j) => `<option value="${escapeAttr(j.id)}">${escapeHtml(j.name)}</option>`)
        .join('');
    if (current) sel.value = current;
  });
}

export function mountPreviewSegmentControl(bannerEl, segments = [], { confirmIfDirty } = {}) {
  if (!bannerEl || bannerEl.querySelector('.forge-edit-segment-preview')) return;

  const wrap = document.createElement('label');
  wrap.className = 'forge-edit-segment-preview';
  wrap.title =
    'Reload preview as an RT CDP segment (authoring). Edits save to that segment’s variant; default stays intact.';

  const opts =
    `<option value="">Preview: default</option>` +
    (segments.length ? segments : [{ id: 'seg-new-wireless', name: 'New wireless prospects' }])
      .filter((s) => s.id !== 'seg-all-visitors')
      .map((s) => `<option value="${escapeAttr(s.id)}">${escapeHtml(s.name)}</option>`)
      .join('');

  wrap.innerHTML = `<span>Segment</span><select class="forge-edit-segment-select">${opts}</select>`;
  const sel = wrap.querySelector('select');
  const current = getPreviewSegmentId();
  if (current) sel.value = current;

  let catalog = null;
  const previousValue = () => getPreviewSegmentId() || '';

  sel.addEventListener('change', () => {
    const next = sel.value || '';
    const navigated = navigateToPreviewSegment(next, {
      catalog,
      confirmIfDirty,
    });
    if (!navigated) {
      sel.value = previousValue();
    }
  });

  const saveBtn = bannerEl.querySelector('.forge-edit-banner__save');
  if (saveBtn) bannerEl.insertBefore(wrap, saveBtn);
  else bannerEl.append(wrap);

  if (current) ensureEditingShellsForPreviewSegment(current);

  loadCatalog(resolveForgeApiBase()).then((cat) => {
    catalog = cat;
    const segs = cat.segments || [];
    sel.innerHTML =
      `<option value="">Preview: default</option>` +
      segs
        .filter((s) => !s.isDefault && s.id !== 'seg-all-visitors')
        .map((s) => `<option value="${escapeAttr(s.id)}">${escapeHtml(s.name)}</option>`)
        .join('');
    if (current) {
      sel.value = current;
      ensureEditingShellsForPreviewSegment(current);
    }
  });
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

export function initPersonalizationOnBlock(blockEl, meta, { onDirty, classify }) {
  if (classify) setClassifyBlockMeta(classify);
  const existing = readBlockPersonalization(blockEl);
  if (existing.enabled) {
    writeBlockPersonalization(blockEl, existing);
  }
  updatePersonalizationBadge(blockEl);
  syncVariantVisibility(blockEl, getPreviewSegmentId());
}
