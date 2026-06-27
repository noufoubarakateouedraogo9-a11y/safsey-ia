/**
 * SAFSEY IA — Backend
 * Routes strictement découplées :
 * - POST /api/generate-image : image_service (Fooocus / SD WebUI local)
 * - POST /api/generate-video : video_service (API Cloud externe)
 */
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import Groq from "groq-sdk";

import { providerStatus, serverConfig } from "./config";
import { ApiError, toPublicError } from "./errors";
import { createSpeech } from "./local/tts";
import { generateImageWithFooocus } from "./image_service/fooocus";
import { generateVideoWithCloud } from "./video_service/cloud";
import { applyWatermark } from "./video_service/watermark";
import { checkHeyGenVideoStatus, cloneVoiceLocal, generateAvatarVideoCloud, listHeyGenAvatars } from "./local/avatarStudioService";
import { addCreditsForOrder, consumeCredit, getMultimodalUsageToday, getOrCreateUserCredits, getPendingManualPayments, incrementMultimodalUsage, resolveManualPayment, submitManualPayment } from "./credits_db";
import { getCreditSecondsFromVariantId, VIDEO_SECOND_COSTS } from "./billing/pricingConfig";
import { createCheckout, listBillingProducts, parseCreditsFromText, verifyLemonSignature } from "./lemon";

const app = express();
const clientDistPath = path.resolve(process.cwd(), "dist");

import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // Max 10MB
});

// ── CORS : toujours autoriser en production same-domain, restreint sinon ──
if (serverConfig.CLIENT_ORIGIN) {
  app.use(cors({ origin: serverConfig.CLIENT_ORIGIN, credentials: true }));
} else {
  // En production same-domain et en dev local
  app.use(cors({ origin: "*" }));
}
app.use(express.json({
  limit: "50mb",
  verify: (req, _res, buf) => {
    (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
  },
}));
app.use(express.urlencoded({ extended: false }));

const getUserId = (req: Request): string => {
  const userId = req.header("x-safsey-user-id") || req.query.userId;
  if (!userId || typeof userId !== "string") {
    throw new ApiError("MISSING_USER_ID", "Identifiant utilisateur manquant.", 401);
  }
  return userId;
};

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "SAFSEY IA",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    pricing: {
      chat: "free",
      image: "30 sec-credits/image (3 free)",
      videoAvatar: "1 sec-credit/sec generated",
      multimodal: "10-30 sec-credits/analysis",
    },
    providers: providerStatus,
  });
});

// ──────────────────────────────────────────────────────────────
// CRÉDITS + BILLING
// ──────────────────────────────────────────────────────────────
app.get("/api/billing/credits", (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const user = getOrCreateUserCredits(userId);
    const multimodal = getMultimodalUsageToday(userId);
    res.json({
      userId: user.userId,
      credits: user.credits,
      hasPurchased: user.hasPurchased,
      freeCreditsGranted: user.freeCreditsGranted,
      multimodalToday: {
        used: multimodal.used,
        remaining: multimodal.remaining === Infinity ? null : multimodal.remaining,
        isLimited: multimodal.isLimited,
      },
      transactions: user.transactions.slice(-20),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/billing/products", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await listBillingProducts();
    res.json({ products });
  } catch (error) {
    next(error);
  }
});

app.post("/api/billing/checkout", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { variantId } = z.object({ variantId: z.string().min(1) }).parse(req.body);
    const products = await listBillingProducts();
    const product = products.find((item) => item.id === variantId);
    if (!product) throw new ApiError("VARIANT_NOT_FOUND", "Pack de crédits introuvable.", 404);

    const checkout = await createCheckout({ userId, variantId, credits: product.credits });
    res.json({ checkoutId: checkout.data.id, url: checkout.data.attributes.url });
  } catch (error) {
    next(error);
  }
});

app.post("/api/billing/manual-payment", (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { variantId, transactionId } = z.object({
      variantId: z.string().min(1),
      transactionId: z.string().min(1),
    }).parse(req.body);
    
    const payment = submitManualPayment(userId, variantId, transactionId);
    res.status(201).json(payment);
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/payments", (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = req.header("authorization") || "";
    const expected = `Bearer ${serverConfig.ADMIN_PASSWORD}`;
    if (auth !== expected) throw new ApiError("UNAUTHORIZED", "Accès refusé", 401);

    const pending = getPendingManualPayments();
    res.json({ pending });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/payments/:id/approve", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = req.header("authorization") || "";
    const expected = `Bearer ${serverConfig.ADMIN_PASSWORD}`;
    if (auth !== expected) throw new ApiError("UNAUTHORIZED", "Accès refusé", 401);

    const payment = resolveManualPayment(req.params.id, "approved");
    
    // Ajouter les crédits correspondants
    const products = await listBillingProducts();
    const product = products.find(p => p.id === payment.variantId);
    const credits = product?.credits || serverConfig.LEMON_CREDITS_FALLBACK;
    
    addCreditsForOrder(payment.userId, credits, payment.transactionId, "Validation manuelle Mobile Money");
    
    res.json({ success: true, payment });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/payments/:id/reject", (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = req.header("authorization") || "";
    const expected = `Bearer ${serverConfig.ADMIN_PASSWORD}`;
    if (auth !== expected) throw new ApiError("UNAUTHORIZED", "Accès refusé", 401);

    const payment = resolveManualPayment(req.params.id, "rejected");
    res.json({ success: true, payment });
  } catch (error) {
    next(error);
  }
});

app.post("/api/webhooks/lemon-squeezy", (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) throw new ApiError("MISSING_RAW_BODY", "Payload webhook invalide.", 400);

    const signature = req.header("x-signature") || undefined;
    if (!verifyLemonSignature(rawBody, signature)) {
      throw new ApiError("INVALID_LEMON_SIGNATURE", "Signature Lemon Squeezy invalide.", 401);
    }

    const payload = JSON.parse(rawBody.toString("utf-8")) as {
      meta?: { event_name?: string; custom_data?: Record<string, string> };
      data?: { id?: string; attributes?: Record<string, unknown> };
    };

    const eventName = payload.meta?.event_name;
    const orderId = String(payload.data?.id ?? "");
    const attrs = payload.data?.attributes ?? {};
    const status = String(attrs.status ?? "");

    if (eventName === "order_created" && status === "paid") {
      const custom = payload.meta?.custom_data ?? {};
      const userId = custom.user_id;
      if (!userId) throw new ApiError("MISSING_WEBHOOK_USER", "user_id absent du webhook.", 400);

      const firstItem = attrs.first_order_item as { variant_name?: string; product_name?: string; variant_id?: number } | undefined;
      const variantId = String(firstItem?.variant_id ?? custom.variant_id ?? "");

      // Priorité : mapping centralisé pricingConfig → fallback ancien système
      const creditSeconds = variantId
        ? getCreditSecondsFromVariantId(variantId)
        : Number(custom.credit_amount || 0)
          || parseCreditsFromText(`${firstItem?.product_name ?? ""} ${firstItem?.variant_name ?? ""}`);

      addCreditsForOrder(userId, creditSeconds, orderId, `Achat Lemon Squeezy (${firstItem?.variant_name ?? "pack"}) — ${Math.round(creditSeconds / 60)} min vidéo`);
    }

    res.json({ received: true });
  } catch (error) {
    next(error);
  }
});

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(8_000),
  })).min(1).max(30),
  mode: z.enum(["regular", "fun"]).default("regular"),
});

// ── Multimodal schema ──────────────────────────────────────────
const multimodalAttachmentSchema = z.object({
  type: z.enum(["image", "video_frame"]),
  base64: z.string().min(10), // data URL
  mimeType: z.string(),
});

const multimodalSchema = z.object({
  text: z.string().max(4_000).default(""),
  attachments: z.array(multimodalAttachmentSchema).min(1).max(12), // max 12 frames vidéo
  mode: z.enum(["regular", "fun"]).default("regular"),
});

import { analyzeWithVision } from "./multimodal";

app.post("/api/chat/multimodal", upload.none(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = multimodalSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(
        "INVALID_MULTIMODAL_REQUEST",
        "Payload multimodal invalide.",
        400,
        parsed.error.flatten(),
      );
    }

    const { text, attachments, mode } = parsed.data;

    // Identification utilisateur
    const userId = getUserId(req);
    const currentCredits = getOrCreateUserCredits(userId);
    const multimodalUsage = getMultimodalUsageToday(userId);

    // ── RÈGLE DE CONSOMMATION MULTIMODALE ───────────────────────
    // Abonnés (hasPurchased) : pas de limite quotidienne, débit en sec-crédits
    // Gratuits : 3 analyses gratuites/jour, puis blocage
    if (!currentCredits.hasPurchased && multimodalUsage.isLimited) {
      throw new ApiError(
        "DAILY_MULTIMODAL_LIMIT",
        "Vous avez atteint votre limite quotidienne de 3 analyses gratuites. Abonnez-vous à un pack pour continuer à analyser vos contenus sans restriction.",
        402,
      );
    }

    if (currentCredits.hasPurchased && currentCredits.credits <= 0) {
      throw new ApiError(
        "NO_CREDITS",
        "Vous avez épuisé vos crédits. Rechargez votre compte pour continuer à analyser vos contenus.",
        402,
      );
    }

    // Vérifications de taille de fichier (max 20MB total en base64)
    const totalSizeB = attachments.reduce((acc, att) => acc + att.base64.length * 0.75, 0);
    if (totalSizeB > 20 * 1024 * 1024) {
      throw new ApiError(
        "FILE_TOO_LARGE",
        "Les fichiers dépassent la limite de 20 MB. Réduisez la taille ou le nombre de frames.",
        413,
      );
    }

    const answer = await analyzeWithVision(text, attachments, mode);
    const resultId = randomUUID();

    // Calcul du coût selon le type de contenu analysé
    const hasVideoFrames = attachments.some((a) => a.type === "video_frame");
    const costSeconds = hasVideoFrames
      ? VIDEO_SECOND_COSTS.MULTIMODAL_VIDEO_ANALYSIS
      : VIDEO_SECOND_COSTS.MULTIMODAL_IMAGE_ANALYSIS;

    if (currentCredits.hasPurchased) {
      // Abonnés : débit en secondes-crédits
      consumeCredit(
        userId,
        `Analyse multimodale ${hasVideoFrames ? "vidéo" : "image"}`,
        resultId,
        costSeconds,
      );
    } else {
      // Gratuits : incrémenter le compteur quotidien (pas de débit sec-crédits)
      incrementMultimodalUsage(userId);
    }

    res.json({
      id: resultId,
      answer,
      mode,
      model: `vision/${(serverConfig.VISION_MODEL ?? "").split("/").pop()}`,
      usedWebSearch: false,
      usedVision: true,
      sources: [],
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/chat", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { messages, mode } = chatSchema.parse(req.body);
    const system = mode === "fun"
      ? "Tu es SAFSEY IA, un assistant polyglotte sarcastique et amusant. Tu es un assistant polyglotte. Réponds toujours dans la même langue que celle utilisée par l'utilisateur pour poser sa question. Sois drôle mais factuel."
      : "Tu es SAFSEY IA, un assistant polyglotte professionnel et précis. Tu es un assistant polyglotte. Réponds toujours dans la même langue que celle utilisée par l'utilisateur pour poser sa question.";

    const llmMessages = [
      { role: "system" as const, content: system },
      ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    let answer: string;
    if (serverConfig.GROQ_API_KEY) {
      const groq = new Groq({ apiKey: serverConfig.GROQ_API_KEY });
      const completion = await groq.chat.completions.create({
        model: serverConfig.GROQ_MODEL ?? "llama-3.3-70b-versatile",
        messages: llmMessages,
        temperature: mode === "fun" ? 0.8 : 0.3,
        max_completion_tokens: 1_400,
      });
      answer = completion.choices[0]?.message?.content ?? "Pas de réponse.";
    } else {
      const response = await fetch(`${serverConfig.OLLAMA_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: serverConfig.OLLAMA_MODEL, messages: llmMessages, stream: false }),
      });
      const data = (await response.json()) as { message?: { content?: string } };
      answer = data.message?.content ?? "Pas de réponse.";
    }

    res.json({
      id: randomUUID(),
      answer,
      mode,
      model: serverConfig.GROQ_API_KEY ? serverConfig.GROQ_MODEL : serverConfig.OLLAMA_MODEL,
      usedWebSearch: false,
      sources: [],
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/tts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text, language } = z.object({
      text: z.string().trim().min(1).max(5_000),
      language: z.string().default("fr"),
    }).parse(req.body);
    const result = await createSpeech(text, language);
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Cache-Control", "no-store");
    res.send(result.audio);
  } catch (error) {
    next(error);
  }
});

const imageSchema = z.object({
  prompt: z.string().trim().min(3).max(1_500),
  negativePrompt: z.string().trim().max(500).optional(),
  style: z.enum(["realistic", "anime_2d", "render_3d", "watercolor", "oil_painting", "pixel_art", "sketch"]),
  aspectRatio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]).default("1:1"),
  steps: z.number().int().min(10).max(60).default(30),
  cfgScale: z.number().min(1).max(20).default(7),
  complex: z.boolean().default(false),
});

app.post("/api/generate-image", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const currentCredits = getOrCreateUserCredits(userId);
    const parsed = imageSchema.parse(req.body);

    const costSeconds = parsed.complex
      ? VIDEO_SECOND_COSTS.IMAGE_GENERATION_COMPLEX  // 120 sec-crédits (4 crédits)
      : VIDEO_SECOND_COSTS.IMAGE_GENERATION;          // 60 sec-crédits (2 crédits)

    if (currentCredits.credits < costSeconds) {
      throw new ApiError(
        "NO_CREDITS",
        `Crédits insuffisants. Cette génération nécessite ${costSeconds / 30} crédits (vous avez ${Math.floor(currentCredits.credits / 30)} crédits). Rechargez votre compte.`,
        402,
      );
    }

    const result = await generateImageWithFooocus(parsed);
    consumeCredit(userId, `Génération image Fooocus (${parsed.complex ? "Complexe" : "Standard"})`, result.id, costSeconds);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

const videoSchema = z.object({
  prompt: z.string().trim().min(8).max(1_500),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  duration: z.union([z.literal(5), z.literal(10), z.literal(30), z.literal(60), z.literal(300)]).default(5),
});

app.post("/api/generate-video", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const currentCredits = getOrCreateUserCredits(userId);
    if (currentCredits.credits <= 0) {
      throw new ApiError(
        "NO_CREDITS",
        "Vous avez épuisé vos 3 essais gratuits. Achetez des crédits pour continuer à générer des vidéos et débloquer les durées supérieures.",
        402,
      );
    }

    const parsedVideo = videoSchema.parse(req.body);
    if (!currentCredits.hasPurchased && parsedVideo.duration !== 5) {
      throw new ApiError(
        "FREE_DURATION_LIMIT",
        "La version gratuite est limitée aux vidéos de 5 secondes. Achetez des crédits pour débloquer les durées supérieures.",
        403,
      );
    }

    const result = await generateVideoWithCloud(parsedVideo);
    
    // Si l'utilisateur n'a pas encore acheté de crédits (version gratuite d'essai), on applique le filigrane
    if (!currentCredits.hasPurchased && result.videoUrl) {
      try {
        console.log(`[Watermark] Application du filigrane SAFSEY IA pour l'utilisateur gratuit: ${userId}`);
        const watermarkedUrl = await applyWatermark(result.videoUrl);
        result.videoUrl = watermarkedUrl;
      } catch (err) {
        console.error("[Watermark] Échec de l'application du filigrane:", err);
      }
    }

    consumeCredit(userId, "Génération vidéo", result.id);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// ══════════════════════════════════════════════════════════════
// STUDIO AVATAR — ROUTES
// ══════════════════════════════════════════════════════════════

app.get("/api/avatar/list", (_req, res) => {
  res.json({ avatars: listHeyGenAvatars() });
});

app.post("/api/avatar/clone-voice", upload.single("audio"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new ApiError("MISSING_AUDIO", "Un échantillon audio de voix est requis pour le clonage.", 400);
    }
    const name = String(req.body.name || `User Voice ${randomUUID().slice(0, 4)}`);
    const result = await cloneVoiceLocal(name, req.file.buffer);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

const avatarVideoSchema = z.object({
  avatarId: z.string().min(1),
  text: z.string().min(1).max(2000),
  voiceId: z.string().default(""),
  audioUrl: z.string().url().optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  estimatedDurationSeconds: z.number().int().min(1).max(300).default(30),
  /** Mode chant Premium (×5 le coût normal) */
  singingMode: z.boolean().default(false),
});

app.post("/api/avatar/generate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const currentCredits = getOrCreateUserCredits(userId);
    const parsed = avatarVideoSchema.parse(req.body);

    // Calcul du coût : ×1 en mode parole, ×5 en mode chant
    const ratePerSecond = parsed.singingMode
      ? VIDEO_SECOND_COSTS.AVATAR_SINGING_PER_SECOND    // 5 sec-crédits/sec
      : VIDEO_SECOND_COSTS.AVATAR_VIDEO_PER_SECOND;     // 1 sec-crédit/sec
    const costSeconds = parsed.estimatedDurationSeconds * ratePerSecond;

    // Bloquer si le chant est demandé par un utilisateur gratuit
    if (parsed.singingMode && !currentCredits.hasPurchased) {
      throw new ApiError(
        "SINGING_PREMIUM_ONLY",
        "Le Mode Chant est une fonctionnalité Premium. Achetez le Pack Créateur ou Business pour y accéder.",
        403,
      );
    }

    if (currentCredits.credits < costSeconds) {
      throw new ApiError(
        "NO_CREDITS",
        `Crédits insuffisants. ${parsed.singingMode ? "🎤 Mode Chant Premium : " : ""}Cette vidéo nécessite ${costSeconds} sec-crédits (${Math.ceil(costSeconds / 60)} min) — vous en avez ${currentCredits.credits}. Rechargez votre compte.`,
        402,
      );
    }

    const result = await generateAvatarVideoCloud(parsed);

    // Débit
    consumeCredit(
      userId,
      `Studio Avatar ${parsed.singingMode ? "🎤 Chant" : "Parole"} — ${parsed.estimatedDurationSeconds}s`,
      result.id,
      costSeconds,
    );

    res.status(201).json({
      ...result,
      singingMode: parsed.singingMode,
      costSeconds,
      remainingSeconds: Math.max(0, currentCredits.credits - costSeconds),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/avatar/status/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await checkHeyGenVideoStatus(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

if (existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      res.sendFile(path.join(clientDistPath, "index.html"));
      return;
    }
    next();
  });
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[safsey-api]", error);
  const publicError = toPublicError(error);
  res.status(publicError.status).json(publicError.body);
});

const PORT = serverConfig.PORT;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║               SAFSEY IA — Backend démarré                   ║
║               http://localhost:${String(PORT).padEnd(28)}║
╠══════════════════════════════════════════════════════════════╣
║  POST /api/generate-image  image_service (Fooocus local)    ║
║  POST /api/generate-video  video_service (Cloud externe)    ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
