import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, ArrowRight, CheckCircle2, Copy, CreditCard, Loader2, Send, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import {
  createBillingCheckout,
  fetchBillingProducts,
  openLemonCheckout,
} from "../lib/billing";
import type { BillingProduct } from "../lib/types";

// ── Logos intégrés pour fiabilité ──────────────────────────────────────

const WaveLogo = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current text-blue-400">
    <circle cx="12" cy="12" r="10" className="text-blue-500" />
    <path d="M7 12c0-2 2-4 5-4s5 2 5 4-2 4-5 4-5-2-5-4z" fill="white" fillOpacity="0.9" />
  </svg>
);

const OrangeMoneyLogo = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
    <circle cx="12" cy="12" r="10" className="text-orange-500" />
    <path d="M9 8h3v8H9V8z" fill="white" />
    <path d="M15 8h3v8h-3V8z" fill="white" />
  </svg>
);

export const PaymentModal = ({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const { t } = useTranslation();
  const [products, setProducts] = useState<BillingProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // États pour le paiement mobile (Wave/OM)
  const [manualProduct, setManualProduct] = useState<BillingProduct | null>(null);
  const [manualProvider, setManualProvider] = useState<"wave" | "om">("wave");
  const [manualStep, setManualStep] = useState<1 | 2 | 3>(1);
  const [txId, setTxId] = useState("");
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [hasFetchError, setHasFetchError] = useState(false);

  // Configuration de tes numéros de téléphone ici
  const WAVE_NUMBER = "+226 00 00 00 00"; // ← Remplace par ton vrai numéro
  const OM_NUMBER = "+226 00 00 00 00";   // ← Remplace par ton vrai numéro

  // Taux de conversion EUR → FCFA (1 EUR = 656 FCFA, arrondi au millier)
  const EUR_TO_FCFA = 656;
  const eurToFcfa = (eur: number) => Math.ceil((eur * EUR_TO_FCFA) / 1000) * 1000;
  const formatFcfa = (fcfa: number) => `${fcfa.toLocaleString("fr-FR")} FCFA`;

  // Les prix FCFA sont calculés dynamiquement via eurToFcfa() dans la modale.

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setHasFetchError(false);
    fetchBillingProducts()
      .then((list) => {
        setProducts(list);
        if (list.length === 0) setHasFetchError(true);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t("billing.loadError"));
        setHasFetchError(true);
      })
      .finally(() => setLoading(false));
  }, [open, t]);

  const buyLemon = async (product: BillingProduct) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setBuyingId(product.id);
    setError(null);
    try {
      const checkout = await createBillingCheckout(user.id, product.id);
      openLemonCheckout(checkout.url, onSuccess);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("billing.openError"));
    } finally {
      setBuyingId(null);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualProduct || !txId.trim()) return;

    setSubmitLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Vous n'êtes pas connecté.");

      const res = await fetch("/api/billing/manual-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-safsey-user-id": user.id },
        body: JSON.stringify({ variantId: manualProduct.id, transactionId: txId.trim() })
      });

      if (!res.ok) throw new Error("Erreur lors de la soumission.");

      setManualStep(3); // Succès
      setTimeout(() => {
        onSuccess();
        closeManualFlow();
      }, 4000);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de soumission");
    } finally {
      setSubmitLoading(false);
    }
  };

  const startManualFlow = (product: BillingProduct, provider: "wave" | "om") => {
    setManualProduct(product);
    setManualProvider(provider);
    setManualStep(1);
    setTxId("");
    setError(null);
  };

  const closeManualFlow = () => {
    setManualProduct(null);
    setManualStep(1);
    setTxId("");
  };

  const copyPhone = async () => {
    const num = manualProvider === "wave" ? WAVE_NUMBER : OM_NUMBER;
    await navigator.clipboard.writeText(num);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl"
          >
            {/* En-tête */}
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {manualProduct ? `${manualProduct.productName} - ${manualProvider === "wave" ? "Wave" : "Orange Money"}` : t("billing.title")}
              </h2>
              <button onClick={() => { onClose(); closeManualFlow(); }} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* ── Étape 1 : Instructions de paiement Mobile ──────────── */}
            {manualProduct && manualStep === 1 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 text-center">
                  <p className="text-sm font-medium text-slate-400">Montant à envoyer</p>
                  <p className="mt-2 text-3xl font-bold text-white">{manualProduct.priceFormatted}</p>
                  <p className="mt-1 text-sm text-slate-500">Pour le pack {manualProduct.productName} ({manualProduct.credits} crédits)</p>
                </div>

                <div>
                  <p className="mb-3 text-sm font-medium text-slate-300">1. Effectuez le transfert vers :</p>
                  <div className={`flex items-center justify-between rounded-xl border p-4 ${manualProvider === "wave" ? "border-blue-400/30 bg-blue-500/10" : "border-orange-400/30 bg-orange-500/10"}`}>
                    <div className="flex items-center gap-3">
                      {manualProvider === "wave" ? <WaveLogo /> : <OrangeMoneyLogo />}
                      <span className="text-lg font-bold tracking-wider text-white">
                        {manualProvider === "wave" ? WAVE_NUMBER : OM_NUMBER}
                      </span>
                    </div>
                    <button onClick={copyPhone} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20">
                      {copiedPhone ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedPhone ? "Copié !" : "Copier"}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => setManualStep(2)}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:brightness-110"
                  >
                    J'ai envoyé le paiement <ArrowRight className="h-4 w-4" />
                  </button>
                  <button onClick={closeManualFlow} className="w-full py-2 text-xs text-slate-500 hover:text-white transition">
                    Retour aux méthodes de paiement
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Étape 2 : Soumission de l'ID Transaction ───────────── */}
            {manualProduct && manualStep === 2 && (
              <motion.form initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} onSubmit={handleManualSubmit} className="space-y-5">
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-300">2. ID de transaction reçu par SMS :</p>
                  <input
                    type="text"
                    required
                    value={txId}
                    onChange={(e) => setTxId(e.target.value)}
                    placeholder="Ex: CI240501.0845.A1B2C3"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20"
                  />
                  <p className="mt-2 text-xs text-slate-500">Cet ID permet à notre équipe de valider manuellement votre paiement.</p>
                </div>
                
                <button
                  type="submit"
                  disabled={submitLoading || !txId.trim()}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                >
                  {submitLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Soumettre pour validation
                </button>
                <button type="button" onClick={() => setManualStep(1)} className="w-full py-2 text-xs text-slate-500 hover:text-white transition">
                  Retour
                </button>
              </motion.form>
            )}

            {/* ── Étape 3 : Confirmation ─────────────────────────────── */}
            {manualProduct && manualStep === 3 && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold text-white">Demande envoyée !</h3>
                <p className="mt-2 text-sm text-slate-400 max-w-xs">
                  Votre demande est en cours de validation par notre équipe. Vos crédits seront ajoutés sous quelques minutes.
                </p>
              </motion.div>
            )}

            {/* ── Avertissement Mobile Money si problème API ──────────── */}
            {hasFetchError && !manualProduct && (
              <div className="mb-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                <p className="font-medium">Service international temporairement indisponible</p>
                <p className="mt-1 text-xs text-amber-300/80">Veuillez utiliser Wave ou Orange Money ci-dessous.</p>
              </div>
            )}

            {/* ── Liste des produits (Affiché si pas de flux manuel) ─── */}
            {!manualProduct && (
              <div className="space-y-3">
                {loading ? (
                  <div className="flex items-center justify-center py-10 text-slate-400">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("billing.loading")}
                  </div>
                ) : products.length === 0 ? (
                  <div className="rounded-xl border border-blue-400/30 bg-blue-500/5 p-5">
                    <p className="text-sm text-slate-300 mb-4 text-center">Choisissez votre pack et payez via Mobile Money :</p>
                    <div className="space-y-3">
                      {[
                        { name: "Pack Essentiel", eur: 19, min: 3, sing: "0,5", credits: 180 },
                        { name: "Pack Créateur ⭐", eur: 39, min: 8, sing: "1,5", credits: 480 },
                        { name: "Pack Business 🏆", eur: 79, min: 20, sing: "4", credits: 1200 },
                      ].map((pack) => (
                        <div key={pack.name} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="text-sm font-semibold text-white">{pack.name}</p>
                              <p className="text-xs text-slate-400">{pack.min} min parole · 🎤 {pack.sing} min chant</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-white">{pack.eur} €</p>
                              <p className="text-[10px] text-amber-300">{formatFcfa(eurToFcfa(pack.eur))}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => startManualFlow({ id: `pack_${pack.min}`, productName: pack.name, variantName: `${pack.min} min`, priceFormatted: formatFcfa(eurToFcfa(pack.eur)), credits: pack.credits } as BillingProduct, "wave")}
                              className="flex items-center justify-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 py-2 text-xs font-semibold text-blue-200 transition hover:bg-blue-500/20"
                            >
                              <WaveLogo /> Wave
                            </button>
                            <button
                              onClick={() => startManualFlow({ id: `pack_${pack.min}`, productName: pack.name, variantName: `${pack.min} min`, priceFormatted: formatFcfa(eurToFcfa(pack.eur)), credits: pack.credits } as BillingProduct, "om")}
                              className="flex items-center justify-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 py-2 text-xs font-semibold text-orange-200 transition hover:bg-orange-500/20"
                            >
                              <OrangeMoneyLogo /> OM
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  products.map((product) => {
                    const videoMinutes = product.credits > 0 ? Math.round(product.credits / 60) : null;
                    const singingMinutes = product.credits > 0 ? (product.credits / 5 / 60).toFixed(1) : null;
                    const priceFcfa = formatFcfa(eurToFcfa(Number(product.priceFormatted?.replace(/[^0-9.,]/g, "").replace(",", ".")) || 0));
                    const isBusiness = videoMinutes !== null && videoMinutes >= 20;
                    const isPopular = videoMinutes !== null && videoMinutes >= 8 && !isBusiness;
                    return (
                    <div key={product.id} className="relative rounded-xl border border-white/10 bg-white/[0.02] p-5">
                      {(isPopular || isBusiness) && (
                        <span className="absolute -top-2 right-3 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 px-2.5 py-0.5 text-[10px] font-bold text-white">
                          {isBusiness ? "🏆 Meilleur rapport" : "⭐ Populaire"}
                        </span>
                      )}
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-semibold text-white text-base">{product.productName}</p>
                          {videoMinutes ? (
                            <div className="mt-1">
                              <p className="flex items-center gap-1.5 text-sm font-medium text-cyan-300">
                                <span className="text-2xl font-bold text-white">{videoMinutes} min</span>
                                <span className="text-slate-400">de vidéo parlée</span>
                              </p>
                              <p className="mt-0.5 text-[11px] text-pink-300/80">
                                🎤 ou {singingMinutes} min de chant IA
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-400 mt-1">{product.variantName} • {product.credits} crédits</p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-2xl text-white">{product.priceFormatted}</span>
                          <p className="text-[10px] text-amber-300/80 mt-0.5">≈ {priceFcfa}</p>
                        </div>
                      </div>
                      {videoMinutes && (
                        <p className="mb-3 text-[11px] text-slate-500 leading-relaxed">
                          Parole : 1 sec = 1 crédit · Chant Premium : 1 sec = 5 crédits · Total : {product.credits} sec
                        </p>
                      )}
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
                        {/* Carte Bancaire */}
                        <button
                          onClick={() => buyLemon(product)}
                          disabled={Boolean(buyingId)}
                          className="flex items-center justify-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/15 disabled:opacity-50"
                        >
                          {buyingId === product.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                          Carte Bancaire
                        </button>
                        
                        {/* Wave */}
                        <button
                          onClick={() => startManualFlow(product, "wave")}
                          className="flex items-center justify-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2.5 text-xs font-semibold text-blue-200 transition hover:bg-blue-500/15"
                        >
                          <WaveLogo />
                          Wave
                        </button>
                        
                        {/* Orange Money */}
                        <button
                          onClick={() => startManualFlow(product, "om")}
                          className="flex items-center justify-center gap-2 rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2.5 text-xs font-semibold text-orange-200 transition hover:bg-orange-500/15"
                        >
                          <OrangeMoneyLogo />
                          Orange Money
                        </button>
                      </div>
                    </div>
                  );
                  })
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
