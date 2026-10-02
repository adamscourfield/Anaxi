const { spawnSync } = require("node:child_process");

// Deployments can overlap on Vercel. PostgreSQL permits only one Prisma migration
// at a time, so wait long enough for the earlier deployment to release its lock.
const attempts = 12;
const retryDelayMs = 20_000;
const abandonedAvatarMigration = "20261108000000_add_avatar_data_source";

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
    // A short-lived deployment created this migration name before it reached main.
    // It only added optional avatar-source columns and failed transactionally, so it
    // is safe to retire the abandoned attempt before applying the canonical migration.
    if (output.includes("P3009") && output.includes(abandonedAvatarMigration)) {
      const resolve = spawnSync("npx", ["prisma", "migrate", "resolve", "--rolled-back", abandonedAvatarMigration], { encoding: "utf8" });
      process.stdout.write(resolve.stdout ?? "");
      process.stderr.write(resolve.stderr ?? "");
      if (resolve.status === 0) continue;
      process.exit(resolve.status ?? 1);
    }
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
