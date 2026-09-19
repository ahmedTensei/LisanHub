# Security Policy

## Reporting a vulnerability

**Do not open a public Issue for a security problem.**

Use GitHub's private vulnerability reporting on this repository: **Security → Report a vulnerability** (https://github.com/ahmedTensei/LisanHub/security/advisories/new). That channel is private between you and the maintainer.

Please include: what the issue is, how to reproduce it, what an attacker could do with it, and any suggested fix. If you need to include a proof of concept, keep it minimal and do not target other people's data.

## What to expect

This is a one-person project in early development. Expect a first reply within about a week. There is no bug bounty and no reward programme.

## Scope

In scope: this repository's code — authorization rules and row-level security policies, authentication flows, file upload and package validation, the sandboxed content player and its message bridge, and anything that could expose one member's data to another.

Out of scope: there is no deployed instance, so live-service findings do not apply yet, and the project page on GitHub Pages is a static page with no data. Third-party services (Supabase, Cloudflare and the hosting provider) should be reported to those vendors.

## Design commitments this project holds itself to

- Authorization is enforced in two independent layers: application policies and database row-level security. A finding that bypasses either layer is a valid report.
- Learning content and its plugins are treated as untrusted and run in an isolated frame with no network, no storage and no access to user data. A way to break out of that isolation, or to make user data reach the frame, is a valid report.
- Secrets never live in the repository, and secret scanning with push protection is enabled. If you find a credential committed here, report it privately and it will be revoked.
