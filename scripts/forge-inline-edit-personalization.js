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

function ensureVariantShells(blockEl, config) {
  const variants = config.variants || [{ id: 'default', label: 'Everyone', isDefault: true }];
  const existing = [...blockEl.querySelectorAll(`:scope > [${VARIANT_ATTR}]`)];
  if (existing.length >= variants.length) {
    variants.forEach((v, i) => {
      const shell = existing[i];
      if (!shell) return;
      shell.setAttribute(VARIANT_ATTR, v.id);
      shell.dataset.forgeVariantLabel = v.label;
      if (v.audienceId) shell.dataset.forgeVariantAudience = v.audienceId;
    });
    return;
  }

  if (existing.length === 0 && variants.length <= 1) {
    const wrap = document.createElement('div');
    wrap.setAttribute(VARIANT_ATTR, 'default');
    wrap.dataset.forgeVariantLabel = 'Everyone';
    while (blockEl.firstChild && !blockEl.firstChild.classList?.contains('forge-edit-badge')) {
      wrap.append(blockEl.firstChild);
    }
    const badge = blockEl.querySelector('.forge-edit-badge');
    if (wrap.childNodes.length) blockEl.insertBefore(wrap, badge);
    return;
  }

  const badge = blockEl.querySelector('.forge-edit-badge');
  const contentNodes = [...blockEl.childNodes].filter(
    (n) => n.nodeType === 1 && !n.classList?.contains('forge-edit-badge') && !n.hasAttribute?.(VARIANT_ATTR),
  );
  if (!contentNodes.length) return;

  const defaultWrap = document.createElement('div');
  defaultWrap.setAttribute(VARIANT_ATTR, 'default');
  defaultWrap.dataset.forgeVariantLabel = 'Everyone';
  contentNodes.forEach((n) => defaultWrap.append(n));
  blockEl.insertBefore(defaultWrap, badge);

  for (let i = 1; i < variants.length; i++) {
    const v = variants[i];
    const clone = defaultWrap.cloneNode(true);
    clone.setAttribute(VARIANT_ATTR, v.id);
    clone.dataset.forgeVariantLabel = v.label;
    if (v.audienceId) clone.dataset.forgeVariantAudience = v.audienceId;
    clone.setAttribute('hidden', '');
    blockEl.insertBefore(clone, badge);
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

export function setPreviewSegmentId(segmentId) {
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
  syncAllPersonalizedBlocks();
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

export function mountPreviewSegmentControl(bannerEl, segments = []) {
  if (!bannerEl || bannerEl.querySelector('.forge-edit-segment-preview')) return;

  const wrap = document.createElement('label');
  wrap.className = 'forge-edit-segment-preview';
  wrap.title = 'Simulate RT CDP segment on preview (authoring only)';

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
  sel.addEventListener('change', () => {
    setPreviewSegmentId(sel.value);
    const u = new URL(window.location.href);
    if (sel.value) u.searchParams.set('forge-preview-segment', sel.value);
    else u.searchParams.delete('forge-preview-segment');
    window.history.replaceState({}, '', u.toString());
  });

  const saveBtn = bannerEl.querySelector('.forge-edit-banner__save');
  if (saveBtn) bannerEl.insertBefore(wrap, saveBtn);
  else bannerEl.append(wrap);

  loadCatalog(resolveForgeApiBase()).then((cat) => {
    const segs = cat.segments || [];
    sel.innerHTML =
      `<option value="">Preview: default</option>` +
      segs
        .filter((s) => !s.isDefault && s.id !== 'seg-all-visitors')
        .map((s) => `<option value="${escapeAttr(s.id)}">${escapeHtml(s.name)}</option>`)
        .join('');
    if (current) sel.value = current;
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
