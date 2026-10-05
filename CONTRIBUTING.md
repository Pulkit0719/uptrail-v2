# Contributing to Uptrail V2

Thank you for your interest in contributing to Uptrail V2. This document provides clear guidelines for setting up your development environment, testing code changes, and submitting pull requests.

---

## 1. Development Workflow

1. **Fork the repository** on GitHub and clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/uptrail-v2.git
   cd uptrail-v2
   ```
2. **Create a topic branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Install dependencies** using the pinned version of pnpm:
   ```bash
   pnpm install --frozen-lockfile
   ```
4. **Configure your local environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your local MySQL credentials
   pnpm config:check
   ```
5. **Start the local development server**:
   ```bash
   pnpm dev
   ```

---

## 2. Quality & Verification Gates

Before submitting a pull request, ensure all local validation checks pass cleanly:

```bash
# Verify runtime configuration
pnpm config:check

# Run TypeScript typecheck without emitting
pnpm check

# Run all unit and integration tests (Vitest)
pnpm test

# Verify production client and server bundles build cleanly
pnpm build

# Scan dependencies for known security vulnerabilities
pnpm audit --audit-level high
```

The GitHub Actions CI pipeline enforces these exact checks on every pull request.

---

## 3. Database & Schema Guidelines

- **Never execute destructive or raw `push` commands** (`drizzle-kit push`) against persistent databases.
- All schema changes must be authored as versioned SQL migrations under `drizzle-v2/` and tracked in `__uptrail_v2_migrations`.
- Do not modify or delete historical baseline migrations (`0000_imported_legacy_baseline.sql`, `0001_add_independent_auth.sql`).
- Test all database changes locally against an isolated MySQL 8 instance before proposing schema modifications.

---

## 4. Security & Privacy Rules

- **Zero Secret Commits**: Never commit `.env` files, database passwords, API keys, TLS certificates, or connection URLs.
- **Data Protection**: Never introduce production user data or real passwords into test fixtures or mock datasets.
- **Provider Restrictions**: Uptrail V2 strictly enforces $0 free-tier operations. Do not introduce dependencies on paid AI fallbacks, proprietary platforms, or external object storage services (S3/R2/MinIO).

---

## 5. Submitting a Pull Request

1. Ensure your working tree is clean and all tests pass.
2. Commit your changes with clear, descriptive commit messages adhering to standard conventional commit prefixes (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`).
3. Push to your branch and open a Pull Request against `main`.
4. Include a concise summary of changes, motivation, and verification steps in your PR description.
