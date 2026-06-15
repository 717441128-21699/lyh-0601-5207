import axios from 'axios';
import {
  Debt,
  DebtCalculationResult,
  RepaymentStrategyResult,
  PrepaymentSimulationResult,
  RepaymentRecord,
  ReminderSettings,
  UpcomingPayment,
  MonthlyReport,
  ApiResponse,
  RepaymentStrategy,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const debtApi = {
  getAll: () => api.get<ApiResponse<Debt[]>>('/debts').then((res) => res.data),
  getById: (id: string) => api.get<ApiResponse<Debt>>(`/debts/${id}`).then((res) => res.data),
  create: (data: Omit<Debt, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<ApiResponse<Debt>>('/debts', data).then((res) => res.data),
  update: (id: string, data: Omit<Debt, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.put<ApiResponse>(`/debts/${id}`, data).then((res) => res.data),
  delete: (id: string) => api.delete<ApiResponse>(`/debts/${id}`).then((res) => res.data),
  getSchedule: (id: string) =>
    api.get<ApiResponse<DebtCalculationResult>>(`/debts/${id}/schedule`).then((res) => res.data),
  getStrategy: (strategy: RepaymentStrategy, extraMonthlyAmount?: number) =>
    api.post<ApiResponse<RepaymentStrategyResult>>('/debts/strategy', { strategy, extraMonthlyAmount }).then((res) => res.data),
  simulatePrepayment: (
    id: string,
    prepaymentAmount: number,
    prepaymentPeriod?: number,
    reduceMethod?: 'reduce_term' | 'reduce_payment'
  ) =>
    api
      .post<ApiResponse<PrepaymentSimulationResult>>(`/debts/${id}/prepayment`, {
        prepaymentAmount,
        prepaymentPeriod,
        reduceMethod,
      })
      .then((res) => res.data),
};

export const repaymentApi = {
  getByDebt: (debtId: string) =>
    api.get<ApiResponse<RepaymentRecord[]>>(`/repayments/debt/${debtId}`).then((res) => res.data),
  create: (formData: FormData) =>
    api.post<ApiResponse<RepaymentRecord>>('/repayments', formData).then((res) => res.data),
  verify: (id: string, verified: boolean) =>
    api.put<ApiResponse>(`/repayments/${id}/verify`, { verified }).then((res) => res.data),
  delete: (id: string) => api.delete<ApiResponse>(`/repayments/${id}`).then((res) => res.data),
};

export const reminderApi = {
  getAll: () => api.get<ApiResponse<ReminderSettings[]>>('/reminders').then((res) => res.data),
  updateGlobal: (data: Omit<ReminderSettings, 'id' | 'debtId' | 'createdAt' | 'updatedAt'>) =>
    api.put<ApiResponse>('/reminders/global', data).then((res) => res.data),
  createForDebt: (debtId: string, data: Omit<ReminderSettings, 'id' | 'debtId' | 'createdAt' | 'updatedAt'>) =>
    api.post<ApiResponse>(`/reminders/debt/${debtId}`, data).then((res) => res.data),
  update: (id: string, data: Omit<ReminderSettings, 'id' | 'debtId' | 'createdAt' | 'updatedAt'>) =>
    api.put<ApiResponse>(`/reminders/${id}`, data).then((res) => res.data),
  delete: (id: string) => api.delete<ApiResponse>(`/reminders/${id}`).then((res) => res.data),
  getUpcoming: (days?: number) =>
    api.get<ApiResponse<UpcomingPayment[]>>('/reminders/upcoming', { params: { days } }).then((res) => res.data),
};

export const reportApi = {
  getAll: () => api.get<ApiResponse<MonthlyReport[]>>('/reports').then((res) => res.data),
  getByMonth: (month: string) =>
    api.get<ApiResponse<MonthlyReport>>(`/reports/${month}`).then((res) => res.data),
  generate: (month: string) =>
    api.post<ApiResponse<MonthlyReport>>(`/reports/generate/${month}`).then((res) => res.data),
  downloadPdf: (month: string) => {
    window.open(`/api/reports/${month}/pdf`, '_blank');
  },
};

export default api;
