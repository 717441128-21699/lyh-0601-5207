import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import db from '../database';
import { ApiResponse, Debt, RepaymentRecord } from '../types';
import { generateRepaymentSchedule } from '../utils/calculator';

const router = express.Router();

const uploadDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'voucher-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

function getPrincipalForPeriod(debt: Debt, period: number): number {
  const schedule = generateRepaymentSchedule(debt);
  const item = schedule.schedule.find((s) => s.period === period);
  return item ? item.principal : 0;
}

function updateDebtRemainingPrincipal(
  debtId: string,
  recordId: string,
  recordPeriod: number,
  recordAmount: number,
  recordExtraPayment: number,
  isVerifying: boolean,
  now: string
): void {
  const debt = db.prepare('SELECT * FROM debts WHERE id = ?').get(debtId) as any;
  if (!debt) return;

  const debtObj: Debt = {
    id: debt.id,
    name: debt.name,
    type: debt.type,
    principal: debt.principal,
    annualRate: debt.annual_rate,
    termMonths: debt.term_months,
    repaymentMethod: debt.repayment_method,
    startDate: debt.start_date,
    dueDay: debt.due_day,
    note: debt.note,
    remainingPrincipal: debt.remaining_principal,
    createdAt: debt.created_at,
    updatedAt: debt.updated_at,
  };

  const principalPart = getPrincipalForPeriod(debtObj, recordPeriod);
  const principalChange = principalPart + (recordExtraPayment || 0);

  let newRemaining: number;
  if (isVerifying) {
    newRemaining = Math.max(0, debt.remaining_principal - principalChange);
  } else {
    newRemaining = debt.remaining_principal + principalChange;
  }

  db.prepare('UPDATE debts SET remaining_principal = ?, updated_at = ? WHERE id = ?').run(
    Math.round(newRemaining * 100) / 100,
    now,
    debtId
  );
}

router.get('/debt/:debtId', (req, res) => {
  try {
    const { debtId } = req.params;
    const rows = db
      .prepare('SELECT * FROM repayment_records WHERE debt_id = ? ORDER BY period')
      .all(debtId) as any[];

    const records: RepaymentRecord[] = rows.map((row) => ({
      id: row.id,
      debtId: row.debt_id,
      period: row.period,
      amount: row.amount,
      extraPayment: row.extra_payment,
      paymentDate: row.payment_date,
      voucherUrl: row.voucher_url,
      verified: row.verified === 1,
      note: row.note,
      createdAt: row.created_at,
    }));

    res.json({ success: true, data: records } as ApiResponse<RepaymentRecord[]>);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message } as ApiResponse);
  }
});

router.post('/', upload.single('voucher'), (req, res) => {
  try {
    const { debtId, period, amount, extraPayment, paymentDate, note } = req.body;
    const id = uuidv4();
    const now = new Date().toISOString();

    let voucherUrl: string | undefined;
    if (req.file) {
      voucherUrl = `/uploads/${req.file.filename}`;
    }

    const verified = voucherUrl ? 1 : 0;

    db.prepare(`
      INSERT INTO repayment_records (id, debt_id, period, amount, extra_payment, payment_date, voucher_url, verified, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      debtId,
      parseInt(period),
      parseFloat(amount),
      parseFloat(extraPayment) || 0,
      paymentDate,
      voucherUrl,
      verified,
      note,
      now
    );

    if (verified === 1) {
      updateDebtRemainingPrincipal(
        debtId,
        id,
        parseInt(period),
        parseFloat(amount),
        parseFloat(extraPayment) || 0,
        true,
        now
      );
    }

    const record: RepaymentRecord = {
      id,
      debtId,
      period: parseInt(period),
      amount: parseFloat(amount),
      extraPayment: parseFloat(extraPayment) || 0,
      paymentDate,
      voucherUrl,
      verified: verified === 1,
      note,
      createdAt: now,
    };

    res.json({
      success: true,
      data: record,
      message: '还款记录创建成功' + (verified ? '，已自动验证' : ''),
    } as ApiResponse<RepaymentRecord>);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message } as ApiResponse);
  }
});

router.put('/:id/verify', (req, res) => {
  try {
    const { id } = req.params;
    const { verified } = req.body;
    const now = new Date().toISOString();
    const targetVerified = verified ? 1 : 0;

    const record = db.prepare('SELECT * FROM repayment_records WHERE id = ?').get(id) as any;
    if (!record) {
      return res.status(404).json({ success: false, error: '还款记录不存在' } as ApiResponse);
    }

    if (record.verified === targetVerified) {
      return res.json({
        success: true,
        message: targetVerified === 1 ? '记录已是已验证状态' : '记录已是未验证状态',
      } as ApiResponse);
    }

    const result = db
      .prepare('UPDATE repayment_records SET verified = ? WHERE id = ?')
      .run(targetVerified, id);

    if (result.changes > 0) {
      const isVerifying = targetVerified === 1;
      updateDebtRemainingPrincipal(
        record.debt_id,
        id,
        record.period,
        record.amount,
        record.extra_payment || 0,
        isVerifying,
        now
      );
    }

    res.json({
      success: true,
      message: targetVerified === 1 ? '还款已验证' : '已取消验证',
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message } as ApiResponse);
  }
});

router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date().toISOString();

    const record = db.prepare('SELECT * FROM repayment_records WHERE id = ?').get(id) as any;
    if (!record) {
      return res.status(404).json({ success: false, error: '还款记录不存在' } as ApiResponse);
    }

    if (record.voucher_url) {
      try {
        const filename = path.basename(record.voucher_url);
        const voucherPath = path.join(uploadDir, filename);
        if (fs.existsSync(voucherPath)) {
          fs.unlinkSync(voucherPath);
        }
      } catch (e) {
        console.warn('删除凭证文件失败:', e);
      }
    }

    if (record.verified === 1) {
      updateDebtRemainingPrincipal(
        record.debt_id,
        id,
        record.period,
        record.amount,
        record.extra_payment || 0,
        false,
        now
      );
    }

    db.prepare('DELETE FROM repayment_records WHERE id = ?').run(id);
    res.json({ success: true, message: '还款记录删除成功' } as ApiResponse);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message } as ApiResponse);
  }
});

export default router;
