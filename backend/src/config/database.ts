import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";
import { ENV } from "./env";

export const pool = new Pool({
  connectionString: ENV.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
});

export const db = drizzle(pool, { schema });

export async function testDbConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT current_database(), current_user;");
    client.release();
    console.log(
      `Connected to PostgreSQL! DB: "${result.rows[0].current_database}", User: "${result.rows[0].current_user}"`
    );
    return true;
  } catch (error) {
    console.error("Database connection failed:", (error as Error).message);
    return false;
  }
}
