// ============================================================
// SAFSEY IA — Types partagés frontend
// ============================================================

// ── Chat ────────────────────────────────────────────────────
export type ChatMode = "regular" | "fun";

export type SearchSource = {
  id: number;
  title: string;
  url: string;
  content: string;
  score?: number;
  publishedDate?: string;
};

export type ChatRole = "user" | "assistant";

// Pièce jointe dans un message (image ou vidéo)
export type AttachmentType = "image" | "video";

export type MessageAttachment = {
  id: string;
  type: AttachmentType;
  name: string;
  mimeType: string;
  base64: string;        // Data URL complet (data:image/png;base64,…)
  thumbnailUrl?: string; // Pour vidéo: première frame extraite côté client
  sizeKb: number;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  attachments?: MessageAttachment[];
  mode?: ChatMode;
  usedWebSearch?: boolean;
  sources?: SearchSource[];
  error?: string;
  model?: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  mode: ChatMode;
  createdAt: string;
  updatedAt: string;
};

export type ChatApiResponse = {
  id: string;
  answer: string;
  mode: ChatMode;
  model: string;
  usedWebSearch: boolean;
  sources: SearchSource[];
  createdAt: string;
};

export type BackendStatus = "checking" | "online" | "offline";

export type AppSettings = {
  mode: ChatMode;
  webSearch: boolean;
};

// ── Générateur d'Images Fooocus (image_service) ─────────────
export type ImageStyle =
  | "realistic"
  | "anime_2d"
  | "render_3d"
  | "watercolor"
  | "oil_painting"
  | "pixel_art"
  | "sketch";

export type ImageAspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

export type ImageRequest = {
  prompt: string;
  negativePrompt?: string;
  style: ImageStyle;
  aspectRatio: ImageAspectRatio;
  steps: number;
  cfgScale: number;
  complex?: boolean;
};

export type ImageResult = {
  id: string;
  imageUrl: string;   // data:image/png;base64,…
  base64: string;
  prompt: string;
  seed: number;
  model: string;
  generatedAt: string;
};

// ── Générateur de Vidéo Cloud (video_service) ───────────────
export type VideoAspectRatio = "16:9" | "9:16" | "1:1";

export type VideoRequest = {
  prompt: string;
  aspectRatio: VideoAspectRatio;
  duration: 5 | 10 | 30 | 60 | 300;
};

export type VideoResult = {
  id: string;
  jobId: string;
  videoUrl: string;
  prompt: string;
  aspectRatio: VideoAspectRatio;
  duration: number;
  generatedAt: string;
};

// ── Crédits & Billing ────────────────────────────────────────
export type CreditTransaction = {
  id: string;
  type: "grant" | "consume" | "purchase";
  /** Valeur en secondes-crédits (positif = gain, négatif = dépense) */
  amount: number;
  reason: string;
  reference?: string;
  createdAt: string;
};

export type CreditsInfo = {
  userId: string;
  /** Solde courant en secondes-crédits */
  credits: number;
  hasPurchased: boolean;
  freeCreditsGranted: boolean;
  /** Compteur quotidien multimodal (3 analyses gratuites/jour pour les non-abonnés) */
  multimodalToday?: {
    used: number;
    remaining: number | null; // null = illimité (abonnés)
    isLimited: boolean;
  };
  transactions: CreditTransaction[];
};

export type BillingProduct = {
  id: string;
  productId?: string;
  productName: string;
  variantName: string;
  priceFormatted: string;
  credits: number;
};
