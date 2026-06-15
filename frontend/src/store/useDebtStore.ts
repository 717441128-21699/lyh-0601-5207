import { create } from 'zustand';
import { Debt, MonthlyReport, RepaymentRecord, ReminderSettings, UpcomingPayment } from '../types';
import { debtApi, repaymentApi, reminderApi, reportApi } from '../services/api';

interface DebtStore {
  debts: Debt[];
  selectedDebt: Debt | null;
  repaymentRecords: RepaymentRecord[];
  reminderSettings: ReminderSettings[];
  upcomingPayments: UpcomingPayment[];
  monthlyReports: MonthlyReport[];
  loading: boolean;
  error: string | null;

  fetchDebts: () => Promise<void>;
  fetchDebtById: (id: string) => Promise<void>;
  createDebt: (data: Omit<Debt, 'id' | 'createdAt' | 'updatedAt'>) => Promise<boolean>;
  updateDebt: (id: string, data: Omit<Debt, 'id' | 'createdAt' | 'updatedAt'>) => Promise<boolean>;
  deleteDebt: (id: string) => Promise<boolean>;

  fetchRepaymentRecords: (debtId: string) => Promise<void>;
  createRepaymentRecord: (formData: FormData) => Promise<boolean>;
  verifyRepayment: (id: string, verified: boolean) => Promise<boolean>;
  deleteRepaymentRecord: (id: string) => Promise<boolean>;

  fetchReminderSettings: () => Promise<void>;
  updateGlobalReminder: (data: Omit<ReminderSettings, 'id' | 'debtId' | 'createdAt' | 'updatedAt'>) => Promise<boolean>;
  fetchUpcomingPayments: (days?: number) => Promise<void>;

  fetchMonthlyReports: () => Promise<void>;
  generateMonthlyReport: (month: string) => Promise<boolean>;

  setSelectedDebt: (debt: Debt | null) => void;
  clearError: () => void;
}

export const useDebtStore = create<DebtStore>((set) => ({
  debts: [],
  selectedDebt: null,
  repaymentRecords: [],
  reminderSettings: [],
  upcomingPayments: [],
  monthlyReports: [],
  loading: false,
  error: null,

  fetchDebts: async () => {
    set({ loading: true, error: null });
    try {
      const response = await debtApi.getAll();
      if (response.success && response.data) {
        set({ debts: response.data });
      } else {
        set({ error: response.error || '获取债务列表失败' });
      }
    } catch (error: any) {
      set({ error: error.message || '网络错误' });
    } finally {
      set({ loading: false });
    }
  },

  fetchDebtById: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const response = await debtApi.getById(id);
      if (response.success && response.data) {
        set({ selectedDebt: response.data });
      } else {
        set({ error: response.error || '获取债务详情失败' });
      }
    } catch (error: any) {
      set({ error: error.message || '网络错误' });
    } finally {
      set({ loading: false });
    }
  },

  createDebt: async (data) => {
    set({ loading: true, error: null });
    try {
      const response = await debtApi.create(data);
      if (response.success) {
        set((state) => ({
          debts: response.data ? [response.data, ...state.debts] : state.debts,
        }));
        return true;
      } else {
        set({ error: response.error || '创建债务失败' });
        return false;
      }
    } catch (error: any) {
      set({ error: error.message || '网络错误' });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  updateDebt: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const response = await debtApi.update(id, data);
      if (response.success) {
        set((state) => ({
          debts: state.debts.map((d) => (d.id === id ? { ...d, ...data, updatedAt: new Date().toISOString() } : d)),
          selectedDebt: state.selectedDebt?.id === id ? { ...state.selectedDebt, ...data, updatedAt: new Date().toISOString() } : state.selectedDebt,
        }));
        return true;
      } else {
        set({ error: response.error || '更新债务失败' });
        return false;
      }
    } catch (error: any) {
      set({ error: error.message || '网络错误' });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  deleteDebt: async (id) => {
    set({ loading: true, error: null });
    try {
      const response = await debtApi.delete(id);
      if (response.success) {
        set((state) => ({
          debts: state.debts.filter((d) => d.id !== id),
          selectedDebt: state.selectedDebt?.id === id ? null : state.selectedDebt,
        }));
        return true;
      } else {
        set({ error: response.error || '删除债务失败' });
        return false;
      }
    } catch (error: any) {
      set({ error: error.message || '网络错误' });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  fetchRepaymentRecords: async (debtId) => {
    set({ loading: true, error: null });
    try {
      const response = await repaymentApi.getByDebt(debtId);
      if (response.success && response.data) {
        set({ repaymentRecords: response.data });
      } else {
        set({ error: response.error || '获取还款记录失败' });
      }
    } catch (error: any) {
      set({ error: error.message || '网络错误' });
    } finally {
      set({ loading: false });
    }
  },

  createRepaymentRecord: async (formData) => {
    set({ loading: true, error: null });
    try {
      const response = await repaymentApi.create(formData);
      if (response.success && response.data) {
        set((state) => ({
          repaymentRecords: [...state.repaymentRecords, response.data!],
        }));
        return true;
      } else {
        set({ error: response.error || '创建还款记录失败' });
        return false;
      }
    } catch (error: any) {
      set({ error: error.message || '网络错误' });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  verifyRepayment: async (id, verified) => {
    try {
      const response = await repaymentApi.verify(id, verified);
      if (response.success) {
        set((state) => ({
          repaymentRecords: state.repaymentRecords.map((r) =>
            r.id === id ? { ...r, verified } : r
          ),
        }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  deleteRepaymentRecord: async (id) => {
    try {
      const response = await repaymentApi.delete(id);
      if (response.success) {
        set((state) => ({
          repaymentRecords: state.repaymentRecords.filter((r) => r.id !== id),
        }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  fetchReminderSettings: async () => {
    set({ loading: true, error: null });
    try {
      const response = await reminderApi.getAll();
      if (response.success && response.data) {
        set({ reminderSettings: response.data });
      }
    } catch (error: any) {
      set({ error: error.message || '网络错误' });
    } finally {
      set({ loading: false });
    }
  },

  updateGlobalReminder: async (data) => {
    set({ loading: true, error: null });
    try {
      const response = await reminderApi.updateGlobal(data);
      if (response.success) {
        await useDebtStore.getState().fetchReminderSettings();
        return true;
      } else {
        set({ error: response.error || '更新提醒设置失败' });
        return false;
      }
    } catch (error: any) {
      set({ error: error.message || '网络错误' });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  fetchUpcomingPayments: async (days) => {
    try {
      const response = await reminderApi.getUpcoming(days);
      if (response.success && response.data) {
        set({ upcomingPayments: response.data });
      }
    } catch {
      // Ignore error
    }
  },

  fetchMonthlyReports: async () => {
    set({ loading: true, error: null });
    try {
      const response = await reportApi.getAll();
      if (response.success && response.data) {
        set({ monthlyReports: response.data });
      }
    } catch (error: any) {
      set({ error: error.message || '网络错误' });
    } finally {
      set({ loading: false });
    }
  },

  generateMonthlyReport: async (month) => {
    set({ loading: true, error: null });
    try {
      const response = await reportApi.generate(month);
      if (response.success && response.data) {
        set((state) => ({
          monthlyReports: [response.data!, ...state.monthlyReports],
        }));
        return true;
      } else {
        set({ error: response.error || '生成月度报告失败' });
        return false;
      }
    } catch (error: any) {
      set({ error: error.message || '网络错误' });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  setSelectedDebt: (debt) => set({ selectedDebt: debt }),
  clearError: () => set({ error: null }),
}));
