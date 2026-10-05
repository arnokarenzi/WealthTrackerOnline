import express from "express";
import * as controller from "../controllers/savingsGoalController.js";

const router = express.Router();

router.get("/", controller.getGoals);
router.put("/:id", controller.updateGoal); // Use this for adding funds
// Update your routes/savingsGoalRoutes.js
router.post("/", controller.createGoal);
router.delete("/:id", controller.deleteGoal); // NEW: Delete route

export default router;
