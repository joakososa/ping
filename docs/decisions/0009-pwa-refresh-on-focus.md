# ADR-0009: PWA freshness: refresh on open and focus, cached shell

- Status: Accepted (2026-11-26)
- Date: 2026-11-24

## Context
The current artifacts update live. A single user does not need live updates, and live sync (Durable Objects,
WebSockets) adds cost and complexity. Claude recommended a PWA over a native app (no store, instant updates, the
current pages are already HTML/JS); Joaquin accepted it on 2026-11-23 without being fully convinced, keeping the
option of a native client later on the same API.

## Decision
- The PWA loads data on open and every time it comes back to the front (`visibilitychange`, `online`).
- Own changes are shown immediately (optimistic) and reconciled with the server response.
- A service worker caches the app shell: shell files are served from cache and refreshed in the background;
  navigations go to the network first (so an expired Access session reaches the login page) and fall back to the
  cached shell offline. `/api/*` is never cached.
- API calls use `redirect: "manual"`; a redirect, 401 or 403 means the Access session expired, and the app offers
  "Entrar de nuevo" (reload through the login).

## Consequences
- A change made elsewhere (e.g. by Claude) appears when the app is next opened or focused, not instantly.
- Live updates can be added later without changing the API or the data model.
