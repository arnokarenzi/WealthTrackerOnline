import { pool } from "../models/MonthlyBudget.js";

import {
  calculateShiftAdjustedFriendPortalEntries,
  FRIEND_PORTAL_FREE_LETTERS_PER_SHIFT,
  FRIEND_PORTAL_RATE_PER_LETTER,
  getFriendPortalShiftKey,
} from "../utils/friendPortalLettersMath.js";

export {
  calculateShiftAdjustedFriendPortalEntries,
  FRIEND_PORTAL_FREE_LETTERS_PER_SHIFT,
  FRIEND_PORTAL_RATE_PER_LETTER,
};

let lettersTableReadyPromise = null;
let payoutsTableReadyPromise = null;

const CREATE_LETTERS_TABLE = `
  CREATE TABLE IF NOT EXISTS FriendPortalDailyLetters (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    work_date DATE NOT NULL,
    letters_count INT UNSIGNED NOT NULL,
    notes VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_friend_portal_daily_work_date (work_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const CREATE_PAYOUTS_TABLE = `
  CREATE TABLE IF NOT EXISTS FriendPortalShiftPayouts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    shift_start DATE NOT NULL,
    shift_end DATE NOT NULL,
    total_letters INT UNSIGNED NOT NULL DEFAULT 0,
    excluded_letters INT UNSIGNED NOT NULL DEFAULT 0,
    payable_letters INT UNSIGNED NOT NULL DEFAULT 0,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    description VARCHAR(255) NOT NULL,
    is_collected TINYINT(1) NOT NULL DEFAULT 0,
    reset_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    collected_at TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_friend_portal_shift_start (shift_start),
    KEY idx_friend_portal_payout_pending (is_collected, reset_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

export const ensureFriendPortalLettersTable = async (queryable = pool) => {
  if (queryable !== pool) {
    await queryable.query(CREATE_LETTERS_TABLE);
    return;
  }
  if (!lettersTableReadyPromise) {
    lettersTableReadyPromise = pool.query(CREATE_LETTERS_TABLE).catch((error) => {
      lettersTableReadyPromise = null;
      throw error;
    });
  }
  await lettersTableReadyPromise;
};

export const ensureFriendPortalPayoutsTable = async (queryable = pool) => {
  if (queryable !== pool) {
    await queryable.query(CREATE_PAYOUTS_TABLE);
    return;
  }
  if (!payoutsTableReadyPromise) {
    payoutsTableReadyPromise = pool.query(CREATE_PAYOUTS_TABLE).catch((error) => {
      payoutsTableReadyPromise = null;
      throw error;
    });
  }
  await payoutsTableReadyPromise;
};

const toEntry = (row) => ({
  id: Number(row.id),
  workDate: row.work_date,
  lettersCount: Number(row.letters_count) || 0,
  notes: row.notes || "",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const shiftBoundsFromStart = (shiftStart) => {
  const match = /^(\d{4})-(\d{2})-(01|16)$/.exec(String(shiftStart || ""));
  if (!match) {
    const error = new Error("Shift start must be the first or sixteenth day of a month.");
    error.code = "INVALID_SHIFT_START";
    throw error;
  }

  const [, yearText, monthText, startDay] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const monthEndDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endDay = startDay === "01" ? 15 : monthEndDay;
  const shiftEnd = `${yearText}-${monthText}-${String(endDay).padStart(2, "0")}`;

  return { shiftStart, shiftEnd };
};

const getShiftStartForWorkDate = (workDate) => {
  const key = getFriendPortalShiftKey(workDate);
  if (key === "invalid-date") {
    const error = new Error("A valid work date is required.");
    error.code = "INVALID_WORK_DATE";
    throw error;
  }
  const [year, month, half] = key.split("-");
  return `${year}-${month}-${half === "1" ? "01" : "16"}`;
};

const sumEntries = (entries) => entries.reduce(
  (total, entry) => ({
    totalLetters: total.totalLetters + entry.lettersCount,
    excludedLetters: total.excludedLetters + entry.excludedLetters,
    payableLetters: total.payableLetters + entry.payableLetters,
    earnings: total.earnings + entry.earnings,
  }),
  { totalLetters: 0, excludedLetters: 0, payableLetters: 0, earnings: 0 },
);

export const getFriendPortalLetterRecords = async (startDate, endDate) => {
  await Promise.all([
    ensureFriendPortalLettersTable(),
    ensureFriendPortalPayoutsTable(),
  ]);

  const [rows] = await pool.query(
    `SELECT id, DATE_FORMAT(work_date, '%Y-%m-%d') AS work_date,
            letters_count, notes, created_at, updated_at
       FROM FriendPortalDailyLetters
      WHERE work_date >= ? AND work_date < DATE_ADD(?, INTERVAL 1 DAY)
      ORDER BY work_date ASC, id ASC`,
    [startDate, endDate],
  );

  const entries = calculateShiftAdjustedFriendPortalEntries(rows.map(toEntry));
  const summary = sumEntries(entries);
  const month = startDate.slice(0, 7);
  const [year, monthNumber] = month.split("-").map(Number);
  const monthEndDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const bounds = [
    { shiftStart: `${month}-01`, shiftEnd: `${month}-15` },
    { shiftStart: `${month}-16`, shiftEnd: `${month}-${String(monthEndDay).padStart(2, "0")}` },
  ];

  const [payoutRows] = await pool.query(
    `SELECT id, DATE_FORMAT(shift_start, '%Y-%m-%d') AS shift_start,
            DATE_FORMAT(shift_end, '%Y-%m-%d') AS shift_end,
            total_letters, excluded_letters, payable_letters, amount,
            is_collected, reset_at, collected_at
       FROM FriendPortalShiftPayouts
      WHERE shift_start IN (?, ?)`,
    bounds.map((item) => item.shiftStart),
  );
  const payoutByStart = new Map(payoutRows.map((row) => [row.shift_start, row]));

  const shiftSummaries = bounds.map(({ shiftStart, shiftEnd }) => {
    const shiftEntries = entries.filter(
      (entry) => entry.workDate >= shiftStart && entry.workDate <= shiftEnd,
    );
    const totals = sumEntries(shiftEntries);
    const payout = payoutByStart.get(shiftStart);
    return {
      shiftStart,
      shiftEnd,
      ...totals,
      status: !payout
        ? "open"
        : (Number(payout.amount) <= 0
          ? "no_payable"
          : (Number(payout.is_collected) === 1 ? "collected" : "pending")),
      payoutId: payout ? Number(payout.id) : null,
      payoutAmount: payout ? Number(payout.amount) || 0 : null,
      resetAt: payout?.reset_at || null,
      collectedAt: payout?.collected_at || null,
    };
  });

  return {
    policy: {
      deductionScope: "per 15-day shift",
      excludedLettersPerShift: FRIEND_PORTAL_FREE_LETTERS_PER_SHIFT,
      ratePerLetter: FRIEND_PORTAL_RATE_PER_LETTER,
    },
    summary,
    shiftSummaries,
    entries,
  };
};

const assertShiftIsOpen = async (queryable, workDate) => {
  const shiftStart = getShiftStartForWorkDate(workDate);
  const [closedRows] = await queryable.query(
    "SELECT id FROM FriendPortalShiftPayouts WHERE shift_start = ? FOR UPDATE",
    [shiftStart],
  );
  if (closedRows.length) {
    const error = new Error("This friend-portal shift has already been reset. Its daily records are locked.");
    error.code = "FRIEND_PORTAL_SHIFT_CLOSED";
    throw error;
  }
};

export const saveFriendPortalDailyLetters = async ({ workDate, lettersCount, notes }) => {
  await Promise.all([
    ensureFriendPortalLettersTable(),
    ensureFriendPortalPayoutsTable(),
  ]);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await assertShiftIsOpen(connection, workDate);
    await connection.query(
      `INSERT INTO FriendPortalDailyLetters (work_date, letters_count, notes)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         letters_count = VALUES(letters_count),
         notes = VALUES(notes),
         updated_at = CURRENT_TIMESTAMP`,
      [workDate, lettersCount, notes || null],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const monthStart = `${workDate.slice(0, 7)}-01`;
  const [year, month] = workDate.split("-").map(Number);
  const monthEndDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthEnd = `${workDate.slice(0, 7)}-${String(monthEndDay).padStart(2, "0")}`;
  const monthRecords = await getFriendPortalLetterRecords(monthStart, monthEnd);
  return monthRecords.entries.find((entry) => entry.workDate === workDate);
};

export const deleteFriendPortalDailyLetters = async (id) => {
  await Promise.all([
    ensureFriendPortalLettersTable(),
    ensureFriendPortalPayoutsTable(),
  ]);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [dateRows] = await connection.query(
      "SELECT DATE_FORMAT(work_date, '%Y-%m-%d') AS work_date FROM FriendPortalDailyLetters WHERE id = ?",
      [id],
    );
    if (!dateRows.length) {
      await connection.commit();
      return false;
    }
    // Lock the shift key before locking/deleting its daily row. Reset uses the
    // same lock order, avoiding a delete-versus-reset deadlock.
    await assertShiftIsOpen(connection, dateRows[0].work_date);
    const [lockedRows] = await connection.query(
      "SELECT id FROM FriendPortalDailyLetters WHERE id = ? FOR UPDATE",
      [id],
    );
    if (!lockedRows.length) {
      await connection.commit();
      return false;
    }
    const [result] = await connection.query(
      "DELETE FROM FriendPortalDailyLetters WHERE id = ?",
      [id],
    );
    await connection.commit();
    return result.affectedRows > 0;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const resetFriendPortalShift = async (shiftStart) => {
  await Promise.all([
    ensureFriendPortalLettersTable(),
    ensureFriendPortalPayoutsTable(),
  ]);
  const { shiftEnd } = shiftBoundsFromStart(shiftStart);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [existingRows] = await connection.query(
      `SELECT id, amount, total_letters, excluded_letters, payable_letters,
              is_collected
         FROM FriendPortalShiftPayouts
        WHERE shift_start = ? FOR UPDATE`,
      [shiftStart],
    );

    if (existingRows.length) {
      await connection.commit();
      const existing = existingRows[0];
      return {
        alreadyReset: true,
        payoutId: Number(existing.id),
        amount: Number(existing.amount) || 0,
        totalLetters: Number(existing.total_letters) || 0,
        excludedLetters: Number(existing.excluded_letters) || 0,
        payableLetters: Number(existing.payable_letters) || 0,
        status: Number(existing.amount) <= 0
          ? "no_payable"
          : (Number(existing.is_collected) === 1 ? "collected" : "pending"),
      };
    }

    const [rows] = await connection.query(
      `SELECT id, DATE_FORMAT(work_date, '%Y-%m-%d') AS work_date,
              letters_count, notes, created_at, updated_at
         FROM FriendPortalDailyLetters
        WHERE work_date >= ? AND work_date <= ?
        ORDER BY work_date ASC, id ASC
        FOR UPDATE`,
      [shiftStart, shiftEnd],
    );
    if (!rows.length) {
      const error = new Error("This shift has no recorded friend-portal letters to reset.");
      error.code = "FRIEND_PORTAL_SHIFT_EMPTY";
      throw error;
    }

    const entries = calculateShiftAdjustedFriendPortalEntries(rows.map(toEntry));
    const totals = sumEntries(entries);
    const amount = totals.earnings;
    const description = `Friend Portal Payout: ${shiftStart} to ${shiftEnd} (${totals.totalLetters} letters)`;

    const [insertResult] = await connection.query(
      `INSERT INTO FriendPortalShiftPayouts
         (shift_start, shift_end, total_letters, excluded_letters,
          payable_letters, amount, description, is_collected)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        shiftStart,
        shiftEnd,
        totals.totalLetters,
        totals.excludedLetters,
        totals.payableLetters,
        amount,
        description,
      ],
    );

    await connection.commit();
    return {
      alreadyReset: false,
      payoutId: Number(insertResult.insertId),
      shiftStart,
      shiftEnd,
      ...totals,
      amount,
      status: amount > 0 ? "pending" : "no_payable_earnings",
    };
  } catch (error) {
    await connection.rollback();
    if (error.code === "ER_DUP_ENTRY") {
      const [rows] = await connection.query(
        `SELECT id, amount, total_letters, excluded_letters, payable_letters,
                is_collected
           FROM FriendPortalShiftPayouts WHERE shift_start = ?`,
        [shiftStart],
      );
      if (rows.length) {
        const existing = rows[0];
        return {
          alreadyReset: true,
          payoutId: Number(existing.id),
          amount: Number(existing.amount) || 0,
          totalLetters: Number(existing.total_letters) || 0,
          excludedLetters: Number(existing.excluded_letters) || 0,
          payableLetters: Number(existing.payable_letters) || 0,
          status: Number(existing.amount) <= 0
          ? "no_payable"
          : (Number(existing.is_collected) === 1 ? "collected" : "pending"),
        };
      }
    }
    throw error;
  } finally {
    connection.release();
  }
};

export const getPendingFriendPortalPayouts = async () => {
  await ensureFriendPortalPayoutsTable();
  const [rows] = await pool.query(
    `SELECT id, DATE_FORMAT(shift_start, '%Y-%m-%d') AS shift_start,
            DATE_FORMAT(shift_end, '%Y-%m-%d') AS shift_end,
            total_letters, excluded_letters, payable_letters, amount,
            description, reset_at
       FROM FriendPortalShiftPayouts
      WHERE is_collected = 0 AND amount > 0
      ORDER BY reset_at DESC, id DESC`,
  );
  return rows.map((row) => ({
    id: Number(row.id),
    shiftStart: row.shift_start,
    shiftEnd: row.shift_end,
    totalLetters: Number(row.total_letters) || 0,
    excludedLetters: Number(row.excluded_letters) || 0,
    payableLetters: Number(row.payable_letters) || 0,
    amount: Number(row.amount) || 0,
    description: row.description,
    resetAt: row.reset_at,
  }));
};

export const claimFriendPortalPayout = async (id) => {
  await ensureFriendPortalPayoutsTable();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT id, amount, description, is_collected
         FROM FriendPortalShiftPayouts
        WHERE id = ? AND is_collected = 0 AND amount > 0
        FOR UPDATE`,
      [id],
    );

    if (!rows.length) {
      await connection.commit();
      return null;
    }

    const payout = rows[0];
    const amount = Number(payout.amount) || 0;
    const [budgetRows] = await connection.query(
      "SELECT id FROM MonthlyBudget WHERE id = 1 FOR UPDATE",
    );
    if (!budgetRows.length) {
      const error = new Error("The active wallet record (MonthlyBudget id 1) was not found.");
      error.code = "WALLET_NOT_FOUND";
      throw error;
    }

    await connection.query(
      "UPDATE MonthlyBudget SET balance = COALESCE(balance, 0) + ? WHERE id = 1",
      [amount],
    );
    await connection.query(
      "UPDATE FriendPortalShiftPayouts SET is_collected = 1, collected_at = NOW() WHERE id = ? AND is_collected = 0",
      [id],
    );
    await connection.query(
      "INSERT INTO WalletIncome (amount, description, source_type) VALUES (?, ?, 'side_income')",
      [amount, payout.description],
    );

    await connection.commit();
    return { collectedAmount: amount, description: payout.description };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
