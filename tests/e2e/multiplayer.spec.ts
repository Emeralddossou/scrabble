import { expect, test } from '@playwright/test';

const password = 'Scrabble!2026';

async function register(page: import('@playwright/test').Page, username: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Créer un compte' }).click();
  await page.getByLabel('Nom de joueur').fill(username);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Forger mon profil' }).click();
  await page.waitForURL('**/dashboard');
  await expect(page.getByRole('heading', { name: `Bonjour, ${username}` })).toBeVisible();
}

test('deux joueurs créent, jouent et terminent une partie libre', async ({ browser }) => {
  const suffix = `${test.info().project.name}-${Date.now()}-${test.info().workerIndex}`;
  const aliceName = `Alice-${suffix}`.slice(0, 24);
  const bobName = `Bob-${suffix}`.slice(0, 24);
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alice = await aliceContext.newPage();
  const bob = await bobContext.newPage();

  try {
    await register(alice, aliceName);
    await register(bob, bobName);

    await alice.reload();
    const bobRow = alice.locator('.player').filter({ hasText: bobName });
    await expect(bobRow).toBeVisible({ timeout: 15_000 });
    await expect(alice.getByRole('option', { name: 'Libre, durée illimitée' })).toBeAttached();
    await bobRow.getByRole('button', { name: 'Inviter' }).click();
    await expect(alice.getByText('Invitation envoyée.')).toBeVisible();

    await bob.reload();
    const receivedPanel = bob
      .getByRole('article')
      .filter({ has: bob.getByRole('heading', { name: 'Invitations reçues' }) });
    const receivedInvite = receivedPanel.locator('.invite').filter({ hasText: aliceName });
    await expect(receivedInvite).toBeVisible({ timeout: 15_000 });
    await expect(receivedInvite.getByText('Partie libre, sans limite de temps')).toBeVisible();
    await receivedInvite.getByRole('button', { name: 'Accepter' }).click();
    await bob.waitForURL(/\/game\/[a-f0-9-]+$/);
    const gameUrl = bob.url();

    await alice.goto(gameUrl);
    await expect(alice.getByRole('heading', { name: 'À vous de composer' })).toBeVisible();
    await alice.getByRole('button', { name: 'Passer' }).click();

    await bob.reload();
    await expect(bob.getByRole('heading', { name: 'À vous de composer' })).toBeVisible({
      timeout: 10_000,
    });
    bob.once('dialog', (dialog) => dialog.accept());
    await bob.getByRole('button', { name: 'Abandonner' }).click();
    await expect(bob.getByText(`${aliceName} remporte la partie`)).toBeVisible({
      timeout: 10_000,
    });

    await bob.getByRole('button', { name: 'Voir le replay' }).click();
    await bob.waitForURL(/\/replay\/[a-f0-9-]+$/);
    await expect(bob.getByRole('heading', { name: 'Replay' })).toBeVisible();
    await expect(bob.getByText('pass', { exact: true })).toBeVisible();
    await expect(bob.getByText('resign', { exact: true })).toBeVisible();
  } finally {
    await aliceContext.close();
    await bobContext.close();
  }
});
