import { createContext } from "react";

/** The gallery's text filter: a tile shows when its section or label matches. */
export const FilterContext = createContext("");
export const SectionContext = createContext<{ id: string; title: string }>({ id: "", title: "" });

export function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** "Pause motion" in the toolbar: tiles read it as the user's reduce-motion. */
export const MotionPausedContext = createContext(false);
