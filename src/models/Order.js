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
    status: {
      type: String,
      default: "pending_payment", // Initial state
    },
  },
  { timestamps: true }
);

// If the model already exists, use it, otherwise compile it
const Order = mongoose.models.Order || mongoose.model("Order", OrderSchema);

export default Order;
