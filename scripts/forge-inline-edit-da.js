/**
 * Insert blocks via admin.da.live (com_kit-style — no FORGE/Railway API).
 */
import { buildBlockSectionHtml, getBlockCategory } from './forge-inline-edit-blocks.js';

const DA_FETCH_MODULE = 'https://da.live/nx/utils/daFetch.js';

export function normalizePagePath(pagePath) {
  let p = String(pagePath || 'index').replace(/\.html$/i, '').replace(/^\/+/, '');
  if (!p || p === '/') return 'index';
  return p;
}

export function pagePathToDaFile(pagePath) {
  const slug = normalizePagePath(pagePath);
  return slug === 'index' ? 'index.html' : `${slug}.html`;
}

export function pagePathToHlxPath(pagePath) {
  const slug = normalizePagePath(pagePath);
  if (slug === 'index') return '/index';
  return `/${slug}`;
}

export function insertBlockIntoPageHtml(pageHtml, blockSectionHtml, afterIndex = -1) {
  const html = String(pageHtml || '');
  const mainOpen = html.match(/<main\b[^>]*>/i);
  if (!mainOpen) {
    return `${html}\n<main>\n${blockSectionHtml}</main>\n`;
  }

  const start = mainOpen.index + mainOpen[0].length;
  const closeIdx = html.toLowerCase().indexOf('</main>', start);
  if (closeIdx === -1) {
    return `${html}\n${blockSectionHtml}\n`;
  }

  const mainInner = html.slice(start, closeIdx);
  const sections = mainInner.split(/(?=<div\b)/i).filter((s) => s.trim());

  let inserted;
  if (afterIndex < 0 || sections.length === 0 || afterIndex >= sections.length - 1) {
    inserted = `${mainInner.trimEnd()}\n${blockSectionHtml}`;
  } else {
    const before = sections.slice(0, afterIndex + 1).join('');
    const after = sections.slice(afterIndex + 1).join('');
    inserted = `${before}${blockSectionHtml}${after}`;
  }

  return html.slice(0, start) + inserted + html.slice(closeIdx);
}

export async function fetchDaPageHtml(org, repo, pagePath, token) {
  const file = pagePathToDaFile(pagePath);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const urls = [
    `https://admin.da.live/source/${org}/${repo}/${file}`,
    `https://content.da.live/${org}/${repo}/${file}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers, credentials: 'include' });
      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 20) return { html: text, source: url };
      }
    } catch {
      /* try next */
    }
  }
  return { html: null, source: null };
}

async function resolveDaFetchModule() {
  try {
    return await import(DA_FETCH_MODULE);
  } catch {
    return null;
  }
}

/**
 * Write HTML to admin.da.live.
 * Prefer an explicit IMS bearer (pasted forge_da_token) — daFetch's 401 handler
 * calls loadIms() which throws "Missing IMS Client ID" on *.aem.page (no da.live config).
 */
async function writeDaPage(org, repo, fileName, html, token) {
  const url = `https://admin.da.live/source/${org}/${repo}/${fileName}`;
  const makeForm = () => {
    const form = new FormData();
    form.append('data', new Blob([html], { type: 'text/html' }), fileName);
    return form;
  };

  const tryBearer = async () => {
    if (!token) return null;
    const headers = { Authorization: `Bearer ${token}` };
    for (const method of ['PUT', 'POST']) {
      try {
        const res = await fetch(url, { method, headers, body: makeForm() });
        if (res.ok || res.status === 201) return { ok: true, method, status: res.status };
        if (res.status === 405 || res.status === 404) continue;
        const body = await res.text().catch(() => '');
        return { ok: false, status: res.status, body: body.slice(0, 200) };
      } catch (e) {
        return { ok: false, status: 0, body: e.message || String(e) };
      }
    }
    return { ok: false, status: 0, body: 'upload failed' };
  };

  let bearerErr = null;
  // 1) Explicit token first (inline-edit dialog / forge_da_token)
  if (token) {
    const bearer = await tryBearer();
    if (bearer?.ok) return bearer;
    // Keep last bearer error; still try daFetch below in case session cookies work
    bearerErr = bearer;
  }

  // 2) daFetch only when we can inject the token (avoids loadIms on aem.page)
  const mod = await resolveDaFetchModule();
  const daFetch = mod?.daFetch || mod?.default || null;
  if (daFetch) {
    try {
      if (token && typeof mod.setImsDetails === 'function') {
        mod.setImsDetails(token);
      }
      for (const method of ['PUT', 'POST']) {
        try {
          const res = await daFetch(url, { method, body: makeForm() });
          if (res.ok || res.status === 201) return { ok: true, method, status: res.status };
          if (res.status === 405 || res.status === 404) continue;
          // Do not treat 401 as terminal — fall through to bearer / next method
          if (res.status === 401 || res.status === 403) continue;
          const body = await res.text().catch(() => '');
          if (!token) return { ok: false, status: res.status, body: body.slice(0, 200) };
        } catch {
          /* Missing IMS Client ID etc. — fall through */
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (token) {
    const retry = await tryBearer();
    if (retry) return retry;
    return bearerErr || { ok: false, status: 0, body: 'upload failed' };
  }

  return { ok: false, status: 401, body: 'no_token' };
}

export async function triggerHlxPreviewPath(org, repo, hlxPath) {
  const url = `https://admin.hlx.page/preview/${org}/${repo}/main${hlxPath}`;
  try {
    const res = await fetch(url, { method: 'POST' });
    return { ok: res.ok, status: res.status, path: hlxPath };
  } catch (e) {
    return { ok: false, error: e.message, path: hlxPath };
  }
}

/**
 * @param {{ org: string, repo: string, pagePath: string, blockId: string, afterIndex?: number, brandName?: string, token?: string }} input
 */
export async function insertBlockOnDaPageClient(input) {
  const { org, repo, pagePath, blockId, afterIndex = -1, brandName = '', token = '' } = input;
  if (!org || !repo || !blockId) {
    return { ok: false, error: 'org, repo, and blockId are required' };
  }

  const fetched = await fetchDaPageHtml(org, repo, pagePath, token);
  let pageHtml = fetched.html;
  if (!pageHtml) {
    pageHtml = `<header></header>\n<main>\n</main>\n<footer></footer>\n`;
  }

  const snippet = buildBlockSectionHtml(blockId, { brandName });
  const updated = insertBlockIntoPageHtml(pageHtml, snippet, afterIndex);
  const daFile = pagePathToDaFile(pagePath);

  const write = await writeDaPage(org, repo, daFile, updated, token);
  if (!write.ok) {
    const needsToken = write.status === 401 || write.body === 'no_token';
    return {
      ok: false,
      error: needsToken
        ? 'DA sign-in required — open da.live in this browser, or paste your IMS token when prompted'
        : `DA write failed: ${write.status} ${write.body || ''}`,
      needsToken,
      category: getBlockCategory(blockId),
    };
  }

  const hlxPath = pagePathToHlxPath(pagePath);
  await triggerHlxPreviewPath(org, repo, hlxPath);

  const slug = normalizePagePath(pagePath);
  const pageUrl = slug === 'index' ? '/' : `/${slug}/`;

  return {
    ok: true,
    blockId,
    category: getBlockCategory(blockId),
    previewUrl: `https://main--${repo}--${org}.aem.page${pageUrl}?forge-edit=1&forge-org=${encodeURIComponent(org)}&forge-repo=${encodeURIComponent(repo)}&_t=${Date.now()}`,
  };
}
