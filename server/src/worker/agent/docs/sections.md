# Sections guide — the parts a long page is made of

For a page people scroll and read: a landing page, a site, a portfolio, an about page. A screen people operate — a tool, a dashboard, a form — is built on its layout alone, not from these.

The layout `.tau/DESIGN.md` names arranges the first screen. Under it comes a run of sections, and a page invented one section at a time comes out as the same heading, paragraph and row of cards all the way down. So decide the run first: name each section from this guide and say what it is there for, in order, then build that list.

- **One job each.** The content picks the pattern: a sequence is steps, a number is a figure, something a person said is a quote. A section with nothing of its own to say is cut, not padded.
- **Neighbours differ.** Two sections in a row never share a pattern or an arrangement. How far their backgrounds differ is the design's call: its Energy line says.
- **Close by asking.** What the first screen asked for is asked for again at the bottom.

## The first screen
A visitor decides here, so the whole offer is on it before any scrolling, at desktop and at phone width: the headline, a line of support, the action, and whatever the layout puts beside them.

These are what make it this brand's and nobody else's. Anything tilted or set off reaches past its box, which on a phone makes the whole page scroll sideways: put `overflow-hidden` on the section that holds one.
- **Framed picture** — one photograph chosen for its mood, in a frame with some character: a tall crop (`aspect-[4/5] object-cover`), an outline set off behind it (a sibling `absolute inset-0 translate-x-3 translate-y-3 border-2 border-foreground`), a slight tilt (`-rotate-2`).
- **Sticker** — a few words on a small rotated shape overlapping a corner of the picture: `absolute -top-5 -right-5 rotate-12 bg-primary text-primary-foreground p-4 text-center`. A promise, a price, a date. Once on a page; a second one stops it being special.
- **Specimen** — the product itself as an object with real content in it: a profile card, a ticket, a receipt, a message thread, a letter. Tilt it a little, with room round it: two that overlap on a phone hide each other's words. It says more than a paragraph describing it, and can be a section of its own further down.

## Rhythm — short sections that break up long ones
- **Ticker** — a strip of short phrases moving sideways between two sections: `overflow-hidden border-y py-3`, and inside it `flex w-max animate-[marquee_40s_linear_infinite]` holding the list twice, each item `shrink-0 px-6`. Add `@keyframes marquee { to { transform: translateX(-50%); } }` at the end of `src/index.css`. Where the motion level is 3 or under, leave it a still row.
- **Figures** — three or four numbers, each very large (`font-heading text-6xl`) over a small label, in a row divided by rules rather than set in cards. Each number has to say something specific.

## Content
- **Numbered rows** — `01`, `02`, `03` in `font-mono text-muted-foreground`, a large title and a sentence, full width, separated by `border-t`. For reasons, rules, or features that deserve a line each. No icons, no cards.
- **Steps** — a short sequence side by side, each a big numeral over two lines; stacked on a phone. Only for things that happen in order.
- **Split feature** — words on one side, a picture or a specimen on the other, unequal (`lg:grid-cols-12`, spans of 5 and 7). Swap the sides if it is used again.
- **Pull quote** — one sentence at heading size (`font-heading text-4xl md:text-6xl`) alone on a band, a small attribution under it. The brand's own line, or a customer's words if the user gave some; do not invent a review.
- **Questions** — the `Accordion` component in a narrow column beside a heading that stays put (`lg:sticky lg:top-24`). Ask what a doubter would ask, and answer in the brand's voice.
- **Comparison** — a `Table` with this product's column marked out (`bg-muted`), or two unequal columns: with it, without it.
- **Timeline** — dated entries down a rule (`border-l pl-6`). For a history, a schedule, a roadmap.

## Asking
- **Closing call** — the last section before the footer: the offer in one line at heading size and the same action as the first screen, on a band where the design uses them.
- **Dialog form** — when the action is to apply, join or book, it opens a `Dialog` holding a short form, validated, with a success state that says what happens next. Every copy of the action on the page opens the same one. Better than scrolling the visitor to a form at the bottom.
