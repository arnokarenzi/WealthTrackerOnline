import axios from "axios";
import {
  DashboardSummary,
  Expense,
  Investment,
  MonthlyBudget,
  GratitudeLog,
  SavingsGoal,
  ActualInvestment,
  PendingEarningItem,
} from "../types/api";

export interface WalletIncomeItem {
  id: number;
  amount: number;
  description: string;
  source_type: "shift_rollover" | "side_income";
  created_at: string;
}

const DEV_API_URL = "http://localhost:5000/api";
const PROD_API_URL = "https://wealthtrackeronline.onrender.com/api";

const baseURL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? DEV_API_URL
    : PROD_API_URL;

const apiClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const financeApi = {
  // --- DASHBOARD & BUDGET ENDPOINTS ---
  getDashboardSummary: async (): Promise<DashboardSummary> => {
    const response =
      await apiClient.get<DashboardSummary>("/dashboard/summary");
    return response.data;
  },

  updateLettersTranslated: async (
    lettersCount: number
  ): Promise<{ message: string }> => {
    const response = await apiClient.post("/monthly-budget/letters", {
      letters: lettersCount,
    });
    return response.data;
  },

  recordTranslatedLetters: async (
    newLetters: number | string
  ): Promise<void> => {
    await apiClient.post("/dashboard/letters", { newLetters });
  },

  resetActiveShift: async (): Promise<{ message: string }> => {
    const response = await apiClient.post("/dashboard/reset-shift");
    return response.data;
  },

  getBudgetPlan: async (): Promise<MonthlyBudget> => {
    const response = await apiClient.get<MonthlyBudget>("/monthly-budget");
    return response.data;
  },

  updateBudgetPlan: async (budget: Partial<MonthlyBudget>): Promise<void> => {
    await apiClient.put("/monthly-budget", budget);
  },

  getWalletIncomeHistory: async (startDate?: string, endDate?: string): Promise<WalletIncomeItem[]> => {
    let url = "/monthly-budget/income-history";
    if (startDate && endDate) {
      url += `?startDate=${startDate}&endDate=${endDate}`;
    }
    const response = await apiClient.get<WalletIncomeItem[]>(url);
    return response.data;
  },

  initializeProjectDefaults: async (passphrase?: string): Promise<void> => {
    await apiClient.post("/monthly-budget/initialize", { passphrase });
  },

  resetAllData: async (): Promise<void> => {
    await apiClient.post("/reset-all-data");
  },

  resetMonth: async (): Promise<{ message: string }> => {
    const response = await apiClient.post("/monthly-budget/reset");
    return response.data;
  },

  resetMonthAndExport: async (): Promise<{ message: string }> => {
    const response = await apiClient.post("/monthly-budget/reset");
    return response.data;
  },

  // --- EXPENSES ENDPOINTS ---
  getExpenses: async (): Promise<Expense[]> => {
    const response = await apiClient.get<Expense[]>("/daily-expenses");
    return response.data;
  },

  getExpenseHistory: async (
    startDate: string,
    endDate: string
  ): Promise<Expense[]> => {
    const response = await apiClient.get<Expense[]>(
      `/daily-expenses/history?startDate=${startDate}&endDate=${endDate}`
    );
    return response.data;
  },

  addExpense: async (expense: Expense): Promise<{ message: string }> => {
    const response = await apiClient.post("/daily-expenses", expense);
    return response.data;
  },

  deleteExpense: async (id: number): Promise<void> => {
    await apiClient.delete(`/daily-expenses/${id}`);
  },

  addExtraIncome: async (data: {
    amount: number;
    description: string;
  }): Promise<{ message: string }> => {
    const response = await apiClient.post("/monthly-budget/add-income", data);
    return response.data;
  },

  getPendingEarnings: async (): Promise<PendingEarningItem[]> => {
    const response = await apiClient.get("/pending-earnings");
    return response.data;
  },

  claimPendingEarning: async (id: number): Promise<void> => {
    await apiClient.post(`/pending-earnings/claim/${id}`);
  },

  // --- INVESTMENTS & PORTFOLIOS ---
  getInvestments: async (
    month: number,
    year: number
  ): Promise<Investment[]> => {
    const response = await apiClient.get<Investment[]>(
      `/investments?month=${month}&year=${year}`
    );
    return response.data;
  },

  logInvestmentAsset: async (
    investment: Investment
  ): Promise<{ message: string }> => {
    const response = await apiClient.post("/investments", investment);
    return response.data;
  },

  deleteInvestmentAsset: async (
    id: number,
    month: number,
    year: number
  ): Promise<void> => {
    await apiClient.delete(`/investments/${id}`, { data: { month, year } });
  },

  getGratitudeHistory: async (): Promise<GratitudeLog[]> => {
    const response = await apiClient.get<GratitudeLog[]>("/gratitude");
    return response.data;
  },

  saveGratitudeReflection: async (reflection: string): Promise<void> => {
    await apiClient.post("/gratitude", { reflection });
  },

  getActualInvestments: async (): Promise<ActualInvestment[]> => {
    const response = await apiClient.get<ActualInvestment[]>(
      "/actual-investments"
    );
    return response.data;
  },

  deleteSavingsGoal: async (id: number): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/savings-goals/${id}`);
    return response.data;
  },

  updateInvestmentValue: async (
    id: number,
    currentValue: number
  ): Promise<void> => {
    await apiClient.put(`/actual-investments/${id}`, {
      current_value: currentValue,
    });
  },

  deployInvestmentReserve: async (data: {
    assetName: string;
    amount: number;
    assetType?: string;
  }): Promise<{ message: string }> => {
    const response = await apiClient.post("/actual-investments/deploy", {
      asset_name: data.assetName,
      amount: data.amount,
      asset_type: data.assetType || "Bond",
    });
    return response.data;
  },

  // --- SAVINGS GOALS ENDPOINTS ---
  getSavingsGoals: async (): Promise<SavingsGoal[]> => {
    const response = await apiClient.get<SavingsGoal[]>("/savings-goals");
    return response.data;
  },

  updateSavingsGoal: async (
    id: number,
    data: { amountToAdd: string }
  ): Promise<{ message: string }> => {
    const response = await apiClient.put(`/savings-goals/${id}`, data);
    return response.data;
  },

  createSavingsGoal: async (data: {
    goalName: string;
    targetAmount: number;
  }): Promise<{ message: string }> => {
    const response = await apiClient.post("/savings-goals", data);
    return response.data;
  },

  // --- SPECIALIZED RESERVES ENDPOINTS ---
  getEmergencyFund: async (): Promise<{
    current_amount?: number;
    currentAmount?: number;
    target_amount?: number;
    targetAmount?: number;
  }> => {
    const response = await apiClient.get("/emergency");
    return response.data;
  },

  updateEmergencyFund: async (current_amount: number): Promise<void> => {
    await apiClient.put("/emergency", { current_amount });
  },

  getSchoolFees: async (): Promise<unknown> => {
    const response = await apiClient.get<unknown>("/school-fees");
    return response.data;
  },

  updateSchoolFees: async (amountSaved: number): Promise<void> => {
    await apiClient.post("/school-fees", { amountSaved });
  },

  getInvestmentReserve: async (): Promise<{
    amount?: number;
    current_amount?: number;
    currentAmount?: number;
    target_amount?: number;
    targetAmount?: number;
  }> => {
    const response = await apiClient.get("/investments/reserve");
    return response.data;
  },

  updateInvestmentReserve: async (amount: number): Promise<void> => {
    await apiClient.put("/investments/reserve", { amount });
  },
};

export default apiClient;
