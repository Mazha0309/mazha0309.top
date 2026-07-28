export type MarkdownFormat =
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
  | "image";

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
  const content = selected || placeholder;
  return {
    from,
    to,
    insert: `${before}${content}${after}`,
    anchor: from + before.length,
    head: from + before.length + content.length,
  };
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
): MarkdownEdit {
  const selection = selectedLines(source, from, to);
  const populated = selection.lines.filter((line) => line.trim());
  const shouldRemove =
    populated.length > 0 && populated.every((line) => pattern.test(line));
  return replaceLines(source, from, to, (line) => {
    if (!line.trim()) return line;
    return shouldRemove ? line.replace(pattern, "") : `${prefix}${line}`;
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
    const selected = source.slice(from, to);
    const alt = selected || "图片描述";
    const insert = `![${alt}](/media/图片地址)`;
    const urlFrom = from + alt.length + 4;
    return {
      from,
      to,
      insert,
      anchor: selected ? urlFrom : from + 2,
      head: selected ? urlFrom + 11 : from + 2 + alt.length,
    };
  }
  if (format.startsWith("heading-")) {
    const level = Number(format.slice(-1));
    const prefix = `${"#".repeat(level)} `;
    return replaceLines(source, from, to, (line) =>
      line.trim() ? `${prefix}${line.replace(/^#{1,6}\s+/, "")}` : line,
    );
  }
  if (format === "quote") {
    return toggleLinePrefix(source, from, to, "> ", /^>\s?/);
  }
  if (format === "bullet-list") {
    return replaceLines(source, from, to, (line) =>
      line.trim()
        ? `- ${line.replace(/^(?:[-+*]|\d+\.)\s+(?:\[[ xX]\]\s+)?/, "")}`
        : line,
    );
  }
  if (format === "ordered-list") {
    let item = 0;
    return replaceLines(source, from, to, (line) => {
      if (!line.trim()) return line;
      item += 1;
      return `${item}. ${line.replace(/^(?:[-+*]|\d+\.)\s+(?:\[[ xX]\]\s+)?/, "")}`;
    });
  }
  if (format === "task-list") {
    return replaceLines(source, from, to, (line) =>
      line.trim()
        ? `- [ ] ${line.replace(/^(?:[-+*]|\d+\.)\s+(?:\[[ xX]\]\s+)?/, "")}`
        : line,
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
