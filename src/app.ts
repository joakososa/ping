import { Hono } from "hono";
import type { JWTVerifyGetKey } from "jose";
import { requireAccess, type AccessBindings, type AccessIdentity } from "./core/access";

export interface Bindings extends AccessBindings {
  DB: D1Database;
  ASSETS: Fetcher;
}

export interface AppDeps {
  /** Where Access public keys come from. Production: the team's JWKS URL. Tests: a local key set. */
  getKeyFor: (env: Bindings) => JWTVerifyGetKey;
}

export type AppEnv = { Bindings: Bindings; Variables: { identity: AccessIdentity } };

export function createApp(deps: AppDeps) {
  const app = new Hono<AppEnv>();

  // Every /api response is private and must never be cached by the browser, the service worker or Cloudflare.
  app.use("/api/*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  });
  app.use("/api/*", requireAccess<Bindings>(deps.getKeyFor));

  app.get("/api/yo", (c) => c.json({ email: c.var.identity.email }));

  app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

  // Anything else is a static file (normally served before the Worker runs; this is the fallback).
  app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

  app.onError((error, c) => {
    console.error(error);
    return c.json({ error: "Internal error" }, 500);
  });

  return app;
}
