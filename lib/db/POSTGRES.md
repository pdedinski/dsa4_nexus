# Target PostgreSQL environment

**Production / deployment:** PostgreSQL **9.6.22** (reported as `x86_64-redhat-linux-gnu`, GCC 8.4.1, Red Hat 8.4.1-1, 64-bit).

When changing schema, migrations, or SQL:

- **No `pgcrypto` / `uuid-ossp`** — UUIDs are generated in the Node app (`crypto.randomUUID`) or supplied as literals in seed SQL; primary keys have **no** DB-side UUID default.
- **`gen_random_uuid()`** is not available in core on 9.6 (only via `pgcrypto`, which is not used).
- **JSONB** and **`INSERT … ON CONFLICT`** are valid on 9.6.

Primary migrations: [`migrations/0001_initial.sql`](./migrations/0001_initial.sql), [`migrations/0002_characters.sql`](./migrations/0002_characters.sql) (saved PC sheets).

**Check connectivity** (uses `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, optional `DB_USER` / `DB_PORT` from `.env`):

```bash
npm run db:test
```

If the server is upgraded, update this file and revisit migrations for any newer PostgreSQL features you adopt.

---

## Troubleshooting: `no pg_hba.conf entry for host "…", SSL off` (SQLSTATE `28000`)

PostgreSQL is **rejecting the TCP client** before any query runs. The IP in the error is the **outbound address of the process that opened the connection** (the machine running Node / Next.js), not necessarily the PC where you use the browser.

Typical situations:

| Client | Often works when… |
|--------|---------------------|
| **DBeaver on your laptop** | `pg_hba` allows that **IP + user + database** (and SSL mode matches: **`host`** vs **`hostssl`**). |
| **Node / Next.js** | Same rules; must use the **same host, port, user, db** as DBeaver. |
| **Different egress IP** (CI, cloud agent, another PC) | That IP is not in `pg_hba.conf`. |

**Fix (pick one):**

1. **On the PostgreSQL server** — Edit `pg_hba.conf` and add a line for the client IP shown in the error (and reload Postgres), e.g. for password auth without SSL (only if you accept that risk on your network):

   ```text
   host    metalfai_tde_nexus    metalfai_tde    151.237.25.13/32    scram-sha-256
   ```

   Use `md5` if the server still uses MD5 for that role. The **third column is the DB role** — it must match **`DB_USER`** / the user in your connection string (not necessarily `postgres`).

2. **SSH tunnel** — Run Postgres proxy so the app connects to `127.0.0.1` on the dev machine; only the tunnel endpoint needs to be allowed if the DB server trusts the SSH host.

3. **Run Next.js where the IP is already allowed** — e.g. `next dev` only on your laptop (same network path as DBeaver), or deploy the app next to an already-trusted host.

4. **`DATABASE_URL`** — If you use a connection string, it must still reach a host/socket that `pg_hba` allows for **that** client IP.

**SSL:** If the error says `SSL off`, Postgres treated the attempt as **non-SSL**. **`hostssl`** lines in `pg_hba` apply only when the **server** has SSL enabled (`ssl = on` in `postgresql.conf`) **and** the client negotiates TLS. If **`npm run db:test`** fails with **`The server does not support SSL connections`**, the server has **no** TLS — remove **`DB_SSL=true`** and any **`sslmode=require`** (or similar) from `DATABASE_URL`; DBeaver on that host is also using a plain connection for `pg_hba` purposes.

### DBeaver works on the same PC but Node fails (`SSL off` vs SSL errors)

1. **If the driver says the server does not support SSL** — Do **not** use `DB_SSL=true` or `sslmode=require`. Align credentials with DBeaver; any remaining `28000` / `pg_hba` needs a **`host`** (non-SSL) rule or matching user/database in `pg_hba`.

2. **If the server supports SSL** and DBeaver uses SSL while Node does not — `SSL off` can mean only **`hostssl`** allows your IP. Then set **`DB_SSL=true`** (or `sslmode=require` on the URL) so Node uses TLS too.

### DBeaver works but Node says `no pg_hba.conf entry … user "postgres" …`

`pg_hba.conf` matches **client IP + database name + PostgreSQL role (user)**. A line that allows **`metalfai_tde`** does **not** allow **`postgres`**. DBeaver often uses a **dedicated app role**; the app defaults to **`DB_USER=postgres`** if unset.

**Fix:** Set **`DB_USER`** (and **`DB_PASSWORD`**) in `.env` to the **same username and password** as in DBeaver — e.g. `metalfai_tde` — or put that user in `DATABASE_URL`. Re-run `npm run db:test` and confirm the redacted URL shows the expected user, not `postgres`.

---

## If you **cannot** change `pg_hba.conf` (managed DB / no root) but **DBeaver works on your PC**

Then only **some client IPs** are allowed. Anything that connects from a **different** egress IP (e.g. Cursor remote dev, CI, another VM) will keep failing until a DBA adds those IPs—or you avoid that path.

### A) Run Next.js on the **same machine** as DBeaver (recommended)

1. Clone/open the repo **locally** on the PC where DBeaver already works.
2. Start the app from a **local** shell: `npm run dev` (not a remote/cloud runner).
3. Open the site at `http://localhost:3000` (or whatever port you use).

Then Node’s outbound IP to Postgres is the **same network path** as DBeaver’s, so behaviour should match.

If you still see a **foreign** IP in the error (not your home ISP), the dev server is **not** running on that PC—find where it runs (remote workspace, port forwarding, etc.) and move it local.

### B) **SSH tunnel** (works without new `pg_hba` lines *if* the server already allows `127.0.0.1` or your SSH user’s path)

On **your laptop** (where you have SSH access to a host that can reach Postgres), forward a local port to the database:

```bash
# Example: SSH to the same machine that runs Postgres, forward local 15432 → Postgres on that host
ssh -N -L 15432:127.0.0.1:5432 youruser@79.124.76.70
```

Leave that session open. In `.env` point the app at the tunnel:

```env
DB_HOST=127.0.0.1
DB_PORT=15432
# DB_NAME, DB_USER, DB_PASSWORD unchanged
```

The app only talks to **localhost** on your laptop; Postgres sees the session as coming from **loopback on the server** (or from the SSH host), which is often already permitted. If your tunnel lands on a **jump host** instead, Postgres still sees the **jump host’s** IP—use a host that `pg_hba` already allows.

### C) Ask whoever runs Postgres

Send them the **exact client IP** from the error line (e.g. `151.237.25.13`) and ask for a **`pg_hba.conf`** entry or a **VPN / private link** that puts your dev hosts on an allowed network.

There is **no** client-only setting that bypasses `pg_hba`; the allowed fix is **same IP as DBeaver**, **tunnel into an allowed path**, or **hosting provider / DBA change**.
