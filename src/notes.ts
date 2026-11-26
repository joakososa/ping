// Data access for `notes`. Shared by the HTTP API (actor "pwa") and, later, the MCP tools (actor "mcp").

import { auditIfChanged, type Actor } from "./core/audit";

export const TEXT_MAX = 2000;

export interface Note {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  deletedAt: string | null;
}

interface NoteRow {
  id: string;
  text: string;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
}

const fromRow = (row: NoteRow): Note => ({
  id: row.id,
  text: row.text,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  version: row.version,
  deletedAt: row.deleted_at,
});

export type Result<T> =
  | { ok: true; value: T; created?: boolean }
  | { ok: false; error: "invalid"; message: string }
  | { ok: false; error: "not_found" }
  | { ok: false; error: "conflict"; current: Note };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateText(text: unknown): string | { message: string } {
  if (typeof text !== "string") return { message: "text must be a string" };
  const trimmed = text.trim();
  if (trimmed === "") return { message: "text cannot be empty" };
  if (trimmed.length > TEXT_MAX) return { message: `text is longer than ${TEXT_MAX} characters` };
  return trimmed;
}

export async function listNotes(db: D1Database): Promise<Note[]> {
  const { results } = await db
    .prepare("SELECT * FROM notes WHERE deleted_at IS NULL ORDER BY created_at DESC")
    .all<NoteRow>();
  return results.map(fromRow);
}

export async function getNote(db: D1Database, id: string): Promise<Note | null> {
  const row = await db.prepare("SELECT * FROM notes WHERE id = ?").bind(id).first<NoteRow>();
  return row ? fromRow(row) : null;
}

/**
 * Creates a note. Idempotent by id: retrying the same request (e.g. an offline retry) returns the existing note
 * instead of creating a duplicate.
 */
export async function createNote(
  db: D1Database,
  input: { id?: unknown; text?: unknown },
  actor: Actor,
  now: Date = new Date(),
): Promise<Result<Note>> {
  const text = validateText(input.text);
  if (typeof text !== "string") return { ok: false, error: "invalid", message: text.message };

  let id: string;
  if (input.id === undefined) {
    id = crypto.randomUUID();
  } else if (typeof input.id === "string" && UUID.test(input.id)) {
    id = input.id.toLowerCase();
  } else {
    return { ok: false, error: "invalid", message: "id must be a UUID" };
  }

  const ts = now.toISOString();
  const note: Note = { id, text, createdAt: ts, updatedAt: ts, version: 1, deletedAt: null };

  const [insert] = await db.batch([
    db
      .prepare("INSERT OR IGNORE INTO notes (id, text, created_at, updated_at, version) VALUES (?, ?, ?, ?, 1)")
      .bind(id, text, ts, ts),
    auditIfChanged(db, { changedAt: ts, actor, operation: "create", entity: "notes", entityId: id, before: null, after: note }),
  ]);

  if (insert?.meta.changes === 1) return { ok: true, value: note, created: true };

  // The id already existed: a retry of the same creation is fine, anything else is a conflict.
  const existing = await getNote(db, id);
  if (existing && existing.text === text) return { ok: true, value: existing, created: false };
  if (existing) return { ok: false, error: "conflict", current: existing };
  return { ok: false, error: "not_found" };
}

/** Partial update with optimistic concurrency. `delete: true` soft-deletes. */
export async function updateNote(
  db: D1Database,
  id: string,
  input: { text?: unknown; delete?: unknown; version?: unknown },
  actor: Actor,
  now: Date = new Date(),
): Promise<Result<Note>> {
  if (typeof input.version !== "number" || !Number.isInteger(input.version)) {
    return { ok: false, error: "invalid", message: "version (integer) is required" };
  }
  const deleting = input.delete === true;
  if (input.text === undefined && !deleting) {
    return { ok: false, error: "invalid", message: "nothing to change" };
  }
  let text: string | undefined;
  if (input.text !== undefined) {
    const validated = validateText(input.text);
    if (typeof validated !== "string") return { ok: false, error: "invalid", message: validated.message };
    text = validated;
  }

  const before = await getNote(db, id);
  if (!before || before.deletedAt) return { ok: false, error: "not_found" };
  if (before.version !== input.version) return { ok: false, error: "conflict", current: before };

  const ts = now.toISOString();
  const after: Note = {
    ...before,
    text: text ?? before.text,
    updatedAt: ts,
    version: before.version + 1,
    deletedAt: deleting ? ts : null,
  };

  const [update] = await db.batch([
    db
      .prepare(
        `UPDATE notes SET text = ?, updated_at = ?, version = version + 1, deleted_at = ?
         WHERE id = ? AND version = ? AND deleted_at IS NULL`,
      )
      .bind(after.text, ts, after.deletedAt, id, before.version),
    auditIfChanged(db, {
      changedAt: ts,
      actor,
      operation: deleting ? "delete" : "update",
      entity: "notes",
      entityId: id,
      before,
      after,
    }),
  ]);

  if (update?.meta.changes === 1) return { ok: true, value: after };

  // Someone else wrote between our read and our update.
  const current = await getNote(db, id);
  if (!current || current.deletedAt) return { ok: false, error: "not_found" };
  return { ok: false, error: "conflict", current };
}
