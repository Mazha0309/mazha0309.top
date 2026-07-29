export interface LyricLine {
  time: number | null;
  text: string;
  translations: string[];
}

export interface ParsedLyrics {
  timed: boolean;
  lines: LyricLine[];
}

const TIMESTAMP_PATTERN =
  /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/gu;
const METADATA_PATTERN =
  /^\[(?:ar|al|ti|au|by|re|ve|length|offset):.*\]$/iu;

function fractionToSeconds(fraction = "") {
  if (!fraction) return 0;
  if (fraction.length === 1) return Number(fraction) / 10;
  if (fraction.length === 2) return Number(fraction) / 100;
  return Number(fraction.slice(0, 3)) / 1000;
}

export function parseLyrics(source: string): ParsedLyrics {
  const normalized = source.replace(/\r\n?/gu, "\n").trim();
  if (!normalized) return { timed: false, lines: [] };

  const rawLines = normalized.split("\n");
  const offsetMatch = rawLines
    .map((line) => /^\[offset:([+-]?\d+)\]$/iu.exec(line.trim()))
    .find(Boolean);
  const offsetSeconds = offsetMatch ? Number(offsetMatch[1]) / 1000 : 0;
  const timedLines: Array<{
    time: number;
    text: string;
    order: number;
  }> = [];

  rawLines.forEach((rawLine, order) => {
    const line = rawLine.trim();
    if (!line || METADATA_PATTERN.test(line)) return;

    const timestamps = [...line.matchAll(TIMESTAMP_PATTERN)];
    if (!timestamps.length) return;
    const text = line.replace(TIMESTAMP_PATTERN, "").trim() || "♪";
    for (const match of timestamps) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const fraction = fractionToSeconds(match[3]);
      if (seconds >= 60) continue;
      timedLines.push({
        time: Math.max(0, minutes * 60 + seconds + fraction + offsetSeconds),
        text,
        order,
      });
    }
  });

  if (timedLines.length) {
    timedLines.sort(
      (left, right) =>
        (left.time ?? 0) - (right.time ?? 0) || left.order - right.order,
    );
    const groupedLines: LyricLine[] = [];
    for (const { time, text } of timedLines) {
      const previous = groupedLines.at(-1);
      if (
        previous &&
        previous.time !== null &&
        time !== null &&
        Math.abs(previous.time - time) < 0.001
      ) {
        if (text !== previous.text && !previous.translations.includes(text)) {
          previous.translations.push(text);
        }
        continue;
      }
      groupedLines.push({ time, text, translations: [] });
    }
    return {
      timed: true,
      lines: groupedLines,
    };
  }

  return {
    timed: false,
    lines: rawLines
      .map((line) => line.trim())
      .filter((line) => line && !METADATA_PATTERN.test(line))
      .map((text) => ({ time: null, text, translations: [] })),
  };
}

export function activeLyricIndex(lines: LyricLine[], currentTime: number) {
  let low = 0;
  let high = lines.length - 1;
  let active = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const time = lines[middle]?.time;
    if (time === null || time === undefined || time > currentTime) {
      high = middle - 1;
    } else {
      active = middle;
      low = middle + 1;
    }
  }
  return active;
}
