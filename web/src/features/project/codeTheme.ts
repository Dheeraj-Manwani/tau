import { EditorView } from "@uiw/react-codemirror";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

/**
 * The Code tab's editor, built from Tau's tokens instead of One Dark: void
 * page, tertiary gutter, blue cursor and a 12% blue selection. Hex values
 * mirror `index.css` because CodeMirror themes are CSS-in-JS, not classes.
 */
const VOID = "#09090b";
const SURFACE = "#111113";
const OVERLAY = "#151518";
const RAISED = "#1c1c20";
const LINE = "#27272a";
const LINE_STRONG = "#34343a";
const TX = "#fafafa";
const TX2 = "#a1a1aa";
const TX3 = "#8b8b95";
const BLUE = "#60a5fa";
const BLUE_HI = "#7ab4fb";
const ORANGE = "#fb923c";
const ORANGE_HI = "#fda55f";
const GREEN = "#34d399";
const RED = "#f87171";

const chrome = EditorView.theme(
  {
    "&": { color: TX, backgroundColor: VOID },
    ".cm-content": { caretColor: BLUE, fontFamily: "var(--mono)" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: BLUE, borderLeftWidth: "2px" },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      { backgroundColor: "rgba(96, 165, 250, 0.2)" },
    ".cm-activeLine": { backgroundColor: "rgba(255, 255, 255, 0.025)" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: TX2 },
    ".cm-gutters": { backgroundColor: VOID, color: TX3, border: "none" },
    ".cm-lineNumbers .cm-gutterElement": { padding: "0 12px 0 16px" },
    ".cm-selectionMatch": { backgroundColor: "rgba(96, 165, 250, 0.12)" },
    "&.cm-focused .cm-matchingBracket": { backgroundColor: "rgba(96, 165, 250, 0.2)", outline: "none" },
    ".cm-searchMatch": { backgroundColor: "rgba(251, 146, 60, 0.2)", outline: `1px solid rgba(251, 146, 60, 0.34)` },
    ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "rgba(96, 165, 250, 0.24)" },
    ".cm-panels": { backgroundColor: OVERLAY, color: TX },
    ".cm-panels.cm-panels-top": { borderBottom: `1px solid ${LINE_STRONG}` },
    ".cm-panels.cm-panels-bottom": { borderTop: `1px solid ${LINE_STRONG}` },
    ".cm-tooltip": { backgroundColor: OVERLAY, border: `1px solid ${LINE_STRONG}`, borderRadius: "8px", color: TX },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: RAISED, color: TX },
    ".cm-foldPlaceholder": { backgroundColor: SURFACE, border: `1px solid ${LINE}`, color: TX2 },
  },
  { dark: true },
);

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.controlKeyword, t.operatorKeyword], color: BLUE },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.labelName], color: BLUE_HI },
  { tag: [t.typeName, t.className, t.namespace, t.annotation], color: ORANGE_HI },
  { tag: [t.number, t.bool, t.null, t.atom, t.constant(t.name), t.standard(t.name)], color: ORANGE },
  { tag: [t.string, t.special(t.string), t.regexp, t.escape], color: GREEN },
  { tag: [t.tagName], color: BLUE_HI },
  { tag: [t.attributeName, t.propertyName], color: TX2 },
  { tag: [t.variableName, t.definition(t.variableName)], color: TX },
  { tag: [t.operator, t.punctuation, t.separator, t.bracket, t.angleBracket], color: TX2 },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: TX3, fontStyle: "italic" },
  { tag: [t.meta, t.processingInstruction], color: TX3 },
  { tag: t.heading, color: TX, fontWeight: "600" },
  { tag: t.link, color: BLUE, textDecoration: "underline" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "600" },
  { tag: t.invalid, color: RED },
]);

export const tauCodeTheme = [chrome, syntaxHighlighting(highlight)];
