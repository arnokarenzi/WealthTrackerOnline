# Apply FinTrack Productivity migrations to Aiven MySQL

Use the Aiven database from a normal Linux terminal. Do not paste commands into the interactive `mysql>` prompt. The Aiven password is requested privately by `-p`; do not place the password directly into the command or share it in chat.

Connection:

- Host: `mysql-22ba951b-arnokarenzi1.a.aivencloud.com`
- Port: `18926`
- User: `avnadmin`
- Database: `defaultdb`

## 1. Back up first

```bash
mkdir -p ~/fintrack-backups
mysqldump -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com -P 18926 -u avnadmin -p --single-transaction defaultdb > ~/fintrack-backups/fintrack-before-productivity.sql
```

After the password prompt returns, verify the dump:

```bash
test -s ~/fintrack-backups/fintrack-before-productivity.sql && ls -lh ~/fintrack-backups/fintrack-before-productivity.sql
```

Do not continue if the file is missing or empty.

## 2. Change to the project root

```bash
cd ~/fintrack
```

First make sure the Productivity ZIP was extracted here with its directory structure preserved. The two migration files should exist:

```bash
ls -l Backend/migrations/20261102_productivity_foundation.sql
ls -l Backend/migrations/20261103_productivity_tasks_projects.sql
```

## 3. Apply Phase 1 (skip only if already installed and verified)

```bash
mysql -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com -P 18926 -u avnadmin -p defaultdb < Backend/migrations/20261102_productivity_foundation.sql
```

Verify:

```bash
mysql -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com -P 18926 -u avnadmin -p defaultdb
```

At `mysql>`:

```sql
SHOW TABLES LIKE 'ProductivitySettings';
SELECT * FROM ProductivitySettings WHERE id = 1;
exit;
```

## 4. Apply Phase 2 (Tasks, Projects and My Day)

Run from the normal terminal:

```bash
mysql -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com -P 18926 -u avnadmin -p defaultdb < Backend/migrations/20261103_productivity_tasks_projects.sql
```

Verify all three new tables and their initial counts:

```bash
mysql -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com -P 18926 -u avnadmin -p defaultdb
```

At `mysql>`:

```sql
SHOW TABLES LIKE 'Productivity%';
SELECT COUNT(*) AS projects FROM ProductivityProjects;
SELECT COUNT(*) AS tasks FROM ProductivityTasks;
SELECT COUNT(*) AS subtasks FROM ProductivityTaskSubtasks;
exit;
```

The new project/task/subtask tables should initially have zero rows. No demo data is inserted.

Before restarting, confirm the existing `Backend/.env` points to this same Aiven database using the variable names consumed by the current connection pool:

```env
DB_HOST=mysql-22ba951b-arnokarenzi1.a.aivencloud.com
DB_PORT=18926
DB_USER=avnadmin
DB_PASSWORD=YOUR_AIVEN_PASSWORD
DB_NAME=defaultdb
```

Keep the real password only in your local `.env` file. Do not paste it into chat or commit `.env` to Git.

## 5. Restart the application

Terminal 1:

```bash
cd ~/fintrack/Backend
npm run dev
```

Terminal 2:

```bash
cd ~/fintrack/Frontend
npm run dev
```

If the backend reports `ER_NO_SUCH_TABLE`, confirm that both migrations were applied to the same `defaultdb` configured in `Backend/.env`.

## Safety

Do not run `db:fresh-install`, any initialize/reset operation, `TRUNCATE`, or deletion of existing finance tables. Both migrations are additive and create only new productivity tables. If either migration returns an error, stop and share the full error before attempting another change.
