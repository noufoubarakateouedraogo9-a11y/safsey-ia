import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CreditsInfo } from "../lib/types";

/**
 * Convertit un solde de secondes-crédits en chaîne lisible.
 * Exemples : 300 → "5 min" | 185 → "3 min 5 s" | 30 → "30 s"
 */
const formatSeconds = (total: number): string => {
  if (total <= 0) return "0 s";
  const min = Math.floor(total / 60);
  const sec = total % 60;
  if (min === 0) return `${sec} s`;
  if (sec === 0) return `${min} min`;
  return `${min} min ${sec} s`;
};

export const CreditsBadge = ({
  credits,
  onBuy,
}: {
  credits: CreditsInfo | null;
  onBuy: () => void;
}) => {
  const { t } = useTranslation();
  const raw = credits?.credits ?? null;
  const isLow = raw !== null && raw < 60; // moins d'une minute → alerte visuelle

  return (
    <button
      type="button"
      onClick={onBuy}
      className={`group flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        isLow
          ? "border-amber-400/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
          : "border-cyan-400/30 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-100 hover:border-cyan-400/50 hover:from-cyan-500/15 hover:to-blue-500/15"
      }`}
      title={t("billing.addCredits", "Recharger les crédits vidéo")}
    >
      <Clock className={`h-3.5 w-3.5 transition ${isLow ? "text-amber-400" : "text-cyan-400 group-hover:text-cyan-300"}`} />
      <span>
        {raw === null ? "…" : formatSeconds(raw)}
      </span>
      <span className={`ml-0.5 hidden text-[10px] sm:inline ${isLow ? "text-amber-300/80" : "text-cyan-300/70"}`}>
        {isLow
          ? "⚠ Faible"
          : t("billing.videoCredit", "vidéo")}
      </span>
    </button>
  );
};
