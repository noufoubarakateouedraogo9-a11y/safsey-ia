import { serverConfig } from "./config";
import { ApiError } from "./errors";

export type CloneVoiceResponse = {
  voiceId: string;
  name: string;
};

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

/**
 * Clone la voix d'un utilisateur de manière instantanée (Instant Voice Cloning) via ElevenLabs.
 */
export const cloneVoiceLocal = async (
  name: string,
  audioBuffer: Buffer,
): Promise<CloneVoiceResponse> => {
  if (!serverConfig.ELEVENLABS_API_KEY) {
    throw new ApiError("ELEVENLABS_NOT_CONFIGURED", "La clé ElevenLabs est absente du serveur.", 503);
  }

  const formData = new FormData();
  formData.append("name", name);
  formData.append("description", "Voix clonée via SAFSEY IA");
  
  const blob = new Blob([audioBuffer], { type: "audio/wav" });
  formData.append("files", blob, "cloned_voice_sample.wav");

  const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: {
      "xi-api-key": serverConfig.ELEVENLABS_API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new ApiError("VOICE_CLONING_FAILED", `Échec du clonage ElevenLabs: ${errorText}`, 502);
  }

  const payload = (await response.json()) as { voice_id: string };
  return {
    voiceId: payload.voice_id,
    name,
  };
};

/**
 * Récupère une liste d'avatars "Talking Photo" de HeyGen ou envoie un modèle par défaut.
 */
export const listHeyGenAvatars = (): HeyGenAvatar[] => {
  return [
    { id: "Daisy-inskirt-20220818", name: "Daisy (Pro)", thumbnailUrl: "https://files2.heygen.ai/avatar/mock/Daisy-inskirt-20220818.png", gender: "female" },
    { id: "Charles_officially_20221021", name: "Charles (Premium)", thumbnailUrl: "https://files2.heygen.ai/avatar/mock/Charles_officially_20221021.png", gender: "male" },
    { id: "Enya-incoat-20221026", name: "Enya (Casual)", thumbnailUrl: "https://files2.heygen.ai/avatar/mock/Enya-incoat-20221026.png", gender: "female" },
    { id: "Tyler-inshirt-20220721", name: "Tyler (Casual)", thumbnailUrl: "https://files2.heygen.ai/avatar/mock/Tyler-inshirt-20220721.png", gender: "male" },
  ];
};

/**
 * Lance la génération d'une vidéo avatar parlant (Talking Photo) via l'API HeyGen v3.
 */
export const generateAvatarVideoCloud = async (params: {
  avatarId: string;
  text: string;
  voiceId: string;
  audioUrl?: string; // au cas où ils préfèrent envoyer directement l'audio
  aspectRatio: "16:9" | "9:16" | "1:1";
}): Promise<HeyGenVideoResponse> => {
  const apiKey = serverConfig.HEYGEN_API_KEY;
  if (!apiKey) {
    throw new ApiError(
      "HEYGEN_NOT_CONFIGURED",
      "La clé d'API HeyGen est manquante. Impossible d'utiliser le Studio Avatar.",
      503,
    );
  }

  const body: Record<string, unknown> = {
    type: "avatar",
    avatar_id: params.avatarId,
    aspect_ratio: params.aspectRatio,
    resolution: "720p",
    output_format: "mp4",
  };

  if (params.audioUrl) {
    body.audio_url = params.audioUrl;
  } else {
    body.script = params.text;
    body.voice_id = params.voiceId || "2d5b0e6cf36f460aa7fc47e3eee4ba54"; // Rachel par défaut
  }

  const response = await fetch("https://api.heygen.com/v3/videos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new ApiError("HEYGEN_VIDEO_FAILED", `Échec du serveur HeyGen: ${errorText}`, 502);
  }

  const payload = (await response.json()) as { id: string; url?: string; status?: string };

  return {
    id: payload.id,
    videoUrl: payload.url || "",
    status: (payload.status === "completed" ? "succeeded" : "processing") as any,
  };
};

/**
 * Vérifie le statut d'une vidéo HeyGen.
 */
export const checkHeyGenVideoStatus = async (id: string): Promise<HeyGenVideoResponse> => {
  const apiKey = serverConfig.HEYGEN_API_KEY;
  if (!apiKey) throw new ApiError("HEYGEN_NOT_CONFIGURED", "Clé HeyGen manquante.", 503);

  const response = await fetch(`https://api.heygen.com/v3/videos/${id}`, {
    headers: {
      "x-api-key": apiKey,
    },
  });

  if (!response.ok) {
    throw new ApiError("HEYGEN_STATUS_FAILED", "Impossible de récupérer le statut de la vidéo.", 502);
  }

  const payload = (await response.json()) as { id: string; url?: string; status?: string; error?: { message?: string } };

  if (payload.status === "failed") {
    throw new ApiError("HEYGEN_GEN_FAILED", payload.error?.message || "La génération d'avatar a échoué.", 502);
  }

  return {
    id: payload.id,
    videoUrl: payload.url || "",
    status: payload.status === "completed" ? "succeeded" : "processing" as any,
  };
};
