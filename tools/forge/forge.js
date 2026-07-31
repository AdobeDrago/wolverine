/* FORGE v2.1 - updated 2026-05-01 */
/**
 * FORGE — DA.live Lit plugin
 * Brand-identity-driven EDS site generator.
 */
import { LitElement, html, nothing } from '../../deps/lit/dist/index.js';

const DA_LIVE_UTILS = ['https://da.', 'live/nx/utils/'].join('');

function importDaLiveModule(file) {
  return import(`${DA_LIVE_UTILS}${file}`);
}

async function loadDaSdk() {
  const mod = await importDaLiveModule('sdk.js');
  return mod.default;
}

async function loadDaFetchDirect() {
  const mod = await importDaLiveModule('daFetch.js');
  return mod.daFetch;
}

const EL_NAME = 'forge-app';

const AVAILABLE_PAGES = [
  'home', 'about', 'products', 'services', 'blog',
  'contact', 'pricing', 'faq', 'careers', 'portfolio',
];

const FONT_OPTIONS = [
  'System Default', 'Inter', 'Roboto', 'Open Sans', 'Lato',
  'Montserrat', 'Poppins', 'Playfair Display', 'Merriweather',
  'Source Sans Pro', 'Raleway', 'Oswald', 'PT Sans',
];

const QUICK_PROMPTS = [
  'Make the hero section more impactful',
  'Add a testimonials block',
  'Change the color scheme to be warmer',
  'Make the navigation sticky',
  'Add a call-to-action banner',
  'Improve mobile responsiveness',
];

const WOLVERINE_EMAIL_QUICK_PROMPTS = [
  'Can you build me a email campaign and brief for a Man/Woman, married w/children, 40+ living in Texas with the Acquisition of May 21st to July 1st of 2026',
  'Can you build me a email campaign and brief for a Single Woman ages 25-35 living in NYC with the Acquisition of May 21st to July 1st of 2026',
  'Can you build me a email campaign and brief for a College Students ages 18-24 with the Acquisition of May 21st to July 1st of 2026',
];

/** Match server/brand-slug.js — keep in sync for repo naming. */
function brandToSlug(name) {
  return String(name || 'site')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'site';
}

function looksLikePrompt(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  if (s.split(/\s+/).length >= 6) return true;
  return /\b(create|build|make|new|project|storefront|website|site|named|called)\b/i.test(s);
}

function extractNameFromPrompt(text) {
  const s = String(text || '').trim();
  if (!s) return '';
  const named = s.match(
    /\b(?:named|called)\s+["']?([A-Za-z0-9][A-Za-z0-9\s.'-]{0,48}?)["']?(?:\s*[,.]|$|\s+for\b|\s+with\b)/i,
  );
  if (named?.[1]) return named[1].trim();
  if (looksLikePrompt(s)) {
    const words = s.replace(/[^\w\s'-]/g, ' ').split(/\s+/).filter(Boolean);
    const skip = new Set([
      'a', 'an', 'the', 'new', 'create', 'build', 'make', 'project', 'storefront', 'site',
      'website', 'named', 'called', 'for', 'with', 'and', 'to',
    ]);
    for (let i = words.length - 1; i >= 0; i--) {
      const w = words[i].replace(/[^a-z0-9]/gi, '');
      if (w.length >= 3 && !skip.has(w.toLowerCase())) return w;
    }
  }
  return '';
}

function resolveBrandSlugFromBrief(brief = {}) {
  const siteName = String(brief.siteName || '').trim();
  if (siteName && !looksLikePrompt(siteName)) return brandToSlug(siteName);
  const brandName = String(brief.brandName || '').trim();
  const extracted = extractNameFromPrompt(brandName);
  if (extracted) return brandToSlug(extracted);
  if (brandName && !looksLikePrompt(brandName)) return brandToSlug(brandName);
  const clientName = String(brief.clientName || '').trim();
  if (clientName && !looksLikePrompt(clientName)) return brandToSlug(clientName);
  if (brandName) return brandToSlug(extractNameFromPrompt(brandName) || brandName);
  return brandToSlug(clientName || 'site');
}

/** da.live Canvas — WYSIWYG block editing (Experience Workspace). */
function resolveDaCanvasOrg(githubOrg) {
  return String(window.FORGE_CONFIG?.DA_CANVAS_ORG || githubOrg || '').trim();
}

function buildDaCanvasPreviewUrl(previewBase, { org, repo, canvasUrl } = {}) {
  if (canvasUrl) return canvasUrl;
  if (!org || !repo) return 'https://da.live/canvas#';
  const canvasOrg = resolveDaCanvasOrg(org);
  if (window.ForgeDaCanvasUrl?.buildDaCanvasUrlFromPreview) {
    return ForgeDaCanvasUrl.buildDaCanvasUrlFromPreview(previewBase || `https://main--${repo}--${org}.aem.page/`, {
      org,
      repo,
      daOrg: canvasOrg,
    });
  }
  try {
    const u = new URL(previewBase || `https://main--${repo}--${org}.aem.page/`);
    let p = decodeURIComponent(u.pathname.replace(/^\/+|\/+$/g, ''));
    if (!p || p === 'index.html') p = '';
    else if (p.endsWith('/index.html')) p = p.slice(0, -'/index.html'.length);
    else if (p.endsWith('.html')) p = p.slice(0, -5);
    const parts = [canvasOrg, repo];
    if (p) parts.push(...p.split('/').filter(Boolean));
    return `https://da.live/canvas#/${parts.join('/')}`;
  } catch {
    return `https://da.live/canvas#/${canvasOrg}/${repo}`;
  }
}

class ForgeApp extends LitElement {
  static properties = {
    activeTab: { type: String },
    brief: { type: Object },
    generating: { type: Boolean },
    generationLog: { type: Array },
    previewUrl: { type: String },
    chatMessages: { type: Array },
    siteUrls: { type: Object },
    context: { type: Object },
    authenticated: { type: Boolean },
    _swatchPreview: { type: String, state: true },
    _logoPreview: { type: String, state: true },
    _chatInput: { type: String, state: true },
    _sendingChat: { type: Boolean, state: true },
    _deviceMode: { type: String, state: true },
    _statusMsg: { type: Object, state: true },
    _progress: { type: Number, state: true },
    _swatchResult: { type: Object, state: true },
    _swatchGenerating: { type: Boolean, state: true },
    _swatchStatus: { type: Object, state: true },
    _swatchBrandInput: { type: String, state: true },
    _recentProjects: { type: Array, state: true },
    _lastProjectId: { type: String, state: true },
  };

  /* Render into light DOM so forge.css applies */
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this._loadRecentProjects();
  }

  constructor() {
    super();
    this.activeTab = 'dashboard';
    this.brief = {
      brandName: '',
      tagline: '',
      mood: '',
      colors: {
        primary: '#0265dc',
        secondary: '#2c2c2c',
        accent: '#067a00',
        background: '#ffffff',
        text: '#2c2c2c',
        light: '#f8f8f8',
        dark: '#1a1a1a',
      },
      fonts: { heading: 'System Default', body: 'System Default', headingWeight: '700' },
      pages: ['home', 'about', 'contact'],
      commerce: false,
      commerceSource: '',
      commerceUrl: '',
      imageStyle: '',
      aemAuthorUrl: '',
      githubOrg: '',
      siteName: '',
      createNewRepo: true,
    };
    this.generating = false;
    this.generationLog = [];
    this.previewUrl = '';
    this.chatMessages = [];
    this.siteUrls = {};
    this.context = null;
    this.authenticated = false;
    this._swatchPreview = '';
    this._logoPreview = '';
    this._chatInput = '';
    this._sendingChat = false;
    this._activeEmailCampaign = null;
    this._pendingEmailHeroSlot = null;
    this._selectedEmailHeroSlot = null;
    this._deviceMode = 'desktop';
    this._statusMsg = null;
    this._progress = 0;
    this._swatchResult = null;
    this._swatchGenerating = false;
    this._swatchStatus = null;
    this._swatchBrandInput = '';
    this._apiBase = null;
    this._recentProjects = [];
    this._lastProjectId = '';
  }

  get apiBase() {
    if (this._apiBase) return this._apiBase;
    // 1. URL param  ?forge_api=https://...  (useful for testing)
    try {
      const p = new URLSearchParams(window.location.search).get('forge_api');
      if (p) return p;
    } catch { /* */ }
    // 2. localStorage override (set via FORGE Settings panel)
    try {
      const stored = localStorage.getItem('forge_api_url');
      if (stored) return stored;
    } catch { /* */ }
    // 3. App Builder forge-api Runtime (forge-config.js or same-origin action URL)
    if (window.FORGE_CONFIG?.FORGE_API_URL) return window.FORGE_CONFIG.FORGE_API_URL;
    const pkg = window.FORGE_RUNTIME?.package || 'dx-excshell-1';
    return `${window.location.origin}/api/v1/web/${pkg}/forge-api`;
  }

  _formatFetchError(err, userMsg = '') {
    let msg = err?.message || String(err);
    const api = this.apiBase;
    const onHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';
    if (err?.name === 'TypeError' && /fetch/i.test(msg)) {
      if (onHttps && /^http:/i.test(api)) {
        msg =
          `Cannot reach forge-api at ${api} from this HTTPS page (browser blocks mixed content). `
          + 'Set FORGE API URL in Settings to your App Builder forge-api action (https://…/forge-api).';
      } else {
        msg =
          `Failed to reach forge-api at ${api}. Open FORGE from App Builder CDN or set FORGE API URL in Settings.`;
      }
    }
    if (/\bemail campaign\b/i.test(userMsg)) {
      return `Email campaign error: ${msg}`;
    }
    return msg.startsWith('Error:') ? msg : `Error: ${msg}`;
  }

  /* ------------------------------------------------------------------ */
  /*  Tab switching                                                      */
  /* ------------------------------------------------------------------ */
  _selectTab(tab) {
    this.activeTab = tab;
  }

  /* ------------------------------------------------------------------ */
  /*  Recent projects (same key as /dashboard + /preview.html)         */
  /* ------------------------------------------------------------------ */
  _siteSlugFromBrand(name) {
    return resolveBrandSlugFromBrief({ brandName: name, siteName: '' }) || '';
  }

  _loadRecentProjects() {
    try {
      const list = JSON.parse(localStorage.getItem('forge_projects') || '[]');
      this._recentProjects = [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 20);
    } catch {
      this._recentProjects = [];
    }
  }

  _persistForgeProject(project) {
    if (!project || !project.id) return;
    const key = 'forge_projects';
    let list = [];
    try {
      list = JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      list = [];
    }
    const brandName = project.brandName || project.brief?.brandName || 'Untitled';
    const slug = this._siteSlugFromBrand(brandName);
    const entry = {
      id: project.id,
      brandName,
      status: project.status || 'complete',
      createdAt: project.createdAt || Date.now(),
      urls: project.urls || {},
    };
    if (slug) entry.siteSlug = slug;
    const idx = list.findIndex((x) => x.id === entry.id);
    if (idx >= 0) list[idx] = { ...list[idx], ...entry };
    else list.unshift(entry);
    localStorage.setItem(key, JSON.stringify(list.slice(0, 100)));
  }

  _previewUrlForIframe(baseUrl) {
    return baseUrl || '';
  }

  _canvasEditUrl(previewBase) {
    const org = this._resolveDaOrg();
    const repo = this._brandRepoSlug();
    return buildDaCanvasPreviewUrl(previewBase, {
      org,
      repo,
      canvasUrl: this.siteUrls?.canvas,
    });
  }

  _onPreviewToolbarLinkClick(e, url) {
    if (!url || url === '#') return;
    e.preventDefault();
    const openUrl = this._previewUrlForIframe(url);
    const id = this._lastProjectId || `forge-local-${Date.now()}`;
    if (!this._lastProjectId) this._lastProjectId = id;
    this._persistForgeProject({
      id,
      brandName: this.brief.brandName || 'Untitled',
      status: 'complete',
      createdAt: Date.now(),
      urls: { ...(this.siteUrls || {}), preview: openUrl },
    });
    this._loadRecentProjects();
    this._postSyncForgeFromPreview();
    window.open(openUrl, '_blank', 'noopener,noreferrer');
  }

  _githubSyncTarget() {
    const gh = this.siteUrls?.github;
    if (typeof gh === 'string' && gh.includes('github.com')) {
      try {
        const u = new URL(gh);
        const p = u.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
        if (p.length >= 2 && u.hostname.replace(/^www\./, '') === 'github.com') {
          return `${p[0]}/${p[1].replace(/\.git$/, '')}`;
        }
      } catch {
        /* fall through */
      }
    }
    const org = this.brief.githubOrg || this.context?.org || 'AdobeDrago';
    return `${org}/${this._brandRepoSlug()}`;
  }

  /** URL-safe repo slug (matches server resolveBrandSlug). */
  _brandRepoSlug() {
    return resolveBrandSlugFromBrief(this.brief);
  }

  /** Org/repo used for GitHub, DA upload, and HLX preview — brief wins over Coworker context. */
  _resolveDaOrg() {
    return (this.brief.githubOrg || '').trim() || this.context?.org || 'AdobeDrago';
  }

  _resolveDaRepo() {
    return this._brandRepoSlug();
  }

  /** True when da.live shell project ≠ FORGE generation target (common Geometrix confusion). */
  _coworkerTargetMismatch() {
    if (!this.context?.org || !this.context?.repo) return false;
    const org = this._resolveDaOrg();
    const repo = this._resolveDaRepo();
    return this.context.org !== org || this.context.repo !== repo;
  }

  /** IMS bearer from da.live session (Coworker / da.live tab). */
  _getDaBearerToken() {
    try {
      const raw = localStorage.getItem('nx-ims');
      if (raw) {
        const parsed = JSON.parse(raw);
        const t = parsed.tokenValue || parsed.access_token || parsed.token || '';
        if (t?.startsWith('eyJ') && t.split('.').length === 3) return t;
      }
    } catch {
      /* ignore */
    }
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith('adobeid_ims_access_token/')) continue;
        const val = localStorage.getItem(key)?.trim() || '';
        if (val.startsWith('eyJ') && val.split('.').length === 3) return val;
      }
    } catch {
      /* ignore */
    }
    return '';
  }

  async _writeDaPage(org, repo, page, fetchImpl) {
    const fileName = String(page.path || 'index.html').replace(/^\/+/, '');
    const url = `https://admin.da.live/source/${org}/${repo}/${fileName}`;
    const makeForm = () => {
      const form = new FormData();
      form.append('data', new Blob([page.html], { type: 'text/html' }), fileName);
      return form;
    };
    for (const method of ['PUT', 'POST']) {
      try {
        const resp = await fetchImpl(url, { method, body: makeForm() });
        if (resp.ok || resp.status === 201) {
          return { ok: true, method, status: resp.status };
        }
        if (resp.status === 405) continue;
        const body = await resp.text().catch(() => '');
        return { ok: false, status: resp.status, body: body.slice(0, 200) };
      } catch (e) {
        return { ok: false, status: 0, body: e.message };
      }
    }
    return { ok: false, status: 0, body: 'PUT and POST both failed' };
  }

  _postSyncForgeFromPreview() {
    const target = this._githubSyncTarget();
    if (!target || !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(target)) return;
    const body = { target };
    const pid = this._lastProjectId || '';
    if (pid && /^forge-\d+$/.test(pid)) body.projectId = pid;
    fetch(`${this.apiBase}/api/sync-forge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) console.warn('[FORGE sync-forge]', j);
      })
      .catch((err) => console.warn('[FORGE sync-forge]', err));
  }

  /* ------------------------------------------------------------------ */
  /*  Brief helpers                                                      */
  /* ------------------------------------------------------------------ */
  _showStatus(text, type = 'info') {
    this._statusMsg = { type, text };
    if (type === 'success' || type === 'info') {
      setTimeout(() => { if (this._statusMsg?.text === text) { this._statusMsg = null; this.requestUpdate(); } }, 5000);
    }
  }

  _updateBrief(field, value) {
    this.brief = { ...this.brief, [field]: value };
  }

  _updateColor(key, value) {
    this.brief = {
      ...this.brief,
      colors: { ...this.brief.colors, [key]: value },
    };
  }

  _updateFont(key, value) {
    this.brief = {
      ...this.brief,
      fonts: { ...this.brief.fonts, [key]: value },
    };
  }

  _togglePage(page) {
    const pages = [...this.brief.pages];
    const idx = pages.indexOf(page);
    if (idx >= 0) pages.splice(idx, 1);
    else pages.push(page);
    this.brief = { ...this.brief, pages };
  }

  _toggleCommerce() {
    this.brief = { ...this.brief, commerce: !this.brief.commerce };
  }

  /* ------------------------------------------------------------------ */
  /*  Swatch upload                                                      */
  /* ------------------------------------------------------------------ */
  _openFilePicker() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => this._handleSwatchUpload(e);
    input.click();
  }

  _openLogoPicker() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target?.files?.[0];
      if (file) this._logoPreview = URL.createObjectURL(file);
    };
    input.click();
  }

  async _handleSwatchUpload(e) {
    const file = e.target?.files?.[0];
    if (!file) return;

    this._swatchPreview = URL.createObjectURL(file);
    this._statusMsg = { type: 'info', text: '🔍 Scanning swatch for brand tokens…' };

    try {
      const formData = new FormData();
      formData.append('image', file);
      const resp = await fetch(`${this.apiBase}/api/extract-brand`, {
        method: 'POST',
        body: formData,
      });
      if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);

      // Fill brief from extracted data
      if (data.brandName) this._updateBrief('brandName', data.brandName);
      if (data.tagline) this._updateBrief('tagline', data.tagline);
      if (data.colors) {
        const c = { ...this.brief.colors };
        if (data.colors.primary) c.primary = data.colors.primary;
        if (data.colors.secondary) c.secondary = data.colors.secondary;
        if (data.colors.accent) c.accent = data.colors.accent;
        if (data.colors.background) c.background = data.colors.background;
        if (data.colors.text) c.text = data.colors.text;
        this.brief = { ...this.brief, colors: c };
      }
      if (data.fonts?.heading) this._updateFont('heading', data.fonts.heading);
      if (data.fonts?.body) this._updateFont('body', data.fonts.body);
      if (data.darkTheme !== undefined) this._updateBrief('darkTheme', data.darkTheme);
      if (data.mood) this._updateBrief('mood', data.mood);
      if (data.logoUrl) this._logoPreview = `${this.apiBase}${data.logoUrl}`;

      this._statusMsg = { type: 'success', text: '✅ Brand tokens extracted! Review and adjust below.' };
    } catch (err) {
      this._statusMsg = { type: 'error', text: `❌ Extraction failed: ${err.message}` };
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Generate site                                                      */
  /* ------------------------------------------------------------------ */
  async _generateSite() {
    this.generating = true;
    this.generationLog = [{ text: 'Starting site generation…', done: false }];
    this._statusMsg = null;
    this._progress = 5;

    try {
      const repoSlug = this._brandRepoSlug();
      if (looksLikePrompt(this.brief.brandName) && (!this.brief.siteName || this.brief.siteName === this.context?.repo)) {
        this.brief = { ...this.brief, siteName: repoSlug };
      }

      // Start generation
      const resp = await fetch(`${this.apiBase}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...this.brief,
          siteName: repoSlug,
          githubOrg: this._resolveDaOrg(),
          daToken: this._getDaBearerToken() || undefined,
        }),
      });
      if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
      const data = await resp.json();

      if (data.error) throw new Error(data.error);

      // If server returns result directly
      if (data.urls || data.siteUrls) {
        this._progress = 55;
        this.siteUrls = {
          ...(data.urls || data.siteUrls || {}),
          preview: data.urls?.preview || `https://main--${data.repoName || this._resolveDaRepo()}--${data.orgName || this._resolveDaOrg()}.aem.page/`,
          da: data.urls?.da || `https://da.live/#/${data.orgName || this._resolveDaOrg()}/${data.repoName || this._resolveDaRepo()}`,
        };
        this.previewUrl = this.siteUrls.preview || '';
        this.generationLog = [...this.generationLog, {
          text: `✅ Site generated → ${data.orgName || this._resolveDaOrg()}/${data.repoName || this._resolveDaRepo()} (${data.outputDir || ''})`,
          done: true,
        }];
        this.generationLog = [...this.generationLog, { text: `📁 ${data.fileCount || 'Files'} created`, done: true }];

        if (data.daResult) {
          const dr = data.daResult;
          if (dr.skipped) {
            this.generationLog = [...this.generationLog, { text: `⚠️ DA (server): ${dr.hint || 'Upload skipped — no bearer.'}`, done: true }];
          } else {
            this.generationLog = [...this.generationLog, {
              text: `📤 DA (server): ${dr.uploaded}/${dr.total} pages uploaded${dr.failures?.length ? ` (${dr.failures.length} failed)` : ''}`,
              done: true,
            }];
            if (dr.failures?.length) {
              for (const f of dr.failures.slice(0, 5)) {
                this.generationLog = [...this.generationLog, {
                  text: `   ↳ ${f.path || '?'}: HTTP ${f.status || '—'} ${(f.body || f.error || '').slice(0, 80)}`,
                  done: true,
                }];
              }
            }
          }
        }
        if (data.edsResult?.previewed?.length) {
          const ok = data.edsResult.previewed.filter((x) => (x.status || 0) < 400 && !x.error).length;
          this.generationLog = [...this.generationLog, {
            text: `🔄 HLX preview: ${ok}/${data.edsResult.previewed.length} admin.hlx.page POSTs OK`,
            done: true,
          }];
        }
        if (data.edsDelivery) {
          const ed = data.edsDelivery;
          if (ed.ready) {
            this.generationLog = [...this.generationLog, {
              text: `✅ EDS preview registered — ${ed.previewUrl || this.siteUrls.preview}`,
              done: true,
            }];
          } else {
            const block = (ed.blockers || []).slice(0, 2).join('; ');
            this.generationLog = [...this.generationLog, {
              text: `⚠️ EDS auto-setup: ${block || 'preview not ready'}${ed.steps?.codeSyncRepo?.installUrl ? ' — install AEM Code Sync on GitHub org once.' : ''}`,
              done: true,
            }];
          }
        }
        if (data.urls?.da) {
          this.generationLog = [...this.generationLog, {
            text: `🔗 Authoring: ${data.urls.da} (use this org/repo — not import-only /preview/ URLs alone)`,
            done: true,
          }];
        }

        // Store pages and push content to DA if we have daFetch
        if (data.pages?.length) {
          this._generatedPages = data.pages;
          this.generationLog = [...this.generationLog, { text: `📄 ${data.pages.length} content pages ready`, done: true }];
          // Push to DA content store via client-side auth
          await this._createDAContent(data);
        }
      }

      // If server queues and returns projectId, poll for status
      if (data.projectId && !data.urls) {
        this.generationLog = [...this.generationLog, { text: `Queued: ${data.projectId}`, done: false }];
        let attempts = 0;
        while (attempts < 30) {
          await new Promise(r => setTimeout(r, 2000));
          attempts++;
          try {
            const poll = await fetch(`${this.apiBase}/api/projects/${data.projectId}`);
            const status = await poll.json();
            if (status.log) {
              this.generationLog = status.log.map(l => ({ text: l, done: true }));
            }
            if (status.status === 'complete') {
              this.siteUrls = status.urls || status.siteUrls || {};
              this.previewUrl = this.siteUrls.preview || '';
              break;
            }
            if (status.status === 'error') throw new Error(status.error || 'Generation failed');
          } catch (e) { if (attempts >= 30) throw e; }
        }
      }

      if (data.projectId) {
        this._lastProjectId = data.projectId;
        this._persistForgeProject({
          id: data.projectId,
          brandName: this.brief.brandName,
          status: 'complete',
          createdAt: Date.now(),
          urls: { ...(data.urls || {}), ...(this.siteUrls || {}) },
        });
        this._loadRecentProjects();
      }

      this._progress = 100;
      this.generating = false;
      this._showStatus('Site generation complete!', 'success');
      if (this.previewUrl) this._selectTab('preview');
    } catch (err) {
      this._progress = 0;
      this.generating = false;
      this._showStatus(`Generation failed: ${err.message}`, 'error');
      this.generationLog = [...this.generationLog, { text: `❌ ${err.message}`, done: false }];
    }
  }

  /* ------------------------------------------------------------------ */
  /*  DA Content Creation                                                */
  /* ------------------------------------------------------------------ */
  async _createDAContent(data) {
    // Prefer the SDK-provided daFetch (injected by DA.live shell when running
    // as a plugin). Fall back to the directly-imported daFetch, which works
    // standalone as long as the user is logged into DA.live in this browser
    // (it reads the IMS token via localStorage 'nx-ims' / loadIms()).
    const fetch = this._daFetch || await loadDaFetchDirect();

    // Must match server generateSite org/repo (fstab + *.aem.page), not Coworker sidebar project.
    const org = data.orgName || this._resolveDaOrg();
    const repoSlug = data.repoName || this._resolveDaRepo();
    const pages = data.pages || this._generatedPages || [];

    if (!pages.length) return;

    if (this._coworkerTargetMismatch()) {
      this.generationLog = [...this.generationLog, {
        text: `ℹ️ Coworker has ${this.context.org}/${this.context.repo} open; FORGE uploads to ${org}/${repoSlug} (your brief). Preview uses ${org}/${repoSlug}, not the Geometrix demo.`,
        done: true,
      }];
    }

    this._progress = 65;
    this.generationLog = [...this.generationLog, {
      text: `📤 Pushing ${pages.length} pages to DA (${org}/${repoSlug}) via ${this._daFetch ? 'daFetch' : 'daFetch (import)'}…`,
      done: false,
    }];

    let pushed = 0;
    const clientFailures = [];
    for (const page of pages) {
      const result = await this._writeDaPage(org, repoSlug, page, fetch);
      if (result.ok) {
        pushed++;
      } else {
        clientFailures.push({ path: page.path, ...result });
        console.warn(`[FORGE] DA push failed ${page.path}:`, result.status, result.body);
      }
    }

    if (pushed === 0) {
      const detail = clientFailures[0]
        ? ` (${clientFailures[0].path}: ${clientFailures[0].status} ${clientFailures[0].body || ''})`
        : '';
      this.generationLog = [...this.generationLog,
        {
          text: `⚠️ DA upload failed for ${org}/${repoSlug}${detail} — log into da.live/Coworker in this browser, or set DA_ADMIN_TOKEN on the FORGE server.`,
          done: true,
        },
      ];
      return;
    }

    this.generationLog = [...this.generationLog,
      { text: `✅ Pushed ${pushed}/${pages.length} pages to DA content store`, done: true },
    ];

    // Trigger EDS preview for every uploaded page so *.aem.page is populated.
    // This must run AFTER the DA upload — the preview pipeline reads source
    // from content.da.live and will 404 if content isn't there yet.
    const previewPaths = Array.from(new Set([
      '/',
      ...pages.map(p => {
        const slug = p.path.replace(/\.html$/, '').replace(/^\/+/, '');
        return `/${slug === 'index' ? '' : slug}`.replace(/\/$/, '') || '/';
      }),
    ]));

    this._progress = 85;
    this.generationLog = [...this.generationLog,
      { text: `🔄 Triggering EDS preview for ${previewPaths.length} paths…`, done: false },
    ];

    let previewed = 0;
    for (const path of previewPaths) {
      try {
        const res = await globalThis.fetch(
          `https://admin.hlx.page/preview/${org}/${repoSlug}/main${path || '/'}`,
          { method: 'POST' },
        );
        if (res.ok) previewed++;
      } catch { /* non-fatal */ }
    }

    this.generationLog = [...this.generationLog,
      { text: `✅ Preview triggered for ${previewed}/${previewPaths.length} paths — site is live on aem.page`, done: true },
    ];
  }

  /* ------------------------------------------------------------------ */
  /*  Co-pilot                                                           */
  /* ------------------------------------------------------------------ */
  async _sendPrompt(text) {
    if (!text?.trim()) return;
    const userMsg = text.trim();
    this._chatInput = '';
    this.chatMessages = [...this.chatMessages, { role: 'user', text: userMsg }];
    this._sendingChat = true;

    try {
      const refineSlot = this._pendingEmailHeroSlot;
      this._pendingEmailHeroSlot = null;

      let resp;
      if (this._activeEmailCampaign?.personaId && !/\bemail campaign\b/i.test(userMsg)) {
        resp = await fetch(`${this.apiBase}/api/social/email-campaign/refine`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personaId: this._activeEmailCampaign.personaId,
            message: userMsg,
            forgePublicBase: this.apiBase.replace(/\/$/, ''),
            refineHeroSlot: refineSlot,
            selectHeroVariant: refineSlot?.replace(/^email-hero-/, ''),
            selectHeroOnly: /^use\s+hero\s+image/i.test(userMsg),
            heroImageAssets: this._activeEmailCampaign.heroImageAssets,
            selectedHeroVariant: this._selectedEmailHeroSlot?.replace(/^email-hero-/, ''),
            heroImageSource: this._activeEmailCampaign.heroImageSource,
          }),
        });
      } else {
        resp = await fetch(`${this.apiBase}/api/copilot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: userMsg,
            brief: this.brief,
            org: this.context?.org || this.brief.githubOrg,
            repo: this.context?.repo || this.brief.siteName,
          }),
        });
      }
      if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
      const data = await resp.json();

      // Map server response { scope, assessment, changes } to UI format
      const scopes = [];
      if (data.scope) {
        if (data.scope.styles) scopes.push('styles');
        if (data.scope.blocks) scopes.push('blocks');
        if (data.scope.content) scopes.push('content');
        if (data.scope.commerce) scopes.push('commerce');
        if (data.scope.pages) scopes.push('pages');
      }
      const diffs = (data.changes || []).map(c => ({
        file: c.file || '',
        changes: (c.diff || c.description || '').split('\n').map(line => ({
          type: line.startsWith('+') ? 'add' : line.startsWith('-') ? 'remove' : 'context',
          line,
        })),
      }));

      const assessmentText = Array.isArray(data.assessment)
        ? data.assessment.join('\n')
        : data.assessment || data.message || data.response || data.note || 'Done.';

      const emailCampaign = data.emailCampaign || null;
      if (emailCampaign) {
        this._activeEmailCampaign = emailCampaign;
        if (emailCampaign.selectedHeroVariant) {
          this._selectedEmailHeroSlot = `email-hero-${emailCampaign.selectedHeroVariant}`;
        }
      }

      this.chatMessages = [
        ...this.chatMessages,
        {
          role: 'assistant',
          text: assessmentText,
          scopes: emailCampaign ? ['emailCampaign', ...scopes] : scopes,
          diffs,
          emailCampaign,
          heroImageAssets: emailCampaign?.heroImageAssets || [],
        },
      ];
      if (data.previewUrl) this.previewUrl = data.previewUrl;
    } catch (err) {
      this.chatMessages = [
        ...this.chatMessages,
        { role: 'assistant', text: this._formatFetchError(err, userMsg) },
      ];
    }
    this._sendingChat = false;
  }

  _handleChatKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this._sendPrompt(this._chatInput);
    }
  }

  _isWolverineBrief() {
    const name = `${this.brief?.brandName || ''} ${this.brief?.siteName || ''}`.toLowerCase();
    return Boolean(this.brief?.wolverineDemo || this.brief?.echoStarDemo || name.includes('wolverine'));
  }

  _copilotQuickPrompts() {
    if (this._isWolverineBrief()) {
      return [...WOLVERINE_EMAIL_QUICK_PROMPTS, ...QUICK_PROMPTS.slice(0, 2)];
    }
    return QUICK_PROMPTS;
  }

  /* ------------------------------------------------------------------ */
  /*  Render: Tabs                                                       */
  /* ------------------------------------------------------------------ */
  _renderTabs() {
    const tabs = [
      { id: 'brief', label: '📋 Brief' },
      { id: 'copilot', label: '🤖 Co-Pilot' },
      { id: 'preview', label: '👁 Preview' },
    ];
    return html`
      <div class="forge-tabs">
        <div class="forge-tabs__tablist-wrap">
          <div class="forge-tabs__tablist" role="tablist">
            ${tabs.map(
              (t) => html`
                <button
                  class="forge-tabs__tab"
                  role="tab"
                  aria-selected="${this.activeTab === t.id}"
                  @click=${() => this._selectTab(t.id)}
                >${t.label}</button>
              `,
            )}
          </div>
        </div>
      </div>
    `;
  }

  /* ------------------------------------------------------------------ */
  /*  Render: Brief tab                                                  */
  /* ------------------------------------------------------------------ */
  _renderBriefTab() {
    const b = this.brief;
    const colors = b.colors || {};
    const fonts = b.fonts || {};
    const headingFont = fonts.heading || 'System Default';
    const bodyFont = fonts.body || 'System Default';
    const headingWeight = fonts.headingWeight || '700';

    const COLOR_LABELS = {
      primary: 'Primary', secondary: 'Secondary', accent: 'Accent',
      background: 'Background', text: 'Text', light: 'Light', dark: 'Dark',
    };

    return html`
      <div class="forge-tabs__panel" ?hidden=${this.activeTab !== 'brief'}>

        <!-- ── Brand Swatch ─────────────────────────────────────────── -->
        <div class="forge__field">
          <label class="forge__label">Brand Swatch</label>
          <div
            class="forge__upload-zone"
            @click=${() => this._openFilePicker()}
            @dragover=${(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; e.currentTarget.classList.add('forge__upload-zone--drag'); }}
            @dragleave=${(e) => e.currentTarget.classList.remove('forge__upload-zone--drag')}
            @drop=${(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('forge__upload-zone--drag');
              const file = e.dataTransfer.files?.[0];
              if (file) this._handleSwatchUpload({ target: { files: [file] } });
            }}
          >
            ${this._swatchPreview
              ? html`<img class="forge__upload-preview" src="${this._swatchPreview}" alt="Swatch preview" />`
              : html`<span>📎 Click or drag & drop a brand swatch image — colors and fonts will be auto-extracted</span>`
            }
          </div>
          ${this._swatchPreview ? html`
            <button class="forge__btn forge__btn--ghost" style="font-size:12px;margin-top:6px;" @click=${(e) => { e.stopPropagation(); this._swatchPreview = ''; }}>Clear swatch</button>
          ` : nothing}
        </div>

        <!-- ── Logo ─────────────────────────────────────────────────── -->
        <div class="forge__field">
          <label class="forge__label">Logo</label>
          <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
            ${this._logoPreview ? html`
              <img src="${this._logoPreview}" style="max-width:160px;max-height:80px;border-radius:6px;border:1px solid var(--spectrum-gray-200);background:var(--spectrum-gray-75);padding:8px;" alt="Logo preview" />
            ` : html`
              <div style="width:160px;height:80px;border-radius:6px;border:2px dashed var(--spectrum-gray-300);display:flex;align-items:center;justify-content:center;color:var(--spectrum-gray-500);font-size:12px;text-align:center;padding:8px;">
                No logo yet
              </div>
            `}
            <button class="forge__btn forge__btn--ghost" style="font-size:12px;" @click=${() => this._openLogoPicker()}>
              ${this._logoPreview ? 'Replace logo' : '📁 Upload logo'}
            </button>
          </div>
        </div>

        <hr class="forge__divider" />

        <!-- ── Identity ──────────────────────────────────────────────── -->
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          <div class="forge__field" style="flex:2;min-width:200px;">
            <label class="forge__label">Brand Name</label>
            <input
              class="forge__input"
              type="text"
              .value=${b.brandName}
              @input=${(e) => this._updateBrief('brandName', e.target.value)}
              placeholder="Acme Corp"
            />
          </div>
          <div class="forge__field" style="flex:3;min-width:200px;">
            <label class="forge__label">Tagline</label>
            <input
              class="forge__input"
              type="text"
              .value=${b.tagline}
              @input=${(e) => this._updateBrief('tagline', e.target.value)}
              placeholder="Building the future, one pixel at a time"
            />
          </div>
        </div>

        <div class="forge__field">
          <label class="forge__label">Brand Mood / Personality</label>
          <select
            class="forge__select"
            .value=${b.mood}
            @change=${(e) => this._updateBrief('mood', e.target.value)}
          >
            <option value="">Select mood…</option>
            ${['Bold & Energetic', 'Calm & Trustworthy', 'Elegant & Luxurious', 'Playful & Fun', 'Modern & Minimal', 'Warm & Friendly', 'Professional & Serious', 'Creative & Innovative'].map(
              (m) => html`<option value="${m}" ?selected=${b.mood === m}>${m}</option>`
            )}
          </select>
        </div>

        <hr class="forge__divider" />

        <!-- ── Colors ────────────────────────────────────────────────── -->
        <div class="forge__field">
          <label class="forge__label">Brand Colors</label>
          <div class="forge__color-row">
            ${Object.entries(colors).map(
              ([key, val]) => html`
                <div class="forge__color-field">
                  <input
                    class="forge__color-input"
                    type="color"
                    .value=${val}
                    @input=${(e) => this._updateColor(key, e.target.value)}
                  />
                  <input
                    class="forge__color-hex"
                    type="text"
                    .value=${val}
                    @change=${(e) => this._updateColor(key, e.target.value)}
                  />
                  <span style="font-size:11px;color:var(--spectrum-gray-600);text-transform:capitalize">${COLOR_LABELS[key] || key}</span>
                </div>
              `,
            )}
          </div>
          <!-- Live color swatch strip -->
          <div style="display:flex;gap:4px;margin-top:10px;padding:8px;background:var(--spectrum-gray-75);border-radius:6px;">
            ${Object.entries(colors).map(([key, val]) => html`
              <div style="flex:1;height:32px;border-radius:4px;background:${val};border:1px solid var(--spectrum-gray-200);" title="${COLOR_LABELS[key] || key}: ${val}"></div>
            `)}
          </div>
        </div>

        <hr class="forge__divider" />

        <!-- ── Typography ────────────────────────────────────────────── -->
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          <div class="forge__field" style="flex:2;min-width:180px;">
            <label class="forge__label">Heading Font</label>
            <select
              class="forge__select"
              @change=${(e) => this._updateFont('heading', e.target.value)}
            >
              ${FONT_OPTIONS.map((f) => html`<option ?selected=${headingFont === f}>${f}</option>`)}
            </select>
          </div>
          <div class="forge__field" style="flex:2;min-width:180px;">
            <label class="forge__label">Body Font</label>
            <select
              class="forge__select"
              @change=${(e) => this._updateFont('body', e.target.value)}
            >
              ${FONT_OPTIONS.map((f) => html`<option ?selected=${bodyFont === f}>${f}</option>`)}
            </select>
          </div>
          <div class="forge__field" style="flex:1;min-width:120px;">
            <label class="forge__label">Heading Weight</label>
            <select
              class="forge__select"
              @change=${(e) => this._updateFont('headingWeight', e.target.value)}
            >
              ${['400', '500', '600', '700', '800', '900'].map(
                (w) => html`<option value="${w}" ?selected=${headingWeight === w}>${w}</option>`
              )}
            </select>
          </div>
        </div>
        <!-- Typography live preview -->
        <div style="padding:16px;background:${colors.background || '#ffffff'};border-radius:6px;margin-bottom:16px;border:1px solid var(--spectrum-gray-200);">
          <div style="font-family:${headingFont},sans-serif;font-size:22px;font-weight:${headingWeight};color:${colors.text || colors.primary || '#1a1a1a'};margin-bottom:6px;">
            ${b.brandName || 'Brand Name'} — Heading
          </div>
          <div style="font-family:${bodyFont},sans-serif;font-size:14px;color:${colors.text || '#444'};line-height:1.6;">
            ${b.tagline || 'This is how your body copy will look across all pages. Clear, readable, on-brand.'}
          </div>
          <div style="margin-top:10px;display:flex;gap:8px;">
            <div style="padding:6px 14px;background:${colors.primary || '#0265dc'};color:#fff;border-radius:4px;font-size:13px;font-weight:600;font-family:${bodyFont},sans-serif;">Primary CTA</div>
            <div style="padding:6px 14px;background:${colors.accent || '#067a00'};color:#fff;border-radius:4px;font-size:13px;font-weight:600;font-family:${bodyFont},sans-serif;">Accent CTA</div>
          </div>
        </div>

        <hr class="forge__divider" />

        <!-- ── Pages ─────────────────────────────────────────────────── -->
        <div class="forge__field">
          <label class="forge__label">Pages</label>
          <div class="forge__pages-grid">
            ${AVAILABLE_PAGES.map(
              (p) => html`
                <label class="forge__page-card ${b.pages.includes(p) ? 'forge__page-card--selected' : ''}">
                  <input
                    type="checkbox"
                    .checked=${b.pages.includes(p)}
                    @change=${() => this._togglePage(p)}
                  />
                  <span style="text-transform:capitalize">${p}</span>
                </label>
              `,
            )}
          </div>
        </div>

        <hr class="forge__divider" />

        <!-- ── Images ────────────────────────────────────────────────── -->
        <div class="forge__field">
          <label class="forge__label">Image Style</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${['Photography', 'Illustration', 'Mixed', 'Minimal / Icon-only'].map((style) => html`
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;padding:6px 12px;border-radius:6px;border:1px solid ${b.imageStyle === style ? 'var(--spectrum-blue-700)' : 'var(--spectrum-gray-300)'};background:${b.imageStyle === style ? 'var(--spectrum-blue-100)' : 'transparent'};transition:all 0.15s;">
                <input type="radio" name="image-style" value="${style}"
                  ?checked=${b.imageStyle === style}
                  @change=${() => this._updateBrief('imageStyle', style)}
                  style="display:none;" />
                ${style}
              </label>
            `)}
          </div>
          <p style="font-size:12px;color:var(--spectrum-gray-500);margin:6px 0 0;">
            Controls the visual treatment of hero images, cards, and media blocks generated for the site.
          </p>
        </div>

        <hr class="forge__divider" />

        <!-- ── Commerce ──────────────────────────────────────────────── -->
        <div class="forge__field">
          <div
            class="forge__toggle ${b.commerce ? 'forge__toggle--on' : ''}"
            @click=${() => this._toggleCommerce()}
          >
            <div class="forge__toggle-switch"></div>
            <span>Enable Commerce (product catalog, cart)</span>
          </div>
        </div>

        ${b.commerce ? html`
          <div style="padding:16px;background:var(--spectrum-gray-75);border-radius:8px;border:1px solid var(--spectrum-gray-200);margin-bottom:16px;">
            <div class="forge__field" style="margin-bottom:12px;">
              <label class="forge__label">Data Source</label>
              <select
                class="forge__select"
                @change=${(e) => this._updateBrief('commerceSource', e.target.value)}
              >
                <option value="">Select source…</option>
                <option value="google-sheets" ?selected=${b.commerceSource === 'google-sheets'}>Google Sheets</option>
                <option value="manual" ?selected=${b.commerceSource === 'manual'}>Manual Entry</option>
                <option value="adobe-commerce" ?selected=${b.commerceSource === 'adobe-commerce'}>Commerce (Magento)</option>
              </select>
            </div>
            ${b.commerceSource === 'google-sheets' ? html`
              <div class="forge__field" style="margin-bottom:0;">
                <label class="forge__label">Google Sheets URL</label>
                <input
                  class="forge__input"
                  type="url"
                  .value=${b.commerceUrl || ''}
                  @input=${(e) => this._updateBrief('commerceUrl', e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/…"
                />
              </div>
            ` : nothing}
            ${b.commerceSource === 'adobe-commerce' ? html`
              <div class="forge__field" style="margin-bottom:0;">
                <label class="forge__label">Commerce / Magento URL</label>
                <input
                  class="forge__input"
                  type="url"
                  .value=${b.commerceUrl || ''}
                  @input=${(e) => this._updateBrief('commerceUrl', e.target.value)}
                  placeholder="https://your-store.example.com"
                />
              </div>
            ` : nothing}
            ${b.commerceSource === 'manual' ? html`
              <p style="font-size:12px;color:var(--spectrum-gray-500);margin:0;">
                Product catalog will be set up in DA.live using a spreadsheet block after generation.
              </p>
            ` : nothing}
          </div>
        ` : nothing}

        <hr class="forge__divider" />

        <!-- ── Deployment ─────────────────────────────────────────────── -->
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          <div class="forge__field" style="flex:1;min-width:200px;">
            <label class="forge__label">GitHub Org</label>
            <input
              class="forge__input"
              type="text"
              .value=${b.githubOrg || this.context?.org || ''}
              @input=${(e) => this._updateBrief('githubOrg', e.target.value)}
              placeholder="AdobeDrago"
            />
          </div>
          <div class="forge__field" style="flex:1;min-width:200px;">
            <label class="forge__label">Site Name (repo)</label>
            <input
              class="forge__input"
              type="text"
              .value=${b.siteName || this.context?.repo || ''}
              @input=${(e) => this._updateBrief('siteName', e.target.value)}
              placeholder="my-brand-site"
            />
          </div>
        </div>

        <!-- Repository mode -->
        <div class="forge__field">
          <label class="forge__label">Repository</label>
          <div style="display:flex;gap:16px;margin-bottom:8px;">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;">
              <input type="radio" name="repo-mode" value="new"
                ?checked=${this.brief.createNewRepo !== false}
                @change=${() => this._updateBrief('createNewRepo', true)} />
              Create new repository
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;">
              <input type="radio" name="repo-mode" value="existing"
                ?checked=${this.brief.createNewRepo === false}
                @change=${() => this._updateBrief('createNewRepo', false)} />
              Use existing repository
            </label>
          </div>
          <div style="font-size:12px;color:#888;margin-top:2px;">
            ${this.brief.createNewRepo !== false
              ? html`Will create <strong>${this._resolveDaOrg()}/${this._resolveDaRepo()}</strong> on GitHub`
              : html`Will push to existing repo <strong>${this._resolveDaOrg()}/${this._resolveDaRepo()}</strong>`}
            ${this._coworkerTargetMismatch()
              ? html`<p style="margin:8px 0 0;font-size:12px;color:var(--spectrum-orange-700);">
                  Coworker project is <strong>${this.context.org}/${this.context.repo}</strong> (e.g. Geometrix demo).
                  FORGE will generate and upload to <strong>${this._resolveDaOrg()}/${this._resolveDaRepo()}</strong> instead.
                  Open that repo in da.live after generate — not the sidebar demo.
                </p>`
              : nothing}
          </div>
        </div>

        <!-- Generate button -->
        <div class="forge__btn-row">
          <button
            class="forge__btn forge__btn--primary"
            ?disabled=${this.generating}
            @click=${() => this._generateSite()}
          >
            ${this.generating
              ? html`<span class="forge__spinner"></span> Generating…`
              : '🚀 Generate Site'}
          </button>
        </div>

        <!-- Progress bar -->
        ${this.generating || this._progress > 0 ? html`
          <div class="forge__progress-wrap">
            <div class="forge__progress-bar" style="width:${this._progress}%"></div>
          </div>
        ` : nothing}

        <!-- Generation log -->
        ${this.generationLog.length
          ? html`
              <div class="forge__gen-log">
                ${this.generationLog.map(
                  (l) => html`<div class="forge__gen-log-line ${l.done ? 'forge__gen-log-line--done' : ''}">${l.text}</div>`,
                )}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  _selectEmailHeroTile(slot) {
    this._selectedEmailHeroSlot = slot;
    if (this._activeEmailCampaign) {
      this._activeEmailCampaign = {
        ...this._activeEmailCampaign,
        selectedHeroVariant: slot.replace(/^email-hero-/, ''),
      };
    }
    void this._sendPrompt(`Use hero image ${slot}`);
  }

  _prefillEmailHeroRefine(slot) {
    this._pendingEmailHeroSlot = slot;
    this._chatInput = `For the Firefly **${slot}** tile, change it so that: `;
    this.requestUpdate();
  }

  _renderEmailHeroGrid(assets, msgIndex) {
    if (!assets?.length) return nothing;
    const selected = this._selectedEmailHeroSlot;
    return html`
      <div class="forge__email-hero-grid">
        <div class="forge__email-hero-grid-title">Email hero images (click to select · refine in chat)</div>
        <div class="forge__email-hero-tiles">
          ${assets.map(
            (a) => html`
              <div class="forge__email-hero-tile${selected === a.slot ? ' forge__email-hero-tile--selected' : ''}">
                <button type="button" class="forge__email-hero-img-btn" @click=${() => this._selectEmailHeroTile(a.slot)}>
                  <img src=${a.url} alt=${a.label || a.slot} loading="lazy" />
                </button>
                <div class="forge__email-hero-cap">
                  <strong>${a.label || a.slot}</strong>
                  <button type="button" class="forge__link-btn" @click=${() => this._prefillEmailHeroRefine(a.slot)}>
                    Refine…
                  </button>
                </div>
              </div>
            `,
          )}
        </div>
      </div>
    `;
  }

  /* ------------------------------------------------------------------ */
  /*  Render: Co-Pilot tab                                               */
  /* ------------------------------------------------------------------ */
  _renderCopilotTab() {
    return html`
      <div class="forge-tabs__panel" ?hidden=${this.activeTab !== 'copilot'}>
        <p class="forge__lead">
          Describe changes in natural language. FORGE will figure out the scope and apply edits.
        </p>

        <!-- Quick prompts -->
        <div class="forge__quick-prompts">
          ${this._copilotQuickPrompts().map(
            (p) => html`
              <button
                class="forge__quick-btn"
                @click=${() => this._sendPrompt(p)}
                ?disabled=${this._sendingChat}
              >${p}</button>
            `,
          )}
        </div>

        <!-- Chat messages -->
        <div class="forge__chat-area">
          ${this.chatMessages.length === 0
            ? html`<p style="color:var(--spectrum-gray-500);text-align:center;margin:40px 0;">No messages yet. Try a quick prompt or type below.</p>`
            : this.chatMessages.map(
                (m) => html`
                  <div class="forge__chat-msg forge__chat-msg--${m.role}">
                    <div>${m.text}</div>
                    ${m.scopes?.length
                      ? html`
                          <div class="forge__scope-badges">
                            ${m.scopes.map(
                              (s) => html`<span class="forge__scope-badge forge__scope-badge--${s}">${s}</span>`,
                            )}
                          </div>
                        `
                      : nothing}
                    ${m.diffs?.length
                      ? m.diffs.map(
                          (d) => html`
                            <div class="forge__diff-block">
                              <div class="forge__diff-file">${d.file || ''}</div>
                              ${(d.changes || []).map(
                                (c) => html`<div class="${c.type === 'add' ? 'forge__diff-add' : c.type === 'remove' ? 'forge__diff-remove' : ''}">${c.line}</div>`,
                              )}
                            </div>
                          `,
                        )
                      : nothing}
                    ${m.emailCampaign
                      ? html`
                          ${this._renderEmailHeroGrid(m.heroImageAssets || m.emailCampaign.heroImageAssets, 0)}
                          <div class="forge__email-campaign-links" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;">
                            <a class="forge__btn forge__btn--blue" href="${m.emailCampaign.reviewUrl}" target="_blank" rel="noopener">Review email</a>
                            <a class="forge__btn" href="${m.emailCampaign.previewUrl}" target="_blank" rel="noopener">Preview HTML</a>
                            <a class="forge__btn" href="${m.emailCampaign.inboxUrl}" target="_blank" rel="noopener">Simulate journey</a>
                          </div>
                        `
                      : nothing}
                  </div>
                `,
              )}
          ${this._sendingChat
            ? html`<div class="forge__chat-msg forge__chat-msg--assistant"><span class="forge__spinner"></span> Thinking…</div>`
            : nothing}
        </div>

        <!-- Input -->
        <div class="forge__chat-input-row">
          <input
            class="forge__chat-input"
            type="text"
            placeholder="Describe what you want to change…"
            .value=${this._chatInput}
            @input=${(e) => { this._chatInput = e.target.value; }}
            @keydown=${(e) => this._handleChatKeydown(e)}
            ?disabled=${this._sendingChat}
          />
          <button
            class="forge__btn forge__btn--blue"
            ?disabled=${this._sendingChat || !this._chatInput?.trim()}
            @click=${() => this._sendPrompt(this._chatInput)}
          >Send</button>
        </div>
      </div>
    `;
  }

  /* ------------------------------------------------------------------ */
  /*  Render: Preview tab                                                */
  /* ------------------------------------------------------------------ */
  _renderPreviewTab() {
    const urls = this.siteUrls || {};
    const org = this._resolveDaOrg();
    const repo = this._brandRepoSlug();
    const daAuthoring = urls.da || `https://da.live/#/${org}/${repo}`;
    const previewBase = urls.preview || this.previewUrl || `https://main--${repo}--${org}.aem.page/`;
    const canvasUrl = urls.canvas || buildDaCanvasPreviewUrl(previewBase, { org, repo });
    const previewTarget = this._previewUrlForIframe(previewBase);
    const links = [
      { label: '🔗 *.aem.page', url: previewBase, pin: true },
      { label: '✎ Canvas edit', url: canvasUrl },
      { label: '📝 DA authoring', url: daAuthoring },
      { label: '🌐 Live', url: urls.live },
      { label: '🐙 GitHub', url: urls.github },
      { label: '🔨 FORGE', url: urls.forge },
    ].filter((l) => l.url);

    return html`
      <div class="forge-tabs__panel" ?hidden=${this.activeTab !== 'preview'}>
        <div class="forge__callout" style="margin:0 0 16px;padding:12px 14px;border-radius:8px;background:var(--spectrum-orange-100);border:1px solid var(--spectrum-orange-400);font-size:12px;line-height:1.55;">
          <strong>Ignore Coworker “da.live preview” URLs</strong> (<code>da.live/preview/…</code>) — they show the
          sidebar project
          ${this.context?.org && this.context?.repo
            ? html` <strong>${this.context.org}/${this.context.repo}</strong> (often Geometrix)`
            : ''},
          not FORGE output. Target: <strong>${org}/${repo}</strong> — use the links below.
        </div>
        ${previewTarget
          ? html`
              <div class="forge__preview-wrap">
                <div class="forge__preview-toolbar">
                  <span style="font-weight:600;font-size:13px;">Site Preview · ${org}/${repo}</span>
                  <div class="forge__device-btns">
                    <button
                      class="forge__device-btn"
                      title="Open da.live Canvas (WYSIWYG block editing)"
                      @click=${async () => {
                        if (window.__forgeConfigReady) await window.__forgeConfigReady;
                        window.open(this._canvasEditUrl(previewBase), '_blank', 'noopener,noreferrer');
                      }}
                    >✎ Canvas edit</button>
                    ${['desktop', 'tablet', 'mobile'].map(
                      (d) => html`
                        <button
                          class="forge__device-btn ${this._deviceMode === d ? 'forge__device-btn--active' : ''}"
                          @click=${() => { this._deviceMode = d; }}
                        >${d === 'desktop' ? '🖥' : d === 'tablet' ? '📱' : '📲'} ${d}</button>
                      `,
                    )}
                  </div>
                </div>
                <iframe
                  class="forge__preview-iframe ${this._deviceMode !== 'desktop' ? `forge__preview-iframe--${this._deviceMode}` : ''}"
                  src="${previewTarget}"
                ></iframe>
              </div>
              <div class="forge__links-row">
                ${links.map((l) =>
                  l.pin
                    ? html`<a
                        class="forge__link-btn"
                        href="${l.url}"
                        target="_blank"
                        rel="noopener"
                        @click=${(e) => this._onPreviewToolbarLinkClick(e, l.url)}
                      >${l.label}</a>`
                    : html`<a class="forge__link-btn" href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`,
                )}
              </div>
              <p style="font-size:12px;color:var(--spectrum-gray-600);margin:12px 0 0;line-height:1.5;">
                <strong>Authoring shell:</strong>
                <a href="${daAuthoring}" target="_blank" rel="noopener">${daAuthoring}</a>
                — open this repo in da.live (not <code>/preview/…</code> import URLs).
                ${looksLikePrompt(this.brief.brandName)
                  ? html` Set <strong>Site Name</strong> to <code>wolverine</code> (short slug) on the Brief tab before regenerating if the repo name was wrong.`
                  : nothing}
              </p>
            `
          : html`
              <div style="text-align:center;padding:60px 20px;color:var(--spectrum-gray-500);">
                <p style="font-size:48px;margin:0 0 16px;">🏗️</p>
                <p style="font-size:16px;margin:0;">No preview yet. Generate a site from the Brief tab first.</p>
              </div>
            `}
      </div>
    `;
  }

  /* ------------------------------------------------------------------ */
  /*  Main render                                                        */
  /* ------------------------------------------------------------------ */
  _renderSwatchTab() {
    const sr = this._swatchResult;
    const bgColor = sr?.colors?.background || '#ffffff';
    const textColor = sr?.colors?.text || '#1a1a1a';
    const headingFont = sr?.fonts?.heading || sr?.headingFont || 'Inter';
    const bodyFont = sr?.fonts?.body || sr?.bodyFont || 'Inter';

    return html`
      <div style="max-width:640px;">
        <h2 style="font-size:18px;font-weight:700;color:var(--spectrum-gray-900);margin:0 0 6px;">🎨 Swatch Generator</h2>
        <p style="color:var(--spectrum-gray-600);font-size:14px;margin:0 0 24px;line-height:1.5;">
          Generate a complete brand identity from a name, or upload an existing brand swatch image to auto-extract colors, fonts, and mood.
        </p>

        <!-- ── Option A: generate from name ─────────────────────────── -->
        <div style="padding:20px;background:var(--spectrum-gray-50);border:1px solid var(--spectrum-gray-200);border-radius:8px;margin-bottom:16px;">
          <div style="font-size:13px;font-weight:600;color:var(--spectrum-gray-800);margin-bottom:12px;letter-spacing:0.02em;">GENERATE FROM BRAND NAME</div>
          <div style="display:flex;gap:8px;align-items:flex-end;">
            <div class="forge__field" style="flex:1;margin-bottom:0;">
              <input
                class="forge__input"
                type="text"
                placeholder="e.g. Wolverine Mobile, Boost Mobile, Acme Corp"
                .value=${this._swatchBrandInput}
                @input=${(e) => { this._swatchBrandInput = e.target.value; }}
                @keydown=${(e) => { if (e.key === 'Enter') this._generateSwatch(); }}
                ?disabled=${this._swatchGenerating}
              />
            </div>
            <button
              class="forge__btn forge__btn--primary"
              @click=${() => this._generateSwatch()}
              ?disabled=${this._swatchGenerating || !this._swatchBrandInput.trim()}
              style="white-space:nowrap;"
            >
              ${this._swatchGenerating ? html`<span class="forge__spinner"></span> Generating…` : '🎨 Generate'}
            </button>
          </div>
        </div>

        <!-- ── Option B: upload image ────────────────────────────────── -->
        <div style="padding:20px;background:var(--spectrum-gray-50);border:1px solid var(--spectrum-gray-200);border-radius:8px;margin-bottom:20px;">
          <div style="font-size:13px;font-weight:600;color:var(--spectrum-gray-800);margin-bottom:12px;letter-spacing:0.02em;">EXTRACT FROM BRAND SWATCH IMAGE</div>
          <div
            class="forge__upload-zone"
            style="min-height:90px;"
            @click=${() => this._openSwatchImagePicker()}
            @dragover=${(e) => { e.preventDefault(); e.currentTarget.classList.add('forge__upload-zone--drag'); }}
            @dragleave=${(e) => e.currentTarget.classList.remove('forge__upload-zone--drag')}
            @drop=${(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('forge__upload-zone--drag');
              const file = e.dataTransfer.files?.[0];
              if (file) this._extractSwatchFromImage(file);
            }}
          >
            ${this._swatchGenerating && !this._swatchBrandInput.trim()
              ? html`<span class="forge__spinner"></span> Scanning image…`
              : html`<span>📎 Click or drag & drop a brand swatch image — AI will extract colors, fonts, logo, and mood</span>`
            }
          </div>
        </div>

        <!-- ── Status ─────────────────────────────────────────────────── -->
        ${this._swatchStatus ? html`
          <div class="forge__status forge__status--${this._swatchStatus.type}" style="margin-bottom:16px;">
            ${this._swatchStatus.text}
          </div>
        ` : nothing}

        <!-- ── Result ─────────────────────────────────────────────────── -->
        ${sr ? html`
          <div style="padding:20px;background:var(--spectrum-gray-50);border:1px solid var(--spectrum-gray-200);border-radius:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
              <h3 style="font-size:15px;font-weight:700;margin:0;color:var(--spectrum-gray-900);">Generated Brand Identity</h3>
              ${sr.source ? html`<span style="font-size:11px;color:var(--spectrum-gray-500);padding:2px 8px;background:var(--spectrum-gray-200);border-radius:99px;">${sr.source}</span>` : nothing}
            </div>

            <!-- Meta grid -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px;margin-bottom:16px;">
              <div><span style="color:var(--spectrum-gray-600);">Brand</span><br><strong>${sr.brandName || '—'}</strong></div>
              <div><span style="color:var(--spectrum-gray-600);">Theme</span><br><strong>${sr.darkTheme ? '🌙 Dark' : '☀️ Light'}</strong></div>
              <div><span style="color:var(--spectrum-gray-600);">Tagline</span><br><strong>${sr.tagline || '—'}</strong></div>
              <div><span style="color:var(--spectrum-gray-600);">Mood</span><br><strong style="text-transform:capitalize;">${sr.mood || '—'}</strong></div>
              <div><span style="color:var(--spectrum-gray-600);">Heading Font</span><br><strong>${headingFont}</strong></div>
              <div><span style="color:var(--spectrum-gray-600);">Body Font</span><br><strong>${bodyFont}</strong></div>
            </div>

            <!-- Color palette -->
            <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;">
              ${Object.entries(sr.colors || {}).map(([name, hex]) => html`
                <div style="text-align:center;min-width:52px;flex:1;">
                  <div style="height:44px;border-radius:6px;background:${hex};border:1px solid var(--spectrum-gray-300);cursor:pointer;"
                    title="${name}: ${hex}"
                    @click=${() => { navigator.clipboard?.writeText(hex); }}
                  ></div>
                  <div style="font-size:10px;color:var(--spectrum-gray-500);margin-top:3px;text-transform:capitalize;">${name}</div>
                  <div style="font-size:10px;color:var(--spectrum-gray-700);font-weight:600;">${hex}</div>
                </div>
              `)}
            </div>

            <!-- Font + color live preview -->
            <div style="padding:16px;background:${bgColor};border-radius:6px;border:1px solid var(--spectrum-gray-200);margin-bottom:16px;">
              <div style="font-family:${headingFont},sans-serif;font-size:22px;font-weight:700;color:${textColor};margin-bottom:6px;">
                ${sr.brandName || 'Brand Name'}
              </div>
              <div style="font-family:${bodyFont},sans-serif;font-size:14px;color:${textColor};opacity:0.85;line-height:1.6;margin-bottom:12px;">
                ${sr.tagline || 'Your tagline appears here. This is body text in your brand font.'}
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <div style="padding:6px 14px;background:${sr.colors?.primary || '#0265dc'};color:#fff;border-radius:4px;font-size:13px;font-weight:600;font-family:${bodyFont},sans-serif;">Primary CTA</div>
                <div style="padding:6px 14px;background:${sr.colors?.accent || '#067a00'};color:#fff;border-radius:4px;font-size:13px;font-weight:600;font-family:${bodyFont},sans-serif;">Accent CTA</div>
                <div style="padding:6px 14px;background:${sr.colors?.secondary || '#2c2c2c'};color:#fff;border-radius:4px;font-size:13px;font-weight:600;font-family:${bodyFont},sans-serif;">Secondary</div>
              </div>
            </div>

            <!-- Actions -->
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="forge__btn forge__btn--primary" @click=${() => this._applySwatchToBrief()}>Apply to Brief →</button>
              <button class="forge__btn forge__btn--blue" @click=${() => { this._applySwatchToBrief(); setTimeout(() => this._generateSite(), 50); }}>Apply & Generate Site 🚀</button>
              <button class="forge__btn forge__btn--ghost" @click=${() => { this._swatchResult = null; this._swatchStatus = null; }}>Clear</button>
            </div>
          </div>
        ` : nothing}
      </div>
    `;
  }

  async _generateSwatch() {
    const brandName = this._swatchBrandInput.trim();
    if (!brandName) { this._swatchStatus = { type: 'error', text: 'Enter a brand name first.' }; return; }

    this._swatchGenerating = true;
    this._swatchStatus = { type: 'info', text: `🎨 Generating brand identity for "${brandName}"…` };
    this._swatchResult = null;

    try {
      const resp = await fetch(this.apiBase + '/api/generate-swatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandName }),
      });
      const d = await resp.json();
      if (d.error) throw new Error(d.error);
      this._swatchResult = d;
      this._swatchStatus = { type: 'success', text: '✅ Brand identity generated! Review and apply below.' };
    } catch (err) {
      this._swatchStatus = { type: 'error', text: `❌ ${err.message}` };
    }
    this._swatchGenerating = false;
  }

  async _extractSwatchFromImage(file) {
    if (!file) return;
    this._swatchGenerating = true;
    this._swatchStatus = { type: 'info', text: '🔍 Scanning image for brand tokens…' };
    this._swatchResult = null;

    const previewUrl = URL.createObjectURL(file);

    try {
      const formData = new FormData();
      formData.append('image', file);
      const resp = await fetch(`${this.apiBase}/api/extract-brand`, { method: 'POST', body: formData });
      if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      this._swatchResult = data;
      if (data.logoUrl) this._logoPreview = `${this.apiBase}${data.logoUrl}`;
      this._swatchStatus = { type: 'success', text: '✅ Brand tokens extracted! Review and apply below.' };
    } catch (err) {
      this._swatchStatus = { type: 'error', text: `❌ Extraction failed: ${err.message}` };
      URL.revokeObjectURL(previewUrl);
    }
    this._swatchGenerating = false;
  }

  _openSwatchImagePicker() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => this._extractSwatchFromImage(e.target?.files?.[0]);
    input.click();
  }

  _applySwatchToBrief() {
    if (!this._swatchResult) return;
    const d = this._swatchResult;
    if (d.brandName) this._updateBrief('brandName', d.brandName);
    if (d.tagline) this._updateBrief('tagline', d.tagline);
    if (d.mood) this._updateBrief('mood', d.mood);
    if (d.colors) this.brief = { ...this.brief, colors: { ...this.brief.colors, ...d.colors } };
    if (d.fonts?.heading || d.headingFont) this._updateFont('heading', d.fonts?.heading || d.headingFont);
    if (d.fonts?.body || d.bodyFont) this._updateFont('body', d.fonts?.body || d.bodyFont);
    if (d.fonts?.headingWeight) this._updateFont('headingWeight', d.fonts.headingWeight);
    if (d.darkTheme !== undefined) this._updateBrief('darkTheme', d.darkTheme);
    this._selectTab('brief');
    this._showStatus('Brand identity applied to brief!', 'success');
  }

  _renderWorkfrontTab() {
    return html`
      <div style="max-width:600px;">
        <h2 style="font-size:18px;font-weight:700;color:var(--spectrum-gray-900);margin:0 0 8px;">🔗 Workfront Import</h2>
        <p style="color:var(--spectrum-gray-600);font-size:14px;margin:0 0 24px;line-height:1.5;">
          Import a campaign brief from Adobe Workfront. Project metadata — brand colors, assets, goals — will be mapped to your FORGE brief automatically.
        </p>
        <div class="forge__field">
          <label class="forge__label">Workfront Project ID or URL</label>
          <input type="text" class="forge__input" id="wf-project-id" placeholder="e.g. 6789abcd1234ef567890 or paste project URL">
        </div>
        <div style="display:flex;gap:8px;margin-top:16px;">
          <button class="forge__btn forge__btn--primary" @click=${() => this._importFromWorkfront()}>Import Project</button>
          <button class="forge__btn" @click=${() => this._browseWorkfront()}>Browse Projects</button>
        </div>
        <div id="wf-status" style="margin-top:16px;font-size:13px;"></div>
        ${this._wfProjects ? html`
          <div style="margin-top:20px;">
            <h3 style="font-size:14px;font-weight:600;margin:0 0 12px;">Available Projects</h3>
            ${this._wfProjects.map(p => html`
              <div style="padding:12px;background:var(--spectrum-gray-50);border:1px solid var(--spectrum-gray-200);border-radius:6px;margin-bottom:8px;cursor:pointer;transition:border-color 0.2s;"
                @click=${() => this._selectWfProject(p)}
                @mouseover=${(e) => e.currentTarget.style.borderColor = 'var(--spectrum-blue-800)'}
                @mouseout=${(e) => e.currentTarget.style.borderColor = 'var(--spectrum-gray-200)'}>
                <div style="font-weight:600;color:var(--spectrum-gray-900);">${p.name}</div>
                <div style="font-size:12px;color:var(--spectrum-gray-500);margin-top:4px;">
                  ${p.status || ''} · ${p.owner || ''} ${p.dueDate ? '· Due ' + p.dueDate : ''}
                </div>
              </div>
            `)}
          </div>
        ` : nothing}
      </div>
    `;
  }

  async _browseWorkfront() {
    const status = this.renderRoot.querySelector('#wf-status');
    if (status) status.innerHTML = '<span style="color:var(--spectrum-gray-500);">Loading projects...</span>';
    try {
      const resp = await fetch(this.apiBase + '/api/workfront/projects');
      const d = await resp.json();
      if (d.error) throw new Error(d.error);
      this._wfProjects = d.projects || [];
      this.requestUpdate();
      if (status) status.innerHTML = '<span style="color:#16a34a;">' + this._wfProjects.length + ' projects found</span>';
    } catch (err) {
      if (status) status.innerHTML = '<span style="color:#dc2626;">❌ ' + err.message + '</span>';
    }
  }

  async _importFromWorkfront() {
    const input = this.renderRoot.querySelector('#wf-project-id');
    const id = input?.value?.trim();
    if (!id) { this._showStatus('Enter a project ID or URL', 'error'); return; }
    const status = this.renderRoot.querySelector('#wf-status');
    if (status) status.innerHTML = '<span style="color:var(--spectrum-gray-500);">Importing...</span>';
    try {
      const resp = await fetch(this.apiBase + '/api/workfront/projects/' + encodeURIComponent(id));
      const d = await resp.json();
      if (d.error) throw new Error(d.error);
      if (d.brief) {
        this.brief = { ...this.brief, ...d.brief };
        this._selectTab('brief');
        this._showStatus('Workfront brief imported!', 'success');
      }
    } catch (err) {
      if (status) status.innerHTML = '<span style="color:#dc2626;">❌ ' + err.message + '</span>';
    }
  }

  _selectWfProject(project) {
    this.brief = { ...this.brief, ...project.brief };
    this._selectTab('brief');
    this._showStatus('Project "' + project.name + '" imported to brief!', 'success');
  }

  _saveApiUrl(url) {
    try {
      if (url.trim()) localStorage.setItem('forge_api_url', url.trim());
      else localStorage.removeItem('forge_api_url');
      this._apiBase = url.trim() || null;
      this._showStatus('API URL saved — FORGE will use it for all requests.', 'success');
    } catch { /* */ }
  }

  _renderDashboard() {
    if (this.activeTab !== 'dashboard') return nothing;
    const storedApi = (() => { try { return localStorage.getItem('forge_api_url') || ''; } catch { return ''; } })();
    return html`
      <div style="padding:24px 0;">
        <!-- API URL banner — shown when not configured for cloud -->
        ${!storedApi && !window.FORGE_CONFIG?.FORGE_API_URL ? html`
          <div style="padding:14px 16px;background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;margin-bottom:20px;font-size:13px;">
            <strong>⚠️ No forge-api URL configured.</strong>
            Open FORGE from App Builder CDN (Experience Cloud) or enter your forge-api action URL in Settings below.
          </div>
        ` : nothing}
        ${this._recentProjects.length
          ? html`
            <div style="margin-bottom:24px;padding:16px 18px;background:var(--spectrum-gray-50);border:1px solid var(--spectrum-gray-200);border-radius:8px;">
              <h3 style="margin:0 0 4px;font-size:14px;font-weight:700;color:var(--spectrum-gray-900);">Recent FORGE sites</h3>
              <p style="margin:0 0 12px;font-size:12px;color:var(--spectrum-gray-600);line-height:1.45;">
                Pinned here and in <code>forge_projects</code> (this origin). da.live’s own sidebar lists repos you open in Document Authoring — use <strong>DA authoring</strong> below so the org/repo shows there too.
              </p>
              <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px;">
                ${this._recentProjects.map(
                  (p) => html`
                    <li style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:10px 12px;background:#fff;border:1px solid var(--spectrum-gray-200);border-radius:6px;">
                      <strong style="font-size:13px;">${p.brandName || 'Untitled'}</strong>
                      <span style="font-size:12px;color:var(--spectrum-gray-500);">● ${p.status || 'draft'}</span>
                      ${p.urls?.da
                        ? html`<a class="forge__link-btn" style="font-size:12px;" href="${p.urls.da}" target="_blank" rel="noopener">DA authoring</a>`
                        : nothing}
                      ${p.urls?.preview
                        ? html`<a class="forge__link-btn" style="font-size:12px;" href="${p.urls.preview}" target="_blank" rel="noopener">Preview</a>`
                        : nothing}
                    </li>
                  `,
                )}
              </ul>
            </div>
          `
          : nothing}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;">
          <div class="forge__card" @click=${() => this._selectTab('brief')} style="cursor:pointer;padding:24px;background:var(--spectrum-gray-50);border:1px solid var(--spectrum-gray-200);border-radius:8px;text-align:center;transition:border-color 0.2s,box-shadow 0.2s;">
            <div style="font-size:36px;margin-bottom:12px;">📋</div>
            <h3 style="margin:0 0 8px;font-size:16px;font-weight:700;color:var(--spectrum-gray-900);">Briefs</h3>
            <p style="margin:0;font-size:13px;color:var(--spectrum-gray-600);line-height:1.5;">
              Start from a brand brief — define colors, fonts, pages, and generate a complete EDS site.
            </p>
          </div>
          <div class="forge__card" @click=${() => this._selectTab('swatch')} style="cursor:pointer;padding:24px;background:var(--spectrum-gray-50);border:1px solid var(--spectrum-gray-200);border-radius:8px;text-align:center;transition:border-color 0.2s,box-shadow 0.2s;">
            <div style="font-size:36px;margin-bottom:12px;">🎨</div>
            <h3 style="margin:0 0 8px;font-size:16px;font-weight:700;color:var(--spectrum-gray-900);">Swatch Generator</h3>
            <p style="margin:0;font-size:13px;color:var(--spectrum-gray-600);line-height:1.5;">
              Upload a brand swatch image — auto-extract colors, fonts, logo, and mood to populate your brief.
            </p>
          </div>
          <div class="forge__card" @click=${() => this._selectTab('copilot')} style="cursor:pointer;padding:24px;background:var(--spectrum-gray-50);border:1px solid var(--spectrum-gray-200);border-radius:8px;text-align:center;transition:border-color 0.2s,box-shadow 0.2s;">
            <div style="font-size:36px;margin-bottom:12px;">💬</div>
            <h3 style="margin:0 0 8px;font-size:16px;font-weight:700;color:var(--spectrum-gray-900);">Co-Pilot</h3>
            <p style="margin:0;font-size:13px;color:var(--spectrum-gray-600);line-height:1.5;">
              Iterate with natural language — modify CSS, add pages, change mood, inject features via prompts.
            </p>
          </div>
          <div class="forge__card" @click=${() => this._selectTab('workfront')} style="cursor:pointer;padding:24px;background:var(--spectrum-gray-50);border:1px solid var(--spectrum-gray-200);border-radius:8px;text-align:center;transition:border-color 0.2s,box-shadow 0.2s;">
            <div style="font-size:36px;margin-bottom:12px;">🔗</div>
            <h3 style="margin:0 0 8px;font-size:16px;font-weight:700;color:var(--spectrum-gray-900);">Workfront</h3>
            <p style="margin:0;font-size:13px;color:var(--spectrum-gray-600);line-height:1.5;">
              Import a campaign brief from Workfront — auto-map project metadata to site components.
            </p>
          </div>
          <div class="forge__card" @click=${() => this._selectTab('preview')} style="cursor:pointer;padding:24px;background:var(--spectrum-gray-50);border:1px solid var(--spectrum-gray-200);border-radius:8px;text-align:center;transition:border-color 0.2s,box-shadow 0.2s;">
            <div style="font-size:36px;margin-bottom:12px;">🖥️</div>
            <h3 style="margin:0 0 8px;font-size:16px;font-weight:700;color:var(--spectrum-gray-900);">Preview</h3>
            <p style="margin:0;font-size:13px;color:var(--spectrum-gray-600);line-height:1.5;">
              View your generated site — preview in iframe, open in Universal Editor, DA, or publish to live.
            </p>
          </div>
        </div>

        <!-- Settings -->
        <div style="margin-top:24px;padding:20px;background:var(--spectrum-gray-50);border:1px solid var(--spectrum-gray-200);border-radius:8px;">
          <h3 style="margin:0 0 12px;font-size:14px;font-weight:700;color:var(--spectrum-gray-900);">⚙️ Settings</h3>
          <div style="display:flex;gap:8px;align-items:flex-end;">
            <div class="forge__field" style="flex:1;margin-bottom:0;">
              <label class="forge__label">FORGE API URL</label>
              <input
                class="forge__input"
                type="url"
                id="forge-api-url-input"
                placeholder="https://…adobeio-static.net/api/v1/web/dx-excshell-1/forge-api"
                .value=${storedApi}
              />
            </div>
            <button class="forge__btn forge__btn--primary" style="white-space:nowrap;"
              @click=${() => {
                const val = this.renderRoot.querySelector('#forge-api-url-input')?.value || '';
                this._saveApiUrl(val);
              }}
            >Save</button>
            ${storedApi ? html`
              <button class="forge__btn forge__btn--ghost" @click=${() => { this._saveApiUrl(''); }}>Clear</button>
            ` : nothing}
          </div>
          <p style="font-size:12px;color:var(--spectrum-gray-500);margin:8px 0 0;line-height:1.5;">
            App Builder <strong>forge-api</strong> action URL. Leave blank when opened from the FORGE CDN — <code>forge-config.js</code> sets it automatically.
          </p>
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <h1 class="forge__title">🔨 FORGE</h1>
      <p class="forge__lead">
        Brand-identity-driven site generator for Adobe Edge Delivery Services.
        ${this.context
          ? html` <span style="font-size:12px;color:var(--spectrum-gray-500);">(${this.context.org}/${this.context.repo})</span>`
          : nothing}
      </p>

      ${this._statusMsg
        ? html`<div class="forge__status forge__status--${this._statusMsg.type}">${this._statusMsg.text}</div>`
        : nothing}

      ${this.activeTab === 'dashboard'
        ? this._renderDashboard()
        : html`
          <div style="margin-bottom:16px;">
            <button class="forge__btn forge__btn--ghost" @click=${() => this._selectTab('dashboard')} style="font-size:13px;">← Back to Dashboard</button>
          </div>
          ${this.activeTab === 'swatch' ? this._renderSwatchTab() : nothing}
          ${this.activeTab === 'workfront' ? this._renderWorkfrontTab() : nothing}
          ${['brief','copilot','preview'].includes(this.activeTab) ? html`
            ${this._renderTabs()}
            ${this._renderBriefTab()}
            ${this._renderCopilotTab()}
            ${this._renderPreviewTab()}
          ` : nothing}
        `}
    `;
  }
}

customElements.define(EL_NAME, ForgeApp);

/* -------------------------------------------------------------------- */
/*  DA.live SDK bootstrap                                                */
/* -------------------------------------------------------------------- */

export default async function init(el) {
  let context = null;
  let daFetch = null;
  try {
    // DA_SDK hangs forever when loaded outside DA.live shell — race with a timeout
    const sdk = await Promise.race([
      loadDaSdk(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);
    context = sdk.context ?? null;
    daFetch = sdk.actions?.daFetch ?? null;
  } catch { /* standalone or timeout — continue without DA context */ }

  const cmp = document.createElement(EL_NAME);
  if (context) {
    cmp.context = context;
    // Prefill org/repo for editing; generation uses brief.githubOrg + brand slug, not context alone.
    cmp.brief = {
      ...cmp.brief,
      githubOrg: cmp.brief.githubOrg || context.org || '',
      siteName: cmp.brief.siteName || context.repo || '',
    };
  }
  if (daFetch) cmp._daFetch = daFetch;
  el.replaceChildren();
  el.append(cmp);
}

function boot() {
  const params = new URLSearchParams(window.location.search);
  // Popup bridge from *.aem.page inline-edit: capture da.live IMS and postMessage back.
  if (params.get('forgeTokenBridge') === '1') {
    const root = document.getElementById('forge-root') || document.body;
    root.id = root.id || 'forge-da-token-bridge';
    import('./da-token-bridge.js')
      .then((m) => m.runDaTokenBridge(root))
      .catch((err) => {
        root.textContent = `Could not start da.live sign-in bridge: ${err?.message || err}`;
      });
    return;
  }

  const root = document.getElementById('forge-root');
  if (!root) return;
  Promise.resolve(init(root)).catch((err) => {
    root.replaceChildren();
    const p = document.createElement('p');
    p.textContent = `Could not start FORGE: ${err?.message ?? err}`;
    p.style.cssText = 'padding:1rem;font-family:system-ui,sans-serif';
    root.append(p);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
