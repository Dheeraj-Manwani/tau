import { ImageIcon } from "lucide-react";
import { useProjectFile } from "./api";
import type { IdentityView } from "./deploy";

/** Read the saved asset from the editor, including before the first deployment. */
export function AppLogo({
  projectId,
  icon,
  draftUrl,
}: {
  projectId: string | null;
  icon?: IdentityView["icon"];
  draftUrl?: string;
}) {
  const file = useProjectFile(projectId ?? undefined, "public/favicon.png", {
    enabled: icon === "custom" && !draftUrl,
    staleTime: 15 * 60_000,
  });
  const url = draftUrl ?? (file.data?.binary ? file.data.url : undefined);
  if (url) return <img src={url} alt="" className="size-full object-contain" />;
  if (icon === "default")
    return (
      <img
        src="/android-chrome-192x192.png"
        alt=""
        className="size-full object-contain"
      />
    );
  return <ImageIcon aria-hidden="true" className="size-4 text-silver-600" />;
}
