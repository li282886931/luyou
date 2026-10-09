import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

await import("./build.mjs");

const entry = resolve(import.meta.dirname, "../dist/server/index.js");
const source = await readFile(entry, "utf8");
if (!source.includes("export default") || !source.includes("async fetch")) {
  throw new Error("Worker entrypoint is invalid");
}
const mod = await import(`${new URL(`file://${entry}`).href}?v=${Date.now()}`);
if (typeof mod.default?.fetch !== "function") throw new Error("Worker fetch export is missing");
console.log("Worker artifact is valid.");
