    // backend/models/Lead.js
import mongoose from "mongoose";

const leadSchema = new mongoose.Schema(
  {
    twinId: { type: mongoose.Schema.Types.ObjectId, ref: "DigitalTwin", required: true },
    userEmail: { type: String, required: true },
    message: { type: String, required: true },
    source: { type: String, default: "chat" },
    status: { type: String, enum: ["new", "contacted", "qualified", "closed"], default: "new" },
  },
  { timestamps: true }
);

export default mongoose.model("Lead", leadSchema);