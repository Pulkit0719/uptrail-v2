# Uptrail v2

Uptrail is a React/Vite career-navigation client backed by Express, tRPC, Drizzle ORM, and MySQL. This repository runs independently: it does not require a Manus account, runtime, OAuth server, Forge gateway, storage proxy, or deployment environment.

## Prerequisites

- Node.js 20.19+ or 22.12+
- pnpm 10.4.1 (Corepack can install the pinned version)
- MySQL 8+
- A private S3-compatible bucket (AWS S3, Cloudflare R2, MinIO, and similar)
- An OpenAI-compatible API key for the AI mentor; the rest of the app can run without it

## Windows / VS Code setup

```powershell
./scripts/setup-windows.ps1
# Review .env, then:
pnpm db:migrate
pnpm dev
```

Edit `.env` before migrating. At minimum, set `DATABASE_URL`. Configure the `S3_*` values before using generated media, and `AI_API_KEY` before using the mentor. Open `http://localhost:3000`.

The `dev` command starts the Express API and Vite middleware together. The production flow is:

```powershell
pnpm build
pnpm start
```

## Local infrastructure with Docker

Copy `.env.example` to `.env`, replace all example passwords, add an AI key if needed, then run:

```powershell
docker compose up --build
```

Compose starts MySQL, MinIO, creates the private bucket, applies Drizzle migrations, and starts Uptrail on port 3000. It uses named volumes; `docker compose down` does not delete them. Do not run `docker compose down -v` against data you need.

## Authentication

New accounts use email/password credentials, scrypt password hashing, opaque seven-day HTTP-only sessions stored as hashes in MySQL, server-side revocation, SameSite cookies, and CSRF tokens. An email match never links a new account to an imported account.

To link an existing imported user explicitly, first back up the database and identify that row's exact `openId`. In PowerShell, keep the password out of command history:

```powershell
$env:LEGACY_USER_OPEN_ID = "exact-existing-open-id"
$env:LOCAL_AUTH_EMAIL = "person@example.com"
$secret = Read-Host "New local password" -AsSecureString
$env:LOCAL_AUTH_PASSWORD = [Net.NetworkCredential]::new("", $secret).Password
pnpm auth:link-legacy
Remove-Item Env:LOCAL_AUTH_PASSWORD, Env:LOCAL_AUTH_EMAIL, Env:LEGACY_USER_OPEN_ID
```

The command refuses implicit email matching, conflicting credentials, or replacement of an existing local identity. After the first account exists, set `OWNER_USER_ID` to its numeric database ID and restart to grant that exact account the admin role.

To look up the numeric ID without changing authorization:

```powershell
$env:LOCAL_AUTH_EMAIL = "person@example.com"
pnpm auth:find-user-id
Remove-Item Env:LOCAL_AUTH_EMAIL
```

Password recovery uses a single-use, time-limited reset token and revokes all existing sessions after a successful reset. Configure `EMAIL_PROVIDER_URL`, `EMAIL_PROVIDER_API_KEY`, and `EMAIL_FROM` together. The provider endpoint receives `{from,to,subject,text,html}` JSON with a Bearer token. Requests always return the same public response whether the account exists or not.

## Quality commands

```powershell
pnpm check
pnpm test
pnpm build
pnpm audit --audit-level high
```

Generate schema changes with `pnpm db:generate`, review the SQL, back up the target database, and only then run `pnpm db:migrate`.

## Configuration

All supported variables and safe placeholders are in `.env.example`. Run `pnpm config:check` before migration or deployment; it reports only whether secret-backed features are configured and never prints their values. Browser bundles receive no provider, email, database, or storage secrets. `TRUST_PROXY=true` is required only when a trusted reverse proxy terminates HTTPS immediately in front of the app.

The important controls are:

| Area | Variables |
|---|---|
| Runtime | `PORT`, `APP_BASE_URL`, `TRUST_PROXY`, `OWNER_USER_ID` |
| Database | `DATABASE_URL`, `DATABASE_POOL_SIZE` |
| AI | `AI_BASE_URL`, `AI_API_KEY`, model names, timeout/retry/output-token limits |
| Storage | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, credentials, path-style and internal-HTTP flags |
| Recovery email | `EMAIL_PROVIDER_URL`, `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM`, reset-token TTL |
| Notifications | `NOTIFICATION_WEBHOOK_URL` |

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md), [BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md), [PRODUCTION_CUTOVER.md](./PRODUCTION_CUTOVER.md), [SECURITY_REVIEW.md](./SECURITY_REVIEW.md), [INDEPENDENCE_VERIFICATION.md](./INDEPENDENCE_VERIFICATION.md), and [FINAL_HANDOVER.md](./FINAL_HANDOVER.md) for operations and migration detail.

## Troubleshooting

- `Database is not configured`: verify `DATABASE_URL` and restart the server.
- Login succeeds but protected calls fail with CSRF errors: clear cookies for localhost, reload `/login`, and avoid mixing `localhost` with `127.0.0.1`.
- Mentor unavailable: set `AI_API_KEY`, verify `AI_BASE_URL` ends at the provider's API root, and select a model the account can use.
- Storage errors: verify the bucket already exists, credentials can get/put objects, and `S3_FORCE_PATH_STYLE=true` for MinIO.
- Secure cookies behind a proxy: terminate TLS, forward `X-Forwarded-Proto: https`, and set `TRUST_PROXY=true` only for a proxy you control.

## Licensing and assets

The package declares MIT licensing, but no historical license file was present in the imported repository. Before public distribution, confirm the intended project license and add the corresponding license text. The UI loads DM Sans and Fraunces from Google Fonts; confirm their license notices and consider self-hosting. The unrouted component showcase references a GitHub-hosted shadcn avatar. No third-party attribution was removed during this migration.
