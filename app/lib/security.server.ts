export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const requestOrigin = new URL(request.url).origin;
  if (origin !== requestOrigin) {
    throw new Response("Cross-origin request rejected", { status: 403 });
  }
}

export function formString(
  form: FormData,
  key: string,
  options: { max?: number; required?: boolean } = {},
) {
  const value = form.get(key);
  const result = typeof value === "string" ? value.trim() : "";
  if (options.required && !result) {
    throw new Response(`${key} is required`, { status: 400 });
  }
  return result.slice(0, options.max ?? 200_000);
}
