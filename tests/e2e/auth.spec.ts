import { expect, test } from '@playwright/test';

test('affiche l’authentification et la navigation mobile', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('ARÈNE LEXICALE FRANCOPHONE')).toBeVisible();
  await page.getByRole('tab', { name: 'Créer un compte' }).click();
  await expect(page.getByLabel('Nom de joueur')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Forger mon profil' })).toBeVisible();
});
