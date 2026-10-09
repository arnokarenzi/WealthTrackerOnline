import {
  runScheduledPacingNotification,
  sendDiagnosticPushNotification,
} from "../services/pushService.js";
import { getKigaliTime } from "../services/dailyLetterService.js";

const authenticateCronRequest = (req, res) => {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) {
    console.error("CRON_SECRET is not configured.");
    res.status(500).json({ ok: false, error: "Cron service is not configured." });
    return false;
  }

  const suppliedSecret = req.get("X-Cron-Secret");
  if (!suppliedSecret || suppliedSecret !== configuredSecret) {
    res.status(401).json({ ok: false, error: "Unauthorized." });
    return false;
  }

  return true;
};

export const runShiftPacingCron = async (req, res) => {
  if (!authenticateCronRequest(req, res)) return;

  try {
    const kigaliTime = getKigaliTime();
    const isTestRequest =
      String(req.get("X-Cron-Test") || "").toLowerCase() === "true";

    console.log(
      `[SHIFT CRON] Request received at Kigali time: ${JSON.stringify(kigaliTime)} | test=${isTestRequest}`,
    );

    const result = await runScheduledPacingNotification({
      allowTest: isTestRequest,
    });

    console.log("[SHIFT CRON] Scheduler result:", JSON.stringify(result, null, 2));
    return res.status(200).json({
      ok: true,
      testRequest: isTestRequest,
      runAtKigali: kigaliTime,
      result,
    });
  } catch (error) {
    console.error("Shift pacing cron request failed:", error);
    return res.status(500).json({
      ok: false,
      error: "Shift pacing scheduler failed.",
      message:
        process.env.NODE_ENV === "production"
          ? undefined
          : error instanceof Error
            ? error.message
            : String(error),
    });
  }
};

/**
 * Authenticated diagnostic push. This does not run the pacing scheduler,
 * change letter progress, or consume a daily pacing notification-log slot.
 * Requires both X-Cron-Secret and X-Cron-Test: true.
 */
export const sendPushTest = async (req, res) => {
  if (!authenticateCronRequest(req, res)) return;

  if (String(req.get("X-Cron-Test") || "").toLowerCase() !== "true") {
    return res.status(403).json({
      ok: false,
      error: "Set X-Cron-Test: true to use the diagnostic push endpoint.",
    });
  }

  try {
    const result = await sendDiagnosticPushNotification();
    const ok = Number(result.sent || 0) > 0;

    return res.status(ok ? 200 : 503).json({
      ok,
      note: "sent counts provider-accepted requests, not confirmed display on the device.",
      result,
    });
  } catch (error) {
    console.error("Diagnostic push failed:", error);
    return res.status(500).json({
      ok: false,
      error: "Diagnostic push failed.",
      message:
        process.env.NODE_ENV === "production"
          ? undefined
          : error instanceof Error
            ? error.message
            : String(error),
    });
  }
};
