// backend/services/chatService.js
//
// Generates a chat reply for the public twin chatbot.
//
// PRIMARY PATH: the AI backend (portfolio-chatbot-backend) runs the
// hybrid-RAG pipeline — vector retrieval over the twin's resume + website
// + structured profile, plus Neo4j knowledge graph, plus a deterministic
// profile slot-filler for fact questions (name/phone/email/...). The AI
// backend owns prompting; we just forward the query and get an answer.
//
// FALLBACK PATH: if the AI backend is unreachable, we degrade to the
// old OpenAI-direct call so the chatbot doesn't go fully dark during an
// AI-backend deploy or outage. The fallback uses ONLY the Mongo twin
// document (no retrieval over resume/website) so it's strictly less
// capable but still answers grounded in the structured profile.

import OpenAI from "openai";
import DigitalTwin from "../models/DigitalTwin.js";
import Message from "../models/Message.js";
import aiEngine from "./aiEngineClient.js";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const persistTurn = async (twinId, userMessage, assistantReply) => {
  if (userMessage?.role && userMessage?.content) {
    try {
      await Message.create([
        { twinId, role: userMessage.role, content: userMessage.content },
        { twinId, role: "assistant", content: assistantReply },
      ]);
    } catch (err) {
      console.warn(`[chat] message persist failed for twin=${twinId}:`, err.message);
    }
  }
};

// ----------------------------------------------------------------------
// Primary path: AI backend hybrid RAG.
// ----------------------------------------------------------------------
// Patterns the AI engine emits when its RAG pipeline can't produce a
// grounded answer. We treat these as soft failures and degrade to the
// OpenAI profile-grounded fallback so visitors get a contextual reply
// instead of a "contact me directly" template — important for demos
// where the AI engine may have weak retrieval for a brand-new twin.
const AI_ENGINE_FALLBACK_FRAGMENTS = [
  "I attempted to generate a response but want to ensure accuracy",
  "Rather than risk providing incorrect information",
  "I don't have enough relevant information about this topic",
  "I don't have specific information about that in my portfolio",
  "I want to make sure I provide you with accurate information",
  "I'm most knowledgeable about:",
];

const looksLikeAiEngineFallback = (reply) => {
  if (!reply || typeof reply !== "string") return true;
  const lower = reply.toLowerCase();
  return AI_ENGINE_FALLBACK_FRAGMENTS.some((frag) =>
    lower.includes(frag.toLowerCase()),
  );
};

const replyViaAiEngine = async ({ twinId, messages, userEmail, sessionId }) => {
  // Prefer the caller-supplied sessionId (persisted on the frontend, keyed
  // per twin). Falling back to a derived id keeps backwards compatibility
  // with callers that don't pass one, but the caller-supplied path is what
  // keeps conversation memory continuous across turns for the visitor.
  const resolvedSessionId =
    sessionId ||
    messages.find((m) => m.sessionId)?.sessionId ||
    `twin-${twinId}-${userEmail || "anon"}`;
  const result = await aiEngine.chat({
    twinId,
    messages,
    sessionId: resolvedSessionId,
    userId: userEmail || "anonymous",
    userEmail,
  });
  if (!result.ok) {
    return null; // signal caller to try fallback
  }
  // Demo-friendly soft-fail: if the AI engine returned its generic
  // "I don't have that info" template OR its raw response flags
  // fallback_triggered=true, treat as a miss so we can degrade to the
  // OpenAI profile-grounded reply. Visitors get a real contextual answer
  // instead of a dead-end refusal.
  const fallbackFlag = result.raw?.fallback_triggered === true;
  if (fallbackFlag || looksLikeAiEngineFallback(result.reply)) {
    console.warn(
      `[chat] AI engine returned fallback for twin=${twinId} (flag=${fallbackFlag}); degrading to OpenAI profile fallback`,
    );
    return null;
  }
  return result.reply;
};

// ----------------------------------------------------------------------
// Fallback path: OpenAI directly with the Mongo profile.
// Same prompt as the legacy implementation — kept intentionally close so
// the fallback behaviour matches what users saw before AI-backend
// integration shipped.
// ----------------------------------------------------------------------
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

  return `You are the digital twin of ${fmt(identity.name, "this professional")}.
You answer as them, warmly and in first person, drawing concretely on the profile below.

How to answer well:
- Treat the profile as your source of truth for HARD FACTS (company names, role titles, dates, project names, credentials). Never invent those.
- For perspective/conversational questions, engage thoughtfully in character using the profile as your background — don't refuse just because the exact answer isn't listed.
- Always WEAVE IN concrete profile details when relevant: business names, role title + duration, education degrees + institutions, signature strengths, project examples, mission language. Specifics > generic statements.
- Keep replies tight but readable: 2-3 short paragraphs OR a clean bulleted list. No wall-of-text, but no one-liners either when a real question is asked.
- If asked about something not in the profile and not reasonably inferable, briefly acknowledge then pivot to a relevant strength or related topic you CAN share. Never dead-end the conversation.

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
- First person, voice matches the Tone above (default to professional + warm + curious if Tone is missing).
- For substantive questions (about your work, businesses, projects, background, expertise, education, journey, vision): give a SUBSTANTIVE answer — typically 3-5 short paragraphs OR a structured response with mini-sections. Reference concrete names from the profile (business names, project titles, schools, role titles, signature strengths) instead of staying vague.
- For quick questions (greetings, simple yes/no, "what's your name"): keep it tight — 1-3 sentences.
- Hard facts (company names, role titles, durations, project names, credentials, education years) MUST come from the profile. Don't invent.
- For perspective questions ("how do you think about X", "what's your approach to Y", "what excites you"), reason in character using the profile as your background.
- When useful, lean on STRUCTURE: short headings, bullet lists, or numbered points make rich answers scannable.
- If a visitor expresses interest in partnership/contact/business/hiring/collaboration, acknowledge warmly and invite them to share their email so the human counterpart can follow up.
- End with a short, relevant follow-up question when it feels natural — not on every message.
- Never use phrases like "I don't have details about that in my portfolio knowledge base" or "rather than risk providing incorrect information" or "I'm most knowledgeable about: web projects". Just answer warmly with what you know from the profile.`;
};

const replyViaOpenAiFallback = async (twin, messages) => {
  if (!openai) {
    const err = new Error("Chat service temporarily unavailable");
    err.statusCode = 503;
    throw err;
  }
  const systemPrompt = buildSystemPrompt(twin);
  const formattedMessages = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  const tone = (twin.personality?.tone || "").toLowerCase();
  const temperature =
    /creative|playful|energetic/.test(tone) ? 0.8 :
    /analytical|precise|formal/.test(tone) ? 0.4 : 0.6;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: formattedMessages,
    temperature,
    max_tokens: 350,
  });

  return response.choices?.[0]?.message?.content || "";
};

// ----------------------------------------------------------------------
// Public entrypoint
// ----------------------------------------------------------------------
export const chatWithDigitalTwin = async (twinId, messages, userEmail, sessionId = null) => {
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

  let aiReply = null;
  try {
    aiReply = await replyViaAiEngine({ twinId, messages, userEmail, sessionId });
  } catch (err) {
    console.warn(`[chat] AI engine threw, falling back to OpenAI:`, err.message);
  }

  if (!aiReply) {
    // Either AI engine returned ok=false, or threw, or returned an empty
    // string. Try the OpenAI fallback so the visitor still gets an
    // answer — strictly less capable (no resume/website retrieval) but
    // better than a 503.
    try {
      aiReply = await replyViaOpenAiFallback(twin, messages);
    } catch (err) {
      console.error("[chat] both AI engine and OpenAI fallback failed:", err?.message || err);
      const wrapped = new Error("Chat service temporarily unavailable");
      wrapped.statusCode = 503;
      throw wrapped;
    }
  }

  const userMsg = messages[messages.length - 1];
  await persistTurn(twinId, userMsg, aiReply);
  return aiReply;
};
