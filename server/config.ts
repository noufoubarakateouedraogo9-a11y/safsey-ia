/**
 * SAFSEY IA — Configuration serveur
 * Toutes les valeurs sensibles viennent du .env — jamais hardcodées.
 */
import "dotenv/config";
import { z } from "zod";

const opt = (def?: string) =>
  z.preprocess((v) => {
    if (typeof v !== "string") return def ?? undefined;
    const s = v.trim();
    return s === "" ? (def ?? undefined) : s;
  }, def !== undefined ? z.string().default(def) : z.string().optional());

const envSchema = z.object({
  // ── Serveur ──────────────────────────────────────────────────────
  PORT:          z.coerce.number().default(5000),
  CLIENT_ORIGIN: opt(), // ex: https://safsey.com en production

  // ── LLM Texte ────────────────────────────────────────────────────
  GROQ_API_KEY:   opt(),
  GROQ_MODEL:     opt("llama-3.3-70b-versatile"),
  OLLAMA_BASE_URL: opt("http://127.0.0.1:11434"),
  OLLAMA_MODEL:   opt("llama3.2"),

  // ── LLM Vision (analyse image/vidéo) ─────────────────────────────
  VISION_PROVIDER:    opt("groq"),  // "groq" | "openrouter"
  VISION_API_KEY:     opt(),        // clé OpenRouter si VISION_PROVIDER=openrouter
  VISION_MODEL:       opt("meta-llama/llama-4-scout-17b-16e-instruct"),
  OPENROUTER_BASE_URL: opt("https://openrouter.ai/api/v1"),

  // ── Image Service — Fooocus / SD WebUI ───────────────────────────
  SD_WEBUI_URL:     opt("http://127.0.0.1:7860"),
  SD_DEFAULT_MODEL: opt("sd_xl_base_1.0.safetensors"),
  SD_STEPS:         z.coerce.number().default(30),
  SD_CFG_SCALE:     z.coerce.number().default(7.5),
  SD_DENOISING:     z.coerce.number().default(0.65),
  USE_COMFYUI:      opt("false"),
  COMFYUI_URL:      opt("http://127.0.0.1:8188"),

  // ── Video Service — API Cloud externe ────────────────────────────
  VIDEO_API_PROVIDER:   opt("replicate"),
  VIDEO_API_ENDPOINT:   opt(),
  VIDEO_API_KEY:        opt(),
  REPLICATE_API_TOKEN:  opt(),
  REPLICATE_VIDEO_MODEL: opt("luma/ray-flash-2-540p"),

  // ── Studio Avatar — HeyGen ───────────────────────────────────────
  HEYGEN_API_KEY:   opt(),
  ELEVENLABS_API_KEY: opt(),

  // ── Paiement — Lemon Squeezy ────────────────────────────────────
  LEMON_SQUEEZY_API_KEY: opt(),
  LEMON_SQUEEZY_STORE_ID: opt(),
  LEMON_WEBHOOK_SECRET:   opt(),
  LEMON_TEST_MODE:        opt("false"),
  LEMON_CREDITS_FALLBACK: z.coerce.number().default(300), // 5 min par défaut
  PUBLIC_APP_URL:         opt("http://localhost:5173"),

  // ── Authentification — Supabase ───────────────────────────────────
  SUPABASE_URL:               opt(),
  SUPABASE_SERVICE_ROLE_KEY:  opt(),

  // ── Administration ────────────────────────────────────────────────
  ADMIN_PASSWORD: opt("admin_safsey_2026"),

  // ── TTS Local ─────────────────────────────────────────────────────
  TTS_MODEL:  opt("tts_models/multilingual/multi-dataset/xtts_v2"),
  TTS_DEVICE: opt("cuda"),
});

export type ServerConfig = z.infer<typeof envSchema>;
export const serverConfig: ServerConfig = envSchema.parse(process.env);

export const providerStatus = {
  llm:          serverConfig.GROQ_API_KEY ? `Groq (${serverConfig.GROQ_MODEL})` : `Ollama (${serverConfig.OLLAMA_MODEL})`,
  image_service: serverConfig.SD_WEBUI_URL,
  video_service: serverConfig.VIDEO_API_PROVIDER === "replicate"
    ? `Replicate (${serverConfig.REPLICATE_VIDEO_MODEL})`
    : serverConfig.VIDEO_API_ENDPOINT || "not configured",
  billing:  serverConfig.LEMON_SQUEEZY_API_KEY ? "Lemon Squeezy ✓" : "not configured",
  heygen:   serverConfig.HEYGEN_API_KEY ? "HeyGen ✓" : "not configured",
  supabase: serverConfig.SUPABASE_URL ? "Supabase ✓" : "not configured",
};
