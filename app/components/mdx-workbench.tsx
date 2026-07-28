import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { redo, redoDepth, undo, undoDepth } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";
import { useEffect, useRef, useState } from "react";
import {
  createMarkdownEdit,
  type MarkdownFormat,
} from "../lib/markdown-editor";

const formattingGroups: {
  label: string;
  actions: { format: MarkdownFormat; label: string; title: string }[];
}[] = [
  {
    label: "标题",
    actions: [
      { format: "heading-1", label: "H1", title: "一级标题" },
      { format: "heading-2", label: "H2", title: "二级标题" },
      { format: "heading-3", label: "H3", title: "三级标题" },
    ],
  },
  {
    label: "行内样式",
    actions: [
      { format: "bold", label: "B", title: "加粗" },
      { format: "italic", label: "I", title: "斜体" },
      { format: "strike", label: "S", title: "删除线" },
      { format: "inline-code", label: "` `", title: "行内代码" },
    ],
  },
  {
    label: "段落",
    actions: [
      { format: "quote", label: "❞", title: "引用" },
      { format: "bullet-list", label: "•", title: "无序列表" },
      { format: "ordered-list", label: "1.", title: "有序列表" },
      { format: "task-list", label: "☑", title: "任务列表" },
      { format: "code-block", label: "</>", title: "代码块" },
    ],
  },
  {
    label: "插入",
    actions: [
      { format: "link", label: "↗", title: "链接" },
      { format: "image", label: "▧", title: "图片" },
    ],
  },
];

export function MdxWorkbench({
  postId,
  initialSource,
  initialHtml,
}: {
  postId: string;
  initialSource: string;
  initialHtml: string;
}) {
  const [source, setSource] = useState(initialSource);
  const [html, setHtml] = useState(initialHtml);
  const [previewError, setPreviewError] = useState("");
  const [autosave, setAutosave] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [historyState, setHistoryState] = useState({ undo: false, redo: false });
  const initial = useRef(true);
  const previewController = useRef<AbortController | null>(null);
  const editor = useRef<EditorView | null>(null);

  function refreshHistory(view: EditorView) {
    setHistoryState({
      undo: undoDepth(view.state) > 0,
      redo: redoDepth(view.state) > 0,
    });
  }

  function runHistory(command: typeof undo) {
    const view = editor.current;
    if (!view) return;
    command(view);
    view.focus();
    refreshHistory(view);
  }

  function applyFormat(format: MarkdownFormat) {
    const view = editor.current;
    if (!view) return;
    const selection = view.state.selection.main;
    const edit = createMarkdownEdit(
      view.state.doc.toString(),
      { from: selection.from, to: selection.to },
      format,
    );
    view.dispatch({
      changes: { from: edit.from, to: edit.to, insert: edit.insert },
      selection: { anchor: edit.anchor, head: edit.head },
      scrollIntoView: true,
      userEvent: "input",
    });
    view.focus();
    refreshHistory(view);
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
        <div className="markdown-toolbar" role="toolbar" aria-label="Markdown 格式工具">
          <div className="markdown-toolbar__group" aria-label="撤销与重做">
            <button
              type="button"
              title="撤销（Ctrl/Cmd + Z）"
              aria-label="撤销"
              disabled={!historyState.undo}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runHistory(undo)}
            >
              ↶
            </button>
            <button
              type="button"
              title="重做（Ctrl/Cmd + Shift + Z）"
              aria-label="重做"
              disabled={!historyState.redo}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runHistory(redo)}
            >
              ↷
            </button>
          </div>
          {formattingGroups.map((group) => (
            <div
              className="markdown-toolbar__group"
              aria-label={group.label}
              key={group.label}
            >
              {group.actions.map((action) => (
                <button
                  type="button"
                  title={action.title}
                  aria-label={action.title}
                  key={action.format}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyFormat(action.format)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          ))}
        </div>
        <textarea name="contentMdx" value={source} readOnly hidden />
        <CodeMirror
          value={source}
          height="640px"
          extensions={[markdown()]}
          onCreateEditor={(view) => {
            editor.current = view;
            refreshHistory(view);
          }}
          onChange={(value, viewUpdate) => {
            setSource(value);
            refreshHistory(viewUpdate.view);
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
