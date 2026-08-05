import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import * as chargenSchema from "./chargenSchema";
import { getDatabaseUrl, getPgSslOption } from "./databaseUrl";

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

function getPool(): Pool {
  if (!global._pgPool) {
    const connectionString = getDatabaseUrl();
    global._pgPool = new Pool({
      connectionString,
      ssl: getPgSslOption(connectionString),
    });
  }
  return global._pgPool;
}

export const db = drizzle(getPool(), {
  schema: { ...schema, ...chargenSchema },
});
