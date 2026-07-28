import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createMediaRecord } from "./content.server";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export function mediaRoot() {
  return process.env.MEDIA_ROOT ?? path.resolve("data/media");
}

export async function storeImage(file: File, alt: string) {
  if (!alt.trim()) throw new Error("图片必须填写替代文本（alt）。");
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("只接受 PNG、JPEG、WebP 或 GIF；SVG 会被拒绝。");
  }
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    throw new Error("图片大小必须在 1 B 到 8 MB 之间。");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const probe = sharp(bytes, { animated: file.type === "image/gif" });
  const metadata = await probe.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("无法识别这张图片。");
  }

  const id = crypto.randomUUID();
  const originalExtension =
    file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const directory = path.join(mediaRoot(), id);
  await mkdir(directory, { recursive: true });

  const originalName = `original.${originalExtension}`;
  const webpName = "display.webp";
  const avifName = "display.avif";
  await Promise.all([
    writeFile(path.join(directory, originalName), bytes, { flag: "wx" }),
    sharp(bytes, { animated: file.type === "image/gif" })
      .rotate()
      .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toFile(path.join(directory, webpName)),
    sharp(bytes)
      .rotate()
      .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
      .avif({ quality: 66 })
      .toFile(path.join(directory, avifName)),
  ]);

  return createMediaRecord({
    storageKey: `${id}/${originalName}`,
    originalName: file.name,
    mimeType: file.type,
    alt: alt.trim(),
    width: metadata.width,
    height: metadata.height,
    sizeBytes: file.size,
    variants: {
      original: `/media/${id}/${originalName}`,
      webp: `/media/${id}/${webpName}`,
      avif: `/media/${id}/${avifName}`,
    },
  });
}

export async function readMediaFile(id: string, filename: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[a-z0-9.-]+$/i.test(filename)) {
    throw new Response("Not found", { status: 404 });
  }
  const fullPath = path.join(mediaRoot(), id, filename);
  try {
    return await readFile(fullPath);
  } catch {
    throw new Response("Not found", { status: 404 });
  }
}

export function mediaContentType(filename: string) {
  if (filename.endsWith(".avif")) return "image/avif";
  if (filename.endsWith(".webp")) return "image/webp";
  if (filename.endsWith(".png")) return "image/png";
  if (filename.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}
