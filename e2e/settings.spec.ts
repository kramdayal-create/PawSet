import { test, expect } from "@playwright/test";

/**
 * Changing the profile name in Settings must actually persist (it previously
 * no-op'd in demo mode) and flow through to the dashboard greeting.
 */

const TAG = process.env.RUN_TAG!;
const name = `Kavi ${TAG}`;

test("changing the profile name persists and updates the greeting", async ({ page }) => {
  await page.goto("/dashboard/settings");
  await page.getByLabel("Full name").fill(name);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();

  // Reload from scratch — the value must come back from the database.
  await page.goto("/dashboard/settings");
  await expect(page.getByLabel("Full name")).toHaveValue(name);

  // The dashboard greeting uses the first name from the same profile.
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /Kavi/ })).toBeVisible();

  // Restore the demo name so the shared account is left as we found it.
  await page.goto("/dashboard/settings");
  await page.getByLabel("Full name").fill("Demo");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();
});
