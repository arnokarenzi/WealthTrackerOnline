# Aiven migration — FinTrack Productivity Phase 5

Database: `defaultdb`  
Host: `mysql-22ba951b-arnokarenzi1.a.aivencloud.com`  
Port: `18926`  
User: `avnadmin`

## 1. Back up first

Run this from the Linux terminal (not from `mysql>`):

```bash
mkdir -p ~/fintrack-backups
mysqldump -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com -P 18926 -u avnadmin -p --single-transaction defaultdb > ~/fintrack-backups/fintrack-before-productivity-phase5.sql
ls -lh ~/fintrack-backups/fintrack-before-productivity-phase5.sql
```

Do not continue until the backup exists and is non-empty.

## 2. Check previous productivity migrations

Connect:

```bash
mysql -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com -P 18926 -u avnadmin -p defaultdb
```

Run:

```sql
SHOW TABLES LIKE 'ProductivitySettings';
SHOW TABLES LIKE 'ProductivityTasks';
SHOW TABLES LIKE 'ProductivityCalendarEvents';
SHOW TABLES LIKE 'ProductivityHabits';
SHOW TABLES LIKE 'ProductivityFocusSessions';
```

Exit with `exit;`.

## 3. Apply Phase 5 only

When Phases 1–4 have already been applied, run:

```bash
cd ~/fintrack
mysql -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com -P 18926 -u avnadmin -p defaultdb < Backend/migrations/20261106_productivity_goals_notes_countdowns.sql
```

If earlier migrations are missing, identify which tables are absent and apply only the missing migrations in date order. Do not rerun existing migration scripts blindly.

## 4. Verify

Reconnect and run:

```sql
SHOW TABLES LIKE 'ProductivityGoals';
SHOW TABLES LIKE 'ProductivityGoalMilestones';
SHOW TABLES LIKE 'ProductivityNotes';
SHOW TABLES LIKE 'ProductivityCountdowns';

SELECT COUNT(*) FROM ProductivityGoals;
SELECT COUNT(*) FROM ProductivityGoalMilestones;
SELECT COUNT(*) FROM ProductivityNotes;
SELECT COUNT(*) FROM ProductivityCountdowns;
```

Each new table should exist. Counts should be zero unless you have already created records in Phase 5.

## Safety

The Phase 5 migration is additive. It creates four new tables and does not update or delete financial records. Do not run `db:fresh-install`, project initialization/reset, `TRUNCATE`, or `DROP DATABASE`.

The package does not include Aiven credentials. Type the database password only at the prompt. The existing source pool configures TLS with `rejectUnauthorized: false`; for stricter certificate verification, configure the Aiven CA certificate and verify the driver's TLS options in your local environment.
