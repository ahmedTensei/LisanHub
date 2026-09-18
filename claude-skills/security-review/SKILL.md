---
name: security-review
description: Reviews authentication, authorization, user-generated content, executable extensions, sandboxing, data access, and security-sensitive architecture for the language-learning platform.
---

# Security Engineering

Treat security as a domain property, not a UI concern.

## Authorization

Use capability-based authorization and policy checks.

The project specification's ownership rule is:
- ordinary users can edit their own content and eligible derived copies;
- only the explicitly authorized four administrative ranks can edit other users' content.

Do not rely on client-side role checks.

## User-generated content

Assume community content is hostile until validated.

Validate and sanitize:
- text
- HTML/markup
- media metadata
- uploads
- links
- structured content
- imported data

Prevent XSS, injection, path traversal, SSRF, malicious file handling, and privilege escalation as applicable to the stack.

## Executable content

Executable extensions/new exercise types are a high-risk capability.

The project specification requires strict security review before publication, verified-member/admin review where applicable, personal sandboxing, administrative disable capability, and continuous monitoring.

Never execute untrusted contributor code in the main application process.

Use strong isolation, explicit resource limits, least privilege, network restrictions, and a kill switch when executable content is eventually implemented.

### The sandbox is already the only render path (decision R7)

All learning content — including first-party plugins — renders and is evaluated inside an `iframe` with `sandbox="allow-scripts"` and **without** `allow-same-origin`, under a strict CSP (`default-src 'none'`, `connect-src 'none'`, `img-src blob:`). Review every change against these invariants:

- **No user data crosses the bridge.** Not the user id, email, username, display name, session token, progress, review state or settings. The player receives a content item and the learner's answer; it returns a score. A message type or field that carries user data is a defect, and a test must fail on it.
- Every `postMessage` payload is validated against a schema on both sides, and the origin is checked; never `eval` or otherwise execute a payload.
- Assets reach the player as blob data, never as a URL signed for the user.
- A package is untrusted input: enforce the size, entry-count, path-traversal, content-sniffing and schema checks in `plugin-architecture` server-side, and fail closed.
- Feature switches must be able to disable a plugin platform-wide (kill switch) without a deployment.

## Data access

Every sensitive read/write must cross the appropriate authorization boundary.

Do not trust:
- user IDs from the browser
- hidden form fields
- client-side ownership claims
- client-side price/access claims
- client-side moderation state

## Files

Treat uploaded files as untrusted:
- validate type and size;
- avoid trusting filenames/extensions;
- store outside executable paths;
- scan/process safely where required;
- use signed/authorized access mechanisms.

## Security review output

For security-sensitive changes, identify:
- threat
- attack surface
- trust boundary
- mitigation
- residual risk
- tests

Do not mark a feature secure merely because it has authentication.
