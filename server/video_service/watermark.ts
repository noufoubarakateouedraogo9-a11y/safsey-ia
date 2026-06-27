import { existsSync, readFileSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import ffprobePath from "@ffprobe-installer/ffprobe";
import ffmpeg from "fluent-ffmpeg";
import { ApiError } from "../errors";

ffmpeg.setFfmpegPath(ffmpegPath.path);
ffmpeg.setFfprobePath(ffprobePath.path);

const WORK_DIR = join(tmpdir(), "safsey-watermark");
const CUSTOM_LOGO_PATH = resolve(process.cwd(), "public/images/watermark.png");

const ensureWorkDir = () => {
  if (!existsSync(WORK_DIR)) {
    mkdirSync(WORK_DIR, { recursive: true });
  }
};

const downloadVideo = async (url: string, dest: string): Promise<void> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Impossible de télécharger la vidéo originale : ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buffer);
};

const cleanup = (paths: string[]) => {
  for (const p of paths) {
    try {
      if (existsSync(p)) unlinkSync(p);
    } catch { /* ignore */ }
  }
};

/**
 * Applique un filigrane semi-transparent en bas à droite de la vidéo.
 * - Si public/images/watermark.png existe, l'overlay ffmpeg est appliqué.
 * - Sinon, un drawtext FFMPEG élégant "SAFSEY IA" est appliqué par défaut.
 */
export const applyWatermark = async (videoUrl: string): Promise<string> => {
  ensureWorkDir();
  const runId = randomUUID().slice(0, 8);

  const inputPath = join(WORK_DIR, `${runId}_input.mp4`);
  const outputPath = join(WORK_DIR, `${runId}_watermarked.mp4`);
  const tempFiles = [inputPath, outputPath];

  try {
    // Si la vidéo est déjà une Data URL Base64, on extrait le buffer
    if (videoUrl.startsWith("data:video/mp4;base64,")) {
      const base64Data = videoUrl.replace(/^data:video\/mp4;base64,/, "");
      writeFileSync(inputPath, Buffer.from(base64Data, "base64"));
    } else {
      await downloadVideo(videoUrl, inputPath);
    }

    const hasLogoImage = existsSync(CUSTOM_LOGO_PATH);

    return new Promise((resolvePromise, reject) => {
      let command = ffmpeg(inputPath);

      if (hasLogoImage) {
        // Option 1 : Utilisation d'une image personnalisée
        command = command
          .input(CUSTOM_LOGO_PATH)
          .complexFilter([
            // Ajuster l'opacité de l'image (format rgba, colorchannelmixer) et la superposer en bas à droite
            "[1:v]format=rgba,colorchannelmixer=aa=0.45,scale=iw*0.45:-1[logo]",
            "[0:v][logo]overlay=main_w-overlay_w-15:main_h-overlay_h-15[outv]",
          ])
          .outputOptions(["-map", "[outv]", "-map", "0:a?"]);
      } else {
        // Option 2 : Drawtext élégant par défaut
        command = command
          .complexFilter([
            "drawtext=text='SAFSEY IA':x=w-tw-20:y=h-th-20:fontcolor=white@0.45:fontsize=22:box=1:boxcolor=black@0.25:boxborderw=6",
          ]);
      }

      command
        .outputOptions(["-c:v", "libx264", "-crf", "23", "-preset", "veryfast"])
        .on("error", (err) => {
          console.error("[watermark] ffmpeg error:", err);
          reject(new ApiError("WATERMARK_PROCESS_FAILED", "Impossible d'appliquer le filigrane.", 500));
        })
        .on("end", () => {
          try {
            const watermarkedBuffer = readFileSync(outputPath);
            const base64 = watermarkedBuffer.toString("base64");
            resolvePromise(`data:video/mp4;base64,${base64}`);
          } catch (err) {
            reject(err);
          }
        })
        .save(outputPath);
    });
  } catch (error) {
    console.error("[watermark] failed:", error);
    // En cas d'erreur de post-traitement, on retourne la vidéo originale pour ne pas bloquer l'utilisateur
    return videoUrl;
  } finally {
    cleanup(tempFiles);
  }
};
