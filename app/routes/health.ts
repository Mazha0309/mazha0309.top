import type { LoaderFunctionArgs } from "react-router";
import { getPool, hasDatabase } from "../lib/db.server";

export async function loader(_args: LoaderFunctionArgs) {
  if (!hasDatabase()) {
    return Response.json({
      ok: true,
      database: "fallback",
      timestamp: new Date().toISOString(),
    });
  }
  try {
    await getPool().query("select 1");
    return Response.json({
      ok: true,
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return Response.json(
      { ok: false, database: "unavailable" },
      { status: 503 },
    );
  }
}
