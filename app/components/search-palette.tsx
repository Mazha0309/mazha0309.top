import { useEffect, useRef, useState } from "react";
import { Form } from "react-router";

export function SearchPalette() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  function show() {
    setOpen(true);
    dialogRef.current?.showModal();
    window.setTimeout(() => inputRef.current?.focus(), 30);
  }

  function close() {
    dialogRef.current?.close();
    setOpen(false);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (event.key === "/" && !typing) {
        event.preventDefault();
        show();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        show();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <button
        className="tool-button"
        type="button"
        onClick={show}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span aria-hidden="true">⌕</span>
        <span className="tool-button__text">SEARCH</span>
      </button>
      <dialog
        className="search-dialog"
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
      >
        <div className="search-card">
          <div className="search-card__head">
            <span className="security-pill">GLOBAL SCANNER / READY</span>
            <button type="button" onClick={close} aria-label="关闭搜索">
              ×
            </button>
          </div>
          <h2>翻翻这张桌子</h2>
          <p>输入标题、标签或只记得一半的关键词。别怕，抽屉会自己打开。</p>
          <Form action="/search" method="get" onSubmit={close}>
            <label htmlFor="global-search">搜索内容</label>
            <div className="search-input-row">
              <input
                ref={inputRef}
                id="global-search"
                name="q"
                type="search"
                autoComplete="off"
                placeholder="例如：二维码 / Docker / 猫"
              />
              <button className="button button--primary" type="submit">
                开始翻找 →
              </button>
            </div>
          </Form>
          <small>快捷键：/ 或 Ctrl K · ESC 关上抽屉</small>
        </div>
      </dialog>
    </>
  );
}
