# Uptrail

AI-powered career guidance platform for career discovery, skill-gap analysis, assessments, personalized learning roadmaps, and AI career mentoring.

**Live Application**: [https://uptrail-v2.onrender.com](https://uptrail-v2.onrender.com)

[![CI](https://github.com/Pulkit0719/uptrail-v2/actions/workflows/ci.yml/badge.svg)](https://github.com/Pulkit0719/uptrail-v2/actions/workflows/ci.yml)
[![Release](https://img.shields.io/badge/release-v2.0.1--independent-1F7863?logo=github)](https://github.com/Pulkit0719/uptrail-v2/releases/tag/v2.0.1-independent)
[![Tests](https://img.shields.io/badge/tests-42%20passed-2ea44f?logo=vitest&logoColor=white)](https://github.com/Pulkit0719/uptrail-v2/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Node](https://img.shields.io/badge/Node-%3E%3D20.19.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Overview

Uptrail is a modern full-stack career navigation platform engineered to help learners make deliberate, evidence-based career progression decisions. Rather than relying on generic recommendations, Uptrail dynamically adapts guidance based on the learner's actual recorded skills, validated assessment attempts, location context, and completed roadmap milestones.

The platform provides an end-to-end career growth workflow:
- **Career Discovery**: Compare industry career paths, market signals, salary contexts, and foundational requirements.
- **Learner Profile**: Manage professional background, education, work style, target role, and location context.
- **Skill Tracking**: Record self-reported and verified capabilities with weighted proficiency levels and project evidence.
- **Skill-Gap Analysis**: Automatically evaluate readiness against target role requirements to highlight highest-impact gaps.
- **Personalized Roadmaps**: Follow sequential, milestone-based learning routes with concrete outcomes and proof-of-work briefs.
- **Career & Skill Assessments**: Complete structured evaluations to measure readiness and benchmark progress.
- **AI Career Mentor**: Profile-aware conversational AI that advises on next steps, study planning, and skill prioritization without hallucinating accomplishments.
- **Live Opportunities**: Browse source-attributed entry and early-career opportunities filtered by path and region.

---

## Why Uptrail

Early-career developers and transitioning professionals often face fragmented tooling:
- Job boards list requirements without contextualizing what a candidate actually needs to learn next.
- Course platforms provide static curriculums disconnected from a learner's existing skills.
- AI chat tools lack persistent memory of completed milestones and validated achievements.

Uptrail brings these threads into a single, cohesive career space. It models learning as a progressive dependency graph: each milestone completed and each skill verified directly updates career readiness metrics and feeds immediate context to the AI mentor.

---

## Key Features

| Feature Group | Capabilities |
| :--- | :--- |
| **Career Discovery** | Explore curated career paths (Frontend, Backend, DevOps, Data, Product); view market demand, salary benchmarks, and prerequisite capability maps. |
| **Learner Profile** | Centralized career space storing country context, education, target role, experience level, and preferred work arrangements. |
| **Skill Intelligence** | Manage skills across 4 proficiency levels (`Foundational`, `Developing`, `Proficient`, `Advanced`) and 3 evidence models (`Self Reported`, `Assessment Verified`, `Project Verified`). |
| **Gap Reporting** | Role-tailored readiness scoring that prioritizes high-leverage capabilities over arbitrary task checklists. |
| **Persistent Roadmaps** | Milestone tracking with persistent database state, outcome definitions, recommended resources, and progress history. |
| **Career Mentor** | Context-aware AI mentoring powered by OpenRouter free-tier models (`openrouter/free`) with hardcoded safeguards against paid model auto-upgrades. |
| **Independent Auth** | Built-in email/password authentication using `scrypt` hashing with unique per-user salts, database-backed sessions, and double-submit CSRF defense. |
| **Secure Cloud Setup** | Production-ready Render deployment backed by Aiven MySQL 8.4 over verified `TLSv1.3` with zero external object storage dependencies. |

---

## Tech Stack

### Frontend
- **Framework**: React 19 with TypeScript 5.9
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS, PostCSS, Radix UI primitives, Lucide icons
- **State & Routing**: Wouter (client-side routing), TanStack Query v5
- **API Client**: tRPC React client with SuperJSON serialization

### Backend & API
- **Runtime**: Node.js (>=20.19.0) with Express
- **API Layer**: tRPC v11 (type-safe end-to-end remote procedure calls)
- **Validation**: Zod schema validation on all inputs and environment configurations
- **Security**: In-memory rate limiting, double-submit CSRF tokens, secure cookie handling

### Database & ORM
- **Database**: MySQL 8.4 (Aiven Cloud) over verified `TLSv1.3` (`TLS_AES_256_GCM_SHA384`)
- **ORM & Migrations**: Drizzle ORM, Drizzle Kit with additive v2 migration lineage

### AI Integration
- **Provider**: OpenRouter API (`https://openrouter.ai/api/v1`) via OpenAI-compatible abstraction
- **Model**: `openrouter/free` (locked to $0 free-tier models; paid fallbacks prohibited)

### Infrastructure & Operations
- **Hosting**: Render (Node Web Service on Free Tier via `render.yaml`)
- **CI / CD**: GitHub Actions continuous integration pipeline

---

## Architecture

```mermaid
flowchart TD
    User["User Browser\n(React 19 + Vite + Wouter)"]
    
    subgraph Cloud["Production Infrastructure (Render)"]
        direction TB
        Proxy["TLS Reverse Proxy\n(HTTPS Termination / HSTS / CSP)"]
        Server["Express + tRPC Server\n(Node.js Runtime)"]
        
        subgraph Core["Core Application Services"]
            Auth["Independent Auth\n(scrypt + Sessions + CSRF)"]
            Router["tRPC Router\n(Profile, Roadmap, Skills)"]
            Mentor["AI Mentor Service\n(Context Builder + Prompts)"]
        end
    end
    
    subgraph Data["External Managed Services"]
        Aiven[("Aiven MySQL 8.4\nTLSv1.3 + CA Verification\n(defaultdb)")]
        AI["OpenRouter API\n(openrouter/free)\nStrict $0 Free Tier"]
    end

    User -->|"HTTPS (Secure Cookies + CSRF)"| Proxy
    Proxy --> Server
    Server --> Auth
    Server --> Router
    Server --> Mentor
    
    Auth -->|"Drizzle Connection Pool"| Aiven
    Router -->|"Drizzle Connection Pool"| Aiven
    Mentor -->|"OpenAI-Compatible HTTPS"| AI

    classDef highlight fill:#18302F,stroke:#1F7863,stroke-width:2px,color:#fff;
    classDef storage fill:#F4FAF6,stroke:#1F7863,stroke-width:1px,color:#18302F;
    class Server,Core,Auth,Router,Mentor highlight;
    class Aiven,AI storage;
```

> **Architecture Notes**:
> - **Zero Manus Dependencies**: No active runtime dependencies on Manus OAuth, Forge gateways, debug collectors, or proprietary SDKs.
> - **Storage-Free Runtime**: Uptrail requires **no external object storage** (no AWS S3, Cloudflare R2, or MinIO). All application assets and avatars are bundled locally in the client.

---

## Independent Infrastructure

Uptrail V2 represents a complete re-engineering from an earlier prototype that relied on third-party runtime services. The codebase has been transitioned to fully independent, operator-owned infrastructure:

1. **Authentication**: Replaced proprietary OAuth with self-contained email/password credentials, `scrypt` key derivation, random salts, and database-backed session management.
2. **Database & Lineage**: Reconnected to Aiven MySQL 8.4 with strict TLS verification. All authentic historical learner data (profiles, skills, roadmap progress, and assessment attempts) were preserved with zero record loss.
3. **AI Provider**: Replaced proprietary gateways with a standardized, OpenAI-compatible OpenRouter provider locked strictly to zero-cost models.
4. **Storage Architecture**: Eliminated remote presigned upload endpoints and S3 SDK dependencies in favor of a storage-free, self-contained bundle design.
5. **Runtime Cleanliness**: Removed injected debug collector scripts, proprietary Vite plugins, and unrouted legacy handlers.

---

## Security Architecture

Security controls are enforced across every layer of the application:

- **Transport Security**: HTTPS terminated with HSTS (`Strict-Transport-Security: max-age=31536000; includeSubDomains`).
- **Browser Protection**: Strict `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: strict-origin-when-cross-origin`.
- **Password Hashing**: Passwords derived using Node.js native `scrypt` with 64-byte derived keys and unique 16-byte random salts.
- **Session Hardening**: Cryptographically random session tokens stored only as SHA-256 hashes in MySQL. Cookies are scoped with `HttpOnly`, `Secure`, `SameSite=Lax`, and 7-day expiration.
- **CSRF Defense**: Double-submit CSRF cookie + `x-csrf-token` header validation enforced on all authenticated and state-changing mutations.
- **Rate Limiting**: Sliding-window rate limiting on login (30 attempts/IP), registration (5 attempts/IP), and password resets (5 attempts/IP).
- **Database Encryption**: Enforced `TLSv1.3` (`TLS_AES_256_GCM_SHA384`) with CA certificate verification and `rejectUnauthorized: true`.
- **Credential Sanitization**: `redactDatabaseError` scrubs connection URIs, hosts, and passwords from logs. Zero database, email, or AI credentials are exposed to the client bundle.
- **Cost Protection**: Strict configuration guarantees prohibiting silent fallback to paid AI models.

---

## Database Architecture

Uptrail V2 uses **MySQL 8.4** managed via **Aiven** and accessed through **Drizzle ORM**:

- **Database Name**: `defaultdb`
- **Tables**: `users`, `authCredentials`, `authSessions`, `passwordResetTokens`, `learnerProfiles`, `learnerSkills`, `roadmapProgress`, `learnerAchievements`, `careerAssessmentAttempts`, `skillAssessmentAttempts`
- **Migration System**: Schema changes are managed via versioned SQL files under `drizzle-v2/` and tracked in `__uptrail_v2_migrations`. Historical baseline migrations are preserved.
- **Foreign Key Integrity**: Strict cascades and referential constraints prevent orphaned credentials, sessions, or profile records.

---

## Local Development

### Prerequisites
- **Node.js**: `^20.19.0` or `>=22.12.0`
- **pnpm**: `10.4.1` (Corepack enabled: `corepack enable`)
- **MySQL**: MySQL 8.0+ or compatible service
- **OpenRouter API Key** *(optional)*: Required only for interactive AI Career Mentor features

### Quick Start

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Pulkit0719/uptrail-v2.git
   cd uptrail-v2
   ```

2. **Install dependencies**:
   ```bash
   pnpm install --frozen-lockfile
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set your local database connection:
   ```env
   DATABASE_URL=mysql://root:password@localhost:3306/uptrail
   APP_BASE_URL=http://localhost:3000
   ```

4. **Verify runtime configuration**:
   ```bash
   pnpm config:check
   ```

5. **Start the development server**:
   ```bash
   pnpm dev
   ```
   The application will be accessible at [http://localhost:3000](http://localhost:3000).

6. **Production build and start**:
   ```bash
   pnpm build
   pnpm start
   ```

---

## Environment Variables

All supported environment variables are documented in [`.env.example`](.env.example):

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | **Yes** | — | MySQL connection URI (append `?ssl-mode=REQUIRED` for TLS) |
| `DATABASE_POOL_SIZE` | No | `10` | Maximum pooled database connections |
| `DATABASE_SSL_CA` | Cloud | — | Inline PEM certificate string for container TLS validation |
| `DATABASE_SSL_CA_FILE` | Local | — | Filesystem path to CA PEM certificate file |
| `PORT` | No | `3000` | HTTP port the application listens on |
| `APP_BASE_URL` | **Yes** | `http://localhost:3000` | Canonical app URL (must be HTTPS in production) |
| `TRUST_PROXY` | Production | `false` | Set to `true` when running behind a trusted reverse proxy |
| `OWNER_USER_ID` | Optional | — | Numeric user ID granted administrative privileges |
| `AI_BASE_URL` | No | `https://openrouter.ai/api/v1` | OpenAI-compatible API base URL |
| `AI_API_KEY` | Optional | — | OpenRouter API key for the AI Career Mentor |
| `AI_CHAT_MODEL` | No | `openrouter/free` | Chat completion model identifier |
| `AI_REQUEST_TIMEOUT_MS` | No | `30000` | Request timeout in milliseconds |
| `AI_MAX_OUTPUT_TOKENS` | No | `800` | Token limit per AI mentor completion |
| `AI_MAX_RETRIES` | No | `2` | Maximum retry attempts on transient network errors |
| `EMAIL_PROVIDER_URL` | Optional | — | Transactional email HTTP webhook URL |
| `EMAIL_PROVIDER_API_KEY` | Optional | — | Bearer authentication token for email provider |
| `EMAIL_FROM` | Optional | — | Sender address for transactional emails |
| `PASSWORD_RESET_TTL_MINUTES` | Optional | `30` | Expiration window for password reset tokens |
| `NOTIFICATION_WEBHOOK_URL` | Optional | — | Generic webhook URL for system notifications |

---

## Testing & Verification

Uptrail V2 maintains strict code quality standards validated by automated testing:

```bash
# TypeScript compiler typecheck (zero emit)
pnpm check

# Unit and integration test suite (Vitest)
pnpm test

# Production bundle build verification
pnpm build

# High-severity dependency vulnerability audit
pnpm audit --audit-level high

# Configuration validation check
pnpm config:check
```

**Test Coverage**: 13 test suites with **42 passing tests** covering authentication, session lifecycle, CSRF validation, database security configuration, rate limiting, and owner authorization.

---

## Production Deployment

Uptrail V2 is pre-configured for continuous deployment on **Render** via [`render.yaml`](render.yaml):

1. Connect the `Pulkit0719/uptrail-v2` repository in your [Render Dashboard](https://dashboard.render.com).
2. Choose **New Blueprint Instance**; Render automatically parses `render.yaml` with the `free` plan.
3. In the Render Environment settings, enter your production secrets:
   - `DATABASE_URL`: Aiven MySQL connection URI
   - `DATABASE_SSL_CA`: Aiven Certificate Authority PEM string
   - `AI_API_KEY`: OpenRouter API key
   - `APP_BASE_URL`: Generated Render HTTPS URL (`https://uptrail-v2.onrender.com`)
4. Trigger the deployment. Render executes `pnpm install --frozen-lockfile && pnpm build` and launches with `pnpm start`.
5. Health checks are monitored continuously at `/healthz`.

For full deployment documentation and runbooks, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md).

---

## Current Free-Tier Infrastructure

Uptrail V2 is currently configured to operate within available free-tier limits:

- **Hosting**: Render Free Web Service ($0.00 / month)
- **Database**: Aiven Free MySQL Tier ($0.00 / month)
- **AI Mentor**: OpenRouter free-tier models (`openrouter/free`, $0.00 / month)
- **Continuous Integration**: GitHub Actions free tier for public repositories ($0.00 / month)

---

## Project Status

- **Deployment Status**: Production Live ([https://uptrail-v2.onrender.com](https://uptrail-v2.onrender.com))
- **Current Production Release**: [`v2.0.1-independent`](https://github.com/Pulkit0719/uptrail-v2/releases/tag/v2.0.1-independent)
- **Production Commit**: `81fb092c0b849a58d7605515cec0975185b9282f`
- **Continuous Integration**: Passing
- **Active Manus Dependencies**: None
- **External Object Storage Required**: None

---

## Documentation & Operations

- [CHANGELOG.md](CHANGELOG.md) — Release notes and version history
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) — Complete operations and deployment runbook
- [CONTRIBUTING.md](CONTRIBUTING.md) — Contribution guidelines and development standards
- [SECURITY.md](SECURITY.md) — Security policy and vulnerability disclosure instructions
- [FINAL_HANDOVER.md](FINAL_HANDOVER.md) — Architectural handover and operational sign-off
- [BACKUP_AND_RECOVERY.md](BACKUP_AND_RECOVERY.md) — Disaster recovery procedures and backup verification
- [PRODUCTION_CUTOVER.md](PRODUCTION_CUTOVER.md) — Staging gates and production cutover verification

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
