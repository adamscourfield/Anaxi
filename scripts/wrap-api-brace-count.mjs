#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = path.join(root, "app", "api");
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const SKIP = new Set([
  "auth/tenants/route.ts",
  "auth/forgot-password/route.ts",
  "auth/[...nextauth]/route.ts",
  "webhooks/resend/route.ts",
]);

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

function findClosingBrace(content, openBraceIndex) {
  let depth = 1;
  for (let i = openBraceIndex + 1; i < content.length; i++) {
    const ch = content[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function wrapMethod(content, method) {
  const prefix = `export async function ${method}(`;
  const start = content.indexOf(prefix);
  if (start < 0) return content;

  let i = start + prefix.length;
  let parenDepth = 1;
  while (i < content.length && parenDepth > 0) {
    const ch = content[i];
    if (ch === "(") parenDepth++;
    else if (ch === ")") parenDepth--;
    i++;
  }
  const params = content.slice(start + prefix.length, i - 1);
  const openBrace = content.indexOf("{", i);
  if (openBrace < 0) return content;
  const closeBrace = findClosingBrace(content, openBrace);
  if (closeBrace < 0) return content;

  const body = content.slice(openBrace + 1, closeBrace);
  const wrapped = `export const ${method} = withApi(async function ${method}(${params}) {${body}});`;

  return content.slice(0, start) + wrapped + content.slice(closeBrace + 1);
}

function ensureImport(content) {
  if (content.includes("@/lib/apiRoute")) return content;
  const line = 'import { withApi } from "@/lib/apiRoute";\n';
  const m = content.match(/^import .+\n/gm);
  if (m?.length) {
    const last = m[m.length - 1];
    const i = content.indexOf(last) + last.length;
    return content.slice(0, i) + line + content.slice(i);
  }
  return line + content;
}

let updated = 0;
for (const file of walk(apiRoot)) {
  const r = rel(file);
  if (SKIP.has(r) || r.startsWith("cron/")) continue;
  let content = fs.readFileSync(file, "utf8");
  if (content.includes("withApi(") || content.includes("apiErrorResponse")) continue;

  const before = content;
  for (const method of METHODS) {
    content = wrapMethod(content, method);
  }
  if (content === before) continue;
  content = ensureImport(content);
  fs.writeFileSync(file, content);
  updated++;
  console.log("wrapped:", r);
}

console.log(`Wrapped ${updated} files`);
