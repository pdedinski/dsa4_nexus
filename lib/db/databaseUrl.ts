/**
 * Builds a PostgreSQL connection URL from discrete .env variables.
 *
 * If `DATABASE_URL` or `POSTGRES_URL` is set (non-empty), that value is used as-is.
 * Use this to match DBeaver or a hosting panel connection string (including `?sslmode=...`).
 *
 * Otherwise builds from: DB_HOST, DB_NAME (required), DB_PASSWORD, DB_USER (default postgres), DB_PORT (default 5432).
 */
export function getDatabaseUrl(): string {
  const fromEnv =
    process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const host = (process.env.DB_HOST ?? "").trim();
  const database = (process.env.DB_NAME ?? "").trim();
  const password = process.env.DB_PASSWORD ?? "";
  const user = (process.env.DB_USER ?? "postgres").trim() || "postgres";
  const port = (process.env.DB_PORT ?? "5432").trim() || "5432";

  if (!host) {
    throw new Error("Missing DB_HOST in environment (.env)");
  }
  if (!database) {
    throw new Error("Missing DB_NAME in environment (.env)");
  }

  const encUser = encodeURIComponent(user);
  const encPass = encodeURIComponent(password);
  return `postgresql://${encUser}:${encPass}@${host}:${port}/${database}`;
}

/**
 * Optional TLS for `pg` / `node-postgres`. The driver does not always apply `sslmode`
 * from the URL alone; pass this as the Pool/Client `ssl` option when non-undefined.
 *
 * - `DB_SSL=true` forces TLS (matches appending `sslmode=require` in custom tooling).
 * - Or set `sslmode=require` (or verify-*) on `DATABASE_URL` / `POSTGRES_URL`.
 */
export function getPgSslOption(
  connectionString: string
): undefined | { rejectUnauthorized: boolean } {
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
