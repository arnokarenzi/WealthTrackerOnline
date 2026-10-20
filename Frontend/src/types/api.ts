export interface ShiftStatus {
  medal: string;
  message: string;
  variant: "danger" | "warning" | "success" | "info";
  behind: number;
  isLastDay: boolean;
  shiftDay: number;
  totalDaysInShift: number;
  isShift1: boolean;
  currentDay: number;
  chunkPacingTarget: number;
  projectedPay: number;
  potentialLoss: number;
}

export interface MonthlyBudget {
  id: number;
  salary: number;
  otherIncome: string | number;
  rent: string | number;
  schoolSaving: string | number;
  phoneInternet: string | number;
  electricityWater: string | number;
  food: string | number;
  miscellaneous: string | number;
  medical: string | number;
  familySupport: string | number;
  emergencyFund: string | number;
  investment: string | number;
  balance: number;
  month: number;
  year: number;
  translatedLetters: number;
  shiftLetters: number;
  remainingBalance: number;
}

export interface DashboardSummary {
  wealthScore: number;
  financialStage: string;
  financialHealthBreakdown?: {
    emergencyBuffer: {
      points: number;
      maxPoints: number;
      progressPct: number;
      targetConfigured: boolean;
      balance: number;
      target: number;
    };
    investment: {
      points: number;
      maxPoints: number;
      ratioPct: number;
      capRatioPct: number;
      incomeConfigured: boolean;
      value: number;
    };
    budgetControl: {
      points: number;
      maxPoints: number;
      configured: boolean;
      spendingPct: number | null;
      actualExpenses: number;
      plannedEssentials: number;
    };
    wallet: {
      points: number;
      maxPoints: number;
      positiveBalance: boolean;
      balance: number;
    };
  };
  emergencyTarget: number;
  efCompletionPct: number;
  seedRatio: number;
  essentials: number;
  shiftStatus: ShiftStatus;
  monthlyBudget: MonthlyBudget;
  walletBalance: number;
  schoolFeesBalance: number;
  investmentReserveBalance: number;
  emergencyReserveBalance: number;
  dailyLetterTarget: number;
  dailyLetterCount: number;
  dailyLettersRemaining: number;
  dailyTargetReached: boolean;
  dailyNotificationSent: boolean;
  dailyLetterDate: string;
  pendingEmergencyTotal: number;
  stagedSalaryPortion: number;
  stagedSidePortion: number;
  month: number;
  year: number;
  totalIncomeBase: number;
  totalExpensesLogged: number;
  remainingBalance: number;
  translatedLetters: number;
  shiftLetters: number;
  burnRates: {
    category: string;
    allocated: number;
    spent: number;
    remaining: number;
    percentUsed: number;
  }[];
}

export interface Expense {
  id?: number;
  expenseDate: string;
  description: string;
  category: string;
  amount: number;
  notes?: string;
}

export interface Investment {
  id?: number;
  asset_name: string;
  principal_invested: number;
  current_value: number;
  month: number;
  year: number;
}

export interface GratitudeLog {
  id?: number;
  reflection: string;
  createdAt?: string;
}

export interface SavingsGoal {
  id: number;
  goalName: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
}

export interface ActualInvestment {
  id: number;
  assetName: string;
  assetType: string;
  principalAmount: number;
  currentValue: number;
  lastUpdated: string;
}

export interface PendingEarningItem {
  id: number;
  amount: number;
  description: string;
  earned_date: string;
  is_collected: boolean;
}


export interface PendingEmergencySnapshot {

  pending: boolean;
  snapshotCount: number;
  latestSnapshotId: number | null;
  monthLabel: string | null;
  earnedDate: string | null;
  salaryPortion: number;
  sideIncomePortion: number;
  totalAmount: number;
}

export interface PendingEmergencySnapshotSummary extends PendingEmergencySnapshot {}

export interface DailyLetterStatus {
  date: string;
  shiftDay: number;
  totalDaysInShift: number;
  shiftLetters: number;
  remainingShiftLetters: number;
  remainingDaysInShift: number;
  currentRequiredPerDay: number;
  dailyTarget: number;
  dailyLetterCount: number;
  dailyRemaining: number;
  targetReached: boolean;
  notificationSent: boolean;
  targetReachedAt: string | null;
  pacingTargetSetAt: string | null;
}

export interface WalletIncomeItem {
  id: number;
  amount: number;
  description: string;
  source_type: "shift_rollover" | "side_income";
  created_at: string;
}

export interface AllocationTemplate {
  id?: number;
  emergency_pct: number;
  essentials_pct: number;
  invest_pct: number;
  discretionary_pct: number;
  salary?: number;
  otherIncome?: number;
  totalIncome?: number;
}

export interface AllocationRecommendations {
  salary?: number;
  otherIncome?: number;
  totalIncome?: number;
  recommendedEssentials: number;
  recommendedEmergency: number;
  recommendedInvest: number;
  recommendedDiscretionary: number;
}

export interface AllocationResponse {
  essentials_pct: number;
  emergency_pct: number;
  invest_pct: number;
  discretionary_pct: number;
  salary: number;
  otherIncome: number;
  totalIncome: number;
  emergencySalaryPortion: number;
  emergencySidePortion: number;
  recommendedEmergency: number;
}

export interface ReserveFundInfo {
  amount?: number;
  current_amount?: number;
  currentAmount?: number;
  target_amount?: number;
  targetAmount?: number;
}

export interface TermConfig {
  id: number | null;
  term_name: string;
  target_amount: number;
}

export type NotificationLevel = "critical" | "warning" | "info" | "success";

export interface SearchResult {
  id: string;
  recordId: number;
  type: "expense" | "bill" | "debt" | "savings-goal" | "investment";
  title: string;
  detail: string;
  amount: number | null;
  date: string | null;
  route: string;
}

export interface BillRecord {
  id: number;
  billName: string;
  vendor: string;
  status: "Paid" | "Unpaid";
  paymentDate: string | null;
  dueDate: string;
  amount: number;
  frequency: string;
  paymentMethod: string;
  category: string;
  notes: string;
  notification: boolean;
  autoPay: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BillPaymentRecord {
  id: number;
  billId: number;
  billName: string;
  category: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  notes: string;
  createdAt?: string;
}

export interface DebtRecord {
  id: number;
  creditor: string;
  debtType: string;
  originalBalance: number;
  balance: number;
  interestRate: number | null;
  minimumPayment: number | null;
  dueDate: string | null;
  remainingTerm: string;
  loanTerm: string;
  frequency: string;
  paymentMethod: string;
  status: "Active" | "Paid off";
  progress: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DebtPaymentRecord {
  id: number;
  debtId: number;
  date: string;
  description: string;
  type: string;
  category: string;
  amount: number;
  paymentMethod: string;
  status: string;
  reference: string;
  balanceBefore: number;
  balanceAfter: number;
  createdAt?: string;
}

export interface DebtSummary {
  totalBalance: number;
  totalMinimumPayments: number;
  recordedIncomeThisMonth: number;
  debtToIncomePercent: number | null;
  ratioBasis: string;
  debtToIncomeRatio: Array<{ year: string; income: number; debt: number }>;
  debtBurdenRatio: Array<{ category: string; value: number }>;
}

export interface ReportsPayload {
  period: { startDate: string; endDate: string };
  definitions: Record<string, string>;
  trendAnalysis: Array<{ id: string; data: Array<{ x: string; y: number }> }>;
  financialOverview: Array<{ id: string; data: Array<{ x: string; y: number }> }>;
  spendingBreakdown: Array<Record<string, string | number>>;
  spendingBreakdownKeys: string[];
  budgetComparison: Array<{ category: string; budget: number; actual: number }>;
}

export interface NetWorthAssetRecord {
  id: string;
  source: "wallet" | "emergency-fund" | "investment-reserve" | "actual-investment" | "manual";
  sourceId?: number;
  assetName: string;
  assetType: string;
  currentValue: number;
  currency: string;
  acquisitionDate: string | null;
  description: string;
}

export interface NetWorthLiabilityRecord {
  id: number;
  name: string;
  type: string;
  amount: number;
  interestRate: number | null;
  minimumPayment: number | null;
  dueDate: string | null;
  loanTerm: string;
  status: string;
}

export interface NetWorthSnapshotRecord {
  id: number;
  date: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

export interface NetWorthPayload {
  assets: NetWorthAssetRecord[];
  liabilities: NetWorthLiabilityRecord[];
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  asOfDate: string;
  breakdown: Record<string, number>;
  history: NetWorthSnapshotRecord[];
  historyIsSnapshotBased: boolean;
  assetRules: string[];
}

export interface SettingsPayload {
  displayName: string;
  themeMode: "light" | "dark";
  preferences: {
    dateFormat: AppDateFormat;
    budgetWarningPercent: number;
    budgetCriticalPercent: number;
    notifications: {
      shiftPacing: boolean;
      dailyTarget: boolean;
      leaderboard: boolean;
      budgetAlerts: boolean;
    };
  };
  updatedAt?: string;
  message?: string;
}

export interface AppNotificationRecord {
  id: number;
  key: string;
  title: string;
  message: string;
  level: NotificationLevel;
  route: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActionCenterItem {
  id: string;
  entityType: "bill" | "debt";
  entityId: number;
  title: string;
  message: string;
  dueDate: string;
  severity: "critical" | "warning";
  actionLabel: string;
  route: string;
}

export interface ActionCenterPayload {
  asOfDate: string;
  dueThrough: string;
  count: number;
  items: ActionCenterItem[];
}

export type AppDateFormat = "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd";
