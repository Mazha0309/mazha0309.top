import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "../lib/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  throw redirect("/admin/pages#now");
}
