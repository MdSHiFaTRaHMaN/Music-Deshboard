import mongoose from "mongoose";

const CustomerSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    blockReason: {
      type: String,
      default: "",
    },
    blockedUntil: {
      type: Date,
      default: null,
    },
    blockCount: {
      type: Number,
      default: 0,
    },
    knownIps: {
      type: [String],
      default: [],
    },
    securityFlags: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const Customer = mongoose.models.Customer || mongoose.model("Customer", CustomerSchema);

export default Customer;
