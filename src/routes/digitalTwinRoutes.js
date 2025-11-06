import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getDigitalTwin,
  createUpdateDigitalTwin,
  patchSection,
  deleteTwin,
  getPublicTwin,
} from "../controllers/digitalTwinController.js";

const router = express.Router();

router.get("/get", protect, getDigitalTwin);
router.post("/create", protect, createUpdateDigitalTwin);
router.patch("/section", protect, patchSection);
router.delete("/delete", protect, deleteTwin);
router.get("/public/:twinId", getPublicTwin); 

export default router;
