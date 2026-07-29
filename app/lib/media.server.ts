import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  createMediaRecord,
  deleteMediaRecords,
  findMediaReferences,
  getMediaRecord,
} from "./content.server";
import {
  readEmbeddedAudioMetadata,
  resolveAudioFileFormat,
  type AudioExtension,
  type EmbeddedAudioMetadata,
} from "./audio-metadata.server";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_AUDIO_BYTES = 64 * 1024 * 1024;
const MAX_EMBEDDED_COVER_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
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

function looksLikeAudio(bytes: Buffer, extension: AudioExtension) {
  if (extension === "mp3") return looksLikeMp3(bytes);
  if (extension === "flac") {
    return bytes.subarray(0, 4).toString("ascii") === "fLaC";
  }
  if (extension === "ogg") {
    return bytes.subarray(0, 4).toString("ascii") === "OggS";
  }
  if (extension === "wav") {
    return (
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WAVE"
    );
  }
  if (extension === "m4a") {
    return bytes.subarray(4, 8).toString("ascii") === "ftyp";
  }
  return false;
}

export async function storeAudio(file: File, label: string) {
  const format = resolveAudioFileFormat(file);
  if (!format) {
    throw new Error("只接受 FLAC、MP3、WAV、M4A 或 OGG 音频。");
  }
  if (file.size <= 0 || file.size > MAX_AUDIO_BYTES) {
    throw new Error("音频大小必须在 1 B 到 64 MB 之间。");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!looksLikeAudio(bytes, format.extension)) {
    throw new Error("这个文件的内容不像它声称的音频格式，先不让它混进歌单。");
  }

  const warnings: string[] = [];
  let embedded: EmbeddedAudioMetadata = {
    title: "",
    artist: "",
    lyrics: "",
    synchronizedLyrics: false,
    picture: null,
  };
  try {
    embedded = await readEmbeddedAudioMetadata(bytes, file, format);
  } catch {
    warnings.push("音频能收下，但内嵌标签没有读懂，需要手动补资料。");
  }

  const id = crypto.randomUUID();
  const originalName = `original.${format.extension}`;
  const directory = path.join(mediaRoot(), id);
  await mkdir(directory, { recursive: true });
  const variants: Record<string, string> = {
    original: `/media/${id}/${originalName}`,
  };

  try {
    await writeFile(path.join(directory, originalName), bytes, { flag: "wx" });
    if (embedded.picture) {
      const picture = Buffer.from(embedded.picture.data);
      if (
        picture.byteLength <= 0 ||
        picture.byteLength > MAX_EMBEDDED_COVER_BYTES
      ) {
        warnings.push("看见了内嵌封面，但它超过 8 MB，所以没有展开。");
      } else {
        const webpName = "cover.webp";
        const avifName = "cover.avif";
        try {
          const pictureMetadata = await sharp(picture, {
            limitInputPixels: 40_000_000,
          }).metadata();
          if (!pictureMetadata.width || !pictureMetadata.height) {
            throw new Error("embedded picture has no dimensions");
          }
          await Promise.all([
            sharp(picture, { limitInputPixels: 40_000_000 })
              .rotate()
              .resize({
                width: 1200,
                height: 1200,
                fit: "inside",
                withoutEnlargement: true,
              })
              .webp({ quality: 84 })
              .toFile(path.join(directory, webpName)),
            sharp(picture, { limitInputPixels: 40_000_000 })
              .rotate()
              .resize({
                width: 1200,
                height: 1200,
                fit: "inside",
                withoutEnlargement: true,
              })
              .avif({ quality: 66 })
              .toFile(path.join(directory, avifName)),
          ]);
          variants.coverWebp = `/media/${id}/${webpName}`;
          variants.coverAvif = `/media/${id}/${avifName}`;
        } catch {
          await Promise.all([
            rm(path.join(directory, webpName), { force: true }),
            rm(path.join(directory, avifName), { force: true }),
          ]).catch(() => undefined);
          warnings.push("看见了内嵌封面，但图片格式太怪，没有强行展开。");
        }
      }
    }

    const record = await createMediaRecord({
      storageKey: `${id}/${originalName}`,
      originalName: file.name,
      mimeType: format.mimeType,
      alt: embedded.title || label.trim() || file.name,
      width: null,
      height: null,
      sizeBytes: file.size,
      variants,
    });
    return {
      record,
      embedded: {
        title: embedded.title,
        artist: embedded.artist,
        lyrics: embedded.lyrics,
        synchronizedLyrics: embedded.synchronizedLyrics,
        coverUrl: variants.coverWebp ?? null,
      },
      warnings,
    };
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
  if (filename.endsWith(".flac")) return "audio/flac";
  if (filename.endsWith(".m4a")) return "audio/mp4";
  if (filename.endsWith(".ogg")) return "audio/ogg";
  if (filename.endsWith(".wav")) return "audio/wav";
  return "image/jpeg";
}
