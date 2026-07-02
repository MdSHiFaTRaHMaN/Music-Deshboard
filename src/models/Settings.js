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
  },
  { timestamps: true }
);

if (mongoose.models.Settings) {
  delete mongoose.models.Settings;
}

const Settings = mongoose.model("Settings", SettingsSchema);
export default Settings;
