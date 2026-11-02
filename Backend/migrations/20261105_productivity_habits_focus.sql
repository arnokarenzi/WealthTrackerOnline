-- FinTrack Productivity Phase 4: Habits and Focus Sessions
-- Additive migration. Does not alter financial or prior productivity tables.
-- Current FinTrack has no account/session ownership model; records use its
-- existing single-workspace model, like the other productivity modules.

CREATE TABLE IF NOT EXISTS ProductivityHabits (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  category VARCHAR(60) NULL,
  frequency ENUM('daily', 'selected_days') NOT NULL DEFAULT 'daily',
  days_of_week VARCHAR(20) NULL COMMENT 'Comma-separated weekday numbers; Sunday=0 through Saturday=6',
  color VARCHAR(7) NOT NULL DEFAULT '#1976d2',
  status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_productivity_habits_status (status),
  KEY idx_productivity_habits_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ProductivityHabitLogs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  habit_id BIGINT UNSIGNED NOT NULL,
  log_date DATE NOT NULL,
  is_completed TINYINT(1) NOT NULL DEFAULT 0,
  notes VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_productivity_habit_log_date (habit_id, log_date),
  KEY idx_productivity_habit_logs_date (log_date),
  CONSTRAINT fk_productivity_habit_logs_habit
    FOREIGN KEY (habit_id) REFERENCES ProductivityHabits(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ProductivityFocusSessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_type ENUM('focus', 'short_break', 'long_break') NOT NULL DEFAULT 'focus',
  status ENUM('completed', 'cancelled') NOT NULL DEFAULT 'completed',
  task_id BIGINT UNSIGNED NULL,
  planned_minutes SMALLINT UNSIGNED NOT NULL,
  actual_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  started_at DATETIME NOT NULL,
  ended_at DATETIME NOT NULL,
  notes VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_productivity_focus_started (started_at),
  KEY idx_productivity_focus_type_status (session_type, status),
  KEY idx_productivity_focus_task (task_id),
  CONSTRAINT fk_productivity_focus_task
    FOREIGN KEY (task_id) REFERENCES ProductivityTasks(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
