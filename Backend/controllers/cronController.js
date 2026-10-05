import { runScheduledPacingNotification } from "../services/pushService.js";
import { getKigaliTime } from "../services/dailyLetterService.js";

export const runShiftPacingCron = async (req, res) => {
  try {
    const configuredSecret = process.env.CRON_SECRET;

    if (!configuredSecret) {
      console.error("CRON_SECRET is not configured.");
      return res.status(500).json({
        ok: false,
        error: "Cron service is not configured.",
      });
    }

    const suppliedSecret = req.get("X-Cron-Secret");

    if (!suppliedSecret || suppliedSecret !== configuredSecret) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized.",
      });
    }

    const kigaliTime = getKigaliTime();

    console.log(
      `[SHIFT CRON] Request received at Kigali time: ${JSON.stringify(
        kigaliTime,
      )}`,
    );

    const result = await runScheduledPacingNotification();

    console.log(
      "[SHIFT CRON] Scheduler result:",
      JSON.stringify(result, null, 2),
    );

    return res.status(200).json({
      ok: true,
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
