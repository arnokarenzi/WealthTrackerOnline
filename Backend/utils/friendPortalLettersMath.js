const nonNegativeIntegerFromEnv = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

export const FRIEND_PORTAL_FREE_LETTERS_PER_SHIFT = nonNegativeIntegerFromEnv(
  process.env.FRIEND_PORTAL_FREE_LETTERS_PER_SHIFT,
  150,
);
export const FRIEND_PORTAL_RATE_PER_LETTER = nonNegativeIntegerFromEnv(
  process.env.FRIEND_PORTAL_RATE_PER_LETTER,
  245,
);

export const getFriendPortalShiftKey = (workDate) => {
  const value = String(workDate || "");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "invalid-date";
  const [, year, month, dayText] = match;
  return `${year}-${month}-${Number(dayText) <= 15 ? "1" : "2"}`;
};

export const calculateFriendPortalEntryEarnings = (
  lettersCount,
  remainingExcludedLetters,
) => {
  const letters = Number(lettersCount);
  const safeLetters = Number.isInteger(letters) && letters > 0 ? letters : 0;
  const remaining = Number(remainingExcludedLetters);
  const safeRemaining = Number.isInteger(remaining) && remaining > 0 ? remaining : 0;
  const excludedLetters = Math.min(safeLetters, safeRemaining);
  const payableLetters = Math.max(0, safeLetters - excludedLetters);

  return {
    lettersCount: safeLetters,
    excludedLetters,
    payableLetters,
    earnings: payableLetters * FRIEND_PORTAL_RATE_PER_LETTER,
  };
};

/**
 * Assigns the 150-letter friend's allowance to the earliest recorded letters
 * in each existing FinTrack shift: days 1-15 and days 16-end of month.
 * Entries may be supplied in any order; returned entries are newest first.
 */
export const calculateShiftAdjustedFriendPortalEntries = (entries) => {
  const sorted = [...entries].sort((a, b) =>
    String(a.workDate).localeCompare(String(b.workDate)),
  );
  const excludedByShift = new Map();

  const calculated = sorted.map((entry) => {
    const shiftKey = getFriendPortalShiftKey(entry.workDate);
    const alreadyExcluded = excludedByShift.get(shiftKey) || 0;
    const remainingAllowance = Math.max(
      0,
      FRIEND_PORTAL_FREE_LETTERS_PER_SHIFT - alreadyExcluded,
    );
    const amounts = calculateFriendPortalEntryEarnings(
      entry.lettersCount,
      remainingAllowance,
    );
    excludedByShift.set(shiftKey, alreadyExcluded + amounts.excludedLetters);

    return { ...entry, ...amounts };
  });

  return calculated.reverse();
};
