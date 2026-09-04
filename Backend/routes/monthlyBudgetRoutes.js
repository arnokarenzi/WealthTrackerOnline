import express from "express";
import * as controller from "../controllers/monthlyBudgetController.js";

const router = express.Router();

router.get("/", controller.getBudget);
router.get("/income-history", controller.getWalletIncomeHistory);
router.put("/", controller.updateBudget);
router.post("/reset", controller.resetMonth);
router.post("/initialize", controller.initializeProject);
router.post("/add-income", controller.addExtraIncome);

export default router;
