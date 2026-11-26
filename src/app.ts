import { Hono } from "hono";
import type { JWTVerifyGetKey } from "jose";
import { requireAccess, type AccessBindings, type AccessIdentity } from "./core/access";
import { createNote, listNotes, updateNote, type Note, type Result } from "./notes";

export interface Bindings extends AccessBindings {
  DB: D1Database;
  ASSETS: Fetcher;
}

export interface AppDeps {
  /** Where Access public keys come from. Production: the team's JWKS URL. Tests: a local key set. */
  getKeyFor: (env: Bindings) => JWTVerifyGetKey;
}

export type AppEnv = { Bindings: Bindings; Variables: { identity: AccessIdentity } };

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body !== null && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function createApp(deps: AppDeps) {
  const app = new Hono<AppEnv>();

  // Every /api response is private and must never be cached by the browser, the service worker or Cloudflare.
  app.use("/api/*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  });
  app.use("/api/*", requireAccess<Bindings>(deps.getKeyFor));

  const reply = (c: { json: (body: unknown, status?: number) => Response }, result: Result<Note>, okStatus = 200) => {
    if (result.ok) return c.json(result.value, result.created ? 201 : okStatus);
    switch (result.error) {
      case "invalid":
        return c.json({ error: result.message }, 400);
      case "not_found":
        return c.json({ error: "Not found" }, 404);
      case "conflict":
        return c.json({ error: "Changed since you read it", current: result.current }, 409);
    }
  };

  app.get("/api/me", (c) => c.json({ email: c.var.identity.email }));

  app.get("/api/notes", async (c) => c.json(await listNotes(c.env.DB)));

  app.post("/api/notes", async (c) => {
    const body = await readJson(c.req.raw);
    if (!body) return c.json({ error: "Body must be a JSON object" }, 400);
    return reply(c, await createNote(c.env.DB, body, "pwa"));
  });

  app.patch("/api/notes/:id", async (c) => {
    const body = await readJson(c.req.raw);
    if (!body) return c.json({ error: "Body must be a JSON object" }, 400);
    return reply(c, await updateNote(c.env.DB, c.req.param("id"), body, "pwa"));
  });

  app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

  // Anything else is a static file (normally served before the Worker runs; this is the fallback).
  app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

  app.onError((error, c) => {
    console.error(error);
    return c.json({ error: "Internal error" }, 500);
  });

  return app;
}
