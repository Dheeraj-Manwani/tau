/** Class strings shared by several primitives (kept out of the component
 * files so React Fast Refresh only sees components there). */

/**
 * boards/Surfaces.dc.html §02. The popover sits on the overlay surface with a
 * strong edge and the only shadow in the system: 14px radius, 6px padding,
 * 34px rows with an 8px radius. Icons are text-2 and brighten on hover; blue
 * is only for the selected check. Destructive goes last, below a separator.
 */
export const menuContentClass =
  "z-50 min-w-48 overflow-hidden rounded-xl border border-line-strong bg-space-overlay p-1.5 text-silver-900 shadow-[0_16px_48px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.04)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0";

export const menuItemClass =
  "group/menu-item relative flex h-[34px] w-full cursor-pointer items-center gap-2.5 rounded-sm px-2.5 text-[13px] text-silver-900 outline-none select-none transition-colors focus:bg-space-raised data-[highlighted]:bg-space-raised data-[disabled]:pointer-events-none data-[disabled]:opacity-40 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-silver-600 focus:[&_svg:not([class*='text-'])]:text-silver-900 data-[highlighted]:[&_svg:not([class*='text-'])]:text-silver-900 data-[variant=destructive]:text-red-400 data-[variant=destructive]:focus:bg-red-400/10 data-[variant=destructive]:data-[highlighted]:bg-red-400/10 data-[variant=destructive]:[&_svg]:!text-red-400";

/**
 * boards/Controls.dc.html §02. Fields sit one step darker than the card they
 * are in (void, strong edge), so they read as inset. One focus style: blue
 * border plus a 3px 20% blue ring. Shared with Textarea and SelectTrigger.
 */
export const fieldClass =
  "w-full min-w-0 rounded-md border border-line-strong bg-space-void text-[13px] text-silver-900 transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-silver-500 hover:border-line-hover focus-visible:border-blue-500 focus-visible:shadow-[0_0_0_3px_rgb(96_165_250/0.2)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-red-400 aria-invalid:focus-visible:shadow-[0_0_0_3px_rgb(248_113_113/0.2)]";

/**
 * boards/Overlays.dc.html: overlay fill, strong edge, r16 and the system's one
 * shadow. Below 640 it becomes a bottom sheet with only the top corners round
 * (plan §4.10).
 */
export const dialogContentClass =
  "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 max-h-[calc(100dvh-2rem)] overflow-y-auto gap-5 rounded-2xl border border-line-strong bg-space-overlay p-6 text-sm text-silver-900 shadow-[0_24px_80px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.04)] duration-150 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[92dvh] max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:border-b-0 max-sm:px-4";

/** The footer runs edge to edge under a hairline, Cancel first. */
export const dialogFooterClass =
  "-mx-6 -mb-6 flex flex-col-reverse gap-2.5 border-t border-line px-6 py-4 max-sm:-mx-4 max-sm:px-4 max-sm:pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end";
