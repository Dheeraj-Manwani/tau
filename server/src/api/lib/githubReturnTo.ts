/** Preserve project navigation while allowing only the configured web origin. */
export function safeGithubReturnTo(raw: unknown, appUrl: string): string {
  const fallback = `${appUrl.replace(/\/+$/, "")}/`;
  if (typeof raw !== "string") return fallback;
  try {
    const target = new URL(raw);
    const app = new URL(appUrl);
    if (!["http:", "https:"].includes(target.protocol) || target.username || target.password || target.origin !== app.origin) return fallback;
    return target.href;
  } catch { return fallback; }
}
