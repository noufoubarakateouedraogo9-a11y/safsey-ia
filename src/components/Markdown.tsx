import { memo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";

type MarkdownProps = {
  content: string;
  onCitationClick?: (index: number) => void;
};

const extractText = (children: ReactNode): string => {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(extractText).join("");
  if (children && typeof children === "object" && "props" in children) {
    // @ts-expect-error recursive children
    return extractText(children.props.children);
  }
  return "";
};

const CodeBlock = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const code = extractText(children);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1_600);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="group relative my-3 overflow-hidden rounded-xl border border-white/10 bg-black/50">
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100"
        aria-label={t("markdown.copyCode")}
      >
        {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
        {copied ? t("markdown.copied") : t("markdown.copy")}
      </button>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed">{children}</pre>
    </div>
  );
};

const MarkdownBase = ({ content, onCitationClick }: MarkdownProps) => (
  <div className="prose-chat">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-3 leading-relaxed last:mb-0">{children}</p>,
        h1: ({ children }) => <h1 className="mb-3 mt-4 text-xl font-semibold text-white first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-2 mt-4 text-lg font-semibold text-white first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-2 mt-3 text-base font-semibold text-white first:mt-0">{children}</h3>,
        ul: ({ children }) => <ul className="mb-3 ml-5 list-disc space-y-1 marker:text-cyan-400/70">{children}</ul>,
        ol: ({ children }) => <ol className="mb-3 ml-5 list-decimal space-y-1 marker:text-cyan-400/70">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        a: ({ href, children }) => {
          if (href?.startsWith("#source-")) {
            const index = Number(href.replace("#source-", ""));
            return (
              <button
                type="button"
                onClick={() => onCitationClick?.(index)}
                className="mx-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded bg-cyan-500/15 px-1 align-baseline text-[10px] font-semibold text-cyan-300 transition hover:bg-cyan-500/30 hover:text-cyan-200"
              >
                {children}
              </button>
            );
          }
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-300 underline decoration-cyan-300/40 underline-offset-2 hover:text-cyan-200"
            >
              {children}
            </a>
          );
        },
        strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
        em: ({ children }) => <em className="text-slate-300">{children}</em>,
        blockquote: ({ children }) => (
          <blockquote className="my-3 border-l-2 border-cyan-400/40 bg-white/[0.02] py-1 pl-4 text-slate-300">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-4 border-white/10" />,
        table: ({ children }) => (
          <div className="my-3 overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="border-b border-white/10 bg-white/5 px-3 py-2 text-left font-medium text-white">{children}</th>,
        td: ({ children }) => <td className="border-b border-white/5 px-3 py-2 text-slate-300">{children}</td>,
        code: ({ className, children, ...props }) => {
          const isBlock = typeof className === "string" && className.includes("language-");
          if (isBlock) {
            return <CodeBlock><code className={className} {...props}>{children}</code></CodeBlock>;
          }
          return (
            <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[12.5px] text-cyan-200" {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => <>{children}</>,
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);

export const Markdown = memo(MarkdownBase);
