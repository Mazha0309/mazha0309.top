import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { redo, redoDepth, undo, undoDepth } from "@codemirror/commands";
import { keymap, type EditorView } from "@codemirror/view";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createMarkdownImageEdit,
  createMarkdownEdit,
  getActiveMarkdownFormats,
  type MarkdownFormat,
} from "../lib/markdown-editor";

type ToolbarAction = {
  format: MarkdownFormat;
  mark: string;
  label: string;
  shortcut?: string;
};

export type EditorMediaItem = {
  id: string;
  alt: string;
  name: string;
  url: string;
};

const inlineActions: ToolbarAction[] = [
  { format: "bold", mark: "B", label: "粗体", shortcut: "Ctrl/⌘ B" },
  { format: "italic", mark: "I", label: "斜体", shortcut: "Ctrl/⌘ I" },
  { format: "strike", mark: "S", label: "删除线" },
  { format: "inline-code", mark: "<>", label: "行内代码" },
];

const blockActions: ToolbarAction[] = [
  { format: "quote", mark: "❝", label: "引用" },
  { format: "bullet-list", mark: "•", label: "无序" },
  { format: "ordered-list", mark: "1.", label: "有序" },
  { format: "task-list", mark: "☐", label: "任务" },
  { format: "code-block", mark: "</>", label: "代码块" },
];

const insertActions: ToolbarAction[] = [
  { format: "link", mark: "↗", label: "链接", shortcut: "Ctrl/⌘ K" },
  { format: "horizontal-rule", mark: "—", label: "分隔线" },
  { format: "table", mark: "▦", label: "表格" },
];

function applyEdit(view: EditorView, edit: ReturnType<typeof createMarkdownEdit>) {
  view.dispatch({
    changes: { from: edit.from, to: edit.to, insert: edit.insert },
    selection: { anchor: edit.anchor, head: edit.head },
    scrollIntoView: true,
    userEvent: "input",
  });
  view.focus();
}

function formatEditor(view: EditorView, format: MarkdownFormat) {
  const selection = view.state.selection.main;
  applyEdit(
    view,
    createMarkdownEdit(
      view.state.doc.toString(),
      { from: selection.from, to: selection.to },
      format,
    ),
  );
  return true;
}

function ToolbarButton({
  mark,
  label,
  shortcut,
  pressed,
  disabled,
  onClick,
}: {
  mark: string;
  label: string;
  shortcut?: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="markdown-toolbar__button"
      type="button"
      title={`${label}${shortcut ? `（${shortcut}）` : ""}`}
      aria-label={`${label}${shortcut ? `，快捷键 ${shortcut}` : ""}`}
      aria-pressed={typeof pressed === "boolean" ? pressed : undefined}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <span className="markdown-toolbar__mark" aria-hidden="true">{mark}</span>
      <span>{label}</span>
    </button>
  );
}

export function MdxWorkbench({
  postId,
  initialSource,
  initialHtml,
  media = [],
}: {
  postId: string;
  initialSource: string;
  initialHtml: string;
  media?: EditorMediaItem[];
}) {
  const [source, setSource] = useState(initialSource);
  const [html, setHtml] = useState(initialHtml);
  const [previewError, setPreviewError] = useState("");
  const [autosave, setAutosave] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [historyState, setHistoryState] = useState({ undo: false, redo: false });
  const [activeFormats, setActiveFormats] = useState<MarkdownFormat[]>([
    "paragraph",
  ]);
  const [mediaOpen, setMediaOpen] = useState(false);
  const initial = useRef(true);
  const previewController = useRef<AbortController | null>(null);
  const editor = useRef<EditorView | null>(null);

  const editorExtensions = useMemo(
    () => [
      markdown(),
      keymap.of([
        {
          key: "Mod-b",
          run: (view) => formatEditor(view, "bold"),
        },
        {
          key: "Mod-i",
          run: (view) => formatEditor(view, "italic"),
        },
        {
          key: "Mod-k",
          run: (view) => formatEditor(view, "link"),
        },
        {
          key: "Mod-Alt-1",
          run: (view) => formatEditor(view, "heading-1"),
        },
        {
          key: "Mod-Alt-2",
          run: (view) => formatEditor(view, "heading-2"),
        },
        {
          key: "Mod-Alt-3",
          run: (view) => formatEditor(view, "heading-3"),
        },
      ]),
    ],
    [],
  );

  function refreshEditorState(view: EditorView) {
    setHistoryState({
      undo: undoDepth(view.state) > 0,
      redo: redoDepth(view.state) > 0,
    });
    const selection = view.state.selection.main;
    setActiveFormats(
      getActiveMarkdownFormats(view.state.doc.toString(), {
        from: selection.from,
        to: selection.to,
      }),
    );
  }

  function runHistory(command: typeof undo) {
    const view = editor.current;
    if (!view) return;
    command(view);
    view.focus();
    refreshEditorState(view);
  }

  function applyFormat(format: MarkdownFormat) {
    const view = editor.current;
    if (!view) return;
    formatEditor(view, format);
    refreshEditorState(view);
  }

  function insertMedia(item: EditorMediaItem) {
    const view = editor.current;
    if (!view) return;
    const selection = view.state.selection.main;
    applyEdit(
      view,
      createMarkdownImageEdit(
        view.state.doc.toString(),
        { from: selection.from, to: selection.to },
        item.url,
        view.state.sliceDoc(selection.from, selection.to) || item.alt,
      ),
    );
    setMediaOpen(false);
    refreshEditorState(view);
  }

  useEffect(() => {
    if (initial.current) {
      initial.current = false;
      return;
    }
    const timer = window.setTimeout(async () => {
      previewController.current?.abort();
      const controller = new AbortController();
      previewController.current = controller;
      try {
        const response = await fetch("/api/admin/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ source }),
          signal: controller.signal,
        });
        const result = (await response.json()) as {
          html?: string;
          error?: string;
        };
        if (!response.ok || !result.html) {
          setPreviewError(result.error ?? "预览失败");
          return;
        }
        setHtml(result.html);
        setPreviewError("");
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setPreviewError("预览连接中断");
        }
      }
    }, 550);
    return () => window.clearTimeout(timer);
  }, [source]);

  useEffect(() => {
    if (source === initialSource) return;
    const timer = window.setTimeout(async () => {
      setAutosave("saving");
      try {
        const response = await fetch(`/api/admin/posts/${postId}/autosave`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contentMdx: source }),
        });
        setAutosave(response.ok ? "saved" : "error");
      } catch {
        setAutosave("error");
      }
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [initialSource, postId, source]);

  return (
    <section className="editor-workbench">
      <div className="editor-pane">
        <header>
          <div>
            <span>MDX SOURCE</span>
            <strong>正文编辑</strong>
          </div>
          <small data-state={autosave}>
            {autosave === "saving"
              ? "自动保存中…"
              : autosave === "saved"
                ? "已自动保存"
                : autosave === "error"
                  ? "自动保存失败"
                  : "等待输入"}
          </small>
        </header>
        <div className="markdown-toolbar" role="toolbar" aria-label="Markdown 编辑工具">
          <div className="markdown-toolbar__row markdown-toolbar__row--primary">
            <div className="markdown-toolbar__group" aria-label="历史记录">
              <ToolbarButton
                mark="↶"
                label="撤回"
                shortcut="Ctrl/⌘ Z"
                disabled={!historyState.undo}
                onClick={() => runHistory(undo)}
              />
              <ToolbarButton
                mark="↷"
                label="重做"
                shortcut="Ctrl/⌘ ⇧ Z"
                disabled={!historyState.redo}
                onClick={() => runHistory(redo)}
              />
            </div>
            <label className="markdown-toolbar__style">
              <span>段落样式</span>
              <select
                aria-label="段落样式"
                value={
                  activeFormats.find((format) => format.startsWith("heading-")) ??
                  "paragraph"
                }
                onChange={(event) =>
                  applyFormat(event.currentTarget.value as MarkdownFormat)
                }
              >
                <option value="paragraph">正文</option>
                <option value="heading-1">一级标题 H1</option>
                <option value="heading-2">二级标题 H2</option>
                <option value="heading-3">三级标题 H3</option>
              </select>
            </label>
            <div className="markdown-toolbar__group" aria-label="行内样式">
              {inlineActions.map((action) => (
                <ToolbarButton
                  {...action}
                  key={action.format}
                  pressed={activeFormats.includes(action.format)}
                  onClick={() => applyFormat(action.format)}
                />
              ))}
            </div>
          </div>
          <div className="markdown-toolbar__row markdown-toolbar__row--secondary">
            <div className="markdown-toolbar__group" aria-label="段落与列表">
              {blockActions.map((action) => (
                <ToolbarButton
                  {...action}
                  key={action.format}
                  pressed={activeFormats.includes(action.format)}
                  onClick={() => applyFormat(action.format)}
                />
              ))}
            </div>
            <div className="markdown-toolbar__group" aria-label="插入内容">
              {insertActions.map((action) => (
                <ToolbarButton
                  {...action}
                  key={action.format}
                  onClick={() => applyFormat(action.format)}
                />
              ))}
              <button
                className="markdown-toolbar__button"
                type="button"
                title="从媒体抽屉插入图片"
                aria-label="从媒体抽屉插入图片"
                aria-expanded={mediaOpen}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setMediaOpen((open) => !open)}
              >
                <span className="markdown-toolbar__mark" aria-hidden="true">▧</span>
                <span>图片</span>
              </button>
            </div>
          </div>
          {mediaOpen ? (
            <section className="markdown-media-picker" aria-label="选择图片">
              <header>
                <div>
                  <strong>从媒体抽屉拿一张</strong>
                  <small>点一下就插进当前光标位置</small>
                </div>
                <a href="/admin/media" target="_blank" rel="noreferrer">
                  上传 / 管理 ↗
                </a>
              </header>
              {media.length ? (
                <div className="markdown-media-picker__grid">
                  {media.slice(0, 12).map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      title={`插入 ${item.name}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => insertMedia(item)}
                    >
                      <img src={item.url} alt="" loading="lazy" />
                      <span>{item.alt || item.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p>媒体抽屉还是空的，先上传一张再回来吧。</p>
              )}
            </section>
          ) : null}
        </div>
        <textarea name="contentMdx" value={source} readOnly hidden />
        <CodeMirror
          value={source}
          height="640px"
          extensions={editorExtensions}
          onCreateEditor={(view) => {
            editor.current = view;
            refreshEditorState(view);
          }}
          onChange={(value) => {
            setSource(value);
          }}
          onUpdate={(viewUpdate) => {
            if (viewUpdate.docChanged || viewUpdate.selectionSet) {
              refreshEditorState(viewUpdate.view);
            }
          }}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
          }}
        />
      </div>
      <div className="preview-pane">
        <header>
          <div>
            <span>SAFE PREVIEW</span>
            <strong>实时预览</strong>
          </div>
          <small>禁用任意 JS / HTML</small>
        </header>
        {previewError ? (
          <p className="form-message form-message--error">{previewError}</p>
        ) : null}
        <article className="prose" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </section>
  );
}
