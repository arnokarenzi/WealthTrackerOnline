import { pool } from "../models/MonthlyBudget.js";
import { getKigaliTime } from "../utils/kigaliTime.js";
import {
  calculateMidnightPacingTarget,
  calculateTargetFromMidnightShiftTotal,
} from "../utils/pacingTarget.js";
export { calculateMidnightPacingTarget } from "../utils/pacingTarget.js";

// Gold shift configuration used by the existing Shift Engine.
export const MAX_SHIFT_LETTERS = 750;
export const GOLD_PACING_ALERT_HOURS = [8, 12, 18];

const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const integerCeil = (value) => Math.max(0, Math.ceil(number(value)));

let schemaReadyPromise = null;
let pacingLogReadyPromise = null;

export const ensureDailyLetterTable = async () => {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS DailyLetterProgress (
          id INT NOT NULL AUTO_INCREMENT,
          tracking_date DATE NOT NULL,
          letter_count INT NOT NULL DEFAULT 0,
          pacing_target INT NULL,
          pacing_target_set_at DATETIME NULL,
          target_reached TINYINT(1) NOT NULL DEFAULT 0,
          notification_sent TINYINT(1) NOT NULL DEFAULT 0,
          target_reached_at DATETIME NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY unique_tracking_date (tracking_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // The previous 65-letter implementation may already have created the
      // table without the two pacing columns. Add them without replacing data.
      const [pacingColumn] = await pool.query(
        "SHOW COLUMNS FROM DailyLetterProgress LIKE 'pacing_target'",
      );
      if (!pacingColumn.length) {
        await pool.query(
          "ALTER TABLE DailyLetterProgress ADD COLUMN pacing_target INT NULL AFTER letter_count",
        );
      }

      const [timestampColumn] = await pool.query(
        "SHOW COLUMNS FROM DailyLetterProgress LIKE 'pacing_target_set_at'",
      );
      if (!timestampColumn.length) {
        await pool.query(
          "ALTER TABLE DailyLetterProgress ADD COLUMN pacing_target_set_at DATETIME NULL AFTER pacing_target",
        );
      }
    })().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }

  await schemaReadyPromise;
};

export const ensurePacingNotificationLogTable = async () => {
  if (!pacingLogReadyPromise) {
    pacingLogReadyPromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS ShiftPacingNotificationLog (
          id INT NOT NULL AUTO_INCREMENT,
          tracking_date DATE NOT NULL,
          trigger_hour TINYINT NOT NULL,
          sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY unique_pacing_trigger (tracking_date, trigger_hour)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)
      .catch((error) => {
        pacingLogReadyPromise = null;
        throw error;
      });
  }

  await pacingLogReadyPromise;
};

const getShiftWindow = (kigali) => {
  const isShift1 = kigali.day <= 15;
  const totalDaysInShift = isShift1
    ? 15
    : Math.max(1, kigali.lastDayOfMonth - 15);
  const shiftDay = isShift1 ? kigali.day : kigali.day - 15;
  const remainingDaysInShift = Math.max(
    1,
    totalDaysInShift - shiftDay + 1,
  );

  return {
    isShift1,
    shiftDay,
    totalDaysInShift,
    remainingDaysInShift,
  };
};

export const getCurrentShiftPacing = async (queryable = pool) => {
  const kigali = getKigaliTime();
  const [rows] = await queryable.query(
    "SELECT shiftLetters FROM MonthlyBudget WHERE id = 1",
  );

  const shiftLetters = number(rows[0]?.shiftLetters);
  const remainingShiftLetters = Math.max(
    0,
    MAX_SHIFT_LETTERS - shiftLetters,
  );
  const shiftWindow = getShiftWindow(kigali);
  const currentRequiredPerDay =
    remainingShiftLetters > 0
      ? integerCeil(
          remainingShiftLetters / shiftWindow.remainingDaysInShift,
        )
      : 0;

  return {
    date: kigali.dateString,
    dateTime: kigali.dateTimeString,
    hour: kigali.hour,
    minute: kigali.minute,
    second: kigali.second,
    shiftLetters,
    remainingShiftLetters,
    currentRequiredPerDay,
    ...shiftWindow,
  };
};

/*
 * Live Gold Medal competition.
 *
 * The #1 dummy competitor is always one Gold-pace day ahead of the user:
 *   leaderScore = Gold pace accumulated so far + one Gold-pace day
 *
 * This reproduces the requested 15-day behavior:
 *   end of Day 1 -> 100 letters
 *   end of Day 2 -> 150 letters
 *   ...
 *   end of Day 14 -> 750 letters
 *
 * For longer/shorter calendar shifts, the daily Gold pace is derived from
 * 750 / actual shift length so the leader still finishes exactly 24 hours
 * before the shift deadline.
 *
 * The scores are calculated from time, not stored/incremented in the database,
 * so they remain live and deterministic after refreshes.
 */
export const getShiftLeaderboard = async (queryable = pool) => {
  const pacing = await getCurrentShiftPacing(queryable);

  const totalDaysInShift = Math.max(1, Number(pacing.totalDaysInShift) || 1);
  const goldTarget = MAX_SHIFT_LETTERS;
  const goldDailyPace = goldTarget / totalDaysInShift;

  const secondsIntoToday =
    Number(pacing.hour || 0) * 3600 +
    Number(pacing.minute || 0) * 60 +
    Number(pacing.second || 0);

  const shiftElapsedDays = Math.min(
    totalDaysInShift,
    Math.max(
      0,
      (Number(pacing.shiftDay) - 1) +
        secondsIntoToday / 86400,
    ),
  );

  // One full Gold-pace day ahead of the user's Gold track.
  const topScore = Math.min(
    goldTarget,
    Math.max(0, (shiftElapsedDays + 1) * goldDailyPace),
  );

  const dummyAccounts = [
    { id: "dummy-01", name: "Daniel M.", gap: 0 },
    { id: "dummy-02", name: "Eric K.", gap: 5 },
    { id: "dummy-03", name: "Samuel R.", gap: 10 },
    { id: "dummy-04", name: "Brian T.", gap: 15 },
    { id: "dummy-05", name: "Kevin A.", gap: 20 },
    { id: "dummy-06", name: "Patrick N.", gap: 25 },
    { id: "dummy-07", name: "Jean P.", gap: 30 },
    { id: "dummy-08", name: "David L.", gap: 35 },
    { id: "dummy-09", name: "Mark E.", gap: 40 },
    { id: "dummy-10", name: "Emmanuel B.", gap: 45 },
  ];

  const competitors = dummyAccounts.map((account) => ({
    ...account,
    score: Math.round(Math.max(0, topScore - account.gap)),
  }));

  return {
    shiftDay: Number(pacing.shiftDay),
    totalDaysInShift,
    shiftLetters: Number(pacing.shiftLetters) || 0,
    goldTarget,
    goldDailyPace,
    shiftElapsedDays,
    topScore: Math.round(topScore),
    serverNowMs: Date.now(),
    competitionFinishDay: Math.max(1, totalDaysInShift - 1),
    userScore: Math.min(
      goldTarget,
      Math.max(0, Number(pacing.shiftLetters) || 0),
    ),
    competitors,
  };
};


/**
 * Applies the same ordering as LeaderboardWidget: higher score first, the user
 * wins an equal-score tie against a dummy competitor, then names sort alphabetically.
 * Returns rank details used by the backend to detect real position improvements.
 */
export const rankShiftLeaderboard = (leaderboard) => {
  const goldTarget = Math.max(0, number(leaderboard?.goldTarget));
  const entries = [
    ...(Array.isArray(leaderboard?.competitors) ? leaderboard.competitors : []).map((competitor) => ({
      id: String(competitor.id),
      name: String(competitor.name || "Competitor"),
      score: Math.min(goldTarget, Math.max(0, number(competitor.score))),
      isUser: false,
    })),
    {
      id: "user",
      name: "You",
      score: Math.min(goldTarget, Math.max(0, number(leaderboard?.userScore))),
      isUser: true,
    },
  ];

  entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.isUser !== b.isUser) return a.isUser ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const ranked = entries.map((entry, index, all) => ({
    ...entry,
    rank: all.findIndex((candidate) => candidate.score === entry.score) + 1,
    sortedIndex: index,
  }));
  const user = ranked.find((entry) => entry.isUser);
  const userIndex = ranked.findIndex((entry) => entry.isUser);
  const nextCompetitor = userIndex > 0 ? ranked[userIndex - 1] : null;

  return {
    userRank: user?.rank ?? ranked.length,
    userScore: user?.score ?? 0,
    nextCompetitor: nextCompetitor
      ? { id: nextCompetitor.id, name: nextCompetitor.name, score: nextCompetitor.score, rank: nextCompetitor.rank }
      : null,
    lettersToOvertake: nextCompetitor
      ? Math.max(0, nextCompetitor.score - (user?.score ?? 0) + 1)
      : 0,
    totalEntries: ranked.length,
  };
};

const readDailyRow = async (queryable, dateString, lock = false) => {
  const sql = `
    SELECT tracking_date, letter_count, pacing_target, pacing_target_set_at,
           target_reached, notification_sent, target_reached_at
    FROM DailyLetterProgress
    WHERE tracking_date = ?
    LIMIT 1
    ${lock ? "FOR UPDATE" : ""}
  `;

  const [rows] = await queryable.query(sql, [dateString]);
  return rows[0] || null;
};

/**
 * Freeze today's pacing target from the 00:00 Kigali state. This function is
 * called by the midnight cron. If any letters were entered after midnight,
 * shiftLetters - today's daily count reconstructs the shift total at midnight.
 * Re-running the cron is idempotent for a given day.
 */
export const lockMidnightPacingTarget = async (queryable = pool) => {
  await ensureDailyLetterTable();
  const pacing = await getCurrentShiftPacing(queryable);
  const existing = await readDailyRow(queryable, pacing.date, false);
  const dailyCount = number(existing?.letter_count);
  const midnightShiftLetters = Math.max(0, pacing.shiftLetters - dailyCount);
  const target = calculateTargetFromMidnightShiftTotal(
    midnightShiftLetters,
    pacing.remainingDaysInShift,
  );

  if (!existing) {
    await queryable.query(
      `INSERT INTO DailyLetterProgress
        (tracking_date, letter_count, pacing_target, pacing_target_set_at, target_reached)
       VALUES (?, 0, ?, UTC_TIMESTAMP(), 0)
       ON DUPLICATE KEY UPDATE
         pacing_target = VALUES(pacing_target),
         pacing_target_set_at = UTC_TIMESTAMP()`,
      [pacing.date, target],
    );
  } else {
    await queryable.query(
      `UPDATE DailyLetterProgress
       SET pacing_target = ?,
           pacing_target_set_at = UTC_TIMESTAMP(),
           target_reached = CASE
             WHEN letter_count >= ? AND ? > 0 THEN 1
             ELSE target_reached
           END,
           target_reached_at = CASE
             WHEN letter_count >= ? AND ? > 0 THEN COALESCE(target_reached_at, UTC_TIMESTAMP())
             ELSE target_reached_at
           END
       WHERE tracking_date = ?`,
      [target, target, target, target, target, pacing.date],
    );
  }

  return getDailyPacingStatus(queryable);
};

/**
 * Safety initializer used by status/notification paths. It creates a missing
 * target using the reconstructed midnight shift total but never recalculates
 * an already-set target. The scheduled midnight job is the authoritative lock.
 */
export const ensureDailyTargetInitialized = async (queryable = pool) => {
  await ensureDailyLetterTable();
  const pacing = await getCurrentShiftPacing(queryable);
  const existing = await readDailyRow(queryable, pacing.date, false);

  if (!existing || existing.pacing_target == null) {
    const dailyCount = number(existing?.letter_count);
    const target = calculateMidnightPacingTarget({
      shiftLetters: pacing.shiftLetters,
      dailyLetterCount: dailyCount,
      remainingDaysInShift: pacing.remainingDaysInShift,
    });

    if (!existing) {
      await queryable.query(
        `INSERT INTO DailyLetterProgress
          (tracking_date, letter_count, pacing_target, pacing_target_set_at, target_reached)
         VALUES (?, 0, ?, UTC_TIMESTAMP(), 0)
         ON DUPLICATE KEY UPDATE tracking_date = VALUES(tracking_date)`,
        [pacing.date, target],
      );
    } else {
      await queryable.query(
        `UPDATE DailyLetterProgress
         SET pacing_target = ?, pacing_target_set_at = COALESCE(pacing_target_set_at, UTC_TIMESTAMP())
         WHERE tracking_date = ? AND pacing_target IS NULL`,
        [target, pacing.date],
      );
    }
  }

  return getDailyPacingStatus(queryable);
};

// Backwards-compatible export for older imports. It no longer locks at 08:00.
export const lockMorningPacingTarget = lockMidnightPacingTarget;

export const getDailyPacingStatus = async (queryable = pool) => {
  await ensureDailyLetterTable();

  // The daily ledger key is the Africa/Kigali calendar date. It switches at
  // 00:00 Kigali; shiftDay/shift pacing formulas below are intentionally unchanged.
  const pacing = await getCurrentShiftPacing(queryable);
  let row = await readDailyRow(queryable, pacing.date, false);

  // If the midnight cron has not yet initialized today's row, derive the
  // target from the shift total at midnight (current shift total minus letters
  // already entered today). This keeps status reads from changing the snapshot.
  const dailyTarget = row?.pacing_target != null
    ? Math.max(0, number(row.pacing_target))
    : calculateMidnightPacingTarget({
        shiftLetters: pacing.shiftLetters,
        dailyLetterCount: number(row?.letter_count),
        remainingDaysInShift: pacing.remainingDaysInShift,
      });
  const dailyCount = number(row?.letter_count);
  const dailyRemaining = Math.max(0, dailyTarget - dailyCount);
  const targetReached = dailyTarget > 0 && dailyCount >= dailyTarget;

  if (targetReached && row && !Number(row.target_reached)) {
    await queryable.query(
      `UPDATE DailyLetterProgress
       SET target_reached = 1,
           target_reached_at = COALESCE(target_reached_at, NOW())
       WHERE tracking_date = ?`,
      [pacing.date],
    );
    row = { ...row, target_reached: 1 };
  }

  return {
    date: pacing.date,
    shiftDay: pacing.shiftDay,
    totalDaysInShift: pacing.totalDaysInShift,
    shiftLetters: pacing.shiftLetters,
    remainingShiftLetters: pacing.remainingShiftLetters,
    remainingDaysInShift: pacing.remainingDaysInShift,
    currentRequiredPerDay: pacing.currentRequiredPerDay,
    dailyTarget,
    dailyLetterCount: dailyCount,
    dailyRemaining,
    targetReached,
    notificationSent: Boolean(row?.notification_sent),
    targetReachedAt: row?.target_reached_at || null,
    pacingTargetSetAt: row?.pacing_target_set_at || null,
  };
};

export const getDailyLetterStatus = getDailyPacingStatus;

export const recordDailyLetters = async (connection, lettersAdded) => {
  await ensureDailyLetterTable();

  const amount = number(lettersAdded);
  if (amount <= 0) {
    return getDailyPacingStatus(connection);
  }

  const pacingBefore = await getCurrentShiftPacing(connection);
  let row = await readDailyRow(connection, pacingBefore.date, true);

  // This controller updates MonthlyBudget.shiftLetters before calling us, so
  // pacingBefore.shiftLetters includes this new entry. To reconstruct the
  // midnight shift total, subtract both today's prior daily count and this entry.
  if (!row) {
    const midnightShiftLetters = Math.max(0, pacingBefore.shiftLetters - amount);
    const target = calculateTargetFromMidnightShiftTotal(
      midnightShiftLetters,
      pacingBefore.remainingDaysInShift,
    );
    await connection.query(
      `INSERT INTO DailyLetterProgress
        (tracking_date, letter_count, pacing_target, pacing_target_set_at, target_reached)
       VALUES (?, 0, ?, UTC_TIMESTAMP(), 0)
       ON DUPLICATE KEY UPDATE tracking_date = VALUES(tracking_date)`,
      [pacingBefore.date, target],
    );
    row = await readDailyRow(connection, pacingBefore.date, true);
  }

  if (row.pacing_target == null) {
    const midnightShiftLetters = Math.max(
      0,
      pacingBefore.shiftLetters - number(row.letter_count) - amount,
    );
    const target = calculateTargetFromMidnightShiftTotal(
      midnightShiftLetters,
      pacingBefore.remainingDaysInShift,
    );
    await connection.query(
      `UPDATE DailyLetterProgress
       SET pacing_target = ?, pacing_target_set_at = COALESCE(pacing_target_set_at, UTC_TIMESTAMP())
       WHERE tracking_date = ? AND pacing_target IS NULL`,
      [target, pacingBefore.date],
    );
  }

  await connection.query(
    `UPDATE DailyLetterProgress
     SET letter_count = letter_count + ?
     WHERE tracking_date = ?`,
    [amount, pacingBefore.date],
  );

  const updated = await readDailyRow(connection, pacingBefore.date, true);
  const dailyTarget = Math.max(0, number(updated?.pacing_target));
  const dailyCount = number(updated?.letter_count);
  const wasAlreadyReached = Boolean(updated?.target_reached);
  const reachedNow = dailyTarget > 0 && dailyCount >= dailyTarget;
  const justReached = reachedNow && !wasAlreadyReached;

  if (reachedNow) {
    await connection.query(
      `UPDATE DailyLetterProgress
       SET target_reached = 1,
           target_reached_at = COALESCE(target_reached_at, NOW())
       WHERE tracking_date = ?`,
      [pacingBefore.date],
    );
  }

  const pacingAfter = await getCurrentShiftPacing(connection);

  return {
    date: pacingAfter.date,
    shiftDay: pacingAfter.shiftDay,
    totalDaysInShift: pacingAfter.totalDaysInShift,
    shiftLetters: pacingAfter.shiftLetters,
    remainingShiftLetters: pacingAfter.remainingShiftLetters,
    remainingDaysInShift: pacingAfter.remainingDaysInShift,
    currentRequiredPerDay: pacingAfter.currentRequiredPerDay,
    dailyTarget,
    dailyLetterCount: dailyCount,
    dailyRemaining: Math.max(0, dailyTarget - dailyCount),
    targetReached: reachedNow,
    notificationSent: Boolean(updated?.notification_sent),
    targetReachedAt: justReached
      ? new Date()
      : updated?.target_reached_at || null,
    justReached,
  };
};

export const markDailyNotificationSent = async (trackingDate) => {
  await ensureDailyLetterTable();
  await pool.query(
    `UPDATE DailyLetterProgress
     SET notification_sent = 1
     WHERE tracking_date = ? AND target_reached = 1`,
    [trackingDate],
  );
};

export const markDailyNotificationUnsent = async (trackingDate) => {
  await ensureDailyLetterTable();
  await pool.query(
    `UPDATE DailyLetterProgress
     SET notification_sent = 0
     WHERE tracking_date = ?`,
    [trackingDate],
  );
};

export const getKigaliDateString = () => getKigaliTime().dateString;
export { getKigaliTime };