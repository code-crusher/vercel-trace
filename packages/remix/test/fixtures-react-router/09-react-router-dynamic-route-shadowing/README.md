# 09-react-router-dynamic-route-shadowing

End-to-end fixture for
[vercel/vercel#17679](https://github.com/vercel/vercel/issues/17679):
a dynamic route in its own server bundle being shadowed by an earlier,
less specific catch-all route.

## What it covers

- **Route definition order vs. React Router ranking.** `app/routes.ts`
  defines the catch-all branch (`:slug` with a nested `*`) *before* the more
  specific `api/items/:id/export` route. React Router ranks routes by
  specificity, so locally the export route wins; on Vercel the builder used to
  emit dynamic-route regexes in definition order, so `/:slug/*` captured
  `POST /api/items/123/export` first.
- **Per-route function config splitting.** `app/routes/api.export.ts` exports
  `config = { maxDuration: 300 }`, which forces it into its own server bundle.
  Without that, both routes would share the default function and React Router
  would route the request correctly regardless of the emitted regex order.
- **Documents and `.data` URLs.** Probes cover the plain path, the
  single-fetch `.data` path, and a `POST` action against the export route.

## Layout

- `app/routes/page.tsx` is the dynamic `:slug` page route in the default
  bundle. Its loader returns `servedBy: "page route"`.
- `app/routes/not-found.tsx` is the nested `*` catch-all. Its loader returns
  `servedBy: "not-found route"`, so a request that falls through to the wrong
  branch fails its `mustContain` assertion.
- `app/routes/api.export.ts` is the `api/items/:id/export` resource route in
  its own bundle. Its loader/action return `servedBy: "export route"`.
