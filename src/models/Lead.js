// backend/models/Lead.js
import mongoose from "mongoose";

const leadSchema = new mongoose.Schema(
  {
    twinId: { type: mongoose.Schema.Types.ObjectId, ref: "DigitalTwin", required: true },
    userEmail: { type: String, required: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    company: { type: String, required: true },
    message: { type: String, required: true },
    interest: { type: String }, // e.g., "Partnership inquiry"
    source: { type: String, default: "chat" },
    status: { type: String, enum: ["new", "contacted", "qualified", "closed"], default: "new" },
    qualified: { type: Boolean, default: false }, // Auto-set based on keywords
  },
  { timestamps: true }
);

// Pre-save hook for auto-qualification
leadSchema.pre("save", function (next) {
  const interestKeywords = ["partnership", "investment", "collaborate"];
  this.qualified = interestKeywords.some((kw) => this.message.toLowerCase().includes(kw));
  next();
});

export default mongoose.model("Lead", leadSchema);