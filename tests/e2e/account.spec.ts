import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

const initialPassword = 'Scrabble!2026';
const changedPassword = 'Changed!2026';
const recoveredPassword = 'Recovered!2026';

test('un joueur gère son profil, son mot de passe et sa récupération', async ({ page }) => {
  const unique = randomUUID().replaceAll('-', '');
  const username = `Profile-${unique.slice(0, 16)}`;
  const email = `profile-${unique}@example.com`;

  await page.goto('/');
  await page.getByRole('tab', { name: 'Créer un compte' }).click();
  await page.getByLabel('Nom de joueur').fill(username);
  await page.getByLabel('E-mail de récupération').fill(email);
  await page.getByLabel('Mot de passe').fill(initialPassword);
  await page.getByRole('button', { name: 'Forger mon profil' }).click();
  await page.waitForURL('**/dashboard');

  await page.getByRole('button', { name: 'Mon profil' }).click();
  await page.waitForURL('**/profile');
  await expect(page.getByRole('heading', { name: username })).toBeVisible();
  await page.getByRole('combobox', { name: 'Avatar' }).selectOption('fox');
  await page.getByLabel('Présentation').fill('Amateur de mots croisés et de parties rapides.');
  await page.getByRole('button', { name: 'Enregistrer le profil' }).click();
  await expect(page.getByText('Profil mis à jour.')).toBeVisible();

  await page.getByLabel('Mot de passe actuel').fill(initialPassword);
  await page.getByLabel('Nouveau mot de passe').fill(changedPassword);
  await page.getByLabel('Confirmer').fill(changedPassword);
  await page.getByRole('button', { name: 'Modifier et déconnecter' }).click();
  await page.waitForURL('**/');

  await page.getByLabel('Nom de joueur ou e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(changedPassword);
  await page.getByRole('button', { name: 'Entrer dans l’arène' }).click();
  await page.waitForURL('**/dashboard');
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  await page.waitForURL('**/');

  await page.getByRole('button', { name: 'Mot de passe oublié ?' }).click();
  await page.getByLabel('Nom de joueur ou e-mail').fill(email);
  await page.getByRole('button', { name: 'Envoyer le lien sécurisé' }).click();
  await expect(page.getByText(/un lien valable une heure/i)).toBeVisible();
  await page.getByRole('button', { name: 'Ouvrir le lien de test' }).click();
  await page.waitForURL(/\/reset-password\?token=/);

  await page.getByLabel('Nouveau mot de passe').fill(recoveredPassword);
  await page.getByLabel('Confirmer le mot de passe').fill(recoveredPassword);
  await page.getByRole('button', { name: 'Modifier le mot de passe' }).click();
  await expect(page.getByText('Mot de passe modifié.')).toBeVisible();
  await page.getByRole('button', { name: 'Retour à la connexion' }).click();

  await page.getByLabel('Nom de joueur ou e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(recoveredPassword);
  await page.getByRole('button', { name: 'Entrer dans l’arène' }).click();
  await page.waitForURL('**/dashboard');
  await expect(page.getByRole('heading', { name: `Bonjour, ${username}` })).toBeVisible();
});
