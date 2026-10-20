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
  PendingEmergencySnapshotSummary,
  DailyLetterStatus,
  TermConfig,
  SearchResult,
  BillRecord,
  BillPaymentRecord,
  DebtRecord,
  DebtPaymentRecord,
  DebtSummary,
  ReportsPayload,
  NetWorthPayload,
  SettingsPayload,
  AppNotificationRecord,
  ActionCenterPayload,
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
  getBudgetAlerts: async (): Promise<{
    alerts: { level: "critical" | "warning"; message: string }[];
    essentialsSpent: number;
    recommended: number;
  }> => {
    const response = await apiClient.get<{
      alerts: { level: "critical" | "warning"; message: string }[];
      essentialsSpent: number;
      recommended: number;
    }>("/alerts");
    return response.data;
  },
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

  getPendingEmergency: async (): Promise<PendingEmergencySnapshotSummary> => {
    const response = await apiClient.get<PendingEmergencySnapshotSummary>(
      "/emergency/pending",
    );
    return response.data;
  },

  claimPendingEmergency: async (): Promise<{
    message: string;
    depositedAmount: number;
    newTotal: number;
  }> => {
    const response = await apiClient.post("/emergency/pending/claim");
    return response.data;
  },

  depositEmergency: async (
    amount: number,
  ): Promise<{ message: string; newTotal: number }> => {
    const response = await apiClient.post("/emergency/deposit", { amount });
    return response.data;
  },

  // --- DAILY LETTER NOTIFICATIONS ---
  getDailyLetterStatus: async (): Promise<DailyLetterStatus> => {
    const response = await apiClient.get<DailyLetterStatus>(
      "/daily-letters",
    );
    return response.data;
  },

  getPushPublicKey: async (): Promise<{ publicKey: string }> => {
    const response = await apiClient.get<{ publicKey: string }>(
      "/push/public-key",
    );
    return response.data;
  },

  savePushSubscription: async (subscription: PushSubscriptionJSON): Promise<void> => {
    await apiClient.post("/push/subscribe", subscription);
  },

  removePushSubscription: async (endpoint: string): Promise<void> => {
    await apiClient.post("/push/unsubscribe", { endpoint });
  },


  sendTestPushNotification: async (
    subscription: PushSubscriptionJSON,
    kind: "morning" | "midday" | "evening" | "target",
  ): Promise<{
    ok: boolean;
    test: boolean;
    kind: string;
    title: string;
    body: string;
  }> => {
    const response = await apiClient.post("/push/test", {
      subscription,
      kind,
    });
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
  ): Promise<{
    success: boolean;
    addedLetters: number;
    translatedLetters: number;
    shiftLetters: number;
    dailyLetterTarget: number;
    dailyLetterCount: number;
    dailyLettersRemaining: number;
    dailyTargetReached: boolean;
    dailyRequiredPerDay: number;
    dailyShiftDay: number;
    dailyShiftTotalDays: number;
    dailyShiftLetters: number;
    dailyShiftLettersRemaining: number;
    dailyRemainingDaysInShift: number;
  }> => {
    const response = await apiClient.post("/dashboard/letters", { newLetters });
    return response.data;
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

  // --- Backend-backed search ---
  searchRecords: async (query: string, options?: { type?: string; limit?: number; offset?: number }): Promise<{
    query: string; type: string; limit: number; offset: number; hasMore: boolean; results: SearchResult[];
  }> => {
    const response = await apiClient.get("/search", {
      params: { q: query, type: options?.type || "all", limit: options?.limit || 10, offset: options?.offset || 0 },
    });
    return response.data;
  },

  // --- Bills and payment history ---
  getBills: async (options?: { status?: "all" | "paid" | "unpaid"; q?: string; limit?: number; offset?: number; includeArchived?: boolean }): Promise<BillRecord[]> => {
    const response = await apiClient.get<BillRecord[]>("/bills", { params: options });
    return response.data;
  },
  createBill: async (payload: Partial<BillRecord> & { billName: string; dueDate: string; amount: number }): Promise<{ message: string; bill: BillRecord }> => {
    const response = await apiClient.post("/bills", payload);
    return response.data;
  },
  updateBill: async (id: number, payload: Partial<BillRecord>): Promise<{ message: string; bill: BillRecord }> => {
    const response = await apiClient.put(`/bills/${id}`, payload);
    return response.data;
  },
  archiveBill: async (id: number): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/bills/${id}`);
    return response.data;
  },
  recordBillPayment: async (id: number, payload: { requestId: string; paymentDate?: string; paymentMethod?: string; notes?: string }): Promise<{ message: string; bill: BillRecord }> => {
    const response = await apiClient.post(`/bills/${id}/payments`, payload);
    return response.data;
  },
  getBillPayments: async (id?: number): Promise<BillPaymentRecord[]> => {
    const path = id === undefined ? "/bills/payments" : `/bills/${id}/payments`;
    const response = await apiClient.get<BillPaymentRecord[]>(path);
    return response.data;
  },
  getBillPaymentTrends: async (): Promise<{ data: Array<{ id: string; data: Array<{ x: string; y: number }> }>; hasPayments: boolean; months: Array<{ key: string; label: string }> }> => {
    const response = await apiClient.get("/bills/trends");
    return response.data;
  },

  // --- Debt and repayment history ---
  getDebts: async (includeArchived = false): Promise<DebtRecord[]> => {
    const response = await apiClient.get<DebtRecord[]>("/debts", { params: { includeArchived } });
    return response.data;
  },
  createDebt: async (payload: {
    creditor: string; debtType: string; balance: number; interestRate?: number | null;
    minimumPayment?: number | null; dueDate?: string | null; loanTerm?: string;
    frequency?: string; paymentMethod?: string;
  }): Promise<{ message: string; debt: DebtRecord }> => {
    const response = await apiClient.post("/debts", payload);
    return response.data;
  },
  updateDebt: async (id: number, payload: Partial<DebtRecord>): Promise<{ message: string; debt: DebtRecord }> => {
    const response = await apiClient.put(`/debts/${id}`, payload);
    return response.data;
  },
  archiveDebt: async (id: number): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/debts/${id}`);
    return response.data;
  },
  recordDebtPayment: async (id: number, payload: { amount: number; requestId: string; paymentDate?: string; paymentMethod?: string; reference?: string }): Promise<{ message: string; debt: DebtRecord }> => {
    const response = await apiClient.post(`/debts/${id}/payments`, payload);
    return response.data;
  },
  getDebtPayments: async (): Promise<DebtPaymentRecord[]> => {
    const response = await apiClient.get<DebtPaymentRecord[]>("/debts/payments");
    return response.data;
  },
  getDebtSummary: async (): Promise<DebtSummary> => {
    const response = await apiClient.get<DebtSummary>("/debts/summary");
    return response.data;
  },

  // --- Reports ---
  getReports: async (startDate?: string, endDate?: string): Promise<ReportsPayload> => {
    const response = await apiClient.get<ReportsPayload>("/reports", {
      params: { ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {}) },
    });
    return response.data;
  },

  // --- Net worth ---
  getNetWorth: async (): Promise<NetWorthPayload> => {
    const response = await apiClient.get<NetWorthPayload>("/net-worth");
    return response.data;
  },
  createNetWorthAsset: async (payload: { assetName: string; assetType: string; currentValue: number; currency?: string; acquisitionDate?: string | null; description?: string }): Promise<{ message: string; id: number }> => {
    const response = await apiClient.post("/net-worth/assets", payload);
    return response.data;
  },
  archiveNetWorthAsset: async (id: number): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/net-worth/assets/${id}`);
    return response.data;
  },
  saveNetWorthSnapshot: async (): Promise<{ message: string; date: string; totalAssets: number; totalLiabilities: number; netWorth: number }> => {
    const response = await apiClient.post("/net-worth/snapshots");
    return response.data;
  },

  // --- Persisted settings ---
  getSettings: async (): Promise<SettingsPayload> => {
    const response = await apiClient.get<SettingsPayload>("/settings");
    return response.data;
  },
  updateSettings: async (payload: Partial<SettingsPayload>): Promise<SettingsPayload> => {
    const response = await apiClient.patch<SettingsPayload>("/settings", payload);
    return response.data;
  },

  // --- Persisted in-app notifications, distinct from push delivery ---
  getNotifications: async (): Promise<AppNotificationRecord[]> => {
    const response = await apiClient.get<AppNotificationRecord[]>("/notifications");
    return response.data;
  },
  markNotificationRead: async (id: number): Promise<{ message: string }> => {
    const response = await apiClient.patch(`/notifications/${id}/read`);
    return response.data;
  },
  markAllNotificationsRead: async (): Promise<{ message: string; updatedCount: number }> => {
    const response = await apiClient.post("/notifications/read-all");
    return response.data;
  },

  // --- Action Center source data ---
  getActionCenter: async (): Promise<ActionCenterPayload> => {
    const response = await apiClient.get<ActionCenterPayload>("/action-center");
    return response.data;
  },
};

export default apiClient;
