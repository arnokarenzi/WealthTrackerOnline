import { pool } from "../models/MonthlyBudget.js";

// Gold shift configuration used by the existing Shift Engine.
export const MAX_SHIFT_LETTERS = 750;
export const GOLD_PACING_ALERT_HOURS = [8, 12, 18];

const TIME_ZONE = "Africa/Kigali";

const getKigaliTime = () => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((part) => [part.type, part.value]),
  );

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;
  const minute = Number(parts.minute);
  const second = Number(parts.second);
  const pad = (value) => String(value).padStart(2, "0");

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dateString: `${year}-${pad(month)}-${pad(day)}`,
    dateTimeString: `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`,
    lastDayOfMonth: new Date(year, month, 0).getDate(),
  };
};

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
    shiftLetters,
    remainingShiftLetters,
    currentRequiredPerDay,
    ...shiftWindow,
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

// Called by the 08:00 Kigali scheduled job. This is the day's frozen target.

export const ensureDailyTargetInitialized = async (queryable = pool) => {
  await ensureDailyLetterTable();
  const pacing = await getCurrentShiftPacing(queryable);
  const existing = await readDailyRow(queryable, pacing.date, false);

  if (!existing) {
    await queryable.query(
      `INSERT INTO DailyLetterProgress
        (tracking_date, letter_count, pacing_target, pacing_target_set_at, target_reached)
       VALUES (?, 0, ?, NOW(), 0)`,
      [pacing.date, pacing.currentRequiredPerDay],
    );
  }

  return getDailyPacingStatus(queryable);
};

export const lockMorningPacingTarget = async (queryable = pool) => {
  await ensureDailyLetterTable();

  const pacing = await getCurrentShiftPacing(queryable);
  const existing = await readDailyRow(queryable, pacing.date, false);

  if (!existing) {
    await queryable.query(
      `INSERT INTO DailyLetterProgress
        (tracking_date, letter_count, pacing_target, pacing_target_set_at, target_reached)
       VALUES (?, 0, ?, NOW(), 0)`,
      [pacing.date, pacing.currentRequiredPerDay],
    );
  } else if (!Number(existing.target_reached)) {
    // Recompute the morning target from the 08:00 state. This is deliberately
    // different from the dynamic headline required-per-day used at 12:00/18:00.
    await queryable.query(
      `UPDATE DailyLetterProgress
       SET pacing_target = ?, pacing_target_set_at = NOW(),
           target_reached = CASE
             WHEN letter_count >= ? AND ? > 0 THEN 1
             ELSE target_reached
           END
       WHERE tracking_date = ?`,
      [
        pacing.currentRequiredPerDay,
        pacing.currentRequiredPerDay,
        pacing.currentRequiredPerDay,
        pacing.date,
      ],
    );
  }

  return getDailyPacingStatus(queryable);
};

// Returns today's frozen target plus the live shift pacing figures.
export const getDailyPacingStatus = async (queryable = pool) => {
  await ensureDailyLetterTable();

  const pacing = await getCurrentShiftPacing(queryable);
  let row = await readDailyRow(queryable, pacing.date, false);

  // If today's row does not exist yet, expose the current calculated target
  // without persistently locking it. The 08:00 scheduler will lock the target.
  const dailyTarget = row?.pacing_target != null
    ? Math.max(0, number(row.pacing_target))
    : pacing.currentRequiredPerDay;
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

  // A letter entry before 08:00 can still reach the target. In that case,
  // initialize a provisional target from the state before this new entry.
  if (!row) {
    await connection.query(
      `INSERT INTO DailyLetterProgress
        (tracking_date, letter_count, pacing_target, pacing_target_set_at, target_reached)
       VALUES (?, 0, ?, NOW(), 0)`,
      [pacingBefore.date, pacingBefore.currentRequiredPerDay],
    );
    row = await readDailyRow(connection, pacingBefore.date, true);
  }

  if (row.pacing_target == null) {
    await connection.query(
      `UPDATE DailyLetterProgress
       SET pacing_target = ?, pacing_target_set_at = NOW()
       WHERE tracking_date = ?`,
      [pacingBefore.currentRequiredPerDay, pacingBefore.date],
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
