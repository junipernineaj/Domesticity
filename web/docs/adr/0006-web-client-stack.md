# ADR-0006: Web client and API stack

Status: Partly accepted. Phase 0 decision made on 2026-11-02; the API and database choices still need Tony's review.
Date: 2026-11-02 (proposed); revised 2026-11-02 (Phase 0 decision)

## Context

Tony is an experienced database administrator and operations leader, not primarily a front-end developer. The stack should be boring, typed where it helps, easy to deploy on junipernine2, and similar to what already runs there if possible. The app needs: a small API, a scheduler process, a PWA client with push support, and a PostgreSQL database.

## Decision for Phase 0 (accepted)

- **No build step and no runtime dependencies** for the scheduling core, the dashboard, and the static server. These are plain ES modules that run on Node 22, with JSDoc for documentation.
- **Tests** use the Node built-in test runner (`node --test`). No test framework dependency.
- **Static server** is a short `node:http` script, used for local development only.

## Why we changed the proposal

The original proposal was TypeScript with Hono, Svelte and Vite. Adopting TypeScript now would need a compile step and a set of dependencies before there is any code worth typing. Phase 0's job is to get the scheduling rules and the dashboard right and test them. The rules are the part most worth protecting, and they are fully covered by tests without a type checker.

TypeScript can be added later, once the scheduling module is stable. JSDoc annotations already describe the shapes, so the move would be mechanical.

## Still proposed (needs Tony's decision)

- **Language for the API and scheduler:** TypeScript on Node, sharing the scheduling module with the client (as originally proposed), or Python with FastAPI, which would need a second implementation and cross-language parity tests.
- **Database access:** plain SQL migrations, reviewed before running (GUARDRAILS.md), with a thin query layer (Kysely or Drizzle) if TypeScript is chosen.
- **Web client framework:** Svelte with Vite, or plain modules as in Phase 0 extended to the full app. Decide once the Phase 0 dashboard has been used.
- **Push:** `web-push` with VAPID keys, when the scheduler is built (ADR-0004).
- **Hosting:** API and scheduler as systemd services on junipernine2, behind Cloudflare Tunnel (ADR-0002).

## Alternatives considered

- **Python (FastAPI + SQLAlchemy):** strong option if Tony prefers Python. Would not share the scheduling module with the client.
- **React or Next.js:** more common, heavier than needed for a single-user app.
- **Build tooling from day one (Vite, esbuild):** would add dependencies before there is code to build.
