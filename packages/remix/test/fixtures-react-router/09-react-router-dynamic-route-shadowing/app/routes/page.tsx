import type { Route } from "./+types/page";

// A dynamic page route that lives in the default server bundle. It has a
// nested catch-all child, so its URL pattern is `/:slug/*`.
export async function loader({ params }: Route.LoaderArgs) {
  return { servedBy: "page route", slug: params.slug };
}

export default function Page({ loaderData }: Route.ComponentProps) {
  return (
    <main>
      <h1>Page route</h1>
      <p>This request was served by the page route.</p>
      <pre>{JSON.stringify(loaderData, null, 2)}</pre>
    </main>
  );
}
