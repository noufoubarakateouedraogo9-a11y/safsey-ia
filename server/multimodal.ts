/**
 * SAFSEY IA — Service multimodal (vision IA)
 *
 * Deux fournisseurs possibles selon la config :
 *   1. Groq Vision   → meta-llama/llama-4-scout-17b-16e-instruct (rapide, gratuit)
 *   2. OpenRouter    → GPT-4o, Gemini Flash, Llama Vision… (payant, plus puissant)
 *
 * Les images sont envoyées en base64.
 * Les vidéos sont décomposées côté client en frames, envoyées comme plusieurs images.
 */

import Groq from "groq-sdk";
import { serverConfig } from "./config";
import { ApiError } from "./errors";

export type VisionContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

export type VisionMessage = {
  role: "system" | "user" | "assistant";
  content: string | VisionContent[];
};

export type MultimodalAttachment = {
  type: "image" | "video_frame";
  base64: string; // data URL complet
  mimeType: string;
};

/**
 * Construit les messages pour une requête vision.
 * Supporte image et frames de vidéo.
 */
const buildVisionMessages = (
  userText: string,
  attachments: MultimodalAttachment[],
  mode: string,
): VisionMessage[] => {
  const system = mode === "fun"
    ? "Tu es SAFSEY IA, un assistant multimodal polyglotte et sarcastique. Tu analyses les images et vidéos avec humour mais pertinence. Tu es un assistant polyglotte. Réponds toujours dans la même langue que celle utilisée par l'utilisateur pour poser sa question."
    : "Tu es SAFSEY IA, un assistant multimodal polyglotte expert. Tu analyses les images et vidéos avec précision et exhaustivité. Tu es un assistant polyglotte. Réponds toujours dans la même langue que celle utilisée par l'utilisateur pour poser sa question.";

  const userContent: VisionContent[] = [];

  // Ajouter les images/frames
  for (const att of attachments) {
    userContent.push({
      type: "image_url",
      image_url: {
        url: att.base64,
        detail: "auto", // "low" pour économiser, "high" pour l'analyse précise
      },
    });
  }

  // Ajouter le texte de l'utilisateur à la fin
  if (userText) {
    userContent.push({ type: "text", text: userText });
  } else {
    const defaultPrompt = attachments.length === 1 && attachments[0].type === "image"
      ? "Décris ce que tu vois sur cette image en détail."
      : attachments.some(a => a.type === "video_frame")
        ? "Analyse cette vidéo. Décris la scène, les actions et le contenu en détail."
        : "Décris ce contenu.";
    userContent.push({ type: "text", text: defaultPrompt });
  }

  return [
    { role: "system", content: system },
    { role: "user", content: userContent },
  ];
};

/**
 * Appel via Groq Vision (llama-4-scout ou llava)
 */
const callGroqVision = async (messages: VisionMessage[], model: string): Promise<string> => {
  if (!serverConfig.GROQ_API_KEY) {
    throw new ApiError(
      "VISION_NO_API_KEY",
      "GROQ_API_KEY manquante pour le traitement multimodal. Configure VISION_API_KEY dans .env.",
      503,
    );
  }

  const groq = new Groq({ apiKey: serverConfig.GROQ_API_KEY });

  const completion = await groq.chat.completions.create({
    model,
    messages: messages as Parameters<typeof groq.chat.completions.create>[0]["messages"],
    temperature: 0.4,
    max_completion_tokens: 2_000,
    stream: false,
  });

  const answer = completion.choices[0]?.message?.content?.trim();
  if (!answer) throw new ApiError("VISION_EMPTY_RESPONSE", "Pas de réponse de l'IA vision.", 502);
  return answer;
};

/**
 * Appel via OpenRouter (GPT-4o, Gemini, etc.)
 */
const callOpenRouterVision = async (messages: VisionMessage[], model: string): Promise<string> => {
  const apiKey = serverConfig.VISION_API_KEY;
  if (!apiKey) {
    throw new ApiError(
      "VISION_NO_OPENROUTER_KEY",
      "VISION_API_KEY (OpenRouter) manquante. Configure-la dans .env.",
      503,
    );
  }

  const response = await fetch(`${serverConfig.OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": serverConfig.PUBLIC_APP_URL || "https://safsey.com",
      "X-Title": "SAFSEY IA",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
      max_tokens: 2_000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new ApiError("VISION_OPENROUTER_FAILED", `OpenRouter a échoué: ${errorText}`, 502);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };

  if (data.error?.message) {
    throw new ApiError("VISION_API_ERROR", data.error.message, 502);
  }

  const answer = data.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new ApiError("VISION_EMPTY_RESPONSE", "Pas de réponse de l'IA vision.", 502);
  return answer;
};

/**
 * Point d'entrée principal pour l'analyse multimodale.
 * Choisit automatiquement le provider selon la config.
 */
export const analyzeWithVision = async (
  userText: string,
  attachments: MultimodalAttachment[],
  mode: string = "regular",
): Promise<string> => {
  if (attachments.length === 0) {
    throw new ApiError("VISION_NO_ATTACHMENT", "Aucun fichier joint à analyser.", 400);
  }

  const model = serverConfig.VISION_MODEL ?? "meta-llama/llama-4-scout-17b-16e-instruct";
  const messages = buildVisionMessages(userText, attachments, mode);

  try {
    if (serverConfig.VISION_PROVIDER === "openrouter") {
      return await callOpenRouterVision(messages, model);
    }
    // Default: Groq Vision
    return await callGroqVision(messages, model);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error("[vision] Analyse multimodale échouée:", error);
    throw new ApiError(
      "VISION_FAILED",
      "L'analyse multimodale a échoué. Vérifie GROQ_API_KEY ou VISION_API_KEY dans .env.",
      502,
    );
  }
};
