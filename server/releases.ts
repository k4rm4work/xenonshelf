// Whether a newer XenonShelf is out: the server asks GitHub for the latest release once a
// day, so the settings panel can say so. The browser never talks to GitHub itself, and
// nothing about the user or the collection is sent.

const LATEST_RELEASE = 'https://api.github.com/repos/xenonshelf/xenonshelf/releases/latest';
const DAY_MS = 24 * 60 * 60 * 1000;

export type NewRelease = { version: string; url: string };

const parts = (version: string) => /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version.trim())?.slice(1).map(Number);

/** Above zero when `a` is the later x.y.z version; zero when either isn't one. */
export function compareVersions(a: string, b: string): number {
  const x = parts(a);
  const y = parts(b);
  if (!x || !y) return 0;
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

/** The latest release on GitHub; undefined when its answer isn't one. */
async function latestFromGitHub(): Promise<NewRelease | undefined> {
  const res = await fetch(LATEST_RELEASE, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'XenonShelf' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const body = (await res.json()) as { tag_name?: unknown; html_url?: unknown };
  const version = typeof body.tag_name === 'string' ? body.tag_name.replace(/^v/, '') : '';
  // The link goes into the page, so only a GitHub one is taken.
  const url = typeof body.html_url === 'string' && body.html_url.startsWith('https://github.com/') ? body.html_url : '';
  return parts(version) && url ? { version, url } : undefined;
}

export function createReleaseCheck({
  current,
  enabled,
  fetchLatest = latestFromGitHub,
}: {
  /** The running version; a build without one (the dev server) never checks. */
  current: string | undefined;
  enabled: () => boolean;
  fetchLatest?: () => Promise<NewRelease | undefined>;
}) {
  let latest: NewRelease | undefined;

  const check = async () => {
    if (!current || !enabled()) return;
    try {
      latest = await fetchLatest();
    } catch {
      // Offline, or GitHub busy: tomorrow's check tries again.
    }
  };

  return {
    check,
    /** Checks now, then once a day for as long as the server runs. */
    start() {
      void check();
      setInterval(check, DAY_MS).unref();
    },
    /** The release to tell about: newer than the running one, while the check is on. */
    newRelease: (): NewRelease | undefined =>
      current && enabled() && latest && compareVersions(latest.version, current) > 0 ? latest : undefined,
  };
}
