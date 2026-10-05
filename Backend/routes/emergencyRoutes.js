import express from "express";
import {
  getEmergencyFund,
  updateEmergencyFund,
  depositEmergencyFund,
  getPendingEmergency,
  claimPendingEmergency,
  deployEmergencyFund,
} from "../controllers/emergencyController.js";

const router = express.Router();

router.get("/", getEmergencyFund);
router.get("/pending", getPendingEmergency);
router.put("/", updateEmergencyFund);
router.post("/deposit", depositEmergencyFund);
router.post("/pending/claim", claimPendingEmergency);
router.post("/deploy", deployEmergencyFund);

export default router;
