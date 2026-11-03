import express from "express";
import {
  runShiftPacingCron,
  runAppNotificationsCron,
  sendPushTest,
} from "../controllers/cronController.js";

const router = express.Router();

// Safe browser check; this does not send a notification.
router.get("/shift-pacing", (_req, res) => {
  res.status(200).json({
    ok: true,
    message: "Shift pacing cron endpoint is online.",
    method: "POST required to execute scheduler.",
  });
});

// Existing scheduled notification endpoint; keep its current 00:00/08:00/12:00/18:00 calls.
router.post("/shift-pacing", runShiftPacingCron);

// Unified bill, debt, task, calendar, habit, goal, countdown, budget and review reminders.
// Configure the existing external scheduler to call this endpoint every five minutes.
router.post("/notifications", runAppNotificationsCron);

// Protected diagnostic notification endpoint.
router.post("/test-push", sendPushTest);

export default router;
