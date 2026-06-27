import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Loader2, Mail, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";

export const AuthModal = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsBusy(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose(); // Fermer la modale si succès
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccessMsg(t("auth.signUpSuccess", "Inscription réussie. Vérifiez vos e-mails !"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.error", "Erreur d'authentification."));
    } finally {
      setIsBusy(false);
    }
  };

  const handleOAuth = async (provider: "google") => {
    setIsBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : `Erreur de connexion ${provider}.`);
      setIsBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
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
            className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-slate-950 p-8 shadow-2xl"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-xl p-1.5 text-slate-500 hover:bg-white/5 hover:text-white transition"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-600 text-2.5xl font-black text-white shadow-xl shadow-cyan-500/20">
                S
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                {isLogin ? t("auth.signIn", "Connexion") : t("auth.signUp", "Créer un compte")}
              </h2>
              <p className="mt-1.5 text-xs text-slate-400">
                {t("auth.subtitle", "Rejoins SAFSEY IA pour débloquer les 3 essais gratuits à vie.")}
              </p>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                {error}
              </div>
            )}

            {successMsg && (
              <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-xs text-emerald-200">
                {successMsg}
              </div>
            )}

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-400">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                  placeholder="votre@email.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-400">
                  {t("auth.password", "Mot de passe")}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={isBusy}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
              >
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {isLogin ? t("auth.signInButton", "Se connecter") : t("auth.signUpButton", "Créer un compte")}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] font-medium text-slate-500">OU</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              onClick={() => handleOAuth("google")}
              disabled={isBusy}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-xs font-medium text-white transition hover:bg-white/[0.06] disabled:opacity-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {t("auth.googleButton", "Continuer avec Google")}
            </button>

            <p className="mt-6 text-center text-xs text-slate-500">
              {isLogin ? t("auth.noAccount", "Pas encore de compte ?") : t("auth.haveAccount", "Déjà un compte ?")}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="ml-1 font-semibold text-cyan-400 hover:underline focus:outline-none"
              >
                {isLogin ? t("auth.signUpLink", "S'inscrire") : t("auth.signInLink", "Se connecter")}
              </button>
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
