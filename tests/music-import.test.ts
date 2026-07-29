import { describe, expect, it } from "vitest";
import {
  MAX_MUSIC_FILE_BYTES,
  fingerprintMusicFile,
  formatMusicFileSize,
  formatMusicRemainingTime,
  formatMusicTransferRate,
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

describe("bulk import helpers", () => {
  it("creates the same SHA-256 fingerprint as the server", async () => {
    await expect(fingerprintMusicFile(new Blob(["hello"]))).resolves.toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("formats transfer speed and a useful long-running ETA", () => {
    expect(formatMusicTransferRate(35.6 * 1024)).toBe("36 KB/s");
    expect(formatMusicTransferRate(2.25 * 1024 * 1024)).toBe("2.3 MB/s");
    expect(formatMusicRemainingTime(3 * 60 * 60 + 25 * 60)).toBe(
      "约 3 小时 25 分",
    );
  });
});
