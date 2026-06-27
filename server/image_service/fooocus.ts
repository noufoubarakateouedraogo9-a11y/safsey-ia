import { randomUUID } from "node:crypto";
import { serverConfig } from "../config";
import { ApiError } from "../errors";

export type ImageStyle =
  | "realistic"
  | "anime_2d"
  | "render_3d"
  | "watercolor"
  | "oil_painting"
  | "pixel_art"
  | "sketch";

export type ImageAspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

export type GenerateImageInput = {
  prompt: string;
  negativePrompt?: string;
  style: ImageStyle;
  aspectRatio: ImageAspectRatio;
  steps: number;
  cfgScale: number;
};

export type GenerateImageResult = {
  id: string;
  imageUrl: string;
  base64: string;
  prompt: string;
  seed: number;
  model: string;
  generatedAt: string;
};

const STYLE_SUFFIX: Record<ImageStyle, string> = {
  realistic: "photorealistic, hyperdetailed, 8K, RAW photo, sharp focus, natural lighting",
  anime_2d: "anime style, 2D cel-shading, vibrant colors, large expressive eyes, clean anime lineart",
  render_3d: "3D render, Pixar style, smooth skin, cinematic lighting, high-poly, Blender octane render",
  watercolor: "watercolor painting, soft brushstrokes, pastel colors, wet paper texture, artistic",
  oil_painting: "oil on canvas, visible brushstrokes, rich textures, classical painting, Rembrandt lighting",
  pixel_art: "pixel art, 16-bit style, crisp pixels, retro game aesthetic, limited color palette",
  sketch: "pencil sketch, detailed linework, crosshatching, monochrome, fine art drawing",
};

const DEFAULT_NEGATIVE =
  "lowres, bad anatomy, bad hands, text, watermark, blurry, deformed, ugly, disfigured, extra limbs";

const ratioToSize = (ratio: ImageAspectRatio): [number, number] => {
  switch (ratio) {
    case "16:9": return [768, 512];
    case "9:16": return [512, 768];
    case "4:3": return [680, 512];
    case "3:4": return [512, 680];
    default: return [512, 512];
  }
};

const checkFooocus = async () => {
  try {
    const response = await fetch(`${serverConfig.SD_WEBUI_URL}/sdapi/v1/sd-models`, {
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok;
  } catch {
    return false;
  }
};

export const generateImageWithFooocus = async (input: GenerateImageInput): Promise<GenerateImageResult> => {
  const online = await checkFooocus();
  if (!online) {
    throw new ApiError(
      "IMAGE_SERVICE_OFFLINE",
      `Le service image Fooocus / SD WebUI est inaccessible sur ${serverConfig.SD_WEBUI_URL}.`,
      503,
    );
  }

  const [width, height] = ratioToSize(input.aspectRatio);
  const fullPrompt = `${input.prompt}, ${STYLE_SUFFIX[input.style]}, masterpiece, best quality`;
  const negativePrompt = input.negativePrompt || DEFAULT_NEGATIVE;

  const response = await fetch(`${serverConfig.SD_WEBUI_URL}/sdapi/v1/txt2img`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: fullPrompt,
      negative_prompt: negativePrompt,
      steps: input.steps,
      cfg_scale: input.cfgScale,
      width,
      height,
      seed: -1,
      sampler_name: "DPM++ 2M Karras",
      batch_size: 1,
      n_iter: 1,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new ApiError("IMAGE_GENERATION_FAILED", `Fooocus / SD WebUI a échoué. ${details}`, 502);
  }

  const payload = (await response.json()) as { images?: string[]; parameters?: { seed?: number } };
  const base64 = payload.images?.[0];

  if (!base64) {
    throw new ApiError("IMAGE_EMPTY_OUTPUT", "Le service image n'a retourné aucune image.", 502);
  }

  return {
    id: randomUUID(),
    imageUrl: `data:image/png;base64,${base64}`,
    base64,
    prompt: fullPrompt,
    seed: payload.parameters?.seed ?? -1,
    model: "fooocus-sdwebui",
    generatedAt: new Date().toISOString(),
  };
};
