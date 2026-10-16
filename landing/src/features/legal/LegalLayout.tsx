import { Children, isValidElement, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftIcon } from "lucide-react";

import { SiteFooter } from "@/src/components/SiteFooter";

/** "4. Credits & billing" → "credits-billing", stable across renumbering. */
function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/^\d+\.\s*/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** One numbered section of a legal page; its title feeds the page's TOC. */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section id={slug(title)} className="scroll-mt-8 border-t border-line pt-8 pb-2 first:border-t-0 first:pt-0">
      <h2 className="text-[17px] font-semibold text-silver-900">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-[1.7] text-silver-600 [&_b]:font-semibold [&_b]:text-silver-900">
        {children}
      </div>
    </section>
  );
}

/**
 * The long-form legal pages (doc/REDESIGN_PLAN.md Phase 11): a Display L
 * title, a mono "Last updated" line, body at 15/1.7 in a 720px column, and an
 * in-page contents list built from the sections, sticky on wide screens and
 * folded into a disclosure on phones.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  const sections = Children.toArray(children)
    .filter(isValidElement<{ title: string }>)
    .filter((child) => child.type === LegalSection)
    .map((child) => child.props.title);

  const toc = (
    <ol className="flex flex-col gap-2 text-[13px]">
      {sections.map((s) => (
        <li key={s}>
          <a href={`#${slug(s)}`} className="text-silver-600 transition-colors hover:text-silver-900">
            {s}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="flex min-h-[100svh] flex-col bg-space-void">
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-[13px] text-silver-600 transition-colors hover:text-silver-900"
        >
          <ArrowLeftIcon className="size-3.5" />
          Back to tau
        </Link>

        <header className="mt-8">
          <p className="font-mono text-[11px] tracking-[0.16em] text-blue-500">// LEGAL</p>
          <h1 className="display-heading display-l mt-3 text-silver-900 max-sm:text-[40px]">{title}</h1>
          <p className="mt-3 font-mono text-xs text-silver-500">Last updated {updated}</p>
        </header>

        <details className="mt-8 rounded-lg border border-line bg-space-surface px-4 py-3 lg:hidden">
          <summary className="cursor-pointer text-[13px] font-medium text-silver-900">On this page</summary>
          <div className="mt-3">{toc}</div>
        </details>

        <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,720px)_200px] lg:justify-between">
          <article className="flex min-w-0 flex-col gap-6">{children}</article>
          <nav aria-label="On this page" className="hidden lg:block">
            <div className="sticky top-8">
              <p className="lab mb-3">On this page</p>
              {toc}
            </div>
          </nav>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
