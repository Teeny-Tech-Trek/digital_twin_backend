// backend/routes/chatRoutes.js
import express from "express";
import { sendMessage } from "../controllers/chatController.js";
import { canSendChatMessage } from "../modules/billing/billing.middleware.js";

const router = express.Router();

// Public chatbot route — quota is metered against the twin owner via the
// twinId in the request body.
router.post("/", canSendChatMessage, sendMessage);

export default router;
