// ============================================================
// SAFSEY IA — Écran d'accueil
// ============================================================
import { motion } from "framer-motion";
import { Code2, Scale, Smile, Sparkles } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import type { ChatMode } from "../lib/types";
import { suggestions } from "../lib/config";
import { cn } from "../utils/cn";

type WelcomeScreenProps = {
  mode: ChatMode;
  onPick: (prompt: string, opts: { web?: boolean; mode?: ChatMode }) => void;
};

const iconMap = {
  spark: Sparkles,
  smile: Smile,
  code: Code2,
  scale: Scale,
} as const;

export const WelcomeScreen = ({ mode, onPick }: WelcomeScreenProps) => {
  const { t } = useTranslation();

  return <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-10 text-center">
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative mb-6"
    >
      <div className="absolute inset-0 -z-10 rounded-full bg-cyan-500/30 blur-2xl" />
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-600 text-3xl font-black text-white shadow-2xl shadow-cyan-500/30">
        {t("brand.name").slice(0, 1)}
      </div>
    </motion.div>

    <motion.h1
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="bg-gradient-to-br from-white via-white to-slate-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl"
    >
      {t("welcome.title")}
    </motion.h1>
    <motion.p
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.16 }}
      className="mt-3 max-w-md text-[15px] text-slate-400"
    >
      <Trans
        i18nKey="welcome.description"
        values={{ fun: t("mode.fun"), image: t("nav.imageShort"), video: t("nav.videoShort") }}
        components={{
          fun: <span className="text-fuchsia-400" />,
          image: <span className="text-cyan-400" />,
          video: <span className="text-violet-400" />,
        }}
      />
    </motion.p>

    <div className="mt-8 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
      {suggestions.map((s, index) => {
        const Icon = iconMap[s.icon as keyof typeof iconMap] ?? Sparkles;
        return (
          <motion.button
            key={s.titleKey}
            type="button"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 + index * 0.06 }}
            onClick={() => onPick(t(s.promptKey), { web: s.web, mode: ("mode" in s ? s.mode : undefined) as ChatMode | undefined })}
            className={cn(
              "group flex flex-col items-start gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-3.5 text-left transition hover:border-cyan-400/30 hover:bg-white/[0.04]",
            )}
          >
            <span className="flex items-center gap-2 text-[13px] font-semibold text-slate-200">
              <Icon className="h-4 w-4 text-cyan-400 transition group-hover:scale-110" />
              {t(s.titleKey)}
              {"mode" in s && s.mode === "fun" && (
                <span className="rounded-full bg-fuchsia-500/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-fuchsia-300">
                  {t("mode.fun")}
                </span>
              )}
            </span>
            <span className="line-clamp-2 text-xs text-slate-500">{t(s.promptKey)}</span>
          </motion.button>
        );
      })}
    </div>

    <p className="mt-6 text-[11px] text-slate-600">
      {t("welcome.currentMode", { mode: mode === "fun" ? t("mode.funIronique") : t("mode.regular") })}
    </p>
  </div>
};
