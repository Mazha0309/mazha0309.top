import {
  LyricsContentType,
  TimestampFormat,
  parseBuffer,
  selectCover,
  type IAudioMetadata,
  type ILyricsTag,
  type IPicture,
} from "music-metadata";

export type AudioExtension = "mp3" | "flac" | "wav" | "m4a" | "ogg";

export interface AudioFileFormat {
  extension: AudioExtension;
  mimeType: string;
}

export interface EmbeddedAudioMetadata {
  title: string;
  artist: string;
  lyrics: string;
  synchronizedLyrics: boolean;
  picture: IPicture | null;
}

const FORMATS: Record<AudioExtension, AudioFileFormat> = {
  mp3: { extension: "mp3", mimeType: "audio/mpeg" },
  flac: { extension: "flac", mimeType: "audio/flac" },
  wav: { extension: "wav", mimeType: "audio/wav" },
  m4a: { extension: "m4a", mimeType: "audio/mp4" },
  ogg: { extension: "ogg", mimeType: "audio/ogg" },
};

const EXTENSION_ALIASES = new Map<string, AudioExtension>([
  ["mp3", "mp3"],
  ["flac", "flac"],
  ["wav", "wav"],
  ["wave", "wav"],
  ["m4a", "m4a"],
  ["ogg", "ogg"],
  ["oga", "ogg"],
]);

const MIME_ALIASES = new Map<string, AudioExtension>([
  ["audio/mpeg", "mp3"],
  ["audio/mp3", "mp3"],
  ["audio/x-mpeg", "mp3"],
  ["audio/flac", "flac"],
  ["audio/x-flac", "flac"],
  ["audio/wav", "wav"],
  ["audio/wave", "wav"],
  ["audio/x-wav", "wav"],
  ["audio/vnd.wave", "wav"],
  ["audio/mp4", "m4a"],
  ["audio/x-m4a", "m4a"],
  ["audio/ogg", "ogg"],
]);

export function resolveAudioFileFormat(input: {
  name: string;
  type: string;
}): AudioFileFormat | null {
  const extension = input.name.split(".").at(-1)?.toLowerCase() ?? "";
  const extensionMatch = EXTENSION_ALIASES.get(extension);
  if (extensionMatch) return FORMATS[extensionMatch];
  const mimeMatch = MIME_ALIASES.get(input.type.trim().toLowerCase());
  return mimeMatch ? FORMATS[mimeMatch] : null;
}

export function audioTitleFromFilename(filename: string) {
  const withoutExtension = filename.replace(/\.[^.]+$/u, "").trim();
  return (withoutExtension || "没有名字的声音").slice(0, 160);
}

function lrcTimestamp(milliseconds: number) {
  const safe = Math.max(0, Math.round(milliseconds));
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1_000);
  const fraction = safe % 1_000;
  return `[${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(fraction).padStart(3, "0")}]`;
}

function looksLikeLrc(value: string) {
  return /(?:^|\n)\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/u.test(value);
}

function synchronizedTag(tags: ILyricsTag[]) {
  return (
    tags.find(
      (tag) =>
        tag.contentType === LyricsContentType.lyrics &&
        tag.timeStampFormat === TimestampFormat.milliseconds &&
        tag.syncText.some(
          (line) =>
            Number.isFinite(line.timestamp) && Boolean(line.text.trim()),
        ),
    ) ??
    tags.find(
      (tag) =>
        tag.timeStampFormat === TimestampFormat.milliseconds &&
        tag.syncText.some(
          (line) =>
            Number.isFinite(line.timestamp) && Boolean(line.text.trim()),
        ),
    )
  );
}

export function embeddedLyricsToText(tags: ILyricsTag[] | undefined) {
  if (!tags?.length) {
    return { lyrics: "", synchronized: false };
  }

  const synchronized = synchronizedTag(tags);
  if (synchronized) {
    const lyrics = synchronized.syncText
      .filter(
        (line) =>
          Number.isFinite(line.timestamp) && Boolean(line.text.trim()),
      )
      .sort(
        (left, right) =>
          (left.timestamp ?? 0) - (right.timestamp ?? 0),
      )
      .map(
        (line) =>
          `${lrcTimestamp(line.timestamp ?? 0)}${line.text.replace(/\s*\n+\s*/gu, " ").trim()}`,
      )
      .join("\n");
    return { lyrics: lyrics.slice(0, 80_000), synchronized: true };
  }

  const plain = tags.find((tag) => tag.text?.trim())?.text?.trim();
  if (plain) {
    const lyrics = plain.slice(0, 80_000);
    return { lyrics, synchronized: looksLikeLrc(lyrics) };
  }

  const joined = tags
    .flatMap((tag) => tag.syncText)
    .map((line) => line.text.trim())
    .filter(Boolean)
    .join("\n");
  return { lyrics: joined.slice(0, 80_000), synchronized: false };
}

const NATIVE_LYRIC_IDS = new Set([
  "USLT",
  "SYLT",
  "TXXX:USLT",
  "TXXX:LYRICS",
  "TXXX:UNSYNCEDLYRICS",
  "LYRICS",
  "UNSYNCEDLYRICS",
  "WM/LYRICS",
  "©LYR",
  "ILYR",
  "ILRC",
]);

function nativeValueText(value: unknown) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const text = Reflect.get(value, "text");
  return typeof text === "string" ? text : "";
}

export function nativeLyricsToText(
  native: IAudioMetadata["native"] | undefined,
) {
  if (!native) return { lyrics: "", synchronized: false };
  for (const tags of Object.values(native)) {
    for (const tag of tags) {
      if (!NATIVE_LYRIC_IDS.has(tag.id.trim().toUpperCase())) continue;
      const lyrics = nativeValueText(tag.value).trim().slice(0, 80_000);
      if (lyrics) {
        return { lyrics, synchronized: looksLikeLrc(lyrics) };
      }
    }
  }
  return { lyrics: "", synchronized: false };
}

interface RiffInfoMetadata {
  title: string;
  artist: string;
  lyrics: string;
}

function decodeRiffInfoText(value: Buffer) {
  const nullIndex = value.indexOf(0);
  const content = value.subarray(0, nullIndex < 0 ? value.length : nullIndex);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(content).trim();
  } catch {
    return "";
  }
}

export function readRiffInfoMetadata(bytes: Uint8Array): RiffInfoMetadata {
  const result: RiffInfoMetadata = { title: "", artist: "", lyrics: "" };
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    buffer.length < 12 ||
    buffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buffer.subarray(8, 12).toString("ascii") !== "WAVE"
  ) {
    return result;
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.subarray(offset, offset + 4).toString("ascii");
    const size = buffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + size;
    if (dataEnd > buffer.length) break;
    if (
      id === "LIST" &&
      size >= 4 &&
      buffer.subarray(dataStart, dataStart + 4).toString("ascii") === "INFO"
    ) {
      let infoOffset = dataStart + 4;
      while (infoOffset + 8 <= dataEnd) {
        const infoId = buffer
          .subarray(infoOffset, infoOffset + 4)
          .toString("ascii");
        const infoSize = buffer.readUInt32LE(infoOffset + 4);
        const valueStart = infoOffset + 8;
        const valueEnd = valueStart + infoSize;
        if (valueEnd > dataEnd) break;
        const isLabel = infoId === "INAM" || infoId === "IART";
        const isLyrics = infoId === "ILYR" || infoId === "ILRC";
        if (isLabel || isLyrics) {
          const maxBytes = isLyrics ? 320_004 : 1_024;
          const value = decodeRiffInfoText(
            buffer.subarray(valueStart, Math.min(valueEnd, valueStart + maxBytes)),
          ).slice(0, isLyrics ? 80_000 : 160);
          if (infoId === "INAM" && value) result.title = value;
          if (infoId === "IART" && value) result.artist = value;
          if (isLyrics && value) result.lyrics = value;
        }
        infoOffset = valueEnd + (infoSize % 2);
      }
    }
    offset = dataEnd + (size % 2);
  }
  return result;
}

function cleanLabel(value: string | undefined) {
  return (value ?? "")
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 160);
}

export async function readEmbeddedAudioMetadata(
  bytes: Uint8Array,
  file: { name: string; size: number },
  format: AudioFileFormat,
): Promise<EmbeddedAudioMetadata> {
  const metadata = await parseBuffer(
    bytes,
    {
      mimeType: format.mimeType,
      path: file.name,
      size: file.size,
    },
    { duration: false, skipCovers: false },
  );
  const riff =
    format.extension === "wav"
      ? readRiffInfoMetadata(bytes)
      : { title: "", artist: "", lyrics: "" };
  const hasId3 = Object.keys(metadata.native).some((tagType) =>
    tagType.toUpperCase().startsWith("ID3"),
  );
  const commonLyrics = embeddedLyricsToText(metadata.common.lyrics);
  const nativeLyrics = nativeLyricsToText(metadata.native);
  const lyrics = commonLyrics.lyrics
    ? commonLyrics
    : nativeLyrics.lyrics
      ? nativeLyrics
      : {
          lyrics: riff.lyrics,
          synchronized: looksLikeLrc(riff.lyrics),
        };
  return {
    title: cleanLabel(
      hasId3 ? metadata.common.title : riff.title || metadata.common.title,
    ),
    artist: cleanLabel(
      hasId3
        ? metadata.common.artist || metadata.common.albumartist
        : riff.artist ||
            metadata.common.artist ||
            metadata.common.albumartist,
    ),
    lyrics: lyrics.lyrics,
    synchronizedLyrics: lyrics.synchronized,
    picture: selectCover(metadata.common.picture) ?? null,
  };
}
