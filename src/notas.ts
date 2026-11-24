// Data access for `notas`. Shared by the HTTP API (actor "pwa") and, in the next PR, the MCP tools (actor "mcp").

import { auditIfChanged, type Actor } from "./core/audit";

export const TEXTO_MAX = 2000;

export interface Nota {
  id: string;
  texto: string;
  creado: string;
  actualizado: string;
  version: number;
  borradoEn: string | null;
}

interface NotaRow {
  id: string;
  texto: string;
  creado: string;
  actualizado: string;
  version: number;
  borrado_en: string | null;
}

const fromRow = (row: NotaRow): Nota => ({
  id: row.id,
  texto: row.texto,
  creado: row.creado,
  actualizado: row.actualizado,
  version: row.version,
  borradoEn: row.borrado_en,
});

export type Result<T> =
  | { ok: true; value: T; created?: boolean }
  | { ok: false; error: "invalid"; message: string }
  | { ok: false; error: "not_found" }
  | { ok: false; error: "conflict"; actual: Nota };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validarTexto(texto: unknown): string | { message: string } {
  if (typeof texto !== "string") return { message: "texto must be a string" };
  const limpio = texto.trim();
  if (limpio === "") return { message: "texto cannot be empty" };
  if (limpio.length > TEXTO_MAX) return { message: `texto is longer than ${TEXTO_MAX} characters` };
  return limpio;
}

export async function listar(db: D1Database): Promise<Nota[]> {
  const { results } = await db
    .prepare("SELECT * FROM notas WHERE borrado_en IS NULL ORDER BY creado DESC")
    .all<NotaRow>();
  return results.map(fromRow);
}

export async function obtener(db: D1Database, id: string): Promise<Nota | null> {
  const row = await db.prepare("SELECT * FROM notas WHERE id = ?").bind(id).first<NotaRow>();
  return row ? fromRow(row) : null;
}

/**
 * Creates a note. Idempotent by id: retrying the same request (e.g. an offline retry) returns the existing note
 * instead of creating a duplicate.
 */
export async function crear(
  db: D1Database,
  input: { id?: unknown; texto?: unknown },
  actor: Actor,
  now: Date = new Date(),
): Promise<Result<Nota>> {
  const texto = validarTexto(input.texto);
  if (typeof texto !== "string") return { ok: false, error: "invalid", message: texto.message };

  let id: string;
  if (input.id === undefined) {
    id = crypto.randomUUID();
  } else if (typeof input.id === "string" && UUID.test(input.id)) {
    id = input.id.toLowerCase();
  } else {
    return { ok: false, error: "invalid", message: "id must be a UUID" };
  }

  const ts = now.toISOString();
  const nota: Nota = { id, texto, creado: ts, actualizado: ts, version: 1, borradoEn: null };

  const [insert] = await db.batch([
    db
      .prepare(
        "INSERT OR IGNORE INTO notas (id, texto, creado, actualizado, version) VALUES (?, ?, ?, ?, 1)",
      )
      .bind(id, texto, ts, ts),
    auditIfChanged(db, { ts, actor, operacion: "crear", entidad: "notas", entidadId: id, antes: null, despues: nota }),
  ]);

  if (insert?.meta.changes === 1) return { ok: true, value: nota, created: true };

  // The id already existed: a retry of the same creation is fine, anything else is a conflict.
  const existente = await obtener(db, id);
  if (existente && existente.texto === texto) return { ok: true, value: existente, created: false };
  if (existente) return { ok: false, error: "conflict", actual: existente };
  return { ok: false, error: "not_found" };
}

/** Partial update with optimistic concurrency. `borrar: true` soft-deletes. */
export async function actualizar(
  db: D1Database,
  id: string,
  input: { texto?: unknown; borrar?: unknown; version?: unknown },
  actor: Actor,
  now: Date = new Date(),
): Promise<Result<Nota>> {
  if (typeof input.version !== "number" || !Number.isInteger(input.version)) {
    return { ok: false, error: "invalid", message: "version (integer) is required" };
  }
  if (input.texto === undefined && input.borrar !== true) {
    return { ok: false, error: "invalid", message: "nothing to change" };
  }
  let texto: string | undefined;
  if (input.texto !== undefined) {
    const validado = validarTexto(input.texto);
    if (typeof validado !== "string") return { ok: false, error: "invalid", message: validado.message };
    texto = validado;
  }

  const antes = await obtener(db, id);
  if (!antes || antes.borradoEn) return { ok: false, error: "not_found" };
  if (antes.version !== input.version) return { ok: false, error: "conflict", actual: antes };

  const ts = now.toISOString();
  const despues: Nota = {
    ...antes,
    texto: texto ?? antes.texto,
    actualizado: ts,
    version: antes.version + 1,
    borradoEn: input.borrar === true ? ts : null,
  };

  const [update] = await db.batch([
    db
      .prepare(
        `UPDATE notas SET texto = ?, actualizado = ?, version = version + 1, borrado_en = ?
         WHERE id = ? AND version = ? AND borrado_en IS NULL`,
      )
      .bind(despues.texto, ts, despues.borradoEn, id, antes.version),
    auditIfChanged(db, {
      ts,
      actor,
      operacion: input.borrar === true ? "borrar" : "editar",
      entidad: "notas",
      entidadId: id,
      antes,
      despues,
    }),
  ]);

  if (update?.meta.changes === 1) return { ok: true, value: despues };

  // Someone else wrote between our read and our update.
  const actual = await obtener(db, id);
  if (!actual || actual.borradoEn) return { ok: false, error: "not_found" };
  return { ok: false, error: "conflict", actual };
}
