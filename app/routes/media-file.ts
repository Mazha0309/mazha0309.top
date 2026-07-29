import type { LoaderFunctionArgs } from "react-router";
import { mediaContentType, readMediaFile } from "../lib/media.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const id = params.id;
  const filename = params.filename;
  if (!id || !filename) throw new Response("Not found", { status: 404 });
  const bytes = await readMediaFile(id, filename);
  const etag = `"${id}-${filename}"`;
  const range = request.headers.get("range");
  if (!range && request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304 });
  }

  const commonHeaders = {
    "Content-Type": mediaContentType(filename),
    "Cache-Control": "public, max-age=31536000, immutable",
    ETag: etag,
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  };

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
    if (!match || (!match[1] && !match[2])) {
      return new Response(null, {
        status: 416,
        headers: {
          ...commonHeaders,
          "Content-Range": `bytes */${bytes.length}`,
        },
      });
    }

    const requestedStart = match[1] ? Number(match[1]) : null;
    const requestedEnd = match[2] ? Number(match[2]) : null;
    let start: number;
    let end: number;
    if (requestedStart === null) {
      const suffixLength = requestedEnd ?? 0;
      start = Math.max(0, bytes.length - suffixLength);
      end = bytes.length - 1;
    } else {
      start = requestedStart;
      end = Math.min(requestedEnd ?? bytes.length - 1, bytes.length - 1);
    }

    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end < start ||
      start >= bytes.length
    ) {
      return new Response(null, {
        status: 416,
        headers: {
          ...commonHeaders,
          "Content-Range": `bytes */${bytes.length}`,
        },
      });
    }

    const chunk = bytes.subarray(start, end + 1);
    return new Response(chunk, {
      status: 206,
      headers: {
        ...commonHeaders,
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes ${start}-${end}/${bytes.length}`,
      },
    });
  }

  return new Response(bytes, {
    headers: {
      ...commonHeaders,
      "Content-Length": String(bytes.length),
    },
  });
}
