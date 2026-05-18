import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const storeFile = join(process.cwd(), "test-results", "e2e-people.json");

async function resetStore() {
  await mkdir(dirname(storeFile), { recursive: true });
  await writeFile(storeFile, "[]\n", "utf8");
}

function cardEmail(page: Page, email: string) {
  return page.locator(`[title="${email}"]`);
}

async function openCardMenu(page: Page, email: string) {
  await page.getByLabel(`Open menu for ${email}`).focus();
  await page.keyboard.press("Enter");
}

async function addPerson(
  page: Page,
  input: { email: string; name?: string; step?: string },
) {
  await page.getByRole("button", { name: /Add person/ }).first().click();
  await page.getByLabel("Email").fill(input.email);
  if (input.name) await page.getByLabel(/Name/).fill(input.name);
  if (input.step) await page.getByLabel("Workflow step").selectOption(input.step);
  await page.getByRole("button", { name: "Add person" }).click();
}

test.beforeEach(async () => {
  await resetStore();
});

test("tracks people through the workflow", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("No one in the pipeline yet")).toBeVisible();
  await addPerson(page, {
    email: "alice@example.com",
    name: "Alice Candidate",
  });
  await expect(cardEmail(page, "alice@example.com")).toBeVisible();

  await addPerson(page, {
    email: "bob@example.com",
    name: "Bob Candidate",
    step: "interview",
  });
  await expect(page.getByText("2 people across 6 stages")).toBeVisible();

  await addPerson(page, { email: "ALICE@example.com" });
  await expect(page.getByText("A person with that email already exists")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.getByLabel("Search people").fill("bob");
  await expect(cardEmail(page, "bob@example.com")).toBeVisible();
  await expect(cardEmail(page, "alice@example.com")).toBeHidden();
  await page.getByLabel("Clear search").click();
  await expect(cardEmail(page, "alice@example.com")).toBeVisible();

  await openCardMenu(page, "alice@example.com");
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await page.getByLabel("Email").fill("alicia@example.com");
  await page.getByLabel(/Name/).fill("Alicia Candidate");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(cardEmail(page, "alicia@example.com")).toBeVisible();
  await expect(page.getByText("Alicia Candidate")).toBeVisible();

  await openCardMenu(page, "alicia@example.com");
  await page.getByRole("menuitem", { name: "Move to" }).hover();
  await page.getByRole("menuitem", { name: "Background Check" }).click();
  await expect(page.getByText("Moved to Background Check")).toBeVisible();

  await page.getByLabel("Select alicia@example.com").click();
  await page.getByLabel("Select bob@example.com").click();
  await expect(page.getByText("2 selected")).toBeVisible();
  await page.getByRole("button", { name: /Move to/ }).click();
  await page.getByRole("menuitem", { name: "Gmail Creation" }).click();
  await expect(page.getByText("Moved 2 to Gmail Creation")).toBeVisible();
  await expect(page.getByText("2 selected")).toBeHidden();

  await page.getByLabel("Select bob@example.com").click();
  await page.getByRole("button", { name: /Delete/ }).click();
  await expect(page.getByText("Removed 1 people")).toBeVisible();
  await expect(cardEmail(page, "bob@example.com")).toBeHidden();

  await page.reload();
  await expect(cardEmail(page, "alicia@example.com")).toBeVisible();
  await expect(cardEmail(page, "bob@example.com")).toBeHidden();
});
