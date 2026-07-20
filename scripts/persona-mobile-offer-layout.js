/** Mobile persona offer layout (keep in sync with server/persona-mobile-offer-layout.js). */
export const PERSONA_MOBILE_OFFER_LAYOUT_CSS = `
@media(max-width:900px){
.xwalk-mockup-offers,.xwalk-mockup-offer-row,.xwalk-mockup-offer-main,.xwalk-mockup-white,.xwalk-family-plans-page,.xwalk-family-main,.xwalk-family-grid{
display:block!important;visibility:visible!important;width:100%!important;max-width:100%!important;overflow:visible!important}
.xwalk-mockup-offer-row{
display:grid!important;grid-template-columns:1fr!important;gap:20px!important;align-items:stretch!important;width:100%!important}
.xwalk-mockup-offer-main{width:100%!important;min-width:0!important}
.xwalk-mockup-plan-head{display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:12px!important;margin-bottom:20px!important}
.xwalk-mockup-plan-pill{display:flex!important;flex-direction:column!important;gap:10px!important;width:100%!important;min-width:0!important;max-width:100%!important;flex:none!important}
.xwalk-mockup-plan-pill .xwalk-plan-line-pill--dark,.xwalk-mockup-plan-pill .xwalk-plan-line-pill.xwalk-plan-line-pill--dark,.xwalk-mockup-plan-pill .xwalk-plan-tier-switch.xwalk-plan-line-pill--dark{
display:block!important;visibility:visible!important;width:100%!important;box-sizing:border-box!important;margin:0!important;padding:12px 18px!important;background:#1a1a1a!important;color:#fff!important;border-radius:8px!important;font-size:0.8125rem!important;line-height:1.4!important}
.xwalk-mockup-plan-pill .xwalk-plan-line-pill--accent,.xwalk-mockup-plan-pill .xwalk-plan-line-pill.xwalk-plan-line-pill--accent{
display:block!important;visibility:visible!important;width:100%!important;box-sizing:border-box!important;margin:0!important;padding:12px 18px!important;background:#d8f3e0!important;color:#0E7A3A!important;border:1px solid #1DB954!important;border-radius:8px!important;font-weight:700!important;font-size:0.8125rem!important;line-height:1.4!important}
.xwalk-mockup-plan-body{display:grid!important;grid-template-columns:1fr!important;gap:16px!important;width:100%!important}
.xwalk-mockup-device-col,.xwalk-mockup-device,.xwalk-mockup-specs{display:block!important;visibility:visible!important;width:100%!important}
.xwalk-mockup-specs{display:grid!important;grid-template-columns:1fr 1fr!important;gap:16px!important}
a.xwalk-mockup-cta,.xwalk-mockup-cta{
display:flex!important;visibility:visible!important;opacity:1!important;width:100%!important;max-width:100%!important;min-height:120px!important;height:auto!important;
align-items:center!important;justify-content:center!important;background:#1DB954!important;color:#fff!important;
font-size:1.25rem!important;font-weight:900!important;text-decoration:none!important;border-radius:14px!important;
padding:20px 16px!important;box-sizing:border-box!important}
.xwalk-family-row{
display:grid!important;grid-template-columns:1fr!important;gap:10px!important;padding:18px 16px!important;width:100%!important;box-sizing:border-box!important}
.xwalk-family-line-label,.xwalk-family-line-price{display:block!important;visibility:visible!important}
.xwalk-family-pill,.xwalk-family-pill--dark,.xwalk-family-pill--accent{
display:block!important;visibility:visible!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important;margin:0!important;padding:14px 20px!important;text-align:center!important;font-size:0.8125rem!important;line-height:1.4!important}
.xwalk-family-pill--dark{background:#1a1a1a!important;color:#fff!important;border-radius:999px!important}
.xwalk-family-pill--accent{background:#d8f3e0!important;color:#0E7A3A!important;font-weight:700!important;border:1px solid #1DB954!important;border-radius:999px!important}
.xwalk-family-cta-wrap{display:block!important;visibility:visible!important;text-align:center!important;margin:32px 0 0!important;padding:0 16px!important}
a.xwalk-family-cta,.xwalk-family-cta{
display:inline-block!important;visibility:visible!important;width:100%!important;max-width:100%!important;padding:16px 24px!important;
background:#1DB954!important;color:#fff!important;font-size:1.25rem!important;font-weight:900!important;text-decoration:none!important;border-radius:14px!important;box-sizing:border-box!important}
}
`;
