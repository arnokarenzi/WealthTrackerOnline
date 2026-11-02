# Aiven migration — FinTrack Productivity Phase 4

1. Back up the `defaultdb` database before migration:

```bash
mkdir -p ~/fintrack-backups
mysqldump -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com -P 18926 -u avnadmin -p --single-transaction defaultdb > ~/fintrack-backups/fintrack-before-productivity-phase4.sql
ls -lh ~/fintrack-backups/fintrack-before-productivity-phase4.sql
```

2. If Phase 1, 2 and 3 are already applied, run only:

```bash
cd ~/fintrack
mysql -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com -P 18926 -u avnadmin -p defaultdb < Backend/migrations/20261105_productivity_habits_focus.sql
```

3. Verify:

```sql
SHOW TABLES LIKE 'ProductivityHabits';
SHOW TABLES LIKE 'ProductivityHabitLogs';
SHOW TABLES LIKE 'ProductivityFocusSessions';
SELECT COUNT(*) FROM ProductivityHabits;
SELECT COUNT(*) FROM ProductivityHabitLogs;
SELECT COUNT(*) FROM ProductivityFocusSessions;
```

Run commands in a normal terminal unless inside the MySQL console. Enter passwords only at the prompt. Do not run `db:fresh-install`, initialization, truncation, or reset commands. Do not reapply the earlier migrations if already installed.
