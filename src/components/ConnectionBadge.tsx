import { cn } from "../utils/cn";
import type { BackendStatus } from "../lib/types";
import { useTranslation } from "react-i18next";

const dotMap: Record<BackendStatus, string> = {
  checking: "bg-amber-400",
  online:   "bg-emerald-400",
  offline:  "bg-rose-500",
};

export const ConnectionBadge = ({ status }: { status: BackendStatus }) => {
  const { t } = useTranslation();

  return <div
    className={cn(
      "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition",
      status === "online"
        ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
        : status === "offline"
        ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
        : "border-white/10 bg-white/[0.03] text-slate-300",
    )}
  >
    <span className="relative flex h-2 w-2">
      {status === "online" && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
      )}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", dotMap[status])} />
    </span>
    {t(`status.${status}`)}
  </div>
};
