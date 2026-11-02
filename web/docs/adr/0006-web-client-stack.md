# ADR-0006: Web client and API stack (proposed)

Status: Proposed. Needs Tony's review before the first code is written.
Date: 2026-11-02

## Context

Tony is an experienced database administrator and operations leader, not primarily a front-end developer. The stack should be boring, typed, easy to deploy on junipernine2, and similar to what already runs there if possible. The app needs: a small API, a scheduler process, a PWA client with push support, and a PostgreSQL database.

## Proposal

- **Language:** TypeScript throughout, so the pure scheduling module is shared between server and client without duplication.
- **API:** Hono on Node.js, with Zod for request validation.
- **Database access:** a query builder or thin SQL layer (Kysely or Drizzle), with plain SQL migrations reviewed before running (GUARDRAILS.md).
- **Scheduler:** a second entry point of the same server package, run as a separate systemd service on a one-minute timer.
- **Web client:** Svelte with Vite, built as a static PWA (manifest, service worker for the app shell and push only, no data caching per ADR-0003).
- **Push:** `web-push` library with VAPID keys.
- **Hosting:** API and scheduler as systemd services on junipernine2, behind Cloudflare Tunnel. Static client served by the same API host or from Cloudflare Pages on a subdomain.
- **Tests:** Vitest for the pure module and golden suite, and integration tests against a disposable PostgreSQL database.

## Alternatives

- **Python (FastAPI + SQLAlchemy):** strong option if Tony prefers Python. Would not share the scheduling module with the client, so the rules would need a second implementation and parity tests.
- **React or Next.js:** more common, heavier than needed for a single-user app.
- **Plain HTML and vanilla JavaScript:** smallest footprint, but the router, forms and state for a dozen screens would become the main source of bugs.

## Decision needed

Tony to confirm TypeScript with Hono and Svelte, or choose Python with FastAPI. The rest of the spec does not depend on the answer, except that the golden-suite port check (SPEC.md section 11) becomes a cross-language test if Python is chosen.
