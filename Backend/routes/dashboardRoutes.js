import express from "express";
import {
  getDashboard,
  updateLetters,
  resetShift,
  updateMonthlyBudget,
} from "../controllers/dashboardController.js";

const router = express.Router();

// Maps to GET /api/dashboard
router.get("/", getDashboard);

router.post("/letters", updateLetters);
router.post("/reset-shift", resetShift);
router.put("/budget/:id", updateMonthlyBudget);

export default router;
