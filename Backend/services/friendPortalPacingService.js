import { pool } from "../models/MonthlyBudget.js";
import { getKigaliTime } from "../utils/kigaliTime.js";
import {
  ensureFriendPortalLettersTable,
  ensureFriendPortalPayoutsTable,
} from "./friendPortalLettersService.js";
import {
  calculateFriendPortalPacing,
  getFriendPortalShiftBounds,
} from "../utils/friendPortalPacingMath.js";

/**
 * Reads live Friend Portal entries for the current Kigali 1st–15th or
 * 16th–month-end shift. The progress target is total letters (450 by default),
 * not payable letters; the existing 150-letter allowance only affects payout.
 */
export const getFriendPortalShiftPacingStatus = async (
  queryable = pool,
  instant = new Date(),
) => {
  await Promise.all([
    ensureFriendPortalLettersTable(queryable),
    ensureFriendPortalPayoutsTable(queryable),
  ]);

  const kigali = getKigaliTime(instant);
  const bounds = getFriendPortalShiftBounds(kigali);

  const [rows] = await queryable.query(
    `SELECT
       COALESCE(SUM(letters_count), 0) AS shift_letters,
       COALESCE(SUM(CASE WHEN work_date = ? THEN letters_count ELSE 0 END), 0) AS today_letters
     FROM FriendPortalDailyLetters
     WHERE work_date >= ? AND work_date <= ?`,
    [kigali.dateString, bounds.shiftStart, bounds.shiftEnd],
  );

  const [closedRows] = await queryable.query(
    "SELECT id FROM FriendPortalShiftPayouts WHERE shift_start = ? LIMIT 1",
    [bounds.shiftStart],
  );

  const totals = rows[0] || {};
  const pacing = calculateFriendPortalPacing({
    shiftLetters: totals.shift_letters,
    todayLetters: totals.today_letters,
    shiftDay: bounds.shiftDay,
    totalDaysInShift: bounds.totalDaysInShift,
    remainingDaysInShift: bounds.remainingDaysInShift,
  });

  return {
    date: kigali.dateString,
    dateTime: kigali.dateTimeString,
    hour: kigali.hour,
    ...bounds,
    ...pacing,
    shiftClosed: closedRows.length > 0,
  };
};
