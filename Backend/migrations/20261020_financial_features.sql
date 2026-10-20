-- FinTrack feature integration migration (MySQL 8+).
-- Additive only: this migration does not reset, replace, or rewrite existing financial records.
-- The current application has no login/session middleware and its existing financial tables are
-- single-tenant, so these new tables follow the same deployment model. Do not use this model for
-- multiple users until authenticated ownership scoping is implemented throughout the application.

CREATE TABLE IF NOT EXISTS Bills (
  id INT NOT NULL AUTO_INCREMENT,
  bill_name VARCHAR(160) NOT NULL,
  vendor VARCHAR(160) NOT NULL DEFAULT '',
  status ENUM('unpaid','paid') NOT NULL DEFAULT 'unpaid',
  payment_date DATE NULL,
  due_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  frequency VARCHAR(32) NOT NULL DEFAULT 'Monthly',
  payment_method VARCHAR(80) NOT NULL DEFAULT '',
  category VARCHAR(100) NOT NULL DEFAULT 'Other',
  notes VARCHAR(500) NOT NULL DEFAULT '',
  notify_enabled TINYINT(1) NOT NULL DEFAULT 0,
  auto_pay TINYINT(1) NOT NULL DEFAULT 0,
  is_archived TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bills_due_status (status, due_date),
  KEY idx_bills_archived_due (is_archived, due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS BillPayments (
  id BIGINT NOT NULL AUTO_INCREMENT,
  bill_id INT NOT NULL,
  request_id VARCHAR(100) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method VARCHAR(80) NOT NULL DEFAULT '',
  notes VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bill_payment_request (request_id),
  KEY idx_bill_payments_bill_date (bill_id, payment_date),
  CONSTRAINT fk_bill_payments_bill FOREIGN KEY (bill_id) REFERENCES Bills(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS Debts (
  id INT NOT NULL AUTO_INCREMENT,
  creditor VARCHAR(160) NOT NULL,
  debt_type VARCHAR(100) NOT NULL,
  original_balance DECIMAL(12,2) NOT NULL,
  current_balance DECIMAL(12,2) NOT NULL,
  interest_rate DECIMAL(7,4) NULL,
  minimum_payment DECIMAL(12,2) NULL,
  due_date DATE NULL,
  loan_term VARCHAR(100) NOT NULL DEFAULT '',
  frequency VARCHAR(32) NOT NULL DEFAULT 'Monthly',
  payment_method VARCHAR(80) NOT NULL DEFAULT '',
  status ENUM('active','paid_off') NOT NULL DEFAULT 'active',
  is_archived TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_debts_status_due (status, due_date),
  KEY idx_debts_archived (is_archived)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS DebtPayments (
  id BIGINT NOT NULL AUTO_INCREMENT,
  debt_id INT NOT NULL,
  request_id VARCHAR(100) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  balance_before DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method VARCHAR(80) NOT NULL DEFAULT '',
  reference VARCHAR(120) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_debt_payment_request (request_id),
  KEY idx_debt_payments_debt_date (debt_id, payment_date),
  CONSTRAINT fk_debt_payments_debt FOREIGN KEY (debt_id) REFERENCES Debts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS NetWorthAssets (
  id INT NOT NULL AUTO_INCREMENT,
  asset_name VARCHAR(160) NOT NULL,
  asset_type VARCHAR(100) NOT NULL,
  current_value DECIMAL(14,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'RWF',
  acquisition_date DATE NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  is_archived TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_networth_assets_archived (is_archived)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS NetWorthSnapshots (
  id BIGINT NOT NULL AUTO_INCREMENT,
  snapshot_date DATE NOT NULL,
  total_assets DECIMAL(14,2) NOT NULL,
  total_liabilities DECIMAL(14,2) NOT NULL,
  net_worth DECIMAL(14,2) NOT NULL,
  breakdown_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_networth_snapshot_date (snapshot_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS AppSettings (
  id TINYINT UNSIGNED NOT NULL,
  display_name VARCHAR(50) NOT NULL DEFAULT '',
  theme_mode ENUM('light','dark') NOT NULL DEFAULT 'light',
  preferences JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_app_settings_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO AppSettings (id, display_name, theme_mode, preferences)
VALUES (
  1,
  '',
  'light',
  JSON_OBJECT(
    'dateFormat', 'dd/MM/yyyy',
    'budgetWarningPercent', 80,
    'budgetCriticalPercent', 100,
    'notifications', JSON_OBJECT(
      'shiftPacing', TRUE,
      'dailyTarget', TRUE,
      'leaderboard', TRUE,
      'budgetAlerts', TRUE
    )
  )
);

CREATE TABLE IF NOT EXISTS AppNotifications (
  id BIGINT NOT NULL AUTO_INCREMENT,
  notification_key VARCHAR(191) NOT NULL,
  title VARCHAR(180) NOT NULL,
  message VARCHAR(1000) NOT NULL,
  level ENUM('critical','warning','info','success') NOT NULL DEFAULT 'info',
  route VARCHAR(120) NOT NULL DEFAULT '/',
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_app_notifications_key (notification_key),
  KEY idx_app_notifications_read_update (is_active, is_read, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
