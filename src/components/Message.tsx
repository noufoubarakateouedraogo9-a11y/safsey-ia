import { memo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Check, Copy, Film, Globe, Loader2, Sparkles, User, Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { createSpeech } from "../lib/api";
import type { ChatMessage as ChatMessageType } from "../lib/types";
import { injectCitationLinks } from "../lib/format";
import { Markdown } from "./Markdown";
import { SourceCard } from "./SourceCard";
import { cn } from "../utils/cn";

type MessageProps = {
  message: ChatMessageType;
  activeSource: number | null;
  onCitationClick: (index: number) => void;
};

const MessageBase = ({ message, activeSource, onCitationClick }: MessageProps) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isUser = message.role === "user";
  const sources = message.sources ?? [];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1_600);
    } catch {
      /* ignore */
    }
  };

  const speak = async () => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    try {
      const audioBlob = await createSpeech(message.content);
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setIsSpeaking(false);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setIsSpeaking(false);
      };
      await audio.play();
    } catch {
      setIsSpeaking(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn("flex w-full gap-3", isUser && "flex-row-reverse")}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white shadow-lg",
          isUser
            ? "bg-gradient-to-br from-slate-600 to-slate-800 shadow-slate-900/40"
            : "bg-gradient-to-br from-cyan-500 to-violet-600 shadow-cyan-500/20",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>

      <div className={cn("flex min-w-0 max-w-[min(680px,85%)] flex-col gap-2", isUser && "items-end")}>
        {!isUser && (
          <div className="flex items-center gap-2 px-1 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-300">{t("chat.assistant")}</span>
            {message.mode && (
              <span className="rounded-full border border-white/10 px-1.5 py-0.5">
                {message.mode === "fun" ? t("mode.funIronique") : t("mode.regular")}
              </span>
            )}
            {message.usedWebSearch && (
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-1.5 py-0.5 text-cyan-300">
                <Globe className="h-3 w-3" /> {t("chat.web")}
              </span>
            )}
          </div>
        )}

        <div
          className={cn(
            "relative rounded-2xl px-4 py-3 text-[14.5px]",
            isUser
              ? "rounded-tr-sm bg-gradient-to-br from-cyan-600 to-blue-700 text-white shadow-lg shadow-cyan-900/30"
              : message.error
                ? "rounded-tl-sm border border-rose-500/30 bg-rose-500/[0.06] text-rose-100"
                : "rounded-tl-sm border border-white/10 bg-white/[0.03] text-slate-100",
          )}
        >
          {message.error ? (
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              <span className="text-[13.5px] leading-relaxed text-rose-100/90">{message.error}</span>
            </div>
          ) : isUser ? (
            <div>
              {/* Pièces jointes (images / vidéo) */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {message.attachments.map((att) => (
                    att.type === "image" ? (
                      <img
                        key={att.id}
                        src={att.base64}
                        alt={att.name}
                        className="max-h-52 max-w-[280px] rounded-xl object-cover shadow-lg"
                      />
                    ) : (
                      <div key={att.id} className="relative flex items-center gap-2 rounded-xl border border-white/20 bg-white/[0.06] px-3 py-2">
                        {att.thumbnailUrl ? (
                          <img src={att.thumbnailUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        ) : (
                          <Film className="h-8 w-8 text-violet-300" />
                        )}
                        <div className="min-w-0">
                          <p className="max-w-[150px] truncate text-xs font-medium text-white">{att.name}</p>
                          <p className="text-[10px] text-cyan-200/70">Vidéo — analyse IA</p>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
              {message.content && (
                <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
              )}
            </div>
          ) : (
            <Markdown
              content={injectCitationLinks(message.content, sources.length)}
              onCitationClick={onCitationClick}
            />
          )}
        </div>

        {sources.length > 0 && (
          <div className="mt-1 flex flex-col gap-2">
            <span className="inline-flex items-center gap-1.5 px-1 text-[11px] font-medium text-slate-400">
              <Globe className="h-3 w-3 text-cyan-400" /> {t("chat.webSources", { count: sources.length })}
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {sources.map((source) => (
                <SourceCard key={source.id} source={source} highlighted={activeSource === source.id} />
              ))}
            </div>
          </div>
        )}

        {!isUser && !message.error && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={copy}
              className="inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copied ? t("chat.copied") : t("chat.copy")}
            </button>
            <button
              type="button"
              onClick={speak}
              disabled={isSpeaking}
              className="inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-slate-500 transition hover:bg-white/5 hover:text-cyan-300 disabled:opacity-60"
            >
              {isSpeaking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Volume2 className="h-3 w-3" />}
              {t("chat.voice")}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const Message = memo(MessageBase);
