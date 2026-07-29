import { expect, type Page } from "@playwright/test";

export const E2E_PASSWORD = "E2ePass123!";

export const smokeUsers = {
  admin: {
    username: "deniz",
    password: E2E_PASSWORD,
  },
  requester: {
    username: "requester.demo",
    password: E2E_PASSWORD,
  },
  approver: {
    username: "idari.mali.manager",
    password: E2E_PASSWORD,
  },
  technician: {
    username: "technician.demo",
    password: E2E_PASSWORD,
  },
} as const;

export async function login(page: Page, user: { username: string; password: string }) {
  await page.goto("/login");
  await page.getByTestId("login-username").fill(user.username);
  await page.getByTestId("login-password").fill(user.password);
  const loginResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/cookie-token/") &&
      response.status() === 200
  );
  await page.getByTestId("login-submit").click();
  await loginResponse;
}

export async function expectOperationalShell(page: Page) {
  await expect(page.getByTestId("app-shell")).toBeVisible();
}

export async function expectPortalShell(page: Page) {
  await expect(page.getByTestId("portal-shell")).toBeVisible();
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: /çıkış|cikis/i }).click();
  await expect(page.getByTestId("login-submit")).toBeVisible();
}
