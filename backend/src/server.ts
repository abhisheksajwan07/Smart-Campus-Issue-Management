import path from "path";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createApp } from "./app";
import { ENV } from "./config/env";
import { db, pool, testDbConnection } from "./config/database";
import { connectRedis } from "./config/redis";
import { departments } from "./db/schema";
import { seed } from "./db/seed";

const app = createApp();

async function ensureSchemaAndSeed() {
  const reg = await pool.query<{ tbl: string | null; mig: string | null }>(
    "SELECT to_regclass('public.complaints') AS tbl, to_regclass('drizzle.__drizzle_migrations') AS mig;"
  );

  // Apply Drizzle SQL migrations automatically on fresh DB or migration-tracked DB
  if (!reg.rows[0]?.tbl || reg.rows[0]?.mig) {
    await migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
    console.log("[DB] Drizzle migrations verified.");
  }

  // Idempotent first-run seed so Docker Compose works out of the box
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(departments);
  if (count === 0) {
    console.log("[DB] Empty database detected — running initial GBU seed...");
    await seed({ closePool: false });
  }
}

async function startServer() {
  console.log("=================================================");
  console.log("   SMART CAMPUS BACKEND SERVICE INITIALIZING   ");
  console.log("=================================================");
  console.log(`Node Environment: ${ENV.NODE_ENV}`);
  console.log(`Target Port:      ${ENV.PORT}`);
  console.log(`Redis Target:     ${ENV.REDIS_URL}`);
  console.log(`FastAPI Target:   ${ENV.FASTAPI_URL}`);
  console.log(`Mock AI Engine:   ${ENV.USE_MOCK_AI ? "ENABLED (Simulator Active)" : "DISABLED (Calling FastAPI)"}`);
  console.log("-------------------------------------------------");

  // Verify Database Connection & ensure schema + seed
  const isDbReady = await testDbConnection();
  if (!isDbReady) {
    console.warn("⚠️  PostgreSQL connection could not be established immediately.");
    console.warn("   Verify DATABASE_URL in your .env file.");
  } else {
    try {
      await ensureSchemaAndSeed();
    } catch (bootErr) {
      console.error("[DB] Auto-migration/seed check failed:", bootErr);
    }
  }

  // Connect Redis
  await connectRedis();

  app.listen(ENV.PORT, () => {
    console.log(`🚀 Server listening on http://localhost:${ENV.PORT}`);
    console.log(`👉 Health check: http://localhost:${ENV.PORT}/api/health`);
    console.log("=================================================");
  });
}

startServer().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
