/**
 * Test PostgreSQL connectivity using the same URL rules as lib/db/databaseUrl.ts.
 * Usage: npm run db:test
 *
 * URL resolution (first match wins):
 *   1) DATABASE_URL or POSTGRES_URL (full connection string — easiest match with DBeaver)
 *   2) DB_HOST, DB_NAME, DB_USER, DB_PORT, DB_PASSWORD
 *
 * Optional: DB_SSL=true — append sslmode=require and pass ssl to pg Client (only if your server uses TLS).
 */
require("dotenv").config();
const { Client } = require("pg");

function getDatabaseUrl() {
  const fromEnv =
    (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) ||
    (process.env.POSTGRES_URL && process.env.POSTGRES_URL.trim());
  if (fromEnv) {
    return fromEnv;
  }

  const host = (process.env.DB_HOST ?? "").trim();
  const database = (process.env.DB_NAME ?? "").trim();
  const password = process.env.DB_PASSWORD ?? "";
  const user = (process.env.DB_USER ?? "postgres").trim() || "postgres";
  const port = (process.env.DB_PORT ?? "5432").trim() || "5432";

  if (!host) throw new Error("Missing DB_HOST in .env");
  if (!database) throw new Error("Missing DB_NAME in .env");

  const encUser = encodeURIComponent(user);
  const encPass = encodeURIComponent(password);
  let url = `postgresql://${encUser}:${encPass}@${host}:${port}/${database}`;
  const sslEnv = process.env.DB_SSL === "true" || process.env.DB_SSL === "1";
  if (sslEnv) {
    url += url.includes("?") ? "&" : "?";
    url += "sslmode=require";
  }
  return url;
}

/** Keep in sync with getPgSslOption in lib/db/databaseUrl.ts */
function getPgSslOption(connectionString) {
  if (process.env.DB_SSL === "true" || process.env.DB_SSL === "1") {
    return { rejectUnauthorized: false };
  }
  const idx = connectionString.indexOf("?");
  if (idx === -1) return undefined;
  const params = new URLSearchParams(connectionString.slice(idx + 1));
  const mode = (params.get("sslmode") || "").toLowerCase();
  if (
    mode === "require" ||
    mode === "verify-ca" ||
    mode === "verify-full"
  ) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

async function main() {
  let url;
  try {
    url = getDatabaseUrl();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  const redacted = url.replace(/:([^:@/]+)@/, ":****@");
  console.log("Connecting to", redacted);

  const client = new Client({
    connectionString: url,
    ssl: getPgSslOption(url),
  });
  try {
    await client.connect();
    const { rows } = await client.query(
      "SELECT current_database() AS db, version() AS version"
    );
    const ver = String(rows[0].version).split("\n")[0];
    console.log("OK — connected.");
    console.log("  current_database:", rows[0].db);
    console.log("  server:", ver);
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error("FAILED:", err.message);
    if (err.code) console.error("  code:", err.code);
    const msg = String(err.message || "");
    if (/does not support SSL/i.test(msg)) {
      console.error(
        "  hint: PostgreSQL has TLS disabled on this host. Unset DB_SSL, remove sslmode=require (and similar) from DATABASE_URL/POSTGRES_URL, then retry."
      );
    } else if (err.code === "28000") {
      console.error(
        "  hint: pg_hba matches IP + database + PostgreSQL user. If DBeaver uses a different login than \"postgres\", set DB_USER (and DB_PASSWORD) to match DBeaver, or fix DATABASE_URL. Check SSL only if the server supports TLS."
      );
    }
    try {
      await client.end();
    } catch (_) {}
    process.exit(1);
  }
}

main();
