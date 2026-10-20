/**
 * Pure pacing-target helpers. A target is based on the shift total at 00:00
 * Kigali for the current date, not the shift total at the 08:00 reminder.
 */
const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const calculateTargetFromMidnightShiftTotal = (
  shiftLettersAtMidnight,
  remainingDaysInShift,
  maxShiftLetters = 750,
) => {
  const cap = Math.max(0, toNumber(maxShiftLetters));
  const midnightTotal = Math.max(0, toNumber(shiftLettersAtMidnight));
  const remainingAtMidnight = Math.max(0, cap - midnightTotal);
  const days = Math.max(1, Math.ceil(toNumber(remainingDaysInShift)));
  return remainingAtMidnight > 0 ? Math.ceil(remainingAtMidnight / days) : 0;
};

/**
 * Recover the start-of-day cumulative shift count from the live shift total
 * and this Kigali date's daily count, then calculate the midnight snapshot.
 */
export const calculateMidnightPacingTarget = ({
  shiftLetters,
  dailyLetterCount = 0,
  remainingDaysInShift,
  maxShiftLetters = 750,
} = {}) => calculateTargetFromMidnightShiftTotal(
  toNumber(shiftLetters) - toNumber(dailyLetterCount),
  remainingDaysInShift,
  maxShiftLetters,
);
