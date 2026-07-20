/**
 * Serialize live preview DOM → DA source HTML and save via admin.da.live.
 */
import { fetchDaPageHtml, pagePathToDaFile, pagePathToHlxPath, triggerHlxPreviewPath } from './forge-inline-edit-da.js';

const FORGE_UI_SELECTORS = [
  '.forge-edit-banner',
  '.forge-edit-drop-zone',
  '.forge-edit-badge',
  '.forge-edit-toast',
  '.forge-edit-menu',
  '.forge-edit-dialog-backdrop',
  '.forge-edit-media-toolbar',
  '.forge-personalization-backdrop',
].join(',');

export function cleanForgeUiFromNode(root) {
  root.querySelectorAll(FORGE_UI_SELECTORS).forEach((n) => n.remove());
  root.querySelectorAll('[contenteditable]').forEach((el) => {
    el.removeAttribute('contenteditable');
    el.removeAttribute('spellcheck');
    el.classList.remove('forge-edit-field', 'forge-edit-field--dirty', 'forge-edit-media');
    el.removeAttribute('title');
  });
  root.querySelectorAll('.forge-edit-block').forEach((el) => {
    el.classList.remove(
      'forge-edit-block',
      'forge-edit-block--content',
      'forge-edit-block--commerce',
      'forge-edit-block--default',
      'forge-edit-block--personalized',
    );
    delete el.dataset.forgeEditDecorated;
    delete el.dataset.forgeComponentType;
    delete el.dataset.forgeBlockId;
    /* Keep data-forge-personalization + data-forge-variant* for RT CDP / AJO delivery */
  });
  root.querySelectorAll('[hidden]').forEach((el) => {
    if (el.hasAttribute('data-forge-variant')) el.removeAttribute('hidden');
  });
}

function mergeMainIntoDaHtml(daHtml, mainEl) {
  const mainClone = mainEl.cloneNode(true);
  cleanForgeUiFromNode(mainClone);
  const inner = mainClone.innerHTML.trim();
  const html = String(daHtml || '');

  const open = html.match(/<main\b[^>]*>/i);
  if (!open) {
    return `${html}\n<main>\n${inner}\n</main>\n`;
  }
  const start = open.index + open[0].length;
  const closeIdx = html.toLowerCase().indexOf('</main>', start);
  if (closeIdx === -1) {
    return `${html}\n<main>\n${inner}\n</main>`;
  }
  return html.slice(0, start) + `\n${inner}\n` + html.slice(closeIdx);
}

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
        if (res.ok || res.status === 201) return { ok: true, status: res.status };
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
  // Prefer pasted IMS bearer — daFetch 401 → loadIms() throws on *.aem.page
  if (token) {
    const bearer = await tryBearer();
    if (bearer?.ok) return bearer;
    bearerErr = bearer;
  }

  try {
    const mod = await import('https://da.live/nx/utils/daFetch.js');
    const daFetch = mod.daFetch || mod.default;
    if (daFetch) {
      if (token && typeof mod.setImsDetails === 'function') {
        mod.setImsDetails(token);
      }
      for (const method of ['PUT', 'POST']) {
        try {
          const res = await daFetch(url, { method, body: makeForm() });
          if (res.ok || res.status === 201) return { ok: true, status: res.status };
          if (res.status === 405 || res.status === 404 || res.status === 401 || res.status === 403) {
            continue;
          }
        } catch {
          /* Missing IMS Client ID — fall through */
        }
      }
    }
  } catch {
    /* bearer fallback */
  }

  if (token) {
    const retry = await tryBearer();
    if (retry) return retry;
    return bearerErr || { ok: false, status: 0, body: 'upload failed' };
  }

  return { ok: false, status: 401, body: 'no_token' };
}

/**
 * Persist current <main> content into DA source for this page.
 */
export async function savePageToDaClient({ org, repo, pagePath, token, mainEl = document.querySelector('main') }) {
  if (!mainEl) return { ok: false, error: 'No <main> on page' };

  const fetched = await fetchDaPageHtml(org, repo, pagePath, token);
  let daHtml = fetched.html;
  if (!daHtml) {
    daHtml = `<header></header>\n<main>\n</main>\n<footer></footer>\n`;
  }

  const updated = mergeMainIntoDaHtml(daHtml, mainEl);
  const daFile = pagePathToDaFile(pagePath);
  const write = await writeDaPage(org, repo, daFile, updated, token);

  if (!write.ok) {
    const needsToken = write.status === 401 || write.body === 'no_token';
    return {
      ok: false,
      needsToken,
      error: needsToken
        ? 'Paste your da.live token to save (or sign in on da.live in this browser)'
        : `Save failed: ${write.status} ${write.body || ''}`,
    };
  }

  await triggerHlxPreviewPath(org, repo, pagePathToHlxPath(pagePath));
  return { ok: true };
}
