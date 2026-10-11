# Layouts guide — the structures a screen is built on

`.tau/DESIGN.md` lists the layouts this app's style allows. Pick one per screen, for what the screen holds, and build it as described here. Use only layouts on that list.

Two rules hold for all of them:
- **Something is biggest.** One element per screen is clearly the most important and is given the most room. Equal thirds and equal halves are what make a page look generated.
- **Mobile is designed, not collapsed.** Below `md`, columns stack in reading order, side navigation becomes a top bar with a menu, and nothing scrolls sideways unless it is meant to.

A page has a third:
- **The first screen makes the offer.** What a visitor sees before scrolling holds the headline, a line of support and the action together, at desktop and at phone width. Size the headline to what it says: three words can fill a screen, a sentence cannot. When the two compete, the type gets smaller; the action does not move down.

## Pages

**Split hero** — `grid lg:grid-cols-12`, words in `lg:col-span-7`, image or product in `lg:col-span-5` (or 5/7), vertically centred, filling most of the first screen. Later sections repeat the split with the sides swapped. The image may bleed off the edge of the page.

**Editorial column** — text in one column of `max-w-[65ch]`, set left of centre on wide screens with the remaining space empty or holding small notes. Headings are oversized. Images and pull quotes break out wider than the column (`-mx-*` or a full-bleed wrapper), then the column resumes.

**Bento grid** — `grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 auto-rows-[minmax(9rem,auto)]`. Tiles span different numbers of columns and rows (`col-span-2 row-span-2`, `col-span-3`, `col-span-1`). One tile is clearly the largest. Each tile holds one thing: a figure, a chart, an image, an action.

**Full-bleed bands** — a stack of full-width `<section>`s, each with its own inner arrangement inside a `max-w-6xl mx-auto` container. No two neighbouring bands are laid out the same way. A band's background is what tells a reader the subject has changed, so change it where the subject does: `bg-background` and `bg-muted` are a shade apart and read as one surface from a distance, while `band-1`, `band-2`, `band-3`, `bg-primary text-primary-foreground` and an image each read as a new one. How much of a page goes on colour is the design's call — its Energy line in `.tau/DESIGN.md` says.

A band class is a scope, not just a fill: `<section className="band-1">` re-points `text-foreground`, `text-muted-foreground`, `border-border`, `bg-card` and the components for everything inside it, and the main button turns to the band's text colour. Build the inside as you would on the page. Do not add `text-white`, a literal colour, or a second `bg-*` on the same element.

**Poster** — the first screen is `min-h-svh` and holds one statement, a line of supporting text, and one action, all three inside it. The statement is set as large as its length allows: `text-[clamp(3rem,12vw,11rem)] leading-[0.9]` for three or four words, nearer `text-[clamp(2.75rem,7vw,6rem)]` for a sentence. Navigation is minimal. Everything else follows below, plainly.

**Index list** — the content as rows: `divide-y` or a table, each row a number or date, a title, a few facts, and an arrow. Rows are tall (`py-6`) and the title is large. Hovering a row reveals an image or more detail. No cards.

## Apps

**Sidebar shell** — `grid min-h-svh md:grid-cols-[15rem_1fr]`. The sidebar (`bg-sidebar text-sidebar-foreground border-r`) holds the name, the sections, and the account at the bottom. The content column has a slim header (title, primary action) and a scrolling body. Below `md` the sidebar becomes a `Sheet` opened from the header.

**Top-bar workspace** — a `h-14` bar with the name at the left, two to four sections in the middle, actions at the right; below it one working area in `max-w-5xl mx-auto`. Sub-views are `Tabs` under the page title.

**Focus column** — a single column, `max-w-md` or `max-w-xl`, centred horizontally and placed in the upper-middle of the screen (`min-h-svh grid place-items-center` with bottom padding). The one input and the one result are large. Nothing sits beside it; secondary things go below or behind a button.

**Master–detail** — `grid md:grid-cols-[20rem_1fr] h-svh`. The list scrolls on its own (`overflow-y-auto`), with search above it; the selected row is marked with `bg-accent`. The detail pane scrolls separately. Below `md` show the list alone, and the detail as its own screen with a back button.

**Dashboard grid** — a row of three to five key figures (small label, very large number, a change indicator), then `grid lg:grid-cols-3 gap-4` where the main chart spans two columns and two rows and smaller panels fill around it. A table of recent items comes last, full width.

**Board** — a `flex gap-4 overflow-x-auto` row of columns, each `w-72 shrink-0` with a header (name, count) and a vertical stack of cards. The board fills the viewport height; columns scroll vertically inside it.

**Split tool** — `grid lg:grid-cols-2 min-h-svh`: controls or input on the left, the live result on the right, updating as the user types. The result side has a contrasting background (`bg-muted`) and holds the copy or download action. Below `lg`, input first, result under it.
