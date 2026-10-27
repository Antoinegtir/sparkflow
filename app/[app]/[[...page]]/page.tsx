import { notFound, redirect } from "next/navigation";
import { IDE } from "@/app/components/ide/IDE";
import { orchestrator } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/** /<app-name>/<page>: the IDE of the project with that URL name. */
export default async function ProjectPage({ params }: { params: Promise<{ app: string; page?: string[] }> }) {
  const { app, page } = await params;
  const list = await orchestrator().listProjects();
  const project = list.find((p) => p.slug === app);
  if (!project) {
    // Old links by id land on the app's name.
    const byId = list.find((p) => p.id === app);
    if (byId) redirect(`/${byId.slug}${page?.length ? `/${page.join("/")}` : ""}`);
    notFound();
  }
  return <IDE id={project.id} slug={project.slug} initialPage={page ?? []} />;
}
