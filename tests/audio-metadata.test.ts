import {
  LyricsContentType,
  TimestampFormat,
  type ILyricsTag,
} from "music-metadata";
import { describe, expect, it } from "vitest";
import {
  audioTitleFromFilename,
  embeddedLyricsToText,
  nativeLyricsToText,
  readRiffInfoMetadata,
  resolveAudioFileFormat,
} from "../app/lib/audio-metadata.server";

describe("resolveAudioFileFormat", () => {
  it.each([
    ["作品.FLAC", "", { extension: "flac", mimeType: "audio/flac" }],
    ["demo.mp3", "audio/x-mpeg", { extension: "mp3", mimeType: "audio/mpeg" }],
    [
      "demo.WAVE",
      "application/octet-stream",
      { extension: "wav", mimeType: "audio/wav" },
    ],
    [
      "没有扩展名",
      "audio/x-wav",
      { extension: "wav", mimeType: "audio/wav" },
    ],
  ])("recognizes %s", (name, type, expected) => {
    expect(resolveAudioFileFormat({ name, type })).toEqual(expected);
  });

  it("does not trust an unrelated file", () => {
    expect(
      resolveAudioFileFormat({
        name: "surprise.exe",
        type: "application/octet-stream",
      }),
    ).toBeNull();
  });
});

describe("embeddedLyricsToText", () => {
  it("turns millisecond-synchronized lyrics into LRC", () => {
    const tags: ILyricsTag[] = [
      {
        contentType: LyricsContentType.lyrics,
        timeStampFormat: TimestampFormat.milliseconds,
        syncText: [
          { timestamp: 8_650, text: "第二句" },
          { timestamp: 3_200, text: "第一句" },
        ],
      },
    ];

    expect(embeddedLyricsToText(tags)).toEqual({
      lyrics: "[00:03.200]第一句\n[00:08.650]第二句",
      synchronized: true,
    });
  });

  it("keeps synchronized original and translated lyric tracks together", () => {
    const tags: ILyricsTag[] = [
      {
        contentType: LyricsContentType.lyrics,
        timeStampFormat: TimestampFormat.milliseconds,
        syncText: [{ timestamp: 1_430, text: "沈むように" }],
      },
      {
        contentType: LyricsContentType.lyrics,
        timeStampFormat: TimestampFormat.milliseconds,
        syncText: [{ timestamp: 1_430, text: "像是沉溺一般" }],
      },
    ];

    expect(embeddedLyricsToText(tags)).toEqual({
      lyrics: "[00:01.430]沈むように\n[00:01.430]像是沉溺一般",
      synchronized: true,
    });
  });

  it("keeps plain embedded lyrics intact", () => {
    const tags: ILyricsTag[] = [
      {
        contentType: LyricsContentType.lyrics,
        timeStampFormat: TimestampFormat.notSynchronized,
        text: "第一行\n第二行",
        syncText: [],
      },
    ];

    expect(embeddedLyricsToText(tags)).toEqual({
      lyrics: "第一行\n第二行",
      synchronized: false,
    });
  });

  it("recognizes LRC stored in an unsynchronized lyric frame", () => {
    const tags: ILyricsTag[] = [
      {
        contentType: LyricsContentType.lyrics,
        timeStampFormat: TimestampFormat.notSynchronized,
        text: "[00:01.000]其实带着时间",
        syncText: [],
      },
    ];

    expect(embeddedLyricsToText(tags).synchronized).toBe(true);
  });

  it("reads the non-standard lyric tag written by FFmpeg to MP3", () => {
    expect(
      nativeLyricsToText({
        "ID3v2.3": [
          {
            id: "TXXX:USLT",
            value: "[00:00.000]藏在 TXXX 里",
          },
        ],
      }),
    ).toEqual({
      lyrics: "[00:00.000]藏在 TXXX 里",
      synchronized: true,
    });
  });
});

describe("audioTitleFromFilename", () => {
  it("uses a clean filename when the title tag is absent", () => {
    expect(audioTitleFromFilename("今天也不想起床.wav")).toBe(
      "今天也不想起床",
    );
  });
});

describe("readRiffInfoMetadata", () => {
  function chunk(id: string, value: Buffer) {
    const size = Buffer.alloc(4);
    size.writeUInt32LE(value.length);
    return Buffer.concat([
      Buffer.from(id, "ascii"),
      size,
      value,
      value.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0),
    ]);
  }

  it("decodes UTF-8 INFO tags in WAV without losing Chinese text", () => {
    const info = Buffer.concat([
      Buffer.from("INFO", "ascii"),
      chunk("INAM", Buffer.from("纸张小曲\0", "utf8")),
      chunk("IART", Buffer.from("测试歌手\0", "utf8")),
      chunk("ILYR", Buffer.from("[00:01.000]第一句\0", "utf8")),
    ]);
    const body = Buffer.concat([
      Buffer.from("WAVE", "ascii"),
      chunk("LIST", info),
    ]);
    const riffSize = Buffer.alloc(4);
    riffSize.writeUInt32LE(body.length);
    const wav = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      riffSize,
      body,
    ]);

    expect(readRiffInfoMetadata(wav)).toEqual({
      title: "纸张小曲",
      artist: "测试歌手",
      lyrics: "[00:01.000]第一句",
    });
  });
});
