import { motion } from "framer-motion";
import { FlaskConical, Rocket } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../utils/cn";
import type { ChatMode } from "../lib/types";

type ModeToggleProps = {
  mode: ChatMode;
  onChange: (mode: ChatMode) => void;
};

const options: { value: ChatMode; labelKey: string; icon: typeof Rocket }[] = [
  { value: "regular", labelKey: "mode.regular", icon: FlaskConical },
  { value: "fun", labelKey: "mode.fun", icon: Rocket },
];

export const ModeToggle = ({ mode, onChange }: ModeToggleProps) => {
  const { t } = useTranslation();

  return <div className="relative inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.03] p-1">
    {options.map((option) => {
      const active = mode === option.value;
      const Icon = option.icon;
      return (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "relative z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            active ? "text-white" : "text-slate-400 hover:text-slate-200",
          )}
        >
          {active && (
            <motion.span
              layoutId="mode-pill"
              className={cn(
                "absolute inset-0 -z-10 rounded-full",
                option.value === "fun"
                  ? "bg-gradient-to-r from-fuchsia-500 to-violet-600 shadow-lg shadow-violet-600/30"
                  : "bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/30",
              )}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          <Icon className="h-3.5 w-3.5" />
          {t(option.labelKey)}
        </button>
      );
    })}
  </div>;
};
