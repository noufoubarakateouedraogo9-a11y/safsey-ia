import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Check, Download, Image, Loader2, RefreshCw, Sliders, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ChatApiError, generateImage } from "../lib/api";
import type { ImageAspectRatio, ImageRequest, ImageResult, ImageStyle } from "../lib/types";
import { cn } from "../utils/cn";

const STYLES: { value: ImageStyle; labelKey: string; emoji: string }[] = [
  { value: "realistic", labelKey: "image.styles.realistic", emoji: "📷" },
  { value: "anime_2d", labelKey: "image.styles.anime_2d", emoji: "🎌" },
  { value: "render_3d", labelKey: "image.styles.render_3d", emoji: "🎬" },
  { value: "watercolor", labelKey: "image.styles.watercolor", emoji: "🎨" },
  { value: "oil_painting", labelKey: "image.styles.oil_painting", emoji: "🖼️" },
  { value: "pixel_art", labelKey: "image.styles.pixel_art", emoji: "👾" },
  { value: "sketch", labelKey: "image.styles.sketch", emoji: "✏️" },
];

const RATIOS: { value: ImageAspectRatio; labelKey: string; icon: string }[] = [
  { value: "1:1", labelKey: "image.ratios.square", icon: "⬜" },
  { value: "16:9", labelKey: "image.ratios.landscape", icon: "🖥️" },
  { value: "9:16", labelKey: "image.ratios.portrait", icon: "📱" },
  { value: "4:3", labelKey: "image.ratios.photo", icon: "🖼️" },
  { value: "3:4", labelKey: "image.ratios.poster", icon: "📄" },
];

const NEG_PROMPT_DEFAULT =
  "lowres, bad anatomy, bad hands, text, watermark, blurry, deformed, ugly, disfigured, extra limbs";

export const ImageService = ({
  isLoggedIn,
  credits,
  onCreditsChanged,
  onBuyCredits,
  onAuthRequired,
}: {
  isLoggedIn: boolean;
  credits: number;
  onCreditsChanged: () => void | Promise<void>;
  onBuyCredits: () => void;
  onAuthRequired: () => void;
}) => {
  const { t } = useTranslation();
  const presetPrompts = t("image.presets", { returnObjects: true }) as string[];
  const [prompt, setPrompt] = useState("");
  const [negPrompt, setNegPrompt] = useState(NEG_PROMPT_DEFAULT);
  const [style, setStyle] = useState<ImageStyle>("realistic");
  const [ratio, setRatio] = useState<ImageAspectRatio>("1:1");
  const [steps, setSteps] = useState(30);
  const [cfg, setCfg] = useState(7);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isComplex, setIsComplex] = useState(false);
  const [result, setResult] = useState<ImageResult | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 1 crédit d'image = 30 secondes de crédit vidéo
  const imageCostCredits = isComplex ? 4 : 2;
  const imageCostSeconds = imageCostCredits * 30; // 60s ou 120s
  const hasEnoughCredits = credits >= imageCostSeconds;

  const submit = useCallback(async () => {
    if (!isLoggedIn) { onAuthRequired(); return; }
    if (!prompt.trim()) { setError(t("image.emptyPrompt")); return; }
    if (!hasEnoughCredits) { onBuyCredits(); return; }
    setError(null);
    setResult(null);
    setIsBusy(true);
    try {
      const req: ImageRequest = {
        prompt: prompt.trim(),
        negativePrompt: negPrompt.trim() || undefined,
        style,
        aspectRatio: ratio,
        steps,
        cfgScale: cfg,
        complex: isComplex,
      };
      const res = await generateImage(req);
      setResult(res);
      void onCreditsChanged();
    } catch (err) {
      if (err instanceof ChatApiError && err.status === 402) onBuyCredits();
      setError(err instanceof ChatApiError ? err.message : t("image.error"));
    } finally {
      setIsBusy(false);
    }
  }, [prompt, negPrompt, style, ratio, steps, cfg, isComplex, hasEnoughCredits, isLoggedIn, onAuthRequired, onCreditsChanged, onBuyCredits, t]);

  const downloadImage = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.imageUrl;
    a.download = `safsey-image-${result.id}.png`;
    a.click();
  };

  const copyBase64 = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.imageUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1_600);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 lg:flex-row">
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full rounded-2xl border border-cyan-400/20 bg-white/[0.025] p-5 shadow-xl shadow-black/30 lg:w-[420px] lg:shrink-0">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-700/30"><Image className="h-5 w-5" /></div>
          <div><h2 className="text-lg font-bold tracking-tight text-white">{t("image.title")}</h2><p className="text-[11px] text-slate-400">{t("image.subtitle")}</p></div>
        </div>

        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t("image.promptLabel")}</label>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} placeholder={t("image.promptPlaceholder")} className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20" />

        <div className="mt-2 flex flex-wrap gap-1.5">{presetPrompts.map((p) => <button key={p} type="button" onClick={() => setPrompt(p)} className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-slate-400 transition hover:border-cyan-400/30 hover:text-cyan-200">{p.slice(0, 32)}...</button>)}</div>

        <label className="mt-5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t("image.styleLabel")}</label>
        <div className="mt-1.5 grid grid-cols-4 gap-1.5">{STYLES.map((s) => <button key={s.value} type="button" onClick={() => setStyle(s.value)} className={cn("flex flex-col items-center rounded-xl border px-2 py-2 text-[10px] transition", style === s.value ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-100" : "border-white/10 text-slate-500 hover:text-slate-300")}><span className="text-sm">{s.emoji}</span><span className="mt-0.5 font-medium leading-tight">{t(s.labelKey)}</span></button>)}</div>

        <label className="mt-5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t("image.ratioLabel")}</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">{RATIOS.map((r) => <button key={r.value} type="button" onClick={() => setRatio(r.value)} className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition", ratio === r.value ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-100" : "border-white/10 text-slate-500 hover:text-slate-300")}><span>{r.icon}</span><span>{t(r.labelKey)}</span><span className="text-[10px] text-slate-600">{r.value}</span></button>)}</div>

        {/* ── Commutateur Complex / Upscale ── */}
        <div className="mt-5 flex items-center justify-between rounded-xl border border-cyan-400/10 bg-cyan-500/[0.02] p-3">
          <div>
            <p className="text-xs font-semibold text-white">💎 Complex / Upscale</p>
            <p className="mt-0.5 text-[10px] text-slate-500">Qualité studio & résolution augmentée (coût x2)</p>
          </div>
          <button
            type="button"
            onClick={() => setIsComplex((v) => !v)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-bold transition",
              isComplex
                ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100"
                : "border-white/10 text-slate-500 hover:text-slate-300"
            )}
          >
            {isComplex ? "Activé (4cr)" : "Désactivé (2cr)"}
          </button>
        </div>

        <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="mt-4 flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-slate-300"><Sliders className="h-3.5 w-3.5" />{showAdvanced ? t("image.advancedHide") : t("image.advancedShow")}</button>

        {showAdvanced && <div className="mt-3 space-y-3"><div><label className="text-[10px] text-slate-400">{t("image.negativePrompt")}</label><textarea value={negPrompt} onChange={(e) => setNegPrompt(e.target.value)} rows={2} className="mt-1 w-full resize-none rounded-lg border border-white/10 bg-black/30 p-2 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none" /></div><div className="grid grid-cols-2 gap-3"><div><label className="text-[10px] text-slate-400">{t("image.steps")} : <span className="text-slate-200">{steps}</span></label><input type="range" min={10} max={60} value={steps} onChange={(e) => setSteps(Number(e.target.value))} className="mt-1 w-full accent-cyan-400" /></div><div><label className="text-[10px] text-slate-400">{t("image.cfgScale")} : <span className="text-slate-200">{cfg}</span></label><input type="range" min={1} max={20} step={0.5} value={cfg} onChange={(e) => setCfg(Number(e.target.value))} className="mt-1 w-full accent-cyan-400" /></div></div></div>}
        {error && <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/[0.08] p-3 text-xs text-rose-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />{error}</div>}
        {!hasEnoughCredits && <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/[0.08] p-3 text-xs leading-relaxed text-amber-100">{t("video.freeTrialExhausted")}</div>}
        
        {/* Affichage informatif du coût */}
        <p className="mt-4 text-center text-xs text-slate-500 font-medium">
          Coût de cette génération : <span className="text-cyan-300 font-bold">{imageCostCredits} crédits</span> ({isComplex ? "2" : "1"} min de vidéo)
        </p>

        {hasEnoughCredits ? (
          <button
            type="button"
            onClick={submit}
            disabled={isBusy || !prompt.trim()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-600/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {isBusy ? t("image.generating") : t("image.generate")}
          </button>
        ) : (
          <button
            type="button"
            onClick={onBuyCredits}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange-600/25 transition hover:brightness-110"
          >
            {t("billing.buyCredits")}
          </button>
        )}
        
        {!hasEnoughCredits && (
          <button type="button" onClick={onBuyCredits} className="mt-2 w-full text-center text-xs font-medium text-cyan-300 underline-offset-4 hover:underline">
            {t("billing.buyCredits")}
          </button>
        )}
      </motion.section>

      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }} className="flex flex-1 flex-col rounded-2xl border border-white/10 bg-black/25 p-4 shadow-xl shadow-black/30">
        <div className="mb-3 flex items-center justify-between gap-2"><p className="text-sm font-semibold text-white">{t("image.result")}</p>{result && <div className="flex gap-2"><button type="button" onClick={() => { setResult(null); setPrompt(""); }} className="flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-slate-400 transition hover:text-white"><RefreshCw className="h-3 w-3" /> {t("image.new")}</button><button type="button" onClick={copyBase64} className="flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-slate-400 transition hover:text-white">{copied ? <Check className="h-3 w-3 text-emerald-400" /> : null}{copied ? t("chat.copied") : t("image.copyUrl")}</button><button type="button" onClick={downloadImage} className="flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[10px] text-cyan-200 transition hover:bg-cyan-500/20"><Download className="h-3 w-3" /> {t("image.download")}</button></div>}</div>
        <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-950 min-h-[400px]"><div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(6,182,212,0.12),transparent_40%),radial-gradient(circle_at_80%_90%,rgba(59,130,246,0.10),transparent_35%)]" />{result ? <img src={result.imageUrl} alt={result.prompt} className="relative z-10 max-h-full max-w-full rounded-xl object-contain shadow-2xl" /> : isBusy ? <div className="relative z-10 flex flex-col items-center gap-4 text-center"><Loader2 className="h-12 w-12 animate-spin text-cyan-400" /><div><p className="text-sm font-semibold text-white">{t("image.processingTitle")}</p><p className="mt-1 max-w-xs text-xs text-slate-500">{t("image.processingHint")}</p></div></div> : <div className="relative z-10 flex flex-col items-center gap-3 text-center"><div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]"><Image className="h-9 w-9 text-slate-600" /></div><p className="text-sm font-medium text-slate-400">{t("image.noResult")}</p><p className="max-w-xs text-xs text-slate-600">{t("image.noResultHint")}</p></div>}</div>
        {result && <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] text-slate-500"><div className="rounded-lg border border-white/5 bg-white/[0.02] p-2 leading-relaxed">{t("image.seed")}<br /><span className="text-slate-300">{result.seed}</span></div><div className="rounded-lg border border-white/5 bg-white/[0.02] p-2 leading-relaxed">{t("image.model")}<br /><span className="text-slate-300">{result.model}</span></div><div className="rounded-lg border border-white/5 bg-white/[0.02] p-2 leading-relaxed">{t("image.format")}<br /><span className="text-slate-300">{ratio}</span></div></div>}
      </motion.section>
    </div>
  );
};