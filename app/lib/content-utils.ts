export function slugify(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

export function splitTags(value: string | string[]) {
  const source = Array.isArray(value) ? value : value.split(/[,，]/);
  return [...new Set(source.map((tag) => tag.trim()).filter(Boolean))].slice(0, 12);
}

export function mdxToText(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function estimateReadingMinutes(value: string) {
  const plain = mdxToText(value);
  const latinWords = plain.match(/[A-Za-z0-9]+/g)?.length ?? 0;
  const cjkCharacters = plain.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu)
    ?.length ?? 0;
  return Math.max(1, Math.ceil(latinWords / 220 + cjkCharacters / 500));
}

export function parseDateInput(value: FormDataEntryValue | null) {
  if (!value || typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

export function isSafeInternalPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");
}
