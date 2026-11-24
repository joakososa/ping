// Spec: docs/specs/notas.md (NOT-*, AUD-*)

import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { call } from "./helpers";

type Nota = { id: string; texto: string; version: number; borradoEn: string | null; creado: string };

const cambios = async (id: string) =>
  (await env.DB.prepare("SELECT * FROM cambios WHERE entidad_id = ? ORDER BY id").bind(id).all()).results;

const crear = async (texto: string, id?: string) =>
  (await call("POST", "/api/notas", { body: id ? { id, texto } : { texto } })).body as Nota;

const ids = (list: Nota[]) => list.map((n) => n.id);

describe("create and list", () => {
  it("NOT-01 creates a note with trimmed text and version 1 (201)", async () => {
    const id = crypto.randomUUID();
    const res = await call("POST", "/api/notas", { body: { id, texto: "  hola  " } });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id, texto: "hola", version: 1, borradoEn: null });
  });

  it("NOT-01 generates a UUID when no id is sent", async () => {
    const res = await call("POST", "/api/notas", { body: { texto: "sin id" } });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("NOT-02 lists visible notes, newest first", async () => {
    const vieja = await crear("vieja");
    await new Promise((r) => setTimeout(r, 5));
    const nueva = await crear("nueva");
    const list = (await call("GET", "/api/notas")).body as Nota[];
    expect(ids(list).indexOf(nueva.id)).toBeLessThan(ids(list).indexOf(vieja.id));
  });

  it("NOT-03 a repeated creation (same id, same text) returns 200 and the existing note", async () => {
    const id = crypto.randomUUID();
    await crear("uno", id);
    const retry = await call("POST", "/api/notas", { body: { id, texto: "uno" } });
    expect(retry.status).toBe(200);
    expect(retry.body.id).toBe(id);
    const list = (await call("GET", "/api/notas")).body as Nota[];
    expect(ids(list).filter((x) => x === id)).toHaveLength(1);
  });

  it("NOT-04 refuses to reuse an id for a different text (409)", async () => {
    const id = crypto.randomUUID();
    await crear("uno", id);
    expect((await call("POST", "/api/notas", { body: { id, texto: "otro" } })).status).toBe(409);
  });

  it.each([
    ["body is an array", ["x"]],
    ["texto missing", {}],
    ["texto not a string", { texto: 5 }],
    ["texto blank", { texto: "   " }],
    ["texto over 2000 chars", { texto: "x".repeat(2001) }],
    ["id not a UUID", { id: "nope", texto: "x" }],
  ])("NOT-05 refuses invalid input with 400: %s", async (_label, body) => {
    expect((await call("POST", "/api/notas", { body })).status).toBe(400);
  });
});

describe("update and delete", () => {
  it("NOT-06 edits with the current version: trimmed text, version + 1", async () => {
    const nota = await crear("v1");
    const res = await call("PATCH", `/api/notas/${nota.id}`, { body: { texto: " v2 ", version: 1 } });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: nota.id, texto: "v2", version: 2 });
  });

  it("NOT-07 refuses a stale version with 409 and the current note, changing nothing", async () => {
    const nota = await crear("v1");
    await call("PATCH", `/api/notas/${nota.id}`, { body: { texto: "v2", version: 1 } });
    const stale = await call("PATCH", `/api/notas/${nota.id}`, { body: { texto: "pisada", version: 1 } });
    expect(stale.status).toBe(409);
    expect(stale.body.actual).toMatchObject({ texto: "v2", version: 2 });
    const row = await env.DB.prepare("SELECT texto, version FROM notas WHERE id = ?").bind(nota.id).first();
    expect(row).toEqual({ texto: "v2", version: 2 });
  });

  it("NOT-08 soft-deletes: hidden from the list, kept in the database", async () => {
    const nota = await crear("chau");
    const res = await call("PATCH", `/api/notas/${nota.id}`, { body: { borrar: true, version: 1 } });
    expect(res.status).toBe(200);
    expect(res.body.borradoEn).not.toBeNull();
    expect(ids((await call("GET", "/api/notas")).body)).not.toContain(nota.id);
    const row = await env.DB.prepare("SELECT borrado_en FROM notas WHERE id = ?").bind(nota.id).first();
    expect(row?.borrado_en).not.toBeNull();
  });

  it("NOT-09 answers 404 for unknown and deleted notes", async () => {
    const unknown = await call("PATCH", `/api/notas/${crypto.randomUUID()}`, { body: { texto: "x", version: 1 } });
    expect(unknown.status).toBe(404);
    const nota = await crear("x");
    await call("PATCH", `/api/notas/${nota.id}`, { body: { borrar: true, version: 1 } });
    expect((await call("PATCH", `/api/notas/${nota.id}`, { body: { texto: "revive", version: 2 } })).status).toBe(404);
  });

  it.each([
    ["no version", { texto: "y" }],
    ["version not an integer", { texto: "y", version: "1" }],
    ["nothing to change", { version: 1 }],
    ["blank texto", { texto: " ", version: 1 }],
  ])("NOT-10 refuses an invalid update with 400: %s", async (_label, body) => {
    const nota = await crear("x");
    expect((await call("PATCH", `/api/notas/${nota.id}`, { body })).status).toBe(400);
  });
});

describe("audit", () => {
  it("AUD-01 records create, edit and delete with actor, operation and snapshots", async () => {
    const nota = await crear("v1");
    await call("PATCH", `/api/notas/${nota.id}`, { body: { texto: "v2", version: 1 } });
    await call("PATCH", `/api/notas/${nota.id}`, { body: { borrar: true, version: 2 } });

    const rows = await cambios(nota.id);
    expect(rows.map((r) => r.operacion)).toEqual(["crear", "editar", "borrar"]);
    for (const r of rows) expect(r).toMatchObject({ actor: "pwa", entidad: "notas", entidad_id: nota.id });
    expect(rows[0]!.antes).toBeNull();
    expect(JSON.parse(rows[0]!.despues as string).texto).toBe("v1");
    expect(JSON.parse(rows[1]!.antes as string).texto).toBe("v1");
    expect(JSON.parse(rows[1]!.despues as string).texto).toBe("v2");
    expect(JSON.parse(rows[2]!.despues as string).borradoEn).not.toBeNull();
  });

  it("AUD-02 refused or no-op writes add no audit rows", async () => {
    const id = crypto.randomUUID();
    await crear("v1", id);
    await call("POST", "/api/notas", { body: { id, texto: "v1" } }); // repeated creation
    await call("POST", "/api/notas", { body: { id, texto: "otro" } }); // id taken
    await call("PATCH", `/api/notas/${id}`, { body: { texto: "x", version: 7 } }); // stale version
    await call("PATCH", `/api/notas/${id}`, { body: { texto: " ", version: 1 } }); // invalid
    expect(await cambios(id)).toHaveLength(1);
  });

  it("AUD-03 a write whose audit insert fails is rolled back with it", async () => {
    // Break the audit table for this test only: the write must not survive without its audit row.
    await env.DB.prepare("ALTER TABLE cambios RENAME TO cambios_off").run();
    try {
      const id = crypto.randomUUID();
      const res = await call("POST", "/api/notas", { body: { id, texto: "sin auditoría" } });
      expect(res.status).toBe(500);
      expect(await env.DB.prepare("SELECT id FROM notas WHERE id = ?").bind(id).first()).toBeNull();
    } finally {
      await env.DB.prepare("ALTER TABLE cambios_off RENAME TO cambios").run();
    }
  });
});
