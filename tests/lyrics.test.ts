import { describe, expect, it } from "vitest";
import { activeLyricIndex, parseLyrics } from "../app/lib/lyrics";

describe("parseLyrics", () => {
  it("parses and sorts LRC timestamps", () => {
    const parsed = parseLyrics(
      "[ti:Demo]\n[00:10.50]第二句\n[00:03.2][00:05.250]第一句",
    );

    expect(parsed.timed).toBe(true);
    expect(parsed.lines).toEqual([
      { time: 3.2, text: "第一句", translations: [] },
      { time: 5.25, text: "第一句", translations: [] },
      { time: 10.5, text: "第二句", translations: [] },
    ]);
  });

  it("applies the LRC offset and never creates negative time", () => {
    const parsed = parseLyrics(
      "[offset:-500]\n[00:00.20]开头\n[01:02.00]后来",
    );

    expect(parsed.lines).toEqual([
      { time: 0, text: "开头", translations: [] },
      { time: 61.5, text: "后来", translations: [] },
    ]);
  });

  it("groups translated lines that share the original timestamp", () => {
    const parsed = parseLyrics(
      [
        "[00:01.43]沈むように溶けてゆくように",
        "[00:01.43]像是沉溺溶化一般",
        "[00:08.83]二人だけの空が広がる夜に",
        "[00:08.83]在只有你我二人的广阔夜空之下",
      ].join("\n"),
    );

    expect(parsed.lines).toEqual([
      {
        time: 1.43,
        text: "沈むように溶けてゆくように",
        translations: ["像是沉溺溶化一般"],
      },
      {
        time: 8.83,
        text: "二人だけの空が広がる夜に",
        translations: ["在只有你我二人的广阔夜空之下"],
      },
    ]);
    expect(activeLyricIndex(parsed.lines, 1.43)).toBe(0);
    expect(activeLyricIndex(parsed.lines, 8.83)).toBe(1);
  });

  it("keeps ordinary lyrics as unsynchronised lines", () => {
    const parsed = parseLyrics("第一行\r\n\r\n第二行");

    expect(parsed).toEqual({
      timed: false,
      lines: [
        { time: null, text: "第一行", translations: [] },
        { time: null, text: "第二行", translations: [] },
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
