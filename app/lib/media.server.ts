import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  createMediaRecord,
  deleteMediaRecords,
  findMediaReferences,
  getMediaRecord,
} from "./content.server";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_AUDIO_BYTES = 32 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const AUDIO_EXTENSIONS = new Map([
  ["audio/mpeg", "mp3"],
  ["audio/mp4", "m4a"],
  ["audio/x-m4a", "m4a"],
  ["audio/ogg", "ogg"],
  ["audio/wav", "wav"],
  ["audio/x-wav", "wav"],
]);

export function mediaRoot() {
  return process.env.MEDIA_ROOT ?? path.resolve("data/media");
}

export async function storeImage(file: File, alt: string) {
  if (!alt.trim()) throw new Error("图片必须填写替代文本（alt）。");
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("只接受 PNG、JPEG、WebP 或 GIF；SVG 会被拒绝。");
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
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
  try {
    const writes = await Promise.allSettled([
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
    const failedWrite = writes.find(
      (result): result is PromiseRejectedResult =>
        result.status === "rejected",
    );
    if (failedWrite) throw failedWrite.reason;

    return await createMediaRecord({
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
  } catch (error) {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

function looksLikeMp3(bytes: Buffer) {
  if (bytes.subarray(0, 3).toString("ascii") === "ID3") return true;
  const searchLimit = Math.min(bytes.length - 1, 4096);
  for (let index = 0; index < searchLimit; index += 1) {
    if (bytes[index] === 0xff && (bytes[index + 1] & 0xe0) === 0xe0) {
      return true;
    }
  }
  return false;
}

function looksLikeAudio(bytes: Buffer, mimeType: string) {
  if (mimeType === "audio/mpeg") return looksLikeMp3(bytes);
  if (mimeType === "audio/ogg") {
    return bytes.subarray(0, 4).toString("ascii") === "OggS";
  }
  if (mimeType === "audio/wav" || mimeType === "audio/x-wav") {
    return (
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WAVE"
    );
  }
  if (mimeType === "audio/mp4" || mimeType === "audio/x-m4a") {
    return bytes.subarray(4, 8).toString("ascii") === "ftyp";
  }
  return false;
}

export async function storeAudio(file: File, label: string) {
  const extension = AUDIO_EXTENSIONS.get(file.type);
  if (!extension) {
    throw new Error("只接受 MP3、M4A、OGG 或 WAV 音频。");
  }
  if (file.size <= 0 || file.size > MAX_AUDIO_BYTES) {
    throw new Error("音频大小必须在 1 B 到 32 MB 之间。");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!looksLikeAudio(bytes, file.type)) {
    throw new Error("这个文件的内容不像它声称的音频格式，先不让它混进歌单。");
  }

  const id = crypto.randomUUID();
  const originalName = `original.${extension}`;
  const directory = path.join(mediaRoot(), id);
  await mkdir(directory, { recursive: true });

  try {
    await writeFile(path.join(directory, originalName), bytes, { flag: "wx" });
    return await createMediaRecord({
      storageKey: `${id}/${originalName}`,
      originalName: file.name,
      mimeType: file.type,
      alt: label.trim() || file.name,
      width: null,
      height: null,
      sizeBytes: file.size,
      variants: {
        original: `/media/${id}/${originalName}`,
      },
    });
  } catch (error) {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

export async function deleteStoredMedia(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw new Error("媒体编号无效。");
  }
  const record = await getMediaRecord(id);
  if (!record) throw new Error("这个文件已经不在媒体抽屉里了。");

  const storageId = record.storageKey.split("/")[0];
  if (!/^[0-9a-f-]{36}$/i.test(storageId)) {
    throw new Error("媒体存储目录无效，已拒绝删除。");
  }
  const references = await findMediaReferences(storageId);
  if (references.length) {
    const visible = references.slice(0, 4).join("、");
    const remaining =
      references.length > 4 ? `等 ${references.length} 处` : "";
    throw new Error(
      `暂时不能删除：仍被 ${visible}${remaining} 使用。先移除引用再来取下它。`,
    );
  }

  await deleteMediaRecords([id]);
  await rm(path.join(mediaRoot(), storageId), { recursive: true, force: true });
  return record;
}

export const deleteStoredImage = deleteStoredMedia;

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
  if (filename.endsWith(".mp3")) return "audio/mpeg";
  if (filename.endsWith(".m4a")) return "audio/mp4";
  if (filename.endsWith(".ogg")) return "audio/ogg";
  if (filename.endsWith(".wav")) return "audio/wav";
  return "image/jpeg";
}
