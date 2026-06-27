import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

export const TypingIndicator = ({ mode }: { mode: "regular" | "fun" }) => {
  const { t } = useTranslation();

  return <div className="flex items-center gap-3">
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 text-white shadow-lg shadow-cyan-500/20">
      <Sparkles className="h-4 w-4" />
    </div>
    <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.03] px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 animate-bounce rounded-full bg-cyan-300"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
        />
      ))}
      <span className="ml-2 text-xs text-slate-400">
        {mode === "fun" ? t("chat.thinkingFun") : t("chat.thinking")}
      </span>
    </div>
  </div>;
};
