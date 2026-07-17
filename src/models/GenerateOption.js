import mongoose from "mongoose";

const packageSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  price: { type: String, required: true },
  tagline: { type: String },
  features: [{ type: String }],
  image: { type: String },
  shopifyProductId: { type: String },
  shopifyVariantId: { type: String },
  compareAtPrice: { type: String }
});

const generateOptionSchema = new mongoose.Schema(
  {
    occasions: [{ type: String }],
    genres: [{ type: String }],
    voices: [{ type: String }],
    moods: [{ type: String }],
    languages: [{ type: String }],
    packages: [packageSchema]
  },
  { timestamps: true }
);

// We will only store one document for options.
const GenerateOption = mongoose.models.GenerateOption || mongoose.model("GenerateOption", generateOptionSchema);

export default GenerateOption;