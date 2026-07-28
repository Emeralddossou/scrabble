import { expect, test } from '@playwright/test';

const password = 'Scrabble!2026';

test('une partie solo experte répond au joueur et rend le tour', async ({ page }) => {
  const suffix = `${test.info().project.name}-${Date.now()}-${test.info().workerIndex}`;
  const username = `Solo-${suffix}`.slice(0, 24);

  await page.goto('/');
  await page.getByRole('tab', { name: 'Créer un compte' }).click();
  await page.getByLabel('Nom de joueur').fill(username);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Forger mon profil' }).click();
  await page.waitForURL('**/dashboard');

  await page.getByRole('button', { name: 'Jouer contre l’IA' }).click();
  await page.getByRole('button', { name: 'Expert' }).click();
  await expect(page.getByRole('option', { name: 'Libre, durée illimitée' })).toBeAttached();
  await page.getByRole('button', { name: 'Commencer la partie' }).click();
  await page.waitForURL(/\/game\/\d+$/);

  await expect(page.getByText('LexiBot-hard', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'À vous de composer' })).toBeVisible();
  await page.getByRole('button', { name: 'Passer' }).click();
  await expect(page.getByRole('heading', { name: 'À vous de composer' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator('.history').getByText('LexiBot-hard', { exact: true })).toBeVisible();
});
