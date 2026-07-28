import type { LoaderFunctionArgs } from "react-router";
import { searchContent } from "../lib/content.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  return Response.json(
    { query, hits: await searchContent(query) },
    {
      headers: {
        "Cache-Control": "private, max-age=30",
      },
    },
  );
}
