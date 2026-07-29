import { describe, expect, it } from "vitest";
import {
  isPlaybackMode,
  nextPlaybackIndex,
  nextPlaybackMode,
} from "../app/lib/music-playback";

describe("music playback modes", () => {
  it("cycles through list, single, and shuffle modes", () => {
    expect(nextPlaybackMode("list")).toBe("single");
    expect(nextPlaybackMode("single")).toBe("shuffle");
    expect(nextPlaybackMode("shuffle")).toBe("list");
    expect(isPlaybackMode("shuffle")).toBe(true);
    expect(isPlaybackMode("surprise")).toBe(false);
  });

  it("loops the list and repeats the current track in single mode", () => {
    expect(nextPlaybackIndex("list", 2, 3)).toBe(0);
    expect(nextPlaybackIndex("single", 2, 3)).toBe(2);
  });

  it("never picks the current track while shuffling", () => {
    expect(nextPlaybackIndex("shuffle", 1, 3, () => 0)).toBe(0);
    expect(nextPlaybackIndex("shuffle", 1, 3, () => 0.999)).toBe(2);
    expect(nextPlaybackIndex("shuffle", 0, 1, () => 0.5)).toBe(0);
  });
});
