import { describe, it, expect } from 'vitest';
import {
  getPathFromRoute,
  getRegExpFromPath,
  getRouteRank,
} from '../src/utils';
import type { RouteManifest } from '../src/types';

describe('getRouteRank()', () => {
  const routes: RouteManifest = {
    root: { id: 'root', file: 'app/root.tsx', path: '' },
    'routes/home': {
      id: 'routes/home',
      parentId: 'root',
      file: 'app/routes/home.tsx',
      index: true,
    },
    'routes/$slug': {
      id: 'routes/$slug',
      parentId: 'root',
      file: 'app/routes/$slug.tsx',
      path: ':slug',
    },
    'routes/api.items.$id.export': {
      id: 'routes/api.items.$id.export',
      parentId: 'root',
      file: 'app/routes/api.items.$id.export.ts',
      path: 'api/items/:id/export',
    },
    'routes/catch-all': {
      id: 'routes/catch-all',
      parentId: 'root',
      file: 'app/routes/catch-all.tsx',
      path: '*',
    },
    'layouts/app': {
      id: 'layouts/app',
      parentId: 'root',
      file: 'app/layouts/app.tsx',
    },
    'routes/app.dashboard': {
      id: 'routes/app.dashboard',
      parentId: 'layouts/app',
      file: 'app/routes/app.dashboard.tsx',
      path: 'dashboard',
    },
    'routes/app.$id': {
      id: 'routes/app.$id',
      parentId: 'layouts/app',
      file: 'app/routes/app.$id.tsx',
      path: ':id',
    },
  };

  it('ranks static segments above dynamic segments above splats', () => {
    const staticRank = getRouteRank(
      routes['routes/api.items.$id.export'],
      routes
    );
    const dynamicRank = getRouteRank(routes['routes/$slug'], routes);
    const splatRank = getRouteRank(routes['routes/catch-all'], routes);

    expect(staticRank).toBeGreaterThan(dynamicRank);
    expect(dynamicRank).toBeGreaterThan(splatRank);
  });

  it('ranks deeper branches above shallower ones', () => {
    expect(
      getRouteRank(routes['routes/app.dashboard'], routes)
    ).toBeGreaterThan(getRouteRank(routes['routes/$slug'], routes));
  });

  it('ignores pathless layout segments in the parent chain', () => {
    // `layouts/app` has no path, so it must not change the score of its
    // children relative to the same route defined directly under the root.
    const directRoutes: RouteManifest = {
      ...routes,
      'routes/dashboard': {
        id: 'routes/dashboard',
        parentId: 'root',
        file: 'app/routes/dashboard.tsx',
        path: 'dashboard',
      },
    };
    expect(getRouteRank(routes['routes/app.dashboard'], routes)).toBe(
      getRouteRank(directRoutes['routes/dashboard'], directRoutes)
    );
  });

  it('ranks an index route above its non-index parent branch', () => {
    expect(getRouteRank(routes['routes/home'], routes)).toBeGreaterThan(
      getRouteRank(routes['root'], routes)
    );
  });
});

// Integration-style assertion that mirrors the per-route loop in
// `build-vite.ts`. Given a route manifest where a catch-all is defined before
// a more specific dynamic route (issue #17679), the emitted Vercel routing
// rules must be sorted by React Router's ranking so the specific route is
// matched first.
describe('dynamic route ordering', () => {
  const routes: RouteManifest = {
    root: { id: 'root', file: 'app/root.tsx', path: '' },
    'routes/page': {
      id: 'routes/page',
      parentId: 'root',
      file: 'app/routes/page.tsx',
      path: ':slug',
    },
    'routes/not-found': {
      id: 'routes/not-found',
      parentId: 'routes/page',
      file: 'app/routes/not-found.tsx',
      path: '*',
    },
    'routes/api.export': {
      id: 'routes/api.export',
      parentId: 'root',
      file: 'app/routes/api.export.ts',
      path: 'api/items/:id/export',
    },
  };

  // `routeIdToServerBundleId` preserves definition order, with the catch-all
  // branch defined first and the specific API route second.
  const routeIdToServerBundleId = {
    'routes/page': 'default',
    'routes/not-found': 'default',
    'routes/api.export': 'api',
  };

  // Mirrors the loop in `build-vite.ts`: rules are collected per route and
  // emitted rank-descending, with every `.data` rule before every non-data
  // rule.
  function getDynamicRules() {
    const dataRules: { rank: number; src: string; dest: string }[] = [];
    const plainRules: { rank: number; src: string; dest: string }[] = [];
    for (const id of Object.keys(routeIdToServerBundleId)) {
      const route = routes[id];
      const { path, rePath } = getPathFromRoute(route, routes);
      if (!path) continue;
      const re = getRegExpFromPath(rePath);
      if (!re) continue;
      const rank = getRouteRank(route, routes);
      const reData = getRegExpFromPath(`${rePath}.data`);
      if (reData) {
        dataRules.push({ rank, src: reData.source, dest: `${path}.data` });
      }
      plainRules.push({ rank, src: re.source, dest: path });
    }
    const byRankDesc = (a: { rank: number }, b: { rank: number }) =>
      b.rank - a.rank;
    return [...dataRules.sort(byRankDesc), ...plainRules.sort(byRankDesc)];
  }

  it('emits the specific route before the catch-all', () => {
    const rules = getDynamicRules();
    const exportIndex = rules.findIndex(r => r.dest === 'api/items/:id/export');
    const catchAllIndex = rules.findIndex(r => r.dest === ':slug/*');
    expect(exportIndex).toBeGreaterThanOrEqual(0);
    expect(catchAllIndex).toBeGreaterThanOrEqual(0);
    expect(exportIndex).toBeLessThan(catchAllIndex);
  });

  it('routes the request to the specific route when applying rules in order', () => {
    const rules = getDynamicRules();
    const requestPath = '/api/items/123/export';
    const match = rules.find(rule => new RegExp(rule.src).test(requestPath));
    expect(match?.dest).toBe('api/items/:id/export');
  });

  it('keeps each route’s `.data` rule ahead of its non-data rule', () => {
    const rules = getDynamicRules();
    const dataIndex = rules.findIndex(
      r => r.dest === 'api/items/:id/export.data'
    );
    const plainIndex = rules.findIndex(r => r.dest === 'api/items/:id/export');
    expect(dataIndex).toBeGreaterThanOrEqual(0);
    expect(plainIndex).toBeGreaterThanOrEqual(0);
    expect(dataIndex).toBeLessThan(plainIndex);

    // The `.data` URL for the specific route must also win over the
    // catch-all's plain rule, even though the catch-all was defined first.
    const dataRequest = '/api/items/123/export.data';
    const dataMatch = rules.find(rule =>
      new RegExp(rule.src).test(dataRequest)
    );
    expect(dataMatch?.dest).toBe('api/items/:id/export.data');
  });

  it('does not change routing for non-dynamic routes', () => {
    // Static routes never produce rules; only the dynamic ones are ranked.
    const staticRoutes: RouteManifest = {
      ...routes,
      'routes/about': {
        id: 'routes/about',
        parentId: 'root',
        file: 'app/routes/about.tsx',
        path: 'about',
      },
    };
    expect(
      getRegExpFromPath(
        getPathFromRoute(staticRoutes['routes/about'], staticRoutes).rePath
      )
    ).toBe(false);
  });
});
