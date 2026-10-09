import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const release = resolve(import.meta.dirname, "../release/luyouclub-miniapp");

for (const file of [
  "package.json",
  "project.config.json",
  "src/app.config.ts",
  "src/pages/home/index.tsx",
  "src/pages/activities/index.tsx",
  "src/pages/profile/index.tsx",
  "src/pages/trip/index.tsx",
  "src/pages/signup/index.tsx",
  "README.md"
]) {
  assert.ok(existsSync(resolve(release, file)), `miniapp release missing: ${file}`);
}

for (const excluded of ["node_modules", "dist", ".pai"]) {
  assert.equal(
    existsSync(resolve(release, excluded)),
    false,
    `miniapp release must not contain: ${excluded}`
  );
}

console.log("Miniapp delivery package contract passed.");
