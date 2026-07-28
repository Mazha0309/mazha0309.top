import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { useEffect, useRef, useState } from "react";

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
  const initial = useRef(true);
  const previewController = useRef<AbortController | null>(null);

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
        <textarea name="contentMdx" value={source} readOnly hidden />
        <CodeMirror
          value={source}
          height="640px"
          extensions={[markdown()]}
          onChange={setSource}
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
