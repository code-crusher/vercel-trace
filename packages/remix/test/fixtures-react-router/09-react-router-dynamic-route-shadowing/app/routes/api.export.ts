import type { Route } from "./+types/api.export";

// A resource route with a per-route `config`. Because `maxDuration` differs
// from the default bundle's config, the Vercel preset builds this route into
// its own server bundle. The dynamic rule emitted for this route must be
// matched before the earlier, less specific `/:slug/*` rule.
export const config = {
  maxDuration: 300,
};

export async function action({ params }: Route.ActionArgs) {
  return Response.json({ ok: true, servedBy: "export route", id: params.id });
}

export async function loader({ params }: Route.LoaderArgs) {
  return Response.json({ ok: true, servedBy: "export route", id: params.id });
}
