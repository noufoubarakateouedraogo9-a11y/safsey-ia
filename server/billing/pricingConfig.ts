/**
 * ═══════════════════════════════════════════════════════════════
 * SAFSEY IA — Configuration centralisée des tarifs
 * ═══════════════════════════════════════════════════════════════
 *
 * SYSTÈME DE CRÉDITS VIDÉO (comme HeyGen & Hedra)
 * ─────────────────────────────────────────────────────────────
 * L'unité de crédit est la SECONDE DE GÉNÉRATION VIDÉO AVATAR.
 *
 *   Exemple :
 *     → Pack Essentiel   = 300 secondes = 5 min de vidéo  (19 €)
 *     → Pack Créateur    = 900 secondes = 15 min de vidéo (49 €)
 *     → Pack Business    = 2400 secondes = 40 min de vidéo (99 €)
 *
 * Pour toute fonctionnalité hors Studio Avatar (images, chat, analyse),
 * le coût est exprimé en secondes équivalentes (voir VIDEO_SECOND_COSTS).
 *
 * ⚠️ MODIFIER CE FICHIER SEULEMENT pour ajuster les prix ou les volumes.
 * ─────────────────────────────────────────────────────────────
 * IMPORTANT : Les IDs de variantes Lemon Squeezy doivent correspondre
 * aux vrais IDs de ton dashboard avant de déployer.
 */

import type { PlanTier } from "./plans";

// ────────────────────────────────────────────────────────────────
// CONSTANTE CENTRALE : 1 crédit = 1 seconde de vidéo avatar
// ────────────────────────────────────────────────────────────────
export const SECONDS_PER_CREDIT = 1;

// ────────────────────────────────────────────────────────────────
// ESSAI GRATUIT  (⚠ Si tu changes ces valeurs, mets à jour aussi
//                    FREE_TRIAL_CREDITS dans server/credits_db.ts)
// ────────────────────────────────────────────────────────────────
export const FREE_TRIAL_IMAGE_CREDITS   = 3;           // 3 images gratuites
export const FREE_TRIAL_IMAGE_COST_SECS = 30;          // chaque image = 30 sec-crédits
export const FREE_TRIAL_VIDEO_SECONDS   = 3 * 60;      // 3 min de vidéo avatar = 180 sec
export const FREE_TRIAL_TOTAL_CREDITS =
  FREE_TRIAL_IMAGE_CREDITS * FREE_TRIAL_IMAGE_COST_SECS + FREE_TRIAL_VIDEO_SECONDS;
// = 90 + 180 = 270 secondes-crédits

// ────────────────────────────────────────────────────────────────
// COÛT PAR FONCTIONNALITÉ (en secondes-crédit)
// ────────────────────────────────────────────────────────────────
export const VIDEO_SECOND_COSTS = {
  /** Génération d'image Fooocus / SD WebUI standard : 2 crédits (= 60s) */
  IMAGE_GENERATION: 60,            // 60 sec-crédits = 2 crédits image

  /** Génération d'image Fooocus / SD WebUI complexe : 4 crédits (= 120s) */
  IMAGE_GENERATION_COMPLEX: 120,    // 120 sec-crédits = 4 crédits image

  /** Analyse multimodale d'une photo jointe au chat */
  MULTIMODAL_IMAGE_ANALYSIS: 10,   // 10 sec-crédits = 1 analyse image

  /** Analyse multimodale d'une vidéo jointe au chat (par frame) */
  MULTIMODAL_VIDEO_ANALYSIS: 30,   // 30 sec-crédits = 1 analyse vidéo

  /** Génération vidéo standard (non-avatar) */
  VIDEO_STANDARD_PER_SECOND: 1,    // 1 sec-crédit par seconde générée

  /** Studio Avatar Parole : 1 sec de vidéo générée = 1 sec-crédit */
  AVATAR_VIDEO_PER_SECOND: 1,      // ratio direct 1:1

  /** Studio Avatar Chant IA (Premium) : 1 sec = 5 sec-crédits */
  AVATAR_SINGING_PER_SECOND: 5,    // ×5 le coût normal

  /** Chat IA texte seul */
  CHAT_TEXT: 0,                    // GRATUIT
} as const;

// ────────────────────────────────────────────────────────────────
// 1. PACKS DE MINUTES VIDÉO (achats ponctuels) — nouvelles valeurs
// ────────────────────────────────────────────────────────────────

export interface VideoMinutePack {
  /** ID de la variante Lemon Squeezy (à remplacer par les vrais IDs) */
  lemonVariantId: string;
  /** Nom affiché à l'utilisateur */
  name: string;
  /** Prix en euros */
  price: number;
  /** Durée totale de vidéo incluse, en MINUTES (pour l'affichage) */
  videoMinutes: number;
  /** Équivalent en secondes-crédits (= videoMinutes × 60) */
  creditSeconds: number;
  /** Badge visuel */
  badge?: "popular" | "best_value";
}

/**
 * Taux de conversion EUR → FCFA (Franc CFA XOF)
 * Taux fixe officiel : 1 EUR = 655,957 FCFA
 * Arrondi à 656 pour simplifier.
 */
export const EUR_TO_FCFA = 656;

/** Convertit un prix en EUR vers FCFA arrondi au millier supérieur */
export const eurToFcfa = (eur: number): number => Math.ceil((eur * EUR_TO_FCFA) / 1000) * 1000;

/** Formate un montant FCFA (ex: 12500 → "12 500 FCFA") */
export const formatFcfa = (fcfa: number): string =>
  `${fcfa.toLocaleString("fr-FR")} FCFA`;

export const VIDEO_MINUTE_PACKS: VideoMinutePack[] = [
  {
    lemonVariantId: "var_pack_essential",  // ← Remplace par ton vrai ID LS
    name: "Pack Essentiel",
    price: 19,                            // 19 €
    videoMinutes: 3,                      // 3 min de vidéo parlée
    creditSeconds: 3 * 60,                // 180 sec-crédits
    // Équivalent chant : 180 / 5 = 36 sec = ~0,5 min de chant
  },
  {
    lemonVariantId: "var_pack_creator",    // ← Remplace par ton vrai ID LS
    name: "Pack Créateur",
    price: 39,                            // 39 €
    videoMinutes: 8,                      // 8 min de vidéo parlée
    creditSeconds: 8 * 60,                // 480 sec-crédits
    badge: "popular",
    // Équivalent chant : 480 / 5 = 96 sec = ~1,5 min de chant
  },
  {
    lemonVariantId: "var_pack_business",   // ← Remplace par ton vrai ID LS
    name: "Pack Business",
    price: 79,                            // 79 €
    videoMinutes: 20,                     // 20 min de vidéo parlée
    creditSeconds: 20 * 60,               // 1200 sec-crédits
    badge: "best_value",
    // Équivalent chant : 1200 / 5 = 240 sec = 4 min de chant
  },
];

// ────────────────────────────────────────────────────────────────
// 2. FORFAITS D'ABONNEMENT (mensuels, fonctionnalités avancées)
// ────────────────────────────────────────────────────────────────

export interface SubscriptionPlan {
  id: PlanTier;
  name: string;
  lemonVariantId: string;
  priceMonthly: number;
  /** Crédits-secondes attribués chaque mois */
  creditSecondsPerMonth: number;
  /** Pour rétro-compat avec l'ancien champ `creditsPerMonth` */
  creditsPerMonth: number;
  maxVideoDuration: number;
  maxConcurrentJobs: number;
  watermark: boolean;
  hdDownload: boolean;
  queuePriority: "low" | "normal" | "high";
  maxVariants: number;
  customWatermark: boolean;
}

export const SUBSCRIPTION_PLANS: Record<PlanTier, SubscriptionPlan> = {
  free: {
    id: "free",
    name: "Gratuit",
    lemonVariantId: "",
    priceMonthly: 0,
    creditSecondsPerMonth: FREE_TRIAL_TOTAL_CREDITS,
    creditsPerMonth: FREE_TRIAL_TOTAL_CREDITS,
    maxVideoDuration: 30,
    maxConcurrentJobs: 1,
    watermark: true,
    hdDownload: false,
    queuePriority: "low",
    maxVariants: 1,
    customWatermark: false,
  },

  creator: {
    id: "creator",
    name: "Créateur",
    lemonVariantId: "var_creator_monthly", // ← Remplace par ton vrai ID LS
    priceMonthly: 39,
    creditSecondsPerMonth: 8 * 60,         // 480 sec = 8 min/mois
    creditsPerMonth: 8 * 60,
    maxVideoDuration: 120,
    maxConcurrentJobs: 3,
    watermark: false,
    hdDownload: true,
    queuePriority: "normal",
    maxVariants: 2,
    customWatermark: false,
  },

  agency: {
    id: "agency",
    name: "Business",
    lemonVariantId: "var_business_monthly", // ← Remplace par ton vrai ID LS
    priceMonthly: 79,
    creditSecondsPerMonth: 20 * 60,          // 1200 sec = 20 min/mois
    creditsPerMonth: 20 * 60,
    maxVideoDuration: 300,
    maxConcurrentJobs: 10,
    watermark: false,
    hdDownload: true,
    queuePriority: "high",
    maxVariants: 5,
    customWatermark: true,
  },
};

// ────────────────────────────────────────────────────────────────
// 3. MAPPING VARIANT_ID → SECONDES-CRÉDITS (pour le webhook)
// ────────────────────────────────────────────────────────────────

/**
 * Quand Lemon Squeezy confirme un achat, ce mapping indique combien
 * de secondes-crédits vidéo attribuer à l'utilisateur.
 *
 * Clés = IDs de variantes Lemon Squeezy → à remplacer par tes vrais IDs.
 */
export const LEMON_VARIANT_CREDIT_SECONDS_MAP: Record<string, number> = {
  // Packs minutes vidéo (nouvelles valeurs)
  "var_pack_essential": 3 * 60,    // 180 sec = 3 min parole / ~0,5 min chant
  "var_pack_creator":   8 * 60,    // 480 sec = 8 min parole / ~1,5 min chant
  "var_pack_business":  20 * 60,   // 1200 sec = 20 min parole / 4 min chant

  // Abonnements mensuels (mêmes valeurs)
  "var_creator_monthly":  8 * 60,
  "var_business_monthly": 20 * 60,
};

// ────────────────────────────────────────────────────────────────
// 4. FONCTIONS UTILITAIRES
// ────────────────────────────────────────────────────────────────

/** Convertit des secondes-crédits en une chaîne lisible (ex: "15 min 30 s") */
export const formatCreditSeconds = (totalSeconds: number): string => {
  if (totalSeconds <= 0) return "0 s";
  const min = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  if (min === 0) return `${sec} s`;
  if (sec === 0) return `${min} min`;
  return `${min} min ${sec} s`;
};

/** Convertit des secondes en minutes arrondies (pour l'affichage utilisateur) */
export const secondsToMinutesDisplay = (seconds: number): string => {
  const min = seconds / 60;
  if (Number.isInteger(min)) return `${min} min`;
  return `${min.toFixed(1)} min`;
};

/** Retourne les secondes-crédits à attribuer pour un variant Lemon Squeezy */
export const getCreditSecondsFromVariantId = (variantId: string): number => {
  return LEMON_VARIANT_CREDIT_SECONDS_MAP[variantId] ?? 0;
};

/** Retourne le plan d'un utilisateur à partir de son ID de variante LS */
export const getPlanFromVariantId = (variantId: string): PlanTier | null => {
  const entry = Object.entries(SUBSCRIPTION_PLANS).find(
    ([, plan]) => plan.lemonVariantId === variantId
  );
  return entry ? (entry[0] as PlanTier) : null;
};

/** Retourne le plan par défaut (Gratuit) */
export const getDefaultPlan = (): SubscriptionPlan => SUBSCRIPTION_PLANS.free;

/** Vérifie si un variant ID correspond à un pack de minutes (non à un abonnement) */
export const isVideoMinutePack = (variantId: string): boolean =>
  VIDEO_MINUTE_PACKS.some((p) => p.lemonVariantId === variantId);

/** Retourne un pack par son variant ID */
export const getPackByVariantId = (variantId: string): VideoMinutePack | null =>
  VIDEO_MINUTE_PACKS.find((p) => p.lemonVariantId === variantId) ?? null;
