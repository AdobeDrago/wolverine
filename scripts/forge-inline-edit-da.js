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

/**
 * Split <main> into top-level EDS section <div>s only.
 * Do NOT split on nested divs — that corrupts DA HTML and Add component appears to no-op after reload.
 */
export function splitMainTopLevelDivs(mainInner) {
  const src = String(mainInner || '');
  const sections = [];
  let depth = 0;
  let start = -1;
  const re = /<\/?div\b[^>]*>/gi;
  let m;
  while ((m = re.exec(src))) {
    const isClose = /^<\//.test(m[0]);
    if (!isClose) {
      if (depth === 0) start = m.index;
      depth += 1;
    } else if (depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        sections.push(src.slice(start, m.index + m[0].length));
        start = -1;
      }
    }
  }
  return sections;
}

/**
 * Remove one top-level EDS section from <main> by index.
 * Uses the same splitter as insert — never peel nested divs.
 */
export function removeBlockFromPageHtml(pageHtml, sectionIndex) {
  const html = String(pageHtml || '');
  const idx = Number(sectionIndex);
  if (!Number.isFinite(idx) || idx < 0) {
    return { html, removed: false, error: 'Invalid section index' };
  }

  const mainOpen = html.match(/<main\b[^>]*>/i);
  if (!mainOpen) {
    return { html, removed: false, error: 'Page has no <main>' };
  }

  const start = mainOpen.index + mainOpen[0].length;
  const closeIdx = html.toLowerCase().indexOf('</main>', start);
  if (closeIdx === -1) {
    return { html, removed: false, error: 'Page has no </main>' };
  }

  const mainInner = html.slice(start, closeIdx);
  const sections = splitMainTopLevelDivs(mainInner);
  if (!sections.length) {
    return { html, removed: false, error: 'No top-level sections in <main>' };
  }
  if (idx >= sections.length) {
    return { html, removed: false, error: `Section index ${idx} out of range (${sections.length} sections)` };
  }
  if (sections.length === 1) {
    return { html, removed: false, error: 'Cannot delete the last section on the page' };
  }

  let cursor = 0;
  let out = '';
  let found = false;
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const at = mainInner.indexOf(sec, cursor);
    if (at === -1) {
      const rebuilt = sections.filter((_, j) => j !== idx).join('\n');
      return {
        html: `${html.slice(0, start)}\n${rebuilt}\n${html.slice(closeIdx)}`,
        removed: true,
        sectionCount: sections.length - 1,
      };
    }
    out += mainInner.slice(cursor, at);
    if (i === idx) found = true;
    else out += sec;
    cursor = at + sec.length;
  }
  out += mainInner.slice(cursor);
  if (!found) {
    return { html, removed: false, error: 'Could not locate section in Document Authoring HTML' };
  }
  return {
    html: html.slice(0, start) + out + html.slice(closeIdx),
    removed: true,
    sectionCount: sections.length - 1,
  };
}

export function insertBlockIntoPageHtml(pageHtml, blockSectionHtml, afterIndex = -1) {
  const html = String(pageHtml || '');
  const snippet = String(blockSectionHtml || '');
  const mainOpen = html.match(/<main\b[^>]*>/i);
  if (!mainOpen) {
    return `${html}\n<main>\n${snippet}</main>\n`;
  }

  const start = mainOpen.index + mainOpen[0].length;
  const closeIdx = html.toLowerCase().indexOf('</main>', start);
  if (closeIdx === -1) {
    return `${html}\n${snippet}\n`;
  }

  const mainInner = html.slice(start, closeIdx);
  const sections = splitMainTopLevelDivs(mainInner);

  let inserted;
  if (!sections.length) {
    const trimmed = mainInner.trim();
    inserted = trimmed ? `${trimmed}\n${snippet}` : `\n${snippet}`;
  } else if (afterIndex < 0 || afterIndex >= sections.length - 1) {
    const last = sections[sections.length - 1];
    const lastAt = mainInner.lastIndexOf(last);
    const head = mainInner.slice(0, lastAt + last.length);
    const tail = mainInner.slice(lastAt + last.length);
    inserted = `${head}\n${snippet}${tail}`;
  } else {
    let cursor = 0;
    let out = '';
    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      const at = mainInner.indexOf(sec, cursor);
      if (at === -1) {
        out = `${sections.join('\n')}\n${snippet}`;
        cursor = -1;
        break;
      }
      out += mainInner.slice(cursor, at) + sec;
      cursor = at + sec.length;
      if (i === afterIndex) out += `\n${snippet}`;
    }
    if (cursor >= 0) out += mainInner.slice(cursor);
    inserted = out;
  }

  return html.slice(0, start) + inserted + html.slice(closeIdx);
}

export async function fetchDaPageHtml(org, repo, pagePath, token) {
  const file = pagePathToDaFile(pagePath);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  // Prefer admin source for mutation. content.da.live is delivery-only and can diverge.
  const adminUrl = `https://admin.da.live/source/${org}/${repo}/${file}`;
  try {
    const res = await fetch(adminUrl, { headers, credentials: 'include' });
    if (res.ok) {
      const text = await res.text();
      if (text && text.length > 20) return { html: text, source: adminUrl };
    }
    if (res.status === 401 || res.status === 403) {
      return { html: null, source: null, needsToken: true, status: res.status };
    }
  } catch {
    /* fall through */
  }

  if (!token) {
    const contentUrl = `https://content.da.live/${org}/${repo}/${file}`;
    try {
      const res = await fetch(contentUrl, { credentials: 'include' });
      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 20) return { html: text, source: contentUrl };
      }
    } catch {
      /* ignore */
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
  const paths = new Set([hlxPath]);
  // Home is published as both / and /index depending on pipeline.
  if (hlxPath === '/index' || hlxPath === '/') {
    paths.add('/');
    paths.add('/index');
  }
  let last = { ok: false, status: 0, path: hlxPath };
  for (const path of paths) {
    const url = `https://admin.hlx.page/preview/${org}/${repo}/main${path === '/' ? '/' : path}`;
    try {
      const res = await fetch(url, { method: 'POST' });
      last = { ok: res.ok, status: res.status, path };
      if (res.ok) return last;
    } catch (e) {
      last = { ok: false, error: e.message, path };
    }
  }
  return last;
}

/**
 * @param {{ org: string, repo: string, pagePath: string, blockId: string, afterIndex?: number, brandName?: string, products?: object[], token?: string }} input
 */
function normalizeDaOrgRepo(org, repo) {
  let o = String(org || '').trim();
  let r = String(repo || '').trim();
  if (o.toLowerCase() === 'adobedrago') o = 'AdobeDrago';
  if (r.toLowerCase() === 'wolverine') r = 'wolverine';
  return { org: o, repo: r };
}

function previewEditUrl(org, repo, pagePath) {
  const slug = normalizePagePath(pagePath);
  const pageUrl = slug === 'index' ? '/' : `/${slug}/`;
  return `https://main--${repo}--${org}.aem.page${pageUrl}?forge-edit=1&forge-org=${encodeURIComponent(org)}&forge-repo=${encodeURIComponent(repo)}&_t=${Date.now()}`;
}

export async function insertBlockOnDaPageClient(input) {
  const normalized = normalizeDaOrgRepo(input.org, input.repo);
  const org = normalized.org;
  const repo = normalized.repo;
  const {
    pagePath,
    blockId,
    afterIndex = -1,
    brandName = '',
    products,
    token = '',
  } = input;
  if (!org || !repo || !blockId) {
    return { ok: false, error: 'org, repo, and blockId are required' };
  }

  const fetched = await fetchDaPageHtml(org, repo, pagePath, token);
  if (fetched.needsToken) {
    return {
      ok: false,
      needsToken: true,
      error: 'DA sign-in required — use Sign in on da.live when prompted',
      category: getBlockCategory(blockId),
    };
  }
  let pageHtml = fetched.html;
  if (!pageHtml) {
    pageHtml = `<header></header>\n<main>\n</main>\n<footer></footer>\n`;
  }

  const snippet = buildBlockSectionHtml(blockId, {
    brandName,
    products: Array.isArray(products) ? products : undefined,
  });
  if (!snippet?.trim()) {
    return { ok: false, error: `Unknown block type: ${blockId}`, category: getBlockCategory(blockId) };
  }
  const updated = insertBlockIntoPageHtml(pageHtml, snippet, afterIndex);
  if (!updated.includes(snippet.trim()) && !updated.includes(`class="${blockId}"`) && !updated.includes(`class="${blockId} `)) {
    return {
      ok: false,
      error: 'Could not insert block into page HTML (unexpected Document Authoring structure)',
      category: getBlockCategory(blockId),
    };
  }
  const daFile = pagePathToDaFile(pagePath);

  const write = await writeDaPage(org, repo, daFile, updated, token);
  if (!write.ok) {
    const needsToken = write.status === 401 || write.status === 403 || write.body === 'no_token';
    return {
      ok: false,
      error: needsToken
        ? 'DA sign-in required — use Sign in on da.live when prompted (token is captured and stored)'
        : `DA write failed: ${write.status} ${write.body || ''}`,
      needsToken,
      category: getBlockCategory(blockId),
    };
  }

  const hlxPath = pagePathToHlxPath(pagePath);
  await triggerHlxPreviewPath(org, repo, hlxPath);

  return {
    ok: true,
    blockId,
    category: getBlockCategory(blockId),
    previewUrl: previewEditUrl(org, repo, pagePath),
  };
}

/**
 * @param {{ org: string, repo: string, pagePath: string, sectionIndex: number, token?: string }} input
 */
export async function deleteBlockOnDaPageClient(input) {
  const normalized = normalizeDaOrgRepo(input.org, input.repo);
  const org = normalized.org;
  const repo = normalized.repo;
  const { pagePath, sectionIndex, token = '' } = input;
  if (!org || !repo) {
    return { ok: false, error: 'org and repo are required' };
  }
  if (!Number.isFinite(Number(sectionIndex)) || Number(sectionIndex) < 0) {
    return { ok: false, error: 'sectionIndex is required' };
  }

  const fetched = await fetchDaPageHtml(org, repo, pagePath, token);
  if (fetched.needsToken) {
    return {
      ok: false,
      needsToken: true,
      error: 'DA sign-in required — use Sign in on da.live when prompted',
    };
  }
  const pageHtml = fetched.html;
  if (!pageHtml) {
    return { ok: false, error: 'Could not load page from Document Authoring' };
  }

  const removed = removeBlockFromPageHtml(pageHtml, sectionIndex);
  if (!removed.removed) {
    return { ok: false, error: removed.error || 'Delete failed' };
  }

  const daFile = pagePathToDaFile(pagePath);
  const write = await writeDaPage(org, repo, daFile, removed.html, token);
  if (!write.ok) {
    const needsToken = write.status === 401 || write.status === 403 || write.body === 'no_token';
    return {
      ok: false,
      error: needsToken
        ? 'DA sign-in required — use Sign in on da.live when prompted (token is captured and stored)'
        : `DA write failed: ${write.status} ${write.body || ''}`,
      needsToken,
    };
  }

  const hlxPath = pagePathToHlxPath(pagePath);
  await triggerHlxPreviewPath(org, repo, hlxPath);

  return {
    ok: true,
    sectionIndex: Number(sectionIndex),
    sectionCount: removed.sectionCount,
    previewUrl: previewEditUrl(org, repo, pagePath),
  };
}
