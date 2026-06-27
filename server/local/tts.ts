/**
 * Local TTS via Coqui TTS (XTTS v2) ou Bark
 * Utilise la carte NVIDIA GPU via CUDA
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { serverConfig } from "../config";
import { ApiError } from "../errors";

const WORK_DIR = join(tmpdir(), "nova-x-tts");

export type TtsResult = {
  audio: Buffer;
  contentType: string;
};

const ensureWorkDir = () => {
  if (!existsSync(WORK_DIR)) mkdirSync(WORK_DIR, { recursive: true });
};

/**
 * Generate speech using Coqui TTS CLI (XTTS v2)
 * Requires: pip install TTS
 * Model: tts_models/multilingual/multi-dataset/xtts_v2
 */
const generateWithCoqui = async (
  text: string,
  language: string,
): Promise<Buffer> => {
  ensureWorkDir();
  const outputPath = join(WORK_DIR, `${randomUUID()}.wav`);

  try {
    // Use TTS CLI for XTTS v2
    const command = [
      "tts",
      `--text "${text.replace(/"/g, '\\"')}"`,
      `--model_name ${serverConfig.TTS_MODEL}`,
      `--out_path ${outputPath}`,
      `--language_ids ${language}`,
      `--device ${serverConfig.TTS_DEVICE}`,
    ].join(" ");

    execSync(command, {
      timeout: 120_000,
      stdio: "pipe",
    });

    const audioBuffer = readFileSync(outputPath);
    return audioBuffer;
  } catch (error) {
    console.error("[local-tts] Coqui TTS failed:", error);
    throw new ApiError(
      "LOCAL_TTS_FAILED",
      "La génération vocale locale a échoué. Vérifie que TTS est installé: pip install TTS",
      500,
    );
  }
};

/**
 * Alternative: Generate speech using Python Bark
 * Requires: pip install bark
 */
const generateWithBark = async (
  text: string,
): Promise<Buffer> => {
  ensureWorkDir();
  const outputPath = join(WORK_DIR, `${randomUUID()}.wav`);

  try {
    const pythonScript = `
import torch
from bark import SAMPLE_RATE, generate_audio, preload_models

preload_models()
audio_array = generate_audio("${text.replace(/"/g, '\\"')}")
from scipy.io.wavfile import write as write_wav
write_wav("${outputPath}", SAMPLE_RATE, audio_array)
`;
    execSync(`python -c "${pythonScript.replace(/\n/g, "\\n")}"`, {
      timeout: 120_000,
      stdio: "pipe",
    });

    return readFileSync(outputPath);
  } catch (error) {
    console.error("[local-tts] Bark failed:", error);
    throw new ApiError("LOCAL_TTS_FAILED", "Bark TTS a échoué.", 500);
  }
};

export const createSpeech = async (
  text: string,
  language: string = "fr",
): Promise<TtsResult> => {
  try {
    const audioBuffer = await generateWithCoqui(text, language);
    return {
      audio: audioBuffer,
      contentType: "audio/wav",
    };
  } catch {
    // Fallback to Bark if Coqui fails
    try {
      const audioBuffer = await generateWithBark(text);
      return {
        audio: audioBuffer,
        contentType: "audio/wav",
      };
    } catch {
      throw new ApiError(
        "LOCAL_TTS_FAILED",
        "Aucun moteur TTS local n'est disponible. Installe TTS (pip install TTS) ou Bark (pip install bark).",
        503,
      );
    }
  }
};
