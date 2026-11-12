import type { Route } from "./+types/not-found";

// Nested catch-all under the dynamic `:slug` route. A request that falls
// through to the page route's branch renders this component.
export async function loader({ request }: Route.LoaderArgs) {
  return { servedBy: "not-found route", url: request.url };
}

export default function NotFound({ loaderData }: Route.ComponentProps) {
  return (
    <main>
      <h1>Not found</h1>
      <p>This request was served by the not-found catch-all route.</p>
      <pre>{JSON.stringify(loaderData, null, 2)}</pre>
    </main>
  );
}
