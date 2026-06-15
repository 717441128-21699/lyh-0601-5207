import dayjs from 'dayjs';
import { Debt, DebtCalculationResult, RepaymentScheduleItem, RepaymentStrategy, RepaymentStrategyResult, PrepaymentSimulationResult } from '../types';

export function calculateEqualInstallment(
  principal: number,
  annualRate: number,
  termMonths: number
): { monthlyPayment: number; totalPayment: number; totalInterest: number } {
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) {
    const monthlyPayment = principal / termMonths;
    return {
      monthlyPayment,
      totalPayment: principal,
      totalInterest: 0,
    };
  }
  const monthlyPayment =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);
  const totalPayment = monthlyPayment * termMonths;
  const totalInterest = totalPayment - principal;
  return { monthlyPayment, totalPayment, totalInterest };
}

export function calculateEqualPrincipal(
  principal: number,
  annualRate: number,
  termMonths: number
): { payments: number[]; totalPayment: number; totalInterest: number } {
  const monthlyRate = annualRate / 100 / 12;
  const monthlyPrincipal = principal / termMonths;
  const payments: number[] = [];
  let remainingPrincipal = principal;
  let totalInterest = 0;

  for (let i = 0; i < termMonths; i++) {
    const interest = remainingPrincipal * monthlyRate;
    const payment = monthlyPrincipal + interest;
    payments.push(payment);
    totalInterest += interest;
    remainingPrincipal -= monthlyPrincipal;
  }

  const totalPayment = principal + totalInterest;
  return { payments, totalPayment, totalInterest };
}

export function generateRepaymentSchedule(
  debt: Debt,
  extraPayments: Map<number, number> = new Map()
): DebtCalculationResult {
  const { principal, annualRate, termMonths, repaymentMethod, startDate } = debt;
  const monthlyRate = annualRate / 100 / 12;
  const schedule: RepaymentScheduleItem[] = [];
  let remainingPrincipal = principal;
  let totalPayment = 0;
  let totalInterest = 0;
  let period = 1;
  let currentDate = dayjs(startDate);

  if (repaymentMethod === 'equal_installment') {
    const { monthlyPayment } = calculateEqualInstallment(principal, annualRate, termMonths);

    while (remainingPrincipal > 0.01 && period <= termMonths * 2) {
      const extraPayment = extraPayments.get(period) || 0;
      const interest = remainingPrincipal * monthlyRate;
      let payment = monthlyPayment;
      let principalPayment = payment - interest;

      if (extraPayment > 0) {
        principalPayment += extraPayment;
      }

      if (principalPayment >= remainingPrincipal) {
        principalPayment = remainingPrincipal;
        payment = principalPayment + interest;
      }

      remainingPrincipal -= principalPayment;
      if (remainingPrincipal < 0) remainingPrincipal = 0;

      totalPayment += payment;
      totalInterest += interest;

      schedule.push({
        period,
        date: currentDate.format('YYYY-MM-DD'),
        payment: Math.round(payment * 100) / 100,
        principal: Math.round(principalPayment * 100) / 100,
        interest: Math.round(interest * 100) / 100,
        remainingPrincipal: Math.round(remainingPrincipal * 100) / 100,
        isPaid: false,
        extraPayment: extraPayment > 0 ? extraPayment : undefined,
      });

      currentDate = currentDate.add(1, 'month');
      period++;
    }
  } else {
    const { payments } = calculateEqualPrincipal(principal, annualRate, termMonths);
    const monthlyPrincipal = principal / termMonths;

    for (let i = 0; i < payments.length && remainingPrincipal > 0.01; i++) {
      const extraPayment = extraPayments.get(period) || 0;
      const interest = remainingPrincipal * monthlyRate;
      let principalPayment = monthlyPrincipal;
      let payment = payments[i];

      if (extraPayment > 0) {
        principalPayment += extraPayment;
        payment += extraPayment;
      }

      if (principalPayment >= remainingPrincipal) {
        principalPayment = remainingPrincipal;
        payment = principalPayment + interest;
      }

      remainingPrincipal -= principalPayment;
      if (remainingPrincipal < 0) remainingPrincipal = 0;

      totalPayment += payment;
      totalInterest += interest;

      schedule.push({
        period,
        date: currentDate.format('YYYY-MM-DD'),
        payment: Math.round(payment * 100) / 100,
        principal: Math.round(principalPayment * 100) / 100,
        interest: Math.round(interest * 100) / 100,
        remainingPrincipal: Math.round(remainingPrincipal * 100) / 100,
        isPaid: false,
        extraPayment: extraPayment > 0 ? extraPayment : undefined,
      });

      currentDate = currentDate.add(1, 'month');
      period++;
    }
  }

  return {
    monthlyPayment: schedule.length > 0 ? schedule[0].payment : 0,
    totalPayment: Math.round(totalPayment * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    schedule,
  };
}

export function calculateRepaymentStrategy(
  debts: Debt[],
  strategy: RepaymentStrategy,
  extraMonthlyAmount: number = 0
): RepaymentStrategyResult {
  const orderedDebts = [...debts].sort((a, b) => {
    if (strategy === 'avalanche') {
      return b.annualRate - a.annualRate;
    } else {
      return a.principal - b.principal;
    }
  });

  const debtInfo: Map<string, { remaining: number; monthlyPayment: number; rate: number; name: string }> = new Map();
  let originalTotalInterest = 0;

  for (const debt of debts) {
    const calc = calculateEqualInstallment(debt.principal, debt.annualRate, debt.termMonths);
    debtInfo.set(debt.id, {
      remaining: debt.principal,
      monthlyPayment: calc.monthlyPayment,
      rate: debt.annualRate / 100 / 12,
      name: debt.name,
    });
    originalTotalInterest += calc.totalInterest;
  }

  const monthlyRate = (debt: Debt) => debt.annualRate / 100 / 12;
  const minPayments: Map<string, number> = new Map();
  for (const debt of debts) {
    const calc = calculateEqualInstallment(debt.principal, debt.annualRate, debt.termMonths);
    minPayments.set(debt.id, calc.monthlyPayment);
  }

  const schedule: RepaymentStrategyResult['schedule'] = [];
  let month = 1;
  let totalInterest = 0;
  let currentDate = dayjs();
  const remainingPrincipals = new Map<string, number>();
  for (const debt of debts) {
    remainingPrincipals.set(debt.id, debt.principal);
  }

  while (Array.from(remainingPrincipals.values()).some((r) => r > 0.01)) {
    const monthPayments: RepaymentStrategyResult['schedule'][0]['payments'] = [];
    let monthTotalPayment = 0;
    let extraRemaining = extraMonthlyAmount;

    for (const debt of orderedDebts) {
      const remaining = remainingPrincipals.get(debt.id) || 0;
      if (remaining <= 0.01) continue;

      const minPayment = minPayments.get(debt.id) || 0;
      const rate = monthlyRate(debt);
      const interest = remaining * rate;
      let principalPayment = minPayment - interest;
      let extraPayment = 0;

      if (extraRemaining > 0) {
        extraPayment = Math.min(extraRemaining, remaining - principalPayment);
        extraRemaining -= extraPayment;
        principalPayment += extraPayment;
      }

      if (principalPayment >= remaining) {
        principalPayment = remaining;
        extraPayment = Math.max(0, principalPayment - (minPayment - interest));
      }

      const payment = principalPayment + interest;
      const newRemaining = remaining - principalPayment;

      remainingPrincipals.set(debt.id, Math.max(0, newRemaining));
      totalInterest += interest;
      monthTotalPayment += payment;

      monthPayments.push({
        debtId: debt.id,
        debtName: debt.name,
        payment: Math.round(payment * 100) / 100,
        extraPayment: Math.round(extraPayment * 100) / 100,
        remainingPrincipal: Math.round(Math.max(0, newRemaining) * 100) / 100,
      });
    }

    schedule.push({
      month,
      date: currentDate.format('YYYY-MM-DD'),
      payments: monthPayments,
      totalPayment: Math.round(monthTotalPayment * 100) / 100,
    });

    currentDate = currentDate.add(1, 'month');
    month++;

    if (month > 600) break;
  }

  const strategyNames: Record<RepaymentStrategy, string> = {
    avalanche: '雪崩法',
    snowball: '雪球法',
  };

  const strategyDescriptions: Record<RepaymentStrategy, string> = {
    avalanche: '优先偿还利率最高的债务，最大化节省利息',
    snowball: '优先偿还余额最小的债务，快速获得成就感',
  };

  return {
    strategy,
    strategyName: strategyNames[strategy],
    description: strategyDescriptions[strategy],
    orderedDebts: orderedDebts.map((debt, index) => ({
      debtId: debt.id,
      debtName: debt.name,
      priority: index + 1,
    })),
    totalInterest: Math.round(totalInterest * 100) / 100,
    savedInterest: Math.round((originalTotalInterest - totalInterest) * 100) / 100,
    originalTotalInterest: Math.round(originalTotalInterest * 100) / 100,
    schedule,
  };
}

export function simulatePrepayment(
  debt: Debt,
  prepaymentAmount: number,
  prepaymentPeriod: number = 1,
  reduceMethod: 'reduce_term' | 'reduce_payment' = 'reduce_term'
): PrepaymentSimulationResult {
  const originalCalc = generateRepaymentSchedule(debt);
  const extraPayments = new Map<number, number>();
  extraPayments.set(prepaymentPeriod, prepaymentAmount);

  const newCalc = generateRepaymentSchedule(debt, extraPayments);

  let adjustedMonthlyPayment = newCalc.monthlyPayment;
  let adjustedSchedule = newCalc.schedule;

  if (reduceMethod === 'reduce_payment' && newCalc.schedule.length > 0) {
    const remainingAfterPrepayment = newCalc.schedule[prepaymentPeriod - 1]?.remainingPrincipal || 0;
    const remainingMonths = debt.termMonths - prepaymentPeriod;
    if (remainingMonths > 0 && remainingAfterPrepayment > 0) {
      const recalculated = calculateEqualInstallment(
        remainingAfterPrepayment,
        debt.annualRate,
        remainingMonths
      );
      adjustedMonthlyPayment = recalculated.monthlyPayment;

      adjustedSchedule = [...newCalc.schedule.slice(0, prepaymentPeriod)];
      let remaining = remainingAfterPrepayment;
      const monthlyRate = debt.annualRate / 100 / 12;
      let currentDate = dayjs(newCalc.schedule[prepaymentPeriod - 1].date).add(1, 'month');

      for (let i = 0; i < remainingMonths && remaining > 0.01; i++) {
        const interest = remaining * monthlyRate;
        let principalPayment = adjustedMonthlyPayment - interest;
        if (principalPayment >= remaining) {
          principalPayment = remaining;
        }
        remaining -= principalPayment;
        adjustedSchedule.push({
          period: prepaymentPeriod + i + 1,
          date: currentDate.format('YYYY-MM-DD'),
          payment: Math.round((principalPayment + interest) * 100) / 100,
          principal: Math.round(principalPayment * 100) / 100,
          interest: Math.round(interest * 100) / 100,
          remainingPrincipal: Math.round(Math.max(0, remaining) * 100) / 100,
          isPaid: false,
        });
        currentDate = currentDate.add(1, 'month');
      }
    }
  }

  const newTotalPayment = adjustedSchedule.reduce((sum, item) => sum + item.payment, 0);
  const newTotalInterest = adjustedSchedule.reduce((sum, item) => sum + item.interest, 0);

  return {
    original: {
      totalMonths: originalCalc.schedule.length,
      totalPayment: originalCalc.totalPayment,
      totalInterest: originalCalc.totalInterest,
      monthlyPayment: originalCalc.monthlyPayment,
    },
    afterPrepayment: {
      totalMonths: adjustedSchedule.length,
      totalPayment: Math.round(newTotalPayment * 100) / 100,
      totalInterest: Math.round(newTotalInterest * 100) / 100,
      monthlyPayment: Math.round(adjustedMonthlyPayment * 100) / 100,
    },
    difference: {
      monthsSaved: originalCalc.schedule.length - adjustedSchedule.length,
      interestSaved: Math.round((originalCalc.totalInterest - newTotalInterest) * 100) / 100,
      totalPaymentSaved: Math.round((originalCalc.totalPayment - newTotalPayment) * 100) / 100,
    },
    newSchedule: adjustedSchedule,
  };
}
