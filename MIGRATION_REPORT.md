# Migration report

## Outcome

Uptrail's active application paths no longer depend on the original OAuth, Forge, Vite runtime, debug collector, or hosted deployment environment. The React/Vite/Express/tRPC/Drizzle/MySQL architecture and existing product routes remain in place.

## Major changes

- Authentication now uses separate local credential records, scrypt hashing, opaque hashed sessions, seven-day expiry, revocation, HTTP-only cookies, and CSRF validation.
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
- The UI has no password-reset/email-verification workflow yet. Add a transactional email provider and single-use reset-token table before a broad public launch.
- Streaming mentor responses were not present in the original active implementation and remain non-streaming.
- The temporary legacy storage alias intentionally retains the old name until cutover verification and retention are complete.
- The imported repository declared MIT in `package.json` but contained no license file; ownership and third-party asset rights require owner review.

## Verification record

The untouched baseline passed TypeScript, 12 tests, and production build. After migration and dependency remediation:

- `pnpm install --frozen-lockfile`: passed.
- `pnpm check`: passed.
- `pnpm test`: passed, 9 files and 17 tests.
- `pnpm build`: passed; the only warning is the existing large client chunk.
- `pnpm audit --prod`: passed with no known vulnerabilities.
- `pnpm audit`: passed with no known vulnerabilities after updating both runtime and development dependency chains.
- Built-server smoke test: `/` returned 200 and `/api/auth/csrf` returned 204 with a CSRF cookie. `/healthz` correctly returned 503 without a configured database.
- Docker validation was not executed because Docker is not installed in this workstation environment.

No live provider calls, production database migration, object copy, or deployment was executed.
