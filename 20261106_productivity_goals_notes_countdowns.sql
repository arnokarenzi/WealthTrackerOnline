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
