import { describe, expect, it } from "vitest";
import {
  MAX_MUSIC_FILE_BYTES,
  formatMusicFileSize,
  musicFileProblem,
  sortMusicFiles,
} from "../app/lib/music-import";

describe("musicFileProblem", () => {
  it.each(["song.mp3", "song.FLAC", "song.wav", "song.m4a", "song.oga"])(
    "accepts %s",
    (name) => {
      expect(musicFileProblem({ name, size: 1024 })).toBeNull();
    },
  );

  it("rejects unrelated, empty, and oversized files before upload", () => {
    expect(musicFileProblem({ name: "cover.jpg", size: 1024 })).toBe(
      "不是支持的音频格式",
    );
    expect(musicFileProblem({ name: "empty.mp3", size: 0 })).toBe(
      "文件是空的",
    );
    expect(
      musicFileProblem({
        name: "too-big.flac",
        size: MAX_MUSIC_FILE_BYTES + 1,
      }),
    ).toBe("单曲超过 64 MB");
  });
});

describe("sortMusicFiles", () => {
  it("keeps a folder import in natural path order", () => {
    const files = [
      { name: "10.mp3", size: 1, webkitRelativePath: "Music/10.mp3" },
      { name: "2.mp3", size: 1, webkitRelativePath: "Music/2.mp3" },
      { name: "1.mp3", size: 1, webkitRelativePath: "Music/1.mp3" },
    ];

    expect(sortMusicFiles(files).map((file) => file.name)).toEqual([
      "1.mp3",
      "2.mp3",
      "10.mp3",
    ]);
  });
});

describe("formatMusicFileSize", () => {
  it("formats the small receipt labels", () => {
    expect(formatMusicFileSize(512)).toBe("1 KB");
    expect(formatMusicFileSize(5.25 * 1024 * 1024)).toBe("5.3 MB");
  });
});
