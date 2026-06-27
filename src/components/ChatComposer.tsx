import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Film, Globe, ImageIcon, Loader2, Lock, MessageSquare, Paperclip, Square, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AppSettings, MessageAttachment } from "../lib/types";
import {
  compressImage,
  extractVideoFrames,
  getVideoThumbnail,
  humanFileSize,
} from "../lib/mediaUtils";
import { cn } from "../utils/cn";
import { ModeToggle } from "./ModeToggle";

type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: (attachments?: MessageAttachment[]) => void;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  isBusy: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  isLoggedIn: boolean;
  onAuthRequired: () => void;
};

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime";
const MAX_FILE_MB = 50;

export const ChatComposer = ({
  value,
  onChange,
  onSend,
  settings,
  onSettingsChange,
  isBusy,
  disabled,
  autoFocus,
  isLoggedIn,
  onAuthRequired,
}: ChatComposerProps) => {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState("");

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  // Auto-focus
  useEffect(() => {
    if (autoFocus && isLoggedIn) textareaRef.current?.focus();
  }, [autoFocus, isLoggedIn]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!isLoggedIn) { onAuthRequired(); return; }
      if (!isBusy && (value.trim() || attachments.length > 0)) {
        handleSend();
      }
    }
  };

  const handleSend = () => {
    if (!isLoggedIn) { onAuthRequired(); return; }
    if (!value.trim() && attachments.length === 0) return;
    onSend(attachments.length > 0 ? attachments : undefined);
    setAttachments([]);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const processFile = useCallback(async (file: File) => {
    if (!isLoggedIn) { onAuthRequired(); return; }

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      alert("Format non supporté. Utilisez JPG, PNG, WebP, MP4 ou WebM.");
      return;
    }

    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      alert(`Fichier trop volumineux (max ${MAX_FILE_MB} MB).`);
      return;
    }

    setIsProcessing(true);
    try {
      if (isImage) {
        setProcessingLabel("Compression de l'image…");
        const compressed = await compressImage(file);
        const attachment: MessageAttachment = {
          id: crypto.randomUUID(),
          type: "image",
          name: file.name,
          mimeType: file.type,
          base64: compressed,
          sizeKb: Math.round(file.size / 1024),
        };
        setAttachments((prev) => [...prev, attachment]);
      } else if (isVideo) {
        setProcessingLabel("Extraction des frames vidéo…");
        const [frames, thumbnail] = await Promise.all([
          extractVideoFrames(file, 8),
          getVideoThumbnail(file),
        ]);

        // On stocke toutes les frames comme attachments de type "video_frame"
        // mais on affiche visuellement la miniature comme représentant la vidéo
        const videoId = crypto.randomUUID();
        const videoAttachment: MessageAttachment = {
          id: videoId,
          type: "video",
          name: file.name,
          mimeType: file.type,
          // On encode les frames en JSON dans base64 pour les transporter
          base64: JSON.stringify({ thumbnail, frames }),
          thumbnailUrl: thumbnail,
          sizeKb: Math.round(file.size / 1024),
        };
        setAttachments((prev) => [...prev, videoAttachment]);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur lors du traitement du fichier.");
    } finally {
      setIsProcessing(false);
      setProcessingLabel("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [isLoggedIn, onAuthRequired]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const canSend = !isBusy && !isProcessing && (value.trim().length > 0 || attachments.length > 0);

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-2 shadow-xl shadow-black/30 backdrop-blur transition focus-within:border-cyan-400/40 focus-within:ring-1 focus-within:ring-cyan-400/20"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* ── Aperçus des pièces jointes ─────────────────────────── */}
      <AnimatePresence initial={false}>
        {attachments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-2 flex flex-wrap gap-2 overflow-hidden px-2 pt-1"
          >
            {attachments.map((att) => (
              <motion.div
                key={att.id}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                className="group relative flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5"
              >
                {/* Aperçu */}
                {att.type === "image" ? (
                  <img
                    src={att.base64}
                    alt={att.name}
                    className="h-9 w-9 rounded-lg object-cover"
                  />
                ) : (
                  <div className="relative h-9 w-9 overflow-hidden rounded-lg bg-black">
                    {att.thumbnailUrl ? (
                      <img src={att.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Film className="m-auto h-5 w-5 text-slate-400" />
                    )}
                    {/* Badge vidéo */}
                    <span className="absolute bottom-0 right-0 rounded-tl bg-violet-600 px-0.5 text-[8px] font-bold text-white">
                      VID
                    </span>
                  </div>
                )}

                {/* Infos fichier */}
                <div className="min-w-0">
                  <p className="max-w-[120px] truncate text-[11px] font-medium text-slate-200">
                    {att.name}
                  </p>
                  <p className="text-[9px] text-slate-500">
                    {att.type === "image" ? "Image" : "Vidéo"} · {humanFileSize(att.sizeKb * 1024)}
                  </p>
                </div>

                {/* Bouton supprimer */}
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-600/50 text-slate-300 transition hover:bg-rose-500/50 hover:text-white"
                  aria-label="Supprimer"
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Indicateur de traitement ────────────────────────────── */}
      {isProcessing && (
        <div className="mb-2 flex items-center gap-2 px-3 text-[11px] text-slate-400">
          <Loader2 className="h-3 w-3 animate-spin text-cyan-400" />
          {processingLabel}
        </div>
      )}

      {/* ── Zone de texte ────────────────────────────────────────── */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder={
          isLoggedIn
            ? attachments.length > 0
              ? "Posez une question sur ce fichier… (ou laissez vide pour une analyse automatique)"
              : t("chat.placeholder")
            : t("auth.loginToChat", "Connectez-vous pour discuter")
        }
        disabled={!isLoggedIn}
        className={cn(
          "max-h-[200px] w-full resize-none bg-transparent px-3 py-2 text-[15px] text-slate-100 placeholder:text-slate-500 focus:outline-none",
          !isLoggedIn && "cursor-pointer opacity-40",
        )}
      />

      {/* ── Barre d'actions ─────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 px-1 pt-1">
        <div className="flex items-center gap-2">
          <ModeToggle mode={settings.mode} onChange={(mode) => onSettingsChange({ ...settings, mode })} />

          {/* Recherche web */}
          <button
            type="button"
            onClick={() => isLoggedIn && onSettingsChange({ ...settings, webSearch: !settings.webSearch })}
            disabled={!isLoggedIn}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
              !isLoggedIn
                ? "border-white/5 bg-white/[0.02] text-slate-600 cursor-not-allowed"
                : settings.webSearch
                  ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-200 shadow-inner shadow-cyan-500/10"
                  : "border-white/10 text-slate-400 hover:text-slate-200",
            )}
            title={t("chat.webSearchTitle")}
          >
            <Globe className="h-3.5 w-3.5" />
            {t("chat.web")}
            {settings.webSearch && isLoggedIn && (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
            )}
          </button>

          {/* Bouton pièce jointe (trombone) */}
          <button
            type="button"
            onClick={() => isLoggedIn ? fileInputRef.current?.click() : onAuthRequired()}
            disabled={isProcessing}
            title="Joindre une image ou une vidéo"
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-full border transition",
              attachments.length > 0
                ? "border-violet-400/50 bg-violet-500/15 text-violet-300"
                : "border-white/10 text-slate-400 hover:border-white/20 hover:bg-white/5 hover:text-slate-200",
              isProcessing && "cursor-wait opacity-50",
            )}
            aria-label="Joindre un fichier"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          {/* Input fichier caché */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Bouton envoyer */}
        <button
          type="button"
          onClick={() => isLoggedIn ? handleSend() : onAuthRequired()}
          disabled={!isLoggedIn || disabled || isBusy || isProcessing || !canSend}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-full transition",
            !isLoggedIn
              ? "bg-white/5 text-slate-600 cursor-not-allowed"
              : isProcessing
                ? "bg-white/5 text-slate-600 cursor-wait"
                : isBusy
                  ? "bg-white/10 text-slate-300"
                  : canSend
                    ? "bg-gradient-to-br from-cyan-500 to-violet-600 text-white shadow-lg shadow-cyan-500/30 hover:brightness-110"
                    : "cursor-not-allowed bg-white/5 text-slate-600",
          )}
          aria-label={isLoggedIn ? (isBusy ? t("chat.generating") : t("chat.send")) : "Se connecter"}
        >
          {!isLoggedIn ? (
            <Lock className="h-4 w-4" />
          ) : isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isBusy ? (
            <Square className="h-4 w-4" />
          ) : (
            <ArrowUp className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* ── Indice drag & drop (apparaît quand pas de fichier) ──── */}
      {attachments.length === 0 && !isProcessing && isLoggedIn && (
        <div className="mt-1 flex items-center gap-3 px-3 py-0.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 text-[10px] text-slate-600 transition hover:text-slate-400"
          >
            <ImageIcon className="h-3 w-3" /> Image
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 text-[10px] text-slate-600 transition hover:text-slate-400"
          >
            <Film className="h-3 w-3" /> Vidéo
          </button>
        </div>
      )}

      {/* ── Overlay connexion ────────────────────────────────────── */}
      {!isLoggedIn && (
        <div
          className="absolute inset-0 z-20 flex cursor-pointer items-center justify-center rounded-2xl bg-slate-950/60 backdrop-blur-[2px] transition hover:bg-slate-950/70"
          onClick={onAuthRequired}
        >
          <div className="flex max-w-xs flex-col items-center gap-3 p-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/15">
              <MessageSquare className="h-6 w-6 text-cyan-400" />
            </div>
            <p className="text-sm font-medium text-white leading-relaxed">
              Connectez-vous pour commencer à discuter avec SAFSEY IA et profiter de vos 3 essais gratuits.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
