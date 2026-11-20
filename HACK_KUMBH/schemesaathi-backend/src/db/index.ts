import path from "path";
import fs from "fs";
import { config } from "../config.js";
import * as schema from "./schema.js";
import pg from "pg";
import { drizzle as drizzleNodePg, NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite, PgliteDatabase } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { MIGRATION_DDL } from "./migrate.js";
import { sql } from "drizzle-orm";

export type AnyDb = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

let dbInstance: AnyDb | null = null;
let pgliteInstance: PGlite | null = null;
let pgPoolInstance: pg.Pool | null = null;
let dbType: "postgres" | "pglite" = "postgres";
let migrationsRan = false;

export async function initDb(): Promise<AnyDb> {
  if (dbInstance) {
    return dbInstance;
  }

  const url = config.databaseUrl;
  const isExplicitMemory = url.startsWith("memory:") || url === "memory";

  if (!isExplicitMemory) {
    try {
      const useSsl =
        url.includes("sslmode=require") ||
        url.includes("neon.tech") ||
        url.includes("supabase.co") ||
        url.includes("amazonaws.com") ||
        process.env.PGSSLMODE === "require";

      const pool = new pg.Pool({
        connectionString: url,
        connectionTimeoutMillis: 3000,
        ssl: useSsl ? { rejectUnauthorized: config.dbSslRejectUnauthorized } : undefined,
      });
      const client = await pool.connect();
      client.release();
      pgPoolInstance = pool;
      dbInstance = drizzleNodePg(pool, { schema });
      dbType = "postgres";
    } catch {
      // Postgres not available; fallback to embedded PGlite
    }
  }

  if (!dbInstance) {
    let pglitePath: string | undefined = undefined;
    if (!isExplicitMemory) {
      pglitePath = path.resolve(process.cwd(), ".db_data");
      if (!fs.existsSync(pglitePath)) {
        fs.mkdirSync(pglitePath, { recursive: true });
      } else {
        // Clean stale lock / pid files if left over from previous unclean process exit
        const pidFile = path.join(pglitePath, "postmaster.pid");
        if (fs.existsSync(pidFile)) {
          try {
            fs.unlinkSync(pidFile);
          } catch {
            // ignore
          }
        }
      }
    }

    pgliteInstance = new PGlite(pglitePath);
    dbInstance = drizzlePglite(pgliteInstance, { schema });
    dbType = "pglite";
  }

  // Ensure tables and indexes exist
  if (!migrationsRan) {
    const statements = MIGRATION_DDL.split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      try {
        await dbInstance.execute(sql.raw(statement));
      } catch {
        // ignore if index already exists
      }
    }
    migrationsRan = true;
  }

  return dbInstance;
}

export function getDbType(): "postgres" | "pglite" {
  return dbType;
}

export function isRealPostgres(): boolean {
  return dbType === "postgres";
}

export async function closeDb(): Promise<void> {
  if (pgPoolInstance) {
    try {
      await pgPoolInstance.end();
    } catch {
      // ignore
    }
    pgPoolInstance = null;
  }
  if (pgliteInstance) {
    try {
      await pgliteInstance.close();
    } catch {
      // ignore
    }
    pgliteInstance = null;
  }
  dbInstance = null;
  migrationsRan = false;
}

export const db = new Proxy({} as AnyDb, {
  get(_target, prop) {
    if (!dbInstance) {
      throw new Error("Database not initialized. Call await initDb() first.");
    }
    const val = (dbInstance as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof val === "function") {
      return val.bind(dbInstance);
    }
    return val;
  },
});
