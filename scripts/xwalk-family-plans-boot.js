/** Family BYOD page — inject grid CSS + rebuild DOM (HLX strips classes). */
(function () {
  const PRIMARY = '#1DB954';
  const SECONDARY = '#0E7A3A';
  const MINT_PAGE = '#eef8f1';
  const MINT_ROW = '#f3fbf6';
  const MINT_PILL = '#d8f3e0';
  const DARK_PILL = '#1a1a1a';
  const LINE_RE = /^(\d+(?:st|nd|rd|th) line|Phone|Plan|Talk|Data boost|Hotspot|Global roaming)\b/i;
  const HERO_BG = '#0A1A0F';
  const LOGO = '/images/brand/wolverine-logo-mark.svg';
  const bootState = { layoutDone: false, heroDone: false, heroSyncing: false, segmentRunning: false, heroRetryCount: 0 };
  const SINGLE_OFFER = {
    'single-woman-nyc': {
      tagline:
        'Active New Yorkers love the Razr compact foldable design — perfect for your on-the-go lifestyle in the city.',
      planTitle: 'Your Plan',
      planPrice: '$50.00',
      pill: 'Unlimited talk, text and data with Global Roaming',
      altPill: 'Unlimited talk, text and premium global roaming in 200+ countries',
      deviceName: 'Razr',
      devicePrice: '$499.99. or $50/month for 12 months',
      devicePriceWas: '$499.99',
      devicePricePromo: '$494.99',
      promoBadge: '$5 off your first purchase',
      promoCode: 'NYC5',
      acoOffer: 'aco-offer-nyc-welcome-5',
      phone:
        'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=900&q=80',
      specs: [
        ['6.9" pOLED', '144Hz Display', '5G Ready'],
        ['50MP Camera', '4200mAh Battery', '256GB Storage'],
      ],
      shop: '/checkout?promo=NYC5&acoOffer=aco-offer-nyc-welcome-5',
    },
    'college-student': {
      tagline: 'Affordable data and a phone that keeps up with campus life — without breaking the budget.',
      planTitle: 'Student Essential',
      planPrice: '$25/mo',
      pill: '5GB premium data · unlimited talk & text',
      altPill: '5GB premium data + Campus data boost · unlimited talk & text',
      deviceName: 'Moto G Play',
      devicePrice: 'From $9.99/mo on Student Essential',
      phone:
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80',
      specs: [
        ['6.5" HD+ display', '5G ready', 'All-day battery'],
        ['50MP camera', 'Student budget friendly', 'Campus-ready essentials'],
      ],
      shop: '/phones',
    },
    'family-texas': {
      tagline:
        'Texas families stay connected with the right smartphone for adults and teenagers alike',
      planTitle: 'Your Plan',
      planPrice: '$80.00',
      pill: 'Unlimited talk, text and premium data with hotspot',
      altPill: 'Unlimited premium data with hotspot on every line',
      deviceName: 'Apple iPhone 16e',
      devicePrice: 'From $29/mo',
      phone:
        'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=900&q=80',
      specs: [
        ['6.1" Super Retina XDR', 'A18 chip', '5G Ready'],
        ['48MP Fusion camera', 'All-day battery', '256GB Storage'],
      ],
      shop: '/plans',
    },
  };
  const CAMPAIGN_HERO = {
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
      tagline:
        'Affordable data and a phone that keeps up with campus life — without breaking the budget.',
      hero: '/images/fpo/persona-college-student.jpg',
      heroAlt: 'College student on campus',
    },
  };

  function createCampaignHero(personaId, headlineOverride, forgeOverrides) {
    const meta = CAMPAIGN_HERO[personaId];
    if (!meta) return null;
    const headline = (forgeOverrides && forgeOverrides.headline) || headlineOverride || meta.headline;
    const tagline = (forgeOverrides && forgeOverrides.tagline) || meta.tagline;
    const heroSrc = (forgeOverrides && forgeOverrides.hero) || meta.hero;
    const heroAlt = (forgeOverrides && forgeOverrides.heroAlt) || meta.heroAlt;
    const section = document.createElement('section');
    section.className = 'xwalk-campaign-hero';
    section.style.cssText = 'background:' + HERO_BG + ';color:#fff;width:100%;';
    const grid = document.createElement('div');
    grid.className = 'xwalk-campaign-hero-grid';
    grid.style.cssText =
      'display:grid;grid-template-columns:1fr 1fr;min-height:min(420px,48vw);max-width:1280px;margin:0 auto;width:100%;';
    const copy = document.createElement('div');
    copy.className = 'xwalk-campaign-hero-copy';
    copy.style.cssText =
      'display:flex;flex-direction:column;justify-content:center;padding:48px 40px 48px 56px;';
    copy.innerHTML =
      '<p class="xwalk-campaign-hero-logo" style="margin:0 0 20px;"><img src="' +
      LOGO +
      '" alt="Wolverine Mobile" width="40" height="40" style="display:block;"></p><h1 class="xwalk-campaign-hero-headline" style="margin:0 0 16px;font-family:Arial Black,Arial,sans-serif;font-size:clamp(2rem,4.5vw,3.25rem);font-weight:900;line-height:1.05;color:#fff;">' +
      headline +
      '</h1>' +
      (tagline
        ? '<p class="xwalk-campaign-hero-tagline" style="margin:0;font-size:1.0625rem;line-height:1.45;color:color-mix(in srgb,#fff 92%,transparent);max-width:36rem;">' +
          tagline +
          '</p>'
        : '');
    const visual = document.createElement('div');
    visual.className = 'xwalk-campaign-hero-visual';
    visual.style.cssText = 'position:relative;min-height:320px;overflow:hidden;background:#111;';
    visual.innerHTML =
      '<div class="xwalk-campaign-hero-bg" style="position:absolute;inset:0;"><picture><img src="' +
      heroSrc +
      '" alt="' +
      heroAlt +
      '" loading="eager" style="width:100%;height:100%;object-fit:cover;object-position:center top;display:block;"></picture></div>';
    grid.append(copy, visual);
    section.append(grid);
    return section;
  }

  function ensureCampaignHero(personaId, headline, forgeOverrides) {
    const page = document.querySelector('.xwalk-family-plans-page');
    if (!page) return;
    if (page.querySelector('.xwalk-campaign-hero')) {
      if (forgeOverrides) applyLandingHeroOverrides(forgeOverrides);
      return;
    }
    const hero = createCampaignHero(personaId, headline || '', forgeOverrides);
    if (hero) page.insertBefore(hero, page.firstChild);
  }

  function stripLegacyCampaignQueryParams() {
    const p = new URLSearchParams(location.search);
    const legacy = [
      'forge-campaign-hero',
      'forge-campaign-hero-alt',
      'forge-campaign-headline',
      'forge-campaign-tagline',
      'forge-api',
    ];
    let changed = false;
    legacy.forEach(function (key) {
      if (p.has(key)) {
        p.delete(key);
        changed = true;
      }
    });
    if (!changed) return;
    const qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }

  function readMobileOverrideParams() {
    const p = new URLSearchParams(location.search);
    if (p.get('forge-mobile-campaign') !== '1') return null;
    return {
      headline: p.get('forge-mobile-headline') || '',
      tagline: p.get('forge-mobile-tagline') || '',
      hero: p.get('forge-mobile-hero') || '',
      heroAlt: p.get('forge-mobile-hero-alt') || '',
      layout: p.get('forge-mobile-layout') || '',
    };
  }

  function readCampaignOverrideParams() {
    const p = new URLSearchParams(location.search);
    const hero = p.get('forge-campaign-hero') || '';
    if (!hero) return null;
    return {
      headline: p.get('forge-campaign-headline') || '',
      tagline: p.get('forge-campaign-tagline') || '',
      hero,
      heroAlt: p.get('forge-campaign-hero-alt') || '',
    };
  }

  function readLandingOverrideParams() {
    const mobile = readMobileOverrideParams();
    if (mobile?.hero) return mobile;
    return readCampaignOverrideParams() || mobile;
  }

  const DEFAULT_FORGE_API =
    'https://4191536-247cyandingo.adobeio-static.net/api/v1/web/dx-excshell-1/forge-api';

  function resolveForgeApiBase() {
    const p = new URLSearchParams(location.search);
    const fromQuery = p.get('forge-api');
    if (fromQuery) return fromQuery.replace(/\/$/, '');
    const fromConfig = window.FORGE_CONFIG && window.FORGE_CONFIG.FORGE_API_URL;
    if (fromConfig) return String(fromConfig).replace(/\/$/, '');
    return DEFAULT_FORGE_API;
  }

  function segmentFromContext() {
    const p = new URLSearchParams(location.search);
    return p.get('forge-preview-segment') || p.get('forge-segment') || '';
  }

  function personaIdFromPath() {
    return personaIdFromPathname(location.pathname);
  }

  function readCachedEmailHero(personaId) {
    const cache = window.FORGE_EMAIL_HEROES;
    if (!cache || !personaId) return null;
    const hit = cache[personaId];
    if (!hit) return null;
    const hero = hit.hero || hit.heroImage || '';
    if (!hero) return null;
    return {
      headline: hit.headline || '',
      tagline: hit.tagline || '',
      hero,
      heroAlt: hit.heroAlt || '',
    };
  }

  async function fetchCampaignHeroFromForge() {
    const api = resolveForgeApiBase();
    if (!api) return null;
    const seg = segmentFromContext();
    const personaId = personaIdFromPath();
    const mobileMode = new URLSearchParams(location.search || '').get('forge-mobile-campaign') === '1';
    const queryParts = [];
    if (seg) queryParts.push('segment=' + encodeURIComponent(seg));
    else if (personaId) queryParts.push('persona=' + encodeURIComponent(personaId));
    if (mobileMode) queryParts.push('viewport=mobile');
    if (!queryParts.length) return null;
    try {
      const res = await fetch(api + '/social/landing-hero?' + queryParts.join('&'), { credentials: 'omit' });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !data.heroImage) return null;
      return {
        headline: data.headline || '',
        tagline: data.tagline || '',
        hero: data.heroImage,
        heroAlt: data.heroAlt || '',
      };
    } catch {
      bootState.heroFetchFailed = true;
      return null;
    }
  }

  function applyLandingHeroOverrides(overrides) {
    if (!overrides) return;
    document.body.classList.add('forge-mobile-campaign-override');
    if (overrides.layout === 'text-first') {
      document.body.classList.add('forge-mobile-text-first');
    }
    const h1 = document.querySelector('.xwalk-campaign-hero-headline');
    const tag = document.querySelector('.xwalk-campaign-hero-tagline');
    const img = document.querySelector('.xwalk-campaign-hero-bg img');
    if (overrides.headline && h1) h1.textContent = overrides.headline;
    if (overrides.tagline && tag) tag.textContent = overrides.tagline;
    if (overrides.hero && img) {
      img.src = overrides.hero;
      if (overrides.heroAlt) img.alt = overrides.heroAlt;
    }
    if (!document.getElementById('forge-mobile-override-css')) {
      const s = document.createElement('style');
      s.id = 'forge-mobile-override-css';
      s.textContent =
        'body.forge-mobile-text-first .xwalk-campaign-hero-grid{display:flex!important;flex-direction:column!important}' +
        'body.forge-mobile-text-first .xwalk-campaign-hero-visual{order:-1!important}' +
        'body.forge-mobile-text-first .xwalk-campaign-hero-copy{order:1!important}';
      document.head.appendChild(s);
    }
  }

  async function resolveEmailHeroOverrides() {
    const local = readLandingOverrideParams();
    if (local?.hero) return local;
    const personaId = personaIdFromPath();
    const cached = readCachedEmailHero(personaId);
    if (cached?.hero) return cached;
    if (segmentFromContext() || personaId) {
      return fetchCampaignHeroFromForge();
    }
    return null;
  }

  async function syncLandingHeroFromForge() {
    if (bootState.heroDone || bootState.heroSyncing) return;
    bootState.heroSyncing = true;
    try {
      const overrides = await resolveEmailHeroOverrides();
      if (!overrides?.hero) return;
      const img = document.querySelector('.xwalk-campaign-hero-bg img');
      if (!img) return;
      applyLandingHeroOverrides(overrides);
      stripLegacyCampaignQueryParams();
      bootState.heroDone = true;
    } finally {
      bootState.heroSyncing = false;
    }
  }

  function applyForgeMobileOverrides() {
    if (bootState.heroDone || bootState.heroRetryCount > 40) return;
    bootState.heroRetryCount += 1;
    void syncLandingHeroFromForge().then(function () {
      if (!bootState.heroDone && hasSegmentParam() && bootState.heroRetryCount <= 40) {
        setTimeout(applyForgeMobileOverrides, 150);
      }
    });
  }

  function injectCss() {
    if (document.getElementById('forge-family-plans')) return;
    const s = document.createElement('style');
    s.id = 'forge-family-plans';
    s.textContent = document.getElementById('forge-family-plans-data')?.textContent || '';
    if (!s.textContent) {
      s.textContent = [
        '.xwalk-family-plans-page{background:' + MINT_PAGE + '!important;width:100%!important}',
        '.xwalk-family-plans-page--single-offer{background:#fff!important;width:100%!important}',
        'body.xwalk-persona-segment-landing header .xwalk-promo-strip,body.xwalk-persona-segment-landing .fragment.xwalk-promo-strip,body.xwalk-persona-segment-landing main .xwalk-promo-strip{display:none!important}',
        'body.xwalk-persona-segment-landing .xwalk-mockup-green-bar{display:none!important}',
        'body.xwalk-persona-segment-landing .xwalk-campaign-hero-headline,body.xwalk-persona-segment-landing .xwalk-campaign-hero-tagline,body.xwalk-persona-segment-landing .xwalk-campaign-hero-copy{color:#fff!important}',
        'body.xwalk-persona-segment-landing .xwalk-plan-line-pill--dark,body.xwalk-persona-segment-landing .xwalk-plan-tier-switch.xwalk-plan-line-pill--dark{color:#fff!important}',
        'body.xwalk-persona-segment-landing .xwalk-plan-line-pill--accent{color:' + SECONDARY + '!important}',
        '.xwalk-mockup-white{background:#fff!important;padding:28px 32px 48px!important;max-width:1200px!important;margin:0 auto!important}',
        '.xwalk-mockup-green-bar{background:' + PRIMARY + '!important;color:#000!important;text-align:center!important;padding:14px 24px!important;font-weight:800!important;display:block!important}',
        '.xwalk-mockup-quote{text-align:center!important;font-style:italic!important;color:' + PRIMARY + '!important;margin:0 0 28px!important}',
        '.xwalk-mockup-offer-row{display:grid!important;grid-template-columns:1fr minmax(160px,200px)!important;gap:24px!important}',
        '.xwalk-mockup-plan-title{color:#111!important;margin:0!important;font-weight:900!important}',
        '.xwalk-mockup-plan-price{color:' + PRIMARY + '!important}',
        '.xwalk-mockup-plan-pill .xwalk-plan-line-pill--dark,.xwalk-mockup-plan-pill .xwalk-plan-line-pill.xwalk-plan-line-pill--dark{background:' + DARK_PILL + '!important;color:#fff!important;border-radius:8px!important;padding:12px 18px!important;margin:0!important;display:block!important}',
        '.xwalk-mockup-plan-pill .xwalk-plan-line-pill--accent,.xwalk-mockup-plan-pill .xwalk-plan-line-pill.xwalk-plan-line-pill--accent{background:' + MINT_PILL + '!important;color:' + SECONDARY + '!important;border:1px solid ' + PRIMARY + '!important;border-radius:8px!important;padding:12px 18px!important;margin:0!important;display:block!important;font-weight:700!important}',
        '.xwalk-mockup-plan-body{display:grid!important;grid-template-columns:minmax(160px,240px) 1fr!important;gap:32px 40px!important}',
        '.xwalk-mockup-device-footer{display:grid!important;grid-template-columns:1fr 1.4fr!important;align-items:baseline!important;max-width:240px!important;margin:0 auto!important}',
        '.xwalk-mockup-device-name{color:' + PRIMARY + '!important;font-weight:900!important;margin:0!important}',
        '.xwalk-mockup-device-price{color:#111!important;margin:0!important}',
        '.xwalk-mockup-specs{display:grid!important;grid-template-columns:1fr 1fr!important;gap:24px 40px!important}',
        '.xwalk-mockup-specs li{color:' + PRIMARY + '!important;font-weight:700!important;list-style:none!important}',
        '.xwalk-mockup-specs li::before{content:"✓ "!important}',
        '.xwalk-mockup-cta{background:' + PRIMARY + '!important;color:#fff!important;font-weight:900!important;border-radius:14px!important;display:flex!important;align-items:center!important;justify-content:center!important;min-height:280px!important;text-decoration:none!important}',
        '.xwalk-aco-promo{background:linear-gradient(135deg,#0E7A3A 0%,' + PRIMARY + ' 100%)!important;color:#fff!important;padding:16px 20px!important;border-radius:12px!important;margin:0 0 20px!important}',
        '.xwalk-aco-promo-badge,.xwalk-aco-promo-code{margin:0!important;font-size:14px!important;line-height:1.4!important}',
        '.xwalk-mockup-device-price s{color:#666!important;font-weight:400!important;margin-right:6px!important}',
        '.xwalk-mockup-device-price .xwalk-aco-savings{display:block!important;font-size:12px!important;font-weight:700!important;color:' + SECONDARY + '!important;margin-top:4px!important}',
        '.xwalk-family-row{display:grid!important;grid-template-columns:92px 168px minmax(0,1fr)!important;gap:12px 32px!important;align-items:center!important;padding:22px 28px!important;background:' + MINT_ROW + '!important;width:100%!important}',
        '.xwalk-family-line-label{font-weight:800!important;color:#111!important}',
        '.xwalk-family-line-price{font-weight:900!important;font-size:1.4rem!important;color:' + PRIMARY + '!important}',
        '.xwalk-family-pill--dark,.xwalk-family-pill--dark *,main:has(#you-run-this-city) .xwalk-family-pill--dark,main:has(#you-run-this-city) .xwalk-family-pill--dark *,main:has(#keep-your-family-connected) .xwalk-family-pill--dark,main:has(#keep-your-family-connected) .xwalk-family-pill--dark *,main:has(#wireless-that-fits-your-semester) .xwalk-family-pill--dark,main:has(#wireless-that-fits-your-semester) .xwalk-family-pill--dark *{background:' + DARK_PILL + '!important;color:#fff!important;border-radius:999px!important;padding:14px 24px!important;text-align:center!important;width:100%!important}',
        '.xwalk-family-pill--dark *{background:transparent!important;padding:0!important;border-radius:0!important;width:auto!important}',
        '.xwalk-family-pill--accent{background:' + MINT_PILL + '!important;color:' + SECONDARY + '!important;border:1px solid ' + PRIMARY + '!important;border-radius:999px!important;padding:14px 24px!important;text-align:center!important;width:100%!important;font-weight:700!important}',
        '.xwalk-family-title{color:' + PRIMARY + '!important;font-family:Arial Black,Arial,sans-serif!important;font-size:1.65rem!important;font-weight:900!important}',
        '.xwalk-family-cta{display:inline-block!important;background:' + PRIMARY + '!important;color:#fff!important;font-size:1.625rem!important;font-weight:900!important;padding:20px 56px!important;border-radius:14px!important;text-decoration:none!important}',
        '.xwalk-family-cta-wrap{text-align:center!important;margin:40px 0 0!important}',
        'body.xwalk-persona-segment-landing{background:#0A1A0F!important}',
        'body.xwalk-persona-offer-page--family-texas main,body.xwalk-persona-offer-page--college-student main,body.xwalk-persona-offer-page--single-woman-nyc main{background:transparent!important;display:block!important;max-width:none!important;padding:0!important}',
        '@media(max-width:900px){body.xwalk-persona-segment-landing,body.xwalk-persona-offer-page--family-texas,body.xwalk-persona-offer-page--college-student,body.xwalk-persona-offer-page--single-woman-nyc{background:#0A1A0F!important}}',
        'main:has(#you-run-this-city),main:has(#keep-your-family-connected),main:has(#wireless-that-fits-your-semester){background:' + MINT_PAGE + '!important;color:#111!important;display:block!important}',
        'main:has(#you-run-this-city)>div,main:has(#keep-your-family-connected)>div,main:has(#wireless-that-fits-your-semester)>div{background:transparent!important;color:#111!important;min-height:0!important;overflow:visible!important}',
        'main:has(#you-run-this-city) h1,main:has(#you-run-this-city) h2,main:has(#you-run-this-city) p:not(.xwalk-family-pill--dark):not(.xwalk-plan-line-pill--dark):not(.xwalk-plan-tier-switch),main:has(#keep-your-family-connected) h1,main:has(#keep-your-family-connected) h2,main:has(#keep-your-family-connected) p:not(.xwalk-family-pill--dark):not(.xwalk-plan-line-pill--dark):not(.xwalk-plan-tier-switch),main:has(#wireless-that-fits-your-semester) h1,main:has(#wireless-that-fits-your-semester) h2,main:has(#wireless-that-fits-your-semester) p:not(.xwalk-family-pill--dark):not(.xwalk-plan-line-pill--dark):not(.xwalk-plan-tier-switch){color:#111!important;text-shadow:none!important}',
        'main:has(#you-run-this-city) .xwalk-family-pill--dark,main:has(#you-run-this-city) .xwalk-family-pill--dark *,main:has(#keep-your-family-connected) .xwalk-family-pill--dark,main:has(#keep-your-family-connected) .xwalk-family-pill--dark *,main:has(#wireless-that-fits-your-semester) .xwalk-family-pill--dark,main:has(#wireless-that-fits-your-semester) .xwalk-family-pill--dark *,main:has(#you-run-this-city) .xwalk-plan-line-pill--dark,main:has(#keep-your-family-connected) .xwalk-plan-line-pill--dark,main:has(#wireless-that-fits-your-semester) .xwalk-plan-line-pill--dark{color:#fff!important}',
        '.xwalk-campaign-hero{background:' + HERO_BG + '!important;color:#fff!important;width:100%!important;display:block!important}',
        '.xwalk-campaign-hero-grid{display:grid!important;grid-template-columns:1fr 1fr!important;min-height:min(420px,48vw)!important;max-width:1280px!important;margin:0 auto!important}',
        '.xwalk-campaign-hero-headline{color:#fff!important;text-shadow:none!important}',
        '.xwalk-campaign-hero-tagline{color:color-mix(in srgb,#fff 92%,transparent)!important}',
        '.xwalk-campaign-hero-visual{position:relative!important;min-height:320px!important;overflow:hidden!important}',
        '.xwalk-campaign-hero-bg img{width:100%!important;height:100%!important;object-fit:cover!important}',
        '@media(max-width:900px){.xwalk-campaign-hero-grid{grid-template-columns:1fr!important}.xwalk-campaign-hero-visual{min-height:280px!important;order:-1!important}.xwalk-mockup-offer-row{grid-template-columns:1fr!important}.xwalk-mockup-cta{display:flex!important;width:100%!important;min-height:120px!important}}',
      ].join('');
    }
    document.head.appendChild(s);
  }

  function paintRow(row, idx) {
    row.style.cssText =
      'display:grid;grid-template-columns:92px 168px minmax(0,1fr);gap:12px 32px;align-items:center;padding:22px 28px;background:' +
      MINT_ROW +
      ';width:100%;box-sizing:border-box;';
    row.querySelector('.xwalk-family-line-label')?.style.setProperty('color', '#111', 'important');
    row.querySelector('.xwalk-family-line-label')?.style.setProperty('font-weight', '800', 'important');
    const price = row.querySelector('.xwalk-family-line-price');
    if (price) price.style.cssText = 'font-weight:900;font-size:1.4rem;color:' + PRIMARY + ';';
    const pill = row.querySelector('.xwalk-family-pill');
    if (pill) {
      if (idx < 2) pill.style.cssText = 'margin:0;padding:14px 24px;border-radius:999px;text-align:center;width:100%;background:' + DARK_PILL + ';color:#fff;font-size:0.8125rem;line-height:1.4;';
      else pill.style.cssText = 'margin:0;padding:14px 24px;border-radius:999px;text-align:center;width:100%;background:' + MINT_PILL + ';color:' + SECONDARY + ';font-weight:700;border:1px solid ' + PRIMARY + ';font-size:0.8125rem;line-height:1.4;';
    }
  }

  function isCta(p) {
    return p?.tagName === 'P' && p.querySelector('a') && /shop\s*now/i.test(p.textContent || '');
  }
  function isLine(p) {
    const t = (p.textContent || '').trim();
    return p?.tagName === 'P' && LINE_RE.test(t);
  }

  function lineLabel(p) {
    const t = (p.textContent || '').trim();
    const m = t.match(LINE_RE);
    return m ? m[1] : t.split(/\s+\$/)[0].trim();
  }

  function specsHtml(left, right) {
    const col = (items) => '<ul>' + items.map((li) => '<li>' + li + '</li>').join('') + '</ul>';
    return '<div class="xwalk-mockup-specs">' + col(left) + col(right) + '</div>';
  }

  const GRID_DEFAULT = {
    'family-texas': {
      headline: 'Keep your family connected',
      headlineId: 'keep-your-family-connected',
      title: 'Family Plans – Bring your own device',
      titleId: 'family-plans--bring-your-own-device',
      shop: '/plans',
      rows: [
        { label: '1st line', price: '$50', pill: 'Unlimited talk, text and premium data with hotspot', accent: false },
        { label: '2nd line', price: '$45', pill: 'Unlimited talk, text and premium data with hotspot', accent: false },
        { label: '3rd line', price: '$24', pill: 'Unlimited talk, text and 30GB of Premium data', accent: true },
        { label: '4th line', price: '$21', pill: 'Unlimited talk, text and 30GB of Premium data', accent: true },
      ],
    },
    'single-woman-nyc': {
      headline: 'You run this city',
      headlineId: 'you-run-this-city',
      title: 'Unlimited Plus + Motorola Razr — NYC wireless',
      shop: '/phones',
      rows: [
        { label: 'Phone', price: 'From $499.99', pill: 'Motorola Razr foldable — built for NYC on-the-go life', accent: false },
        { label: 'Plan', price: '$45/mo', pill: 'Unlimited Plus · 30GB hotspot · unlimited talk & text', accent: false },
        { label: 'Talk & text', price: 'Unlimited', pill: 'Nationwide calling and messaging', accent: false },
        { label: 'Global roaming', price: 'Included', pill: 'Unlimited talk, text and data with Global Roaming', accent: true },
      ],
    },
    'college-student': {
      headline: 'Wireless that fits your semester',
      headlineId: 'wireless-that-fits-your-semester',
      title: 'Student Essential — campus wireless',
      shop: '/phones',
      rows: [
        { label: 'Phone', price: 'From $9.99', pill: 'Moto G Play — student budget friendly', accent: false },
        { label: 'Plan', price: '$25/mo', pill: '5GB premium data · unlimited talk & text', accent: false },
        { label: 'Talk & text', price: 'Unlimited', pill: 'Nationwide calling and messaging', accent: false },
        { label: 'Data boost', price: '+$5/mo', pill: 'Extra high-speed data for streaming & study', accent: true },
      ],
    },
  };

  function hasSegmentParam() {
    const params = new URLSearchParams(location.search || '');
    return Boolean(params.get('forge-preview-segment') || params.get('forge-segment'));
  }

  function hidePromoStrip() {
    document
      .querySelectorAll('header .xwalk-promo-strip, .fragment.xwalk-promo-strip, main .xwalk-promo-strip')
      .forEach((el) => {
        el.style.setProperty('display', 'none', 'important');
      });
  }

  function stripAiBadges() {
    document.querySelectorAll('.xwalk-mockup-green-bar, .xwalk-mockup-ai-badge').forEach((el) => el.remove());
  }

  function buildGridPage(personaId, headline) {
    const meta = GRID_DEFAULT[personaId];
    if (!meta) return null;
    const root = document.createElement('div');
    root.className = 'xwalk-persona-mockup xwalk-family-plans-page';
    root.style.cssText = 'background:' + MINT_PAGE + ';width:100%;';
    const main = document.createElement('section');
    main.className = 'xwalk-family-main';
    main.style.cssText =
      'background:' + MINT_PAGE + ';padding:36px 40px 56px;max-width:1040px;margin:0 auto;';
    const h1 = document.createElement('h1');
    h1.className = 'xwalk-family-headline';
    if (meta.headlineId) h1.id = meta.headlineId;
    h1.textContent = headline || meta.headline;
    h1.style.cssText =
      'margin:0 0 24px;font-family:Arial Black,Arial,sans-serif;font-size:1.75rem;font-weight:900;color:' +
      PRIMARY +
      ';';
    main.append(h1);
    const shell = document.createElement('div');
    shell.className = 'xwalk-family-offer';
    const h2 = document.createElement('h2');
    h2.className = 'xwalk-family-title';
    h2.textContent = meta.title;
    if (meta.titleId) h2.id = meta.titleId;
    h2.style.cssText =
      'margin:0 0 28px;font-family:Arial Black,Arial,sans-serif;font-size:1.65rem;font-weight:900;color:' +
      PRIMARY +
      ';';
    shell.append(h2);
    const grid = document.createElement('div');
    grid.className = 'xwalk-family-grid';
    meta.rows.forEach((row, ri) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'xwalk-family-row';
      rowEl.innerHTML =
        '<span class="xwalk-family-line-label">' +
        row.label +
        '</span><span class="xwalk-family-line-price"><span class="xwalk-family-now">' +
        row.price +
        '</span></span><p class="xwalk-family-pill xwalk-family-pill--' +
        (row.accent ? 'accent' : 'dark') +
        '">' +
        row.pill +
        '</p>';
      grid.append(rowEl);
      paintRow(rowEl, ri);
    });
    shell.append(grid);
    const ctaWrap = document.createElement('p');
    ctaWrap.className = 'xwalk-family-cta-wrap';
    ctaWrap.innerHTML =
      '<a class="xwalk-family-cta" href="' + meta.shop + '">Shop Now →</a>';
    shell.append(ctaWrap);
    main.append(shell);
    root.append(main);
    return root;
  }

  function planPillsHtml(meta) {
    let html =
      '<p class="xwalk-plan-pill xwalk-plan-line-pill xwalk-plan-line-pill--dark">' +
      meta.pill +
      '</p>';
    if (meta.altPill) {
      html +=
        '<p class="xwalk-plan-pill xwalk-plan-line-pill xwalk-plan-line-pill--accent">' +
        meta.altPill +
        '</p>';
    }
    return html;
  }

  function buildAcoPromoBanner(meta) {
    if (!meta.promoCode) return '';
    return (
      '<div class="xwalk-aco-promo xwalk-aco-promo--compact" data-aco-offer="' +
      (meta.acoOffer || '') +
      '" data-promo-code="' +
      meta.promoCode +
      '"><p class="xwalk-aco-promo-badge">' +
      (meta.promoBadge || '$5 off your first purchase') +
      '</p><p class="xwalk-aco-promo-code">Code <strong>' +
      meta.promoCode +
      '</strong> · Commerce</p></div>'
    );
  }

  function devicePriceHtml(meta) {
    if (meta.devicePriceWas && meta.devicePricePromo) {
      return (
        '<s>' +
        meta.devicePriceWas +
        '</s> <strong>' +
        meta.devicePricePromo +
        '</strong><span class="xwalk-aco-savings">' +
        (meta.promoBadge || '') +
        '</span>'
      );
    }
    return '<strong>' + meta.devicePrice + '</strong>';
  }

  function buildSingleOfferPage(personaId, headline, forgeOverrides) {
    const meta = SINGLE_OFFER[personaId];
    if (!meta) return null;
    const root = document.createElement('div');
    root.className =
      'xwalk-persona-mockup xwalk-family-plans-page xwalk-family-plans-page--campaign xwalk-family-plans-page--single-offer xwalk-persona-segment-landing';
    root.style.cssText = 'background:#fff;width:100%;';
    const hero = createCampaignHero(personaId, headline, forgeOverrides);
    if (hero) root.append(hero);
    const white = document.createElement('section');
    white.className = 'xwalk-mockup-white';
    if (meta.tagline) {
      white.innerHTML += '<p class="xwalk-mockup-quote"><em>' + meta.tagline + '</em></p>';
    }
    white.innerHTML +=
      '<div class="xwalk-mockup-offers">' +
      buildAcoPromoBanner(meta) +
      '<div class="xwalk-mockup-offer-row"><div class="xwalk-mockup-offer-main">' +
      '<div class="xwalk-mockup-plan-head"><h2 class="xwalk-mockup-plan-title" id="xwalk-single-offer-plan">' +
      meta.planTitle +
      ' <span class="xwalk-mockup-plan-price">' +
      meta.planPrice +
      '</span></h2><div class="xwalk-mockup-plan-pill">' +
      planPillsHtml(meta) +
      '</div></div><div class="xwalk-mockup-plan-body"><div class="xwalk-mockup-device-col"><div class="xwalk-mockup-device"><img src="' +
      meta.phone +
      '" alt="' +
      meta.deviceName +
      '"></div><div class="xwalk-mockup-device-footer"><p class="xwalk-mockup-device-name">' +
      meta.deviceName +
      '</p><p class="xwalk-mockup-device-price">' +
      devicePriceHtml(meta) +
      '</p></div></div>' +
      specsHtml(meta.specs[0], meta.specs[1]) +
      '</div></div><a class="xwalk-mockup-cta" href="' +
      meta.shop +
      '">Shop Now →</a></div></div>';
    root.append(white);
    return root;
  }

  function headlineFromPage(page, personaId) {
    const meta = GRID_DEFAULT[personaId] || SINGLE_OFFER[personaId];
    return (
      page?.querySelector('.xwalk-family-headline')?.textContent?.trim() ||
      page?.querySelector('.xwalk-campaign-hero-headline')?.textContent?.trim() ||
      meta?.headline ||
      ''
    );
  }

  function personaIdFromPathname(pathname) {
    const path = String(pathname || '');
    const m = path.match(/(?:^|\/)(family-texas|college-student|single-woman-nyc)(?:\/|$|\?|#)/);
    return m ? m[1] : null;
  }

  async function runSegmentLayout(personaId, headline, page) {
    const forgeHero = await resolveEmailHeroOverrides();
    hidePromoStrip();
    stripAiBadges();

    if (page?.querySelector('.xwalk-mockup-offer-row')) {
      ensureCampaignHero(personaId, headline, forgeHero);
      page.querySelectorAll('.xwalk-plan-line-pill--dark, .xwalk-family-pill--dark').forEach((p) => {
        p.style.setProperty('color', '#fff', 'important');
        p.querySelectorAll('*').forEach((child) => child.style.setProperty('color', '#fff', 'important'));
      });
    } else if (page?.querySelector('.xwalk-family-grid')) {
      const built = buildSingleOfferPage(personaId, headline, forgeHero);
      if (built) page.replaceWith(built);
    } else {
      const section =
        document.querySelector('main > .section > div') ||
        document.querySelector('main > div') ||
        document.querySelector('.xwalk-family-plans > div > div');
      const built = buildSingleOfferPage(personaId, headline, forgeHero);
      if (section && built) section.replaceChildren(built);
    }

    bootState.layoutDone = true;
    if (forgeHero?.hero) {
      applyLandingHeroOverrides(forgeHero);
      stripLegacyCampaignQueryParams();
      bootState.heroDone = true;
    } else {
      applyForgeMobileOverrides();
    }
  }

  function run() {
    if (!document.body) return;
    const personaId = personaIdFromPathname(location.pathname);
    if (!personaId) return;
    const segment = hasSegmentParam();
    injectCss();
    document.body.classList.add('xwalk-persona-offer-page', 'xwalk-persona-offer-page--' + personaId);
    document.body.classList.toggle('xwalk-persona-segment-landing', segment);
    const main = document.querySelector('main');
    if (main) {
      main.classList.remove('xwalk-boost-main');
      main.style.cssText =
        'display:block;max-width:none;padding:0;background:' + (segment ? '#fff' : MINT_PAGE) + ';';
    }

    if (segment) {
      hidePromoStrip();
      stripAiBadges();
      if (bootState.layoutDone) {
        applyForgeMobileOverrides();
        return;
      }
    } else if (bootState.layoutDone) {
      return;
    }

    let page = document.querySelector('.xwalk-family-plans-page');
    const headline = headlineFromPage(page, personaId);

    if (!segment) {
      page?.querySelector('.xwalk-campaign-hero')?.remove();
      page?.querySelector('.xwalk-mockup-green-bar')?.remove();
      if (page?.classList.contains('xwalk-family-plans-page--single-offer')) {
        const built = buildGridPage(personaId, headline);
        if (built) {
          page.replaceWith(built);
          page = built;
        }
      } else if (page?.querySelector('.xwalk-family-grid')) {
        document.querySelectorAll('.xwalk-family-row').forEach((r, i) => paintRow(r, i));
      } else {
        const section =
          document.querySelector('main > .section > div') ||
          document.querySelector('main > div') ||
          document.querySelector('.xwalk-family-plans > div > div');
        if (section && !section.querySelector('.xwalk-family-grid')) {
          const built = buildGridPage(personaId, headline);
          if (built) section.replaceChildren(built);
        }
      }
      bootState.layoutDone = true;
      return;
    }

    if (bootState.segmentRunning) return;
    bootState.segmentRunning = true;
    void runSegmentLayout(personaId, headline, page).finally(function () {
      bootState.segmentRunning = false;
    });
  }

  let scheduleTimer;
  function schedule() {
    clearTimeout(scheduleTimer);
    scheduleTimer = setTimeout(run, bootState.layoutDone ? 0 : 50);
  }

  document.addEventListener('DOMContentLoaded', schedule);
  document.addEventListener('aem:loaded', schedule);
  for (const ms of [0, 100, 400, 800, 1500, 3000, 5000]) setTimeout(schedule, ms);

  const mainEl = document.querySelector('main');
  if (mainEl) {
    new MutationObserver(function () {
      if (bootState.layoutDone) return;
      schedule();
    }).observe(mainEl, { childList: true, subtree: true });
  }
})();
