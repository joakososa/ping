// Spec: docs/specs/pwa.md (PWA-*). Runs against the TEST-ONLY server (e2e/worker.ts).

import { expect, test, type Page } from "@playwright/test";

const unique = (label: string) => `${label} ${Math.random().toString(36).slice(2, 8)}`;
const note = (page: Page, text: string) => page.locator(".note", { hasText: text });

async function addNote(page: Page, text: string) {
  await page.getByLabel("Nueva nota").fill(text);
  await page.getByRole("button", { name: "Anotar" }).click();
}

async function open(page: Page) {
  await page.goto("/");
  await expect(page.locator("#who")).toHaveText("joaquin@example.com");
}

test("PWA-01 has what Chrome needs to offer installing it", async ({ page, request }) => {
  await open(page);
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifest = await (await request.get(manifestHref!)).json();
  expect(manifest).toMatchObject({ name: "Ping", display: "standalone", start_url: "/" });
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()))).toBe(true);
});

test("PWA-02 shows the last known notes at once, then refreshes", async ({ page }) => {
  const text = unique("guardada");
  await open(page);
  await addNote(page, text);
  await expect(note(page, text)).not.toHaveClass(/pending/);

  // Slow down the server's list: the saved copy must show before it answers.
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route("**/api/notes", async (route) => {
    await gate;
    await route.continue();
  });
  await page.reload();
  await expect(note(page, text)).toBeVisible();
  release();
  await expect(page.locator("#who")).toHaveText("joaquin@example.com");
});

test("PWA-03 refreshes when the app comes back to the front", async ({ page, request }) => {
  await open(page);
  const text = unique("desde otro lado");
  expect((await request.post("/api/notes", { data: { text } })).status()).toBe(201);
  await expect(note(page, text)).toHaveCount(0);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(note(page, text)).toBeVisible();
});

test("PWA-04 shows a new note at once, pending until the server confirms", async ({ page }) => {
  await open(page);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route("**/api/notes", async (route) => {
    if (route.request().method() === "POST") await gate;
    await route.continue();
  });
  const text = unique("nueva");
  await addNote(page, text);
  await expect(note(page, text)).toContainText("Pendiente de envío");
  release();
  await expect(note(page, text)).not.toContainText("Pendiente de envío");
});

test("PWA-05 keeps notes written offline and sends them when back online", async ({ page, context, request }) => {
  await open(page);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const text = unique("sin señal");

  await context.setOffline(true);
  await addNote(page, text);
  await expect(note(page, text)).toContainText("Pendiente de envío");
  await expect(page.locator("#notice")).toContainText("Sin conexión");

  await page.reload(); // still offline: the service worker serves the app
  await expect(note(page, text)).toContainText("Pendiente de envío");

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(note(page, text)).not.toContainText("Pendiente de envío");
  const onServer = await (await request.get("/api/notes")).json();
  expect(onServer.map((n: { text: string }) => n.text)).toContain(text);
});

test("PWA-06 refuses to overwrite a note changed elsewhere and shows the current one", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  const text = unique("original");
  await open(a);
  await addNote(a, text);
  await expect(note(a, text)).not.toHaveClass(/pending/);
  await open(b);

  // A edits first.
  await note(a, text).getByRole("button", { name: "Editar" }).click();
  await a.getByLabel("Editar nota").fill(`${text} (A)`);
  await a.getByRole("button", { name: "Guardar" }).click();
  await expect(note(a, `${text} (A)`)).toBeVisible();

  // B still has version 1 and tries to edit.
  await note(b, text).getByRole("button", { name: "Editar" }).click();
  await b.getByLabel("Editar nota").fill(`${text} (B)`);
  await b.getByRole("button", { name: "Guardar" }).click();
  await expect(b.locator("#notice")).toContainText("cambió mientras la tenías abierta");
  await expect(note(b, `${text} (A)`)).toBeVisible();
  await expect(note(b, `${text} (B)`)).toHaveCount(0);
});

test("PWA-07 deleting needs two taps", async ({ page }) => {
  const text = unique("para borrar");
  await open(page);
  await addNote(page, text);
  await expect(note(page, text)).not.toHaveClass(/pending/);

  const del = note(page, text).getByRole("button", { name: "Borrar" });
  await del.click();
  await expect(note(page, text).getByRole("button", { name: "¿Seguro?" })).toBeVisible();
  await expect(note(page, text)).toBeVisible();
  await note(page, text).getByRole("button", { name: "¿Seguro?" }).click();
  await expect(note(page, text)).toHaveCount(0);
});

test("PWA-08 an expired session offers to log in again", async ({ page }) => {
  await open(page);
  // What Access does when the session expired: redirect API calls to its login page.
  await page.route("**/api/**", (route) =>
    route.fulfill({ status: 302, headers: { Location: "https://e2e.cloudflareaccess.com/cdn-cgi/access/login" } }),
  );
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.locator("#notice")).toContainText("Tu sesión venció");
  await expect(page.getByRole("button", { name: "Entrar de nuevo" })).toBeVisible();
});

test("PWA-09 the service worker never stores API responses", async ({ page }) => {
  await open(page);
  await addNote(page, unique("cache"));
  await page.reload();
  await expect(page.locator("#who")).toHaveText("joaquin@example.com");
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const req of await (await caches.open(name)).keys()) urls.push(new URL(req.url).pathname);
    }
    return urls;
  });
  expect(cached.length).toBeGreaterThan(0);
  expect(cached.filter((path) => path.startsWith("/api/"))).toEqual([]);
});

test("PWA-10 is in Spanish, fits 360 px and has a dark mode", async ({ browser }) => {
  const light = await (await browser.newContext({ viewport: { width: 360, height: 740 }, colorScheme: "light" })).newPage();
  await open(light);
  expect(await light.locator("html").getAttribute("lang")).toBe("es");
  await expect(light.getByRole("button", { name: "Anotar" })).toBeVisible();
  expect(await light.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  const dark = await (await browser.newContext({ viewport: { width: 360, height: 740 }, colorScheme: "dark" })).newPage();
  await open(dark);
  const bg = (p: Page) => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(await bg(dark)).not.toBe(await bg(light));
});
