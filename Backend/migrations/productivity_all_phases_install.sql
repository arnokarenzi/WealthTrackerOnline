-- FinTrack Productivity Suite: consolidated installer for Phases 1–6.
-- For MariaDB/MySQL on Aiven. Select the target database in the mysql command.
-- IMPORTANT: Back up defaultdb before running this file.
-- This file combines only the six productivity migrations in dependency order.
-- It uses CREATE TABLE IF NOT EXISTS and INSERT IGNORE for the default settings row.
-- It does not DROP, TRUNCATE, DELETE, or ALTER existing financial tables.
-- Existing tables with an unexpected schema are NOT repaired by IF NOT EXISTS;
-- verify the installed schema if a table already exists but behaves incorrectly.

SET NAMES utf8mb4;


-- ===== BEGIN 20261102_productivity_foundation.sql =====
-- FinTrack Productivity Foundation
-- Additive MariaDB/MySQL-compatible migration. It does not modify existing financial tables.
-- The current FinTrack source has no login/session middleware or per-user account model.
-- Therefore these preferences follow the existing single-workspace application model.
-- Do not expose this application as a multi-user service until authentication and owner scoping
-- have been implemented for the productivity and existing financial APIs.

CREATE TABLE IF NOT EXISTS ProductivitySettings (
  id TINYINT UNSIGNED NOT NULL,
  week_starts_on ENUM('monday', 'sunday') NOT NULL DEFAULT 'monday',
  default_calendar_view ENUM('day', 'week', 'month') NOT NULL DEFAULT 'week',
  default_focus_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 25,
  short_break_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 5,
  long_break_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 15,
  long_break_after_sessions TINYINT UNSIGNED NOT NULL DEFAULT 4,
  reminders_enabled TINYINT(1) NOT NULL DEFAULT 1,
  focus_sound_enabled TINYINT(1) NOT NULL DEFAULT 0,
  time_zone VARCHAR(64) NOT NULL DEFAULT 'Africa/Kigali',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO ProductivitySettings (
  id,
  week_starts_on,
  default_calendar_view,
  default_focus_minutes,
  short_break_minutes,
  long_break_minutes,
  long_break_after_sessions,
  reminders_enabled,
  focus_sound_enabled,
  time_zone
) VALUES (
  1,
  'monday',
  'week',
  25,
  5,
  15,
  4,
  1,
  0,
  'Africa/Kigali'
);
-- ===== END 20261102_productivity_foundation.sql =====

-- ===== BEGIN 20261103_productivity_tasks_projects.sql =====
-- FinTrack Productivity Phase 2: Tasks, Projects and My Day
-- Additive MariaDB/MySQL migration. Does not modify financial tables.
-- The current application has no authentication/owner model; these records
-- follow the existing single-workspace model until account isolation is built.

CREATE TABLE IF NOT EXISTS ProductivityProjects (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#1976d2',
  status ENUM('active', 'completed', 'archived') NOT NULL DEFAULT 'active',
  target_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_productivity_projects_status (status),
  KEY idx_productivity_projects_target_date (target_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ProductivityTasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id BIGINT UNSIGNED NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  status ENUM('todo', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'todo',
  priority ENUM('none', 'low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  due_date DATE NULL,
  due_time TIME NULL,
  scheduled_date DATE NULL,
  scheduled_start_time TIME NULL,
  estimated_minutes SMALLINT UNSIGNED NULL,
  is_important TINYINT(1) NOT NULL DEFAULT 0,
  is_urgent TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  completed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_productivity_tasks_project (project_id),
  KEY idx_productivity_tasks_status (status),
  KEY idx_productivity_tasks_due_date (due_date),
  KEY idx_productivity_tasks_scheduled_date (scheduled_date),
  KEY idx_productivity_tasks_completed_at (completed_at),
  KEY idx_productivity_tasks_priority (priority),
  CONSTRAINT fk_productivity_tasks_project
    FOREIGN KEY (project_id) REFERENCES ProductivityProjects(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ProductivityTaskSubtasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  task_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  is_completed TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  completed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_productivity_subtasks_task (task_id),
  CONSTRAINT fk_productivity_subtasks_task
    FOREIGN KEY (task_id) REFERENCES ProductivityTasks(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- ===== END 20261103_productivity_tasks_projects.sql =====

-- ===== BEGIN 20261104_productivity_calendar_events.sql =====
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
-- ===== END 20261104_productivity_calendar_events.sql =====

-- ===== BEGIN 20261105_productivity_habits_focus.sql =====
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
-- ===== END 20261105_productivity_habits_focus.sql =====

-- ===== BEGIN 20261106_productivity_goals_notes_countdowns.sql =====
-- FinTrack Productivity Phase 5: Goals, milestones, notes and countdowns.
-- Additive MariaDB/MySQL migration. Does not alter financial or prior productivity tables.
-- Records follow the existing shared single-workspace model because this installation
-- does not yet have authentication or per-user ownership.

CREATE TABLE IF NOT EXISTS ProductivityGoals (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  category VARCHAR(60) NULL,
  status ENUM('active', 'completed', 'archived') NOT NULL DEFAULT 'active',
  start_date DATE NULL,
  target_date DATE NULL,
  progress_mode ENUM('milestones', 'manual') NOT NULL DEFAULT 'milestones',
  manual_progress TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_productivity_goals_status (status),
  KEY idx_productivity_goals_target_date (target_date),
  KEY idx_productivity_goals_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ProductivityGoalMilestones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  goal_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  due_date DATE NULL,
  is_completed TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  completed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_productivity_goal_milestones_goal (goal_id, sort_order),
  KEY idx_productivity_goal_milestones_due (due_date),
  CONSTRAINT fk_productivity_goal_milestones_goal
    FOREIGN KEY (goal_id) REFERENCES ProductivityGoals(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ProductivityNotes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(200) NULL,
  content LONGTEXT NOT NULL,
  category VARCHAR(60) NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#fff4cc',
  is_pinned TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_productivity_notes_status_pinned (status, is_pinned),
  KEY idx_productivity_notes_category (category),
  KEY idx_productivity_notes_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ProductivityCountdowns (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(150) NOT NULL,
  description TEXT NULL,
  event_date DATE NOT NULL,
  event_time TIME NULL,
  category VARCHAR(60) NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#1976d2',
  recurrence ENUM('none', 'yearly') NOT NULL DEFAULT 'none',
  status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_productivity_countdowns_status_date (status, event_date),
  KEY idx_productivity_countdowns_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- ===== END 20261106_productivity_goals_notes_countdowns.sql =====

-- ===== BEGIN 20261107_productivity_reviews_insights.sql =====
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
-- ===== END 20261107_productivity_reviews_insights.sql =====
