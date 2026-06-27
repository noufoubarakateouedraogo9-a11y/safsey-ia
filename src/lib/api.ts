// ============================================================
// SAFSEY IA — Client API (routes découplées)
//   /api/generate-image  → image_service (Fooocus local)
//   /api/generate-video  → video_service (Cloud)
//   /api/chat            → LLM (Groq / Ollama)
// ============================================================
import { clientConfig } from "./config";
import { authHeaders } from "./billing";
import { supabase } from "./supabase";
import type {
  AppSettings,
  BackendStatus,
  ChatApiResponse,
  ChatMessage,
  ImageRequest,
  ImageResult,
  VideoRequest,
  VideoResult,
} from "./types";

type SendChatArgs = { messages: ChatMessage[] } & AppSettings;

export class ChatApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ChatApiError";
  }
}

const withTimeout = (ms: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, clear: () => clearTimeout(timer) };
};

const parseApiError = async (res: Response): Promise<ChatApiError> => {
  let code = `HTTP_${res.status}`;
  let message = "Le backend a renvoyé une erreur.";
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    if (body?.error) code = body.error;
    if (body?.message) message = body.message;
  } catch { /* non-JSON */ }
  return new ChatApiError(code, message, res.status);
};

// ── Santé ────────────────────────────────────────────────────
export const checkBackendHealth = async (): Promise<BackendStatus> => {
  const { controller, clear } = withTimeout(6_000);
  try {
    const res = await fetch(`${clientConfig.apiUrl}/api/health`, {
      method: "GET",
      signal: controller.signal,
      // En production same-domain, no-cache pour éviter les faux positifs
      headers: { "Cache-Control": "no-cache" },
    });
    clear();
    return res.ok ? "online" : "offline";
  } catch {
    clear();
    return "offline";
  }
};

// ── Chat IA ──────────────────────────────────────────────────
export const sendChat = async ({ messages, mode, webSearch }: SendChatArgs): Promise<ChatApiResponse> => {
  const { controller, clear } = withTimeout(45_000);
  try {
    const res = await fetch(`${clientConfig.apiUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        mode,
        webSearch,
      }),
    });
    clear();
    if (!res.ok) throw await parseApiError(res);
    return (await res.json()) as ChatApiResponse;
  } catch (error) {
    clear();
    if (error instanceof ChatApiError) throw error;
    throw new ChatApiError("NETWORK_ERROR", "Impossible de joindre SAFSEY IA.", 0);
  }
};

// ── /api/generate-image (image_service — Fooocus local) ──────
export const generateImage = async (request: ImageRequest): Promise<ImageResult> => {
  const { controller, clear } = withTimeout(120_000);
  const { data: { user } } = await supabase.auth.getUser();
  try {
    const res = await fetch(`${clientConfig.apiUrl}/api/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(user ? authHeaders(user.id) : {}) },
      signal: controller.signal,
      body: JSON.stringify(request),
    });
    clear();
    if (!res.ok) throw await parseApiError(res);
    return (await res.json()) as ImageResult;
  } catch (error) {
    clear();
    if (error instanceof ChatApiError) throw error;
    throw new ChatApiError(
      "IMAGE_SERVICE_ERROR",
      "Le générateur d'images (Fooocus) n'est pas accessible. Vérifie que SD WebUI tourne sur http://127.0.0.1:7860.",
      0,
    );
  }
};

// ── /api/generate-video (video_service — Cloud) ───────────────
export const generateVideo = async (request: VideoRequest): Promise<VideoResult> => {
  const { controller, clear } = withTimeout(300_000);
  const { data: { user } } = await supabase.auth.getUser();
  try {
    const res = await fetch(`${clientConfig.apiUrl}/api/generate-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(user ? authHeaders(user.id) : {}) },
      signal: controller.signal,
      body: JSON.stringify(request),
    });
    clear();
    if (!res.ok) throw await parseApiError(res);
    return (await res.json()) as VideoResult;
  } catch (error) {
    clear();
    if (error instanceof ChatApiError) throw error;
    throw new ChatApiError(
      "VIDEO_SERVICE_ERROR",
      "Le service vidéo Cloud est indisponible. Vérifie la clé API dans .env.",
      0,
    );
  }
};

// ── TTS ───────────────────────────────────────────────────────
export type MultimodalAttachment = {
  type: "image" | "video_frame";
  base64: string;
  mimeType: string;
};

export const sendMultimodalChat = async ({
  text,
  attachments,
  mode = "regular",
}: {
  text: string;
  attachments: MultimodalAttachment[];
  mode?: string;
}): Promise<ChatApiResponse> => {
  const { controller, clear } = withTimeout(120_000); // vision peut être lente
  const { data: { user } } = await supabase.auth.getUser();

  try {
    const res = await fetch(`${clientConfig.apiUrl}/api/chat/multimodal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(user ? { "x-safsey-user-id": user.id } : {}),
      },
      signal: controller.signal,
      body: JSON.stringify({ text, attachments, mode }),
    });
    clear();
    if (!res.ok) throw await parseApiError(res);
    return (await res.json()) as ChatApiResponse;
  } catch (error) {
    clear();
    if (error instanceof ChatApiError) throw error;
    throw new ChatApiError("NETWORK_ERROR", "Impossible d'envoyer la requête multimodale.", 0);
  }
};

// ── Studio Avatar ─────────────────────────────────────────────
export type HeyGenAvatar = {
  id: string;
  name: string;
  thumbnailUrl: string;
  gender: "male" | "female";
};

export type HeyGenVideoResponse = {
  id: string;
  videoUrl: string;
  status: "processing" | "succeeded" | "failed";
};

export const fetchHeyGenAvatars = async (): Promise<HeyGenAvatar[]> => {
  const response = await fetch(`${clientConfig.apiUrl}/api/avatar/list`);
  if (!response.ok) throw new Error("Impossible de récupérer la liste des avatars.");
  const payload = (await response.json()) as { avatars: HeyGenAvatar[] };
  return payload.avatars;
};

export const cloneVoice = async (name: string, audioBlob: Blob): Promise<{ voiceId: string; name: string }> => {
  const { controller, clear } = withTimeout(60_000);
  const { data: { user } } = await supabase.auth.getUser();
  const form = new FormData();
  form.append("audio", audioBlob);
  form.append("name", name);

  try {
    const res = await fetch(`${clientConfig.apiUrl}/api/avatar/clone-voice`, {
      method: "POST",
      headers: {
        ...(user ? authHeaders(user.id) : {}),
      },
      signal: controller.signal,
      body: form,
    });
    clear();
    if (!res.ok) throw await parseApiError(res);
    return (await res.json()) as { voiceId: string; name: string };
  } catch (error) {
    clear();
    if (error instanceof ChatApiError) throw error;
    throw new ChatApiError("VOICE_CLONING_ERROR", "Le clonage de voix a échoué.", 0);
  }
};

export const generateAvatarVideo = async (request: {
  avatarId: string;
  text: string;
  voiceId: string;
  audioUrl?: string;
  aspectRatio: "16:9" | "9:16" | "1:1";
  singingMode?: boolean;
}): Promise<HeyGenVideoResponse> => {
  const { controller, clear } = withTimeout(120_000);
  const { data: { user } } = await supabase.auth.getUser();

  try {
    const res = await fetch(`${clientConfig.apiUrl}/api/avatar/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(user ? authHeaders(user.id) : {}),
      },
      signal: controller.signal,
      body: JSON.stringify(request),
    });
    clear();
    if (!res.ok) throw await parseApiError(res);
    return (await res.json()) as HeyGenVideoResponse;
  } catch (error) {
    clear();
    if (error instanceof ChatApiError) throw error;
    throw new ChatApiError("AVATAR_GEN_ERROR", "La génération d'avatar vidéo a échoué.", 0);
  }
};

export const checkAvatarVideoStatus = async (id: string): Promise<HeyGenVideoResponse> => {
  const response = await fetch(`${clientConfig.apiUrl}/api/avatar/status/${id}`);
  if (!response.ok) throw new Error("Impossible de vérifier le statut de la vidéo.");
  return (await response.json()) as HeyGenVideoResponse;
};

export const createSpeech = async (text: string, language = "fr"): Promise<Blob> => {
  const { controller, clear } = withTimeout(30_000);
  try {
    const res = await fetch(`${clientConfig.apiUrl}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ text, language }),
    });
    clear();
    if (!res.ok) throw await parseApiError(res);
    return await res.blob();
  } catch (error) {
    clear();
    if (error instanceof ChatApiError) throw error;
    throw new ChatApiError("TTS_ERROR", "Impossible de générer la voix.", 0);
  }
};
