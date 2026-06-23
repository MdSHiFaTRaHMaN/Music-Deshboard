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
      index: true,
    },
    occasion: String,
    forWho: String,
    recipientName: String,
    genre: String,
    voice: String,
    mood: String,
    lyrics: String,
    musicTracks: [TrackSchema],
    selectedDemo: String,
    selectedPackage: String,
    orderNotes: String,
    shopifyProductId: {
      type: String,
      index: true,
    },
    shopifyVariantId: String,
    status: {
      type: String,
      default: "pending_payment",
    },
  },
  { timestamps: true }
);

// If the model already exists, use it, otherwise compile it
const Order = mongoose.models.Order || mongoose.model("Order", OrderSchema);

export default Order;