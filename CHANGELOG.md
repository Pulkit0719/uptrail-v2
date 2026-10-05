# Changelog

All notable changes to the Uptrail project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v2.0.1-independent] - 2026-10-05

### Added
- **Inline CA Configuration**: Added support for the `DATABASE_SSL_CA` environment variable to satisfy strict production TLS certificate verification without requiring filesystem-mounted certificates in containerized cloud environments (Render).

### Fixed
- **Cloud Database TLS Validation**: Resolved strict validation startup failure when deploying on Render with Aiven MySQL over TLS by allowing either `DATABASE_SSL_CA` or `DATABASE_SSL_CA_FILE` to fulfill the trusted certificate authority requirement.

### Operations
- **Live Production Deployment**: Successfully deployed to Render free tier at [https://uptrail-v2.onrender.com](https://uptrail-v2.onrender.com).
- **Verified Infrastructure**: Confirmed end-to-end HTTPS, HSTS, secure cookies, CSRF protection, and live Aiven MySQL 8.4 connectivity over `TLSv1.3`.

---

## [v2.0.0-independent] - 2026-10-05

### Added
- **Independent Local Authentication**: Built-in credential management featuring `scrypt` password derivation with cryptographically secure random per-user salts.
- **Server-Side Session Store**: Opaque, SHA-256-hashed session tokens stored in MySQL with automatic expiration and server-side revocation.
- **CSRF Defense**: Double-submit CSRF cookie and `x-csrf-token` header validation on all state-changing endpoints.
- **Rate Limiting**: In-memory rate limiting across authentication and password reset routes to mitigate brute-force attempts.
- **OpenRouter Free AI Integration**: Direct OpenAI-compatible abstraction connecting to OpenRouter using `$0` free-tier models (`openrouter/free`) with hardcoded protection against paid fallbacks.
- **Declarative Deployment Blueprint**: Added `render.yaml` for zero-cost, one-click continuous deployment on Render.
- **Automated CI Workflow**: GitHub Actions continuous integration validating dependencies, configuration, TypeScript types, automated tests, build artifacts, and dependency audit.
- **Comprehensive Test Suite**: 13 test suites and 42 automated tests covering authentication, authorization, session lifecycles, and database configuration.

### Changed
- **Database Architecture**: Replaced local and proprietary database configurations with Aiven MySQL 8.4 over verified `TLSv1.3` (`TLS_AES_256_GCM_SHA384`) with full certificate authority verification.
- **Migration Lineage**: Implemented additive `__uptrail_v2_migrations` lineage preserving 100% of authentic imported learner profiles, skills, assessment attempts, and milestone records.

### Removed
- **Manus Dependencies**: Completely removed all runtime dependencies on Manus OAuth, Forge gateways, Vite runtime plugins (`vite-plugin-manus-runtime`), debug collectors (`/__manus__/debug-collector.js`), and proprietary SDK wrappers.
- **External Object Storage**: Completely removed AWS SDK, S3, Cloudflare R2, and MinIO dependencies; all application assets and media are now packaged directly in the client bundle.

---

## [v1.0.0] - Historical Baseline

- Initial prototype build of the career guidance platform.
