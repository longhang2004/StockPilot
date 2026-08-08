import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

async function signup(page: Page, email: string, name: string) {
  await page.goto('/signup');
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password').fill('PlaywrightPass1!');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/create-workspace/);
}

test.describe('SaaS onboarding', () => {
  test('signup, create workspace, invite, and accept a teammate', async ({
    browser,
  }) => {
    const suffix = randomUUID().slice(0, 8);
    const ownerEmail = `owner-${suffix}@e2e.test`;
    const teammateEmail = `teammate-${suffix}@e2e.test`;

    // 1. Signup and create the workspace.
    const ownerContext: BrowserContext = await browser.newContext({
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const ownerPage = await ownerContext.newPage();
    await signup(ownerPage, ownerEmail, 'Owner E2E');
    await ownerPage
      .getByLabel('Workspace name')
      .fill(`E2E Wholesale ${suffix}`);
    await ownerPage.getByRole('button', { name: 'Create workspace' }).click();
    await expect(ownerPage).toHaveURL(/\/app/);
    await expect(
      ownerPage.getByRole('heading', { name: /operations overview/i }),
    ).toBeVisible();

    // 2. The Owner invites a Manager and copies the invite link.
    await ownerPage.goto('/app/settings');
    await ownerPage.getByLabel('Email').fill(teammateEmail);
    await ownerPage.getByLabel('Role', { exact: true }).selectOption('MANAGER');
    await ownerPage.getByRole('button', { name: 'Invite teammate' }).click();
    await expect(
      ownerPage.getByRole('heading', { name: 'Pending invitations' }),
    ).toBeVisible();
    await expect(
      ownerPage.getByText(teammateEmail, { exact: true }),
    ).toBeVisible();
    await ownerPage.getByRole('button', { name: 'Copy invite link' }).click();
    const inviteLink = await ownerPage.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(inviteLink).toContain('/invitations/accept?token=');
    const token = new URL(inviteLink).searchParams.get('token');
    expect(token).toBeTruthy();

    // 3. The teammate signs up and accepts the invitation link.
    const teammateContext: BrowserContext = await browser.newContext();
    const teammatePage = await teammateContext.newPage();
    await signup(teammatePage, teammateEmail, 'Teammate E2E');
    await teammatePage.goto(
      `/invitations/accept?token=${encodeURIComponent(token!)}`,
    );
    await expect(teammatePage).toHaveURL(/\/app/);
    // The accepted teammate lands in the shared workspace's overview (the
    // sidebar identity block is collapsed on the mobile project).
    await expect(
      teammatePage.getByRole('heading', { name: /operations overview/i }),
    ).toBeVisible();

    // 4. The Owner sees the accepted member on the team screen.
    await ownerPage.goto('/app/settings');
    await expect(ownerPage.getByText(teammateEmail)).toBeVisible();

    await ownerContext.close();
    await teammateContext.close();
  });

  test('a rejected duplicate signup shows a friendly message', async ({
    page,
  }) => {
    const suffix = randomUUID().slice(0, 8);
    const email = `dup-${suffix}@e2e.test`;
    await signup(page, email, 'Duplicate User');
    await page.goto('/signup');
    await page.getByLabel('Full name').fill('Duplicate User');
    await page.getByLabel('Work email').fill(email);
    await page.getByLabel('Password').fill('PlaywrightPass1!');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText(/already exists/i)).toBeVisible();
  });
});
