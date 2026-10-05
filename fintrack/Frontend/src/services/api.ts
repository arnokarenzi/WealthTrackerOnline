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
  WalletIncomeItem,
  AllocationTemplate,
  AllocationRecommendations,
  AllocationResponse,
  ReserveFundInfo,
  TermConfig,
} from "../types/api";

const DEV_API_URL = "http://localhost:5000/api";
const PROD_API_URL = "https://wealthtrackeronline.onrender.com/api";

const baseURL =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1")
    ? DEV_API_URL
    : import.meta.env.VITE_API_BASE_URL || PROD_API_URL;

const apiClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const financeApi = {
  // --- ALLOCATION TEMPLATE & TARGET ENDPOINTS ---
  getAllocations: async (): Promise<AllocationResponse> => {
    const response = await apiClient.get<AllocationResponse>("/allocations");
    return response.data;
  },

  getAllocationTemplate: async (): Promise<AllocationTemplate> => {
    const response = await apiClient.get<AllocationTemplate>("/allocations");
    return response.data;
  },

  updateAllocationTemplate: async (
    payload: AllocationTemplate,
  ): Promise<{ message: string }> => {
    const response = await apiClient.put("/allocations", payload);
    return response.data;
  },

  applyAllocationTemplate: async (
    payload: AllocationTemplate,
  ): Promise<AllocationRecommendations> => {
    const response = await apiClient.post<AllocationRecommendations>(
      "/allocations/apply",
      payload,
    );
    return response.data;
  },

  depositEmergency: async (
    amount: number,
  ): Promise<{ message: string; newTotal: number }> => {
    const response = await apiClient.post("/emergency/deposit", { amount });
    return response.data;
  },

  // --- DASHBOARD & BUDGET ENDPOINTS ---
  getDashboardSummary: async (): Promise<DashboardSummary> => {
    const response =
      await apiClient.get<DashboardSummary>("/dashboard/summary");
    return response.data;
  },

  deployEmergencyFund: async (data: {
    amount: number;
    description?: string;
  }): Promise<{ message: string }> => {
    const response = await apiClient.post("/emergency/deploy", data);
    return response.data;
  },

  updateLettersTranslated: async (
    lettersCount: number,
  ): Promise<{ message: string }> => {
    const response = await apiClient.post("/monthly-budget/letters", {
      letters: lettersCount,
    });
    return response.data;
  },

  recordTranslatedLetters: async (
    newLetters: number | string,
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

  getWalletIncomeHistory: async (
    startDate?: string,
    endDate?: string,
  ): Promise<WalletIncomeItem[]> => {
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
    endDate: string,
  ): Promise<Expense[]> => {
    const response = await apiClient.get<Expense[]>(
      `/daily-expenses/history?startDate=${startDate}&endDate=${endDate}`,
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
    const response =
      await apiClient.get<PendingEarningItem[]>("/pending-earnings");
    return response.data;
  },

  claimPendingEarning: async (id: number): Promise<void> => {
    await apiClient.post(`/pending-earnings/claim/${id}`);
  },

  // --- INVESTMENTS & PORTFOLIOS ---
  getInvestments: async (
    month: number,
    year: number,
  ): Promise<Investment[]> => {
    const response = await apiClient.get<Investment[]>(
      `/investments?month=${month}&year=${year}`,
    );
    return response.data;
  },

  logInvestmentAsset: async (
    investment: Investment,
  ): Promise<{ message: string }> => {
    const response = await apiClient.post("/investments", investment);
    return response.data;
  },

  deleteInvestmentAsset: async (
    id: number,
    month: number,
    year: number,
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
      "/actual-investments",
    );
    return response.data;
  },

  updateInvestmentValue: async (
    id: number,
    currentValue: number,
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
    const response = await apiClient.post("/investments/deploy", {
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
    data: { amountToAdd: string },
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

  deleteSavingsGoal: async (id: number): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/savings-goals/${id}`);
    return response.data;
  },

  // --- SPECIALIZED RESERVES ENDPOINTS ---
  getEmergencyFund: async (): Promise<ReserveFundInfo> => {
    const response = await apiClient.get<ReserveFundInfo>("/emergency");
    return response.data;
  },

  updateEmergencyFund: async (current_amount: number): Promise<void> => {
    await apiClient.put("/emergency", { current_amount });
  },

  updateEmergencyTarget: async (
    targetAmount: number,
    currentAmount?: number,
  ): Promise<{ message: string }> => {
    const response = await apiClient.put("/emergency", {
      targetAmount,
      target_amount: targetAmount,
      ...(currentAmount !== undefined && {
        currentAmount,
        current_amount: currentAmount,
      }),
    });
    return response.data;
  },

  getSchoolFees: async (): Promise<unknown> => {
    const response = await apiClient.get<unknown>("/school-fees");
    return response.data;
  },

  updateSchoolFees: async (amountSaved: number): Promise<void> => {
    await apiClient.post("/school-fees", { amountSaved });
  },

  getInvestmentReserve: async (): Promise<ReserveFundInfo> => {
    const response = await apiClient.get<ReserveFundInfo>(
      "/investments/reserve",
    );
    return response.data;
  },

  updateInvestmentReserve: async (amount: number): Promise<void> => {
    await apiClient.put("/investments/reserve", { amount });
  },

  updateInvestmentReserveTarget: async (
    targetAmount: number,
    currentAmount?: number,
  ): Promise<{ message: string }> => {
    const response = await apiClient.put("/investments/reserve", {
      targetAmount,
      target_amount: targetAmount,
      ...(currentAmount !== undefined && {
        amount: currentAmount,
        current_amount: currentAmount,
        currentAmount: currentAmount,
      }),
    });
    return response.data;
  },

  // --- TERM CONFIGURATION ENDPOINTS ---
  getTermConfig: async (): Promise<TermConfig> => {
    const response = await apiClient.get<TermConfig>(
      "/school-fees/term-config/active",
    );
    return response.data;
  },

  updateTermConfig: async (payload: {
    targetAmount: number;
    termName?: string;
  }): Promise<{ message: string }> => {
    const response = await apiClient.put("/school-fees/term-config", payload);
    return response.data;
  },
};

export default apiClient;
