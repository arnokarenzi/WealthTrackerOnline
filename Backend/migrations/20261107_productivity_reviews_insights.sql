-- FinTrack Productivity Phase 6: Daily Reviews, Weekly Reviews and Productivity Insights.
-- Additive MariaDB/MySQL migration. Insights are calculated from existing productivity records;
-- only daily and weekly review records are stored by this migration.
-- Current FinTrack has no account/session ownership model, so this remains a shared workspace.

CREATE TABLE IF NOT EXISTS ProductivityDailyReviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  review_date DATE NOT NULL,
  mood_rating TINYINT UNSIGNED NULL,
  energy_rating TINYINT UNSIGNED NULL,
  wins TEXT NULL,
  challenges TEXT NULL,
  lessons TEXT NULL,
  gratitude TEXT NULL,
  tomorrow_priorities TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_productivity_daily_review_date (review_date),
  KEY idx_productivity_daily_reviews_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ProductivityWeeklyReviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  overall_rating TINYINT UNSIGNED NULL,
  wins TEXT NULL,
  challenges TEXT NULL,
  lessons TEXT NULL,
  next_week_priorities TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_productivity_weekly_review_start (week_start),
  KEY idx_productivity_weekly_reviews_end (week_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
