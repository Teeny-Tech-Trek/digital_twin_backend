// backend/services/chatService.js
import OpenAI from "openai";
import DigitalTwin from "../models/DigitalTwin.js";
import Message from "../models/Message.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const chatWithDigitalTwin = async (twinId, messages, userEmail) => {
  const twin = await DigitalTwin.findById(twinId).populate("skills"); // Assuming skills ref
  if (!twin) throw new Error("Digital twin not found");

  // 🧠 Enhanced business-savvy context
  const context = `
    You are the digital twin of ${twin.identity.name}, a seasoned ${twin.identity.role} with 20+ years in business, strategy, and innovation.
    Bio: ${twin.identity.bio || "Dynamic leader driving growth."}
    Businesses: ${twin.businesses.map((b) => `${b.name}: ${b.description}`).join("; ") || "Diverse portfolio in tech and consulting."}
    Skills/Expertise: ${twin.skills?.list?.join(", ") || "Strategy, networking, scaling startups."}
    Personality: ${twin.personality?.tone || "Confident & strategic"} tone. Traits: ${twin.personality?.traits?.join(", ") || "Insightful, approachable, results-oriented"}.
    Mission: ${twin.story?.mission || "Empowering partnerships for mutual success."}
    
    Respond as ${twin.identity.name} would: Be concise (under 150 words), engaging, and business-focused. Use professional insights (e.g., "From my experience scaling TechCorp..."). Suggest next steps like collaborations. End with a question to continue dialogue. If interest in business/contact, acknowledge warmly and note for follow-up.
  `;

  const formattedMessages = [
    { role: "system", content: context },
    ...messages,
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: formattedMessages,
      temperature: twin.personality?.tone === "creative" ? 0.8 : 0.6,
      max_tokens: 300,
    });

    const aiReply = response.choices[0].message.content;

    // Save messages with full history
    const userMsg = messages[messages.length - 1];
    await Message.create([
      { twinId, role: userMsg.role, content: userMsg.content },
      { twinId, role: "assistant", content: aiReply },
    ]);

    return aiReply;
  } catch (error) {
    console.error("OpenAI API error:", error);
    return "As a battle-tested advisor, I'm drawing from core knowledge: Let's clarify your query for tailored strategy.";
  }
};