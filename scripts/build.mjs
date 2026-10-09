import { access, mkdir, readFile, rm, writeFile, cp } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const source = resolve(root, "site");

const [html, css, js, logo, hero, depositQr, workerTemplate] = await Promise.all([
  readFile(resolve(source, "index.html"), "utf8"),
  readFile(resolve(source, "styles.css"), "utf8"),
  readFile(resolve(source, "app.js"), "utf8"),
  readFile(resolve(source, "assets/deer-club.png")),
  readFile(resolve(source, "assets/zhangbei-hero.png")),
  readFile(resolve(source, "assets/deposit-qr.jpg")),
  readFile(resolve(root, "worker/index.template.js"), "utf8")
]);

const selfContainedHtml = html
  .replace('<link rel="stylesheet" href="./styles.css" />', `<style>${css}</style>`);

const embedded = workerTemplate
  .replace("__HTML__", JSON.stringify(selfContainedHtml))
  .replace("__CSS__", JSON.stringify(css))
  .replace("__JS__", JSON.stringify(js))
  .replace("__LOGO__", JSON.stringify(logo.toString("base64")))
  .replace("__HERO__", JSON.stringify(hero.toString("base64")))
  .replace("__DEPOSIT_QR__", JSON.stringify(depositQr.toString("base64")));

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, "server"), { recursive: true });
await mkdir(resolve(dist, ".openai"), { recursive: true });
await writeFile(resolve(dist, "server/index.js"), embedded);
try {
  await access(resolve(root, ".openai/hosting.json"));
  await cp(resolve(root, ".openai/hosting.json"), resolve(dist, ".openai/hosting.json"));
} catch {
  // Hosting metadata is provisioned externally and is not required for a portable Worker build.
}
await cp(resolve(root, "drizzle"), resolve(dist, ".openai/drizzle"), { recursive: true });
console.log("Built Cloudflare Worker with embedded club assets.");
