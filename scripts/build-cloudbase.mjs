import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const out = resolve(root, "release/luyouclub-cloudbase");
const source = resolve(root, "site");
let localCloudbaseConfig;
try {
  localCloudbaseConfig = await readFile(resolve(out, "cloudbaserc.json"), "utf8");
} catch {
  localCloudbaseConfig = undefined;
}

const [html, css, js, logo, hero, depositQr, worker, server, dataContract, readme, prompt, envExample, bootstrap, cloudPackage] = await Promise.all([
  readFile(resolve(source, "index.html"), "utf8"),
  readFile(resolve(source, "styles.css"), "utf8"),
  readFile(resolve(source, "app.js"), "utf8"),
  readFile(resolve(source, "assets/deer-club.png")),
  readFile(resolve(source, "assets/zhangbei-hero.png")),
  readFile(resolve(source, "assets/deposit-qr.jpg")),
  readFile(resolve(root, "worker/index.template.js"), "utf8"),
  readFile(resolve(root, "cloudbase/server.cjs"), "utf8"),
  readFile(resolve(root, "cloudbase/data-contract.cjs"), "utf8"),
  readFile(resolve(root, "cloudbase/README.md"), "utf8"),
  readFile(resolve(root, "cloudbase/WORKBUDDY_PROMPT.md"), "utf8"),
  readFile(resolve(root, "cloudbase/.env.example"), "utf8"),
  readFile(resolve(root, "cloudbase/scf_bootstrap"), "utf8"),
  readFile(resolve(root, "cloudbase/package.json"), "utf8")
]);

const page = html.replace('<link rel="stylesheet" href="./styles.css" />', `<style>${css}</style>`);
const generatedWorker = worker
  .replace("__HTML__", JSON.stringify(page))
  .replace("__CSS__", JSON.stringify(css))
  .replace("__JS__", JSON.stringify(js))
  .replace("__LOGO__", JSON.stringify(logo.toString("base64")))
  .replace("__HERO__", JSON.stringify(hero.toString("base64")))
  .replace("__DEPOSIT_QR__", JSON.stringify(depositQr.toString("base64")))
  .replace("export default {", "module.exports = {");

await rm(out, { recursive: true, force: true });
await mkdir(resolve(out, "public/assets"), { recursive: true });
if (localCloudbaseConfig) await writeFile(resolve(out, "cloudbaserc.json"), localCloudbaseConfig);
await writeFile(resolve(out, "worker.cjs"), generatedWorker);
await writeFile(resolve(out, "server.cjs"), server);
await writeFile(resolve(out, "data-contract.cjs"), dataContract);
await writeFile(resolve(out, "README.md"), readme);
await writeFile(resolve(out, "WORKBUDDY_PROMPT.md"), prompt);
await writeFile(resolve(out, ".env.example"), envExample);
await writeFile(resolve(out, "scf_bootstrap"), bootstrap, { mode: 0o755 });
await writeFile(resolve(out, "package.json"), cloudPackage);
await writeFile(resolve(out, "public/index.html"), html);
await writeFile(resolve(out, "public/styles.css"), css);
await writeFile(resolve(out, "public/app.js"), js);
await cp(resolve(source, "assets"), resolve(out, "public/assets"), { recursive: true });
console.log(`CloudBase release created: ${out}`);
