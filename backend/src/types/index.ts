export type DebtType = 'credit_card' | 'mortgage' | 'car_loan' | 'personal_loan' | 'other';

export type RepaymentMethod = 'equal_installment' | 'equal_principal';

export type RepaymentStrategy = 'avalanche' | 'snowball';

export interface Debt {
  id: string;
  name: string;
  type: DebtType;
  principal: number;
  annualRate: number;
  termMonths: number;
  repaymentMethod: RepaymentMethod;
  startDate: string;
  dueDay: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RepaymentScheduleItem {
  period: number;
  date: string;
  payment: number;
  principal: number;
  interest: number;
  remainingPrincipal: number;
  isPaid: boolean;
  extraPayment?: number;
}

export interface DebtCalculationResult {
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
  schedule: RepaymentScheduleItem[];
}

export interface RepaymentRecord {
  id: string;
  debtId: string;
  period: number;
  amount: number;
  extraPayment: number;
  paymentDate: string;
  voucherUrl?: string;
  verified: boolean;
  note?: string;
  createdAt: string;
}

export interface RepaymentStrategyResult {
  strategy: RepaymentStrategy;
  strategyName: string;
  description: string;
  orderedDebts: {
    debtId: string;
    debtName: string;
    priority: number;
  }[];
  totalInterest: number;
  savedInterest: number;
  originalTotalInterest: number;
  schedule: {
    month: number;
    date: string;
    payments: {
      debtId: string;
      debtName: string;
      payment: number;
      extraPayment: number;
      remainingPrincipal: number;
    }[];
    totalPayment: number;
  }[];
}

export interface PrepaymentSimulationResult {
  original: {
    totalMonths: number;
    totalPayment: number;
    totalInterest: number;
    monthlyPayment: number;
  };
  afterPrepayment: {
    totalMonths: number;
    totalPayment: number;
    totalInterest: number;
    monthlyPayment: number;
  };
  difference: {
    monthsSaved: number;
    interestSaved: number;
    totalPaymentSaved: number;
  };
  newSchedule: RepaymentScheduleItem[];
}

export interface ReminderSettings {
  id: string;
  debtId?: string;
  enabled: boolean;
  daysBefore: number;
  notificationType: 'email' | 'push' | 'both';
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyReport {
  id: string;
  month: string;
  totalDebt: number;
  previousMonthTotalDebt: number;
  debtChange: number;
  monthlyPaymentTotal: number;
  interestPaid: number;
  principalPaid: number;
  debts: {
    debtId: string;
    debtName: string;
    beginningBalance: number;
    endingBalance: number;
    payment: number;
    interest: number;
    principal: number;
  }[];
  createdAt: string;
}

export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
