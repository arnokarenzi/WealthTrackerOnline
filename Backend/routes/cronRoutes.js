import express from "express";
import {
  runShiftPacingCron,
  sendPushTest,
} from "../controllers/cronController.js";

const router = express.Router();

// Safe browser-friendly health check; GET never runs the scheduler.
router.get("/shift-pacing", (_req, res) => {
  res.status(200).json({
    ok: true,
    message: "Shift pacing cron endpoint is online.",
    method: "POST required to execute scheduler.",
  });
});

// Called by cron-job.org. Every request must include X-Cron-Secret.
router.post("/shift-pacing", runShiftPacingCron);

// Manual diagnostic only; additionally requires X-Cron-Test: true.
// Does not modify daily letters, targets, or pacing idempotency logs.
router.post("/test-push", sendPushTest);

export default router;
