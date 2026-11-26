# ADR-0006: Soft delete and audit log

- Status: Proposed
- Date: 2026-11-24

## Context
Data in these systems is personal and written by several actors (PWA, Claude through MCP, local scripts). Mistakes
must be visible and reversible, and no actor (least of all an AI tool) should be able to destroy data.

## Decision
- **No hard deletes.** Deleting sets `deleted_at` (timestamp); reads hide those rows. No endpoint or MCP tool
  deletes rows, and no tool runs free-form SQL.
- **Audit log:** an `audit_log` table records every successful write: timestamp, actor (`pwa` | `mcp` | `script`),
  operation, entity, entity id, JSON snapshots before and after.
- The write and its audit row are sent as **one D1 batch (one transaction)**. The audit insert uses
  `WHERE changes() = 1`, so a write that changed nothing (stale version, duplicate id) leaves no audit row.

## Consequences
- Any change can be traced and undone by hand from `audit_log`.
- The database grows with history; at personal scale this is far below the 500 MB Free limit.
- Nightly exports (stage 1 backups) include `audit_log`.
