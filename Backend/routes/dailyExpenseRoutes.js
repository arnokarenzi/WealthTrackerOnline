import express from "express";
import * as controller from "../controllers/dailyExpenseController.js";

const router = express.Router();

router.get("/", controller.getExpenses);
router.post("/", controller.addExpense);
router.delete("/:id", controller.deleteExpense);

export default router;
