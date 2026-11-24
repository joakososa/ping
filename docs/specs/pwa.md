# Spec: PWA (`PWA`)

- Status: Proposed
- Implements: ADR-0007, ADR-0009
- Verification: manual checklist below (run on desktop Chrome and on Android after each PWA change). Browser tests
  may be added later; until then each PR that touches `web/` states which items were checked and how.

| Id | Requirement | How to check |
| --- | --- | --- |
| PWA-01 | The app is installable on Android (manifest with name, icons 192/512 + maskable, `display: standalone`, service worker). | Chrome menu shows "Install app"; installed icon opens without browser bar. |
| PWA-02 | On open, the last known notes show at once (local copy), then the list refreshes from the API. | Open with slow network: list appears, then updates. |
| PWA-03 | The list refreshes whenever the app comes back to the front, and when the connection returns. | Add a note from another device, switch back: it appears. |
| PWA-04 | A new note shows immediately, marked "Pendiente de envío" until the server confirms it. | Add a note; the mark disappears after the save. |
| PWA-05 | Without connection, new notes are kept on the device and sent when the connection returns; an offline notice is shown. Reloading offline still opens the app with the pending notes. | Airplane mode → add → reload → back online. |
| PWA-06 | Editing and deleting send the `version` read. On 409 the app says the note changed while open and shows the current version. | Edit the same note in two tabs. |
| PWA-07 | Deleting needs two taps (no browser dialogs). | Tap Borrar → "¿Seguro?" → tap again within 3 s. |
| PWA-08 | When the Access session expires, the app says so and offers "Entrar de nuevo", which goes through the Access login. | Revoke the session in Zero Trust, then interact. |
| PWA-09 | The service worker never caches `/api/*`. | DevTools → Application → Cache Storage holds only shell files. |
| PWA-10 | The UI is in Spanish, readable in light and dark mode, and usable at 360 px width. | Visual check. |
