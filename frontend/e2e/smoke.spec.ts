import { expect, test } from "@playwright/test";
import { expectXlsxDownload } from "./helpers/download";
import {
  expectOperationalShell,
  expectPortalShell,
  login,
  logout,
  smokeUsers,
} from "./helpers/auth";

const backendUrl = process.env.E2E_BACKEND_URL ?? "http://localhost:8000";

test.beforeEach(async ({ page }) => {
  page.on("response", (response) => {
    const url = response.url();
    const status = response.status();

    if (url.startsWith(backendUrl) && status >= 500) {
      throw new Error(`Unexpected backend ${status}: ${url}`);
    }
  });
});

test("health endpoint and login screen boot", async ({ page, request }) => {
  const healthResponse = await request.get(`${backendUrl}/api/health/`);
  expect(healthResponse.status()).toBe(200);

  await page.goto("/login");
  await expect(page.getByTestId("login-submit")).toBeVisible();
});

test("admin can login, navigate core pages, export personnel xlsx, and logout", async ({
  page,
}) => {
  await login(page, smokeUsers.admin);
  await expectOperationalShell(page);

  for (const path of [
    "/assets",
    "/personnel",
    "/licenses",
    "/maintenance",
    "/assignments",
    "/reminders",
    "/audit",
    "/tickets",
  ]) {
    await page.goto(path);
    await expectOperationalShell(page);
    await expect(page.getByText(/hata|error|500/i)).toHaveCount(0);
  }

  await page.goto("/personnel");
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("personnel-export-excel").click();
  await expectXlsxDownload(await downloadPromise);

  await logout(page);
  await page.goto("/assets");
  await expect(page.getByTestId("login-submit")).toBeVisible();
});

test("requester portal opens and ticket creation form is reachable", async ({
  page,
}) => {
  await login(page, smokeUsers.requester);
  await page.goto("/my-tickets");
  await expectPortalShell(page);

  await page.getByRole("button", { name: /talep/i }).first().click();
  await expect(page.getByText(/talep/i).first()).toBeVisible();
});

test("approver portal opens approval workspace", async ({ page }) => {
  await login(page, smokeUsers.approver);
  await page.goto("/approvals");
  await expectPortalShell(page);
  await expect(page.getByText(/onay|approval/i).first()).toBeVisible();
});

test("technician workspace opens ticket inbox", async ({ page }) => {
  await login(page, smokeUsers.technician);
  await page.goto("/tickets");
  await expectOperationalShell(page);
  await expect(page.getByTestId("ticket-inbox")).toBeVisible();
});
