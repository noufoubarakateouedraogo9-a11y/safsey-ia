import { randomUUID } from "node:crypto";
import Replicate from "replicate";
import { serverConfig } from "../config";
import { ApiError } from "../errors";

export type VideoAspectRatio = "16:9" | "9:16" | "1:1";

export type GenerateVideoInput = {
  prompt: string;
  aspectRatio: VideoAspectRatio;
  duration: 5 | 10 | 30 | 60 | 300;
};

export type GenerateVideoResult = {
  id: string;
  jobId: string;
  videoUrl: string;
  prompt: string;
  aspectRatio: VideoAspectRatio;
  duration: number;
  generatedAt: string;
};

const pickUrl = (output: unknown): string | null => {
  if (typeof output === "string" && output.startsWith("http")) return output;
  if (Array.isArray(output)) {
    for (const item of output) {
      const found = pickUrl(item);
      if (found) return found;
    }
  }
  if (output && typeof output === "object") {
    const maybeUrl = (output as { url?: () => URL | string }).url;
    if (typeof maybeUrl === "function") return String(maybeUrl());
  }
  return null;
};

export const generateVideoWithCloud = async (input: GenerateVideoInput): Promise<GenerateVideoResult> => {
  if (serverConfig.VIDEO_API_PROVIDER === "replicate") {
    if (!serverConfig.REPLICATE_API_TOKEN) {
      throw new ApiError(
        "VIDEO_API_NOT_CONFIGURED",
        "REPLICATE_API_TOKEN est manquant. Configure la clé Cloud dans .env.",
        503,
      );
    }

    const replicate = new Replicate({ auth: serverConfig.REPLICATE_API_TOKEN, useFileOutput: false });
    const output = await replicate.run(serverConfig.REPLICATE_VIDEO_MODEL, {
      input: {
        prompt: input.prompt,
        aspect_ratio: input.aspectRatio,
        duration: input.duration,
      },
    });

    const videoUrl = pickUrl(output);
    if (!videoUrl) {
      throw new ApiError("VIDEO_EMPTY_OUTPUT", "L'API vidéo Cloud n'a retourné aucune URL vidéo.", 502);
    }

    return {
      id: randomUUID(),
      jobId: randomUUID(),
      videoUrl,
      prompt: input.prompt,
      aspectRatio: input.aspectRatio,
      duration: input.duration,
      generatedAt: new Date().toISOString(),
    };
  }

  if (!serverConfig.VIDEO_API_ENDPOINT) {
    throw new ApiError(
      "VIDEO_API_NOT_CONFIGURED",
      "Aucun VIDEO_API_ENDPOINT ou fournisseur vidéo Cloud n'est configuré.",
      503,
    );
  }

  const response = await fetch(serverConfig.VIDEO_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(serverConfig.VIDEO_API_KEY ? { Authorization: `Bearer ${serverConfig.VIDEO_API_KEY}` } : {}),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new ApiError("VIDEO_GENERATION_FAILED", `L'API vidéo Cloud a échoué. ${details}`, 502);
  }

  const payload = (await response.json()) as { videoUrl?: string; url?: string; jobId?: string; id?: string };
  const videoUrl = payload.videoUrl || payload.url;
  if (!videoUrl) throw new ApiError("VIDEO_EMPTY_OUTPUT", "L'API vidéo Cloud n'a retourné aucune URL vidéo.", 502);

  return {
    id: randomUUID(),
    jobId: payload.jobId || payload.id || randomUUID(),
    videoUrl,
    prompt: input.prompt,
    aspectRatio: input.aspectRatio,
    duration: input.duration,
    generatedAt: new Date().toISOString(),
  };
};
