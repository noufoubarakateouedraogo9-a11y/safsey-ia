import { clientConfig } from "./config";
import type { BillingProduct, CreditsInfo } from "./types";

const USER_ID_KEY = "safsey.userId.v1";

declare global {
  interface Window {
    LemonSqueezy?: {
      Setup?: (options?: { eventHandler?: (event: { event: string; data?: unknown }) => void }) => void;
      Url?: { Open?: (url: string) => void; Close?: () => void };
    };
    createLemonSqueezy?: () => void;
  }
}

export const getSafseyUserId = (): string => {
  let existing = localStorage.getItem(USER_ID_KEY);
  if (!existing) {
    existing = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, existing);
  }
  return existing;
};

export const authHeaders = (userId: string): Record<string, string> => ({
  "x-safsey-user-id": userId,
});

export const fetchCredits = async (userId: string): Promise<CreditsInfo> => {
  const response = await fetch(`${clientConfig.apiUrl}/api/billing/credits`, {
    headers: authHeaders(userId),
  });
  if (!response.ok) throw new Error("Impossible de récupérer les crédits.");
  return (await response.json()) as CreditsInfo;
};

export const fetchBillingProducts = async (): Promise<BillingProduct[]> => {
  const response = await fetch(`${clientConfig.apiUrl}/api/billing/products`);
  if (!response.ok) throw new Error("Impossible de récupérer les packs Lemon Squeezy.");
  const payload = (await response.json()) as { products: BillingProduct[] };
  return payload.products;
};

export const createBillingCheckout = async (userId: string, variantId: string): Promise<{ checkoutId: string; url: string }> => {
  const response = await fetch(`${clientConfig.apiUrl}/api/billing/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(userId) },
    body: JSON.stringify({ variantId }),
  });
  if (!response.ok) throw new Error("Impossible de créer le checkout Lemon Squeezy.");
  return (await response.json()) as { checkoutId: string; url: string };
};

export const setupLemonSqueezy = (onSuccess?: () => void) => {
  window.createLemonSqueezy?.();
  window.LemonSqueezy?.Setup?.({
    eventHandler: (event) => {
      if (event.event === "Checkout.Success") {
        window.setTimeout(() => onSuccess?.(), 2_000);
      }
    },
  });
};

export const openLemonCheckout = (url: string, onSuccess?: () => void) => {
  setupLemonSqueezy(onSuccess);
  if (window.LemonSqueezy?.Url?.Open) {
    window.LemonSqueezy.Url.Open(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
};