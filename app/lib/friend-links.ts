export const friendAccentOptions = [
  { value: "pink", label: "草莓粉" },
  { value: "yellow", label: "便签黄" },
  { value: "blue", label: "晴空蓝" },
  { value: "mint", label: "薄荷绿" },
  { value: "lavender", label: "薰衣草" },
] as const;

export function normalizeFriendAccent(value: string) {
  return friendAccentOptions.some((option) => option.value === value)
    ? value
    : "pink";
}

export function isAllowedFriendUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isAllowedFriendAvatarUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.includes("\\")
  ) {
    return true;
  }
  return isAllowedFriendUrl(trimmed);
}

export function friendHostLabel(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

export function friendInitial(name: string) {
  return Array.from(name.trim())[0]?.toUpperCase() ?? "?";
}
