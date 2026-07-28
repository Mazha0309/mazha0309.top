import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "../lib/auth.server";
import { collectSystemProbe } from "../lib/system-probe.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  return Response.json(await collectSystemProbe(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
