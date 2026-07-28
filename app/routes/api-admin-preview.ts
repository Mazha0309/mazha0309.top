import type { ActionFunctionArgs } from "react-router";
import { requireAdmin } from "../lib/auth.server";
import { renderSafeMdx } from "../lib/mdx.server";
import { requireSameOrigin } from "../lib/security.server";

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  requireSameOrigin(request);
  const body = (await request.json()) as { source?: unknown };
  if (typeof body.source !== "string") {
    return Response.json({ error: "Invalid source" }, { status: 400 });
  }
  try {
    return Response.json({ html: await renderSafeMdx(body.source) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Preview failed" },
      { status: 400 },
    );
  }
}
