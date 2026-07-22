import mongoose from "mongoose";

const TrackSchema = new mongoose.Schema({
  id: String,
  title: String,
  audioUrl: String,
  streamAudioUrl: String,
  imageUrl: String,
  duration: Number,
  lyrics: String,
});

const OrderSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      index: true,
    },
    taskId: {
      type: String,
      required: true,
      index: true, // Used to match with Shopify later
    },
    musicId: {
      type: String,
      index: true,
      unique: true,
      sparse: true, // Public-facing opaque ID exposed in the cart line item.
      // Never expose taskId itself to the customer/browser — use this to
      // look up the real taskId server-side (e.g. for admin/support tools).
    },
    occasion: String,
    forWho: String,
    recipientName: String,
    genre: String,
    voice: String,
    mood: String,
    lyrics: String,
    musicTracks: [TrackSchema],
    selectedDemo: String, // ID of the track they favorited
    selectedPackage: String,
    orderNotes: String,
    shopifyProductId: {
      type: String,
      index: true, // The Shopify product this order/song was generated against
    },
    shopifyVariantId: String, // The variant added to the Shopify cart
    shopifyOrderId: {
      type: String,
      index: true, // To track and fulfill specific orders
    },
    deliveryEmailSent: {
      type: Boolean,
      default: false,
    },
    resumeEmailSent: {
      type: Boolean,
      default: false,
    },
    lastPolledAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      default: "created", // Initial state when generated but not added to cart
    },
    generationError: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// If the model already exists, use it, otherwise compile it
const Order = mongoose.models.Order || mongoose.model("Order", OrderSchema);

export default Order;