import mongoose from "mongoose";

const businessSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, required: true },
  description: { type: String, required: true },
  link: { type: String, default: "" },
  products: [{ type: String }],
  duration: { type: String, default: "" },
});

const experienceSchema = new mongoose.Schema({
  company: { type: String, required: true },
  role: { type: String, required: true },
  duration: { type: String, required: true },
  key_projects: [{ type: String }],
});

const educationSchema = new mongoose.Schema({
  institution: { type: String, required: true },
  degree: { type: String, required: true },
  year: { type: String, required: true },
});

const skillsSchema = new mongoose.Schema({
  list: [{ type: String }], // e.g. ["AI Strategy", "Systems Thinking"]
  coreDomains: { type: String, default: "" }, // textarea from frontend
  signatureStrengths: { type: String, default: "" }, // textarea from frontend
});

const personalitySchema = new mongoose.Schema({
  traits: [{ type: String }],
  leadership_style: { type: String, default: "" },
  decision_style: { type: String, default: "" },
  tone: { type: String, default: "" },
  archetype: { type: String, default: "" },
  values: [{ type: String }],
});

const storySchema = new mongoose.Schema({
  mission: { type: String, default: "" },
  impact: { type: String, default: "" },
  themes: [{ type: String }],
});

const networkingSchema = new mongoose.Schema({
  audience: { type: String, default: "" },
  intent: { type: String, default: "" },
  boundaries: [{ type: String }],
});

const linksSchema = new mongoose.Schema({
  linkedin: { type: String, default: "" },
  website: { type: String, default: "" },
  portfolio: { type: String, default: "" },
  socials: [{ type: String }],
});

const digitalTwinSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    identity: {
      name: { type: String, required: true },
      role: { type: String, required: true },
      tagline: { type: String, default: "" },
      bio: { type: String, required: true },
    },
    businesses: [businessSchema],
    experience: [experienceSchema],
    education: [educationSchema],
    skills: skillsSchema,
    personality: personalitySchema,
    story: storySchema,
    networking: networkingSchema,
    links: linksSchema,
    isActive: { type: Boolean, default: true },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

digitalTwinSchema.index({ user: 1 });
digitalTwinSchema.index({ "identity.name": "text", "identity.role": "text" });

export default mongoose.model("DigitalTwin", digitalTwinSchema);
