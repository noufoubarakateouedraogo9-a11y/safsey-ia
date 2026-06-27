import { useEffect, useState } from "react";
import { Check, X, Loader2, RefreshCw } from "lucide-react";
import { clientConfig } from "../lib/config";
import type { PendingManualPayment } from "../../server/credits_db";

export const AdminScreen = () => {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [payments, setPayments] = useState<PendingManualPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPayments = async (authToken: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${clientConfig.apiUrl}/api/admin/payments`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error("Mot de passe incorrect ou erreur réseau");
      const data = await res.json();
      setPayments(data.pending);
      setToken(authToken);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPayments(password);
  };

  const handleAction = async (id: string, action: "approve" | "reject") => {
    if (!token) return;
    try {
      const res = await fetch(`${clientConfig.apiUrl}/api/admin/payments/${id}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erreur lors de l'action");
      await fetchPayments(token);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur");
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-white">
        <form onSubmit={handleLogin} className="w-full max-w-sm rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h1 className="mb-4 text-xl font-bold">Admin SAFSEY IA</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe admin"
            className="mb-4 w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 focus:border-cyan-400 focus:outline-none"
          />
          <button type="submit" disabled={loading} className="w-full rounded-lg bg-cyan-600 py-2 font-medium hover:bg-cyan-500">
            {loading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Connexion"}
          </button>
          {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}
        </form>
      </div>
    );
  }

  // Auto-refresh toutes les 5 secondes quand on est connecté
  useEffect(() => {
    if (!token) return;
    const iv = setInterval(() => fetchPayments(token), 5_000);
    return () => clearInterval(iv);
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Paiements Manuels en Attente</h1>
            <p className="mt-1 text-xs text-slate-500">Rafraîchissement automatique toutes les 5 secondes</p>
          </div>
          <button onClick={() => fetchPayments(token)} className="flex items-center gap-1.5 text-sm text-cyan-400 hover:underline">
            <RefreshCw className="h-3.5 w-3.5" /> Rafraîchir
          </button>
        </div>

        {payments.length === 0 ? (
          <p className="text-slate-400">Aucun paiement en attente.</p>
        ) : (
          <div className="grid gap-4">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div>
                  <p className="font-mono text-sm text-cyan-300">Tx: {p.transactionId}</p>
                  <p className="text-xs text-slate-400">Variant: {p.variantId} · Date: {new Date(p.createdAt).toLocaleString()}</p>
                  <p className="text-xs text-slate-500">User: {p.userId}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction(p.id, "approve")}
                    className="flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-sm font-medium text-emerald-400 hover:bg-emerald-500/30"
                  >
                    <Check className="h-4 w-4" /> Valider
                  </button>
                  <button
                    onClick={() => handleAction(p.id, "reject")}
                    className="flex items-center gap-1 rounded-lg bg-rose-500/20 px-3 py-1.5 text-sm font-medium text-rose-400 hover:bg-rose-500/30"
                  >
                    <X className="h-4 w-4" /> Rejeter
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
