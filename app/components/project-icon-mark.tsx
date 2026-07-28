import { resolveProjectIcon } from "../lib/project-icon";

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
  return (
    <div
      className={`project-card__symbol project-card__symbol--${icon.shape} ${className}`.trim()}
      aria-hidden="true"
    >
      {icon.imageUrl ? (
        <img src={icon.imageUrl} alt="" loading="lazy" />
      ) : (
        <span>{icon.glyph}</span>
      )}
    </div>
  );
}
