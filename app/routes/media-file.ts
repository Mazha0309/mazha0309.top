import type { LoaderFunctionArgs } from "react-router";
import { mediaContentType, readMediaFile } from "../lib/media.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const id = params.id;
  const filename = params.filename;
  if (!id || !filename) throw new Response("Not found", { status: 404 });
  const bytes = await readMediaFile(id, filename);
  const etag = `"${id}-${filename}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304 });
  }
  return new Response(bytes, {
    headers: {
      "Content-Type": mediaContentType(filename),
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
