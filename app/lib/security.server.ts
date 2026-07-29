function normalizedHttpOrigin(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Origin must use http or https.");
  }
  return url.origin;
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;

  let expectedOrigin: string;
  try {
    // Behind Caddy/Cloudflare, Request.url can use the internal HTTP scheme even
    // though the browser correctly sends the public HTTPS Origin. APP_ORIGIN is
    // the administrator-controlled canonical boundary and must win in production.
    expectedOrigin = normalizedHttpOrigin(
      process.env.APP_ORIGIN?.trim() || request.url,
    );
  } catch {
    throw new Response("Server origin configuration is invalid", {
      status: 500,
    });
  }

  let submittedOrigin: string;
  try {
    submittedOrigin = normalizedHttpOrigin(origin);
  } catch {
    throw new Response("Cross-origin request rejected", { status: 403 });
  }

  if (submittedOrigin !== expectedOrigin) {
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
