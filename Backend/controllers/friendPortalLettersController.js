import {
  claimFriendPortalPayout,
  deleteFriendPortalDailyLetters,
  getFriendPortalLetterRecords,
  getPendingFriendPortalPayouts,
  resetFriendPortalShift,
  saveFriendPortalDailyLetters,
} from "../services/friendPortalLettersService.js";

const validDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const validMonth = (value) =>
  typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

const validShiftStart = (value) =>
  typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])-(01|16)$/.test(value);

const currentMonthKigali = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kigali",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());

const handleServiceError = (res, error, operation) => {
  if (error.code === "FRIEND_PORTAL_SHIFT_CLOSED" || error.code === "FRIEND_PORTAL_SHIFT_EMPTY") {
    return res.status(409).json({ error: error.message, code: error.code });
  }
  if (error.code === "INVALID_SHIFT_START" || error.code === "INVALID_WORK_DATE") {
    return res.status(400).json({ error: error.message, code: error.code });
  }
  console.error(`${operation}:`, error);
  return res.status(500).json({ error: `Could not ${operation.toLowerCase()}.` });
};

export const getFriendPortalLetters = async (req, res) => {
  try {
    const month = req.query.month || currentMonthKigali();
    if (!validMonth(month)) {
      return res.status(400).json({ error: "Month must use YYYY-MM format." });
    }

    const [year, monthNumber] = month.split("-").map(Number);
    const startDate = `${month}-01`;
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const endDate = `${month}-${String(lastDay).padStart(2, "0")}`;
    const result = await getFriendPortalLetterRecords(startDate, endDate);
    return res.json({ month, ...result });
  } catch (error) {
    console.error("Get friend-portal letter records error:", error);
    return res.status(500).json({ error: "Could not retrieve friend-portal letter records." });
  }
};

export const saveFriendPortalLetters = async (req, res) => {
  const workDate = req.body?.workDate;
  const lettersCount = Number(req.body?.lettersCount);
  const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : "";

  if (!validDate(workDate)) {
    return res.status(400).json({ error: "Work date must be a valid YYYY-MM-DD date." });
  }
  if (!Number.isInteger(lettersCount) || lettersCount < 1 || lettersCount > 1000000) {
    return res.status(400).json({ error: "Letters must be a whole number between 1 and 1,000,000." });
  }
  if (notes.length > 500) {
    return res.status(400).json({ error: "Notes cannot exceed 500 characters." });
  }

  try {
    const entry = await saveFriendPortalDailyLetters({ workDate, lettersCount, notes });
    return res.status(200).json({
      message: "Friend-portal letters saved successfully.",
      entry,
    });
  } catch (error) {
    return handleServiceError(res, error, "Save friend-portal letters");
  }
};

export const removeFriendPortalLetters = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ error: "A valid record ID is required." });
  }

  try {
    const deleted = await deleteFriendPortalDailyLetters(id);
    if (!deleted) {
      return res.status(404).json({ error: "Friend-portal letter record not found." });
    }
    return res.json({ message: "Friend-portal letter record deleted." });
  } catch (error) {
    return handleServiceError(res, error, "Delete friend-portal letters");
  }
};

export const resetFriendPortalShiftController = async (req, res) => {
  const shiftStart = req.body?.shiftStart;
  if (!validShiftStart(shiftStart)) {
    return res.status(400).json({
      error: "Shift start must be the first or sixteenth day of a month (YYYY-MM-01 or YYYY-MM-16).",
    });
  }

  try {
    const result = await resetFriendPortalShift(shiftStart);
    if (result.alreadyReset) {
      return res.status(200).json({
        ...result,
        message: "This friend-portal shift was already reset. No duplicate receivable was created.",
      });
    }

    return res.status(200).json({
      ...result,
      message: result.amount > 0
        ? "Friend-portal shift reset. Earnings have been moved to pending receivables."
        : "Friend-portal shift reset. No payable earnings were available, so no receivable was created.",
    });
  } catch (error) {
    return handleServiceError(res, error, "Reset friend-portal shift");
  }
};

export const getPendingFriendPortalPayoutsController = async (_req, res) => {
  try {
    const payouts = await getPendingFriendPortalPayouts();
    return res.json(payouts);
  } catch (error) {
    console.error("Get pending friend-portal payouts error:", error);
    return res.status(500).json({ error: "Could not retrieve pending friend-portal payouts." });
  }
};

export const claimFriendPortalPayoutController = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ error: "A valid payout ID is required." });
  }

  try {
    const result = await claimFriendPortalPayout(id);
    if (!result) {
      return res.status(404).json({
        error: "Friend-portal payout not found or already deposited.",
      });
    }
    return res.json({
      message: "Friend-portal payment confirmed and added to your wallet.",
      ...result,
    });
  } catch (error) {
    if (error.code === "WALLET_NOT_FOUND") {
      return res.status(409).json({ error: error.message, code: error.code });
    }
    console.error("Claim friend-portal payout error:", error);
    return res.status(500).json({ error: "Could not deposit friend-portal payout." });
  }
};
