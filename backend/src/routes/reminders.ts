import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { ApiResponse, ReminderSettings } from '../types';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM reminder_settings').all() as any[];
    const settings: ReminderSettings[] = rows.map((row) => ({
      id: row.id,
      debtId: row.debt_id || undefined,
      enabled: row.enabled === 1,
      daysBefore: row.days_before,
      notificationType: row.notification_type,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    res.json({ success: true, data: settings } as ApiResponse<ReminderSettings[]>);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message } as ApiResponse);
  }
});

router.put('/global', (req, res) => {
  try {
    const { enabled, daysBefore, notificationType } = req.body;
    const now = new Date().toISOString();

    const result = db.prepare(`
      UPDATE reminder_settings SET
        enabled = ?, days_before = ?, notification_type = ?, updated_at = ?
      WHERE debt_id IS NULL
    `).run(enabled ? 1 : 0, daysBefore, notificationType, now);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: '全局提醒设置不存在' } as ApiResponse);
    }

    res.json({ success: true, message: '提醒设置更新成功' } as ApiResponse);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message } as ApiResponse);
  }
});

router.post('/debt/:debtId', (req, res) => {
  try {
    const { debtId } = req.params;
    const { enabled, daysBefore, notificationType } = req.body;
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT * FROM reminder_settings WHERE debt_id = ?').get(debtId);
    if (existing) {
      return res.status(400).json({ success: false, error: '该债务的提醒设置已存在' } as ApiResponse);
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO reminder_settings (id, debt_id, enabled, days_before, notification_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, debtId, enabled ? 1 : 0, daysBefore, notificationType, now, now);

    res.json({ success: true, message: '债务提醒设置创建成功' } as ApiResponse);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message } as ApiResponse);
  }
});

router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { enabled, daysBefore, notificationType } = req.body;
    const now = new Date().toISOString();

    const result = db.prepare(`
      UPDATE reminder_settings SET
        enabled = ?, days_before = ?, notification_type = ?, updated_at = ?
      WHERE id = ?
    `).run(enabled ? 1 : 0, daysBefore, notificationType, now, id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: '提醒设置不存在' } as ApiResponse);
    }

    res.json({ success: true, message: '提醒设置更新成功' } as ApiResponse);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message } as ApiResponse);
  }
});

router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const result = db.prepare('DELETE FROM reminder_settings WHERE id = ? AND debt_id IS NOT NULL').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: '提醒设置不存在或无法删除' } as ApiResponse);
    }

    res.json({ success: true, message: '提醒设置删除成功' } as ApiResponse);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message } as ApiResponse);
  }
});

router.get('/upcoming', (req, res) => {
  try {
    const { days = 7 } = req.query;
    const daysAhead = parseInt(days as string);

    const reminderRow = db.prepare("SELECT * FROM reminder_settings WHERE debt_id IS NULL AND enabled = 1").get() as any;
    if (!reminderRow) {
      return res.json({ success: true, data: [] } as ApiResponse);
    }

    const daysBefore = reminderRow.days_before;
    const today = new Date();

    const rows = db.prepare('SELECT * FROM debts').all() as any[];
    const upcoming: {
      debtId: string;
      debtName: string;
      dueDate: string;
      amount: number;
      daysRemaining: number;
    }[] = [];

    for (const row of rows) {
      const dueDay = row.due_day;
      const dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay);

      if (dueDate < today) {
        dueDate.setMonth(dueDate.getMonth() + 1);
      }

      const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysRemaining <= daysBefore + daysAhead) {
        const { generateRepaymentSchedule } = require('../utils/calculator');
        const debt = {
          id: row.id,
          name: row.name,
          type: row.type,
          principal: row.principal,
          annualRate: row.annual_rate,
          termMonths: row.term_months,
          repaymentMethod: row.repayment_method,
          startDate: row.start_date,
          dueDay: row.due_day,
          note: row.note,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
        const calc = generateRepaymentSchedule(debt);

        upcoming.push({
          debtId: row.id,
          debtName: row.name,
          dueDate: dueDate.toISOString().split('T')[0],
          amount: calc.monthlyPayment,
          daysRemaining,
        });
      }
    }

    upcoming.sort((a, b) => a.daysRemaining - b.daysRemaining);
    res.json({ success: true, data: upcoming } as ApiResponse);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message } as ApiResponse);
  }
});

export default router;
