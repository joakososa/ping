-- ping: the stage-1 proof system and template for every other system.

CREATE TABLE notas (
  id          TEXT PRIMARY KEY,                -- client-generated UUID (makes creation idempotent)
  texto       TEXT NOT NULL,
  creado      TEXT NOT NULL,                   -- ISO 8601, UTC
  actualizado TEXT NOT NULL,                   -- ISO 8601, UTC
  version     INTEGER NOT NULL DEFAULT 1,      -- optimistic concurrency: writes must send the version they read
  borrado_en  TEXT                             -- soft delete; NULL = visible
);

CREATE INDEX notas_visibles ON notas (borrado_en, creado);

-- Audit log: one row per successful write, from any actor. Part of the template.
CREATE TABLE cambios (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          TEXT NOT NULL,
  actor       TEXT NOT NULL CHECK (actor IN ('pwa', 'mcp', 'script')),
  operacion   TEXT NOT NULL,
  entidad     TEXT NOT NULL,
  entidad_id  TEXT NOT NULL,
  antes       TEXT,                            -- JSON snapshot before the change (NULL on create)
  despues     TEXT                             -- JSON snapshot after the change
);

CREATE INDEX cambios_entidad ON cambios (entidad, entidad_id);
