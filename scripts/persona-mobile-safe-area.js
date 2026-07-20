import { PERSONA_MOBILE_OFFER_LAYOUT_CSS } from './persona-mobile-offer-layout.js';

/** Persona landings — mobile layout, safe area, dark green shell (keep in sync with server/). */
export const PERSONA_DARK_GREEN = '#0A1A0F';

export const PERSONA_MOBILE_SAFE_AREA_CSS = `
@media(max-width:900px){
html.xwalk-persona-path--family-texas body,
html.xwalk-persona-path--college-student body,
html.xwalk-persona-path--single-woman-nyc body,
body.xwalk-persona-segment-landing,
body.xwalk-persona-offer-page--family-texas,
body.xwalk-persona-offer-page--college-student,
body.xwalk-persona-offer-page--single-woman-nyc{
background:${PERSONA_DARK_GREEN}!important;padding-top:0!important}
body.xwalk-persona-segment-landing main,
body.xwalk-persona-offer-page--family-texas main,
body.xwalk-persona-offer-page--college-student main,
body.xwalk-persona-offer-page--single-woman-nyc main{
display:block!important;visibility:visible!important;overflow:visible!important;height:auto!important;min-height:0!important;background:transparent!important}
body.xwalk-persona-segment-landing header,
body.xwalk-persona-offer-page--family-texas header,
body.xwalk-persona-offer-page--college-student header,
body.xwalk-persona-offer-page--single-woman-nyc header{
display:block!important;visibility:visible!important;position:relative!important;top:auto!important;z-index:300!important;background:${PERSONA_DARK_GREEN}!important;padding-top:max(8px,env(safe-area-inset-top,0px))!important}
html.wolverine-mobile-sim body.xwalk-persona-segment-landing header,
html.wolverine-mobile-sim body.xwalk-persona-offer-page header{
padding-top:8px!important}
body.xwalk-persona-segment-landing header nav,
body.xwalk-persona-offer-page header nav{
min-height:56px!important;padding-top:8px!important;padding-bottom:8px!important}
body.xwalk-persona-segment-landing header .nav-hamburger,
body.xwalk-persona-offer-page header .nav-hamburger{
display:flex!important;visibility:visible!important;opacity:1!important}
.xwalk-campaign-hero,.xwalk-campaign-hero-grid,.xwalk-campaign-hero-copy,.xwalk-campaign-hero-visual{
display:block!important;visibility:visible!important;background:${PERSONA_DARK_GREEN}!important}
.xwalk-campaign-hero-grid{display:grid!important;grid-template-columns:1fr!important;width:100%!important}
.xwalk-campaign-hero-visual{min-height:200px!important;order:-1!important}
.xwalk-campaign-hero-copy{padding:24px 18px 28px!important}
.xwalk-campaign-hero-headline{font-size:1.5rem!important;line-height:1.12!important;color:#fff!important}
.xwalk-family-plans-page,.xwalk-persona-mockup,.xwalk-mockup-white{
display:block!important;visibility:visible!important;width:100%!important;max-width:100%!important}
.xwalk-family-plans-page--single-offer,.xwalk-mockup-white{background:#fff!important}
}
${PERSONA_MOBILE_OFFER_LAYOUT_CSS}
`;
