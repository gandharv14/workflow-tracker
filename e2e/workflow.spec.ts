import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const storeFile = join(process.cwd(), "test-results", "e2e-people.json");

async function resetStore() {
  await mkdir(dirname(storeFile), { recursive: true });
  await writeFile(storeFile, "[]\n", "utf8");
}

async function readStorePeople() {
  return JSON.parse(await readFile(storeFile, "utf8")) as Array<{
    email: string;
    name?: string;
    step: string;
  }>;
}

function cardEmail(page: Page, email: string) {
  return page.locator(`[title="${email}"]`);
}

async function openCardMenu(page: Page, email: string) {
  await page.getByLabel(`Open menu for ${email}`).click();
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

  await page.getByLabel("Search people").fill("alice");
  await addPerson(page, {
    email: "charlie@example.com",
    name: "Charlie Candidate",
  });
  await expect(cardEmail(page, "charlie@example.com")).toBeVisible();
  await expect(page.getByLabel("Search people")).toHaveValue("");

  await addPerson(page, {
    email: "bob@example.com",
    name: "Bob Candidate",
    step: "background_check",
  });
  await expect(page.getByText("3 people across 4 stages")).toBeVisible();

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
  await page
    .getByRole("menuitem", { name: "Background Check + Gmail Creation" })
    .click();
  await expect(
    page.getByText("Moved to Background Check + Gmail Creation"),
  ).toBeVisible();

  await page.getByLabel("Select alicia@example.com").click();
  await page.getByLabel("Select bob@example.com").click();
  await expect(page.getByText("2 selected")).toBeVisible();
  await page.getByRole("button", { name: /Move to/ }).click();
  await page
    .getByRole("menuitem", { name: "Background Check + Gmail Creation" })
    .click();
  await expect(
    page.getByText("Moved 2 to Background Check + Gmail Creation"),
  ).toBeVisible();
  await expect(page.getByText("2 selected")).toBeHidden();

  await page.getByLabel("Select bob@example.com").click();
  await page.getByRole("button", { name: /Delete/ }).click();
  await expect(page.getByText("Removed 1 people")).toBeVisible();
  await expect(cardEmail(page, "bob@example.com")).toBeHidden();

  await page.reload();
  await expect(cardEmail(page, "alicia@example.com")).toBeVisible();
  await expect(cardEmail(page, "bob@example.com")).toBeHidden();
});

test("recreates a deleted person, moves the new record, and persists after reload", async ({
  page,
}) => {
  await page.goto("/");

  await addPerson(page, {
    email: "recreate@example.com",
    name: "Original Candidate",
  });
  await expect(cardEmail(page, "recreate@example.com")).toBeVisible();

  await openCardMenu(page, "recreate@example.com");
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByText("Removed recreate@example.com")).toBeVisible();
  await expect(cardEmail(page, "recreate@example.com")).toBeHidden();

  await addPerson(page, {
    email: "recreate@example.com",
    name: "Recreated Candidate",
  });
  await expect(cardEmail(page, "recreate@example.com")).toBeVisible();
  await expect(page.getByText("Recreated Candidate")).toBeVisible();

  await openCardMenu(page, "recreate@example.com");
  await page.getByRole("menuitem", { name: "Move to" }).hover();
  await page.getByRole("menuitem", { name: "Sent Contracts" }).click();
  await expect(page.getByText("Moved to Sent Contracts")).toBeVisible();

  await page.reload();
  await expect(cardEmail(page, "recreate@example.com")).toBeVisible();
  await expect(page.getByText("Recreated Candidate")).toBeVisible();

  const persisted = await readStorePeople();
  expect(persisted).toHaveLength(1);
  expect(persisted[0]).toMatchObject({
    email: "recreate@example.com",
    name: "Recreated Candidate",
    step: "sent_contracts",
  });
});
