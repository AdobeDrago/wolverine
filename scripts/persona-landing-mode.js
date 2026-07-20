/** Persona slug from pathname (supports /proxy/family-texas in phone simulator). */
export function personaIdFromPathname(pathname, loc = window.location) {
  const path = (pathname ?? loc?.pathname ?? '').replace(/\/$/, '');
  const m = path.match(/\/(family-texas|college-student|single-woman-nyc)$/);
  return m ? m[1] : null;
}

/** True when URL is a campaign/segment landing (email, SMS, push deep link). */
export function hasForgeSegmentParam(loc = window.location) {
  const params = new URLSearchParams(loc.search || '');
  return Boolean(params.get('forge-preview-segment') || params.get('forge-segment'));
}
