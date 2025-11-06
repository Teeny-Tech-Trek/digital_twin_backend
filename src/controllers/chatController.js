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

  // Create a lead if the message indicates interest
  const lastMessage = messages[messages.length - 1].content.toLowerCase();
  if (lastMessage.includes("interested") || lastMessage.includes("contact") || lastMessage.includes("business")) {
    await leadService.createLead(twinId, userEmail, lastMessage);
  }

  res.json({ success: true, reply });
});