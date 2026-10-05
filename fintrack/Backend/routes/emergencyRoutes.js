import express from "express";
import {
  getEmergencyFund,
  updateEmergencyFund,
  depositEmergencyFund,
  deployEmergencyFund,
} from "../controllers/emergencyController.js";

const router = express.Router();

router.get("/", getEmergencyFund);
router.put("/", updateEmergencyFund);
router.post("/deposit", depositEmergencyFund);
router.post("/deploy", deployEmergencyFund);

export default router;
