# Migration report

## Outcome

Uptrail's active application paths no longer depend on the original OAuth, Forge, Vite runtime, debug collector, or hosted deployment environment. The React/Vite/Express/tRPC/Drizzle/MySQL architecture and existing product routes remain in place.

## Major changes

- Authentication now uses separate local credential records, scrypt hashing, opaque hashed sessions, seven-day expiry, revocation, HTTP-only cookies, and CSRF validation.
- Password recovery uses a configurable transactional-email endpoint, hashed single-use reset tokens with bounded expiry, and all-session revocation after reset.
- Existing users and all profile/progress foreign keys stay unchanged. Imported accounts require an explicit exact-ID linking command; registration never merges by email.
- The AI mentor uses a reusable OpenAI-compatible backend provider. Image generation and transcription use the same provider configuration and never expose keys to the browser.
- Storage uses the AWS SDK against a configurable S3-compatible service. Keys are validated, server uploads are size-limited, downloads require authentication, and signed URLs expire after five minutes.
- Owner notifications use an optional independently controlled webhook.
- The Manus runtime plugin, debug collector, OAuth SDK/types, unused integration wrappers, browser bearer fallback, generated template, and unresolved analytics injection were removed.
- Production packaging now includes a multi-stage Dockerfile, Compose-based local stack, additive database migration, health endpoint, non-root runtime, and deployment/cutover documentation.

## Data preservation

`0005_clear_sunspot.sql` only creates two auth tables and indexes/foreign keys. It does not alter the existing user, profile, skill, roadmap, or achievement tables. Old object URLs can continue to resolve through the temporary `/manus-storage/*` alias after objects are copied to the new bucket under identical keys.

## Security changes

- Provider and storage secrets are server-only.
- Session tokens and CSRF tokens are hashed in MySQL.
- Login/registration have an in-process rate limit; distributed deployments should replace it with a shared Redis/gateway limiter.
- Storage traversal is rejected and arbitrary external audio URLs are not fetched.
- Express hides its signature, limits JSON bodies to 2 MB, and sets baseline security headers.
- Production webhooks must use HTTPS.

## Known limitations and external work

- No live database, old OAuth tenant, old storage account, AI account, DNS, TLS endpoint, or production host was available, so no production data copy, identity proofing, model call, object transfer, or deployment was attempted.
- Existing users cannot authenticate until an operator links a local credential after verifying identity.
- The in-memory auth rate limiter is per process.
- Email ownership is proven only through the password-reset delivery path; registration does not require pre-login email verification and MFA is not implemented.
- Streaming mentor responses were not present in the original active implementation and remain non-streaming.
- The temporary legacy storage alias intentionally retains the old name until cutover verification and retention are complete.
- The imported repository declared MIT in `package.json` but contained no license file; ownership and third-party asset rights require owner review.

## Verification record

The untouched baseline passed TypeScript, 12 tests, and production build. After migration and dependency remediation:

- `pnpm install --frozen-lockfile`: passed.
- `pnpm check`: passed.
- `pnpm test`: passed, 10 files and 26 tests.
- `pnpm build`: passed. Route splitting reduced the eager application JavaScript from about 1,106 kB (335.7 kB gzip) to 421.1 kB (132.1 kB gzip). Mermaid remains a 509.9 kB on-demand chunk and triggers Vite's informational chunk warning.
- `pnpm audit --prod`: passed with no known vulnerabilities.
- `pnpm audit`: passed with no known vulnerabilities after updating both runtime and development dependency chains.
- `pnpm db:generate`: reported no further schema changes after additive migration `0006` was generated.
- Built-server smoke test: `/` returned 200 with CSP, `/api/auth/csrf` returned 204 with a CSRF cookie, and `/healthz` correctly returned 503 against an intentionally unavailable database.
- Docker validation was not executed because Docker is not installed in this workstation environment.
- The workstation reports Node 20.11.1, below the documented Node 20.19 minimum. Local gates passed, but the release must be repeated by CI/staging on Node 20.19+ before production approval.

No live provider calls, production database migration, object copy, or deployment was executed.
