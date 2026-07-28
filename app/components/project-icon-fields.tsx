import { useState } from "react";
import {
  normalizeProjectIconMode,
  normalizeProjectIconShape,
  projectIconPresets,
  projectIconShapes,
} from "../lib/project-icon";
import type { ProjectIconMode } from "../lib/types";
import { ProjectIconMark } from "./project-icon-mark";

export function ProjectIconFields({
  project,
}: {
  project?: {
    id?: string;
    slug?: string;
    iconMode?: string;
    iconValue?: string;
    iconShape?: string;
  };
}) {
  const [mode, setMode] = useState<ProjectIconMode>(
    normalizeProjectIconMode(project?.iconMode ?? "random"),
  );
  const [shape, setShape] = useState(
    normalizeProjectIconShape(project?.iconShape ?? "random"),
  );
  const [value, setValue] = useState(project?.iconValue ?? "spark");
  const previewValue =
    mode === "preset" && !projectIconPresets.some((item) => item.value === value)
      ? "spark"
      : value;

  return (
    <fieldset className="project-icon-editor field--wide">
      <legend>项目图标 <small>ICON PLAYGROUND</small></legend>
      <div className="project-icon-editor__preview">
        <ProjectIconMark
          className="project-card__symbol--preview"
          project={{
            id: project?.id ?? `preview-${value}`,
            slug: project?.slug ?? "new-project",
            iconMode: mode,
            iconValue: previewValue,
            iconShape: shape,
          }}
        />
        <span>
          <strong>卡片左上角会长这样</strong>
          <small>随机不是每次乱跳，而是按项目固定抽一款。</small>
        </span>
      </div>
      <div className="project-icon-editor__controls">
        <label className="field">
          <span>内容方式</span>
          <select
            name="iconMode"
            value={mode}
            onChange={(event) => {
              const nextMode = normalizeProjectIconMode(event.target.value);
              setMode(nextMode);
              if (nextMode === "preset" && !projectIconPresets.some((item) => item.value === value)) {
                setValue("spark");
              }
            }}
          >
            <option value="random">随机预设</option>
            <option value="preset">指定预设</option>
            <option value="custom">自定义文字 / Emoji</option>
            <option value="image">自定义图片 URL</option>
          </select>
        </label>
        <label className="field">
          <span>外框形状</span>
          <select
            name="iconShape"
            value={shape}
            onChange={(event) =>
              setShape(normalizeProjectIconShape(event.target.value))
            }
          >
            {projectIconShapes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {mode === "preset" ? (
          <label className="field">
            <span>预设图案</span>
            <select
              name="iconValue"
              value={previewValue}
              onChange={(event) => setValue(event.target.value)}
            >
              {projectIconPresets.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.glyph}　{item.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {mode === "custom" ? (
          <label className="field">
            <span>自定义内容 <small>最多 6 字符</small></span>
            <input
              name="iconValue"
              value={value}
              maxLength={24}
              placeholder="ฅ / 42 / 喵"
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
        ) : null}
        {mode === "image" ? (
          <label className="field">
            <span>图片 URL <small>站内路径或 HTTP(S)</small></span>
            <input
              name="iconValue"
              value={value}
              inputMode="url"
              maxLength={600}
              placeholder="/media/…/display.webp"
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
        ) : null}
        {mode === "random" ? (
          <input type="hidden" name="iconValue" value="" />
        ) : null}
      </div>
    </fieldset>
  );
}
