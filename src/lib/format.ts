import type { ChatMode } from "./types";

/**
 * Transforms [n] citation tokens inside the LLM answer into clickable
 * markdown links pointing to the matching source, only for indices that exist.
 */
export const injectCitationLinks = (content: string, sourceCount: number): string => {
  if (sourceCount <= 0) return content;
  return content.replace(/\[(\d{1,2})\]/g, (match, digits) => {
    const index = Number(digits);
    if (index >= 1 && index <= sourceCount) {
      return `[${index}](#source-${index})`;
    }
    return match;
  });
};

export const formatRelativeTime = (iso: string): string => {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60_000);

  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;

  const days = Math.round(hours / 24);
  if (days < 7) return `il y a ${days} j`;

  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
};

export const deriveTitle = (text: string): string => {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "...";
  return cleaned.length > 42 ? `${cleaned.slice(0, 42)}…` : cleaned;
};

export const modeLabel = (mode: ChatMode): string =>
  mode === "fun" ? "Fun / Ironique" : "Régulier";

export const initialsFromUrl = (url: string): string => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const base = host.split(".")[0];
    return base.slice(0, 2).toUpperCase();
  } catch {
    return "W";
  }
};

export const hostFromUrl = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
