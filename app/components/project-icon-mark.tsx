import { useId } from "react";
import { resolveProjectIcon } from "../lib/project-icon";
import type { ProjectIconShape } from "../lib/types";

const framePaths: Record<Exclude<ProjectIconShape, "random">, string> = {
  blob: "M49 5 C68 2 88 12 95 31 C99 50 91 74 78 88 C63 99 38 98 19 88 C4 78 3 55 7 36 C11 18 29 8 49 5 Z",
  circle:
    "M49 5 C73 3 93 20 96 45 C98 69 82 92 57 96 C31 99 8 83 5 58 C2 33 18 10 42 6 C44 6 47 5 49 5 Z",
  rounded:
    "M18 8 C33 5 73 7 86 12 C96 22 94 69 89 84 C77 95 29 96 13 87 C5 72 7 26 18 8 Z",
  diamond:
    "M50 3 C59 14 86 35 96 48 C90 62 65 89 51 97 C37 88 10 67 4 51 C11 36 36 12 50 3 Z",
  hexagon:
    "M31 7 Q27 8 24 13 L7 41 Q3 48 7 56 L24 87 Q28 93 35 94 L69 93 Q76 92 80 86 L95 56 Q98 50 94 43 L77 13 Q74 8 68 7 Z",
  ticket:
    "M19 7 Q8 7 8 18 L8 37 C21 38 21 61 8 63 L8 82 Q8 94 20 94 L80 94 Q92 94 92 82 L92 63 C79 61 79 38 92 37 L92 18 Q92 7 81 7 Z",
  burst:
    "M50 4 Q57 18 66 10 Q67 25 82 16 Q78 32 95 32 Q83 43 97 50 Q82 57 91 72 Q75 69 77 89 Q63 79 55 97 Q47 82 36 93 Q33 78 16 84 Q22 68 5 64 Q18 52 3 43 Q20 38 11 23 Q29 27 30 9 Q43 19 50 4 Z",
  flower:
    "M50 18 C57 1 73 2 76 20 C94 13 99 29 87 42 C102 51 96 68 79 69 C82 88 66 97 52 83 C39 98 22 91 24 72 C6 72 0 55 14 43 C1 30 10 14 28 20 C31 3 46 2 50 18 Z",
};

export function ProjectIconMark({
  project,
  className = "",
}: {
  project: {
    id?: string;
    slug?: string;
    iconMode?: string;
    iconValue?: string;
    iconShape?: string;
  };
  className?: string;
}) {
  const icon = resolveProjectIcon(project);
  const clipId = `project-icon-${useId().replaceAll(":", "")}`;
  const framePath = framePaths[icon.shape];
  const glyphLength = Array.from(icon.glyph).length;
  return (
    <div
      className={`project-card__symbol project-card__symbol--${icon.shape} project-card__symbol--variant-${icon.variant} ${className}`.trim()}
      data-glyph-length={glyphLength}
      aria-hidden="true"
    >
      <svg
        className="project-card__symbol-frame"
        viewBox="-5 -5 112 112"
        focusable="false"
      >
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <path d={framePath} />
          </clipPath>
        </defs>
        <path
          className="project-card__symbol-echo"
          d={framePath}
          transform="translate(2 3)"
        />
        <path className="project-card__symbol-paper" d={framePath} />
        {icon.imageUrl ? (
          <image
            className="project-card__symbol-image"
            href={icon.imageUrl}
            x="0"
            y="0"
            width="100"
            height="100"
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
          />
        ) : null}
        <path className="project-card__symbol-outline" d={framePath} />
        <path className="project-card__symbol-scratch" d={framePath} />
      </svg>
      {icon.imageUrl ? null : <span>{icon.glyph}</span>}
    </div>
  );
}
