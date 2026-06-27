import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Clock, Download, Film, Loader2, Play, RefreshCw, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ChatApiError, generateVideo } from "../lib/api";
import type { VideoAspectRatio, VideoRequest, VideoResult } from "../lib/types";
import { cn } from "../utils/cn";

const RATIOS: { value: VideoAspectRatio; labelKey: string; descKey: string; icon: string }[] = [
  { value: "16:9", labelKey: "video.ratios.youtube", descKey: "video.ratios.horizontal", icon: "📺" },
  { value: "9:16", labelKey: "video.ratios.tiktok", descKey: "video.ratios.vertical", icon: "📱" },
  { value: "1:1", labelKey: "video.ratios.instagram", descKey: "video.ratios.square", icon: "⬜" },
];

const DURATIONS: { value: 5 | 10 | 30 | 60 | 300; labelKey: string; premium?: boolean }[] = [
  { value: 5, labelKey: "video.duration5" },
  { value: 10, labelKey: "video.duration10", premium: true },
  { value: 30, labelKey: "video.duration30", premium: true },
  { value: 60, labelKey: "video.duration60", premium: true },
  { value: 300, labelKey: "video.duration300", premium: true },
];

export const VideoService = ({
  isLoggedIn,
  credits,
  hasPurchased,
  onCreditsChanged,
  onBuyCredits,
  onAuthRequired,
}: {
  isLoggedIn: boolean;
  credits: number;
  hasPurchased: boolean;
  onCreditsChanged: () => void | Promise<void>;
  onBuyCredits: () => void;
  onAuthRequired: () => void;
}) => {
  const { t } = useTranslation();
  const presetPrompts = t("video.presets", { returnObjects: true }) as string[];
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState<VideoAspectRatio>("16:9");
  const [duration, setDuration] = useState<5 | 10 | 30 | 60 | 300>(5);
  const [result, setResult] = useState<VideoResult | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!isLoggedIn) { onAuthRequired(); return; }
    if (!prompt.trim()) { setError(t("video.emptyPrompt")); return; }
    if (credits <= 0) { onBuyCredits(); return; }
    if (hasPurchased === false && duration !== 5) {
      setError(t("video.freeDurationLimit"));
      return;
    }
    setError(null);
    setResult(null);
    setIsBusy(true);
    try {
      const req: VideoRequest = { prompt: prompt.trim(), aspectRatio: ratio, duration };
      const res = await generateVideo(req);
      setResult(res);
      void onCreditsChanged();
    } catch (err) {
      if (err instanceof ChatApiError && err.status === 402) onBuyCredits();
      setError(err instanceof ChatApiError ? err.message : t("video.error"));
    } finally {
      setIsBusy(false);
    }
  }, [prompt, ratio, duration, credits, hasPurchased, isLoggedIn, onAuthRequired, onCreditsChanged, onBuyCredits, t]);

  const downloadVideo = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.videoUrl;
    a.download = `safsey-video-${result.id}.mp4`;
    a.click();
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 lg:flex-row">
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full rounded-2xl border border-violet-400/20 bg-white/[0.025] p-5 shadow-xl shadow-black/30 lg:w-[420px] lg:shrink-0">
        <div className="mb-5 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-700 text-white shadow-lg shadow-violet-700/30"><Film className="h-5 w-5" /></div><div><h2 className="text-lg font-bold tracking-tight text-white">{t("video.title")}</h2><p className="text-[11px] text-slate-400">{t("video.subtitle")}</p></div></div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t("video.promptLabel")}</label>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} placeholder={t("video.promptPlaceholder")} className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-violet-400/40 focus:outline-none focus:ring-1 focus:ring-violet-400/20" />
        <div className="mt-2 flex flex-wrap gap-1.5">{presetPrompts.map((p) => <button key={p} type="button" onClick={() => setPrompt(p)} className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-slate-400 transition hover:border-violet-400/30 hover:text-violet-200">{p.slice(0, 34)}...</button>)}</div>
        <label className="mt-5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t("video.formatLabel")}</label>
        <div className="mt-1.5 grid grid-cols-3 gap-2">{RATIOS.map((r) => <button key={r.value} type="button" onClick={() => setRatio(r.value)} className={cn("flex flex-col items-center rounded-xl border px-2 py-2.5 text-xs transition", ratio === r.value ? "border-violet-400/60 bg-violet-500/20 text-violet-100" : "border-white/10 text-slate-500 hover:text-slate-300")}><span className="text-base">{r.icon}</span><span className="mt-0.5 font-semibold">{t(r.labelKey)}</span><span className="text-[9px] text-slate-600">{r.value} · {t(r.descKey)}</span></button>)}</div>
        <label className="mt-5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t("video.durationLabel")}</label>
        <div className="mt-1.5 grid grid-cols-2 gap-2">{DURATIONS.map((d) => {
          const locked = Boolean(d.premium && !hasPurchased);
          return <button key={d.value} type="button" onClick={() => !locked && setDuration(d.value)} disabled={locked} title={locked ? t("video.durationLocked") : undefined} className={cn("flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm transition", duration === d.value ? "border-violet-400/60 bg-violet-500/20 text-violet-100" : locked ? "cursor-not-allowed border-white/5 bg-white/[0.02] text-slate-700" : "border-white/10 text-slate-500 hover:text-slate-300")}><Clock className="h-3.5 w-3.5" />{t(d.labelKey)}{locked ? " 🔒" : ""}</button>;
        })}</div>
        {!hasPurchased && <p className="mt-2 text-[11px] text-amber-300">{t("video.freeDurationNotice")}</p>}
        <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-500/[0.07] p-3 text-[11px] text-amber-200 leading-relaxed">☁️ {t("video.cloudNotice")}</div>
        {error && <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/[0.08] p-3 text-xs text-rose-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />{error}</div>}
        {credits <= 0 && <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/[0.08] p-3 text-xs leading-relaxed text-amber-100">{t("video.freeTrialExhausted")}</div>}
        <button type="button" onClick={submit} disabled={isBusy || !prompt.trim() || credits <= 0} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-700/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">{isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}{credits <= 0 ? t("billing.creditsDepleted") : isBusy ? t("video.generating") : t("video.generate")}</button>
        {credits <= 0 && <button type="button" onClick={onBuyCredits} className="mt-2 w-full text-center text-xs font-medium text-violet-300 underline-offset-4 hover:underline">{t("billing.buyCredits")}</button>}
      </motion.section>
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }} className="flex flex-1 flex-col rounded-2xl border border-white/10 bg-black/25 p-4 shadow-xl shadow-black/30">
        <div className="mb-3 flex items-center justify-between gap-2"><p className="text-sm font-semibold text-white">{t("video.result")}</p>{result && <div className="flex flex-wrap gap-1.5"><button type="button" onClick={() => { setResult(null); setPrompt(""); }} className="flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-slate-400 transition hover:text-white"><RefreshCw className="h-3 w-3" /> {t("video.new")}</button><button type="button" onClick={downloadVideo} className="flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-[10px] text-violet-200 transition hover:bg-violet-500/20"><Download className="h-3 w-3" /> {t("video.download")}</button><a href={`https://api.whatsapp.com/send?text=${encodeURIComponent("Vidéo créée avec SAFSEY IA !")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] text-emerald-200 transition hover:bg-emerald-500/20"><span>📱</span> WhatsApp</a><a href="https://www.tiktok.com/upload" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-full border border-pink-500/30 bg-pink-500/10 px-2.5 py-1 text-[10px] text-pink-200 transition hover:bg-pink-500/20"><span>🎵</span> TikTok</a><a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] text-amber-200 transition hover:bg-amber-500/20"><span>📸</span> Instagram</a></div>}</div>
        <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-950 min-h-[420px]"><div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(217,70,239,0.12),transparent_40%),radial-gradient(circle_at_80%_90%,rgba(139,92,246,0.10),transparent_35%)]" />{result ? <video src={result.videoUrl} controls autoPlay loop className="relative z-10 max-h-full max-w-full rounded-xl shadow-2xl" /> : isBusy ? <div className="relative z-10 flex flex-col items-center gap-4 text-center"><Loader2 className="h-12 w-12 animate-spin text-violet-400" /><div><p className="text-sm font-semibold text-white">{t("video.processingTitle")}</p><p className="mt-1 max-w-xs text-xs text-slate-500">{t("video.processingHint")}</p></div></div> : <div className="relative z-10 flex flex-col items-center gap-3 text-center"><div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]"><Play className="h-9 w-9 text-slate-600" /></div><p className="text-sm font-medium text-slate-400">{t("video.noResult")}</p><p className="max-w-xs text-xs text-slate-600">{t("video.noResultHint")}</p></div>}</div>
        {result && <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] text-slate-500"><div className="rounded-lg border border-white/5 bg-white/[0.02] p-2 leading-relaxed">{t("video.duration")}<br /><span className="text-slate-300">{result.duration}s</span></div><div className="rounded-lg border border-white/5 bg-white/[0.02] p-2 leading-relaxed">{t("video.format")}<br /><span className="text-slate-300">{result.aspectRatio}</span></div><div className="rounded-lg border border-white/5 bg-white/[0.02] p-2 leading-relaxed">{t("video.jobId")}<br /><span className="truncate text-slate-300">{result.jobId.slice(0, 8)}...</span></div></div>}
      </motion.section>
    </div>
  );
};