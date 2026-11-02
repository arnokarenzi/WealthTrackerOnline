-- FinTrack Productivity Phase 3: Calendar events
-- Additive migration. Task dates remain stored in ProductivityTasks.
-- Calendar events are independent records; no financial table is modified.

CREATE TABLE IF NOT EXISTS ProductivityCalendarEvents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  event_date DATE NOT NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  is_all_day TINYINT(1) NOT NULL DEFAULT 0,
  color VARCHAR(7) NOT NULL DEFAULT '#1976d2',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_productivity_calendar_event_date (event_date),
  KEY idx_productivity_calendar_event_start (event_date, start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
