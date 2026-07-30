import { useEffect, useState, type ReactNode } from "react";
import type { MdxHeading } from "../lib/types";

const READING_MODE_KEY = "mazha-article-reading-mode";

function TocLinks({
  headings,
  activeId,
  onNavigate,
}: {
  headings: MdxHeading[];
  activeId: string;
  onNavigate: (id: string) => void;
}) {
  if (!headings.length) {
    return (
      <p className="article-toc__empty">
        这张纸还没分章节，先顺着墨迹往下读吧。
      </p>
    );
  }

  const firstLevel = Math.min(...headings.map((heading) => heading.level));
  return (
    <ol className="article-toc__list">
      {headings.map((heading, index) => (
        <li
          key={heading.id}
          data-depth={Math.min(3, heading.level - firstLevel + 1)}
        >
          <a
            href={`#${heading.id}`}
            aria-current={activeId === heading.id ? "location" : undefined}
            onClick={() => onNavigate(heading.id)}
          >
            <span aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            {heading.text}
          </a>
        </li>
      ))}
    </ol>
  );
}

export function ArticleReader({
  html,
  headings,
  children,
}: {
  html: string;
  headings: MdxHeading[];
  children: ReactNode;
}) {
  const [readingMode, setReadingMode] = useState(false);
  const [activeId, setActiveId] = useState(headings[0]?.id ?? "");

  useEffect(() => {
    try {
      setReadingMode(window.localStorage.getItem(READING_MODE_KEY) === "noto");
    } catch {
      // Reading mode still works for this visit when storage is unavailable.
    }
  }, []);

  useEffect(() => {
    if (!headings.length) return;
    let frame = 0;

    const updateActiveHeading = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const readingLine = Math.max(110, window.innerHeight * 0.28);
        let nextId = headings[0]?.id ?? "";
        for (const heading of headings) {
          const element = document.getElementById(heading.id);
          if (element && element.getBoundingClientRect().top <= readingLine) {
            nextId = heading.id;
          }
        }
        if (
          window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - 2
        ) {
          nextId = headings.at(-1)?.id ?? nextId;
        }
        setActiveId((current) => (current === nextId ? current : nextId));
      });
    };

    updateActiveHeading();
    window.addEventListener("scroll", updateActiveHeading, { passive: true });
    window.addEventListener("resize", updateActiveHeading);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateActiveHeading);
      window.removeEventListener("resize", updateActiveHeading);
    };
  }, [headings]);

  function toggleReadingMode() {
    setReadingMode((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(
          READING_MODE_KEY,
          next ? "noto" : "handwritten",
        );
      } catch {
        // Keep the in-memory preference when storage is unavailable.
      }
      return next;
    });
  }

  return (
    <article
      className={`article-reader${readingMode ? " article-reader--reading" : ""}`}
    >
      {children}
      <div className="article-reading-toolbar">
        <div>
          <span className="micro-label">READING MODE / 字体换班</span>
          <strong>
            {readingMode ? "思源黑体正在值班" : "现在是手写纸片模式"}
          </strong>
          <small>目录一直都在，开关只调整文章字体与阅读排版。</small>
        </div>
        <button
          className="article-reading-toggle"
          type="button"
          aria-pressed={readingMode}
          onClick={toggleReadingMode}
        >
          <span aria-hidden="true">Aa</span>
          {readingMode ? "换回手写体" : "开启阅读模式"}
        </button>
        <span className="sr-only" aria-live="polite">
          {readingMode ? "已开启思源黑体阅读模式" : "已关闭阅读模式"}
        </span>
      </div>

      <details className="article-toc article-toc--mobile">
        <summary>
          <span>INDEX / 文章目录</span>
          <strong>
            {headings.length ? `${headings.length} 个标题路标` : "暂无章节"}
          </strong>
        </summary>
        <nav aria-label="文章目录">
          <TocLinks
            headings={headings}
            activeId={activeId}
            onNavigate={setActiveId}
          />
        </nav>
      </details>

      <div className="article-reader__layout">
        <div
          className="prose"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <aside className="article-toc article-toc--desktop">
          <span className="micro-label">PAPER INDEX / 标题路标</span>
          <strong className="article-toc__title">沿着这张纸往下读</strong>
          <nav aria-label="文章目录">
            <TocLinks
              headings={headings}
              activeId={activeId}
              onNavigate={setActiveId}
            />
          </nav>
          <small className="article-toc__foot">当前章节会沾上一点粉色墨水。</small>
        </aside>
      </div>
    </article>
  );
}
