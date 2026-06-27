// ============================================================
// SAFSEY IA — Barre latérale
// ============================================================
import { motion } from "framer-motion";
import { MessageSquare, Plus, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Conversation } from "../lib/types";
import { cn } from "../utils/cn";
import { formatRelativeTime } from "../lib/format";

type SidebarProps = {
  conversations: Conversation[];
  activeId: string | null;
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
};

export const Sidebar = ({ conversations, activeId, open, onClose, onSelect, onNew, onDelete }: SidebarProps) => {
  const { t } = useTranslation();

  return <>
    {open && (
      <div
        className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
    )}

    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-full w-72 flex-col border-r border-white/10 bg-[#060a14]/95 backdrop-blur-xl transition-transform duration-300 md:static md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 text-sm font-black text-white">
            {t("brand.name").slice(0, 1)}
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight text-white">{t("brand.name")}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">{t("brand.sidebarSubtitle")}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white md:hidden"
          aria-label={t("sidebar.close")}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="px-3">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-sm font-medium text-slate-100 transition hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-white"
        >
          <Plus className="h-4 w-4" /> {t("sidebar.newConversation")}
        </button>
      </div>

      <div className="mt-4 flex-1 space-y-1 overflow-y-auto px-2 pb-4">
        <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{t("sidebar.history")}</p>
        {conversations.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-slate-600">{t("sidebar.empty")}</p>
        )}
        {conversations.map((conversation) => {
          const active = conversation.id === activeId;
          return (
            <div
              key={conversation.id}
              className={cn(
                "group relative flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 transition",
                active ? "bg-white/[0.06]" : "hover:bg-white/[0.03]",
              )}
              onClick={() => onSelect(conversation.id)}
            >
              {active && (
                <motion.span
                  layoutId="active-conversation"
                  className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-cyan-400"
                />
              )}
              <MessageSquare className={cn("h-4 w-4 shrink-0", active ? "text-cyan-400" : "text-slate-500")} />
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-[13px]", active ? "text-white" : "text-slate-300")}>
                  {conversation.title}
                </p>
                <p className="text-[10px] text-slate-600">{formatRelativeTime(conversation.updatedAt)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(conversation.id); }}
                aria-label={t("sidebar.delete")}
                className="rounded-md p-1 text-slate-600 opacity-0 transition hover:bg-rose-500/10 hover:text-rose-400 group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="border-t border-white/10 p-3">
        <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px] leading-relaxed text-slate-500">
          <span className="text-cyan-400">{t("sidebar.footerImage")}</span> · {t("sidebar.footerImageMeta")}
          &nbsp;|&nbsp;
          <span className="text-violet-400">{t("sidebar.footerVideo")}</span> · {t("sidebar.footerVideoMeta")}
        </div>
      </div>
    </aside>
  </>;
};
