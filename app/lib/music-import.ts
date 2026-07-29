export const MAX_MUSIC_FILE_BYTES = 64 * 1024 * 1024;

export const MUSIC_FILE_ACCEPT =
  ".flac,.mp3,.wav,.wave,.m4a,.ogg,.oga,audio/flac,audio/x-flac,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/ogg";

const SUPPORTED_EXTENSIONS = new Set([
  "flac",
  "mp3",
  "wav",
  "wave",
  "m4a",
  "ogg",
  "oga",
]);

export interface MusicFileLike {
  name: string;
  size: number;
  webkitRelativePath?: string;
}

export function musicFileProblem(file: MusicFileLike) {
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    return "不是支持的音频格式";
  }
  if (file.size <= 0) return "文件是空的";
  if (file.size > MAX_MUSIC_FILE_BYTES) return "单曲超过 64 MB";
  return null;
}

export function musicFileDisplayName(file: MusicFileLike) {
  return file.webkitRelativePath || file.name;
}

export function sortMusicFiles<T extends MusicFileLike>(files: T[]) {
  return [...files].sort((left, right) =>
    musicFileDisplayName(left).localeCompare(
      musicFileDisplayName(right),
      "zh-CN",
      { numeric: true, sensitivity: "base" },
    ),
  );
}

export function formatMusicFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function fingerprintMusicFile(file: Blob) {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function formatMusicTransferRate(bytesPerSecond: number) {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "";
  if (bytesPerSecond < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytesPerSecond / 1024))} KB/s`;
  }
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
}

export function formatMusicRemainingTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "不到 1 分钟";
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  if (minutes < 60) return `约 ${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `约 ${hours} 小时 ${remainingMinutes} 分` : `约 ${hours} 小时`;
}
