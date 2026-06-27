import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SearchSource } from "../lib/types";
import { hostFromUrl, initialsFromUrl } from "../lib/format";
import { cn } from "../utils/cn";

type SourceCardProps = {
  source: SearchSource;
  highlighted?: boolean;
};

export const SourceCard = ({ source, highlighted }: SourceCardProps) => {
  const { i18n } = useTranslation();

  return <a
    href={source.url}
    target="_blank"
    rel="noopener noreferrer"
    data-source-index={source.id}
    className={cn(
      "group flex min-w-[220px] max-w-[260px] shrink-0 flex-col gap-2 rounded-xl border bg-white/[0.02] p-3 transition",
      highlighted
        ? "border-cyan-400/60 bg-cyan-500/[0.07] ring-1 ring-cyan-400/30"
        : "border-white/10 hover:border-white/20 hover:bg-white/[0.04]",
    )}
  >
    <div className="flex items-center gap-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-cyan-500/30 to-violet-500/30 text-[10px] font-bold text-cyan-200">
        {initialsFromUrl(source.url)}
      </span>
      <span className="truncate text-[11px] text-slate-400">{hostFromUrl(source.url)}</span>
      <span className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-md text-slate-500 transition group-hover:text-cyan-300">
        <ExternalLink className="h-3.5 w-3.5" />
      </span>
    </div>
    <span className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-100">
      [{source.id}] {source.title}
    </span>
    {source.publishedDate && (
      <span className="text-[10px] text-slate-500">
        {new Date(source.publishedDate).toLocaleDateString(i18n.resolvedLanguage, { day: "2-digit", month: "short", year: "numeric" })}
      </span>
    )}
  </a>
};
