import { pool } from "../../models/MonthlyBudget.js";
import { getKigaliDateString } from "../../utils/kigaliTime.js";
import { getReviewWeekEnd } from "../../utils/productivityReviewsValidation.js";

const dateValue = (value) => value instanceof Date ? getKigaliDateString(value) : String(value).slice(0, 10);

const mapDailyReview = (row) => row ? ({
  id: Number(row.id), reviewDate: dateValue(row.review_date),
  moodRating: row.mood_rating == null ? null : Number(row.mood_rating),
  energyRating: row.energy_rating == null ? null : Number(row.energy_rating),
  wins: row.wins || "", challenges: row.challenges || "", lessons: row.lessons || "",
  gratitude: row.gratitude || "", tomorrowPriorities: row.tomorrow_priorities || "", notes: row.notes || "",
  createdAt: row.created_at, updatedAt: row.updated_at,
}) : null;

const mapWeeklyReview = (row) => row ? ({
  id: Number(row.id), weekStart: dateValue(row.week_start), weekEnd: dateValue(row.week_end),
  overallRating: row.overall_rating == null ? null : Number(row.overall_rating),
  wins: row.wins || "", challenges: row.challenges || "", lessons: row.lessons || "",
  nextWeekPriorities: row.next_week_priorities || "", notes: row.notes || "",
  createdAt: row.created_at, updatedAt: row.updated_at,
}) : null;

const DAILY_SELECT = `SELECT id, review_date, mood_rating, energy_rating, wins, challenges, lessons,
                             gratitude, tomorrow_priorities, notes, created_at, updated_at
                        FROM ProductivityDailyReviews`;
const WEEKLY_SELECT = `SELECT id, week_start, week_end, overall_rating, wins, challenges, lessons,
                              next_week_priorities, notes, created_at, updated_at
                         FROM ProductivityWeeklyReviews`;

export const getDailyReview = async (reviewDate) => {
  const [rows] = await pool.query(`${DAILY_SELECT} WHERE review_date = ? LIMIT 1`, [reviewDate]);
  return mapDailyReview(rows[0]);
};

export const saveDailyReview = async (values) => {
  await pool.query(
    `INSERT INTO ProductivityDailyReviews
      (review_date, mood_rating, energy_rating, wins, challenges, lessons, gratitude, tomorrow_priorities, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE mood_rating = VALUES(mood_rating), energy_rating = VALUES(energy_rating),
       wins = VALUES(wins), challenges = VALUES(challenges), lessons = VALUES(lessons),
       gratitude = VALUES(gratitude), tomorrow_priorities = VALUES(tomorrow_priorities),
       notes = VALUES(notes), updated_at = CURRENT_TIMESTAMP`,
    [values.reviewDate, values.moodRating, values.energyRating, values.wins, values.challenges,
      values.lessons, values.gratitude, values.tomorrowPriorities, values.notes],
  );
  return getDailyReview(values.reviewDate);
};

export const listDailyReviewHistory = async (limit = 30) => {
  const [rows] = await pool.query(`${DAILY_SELECT} ORDER BY review_date DESC LIMIT ?`, [limit]);
  return rows.map(mapDailyReview);
};

export const getWeeklyReview = async (weekStart) => {
  const [rows] = await pool.query(`${WEEKLY_SELECT} WHERE week_start = ? LIMIT 1`, [weekStart]);
  return mapWeeklyReview(rows[0]);
};

export const saveWeeklyReview = async (values) => {
  const weekEnd = getReviewWeekEnd(values.weekStart);
  await pool.query(
    `INSERT INTO ProductivityWeeklyReviews
      (week_start, week_end, overall_rating, wins, challenges, lessons, next_week_priorities, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE week_end = VALUES(week_end), overall_rating = VALUES(overall_rating),
       wins = VALUES(wins), challenges = VALUES(challenges), lessons = VALUES(lessons),
       next_week_priorities = VALUES(next_week_priorities), notes = VALUES(notes),
       updated_at = CURRENT_TIMESTAMP`,
    [values.weekStart, weekEnd, values.overallRating, values.wins, values.challenges,
      values.lessons, values.nextWeekPriorities, values.notes],
  );
  return getWeeklyReview(values.weekStart);
};

export const listWeeklyReviewHistory = async (limit = 20) => {
  const [rows] = await pool.query(`${WEEKLY_SELECT} ORDER BY week_start DESC LIMIT ?`, [limit]);
  return rows.map(mapWeeklyReview);
};
