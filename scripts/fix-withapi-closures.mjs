#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = path.join(root, "app", "api");

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, files);
    else if (name === "route.ts") files.push(full);
  }
  return files;
}

let fixed = 0;
for (const file of walk(apiRoot)) {
  let content = fs.readFileSync(file, "utf8");
  if (!content.includes("withApi(")) continue;
  const before = content;
  content = content.replace(/\n}\n\nexport const (\w+) = withApi/g, "\n});\n\nexport const $1 = withApi");
  if (!content.trimEnd().endsWith("});")) {
    const trimmed = content.trimEnd();
    if (trimmed.endsWith("}") && !trimmed.endsWith("});")) {
      content = trimmed.slice(0, -1) + "});\n";
    }
  }
  if (content !== before) {
    fs.writeFileSync(file, content);
    fixed++;
  }
}

console.log(`Fixed ${fixed} files`);
