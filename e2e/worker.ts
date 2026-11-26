// TEST-ONLY Worker for the browser tests. Never deployed: it is only referenced by e2e/wrangler.jsonc, which has
// no routes and no workers.dev URL.
//
// It runs the real app (src/app.ts) but plays the role of Cloudflare Access: it signs a token with a local key and
// adds it to every request, so the PWA can be driven end to end without a real Access login.

import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { createApp, type Bindings } from "../src/app";

let ready: Promise<{ app: ReturnType<typeof createApp>; token: string }> | null = null;

async function init(env: Bindings) {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const jwk = { ...(await exportJWK(publicKey)), kid: "e2e", alg: "RS256" };
  const token = await new SignJWT({ email: env.ALLOWED_EMAIL })
    .setProtectedHeader({ alg: "RS256", kid: "e2e" })
    .setIssuer(`https://${env.TEAM_DOMAIN}`)
    .setAudience(env.POLICY_AUD ?? "")
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(privateKey);
  return { app: createApp({ getKeyFor: () => createLocalJWKSet({ keys: [jwk] }) }), token };
}

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
    ready ??= init(env);
    const { app, token } = await ready;
    const withAccess = new Request(request);
    withAccess.headers.set("Cf-Access-Jwt-Assertion", token);
    return app.fetch(withAccess, env, ctx);
  },
};
