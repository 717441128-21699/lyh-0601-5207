import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';
import dayjs from 'dayjs';
import db from '../database';
import { ApiResponse, MonthlyReport, Debt } from '../types';
import { generateRepaymentSchedule } from '../utils/calculator';

const router = express.Router();

function generateMonthlyReport(month: string): MonthlyReport {
  const monthStart = dayjs(month + '-01');
  const prevMonthStart = monthStart.subtract(1, 'month');
  const nextMonthStart = monthStart.add(1, 'month');

  const debtsRows = db.prepare('SELECT * FROM debts').all() as any[];
  const debts: Debt[] = debtsRows.map((row) => ({
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
    remainingPrincipal: row.remaining_principal,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const reportDebts: MonthlyReport['debts'] = [];
  let totalDebt = 0;
  let previousMonthTotalDebt = 0;
  let monthlyPaymentTotal = 0;
  let interestPaid = 0;
  let principalPaid = 0;

  for (const debt of debts) {
    const schedule = generateRepaymentSchedule(debt);

    const records = db
      .prepare(
        `SELECT * FROM repayment_records 
       WHERE debt_id = ? AND payment_date >= ? AND payment_date < ?
       ORDER BY period`
      )
      .all(debt.id, monthStart.format('YYYY-MM-DD'), nextMonthStart.format('YYYY-MM-DD')) as any[];

    let beginningBalance = debt.principal;
    let endingBalance = debt.principal;
    let payment = 0;
    let interest = 0;
    let principal = 0;

    for (const item of schedule.schedule) {
      const itemDate = dayjs(item.date);
      if (itemDate.isBefore(monthStart)) {
        beginningBalance = item.remainingPrincipal + item.principal;
      }
      if (itemDate.isBefore(nextMonthStart)) {
        endingBalance = item.remainingPrincipal;
      }
    }

    for (const record of records) {
      payment += record.amount;
      const scheduleItem = schedule.schedule.find((s) => s.period === record.period);
      if (scheduleItem) {
        interest += scheduleItem.interest;
        principal += scheduleItem.principal + (record.extra_payment || 0);
      }
    }

    if (payment === 0) {
      for (const item of schedule.schedule) {
        const itemDate = dayjs(item.date);
        if (itemDate.isSame(monthStart, 'month')) {
          payment += item.payment;
          interest += item.interest;
          principal += item.principal;
        }
      }
    }

    totalDebt += endingBalance;
    previousMonthTotalDebt += beginningBalance;
    monthlyPaymentTotal += payment;
    interestPaid += interest;
    principalPaid += principal;

    reportDebts.push({
      debtId: debt.id,
      debtName: debt.name,
      beginningBalance,
      endingBalance,
      payment,
      interest,
      principal,
    });
  }

  const now = new Date().toISOString();

  return {
    id: uuidv4(),
    month,
    totalDebt: Math.round(totalDebt * 100) / 100,
    previousMonthTotalDebt: Math.round(previousMonthTotalDebt * 100) / 100,
    debtChange: Math.round((previousMonthTotalDebt - totalDebt) * 100) / 100,
    monthlyPaymentTotal: Math.round(monthlyPaymentTotal * 100) / 100,
    interestPaid: Math.round(interestPaid * 100) / 100,
    principalPaid: Math.round(principalPaid * 100) / 100,
    debts: reportDebts,
    createdAt: now,
  };
}

router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM monthly_reports ORDER BY month DESC').all() as any[];
    const reports: MonthlyReport[] = rows.map((row) => ({
      id: row.id,
      month: row.month,
      totalDebt: row.total_debt,
      previousMonthTotalDebt: row.previous_month_total_debt,
      debtChange: row.debt_change,
      monthlyPaymentTotal: row.monthly_payment_total,
      interestPaid: row.interest_paid,
      principalPaid: row.principal_paid,
      debts: JSON.parse(row.debts_data),
      createdAt: row.created_at,
    }));
    res.json({ success: true, data: reports } as ApiResponse<MonthlyReport[]>);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message } as ApiResponse);
  }
});

router.get('/:month', (req, res) => {
  try {
    const { month } = req.params;
    const row = db.prepare('SELECT * FROM monthly_reports WHERE month = ?').get(month) as any;

    let report: MonthlyReport;

    if (row) {
      report = {
        id: row.id,
        month: row.month,
        totalDebt: row.total_debt,
        previousMonthTotalDebt: row.previous_month_total_debt,
        debtChange: row.debt_change,
        monthlyPaymentTotal: row.monthly_payment_total,
        interestPaid: row.interest_paid,
        principalPaid: row.principal_paid,
        debts: JSON.parse(row.debts_data),
        createdAt: row.created_at,
      };
    } else {
      report = generateMonthlyReport(month);
    }

    res.json({ success: true, data: report } as ApiResponse<MonthlyReport>);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message } as ApiResponse);
  }
});

router.post('/generate/:month', (req, res) => {
  try {
    const { month } = req.params;
    const existing = db.prepare('SELECT * FROM monthly_reports WHERE month = ?').get(month);

    if (existing) {
      return res.status(400).json({ success: false, error: '该月报告已存在' } as ApiResponse);
    }

    const report = generateMonthlyReport(month);

    db.prepare(`
      INSERT INTO monthly_reports (id, month, total_debt, previous_month_total_debt, debt_change, monthly_payment_total, interest_paid, principal_paid, debts_data, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      report.id,
      report.month,
      report.totalDebt,
      report.previousMonthTotalDebt,
      report.debtChange,
      report.monthlyPaymentTotal,
      report.interestPaid,
      report.principalPaid,
      JSON.stringify(report.debts),
      report.createdAt
    );

    res.json({ success: true, data: report, message: '月度报告生成成功' } as ApiResponse<MonthlyReport>);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message } as ApiResponse);
  }
});

router.get('/:month/pdf', (req, res) => {
  try {
    const { month } = req.params;
    let report: MonthlyReport;

    const row = db.prepare('SELECT * FROM monthly_reports WHERE month = ?').get(month) as any;
    if (row) {
      report = {
        id: row.id,
        month: row.month,
        totalDebt: row.total_debt,
        previousMonthTotalDebt: row.previous_month_total_debt,
        debtChange: row.debt_change,
        monthlyPaymentTotal: row.monthly_payment_total,
        interestPaid: row.interest_paid,
        principalPaid: row.principal_paid,
        debts: JSON.parse(row.debts_data),
        createdAt: row.created_at,
      };
    } else {
      report = generateMonthlyReport(month);
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="debt-report-${month}.pdf"`);

    doc.pipe(res);

    doc.fontSize(20).text('月度负债报告', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`报告月份: ${month}`, { align: 'center' });
    doc.moveDown();

    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    doc.fontSize(12).text('一、总体概况');
    doc.moveDown();
    doc.fontSize(10).text(`负债总额: ¥${report.totalDebt.toFixed(2)}`);
    doc.text(`上月负债总额: ¥${report.previousMonthTotalDebt.toFixed(2)}`);
    doc.text(`负债变化: ${report.debtChange >= 0 ? '减少' : '增加'} ¥${Math.abs(report.debtChange).toFixed(2)}`);
    doc.text(`本月还款总额: ¥${report.monthlyPaymentTotal.toFixed(2)}`);
    doc.text(`其中本金: ¥${report.principalPaid.toFixed(2)}`);
    doc.text(`其中利息: ¥${report.interestPaid.toFixed(2)}`);
    doc.moveDown();

    doc.fontSize(12).text('二、各债务明细');
    doc.moveDown();

    const tableTop = doc.y;
    const colWidths = [150, 100, 100, 80, 80, 80];
    const headers = ['债务名称', '期初余额', '期末余额', '还款额', '本金', '利息'];

    doc.fontSize(10);
    let x = 50;
    headers.forEach((header, i) => {
      doc.text(header, x, tableTop);
      x += colWidths[i];
    });

    let y = tableTop + 20;
    for (const debt of report.debts) {
      x = 50;
      doc.text(debt.debtName, x, y);
      x += colWidths[0];
      doc.text(`¥${debt.beginningBalance.toFixed(2)}`, x, y);
      x += colWidths[1];
      doc.text(`¥${debt.endingBalance.toFixed(2)}`, x, y);
      x += colWidths[2];
      doc.text(`¥${debt.payment.toFixed(2)}`, x, y);
      x += colWidths[3];
      doc.text(`¥${debt.principal.toFixed(2)}`, x, y);
      x += colWidths[4];
      doc.text(`¥${debt.interest.toFixed(2)}`, x, y);
      y += 20;
    }

    doc.moveDown();
    doc.fontSize(10).text(`生成时间: ${new Date().toLocaleString('zh-CN')}`);

    doc.end();
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message } as ApiResponse);
  }
});

export default router;
