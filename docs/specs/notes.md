# Spec: Notes API and audit log (`NOTE`, `AUD`)

- Status: Proposed
- Implements: ADR-0005 (Optimistic concurrency with an integer `version`), ADR-0006 (Soft delete and audit log),
  ADR-0007 (Idempotent creation with client-generated ids)
- Tests: `test/notes.test.ts`, recorded in `docs/tests/notes.md`
- Contract: `docs/api.md` · Schema: `docs/db-schema.md`

All requests carry a valid Access token (see the Access gate spec, `docs/specs/access.md`). A note is
`{ id, text, createdAt, updatedAt, version, deletedAt }`.

## Create and list

| Id | Requirement |
| --- | --- |
| NOTE-01 | `POST /api/notes { id?, text }` creates a note with `text` trimmed, `version` 1, `deletedAt` null, and answers **201** with it. Without `id`, the server generates a UUID. |
| NOTE-02 | `GET /api/notes` returns the visible (not deleted) notes, newest `createdAt` first. |
| NOTE-03 | Repeating a creation with the **same `id` and same text** answers **200** with the existing note and creates nothing new. |
| NOTE-04 | Creating with an `id` that already exists and a **different text** answers **409**. |
| NOTE-05 | Invalid input answers **400**: body not a JSON object; `text` missing, not a string, empty after trimming, or longer than 2000 characters; `id` present but not a UUID. |

## Update and delete

| Id | Requirement |
| --- | --- |
| NOTE-06 | `PATCH /api/notes/:id { version, text }` with the current `version` updates the text (trimmed), increments `version`, refreshes `updatedAt`, and answers **200** with the note. |
| NOTE-07 | A `PATCH` with a `version` that is not the current one answers **409** `{ error, current }` with the current note, and changes nothing. |
| NOTE-08 | `PATCH { version, delete: true }` soft-deletes: answers **200** with `deletedAt` set; the note disappears from `GET /api/notes` but stays in the database. |
| NOTE-09 | A `PATCH` on an unknown or deleted note answers **404**. |
| NOTE-10 | A `PATCH` without an integer `version`, or with nothing to change, answers **400**. |

## Audit

| Id | Requirement |
| --- | --- |
| AUD-01 | Every successful write (create, update, delete) adds exactly one row to `audit_log` with actor `pwa`, the operation (`create`, `update`, `delete`), entity `notes`, the note id, and the whole row as JSON before (null on create) and after. |
| AUD-02 | A write that is refused or changes nothing (validation error, stale version, repeated creation) adds no row to `audit_log`. |
| AUD-03 | The write and its audit row are committed together (one D1 batch): if the audit insert fails, the write is undone. |
