# Aiven — FinTrack Productivity Phase 6 migration

Database connection details:

- Host: `mysql-22ba951b-arnokarenzi1.a.aivencloud.com`
- Port: `18926`
- User: `avnadmin`
- Database: `defaultdb`

## 1. Back up first

Run in your normal Linux terminal:

```bash
mkdir -p ~/fintrack-backups
mysqldump \
  -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com \
  -P 18926 \
  -u avnadmin \
  -p \
  --single-transaction \
  defaultdb \
  > ~/fintrack-backups/fintrack-before-productivity-phase6.sql
```

Check that the file exists and has a nonzero size:

```bash
ls -lh ~/fintrack-backups/fintrack-before-productivity-phase6.sql
```

## 2. Confirm previous tables exist

Connect:

```bash
mysql -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com -P 18926 -u avnadmin -p defaultdb
```

At the `mysql>` prompt:

```sql
SHOW TABLES LIKE 'ProductivitySettings';
SHOW TABLES LIKE 'ProductivityTasks';
SHOW TABLES LIKE 'ProductivityCalendarEvents';
SHOW TABLES LIKE 'ProductivityHabits';
SHOW TABLES LIKE 'ProductivityFocusSessions';
SHOW TABLES LIKE 'ProductivityGoals';
SHOW TABLES LIKE 'ProductivityNotes';
SHOW TABLES LIKE 'ProductivityCountdowns';
```

If one or more previous tables are missing, do not run the Phase 6 migration yet. Apply the missing earlier migration(s) in date order after checking the relevant table state. Do not run all migrations blindly.

Exit:

```sql
exit;
```

## 3. Apply only the Phase 6 migration

After extracting the Phase 6 ZIP into `~/fintrack`:

```bash
cd ~/fintrack
mysql \
  -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com \
  -P 18926 \
  -u avnadmin \
  -p \
  defaultdb \
  < Backend/migrations/20261107_productivity_reviews_insights.sql
```

Type your Aiven password when prompted. Do not include the password in the command.

## 4. Verify

```bash
mysql -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com -P 18926 -u avnadmin -p defaultdb
```

Then:

```sql
SHOW TABLES LIKE 'ProductivityDailyReviews';
SHOW TABLES LIKE 'ProductivityWeeklyReviews';
SELECT COUNT(*) FROM ProductivityDailyReviews;
SELECT COUNT(*) FROM ProductivityWeeklyReviews;
```

The two tables should exist and normally start with zero rows. No sample review records are inserted by the migration.

## 5. Restart and test the application

```bash
cd ~/fintrack/Backend
npm test
npm run dev
```

In another terminal:

```bash
cd ~/fintrack/Frontend
npm ci
npm run build
npm run dev
```

Open `/#/productivity/reviews` and `/#/productivity/insights`.

Do not run `db:fresh-install`, initialization or reset scripts. The migration creates two new tables only and does not change financial tables or balances.
