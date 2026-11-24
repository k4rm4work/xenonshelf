import { test as base, expect, type Page } from '@playwright/test';
import { copyFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(import.meta.dirname, '.data');

/**
 * Each test starts from e2e/library.json, in English, and fails on any error the page
 * logs or throws. Requests that fail on purpose (IGDB, which the test server has no keys
 * for) are left out by their URL.
 */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      copyFileSync(path.join(import.meta.dirname, 'library.json'), path.join(DATA_DIR, 'games.json'));
      rmSync(path.join(DATA_DIR, 'backups'), { recursive: true, force: true });
      await page.addInitScript(() => {
        if (!localStorage.getItem('x360lib:settings')) localStorage.setItem('x360lib:settings', JSON.stringify({ language: 'en' }));
      });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error' && !m.location().url.includes('/api/igdb/')) errors.push(m.text());
      });
      await use(errors);
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** A game on the shelf, by its title (a tile's name also carries its year, status and marks). */
export const tile = (page: Page, title: string) => page.getByRole('main').getByRole('button', { name: new RegExp(`\\b${title}\\b`) });

/** The count beside a channel's name in the header. */
export const channel = (page: Page, name: 'Collection' | 'Wishlist') =>
  page.getByRole('navigation').getByRole('link', { name: new RegExp(`^${name}`) });

/** Opens a game's card. */
export async function openCard(page: Page, title: string) {
  await tile(page, title).click();
  const card = page.getByRole('dialog', { name: title });
  await expect(card).toBeVisible();
  return card;
}
