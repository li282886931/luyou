import { cp, mkdir, rm } from "node:fs/promises";
import { basename, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "miniapp");
const out = resolve(root, "release/luyouclub-miniapp");
const excluded = new Set(["node_modules", "dist", ".pai", ".DS_Store"]);

await rm(out, { recursive: true, force: true });
await mkdir(resolve(root, "release"), { recursive: true });
await cp(source, out, {
  recursive: true,
  filter(path) {
    return !excluded.has(basename(path));
  }
});

console.log(`Miniapp source release created: ${out}`);
