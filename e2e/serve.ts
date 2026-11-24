// The server the end-to-end tests drive: the editable build, as the Docker image ships it,
// on the production server, with its data in e2e/.data instead of data/.
// Run by Playwright (playwright.config.ts); each test restores the library it starts from.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { build } from 'vite';

const ROOT = path.resolve(import.meta.dirname, '..');
export const DATA_DIR = path.join(import.meta.dirname, '.data');

rmSync(DATA_DIR, { recursive: true, force: true });
mkdirSync(DATA_DIR, { recursive: true });
// A server already set up: no first-run guide over the page.
writeFileSync(path.join(DATA_DIR, 'config.json'), JSON.stringify({ setupDone: true }));

process.env.VITE_EDITABLE = 'true';
await build({ root: ROOT, logLevel: 'warn' });

process.env.PORT ??= '4317';
process.env.LIBRARY_FILE = path.join(DATA_DIR, 'games.json');
process.env.SEED_FILE = path.join(import.meta.dirname, 'library.json');
await import('../server/main.ts');
