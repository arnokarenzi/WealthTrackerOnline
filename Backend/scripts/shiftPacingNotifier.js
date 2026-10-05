import "dotenv/config";
import { pool } from "../models/MonthlyBudget.js";
import { runScheduledPacingNotification } from "../services/pushService.js";
import { getKigaliTime } from "../services/dailyLetterService.js";

const main = async () => {
  const result = await runScheduledPacingNotification();
  console.log(
    JSON.stringify(
      {
        ok: true,
        runAtKigali: getKigaliTime(),
        result,
      },
      null,
      2,
    ),
  );
};

main()
  .catch((error) => {
    console.error("Shift pacing notifier failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
