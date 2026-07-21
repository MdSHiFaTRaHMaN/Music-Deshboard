import dbConnect from "./mongoose.js";
import Settings from "../models/Settings.js";

let cachedSettings = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 1000; // 1 minute cache

export function clearSettingsCache() {
  cachedSettings = null;
  cacheTime = 0;
}

/**
 * Fetches global platform settings from DB with a short in-memory cache.
 * Falls back to process.env values if DB settings are empty.
 */
export async function getSettings() {
  const now = Date.now();
  if (process.env.NODE_ENV !== "development" && cachedSettings && now - cacheTime < CACHE_TTL) {
    return cachedSettings;
  }

  await dbConnect();
  let settingsDoc = await Settings.findOne({});
  let settings = settingsDoc ? settingsDoc.toObject() : {};

  // Auto-refresh Shopify token if needed
  let token = settings.shopifyAdminApiKey || "";
  let tokenExpiresAt = settings.shopifyTokenExpiresAt || 0;

  if (settings.shopUrl1 && settings.shopifyClientId && settings.shopifySecretId) {
    if (!token || now > tokenExpiresAt - 60000) {
      try {
        let shopDomain = settings.shopUrl1;
        if (shopDomain.startsWith('http')) {
          shopDomain = new URL(shopDomain).hostname;
        }

        const response = await fetch(
          `https://${shopDomain}/admin/oauth/access_token`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'client_credentials',
              client_id: settings.shopifyClientId,
              client_secret: settings.shopifySecretId,
            }).toString(),
          }
        );

        if (response.ok) {
          const { access_token, expires_in } = await response.json();
          token = access_token;
          tokenExpiresAt = now + (expires_in * 1000);
          
          if (settingsDoc) {
             settingsDoc.shopifyAdminApiKey = token;
             settingsDoc.shopifyTokenExpiresAt = tokenExpiresAt;
             await settingsDoc.save();
          }
        } else {
          console.error(`Token request failed: ${response.status}`);
        }
      } catch (err) {
        console.error("Error fetching Shopify token:", err);
      }
    }
  }

  cachedSettings = {
    sunoApiKey: settings?.sunoApiKey || process.env.SUNO_API_KEY || "",
    sunoApiBase: process.env.SUNO_API_BASE || "",
    shopUrl1: settings?.shopUrl1 || "",
    shopUrl2: settings?.shopUrl2 || "",
    shopifyClientId: settings?.shopifyClientId || "",
    shopifySecretId: settings?.shopifySecretId || "",
    shopifyAdminApiKey: token,
    shopifyTokenExpiresAt: tokenExpiresAt,
    notificationEmail: settings?.notificationEmail || "",
    contactPhone: settings?.contactPhone || "",
    monthlyTarget: settings?.monthlyTarget || 20000,
    klaviyoApiKey: settings?.klaviyoApiKey || process.env.KLAVIYO_API_KEY || "",
    
    // Limits & Security
    previewDurationSeconds: settings?.previewDurationSeconds ?? 45,
    rateLimitPerMinute: settings?.rateLimitPerMinute ?? 0,
    rateLimitPerHour: settings?.rateLimitPerHour ?? 0,
    rateLimitPerDay: settings?.rateLimitPerDay ?? 10,
    rateLimitPerMonth: settings?.rateLimitPerMonth ?? 0,
    autoBlockEnabled: settings?.autoBlockEnabled ?? false,
    autoBlockGenerationCount: settings?.autoBlockGenerationCount ?? 5,
    autoBlockRequiredPurchases: settings?.autoBlockRequiredPurchases ?? 0,
  };
  cacheTime = now;

  return cachedSettings;
}
