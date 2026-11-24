import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { libraryApi } from './vite-plugin-library-api';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/** Short hash of the built commit; empty when there is no git history. Read from .git
    directly, since the git binary isn't always on the PATH of the shell npm spawns. */
function gitCommit() {
  try {
    const git = (path: string) => readFileSync(new URL(`./.git/${path}`, import.meta.url), 'utf8').trim();
    const head = git('HEAD');
    if (!head.startsWith('ref: ')) return head.slice(0, 7);
    const ref = head.slice(5);
    let hash: string | undefined;
    try {
      hash = git(ref);
    } catch {
      // Refs packed by git gc live in a single file: "<hash> <ref>" per line.
      hash = git('packed-refs')
        .split('\n')
        .find((line) => line.endsWith(` ${ref}`))
        ?.split(' ')[0];
    }
    return hash?.slice(0, 7) ?? '';
  } catch {
    return '';
  }
}

// One stamp for the bundle and for version.json, which open tabs poll to learn that a
// newer build is up (see src/lib/updates.ts).
const BUILD_INFO = { version, commit: gitCommit(), builtAt: new Date().toISOString() };

const LIBRARY = fileURLToPath(new URL('./data/games.json', import.meta.url));
const STARTER = fileURLToPath(new URL('./data/starter-library.json', import.meta.url));

export default defineConfig(({ command }) => ({
  // Build info shown in the settings panel (see src/lib/version.ts).
  define: {
    __APP_VERSION__: JSON.stringify(BUILD_INFO.version),
    __APP_COMMIT__: JSON.stringify(BUILD_INFO.commit),
    __BUILD_DATE__: JSON.stringify(BUILD_INFO.builtAt),
  },
  // Relative base keeps the build working on GitHub Pages subpaths.
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    libraryApi(),
    {
      name: 'version-file',
      apply: 'build',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(BUILD_INFO) });
      },
    },
  ],
  resolve: {
    alias: {
      // Only a read-only static build carries the library inside it. The dev server and the
      // self-hosted build read it from the API, so they get the empty starter instead and
      // the bundle stays small. data/games.json is local and not in git (see README).
      '@library': command === 'build' && process.env.VITE_EDITABLE !== 'true' && existsSync(LIBRARY) ? LIBRARY : STARTER,
    },
  },
  // The app saves its own edits to data/games.json; watching that file would reload the
  // page after every change. In dev the library is read through the API anyway.
  server: {
    watch: { ignored: ['**/data/games.json'] },
  },
  test: {
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
}));
