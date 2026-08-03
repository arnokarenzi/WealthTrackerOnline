import express from "express";
import {
  getEmergencyFund,
  updateEmergencyFund,
} from "../controllers/emergencyController.js";

const router = express.Router();

router.get("/", getEmergencyFund);
router.put("/", updateEmergencyFund);

export default router;
