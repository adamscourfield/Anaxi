const { spawnSync } = require("node:child_process");

const attempts = 5;
const retryDelayMs = 15_000;

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const result = spawnSync("npx", ["prisma", "migrate", "deploy"], { encoding: "utf8" });
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    if (result.status === 0) return;
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    if (!output.includes("P1002")) process.exit(result.status ?? 1);
    if (attempt === attempts) process.exit(result.status ?? 1);

    console.log(`Migration attempt ${attempt} did not complete; retrying in 15 seconds.`);
    await wait(retryDelayMs);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
