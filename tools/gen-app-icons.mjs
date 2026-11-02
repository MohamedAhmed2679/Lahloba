// Generates app icons/splash PNGs from the brand symbol geometry (branding/02_Logo, "The Honest Ladle").
// Usage: node tools/gen-app-icons.mjs <path-to-@resvg/resvg-js>   (writes into apps/*/assets)
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Resvg } = require(process.argv[2]);
const LADLE = (stroke, portion, w = 13.5) =>
  `<g fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"><path d="M70 17 V61 A20 20 0 0 1 30 61 V56"/></g><path d="M40.5 60 H59.5 A9.5 9.5 0 0 1 40.5 60 Z" fill="${portion}"/>`;
const svg = (size, body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${bg ? `<rect width="1024" height="1024" fill="${bg}"/>` : ''}${body}</svg>`;
// Matches lahloba_app_icon_1024.svg: symbol at translate(112,96) scale(8).
const full = (stroke, portion) => `<g transform="translate(112,96) scale(8)">${LADLE(stroke, portion)}</g>`;
// Adaptive-icon foreground: keep the mark inside the 66% safe zone.
const safe = (stroke, portion) => `<g transform="translate(232,224) scale(5.6)">${LADLE(stroke, portion)}</g>`;
const png = (s, out) => writeFileSync(out, new Resvg(s, { fitTo: { mode: 'original' } }).render().asPng());
const apps = {
  customer: { bg: '#8E2443' },  // Hibiscus ground: customer/primary brand
  partner: { bg: '#2A1C17' },   // Molasses ground: partner tools (role accents stay in-app)
};
for (const [app, { bg }] of Object.entries(apps)) {
  const dir = new URL(`../apps/${app}/assets/`, import.meta.url).pathname;
  png(svg(1024, full('#F7F0E3', '#E9A23B'), bg), `${dir}icon.png`);
  png(svg(1024, safe('#F7F0E3', '#E9A23B')), `${dir}adaptive-icon.png`);
  png(svg(512, full('#F7F0E3', '#E9A23B')), `${dir}splash-icon.png`);
  png(svg(48, full('#F7F0E3', '#E9A23B'), bg), `${dir}favicon.png`);
}
const ops = new URL('../apps/operations/public/', import.meta.url).pathname;
png(svg(64, full('#F7F0E3', '#E9A23B'), '#2A1C17'), `${ops}favicon.png`);
console.log('icons written');
