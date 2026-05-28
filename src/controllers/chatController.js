// backend/controllers/chatController.js
import asyncHandler from "express-async-handler";
import * as chatService from "../services/chatService.js";
import * as leadService from "../services/leadService.js";

/**
 * POST /api/chat
 * Public chatbot endpoint. The visitor sends:
 *   { twinId, userEmail, messages: [{role, content}, ...] }
 * We answer as the twin owner, grounded in their profile.
 */
export const sendMessage = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const { twinId, messages, userEmail } = body;
  // Accept both camelCase (NetTwin frontend) and snake_case (any external
  // consumer that mirrors the AI engine's contract). Either reaches the
  // engine as session_id so conversation memory stays continuous across
  // turns instead of being regenerated on every request.
  const sessionId = body.sessionId || body.session_id || null;

  // Explicit 400 with field-level detail. Throwing a plain Error without a
  // status code falls through to Express's default handler as a 500, which
  // is wrong for client input errors.
  const missing = [];
  if (!twinId) missing.push("twinId");
  if (!userEmail) missing.push("userEmail");
  if (!Array.isArray(messages) || messages.length === 0) missing.push("messages");
  if (missing.length) {
    return res.status(400).json({
      success: false,
      error: "VALIDATION_ERROR",
      message: `Missing required fields: ${missing.join(", ")}`,
    });
  }

  let reply;
  try {
    reply = await chatService.chatWithDigitalTwin(twinId, messages, userEmail, sessionId);
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: status === 404 ? "TWIN_NOT_FOUND" : "CHAT_FAILED",
      message: error.message || "Chat failed",
    });
  }

  // Optional auto-lead capture when the visitor signals partnership intent.
  // Failure here MUST NOT break the chat reply — the lead capture is a
  // best-effort side-effect, not part of the chat contract.
  const interestKeywords = [
    "interested",
    "contact",
    "partnership",
    "collaborate",
    "investment",
  ];
  const lastMessage = String(messages[messages.length - 1]?.content || "").toLowerCase();
  if (interestKeywords.some((kw) => lastMessage.includes(kw))) {
    try {
      await leadService.createLead(twinId, userEmail, lastMessage, {
        name: "Anonymous (chat)",
        phone: "",
        company: "N/A",
      });
    } catch (leadError) {
      console.warn("[CHAT] auto-lead capture failed:", leadError.message);
    }
  }

  return res.json({ success: true, reply });
});
