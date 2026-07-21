import mongoose from "mongoose";

const SettingsSchema = new mongoose.Schema(
  {
    shopifySecretId: { type: String, default: "" },
    shopifyClientId: { type: String, default: "" },
    shopifyAdminApiKey: { type: String, default: "" },
    shopifyTokenExpiresAt: { type: Number, default: 0 },
    shopUrl1: { type: String, default: "" },
    shopUrl2: { type: String, default: "" },
    sunoApiKey: { type: String, default: "" },
    notificationEmail: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    monthlyTarget: { type: Number, default: 20000 },
    klaviyoApiKey: { type: String, default: "" },
    
    // Limits & Security
    previewDurationSeconds: { type: Number, default: 45 },
    rateLimitPerMinute: { type: Number, default: 0 },
    rateLimitPerHour: { type: Number, default: 0 },
    rateLimitPerDay: { type: Number, default: 10 },
    rateLimitPerMonth: { type: Number, default: 0 },
    autoBlockEnabled: { type: Boolean, default: false },
    autoBlockGenerationCount: { type: Number, default: 5 },
    autoBlockRequiredPurchases: { type: Number, default: 0 },
  },
  { timestamps: true }
);

if (mongoose.models.Settings) {
  delete mongoose.models.Settings;
}

const Settings = mongoose.model("Settings", SettingsSchema);
export default Settings;
