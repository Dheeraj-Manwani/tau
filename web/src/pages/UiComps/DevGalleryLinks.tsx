import { Link } from "react-router-dom";

import { GALLERY_SECTIONS } from "./links";

/** Dev builds only (the caller gates on import.meta.env.DEV): jump into /ui-comps. */
export function DevGalleryLinks() {
  return (
    <nav
      aria-label="UI states gallery"
      className="mt-14 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-dashed border-line-strong px-4 py-3 font-mono text-xs"
    >
      <Link to="/ui-comps" className="text-blue-500 hover:underline">
        dev · /ui-comps
      </Link>
      {GALLERY_SECTIONS.map(({ id, label }) => (
        <Link key={id} to={`/ui-comps#${id}`} className="text-silver-600 hover:text-silver-900">
          {label}
        </Link>
      ))}
    </nav>
  );
}
