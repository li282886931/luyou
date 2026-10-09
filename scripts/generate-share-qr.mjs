import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("/Users/peihuimin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp");
const root = resolve(import.meta.dirname, "..");
const qrPath = "/private/tmp/luyou-signup-qr-base.png";
const output = resolve(root, "luyou-signup-qr.png");
const logo = await sharp(resolve(root, "site/assets/deer-club.png")).resize(230, 230, { fit: "cover" }).png().toBuffer();
const qr = await sharp(qrPath).resize(720, 720).png().toBuffer();
const artwork = Buffer.from(`<svg width="1200" height="1500" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="1500" rx="64" fill="#f7f1e7"/>
  <rect width="1200" height="320" fill="#111816"/>
  <circle cx="600" cy="205" r="138" fill="#f7f1e7" stroke="#e8902e" stroke-width="10"/>
  <text x="600" y="405" text-anchor="middle" fill="#171a1c" font-size="58" font-weight="800" font-family="PingFang SC,Microsoft YaHei,sans-serif">鹿友自驾俱乐部</text>
  <text x="600" y="465" text-anchor="middle" fill="#d7791f" font-size="30" font-weight="700" letter-spacing="8" font-family="PingFang SC,Microsoft YaHei,sans-serif">张北草原 · 首发招募</text>
  <rect x="110" y="515" width="980" height="900" rx="48" fill="#fff"/>
  <rect x="390" y="1290" width="420" height="78" rx="39" fill="#ec922d"/>
  <text x="600" y="1341" text-anchor="middle" fill="#17130d" font-size="30" font-weight="800" font-family="PingFang SC,Microsoft YaHei,sans-serif">微信扫码 · 选择报名身份</text>
  <text x="600" y="1460" text-anchor="middle" fill="#6d716f" font-size="25" font-family="PingFang SC,Microsoft YaHei,sans-serif">车主报名 · 搭车报名 · 信息仅供活动组织使用</text>
</svg>`);

await sharp(artwork)
  .composite([
    { input: logo, left: 485, top: 90 },
    { input: qr, left: 240, top: 550 }
  ])
  .png()
  .toFile(output);
console.log(output);
