import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { Debt, ApiResponse } from '../types';
import { generateRepaymentSchedule, calculateRepaymentStrategy, simulatePrepayment } from '../utils/calculator';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM debts ORDER BY created_at DESC').all() as any[];
    const debts: Debt[] = rows.map((row) => ({
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
    }));
    res.json({ success: true, data: debts } as ApiResponse<Debt[]>);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message } as ApiResponse);
  }
});

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const row = db.prepare('SELECT * FROM debts WHERE id = ?').get(id) as any;
    if (!row) {
      return res.status(404).json({ success: false, error: '债务不存在' } as ApiResponse);
    }
    const debt: Debt = {
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
    res.json({ success: true, data: debt } as ApiResponse<Debt>);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message } as ApiResponse);
  }
});

router.post('/', (req, res) => {
  try {
    const { name, type, principal, annualRate, termMonths, repaymentMethod, startDate, dueDay, note } = req.body;
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO debts (id, name, type, principal, annual_rate, term_months, repayment_method, start_date, due_day, note, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, type, principal, annualRate, termMonths, repaymentMethod, startDate, dueDay, note, now, now);

    const debt: Debt = {
      id,
      name,
      type,
      principal,
      annualRate,
      termMonths,
      repaymentMethod,
      startDate,
      dueDay,
      note,
      createdAt: now,
      updatedAt: now,
    };

    res.json({ success: true, data: debt, message: '债务创建成功' } as ApiResponse<Debt>);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message } as ApiResponse);
  }
});

router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, principal, annualRate, termMonths, repaymentMethod, startDate, dueDay, note } = req.body;
    const now = new Date().toISOString();

    const result = db.prepare(`
      UPDATE debts SET
        name = ?, type = ?, principal = ?, annual_rate = ?, term_months = ?,
        repayment_method = ?, start_date = ?, due_day = ?, note = ?, updated_at = ?
      WHERE id = ?
    `).run(name, type, principal, annualRate, termMonths, repaymentMethod, startDate, dueDay, note, now, id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: '债务不存在' } as ApiResponse);
    }

    res.json({ success: true, message: '债务更新成功' } as ApiResponse);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message } as ApiResponse);
  }
});

router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM debts WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: '债务不存在' } as ApiResponse);
    }

    res.json({ success: true, message: '债务删除成功' } as ApiResponse);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message } as ApiResponse);
  }
});

router.get('/:id/schedule', (req, res) => {
  try {
    const { id } = req.params;
    const row = db.prepare('SELECT * FROM debts WHERE id = ?').get(id) as any;
    if (!row) {
      return res.status(404).json({ success: false, error: '债务不存在' } as ApiResponse);
    }

    const debt: Debt = {
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

    const records = db.prepare('SELECT * FROM repayment_records WHERE debt_id = ? ORDER BY period').all(id) as any[];
    const extraPayments = new Map<number, number>();
    const paidPeriods = new Set<number>();

    for (const record of records) {
      if (record.extra_payment > 0) {
        extraPayments.set(record.period, record.extra_payment);
      }
      paidPeriods.add(record.period);
    }

    const calculation = generateRepaymentSchedule(debt, extraPayments);
    calculation.schedule = calculation.schedule.map((item) => ({
      ...item,
      isPaid: paidPeriods.has(item.period),
    }));

    res.json({ success: true, data: calculation } as ApiResponse);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message } as ApiResponse);
  }
});

router.post('/strategy', (req, res) => {
  try {
    const { strategy, extraMonthlyAmount } = req.body;
    const rows = db.prepare('SELECT * FROM debts').all() as any[];

    if (rows.length === 0) {
      return res.status(400).json({ success: false, error: '请先添加债务' } as ApiResponse);
    }

    const debts: Debt[] = rows.map((row) => ({
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
    }));

    const result = calculateRepaymentStrategy(debts, strategy, extraMonthlyAmount || 0);
    res.json({ success: true, data: result } as ApiResponse);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message } as ApiResponse);
  }
});

router.post('/:id/prepayment', (req, res) => {
  try {
    const { id } = req.params;
    const { prepaymentAmount, prepaymentPeriod, reduceMethod } = req.body;

    const row = db.prepare('SELECT * FROM debts WHERE id = ?').get(id) as any;
    if (!row) {
      return res.status(404).json({ success: false, error: '债务不存在' } as ApiResponse);
    }

    const debt: Debt = {
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

    const result = simulatePrepayment(debt, prepaymentAmount, prepaymentPeriod || 1, reduceMethod || 'reduce_term');
    res.json({ success: true, data: result } as ApiResponse);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message } as ApiResponse);
  }
});

export default router;
