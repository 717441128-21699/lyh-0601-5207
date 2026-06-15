import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import db from '../database';
import { ApiResponse, RepaymentRecord } from '../types';

const router = express.Router();

const uploadDir = path.join(__dirname, '../../uploads');
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
    `).run(id, debtId, parseInt(period), parseFloat(amount), parseFloat(extraPayment) || 0, paymentDate, voucherUrl, verified, note, now);

    if (verified === 1) {
      const debt = db.prepare('SELECT * FROM debts WHERE id = ?').get(debtId) as any;
      if (debt) {
        const principalPaid = parseFloat(amount) + (parseFloat(extraPayment) || 0);
        const newRemaining = Math.max(0, debt.remaining_principal - principalPaid);
        db.prepare('UPDATE debts SET remaining_principal = ?, updated_at = ? WHERE id = ?')
          .run(newRemaining, now, debtId);
      }
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

    res.json({ success: true, data: record, message: '还款记录创建成功' + (verified ? '，已自动验证' : '') } as ApiResponse<RepaymentRecord>);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message } as ApiResponse);
  }
});

router.put('/:id/verify', (req, res) => {
  try {
    const { id } = req.params;
    const { verified } = req.body;
    const now = new Date().toISOString();

    const record = db.prepare('SELECT * FROM repayment_records WHERE id = ?').get(id) as any;
    if (!record) {
      return res.status(404).json({ success: false, error: '还款记录不存在' } as ApiResponse);
    }

    const result = db
      .prepare('UPDATE repayment_records SET verified = ? WHERE id = ?')
      .run(verified ? 1 : 0, id);

    if (result.changes > 0) {
      const debt = db.prepare('SELECT * FROM debts WHERE id = ?').get(record.debt_id) as any;
      if (debt) {
        const principalPaid = record.amount + (record.extra_payment || 0);
        let newRemaining = debt.remaining_principal;
        if (verified) {
          newRemaining = Math.max(0, debt.remaining_principal - principalPaid);
        } else {
          newRemaining = debt.remaining_principal + principalPaid;
        }
        db.prepare('UPDATE debts SET remaining_principal = ?, updated_at = ? WHERE id = ?')
          .run(newRemaining, now, record.debt_id);
      }
    }

    res.json({ success: true, message: verified ? '还款已验证' : '已取消验证' } as ApiResponse);
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
      const voucherPath = path.join(__dirname, '../..', record.voucher_url);
      if (fs.existsSync(voucherPath)) {
        fs.unlinkSync(voucherPath);
      }
    }

    if (record.verified === 1) {
      const debt = db.prepare('SELECT * FROM debts WHERE id = ?').get(record.debt_id) as any;
      if (debt) {
        const principalPaid = record.amount + (record.extra_payment || 0);
        const newRemaining = debt.remaining_principal + principalPaid;
        db.prepare('UPDATE debts SET remaining_principal = ?, updated_at = ? WHERE id = ?')
          .run(newRemaining, now, record.debt_id);
      }
    }

    db.prepare('DELETE FROM repayment_records WHERE id = ?').run(id);
    res.json({ success: true, message: '还款记录删除成功' } as ApiResponse);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message } as ApiResponse);
  }
});

export default router;
