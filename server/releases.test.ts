import { describe, expect, it } from 'vitest';
import { compareVersions, createReleaseCheck } from './releases';

describe('compareVersions', () => {
  it('orders versions part by part, not as text', () => {
    expect(compareVersions('1.0.10', '1.0.9')).toBeGreaterThan(0);
    expect(compareVersions('v1.2.0', '1.10.0')).toBeLessThan(0);
    expect(compareVersions('2.0.0', 'v2.0.0')).toBe(0);
  });

  it('treats anything that is not x.y.z as no newer', () => {
    expect(compareVersions('2.0.0-beta', '1.0.0')).toBe(0);
    expect(compareVersions('', '1.0.0')).toBe(0);
  });
});

describe('createReleaseCheck', () => {
  const release = { version: '1.0.2', url: 'https://github.com/xenonshelf/xenonshelf/releases/tag/v1.0.2' };

  it('tells about a newer release only', async () => {
    const newer = createReleaseCheck({ current: '1.0.1', enabled: () => true, fetchLatest: async () => release });
    await newer.check();
    expect(newer.newRelease()).toEqual(release);

    const same = createReleaseCheck({ current: '1.0.2', enabled: () => true, fetchLatest: async () => release });
    await same.check();
    expect(same.newRelease()).toBeUndefined();
  });

  it('asks nothing while the check is off, and stays quiet when turned off later', async () => {
    let on = false;
    let asked = 0;
    const releases = createReleaseCheck({
      current: '1.0.1',
      enabled: () => on,
      fetchLatest: async () => (asked++, release),
    });
    await releases.check();
    expect(asked).toBe(0);
    on = true;
    await releases.check();
    expect(releases.newRelease()).toEqual(release);
    on = false;
    expect(releases.newRelease()).toBeUndefined();
  });

  it('never checks without a version of its own, and survives GitHub being away', async () => {
    let asked = 0;
    const dev = createReleaseCheck({ current: undefined, enabled: () => true, fetchLatest: async () => (asked++, release) });
    await dev.check();
    expect(asked).toBe(0);

    const offline = createReleaseCheck({
      current: '1.0.1',
      enabled: () => true,
      fetchLatest: () => Promise.reject(new Error('offline')),
    });
    await expect(offline.check()).resolves.toBeUndefined();
    expect(offline.newRelease()).toBeUndefined();
  });
});
