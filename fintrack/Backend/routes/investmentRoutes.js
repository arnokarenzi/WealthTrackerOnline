import express from "express";
import {
  getInvestments,
  createInvestment,
  updateValuation,
  deleteInvestment,
  getInvestmentReserve,
  updateInvestmentReserve,
  deployReserve,
} from "../controllers/investmentController.js";

const router = express.Router();

// Reserve Pool Endpoints
router.get("/reserve", getInvestmentReserve);
router.put("/reserve", updateInvestmentReserve);
router.post("/reserve", updateInvestmentReserve);

// Asset Holdings Endpoints
router.get("/", getInvestments);
router.post("/", createInvestment);
router.put("/:id", updateValuation);
router.delete("/:id", deleteInvestment);
router.post("/deploy", deployReserve);

export default router;
