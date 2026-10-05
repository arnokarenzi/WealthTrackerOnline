import { runScheduledPacingNotification } from "../services/pushService.js";
import { getKigaliTime } from "../services/dailyLetterService.js";

export const runShiftPacingCron = async (req, res) => {
  try {
    const configuredSecret = process.env.CRON_SECRET;

    // CRON_SECRET must always be configured.
    if (!configuredSecret) {
      console.error("CRON_SECRET is not configured.");

      return res.status(500).json({
        ok: false,
        error: "Cron service is not configured.",
      });
    }

    // Authentication is required for EVERY request,
    // including test requests.
    const suppliedSecret = req.get("X-Cron-Secret");

    if (!suppliedSecret || suppliedSecret !== configuredSecret) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized.",
      });
    }

    const kigaliTime = getKigaliTime();

    // Optional authenticated test mode.
    //
    // Send:
    // X-Cron-Test: true
    //
    // This allows us to test immediately without waiting
    // for 08:00, 12:00, or 18:00 Kigali time.
    const isTestRequest =
      String(req.get("X-Cron-Test") || "").toLowerCase() === "true";

    console.log(
      `[SHIFT CRON] Request received at Kigali time: ${JSON.stringify(
        kigaliTime,
      )} | test=${isTestRequest}`,
    );

    // Normal scheduled requests must happen at:
    // 08:00, 12:00, or 18:00 Kigali.
    //
    // Test requests are allowed to continue regardless of the hour.
    if (!isTestRequest && ![8, 12, 18].includes(kigaliTime.hour)) {
      return res.status(200).json({
        ok: true,
        runAtKigali: kigaliTime,
        result: {
          skipped: true,
          reason: "not-a-scheduled-kigali-hour",
          kigali: kigaliTime,
        },
      });
    }

    const result = await runScheduledPacingNotification({
      allowTest: isTestRequest,
    });

    console.log(
      "[SHIFT CRON] Scheduler result:",
      JSON.stringify(result, null, 2),
    );

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
