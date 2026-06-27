import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

const localeModules = import.meta.glob("./locales/*.json", {
  eager: true,
  import: "default",
}) as Record<string, Record<string, unknown>>;

export const resources = Object.fromEntries(
  Object.entries(localeModules).map(([filePath, messages]) => {
    const language = filePath.match(/([^/]+)\.json$/)?.[1] ?? "en";
    return [language, { translation: messages }];
  }),
);

export const availableLanguages = Object.keys(resources).sort();

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: availableLanguages,
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "safsey.language",
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

export default i18n;
