import { describe, expect, it } from "vitest";
import { activeLyricIndex, parseLyrics } from "../app/lib/lyrics";

describe("parseLyrics", () => {
  it("parses and sorts LRC timestamps", () => {
    const parsed = parseLyrics(
      "[ti:Demo]\n[00:10.50]第二句\n[00:03.2][00:05.250]第一句",
    );

    expect(parsed.timed).toBe(true);
    expect(parsed.lines).toEqual([
      { time: 3.2, text: "第一句" },
      { time: 5.25, text: "第一句" },
      { time: 10.5, text: "第二句" },
    ]);
  });

  it("applies the LRC offset and never creates negative time", () => {
    const parsed = parseLyrics(
      "[offset:-500]\n[00:00.20]开头\n[01:02.00]后来",
    );

    expect(parsed.lines).toEqual([
      { time: 0, text: "开头" },
      { time: 61.5, text: "后来" },
    ]);
  });

  it("keeps ordinary lyrics as unsynchronised lines", () => {
    const parsed = parseLyrics("第一行\r\n\r\n第二行");

    expect(parsed).toEqual({
      timed: false,
      lines: [
        { time: null, text: "第一行" },
        { time: null, text: "第二行" },
      ],
    });
  });
});

describe("activeLyricIndex", () => {
  const lines = parseLyrics(
    "[00:01.00]一\n[00:04.00]二\n[00:09.00]三",
  ).lines;

  it("finds the latest lyric at or before the current time", () => {
    expect(activeLyricIndex(lines, 0.5)).toBe(-1);
    expect(activeLyricIndex(lines, 4)).toBe(1);
    expect(activeLyricIndex(lines, 30)).toBe(2);
  });
});
