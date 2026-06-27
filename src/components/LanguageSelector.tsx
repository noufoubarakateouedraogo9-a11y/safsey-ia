import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { availableLanguages, resources } from "../i18n";

export const LanguageSelector = () => {
  const { i18n, t } = useTranslation();

  return (
    <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-slate-300">
      <Languages className="h-3.5 w-3.5 text-slate-400" />
      <select
        value={i18n.resolvedLanguage ?? i18n.language}
        onChange={(event) => void i18n.changeLanguage(event.target.value)}
        className="bg-transparent text-xs text-slate-200 outline-none"
        aria-label={t("language.nativeName")}
      >
        {availableLanguages.map((lng) => {
          const nativeName = resources[lng]?.translation?.language &&
            typeof resources[lng].translation.language === "object" &&
            "nativeName" in resources[lng].translation.language
            ? String((resources[lng].translation.language as { nativeName: string }).nativeName)
            : lng.toUpperCase();

          return (
            <option key={lng} value={lng} className="bg-slate-900 text-slate-100">
              {nativeName}
            </option>
          );
        })}
      </select>
    </label>
  );
};