// Resets the database to the Mdm Tan demo story. Run before judging: `npm run seed`.
// The story itself lives in src/lib/demoSeed.ts (also used by the "Reset demo" button).
import { Client } from "pg";
import { DEMO_PASSWORD, seedDemo } from "../src/lib/demoSeed";

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const { combinedAlert } = await seedDemo(db, console.log);
  if (!combinedAlert) {
    console.warn("WARNING: seed did not produce a combined alert — the demo story will not land.");
    process.exitCode = 1;
  }
  console.log(`Seeded. Logins: siti@ / rachel@ / drlim@teman.demo, password "${DEMO_PASSWORD}"`);
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
