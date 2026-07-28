import type { ProjectRecord } from "../lib/types";
import { ProjectIconMark } from "./project-icon-mark";

export function ProjectCard({
  project,
  index = 0,
}: {
  project: ProjectRecord;
  index?: number;
}) {
  return (
    <article
      id={project.slug}
      className={`project-card project-card--${project.accent}`}
      style={{ "--card-index": index } as React.CSSProperties}
    >
      <header>
        <span className="project-card__number">
          PRJ-{String(index + 1).padStart(2, "0")}
        </span>
        <span className="project-card__status">{project.statusLabel}</span>
      </header>
      <ProjectIconMark project={project} />
      <h3>{project.title}</h3>
      <p>{project.summary}</p>
      <div className="tag-list">
        {project.stack.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      <footer>
        {project.repoUrl ? (
          <a href={project.repoUrl} rel="noreferrer" target="_blank">
            SOURCE ↗
          </a>
        ) : null}
        {project.liveUrl ? (
          <a href={project.liveUrl} rel="noreferrer" target="_blank">
            OPEN ↗
          </a>
        ) : null}
      </footer>
    </article>
  );
}
