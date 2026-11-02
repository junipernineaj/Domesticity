# ADR-0008: Host on junipernine2 behind a Cloudflare Tunnel, with Cloudflare Access in front

Status: Accepted (2 Nov 2026). Set up on the server by Tony.
Date: 2026-11-02

## Context

The Domesticity web app runs on junipernine2, Tony's Ubuntu home server, and needs to be reachable from his Mac and iPhone away from home. The recipe and photo apps are hosted the same way. ADR-0002 chose junipernine2 with a Cloudflare Tunnel. This ADR records how it is done.

The main risk is exposing a home server to the internet. The GUARDRAILS say no inbound ports are opened on the router. Phase 0 also has no app-level login, so something has to stand in front of it.

## Decision

1. **App listens on loopback only.** `HOST=127.0.0.1`, port 8095. Nothing on the LAN can reach it directly.
2. **cloudflared runs on the same host** as a system service. It makes an outbound connection to Cloudflare, so the router needs no port forwarding.
3. **One hostname per app**, routed by the tunnel's ingress rules. Domesticity uses `domesticity.junipernine.com`. Any other hostname gets a 404.
4. **Cloudflare Access** sits in front of each hostname, with a policy that allows only Tony's email, using a one-time PIN. This is the only login until the app has its own (ADR-0005).
5. **The app runs as a system user** (`domesticity`), with systemd hardening (no write access, no home directory, restricted address families).
6. **Deployment is by script** (`web/deploy/install.sh`), run by hand on the server. It runs the tests before it replaces the running copy.

## Why this shape

- Outbound-only tunnel: no open ports, no dynamic DNS, and no exposure of the home IP.
- Access before the app: the app's own code has no auth yet, so the gate has to be outside it. A bug in the app then can't expose data to the internet.
- Loopback binding: even if the tunnel or Access were misconfigured, the app is not on the LAN.
- Separate hostnames per app: each can get its own Access policy and be turned off on its own.

## Alternatives considered

- **Port forwarding on the router with a dynamic DNS name.** Rejected: opens the home network to the internet and needs TLS set up by hand.
- **Tailscale (or another VPN mesh) only.** Good for private access, but the Mac and iPhone each need the client installed and it can't serve a public link. Worth revisiting if the Access policy ever feels too exposed.
- **Cloudflare Pages or Workers for the app.** Rejected for now: the scheduler needs a long-running process and the data is on junipernine2 (ADR-0002).

## Consequences

- The tunnel credentials JSON and the Access policy are the security boundary. The credentials file is mode 600 under `/etc/cloudflared`, and must not be committed (GUARDRAILS).
- Access sign-in uses email codes, so access depends on the email account. Keep that account secured.
- Restarting cloudflared or the app takes the site down briefly. Acceptable for one household.
- Claude does not change Cloudflare, DNS or the tunnel without an explicit yes in chat (GUARDRAILS). Those steps are run by Tony.
- Each new app added to junipernine2 needs its own port, hostname and Access application. Port 8095 is used by Domesticity; the other apps keep theirs.
