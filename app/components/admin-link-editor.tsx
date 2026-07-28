import { useMemo, useState } from "react";
import type { ContentLink } from "../lib/types";

type EditableLink = Omit<ContentLink, "id" | "position"> & {
  clientId: string;
};

function newLink(kind: ContentLink["kind"]): EditableLink {
  return {
    clientId: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind,
    label: "",
    url: "",
    note: "",
    enabled: true,
  };
}

export function AdminLinkEditor({ links }: { links: ContentLink[] }) {
  const [items, setItems] = useState<EditableLink[]>(() =>
    links.map(({ id, position: _position, ...link }) => ({
      ...link,
      clientId: id,
    })),
  );

  const serialized = useMemo(
    () =>
      JSON.stringify(
        items.map(({ clientId: _clientId, ...item }, position) => ({
          ...item,
          position,
        })),
      ),
    [items],
  );

  const update = <K extends keyof EditableLink>(
    clientId: string,
    key: K,
    value: EditableLink[K],
  ) => {
    setItems((current) =>
      current.map((item) => item.clientId === clientId ? { ...item, [key]: value } : item),
    );
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    setItems((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  return (
    <div className="link-editor">
      <input type="hidden" name="linksJson" value={serialized} />
      <div className="link-editor__head">
        <div>
          <span className="micro-label">NAVIGATION & SOCIAL</span>
          <h3>导航与社交链接</h3>
          <p>拖顺序不用碰 JSON；关闭后会保留配置，但不会出现在公开站点。</p>
        </div>
        <div className="link-editor__add">
          <button className="button button--small" type="button" onClick={() => setItems((current) => [...current, newLink("nav")])}>
            ＋ 导航
          </button>
          <button className="button button--small" type="button" onClick={() => setItems((current) => [...current, newLink("social")])}>
            ＋ 社交
          </button>
        </div>
      </div>

      <div className="link-editor__list">
        {items.map((item, index) => (
          <fieldset className="link-row" key={item.clientId}>
            <legend>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {item.kind === "nav" ? "导航入口" : "社交链接"}
            </legend>
            <div className="link-row__fields">
              <label className="field">
                <span>类型</span>
                <select
                  aria-label={`第 ${index + 1} 条链接类型`}
                  value={item.kind}
                  onChange={(event) => update(item.clientId, "kind", event.target.value as ContentLink["kind"])}
                >
                  <option value="nav">导航</option>
                  <option value="social">社交</option>
                </select>
              </label>
              <label className="field">
                <span>显示文字</span>
                <input
                  aria-label={`第 ${index + 1} 条链接文字`}
                  value={item.label}
                  onChange={(event) => update(item.clientId, "label", event.target.value)}
                  placeholder={item.kind === "nav" ? "BLOG" : "GitHub"}
                />
              </label>
              <label className="field link-row__url">
                <span>地址</span>
                <input
                  aria-label={`第 ${index + 1} 条链接地址`}
                  value={item.url}
                  onChange={(event) => update(item.clientId, "url", event.target.value)}
                  placeholder="/blog 或 https://..."
                />
              </label>
              <label className="field link-row__note">
                <span>备注（可选）</span>
                <input
                  aria-label={`第 ${index + 1} 条链接备注`}
                  value={item.note ?? ""}
                  onChange={(event) => update(item.clientId, "note", event.target.value)}
                  placeholder="只在后台帮助你辨认"
                />
              </label>
            </div>
            <div className="link-row__actions">
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={(event) => update(item.clientId, "enabled", event.target.checked)}
                />
                <span>公开显示</span>
              </label>
              <div>
                <button type="button" aria-label={`上移 ${item.label || `第 ${index + 1} 条`}`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
                <button type="button" aria-label={`下移 ${item.label || `第 ${index + 1} 条`}`} disabled={index === items.length - 1} onClick={() => move(index, 1)}>↓</button>
                <button className="link-row__remove" type="button" onClick={() => setItems((current) => current.filter((candidate) => candidate.clientId !== item.clientId))}>
                  删除
                </button>
              </div>
            </div>
          </fieldset>
        ))}
        {items.length === 0 ? <p className="empty-note">这里还没有链接。先加一张导航或社交纸条。</p> : null}
      </div>
    </div>
  );
}
