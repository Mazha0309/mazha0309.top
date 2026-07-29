import type { ActionFunctionArgs } from "react-router";
import { createHash, randomUUID } from "node:crypto";
import { recordPageView } from "../lib/content.server";
import { isSafeInternalPath } from "../lib/content-utils";

const visitorCookieName = "mazha_visitor";
const visitorIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function readCookie(request: Request, name: string) {
  const source = request.headers.get("cookie") ?? "";
  for (const pair of source.split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(pair.slice(separator + 1).trim());
    } catch {
      return "";
    }
  }
  return "";
}

function visitorCookie(value: string) {
  return [
    `${visitorCookieName}=${encodeURIComponent(value)}`,
    "Path=/",
    "Max-Age=31536000",
    "HttpOnly",
    "SameSite=Lax",
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

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

  const storedVisitorId = readCookie(request, visitorCookieName);
  const hasValidVisitorId = visitorIdPattern.test(storedVisitorId);
  const visitorId = hasValidVisitorId ? storedVisitorId : randomUUID();
  const visitorHash = createHash("sha256").update(visitorId).digest("hex");

  await recordPageView(path, visitorHash);
  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "private, no-store",
      ...(hasValidVisitorId
        ? {}
        : { "Set-Cookie": visitorCookie(visitorId) }),
    },
  });
}
