// backend/models/Message.js
import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    twinId: { type: mongoose.Schema.Types.ObjectId, ref: "DigitalTwin", required: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Message", messageSchema);