-- FinTrack unified push notifications.
-- Additive migration: stores idempotency/delivery attempts only; it does not
-- alter PushSubscriptions, financial records, wallet balances or productivity data.
-- Existing Web Push/VAPID subscriptions are reused.

CREATE TABLE IF NOT EXISTS PushNotificationDeliveryLog (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_key_hash CHAR(64) NOT NULL,
  category VARCHAR(40) NOT NULL,
  event_key VARCHAR(240) NOT NULL,
  title VARCHAR(180) NOT NULL,
  status ENUM('sending', 'accepted', 'no_subscriptions', 'failed') NOT NULL DEFAULT 'sending',
  attempted_count INT UNSIGNED NOT NULL DEFAULT 0,
  accepted_count INT UNSIGNED NOT NULL DEFAULT 0,
  last_error VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_push_notification_event (event_key_hash),
  KEY idx_push_notification_category_date (category, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
