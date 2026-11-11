import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, remove } from 'fs-extra';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  createInstallBuilders,
  getBuildUtilsSpec,
  getBuildUtilsVersionForInstall,
  getNpmDeprecationWarnings,
  shouldFallbackBuilderPins,
} from '../../src/install-builders';

describe('getNpmDeprecationWarnings', () => {
  it('returns only the `npm WARN deprecated` lines', () => {
    const stderr = [
      'npm notice New minor version of npm available!',
      'npm WARN deprecated inflight@1.0.6: This module is not supported.',
      'npm WARN deprecated querystring@0.2.0: The querystring API is considered legacy.',
      'npm WARN ERESOLVE overriding peer dependency',
      'npm notice',
      'npm notice Run `npm install` to install dependencies.',
    ].join('\n');

    expect(getNpmDeprecationWarnings(stderr)).toEqual([
      'npm WARN deprecated inflight@1.0.6: This module is not supported.',
      'npm WARN deprecated querystring@0.2.0: The querystring API is considered legacy.',
    ]);
  });

  it('handles CRLF line endings', () => {
    const stderr =
      'npm notice hello\r\nnpm WARN deprecated foo@1.0.0: deprecated\r\nnpm WARN peer bar';

    expect(getNpmDeprecationWarnings(stderr)).toEqual([
      'npm WARN deprecated foo@1.0.0: deprecated',
    ]);
  });

  it('returns nothing when there are no deprecation warnings', () => {
    expect(
      getNpmDeprecationWarnings('npm notice added 2 packages in 1s')
    ).toEqual([]);
  });
});

describe('shouldFallbackBuilderPins', () => {
  it('does not fall back when binary pins are strict', () => {
    expect(shouldFallbackBuilderPins({ strictBuilderPins: true }, 1)).toBe(
      false
    );
  });

  it('retains fallback for non-strict installs with managed pins', () => {
    expect(shouldFallbackBuilderPins({}, 1)).toBe(true);
  });

  it('does not fall back when no spec was pinned', () => {
    expect(shouldFallbackBuilderPins({}, 0)).toBe(false);
  });
});

describe('getBuildUtilsVersionForInstall', () => {
  const dependencies = {
    buildUtilsVersion: '14.5.0',
    pinnedBuildUtilsVersion:
      'https://preview.vercel.sh/tarballs/vercel-build-utils.tgz',
  };

  it('uses the published version for unpinned builders and fallbacks', () => {
    expect(getBuildUtilsVersionForInstall(dependencies, false)).toBe('14.5.0');
  });

  it('uses the matching preview tarball for pinned preview builders', () => {
    expect(getBuildUtilsVersionForInstall(dependencies, true)).toBe(
      dependencies.pinnedBuildUtilsVersion
    );
  });

  it('uses the published version when there is no separate preview tarball', () => {
    expect(
      getBuildUtilsVersionForInstall({ buildUtilsVersion: '14.5.0' }, true)
    ).toBe('14.5.0');
  });
});

describe('getBuildUtilsSpec', () => {
  it('uses the CLI dependency version', () => {
    expect(getBuildUtilsSpec('14.5.0')).toBe('@vercel/build-utils@14.5.0');
  });

  it('uses the CLI preview tarball', () => {
    expect(
      getBuildUtilsSpec(
        'https://preview.vercel.sh/tarballs/vercel-build-utils.tgz'
      )
    ).toBe(
      '@vercel/build-utils@https://preview.vercel.sh/tarballs/vercel-build-utils.tgz'
    );
  });

  it('ignores the workspace protocol from a source checkout', () => {
    expect(getBuildUtilsSpec('workspace:*')).toBe('@vercel/build-utils');
  });

  it('falls back to the latest package when the CLI has no dependency', () => {
    expect(getBuildUtilsSpec()).toBe('@vercel/build-utils');
  });
});

describe('installBuilders() npm deprecation warnings', () => {
  // This test creates symlinks, which require admin by default on Windows.
  it.skipIf(process.platform === 'win32')(
    'warns only for the `npm WARN deprecated` lines of stderr',
    async () => {
      const buildersDir = await mkdtemp(join(tmpdir(), 'install-builders-'));
      const warn = vi.fn();
      const stderr = [
        'npm notice New minor version of npm available! 10.9.0 -> 11.0.0',
        'npm WARN deprecated inflight@1.0.6: This module is not supported.',
        'npm WARN deprecated querystring@0.2.0: The querystring API is considered legacy.',
        'npm WARN ERESOLVE overriding peer dependency',
        'npm notice Run `npm fund` for details.',
      ].join('\n');

      try {
        const installBuilders = createInstallBuilders({
          buildUtilsVersion: '14.5.0',
          code: value => value,
          cmd: value => value,
          isCantParseJSONFile: (): never | false => false,
          output: { debug: vi.fn(), log: vi.fn(), warn },
          readJSONFile: async () => ({
            dependencies: { 'vercel-bash': '4.1.0' },
          }),
          run: async () => ({ stderr }),
        });

        await installBuilders(buildersDir, new Set(['vercel-bash@4.1.0']));

        expect(warn.mock.calls.map(([message]) => message)).toEqual([
          'npm WARN deprecated inflight@1.0.6: This module is not supported.',
          'npm WARN deprecated querystring@0.2.0: The querystring API is considered legacy.',
        ]);
      } finally {
        await remove(buildersDir);
      }
    }
  );
});
