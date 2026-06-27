import crypto from "node:crypto";
import { serverConfig } from "./config";
import { ApiError } from "./errors";

const LEMON_API_BASE = "https://api.lemonsqueezy.com/v1";

type LemonResource<T = Record<string, unknown>> = {
  id: string;
  type: string;
  attributes: T;
};

export type BillingProduct = {
  id: string;
  productId?: string;
  productName: string;
  variantName: string;
  priceFormatted: string;
  credits: number;
};

const requireLemonConfig = () => {
  if (!serverConfig.LEMON_SQUEEZY_API_KEY || !serverConfig.LEMON_SQUEEZY_STORE_ID) {
    throw new ApiError(
      "LEMON_NOT_CONFIGURED",
      "Lemon Squeezy n'est pas configuré. Ajoute LEMON_SQUEEZY_API_KEY et LEMON_SQUEEZY_STORE_ID dans .env.",
      503,
    );
  }
};

const lemonRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  requireLemonConfig();
  const response = await fetch(`${LEMON_API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${serverConfig.LEMON_SQUEEZY_API_KEY}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new ApiError("LEMON_API_ERROR", `Erreur Lemon Squeezy: ${details}`, 502);
  }

  return (await response.json()) as T;
};

export const parseCreditsFromText = (value: string | undefined): number => {
  const fallback = serverConfig.LEMON_CREDITS_FALLBACK;
  if (!value) return fallback;
  const match = value.match(/(\d+)\s*(?:credits?|crédits?|generations?|générations?)/i) || value.match(/(\d+)/);
  return match ? Number(match[1]) : fallback;
};

export const listBillingProducts = async (): Promise<BillingProduct[]> => {
  const productsResponse = await lemonRequest<{ data: LemonResource<{ name?: string }>[] }>(
    `/products?filter[store_id]=${encodeURIComponent(serverConfig.LEMON_SQUEEZY_STORE_ID)}`,
  );
  const variantsResponse = await lemonRequest<{ data: LemonResource<Record<string, unknown>>[] }>(
    `/variants?filter[store_id]=${encodeURIComponent(serverConfig.LEMON_SQUEEZY_STORE_ID)}`,
  );

  const productNames = new Map<string, string>();
  for (const product of productsResponse.data ?? []) {
    productNames.set(String(product.id), String(product.attributes.name ?? "Pack de crédits"));
  }

  return (variantsResponse.data ?? [])
    .filter((variant) => String(variant.attributes.status ?? "published") !== "draft")
    .map((variant) => {
      const productId = String(variant.attributes.product_id ?? "");
      const productName = productNames.get(productId) ?? String(variant.attributes.product_name ?? "Pack de crédits");
      const variantName = String(variant.attributes.name ?? "Pack");
      const priceFormatted = String(variant.attributes.price_formatted ?? variant.attributes.price ?? "");
      const credits = parseCreditsFromText(`${productName} ${variantName}`);

      return {
        id: String(variant.id),
        productId,
        productName,
        variantName,
        priceFormatted,
        credits,
      };
    });
};

export const createCheckout = async (input: {
  userId: string;
  variantId: string;
  credits: number;
}) => {
  const body = {
    data: {
      type: "checkouts",
      attributes: {
        product_options: {
          enabled_variants: [Number(input.variantId)],
          redirect_url: serverConfig.PUBLIC_APP_URL,
        },
        checkout_options: {
          embed: true,
          media: true,
          button_color: "#06b6d4",
        },
        checkout_data: {
          custom: {
            user_id: input.userId,
            credit_amount: String(input.credits),
            variant_id: input.variantId,
          },
        },
        test_mode: serverConfig.LEMON_TEST_MODE === "true",
      },
      relationships: {
        store: {
          data: { type: "stores", id: String(serverConfig.LEMON_SQUEEZY_STORE_ID) },
        },
        variant: {
          data: { type: "variants", id: String(input.variantId) },
        },
      },
    },
  };

  return lemonRequest<{ data: { id: string; attributes: { url: string } } }>("/checkouts", {
    method: "POST",
    body: JSON.stringify(body),
  });
};

export const verifyLemonSignature = (rawBody: Buffer, signature: string | undefined): boolean => {
  if (!serverConfig.LEMON_WEBHOOK_SECRET) return true;
  if (!signature) return false;

  const hmac = crypto.createHmac("sha256", serverConfig.LEMON_WEBHOOK_SECRET);
  const digest = Buffer.from(hmac.update(rawBody).digest("hex"), "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");

  return digest.length === signatureBuffer.length && crypto.timingSafeEqual(digest, signatureBuffer);
};
