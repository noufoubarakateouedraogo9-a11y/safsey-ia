import { clientConfig } from "./config";
import type { AppSettings, Conversation } from "./types";

export const loadConversations = (): Conversation[] => {
  try {
    const raw = localStorage.getItem(clientConfig.storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Conversation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveConversations = (conversations: Conversation[]) => {
  try {
    localStorage.setItem(clientConfig.storageKey, JSON.stringify(conversations));
  } catch {
    /* quota exceeded — silently ignore */
  }
};

export const loadSettings = (): AppSettings | null => {
  try {
    const raw = localStorage.getItem(clientConfig.settingsKey);
    if (!raw) return null;
    return JSON.parse(raw) as AppSettings;
  } catch {
    return null;
  }
};

export const saveSettings = (settings: AppSettings) => {
  try {
    localStorage.setItem(clientConfig.settingsKey, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
};
