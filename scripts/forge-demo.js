/**
 * Demo chrome for EchoStar: persona switcher + RT CDP / AJO strip (?forge-demo=1).
 */
import { productBrandName } from './forge-product-brand.js';

const DEMO_BUILD = 7;

function isDemoMode() {
  const p = new URLSearchParams(window.location.search);
  return p.get('forge-demo') === '1' || p.get('forge-demo') === 'true';
}

function resolveApiBase() {
  const meta = document.querySelector('meta[name="forge:api"]');
  if (meta?.content) return meta.content.replace(/\/$/, '');
  const p = new URLSearchParams(window.location.search);
  const q = p.get('forge-api');
  if (q) return q.replace(/\/$/, '');
  return '';
}

function setPreviewSegment(segmentId) {
  try {
    if (window.ForgeExperience) {
      const prev = ForgeExperience.get('preview') || {};
      ForgeExperience.patchNs('preview', { ...prev, segmentId: segmentId || '' });
    }
    if (segmentId) sessionStorage.setItem('forge_preview_segment', segmentId);
    else sessionStorage.removeItem('forge_preview_segment');
  } catch {
    /* ignore */
  }
  const u = new URL(window.location.href);
  if (segmentId) u.searchParams.set('forge-preview-segment', segmentId);
  else u.searchParams.delete('forge-preview-segment');
  window.history.replaceState({}, '', u.toString());
  window.dispatchEvent(new CustomEvent('forge:preview-segment', { detail: { segmentId } }));
}

function formatCount(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString();
}

async function loadCatalog() {
  const base = resolveApiBase();
  const url = base ? `${base}/api/personalization/catalog` : '/api/personalization/catalog';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Catalog ${res.status}`);
  return res.json();
}

function findPersona(catalog, segmentId) {
  const personas = catalog.personas || [];
  return personas.find((p) => (p.rtcdp?.segmentId || `seg-${p.id}`) === segmentId) || null;
}

function mountChrome(catalog) {
  if (document.querySelector('.forge-demo-chrome')) return;

  const personas = catalog.personas || [];
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `/styles/forge-demo-chrome.css?v=${DEMO_BUILD}`;
  document.head.appendChild(link);

  document.body.classList.add('forge-demo-active');

  const current =
    new URLSearchParams(window.location.search).get('forge-preview-segment') ||
    (window.ForgeExperience && ForgeExperience.get('preview')?.segmentId) ||
    sessionStorage.getItem('forge_preview_segment') ||
    '';

  const chrome = document.createElement('div');
  chrome.className = 'forge-demo-chrome';
  chrome.setAttribute('role', 'region');
  chrome.setAttribute('aria-label', 'Campaign demo controls');

  const personaButtons = personas
    .map((p) => {
      const seg = p.rtcdp?.segmentId || `seg-${p.id}`;
      const active = current === seg ? 'active' : '';
      return `<button type="button" data-segment="${seg}" data-persona-id="${p.id}" class="${active}">${p.label}</button>`;
    })
    .join('');

  chrome.innerHTML = `
    <div class="forge-demo-chrome__inner">
      <span class="forge-demo-chrome__brand">${productBrandName()} Demo</span>
      <span class="forge-demo-chrome__meta">RT CDP · AJO · Target</span>
      <div class="forge-demo-personas" id="forgeDemoPersonas">${personaButtons}</div>
      <div class="forge-demo-chrome__actions">
        <button type="button" id="forgeDemoAjoToggle">Journey</button>
        <a href="/?forge-edit=1" class="primary">Edit mode</a>
      </div>
      <div class="forge-demo-ajo-panel" id="forgeDemoAjoPanel"></div>
    </div>
  `;

  document.body.prepend(chrome);

  function renderAjoPanel(persona) {
    const panel = document.getElementById('forgeDemoAjoPanel');
    if (!panel) return;
    if (!persona) {
      panel.innerHTML = '<p class="forge-demo-chrome__meta">Select a persona to see campaign details.</p>';
      return;
    }
    const steps = (persona.journey?.steps || [])
      .map((s) => s.label || s.channel)
      .join(' → ');
    panel.innerHTML = `
      <dl>
        <dt>RT CDP segment</dt><dd>${persona.rtcdp?.segmentName || persona.label} (${formatCount(persona.rtcdp?.primaryTarget)} profiles)</dd>
        <dt>AJO campaign</dt><dd>${persona.ajo?.campaignName || '—'}</dd>
        <dt>AJO journey</dt><dd>${persona.ajo?.journeyName || '—'}</dd>
        <dt>Goal</dt><dd>${persona.campaignGoal || '—'}</dd>
        <dt>Journey steps</dt><dd>${steps || '—'}</dd>
      </dl>
    `;
  }

  let activePersona = findPersona(catalog, current) || personas[0];
  renderAjoPanel(activePersona);

  document.getElementById('forgeDemoPersonas')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-segment]');
    if (!btn) return;
    const seg = btn.getAttribute('data-segment');
    document.querySelectorAll('.forge-demo-personas button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    setPreviewSegment(seg);
    activePersona = findPersona(catalog, seg);
    renderAjoPanel(activePersona);
    const pid = btn.getAttribute('data-persona-id');
    const path = activePersona?.landing?.path || pid;
    if (path && !window.location.pathname.includes(path)) {
      const u = new URL(window.location.href);
      u.pathname = `/${path}`;
      u.searchParams.set('forge-demo', '1');
      u.searchParams.set('forge-preview-segment', seg);
      window.location.href = u.toString();
    }
  });

  document.getElementById('forgeDemoAjoToggle')?.addEventListener('click', () => {
    document.getElementById('forgeDemoAjoPanel')?.classList.toggle('open');
  });
}

async function init() {
  if (!isDemoMode()) return;
  try {
    const catalog = await loadCatalog();
    mountChrome(catalog);
    if (!new URLSearchParams(window.location.search).get('forge-preview-segment') && catalog.personas?.[0]) {
      const seg = catalog.personas[0].rtcdp?.segmentId || `seg-${catalog.personas[0].id}`;
      setPreviewSegment(seg);
    }
  } catch (err) {
    console.warn('[forge-demo]', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
