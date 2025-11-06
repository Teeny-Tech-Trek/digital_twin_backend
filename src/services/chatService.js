// backend/services/chatService.js
import OpenAI from "openai";
import DigitalTwin from "../models/DigitalTwin.js";
import Message from "../models/Message.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const chatWithDigitalTwin = async (twinId, messages, userEmail) => {
  const twin = await DigitalTwin.findById(twinId);
  if (!twin) throw new Error("Digital twin not found");

  // 🧠 Build twin context
  const context = `
    You are a digital twin of ${twin.identity.name}, a ${twin.identity.role}.
    Bio: ${twin.identity.bio || "No bio provided."}
    Businesses: ${twin.businesses.map((b) => `${b.name} (${b.description})`).join(", ") || "None"}
    Skills: ${twin.skills.list.join(", ") || "None"}
    Personality: ${twin.personality.tone || "Professional"} tone, traits: ${twin.personality.traits?.join(", ") || "None"}
    Mission: ${twin.story.mission || "No mission provided."}
    Respond as ${twin.identity.name} would, based on this information. Be concise, engaging, and aligned with the personality traits.
  `;

  const formattedMessages = [
    { role: "system", content: context },
    ...messages,
  ];

  try {
    // ✅ NEW OpenAI v4 syntax
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // or "gpt-4-turbo"
      messages: formattedMessages,
      temperature: twin.personality.tone === "creative" ? 0.9 : 0.7,
      max_tokens: 500,
    });

    const aiReply = response.choices[0].message.content;

    // 🗃 Save both user and AI messages
    await Message.create([
      {
        twinId,
        role: messages[messages.length - 1].role,
        content: messages[messages.length - 1].content,
        timestamp: new Date(),
      },
      {
        twinId,
        role: "assistant",
        content: aiReply,
        timestamp: new Date(),
      },
    ]);

    return aiReply;
  } catch (error) {
    console.error("Open AI API error:", error);
    throw new Error("Failed to process chat request");
  }
};
