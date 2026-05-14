# Security Policy

The TaskNebula team and the Neura Parse organization take security seriously. We appreciate the work of independent researchers who help us keep our users safe. This document describes how to report a vulnerability and what you can expect from us.

## Supported Versions

TaskNebula follows semantic versioning. Security fixes are backported to the **two most recent minor releases** on the active major line.

| Version       | Supported          |
| ------------- | ------------------ |
| 0.2.x (latest) | :white_check_mark: |
| 0.1.x (prior)  | :white_check_mark: |
| < 0.1.0        | :x:                |

Older releases will not receive patches. We strongly recommend running the latest minor release.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Send a detailed report to **security@neuraparse.com**. Include:

- A description of the vulnerability and the impact you believe it could have.
- Steps to reproduce, including affected version, deployment mode (Docker / source), and any relevant configuration.
- Proof-of-concept code or screenshots if available.
- Your name and contact information (optional, used for credit if you wish).

If you prefer encrypted communication, our PGP key is published below. The fingerprint is also available on `keys.openpgp.org` once we publish a permanent key.

```
-----BEGIN PGP PUBLIC KEY BLOCK-----
(Placeholder — production PGP key will be published before v1.0.0.
 Until then, please use TLS-encrypted email or request a key over a
 verified channel.)
-----END PGP PUBLIC KEY BLOCK-----
```

## Our Commitments (SLA)

When you report a vulnerability to us, we commit to the following targets:

| Stage              | Target                                   |
| ------------------ | ---------------------------------------- |
| Acknowledgement    | Within **72 hours** of receipt           |
| Triage & severity  | Within **5 business days**               |
| Status updates     | Every **7 days** until resolved          |
| Coordinated fix    | Aim for **90 days** from triage          |

We follow [coordinated disclosure](https://www.cisa.gov/coordinated-vulnerability-disclosure-process): we ask that you give us a reasonable opportunity to remediate before any public disclosure. If the issue is actively being exploited in the wild, we may accelerate the timeline and publish guidance immediately.

## Scope

In scope:

- The TaskNebula web application (`apps/web`)
- Official Docker images published by Neura Parse
- Database schemas and migration code in `packages/db`
- Server-side code paths, authentication, authorization, and webhook signing

Out of scope:

- Issues that require physical access to a user's device.
- Self-XSS that requires the victim to paste attacker-controlled code into the browser console.
- Reports about missing security headers without a demonstrated impact.
- Denial-of-service attacks that rely on volumetric traffic.
- Vulnerabilities in third-party dependencies that have not yet been patched upstream (please report those upstream first; you may still notify us).

## Bug Bounty

**No paid bug bounty program is active at this time.** We will publicly credit reporters (with permission) in our release notes and on `SECURITY.md` after a fix has shipped. A formal bounty program may be introduced after the v1.0.0 release; this policy will be updated accordingly.

## Safe Harbor

We will not pursue legal action against researchers who:

- Make a good-faith effort to avoid privacy violations, destruction of data, and interruption of service.
- Only interact with accounts you own or for which you have explicit permission.
- Report the vulnerability promptly and give us a reasonable window to respond before disclosure.

If in doubt, contact **security@neuraparse.com** before testing.

## Related Documents

- [CONTRIBUTING.md](./CONTRIBUTING.md) — general contribution guidelines
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) — community standards
- [LICENSE](./LICENSE) — MIT license
