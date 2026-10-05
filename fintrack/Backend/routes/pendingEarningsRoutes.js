// Example: server/routes/pendingEarnings.js
import express from "express";
import {
  getPendingEarnings,
  claimPendingEarning,
} from "../controllers/pendingEarningsController.js";

const router = express.Router();

router.get("/", getPendingEarnings);
router.post("/claim/:id", claimPendingEarning);

export default router;
