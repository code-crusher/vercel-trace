import { type RouteConfig, route } from "@react-router/dev/routes";

// Repro for https://github.com/vercel/vercel/issues/17679
//
// The catch-all (`:slug` + `*`) is intentionally defined *before* the more
// specific `api/items/:id/export` route. React Router ranks routes by
// specificity, so the request reaches `export.ts` locally and with
// `react-router-serve`. On Vercel, the builder used to emit the dynamic route
// patterns in definition order, so `/:slug/*` captured
// `POST /api/items/123/export` and the request never reached the export route.
//
// `export.ts` exports a `config` with a different `maxDuration`, which forces
// it into its own server bundle (this is what makes the bug observable — if
// every route shared one bundle, the default function would still contain
// `export.ts` and React Router would route to it).
export default [
  route(":slug", "routes/page.tsx", [route("*", "routes/not-found.tsx")]),
  route("api/items/:id/export", "routes/api.export.ts"),
] satisfies RouteConfig;
