import { createApp } from "./app";
import { ENV } from "./config/env";
import { testDbConnection } from "./config/database";

const app = createApp();

async function startServer() {
  console.log("=================================================");
  console.log("   SMART CAMPUS BACKEND SERVICE INITIALIZING   ");
  console.log("=================================================");
  console.log(`Node Environment: ${ENV.NODE_ENV}`);
  console.log(`Target Port:      ${ENV.PORT}`);
  console.log(`FastAPI Target:   ${ENV.FASTAPI_URL}`);
  console.log(`Mock AI Engine:   ${ENV.USE_MOCK_AI ? "ENABLED (Simulator Active)" : "DISABLED (Calling FastAPI)"}`);
  console.log("-------------------------------------------------");

  // Verify Database Connection
  const isDbReady = await testDbConnection();
  if (!isDbReady) {
    console.warn("⚠️  PostgreSQL connection could not be established immediately.");
    console.warn("   Verify DATABASE_URL in your .env file.");
  }

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
