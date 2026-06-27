import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, Download, Loader2, Mic, Mic2, Play,
  RefreshCw, Sparkles, Square, Upload, Wand2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { YouTubeShareModal } from "./YouTubeShareModal";
import {
  checkAvatarVideoStatus,
  cloneVoice,
  fetchHeyGenAvatars,
  generateAvatarVideo,
  type HeyGenAvatar,
  type HeyGenVideoResponse,
} from "../lib/api";
import { cn } from "../utils/cn";

const PRESET_VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel (Femme - Naturel)", gender: "female" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi (Femme - Dynamique)", gender: "female" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella (Femme - Doux)", gender: "female" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni (Homme - Grave)", gender: "male" },
  { id: "TxGEqn7nU66RJ90L6f2V", name: "Liam (Homme - Professionnel)", gender: "male" },
];

export const AvatarStudio = ({
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

  const [avatars, setAvatars] = useState<HeyGenAvatar[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<string>("");
  const [, setCustomAvatar] = useState<File | null>(null);
  const [customAvatarPreview, setCustomAvatarPreview] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");

  // Mode Parole vs Chant
  const [studioMode, setStudioMode] = useState<"speech" | "singing">("speech");
  const [melodyFile, setMelodyFile] = useState<File | null>(null);
  const [melodyPreview, setMelodyPreview] = useState<string | null>(null);
  const melodyInputRef = useRef<HTMLInputElement>(null);

  // Voix et Clonage
  const [voiceSource, setVoiceSource] = useState<"preset" | "clone">("preset");
  const [selectedVoiceId, setSelectedVoiceId] = useState(PRESET_VOICES[0].id);
  const [clonedVoices, setClonedVoices] = useState<{ id: string; name: string }[]>([]);
  
  // Enregistrement pour clonage
  const [isRecording, setIsRecording] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voicePreview, setVoicePreview] = useState<string | null>(null);
  const [cloneName, setClonename] = useState("");
  const [isCloning, setIsCloning] = useState(false);

  const [isBusy, setIsBusy] = useState(false);
  const [prediction, setPrediction] = useState<HeyGenVideoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingAvatars, setLoadingAvatars] = useState(false);
  const [ytShareOpen, setYtShareOpen] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Charger les avatars HeyGen au démarrage
  useEffect(() => {
    setLoadingAvatars(true);
    fetchHeyGenAvatars()
      .then((list) => {
        setAvatars(list);
        if (list.length > 0) setSelectedAvatar(list[0].id);
      })
      .catch(() => {
        // Fallback en cas d'API indisponible
        const mock = [
          { id: "Daisy-inskirt-20220818", name: "Daisy (Pro)", thumbnailUrl: "https://files2.heygen.ai/avatar/mock/Daisy-inskirt-20220818.png", gender: "female" as const },
          { id: "Charles_officially_20221021", name: "Charles (Premium)", thumbnailUrl: "https://files2.heygen.ai/avatar/mock/Charles_officially_20221021.png", gender: "male" as const },
        ];
        setAvatars(mock);
        setSelectedAvatar(mock[0].id);
      })
      .finally(() => setLoadingAvatars(false));
  }, []);

  // Polling du statut de la vidéo HeyGen
  useEffect(() => {
    if (!prediction || prediction.status === "succeeded" || prediction.status === "failed") return;

    const iv = setInterval(async () => {
      try {
        const next = await checkAvatarVideoStatus(prediction.id);
        setPrediction(next);
        if (next.status === "succeeded") {
          onCreditsChanged();
          clearInterval(iv);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur de suivi vidéo.");
        clearInterval(iv);
      }
    }, 5000);

    return () => clearInterval(iv);
  }, [prediction, onCreditsChanged]);

  const handleCustomAvatar = (file: File | null) => {
    setCustomAvatar(file);
    if (customAvatarPreview) URL.revokeObjectURL(customAvatarPreview);
    if (file) {
      setCustomAvatarPreview(URL.createObjectURL(file));
      setSelectedAvatar("custom");
    } else {
      setCustomAvatarPreview(null);
      if (avatars.length > 0) setSelectedAvatar(avatars[0].id);
    }
  };

  const startRecording = async () => {
    if (!isLoggedIn) { onAuthRequired(); return; }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/wav" });
        setVoiceBlob(blob);
        setVoicePreview(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      setIsRecording(true);
    } catch {
      setError("Impossible d'accéder au micro.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const submitCloning = async () => {
    if (!voiceBlob || !cloneName.trim()) return;
    setIsCloning(true);
    setError(null);
    try {
      const result = await cloneVoice(cloneName.trim(), voiceBlob);
      setClonedVoices((prev) => [...prev, { id: result.voiceId, name: result.name }]);
      setSelectedVoiceId(result.voiceId);
      setVoiceSource("preset"); // Basculer automatiquement sur la liste
      setVoiceBlob(null);
      setVoicePreview(null);
      setClonename("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du clonage.");
    } finally {
      setIsCloning(false);
    }
  };

  const submitVideo = async () => {
    if (!isLoggedIn) { onAuthRequired(); return; }
    if (!text.trim()) { setError(studioMode === "singing" ? "Les paroles sont requises." : "Le script de l'avatar est requis."); return; }
    if (credits <= 0) { onBuyCredits(); return; }

    setIsBusy(true);
    setError(null);
    setPrediction(null);

    try {
      const result = await generateAvatarVideo({
        avatarId: selectedAvatar,
        text: text.trim(),
        voiceId: selectedVoiceId,
        aspectRatio,
        singingMode: studioMode === "singing",
      });
      setPrediction(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de génération.");
    } finally {
      setIsBusy(false);
    }
  };

  const downloadVideo = () => {
    if (!prediction?.videoUrl) return;
    const a = document.createElement("a");
    a.href = prediction.videoUrl;
    a.download = `safsey-avatar-${prediction.id}.mp4`;
    a.click();
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 lg:flex-row">
      
      {/* ── Configuration ── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full rounded-2xl border border-violet-400/20 bg-white/[0.025] p-5 shadow-xl lg:w-[460px] lg:shrink-0"
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-700 text-white shadow-lg">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white">Studio Avatar</h2>
            <p className="text-[11px] text-slate-400">Lip sync réaliste & clonage de voix ElevenLabs/HeyGen</p>
          </div>
        </div>

        {/* ── Commutateur Mode Parole / Mode Chant ── */}
        <div className="mb-5">
          <div className="flex rounded-xl bg-black/30 p-1 border border-white/10">
            <button
              type="button"
              onClick={() => setStudioMode("speech")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition",
                studioMode === "speech" ? "bg-violet-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
              )}
            >
              🗣️ Mode Parole
            </button>
            <button
              type="button"
              onClick={() => setStudioMode("singing")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition",
                studioMode === "singing"
                  ? "bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-lg shadow-pink-600/30"
                  : "text-slate-400 hover:text-white"
              )}
            >
              🎤 Mode Chant
              <span className="rounded bg-amber-500/80 px-1 py-0.5 text-[8px] font-bold text-white">PREMIUM</span>
            </button>
          </div>

          {studioMode === "singing" && (
            <div className="mt-3 rounded-xl border border-pink-500/30 bg-gradient-to-r from-pink-500/[0.08] to-fuchsia-500/[0.08] p-3">
              <p className="text-xs font-semibold text-pink-200">🎤 Fonctionnalité Premium — Chant IA</p>
              <p className="mt-1 text-[11px] text-pink-300/70 leading-relaxed">
                Nécessite le Pack Créateur ou Business pour une qualité studio.
                Coût : <strong>×5</strong> le crédit d'une vidéo parlée (1 min chantée = 5 min de crédit).
              </p>
            </div>
          )}
        </div>

        {/* 1. Choix de l'avatar */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">1. Choix du Personnage</label>
          {loadingAvatars ? (
            <div className="flex h-24 items-center justify-center text-slate-500 text-xs">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement des modèles...
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {avatars.map((av) => (
                <button
                  key={av.id}
                  type="button"
                  onClick={() => setSelectedAvatar(av.id)}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border transition aspect-[3/4]",
                    selectedAvatar === av.id ? "border-violet-500 ring-2 ring-violet-500/30" : "border-white/10 hover:border-white/20"
                  )}
                >
                  <img src={av.thumbnailUrl} alt={av.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 p-1 text-[9px] text-white truncate text-center">
                    {av.name}
                  </div>
                </button>
              ))}

              {/* Upload photo perso */}
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className={cn(
                  "relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed transition aspect-[3/4]",
                  selectedAvatar === "custom" ? "border-violet-500 ring-2 ring-violet-500/30 bg-violet-500/10" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                )}
              >
                {customAvatarPreview ? (
                  <img src={customAvatarPreview} alt="Custom" className="h-full w-full object-cover" />
                ) : (
                  <>
                    <Upload className="h-5 w-5 text-slate-400" />
                    <span className="mt-1 text-[9px] text-slate-400 text-center">Ma Photo</span>
                  </>
                )}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => handleCustomAvatar(e.target.files?.[0] ?? null)}
                />
              </button>
            </div>
          )}
        </div>

        {/* 2. Script / Paroles */}
        <div className="mt-5 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            2. {studioMode === "singing" ? "Paroles de la chanson" : "Script (Texte à prononcer)"}
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={studioMode === "singing" ? 6 : 4}
            maxLength={studioMode === "singing" ? 2000 : 1000}
            placeholder={studioMode === "singing"
              ? "Écris les paroles que ton avatar va chanter...\n\nExemple :\n🎵 Je suis SAFSEY, je crée sans limites\n🎵 L'IA qui danse et qui chante vite..."
              : "Écris ici ce que ton personnage doit dire..."
            }
            className="w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-violet-400/40 focus:outline-none focus:ring-1 focus:ring-violet-400/20"
          />
          <p className="text-right text-[10px] text-slate-600">{text.length}/{studioMode === "singing" ? 2000 : 1000}</p>
        </div>

        {/* 2b. Upload de mélodie (Mode Chant uniquement) */}
        {studioMode === "singing" && (
          <div className="mt-3 space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              2b. Mélodie (optionnel)
            </label>
            <label
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-pink-400/20 bg-pink-500/[0.04] p-4 text-center transition hover:border-pink-400/40 hover:bg-pink-500/[0.08]"
              onClick={() => melodyInputRef.current?.click()}
            >
              {melodyPreview ? (
                <div className="flex w-full items-center gap-3">
                  <span className="text-lg">🎵</span>
                  <audio src={melodyPreview} controls className="h-8 flex-1" />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setMelodyFile(null); setMelodyPreview(null); }}
                    className="text-rose-400 hover:text-rose-300"
                  >✕</button>
                </div>
              ) : (
                <>
                  <Upload className="h-5 w-5 text-pink-400" />
                  <span className="mt-1 text-xs text-pink-300">{melodyFile ? melodyFile.name : "Importer une mélodie (MP3/WAV)"}</span>
                  <span className="mt-0.5 text-[10px] text-slate-600">L'IA générera la musique automatiquement si aucune mélodie n'est fournie</span>
                </>
              )}
              <input
                ref={melodyInputRef}
                type="file"
                accept="audio/mp3,audio/wav,audio/mpeg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setMelodyFile(file);
                  if (melodyPreview) URL.revokeObjectURL(melodyPreview);
                  setMelodyPreview(file ? URL.createObjectURL(file) : null);
                }}
              />
            </label>
          </div>
        )}

        {/* 3. Choix de la voix */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">3. Gestion de la Voix</label>
            <div className="flex rounded-lg bg-black/30 p-0.5 border border-white/10">
              <button
                type="button"
                onClick={() => setVoiceSource("preset")}
                className={cn("rounded px-2 py-1 text-[10px] font-medium transition", voiceSource === "preset" ? "bg-violet-600 text-white" : "text-slate-400")}
              >
                Voix IA
              </button>
              <button
                type="button"
                onClick={() => setVoiceSource("clone")}
                className={cn("rounded px-2 py-1 text-[10px] font-medium transition", voiceSource === "clone" ? "bg-violet-600 text-white" : "text-slate-400")}
              >
                Clonage
              </button>
            </div>
          </div>

          {voiceSource === "preset" ? (
            <select
              value={selectedVoiceId}
              onChange={(e) => setSelectedVoiceId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-violet-400"
            >
              <optgroup label="Voix SAFSEY standard">
                {PRESET_VOICES.map((v) => (
                  <option key={v.id} value={v.id} className="bg-slate-900">
                    {v.name}
                  </option>
                ))}
              </optgroup>
              {clonedVoices.length > 0 && (
                <optgroup label="Mes voix clonées">
                  {clonedVoices.map((v) => (
                    <option key={v.id} value={v.id} className="bg-slate-900">
                      👤 {v.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          ) : (
            <div className="rounded-xl border border-violet-500/10 bg-violet-500/[0.02] p-3 space-y-3">
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Enregistre un échantillon de 10 secondes pour cloner ta voix instantanément avec ElevenLabs.
              </p>
              {voicePreview && <audio src={voicePreview} controls className="w-full h-8" />}
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition",
                    isRecording ? "bg-red-500 text-white animate-pulse" : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                  )}
                >
                  {isRecording ? <><Square className="h-3.5 w-3.5" /> Stop</> : <><Mic className="h-3.5 w-3.5" /> Enregistrer</>}
                </button>

                {voiceBlob && (
                  <input
                    type="text"
                    value={cloneName}
                    onChange={(e) => setClonename(e.target.value)}
                    placeholder="Nom de ma voix..."
                    className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                  />
                )}
              </div>

              {voiceBlob && cloneName.trim() && (
                <button
                  type="button"
                  onClick={submitCloning}
                  disabled={isCloning}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {isCloning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mic2 className="h-3.5 w-3.5" />}
                  Créer mon clone vocal
                </button>
              )}
            </div>
          )}
        </div>

        {/* 4. Format */}
        <div className="mt-5 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">4. Format</label>
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { value: "16:9" as const, label: "Paysage", icon: "📺" },
              { value: "9:16" as const, label: "Portrait", icon: "📱" },
              { value: "1:1" as const, label: "Carré", icon: "⬜" },
            ]).map((fmt) => (
              <button
                key={fmt.value}
                type="button"
                onClick={() => setAspectRatio(fmt.value)}
                className={cn(
                  "flex flex-col items-center rounded-xl border py-2 text-[10px] transition",
                  aspectRatio === fmt.value ? "border-violet-500/60 bg-violet-500/10 text-white" : "border-white/10 text-slate-500 hover:text-slate-300"
                )}
              >
                <span className="text-base">{fmt.icon}</span>
                <span className="mt-0.5 font-medium">{fmt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <p>{error}</p>
          </div>
        )}
        {credits <= 0 && <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/[0.08] p-3 text-xs leading-relaxed text-amber-100">{t("video.freeTrialExhausted")}</div>}

        <button
          type="button"
          onClick={submitVideo}
          disabled={isBusy || !text.trim() || credits <= 0}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-700/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {credits <= 0
            ? t("billing.creditsDepleted")
            : isBusy
              ? t("video.generating")
              : studioMode === "singing"
                ? "🎤 Générer la chanson (×5 crédits)"
                : "Générer la vidéo avatar"
          }
        </button>
        {credits <= 0 && <button type="button" onClick={onBuyCredits} className="mt-2 w-full text-center text-xs font-medium text-cyan-300 underline-offset-4 hover:underline">{t("billing.buyCredits")}</button>}
      </motion.section>

      {/* ── Prévisualisation ── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.07 }}
        className="flex flex-1 flex-col rounded-2xl border border-white/10 bg-black/25 p-4 shadow-xl"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-white">Rendu de l'Avatar</p>
          {prediction?.status === "succeeded" && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => { setPrediction(null); setText(""); }}
                className="flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-slate-400 transition hover:text-white"
              >
                <RefreshCw className="h-3 w-3" /> Nouveau
              </button>
              <button
                type="button"
                onClick={downloadVideo}
                className="flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-[10px] text-violet-200 transition hover:bg-violet-500/20"
              >
                <Download className="h-3 w-3" /> {t("video.download")}
              </button>
              {/* ── Boutons de partage viral avec branding ── */}
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent("🎬 " + (studioMode === "singing" ? "🎤 Écoute cette chanson" : "Regarde cette vidéo") + " créée avec SAFSEY IA ! Essaie gratuitement → https://safsey.com " + (prediction.videoUrl || ""))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] text-emerald-200 transition hover:bg-emerald-500/20"
              >
                <span className="text-[11px]">📱</span> WhatsApp
              </a>
              <a
                href="https://www.tiktok.com/upload?lang=fr"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-full border border-pink-500/30 bg-pink-500/10 px-2.5 py-1 text-[10px] text-pink-200 transition hover:bg-pink-500/20"
              >
                <span className="text-[11px]">🎵</span> TikTok
              </a>
              <a
                href="https://www.instagram.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] text-amber-200 transition hover:bg-amber-500/20"
              >
                <span className="text-[11px]">📸</span> Instagram
              </a>
              {/* Bouton Partager sur YouTube */}
              <button
                type="button"
                onClick={() => setYtShareOpen(true)}
                className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[10px] text-red-200 transition hover:bg-red-500/20"
              >
                <span className="text-[11px]">🎥</span> YouTube
              </button>
            </div>
          )}
        </div>

        <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-950 min-h-[420px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,0.12),transparent_40%),radial-gradient(circle_at_80%_90%,rgba(139,92,246,0.08),transparent_35%)]" />

          {prediction?.videoUrl ? (
            <video
              src={prediction.videoUrl}
              controls
              autoPlay
              loop
              className="relative z-10 max-h-full max-w-full rounded-xl shadow-2xl"
            />
          ) : prediction && prediction.status === "processing" ? (
            <div className="relative z-10 flex flex-col items-center gap-4 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-violet-400" />
              <div>
                <p className="text-sm font-semibold text-white">{t("video.processingTitle")}</p>
                <p className="mt-1 max-w-xs text-xs text-slate-500">{t("video.processingHint")}</p>
              </div>
            </div>
          ) : (
            <div className="relative z-10 flex flex-col items-center gap-3 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
                <Play className="h-9 w-9 text-slate-600" />
              </div>
              <p className="text-sm font-medium text-slate-400">Prêt pour le Studio Avatar</p>
              <p className="max-w-xs text-xs text-slate-600">
                Choisis ton présentateur, tape un texte ou clone ta voix et génère une vidéo synchronisée.
              </p>
            </div>
          )}
        </div>

        {prediction && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-slate-500">
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2 leading-relaxed">
              Statut<br />
              <span className="text-slate-300 font-semibold">{prediction.status}</span>
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2 leading-relaxed">
              ID Tâche<br />
              <span className="truncate text-slate-300 font-mono">{prediction.id.slice(0, 8)}...</span>
            </div>
          </div>
        )}
      </motion.section>

      <YouTubeShareModal
        open={ytShareOpen}
        onClose={() => setYtShareOpen(false)}
        aspectRatio={aspectRatio}
      />
    </div>
  );
};
