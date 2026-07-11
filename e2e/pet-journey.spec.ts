import { test, expect } from "@playwright/test";

/**
 * True end-to-end journey against the live (demo-mode) database:
 * add a companion → save their routine → add a trusted contact →
 * write a care plan → create a share link → open the public guide.
 *
 * Everything created is tagged with RUN_TAG so global-teardown can
 * remove it afterwards.
 */

const TAG = process.env.RUN_TAG!;
const petName = `Biscuit ${TAG}`;
const contactName = `Sarah ${TAG}`;

test.describe.configure({ mode: "serial" });

test("add a companion, then see it on the dashboard", async ({ page }) => {
  await page.goto("/dashboard/pets/new");
  await page.getByLabel("Pet name *").fill(petName);
  await page.getByLabel("Species *").selectOption("dog");
  await page.getByLabel("Breed / type").fill("Beagle");
  await page.getByLabel("Age").fill("3 years old");
  await page.getByRole("button", { name: "Save pet" }).click();

  // Redirects to the new pet's page (subtitle joins breed · species · age).
  await expect(page.getByRole("heading", { name: petName })).toBeVisible();
  await expect(page.getByText("Beagle · dog · 3 years old")).toBeVisible();

  // And it shows up in the family list.
  await page.goto("/dashboard/pets");
  await expect(page.getByText(petName)).toBeVisible();
});

test("save the pet's routine and see it persist", async ({ page }) => {
  await page.goto("/dashboard/pets");
  await page.getByText(petName).click();
  // Exact match: the overview quick-links also link to ?tab=routine ("Daily routine").
  await page.getByRole("link", { name: "Routine", exact: true }).click();

  await page.getByLabel("Feeding schedule").fill("Morning 7am, Evening 6pm");
  await page.getByLabel("Food brand / type").fill("Royal Canin Adult");
  await page.getByRole("button", { name: "Save routine" }).click();

  await expect(page.getByText("Changes saved successfully.")).toBeVisible();

  // Reload from scratch so we assert the value came back from the database,
  // not a form input that simply kept what we typed.
  await page.goto("/dashboard/pets");
  await page.getByText(petName).click();
  await page.getByRole("link", { name: "Routine", exact: true }).click();
  await expect(page.getByLabel("Feeding schedule")).toHaveValue("Morning 7am, Evening 6pm");
});

test("add a trusted contact", async ({ page }) => {
  // ?add=1 forces the contact form open (it's otherwise hidden when contacts exist).
  await page.goto("/dashboard/contacts?add=1");
  await page.getByLabel("Name *").fill(contactName);
  await page.getByLabel("Phone").fill("07700 900123");
  await page.getByText("Can be contacted in an emergency").click();
  await page.getByRole("button", { name: /Add contact|Save contact/ }).click();

  await expect(page.getByText(contactName)).toBeVisible();
});

test("write a care plan", async ({ page }) => {
  await page.goto("/dashboard/emergency-plan");
  await page
    .getByLabel("General emergency instructions")
    .fill(`Please call ${contactName} first. Biscuit is microchipped.`);
  await page.getByRole("button", { name: "Save emergency plan" }).click();

  await expect(page.getByText("Care plan saved.")).toBeVisible();
});

test("create a share link and open the public care guide", async ({ page, context }) => {
  await page.goto("/dashboard/pets");
  await page.getByText(petName).click();
  // Exact match: the overview quick-links also link to ?tab=share ("Share & print").
  await page.getByRole("link", { name: "Share", exact: true }).click();

  await page.getByLabel("Link title (optional)").fill(`Weekend care — ${TAG}`);
  // Don't rely on the default checked state — explicitly include the routine
  // so the public guide is guaranteed to show it.
  await page.getByRole("checkbox", { name: "Daily routine" }).check();
  await page.getByRole("button", { name: "Create share link" }).click();

  // Confirmation appears (this is the flow that used to fail on base64url).
  await expect(page.getByText("Share link created!")).toBeVisible();

  // Open the public guide in a new tab.
  const [guide] = await Promise.all([
    context.waitForEvent("page"),
    page.getByRole("button", { name: "Preview link" }).click(),
  ]);
  await guide.waitForLoadState("domcontentloaded");
  await expect(guide.getByRole("heading", { name: /Care Guide|Weekend care/ })).toBeVisible();
  // The routine section rendered means include_routine took effect end-to-end.
  await expect(guide.getByRole("heading", { name: "Daily Routine" })).toBeVisible();
  await expect(guide.getByText("Morning 7am, Evening 6pm")).toBeVisible();
});

test("printable sitter guide and emergency card render standalone", async ({ page }) => {
  await page.goto("/dashboard/pets");
  await page.getByText(petName).click();
  await expect(page).toHaveURL(/\/dashboard\/pets\/[0-9a-f-]+/);
  const petId = page.url().match(/pets\/([0-9a-f-]+)/)![1];

  // Sitter guide: standalone page (no app sidebar), with populated basics + routine.
  await page.goto(`/guide/${petId}`);
  await expect(page.getByRole("heading", { name: /Care Guide/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Basic details" })).toBeVisible();
  await expect(page.getByText("Morning 7am, Evening 6pm")).toBeVisible();
  // The dashboard sidebar must not bleed into the print view.
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0);

  // Emergency card: standalone, shows the owner and the emergency contact.
  await page.goto(`/emergency-card/${petId}`);
  await expect(page.getByText(/Emergency Card/)).toBeVisible();
  await expect(page.getByText("Pet owner")).toBeVisible();
  await expect(page.getByText(contactName)).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
});
