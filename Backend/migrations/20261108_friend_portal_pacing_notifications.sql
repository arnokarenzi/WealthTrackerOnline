-- Friend Portal shift-pacing push delivery log.
-- Additive only; does not alter daily letters, finalized payouts, or wallet data.

CREATE TABLE IF NOT EXISTS FriendPortalPacingNotificationLog (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tracking_date DATE NOT NULL,
  trigger_key VARCHAR(24) NOT NULL,
  sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_friend_portal_pacing_trigger (tracking_date, trigger_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
