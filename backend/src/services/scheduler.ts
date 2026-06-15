import db from '../database';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import { generateRepaymentSchedule } from '../utils/calculator';

const notifiedPayments = new Set<string>();

export function startScheduler() {
  console.log('⏰ 定时任务服务已启动');

  checkUpcomingPayments();
  setInterval(checkUpcomingPayments, 60 * 60 * 1000);

  checkMonthlyReport();
  setInterval(checkMonthlyReport, 24 * 60 * 60 * 1000);
}

function checkUpcomingPayments() {
  try {
    const reminderSetting = db.prepare('SELECT * FROM reminder_settings WHERE debt_id IS NULL').get() as any;
    if (!reminderSetting || reminderSetting.enabled !== 1) return;

    const daysBefore = reminderSetting.days_before || 3;
    const today = dayjs();
    const checkDate = today.add(daysBefore, 'day').format('YYYY-MM-DD');

    const debts = db.prepare('SELECT * FROM debts WHERE remaining_principal > 0').all() as any[];

    for (const debt of debts) {
      const dueDay = debt.due_day;
      const currentMonth = today.month() + 1;
      const currentYear = today.year();

      let dueDate = dayjs(`${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`);

      if (dueDate.isBefore(today, 'day')) {
        dueDate = dueDate.add(1, 'month');
      }

      const diffDays = dueDate.diff(today, 'day');

      if (diffDays >= 0 && diffDays <= daysBefore) {
        const notificationKey = `${debt.id}-${dueDate.format('YYYY-MM')}`;

        if (!notifiedPayments.has(notificationKey)) {
          console.log(`📬 还款提醒: ${debt.name} 将在 ${diffDays} 天后到期 (${dueDate.format('YYYY-MM-DD')})`);
          notifiedPayments.add(notificationKey);
        }
      }
    }
  } catch (error) {
    console.error('检查还款提醒失败:', error);
  }
}

function checkMonthlyReport() {
  try {
    const today = dayjs();
    const currentMonth = today.format('YYYY-MM');

    if (today.date() === 1) {
      const existingReport = db.prepare('SELECT * FROM monthly_reports WHERE month = ?').get(currentMonth);

      if (!existingReport) {
        console.log(`📊 自动生成 ${currentMonth} 月度报告...`);
        autoGenerateMonthlyReport(currentMonth);
        console.log(`✅ ${currentMonth} 月度报告已自动生成`);
      }
    }
  } catch (error) {
    console.error('自动生成月度报告失败:', error);
  }
}

export function getUpcomingPaymentsForNotification(): {
  debtName: string;
  dueDate: string;
  daysRemaining: number;
  amount: number;
}[] {
  const result: {
    debtName: string;
    dueDate: string;
    daysRemaining: number;
    amount: number;
  }[] = [];

  try {
    const reminderSetting = db.prepare('SELECT * FROM reminder_settings WHERE debt_id IS NULL').get() as any;
    if (!reminderSetting || reminderSetting.enabled !== 1) return result;

    const daysBefore = reminderSetting.days_before || 3;
    const today = dayjs();

    const debts = db.prepare('SELECT * FROM debts WHERE remaining_principal > 0').all() as any[];

    for (const debt of debts) {
      const dueDay = debt.due_day;
      const currentMonth = today.month() + 1;
      const currentYear = today.year();

      let dueDate = dayjs(`${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`);

      if (dueDate.isBefore(today, 'day')) {
        dueDate = dueDate.add(1, 'month');
      }

      const diffDays = dueDate.diff(today, 'day');

      if (diffDays >= 0 && diffDays <= daysBefore) {
        const monthlyRate = debt.annual_rate / 100 / 12;
        const monthlyPayment =
          (debt.principal * monthlyRate * Math.pow(1 + monthlyRate, debt.term_months)) /
          (Math.pow(1 + monthlyRate, debt.term_months) - 1);

        result.push({
          debtName: debt.name,
          dueDate: dueDate.format('YYYY-MM-DD'),
          daysRemaining: diffDays,
          amount: Math.round(monthlyPayment * 100) / 100,
        });
      }
    }
  } catch (error) {
    console.error('获取即将到期还款失败:', error);
  }

  return result.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

function autoGenerateMonthlyReport(month: string) {
  const monthStart = dayjs(month + '-01');
  const prevMonthStart = monthStart.subtract(1, 'month');
  const nextMonthStart = monthStart.add(1, 'month');

  const debtsRows = db.prepare('SELECT * FROM debts').all() as any[];

  const reportDebts: any[] = [];
  let totalDebt = 0;
  let previousMonthTotalDebt = 0;
  let monthlyPaymentTotal = 0;
  let interestPaid = 0;
  let principalPaid = 0;

  for (const debt of debtsRows) {
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
      const scheduleItem = schedule.schedule.find((s: any) => s.period === record.period);
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
  const reportId = uuidv4();

  db.prepare(`
    INSERT INTO monthly_reports (
      id, month, total_debt, previous_month_total_debt, debt_change,
      monthly_payment_total, interest_paid, principal_paid, debts_data, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    reportId,
    month,
    Math.round(totalDebt * 100) / 100,
    Math.round(previousMonthTotalDebt * 100) / 100,
    Math.round((previousMonthTotalDebt - totalDebt) * 100) / 100,
    Math.round(monthlyPaymentTotal * 100) / 100,
    Math.round(interestPaid * 100) / 100,
    Math.round(principalPaid * 100) / 100,
    JSON.stringify(reportDebts),
    now
  );

  return {
    id: reportId,
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
