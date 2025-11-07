// backend/controllers/chatController.js
import asyncHandler from "express-async-handler";
import * as chatService from "../services/chatService.js";
import * as leadService from "../services/leadService.js";

export const sendMessage = asyncHandler(async (req, res) => {
  const { twinId, messages, userEmail } = req.body;
  if (!twinId || !messages || !userEmail) {
    throw new Error("Missing required fields: twinId, messages, or userEmail");
  }

  const reply = await chatService.chatWithDigitalTwin(twinId, messages, userEmail);

  // Enhanced lead creation: Only if qualified interest
  const lastMessage = messages[messages.length - 1].content.toLowerCase();
  const interestKeywords = ["interested", "contact", "business", "partnership", "collaborate"];
  if (interestKeywords.some((kw) => lastMessage.includes(kw))) {
    // Placeholder for basic lead; full form comes via /leads endpoint
    await leadService.createLead(twinId, userEmail, lastMessage, { name: "Anonymous", phone: "", company: "N/A" });
  }

  res.json({ success: true, reply });
});