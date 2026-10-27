import { notFound, redirect } from "next/navigation";
import { orchestrator } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/** Old /p/<id> links: redirect to the app's URL name. */
export default async function LegacyProjectPage({ params }: { params: Promise<{ id: string; page?: string[] }> }) {
  const { id, page } = await params;
  const p = (await orchestrator().listProjects()).find((x) => x.id === id);
  if (!p) notFound();
  redirect(`/${p.slug}${page?.length ? `/${page.join("/")}` : ""}`);
}
