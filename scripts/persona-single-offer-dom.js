/**
 * Client-side single-phone offer DOM (matches server/persona-single-offer.js).
 */
const PRIMARY = '#1DB954';
const OFFER = {
  'single-woman-nyc': {
    tagline:
      'Active New Yorkers love the Razr compact foldable design — perfect for your on-the-go lifestyle in the city.',
    planTitle: 'Your Plan',
    planPrice: '$50.00',
    pill: 'Unlimited talk, text and data with Global Roaming',
    altPill: 'Unlimited talk, text and premium global roaming in 200+ countries',
    deviceName: 'Razr',
    devicePrice: '$499.99. or $50/month for 12 months',
    phone:
      'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=900&q=80',
    specs: [
      ['6.9" pOLED', '144Hz Display', '5G Ready'],
      ['50MP Camera', '4200mAh Battery', '256GB Storage'],
    ],
    shop: '/phones',
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

function specsEl(left, right) {
  const col = (items) => {
    const ul = document.createElement('ul');
    items.forEach((t) => {
      const li = document.createElement('li');
      li.textContent = t;
      ul.append(li);
    });
    return ul;
  };
  const wrap = document.createElement('div');
  wrap.className = 'xwalk-mockup-specs';
  wrap.append(col(left), col(right));
  return wrap;
}

/**
 * @param {string} personaId
 * @param {string} headline
 */
export function createSingleOfferSection(personaId, headline) {
  const meta = OFFER[personaId];
  if (!meta) return null;

  const white = document.createElement('section');
  white.className = 'xwalk-mockup-white';

  if (meta.tagline) {
    const quote = document.createElement('p');
    quote.className = 'xwalk-mockup-quote';
    const em = document.createElement('em');
    em.textContent = meta.tagline;
    quote.append(em);
    white.append(quote);
  }

  const offers = document.createElement('div');
  offers.className = 'xwalk-mockup-offers';

  const row = document.createElement('div');
  row.className = 'xwalk-mockup-offer-row';

  const main = document.createElement('div');
  main.className = 'xwalk-mockup-offer-main';

  const planHead = document.createElement('div');
  planHead.className = 'xwalk-mockup-plan-head';
  const h2 = document.createElement('h2');
  h2.className = 'xwalk-mockup-plan-title';
  h2.id = 'xwalk-single-offer-plan';
  const price = document.createElement('span');
  price.className = 'xwalk-mockup-plan-price';
  price.textContent = meta.planPrice;
  h2.append(`${meta.planTitle} `, price);
  planHead.append(h2);
  const pillWrap = document.createElement('div');
  pillWrap.className = 'xwalk-mockup-plan-pill';
  const darkPill = document.createElement('p');
  darkPill.className = 'xwalk-plan-pill xwalk-plan-line-pill xwalk-plan-line-pill--dark';
  darkPill.textContent = meta.pill;
  pillWrap.append(darkPill);
  if (meta.altPill) {
    const accentPill = document.createElement('p');
    accentPill.className = 'xwalk-plan-pill xwalk-plan-line-pill xwalk-plan-line-pill--accent';
    accentPill.textContent = meta.altPill;
    pillWrap.append(accentPill);
  }
  planHead.append(pillWrap);
  main.append(planHead);

  const planBody = document.createElement('div');
  planBody.className = 'xwalk-mockup-plan-body';

  const deviceCol = document.createElement('div');
  deviceCol.className = 'xwalk-mockup-device-col';
  const device = document.createElement('div');
  device.className = 'xwalk-mockup-device';
  const img = document.createElement('img');
  img.src = meta.phone;
  img.alt = meta.deviceName;
  img.loading = 'eager';
  device.append(img);
  const footer = document.createElement('div');
  footer.className = 'xwalk-mockup-device-footer';
  const name = document.createElement('p');
  name.className = 'xwalk-mockup-device-name';
  name.textContent = meta.deviceName;
  const devPrice = document.createElement('p');
  devPrice.className = 'xwalk-mockup-device-price';
  devPrice.innerHTML = `<strong>${meta.devicePrice}</strong>`;
  footer.append(name, devPrice);
  deviceCol.append(device, footer);
  planBody.append(deviceCol, specsEl(meta.specs[0], meta.specs[1]));
  main.append(planBody);

  const cta = document.createElement('a');
  cta.className = 'xwalk-mockup-cta';
  cta.href = meta.shop;
  cta.textContent = 'Shop Now →';

  row.append(main, cta);
  offers.append(row);
  white.append(offers);

  return white;
}

export { OFFER as PERSONA_SINGLE_OFFER };
