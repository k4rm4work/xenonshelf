// Replaced at build time by vite.config.ts.
declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;
declare const __BUILD_DATE__: string;

export const APP_NAME = 'XenonShelf';
export const APP_AUTHOR = "Szymon 'k4rm4' Kucharski";
const REPO_URL = 'https://github.com/k4rm4work/xenonshelf';
/** The README's steps for moving a server to a new version. */
export const UPDATE_GUIDE_URL = `${REPO_URL}#updating`;

export const BUILD = {
  version: __APP_VERSION__,
  /** Missing when the build had no git history to read. */
  commit: __APP_COMMIT__ || undefined,
  builtAt: __BUILD_DATE__,
};

/** A new issue from one of the repo's forms (.github/ISSUE_TEMPLATE), with the version and,
    for a problem, the browser already filled in. */
export function feedbackUrl(template: 'bug_report' | 'idea') {
  const url = new URL(`${REPO_URL}/issues/new`);
  url.searchParams.set('template', `${template}.yml`);
  url.searchParams.set('version', BUILD.commit ? `${BUILD.version} (${BUILD.commit})` : BUILD.version);
  if (template === 'bug_report') url.searchParams.set('device', navigator.userAgent);
  return url.toString();
}
