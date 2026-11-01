-- Separate daily records for letters translated in a friend's portal.
-- Does not alter MonthlyBudget, DailyLetterProgress, or existing earnings.
CREATE TABLE IF NOT EXISTS FriendPortalDailyLetters (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  work_date DATE NOT NULL,
  letters_count INT UNSIGNED NOT NULL,
  notes VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_friend_portal_daily_work_date (work_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
