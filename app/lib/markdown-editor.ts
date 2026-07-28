export type MarkdownFormat =
  | "paragraph"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "bold"
  | "italic"
  | "strike"
  | "inline-code"
  | "quote"
  | "bullet-list"
  | "ordered-list"
  | "task-list"
  | "code-block"
  | "link"
  | "image"
  | "horizontal-rule"
  | "table";

export type MarkdownEdit = {
  from: number;
  to: number;
  insert: string;
  anchor: number;
  head: number;
};

function wrapSelection(
  source: string,
  from: number,
  to: number,
  before: string,
  after: string,
  placeholder: string,
): MarkdownEdit {
  const selected = source.slice(from, to);
  const wrappedBefore = source.slice(Math.max(0, from - before.length), from);
  const wrappedAfter = source.slice(to, to + after.length);
  if (selected && wrappedBefore === before && wrappedAfter === after) {
    return {
      from: from - before.length,
      to: to + after.length,
      insert: selected,
      anchor: from - before.length,
      head: to - before.length,
    };
  }
  const content = selected || placeholder;
  return {
    from,
    to,
    insert: `${before}${content}${after}`,
    anchor: from + before.length,
    head: from + before.length + content.length,
  };
}

function stripBlockPrefix(line: string) {
  return line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^>\s?/, "")
    .replace(/^(?:[-+*]|\d+\.)\s+(?:\[[ xX]\]\s+)?/, "");
}

function selectedLines(source: string, from: number, to: number) {
  const lineFrom = source.lastIndexOf("\n", Math.max(0, from - 1)) + 1;
  const effectiveTo = to > from && source[to - 1] === "\n" ? to - 1 : to;
  const nextBreak = source.indexOf("\n", effectiveTo);
  const lineTo = nextBreak === -1 ? source.length : nextBreak;
  return {
    from: lineFrom,
    to: lineTo,
    lines: source.slice(lineFrom, lineTo).split("\n"),
  };
}

function insertBlock(
  source: string,
  from: number,
  to: number,
  block: string,
  selectFrom: number,
  selectTo: number,
): MarkdownEdit {
  const selected = source.slice(from, to);
  const before = from > 0 && source[from - 1] !== "\n" ? "\n\n" : "";
  const after = to < source.length && source[to] !== "\n" ? "\n\n" : "";
  const insert = `${selected}${before}${block}${after}`;
  const blockFrom = from + selected.length + before.length;
  return {
    from,
    to,
    insert,
    anchor: blockFrom + selectFrom,
    head: blockFrom + selectTo,
  };
}

function replaceLines(
  source: string,
  from: number,
  to: number,
  transform: (line: string, index: number) => string,
): MarkdownEdit {
  const selection = selectedLines(source, from, to);
  const insert = selection.lines.map(transform).join("\n");
  return {
    from: selection.from,
    to: selection.to,
    insert,
    anchor: selection.from,
    head: selection.from + insert.length,
  };
}

function toggleLinePrefix(
  source: string,
  from: number,
  to: number,
  prefix: string,
  pattern: RegExp,
  normalize: (line: string) => string = (line) => line,
): MarkdownEdit {
  const selection = selectedLines(source, from, to);
  const populated = selection.lines.filter((line) => line.trim());
  const shouldRemove =
    populated.length > 0 && populated.every((line) => pattern.test(line));
  return replaceLines(source, from, to, (line) => {
    if (!line.trim()) return line;
    return shouldRemove
      ? line.replace(pattern, "")
      : `${prefix}${normalize(line)}`;
  });
}

export function createMarkdownEdit(
  source: string,
  selection: { from: number; to: number },
  format: MarkdownFormat,
): MarkdownEdit {
  const from = Math.max(0, Math.min(selection.from, source.length));
  const to = Math.max(from, Math.min(selection.to, source.length));

  if (format === "bold") {
    return wrapSelection(source, from, to, "**", "**", "加粗文字");
  }
  if (format === "italic") {
    return wrapSelection(source, from, to, "*", "*", "斜体文字");
  }
  if (format === "strike") {
    return wrapSelection(source, from, to, "~~", "~~", "删除文字");
  }
  if (format === "inline-code") {
    return wrapSelection(source, from, to, "`", "`", "code");
  }
  if (format === "code-block") {
    return wrapSelection(source, from, to, "```\n", "\n```", "代码");
  }
  if (format === "link") {
    const selected = source.slice(from, to);
    const label = selected || "链接文字";
    const insert = `[${label}](https://)`;
    const urlFrom = from + label.length + 3;
    return {
      from,
      to,
      insert,
      anchor: selected ? urlFrom : from + 1,
      head: selected ? urlFrom + 8 : from + 1 + label.length,
    };
  }
  if (format === "image") {
    return createMarkdownImageEdit(
      source,
      { from, to },
      "/media/图片地址",
      source.slice(from, to) || "图片描述",
    );
  }
  if (format === "horizontal-rule") {
    return insertBlock(source, from, to, "---", 3, 3);
  }
  if (format === "table") {
    const block = [
      "| 列 1 | 列 2 | 列 3 |",
      "| --- | --- | --- |",
      "| 内容 | 内容 | 内容 |",
    ].join("\n");
    return insertBlock(source, from, to, block, 2, 5);
  }
  if (format === "paragraph") {
    return replaceLines(source, from, to, (line) =>
      line.trim() ? stripBlockPrefix(line) : line,
    );
  }
  if (format.startsWith("heading-")) {
    const level = Number(format.slice(-1));
    const prefix = `${"#".repeat(level)} `;
    return replaceLines(source, from, to, (line) =>
      line.trim() ? `${prefix}${stripBlockPrefix(line)}` : line,
    );
  }
  if (format === "quote") {
    return toggleLinePrefix(source, from, to, "> ", /^>\s?/);
  }
  if (format === "bullet-list") {
    return toggleLinePrefix(
      source,
      from,
      to,
      "- ",
      /^[-+*]\s+(?!\[[ xX]\]\s+)/,
      stripBlockPrefix,
    );
  }
  if (format === "ordered-list") {
    const selection = selectedLines(source, from, to);
    const populated = selection.lines.filter((line) => line.trim());
    const shouldRemove =
      populated.length > 0 &&
      populated.every((line) => /^\d+\.\s+/.test(line));
    let item = 0;
    return replaceLines(source, from, to, (line) => {
      if (!line.trim()) return line;
      if (shouldRemove) return line.replace(/^\d+\.\s+/, "");
      item += 1;
      return `${item}. ${stripBlockPrefix(line)}`;
    });
  }
  if (format === "task-list") {
    return toggleLinePrefix(
      source,
      from,
      to,
      "- [ ] ",
      /^[-+*]\s+\[[ xX]\]\s+/,
      stripBlockPrefix,
    );
  }

  return {
    from,
    to,
    insert: source.slice(from, to),
    anchor: from,
    head: to,
  };
}

export function createMarkdownImageEdit(
  source: string,
  selection: { from: number; to: number },
  url: string,
  alt: string,
): MarkdownEdit {
  const from = Math.max(0, Math.min(selection.from, source.length));
  const to = Math.max(from, Math.min(selection.to, source.length));
  const safeAlt = alt.replace(/[\]\r\n]+/g, " ").trim() || "图片";
  const safeUrl = url.replace(/\s/g, "%20").replace(/\)/g, "%29");
  const insert = `![${safeAlt}](${safeUrl})`;
  return {
    from,
    to,
    insert,
    anchor: from + insert.length,
    head: from + insert.length,
  };
}

export function getActiveMarkdownFormats(
  source: string,
  selection: { from: number; to: number },
): MarkdownFormat[] {
  const from = Math.max(0, Math.min(selection.from, source.length));
  const to = Math.max(from, Math.min(selection.to, source.length));
  const active = new Set<MarkdownFormat>();
  const line = selectedLines(source, from, to).lines[0] ?? "";
  const heading = line.match(/^(#{1,3})\s+/);

  if (heading) active.add(`heading-${heading[1].length}` as MarkdownFormat);
  else active.add("paragraph");
  if (/^>\s?/.test(line)) active.add("quote");
  if (/^[-+*]\s+(?!\[[ xX]\]\s+)/.test(line)) active.add("bullet-list");
  if (/^\d+\.\s+/.test(line)) active.add("ordered-list");
  if (/^[-+*]\s+\[[ xX]\]\s+/.test(line)) active.add("task-list");

  const selected = source.slice(from, to);
  if (selected) {
    const wrapped = (before: string, after = before) =>
      source.slice(Math.max(0, from - before.length), from) === before &&
      source.slice(to, to + after.length) === after;
    if (wrapped("**")) active.add("bold");
    if (wrapped("*") && !wrapped("**")) active.add("italic");
    if (wrapped("~~")) active.add("strike");
    if (wrapped("`")) active.add("inline-code");
  }

  return [...active];
}
