#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = path.join(root, "app", "api");

const SKIP = new Set([
  "auth/tenants/route.ts",
  "auth/forgot-password/route.ts",
  "auth/[...nextauth]/route.ts",
  "webhooks/resend/route.ts",
]);

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function rel(p) {
  return path.relative(apiRoot, p).replace(/\\/g, "/");
}

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, files);
    else if (name === "route.ts") files.push(full);
  }
  return files;
}

function ensureWithApiImport(content) {
  if (content.includes('from "@/lib/apiRoute"')) return content;
  const line = 'import { withApi } from "@/lib/apiRoute";\n';
  const imports = content.match(/^import .+;?\n/gm);
  if (imports?.length) {
    const last = imports[imports.length - 1];
    const idx = content.indexOf(last) + last.length;
    return content.slice(0, idx) + line + content.slice(idx);
  }
  return line + content;
}

function wrapHandlers(content) {
  if (content.includes("withApi(")) return content;
  let next = content;
  for (const m of METHODS) {
    next = next.replace(
      new RegExp(`export async function ${m}\\(`, "g"),
      `export const ${m} = withApi(async function ${m}(`,
    );
  }
  if (next === content) return content;

  // Close each wrapped handler: }; before next export const METHOD or end of file
  for (const m of METHODS) {
    const closeBefore = new RegExp(
      `(export const ${m} = withApi\\(async function ${m}[\\s\\S]*?)(\\n\\})(\\nexport const (?:${METHODS.join("|")})|\\n*$)`,
      "g",
    );
    next = next.replace(closeBefore, "$1\n});$3");
  }
  return next;
}

let updated = 0;
for (const file of walk(apiRoot)) {
  const r = rel(file);
  if (SKIP.has(r) || r.startsWith("cron/")) continue;
  let content = fs.readFileSync(file, "utf8");
  if (content.includes("withApi(") || content.includes("apiErrorResponse")) continue;
  const wrapped = wrapHandlers(content);
  if (wrapped === content) continue;
  content = ensureWithApiImport(wrapped);
  fs.writeFileSync(file, content);
  updated++;
  console.log("wrapped:", r);
}

console.log(`Wrapped ${updated} files`);
