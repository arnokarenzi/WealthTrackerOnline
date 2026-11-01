-- Separate receivables for friend-portal translations.
-- Does not alter or reset the existing personal PendingEarnings workflow.
CREATE TABLE IF NOT EXISTS FriendPortalShiftPayouts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  shift_start DATE NOT NULL,
  shift_end DATE NOT NULL,
  total_letters INT UNSIGNED NOT NULL DEFAULT 0,
  excluded_letters INT UNSIGNED NOT NULL DEFAULT 0,
  payable_letters INT UNSIGNED NOT NULL DEFAULT 0,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  description VARCHAR(255) NOT NULL,
  is_collected TINYINT(1) NOT NULL DEFAULT 0,
  reset_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  collected_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_friend_portal_shift_start (shift_start),
  KEY idx_friend_portal_payout_pending (is_collected, reset_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
