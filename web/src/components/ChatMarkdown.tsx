import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function ChatMarkdown({
  content,
  compact = false,
}: {
  content: string;
  compact?: boolean;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="mb-2.5 leading-[1.65] last:mb-0">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        h1: ({ children }) => (
          <p className="mb-1 mt-3 font-semibold first:mt-0">{children}</p>
        ),
        h2: ({ children }) => (
          <p className="mb-1 mt-3 font-semibold first:mt-0">{children}</p>
        ),
        h3: ({ children }) => (
          <p className="mb-1 mt-2 font-medium first:mt-0">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="mb-2 list-disc space-y-0.5 pl-4 last:mb-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2 list-decimal space-y-0.5 pl-4 last:mb-0">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="leading-[1.65]">{children}</li>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline-offset-3 hover:text-blue-hi hover:underline"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-2 border-l-2 border-line-strong pl-3 text-silver-600 last:mb-0">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-3 border-line" />,
        code: ({ className, children }) => {
          if (compact) {
            return (
              <code
                className="font-semibold"
                style={{
                  display: "inline",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  lineHeight: "inherit",
                  color: "inherit",
                  background: "none",
                  padding: 0,
                  borderRadius: 0,
                }}
              >
                {children}
              </code>
            );
          }
          const isBlock = /language-/.test(className ?? "");
          if (isBlock) {
            return (
              <pre className="mb-2.5 overflow-x-auto rounded-md border border-line bg-space-void px-3.5 py-3 last:mb-0">
                <code className="block bg-transparent p-0 font-mono text-[12.5px] leading-[1.7] text-silver-600">
                  {children}
                </code>
              </pre>
            );
          }
          return (
            <code className="inline rounded-xs border border-line bg-space-surface px-1 py-px font-mono text-[0.85em] text-silver-900">
              {children}
            </code>
          );
        },
        pre: ({ children }) => <>{children}</>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
