import { channel, expect, openCard, test, tile } from './fixtures';

test('shows the collection and the wishlist', async ({ page }) => {
  await page.goto('/');
  await expect(channel(page, 'Collection')).toContainText('3');
  await expect(channel(page, 'Wishlist')).toContainText('1');
  for (const title of ['Halo 3', 'Mass Effect', 'Limbo']) await expect(tile(page, title)).toBeVisible();
  await expect(tile(page, 'Alan Wake')).toHaveCount(0);

  await channel(page, 'Wishlist').click();
  await expect(page).toHaveURL(/#\/wishlist/);
  await expect(tile(page, 'Alan Wake')).toBeVisible();
  await expect(tile(page, 'Halo 3')).toHaveCount(0);
});

test('finds games by title', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox', { name: 'search titles' }).fill('mass');
  await expect(tile(page, 'Mass Effect')).toBeVisible();
  await expect(tile(page, 'Halo 3')).toHaveCount(0);
  await expect(tile(page, 'Limbo')).toHaveCount(0);
});

test('adds a game found on IGDB, and takes it back', async ({ page }) => {
  // The test server has no IGDB keys: the browser gets its answers here instead.
  await page.route('**/api/igdb/search*', (route) =>
    route.fulfill({ json: { results: [{ igdbId: 7331, title: 'Gears of War', releaseYear: 2006, genres: ['Shooter'] }] } }),
  );
  await page.route('**/api/igdb/game*', (route) => route.fulfill({ json: { details: { developers: ['Epic Games'] } } }));

  await page.goto('/');
  await page.getByRole('button', { name: 'add game' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add game' });
  await dialog.getByRole('searchbox').fill('gears');
  await dialog.getByRole('button', { name: /Gears of War/ }).click();
  await expect(dialog.getByRole('definition').filter({ hasText: 'Epic Games' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Add to library' }).click();
  await dialog.getByRole('button', { name: 'Add to collection' }).click();

  await expect(page.getByText('Added to your collection')).toBeVisible();
  await expect(channel(page, 'Collection')).toContainText('4');
  await page.reload();
  await expect(tile(page, 'Gears of War')).toBeVisible();

  const card = await openCard(page, 'Gears of War');
  await card.getByRole('tab', { name: 'History' }).click();
  await expect(card.getByRole('tabpanel')).toContainText('Added to the collection');
  await card.getByRole('button', { name: 'Delete' }).click();
  await card.getByRole('button', { name: 'Really delete?' }).click();
  await expect(tile(page, 'Gears of War')).toHaveCount(0);
  await expect(page.getByText('Game deleted')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(tile(page, 'Gears of War')).toBeVisible();
});

test('a status and a tag set on the card are kept, with their history', async ({ page }) => {
  await page.goto('/');
  const card = await openCard(page, 'Mass Effect');
  await card.getByRole('button', { name: /^Status/ }).click();
  await card.getByRole('option', { name: 'Completed' }).click();
  await expect(card.getByRole('button', { name: 'Status: Completed' })).toBeVisible();

  const tags = card.getByRole('combobox', { name: 'new tag' });
  await tags.fill('favourites');
  await tags.press('Enter');
  await expect(card.getByRole('group', { name: 'Tags' })).toContainText('favourites');

  await page.reload();
  const again = await openCard(page, 'Mass Effect');
  await expect(again.getByRole('button', { name: 'Status: Completed' })).toBeVisible();
  await again.getByRole('tab', { name: 'History' }).click();
  const history = again.getByRole('tabpanel');
  await expect(history).toContainText('Status: Completed');
  await expect(history).toContainText('Tagged “favourites”');
});

test('lends a copy and takes it back', async ({ page }) => {
  await page.goto('/');
  const card = await openCard(page, 'Halo 3');
  await card.getByRole('tab', { name: 'Copy' }).click();
  await card.getByRole('button', { name: /^Loan/ }).click();
  await card.getByRole('combobox', { name: 'To' }).fill('Kasia');
  await card.getByRole('button', { name: 'save' }).click();
  await expect(card).toContainText('Kasia');

  await page.reload();
  const again = await openCard(page, 'Halo 3');
  await expect(again).toContainText('On loan to Kasia');
  await again.getByRole('button', { name: 'returned' }).click();
  await expect(again).not.toContainText('On loan to Kasia');
  await again.getByRole('tab', { name: 'History' }).click();
  await expect(again.getByRole('tabpanel')).toContainText('Lent to Kasia');
  await expect(again.getByRole('tabpanel')).toContainText('Returned by Kasia');
});

test('imports a list by title when IGDB is not set up', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'add game' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add game' });
  await dialog.getByRole('button', { name: /Import a list/ }).click();
  await dialog.getByRole('textbox').fill('Fable II\nBioShock');
  await dialog.getByRole('button', { name: /^Look up on IGDB/ }).click();
  await dialog.getByRole('button', { name: /^Add to library/ }).click();

  await expect(channel(page, 'Collection')).toContainText('5');
  await page.reload();
  await expect(tile(page, 'Fable II')).toBeVisible();
  await expect(tile(page, 'BioShock')).toBeVisible();
});

test('opens the settings from the logo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('radiogroup', { name: /Theme/i })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('radiogroup', { name: /Theme/i })).toHaveCount(0);
});
