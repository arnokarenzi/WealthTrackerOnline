import express from "express";
import {
  getInvestments,
  createInvestment,
  updateValuation,
  deleteInvestment,
} from "../controllers/investmentController.js";

const router = express.Router();

router.get("/", getInvestments);
router.post("/", createInvestment);
router.put("/:id", updateValuation);
router.delete("/:id", deleteInvestment);

export default router;
