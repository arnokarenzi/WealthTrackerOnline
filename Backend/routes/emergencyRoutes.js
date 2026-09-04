import express from "express";
import {
  getEmergencyFund,
  updateEmergencyFund,
  deployEmergencyFund,
} from "../controllers/emergencyController.js";

const router = express.Router();

router.get("/", getEmergencyFund);
router.put("/", updateEmergencyFund);
router.post("/deploy", deployEmergencyFund);

export default router;
