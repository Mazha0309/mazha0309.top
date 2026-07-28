import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { listProjects } from "../lib/content.server";
import { PageHeading } from "../components/page-heading";
import { ProjectCard } from "../components/project-card";
import { PageViewBeacon } from "../components/post-engagement";

export const meta: MetaFunction = () => [
  { title: "项目档案 — Mazha0309" },
  { name: "description", content: "做过的工具、实验和仍在施工的洞。" },
];

export async function loader(_args: LoaderFunctionArgs) {
  return { projects: await listProjects() };
}

export default function Projects({
  loaderData,
}: {
  loaderData: Awaited<ReturnType<typeof loader>>;
}) {
  return (
    <div className="page-shell content-width">
      <PageViewBeacon path="/projects" />
      <PageHeading
        eyebrow="PROJECT CABINET / HANDLE WITH CARE"
        title="做过的东西，都在这柜子里"
        lead="有些已经能用，有些仍在发出不太健康的电流声。点进去前请自行判断。"
        count={loaderData.projects.length}
      />
      <div className="project-grid project-grid--archive">
        {loaderData.projects.map((project, index) => (
          <ProjectCard key={project.id} project={project} index={index} />
        ))}
      </div>
    </div>
  );
}
