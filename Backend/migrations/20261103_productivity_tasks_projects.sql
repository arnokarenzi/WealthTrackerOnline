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
