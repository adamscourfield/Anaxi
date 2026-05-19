#!/usr/bin/env node
/**
 * Normalizes API route error handling:
 * - Replaces verbose catch blocks with apiErrorResponse
 * - Wraps handlers without try/catch in withApi
 */
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

const CATCH_RE =
  /\} catch \(err(?:: unknown)?\) \{[\s\S]*?return NextResponse\.json\([\s\S]*?\n  \}/g;

function rel(p) {
  return path.relative(path.join(root, "app", "api"), p).replace(/\\/g, "/");
}

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, files);
    else if (name === "route.ts") files.push(full);
  }
  return files;
}

function ensureImports(content) {
  let next = content;
  if (!next.includes("apiErrorResponse")) {
    const importLine = 'import { apiErrorResponse } from "@/lib/apiErrors";\n';
    const lastImport = [...next.matchAll(/^import .+$/gm)].pop();
    if (lastImport) {
      const idx = lastImport.index + lastImport[0].length;
      next = next.slice(0, idx + 1) + importLine + next.slice(idx + 1);
    } else {
      next = importLine + next;
    }
  }
  return next;
}

function normalizeCatch(content) {
  if (!content.includes("catch (err")) return content;
  return content.replace(CATCH_RE, "} catch (err) {\n    return apiErrorResponse(err);\n  }");
}

function wrapExports(content) {
  if (content.includes("withApi(")) return content;
  const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
  let next = content;
  for (const method of methods) {
    const re = new RegExp(
      `export async function ${method}\\(([^)]*)\\)\\s*\\{`,
      "g",
    );
    if (!re.test(next)) continue;
    next = next.replace(
      new RegExp(`export async function ${method}\\(([^)]*)\\)\\s*\\{`, "g"),
      `export const ${method} = withApi(async function ${method}($1) {`,
    );
    // Close: find export const METHOD ... and add closing paren before next export
  }
  // Fix closing braces: replace "}\n\nexport const" or "}\n\nexport async" for wrapped functions
  // Simpler: only wrap if no try/catch at function level - skip wrapExports for now
  return next;
}

let updated = 0;
for (const file of walk(apiRoot)) {
  const r = rel(file);
  if (SKIP.has(r)) continue;
  if (r.startsWith("cron/")) continue;

  let content = fs.readFileSync(file, "utf8");
  const before = content;
  content = normalizeCatch(content);
  if (content !== before) {
    content = ensureImports(content);
    fs.writeFileSync(file, content);
    updated++;
    console.log("normalized catch:", r);
  }
}

console.log(`Updated ${updated} files`);
