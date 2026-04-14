import { expect, test } from "@playwright/test";
import { addSupabaseSessionCookies } from "./supabase-auth-cookies";

/**
 * Full flow: manager creates event + menu + tables → waiter places order → kitchen advances status.
 * Requires a Supabase user with role **manager** (managers can use waiter and kitchen routes too).
 *
 * Set in `.env.local` (not committed):
 *   E2E_EMAIL=...
 *   E2E_PASSWORD=...
 * Plus normal `NEXT_PUBLIC_SUPABASE_*` vars (used to mint session cookies in Node).
 */
test("manager → waiter → kitchen happy path", async ({ page, context }) => {
  test.setTimeout(300_000);

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.error("[browser console]", msg.text());
    }
  });
  page.on("requestfailed", (req) => {
    console.error("[request failed]", req.url(), req.failure()?.errorText);
  });

  test.skip(
    !process.env.E2E_EMAIL?.trim() || !process.env.E2E_PASSWORD,
    "Set E2E_EMAIL and E2E_PASSWORD in .env.local (manager account).",
  );
  test.skip(
    !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );

  await addSupabaseSessionCookies(context, {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    email: process.env.E2E_EMAIL!.trim(),
    password: process.env.E2E_PASSWORD!,
  });

  const suffix = Date.now();
  const eventName = `E2E Smoke ${suffix}`;
  const dishLabel = `E2E Main ${suffix}`;

  await page.goto("/manager", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/manager/);

  await page.goto("/manager/events/new", { waitUntil: "load" });
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { webpackChunk_N_E?: unknown[] }).webpackChunk_N_E !== "undefined",
    { timeout: 60_000 },
  );
  await page.waitForTimeout(3000);

  await page.locator('input[name="name"]').fill(eventName);
  await expect(page.locator('input[name="name"]')).toHaveValue(eventName);
  await page.locator('input[name="room_location"]').fill("E2E Room");
  await expect(page.locator('input[name="room_location"]')).toHaveValue("E2E Room");
  await page.locator('input[name="event_date"]').fill("2030-06-20T18:00");
  await expect(page.locator('input[name="event_date"]')).toHaveValue("2030-06-20T18:00");

  await page.getByRole("button", { name: "Create event" }).click();
  try {
    await page.waitForURL(/\/manager\/events\/[0-9a-f-]+$/i, { timeout: 120_000 });
  } catch {
    const msg =
      (await page.locator("form .rounded-md.bg-red-50, form [class*='red-50']").first().textContent()) ??
      (await page.locator('[role="alert"]').first().textContent());
    throw new Error(`Did not navigate to new event. ${msg ? `UI: ${msg}` : "No error banner found."}`);
  }

  const eventUrl = page.url();
  const eventIdMatch = eventUrl.match(/events\/([0-9a-f-]+)/i);
  expect(eventIdMatch?.[1]).toBeTruthy();
  const eventId = eventIdMatch![1];

  const mainSection = page
    .locator("div")
    .filter({ has: page.getByRole("heading", { name: /Main course/i }) });
  await mainSection.getByPlaceholder("e.g. Soup").fill(dishLabel);
  await mainSection.getByRole("button", { name: "Add" }).click();
  await expect(mainSection.getByText(dishLabel)).toBeVisible({ timeout: 30_000 });

  await page.getByLabel("Number of tables").fill("1");
  await page.getByLabel("Seats per table").fill("4");
  await page.getByRole("button", { name: "Generate tables" }).click();
  await expect(page.getByText("Table 1", { exact: false }).first()).toBeVisible({ timeout: 30_000 });

  await page.goto(`/waiter/${eventId}`);
  await page.getByRole("link", { name: new RegExp(eventName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();
  await page.getByRole("link", { name: /Table 1/ }).click();
  await page.getByRole("button", { name: "Seat 1" }).click();
  await expect(page.getByRole("heading", { name: /Seat 1/ })).toBeVisible();
  await page.getByRole("button", { name: "Send to kitchen" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Seat 1" })).toContainText("Mn:", { timeout: 30_000 });

  await page.goto(`/kitchen/${eventId}`);
  await expect(page.getByRole("button", { name: "Cooked" }).first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Cooked" }).first().click();
  await expect(page.getByRole("button", { name: "Served" }).first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Served" }).first().click();
  await expect(page.getByRole("button", { name: "Cooked" })).toHaveCount(0, { timeout: 30_000 });
});
