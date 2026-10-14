import { expect, test, type Page } from "@playwright/test";
import { totp } from "../src/server/auth/totp";
import { db, latestCode, uniqueEmail, uniquePhone } from "./db";

const PASSWORD = "sunny-kigali-hills-at-dawn";

async function signUp(page: Page, email: string, phone: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("Test Applicant");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify$/);
}

async function verifyContacts(page: Page, email: string, phone: string) {
  const emailCard = page.getByTestId("verify-email");
  await emailCard.getByLabel("6-digit code").fill(await latestCode(email, "emailVerify"));
  await emailCard.getByRole("button", { name: "Verify" }).click();
  await expect(emailCard.getByText("Verified")).toBeVisible();

  const phoneCard = page.getByTestId("verify-phone");
  await phoneCard.getByLabel("6-digit code").fill(await latestCode(phone, "phoneVerify"));
  await phoneCard.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
}

test.afterAll(async () => {
  await db.$disconnect();
});

test("sign up, verify contacts, enable an authenticator app and sign in with two steps", async ({
  page,
}) => {
  const email = uniqueEmail("totp");
  const phone = uniquePhone();
  await signUp(page, email, phone);
  await verifyContacts(page, email, phone);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Hello, Test");

  // Enable the authenticator app from Security settings.
  await page.goto("/settings/security");
  await page.getByTestId("mfa-totp").getByRole("button", { name: "Set up" }).click();
  const secret = await page.getByTestId("totp-secret").getAttribute("data-secret");
  expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  await page.getByLabel(/Enter the 6-digit code/).fill(totp(secret!));
  await page.getByRole("button", { name: "Confirm" }).click();

  const codes = page.getByTestId("recovery-codes");
  await expect(codes.getByRole("listitem")).toHaveCount(10);
  const recoveryCode = (await codes.getByRole("listitem").first().textContent())!.trim();
  await page.getByRole("button", { name: "I have saved my codes" }).click();
  await expect(page.getByTestId("mfa-totp").getByText("Preferred")).toBeVisible();

  // Sign out, then sign back in: password, then the authenticator code.
  await signOut(page);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/sign-in\/two-step/);
  await page.getByLabel("Verification code").fill("000000");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText("That code isn't right")).toBeVisible();
  await page.getByLabel("Verification code").fill(totp(secret!, Date.now() + 30_000));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // A recovery code also works as the second step.
  await signOut(page);
  await signIn(page, email);
  await page.getByRole("button", { name: "Try another way" }).click();
  await page.getByRole("button", { name: "Use a recovery code" }).click();
  await page.getByLabel("Recovery code").fill(recoveryCode);
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("text-message two-step as the preferred method", async ({ page }) => {
  const email = uniqueEmail("sms");
  const phone = uniquePhone();
  await signUp(page, email, phone);
  await verifyContacts(page, email, phone);

  await page.goto("/settings/security");
  await page.getByTestId("mfa-sms").getByRole("button", { name: "Set up" }).click();
  await page.getByRole("button", { name: "Send code" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Text message")
    .fill(await latestCode(phone, "mfaEnrolCode"));
  await page.getByRole("dialog").getByRole("button", { name: "Set up" }).click();
  await page.getByRole("button", { name: "I have saved my codes" }).click();

  await signOut(page);
  await signIn(page, email);
  await expect(page.getByText(/We sent a 6-digit code to \+250/)).toBeVisible();
  await page.getByLabel("Verification code").fill(await latestCode(phone, "mfaLoginCode"));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("rejects a wrong password with a generic message", async ({ page }) => {
  await signIn(page, "applicant@demo.rebp.rw", "definitely-not-the-password");
  await expect(page.getByText("The email or password is incorrect.")).toBeVisible();
});

test("password reset through an emailed code", async ({ page }) => {
  const email = uniqueEmail("reset");
  const phone = uniquePhone();
  await signUp(page, email, phone);
  await verifyContacts(page, email, phone);
  await signOut(page);

  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send reset code" }).click();
  await expect(page).toHaveURL(/\/reset-password/);
  await page.getByLabel("Reset code").fill(await latestCode(email, "passwordReset"));
  await page.getByLabel("New password", { exact: true }).fill("a-brand-new-passphrase");
  await page.getByLabel("Confirm new password").fill("a-brand-new-passphrase");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByText("Password updated")).toBeVisible();

  await signIn(page, email, "a-brand-new-passphrase");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("protected pages redirect to sign-in and return afterwards", async ({ page }) => {
  await page.goto("/settings/security");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fsettings%2Fsecurity/);
  await page.getByLabel("Email address").fill("applicant@demo.rebp.rw");
  await page.getByLabel("Password", { exact: true }).fill("Rebp-Demo-Pilot-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/security$/);

  // Applicants cannot reach the back office.
  await page.goto("/backoffice");
  await expect(page).toHaveURL(/\/forbidden$/);
});

test("staff must set up two-step before using the back office", async ({ page }) => {
  await db.user.update({
    where: { email: "officer@demo.rebp.rw" },
    data: { mfaMethods: [], mfaPreferred: null, totpSecretEnc: null },
  });
  await signIn(page, "officer@demo.rebp.rw", "Rebp-Demo-Pilot-2026");
  // Sign-in lands on the dashboard, whose guard forces mandatory two-step setup first.
  await expect(page).toHaveURL(/\/settings\/security\?setup=required/);
  await page.goto("/backoffice");
  await expect(page).toHaveURL(/\/settings\/security\?setup=required/);
  await expect(page.getByText("Your role requires two-step verification").first()).toBeVisible();

  await page.getByTestId("mfa-email").getByRole("button", { name: "Set up" }).click();
  await page.getByRole("button", { name: "Send code" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Email")
    .fill(await latestCode("officer@demo.rebp.rw", "mfaEnrolCode"));
  await page.getByRole("dialog").getByRole("button", { name: "Set up" }).click();
  await page.getByRole("button", { name: "I have saved my codes" }).click();

  await page.goto("/backoffice");
  await expect(page.getByRole("heading", { level: 1, name: "Back office" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Work queue" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Decisions" })).toHaveCount(0);
});
