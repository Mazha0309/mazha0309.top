import type { LoaderFunctionArgs } from "react-router";
import { collectReadiness } from "../lib/system-probe.server";

export async function loader(_args: LoaderFunctionArgs) {
  const readiness = await collectReadiness();
  return Response.json(readiness, {
    status: readiness.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
