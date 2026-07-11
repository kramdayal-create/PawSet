import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("renders the hero, CTAs and key sections with no runtime errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/");

    await expect(page.locator("h1").first()).toContainText("loving hands");
    await expect(page.getByText("for the ones who love you back")).toBeVisible();
    await expect(page.getByText("Made with love").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "How it works" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Everything their carer needs" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Go with a light heart" })).toBeVisible();

    // Primary CTAs point at signup; nav sign-in at login.
    await expect(page.locator('a[href="/signup"]').first()).toBeVisible();
    await expect(page.locator('a[href="/login"]').first()).toBeVisible();

    expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
  });
});
