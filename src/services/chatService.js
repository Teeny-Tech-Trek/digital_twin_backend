// backend/services/chatService.js
//
// Generates a chat reply from the user's digital twin profile. The model
// answers AS the twin, grounded ONLY in the data the twin owner provided.
//
// IMPORTANT: do NOT invent business experience, company names, year-counts,
// or accomplishments in the system prompt. The model will echo anything we
// put there as if it were the twin's lived experience — the previous version
// hardcoded "20+ years" and "TechCorp" and the model fabricated those into
// real replies.

import OpenAI from "openai";
import DigitalTwin from "../models/DigitalTwin.js";
import Message from "../models/Message.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Format a value, returning a placeholder when empty so the prompt stays grounded. */
const fmt = (value, fallback = "(not provided)") => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value.trim() || fallback;
  if (Array.isArray(value)) return value.length ? value.join(", ") : fallback;
  return String(value);
};

const formatBusinesses = (businesses = []) => {
  if (!businesses.length) return "(none provided)";
  return businesses
    .map((b) => {
      const parts = [b.name, b.role, b.description].filter(Boolean);
      return `- ${parts.join(" — ")}`;
    })
    .join("\n");
};

const formatExperience = (experience = []) => {
  if (!experience.length) return "(none provided)";
  return experience
    .map((e) => {
      const projects =
        e.key_projects && e.key_projects.length
          ? ` Projects: ${e.key_projects.join("; ")}.`
          : "";
      return `- ${e.role} at ${e.company} (${e.duration}).${projects}`;
    })
    .join("\n");
};

const formatEducation = (education = []) => {
  if (!education.length) return "(none provided)";
  return education
    .map((e) => `- ${e.degree}, ${e.institution} (${e.year})`)
    .join("\n");
};

const buildSystemPrompt = (twin) => {
  const identity = twin.identity || {};
  const skills = twin.skills || {};
  const personality = twin.personality || {};
  const story = twin.story || {};
  const networking = twin.networking || {};

  // Notice every block reads ONLY from the twin document. No hardcoded
  // experiences, durations, or example companies — those would leak into
  // the model's output as if they were the twin's actual history.
  return `You are the digital twin of ${fmt(identity.name, "this professional")}.
You answer as them, in first person, grounded ONLY in the profile below. Do not invent companies, roles, years of experience, projects, or credentials that aren't listed. If asked about something not in the profile, say you don't have that information handy and offer to follow up.

=== Identity ===
Name: ${fmt(identity.name)}
Role: ${fmt(identity.role)}
Tagline: ${fmt(identity.tagline)}
Bio: ${fmt(identity.bio)}

=== Businesses ===
${formatBusinesses(twin.businesses)}

=== Experience ===
${formatExperience(twin.experience)}

=== Education ===
${formatEducation(twin.education)}

=== Skills & Expertise ===
Skill list: ${fmt(skills.list)}
Core domains: ${fmt(skills.coreDomains)}
Signature strengths: ${fmt(skills.signatureStrengths)}

=== Personality ===
Tone: ${fmt(personality.tone)}
Traits: ${fmt(personality.traits)}
Leadership style: ${fmt(personality.leadership_style)}
Decision style: ${fmt(personality.decision_style)}
Archetype: ${fmt(personality.archetype)}
Values: ${fmt(personality.values)}

=== Story ===
Mission: ${fmt(story.mission)}
Impact: ${fmt(story.impact)}
Themes: ${fmt(story.themes)}

=== Networking preferences ===
Audience: ${fmt(networking.audience)}
Intent: ${fmt(networking.intent)}
Boundaries: ${fmt(networking.boundaries)}

=== Response guidelines ===
- First person, voice matches the Tone above (default to professional + warm if Tone is missing).
- Keep replies under ~150 words unless asked to elaborate.
- Use ONLY facts from the profile. Do not fabricate companies, durations, metrics, or stories.
- If a visitor expresses interest in partnership/contact/business, acknowledge and invite them to share their email so you (the human) can follow up.
- End with a short question that moves the conversation forward when natural — not on every message.`;
};

export const chatWithDigitalTwin = async (twinId, messages, userEmail) => {
  const twin = await DigitalTwin.findById(twinId);
  if (!twin) {
    const error = new Error("Digital twin not found");
    error.statusCode = 404;
    throw error;
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    const error = new Error("messages must be a non-empty array");
    error.statusCode = 400;
    throw error;
  }

  const systemPrompt = buildSystemPrompt(twin);

  const formattedMessages = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  // Tone heuristic: creative tones run hotter, analytical run cooler.
  const tone = (twin.personality?.tone || "").toLowerCase();
  const temperature =
    /creative|playful|energetic/.test(tone) ? 0.8 :
    /analytical|precise|formal/.test(tone) ? 0.4 : 0.6;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: formattedMessages,
      temperature,
      max_tokens: 350,
    });

    const aiReply = response.choices?.[0]?.message?.content || "";

    // Persist both turns for analytics + future history rehydration.
    const userMsg = messages[messages.length - 1];
    if (userMsg?.role && userMsg?.content) {
      await Message.create([
        { twinId, role: userMsg.role, content: userMsg.content },
        { twinId, role: "assistant", content: aiReply },
      ]);
    }

    return aiReply;
  } catch (error) {
    console.error("[CHAT] OpenAI API error:", error?.message || error);
    // Bubble up so the caller returns a real 5xx; don't mask with a fake
    // success that the user would mistake for a real twin reply.
    const wrapped = new Error("Chat service temporarily unavailable");
    wrapped.statusCode = 503;
    throw wrapped;
  }
};
