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
