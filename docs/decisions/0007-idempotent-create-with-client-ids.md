# ADR-0007: Idempotent creation with client-generated ids

- Status: Accepted (2026-11-26)
- Date: 2026-11-24

## Context
The PWA must let Joaquin write a note with no signal and send it later. A request can also succeed on the server
while its response is lost, so the client retries. Server-generated ids would create duplicates on retry.

## Decision
- Clients generate the record id (UUID v4) before sending. The server accepts a client id or generates one if
  absent (e.g. for MCP tools).
- Creating with an id that already exists and the **same content** returns **200** with the existing record
  (a retry). With **different content** it returns **409** (the id is taken).
- The PWA keeps unsent creations in a local queue and sends them on load, on reconnect and after each new note.

## Consequences
- Retries are always safe; the audit log records the creation once.
- Offline edits and deletes are not queued (they need the current `version`); only creations work offline.
