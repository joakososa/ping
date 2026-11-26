import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          TEAM_DOMAIN: "test-team.cloudflareaccess.com",
          POLICY_AUD: "test-aud",
          ALLOWED_EMAIL: "joaquin@example.com",
        },
      },
    }),
  ],
});
