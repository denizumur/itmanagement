import { expect, test } from "@playwright/test";
import { expectXlsxDownload } from "./helpers/download";
import {
  expectOperationalShell,
  expectPortalShell,
  E2E_PASSWORD,
  login,
  logout,
  smokeUsers,
} from "./helpers/auth";

const backendUrl = process.env.E2E_BACKEND_URL ?? "http://localhost:8000";
const backendErrorsByPage = new WeakMap<object, string[]>();

test.beforeEach(async ({ page }) => {
  const backendErrors: string[] = [];
  backendErrorsByPage.set(page, backendErrors);

  page.on("response", (response) => {
    const url = response.url();
    const status = response.status();

    if (url.startsWith(backendUrl) && status >= 500) {
      backendErrors.push(`Unexpected backend ${status}: ${url}`);
    }
  });
});

test.afterEach(async ({ page }) => {
  expect(backendErrorsByPage.get(page) ?? []).toEqual([]);
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
    "/admin-console",
    "/tickets",
  ]) {
    await page.goto(path);
    await expectOperationalShell(page);
  }

  await page.goto("/admin-console");
  await expect(page.getByTestId("admin-console-page")).toBeVisible();
  await expect(page.getByTestId("admin-console-backup-status")).toBeVisible();
  await expect(page.getByTestId("admin-console-backup-guidance")).toBeVisible();
  await expect(page.getByTestId("admin-console-checklist")).toBeVisible();
  await expect(page.getByTestId("copy-backup-verify-command")).toBeVisible();
  await expect(page.getByTestId("admin-console-invitations")).toBeVisible();
  await expect(page.getByTestId("admin-console-operations")).toBeVisible();

  await page.getByRole("link", { name: /yönetim ekranına git/i }).click();
  await expect(page.getByTestId("admin-users-page")).toBeVisible();
  await expect(page.getByTestId("admin-users-table")).toBeVisible();
  await page.getByTestId("admin-users-search").fill("deniz");
  await expect(page.getByTestId("admin-users-table")).toBeVisible();
  await page
    .getByRole("button", { name: /kullanıcı detayını gör/i })
    .first()
    .click();
  await expect(page.getByTestId("admin-users-detail-drawer")).toBeVisible();
  await expect(page.getByText(/token_hash|activation_url|password/i)).toHaveCount(0);

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

test("invited inactive user can activate account and login once", async ({
  page,
  request,
}) => {
  const tokenResponse = await request.post(`${backendUrl}/api/auth/token/`, {
    data: smokeUsers.admin,
  });
  expect(tokenResponse.status()).toBe(200);
  const tokenBody = await tokenResponse.json();
  const accessToken = tokenBody.access as string;

  const employeeResponse = await request.get(
    `${backendUrl}/api/employees/table/?search=E2E%20Invite%20User`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  expect(employeeResponse.status()).toBe(200);
  const employeeBody = await employeeResponse.json();
  const inviteEmployee = employeeBody.results[0];
  expect(inviteEmployee.user).toBeTruthy();

  const invitationResponse = await request.post(
    `${backendUrl}/api/auth/invitations/`,
    {
      data: {
        user_id: inviteEmployee.user,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  expect(invitationResponse.status()).toBe(201);
  const invitationBody = await invitationResponse.json();
  const activationUrl = invitationBody.activation_url as string;
  const activationPath = new URL(activationUrl).pathname + new URL(activationUrl).search;
  const activatedPassword = `${E2E_PASSWORD}Activated!`;

  await page.goto(activationPath);
  await page.getByTestId("activate-account-password").fill(activatedPassword);
  await page.getByTestId("activate-account-password-confirm").fill(activatedPassword);
  await page.getByTestId("activate-account-submit").click();
  await expect(page.getByTestId("activate-account-success")).toBeVisible();

  await login(page, {
    username: "e2e.invite.user",
    password: activatedPassword,
  });
  await page.goto("/my-tickets");
  await expectPortalShell(page);
  await logout(page);

  await page.goto(activationPath);
  await page.getByTestId("activate-account-password").fill(`${E2E_PASSWORD}Again!`);
  await page
    .getByTestId("activate-account-password-confirm")
    .fill(`${E2E_PASSWORD}Again!`);
  await page.getByTestId("activate-account-submit").click();
  await expect(page.getByTestId("activate-account-error")).toBeVisible();
});
