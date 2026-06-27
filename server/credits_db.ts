import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type CreditTransaction = {
  id: string;
  type: "grant" | "consume" | "purchase";
  amount: number;
  reason: string;
  reference?: string;
  createdAt: string;
};

export type UserCredits = {
  userId: string;
  credits: number;
  freeCreditsGranted: boolean;
  hasPurchased: boolean;
  /** Compteur d'analyses multimodales gratuites : "YYYY-MM-DD:count" */
  dailyMultimodalUsage?: string;
  createdAt: string;
  updatedAt: string;
  transactions: CreditTransaction[];
};

export type PendingManualPayment = {
  id: string;
  userId: string;
  variantId: string;
  transactionId: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

type CreditsDatabase = {
  users: Record<string, UserCredits>;
  processedOrders: Record<string, true>;
  manualPayments: Record<string, PendingManualPayment>;
};

const DATA_DIR = process.env.SAFSEY_DATA_DIR || path.resolve(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "credits.json");

/**
 * Crédits offerts à l'inscription.
 * Unité : secondes-crédits  (1 sec = 1 sec de génération vidéo avatar)
 *
 *   90 sec  = 3 images gratuites (3 × 30 sec)
 *  180 sec  = 3 min de vidéo gratuite
 * ────────
 *  270 sec  total
 *
 * Valeur dupliquée ici volontairement pour éviter les dépendances circulaires ESM.
 * Si tu changes FREE_TRIAL_TOTAL_CREDITS dans pricingConfig.ts, mets aussi à jour
 * la valeur ci-dessous.
 */
const FREE_TRIAL_CREDITS = 270; // = (3 images × 30) + (3 min × 60)

const now = () => new Date().toISOString();

const ensureDb = () => {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DB_PATH)) {
    writeFileSync(DB_PATH, JSON.stringify({ users: {}, processedOrders: {}, manualPayments: {} }, null, 2));
  }
};

const readDb = (): CreditsDatabase => {
  ensureDb();
  const db = JSON.parse(readFileSync(DB_PATH, "utf-8"));
  if (!db.manualPayments) db.manualPayments = {};
  return db as CreditsDatabase;
};

const writeDb = (db: CreditsDatabase) => {
  ensureDb();
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
};

const createUser = (userId: string): UserCredits => ({
  userId,
  credits: FREE_TRIAL_CREDITS,
  freeCreditsGranted: true,
  hasPurchased: false,
  createdAt: now(),
  updatedAt: now(),
  transactions: [
    {
      id: randomUUID(),
      type: "grant",
      amount: FREE_TRIAL_CREDITS,
      reason: "Essais gratuits à l'inscription",
      createdAt: now(),
    },
  ],
});

export const getOrCreateUserCredits = (userId: string): UserCredits => {
  const db = readDb();
  if (!db.users[userId]) {
    db.users[userId] = createUser(userId);
    writeDb(db);
  }
  // Backward compatibility for older local .data/credits.json files.
  if (typeof db.users[userId].hasPurchased !== "boolean") {
    db.users[userId].hasPurchased = db.users[userId].transactions.some((tx) => tx.type === "purchase");
    writeDb(db);
  }
  return db.users[userId];
};

/**
 * Consomme un nombre variable de secondes-crédits (pour les fonctionnalités tarifées).
 * Remplace l'ancien consumeCredit qui débitait toujours 1 crédit fixe.
 * @param seconds  Secondes-crédits à déduire (par défaut : 1)
 */
export const consumeCredit = (
  userId: string,
  reason: string,
  reference?: string,
  seconds = 1,
): UserCredits => {
  const db = readDb();
  const user = db.users[userId] ?? createUser(userId);

  if (user.credits <= 0) {
    throw Object.assign(new Error("Crédits épuisés"), { code: "NO_CREDITS" });
  }

  const actualDebit = Math.min(seconds, user.credits); // ne jamais passer en négatif
  user.credits -= actualDebit;
  user.updatedAt = now();
  user.transactions.push({
    id: randomUUID(),
    type: "consume",
    amount: -actualDebit,
    reason,
    reference,
    createdAt: now(),
  });

  db.users[userId] = user;
  writeDb(db);
  return user;
};

export const addCreditsForOrder = (
  userId: string,
  creditsToAdd: number,
  orderId: string,
  reason: string,
): UserCredits => {
  const db = readDb();
  const user = db.users[userId] ?? createUser(userId);

  if (db.processedOrders[orderId]) {
    return user;
  }

  user.credits += creditsToAdd;
  user.hasPurchased = true;
  user.updatedAt = now();
  user.transactions.push({
    id: randomUUID(),
    type: "purchase",
    amount: creditsToAdd,
    reason,
    reference: orderId,
    createdAt: now(),
  });

  db.users[userId] = user;
  db.processedOrders[orderId] = true;
  writeDb(db);
  return user;
};

export const submitManualPayment = (userId: string, variantId: string, transactionId: string): PendingManualPayment => {
  const db = readDb();
  const id = randomUUID();
  const payment: PendingManualPayment = {
    id,
    userId,
    variantId,
    transactionId,
    status: "pending",
    createdAt: now(),
  };
  db.manualPayments[id] = payment;
  writeDb(db);
  return payment;
};

export const getPendingManualPayments = (): PendingManualPayment[] => {
  const db = readDb();
  return Object.values(db.manualPayments).filter((p) => p.status === "pending");
};

export const resolveManualPayment = (paymentId: string, status: "approved" | "rejected"): PendingManualPayment => {
  const db = readDb();
  const payment = db.manualPayments[paymentId];
  if (!payment) throw new Error("Paiement introuvable");
  payment.status = status;
  writeDb(db);
  return payment;
};

// ════════════════════════════════════════════════════════════════
// LIMITE QUOTIDIENNE MULTIMODALE (3 analyses gratuites/jour)
// ════════════════════════════════════════════════════════════════

const MAX_FREE_MULTIMODAL_PER_DAY = 3;

const todayKey = (): string => new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

/**
 * Retourne le nombre d'analyses multimodales gratuites restantes aujourd'hui.
 * Les abonnés (hasPurchased) ne sont pas limités → retourne Infinity.
 */
export const getMultimodalUsageToday = (userId: string): { used: number; remaining: number; isLimited: boolean } => {
  const user = getOrCreateUserCredits(userId);

  // Les abonnés n'ont pas de limite quotidienne
  if (user.hasPurchased) {
    return { used: 0, remaining: Infinity, isLimited: false };
  }

  const today = todayKey();
  const stored = user.dailyMultimodalUsage ?? "";
  const [dateStr, countStr] = stored.split(":");
  const used = dateStr === today ? Number(countStr || 0) : 0;
  const remaining = Math.max(0, MAX_FREE_MULTIMODAL_PER_DAY - used);

  return { used, remaining, isLimited: remaining <= 0 };
};

/**
 * Incrémente le compteur d'analyses multimodales gratuites du jour.
 * Ne fait rien pour les abonnés.
 */
export const incrementMultimodalUsage = (userId: string): void => {
  const db = readDb();
  const user = db.users[userId];
  if (!user || user.hasPurchased) return;

  const today = todayKey();
  const stored = user.dailyMultimodalUsage ?? "";
  const [dateStr, countStr] = stored.split(":");
  const currentCount = dateStr === today ? Number(countStr || 0) : 0;

  user.dailyMultimodalUsage = `${today}:${currentCount + 1}`;
  user.updatedAt = now();
  writeDb(db);
};
