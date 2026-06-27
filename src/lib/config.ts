// ============================================================
// SAFSEY IA — Configuration frontend
// ============================================================

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const resolveApiUrl = (): string => {
  const fromEnv = import.meta.env.VITE_API_URL;
  if (fromEnv && fromEnv.trim() !== "") return trimTrailingSlash(fromEnv.trim());
  // Chemin relatif → le proxy Vite redirige /api vers le backend Express (port 5000)
  return "";
};

export const clientConfig = {
  apiUrl: resolveApiUrl(),
  appName: "SAFSEY IA",
  appTagline: "IA conversationnelle · Image locale · Vidéo Cloud",
  storageKey: "safsey.conversations.v1",
  settingsKey: "safsey.settings.v1",
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? "",
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
};

export const suggestions = [
  {
    titleKey: "suggestions.items.0.title",
    promptKey: "suggestions.items.0.prompt",
    web: false,
    icon: "spark",
  },
  {
    titleKey: "suggestions.items.1.title",
    promptKey: "suggestions.items.1.prompt",
    web: false,
    mode: "fun" as const,
    icon: "smile",
  },
  {
    titleKey: "suggestions.items.2.title",
    promptKey: "suggestions.items.2.prompt",
    web: false,
    icon: "code",
  },
  {
    titleKey: "suggestions.items.3.title",
    promptKey: "suggestions.items.3.prompt",
    web: false,
    icon: "scale",
  },
] as const;
