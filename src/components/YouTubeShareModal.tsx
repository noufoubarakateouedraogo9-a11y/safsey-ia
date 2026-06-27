import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, ExternalLink, Video, X } from "lucide-react";

export const YouTubeShareModal = ({
  open,
  onClose,
  aspectRatio,
}: {
  open: boolean;
  onClose: () => void;
  aspectRatio: "16:9" | "9:16" | "1:1";
}) => {
  const [customTitle, setCustomTitle] = useState("");
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedDesc, setCopiedDesc] = useState(false);

  const isShort = aspectRatio === "9:16";

  const fullTitle = `Vidéo créée avec SAFSEY IA - ${customTitle.trim() || "Mon Avatar"}`.slice(0, 100);
  const description = `Crée ton propre avatar parlant ou chantant ici : https://safsey.com\n\n#safsey #ia #avatar #talkingphoto ${isShort ? "#shorts" : ""}`;

  const handleCopyTitle = async () => {
    await navigator.clipboard.writeText(fullTitle).catch(() => {});
    setCopiedTitle(true);
    setTimeout(() => setCopiedTitle(false), 2000);
  };

  const handleCopyDesc = async () => {
    await navigator.clipboard.writeText(description).catch(() => {});
    setCopiedDesc(true);
    setTimeout(() => setCopiedDesc(false), 2000);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-xl p-1.5 text-slate-500 hover:bg-white/5 hover:text-white transition"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600/20 text-red-400">
              <Video className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Assistant de Publication YouTube</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Prépare les métadonnées optimisées pour booster tes vues sur YouTube.
              </p>
            </div>
          </div>

          {/* Type Détection */}
          <div className="mb-4 rounded-xl border border-red-500/10 bg-red-500/[0.03] p-3 text-xs leading-relaxed text-red-200">
            {isShort ? (
              <p>
                📱 <strong>Format détecté : YouTube Short (9:16)</strong><br />
                Recommandé pour un reach viral maximum et l'acquisition rapide d'abonnés. Le hashtag <code className="bg-black/30 px-1 rounded">#shorts</code> a été ajouté à la description.
              </p>
            ) : (
              <p>
                📺 <strong>Format détecté : Vidéo YouTube Standard ({aspectRatio})</strong><br />
                Idéal pour le contenu long format ou les guides détaillés.
              </p>
            )}
          </div>

          <div className="space-y-4">
            {/* Custom Title Input */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Titre personnalisé de ta vidéo
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                maxLength={60}
                placeholder="Ex: Mon premier avatar"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/30"
              />
            </div>

            {/* Title Pre-filled Copy section */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Titre pré-rempli (YouTube)
                </label>
                <button
                  type="button"
                  onClick={handleCopyTitle}
                  className="flex items-center gap-1 text-[11px] font-bold text-red-400 hover:text-red-300"
                >
                  {copiedTitle ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedTitle ? "Copié !" : "Copier"}
                </button>
              </div>
              <div className="rounded-xl border border-white/5 bg-black/40 p-3 text-xs font-medium text-slate-300 break-words leading-relaxed select-all">
                {fullTitle}
              </div>
            </div>

            {/* Description Pre-filled Copy section */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Description pré-remplie
                </label>
                <button
                  type="button"
                  onClick={handleCopyDesc}
                  className="flex items-center gap-1 text-[11px] font-bold text-red-400 hover:text-red-300"
                >
                  {copiedDesc ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedDesc ? "Copié !" : "Copier"}
                </button>
              </div>
              <pre className="rounded-xl border border-white/5 bg-black/40 p-3 text-[11px] text-slate-400 whitespace-pre-wrap font-mono leading-relaxed select-all">
                {description}
              </pre>
            </div>

            {/* Action button */}
            <a
              href="https://www.youtube.com/upload"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-bold text-white shadow-lg shadow-red-700/20 transition hover:bg-red-500"
            >
              Uploader sur YouTube <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
