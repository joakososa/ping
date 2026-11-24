# Tests: PWA (`PWA`)

Spec: `docs/specs/pwa.md` (PWA). File: `e2e/pwa.spec.ts` (Playwright, Chromium emulating a Pixel 7), run in CI on
every push against the test-only server `e2e/worker.ts`, which runs the real app and plays Cloudflare Access
(ADR-0011, Browser tests with Playwright in CI). Run locally with `npm run test:e2e`.

| Requirement | Test | What it proves |
| --- | --- | --- |
| PWA-01: installable on Android | `PWA-01 has what Chrome needs to offer installing it` | Manifest has name, `standalone`, 192/512 and maskable icons that load, and the service worker registers |
| PWA-02: last known notes at once, then refresh | `PWA-02 shows the last known notes at once, then refreshes` | With the server's list held back, a reload still shows the note saved on the device |
| PWA-03: refresh when coming back to the front | `PWA-03 refreshes when the app comes back to the front` | A note created elsewhere appears when the app becomes visible again |
| PWA-04: new note at once, pending until confirmed | `PWA-04 shows a new note at once, pending until the server confirms` | The note shows "Pendiente de envío" while the server is held back, and the mark goes away after |
| PWA-05: offline notes kept and sent later | `PWA-05 keeps notes written offline and sends them when back online` | Offline: note pending and notice shown; reload offline still opens the app; back online it reaches the server |
| PWA-06: 409 shows the current note | `PWA-06 refuses to overwrite a note changed elsewhere and shows the current one` | Two devices edit the same note: the second is told and sees the first one's text, nothing is overwritten |
| PWA-07: delete needs two taps | `PWA-07 deleting needs two taps` | One tap only arms "¿Seguro?"; the second deletes |
| PWA-08: expired session offers to log in again | `PWA-08 an expired session offers to log in again` | When API calls get the Access login redirect, the app shows "Tu sesión venció" and "Entrar de nuevo" |
| PWA-09: service worker never stores `/api/*` | `PWA-09 the service worker never stores API responses` | After using the app, the caches hold shell files and no `/api/` response |
| PWA-10: Spanish, 360 px, dark mode | `PWA-10 is in Spanish, fits 360 px and has a dark mode` | `lang="es"`, no horizontal scroll at 360 px, different background in dark mode |

## Still checked by hand, once, on the phone after the first deploy

| Requirement | How | Result |
| --- | --- | --- |
| PWA-01 (real prompt) | Chrome menu → "Instalar app"; open from the home screen: no address bar | Pending |
| PWA-08 (real login) | Zero Trust → revoke the session, touch the app, "Entrar de nuevo" → Access login → back in the app | Pending |
