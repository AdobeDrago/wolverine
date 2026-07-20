/**
 * Customer-facing product name on HLX preview sites (Wolverine vs FORGE).
 */
export function isWolverineProductSite() {
  const host = location.hostname.toLowerCase();
  if (host.includes('wolverine')) return true;
  const params = new URLSearchParams(location.search);
  if ((params.get('forge-repo') || '').toLowerCase() === 'wolverine') return true;
  const m = host.match(/^main--([^-]+(?:-[^-]+)*?)--/i);
  return m ? m[1].toLowerCase().includes('wolverine') : false;
}

export function productBrandName() {
  return isWolverineProductSite() ? 'Wolverine' : 'FORGE';
}
