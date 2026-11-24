# Developing XenonShelf

Vite + React + Tailwind on the front, a small Node server with no dependencies behind it.
To simply run the app, see the [README](README.md).

## Start

```bash
npm install
npm run dev       # http://localhost:5173, games can be added and edited here
npm test
npm run build     # a static site in dist/, read-only
```

Editing works under `npm run dev` only: the dev server writes changes straight to
`data/games.json`. That file is a local copy for testing, ignored by git; on the first start it
is created empty from `data/starter-library.json`. To work on a copy of a server's library:

```bash
scp <user>@<server>:xenonshelf/library-data/games.json data/games.json
```

**Component gallery:** under `npm run dev`, `http://localhost:5173/#/ui` shows every component
with sample games, in both themes and at phone width. Builds leave it out.

## IGDB keys

Set them in the app (Settings → Server), which writes `data/config.json`, or copy `.env.example`
to `.env.local` and fill in `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET`. The README explains how
to get them. `.env.local` and `data/config.json` stay out of git, and keys in `.env.local` win.
The login is never asked for under `npm run dev`.

## Scripts

```bash
npm run enrich -- --dry   # preview, writes nothing
npm run enrich            # fill in IGDB data for games without it
npm run enrich -- --all   # refresh every game
npm run import -- titles.txt
npm run check-library -- data/games.json
```

**enrich** finds each game's Xbox 360 version on IGDB and stores its id. It fills in the release
year and genres (as ids, see src/lib/genres.ts) only where they are missing, keeps those set by hand and reports
differences. It then fetches the details shown in the game view: the description (IGDB has it in
English only), developer and publisher, series, critics' score, PEGI, co-op and split screen,
and play time. Own covers are kept, and only exact or close title matches are applied; the rest
are reported. A game with a Polish shelf title can carry `"igdbQuery"` with the English one,
e.g. `"Obcy: Izolacja"` → `"Alien: Isolation"`. Games added through the app's search get these
details straight away.

**import** reads one title per line, with optional flags after `|`:

```
Halo 3 | completed
Mass Effect 2 | digital
Fable II | wishlist | high
```

Flags: `digital`, `wishlist`, `playing` / `completed` / `dropped`, `high` / `low`. Titles are
matched on IGDB (Xbox 360 only) and duplicates are skipped. The app's own import (Add game →
"Have more games?") reads spreadsheets and pasted lists and is usually the easier way.

**check-library** checks a library file the way every save is checked, e.g. before deploying a
version that validates more strictly.

## Translations

Every string the app shows lives in `src/lib/i18n/`, one file per language. Polish (`pl.ts`)
is the reference: its keys are the type every other file must match, so a new string goes there
first, then into each language; TypeScript names any file that misses it. `{name}` marks a
value filled in at render time. `src/lib/i18n/i18n.test.ts` checks that every language has the
same keys and placeholders, that every choice the app offers and every plural form has its
words, and that no key is left unused.

To add a language: copy `en.ts`, translate it, and list it in `languages.ts` (its code, as
`Intl` knows it, and its own name) and in `MESSAGES` in `index.tsx`. If its plural rules
need forms the others don't, the test says which. Genres are stored as ids
(`src/lib/genres.ts`) and named per language as `genre.<id>`.

## The Docker image

`docker compose up -d --build` builds the image from this folder instead of pulling it. CI
tests every push and publishes `ghcr.io/k4rm4work/xenonshelf` for amd64 and arm64: `edge` and
the short commit from `main`, and the version and `latest` from a version tag. Servers pull
`latest`, so a change reaches them only once it is released:

```bash
npm version minor   # or patch: bumps package.json and tags it, e.g. v0.2.0
git push --follow-tags
```

The tag's CI run publishes the image and opens a GitHub release with notes from the commits.

A server that runs from a clone of this repo updates with:

```bash
git pull && docker compose build && docker compose run --rm --no-deps xenonshelf node scripts/check-library.ts /data/games.json && docker compose up -d
```

The check stops the update before the running version is replaced if the library on the server
wouldn't pass the new version's validation.

Without Docker: `VITE_EDITABLE=true npm run build`, then `node server/main.ts` (Node 24). Set the
port and the library file with `PORT` and `LIBRARY_FILE`; `config.json` is kept beside the
library.

## Static hosting (read-only)

`npm run build` makes a static site with relative paths and hash routing, so it works on GitHub
Pages, Netlify or Vercel without configuration. That version is read-only.
