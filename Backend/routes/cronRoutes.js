import express from "express";
import { runShiftPacingCron } from "../controllers/cronController.js";

const router = express.Router();

/**
 * Called by cron-job.org.
 *
 * Required header:
 * X-Cron-Secret: <value of CRON_SECRET>
 */
router.post("/shift-pacing", runShiftPacingCron);

export default router;
