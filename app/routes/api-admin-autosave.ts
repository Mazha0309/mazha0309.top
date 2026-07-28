import type { ActionFunctionArgs } from "react-router";
import { autosavePostContent, getAdminPost } from "../lib/content.server";
import { requireAdmin } from "../lib/auth.server";
import { validateMdx } from "../lib/mdx.server";
import { requireSameOrigin } from "../lib/security.server";

export async function action({ request, params }: ActionFunctionArgs) {
  await requireAdmin(request);
  requireSameOrigin(request);
  if (!params.id) return Response.json({ error: "Not found" }, { status: 404 });
  const post = await getAdminPost(params.id);
  if (!post) return Response.json({ error: "Not found" }, { status: 404 });
  const body = (await request.json()) as { contentMdx?: unknown };
  if (typeof body.contentMdx !== "string") {
    return Response.json({ error: "Invalid source" }, { status: 400 });
  }
  try {
    validateMdx(body.contentMdx);
    await autosavePostContent(post.id, body.contentMdx);
    return Response.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Autosave failed" },
      { status: 400 },
    );
  }
}
