# Security policy

## Design

V-Calm is a static site: there is no server-side code, database, login or user data on the server. Practice history is stored only in the visitor's browser (`localStorage`).

Hardening in place:

- Strict Content-Security-Policy: same-origin scripts and styles only, no inline code, `frame-ancestors 'none'`
- No third-party requests (no CDNs, fonts, analytics or trackers)
- HSTS, `nosniff`, `no-referrer`, restrictive `Permissions-Policy`, COOP/CORP
- Docker image: unprivileged nginx, read-only filesystem, all capabilities dropped, `no-new-privileges`
- Dependabot for dev dependencies and GitHub Actions; CI runs lint and tests on every PR

## Reporting a vulnerability

Please **don't open a public issue**. Use GitHub's private reporting on this repository: **Security → Report a vulnerability**.
You'll get a response within 7 days.

## Supported versions

Only the latest release, the one deployed at `breathe.viktorbezhenar.in.ua`, is supported.
