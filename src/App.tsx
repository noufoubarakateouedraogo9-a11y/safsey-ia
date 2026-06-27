// ============================================================
// SAFSEY IA — Application principale
// Navigation : Chat IA | Générateur d'Images | Générateur de Vidéo
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Coins, Image, Info, Menu, MessageSquare, RotateCcw, Sparkles, Video } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ChatComposer }     from "./components/ChatComposer";
import { ConnectionBadge }  from "./components/ConnectionBadge";
/* CreditsBadge remplacé par bouton inline */
import { ImageService }     from "./components/ImageService";
import { LanguageSelector } from "./components/LanguageSelector";
import { Message }          from "./components/Message";
import { PaymentModal }     from "./components/PaymentModal";
import { Sidebar }          from "./components/Sidebar";
import { TypingIndicator }  from "./components/TypingIndicator";
import { VideoService }     from "./components/VideoService";
import { AvatarStudio }     from "./components/AvatarStudio";
import { WelcomeScreen }    from "./components/WelcomeScreen";
import { AuthModal }        from "./components/AuthModal";
import { AdminScreen }      from "./components/AdminScreen";
import { supabase, signOut } from "./lib/supabase";
import type { User } from "@supabase/supabase-js";

import { ChatApiError, checkBackendHealth, sendChat, sendMultimodalChat } from "./lib/api";
import { fetchCredits } from "./lib/billing";
import { deriveTitle } from "./lib/format";
import { loadConversations, loadSettings, saveConversations, saveSettings } from "./lib/storage";
import type { AppSettings, BackendStatus, ChatMessage, ChatMode, Conversation, CreditsInfo, MessageAttachment } from "./lib/types";

type AppView = "chat" | "image" | "video" | "avatarStudio";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

// ── Onglets de navigation ─────────────────────────────────────
const NAV_TABS: { id: AppView; labelKey: string; shortKey: string; icon: typeof MessageSquare; accent: string }[] = [
  { id: "chat",         labelKey: "nav.chat",         shortKey: "nav.chatShort",         icon: MessageSquare, accent: "cyan" },
  { id: "image",        labelKey: "nav.image",        shortKey: "nav.imageShort",        icon: Image,         accent: "blue" },
  { id: "video",        labelKey: "nav.video",        shortKey: "nav.videoShort",        icon: Video,         accent: "violet" },
  { id: "avatarStudio", labelKey: "nav.avatarStudio", shortKey: "nav.avatarStudioShort", icon: Sparkles,      accent: "fuchsia" },
];

const NAV_ACCENT_ACTIVE: Record<AppView, string> = {
  chat:         "bg-cyan-500/15 text-cyan-100 border-cyan-400/30",
  image:        "bg-blue-500/15 text-blue-100 border-blue-400/30",
  video:        "bg-violet-500/15 text-violet-100 border-violet-400/30",
  avatarStudio: "bg-fuchsia-500/15 text-fuchsia-100 border-fuchsia-400/30",
};

const NAV_GLOW: Record<AppView, string> = {
  chat:         "from-cyan-600/10",
  image:        "from-blue-600/10",
  video:        "from-violet-600/10",
  avatarStudio: "from-fuchsia-600/10",
};

// ─────────────────────────────────────────────────────────────
export default function App() {
  const { t } = useTranslation();
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations());
  const [activeId, setActiveId] = useState<string | null>(() => loadConversations()[0]?.id ?? null);
  const [settings, setSettings] = useState<AppSettings>(
    () => loadSettings() ?? { mode: "regular", webSearch: false },
  );
  const [input, setInput]             = useState("");
  const [isBusy, setIsBusy]           = useState(false);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");
  const [credits, setCredits] = useState<CreditsInfo | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [authOpen, setAuthOpen]       = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSource, setActiveSource] = useState<number | null>(null);
  const [activeView, setActiveView]   = useState<AppView>("chat");

  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const scrollRef   = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );
  const messages = activeConversation?.messages ?? [];

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => saveConversations(conversations), [conversations]);
  useEffect(() => saveSettings(settings), [settings]);

  const refreshCredits = useCallback(async () => {
    if (!user) return;
    try {
      const next = await fetchCredits(user.id);
      setCredits(next);
    } catch {
      // Le compteur ne doit pas empêcher l'interface de se charger.
    }
  }, [user]);

  // Health check toutes les 10 s
  useEffect(() => {
    let active = true;
    const check = async () => {
      const status = await checkBackendHealth();
      if (active) setBackendStatus(status);
      if (active && user) void refreshCredits();
    };
    check();
    const iv = window.setInterval(check, 10_000);
    return () => { active = false; window.clearInterval(iv); };
  }, [refreshCredits, user]);

  // Auto-scroll
  useEffect(() => {
    sentinelRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isBusy]);

  const updateConversation = useCallback(
    (id: string, upd: (c: Conversation) => Conversation) =>
      setConversations((prev) => prev.map((c) => (c.id === id ? upd(c) : c))),
    [],
  );

  const handleNewConversation = useCallback(() => {
    const empty = conversations.find((c) => c.messages.length === 0);
    if (empty) { setActiveId(empty.id); setSidebarOpen(false); return; }
    const nc: Conversation = {
      id: uid(), title: t("sidebar.newConversation"), messages: [],
      mode: settings.mode, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    setConversations((prev) => [nc, ...prev]);
    setActiveId(nc.id);
    setSidebarOpen(false);
  }, [conversations, settings.mode, t]);

  const handleDeleteConversation = useCallback((id: string) => {
    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (id === activeId) setActiveId(filtered[0]?.id ?? null);
      return filtered;
    });
  }, [activeId]);

  const handleCitationClick = useCallback((index: number) => {
    setActiveSource(index);
    scrollRef.current
      ?.querySelector<HTMLElement>(`[data-source-index="${index}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setActiveSource(null), 2_400);
  }, []);

  const handleSend = useCallback(
    async (overrideText?: string, overrideSettings?: AppSettings, attachments?: MessageAttachment[]) => {
      if (!user) {
        setAuthOpen(true);
        return;
      }
      const text = (overrideText ?? input).trim();
      const hasAttachments = (attachments?.length ?? 0) > 0;
      if (!text && !hasAttachments) return;
      if (isBusy) return;

      // Vérification des crédits multimodaux (pièces jointes uniquement)
      // Le Chat IA standard (texte seul) est 100% GRATUIT et ILLIMITÉ
      if (hasAttachments) {
        const isPurchased = credits?.hasPurchased ?? false;
        if (isPurchased && (credits?.credits ?? 0) <= 0) {
          // Abonné qui a épuisé ses crédits
          setPaymentOpen(true);
          return;
        }
        if (!isPurchased && credits?.multimodalToday?.isLimited) {
          // Non-abonné qui a atteint la limite quotidienne de 3
          setPaymentOpen(true);
          return;
        }
      }

      const { mode, webSearch } = overrideSettings ?? settings;

      let conversationId = activeId;
      let priorMessages: ChatMessage[] = activeConversation?.messages ?? [];

      const titleText = text || (hasAttachments ? `Analyse de ${attachments![0].name}` : "Conversation");

      if (!conversationId) {
        const nc: Conversation = {
          id: uid(), title: deriveTitle(titleText), messages: [], mode,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        conversationId = nc.id;
        priorMessages = [];
        setConversations((prev) => [nc, ...prev]);
        setActiveId(nc.id);
      }

      // Le message affiché inclut les pièces jointes
      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: text,
        attachments,
        createdAt: new Date().toISOString(),
      };
      const historyForApi = [...priorMessages, userMsg];
      const targetId = conversationId;

      updateConversation(targetId, (c) => ({
        ...c,
        title: c.messages.length === 0 ? deriveTitle(titleText) : c.title,
        mode,
        messages: [...c.messages, userMsg],
        updatedAt: new Date().toISOString(),
      }));

      setInput("");
      setIsBusy(true);

      try {
        let response;
        if (hasAttachments) {
          // Mode multimodal (vision IA)
          type MAtt = { type: "image" | "video_frame"; base64: string; mimeType: string };
          const multimodalAttachments = attachments!.flatMap<MAtt>((att) => {
            if (att.type === "image") {
              return [{ type: "image" as const, base64: att.base64, mimeType: att.mimeType }];
            }
            try {
              const { frames } = JSON.parse(att.base64) as { thumbnail: string; frames: string[] };
              return frames.map<MAtt>((f) => ({ type: "video_frame" as const, base64: f, mimeType: "image/jpeg" }));
            } catch {
              return [];
            }
          });
          response = await sendMultimodalChat({ text, attachments: multimodalAttachments, mode });
        } else {
          // Mode texte classique
          response = await sendChat({ messages: historyForApi, mode, webSearch });
        }

        updateConversation(targetId, (c) => ({
          ...c,
          messages: [...c.messages, {
            id: response.id, role: "assistant", content: response.answer,
            mode: response.mode, usedWebSearch: response.usedWebSearch,
            sources: response.sources, createdAt: response.createdAt,
          }],
          updatedAt: new Date().toISOString(),
        }));
      } catch (error) {
        const msg = error instanceof ChatApiError ? error.message : "Une erreur inattendue est survenue.";
        updateConversation(targetId, (c) => ({
          ...c,
          messages: [...c.messages, { id: uid(), role: "assistant", content: "", error: msg, createdAt: new Date().toISOString() }],
          updatedAt: new Date().toISOString(),
        }));
      } finally {
        setIsBusy(false);
      }
    },
    [activeId, activeConversation, input, isBusy, settings, credits, updateConversation, user],
  );

  const handlePickSuggestion = useCallback(
    (prompt: string, opts: { web?: boolean; mode?: ChatMode }) => {
      const ns: AppSettings = {
        mode: opts.mode ?? settings.mode,
        webSearch: typeof opts.web === "boolean" ? opts.web : settings.webSearch,
      };
      setSettings(ns);
      void handleSend(prompt, ns);
    },
    [handleSend, settings.mode, settings.webSearch],
  );

  const handleRetryLast = useCallback(() => {
    const last = [...messages].reverse().find((m) => m.role === "user");
    if (last && !isBusy) void handleSend(last.content);
  }, [messages, isBusy, handleSend]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const showRetry = Boolean(lastAssistant?.error) && !isBusy;

  if (isAuthLoading) return null;
  
  if (window.location.pathname === "/admin") {
    return <AdminScreen />;
  }

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="relative flex h-screen overflow-hidden bg-slate-950 text-slate-100">

      {/* Fond ambiant (couleur change selon l'onglet) */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className={`absolute left-1/4 top-[-12rem] h-[36rem] w-[36rem] rounded-full bg-gradient-to-br ${NAV_GLOW[activeView]} to-transparent blur-[120px] transition-colors duration-700`} />
        <div className="absolute bottom-[-14rem] right-[-8rem] h-[34rem] w-[34rem] rounded-full bg-violet-600/8 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "linear-gradient(rgba(148,163,184,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,.5) 1px,transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
      </div>

      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={(id) => {
          setActiveId(id);
          setSettings((p) => ({ ...p, mode: conversations.find((c) => c.id === id)?.mode ?? p.mode }));
          setSidebarOpen(false);
        }}
        onNew={handleNewConversation}
        onDelete={handleDeleteConversation}
      />

      <div className="flex min-w-0 flex-1 flex-col">

        {/* ── Header ── */}
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide">{t("brand.name")}</h1>
              <p className="hidden text-[11px] text-slate-500 sm:block">
                {activeView === "chat"  && t("header.chat", { mode: settings.mode === "fun" ? t("mode.fun") : t("mode.regular") })}
                {activeView === "image" && t("header.image")}
                {activeView === "video" && t("header.video")}
                {activeView === "avatarStudio" && t("header.avatarStudio", "Studio Avatar · Création de présentateurs animés")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Navigation desktop */}
            <nav className="hidden rounded-full border border-white/10 bg-white/[0.03] p-1 sm:flex">
              {NAV_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeView === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveView(tab.id)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      isActive
                        ? NAV_ACCENT_ACTIVE[tab.id]
                        : "border-transparent text-slate-500 hover:text-slate-200"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t(tab.labelKey)}
                  </button>
                );
              })}
            </nav>

            <LanguageSelector />

            {user ? (
              <>
                {/* Bouton Crédits / Paiement */}
                <button
                  type="button"
                  onClick={() => setPaymentOpen(true)}
                  className="group flex items-center gap-2 rounded-full border border-cyan-400/30 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 px-3 py-1.5 transition hover:border-cyan-400/50 hover:from-cyan-500/15 hover:to-blue-500/15"
                  aria-label="Acheter des crédits"
                >
                  <Coins className="h-4 w-4 text-cyan-400 transition group-hover:text-cyan-300" />
                  <span className="text-xs font-semibold text-cyan-100">{credits?.credits ?? 0} {t("billing.credits")}</span>
                  <span className="ml-1 hidden text-[10px] font-medium text-cyan-300/80 sm:inline">+ Ajouter</span>
                </button>
                <button
                  type="button"
                  onClick={signOut}
                  className="ml-2 text-[10px] font-medium text-slate-500 hover:text-rose-400 transition"
                >
                  Déconnexion
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                className="rounded-full bg-gradient-to-r from-cyan-500 to-violet-600 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 hover:brightness-110 transition"
              >
                Connexion / S'inscrire
              </button>
            )}

            <ConnectionBadge status={backendStatus} />

            {showRetry && (
              <button
                type="button"
                onClick={handleRetryLast}
                className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300 transition hover:bg-amber-500/20"
              >
                <RotateCcw className="h-3 w-3" /> {t("chat.retry")}
              </button>
            )}
          </div>
        </header>

        {/* Navigation mobile */}
        <div className="border-b border-white/5 px-4 py-2 sm:hidden">
          <div className="grid grid-cols-3 rounded-full border border-white/10 bg-white/[0.03] p-1">
            {NAV_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveView(tab.id)}
                  className={`flex items-center justify-center gap-1 rounded-full py-1.5 text-[10px] font-medium transition ${
                    activeView === tab.id ? "bg-white/10 text-white" : "text-slate-500"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                {t(tab.shortKey)}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Main content ── */}
        <main ref={scrollRef} className="flex-1 overflow-y-auto">
          {activeView === "image" ? (
            <ImageService
              isLoggedIn={Boolean(user)}
              credits={credits?.credits ?? 0}
              onCreditsChanged={refreshCredits}
              onBuyCredits={() => setPaymentOpen(true)}
              onAuthRequired={() => setAuthOpen(true)}
            />
          ) : activeView === "video" ? (
            <VideoService
              isLoggedIn={Boolean(user)}
              credits={credits?.credits ?? 0}
              hasPurchased={credits?.hasPurchased ?? false}
              onCreditsChanged={refreshCredits}
              onBuyCredits={() => setPaymentOpen(true)}
              onAuthRequired={() => setAuthOpen(true)}
            />
          ) : activeView === "avatarStudio" ? (
            <AvatarStudio
              isLoggedIn={Boolean(user)}
              credits={credits?.credits ?? 0}
              onCreditsChanged={refreshCredits}
              onBuyCredits={() => setPaymentOpen(true)}
              onAuthRequired={() => setAuthOpen(true)}
            />
          ) : messages.length === 0 ? (
            <div className="flex min-h-full flex-col justify-center">
              <WelcomeScreen mode={settings.mode} onPick={handlePickSuggestion} />
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
              {messages.map((message) => (
                <Message
                  key={message.id}
                  message={message}
                  activeSource={activeSource}
                  onCitationClick={handleCitationClick}
                />
              ))}
              {isBusy && <TypingIndicator mode={settings.mode} />}
              <div ref={sentinelRef} />
            </div>
          )}
        </main>

        {/* ── Composer (chat uniquement) ── */}
        {activeView === "chat" && (
          <footer className="border-t border-white/5 px-4 pb-4 pt-3">
            <div className="mx-auto w-full max-w-3xl">
              <ChatComposer
                value={input}
                onChange={setInput}
                onSend={(attachments) => handleSend(undefined, undefined, attachments)}
                settings={settings}
                onSettingsChange={setSettings}
                isBusy={isBusy}
                autoFocus
                isLoggedIn={Boolean(user)}
                onAuthRequired={() => setAuthOpen(true)}
              />
              <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-600">
                <Info className="h-3 w-3" />
                {t("brand.disclaimer")}
              </p>
            </div>
          </footer>
        )}
      </div>

      {/* Notice hors ligne */}
      {backendStatus === "offline" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="pointer-events-none fixed bottom-24 left-1/2 z-20 -translate-x-1/2 px-4"
        >
          <div className="rounded-xl border border-rose-400/30 bg-rose-950/80 px-4 py-2 text-center text-xs text-rose-200 shadow-xl backdrop-blur">
            {t("offline", { command: "npm run server" })}
          </div>
        </motion.div>
      )}

      <PaymentModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        onSuccess={refreshCredits}
      />

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
      />
    </div>
  );
}
