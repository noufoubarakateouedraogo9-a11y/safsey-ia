/**
 * SAFSEY IA — Utilitaires de traitement media côté client
 *
 * - Compression d'images avant envoi
 * - Extraction de frames d'une vidéo (canvas HTML5)
 * - Conversion en base64
 */

export const MAX_IMAGE_DIM = 1280; // px
export const IMAGE_QUALITY = 0.82;
export const MAX_VIDEO_FRAMES = 8; // frames extraites pour l'analyse vidéo

/**
 * Lit un fichier et retourne un Data URL base64.
 */
export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/**
 * Compresse une image et la retourne en Data URL JPEG/WebP.
 * Réduit la résolution si supérieure à MAX_IMAGE_DIM.
 */
export const compressImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > MAX_IMAGE_DIM || height > MAX_IMAGE_DIM) {
        const ratio = Math.min(MAX_IMAGE_DIM / width, MAX_IMAGE_DIM / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas non supporté")); return; }

      ctx.drawImage(img, 0, 0, width, height);
      const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
      resolve(canvas.toDataURL(mimeType, IMAGE_QUALITY));
    };

    img.onerror = reject;
    img.src = url;
  });

/**
 * Extrait N frames régulièrement espacées d'une vidéo HTML5.
 * Retourne un tableau de Data URLs JPEG.
 */
export const extractVideoFrames = (file: File, maxFrames = MAX_VIDEO_FRAMES): Promise<string[]> =>
  new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.src = url;
    video.preload = "auto";
    video.muted = true;

    video.onloadedmetadata = () => {
      const duration = video.duration;
      // Sécurité: on refuse les vidéos de plus de 5 min
      if (duration > 300) {
        URL.revokeObjectURL(url);
        reject(new Error("La vidéo dépasse la limite de 5 minutes."));
        return;
      }

      // Espacer les frames uniformément sur la durée de la vidéo
      // On ignore les 5 premières secondes et on s'arrête 2s avant la fin
      const start = Math.min(5, duration * 0.05);
      const end = Math.max(0, duration - 2);
      const step = (end - start) / Math.max(maxFrames - 1, 1);
      const timestamps = Array.from({ length: maxFrames }, (_, i) =>
        Math.min(start + i * step, end)
      );

      const frames: string[] = [];
      let index = 0;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      const seekNext = () => {
        if (index >= timestamps.length) {
          URL.revokeObjectURL(url);
          resolve(frames);
          return;
        }
        video.currentTime = timestamps[index];
      };

      video.onseeked = () => {
        // Redimensionner à 640px max
        const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL("image/jpeg", 0.75));
        index++;
        seekNext();
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Impossible de charger la vidéo."));
      };

      seekNext();
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Format vidéo non supporté."));
    };

    video.load();
  });

/**
 * Génère une miniature (thumbnail) pour un fichier vidéo à t=1s.
 */
export const getVideoThumbnail = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.src = url;
    video.muted = true;
    video.preload = "metadata";

    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration / 4);
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 320 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossible de générer la miniature."));
    };
  });

/**
 * Retourne un label humain pour la taille d'un fichier.
 */
export const humanFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};
