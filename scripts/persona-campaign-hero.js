/**
 * Client-side campaign hero bar (matches server/persona-campaign-hero.js).
 */

const HERO_BG = '#0A1A0F';
const LOGO = '/images/brand/wolverine-logo-mark.svg';

export const PERSONA_CAMPAIGN_HERO = {
  'family-texas': {
    headline: 'Keep your family connected',
    tagline:
      'Texas families stay connected with the right smartphone for adults and teenagers alike',
    hero: '/images/fpo/persona-family-texas-street.png',
    heroAlt: 'Texas family outdoors — parents and teens',
  },
  'single-woman-nyc': {
    headline: 'You run this city',
    tagline:
      'Active New Yorkers love the Razr compact foldable design — perfect for your on-the-go lifestyle in the city.',
    hero: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=2000&q=80',
    heroAlt: 'Young woman in New York City street scene',
  },
  'college-student': {
    headline: 'Wireless that fits your semester',
    tagline: 'Affordable data and a phone that keeps up with campus life — without breaking the budget.',
    hero: '/images/fpo/persona-college-student.jpg',
    heroAlt: 'College student on campus',
  },
};

export function createCampaignHeroEl(personaId, headlineOverride = '') {
  const meta = PERSONA_CAMPAIGN_HERO[personaId];
  if (!meta) return null;

  const headline = headlineOverride || meta.headline;
  const section = document.createElement('section');
  section.className = 'xwalk-campaign-hero';
  section.dataset.personaId = personaId;

  const grid = document.createElement('div');
  grid.className = 'xwalk-campaign-hero-grid';
  grid.style.cssText =
    'display:grid;grid-template-columns:1fr 1fr;min-height:min(420px,48vw);max-width:1280px;margin:0 auto;width:100%;';

  const copy = document.createElement('div');
  copy.className = 'xwalk-campaign-hero-copy';
  copy.style.cssText =
    'display:flex;flex-direction:column;justify-content:center;padding:48px 40px 48px 56px;';

  const logoP = document.createElement('p');
  logoP.className = 'xwalk-campaign-hero-logo';
  logoP.style.margin = '0 0 20px';
  logoP.innerHTML = `<img src="${LOGO}" alt="Wolverine Mobile" width="40" height="40" style="display:block;">`;

  const h1 = document.createElement('h1');
  h1.className = 'xwalk-campaign-hero-headline';
  h1.textContent = headline;
  h1.style.cssText =
    'margin:0 0 16px;font-family:Arial Black,Arial,sans-serif;font-size:clamp(2rem,4.5vw,3.25rem);font-weight:900;line-height:1.05;color:#fff;';

  copy.append(logoP, h1);
  if (meta.tagline) {
    const tag = document.createElement('p');
    tag.className = 'xwalk-campaign-hero-tagline';
    tag.textContent = meta.tagline;
    tag.style.cssText =
      'margin:0;font-size:1.0625rem;line-height:1.45;color:color-mix(in srgb,#fff 92%,transparent);max-width:36rem;';
    copy.append(tag);
  }

  const visual = document.createElement('div');
  visual.className = 'xwalk-campaign-hero-visual';
  visual.style.cssText = 'position:relative;min-height:320px;overflow:hidden;background:#111;';

  const bg = document.createElement('div');
  bg.className = 'xwalk-campaign-hero-bg';
  bg.style.cssText = 'position:absolute;inset:0;margin:0;padding:0;';
  bg.innerHTML = `<picture><img src="${meta.hero}" alt="${meta.heroAlt}" loading="eager" style="width:100%;height:100%;object-fit:cover;object-position:center top;display:block;"></picture>`;

  visual.append(bg);
  grid.append(copy, visual);
  section.style.background = HERO_BG;
  section.style.color = '#fff';
  section.style.width = '100%';
  section.append(grid);
  return section;
}

import { PERSONA_MOBILE_SAFE_AREA_CSS } from './persona-mobile-safe-area.js';

export const CAMPAIGN_HERO_CSS = `
.xwalk-campaign-hero{background:#0A1A0F!important;color:#fff!important;width:100%!important;display:block!important}
.xwalk-campaign-hero-grid{display:grid!important;grid-template-columns:1fr 1fr!important;min-height:min(420px,48vw)!important;max-width:1280px!important;margin:0 auto!important;width:100%!important}
.xwalk-campaign-hero-copy{display:flex!important;flex-direction:column!important;justify-content:center!important;padding:48px 40px 48px 56px!important}
.xwalk-campaign-hero-headline{color:#fff!important;text-shadow:none!important}
.xwalk-campaign-hero-tagline{color:color-mix(in srgb,#fff 92%,transparent)!important}
.xwalk-campaign-hero-visual{position:relative!important;min-height:320px!important;overflow:hidden!important}
.xwalk-campaign-hero-bg img{width:100%!important;height:100%!important;object-fit:cover!important}
@media(max-width:900px){.xwalk-campaign-hero-grid{grid-template-columns:1fr!important}.xwalk-campaign-hero-visual{min-height:280px!important;order:-1!important}}
${PERSONA_MOBILE_SAFE_AREA_CSS}
`;
