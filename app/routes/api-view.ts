import type { ActionFunctionArgs } from "react-router";
import { recordPageView } from "../lib/content.server";
import { isSafeInternalPath } from "../lib/content-utils";

export async function action({ request }: ActionFunctionArgs) {
  if (
    request.headers.get("dnt") === "1" ||
    request.headers.get("sec-gpc") === "1"
  ) {
    return new Response(null, { status: 204 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const path =
    typeof body === "object" &&
    body !== null &&
    "path" in body &&
    typeof body.path === "string"
      ? body.path.slice(0, 240)
      : "";
  if (!path || !isSafeInternalPath(path) || path.startsWith("/admin")) {
    return Response.json({ error: "Invalid path" }, { status: 400 });
  }

  await recordPageView(path);
  return new Response(null, { status: 204 });
}
