"use client";

import { useParams } from "next/navigation";
import { SharedShell } from "@/app/components/SharedShell";

/** /s/<serverUid>/<projectId>[/<page>]: a project shared with you, served by its owner's computer. */
export default function SharedPage() {
  const { rest } = useParams<{ rest: string[] }>();
  const [serverUid, projectId, ...page] = (rest ?? []).map(decodeURIComponent);
  if (!serverUid || !projectId) return null;
  return <SharedShell key={`${serverUid}/${projectId}`} serverUid={serverUid} projectId={projectId} page={page} />;
}
