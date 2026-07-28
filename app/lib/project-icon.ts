import type { ProjectIconMode, ProjectIconShape } from "./types";

export const projectIconPresets = [
  { value: "spark", label: "星光", glyph: "✦" },
  { value: "code", label: "代码", glyph: "</>" },
  { value: "radio", label: "电波", glyph: "⌁" },
  { value: "orbit", label: "轨道", glyph: "◎" },
  { value: "link", label: "跳转", glyph: "↗" },
  { value: "heart", label: "爱心", glyph: "♡" },
  { value: "bolt", label: "闪电", glyph: "ϟ" },
  { value: "moon", label: "月亮", glyph: "☾" },
  { value: "flower", label: "小花", glyph: "❀" },
  { value: "cat", label: "猫爪", glyph: "ฅ" },
  { value: "cube", label: "晶体", glyph: "◇" },
  { value: "wave", label: "波纹", glyph: "≋" },
] as const;

export const projectIconShapes: {
  value: ProjectIconShape;
  label: string;
}[] = [
  { value: "random", label: "随机外框" },
  { value: "blob", label: "手捏软团" },
  { value: "circle", label: "圆圆徽章" },
  { value: "rounded", label: "圆角方糖" },
  { value: "diamond", label: "歪钻石" },
  { value: "hexagon", label: "六角螺帽" },
  { value: "ticket", label: "票根缺口" },
  { value: "burst", label: "放射爆炸" },
  { value: "flower", label: "花瓣印章" },
];

const concreteShapes = projectIconShapes
  .map(({ value }) => value)
  .filter((value): value is Exclude<ProjectIconShape, "random"> => value !== "random");
const modes: ProjectIconMode[] = ["random", "preset", "custom", "image"];

function stableNumber(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stablePick<T>(items: readonly T[], seed: string, salt: string) {
  return items[stableNumber(`${seed}:${salt}`) % items.length];
}

export function normalizeProjectIconMode(value: string): ProjectIconMode {
  return modes.includes(value as ProjectIconMode)
    ? (value as ProjectIconMode)
    : "random";
}

export function normalizeProjectIconShape(value: string): ProjectIconShape {
  return projectIconShapes.some((shape) => shape.value === value)
    ? (value as ProjectIconShape)
    : "random";
}

export function isAllowedProjectIconUrl(value: string) {
  const trimmed = value.trim();
  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.includes("\\")
  ) {
    return true;
  }
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeProjectIconValue(
  mode: ProjectIconMode,
  value: string,
) {
  const trimmed = value.trim();
  if (mode === "preset") {
    return projectIconPresets.some((preset) => preset.value === trimmed)
      ? trimmed
      : "spark";
  }
  if (mode === "custom") {
    return Array.from(trimmed).slice(0, 6).join("") || "?";
  }
  if (mode === "image") {
    return isAllowedProjectIconUrl(trimmed) ? trimmed : "";
  }
  return "";
}

export function resolveProjectIcon(input: {
  id?: string;
  slug?: string;
  iconMode?: string;
  iconValue?: string;
  iconShape?: string;
}) {
  const seed = input.id || input.slug || "project";
  const mode = normalizeProjectIconMode(input.iconMode ?? "random");
  const requestedShape = normalizeProjectIconShape(input.iconShape ?? "random");
  const shape =
    requestedShape === "random"
      ? stablePick(concreteShapes, seed, "shape")
      : requestedShape;

  if (mode === "image") {
    const imageUrl = normalizeProjectIconValue(mode, input.iconValue ?? "");
    if (imageUrl) return { mode, shape, glyph: "", imageUrl };
  }

  if (mode === "custom") {
    return {
      mode,
      shape,
      glyph: normalizeProjectIconValue(mode, input.iconValue ?? ""),
      imageUrl: "",
    };
  }

  const preset =
    mode === "random"
      ? stablePick(projectIconPresets, seed, "glyph")
      : projectIconPresets.find(
          ({ value }) =>
            value === normalizeProjectIconValue("preset", input.iconValue ?? ""),
        ) ?? projectIconPresets[0];

  return { mode, shape, glyph: preset.glyph, imageUrl: "" };
}
