import express from "express";
import * as controller from "../controllers/monthlyBudgetController.js";
const router = express.Router();
router.get("/", controller.getBudget);
router.put("/", controller.updateBudget);
router.post("/reset", controller.resetMonth);
router.post("/initialize", controller.initializeProject);

export default router;
