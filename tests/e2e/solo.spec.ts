import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

const password = 'Scrabble!2026';

test('une partie solo experte répond au joueur et rend le tour', async ({ page }) => {
  const username = `Solo-${randomUUID().replaceAll('-', '').slice(0, 18)}`;

  await page.goto('/');
  await page.getByRole('tab', { name: 'Créer un compte' }).click();
  await page.getByLabel('Nom de joueur').fill(username);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Forger mon profil' }).click();
  await page.waitForURL('**/dashboard');

  await page.getByRole('button', { name: 'Jouer contre l’IA' }).click();
  const dialog = page.getByRole('dialog', { name: 'Choisissez votre adversaire' });
  await dialog.getByRole('button', { name: 'Expert' }).click();
  await expect(dialog.getByLabel('Mode de jeu')).toHaveValue('free');
  await dialog.getByRole('button', { name: 'Commencer la partie' }).click();
  await page.waitForURL(/\/game\/[a-f0-9-]+$/);

  await expect(page.getByText('LexiBot-hard', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'À vous de composer' })).toBeVisible();
  await page.getByRole('button', { name: 'Passer' }).click();
  await expect(page.getByRole('heading', { name: 'À vous de composer' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator('.history').getByText('LexiBot-hard', { exact: true })).toBeVisible();
});
