# Spec: PWA (`PWA`)

- Status: Proposed
- Implements: ADR-0007 (Idempotent creation with client-generated ids), ADR-0009 (PWA freshness: refresh on open
  and focus, cached shell)
- Verification: see "Who checks what" below and `docs/tests/pwa.md`.

## Requirements

| Id | Requirement |
| --- | --- |
| PWA-01 | **Installable on Android.** Chrome offers "Install app" for the site; once installed, Ping has its own icon on the home screen and opens full screen, like a native app, without Chrome's address bar. (Technically: a web manifest with name, icons and `display: standalone`, plus a service worker.) |
| PWA-02 | On open, the notes seen last time appear at once (saved on the device), and then the list is refreshed from the server. |
| PWA-03 | The list is refreshed every time the app comes back to the front, and when the connection returns. |
| PWA-04 | A new note appears immediately, marked "Pendiente de envío" until the server confirms it. |
| PWA-05 | Without connection, new notes are kept on the device and sent when the connection returns, with a notice saying so. Reloading without connection still opens the app with the pending notes. |
| PWA-06 | Editing and deleting send the `version` read. If the note changed meanwhile (409), the app says so and shows the current version. |
| PWA-07 | Deleting needs two taps (no browser pop-up dialogs). |
| PWA-08 | When the Access session expires, the app says so and offers "Entrar de nuevo", which goes through the Access login. |
| PWA-09 | The service worker never stores `/api/*` responses. |
| PWA-10 | The UI is in Spanish, readable in light and dark mode, and usable at 360 px width. |

## Who checks what

- **Claude, before each PR that touches `web/`:** runs the app locally with a fake Access login and drives it with a
  headless Chrome (PWA-02, 04, 05, 06, 07, 09, 10). The results go in `docs/tests/pwa.md` and in the PR.
- **Joaquin, once after the first deploy** (about 10 minutes, on the phone): PWA-01 (install), PWA-03 (come back to
  the app after adding a note elsewhere) and PWA-08 (session expiry). These need the real domain, Access and an
  Android device.
- Planned: move Claude's checks into automated browser tests in CI, so they run on every PR.
