# Tests: Notes API and audit log (`NOT`, `AUD`)

Spec: `docs/specs/notas.md` (Notes API and audit log). File: `test/notas.test.ts`. Each test runs against a real
local D1 with the migrations applied (`test/setup.ts`).

## Create and list

| Requirement | Test | What it proves |
| --- | --- | --- |
| NOT-01: create → 201, trimmed text, version 1; server UUID when no id | `NOT-01 creates a note with trimmed text and version 1 (201)`, `NOT-01 generates a UUID when no id is sent` | Creating works with and without a client id |
| NOT-02: list visible notes, newest first | `NOT-02 lists visible notes, newest first` | Order of the list |
| NOT-03: same id + same text → 200, no duplicate | `NOT-03 a repeated creation (same id, same text) returns 200 and the existing note` | An offline retry never creates a second note |
| NOT-04: same id + different text → 409 | `NOT-04 refuses to reuse an id for a different text (409)` | An id cannot be hijacked for another note |
| NOT-05: invalid input → 400 | `NOT-05 refuses invalid input with 400: …` (6 cases: array body, missing text, non-string text, blank text, text over 2000 chars, id not a UUID) | Bad input never reaches the database |

## Update and delete

| Requirement | Test | What it proves |
| --- | --- | --- |
| NOT-06: edit with current version → text trimmed, version + 1 | `NOT-06 edits with the current version: trimmed text, version + 1` | Normal edit |
| NOT-07: stale version → 409 with current note, nothing changes | `NOT-07 refuses a stale version with 409 and the current note, changing nothing` | Two devices cannot silently overwrite each other (checked in the database too) |
| NOT-08: delete hides the note but keeps the row | `NOT-08 soft-deletes: hidden from the list, kept in the database` | Deleting is reversible |
| NOT-09: unknown or deleted note → 404 | `NOT-09 answers 404 for unknown and deleted notes` | A deleted note cannot be edited back |
| NOT-10: missing/non-integer version or nothing to change → 400 | `NOT-10 refuses an invalid update with 400: …` (4 cases: no version, version as text, nothing to change, blank text) | Every update must say which version it read |

## Audit

| Requirement | Test | What it proves |
| --- | --- | --- |
| AUD-01: one audit row per successful write, with actor, operation, before/after | `AUD-01 records create, edit and delete with actor, operation and snapshots` | The history shows who changed what, from what to what |
| AUD-02: refused or no-op writes leave no audit row | `AUD-02 refused or no-op writes add no audit rows` | The history only has real changes (retry, taken id, stale version, invalid input) |
| AUD-03: write and audit row committed together | `AUD-03 a write whose audit insert fails is rolled back with it` | There is never a change without its history row |
