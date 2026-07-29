export type PlaybackMode = "list" | "single" | "shuffle";

export const PLAYBACK_MODES: PlaybackMode[] = [
  "list",
  "single",
  "shuffle",
];

export const PLAYBACK_MODE_LABELS: Record<PlaybackMode, string> = {
  list: "列表循环",
  single: "单曲循环",
  shuffle: "随机播放",
};

export const PLAYBACK_MODE_MARKS: Record<PlaybackMode, string> = {
  list: "↻",
  single: "↺¹",
  shuffle: "⤨",
};

export function isPlaybackMode(value: string | null): value is PlaybackMode {
  return PLAYBACK_MODES.includes(value as PlaybackMode);
}

export function nextPlaybackMode(mode: PlaybackMode) {
  const index = PLAYBACK_MODES.indexOf(mode);
  return PLAYBACK_MODES[(index + 1) % PLAYBACK_MODES.length] ?? "list";
}

export function nextPlaybackIndex(
  mode: PlaybackMode,
  currentIndex: number,
  trackCount: number,
  random: () => number = Math.random,
) {
  if (trackCount <= 1) return 0;
  const safeCurrent = Math.max(0, Math.min(trackCount - 1, currentIndex));
  if (mode === "single") return safeCurrent;
  if (mode === "list") return (safeCurrent + 1) % trackCount;

  const randomValue = Math.max(0, Math.min(0.999999999, random()));
  const candidate = Math.floor(randomValue * (trackCount - 1));
  return candidate >= safeCurrent ? candidate + 1 : candidate;
}
