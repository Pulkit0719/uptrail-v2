# Manus dependency audit

Audit date: 2026-09-29. Baseline branch was `main`; migration work is on `migration/manus-independence`. The baseline working tree was clean.

## Baseline

Before edits:

- `pnpm check`: passed.
- `pnpm test`: passed, 7 files and 12 tests.
- `pnpm build`: passed in about 1m57s with unresolved analytics-placeholder warnings and a large-bundle warning.

No production credentials, infrastructure, or data were accessed.

## Dependency map

| Area | Original implementation | Reachability before migration | Resolution |
|---|---|---:|---|
| Authentication | `sdk.ts`, `oauth.ts`, remote WebDev OAuth RPCs, JWT cookie, preview bearer-token fallback | Active through context, callback route, client login, and tRPC | Replaced with local credentials and revocable database sessions in `auth.ts`; callback and SDK removed |
| AI mentor | Forge-compatible chat and model endpoints in `llm.ts` | Active through `mentor.ts` | Replaced by an OpenAI-compatible provider abstraction using `AI_*` server variables |
| Image generation | Forge ImageService | File present but not imported by a route or feature | Reimplemented against the configured AI provider; output goes to independent S3 |
| Transcription | Forge speech endpoint | File present but not imported by a route or feature | Reimplemented against the configured AI provider and restricted to Uptrail-managed S3 objects |
| Storage | Forge presign endpoints and `/manus-storage/*` redirect | Helper reached only by the unused image helper; proxy route was active | Replaced with AWS SDK S3-compatible operations and authenticated `/storage/*` downloads |
| Legacy asset paths | `/manus-storage/*` | Potentially persisted outside code | Retained temporarily as a read-only alias to the new S3 backend; this is the only intentional surviving name |
| Notifications | Forge SendNotification RPC | Active through admin-only `system.notifyOwner` | Replaced with optional `NOTIFICATION_WEBHOOK_URL` |
| Maps | Forge server proxy and browser Forge key | Components/modules had no importers | Removed after import tracing |
| Data API/search gateway | Forge CallApi wrapper | No importers | Removed; live opportunities already use the independent Remotive API directly |
| Heartbeat/scheduling | Forge heartbeat RPC wrapper and special cron identity | No importers or callback routes | Removed; production scheduling is documented as infrastructure-owned HTTP/cron work |
| Vite runtime | `vite-plugin-manus-runtime` | Active in every Vite build/dev session | Removed from config, package, and lockfile |
| Debug collector | injected `/__manus__/debug-collector.js` and log endpoint | Active in development | Removed; standard browser/server logs remain |
| Template metadata | `template.json` containing copied runtime source | Not used by application execution | Removed as obsolete generated configuration |
| Analytics injection | unresolved `%VITE_ANALYTICS_*%` script | Active in HTML and warned during build | Removed; analytics can be added later with an independently controlled endpoint and consent review |

## Original environment variables

The runtime depended on `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, `OAUTH_SERVER_URL`, `JWT_SECRET`, `OWNER_OPEN_ID`, `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`, `VITE_FRONTEND_FORGE_API_URL`, `VITE_FRONTEND_FORGE_API_KEY`, `VITE_ANALYTICS_ENDPOINT`, and `VITE_ANALYTICS_WEBSITE_ID`. They are no longer read.

Independent configuration is documented in `.env.example`: `DATABASE_URL`, `OWNER_USER_ID`, `AI_*`, `S3_*`, `NOTIFICATION_WEBHOOK_URL`, `PORT`, and `TRUST_PROXY`.

## Data and schema observations

The existing MySQL schema stores users, learner profiles, skills, roadmap progress, and achievements with user foreign keys. Migration `0005_clear_sunspot.sql` adds only `authCredentials` and `authSessions`; it does not delete, rename, or rewrite existing records. The legacy `users.openId` column remains to preserve stable user rows and all foreign-key relationships.

Local registration always creates a new user. Imported users are linked only by the explicit `auth:link-legacy` command using an exact legacy ID. Email equality alone is never sufficient.

## Remaining non-Manus external dependencies

- Remotive provides the live opportunity feed.
- Google Fonts hosts DM Sans and Fraunces.
- The unrouted component showcase references a shadcn avatar hosted on GitHub.
- An operator-selected OpenAI-compatible API, S3 service, notification webhook, MySQL host, and deployment platform are required for their respective features.

These are configurable or documented and are not tied to the original runtime.
