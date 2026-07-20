import express from "express";
import {
  getDashboard,
  updateMonthlyBudget,
  updateLetters,
  resetShift,
} from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/summary", getDashboard);
router.put("/monthly-budget/:id", updateMonthlyBudget);
router.post("/letters", updateLetters);
router.post("/reset-shift", resetShift); // NEW ENDPOINT TO RESET THE SHIFT

export default router;
