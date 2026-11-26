-- ping: the stage-1 proof system and template for every other system.

CREATE TABLE notes (
  id          TEXT PRIMARY KEY,                -- client-generated UUID (makes creation idempotent)
  text        TEXT NOT NULL,
  created_at  TEXT NOT NULL,                   -- ISO 8601, UTC
  updated_at  TEXT NOT NULL,                   -- ISO 8601, UTC
  version     INTEGER NOT NULL DEFAULT 1,      -- optimistic concurrency: writes must send the version they read
  deleted_at  TEXT                             -- soft delete; NULL = visible
);

CREATE INDEX notes_visible ON notes (deleted_at, created_at);

-- Audit log: one row per successful write, from any actor. Part of the template.
CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  changed_at  TEXT NOT NULL,
  actor       TEXT NOT NULL CHECK (actor IN ('pwa', 'mcp', 'script')),
  operation   TEXT NOT NULL,
  entity      TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  before_json TEXT,                            -- whole row as JSON before the change (NULL on create)
  after_json  TEXT                             -- whole row as JSON after the change
);

CREATE INDEX audit_log_entity ON audit_log (entity, entity_id);
