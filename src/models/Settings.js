import mongoose from "mongoose";

const SettingsSchema = new mongoose.Schema(
  {
    shopifySecretId: { type: String, default: "" },
    shopifyClientId: { type: String, default: "" },
    shopUrl: { type: String, default: "" },
    sunoApiKey: { type: String, default: "" },
    notificationEmail: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
  },
  { timestamps: true }
);

const Settings = mongoose.models.Settings || mongoose.model("Settings", SettingsSchema);
export default Settings;
