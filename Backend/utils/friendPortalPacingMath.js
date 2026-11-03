import {
  FRIEND_PORTAL_FREE_LETTERS_PER_SHIFT,
  FRIEND_PORTAL_RATE_PER_LETTER,
} from "./friendPortalLettersMath.js";

const positiveIntegerFromEnv = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const FRIEND_PORTAL_SHIFT_TARGET_LETTERS = positiveIntegerFromEnv(
  process.env.FRIEND_PORTAL_SHIFT_TARGET_LETTERS,
  450,
);

export const getFriendPortalShiftBounds = (kigali) => {
  const year = Number(kigali?.year);
  const month = Number(kigali?.month);
  const day = Number(kigali?.day);
  const lastDayOfMonth = Number(kigali?.lastDayOfMonth);

  if (
    !Number.isInteger(year) || year < 2000 ||
    !Number.isInteger(month) || month < 1 || month > 12 ||
    !Number.isInteger(day) || day < 1 || day > lastDayOfMonth ||
    !Number.isInteger(lastDayOfMonth) || lastDayOfMonth < 28 || lastDayOfMonth > 31
  ) {
    throw new Error("Invalid Kigali date supplied for Friend Portal pacing.");
  }

  const firstHalf = day <= 15;
  const startDay = firstHalf ? 1 : 16;
  const endDay = firstHalf ? 15 : lastDayOfMonth;
  const shiftDay = firstHalf ? day : day - 15;
  const totalDaysInShift = endDay - startDay + 1;
  const remainingDaysInShift = Math.max(1, totalDaysInShift - shiftDay + 1);
  const pad = (value) => String(value).padStart(2, "0");

  return {
    shiftStart: `${year}-${pad(month)}-${pad(startDay)}`,
    shiftEnd: `${year}-${pad(month)}-${pad(endDay)}`,
    shiftDay,
    totalDaysInShift,
    remainingDaysInShift,
  };
};

export const calculateFriendPortalPacing = ({
  shiftLetters,
  todayLetters,
  shiftDay,
  totalDaysInShift,
  remainingDaysInShift,
  target = FRIEND_PORTAL_SHIFT_TARGET_LETTERS,
} = {}) => {
  const safeInteger = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
  };

  const safeTarget = Math.max(1, safeInteger(target));
  const safeShiftLetters = safeInteger(shiftLetters);
  const safeTodayLetters = safeInteger(todayLetters);
  const safeRemainingDays = Math.max(1, safeInteger(remainingDaysInShift));
  const remainingShiftLetters = Math.max(0, safeTarget - safeShiftLetters);
  const currentRequiredPerDay = remainingShiftLetters > 0
    ? Math.ceil(remainingShiftLetters / safeRemainingDays)
    : 0;
  const todayRemaining = Math.max(0, currentRequiredPerDay - safeTodayLetters);
  const payableLettersAtTarget = Math.max(0, safeTarget - FRIEND_PORTAL_FREE_LETTERS_PER_SHIFT);

  return {
    target: safeTarget,
    shiftLetters: safeShiftLetters,
    todayLetters: safeTodayLetters,
    remainingShiftLetters,
    remainingDaysInShift: safeRemainingDays,
    currentRequiredPerDay,
    todayRemaining,
    targetReached: safeShiftLetters >= safeTarget,
    progressPercent: Math.min(100, Math.round((safeShiftLetters / safeTarget) * 100)),
    payableLettersAtTarget,
    estimatedEarningsAtTarget: payableLettersAtTarget * FRIEND_PORTAL_RATE_PER_LETTER,
    shiftDay: safeInteger(shiftDay),
    totalDaysInShift: safeInteger(totalDaysInShift),
  };
};
