# XenonShelf

Your Xbox 360 collection and wishlist, in the style of the console's dashboard.

XenonShelf runs on a computer or NAS in your home and opens in any browser on your network:
on your PC, your phone or your tablet. Add games by searching for them (covers and details come
from IGDB) or import a whole list at once, mark what you have played, note editions, SteelBooks
and loans, and keep a wishlist of what to buy next.

In English, Español, Português (Brasil), Français, Deutsch and Polski: the app picks your
browser's language, and the settings change it.

The name comes from Xenon, the Xbox 360's code name.

## What you need

- A computer that stays on at home: a PC, a Mac, a home server or a NAS (Synology, QNAP,
  Unraid, a Raspberry Pi 4 or newer…).
- **Docker** on it. On Windows and macOS install
  [Docker Desktop](https://www.docker.com/products/docker-desktop/); most NAS systems have it in
  their app store ("Container Manager" on Synology, built in on Unraid).

That's all. You don't need to know programming, and nothing has to be built.

## Install in three steps

**1. Make a folder** called `xenonshelf` anywhere you like, and save this in it as a file
named `docker-compose.yml`:

```yaml
services:
  xenonshelf:
    image: ghcr.io/k4rm4work/xenonshelf:latest
    container_name: xenonshelf
    restart: unless-stopped
    ports:
      - '8360:3000'
    volumes:
      - ./library-data:/data
```

**2. Start it.** Open a terminal in that folder and run:

```bash
docker compose up -d
```

On a NAS you can instead create a new "project" (or "stack") in its Docker app and paste the
file above into it.

**3. Open it** in a browser at `http://<your computer's address>:8360`, for example
`http://192.168.1.20:8360`, or `http://localhost:8360` on the computer itself.

A short guide greets you on the first visit:

- **Covers and search.** Paste two free keys so the app can find games and their covers. The
  guide shows where to get them, step by step; it takes about three minutes (see below).
- **Login (optional).** Set a user name and password if others on your network shouldn't
  change your collection.

You can skip both steps and come back to them any time under **Settings → Server**.

> **Finding your computer's address:** on Windows run `ipconfig` and look for "IPv4
> Address"; on macOS open System Settings → Network; a NAS shows it in its control panel.

## Getting the IGDB keys

Game covers, descriptions and search come from [IGDB](https://www.igdb.com), a free games
database run by Twitch. It needs a pair of keys of your own:

1. Sign in at [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) with a Twitch
   account. Twitch asks you to turn on two-factor sign-in first.
2. Click **Register Your Application**. Use any name, set the OAuth Redirect URL to
   `http://localhost`, the category to _Application Integration_ and the client type to
   _Confidential_.
3. Open the application you saved, copy the **Client ID**, click **New Secret** and copy the
   secret.
4. Paste both into the app's guide (or Settings → Server). The app checks them with Twitch
   before saving.

Without keys the app still works: you add games by typing their title, with a stand-in cover.

## Image channels

- `latest` is the newest versioned release and is the recommended choice for a stable home server.
- `edge` follows `main` and changes as soon as a commit passes CI; use it to try the latest development build.
- Every image also has a short commit-SHA tag for pinning an exact build.

## Updating

When a new version is out, the app shows a notice. To update, run in the same folder:

```bash
docker compose pull && docker compose up -d
```

Your collection is not touched.

## Your data and backups

Everything lives in the `library-data` folder next to `docker-compose.yml`:

- `games.json` is your collection.
- `backups/` holds a copy from each of the last 30 days, made automatically.
- `config.json` holds the IGDB keys and the login set in the app. The password is stored only
  as a secure hash.

Back up the `library-data` folder with the rest of your files. In the app, **Settings → Your
data** lets you download your collection as a spreadsheet (it opens in Excel) or a full backup,
and restore a backup.

## Keeping it safe

XenonShelf is meant for your home network. To use it away from home, connect to your home
network through a VPN (for example WireGuard, Tailscale or your router's VPN). Don't open port
8360 to the internet: the login is not encrypted on the way unless you put the app behind a
reverse proxy with HTTPS. Every change saves the whole library, so let the proxy pass large
requests: nginx, for one, stops at 1 MB unless told `client_max_body_size 50m;`.

## License and community forks

XenonShelf is licensed under the **GNU Affero General Public License v3.0 or later
(AGPL-3.0-or-later)**. You may use, study, modify, and redistribute the software, including
for commercial purposes, provided you comply with the license.

If you distribute a modified version, you must provide its corresponding source code under the
AGPL. If you run a modified version that users can interact with over a network, you must also
offer those users access to the corresponding source code under the AGPL. The license does not
prohibit commercial use; it ensures that covered modifications remain available to users under
the same freedoms.

The XenonShelf name, logo, and project branding are not granted under the software license.
Community forks are welcome, but should use their own name and branding and must not imply that
they are official XenonShelf releases or endorsed by this project. See
[TRADEMARKS.md](TRADEMARKS.md) for the project name and branding policy.

The license applies to project code; third-party dependencies, game artwork, trademarks, and
external data may have their own separate terms.

## More options

- **Another port:** change the first number in `"8360:3000"` and run `docker compose up -d`.
- **Settings in a file instead of the app:** create a file named `.env.local` next to
  `docker-compose.yml`, add the line `env_file: [{ path: .env.local, required: false }]` under
  `xenonshelf:` in the compose file, and set any of these. Values set here can't be changed in
  the app.

  | Variable                                 | What it does                                  |
  | ---------------------------------------- | --------------------------------------------- |
  | `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`   | the IGDB keys                                 |
  | `XENONSHELF_USER`, `XENONSHELF_PASSWORD` | the login (password of 12 characters or more) |

- **Fill in details for games added without them:**
  `docker compose exec xenonshelf node scripts/enrich.ts`

## Feedback

Found a problem or have an idea? Open **Settings → Feedback** in the app: it takes you to a
short form with the app version already filled in. Questions and everything else go to the
[discussions](https://github.com/k4rm4work/xenonshelf/discussions). Every report is read.
See [CONTRIBUTING.md](CONTRIBUTING.md) for how it works.

## For developers

Running the app from source, the tests, the scripts and how it is built are in
[DEVELOPMENT.md](DEVELOPMENT.md).
