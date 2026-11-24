# Tests: PWA (`PWA`)

Spec: `docs/specs/pwa.md` (PWA). No automated tests in the repo yet: Claude checks the app with a headless Chrome
against a local server that fakes the Access login; Joaquin checks the device-only items once after the first deploy.

## Claude's browser check (last run: 2026-11-24, on branch `feat/pwa`)

| Requirement | What was done | Result |
| --- | --- | --- |
| PWA-02: last notes at once, then refresh | Reload: the saved list showed first, then the server's | OK |
| PWA-04: new note shows at once, "Pendiente de envío" until confirmed | Added two notes | OK |
| PWA-05: offline notes kept and sent later; app opens offline | Offline: note marked pending with the notice; reload offline opened the app with it; back online it was sent | OK |
| PWA-06: edit/delete send the version; 409 shows the current note | Edited a note (version 1 → 2); 409 path reviewed in code (`cambiar` in `web/app.js`) | OK |
| PWA-07: delete needs two taps | Tapped Borrar twice | OK |
| PWA-09: service worker never stores `/api/*` | Reviewed `web/sw.js` (returns early for `/api/`) | OK |
| PWA-10: Spanish, light/dark, 360 px | Screenshot at 400 px, light mode | OK (dark mode not checked yet) |

## Joaquin's check after the first deploy (on the Android phone)

| Requirement | How | Result |
| --- | --- | --- |
| PWA-01: installable, own icon, opens without the address bar | Chrome menu → "Instalar app"; open from the home screen | Pending |
| PWA-03: refresh when coming back to the app | Add a note from the computer, switch back to the app on the phone | Pending |
| PWA-08: expired session offers "Entrar de nuevo" | Zero Trust → revoke the session, then touch the app | Pending |
