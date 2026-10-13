export interface PatchLine {
  text: string;
  kind: "added" | "removed" | "context" | "header";
  before: number | null;
  after: number | null;
}

export function githubPatchLines(patch: string): PatchLine[] {
  let before = 0;
  let after = 0;
  let inHunk = false;
  return patch.split("\n").filter((line, index, all) => index < all.length - 1 || line !== "").map((text) => {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
    if (hunk) {
      before = Number(hunk[1]); after = Number(hunk[2]); inHunk = true;
      return { text, kind: "header", before: null, after: null };
    }
    if (!inHunk || text.startsWith("\\")) return { text, kind: "header", before: null, after: null };
    if (text.startsWith("+")) return { text, kind: "added", before: null, after: after++ };
    if (text.startsWith("-")) return { text, kind: "removed", before: before++, after: null };
    return { text, kind: "context", before: before++, after: after++ };
  });
}

export function githubBytes(bytes: number): string {
  if (bytes < 1_000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
