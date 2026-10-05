# Security Policy

The security of Uptrail V2 and user privacy are fundamental priorities. This document outlines our vulnerability reporting process and implemented security controls.

---

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly:

- **Do NOT open a public GitHub issue** for sensitive vulnerabilities, credentials, authentication flaws, or data leakage concerns.
- **GitHub Private Vulnerability Reporting**: Use the **Report a vulnerability** button under the [Security Advisory tab](https://github.com/Pulkit0719/uptrail-v2/security/advisories) on GitHub. This creates a secure, private advisory channel where we can collaborate on a fix before public disclosure.
- If private reporting is unavailable, contact the repository maintainers through GitHub direct communication channels without exposing exploit details publicly.

Please include:
1. A clear description of the vulnerability.
2. Steps to reproduce or a minimal proof of concept.
3. Potential impact and attack vectors.
4. Suggested remediation if known.

We appreciate responsible disclosure and aim to acknowledge reports promptly.

---

## Security Architecture & Defenses

Uptrail V2 incorporates defense-in-depth principles:

| Defense Layer | Implemented Control |
| :--- | :--- |
| **Transport Security** | Enforced HTTPS with HSTS (`Strict-Transport-Security: max-age=31536000; includeSubDomains`). |
| **Database Encryption** | Mandatory TLSv1.3 (`TLS_AES_256_GCM_SHA384`) with Certificate Authority verification and `rejectUnauthorized: true`. |
| **Authentication** | `scrypt` password key derivation with cryptographically secure random per-user salts. |
| **Session Integrity** | Opaque session tokens stored as SHA-256 hashes in MySQL; automatic expiration and server-side revocation. |
| **Cookie Security** | `HttpOnly`, `Secure`, and `SameSite=Lax` flags set on all session cookies to prevent XSS and cross-site exfiltration. |
| **CSRF Protection** | Double-submit CSRF tokens verified via header and cookie on all state-changing endpoints. |
| **Rate Limiting** | In-memory sliding-window limiter on login, registration, and recovery endpoints to thwart brute-force attacks. |
| **Browser Defenses** | Strict `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: strict-origin-when-cross-origin`. |
| **Secret Isolation** | Server-only credential scoping; browser builds contain zero database, email, or AI provider secrets. |
