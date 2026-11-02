# ADR-0001: Web app becomes the primary client; iOS parity is the target

Status: Accepted
Date: 2026-11-02

## Context

Domesticity exists as a native SwiftUI app with SwiftData storage, designed for future iCloud sharing. Tony wants it to run from junipernine.com like the recipe and photo apps, so it can be used from any device without installing anything.

## Decision

- Build a browser app (a progressive web app) as the primary client.
- The target is feature parity with the iOS app, as listed in SPEC.md section 9.
- Keep the iOS app in its repository unchanged for now. It is a reference for behaviour, not a parallel product.

## Consequences

- The scheduling rules are re-specified in SPEC.md section 5 rather than copied, so the web app is the first place the rules are written down precisely.
- Platform-specific gaps (notification action buttons, offline use) are accepted and documented rather than worked around.
- The iOS app's CloudKit design is not carried over. Sharing is a future decision (ADR-0005).
