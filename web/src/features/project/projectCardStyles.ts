/** boards/Home.dc.html project card: one surface, hover lifts 2px and
 *  brightens the edge, no glow. Shared by My projects and the community grid. */
export const projectCardClass =
  "flex h-full flex-col overflow-hidden rounded-lg border border-line bg-space-surface text-left transition-[border-color,transform] duration-150 outline-none hover:-translate-y-0.5 hover:border-line-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 motion-reduce:transition-none motion-reduce:hover:translate-y-0";

export const projectGridClass =
  "grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(260px,100%),1fr))]";
