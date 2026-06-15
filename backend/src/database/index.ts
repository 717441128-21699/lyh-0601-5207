import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../../data/debt-manager.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS debts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      principal REAL NOT NULL,
      annual_rate REAL NOT NULL,
      term_months INTEGER NOT NULL,
      repayment_method TEXT NOT NULL,
      start_date TEXT NOT NULL,
      due_day INTEGER NOT NULL,
      note TEXT,
      remaining_principal REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS repayment_records (
      id TEXT PRIMARY KEY,
      debt_id TEXT NOT NULL,
      period INTEGER NOT NULL,
      amount REAL NOT NULL,
      extra_payment REAL NOT NULL DEFAULT 0,
      payment_date TEXT NOT NULL,
      voucher_url TEXT,
      verified INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reminder_settings (
      id TEXT PRIMARY KEY,
      debt_id TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      days_before INTEGER NOT NULL DEFAULT 3,
      notification_type TEXT NOT NULL DEFAULT 'push',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS monthly_reports (
      id TEXT PRIMARY KEY,
      month TEXT NOT NULL UNIQUE,
      total_debt REAL NOT NULL,
      previous_month_total_debt REAL NOT NULL,
      debt_change REAL NOT NULL,
      monthly_payment_total REAL NOT NULL,
      interest_paid REAL NOT NULL,
      principal_paid REAL NOT NULL,
      debts_data TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_repayment_records_debt_id ON repayment_records(debt_id);
    CREATE INDEX IF NOT EXISTS idx_repayment_records_date ON repayment_records(payment_date);
    CREATE INDEX IF NOT EXISTS idx_reminder_settings_debt_id ON reminder_settings(debt_id);
    CREATE INDEX IF NOT EXISTS idx_monthly_reports_month ON monthly_reports(month);
  `);

  const columns = db.prepare("PRAGMA table_info(debts)").all() as any[];
  const hasRemainingPrincipal = columns.some((c: any) => c.name === 'remaining_principal');
  if (!hasRemainingPrincipal) {
    db.exec('ALTER TABLE debts ADD COLUMN remaining_principal REAL NOT NULL DEFAULT 0');
  }

  const debtsWithoutRemaining = db.prepare('SELECT * FROM debts WHERE remaining_principal = 0').all() as any[];
  for (const debt of debtsWithoutRemaining) {
    db.prepare('UPDATE debts SET remaining_principal = ? WHERE id = ?').run(debt.principal, debt.id);
  }

  const globalReminder = db.prepare('SELECT * FROM reminder_settings WHERE debt_id IS NULL').get();
  if (!globalReminder) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO reminder_settings (id, debt_id, enabled, days_before, notification_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('global-reminder', null, 1, 3, 'push', now, now);
  }
}

initDatabase();

export default db;
