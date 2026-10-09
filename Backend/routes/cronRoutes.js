import express from "express";
import {
  runShiftPacingCron,
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

// Existing scheduled notification endpoint.
router.post("/shift-pacing", runShiftPacingCron);

// Protected diagnostic notification endpoint.
router.post("/test-push", sendPushTest);

export default router;
