import express from "express";
import { runShiftPacingCron } from "../controllers/cronController.js";

const router = express.Router();

/**
 * Simple browser health check.
 */
router.get("/shift-pacing", (req, res) => {
  res.status(200).json({
    ok: true,
    message: "Shift pacing cron endpoint is online.",
    method: "POST required to execute scheduler.",
  });
});

/**
 * Called by cron-job.org.
 *
 * Required header:
 * X-Cron-Secret: <value of CRON_SECRET>
 */
router.post("/shift-pacing", runShiftPacingCron);

export default router;
