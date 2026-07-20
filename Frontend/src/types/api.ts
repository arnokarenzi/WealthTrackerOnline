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
  emergencyTarget: number;
  efCompletionPct: number;
  seedRatio: number;
  essentials: number;
  shiftStatus: ShiftStatus;
  monthlyBudget: MonthlyBudget;
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

export interface DashboardSummary {
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
